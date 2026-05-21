#!/usr/bin/env node
/**
 * One-shot migration from the single-tenant `ownerUid` model to
 * multi-tenant `kindergartens/{kgId}`.
 *
 * What it does (idempotent):
 *  1. For each admin user in `/users` (role=admin), create a `kindergartens/{kgId}`
 *     doc and a self `staff/{id}` record (claimedByUid = the admin's uid).
 *  2. Stamp `users/{uid}` with kindergartenId + staffRecordId; drop `address`.
 *  3. For each parent user, derive their kindergartenId from the matching
 *     `parents/{id}` record (`claimedByUid == uid`) and stamp the user doc.
 *  4. For every doc in /departments, /children, /parents, /posts, /albums,
 *     /photos, /absences: copy `ownerUid` → `kindergartenId`, then delete the
 *     `ownerUid` field. The mapping ownerUid→kindergartenId is built in step 1.
 *  5. Posts: backfill `authorUid` (= former ownerUid, the admin) and
 *     `authorName` (= admin's displayName).
 *
 * Prereqs:
 *  - `npm install firebase-admin` (devDep)
 *  - GOOGLE_APPLICATION_CREDENTIALS pointing at a service account JSON, OR
 *    pass --service-account=path/to/key.json
 *
 * Usage:
 *   node scripts/migrate-kindergartens.mjs [--dry-run] [--service-account=path]
 */

import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const saArg = args.find((a) => a.startsWith('--service-account='));
const saPath = saArg ? saArg.split('=')[1] : null;

initializeApp({
  credential: saPath
    ? cert(JSON.parse(readFileSync(saPath, 'utf-8')))
    : applicationDefault(),
});

const db = getFirestore();

const COLLECTIONS_WITH_OWNER_UID = [
  'departments',
  'children',
  'parents',
  'albums',
  'photos',
  'absences',
];

const log = (...args) => console.log('[migrate]', ...args);

async function commit(batch, label) {
  if (dryRun) {
    log(`(dry-run) skipping commit for ${label}`);
    return;
  }
  await batch.commit();
  log(`committed: ${label}`);
}

async function ensureKindergartenForAdmin(adminUid, adminDoc) {
  // Check if this admin already has a kindergarten created (idempotency).
  const existing = await db
    .collection('kindergartens')
    .where('createdByUid', '==', adminUid)
    .limit(1)
    .get();

  if (!existing.empty) {
    const kg = existing.docs[0];
    log(`admin ${adminUid}: kindergarten already exists (${kg.id})`);
    return kg.id;
  }

  const kgRef = db.collection('kindergartens').doc();
  const kgData = {
    name: `${adminDoc.displayName || 'Kindergarten'}'s kindergarten`,
    address: adminDoc.address ?? null,
    createdByUid: adminUid,
    createdAt: adminDoc.createdAt ?? Date.now(),
  };
  if (dryRun) {
    log(`(dry-run) would create kindergarten for admin ${adminUid}:`, kgData);
  } else {
    await kgRef.set(kgData);
    log(`created kindergarten ${kgRef.id} for admin ${adminUid}`);
  }
  return kgRef.id;
}

async function ensureSelfStaffRecord(adminUid, adminDoc, kgId) {
  const existing = await db
    .collection('staff')
    .where('claimedByUid', '==', adminUid)
    .where('kindergartenId', '==', kgId)
    .limit(1)
    .get();
  if (!existing.empty) return existing.docs[0].id;

  const displayName = adminDoc.displayName ?? '';
  const parts = displayName.trim().split(/\s+/);
  const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : displayName;
  const lastName = parts.length > 1 ? parts[parts.length - 1] : '';

  const staffRef = db.collection('staff').doc();
  const data = {
    firstName: firstName || 'Admin',
    lastName: lastName || '',
    email: adminDoc.email ?? '',
    phone: null,
    role: 'admin',
    departmentIds: [],
    allDepartments: true,
    kindergartenId: kgId,
    claimedByUid: adminUid,
    createdAt: adminDoc.createdAt ?? Date.now(),
  };
  if (dryRun) {
    log(`(dry-run) would create staff self-record for ${adminUid}`);
  } else {
    await staffRef.set(data);
    log(`created staff self-record ${staffRef.id} for admin ${adminUid}`);
  }
  return staffRef.id;
}

