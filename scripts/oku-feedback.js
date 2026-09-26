#!/usr/bin/env node
/**
 * Rektör Oldum: öneri/şikâyet kayıtlarını okur (v0.7.1)
 *
 * Oyundaki "Bildir" penceresi iletileri Firestore'daki `feedback` koleksiyonuna yazar.
 * Kurallar bu koleksiyonun okunmasını kapatır; betik Admin SDK ile okur (Admin SDK
 * kuralları aşar) ve kayıtları tarih sırasıyla yazar. Hiçbir şey yazmaz ya da silmez.
 *
 * KULLANIM:
 *   1) Firebase Console > Project Settings > Service Accounts > "Generate new private key"
 *      ile inen dosyayı scripts/service-account.json adıyla sakla (depo kökü de olur).
 *      Dosya .gitignore'da; depoya girmez, kimseyle paylaşma.
 *   2) Depo kökünde bir kez:  npm i firebase-admin
 *   3) node scripts/oku-feedback.js [seçenekler] [hizmet-hesabı.json]
 *        --son N     yalnız en yeni N kayıt (varsayılan hepsi)
 *        --tur T     yalnız hata | oneri | baska
 *        --json      JSON olarak yaz (başka araca aktarmak için)
 *
 * Firebase Console'dan okumak için: Firestore Database > Data > feedback.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BURASI = dirname(fileURLToPath(import.meta.url));
const TURLER = { hata: 'Hata', oneri: 'Öneri', baska: 'Başka' };

function secenekleriOku(argv) {
  const s = { son: 0, tur: null, json: false, hesap: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--son') s.son = Math.max(0, parseInt(argv[++i], 10) || 0);
    else if (a === '--tur') s.tur = argv[++i] || null;
    else if (a === '--json') s.json = true;
    else if (a === '--yardim' || a === '-h' || a === '--help') s.yardim = true;
    else s.hesap = a;
  }
  return s;
}

function hesapDosyasiBul(verilen) {
  const adaylar = verilen
    ? [resolve(verilen)]
    : [resolve(BURASI, 'service-account.json'), resolve(BURASI, '..', 'service-account.json')];
  return { yol: adaylar.find(p => existsSync(p)) || null, adaylar };
}

function tarihYaz(ts) {
  const d = ts?.toDate ? ts.toDate() : null;
  return d ? d.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '(tarih yok)';
}

async function main() {
  const s = secenekleriOku(process.argv.slice(2));
  if (s.yardim) {
    console.log('Kullanım: node scripts/oku-feedback.js [--son N] [--tur hata|oneri|baska] [--json] [hizmet-hesabı.json]');
    return;
  }
  if (s.tur && !TURLER[s.tur]) {
    console.error(`Bilinmeyen tür: ${s.tur} (hata, oneri ya da baska olmalı)`);
    process.exit(1);
  }

  const { yol, adaylar } = hesapDosyasiBul(s.hesap);
  if (!yol) {
    console.error('Hizmet hesabı dosyası bulunamadı. Bakılan yerler:');
    adaylar.forEach(p => console.error(`  - ${p}`));
    console.error('\nNe yapmalı:');
    console.error('  1) Firebase Console > Project Settings > Service Accounts > "Generate new private key"');
    console.error('  2) İnen dosyayı scripts/service-account.json olarak kaydet (.gitignore\'da, depoya girmez)');
    console.error('  3) npm i firebase-admin   (depo kökünde, bir kez)');
    console.error('  4) node scripts/oku-feedback.js');
    console.error('\nBetik olmadan: Firebase Console > Firestore Database > Data > feedback.');
    process.exit(1);
  }

  let admin;
  try {
    admin = (await import('firebase-admin')).default;
  } catch (err) {
    console.error('firebase-admin paketi yok. Depo kökünde bir kez çalıştır:  npm i firebase-admin');
    process.exit(1);
  }

  let hesap;
  try {
    hesap = JSON.parse(readFileSync(yol, 'utf-8'));
  } catch (err) {
    console.error(`Hizmet hesabı dosyası okunamadı: ${yol}\n${err.message}`);
    process.exit(1);
  }

  admin.initializeApp({ credential: admin.credential.cert(hesap) });
  const db = admin.firestore();

  // Tarih sırasıyla (eskiden yeniye). Tür süzgeci bellekte uygulanır: bileşik dizin gerekmesin.
  const snap = await db.collection('feedback').orderBy('createdAt', 'asc').get();
  let kayitlar = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (s.tur) kayitlar = kayitlar.filter(k => k.tur === s.tur);
  if (s.son) kayitlar = kayitlar.slice(-s.son);

  if (s.json) {
    const duz = kayitlar.map(k => ({ ...k, createdAt: k.createdAt?.toDate ? k.createdAt.toDate().toISOString() : null }));
    console.log(JSON.stringify(duz, null, 2));
    return;
  }

  console.log(`Proje: ${hesap.project_id} | feedback: ${snap.size} kayıt${s.tur || s.son ? `, gösterilen ${kayitlar.length}` : ''}\n`);
  for (const k of kayitlar) {
    const b = k.baglam || {};
    const oyun = b.yil ? `${b.yil}. yıl ${b.donem || ''}`.trim() : 'oyun yok';
    console.log(`── ${tarihYaz(k.createdAt)} · ${TURLER[k.tur] || k.tur} · ${k.id}`);
    console.log(`   Sürüm ${b.surum || '?'} · ${oyun} · ${b.tip || '?'} · ${b.senaryo || '?'} · ${b.ekran || '?'} · ${b.tarayici || '?'}`);
    if (k.iletisim) console.log(`   İletişim: ${k.iletisim}`);
    console.log(`   uid: ${k.uid}`);
    console.log(String(k.ileti || '').split('\n').map(s2 => `   | ${s2}`).join('\n'));
    console.log();
  }
}

main().catch((err) => {
  console.error('Hata:', err?.message || err);
  process.exit(1);
});
