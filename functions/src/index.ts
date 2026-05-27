import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
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

// ===========================================================================
// 6) Send a branded claim invite email.
//
// The default Firebase email-link template can't be customized, so instead of
// the client calling sendSignInLinkToEmail, an admin calls this function. It
// generates the same passwordless /claim sign-in link with the Admin SDK and
// queues a branded email via the "Trigger Email" extension (writes to /mail).
// ===========================================================================

type Lang = 'en' | 'al';

interface InviteRequest {
  email?: string;
  lang?: Lang;
  origin?: string;
}

interface InviteRecord {
  firstName?: string;
  claimedByUid?: string | null;
  lastInviteSentAt?: number;
}

// Minimum gap between re-sending an invite to the same person — blocks
// double-clicks and abuse loops that would burn the SMTP daily quota.
const INVITE_COOLDOWN_MS = 60_000;

export const sendClaimInvite = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const data = (request.data ?? {}) as InviteRequest;
  const email = (data.email ?? '').trim().toLowerCase();
  const lang: Lang = data.lang === 'al' ? 'al' : 'en';
  const origin = (data.origin ?? '').replace(/\/+$/, '');
  if (!email || !origin) {
    throw new HttpsError('invalid-argument', 'Email and origin are required.');
  }

  // Caller must be an admin with a kindergarten.
  const callerSnap = await db.collection('users').doc(callerUid).get();
  const caller = callerSnap.data() as UserDoc | undefined;
  if (!caller || caller.role !== 'admin' || !caller.kindergartenId) {
    throw new HttpsError('permission-denied', 'Only admins can send invites.');
  }
  const kgId = caller.kindergartenId;

  // The email must match an unclaimed staff/parent invite in the admin's kg —
  // this both personalizes the email and stops the endpoint being used to send
  // mail to arbitrary addresses.
  const [staffSnap, parentSnap] = await Promise.all([
    db.collection('staff')
      .where('kindergartenId', '==', kgId)
      .where('email', '==', email)
      .limit(1)
      .get(),
    db.collection('parents')
      .where('kindergartenId', '==', kgId)
      .where('email', '==', email)
      .limit(1)
      .get(),
  ]);
  const recordSnap = staffSnap.docs[0] ?? parentSnap.docs[0];
  if (!recordSnap) {
    throw new HttpsError('not-found', 'No invite found for that email in your kindergarten.');
  }
  const record = recordSnap.data() as InviteRecord;
  if (record.claimedByUid) {
    throw new HttpsError('failed-precondition', 'This account has already been claimed.');
  }

  // Rate-limit re-sends to the same invitee.
  const sinceLast = Date.now() - (record.lastInviteSentAt ?? 0);
  if (sinceLast < INVITE_COOLDOWN_MS) {
    const wait = Math.ceil((INVITE_COOLDOWN_MS - sinceLast) / 1000);
    throw new HttpsError(
      'resource-exhausted',
      `An invite was just sent. Please wait ${wait}s before resending.`,
    );
  }

  // Kindergarten name for branding.
  const kgSnap = await db.collection('kindergartens').doc(kgId).get();
  const kgName = (kgSnap.data()?.name as string | undefined)?.trim() || 'your kindergarten';

  // Generate the passwordless sign-in link (we email it ourselves).
  const continueUrl = `${origin}/claim?email=${encodeURIComponent(email)}`;
  const link = await getAuth().generateSignInWithEmailLink(email, {
    url: continueUrl,
    handleCodeInApp: true,
  });

  const message = buildInviteEmail(lang, {
    kgName,
    firstName: record.firstName?.trim() ?? '',
    link,
  });
  await db.collection('mail').add({ to: email, message });
  await recordSnap.ref.update({ lastInviteSentAt: Date.now() });

  logger.info('invite.queued', { kgId, email });
  return { ok: true as const };
});

// ===========================================================================
// 7) Admin self sign-up (email-link claim flow).
//
// Public endpoint. Instead of creating an account up front, it stores a small
// pendingAdminSignups doc and emails a claim link. Nothing real (kindergarten /
// auth user / staff record) exists until the person proves the email by
// clicking the link — the /claim page then materializes everything. Protect
// this with App Check before launch.
// ===========================================================================

interface AdminSignupRequest {
  email?: string;
  displayName?: string;
  kindergartenName?: string;
  address?: string;
  lang?: Lang;
  origin?: string;
}

interface PendingAdminSignup {
  email: string;
  displayName: string;
  kindergartenName: string;
  address: string;
  lang: Lang;
  createdAt: number;
  lastInviteSentAt?: number;
}

