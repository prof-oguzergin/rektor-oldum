/**
 * Rektör Oldum — Leaderboard Modülü (leaderboard.js)
 * Firebase Firestore tabanlı skor tablosu: anonim auth, yazma ve okuma.
 * ES module, Firebase SDK'yı CDN'den dinamik olarak yükler.
 */

import { firebaseConfig, APP_CHECK_SITE_KEY } from './firebase-config.js?v=0.4.27';

// ─────────────────────────────────────────────────────────────────────────────
// TEKİL BAŞLATMA
// ─────────────────────────────────────────────────────────────────────────────

let _app  = null;
let _auth = null;
let _db   = null;

// Çevrimiçi liderlik tablosunun geçici olarak kullanılamadığı durumlar
// (Firebase Console: Anonymous auth kapalı, API key geçersiz, Identity Toolkit
//  API'si aktif değil). UI bu durumda skoru lokal yedekleyip "bakımda" mesajı gösterir.
const _UNAVAILABLE_CODES = new Set([
  'auth/api-key-not-valid',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.',
  'auth/operation-not-allowed',
  'auth/admin-restricted-operation',
  'auth/configuration-not-found',
  'auth/network-request-failed',
]);

export function isLeaderboardUnavailable(err) {
  if (!err) return false;
  const code = String(err.code || '').toLowerCase();
  if (_UNAVAILABLE_CODES.has(code)) return true;
  // Bazı SDK sürümleri code'u boş bırakıp message'a koyuyor
  const msg = String(err.message || '').toLowerCase();
  return /api-key-not-valid|operation-not-allowed|admin-restricted|configuration-not-found/.test(msg);
}

const _LOCAL_SCORE_KEY = 'rektor_oldum_local_scores';

export function saveLocalScore(entry) {
  try {
    const list = JSON.parse(localStorage.getItem(_LOCAL_SCORE_KEY) || '[]');
    list.push({ ...entry, savedAt: new Date().toISOString() });
    list.sort((a, b) => (b.score || 0) - (a.score || 0));
    localStorage.setItem(_LOCAL_SCORE_KEY, JSON.stringify(list.slice(0, 100)));
  } catch (e) {
    console.warn('[leaderboard] Lokal skor yedeklenemedi:', e);
  }
}

export function getLocalScores() {
  try {
    return JSON.parse(localStorage.getItem(_LOCAL_SCORE_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

/**
 * Firebase'i başlatır (lazy single-init).
 * APP_CHECK_SITE_KEY tanımlıysa App Check (reCAPTCHA v3) etkinleştirilir;
 * boş ise eski davranış (geriye dönük uyumluluk).
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

  // App Check token doğrulaması.
  // initializeApp'ten hemen sonra, getAuth/getFirestore'dan ÖNCE çağrılmalı
  // ki sonraki tüm istekler App Check token'ı taşısın.
  if (APP_CHECK_SITE_KEY) {
    try {
      const { initializeAppCheck, ReCaptchaV3Provider } = await import(
        'https://www.gstatic.com/firebasejs/11.0.2/firebase-app-check.js'
      );
      initializeAppCheck(_app, {
        provider: new ReCaptchaV3Provider(APP_CHECK_SITE_KEY),
        isTokenAutoRefreshEnabled: true,
      });
    } catch (err) {
      // App Check başarısız olsa bile uygulamanın çalışmasını engelleme
      console.warn('[leaderboard] App Check başlatılamadı (devam ediliyor):', err.message);
    }
  }

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
  // Girdiler meşru oyun aralığı içinde tutulur
  const prestige = Math.max(0, Math.min(100, _safeNum(state?.university?.prestige, 0)));
  const ranking  = _safeNum(state?.university?.ranking, 50);
  const mezun    = Math.max(0, Math.min(10_000, _safeNum(state?.alumniData?.totalGraduates ?? state?.alumni?.length, 0)));
  const yil      = Math.max(1, Math.min(200, _safeNum(state?.meta?.year, 1)));

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
  // Gösterilen puan gerçek skorla tutarlı kalsın diye aynı sınırlar
  const prestige = Math.max(0, Math.min(100, state.university?.prestige ?? 0));
  const ranking  = state.university?.ranking  ?? 50;
  const mezun    = Math.max(0, Math.min(10_000, state.alumniData?.totalGraduates ?? state.alumni?.length ?? 0));
  const yil      = Math.max(1, Math.min(200, state.meta?.year ?? 1));
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
 * Firestore'a skor kaydeder. Kullanıcı başına TEK kayıt tutulur:
 * doc id = uid. Yeni skor mevcuttan yüksekse update, değilse atlanır
 * (R-Fatih önerisi — leaderboard'da kullanıcı başına yalnızca en iyi skor).
 *
 * @param {string} name   Oyuncu adı (1-30 karakter)
 * @param {object} state  Mevcut oyun state'i
 * @returns {{ status: 'created'|'updated'|'not-improved', score: number, oldScore?: number, docId: string }}
 */
export async function submitScore(name, state) {
  if (!name || name.trim().length === 0) {
    throw new Error('İsim boş olamaz.');
  }
  const trimmed = name.trim().slice(0, 30);
  const score   = _safeNum(calculateScore(state), 0);

  const uid = await ensureAnonAuth();
  const { db } = await initFirebase();

  const { doc, getDoc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js');

  // Doc ID = uid (kullanıcı başına tek kayıt). gameId payload'da arşiv için tutulur.
  const docId  = uid;
  const gameId = String(state?.meta?.gameId || Date.now().toString(36)).slice(0, 100);
  const ref    = doc(db, 'scores', docId);

  // Önce mevcut kullanıcı kaydını oku — yeni skor düşükse hiç yazma.
  let existingScore = null;
  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      existingScore = _safeNum(existing.data()?.score, null);
    }
  } catch (err) {
    // Read başarısız olursa (offline vb.) ileri git, write sırasında tekrar dene.
    console.warn('[leaderboard] Mevcut skor okunamadi (yine de gondermeye calisilacak):', err?.message || err);
  }

  if (existingScore !== null && score <= existingScore) {
    return {
      status:    'not-improved',
      score,
      oldScore:  existingScore,
      docId,
    };
  }

  const payload = {
    uid,                                  // Rules'da request.auth.uid ile eşleşmeli
    gameId,                               // Hangi oyundan geldi (arşiv)
    name:      trimmed,
    score,
    year:      Math.round(_safeNum(state?.meta?.year, 1)),
    rank:      Math.round(_safeNum(state?.university?.ranking, 50)),
    prestige:  Math.round(_safeNum(state?.university?.prestige, 0)),
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(ref, payload);
    return {
      status:    existingScore === null ? 'created' : 'updated',
      score,
      oldScore:  existingScore,
      docId,
    };
  } catch (err) {
    console.error('[leaderboard] Skor gönderilirken hata:', err, 'payload:', payload);
    let msg;
    if (err?.code === 'permission-denied') {
      msg = 'Skor gönderme reddedildi. Veri geçersiz veya kurallar tarafından engellendi.';
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
