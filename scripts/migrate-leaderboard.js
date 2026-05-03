#!/usr/bin/env node
/**
 * Rektör Oldum — Leaderboard Migration v0.4.27
 *
 * Eski format (`uid_gameId` doc id, kullanıcı başına N kayıt) → yeni format
 * (`uid` doc id, kullanıcı başına TEK en iyi kayıt).
 *
 * R-Fatih önerisi: leaderboard'da kullanıcı başına yalnızca en iyi skor tutulsun.
 *
 * KULLANIM:
 *   1) Firebase Console > Project Settings > Service Accounts >
 *      "Generate new private key" → service-account.json indir
 *   2) Bu repo dizininden:
 *        npm i firebase-admin
 *        node scripts/migrate-leaderboard.js path/to/service-account.json
 *      Default yol: ./service-account.json
 *   3) Script önce DRY-RUN raporu basar; onaylarsan yazma adımına geçer.
 *
 * GÜVENLIK:
 *   - Bu script Admin SDK kullanır; Firestore Rules onu BYPASS eder.
 *   - Service account JSON repo'ya commit edilmemeli (.gitignore'da).
 *   - Tek seferlik bir araçtır; çalıştırdıktan sonra dosyayı silebilirsin.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import admin from 'firebase-admin';

const SERVICE_ACCOUNT_PATH = process.argv[2] || './service-account.json';

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(question, (a) => { rl.close(); res(a.trim()); }));
}

async function main() {
  const accountPath = resolve(SERVICE_ACCOUNT_PATH);
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(readFileSync(accountPath, 'utf-8'));
  } catch (err) {
    console.error(`Service account JSON okunamadi: ${accountPath}`);
    console.error('Firebase Console > Project Settings > Service Accounts > Generate new private key');
    process.exit(1);
  }

  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();
  console.log(`Bagli proje: ${serviceAccount.project_id}\n`);

  // ─── 1. ADIM: Mevcut belgeleri oku ─────────────────────────────────────────
  const snap = await db.collection('scores').get();
  const allDocs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  console.log(`Toplam belge: ${allDocs.length}`);

  const oldFormat = allDocs.filter((d) => d.id.includes('_'));
  const newFormat = allDocs.filter((d) => !d.id.includes('_'));
  console.log(`  Eski format (uid_gameId): ${oldFormat.length}`);
  console.log(`  Yeni format (uid):        ${newFormat.length}`);

  if (oldFormat.length === 0) {
    console.log('\nMigration gereksiz — tüm belgeler zaten yeni formatta.');
    return;
  }

  // ─── 2. ADIM: Her uid için en iyi skoru bul ────────────────────────────────
  const bestPerUid = new Map();
  for (const d of allDocs) {
    const uid = d.data.uid;
    if (!uid) {
      console.warn(`  UYARI: ${d.id} icinde uid yok, atlandi`);
      continue;
    }
    const score = Number(d.data.score) || 0;
    const existing = bestPerUid.get(uid);
    if (!existing || score > Number(existing.data.score || 0)) {
      bestPerUid.set(uid, d);
    }
  }
  console.log(`Benzersiz oyuncu: ${bestPerUid.size}`);
  console.log(`Silinecek belge: ${allDocs.length - bestPerUid.size}`);
  console.log();

  // ─── 3. ADIM: Plan raporu ──────────────────────────────────────────────────
  console.log('Plan:');
  for (const [uid, d] of bestPerUid) {
    const target = uid; // yeni doc id
    const isMove = d.id !== target;
    const tag = isMove ? '[TASI]' : '[OK  ]';
    const name = (d.data.name || '?').padEnd(28).slice(0, 28);
    console.log(`  ${tag} ${name} ${String(d.data.score).padStart(6)} puan  ${d.id} -> ${target}`);
  }
  console.log();

  // ─── 4. ADIM: Onay iste ────────────────────────────────────────────────────
  const ans = await ask(`Devam edilsin mi? Bu islem ${oldFormat.length} eski belgeyi silip ${bestPerUid.size} yeni belge yazar. [evet/hayir]: `);
  if (ans.toLowerCase() !== 'evet') {
    console.log('Iptal edildi.');
    return;
  }

  // ─── 5. ADIM: Yazma + silme (batch ile) ────────────────────────────────────
  // Firestore batch limiti 500 op. 51 belge × ~2 op (write + delete) = 102, sigar.
  const batch = db.batch();
  let writeCount = 0;
  let deleteCount = 0;

  // Önce her uid için yeni belge yaz (en iyi skoru uid doc id'ye)
  for (const [uid, d] of bestPerUid) {
    const targetRef = db.collection('scores').doc(uid);
    const payload = {
      uid,
      gameId:    String(d.data.gameId || 'migrated').slice(0, 100),
      name:      String(d.data.name || 'Anonim Rektör').slice(0, 30),
      score:     Number(d.data.score) || 0,
      year:      Number(d.data.year) || 1,
      rank:      Number(d.data.rank) || 50,
      prestige:  Number(d.data.prestige) || 0,
      // createdAt'i koru — ayni belge ise (overwrite)
      createdAt: d.data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
    };
    batch.set(targetRef, payload);
    writeCount++;
  }

  // Sonra eski formatlı belgeleri sil (yeni format ile çakışmıyorsa)
  for (const d of oldFormat) {
    // Eski belgeyi sil — yeni doc id (uid) ile farklı olduğu icin guvenli
    if (!bestPerUid.has(d.id)) {  // yeni formatlı zaten target değil
      batch.delete(db.collection('scores').doc(d.id));
      deleteCount++;
    }
  }

  console.log(`\nBatch hazir: ${writeCount} yazma + ${deleteCount} silme`);
  await batch.commit();
  console.log('Migration tamamlandi.\n');

  // ─── 6. ADIM: Doğrulama ────────────────────────────────────────────────────
  const verify = await db.collection('scores').get();
  const verifyDocs = verify.docs.map((d) => d.id);
  const stillOld = verifyDocs.filter((id) => id.includes('_'));
  console.log(`Dogrulama: ${verify.size} belge kaldi (${stillOld.length} eski format)`);
  if (stillOld.length === 0) {
    console.log('Tum belgeler yeni formatta. Migration basarili.');
  } else {
    console.warn(`UYARI: Hala eski formatta ${stillOld.length} belge var. Manuel inceleme gerek.`);
    stillOld.slice(0, 10).forEach((id) => console.warn(`  - ${id}`));
  }
}

main().catch((err) => {
  console.error('Hata:', err);
  process.exit(1);
});
