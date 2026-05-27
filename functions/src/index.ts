import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';

initializeApp();
const db = getFirestore();

interface UserDoc {
  email?: string;
  displayName?: string | null;
  role?: 'admin' | 'employee' | 'parent';
  kindergartenId?: string | null;
  /** Per-device map: deviceId → token. */
  fcmTokens?: Record<string, string>;
}

interface TokenInfo {
  token: string;
  uid: string;
  deviceId: string;
}

interface ConversationDoc {
  participantIds: string[];
  participantNames: Record<string, string>;
  isGroup: boolean;
  title: string | null;
  kindergartenId: string;
}

interface MessageDoc {
  authorUid: string;
  authorName: string | null;
  text: string;
}

interface PostDoc {
  title: string;
  description: string;
  departmentId: string | null;
  authorUid: string;
  authorName: string | null;
  kindergartenId: string;
}

interface AbsenceDoc {
  childId: string;
  type: 'sick' | 'holiday';
  startDate: string;
  endDate: string;
  kindergartenId: string;
  createdByUid: string;
}

interface ChildDoc {
  firstName: string;
  lastName: string;
  departmentId: string | null;
  parentIds: string[];
  kindergartenId: string;
}

interface ParentDoc {
  claimedByUid: string | null;
  childIds: string[];
  kindergartenId: string;
}

interface StaffDoc {
  role: 'admin' | 'employee';
  claimedByUid: string | null;
  departmentIds: string[];
  allDepartments: boolean;
  kindergartenId: string;
}

interface AlbumDoc {
  name: string;
  departmentId: string;
  kindergartenId: string;
  createdByUid?: string;
}

interface PhotoDoc {
  albumId: string;
  storagePath: string;
  downloadUrl: string;
  kindergartenId: string;
  uploadedByUid: string;
  uploadedAt: number;
}

/**
 * Read each uid's /users/{uid}.fcmTokens map and flatten into a list of
 * { token, uid, deviceId } records — deduped by token. Tolerates legacy
 * array-shaped fcmTokens so old docs don't break sends.
 */
async function tokensForUids(uids: string[]): Promise<TokenInfo[]> {
  if (uids.length === 0) return [];
  const unique = Array.from(new Set(uids));
  const refs = unique.map((u) => db.collection('users').doc(u));
  const snaps = await db.getAll(...refs);
  const seen = new Set<string>();
  const out: TokenInfo[] = [];
  for (const snap of snaps) {
    if (!snap.exists) continue;
    const data = snap.data() as UserDoc | undefined;
    const tokens = data?.fcmTokens;
    if (!tokens) continue;
    // Map shape (new): { deviceId: token }
    if (typeof tokens === 'object' && !Array.isArray(tokens)) {
      for (const [deviceId, token] of Object.entries(tokens)) {
        if (!token || seen.has(token)) continue;
        seen.add(token);
        out.push({ token, uid: snap.id, deviceId });
      }
    } else if (Array.isArray(tokens)) {
      // Legacy shape (array). No deviceId available; pass an empty string so
      // pruning falls back to removing the whole entry. Safe enough until any
      // remaining legacy arrays roll over.
      for (const token of tokens as string[]) {
        if (!token || seen.has(token)) continue;
        seen.add(token);
        out.push({ token, uid: snap.id, deviceId: '' });
      }
    }
  }
  return out;
}

/**
 * After sending, scrub invalid/unregistered tokens from the owning user docs
 * so they don't accumulate indefinitely. Removes by deviceId key when known.
 */
async function pruneInvalidTokens(
  response: { responses: { success: boolean; error?: { code?: string } }[] },
  infos: TokenInfo[],
): Promise<void> {
  const deleteFieldsByUser = new Map<string, Record<string, FirebaseFirestore.FieldValue>>();
  response.responses.forEach((r, i) => {
    if (r.success) return;
    const code = r.error?.code ?? '';
    if (
      code !== 'messaging/invalid-registration-token' &&
      code !== 'messaging/registration-token-not-registered'
    ) return;
    const info = infos[i];
    if (!info?.deviceId) return; // legacy array entries: skip targeted prune
    const fields = deleteFieldsByUser.get(info.uid) ?? {};
    fields[`fcmTokens.${info.deviceId}`] = FieldValue.delete();
    deleteFieldsByUser.set(info.uid, fields);
  });
  if (deleteFieldsByUser.size === 0) return;
  const batch = db.batch();
  for (const [uid, fields] of deleteFieldsByUser) {
    batch.update(db.collection('users').doc(uid), fields);
  }
  await batch.commit();
}

