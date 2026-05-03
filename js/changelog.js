/**
 * Rektör Oldum — Sürüm Notları
 * Her sürümde başa yeni entry ekle. version + date + items[].
 * type: 'fix' (düzeltme) | 'feat' (yeni) | 'balance' (denge) | 'security'
 */

export const CHANGELOG = [
  {
    version: '0.4.27',
    date: '2026-05-04',
    title: 'Skor tablosunda kullanıcı başına yalnızca en iyi skor',
    items: [
      { type: 'feat', text: 'Önceden bir kullanıcı birden fazla oyun bitirince skor tablosunda birden çok kaydı oluşuyordu (R-Fatih önerisi). Artık kullanıcı başına yalnızca en iyi skor tutuluyor: yeni oyun mevcuttan yüksek skor üretirse kayıt güncelleniyor, düşük olunca atlanıyor — modal "📊 X puan aldın. Küresel en iyi skorun Y — leaderboard güncellenmedi." der.' },
      { type: 'security', text: 'Firestore Security Rules güncellendi: doc id artık `uid` (kullanıcı başına tek belge), update yalnızca yeni skor mevcuttan yüksek olunca kabul ediliyor (server-side). İstemci tarafı bypass edilse bile sunucu reddediyor.' },
    ],
  },
  {
    version: '0.4.26',
    date: '2026-05-04',
    title: 'Siyaset Bilimi bölümü tam veri ile destekleniyor',
    items: [
      { type: 'fix', text: 'Siyaset Bilimi bölümü açılabiliyordu ama bölüm tanımı, ders müfredatı ve uzmanlık alanları eksikti — bölüm açıldıktan sonra hoca/öğrenci akışı düşük uyumda kalıyordu (seyrekilyas09 raporu, Issue #5). Bölüm artık tam veri ile destekleniyor: 8 ders müfredatı, 7 uzmanlık alanı (Siyaset Teorisi, Siyasi Düşünce, Karşılaştırmalı Siyaset, Türk Siyasal Hayatı, Uluslararası İlişkiler, Kamu Yönetimi, Siyaset Sosyolojisi).' },
    ],
  },
  {
    version: '0.4.25',
    date: '2026-05-04',
    title: 'İletişim bölümü tam veri ile destekleniyor',
    items: [
      { type: 'fix', text: 'İletişim bölümü açılabiliyordu ama bölüm tanımı, ders müfredatı ve uzmanlık alanları eksikti. Bu yüzden hoca alımında "mevcut müfredatla ders örtüşmesi yok" uyarısı çıkıp uyum hep düşük kalıyordu (Erdinç raporu). Bölüm artık tam veri ile destekleniyor: 8 ders müfredatı, 7 uzmanlık alanı (Gazetecilik, Halkla İlişkiler, Reklam, Radyo-TV, Yeni Medya, İletişim Tasarımı, Medya Çalışmaları).' },
    ],
  },
  {
    version: '0.4.24',
    date: '2026-05-04',
    title: 'Ulaşım merkezi, idari bina ve araştırma merkezi etkin',
    items: [
      { type: 'fix', text: 'Ulaşım merkezi binası kuruluyordu ama memnuniyete hiçbir etkisi yoktu (Erdinç raporu). Artık inşa edildiğinde "Ulaşım" memnuniyet skorunu artırıyor; her seviye yükseldiğinde etki büyüyor.' },
      { type: 'fix', text: 'İdari bina memnuniyet bonusu da hesaba bağlanmamıştı. Artık idari hizmetler memnuniyetine doğrudan katkıda bulunuyor.' },
      { type: 'feat', text: 'Araştırma merkezi artık "Bölüm Ata" ile etkin: atanan bölümün hocalarına araştırma çağrısı başarı şansında %15 bonus uygulanıyor (Erdinç raporu, "yakında" beklemesi sona erdi).' },
    ],
  },
  {
    version: '0.4.23',
    date: '2026-05-04',
    title: 'Akreditasyon erken yenileme düzeltildi',
    items: [
      { type: 'fix', text: 'Akreditasyon süresi yaklaştığında "Yenile" butonu görünüyordu ama tıklayınca "akreditasyon zaten mevcut" hatası alınıyordu (Erdinç raporu). Son 2 dönem kala erken yenileme artık kabul ediliyor; renewal maliyeti ile yeni başvuru başlatılıyor.' },
    ],
  },
  {
    version: '0.4.22',
    date: '2026-05-04',
    title: 'MÜDEK ve idari ekranda öğrenci memnuniyeti yanlış görünüyordu',
    items: [
      { type: 'fix', text: 'Ana ekranda öğrenci memnuniyeti 100 görünüp MÜDEK akreditasyon başvurusunda 50 olarak görünmesi nedeniyle başvuru reddediliyordu (AkaDemi raporu). Aynı sorun idari/bölüm ekranında da vardı (Emir raporu). Bölüm bazlı memnuniyet sayısı tutulmuyorsa genel öğrenci memnuniyetine göre değerlendirilecek.' },
    ],
  },
  {
    version: '0.4.21',
    date: '2026-05-04',
    title: 'Yazılım Mühendisliği bölümü tamamlandı + İdari bina detayı',
    items: [
      { type: 'fix', text: 'Yazılım Mühendisliği bölümü açılabiliyordu ama bölüm tanımı, ders müfredatı ve uzmanlık alanı eksikti. Bu yüzden bölüm açıldıktan sonra hoca/öğrenci alınamıyordu (Erdinç raporu). Bölüm artık tam veri ile destekleniyor: 8 ders müfredatı, 7 uzmanlık alanı.' },
      { type: 'fix', text: 'İdari binanın ofis kapasitesi ve idari personel doluluğu yerleşke kartında görünmüyordu (Erdinç raporu). Yeni özel kart: ofis sayısı, mevcut idari personel, doluluk oranı, bir üst düzeyin kapasitesi.' },
    ],
  },
  {
    version: '0.4.20',
    date: '2026-05-04',
    title: 'Birden fazla spor tesisi inşa edilebilir',
    items: [
      { type: 'fix', text: 'Spor tesisi tek tek yapılabiliyordu, yenisi reddediliyordu (AkaDemi raporu). Artık birden fazla spor tesisi inşa edilebilir; mevcut tesis tamamlandıktan sonra yenisi başlatılabilir.' },
    ],
  },
  {
    version: '0.4.19',
    date: '2026-05-04',
    title: 'Memnuniyet sayısı + spor beraberliği',
    items: [
      { type: 'fix', text: 'Genel Öğrenci Memnuniyeti "63.9000000" gibi uzun ondalıklı görünüyordu (R-Fatih raporu, Issue #7). Ekrandaki tüm memnuniyet sayıları artık tam sayıya yuvarlanıyor.' },
      { type: 'fix', text: 'Basketbol ve voleybolda beraberlik gösteriliyordu, gerçekte bu sporlarda beraberlik yok (R-Fatih raporu, Issue #9). Spor başına "beraberlik var mı" alanı eklendi; basketbol/voleybol/yüzme/atletizm/e-spor için yakın sonuçlar artık galibiyet/mağlubiyetle sonuçlanıyor. Sezon sonu kayıt formatı da uyarlandı.' },
    ],
  },
  {
    version: '0.4.18',
    date: '2026-05-03',
    title: 'Dönemlik harç slider\'ı kayıt yapmıyordu',
    items: [
      { type: 'fix', text: 'Harç slider\'ında değer değiştiriyordunuz ama state\'e kaydedilmiyordu (Burak Gökalp raporu). Slider\'ı bıraktığınız anda harç artık kayıt ediliyor ve onay bildirimi geliyor. Aynı düzeltme financial aid (Co-op tipi) için de yapıldı.' },
    ],
  },
  {
    version: '0.4.17',
    date: '2026-05-03',
    title: '"Bahar undefined" sorunu için son katman koruma',
    items: [
      { type: 'fix', text: 'Bazı oyuncular "Dönem Özeti — Bahar undefined" başlığını hâlâ görüyordu (Erdinç + Burak Gökalp raporları). Kayıt yüklenirken oyun yıl/dönem alanları eksik gelirse otomatik düzeltiliyor (yıl 1, dönem güz olarak başlatılıyor).' },
      { type: 'fix', text: 'Tarayıcıların eski HTML\'i önbellekten yüklemesini engellemek için sayfa başlığına önbellek başlıkları eklendi. Yeni sürümler artık daha güvenilir biçimde tarayıcılara ulaşacak.' },
    ],
  },
  {
    version: '0.4.16',
    date: '2026-05-03',
    title: 'Bütçe dağılımı uygulanmıyor sorunu düzeltildi',
    items: [
      { type: 'fix', text: 'Bütçe Dağılımı ekranında slider\'larla yüzde değiştirip "Dağılımı Uygula"ya basınca eski değere dönüyordu, kayıt yapılmıyordu (Yusuf Sertkaya raporu). Karar gönderiminde aksiyon adı yanlıştı; düzeltildi. Artık dağılım anında uygulanıyor.' },
    ],
  },
  {
    version: '0.4.14',
    date: '2026-05-03',
    title: 'App Check (reCAPTCHA v3) altyapısı eklendi',
    items: [
      { type: 'security', text: 'Bot ve betiklere karşı koruma için App Check (reCAPTCHA v3) entegrasyonu kondu. Site anahtarı yapılandırılınca etkinleşir; tarayıcı dışından gönderilen sahte istekler reddedilecek. Oyuncu için görünmez (görünür bir doğrulama yok).' },
    ],
  },
  {
    version: '0.4.13',
    date: '2026-05-03',
    title: 'Eski oyun kayıtlarına da mükerrer skor koruması',
    items: [
      { type: 'fix', text: 'v0.4.12 öncesi başlamış oyun kayıtlarında oyun kimliği bulunmuyordu; bu kayıtlardan skor gönderildiğinde mükerrer kayıt önleme tetiklenmiyordu. Artık kayıt yüklenirken eksik kimlik otomatik tamamlanıyor.' },
    ],
  },
  {
    version: '0.4.12',
    date: '2026-05-03',
    title: 'Mükerrer skor kaydı engellendi (hem oyun içinde hem sunucuda)',
    items: [
      { type: 'fix', text: 'Bir oyundan birden fazla kez skor gönderilebiliyor, sıralama bozuluyordu (R-Fatih raporu). Oyun içinde gönderildi bayrağı tutuldu; modal ikinci açılışta gönderim bilgisini gösterip yeni kayda izin vermiyor.' },
      { type: 'security', text: 'Sunucu tarafı koruma da eklendi (serhattural geri bildirimi): her skor için "kullanıcı + oyun kimliği" benzersiz belge kimliği kullanılıyor. Tarayıcı tarafındaki kontrol atlatılsa bile aynı oyundan ikinci kayıt sunucuda reddediliyor.' },
      { type: 'security', text: 'Sunucu yetkilendirme kuralları (firestore.rules) yazıldı: skor alanı 0–100.000, yıl 1–200, isim 1–30 karakter aralığında olmak zorunda. Ayrıca tarih sunucu zamanından alınıyor; istemci kendi tarihini yazamıyor.' },
    ],
  },
  {
    version: '0.4.11',
    date: '2026-05-03',
    title: 'Kadroda yanlış hoca açılması düzeltildi',
    items: [
      { type: 'fix', text: 'Bir hocaya tıklayınca başka bir hocanın profili açılıyordu (Emir/X raporu). Sebep: kayıt yüklendikten sonra yeni gelen adaylara mevcut hocalarla aynı kimlik veriliyordu. Hem yeni kimlikler artık çakışmaz hale getirildi hem de eski kayıtlardaki yinelenen kimlikler yükleme sırasında otomatik düzeltiliyor.' },
    ],
  },
  {
    version: '0.4.10',
    date: '2026-05-03',
    title: 'Dönem geçiş takılması ve erken kapanma düzeltmeleri',
    items: [
      { type: 'fix', text: '"Sonraki Dönem"e basıldığında oyun ilerlemiyor, sayfayı kapatıp açmak gerekiyordu. Simülasyonda hata olunca state önceki döneme geri alınıyor ve net bir uyarı gösteriliyor. Sayfa yenilemeye gerek kalmadı.' },
      { type: 'balance', text: 'Yeni kurulan üniversitelerde ilk 6 dönem (3 yıl) "öğrenci az" oyun bitti kontrolüne tabi olmayacak. Ayrıca eşik %40\'tan %25\'e, üst üste düşük dönem sayısı 3\'ten 6\'ya çekildi: kuruluş döneminde yanlışlıkla "üniversite kapandı" çıkmıyor.' },
      { type: 'fix', text: 'Kayıt yüklendikten sonra eski "oyun bitti" bayrağı bazen kalıcı kalıyordu. Yükleme sırasında temizleniyor.' },
    ],
  },
  {
    version: '0.4.9',
    date: '2026-05-03',
    title: 'Sürüm notları Türkçeleştirildi',
    items: [
      { type: 'fix', text: 'Yenilikler panelindeki ifadeler Türkçeleştirildi: önbellek, geri ödeme planı, kaydırma, yan menü, gezinme gibi karşılıklar kullanıldı.' },
    ],
  },
  {
    version: '0.4.8',
    date: '2026-05-03',
    title: 'Sürüm notları paneli eklendi',
    items: [
      { type: 'feat', text: 'Ana menüye "Yenilikler" düğmesi eklendi. Yeni sürüm yüklenince bu pencere kendiliğinden açılır.' },
    ],
  },
  {
    version: '0.4.7',
    date: '2026-05-03',
    title: 'Banka kredisi açığının kapatılması',
    items: [
      { type: 'balance', text: 'Kredinin geri ödeme planı hatalıydı: taksitin içindeki faiz de anaparadan düşülüyordu. Yeni kredi çekip eskiyi kapatarak faizden kaçma açığı kapatıldı. Artık her dönem gerçek faiz ödeniyor.' },
      { type: 'balance', text: 'Erken kredi kapatma için %5 erken kapatma cezası eklendi.' },
    ],
  },
  {
    version: '0.4.6',
    date: '2026-05-03',
    title: 'Çevrimiçi skor tablosu çalışır hale geldi',
    items: [
      { type: 'fix', text: 'Yapılandırma anahtarındaki tek karakterlik yazım hatası nedeniyle skorlar çevrimiçi tabloya yazılamıyordu. Düzeltildi.' },
    ],
  },
  {
    version: '0.4.5',
    date: '2026-05-03',
    title: 'Skor gönderme hata iletileri sadeleştirildi',
    items: [
      { type: 'fix', text: 'Skor sunucusuna ulaşılamadığında ham hata kodu gösterilmesi yerine "skor yerel olarak yedeklendi" bildirimi gösteriliyor.' },
    ],
  },
  {
    version: '0.4.4',
    date: '2026-05-03',
    title: 'Önbellek ve Co-op üniversite düzeltmeleri',
    items: [
      { type: 'fix', text: 'Tarayıcılar eski kod dosyalarını önbellekten yüklediği için "Bahar undefined" gibi düzeltilmiş yazılar yeniden görünüyordu. Tüm kod dosyaları artık sürüm etiketli yükleniyor.' },
      { type: 'fix', text: 'Co-op Üniversitesi seçilince "Bilinmeyen üniversite tipi" hatası alınıyordu. Düzeltildi.' },
    ],
  },
  {
    version: '0.4.3',
    date: '2026-05-03',
    title: 'Mobil uyumluluk ve bölüm seçimi iyileştirmesi',
    items: [
      { type: 'feat', text: 'Mobil cihaz uyumluluğu eklendi: kaydırma açıldı, yan menü alt gezinme çubuğu olarak konumlandı, düğmeler 44 piksel dokunma hedefine uyduruldu.' },
      { type: 'fix', text: 'Bölüm seçim sınırı netleştirildi. Senaryoya göre en fazla seçilebilecek bölüm sayısı uyarı kutusunda gösteriliyor.' },
      { type: 'fix', text: 'Dönem sonu özet penceresinde "Bahar undefined" başlığı düzeltildi.' },
      { type: 'fix', text: 'Skor gönderimi geçersiz veya eksik alanlara karşı korunaklı hale getirildi.' },
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
  } catch { /* yerel depo yazılamadı */ }
}

export function hasUnseenChanges(currentVersion) {
  const seen = getLastSeenVersion();
  if (!seen) return true;                  // ilk ziyaret
  return seen !== currentVersion;          // sürüm değiştiyse göster
}