async function migrateAdmins() {
  const usersSnap = await db.collection('users').where('role', '==', 'admin').get();
  const adminToKg = new Map();

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const data = userDoc.data();
    const kgId = await ensureKindergartenForAdmin(uid, data);
    const staffId = await ensureSelfStaffRecord(uid, data, kgId);
    adminToKg.set(uid, kgId);

    const patch = {
      kindergartenId: kgId,
      staffRecordId: staffId,
      address: FieldValue.delete(),
    };
    if (dryRun) {
      log(`(dry-run) would patch users/${uid}:`, patch);
    } else {
      await userDoc.ref.update(patch);
    }
  }
  return adminToKg;
}

async function migrateParents(adminToKg) {
  // Walk parent users, find their parent record, derive kgId.
  const parentUsers = await db.collection('users').where('role', '==', 'parent').get();
  for (const userDoc of parentUsers.docs) {
    const uid = userDoc.id;
    const parentSnap = await db
      .collection('parents')
      .where('claimedByUid', '==', uid)
      .limit(1)
      .get();
    if (parentSnap.empty) {
      log(`parent user ${uid} has no matching parent record — skipping`);
      continue;
    }
    const parent = parentSnap.docs[0].data();
    const ownerUid = parent.ownerUid;
    const kgId = adminToKg.get(ownerUid);
    if (!kgId) {
      log(`parent user ${uid}: owner admin ${ownerUid} has no kindergarten mapping — skipping`);
      continue;
    }
    const patch = {
      kindergartenId: kgId,
      staffRecordId: null,
      address: FieldValue.delete(),
    };
    if (dryRun) {
      log(`(dry-run) would patch users/${uid} (parent):`, patch);
    } else {
      await userDoc.ref.update(patch);
    }
  }
}

async function migrateCollection(coll, adminToKg) {
  const snap = await db.collection(coll).get();
  log(`migrating ${snap.size} docs in /${coll}`);
  const batches = [];
  let batch = db.batch();
  let count = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (!data.ownerUid) {
      // Already migrated (or never had ownerUid).
      continue;
    }
    const kgId = adminToKg.get(data.ownerUid);
    if (!kgId) {
      log(`/${coll}/${docSnap.id}: owner ${data.ownerUid} has no kindergarten — skipping`);
      continue;
    }
    batch.update(docSnap.ref, {
      kindergartenId: kgId,
      ownerUid: FieldValue.delete(),
    });
    count++;
    if (count % 400 === 0) {
      batches.push(batch);
      batch = db.batch();
    }
  }
  batches.push(batch);
  for (const [i, b] of batches.entries()) {
    await commit(b, `${coll} batch ${i + 1}/${batches.length}`);
  }
}

async function backfillPostAuthors(adminToKg) {
  // For posts, copy ownerUid → authorUid and lookup displayName for authorName.
  const snap = await db.collection('posts').get();
  log(`backfilling authors on ${snap.size} posts`);
  // Cache user display names.
  const nameCache = new Map();
  async function nameFor(uid) {
    if (nameCache.has(uid)) return nameCache.get(uid);
    const u = await db.collection('users').doc(uid).get();
    const name = u.exists ? (u.data()?.displayName ?? null) : null;
    nameCache.set(uid, name);
    return name;
  }

  let batch = db.batch();
  let pending = 0;
  for (const p of snap.docs) {
    const data = p.data();
    if (data.authorUid) continue; // already backfilled
    const ownerUid = data.ownerUid ?? null;
    if (!ownerUid) continue;
    const kgId = adminToKg.get(ownerUid);
    if (!kgId) continue;
    const authorName = await nameFor(ownerUid);
    batch.update(p.ref, {
      kindergartenId: kgId,
      authorUid: ownerUid,
      authorName,
      ownerUid: FieldValue.delete(),
    });
    pending++;
    if (pending % 400 === 0) {
      await commit(batch, `posts batch ${pending / 400}`);
      batch = db.batch();
    }
  }
  if (pending > 0) {
    await commit(batch, `posts final batch (${pending % 400})`);
  }
}

async function main() {
  log(`starting migration${dryRun ? ' (dry-run)' : ''}`);
  const adminToKg = await migrateAdmins();
  log(`admin→kindergarten mapping: ${adminToKg.size} entries`);

  await migrateParents(adminToKg);

  for (const coll of COLLECTIONS_WITH_OWNER_UID) {
    await migrateCollection(coll, adminToKg);
  }

  // posts handled separately so we can backfill author fields in the same pass
  await backfillPostAuthors(adminToKg);

  log('done.');
}

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
