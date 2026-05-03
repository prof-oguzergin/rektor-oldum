/**
 * Rektör Oldum — Leaderboard Modülü (leaderboard.js)
 * Firebase Firestore tabanlı skor tablosu: anonim auth, yazma ve okuma.
 * ES module, Firebase SDK'yı CDN'den dinamik olarak yükler.
 */

import { firebaseConfig } from './firebase-config.js?v=0.4.4';

// ─────────────────────────────────────────────────────────────────────────────
// TEKİL BAŞLATMA
// ─────────────────────────────────────────────────────────────────────────────

let _app  = null;
let _auth = null;
let _db   = null;

/**
 * Firebase'i başlatır (lazy single-init).
 * @returns {{ app, auth, db }}
 */
export async function initFirebase() {
  if (_app) return { app: _app, auth: _auth, db: _db };

  const [{ initializeApp }, { getAuth }, { getFirestore }] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js'),
  ]);

  _app  = initializeApp(firebaseConfig);
  _auth = getAuth(_app);
  _db   = getFirestore(_app);

  return { app: _app, auth: _auth, db: _db };
}

// ─────────────────────────────────────────────────────────────────────────────
// ANONİM KİMLİK DOĞRULAMA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Anonim kullanıcı oturumu açar. Zaten açıksa beklemez.
 * @returns {string} uid
 */
export async function ensureAnonAuth() {
  const { auth } = await initFirebase();

  if (auth.currentUser) return auth.currentUser.uid;

  const { signInAnonymously } = await import('https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js');
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}

// ─────────────────────────────────────────────────────────────────────────────
// SKOR HESAPLAMA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sayısal değer güvenlik filtresi: NaN, Infinity, undefined, null hepsi fallback'e döner.
 */
function _safeNum(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

/**
 * Oyun state'inden skor hesapla.
 * @param {object} state
 * @returns {number} 0-100000 arasında tam sayı
 */
export function calculateScore(state) {
  const prestige = _safeNum(state?.university?.prestige, 0);
  const ranking  = _safeNum(state?.university?.ranking, 50);
  const mezun    = _safeNum(state?.alumniData?.totalGraduates ?? state?.alumni?.length, 0);
  const yil      = _safeNum(state?.meta?.year, 1);

  let score = Math.round(
    prestige * 10
    + (51 - Math.max(1, Math.min(50, ranking))) * 5
    + mezun / 10
    + yil * 2,
  );

  if (_safeNum(state?.university?.budget, 0) < 0) {
    score = Math.round(score * 0.8);
  }

  if (!Number.isFinite(score)) score = 0;
  return Math.max(0, Math.min(100000, score));
}

/**
 * Skor kırılımını açıklayan metin döndürür (modal'da gösterim için).
 * @param {object} state
 * @returns {string[]} Her satır bir kırılım açıklaması
 */
export function scoreBreakdown(state) {
  const prestige = state.university?.prestige ?? 0;
  const ranking  = state.university?.ranking  ?? 50;
  const mezun    = state.alumniData?.totalGraduates ?? state.alumni?.length ?? 0;
  const yil      = state.meta?.year ?? 1;
  const budget   = state.university?.budget ?? 0;

  const lines = [
    `Saygınlık (${prestige}) × 10 = ${prestige * 10} puan`,
    `Sıralama (#${ranking}) bonusu = ${(51 - Math.max(1, Math.min(50, ranking))) * 5} puan`,
    `Mezun (${mezun}) / 10 = ${Math.round(mezun / 10)} puan`,
    `Yıl (${yil}) × 2 = ${yil * 2} puan`,
  ];
  if (budget < 0) lines.push('Bütçe açığı: %20 ceza uygulandı');
  return lines;
}

// ─────────────────────────────────────────────────────────────────────────────
// SKOR YAZMA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Firestore'a skor kaydeder.
 * @param {string} name   Oyuncu adı (1-30 karakter)
 * @param {object} state  Mevcut oyun state'i
 * @returns {string} Eklenen dökümanın ID'si
 */
export async function submitScore(name, state) {
  if (!name || name.trim().length === 0) {
    throw new Error('İsim boş olamaz.');
  }
  const trimmed = name.trim().slice(0, 30);
  const score   = calculateScore(state);

  await ensureAnonAuth();
  const { db } = await initFirebase();

  const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js');

  // Tüm sayısal alanları NaN/undefined'a karşı güvene al (Firestore rules tip kontrolü yapıyor)
  const payload = {
    name:      trimmed,
    score:     _safeNum(score, 0),
    year:      Math.round(_safeNum(state?.meta?.year, 1)),
    rank:      Math.round(_safeNum(state?.university?.ranking, 50)),
    prestige:  Math.round(_safeNum(state?.university?.prestige, 0)),
    createdAt: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(collection(db, 'scores'), payload);
    return docRef.id;
  } catch (err) {
    console.error('[leaderboard] Skor gönderilirken hata:', err, 'payload:', payload);
    let msg;
    if (err?.code === 'permission-denied') {
      msg = 'Skor gönderme reddedildi. Geçersiz veri gönderildi olabilir.';
    } else if (err?.code === 'unauthenticated') {
      msg = 'Anonim oturum açılamadı. Lütfen sayfayı yenileyip tekrar dene.';
    } else if (err?.code === 'unavailable' || /network|offline/i.test(err?.message || '')) {
      msg = 'İnternet bağlantısı yok. Lütfen kontrol edip tekrar dene.';
    } else {
      msg = `Skor gönderilemedi: ${err?.message || err?.code || 'bilinmeyen hata'}`;
    }
    throw new Error(msg);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SKOR OKUMA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Firestore'dan en yüksek skorları çeker.
 * @param {number} limitCount Maksimum kayıt sayısı (varsayılan 50)
 * @returns {Array<object>} Skor listesi (büyükten küçüğe)
 */
export async function getTopScores(limitCount = 50) {
  const { db } = await initFirebase();

  const { collection, query, orderBy, limit, getDocs } = await import(
    'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js'
  );

  try {
    const q = query(
      collection(db, 'scores'),
      orderBy('score', 'desc'),
      limit(limitCount),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d, i) => ({ id: d.id, position: i + 1, ...d.data() }));
  } catch (err) {
    console.error('[leaderboard] Skorlar alınırken hata:', err);
    throw new Error('Skor tablosu yüklenemedi. Lütfen internet bağlantını kontrol et.');
  }
}
