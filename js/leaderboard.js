/**
 * Rektör Oldum — Leaderboard Modülü (leaderboard.js)
 * Firebase Firestore tabanlı skor tablosu: anonim auth, yazma ve okuma.
 * v0.7.1: skor sezonları (Sezon 2 `scores_s2`, eski sezon `scores`) ve oyun içi
 * öneri/şikâyet formunun Firestore yazımı (`feedback`).
 * ES module, Firebase SDK'yı CDN'den dinamik olarak yükler.
 */

import { firebaseConfig, APP_CHECK_SITE_KEY } from './firebase-config.js?v=0.4.27';
import { THE_2024 } from './intl_rankings_the2024.js?v=0.4.39';
import { calculateIntlPillars, calculateIntlTotalScore, findIntlRank } from './intl_ranking.js?v=0.7.0';

const _FIRESTORE_URL = 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

// ─────────────────────────────────────────────────────────────────────────────
// SEZONLAR (v0.7.1)
// ─────────────────────────────────────────────────────────────────────────────
// v0.7.0 oyun dengesini değiştirdi (oyun çok daha yavaş). Eski hızlı sürümlerin
// skorları yeni dengede aşılamıyordu; eski yüksek skoru olan oyuncu da kural gereği
// (güncelleme yalnız daha yüksek skorla) yeni skorunu hiç gönderemiyordu.
//
//   Sezon 2 ('s2'): yeni skorlar `scores_s2`'ye yazılır (oyuncu başına tek kayıt,
//     belge kimliği = anonim uid, `scores` ile aynı doğrulama). Görünüm `scores_s2`
//     ile `scores`'un kesimden sonra yazılmış kayıtlarının birleşimidir; aynı uid iki
//     yerdeyse yüksek olan sayılır. v0.7.0'da oynayanlar da görünür, taşıma gerekmez.
//   Eski sezon ('s1'): `scores`'un kesimden önceki kayıtları ("eski sistem").
//
// `scores` kuralları olduğu gibi kalır: önbellekteki eski istemciler oraya yazmayı
// sürdürür, o kayıtlar kesimden sonra olduğu için Sezon 2'de görünür.
// Kesim ui.js'teki _LB_SEZON_KESIM_MS ile aynı olmalı (yerel yedek skorların sezonu).
export const SEZON_KESIM_MS = Date.parse('2026-09-25T00:00:00Z');   // v0.7.0'ın yayına girdiği an
export const GUNCEL_SEZON   = 's2';
const _SEZON2_KOLEKSIYON    = 'scores_s2';
const _ESKI_KOLEKSIYON      = 'scores';
const _ONBELLEK_MS          = 60_000;   // sekme ve görünüm değiştikçe yeniden okumasın
const _OKUMA_ZAMAN_ASIMI_MS = 15_000;   // yanıt gelmezse yerel yedeğe düşülür
// Yazma (oturum + okuma + yazma) süresi. reCAPTCHA yüklenemezse (engelleyici eklenti, ağ
// süzgeci) App Check jeton beklerken istek hiç sonuçlanmıyordu; pencere "Gönderiliyor…"da kalıyordu.
const _YAZMA_ZAMAN_ASIMI_MS = 20_000;

/** Okuma önbelleği: { s1, s2, kesimSonrasi } → { zaman, sonuc } */
let _lbOnbellek = {};

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
  'deadline-exceeded',   // v0.7.1: gönderim süresi doldu (_zamanAsimi)
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

/**
 * Yerel yedek skorun sezonu. v0.7.1'den önce yazılan kayıtlarda sezon alanı yok;
 * kayıt tarihi kesimden sonraysa Sezon 2 sayılır.
 */
export function yerelSkorSezonu(r) {
  if (r?.sezon === 's1' || r?.sezon === 's2') return r.sezon;
  const t = Date.parse(r?.savedAt || '');
  return Number.isFinite(t) && t >= SEZON_KESIM_MS ? 's2' : 's1';
}