async function sendMulticast(
  infos: TokenInfo[],
  payload: Omit<MulticastMessage, 'tokens'>,
): Promise<void> {
  if (infos.length === 0) return;
  const tokens = infos.map((i) => i.token);
  try {
    const res = await getMessaging().sendEachForMulticast({ ...payload, tokens });
    logger.info('push.sent', { ok: res.successCount, fail: res.failureCount });
    if (res.failureCount > 0) await pruneInvalidTokens(res, infos);
  } catch (err) {
    logger.error('push.sendFailed', err);
  }
}

// ===========================================================================
// 1) New chat message → notify other participants
// ===========================================================================
export const onMessageCreate = onDocumentCreated(
  'conversations/{cid}/messages/{mid}',
  async (event) => {
    const msg = event.data?.data() as MessageDoc | undefined;
    if (!msg) return;
    const convSnap = await db.collection('conversations').doc(event.params.cid).get();
    if (!convSnap.exists) return;
    const conv = convSnap.data() as ConversationDoc;

    const recipients = conv.participantIds.filter((uid) => uid !== msg.authorUid);
    const infos = await tokensForUids(recipients);

    const senderName = msg.authorName ?? conv.participantNames[msg.authorUid] ?? 'New message';
    const title = conv.isGroup ? (conv.title ?? 'Group') + ' · ' + senderName : senderName;

    await sendMulticast(infos, {
      data: {
        type: 'message',
        conversationId: event.params.cid,
        title,
        body: msg.text.slice(0, 140),
        url: `/messages/${event.params.cid}`,
      },
    });
  },
);

// ===========================================================================
// 2) New post → notify staff (any) + parents whose children are in the dept
// ===========================================================================
export const onPostCreate = onDocumentCreated('posts/{id}', async (event) => {
  const post = event.data?.data() as PostDoc | undefined;
  if (!post) return;

  // Staff in same kindergarten (admin + employee). User spec: admin does not
  // receive post notifications, so filter to employees only.
  const staffSnap = await db
    .collection('staff')
    .where('kindergartenId', '==', post.kindergartenId)
    .where('role', '==', 'employee')
    .get();
  const staffUids = staffSnap.docs
    .map((d) => (d.data() as StaffDoc).claimedByUid)
    .filter((u): u is string => !!u && u !== post.authorUid);

  // Parents whose children are in the relevant department (or broadcast).
  let parentUids: string[] = [];
  const parentsSnap = await db
    .collection('parents')
    .where('kindergartenId', '==', post.kindergartenId)
    .get();
  const parentDocs = parentsSnap.docs.map((d) => ({ id: d.id, data: d.data() as ParentDoc }));

  if (post.departmentId === null) {
    parentUids = parentDocs
      .map((p) => p.data.claimedByUid)
      .filter((u): u is string => !!u && u !== post.authorUid);
  } else {
    // Need to fetch children to know which parents belong to this department.
    const childrenSnap = await db
      .collection('children')
      .where('kindergartenId', '==', post.kindergartenId)
      .where('departmentId', '==', post.departmentId)
      .get();
    const eligibleChildIds = new Set(childrenSnap.docs.map((d) => d.id));
    parentUids = parentDocs
      .filter((p) => p.data.childIds.some((cid) => eligibleChildIds.has(cid)))
      .map((p) => p.data.claimedByUid)
      .filter((u): u is string => !!u && u !== post.authorUid);
  }

  const recipients = Array.from(new Set([...staffUids, ...parentUids]));
  const infos = await tokensForUids(recipients);

  await sendMulticast(infos, {
    data: {
      type: 'post',
      postId: event.params.id,
      title: post.title,
      body: post.authorName ? `Posted by ${post.authorName}` : 'New post',
      url: '/posts',
    },
  });
});

// ===========================================================================
// 3) New absence (sick only) → notify staff with access to the child's dept
// ===========================================================================
export const onAbsenceCreate = onDocumentCreated('absences/{id}', async (event) => {
  const absence = event.data?.data() as AbsenceDoc | undefined;
  if (!absence || absence.type !== 'sick') return;

  const childSnap = await db.collection('children').doc(absence.childId).get();
  if (!childSnap.exists) return;
  const child = childSnap.data() as ChildDoc;

  // Find staff (employee role) whose departments include the child's dept,
  // or who have allDepartments=true.
  const staffSnap = await db
    .collection('staff')
    .where('kindergartenId', '==', absence.kindergartenId)
    .where('role', '==', 'employee')
    .get();
  const staffUids: string[] = [];
  for (const s of staffSnap.docs) {
    const data = s.data() as StaffDoc;
    if (!data.claimedByUid || data.claimedByUid === absence.createdByUid) continue;
    if (
      data.allDepartments ||
      (child.departmentId !== null && data.departmentIds.includes(child.departmentId))
    ) {
      staffUids.push(data.claimedByUid);
    }
  }

  const infos = await tokensForUids(staffUids);

  await sendMulticast(infos, {
    data: {
      type: 'sick',
      absenceId: event.params.id,
      title: 'Sick report',
      body: `${child.firstName} ${child.lastName} · ${absence.startDate} → ${absence.endDate}`,
      url: '/home',
    },
  });
});

