/**
 * Rektör Oldum — Sürüm Notları
 * Her sürümde başa yeni entry ekle. version + date + items[].
 * type: 'fix' (düzeltme) | 'feat' (yeni) | 'balance' (denge) | 'security'
 */

export const CHANGELOG = [
  {
    version: '0.4.8',
    date: '2026-05-03',
    title: 'Sürüm notları paneli eklendi',
    items: [
      { type: 'feat', text: 'Ana menüye "Yenilikler" butonu eklendi. Yeni sürüm yüklenince otomatik açılır.' },
    ],
  },
  {
    version: '0.4.7',
    date: '2026-05-03',
    title: 'Banka kredisi exploit düzeltmesi',
    items: [
      { type: 'balance', text: 'Kredi amortizasyonu hatalıydı: taksitin içindeki faiz de anaparadan düşüyordu. Sonsuz refinance exploit\'i kapatıldı — artık her dönem gerçek faiz ödeniyor.' },
      { type: 'balance', text: 'Erken kredi kapatma: %5 erken kapatma cezası eklendi.' },
    ],
  },
  {
    version: '0.4.6',
    date: '2026-05-03',
    title: 'Çevrimiçi skor tablosu çalışır hale geldi',
    items: [
      { type: 'fix', text: 'Firebase API anahtarındaki bir karakter hatası nedeniyle skorlar çevrimiçi tabloya yazılamıyordu. Düzeltildi.' },
    ],
  },
  {
    version: '0.4.5',
    date: '2026-05-03',
    title: 'Skor gönderme hata mesajları sadeleştirildi',
    items: [
      { type: 'fix', text: 'Skor tablosu erişilemediğinde ham Firebase hata kodu gösterilmesi yerine, "skor lokal kaydedildi" bildirimi gösteriliyor.' },
    ],
  },
  {
    version: '0.4.4',
    date: '2026-05-03',
    title: 'Önbellek ve Co-op üniversite düzeltmeleri',
    items: [
      { type: 'fix', text: 'Tarayıcılar eski JavaScript dosyalarını önbellekten yüklediği için "Bahar undefined" gibi düzeltilmiş hatalar tekrar görünüyordu. Tüm modüller artık sürüm etiketli yükleniyor.' },
      { type: 'fix', text: 'Co-op Üniversitesi seçilince "Bilinmeyen üniversite tipi" hatası alınıyordu — düzeltildi.' },
    ],
  },
  {
    version: '0.4.3',
    date: '2026-05-03',
    title: 'Mobil uyumluluk + bölüm seçim iyileştirmesi',
    items: [
      { type: 'feat', text: 'Mobil cihaz uyumluluğu eklendi: scroll açıldı, sidebar alt navigasyon olarak konumlandı, butonlar 44px dokunma hedefine uyduruldu.' },
      { type: 'fix', text: 'Bölüm seçim sınırı netleştirildi — senaryoya göre maksimum bölüm sayısı uyarı kutusunda gösteriliyor.' },
      { type: 'fix', text: 'Dönem özeti modalında "Bahar undefined" başlığı düzeltildi.' },
      { type: 'fix', text: 'Skor gönderme NaN/undefined alanlara karşı korunaklı hale getirildi.' },
    ],
  },
];

const _SEEN_KEY = 'rektor_oldum_last_seen_version';

export function getLastSeenVersion() {
  try {
    return localStorage.getItem(_SEEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setLastSeenVersion(v) {
  try {
    localStorage.setItem(_SEEN_KEY, v);
  } catch { /* localStorage yazılamadı */ }
}

export function hasUnseenChanges(currentVersion) {
  const seen = getLastSeenVersion();
  if (!seen) return true;                  // ilk ziyaret
  return seen !== currentVersion;          // sürüm değiştiyse göster
}