export const requestAdminSignup = onCall(async (request) => {
  const data = (request.data ?? {}) as AdminSignupRequest;
  const email = (data.email ?? '').trim().toLowerCase();
  const displayName = (data.displayName ?? '').trim();
  const kindergartenName = (data.kindergartenName ?? '').trim();
  const address = (data.address ?? '').trim();
  const lang: Lang = data.lang === 'al' ? 'al' : 'en';
  const origin = (data.origin ?? '').replace(/\/+$/, '');
  if (!email || !displayName || !kindergartenName || !origin) {
    throw new HttpsError('invalid-argument', 'Missing required fields.');
  }

  // Reject if a real account already exists for this email (auth user that has
  // a /users profile = fully set up). A passwordless auth user with no profile
  // (clicked a link but never finished) is allowed to retry.
  try {
    const existing = await getAuth().getUserByEmail(email);
    const profile = await db.collection('users').doc(existing.uid).get();
    if (profile.exists) {
      throw new HttpsError(
        'already-exists',
        'An account with this email already exists. Please sign in.',
      );
    }
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    // auth/user-not-found → no account yet, continue.
  }

  // One pending signup per email (idempotent + dedupe, with resend cooldown).
  const pendingCol = db.collection('pendingAdminSignups');
  const existingSnap = await pendingCol.where('email', '==', email).limit(1).get();
  let ref: FirebaseFirestore.DocumentReference;
  if (!existingSnap.empty) {
    ref = existingSnap.docs[0].ref;
    const prev = existingSnap.docs[0].data() as PendingAdminSignup;
    const sinceLast = Date.now() - (prev.lastInviteSentAt ?? 0);
    if (sinceLast < INVITE_COOLDOWN_MS) {
      const wait = Math.ceil((INVITE_COOLDOWN_MS - sinceLast) / 1000);
      throw new HttpsError(
        'resource-exhausted',
        `A confirmation email was just sent. Please wait ${wait}s before retrying.`,
      );
    }
    await ref.update({ displayName, kindergartenName, address, lang, lastInviteSentAt: Date.now() });
  } else {
    ref = await pendingCol.add({
      email,
      displayName,
      kindergartenName,
      address,
      lang,
      createdAt: Date.now(),
      lastInviteSentAt: Date.now(),
    } satisfies PendingAdminSignup);
  }

  // Generate the claim sign-in link (does not create the user — that happens
  // when they click it).
  const continueUrl = `${origin}/claim?email=${encodeURIComponent(email)}`;
  const link = await getAuth().generateSignInWithEmailLink(email, {
    url: continueUrl,
    handleCodeInApp: true,
  });

  const message = buildInviteEmail(lang, { kgName: kindergartenName, firstName: displayName, link }, 'signup');
  await db.collection('mail').add({ to: email, message });

  logger.info('adminSignup.queued', { email });
  return { ok: true as const };
});

type EmailKind = 'invite' | 'signup';

function buildInviteEmail(
  lang: Lang,
  v: { kgName: string; firstName: string; link: string },
  kind: EmailKind = 'invite',
): { subject: string; html: string; text: string } {
  const greeting =
    lang === 'al'
      ? v.firstName
        ? `Përshëndetje ${v.firstName},`
        : 'Përshëndetje,'
      : v.firstName
        ? `Hello ${v.firstName},`
        : 'Hello,';

  const copy =
    kind === 'signup'
      ? lang === 'al'
        ? {
            subject: `Konfirmoni email-in për ${v.kgName}`,
            intro: `Jeni duke krijuar <strong>${v.kgName}</strong>. Konfirmoni email-in tuaj për të përfunduar dhe vendosur fjalëkalimin.`,
            button: 'Konfirmo & vazhdo',
          }
        : {
            subject: `Confirm your email for ${v.kgName}`,
            intro: `You're setting up <strong>${v.kgName}</strong>. Confirm your email to finish and set your password.`,
            button: 'Confirm & continue',
          }
      : lang === 'al'
        ? {
            subject: `Ftesë për t'u bashkuar me ${v.kgName}`,
            intro: `<strong>${v.kgName}</strong> ju ka ftuar të aktivizoni llogarinë tuaj.`,
            button: 'Aktivizo llogarinë',
          }
        : {
            subject: `You're invited to join ${v.kgName}`,
            intro: `<strong>${v.kgName}</strong> has invited you to set up your account.`,
            button: 'Set up your account',
          };

  const t = {
    ...copy,
    greeting,
    fallback:
      lang === 'al' ? 'Ose kopjoni këtë lidhje në shfletues:' : 'Or paste this link into your browser:',
    ignore:
      lang === 'al'
        ? 'Nëse nuk e prisnit këtë email, mund ta injoroni.'
        : "If you weren't expecting this email, you can safely ignore it.",
  };

  const text = `${t.greeting}\n\n${v.kgName} — ${t.button}\n\n${v.link}\n\n${t.ignore}`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f5f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f8;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:#3880ff;padding:24px 28px;color:#ffffff;font-size:18px;font-weight:600;">
                ${escapeHtml(v.kgName)}
              </td>
            </tr>
            <tr>
              <td style="padding:28px;color:#1f2937;font-size:15px;line-height:1.6;">
                <p style="margin:0 0 12px;">${t.greeting}</p>
                <p style="margin:0 0 24px;">${t.intro}</p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                  <tr>
                    <td align="center" style="border-radius:8px;background:#3880ff;">
                      <a href="${v.link}" style="display:inline-block;padding:13px 28px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">${t.button}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 6px;color:#6b7280;font-size:13px;">${t.fallback}</p>
                <p style="margin:0 0 24px;word-break:break-all;font-size:12px;"><a href="${v.link}" style="color:#3880ff;">${escapeHtml(v.link)}</a></p>
                <p style="margin:0;color:#9ca3af;font-size:12px;">${t.ignore}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject: t.subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