// ===========================================================================
// 4) New album → notify parents in the dept + employees with dept access
// ===========================================================================
export const onAlbumCreate = onDocumentCreated('albums/{id}', async (event) => {
  const album = event.data?.data() as AlbumDoc | undefined;
  if (!album) return;

  // Employees with access to this department (allDepartments or specific).
  const staffSnap = await db
    .collection('staff')
    .where('kindergartenId', '==', album.kindergartenId)
    .where('role', '==', 'employee')
    .get();
  const staffUids: string[] = [];
  for (const s of staffSnap.docs) {
    const data = s.data() as StaffDoc;
    if (!data.claimedByUid || data.claimedByUid === album.createdByUid) continue;
    if (data.allDepartments || data.departmentIds.includes(album.departmentId)) {
      staffUids.push(data.claimedByUid);
    }
  }

  // Parents whose children are in this album's department.
  const childrenSnap = await db
    .collection('children')
    .where('kindergartenId', '==', album.kindergartenId)
    .where('departmentId', '==', album.departmentId)
    .get();
  const eligibleChildIds = new Set(childrenSnap.docs.map((d) => d.id));

  const parentsSnap = await db
    .collection('parents')
    .where('kindergartenId', '==', album.kindergartenId)
    .get();
  const parentUids = parentsSnap.docs
    .map((d) => d.data() as ParentDoc)
    .filter((p) => p.childIds.some((cid) => eligibleChildIds.has(cid)))
    .map((p) => p.claimedByUid)
    .filter((u): u is string => !!u && u !== album.createdByUid);

  const recipients = Array.from(new Set([...staffUids, ...parentUids]));
  const infos = await tokensForUids(recipients);

  await sendMulticast(infos, {
    data: {
      type: 'album',
      albumId: event.params.id,
      title: 'New album',
      body: album.name,
      url: '/albums',
    },
  });
});

// ===========================================================================
// 5) New photo in an album → notify dept employees + parents in that dept.
// Tag the web-push notification by albumId so multiple uploads to the same
// album collapse to a single on-screen notification.
// ===========================================================================
export const onPhotoCreate = onDocumentCreated('photos/{id}', async (event) => {
  const photo = event.data?.data() as PhotoDoc | undefined;
  if (!photo) return;

  const albumSnap = await db.collection('albums').doc(photo.albumId).get();
  if (!albumSnap.exists) return;
  const album = albumSnap.data() as AlbumDoc;

  // Employees with access to this album's department.
  const staffSnap = await db
    .collection('staff')
    .where('kindergartenId', '==', album.kindergartenId)
    .where('role', '==', 'employee')
    .get();
  const staffUids: string[] = [];
  for (const s of staffSnap.docs) {
    const data = s.data() as StaffDoc;
    if (!data.claimedByUid || data.claimedByUid === photo.uploadedByUid) continue;
    if (data.allDepartments || data.departmentIds.includes(album.departmentId)) {
      staffUids.push(data.claimedByUid);
    }
  }

  // Parents whose children are in this album's department.
  const childrenSnap = await db
    .collection('children')
    .where('kindergartenId', '==', album.kindergartenId)
    .where('departmentId', '==', album.departmentId)
    .get();
  const eligibleChildIds = new Set(childrenSnap.docs.map((d) => d.id));

  const parentsSnap = await db
    .collection('parents')
    .where('kindergartenId', '==', album.kindergartenId)
    .get();
  const parentUids = parentsSnap.docs
    .map((d) => d.data() as ParentDoc)
    .filter((p) => p.childIds.some((cid) => eligibleChildIds.has(cid)))
    .map((p) => p.claimedByUid)
    .filter((u): u is string => !!u && u !== photo.uploadedByUid);

  const recipients = Array.from(new Set([...staffUids, ...parentUids]));
  const infos = await tokensForUids(recipients);

  await sendMulticast(infos, {
    data: {
      type: 'album',
      albumId: photo.albumId,
      title: album.name,
      body: 'New photo added',
      url: '/albums',
      // Web push collapses notifications with the same tag — burst uploads
      // turn into one notification on screen.
      tag: `album-${photo.albumId}`,
    },
  });
});
