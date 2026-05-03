/**
 * Rektör Oldum — Firebase Yapılandırması
 *
 * Bu apiKey *gizli* değildir; tarayıcıda görünür ve sorun değildir.
 * Güvenlik Firestore Security Rules tarafından sağlanır.
 *
 * Dökümanlar: https://firebase.google.com/docs/projects/api-keys
 */

export const firebaseConfig = {
  apiKey:            "AIzaSyAt9lcbuSLYwcwyeKX-kWb3ZyoomXI7RVE",
  authDomain:        "rektor-oldum.firebaseapp.com",
  projectId:         "rektor-oldum",
  storageBucket:     "rektor-oldum.firebasestorage.app",
  messagingSenderId: "641061692471",
  appId:             "1:641061692471:web:56e31a04f7df597ee60bb2",
};

/**
 * App Check (reCAPTCHA v3) — bot/script saldırılarına karşı koruma.
 * Site key reCAPTCHA Admin Console'da v3 olarak oluşturulup buraya konur.
 * Boş bırakılırsa App Check devre dışı kalır (geriye dönük uyumluluk).
 *
 * Localhost'ta debug token kullanmak için:
 *   self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
 * Konsola çıkan token'ı Firebase Console > App Check > Apps > ⋮ > Debug
 * sayfasında ekle.
 */
export const APP_CHECK_SITE_KEY = '6LcHhtcsAAAAAHaOmKLINvgINeMPv8Mbk_cT_F1L';