/**
 * Çevrimiçi tablo kullanılamazken skoru bu cihazda saklar. v0.7.1: kayıt sezonu da
 * tutar (verilmezse güncel sezon); her sezonun en iyi 100 skoru kalır.
 */
export function saveLocalScore(entry) {
  try {
    const list = getLocalScores();
    list.push({ ...entry, sezon: entry?.sezon || GUNCEL_SEZON, savedAt: new Date().toISOString() });
    const kalan = [];
    for (const sezon of ['s2', 's1']) {
      kalan.push(...list
        .filter(r => yerelSkorSezonu(r) === sezon)
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 100));
    }
    localStorage.setItem(_LOCAL_SCORE_KEY, JSON.stringify(kalan));
  } catch (e) {
    console.warn('[leaderboard] Lokal skor yedeklenemedi:', e);
  }
}

/**
 * @param {'s1'|'s2'|null} [sezon] verilirse yalnız o sezonun kayıtları
 */
export function getLocalScores(sezon = null) {
  let list;
  try {
    list = JSON.parse(localStorage.getItem(_LOCAL_SCORE_KEY) || '[]');
  } catch (e) {
    return [];
  }
  if (!Array.isArray(list)) return [];
  return sezon ? list.filter(r => yerelSkorSezonu(r) === sezon) : list;
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
    import(_FIRESTORE_URL),
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

/**
 * Oturum açmadan bu cihazın anonim kimliği (daha önce skor göndermişse vardır).
 * Kalıcı oturumun yüklenmesi en çok 3 saniye beklenir; yoksa null.
 */
async function _mevcutUid(auth) {
  try {
    if (typeof auth.authStateReady === 'function') {
      await Promise.race([auth.authStateReady(), new Promise(res => setTimeout(res, 3000))]);
    }
  } catch (e) { /* kimlik bilinmiyor: vurgu yapılmaz */ }
  return auth.currentUser?.uid || null;
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

/** Firestore Timestamp, {seconds} ya da tarih dizgisi → milisaniye (yoksa 0). */
function _zamanMs(v) {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
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
 * Skoru güncel sezona (Sezon 2, `scores_s2`) kaydeder. Kullanıcı başına TEK kayıt
 * tutulur: doc id = uid. Kurallar güncellemeyi yalnız daha yüksek skorla kabul eder;
 * yeni skor mevcut Sezon 2 kaydından düşükse hiç yazılmaz.
 *
 * Sezon 2 görünümü `scores`'un kesim sonrası kaydını da sayar (v0.7.0'da gönderilmiş
 * skor). Durum ve eski skor bu birleşik en iyiye göre verilir: yeni skor ondan yüksek
 * değilse 'not-improved' döner (tabloda görünen değer değişmez).
 *
 * v0.7.1: bütün gönderim (oturum, okuma, yazma) 20 saniyeyle sınırlı; süre dolarsa
 * 'deadline-exceeded' kodlu hata atılır (isLeaderboardUnavailable true: skor yerelde saklanır).
 *
 * @param {string} name   Oyuncu adı (1-30 karakter)
 * @param {object} state  Mevcut oyun state'i
 * @returns {{ status: 'created'|'updated'|'not-improved', score: number, oldScore?: number, docId: string, sezon: string }}
 */
export async function submitScore(name, state) {
  if (!name || name.trim().length === 0) {
    throw new Error('İsim boş olamaz.');
  }
  return _zamanAsimi(_skoruGonder(name, state), _YAZMA_ZAMAN_ASIMI_MS,
    'Skor gönderimi yanıt vermedi. Bağlantını denetleyip tekrar dene.');
}

async function _skoruGonder(name, state) {
  const trimmed = name.trim().slice(0, 30);
  // Kuralların üst sınırı 5000 (gerçek oyunda en çok ~2650)
  const score   = Math.max(0, Math.min(5000, Math.round(_safeNum(calculateScore(state), 0))));

  const uid = await ensureAnonAuth();
  const { db } = await initFirebase();

  const { doc, getDoc, setDoc, serverTimestamp } = await import(_FIRESTORE_URL);

  // Doc ID = uid (kullanıcı başına tek kayıt). gameId payload'da arşiv için tutulur.
  const docId  = uid;
  const gameId = String(state?.meta?.gameId || Date.now().toString(36)).slice(0, 100);
  const ref    = doc(db, _SEZON2_KOLEKSIYON, docId);

  // Önce bu sezondaki kayıtları oku: Sezon 2 kaydı ve (varsa) v0.7.0'da `scores`'a
  // yazılmış kesim sonrası kayıt.
  let s2Skor = null;
  let eskiKoleksiyonSkor = null;
  try {
    const [s2, eski] = await Promise.all([getDoc(ref), getDoc(doc(db, _ESKI_KOLEKSIYON, docId))]);
    if (s2.exists()) s2Skor = _safeNum(s2.data()?.score, null);
    if (eski.exists() && _zamanMs(eski.data()?.createdAt) >= SEZON_KESIM_MS) {
      eskiKoleksiyonSkor = _safeNum(eski.data()?.score, null);
    }
  } catch (err) {
    // Read başarısız olursa (offline vb.) ileri git, write sırasında tekrar dene.
    console.warn('[leaderboard] Mevcut skor okunamadi (yine de gondermeye calisilacak):', err?.message || err);
  }

  const bilinen   = [s2Skor, eskiKoleksiyonSkor].filter(v => v !== null);
  const sezonEnIyi = bilinen.length ? Math.max(...bilinen) : null;

  if (s2Skor !== null && score <= s2Skor) {
    return {
      status:    'not-improved',
      score,
      oldScore:  sezonEnIyi,
      docId,
      sezon:     GUNCEL_SEZON,
    };
  }

  // v0.4.45: state'te intlRanking yoksa (eski kayıt yüklemiş oyuncu, henüz dönem
  // geçmemiş yeni oyun vb.) anlık olarak hesapla — 1900 default'una düşmesin.
  let intlRank = _safeNum(state?.university?.intlRanking, 0);
  if (!intlRank) {
    try {
      const pillars = calculateIntlPillars(state);
      const total   = calculateIntlTotalScore(pillars, THE_2024.pillarsWeights);
      intlRank      = findIntlRank(total, THE_2024);
    } catch (err) {
      console.warn('[leaderboard] intlRanking anlik hesabi basarisiz:', err?.message || err);
      intlRank = 1900;
    }
  }

  // v0.7.1: sayılar kuralların aralığına kırpılır (aralık dışı tek alan bütün kaydı reddettirir;
  // Math.max(0, ...) ayrıca -0'ı önler, SDK -0'ı tam sayı değil ondalık yazar)
  const payload = {
    uid,                                  // Rules'da request.auth.uid ile eşleşmeli
    gameId,                               // Hangi oyundan geldi (arşiv)
    name:      trimmed,
    score,
    year:      Math.max(1, Math.min(200, Math.round(_safeNum(state?.meta?.year, 1)))),
    // Dünya sırası (THE WUR 2024 listesinde konum, 1-1904).
    rank:      Math.max(1, Math.min(5000, Math.round(intlRank))),
    prestige:  Math.max(0, Math.min(100, Math.round(_safeNum(state?.university?.prestige, 0)))),
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(ref, payload);
    _lbOnbellek = {};   // tablo yeni kaydı hemen göstersin
    let status = 'created';
    if (sezonEnIyi !== null) status = score > sezonEnIyi ? 'updated' : 'not-improved';
    return {
      status,
      score,
      oldScore:  sezonEnIyi,
      docId,
      sezon:     GUNCEL_SEZON,
    };
  } catch (err) {
    console.error('[leaderboard] Skor gönderilirken hata:', err, 'payload:', payload);
    let msg;
    if (err?.code === 'permission-denied') {
      msg = 'Skor gönderme reddedildi. Veri geçersiz veya kurallar tarafından engellendi.';
    } else if (err?.code === 'unauthenticated') {
      msg = 'Anonim oturum açılamadı. Lütfen sayfayı yenileyip tekrar dene.';
    } else if (err?.code === 'unavailable' || /network|offline/i.test(err?.message || '')) {
      msg = 'İnternet bağlantısı yok. Bağlantını denetleyip tekrar dene.';
    } else {
      msg = `Skor gönderilemedi: ${err?.message || err?.code || 'bilinmeyen hata'}`;
    }
    throw new Error(msg);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SKOR OKUMA
// ─────────────────────────────────────────────────────────────────────────────

/** Söz belirli sürede sonuçlanmazsa 'deadline-exceeded' koduyla reddedilir. */
function _zamanAsimi(soz, ms, mesaj = 'Skor tablosu yanıt vermedi.') {
  let zamanlayici;
  const sure = new Promise((_, reddet) => {
    zamanlayici = setTimeout(() => {
      const hata = new Error(mesaj);
      hata.code = 'deadline-exceeded';
      reddet(hata);
    }, ms);
  });
  return Promise.race([soz, sure]).finally(() => clearTimeout(zamanlayici));
}

/** Belgeyi tablo satırına çevirir (id = uid). */
function _satir(d, kaynak) {
  const v = d.data() || {};
  return { id: d.id, ...v, score: _safeNum(v.score, 0), kaynak };
}

/** Skor çoktan aza; eşitlikte önce gönderen üstte. */
function _skorSirasi(a, b) {
  return (b.score - a.score) || (_zamanMs(a.createdAt) - _zamanMs(b.createdAt));
}

/**
 * `scores`'un kesimden sonra yazılmış kayıtları (v0.7.0 ve eski önbellekli istemciler).
 * Az sayıda ve yalnız eski istemcilerden büyüyor; hepsi okunur. Yalnız createdAt
 * aralığı süzülür, bileşik dizin gerekmez. @returns {Map<string, object>} uid → satır
 */
async function _kesimSonrasiEskiKayitlar(db, fs, yenile) {
  const o = _lbOnbellek.kesimSonrasi;
  if (!yenile && o && Date.now() - o.zaman < _ONBELLEK_MS) return o.sonuc;
  const snap = await fs.getDocs(fs.query(
    fs.collection(db, _ESKI_KOLEKSIYON),
    fs.where('createdAt', '>=', fs.Timestamp.fromMillis(SEZON_KESIM_MS)),
    fs.limit(1000),
  ));
  const harita = new Map();
  snap.docs.forEach(d => harita.set(d.id, _satir(d, _ESKI_KOLEKSIYON)));
  _lbOnbellek.kesimSonrasi = { zaman: Date.now(), sonuc: harita };
  return harita;
}

/**
 * Sezon 2: `scores_s2`'nin en iyi K kaydı ile kesim sonrası `scores` kayıtlarının birleşimi.
 * K ≥ limit olduğundan ilk `limit` satır kesindir: K'nın dışında kalan bir Sezon 2 skorunun
 * üstünde en az K oyuncu vardır.
 */
async function _sezon2Getir(db, fs, limitCount, uid, eskiSonra) {
  const K = Math.max(limitCount, 50);
  let s2Docs = [];
  let s2Tam = true;   // K'dan az geldiyse koleksiyonun hepsi elde
  try {
    const snap = await fs.getDocs(fs.query(
      fs.collection(db, _SEZON2_KOLEKSIYON),
      fs.orderBy('score', 'desc'),
      fs.limit(K),
    ));
    s2Docs = snap.docs;
    s2Tam = snap.size < K;
  } catch (err) {
    // Kurallar henüz yayımlanmadıysa `scores_s2` okunamaz; v0.7.0 kayıtlarıyla devam edilir
    if (err?.code !== 'permission-denied') throw err;
    console.warn('[leaderboard] scores_s2 okunamadı (kurallar yayımlandı mı?):', err.message);
  }

  const s2Bilinen = new Map();   // uid → Sezon 2 skoru
  const birlesik  = new Map();   // uid → en yüksek satır
  const ekle = (s) => {
    const onceki = birlesik.get(s.id);
    if (!onceki || s.score > onceki.score) birlesik.set(s.id, s);
  };
  eskiSonra.forEach(ekle);
  s2Docs.forEach(d => {
    const s = _satir(d, _SEZON2_KOLEKSIYON);
    s2Bilinen.set(s.id, s.score);
    ekle(s);
  });
  const liste    = [...birlesik.values()].sort(_skorSirasi);
  const satirlar = liste.slice(0, limitCount);

  let ben = null;
  if (uid) {
    const idx = liste.findIndex(r => r.id === uid);
    if (idx >= 0 && (idx < limitCount || s2Tam)) {
      ben = { sira: idx + 1, satir: liste[idx], listede: idx < limitCount };
    } else if (!s2Tam) {
      // Listenin dışında: kendi birleşik skorunu bul, üstündekileri say
      let benim = birlesik.get(uid) || null;
      if (!s2Bilinen.has(uid)) {
        const d = await fs.getDoc(fs.doc(db, _SEZON2_KOLEKSIYON, uid));
        if (d.exists()) {
          const s = _satir(d, _SEZON2_KOLEKSIYON);
          if (!benim || s.score > benim.score) benim = s;
        }
      }
      if (benim) {
        const benSkor = benim.score;
        const ustte = (await fs.getCountFromServer(fs.query(
          fs.collection(db, _SEZON2_KOLEKSIYON),
          fs.where('score', '>', benSkor),
        ))).data().count;
        // Kesim sonrası `scores`'ta benden yüksek olanlar; Sezon 2 skoru da benden
        // yüksekse yukarıda zaten sayıldı. Sezon 2 skoru bilinmeyenler kimlikle okunur.
        const adaylar    = [...eskiSonra.values()].filter(s => s.id !== uid && s.score > benSkor);
        const bilinmeyen = adaylar.filter(s => !s2Bilinen.has(s.id)).map(s => s.id);
        for (let i = 0; i < bilinmeyen.length; i += 30) {
          const parca = await fs.getDocs(fs.query(
            fs.collection(db, _SEZON2_KOLEKSIYON),
            fs.where(fs.documentId(), 'in', bilinmeyen.slice(i, i + 30)),
          ));
          parca.docs.forEach(d => s2Bilinen.set(d.id, _safeNum(d.data()?.score, 0)));
        }
        const ek = adaylar.filter(s => !((s2Bilinen.get(s.id) ?? -1) > benSkor)).length;
        ben = { sira: ustte + ek + 1, satir: benim, listede: false };
      }
    }
  }
  return { sezon: 's2', satirlar, ben };
}

/**
 * Eski sezon: `scores`'un kesimden önceki (ya da tarihsiz) kayıtları, skor sırasıyla.
 * Skora göre 100'lük sayfalarla okunur, kesim sonrası olanlar ayıklanır.
 */
async function _eskiSezonGetir(db, fs, limitCount, uid, eskiSonra) {
  const eskiler = [];
  let son = null;
  let bitti = false;
  for (let sayfa = 0; sayfa < 5 && eskiler.length < limitCount && !bitti; sayfa++) {
    const kosullar = [fs.orderBy('score', 'desc')];
    if (son) kosullar.push(fs.startAfter(son));
    kosullar.push(fs.limit(100));
    const snap = await fs.getDocs(fs.query(fs.collection(db, _ESKI_KOLEKSIYON), ...kosullar));
    snap.docs.forEach(d => {
      const s = _satir(d, _ESKI_KOLEKSIYON);
      if (_zamanMs(s.createdAt) < SEZON_KESIM_MS) eskiler.push(s);
    });
    son = snap.docs[snap.docs.length - 1] || null;
    bitti = snap.size < 100;
  }
  eskiler.sort(_skorSirasi);
  const satirlar = eskiler.slice(0, limitCount);

  let ben = null;
  if (uid) {
    const idx = eskiler.findIndex(r => r.id === uid);
    if (idx >= 0 && (idx < limitCount || bitti)) {
      ben = { sira: idx + 1, satir: eskiler[idx], listede: idx < limitCount };
    } else if (!bitti) {
      const d = await fs.getDoc(fs.doc(db, _ESKI_KOLEKSIYON, uid));
      if (d.exists() && _zamanMs(d.data()?.createdAt) < SEZON_KESIM_MS) {
        const benim = _satir(d, _ESKI_KOLEKSIYON);
        const ustte = (await fs.getCountFromServer(fs.query(
          fs.collection(db, _ESKI_KOLEKSIYON),
          fs.where('score', '>', benim.score),
        ))).data().count;
        // Sayım kesim sonrası kayıtları da içerir; onlar eski sezondan sayılmaz
        const kesimSonrasiUstte = [...eskiSonra.values()].filter(s => s.score > benim.score).length;
        ben = { sira: Math.max(1, ustte - kesimSonrasiUstte + 1), satir: benim, listede: false };
      }
    }
  }
  return { sezon: 's1', satirlar, ben };
}

/**
 * Bir sezonun skor tablosunu getirir.
 * @param {{ sezon?: 's1'|'s2', limit?: number, yenile?: boolean }|number} [secenek]
 *        sezon verilmezse güncel sezon; yenile önbelleği atlar (Yenile düğmesi).
 *        Geriye uyum: sayı verilirse satır sayısıdır.
 * @returns {Promise<{ sezon: string, satirlar: object[], ben: null|{ sira: number, satir: object, listede: boolean } }>}
 *          satirlar büyükten küçüğe; ben bu cihazın kaydı (kimlik yoksa ya da bu sezonda skoru yoksa null)
 */
export async function getTopScores(secenek = {}) {
  const ayar       = typeof secenek === 'number' ? { limit: secenek } : (secenek || {});
  const sezon      = ayar.sezon === 's1' ? 's1' : GUNCEL_SEZON;
  const limitCount = Math.max(1, Math.min(100, Math.round(_safeNum(ayar.limit, 50))));
  const yenile     = !!ayar.yenile;

  const o = _lbOnbellek[sezon];
  if (!yenile && o && o.limit === limitCount && Date.now() - o.zaman < _ONBELLEK_MS) return o.sonuc;

  try {
    const sonuc = await _zamanAsimi((async () => {
      const { auth, db } = await initFirebase();
      const fs = await import(_FIRESTORE_URL);
      const [uid, eskiSonra] = await Promise.all([
        _mevcutUid(auth),
        _kesimSonrasiEskiKayitlar(db, fs, yenile),
      ]);
      return sezon === 's1'
        ? _eskiSezonGetir(db, fs, limitCount, uid, eskiSonra)
        : _sezon2Getir(db, fs, limitCount, uid, eskiSonra);
    })(), _OKUMA_ZAMAN_ASIMI_MS);
    _lbOnbellek[sezon] = { zaman: Date.now(), limit: limitCount, sonuc };
    return sonuc;
  } catch (err) {
    console.error('[leaderboard] Skorlar alınırken hata:', err);
    throw new Error('Skor tablosu yüklenemedi. Lütfen internet bağlantını denetle.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ÖNERİ VE ŞİKÂYET (v0.7.1)
// ─────────────────────────────────────────────────────────────────────────────
// Oyun içi "Bildir" penceresi `feedback` koleksiyonuna yeni belge yazar. Kurallar
// yalnız oluşturmaya izin verir (okuma, güncelleme, silme kapalı); geliştirici
// kayıtları Firebase Console'dan ya da scripts/oku-feedback.js ile okur.
// Sınırlar firestore.rules'taki `feedback` bloğuyla aynı olmalı.

export const GERI_BILDIRIM_TURLERI = ['hata', 'oneri', 'baska'];
export const GERI_BILDIRIM_SINIR = { iletiEnAz: 10, iletiEnCok: 2000, iletisimEnCok: 100 };

/** Kurallardaki string.size() gibi karakter (kod noktası) sayar; emoji iki sayılmaz. */
export function karakterSayisi(metin) {
  return [...String(metin ?? '')].length;
}

/** Bağlam alanlarını kuralların beklediği tür ve uzunluğa indirir. */
function _baglamiTemizle(b = {}) {
  const yazi = (v, n) => [...String(v ?? '')].slice(0, n).join('');
  return {
    surum:    yazi(b.surum, 20),
    yil:      Math.max(0, Math.min(1000, Math.round(_safeNum(b.yil, 0)))),
    donem:    yazi(b.donem, 20),
    tip:      yazi(b.tip, 40),
    senaryo:  yazi(b.senaryo, 60),
    ekran:    yazi(b.ekran, 20),
    tarayici: yazi(b.tarayici, 60),
  };
}

/**
 * Öneri/şikâyet iletisini gönderir.
 * @param {{ tur: string, ileti: string, iletisim?: string, baglam: object }} veri
 * @returns {Promise<{ id: string }>}
 * @throws {Error} Türkçe, oyuncuya gösterilebilir ileti
 */
export async function submitFeedback({ tur, ileti, iletisim = '', baglam = {} } = {}) {
  const metin = String(ileti ?? '').trim();
  const kisi  = String(iletisim ?? '').trim();
  if (!GERI_BILDIRIM_TURLERI.includes(tur)) throw new Error('Bir tür seç.');
  if (karakterSayisi(metin) < GERI_BILDIRIM_SINIR.iletiEnAz) {
    throw new Error(`İleti en az ${GERI_BILDIRIM_SINIR.iletiEnAz} karakter olmalı.`);
  }
  if (karakterSayisi(metin) > GERI_BILDIRIM_SINIR.iletiEnCok) {
    throw new Error(`İleti en çok ${GERI_BILDIRIM_SINIR.iletiEnCok} karakter olabilir.`);
  }
  if (karakterSayisi(kisi) > GERI_BILDIRIM_SINIR.iletisimEnCok) {
    throw new Error(`İletişim bilgisi en çok ${GERI_BILDIRIM_SINIR.iletisimEnCok} karakter olabilir.`);
  }

  try {
    // Oturum da süreye dahil: reCAPTCHA yüklenemezse oturum açma hiç sonuçlanmıyor
    const ref = await _zamanAsimi((async () => {
      const uid = await ensureAnonAuth();
      const { db } = await initFirebase();
      const { collection, addDoc, serverTimestamp } = await import(_FIRESTORE_URL);
      return addDoc(collection(db, 'feedback'), {
        uid,
        tur,
        ileti:     metin,
        iletisim:  kisi,
        baglam:    _baglamiTemizle(baglam),
        createdAt: serverTimestamp(),
      });
    })(), _YAZMA_ZAMAN_ASIMI_MS);
    return { id: ref.id };
  } catch (err) {
    console.error('[leaderboard] Geri bildirim gönderilemedi:', err);
    const kod = String(err?.code || '');
    let msg;
    if (kod === 'permission-denied') {
      msg = 'İleti şu an kabul edilmedi. Birazdan yeniden dene.';
    } else if (kod === 'deadline-exceeded' || kod === 'unavailable' || kod === 'auth/network-request-failed'
      || /network|offline|failed to fetch/i.test(err?.message || '')) {
      msg = 'Bağlantı kurulamadı. İnternet bağlantını denetleyip yeniden dene.';
    } else if (isLeaderboardUnavailable(err)) {
      msg = 'Gönderim hizmeti şu an bakımda. Birazdan yeniden dene.';
    } else {
      msg = 'İleti gönderilemedi. Birazdan yeniden dene.';
    }
    throw new Error(msg);
  }
}
