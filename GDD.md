# Rektör Oldum — Game Design Document (GDD)

**Sürüm:** 0.1-taslak
**Tarih:** 2026-03-19
**Platform:** Web (HTML5 — Vanilla JS)

---

## 1. Oyun Özeti

### Elevator Pitch

Türkiye'nin en prestijli üniversitesini siz yönetin. Yıldız hocaları transfer edin, zeki öğrencileri çekin, laboratuvarlar kurun, TÜBİTAK projeleri kazanın. Her kararın on yıl sonra yansımaları olacak — bir hocayı mutsuz bırakırsanız rakibiniz onu kapar, bir bölümü ihmal ederseniz akreditasyonunuzu kaybedersiniz.

### Tür

Tycoon / Yönetim Simülasyonu — Metin ve kart tabanlı arayüz

### Platform

Web (HTML5) — Tek sayfa uygulama, tarayıcıda çalışır, kurulum gerektirmez.

### Hedef Kitle

- **Birincil:** 18-35 yaş, Türk üniversite öğrencileri ve mezunları; tycoon/yönetim oyunlarına aşina
- **İkincil:** Akademisyenler, eğitim meraklıları, Football Manager benzeri derin sistemlere ilgi duyanlar
- **Üçüncül:** Sıradan oyuncular (sandbox modda hafif deneyim)

### Temel Fark

Türk yükseköğretim gerçekliğine dayalı mekanikler: YÖK kısıtlamaları, ÖSYM sınav sistemi, TÜBİTAK proje döngüleri, kadro kadük sistemi, döner sermaye. Soyut bir "üniversite" değil, tanıdık bir evren.

---

## 2. Temel Oyun Döngüsü

### Ana Döngü (Flywheel)

```
Yıldız Hoca Transferi
        ↓
İyi Öğrenci Çeker (sınav puanı artar)
        ↓
İyi Araştırma + Kaliteli Eğitim
        ↓
Mezunlar Sektörde Başarılı Olur
        ↓
Ün ve Prestij Artar
        ↓
Daha İyi Hoca ve Öğrenci Çeker
        ↑_______________________________↑
```

Bu döngü her karar katmanında kendini tekrarlar. Oyuncu döngüyü hızlandırmak veya yeni bir döngü kolu (teknokent, uluslararası işbirliği) açmak için yatırım yapar.

### Tur Yapısı ve Akademik Takvim Modelleri

Üniversiteler iki farklı akademik takvim modelinden birini kullanır. Bu seçim oyun başında yapılır veya oyun içinde (maliyetli bir reform olarak) değiştirilebilir.

#### Model A: 2 Dönem + Yaz Okulu (Klasik Sistem)

```
Bir akademik yıl = 3 tur: Güz → Bahar → Yaz (opsiyonel)

Güz Dönemi:  Tam dönem (16 hafta) — Ana tur
Bahar Dönemi: Tam dönem (16 hafta) — Ana tur
Yaz Okulu:    Kısa dönem (8 hafta) — İsteğe bağlı, sınırlı kapasite

Yaz Okulu Özellikleri:
  - Öğrenciler isteğe bağlı katılır (genelde %20-40 katılım)
  - Sınırlı ders açılır (hoca gönüllülüğüne bağlı)
  - Ek harç geliri (normal harç × 0.4/ders)
  - Hocalara ek ücret ödenir (maaş × 0.3)
  - Öğrenci erken mezun olabilir (8 dönem → 7 dönem)
  - Araştırma için boş kampüs avantajı (yaz okulu küçük olduğundan)
  - Yaz okulu açmamak da bir seçenek (maliyet tasarrufu)
```

#### Model B: 3 Dönem + Zorunlu Co-op (TOBB ETÜ Modeli)

```
Bir akademik yıl = 3 tur: Güz → Bahar → Yaz (hepsi zorunlu)

Güz Dönemi:  Tam dönem (14 hafta) — Ana tur
Bahar Dönemi: Tam dönem (14 hafta) — Ana tur
Yaz Dönemi:  Tam dönem (14 hafta) — Ana tur (co-op veya ders)

Co-op (Dönemli Ortak Eğitim) Sistemi:
  - Öğrenciler 8 dönemde 2-3 co-op dönemi yapar (zorunlu)
  - Co-op döneminde öğrenci sektörde çalışır, ders almaz
  - Co-op partnerleri: Üniversitenin endüstri bağlantılarına bağlı
  - Partner Kalitesi = f(Prestij, Teknokent_Varlığı, Mezun_Ağı)

Co-op Etkileri:
  - Öğrenci sektör deneyimi kazanır → mezuniyet sonrası iş bulma +%30
  - Endüstri bağlantısı güçlenir → sponsorluk geliri +%20
  - Öğrenci maaş alır → burs ihtiyacı azalır
  - Mezun ağı daha güçlü (iş dünyasıyla erken entegrasyon)
  - Bazı öğrenciler co-op sırasında iş teklifi alır → mezun başarısı artar
  - Dezavantaj: 3 dönem tam kapasite çalışma → hoca iş yükü yüksek
  - Dezavantaj: Kampüs 12 ay aktif → bakım maliyeti +%15

Co-op Partner Eşleştirme:
  Kaliteli_Partner_Şansı = (Prestij × 0.4 + Teknokent_Puanı × 0.3
                           + Mezun_Ağı_Gücü × 0.3) / 100
  İyi partner → öğrenci memnuniyeti ↑, maaş ↑, geri dönüş oranı ↑
  Kötü partner → öğrenci şikayeti, co-op kalitesi ↓, prestij riski
```

#### Model Karşılaştırması

| Özellik | 2 Dönem + Yaz Okulu | 3 Dönem + Co-op |
|---|---|---|
| Yıllık tur sayısı | 2 (+ opsiyonel yaz) | 3 (hepsi zorunlu) |
| Dönem uzunluğu | 16 hafta | 14 hafta |
| Öğrenci mezuniyet süresi | 8 dönem (4 yıl) | 8-9 dönem (~3 yıl) |
| Hoca iş yükü | Normal (yaz tatili var) | Yüksek (12 ay aktif) |
| Endüstri bağlantısı | Düşük-orta | Çok yüksek |
| Kampüs bakım maliyeti | Normal | +%15 (yıl boyu aktif) |
| Ek gelir fırsatı | Yaz okulu harçları | Co-op endüstri katkıları |
| Hoca araştırma zamanı | Yaz ayları boş (avantaj) | Sınırlı (dezavantaj) |
| Mezun iş bulma oranı | Normal | +%30 bonus |
| Model değiştirme maliyeti | — | 20M ₺ + 2 dönem geçiş süresi + prestij -5 |

#### Stratejik Seçim

- **2 Dönem modeli** araştırma odaklı üniversiteler için idealdir (hocalar yazın araştırma yapar).
- **3 Dönem + Co-op** sektör bağlantısı ve mezun istihdamı odaklı üniversiteler için idealdir.
- Oyuncu oyun içinde model değiştirebilir ama maliyetlidir (reform olayı tetiklenir).

### Dönem Aksiyonları (Her Model İçin Ortak)

#### Dönem Başı Aksiyonları (Oyuncu Kontrolü)

| Aksiyon | Açıklama | Dönem |
|---|---|---|
| Kadro Yönetimi | Hoca transferi, teklif kabul/ret, iş yükü ayarı | Her dönem |
| Bütçe Tahsisi | Bölümlere kaynak dağıtımı, burs miktarı belirleme | Her dönem |
| İnşaat Başlatma | Yeni bina/tesis kararı | Her dönem |
| Araştırma Proje Başvurusu | TÜBİTAK/AB projeleri için başvuru | Güz dönemi |
| Öğrenci Alımı | Yıllık kontenjan kararı (ÖSYM sonuçları) | Güz dönemi |
| Yaz Okulu Planlaması | Açılacak dersler, hoca ataması (Model A) | Bahar sonu |
| Co-op Eşleştirme | Öğrenci-şirket eşleştirmesi (Model B) | Her yaz dönemi öncesi |

#### Dönem İçi Otomatik Olaylar (Simülasyon)

- Hoca mutluluk puanları güncellenir
- Araştırma projelerinde ilerleme kaydedilir
- Öğrenci GPA'ları hesaplanır
- Co-op öğrencileri sektör deneyimi kazanır (Model B, yaz)
- Rastgele olaylar tetiklenir (bkz. Bölüm 11)
- Rakip üniversiteler hamlelerini yapar

#### Dönem Sonu Hesaplamalar (Otomatik)

- Gelir/Gider dengesi ve bütçe raporu
- Hoca performans değerlendirmesi
- Öğrenci başarı istatistikleri
- Mezuniyet listesi (ilgili dönemde biten öğrenciler)
- Co-op geri bildirim raporu (Model B, yaz sonu)
- Prestij puanı güncelleme
- Sıralama pozisyonu güncelleme

#### Dönem Sonu Ekranı

Özet kart dizisi: "Bu dönem neler oldu?" Her kart bir sonuca odaklanır. Oyuncu kartları geçerek okur, sonra "Sonraki Döneme Geç" der.

---

## 3. Ekonomi ve Bütçe Sistemi

### 3.0 Üniversite Tipi Seçimi (Oyun Başında)

Oyun başında oyuncu üniversitenin tipini seçer. Bu seçim tüm ekonomi sistemini şekillendirir.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ÜNİVERSİTE TİPİ SEÇİMİ                           │
├──────────────────┬────────────────────────┬─────────────────────────────── │
│                  │ DEVLET ÜNİVERSİTESİ    │ VAKIF ÜNİVERSİTESİ            │
├──────────────────┼────────────────────────┼─────────────────────────────── │
│ Öğrenci ücreti   │ ÇOK DÜŞÜK (sembolik)  │ YÜKSEK (oyuncu belirler)      │
│ Devlet ödeneği   │ YÜKSEK (ana gelir)    │ DÜŞÜK veya YOK                │
│ Vakıf desteği    │ YOK                   │ VAR (başlangıç sermayesi)      │
│ Kadro esnekliği  │ DÜŞÜK (merkezi atama) │ YÜKSEK (özgürce transfer)     │
│ Maaş esnekliği   │ DÜŞÜK (tavan var)     │ YÜKSEK (piyasa maaşı)        │
│ Öğrenci kalitesi │ Puana göre (ÖSYM)     │ Ücrete duyarlı + puana göre   │
│ Bürokratik yük   │ YÜKSEK (YÖK baskısı) │ ORTA                          │
│ İflas riski      │ DÜŞÜK (devlet kurtarır)│ YÜKSEK (kapanabilir)         │
│ Zorluk           │ ★★★☆☆               │ ★★★★☆                        │
└──────────────────┴────────────────────────┴───────────────────────────────┘
```

#### Devlet Üniversitesi Ekonomisi

```
Gelir yapısı:
  %50-65  Devlet ödeneği (güvenli ama sabit, büyümez)
  %10-15  Öğrenci katkı payı (sembolik, ~2.000-5.000 ₺/dönem)
  %10-20  Araştırma fonları / TÜBİTAK
  %5-10   Döner sermaye
  %3-5    Diğer (bağış, sponsorluk, patent)

Avantajlar:
  + Sabit gelir garantisi (devlet ödeneği)
  + İflas riski düşük (en kötü "kayyum" atanır, oyun devam eder)
  + Öğrenci ücreti düşük → iyi öğrenci çekmek daha kolay
  + Toplum gözünde saygınlık (yerleşik kurum)

Dezavantajlar:
  - Gelir artışı sınırlı (devlet ödeneği enflasyonla bile zorlar)
  - Maaş tavanı: Profesör max 200.000 ₺/ay (ek ders + döner dahil)
    → Yıldız hocaları çekmek ZOR (vakıf 350K+ teklif eder)
  - Kadro atamada bürokratik süreç (1 dönem gecikme)
  - YÖK kısıtları: Kontenjan, bölüm açma/kapama onay gerektirir
  - Bütçe fazlası biriktirilemez (yıl sonu harcanmazsa kesilir)
```

#### Vakıf Üniversitesi Ekonomisi

```
Gelir yapısı:
  %50-70  Öğrenci harçları (ANA GELİR KAYNAĞI)
  %10-20  Vakıf desteği / mütevelli bağış
  %5-15   Araştırma fonları
  %5-10   Döner sermaye + danışmanlık
  %3-8    Sponsorluk, patent, teknokent

Avantajlar:
  + Maaş esnekliği — yıldız hocaya istediğin maaşı ver
  + Kadro esnekliği — hemen al, hemen çıkar (sözleşme bazlı)
  + Bölüm açma/kapama hızlı (YÖK onayı kolay)
  + Gelir potansiyeli çok yüksek (iyi prestijde harç gelirleri patlıyor)
  + Bütçe fazlası yatırıma dönüştürülebilir

Dezavantajlar:
  - Öğrenci bulamazsan BATASIN (harç = ana gelir)
  - Harç yüksekse iyi öğrenci gelmeyebilir (fiyat-kalite dengesi)
  - Vakıf desteği her zaman devam etmez (mütevelli değişebilir)
  - İflas riski YÜKSEK (3 dönem üst üste açık → kapanma)
  - "Paralı üniversite" algısı → prestij tavanı (ilk 30 yıl dezavantaj)
```

#### ABD Üniversitesi Modeli (İleri Zorluk)

ABD modeli tamamen farklı bir oyun deneyimi sunar. Para birimi $, kurallar farklı, spor devasa bir faktör.

```
Gelir yapısı:
  %25-45  Öğrenci ücretleri (tuition — ÇOK YÜKSEK)
  %15-30  Endowment getirisi (yatırım fonu — uzun vade)
  %10-20  Araştırma fonları (NSF, NIH, DARPA, DoD)
  %10-15  Spor gelirleri (NCAA — sadece büyük okullarda)
  %5-15   Mezun bağışları (alumni — en güçlü feedback loop)
  %5-10   Döner sermaye, hastane, lisans
  %3-5    Devlet desteği (sadece state university ise)

Para Birimi: $ (ABD Doları)
```

##### Tuition (Öğrenci Ücreti) Sistemi

```
ABD'de ücretler Türkiye'nin 10-20 katıdır.

Ücret Aralıkları (yıllık):
  Community College:     $5.000 - $15.000
  State University:      $10.000 - $30.000 (in-state)
                         $25.000 - $55.000 (out-of-state)
  Özel Üniversite:       $40.000 - $65.000
  Ivy League / Elit:     $55.000 - $85.000

  + Room & Board (yurt + yemek): $12.000 - $20.000/yıl
  → Toplam maliyet: $20.000 - $100.000/yıl

ABD'de Burs Çeşitleri:
  Merit Scholarship: Akademik başarıya göre (SAT/GPA)
  Athletic Scholarship: SPOR BURSU — ABD'ye özgü, büyük bütçe
  Need-Based Aid: Aile geliri düşükse (FAFSA sistemi)
  Legacy Admission: Mezun çocuklarına öncelik (tartışmalı)
  International Student Aid: Yabancı öğrencilere (sınırlı)

Financial Aid "Meet Full Need" Politikası:
  Elit okullar (Harvard, MIT, Stanford):
    "Kabul edilen herkesin ihtiyacını %100 karşılarız"
    → Ücret $80K ama aile geliri < $75K ise ÜCRETSİZ
    → Sadece çok zengin endowment'ı olan okullar yapabilir
    → Oyunda: Prestij ≥ 90 VE endowment > $5B ise açılır
```

##### Endowment (Bağış Fonu) Sistemi — ABD'nin Süper Gücü

```
ABD üniversitelerinin en büyük farkı: Endowment.
Birikmiş bağış fonu yatırıma yatırılır, getirisi harcanır.

Endowment Mekaniği:
  Başlangıç: $10M - $100M (seçime göre)
  Büyüme: Her yıl mezun bağışları + yatırım getirisi
  Harcama Kuralı: Yılda endowment'ın %4-5'i harcanır (geri kalanı büyür)

  Örnek:
    Endowment = $1 Milyar
    Yıllık Harcama = $1B × %5 = $50M (devasa sabit gelir!)
    + Yeni bağışlar: $20M/yıl
    + Yatırım getirisi: %7 = $70M
    → Yıl sonu endowment: $1B - $50M + $20M + $70M = $1.04B (büyüyor!)

  Endowment Yatırım Riski:
    İyi yıl (boğa piyasası): +%12-15 getiri
    Normal yıl: +%6-8
    Kötü yıl (kriz): -%10-30 (2008 gibi → endowment erir!)
    Oyuncu yatırım stratejisi seçer:
      Agresif: Yüksek getiri + yüksek risk
      Dengeli: Orta getiri + orta risk
      Muhafazakâr: Düşük getiri + düşük risk

  Endowment Büyüklüğü ve Etkisi:
    < $100M:    Kısıtlı, burs kapasitesi düşük
    $100M-$1B:  Orta, araştırma fonlaması mümkün
    $1B-$10B:   Güçlü, "meet full need" düşünülebilir
    $10B+:      Elit (Harvard $50B), para neredeyse sınırsız
```

##### NCAA Spor Sistemi — ABD'ye Özgü Dev Mekanik

```
ABD'de üniversite sporu profesyonel lig gibidir.
Futbol (American football) ve basketbol devasa gelir kaynağıdır.

Spor Bölümleri (Division):
  Division I (D1): Büyük bütçe, TV gelirleri, stadyum
    FBS (Football Bowl Subdivision): En üst seviye
    FCS: Bir alt seviye
  Division II (D2): Orta bütçe, bölgesel
  Division III (D3): Düşük bütçe, spor bursu yok

Spor Gelirleri (D1 FBS):
  TV yayın hakları:    $10M - $80M/yıl (konferans anlaşması)
  Bilet satışı:        $5M - $50M/yıl (100K kişilik stadyum!)
  Sponsorluk (Nike vb.): $5M - $30M/yıl
  Merchandise:         $2M - $15M/yıl
  Turnuva ödülü:       $5M - $20M (March Madness, Bowl oyunları)

  Toplam spor geliri: $30M - $200M/yıl (bazı okullar üniversiteden
  daha çok spor gelirine sahip!)

Spor Giderleri:
  Sporcu bursları: $15M - $50M/yıl (D1'de 300+ sporcu bursu)
  Antrenör maaşları: Baş antrenör $2M - $12M/yıl (!!)
    (Bazı antrenörler rektörden 10× fazla kazanır)
  Tesis bakımı: $5M - $20M/yıl
  Seyahat, ekipman: $3M - $10M/yıl

Spor Bursları (Athletic Scholarship):
  Futbol: 85 tam burs
  Basketbol (Erkek): 13 tam burs
  Basketbol (Kadın): 15 tam burs
  Diğer sporlar: 10-20 burs (yüzme, atletizm, beyzbol...)
  Toplam: 200-300+ sporcu bursu

  Sporcu Öğrenci Profili:
    Akademik yetenek: Genelde düşük-orta (istisnalar var)
    Spor yeteneği: YÜKSEK (1-100 stat)
    Mezuniyet oranı: Ortalama altı (futbol/basketbol)
    AMA: Kampüs kültürü, okul ruhu, marka değeri → prestij bonusu

Spor ve Prestij İlişkisi:
  Başarılı futbol/basketbol sezonu:
    + Başvuru sayısı +%10-30 ("Flutie Effect")
    + Mezun bağışları +%15-20 (heyecanlanıp bağış yaparlar)
    + Marka bilinirliği ulusal düzeyde artar
    + Öğrenci morali ve kampüs ruhu yükselir
  Kötü sezon veya skandal:
    - NCAA ceza riski (şike, akademik sahtekarlık)
    - Burs iptali, turnuva yasağı
    - Prestij kaybı, sponsorlar çekilir

Sporcu Bursu Stratejisi:
  5 yıldızlı recruit (lise yıldızı) çekmek = hoca transferi gibi
  Scout: Lise/hazırlık okullarından yetenek taraması
  Teklif: Tam burs + tesis kalitesi + antrenör ünü + şehir
  Rakip okullar da aynı sporcuyu ister → "Recruiting War"
  NIL (Name, Image, Likeness) hakları:
    Sporcular reklam geliri elde edebilir (2021 sonrası)
    Zengin okul: Sponsorlar sporcuya NIL anlaşması teklif eder
    → Oyuncu buna dolaylı etki edebilir (teknokent/sponsor ağı)
```

##### Tenure (Kalıcı Kadro) Sistemi

```
ABD'de "tenure track" sistemi Türkiye'den farklıdır:

  Assistant Professor (tenure-track): 6 yıl deneme süresi
    → Süre sonunda "tenure kararı": Ya kalıcı kadro ya kovulma
    → "Up or out" — orta yol yok

  Associate Professor (tenured): Kalıcı kadro, kovulamaz
  Full Professor (tenured): En üst düzey

  Tenure Değerlendirme Kriterleri:
    Araştırma ≥ 70 (yayın, fonlama, atıf)
    Eğitim ≥ 50 (öğrenci değerlendirmeleri)
    Service ≥ 40 (komite çalışması, yönetim)

  Tenure Verilmezse:
    Hoca 1 yıl daha kalır ve gider (terminal year)
    Başka üniversiteye transfer olur
    YENİ tenure-track hoca aranır (maliyet + zaman)

  Stratejik ikilem:
    Tenure ver → Hoca kalıcı, kovulamazsın (kötüyse 30 yıl taşırsın)
    Tenure verme → İyi hocayı kaybedersin (rakip kapar)
```

##### ABD vs. Türkiye Karşılaştırma Özeti

```
                    TR Devlet   TR Vakıf    ABD State   ABD Private
Ücret (yıllık)     ~$200       $3-15K      $10-30K     $40-85K
Devlet desteği     YÜKSEK      YOK         ORTA        YOK
Endowment          YOK         NADİR       ORTA        DEV
Spor geliri        YOK         YOK         DEV (D1)    DEV (D1)
Mezun bağışı       DÜŞÜK       DÜŞÜK       YÜKSEK      ÇOK YÜKSEK
Hoca maaş tavanı   VAR         YOK         ORTA        YOK
Transfer esnekliği DÜŞÜK       YÜKSEK      ORTA        YÜKSEK
Spor bursu         YOK         YOK         ÇOK         ÇOK
Tenure sistemi     YÖK bazlı  Sözleşme    Up or out   Up or out
Zorluk             ★★★        ★★★★       ★★★★       ★★★★★
```

### Başlangıç Koşulları

| Parametre | TR Devlet | TR Vakıf | ABD State | ABD Private |
|---|---|---|---|---|
| Başlangıç Bütçesi | 50M ₺ | 80M ₺ | $200M | $150M |
| Endowment | — | — | $50M | $100M |
| Aylık Sabit Gider | ~8M ₺ | ~6M ₺ | ~$15M | ~$10M |
| İlk Öğrenci Sayısı | 1.200 | 600 | 5.000 | 1.500 |
| İlk Hoca Sayısı | 45 | 25 | 150 | 60 |
| Başlangıç Prestij | 35 | 20 | 30 | 25 |
| Bölüm Sayısı | 6 | 3 | 10 | 4 |
| Spor Division | — | — | D2 (D1'e çıkılabilir) | D3 (yükseltilebilir) |

### 3.1 Gelir Kaynakları

#### 3.1.1 Öğrenci Ücretleri (Oyunun En Kritik Ekonomik Kararı)

```
ÜCRETLENDİRME STRATEJİSİ

Vakıf üniversitesinde öğrenci ücreti oyuncunun belirlediği en önemli
değişkendir. Doğru fiyatlama büyüme, yanlış fiyatlama iflas demektir.

Ücret Belirleme (dönem başına, bölüm bazında):
  Oyuncu her bölüm için ayrı ücret belirler.

  Ücret_Aralığı (dönem başına):
    Minimum: 20.000 ₺ (maliyet altı, sürdürülemez)
    Ucuz:    30.000 - 50.000 ₺
    Orta:    50.000 - 100.000 ₺
    Pahalı:  100.000 - 200.000 ₺
    Premium: 200.000 - 400.000 ₺ (çok yüksek prestij gerektirir)

  Devlet üniversitesinde:
    Katkı_Payı = Sabit (YÖK belirler), ~2.000-5.000 ₺/dönem
    Oyuncu değiştiremez. İkinci öğretim ×2, uzaktan eğitim ×1.5.

Bölüm Bazında Ücret Farklılığı:
  Tıp:          ×2.0 (yüksek maliyet, yüksek talep)
  Mühendislik:  ×1.3 (lab maliyeti)
  Hukuk/İşletme: ×1.2 (düşük maliyet, yüksek talep)
  Fen Bilimleri: ×1.0 (baz)
  Sosyal Bilimler: ×0.9 (düşük talep, ucuz tutulmalı)
```

#### Ücret-Öğrenci Kalitesi İlişkisi (Kritik Denge)

```
Ücret arttıkça bazı iyi öğrenciler başka yere gider.
Ücret düştükçe bütçe zorlanır ama talep artar.

Ücret_Cazibe_Etkisi:
  Her öğrencinin bir "ödeme kapasitesi" var (aile geliri).
  Ücret > Ödeme_Kapasitesi ise: O öğrenci gelMEZ (burs yoksa)

  Öğrenci havuzu dağılımı (yaklaşık):
    %15 Zengin: 400K+ ₺/dönem ödeyebilir (sadece prestij bakar)
    %25 Üst-orta: 150-400K ₺ (kalite-fiyat dengesi)
    %35 Orta: 50-150K ₺ (fiyata duyarlı, burs önemli)
    %20 Düşük: < 50K ₺ (burs şart, yoksa devlet üniv. tercih eder)
    %5  Çok düşük: < 20K ₺ (sadece devlet veya tam burslu)

  Paradoks:
    En iyi öğrenciler genelde orta-düşük gelirli ailelerden de çıkar.
    Ücret çok yüksekse → sadece zenginler gelir → ortalama yetenek DÜŞEBİLİR
    Ücret + cömert burs → hem zenginler hem yetenekliler gelir AMA maliyet yüksek

Fiyat_Elastikliği (prestije göre değişir):
  Düşük prestij (< 30):
    Ücret %10 artarsa → başvuru %15 düşer (çok elastik, kimse gelmez)
  Orta prestij (30-60):
    Ücret %10 artarsa → başvuru %8 düşer (orta elastik)
  Yüksek prestij (60-80):
    Ücret %10 artarsa → başvuru %3 düşer (az elastik, herkes ister)
  Çok yüksek prestij (> 80):
    Ücret %10 artarsa → başvuru %1 düşer (neredeyse inelastik)
    → Boğaziçi/ODTÜ etkisi: Herkes ister, fiyat önemli değil

Maliyet-Kalite Stratejileri:

  "Ucuz Üniversite" (30-50K ₺):
    + Çok öğrenci gelir (kontenjan dolar)
    + Fakir ama yetenekli öğrenciler erişebilir
    - Kişi başı gelir düşük, ölçekle telafi gerekir
    - "Ucuz = düşük kalite" algısı (prestij < 40 ise)
    - Hoca maaşlarını karşılamak zor

  "Orta Segment" (60-120K ₺):
    + Dengeli gelir-kalite oranı
    + Orta sınıf erişebilir
    - Hem yukarıya hem aşağıya rekabet
    - Burs politikasıyla ince ayar gerekir

  "Premium" (150-300K ₺):
    + Yüksek kişi başı gelir
    + "Pahalı = kaliteli" algısı (prestij > 60 ise işe yarar)
    - Az öğrenci gelir → kontenjan dolmayabilir
    - Sadece zenginler → yetenek havuzu daralır
    - MUTLAKA cömert burs gerekir (yoksa en iyileri kaçırırsın)

  "Prestij Oyunu" (250K+ ₺):
    + Çok yüksek gelir
    + Marka değeri
    - Sadece prestij > 75 ise sürdürülebilir
    - %40+ burslu öğrenci şart (yoksa diploma fabrikası algısı)
    - Mezun başarısı düşerse çökme riski yüksek
```

#### Burs Stratejisi (Ücret Politikasının İkiz Kardeşi)

```
Burs = Ücretin karşılığı. Yüksek ücret + cömert burs = en iyi strateji
(eğer bütçe yetiyorsa).

Burs Tipleri:
  Tam Burs (Merit):
    Ücretin %100'ü + aylık 5.000 ₺ yaşam desteği
    Koşul: Sınav puanı üst %5 dilim
    Etki: En iyi öğrencileri devletten bile çeker
    Maliyet: ÇOK YÜKSEK (öğrenci başı gelir = negatif)
    AMA: Bu öğrenciler mezun olunca üniversiteye EN ÇOK prestij kazandırır

  %75 Burs:
    Ücretin %75'i karşılanır
    Koşul: Üst %10 dilim
    Etki: İyi öğrenci çeker, maliyet daha az

  %50 Burs:
    Koşul: Üst %20 dilim
    Etki: Dengeli

  %25 Burs:
    Koşul: Üst %30 dilim
    Etki: Teşvik, ama karar verici değil

  İhtiyaç Bursu:
    Aile geliri < eşik ise ek destek
    Etki: Fakir ama yetenekli öğrenciyi kurtarır
    Sosyal sorumluluk puanı bonusu → prestij +1/yıl

  Başarı Bursu (devam eden):
    GPA ≥ 3.5 tutanlar burslu kalır, düşenler kaybeder
    Etki: Motivasyon + rekabet → GPA ortalaması artar
    Risk: Stres → bazı öğrenciler mental sağlık sorunu

Burs Bütçesi Yönetimi:
  Toplam_Burs_Maliyeti = Σ(Burslu_Öğrenci × Burs_Miktarı)
  Burs_Oranı = Toplam_Burs / Toplam_Harç_Geliri

  Burs oranı > %50: Mali açık riski, ama öğrenci kalitesi çok yüksek
  Burs oranı %25-50: Dengeli
  Burs oranı < %15: Gelir yüksek ama öğrenci kalitesi düşer
  Burs oranı = %0: "Diploma fabrikası" algısı, prestij düşer

Net Gelir Formülü:
  Net_Harç_Geliri = Toplam_Öğrenci × Ortalama_Ücret × (1 - Burs_Oranı)
```

#### 3.1.2 Devlet Ödeneği

```
Devlet Üniversitesi:
  Dönem_Ödeneği = Baz_Ödenek + (Öğrenci_Sayısı × Öğrenci_Başı_Pay)
                + Araştırma_Üniv_Bonusu + Performans_Ödeneği

  Baz_Ödenek: 15.000.000 ₺/dönem (sabit)
  Öğrenci_Başı_Pay: 4.500 ₺/öğrenci/dönem
  Araştırma_Üniv_Statüsü: +%40 (Prestij ≥ 70 gerekir)
  Performans_Ödeneği: Sıralamadaki yerine göre
    İlk 10: +5M ₺/dönem
    11-25: +2M ₺/dönem
    26-50: +1M ₺/dönem
    50+: Yok

  Devlet bütçe kesintisi olayı (rastgele):
    Ekonomik kriz dönemlerinde ödenek -%20-30 kesilebilir
    Siyasi karar: Bazı bölgelere artı ödenek, bazılarına kesinti

Vakıf Üniversitesi:
  Devlet ödeneği = YOK (veya sembolik)
  Vakıf Katkısı: Mütevelli heyetinin bağışı
    Başlangıçta: 10-20M ₺/yıl (azalan)
    Üniversite büyüdükçe: Vakıf katkısı sabit kalır veya azalır
    Mütevelli memnuniyeti düşerse: Katkı kesilir
      Mütevelli_Memnuniyeti = f(Kârlılık, Prestij, Skandal_Yokluğu)
    Mütevelli mutsuzsa: "Rektör değiştirin" baskısı
```

#### 3.1.3 Araştırma Fonları / TÜBİTAK

```
Proje Geliri:
  Doğrudan: Proje_Bütçesi (hocalar harcar, araştırma ekipmanı/seyahat)
  Dolaylı:  Genel_Gider_Payı (overhead) = Proje_Bütçesi × %15-30
    → Bu pay üniversitenin genel bütçesine girer

Proje Büyüklükleri:
  TÜBİTAK 1001 (Bilimsel Araştırma):  300K - 2.4M ₺, 3 yıl
  TÜBİTAK 1003 (Öncelikli Alan):      500K - 5M ₺, 3 yıl
  BAP (Üniversite İç Fon):             50K - 500K ₺, 1-2 yıl
  AB Horizon Europe:                    1M - 10M €, 3-5 yıl (BÜYÜK!)
  ERC Starting Grant:                   1.5M €, 5 yıl (prestij bombası)
  Sanayi Projesi (Ar-Ge merkezi):       200K - 5M ₺, 1-3 yıl

Overhead Gelir Tahmini (dönem başına):
  Az proje (5 aktif):      500K - 1.5M ₺
  Orta (15 aktif):         2M - 5M ₺
  Çok (30+ aktif):         5M - 15M ₺
  AB/ERC projesi varsa:    +3M - 8M ₺ (tek proje devasa)
```

#### 3.1.4 Döner Sermaye ve Hizmet Gelirleri

```
Üniversitenin bölümlerine ve tesislerine göre hizmet geliri:

Tıp Fakültesi Hastanesi:
  Gelir: 5M - 30M ₺/dönem (en büyük gelir kaynağı olabilir!)
  Maliyet: 3M - 20M ₺/dönem (personel, ekipman, ilaç)
  Net: 2M - 10M ₺/dönem kâr
  Risk: Malpraktis davası, ekipman arızası, pandemi

Diş Hekimliği Kliniği:    1M - 5M ₺/dönem
Eczacılık Laboratuvarı:   500K - 2M ₺/dönem
Test/Analiz Laboratuvarı:  200K - 3M ₺/dönem (kimya, malzeme, çevre)
Danışmanlık Hizmetleri:    500K - 5M ₺/dönem (hukuk, işletme, mühendislik)
Sürekli Eğitim Merkezi:    300K - 2M ₺/dönem (sertifika programları)
Konferans/Etkinlik Salonu:  100K - 1M ₺/dönem (dış etkinlik kirası)
Spor Tesisleri:             50K - 500K ₺/dönem (dış kullanıma açılırsa)

Teknokent/Kuluçka Merkezi:
  Kira geliri: 500K - 3M ₺/dönem
  Şirket pay geliri: Startup başarılıysa büyük (ama nadir ve gecikmeli)
  Endüstri sponsorluğu: 500K - 10M ₺/yıl (anlaşma bazlı)
```

#### 3.1.5 Mezun Bağışları

```
Mezun bağışları uzun vadeli bir gelir kaynağıdır.
İlk 10 yılda neredeyse sıfırdır, sonra büyümeye başlar.

Dönem_Bağış = Σ(Her_Mezun_Kohort × Bağış_Olasılığı × Bağış_Miktarı)

Bağış_Olasılığı (mezuniyet sonrası yıla göre):
  0-5 yıl:   %2 (yeni mezun, parası yok)
  5-10 yıl:  %8 (kariyer kuruldu)
  10-20 yıl: %15 (üst düzey, bağış kapasitesi yüksek)
  20+ yıl:   %20 (nostalji + bağış kapasitesi)

  × Mezun_Memnuniyeti çarpanı (0.5 - 2.0)
  × Üniversite_Prestij çarpanı (düşükse bağışçı utanır)

Bağış_Miktarı (kişi başı, yıllık):
  Normal mezun: 1.000 - 10.000 ₺
  Başarılı mezun (yönetici, girişimci): 10.000 - 100.000 ₺
  Ünlü mezun: 100.000 - 10.000.000 ₺ (büyük bağış olayı)

Bağış Kampanyası (aktif aksiyon):
  Dönem başında başlatılabilir, maliyet: 500K ₺
  Başarı: Mezun ağı gücü × prestij → bağışlarda +%30-50 o dönem
  Büyük bağışçı olayı tetiklenebilir (ünlü mezun devasa bağış)
```

#### 3.1.6 Patent ve Lisans Gelirleri

```
Patent_Geliri = Aktif_Patent_Sayısı × Ortalama_Lisans_Bedeli
Lisans_Bedeli: 50.000 - 2.000.000 ₺/yıl (buluşun alanına göre)

Patent oluşumu:
  Her dönem, araştırma puanı yeterli hocaların patent üretme şansı var
  Patent_Şansı = (Araştırma - 60) × 0.5 + Alan_Çarpanı
    Mühendislik/Sağlık: Alan_Çarpanı = +10
    Temel Bilim: +3
    Sosyal Bilim: 0 (patent üretmez)
  Teknokent varsa: Patent ticarileştirme başarısı +%30
```

### 3.2 Gider Kalemleri

#### 3.2.1 Maaşlar (En Büyük Gider Kalemi — Toplam Bütçenin %50-65'i)

```
Akademik Maaş Tabanları (aylık, brüt, TL):

  Devlet Üniversitesi (maaş tavanı var):
    Araştırma Görevlisi: 35.000 - 45.000
    Dr. Öğr. Üyesi:     55.000 - 80.000
    Doçent:              80.000 - 120.000
    Profesör:            120.000 - 200.000
    + Ek ders ücreti:    3.000 - 8.000 ₺/ders/ay
    + Döner sermaye payı: Değişken

  Vakıf Üniversitesi (piyasa maaşı, tavan yok):
    Araştırma Görevlisi: 40.000 - 65.000
    Dr. Öğr. Üyesi:     80.000 - 150.000
    Doçent:              120.000 - 250.000
    Profesör:            180.000 - 500.000+
    Yıldız transfer:     500.000 - 1.000.000+ (özel paket)

  Yarı Zamanlı Öğretim Görevlisi: 3.000 - 8.000 ₺/ders/hafta/ay
  Lisansüstü ArGö: 25.000 - 40.000 ₺/ay

İdari Personel Maaş Kütlesi:
  Genel Sekreter:      80.000 - 200.000 ₺/ay
  Birim Müdürleri:     50.000 - 100.000 ₺/ay
  Genel idari kadro:   Akademik maaş kütlesinin %25-35'i kadar

Maaş Kütlesi Dönem Gideri = Σ(Tüm Maaşlar × 5 ay)
  Devlet: Akademik ~%55, İdari ~%20, Diğer ~%5 = toplam bütçenin %80'i
  Vakıf:  Akademik ~%45, İdari ~%15, Diğer ~%5 = toplam bütçenin %65'i
```

#### 3.2.2 Altyapı Bakımı

```
Her binanın yıllık bakım maliyeti = İnşaat_Maliyeti × 0.05
Kalite düştükçe bakım maliyeti artar:
  5 yıldız: normal maliyet
  4 yıldız: +%10
  3 yıldız: +%25
  2 yıldız: +%50 (bakımsız)
  1 yıldız: +%100 + öğrenci memnuniyeti düşer + skandal riski
```

#### 3.2.3 Burs Ödemeleri

```
Burs_Toplam = Σ(Burslu_Öğrenci × Burs_Miktarı)

Burs tipleri ve maliyetleri (dönem başına):
  Tam Burs:    Ücret + 5.000 ₺/ay yaşam = Ücret + 25.000 ₺
  %75 Burs:    Ücret × 0.75
  %50 Burs:    Ücret × 0.50
  %25 Burs:    Ücret × 0.25
  İhtiyaç:     3.000 - 5.000 ₺/ay yaşam desteği = 15.000 - 25.000 ₺/dönem

Devlet üniversitesinde:
  Ücret zaten sembolik → burs = yaşam desteği (yurt + yemek + harçlık)
  Tam burs: 5.000 ₺/ay → 25.000 ₺/dönem
  KYK desteği (dış kaynak): Oyuncunun kontrolünde değil ama etkisi var
```

#### Araştırma Yatırımları

```
Araştırma_Bütçesi = Oyuncu_Kararı (dönem başında belirlenir)
Minimum verimli eşik: 2.000.000 ₺/dönem
Optimal: 5.000.000 - 15.000.000 ₺/dönem
Fazlası verim kaybı → Harcama Verimliliği düşer
```

#### İnşaat ve Genişleme

```
Her bina türü için sabit inşaat maliyeti (bkz. Bölüm 7).
İnşaat süresi boyunca sermaye bloke edilir, gelir sağlamaz.
```

### 3.3 Bütçe Dengesi ve Borçlanma

```
Bütçe_Dengesi = Toplam_Gelir - Toplam_Gider

Pozitif: Rezerve eklenir
Negatif: Rezervden çekilir

Rezerv < 0 olursa:
  Aşama 1 (0 ile -10M arası): Uyarı mesajı, faiz yok
  Aşama 2 (-10M ile -30M arası): Kısa vadeli borç, %3/dönem faiz
  Aşama 3 (-30M ile -60M arası): YÖK denetimi başlar, harcama kısıtı
  Aşama 4 (-60M altı): İFLAS — oyun biter (veya kurtarma paketi opsiyonu)

Borçlanma Mekanizması:
  - Banka kredisi: Anında, %4/dönem, maksimum 30M ₺
  - Vakıf/Bağış kampanyası: 2 dönem sürer, faiz yok, prestij -5
  - Devlet kurtarma paketi: 1 kez kullanılabilir, -10 prestij, YÖK kısıtı 3 dönem
```

### 3.4 İflas Koşulları

Aşağıdakilerden biri gerçekleşirse oyun biter (Hard Fail):

1. Borç -60.000.000 ₺ altına düşer ve 2 dönem içinde toparlanamaz
2. Öğrenci sayısı minimum kapasiteyi (%40 altı) geçerse 3 dönem boyunca
3. Akreditasyon kaybı + mali açık birlikte gerçekleşirse

---

## 4. Akademik Kadro Sistemi

### 4.1 Hoca Profil Kartı

Her hocanın bir profil kartı vardır — futbolcu kartı gibi, tüm özelliklerini tek bakışta gösterir.

#### Temel İstatistikler (1-100, çubuk gösterge)

| İstatistik | Açıklama | Etkisi |
|---|---|---|
| Araştırma | Yayın kalitesi, proje başarısı | Araştırma puanı, TÜBİTAK başvurusu |
| Eğitim | Ders anlatma, materyal, öğrenci ilgisi | Öğrenci GPA, mezuniyet oranı, memnuniyet |
| Yönetim | İdari kapasite, bölüm/fakülte yönetimi | Dekan/bölüm başkanlığı etkinliği |
| Mentorluk | Lisansüstü öğrenci yetiştirme | Doktora mezun kalitesi, genç hoca yetiştirme |
| Popülerlik | Medya, konferans, kamuoyu tanınırlığı | Tercih sırası bonusu, uluslararası görünürlük |
| Sadakat | Transfer direnci, kuruma bağlılık | Rakip teklife dayanıklılık |
| Motivasyon | Dönem bazlı performans çarpanı | Tüm stat'ları ×(Motivasyon/100) etkiler |

```
Örnek Hoca Profil Kartı:
┌─────────────────────────────────────────────────────┐
│  Prof. Dr. Ayşe Kaya            ★★★★☆ (82 OVR)    │
│  Unvan: Profesör   Yaş: 48                          │
│  Alan: Bilgisayar Bilimi                             │
│  Çalışma Alanları: Yapay Zeka, Doğal Dil İşleme     │
│  Bölüm: Bilgisayar Mühendisliği                     │
│  Disiplinler Arası: Dilbilim (%30 uyum)              │
│─────────────────────────────────────────────────────│
│  Araştırma  ████████████████████░░░░░  82            │
│  Eğitim     ████████████░░░░░░░░░░░░░  55            │
│  Yönetim    ██████████████░░░░░░░░░░░  62            │
│  Mentorluk  ████████████████████░░░░░  78            │
│  Popülerlik ██████████████████████░░░  88            │
│  Sadakat    ██████████████░░░░░░░░░░░  60            │
│  Motivasyon ████████████████████░░░░░  80            │
│─────────────────────────────────────────────────────│
│  h-indeks: 28   Yayın: 142   Atıf: 3.200            │
│  Maaş: 280.000 ₺/ay   Sözleşme: 2028'e kadar       │
│  Mutluluk: 72/100  😊                                │
│  Özel: "Disiplinler arası araştırmacı" etiketi       │
└─────────────────────────────────────────────────────┘
```

#### Genel Değerlendirme (OVR — Overall Rating)

```
OVR = (Araştırma × 0.30 + Eğitim × 0.25 + Mentorluk × 0.15
     + Yönetim × 0.10 + Popülerlik × 0.10 + Sadakat × 0.10)
     × (Motivasyon / 100)

OVR Yıldız Karşılıkları:
  90-100: ★★★★★  Dünya çapında (çok nadir, her kategoride 2-3 kişi)
  80-89:  ★★★★☆  Elit
  70-79:  ★★★☆☆  İyi
  55-69:  ★★☆☆☆  Ortalama
  40-54:  ★☆☆☆☆  Zayıf
  < 40:   ☆☆☆☆☆  Yetersiz
```

#### Hoca Arketipleri

Stat dağılımı hocanın "tipi"ni belirler. Bu oyuncuya etiket olarak gösterilir:

| Arketip | Koşul | Oyun Etkisi |
|---|---|---|
| Araştırma Makinesi | Araştırma ≥ 85, Eğitim ≤ 50 | Yayın canavarı ama öğrenci şikayet eder |
| Hoca'nın Hocası | Eğitim ≥ 85, Araştırma ≤ 50 | Öğrenci tapıyor ama yayın az, doçentlik zorlaşır |
| Yıldız | Araştırma ≥ 75, Eğitim ≥ 75 | Nadir ve pahalı — herkes ister |
| Medya Yüzü | Popülerlik ≥ 85 | PR bonusu, tercih sırası etkisi ama kalıcılık düşük |
| Doğal Lider | Yönetim ≥ 70 VE Araştırma ≥ 70 | Altın profil — ideal dekan/rektör, çok nadir |
| Bürokrat | Yönetim ≥ 75 AMA Araştırma < 40 | İdari işleri yapar ama akademik saygınlığı yok, hocalar dinlemez |
| Mentor | Mentorluk ≥ 85 | Doktora öğrencileri çok başarılı, genç hoca yetiştirme |
| Disiplinler Arası | 2+ çalışma alanı, farklı kategorilerde | Sinerji bonusu ama tek bölüme sığmaz |
| Tek Boyutlu | Bir stat ≥ 80, diğerleri ≤ 40 | Ucuz, dar alanda verimli ama esnek değil |

**Gizli Stat'lar (oyuncuya doğrudan gösterilmez):**
- **Potansiyel** (1-100): Genç hocanın ileride ne olacağını belirler. Scout ile ±15 hata payıyla öğrenilebilir.
- **Zaman Yönetimi** (1-100): Hocanın zamanını ne kadar verimli kullandığı. Yüksekse ağır yük altında bile üretken kalır (bkz. 4.3c). Gözlemlenerek anlaşılır ("4 ders veriyor ama hâlâ yayın yapıyor?"). Scout ile ±20 hata payıyla öğrenilebilir.

### 4.1a-2 Yetenek Keşfi ve Geliştirme Sistemi

Hocalar ve öğrenciler ilk geldiğinde gerçek yetenekleri tam olarak bilinmez.
Olanak sağladıkça potansiyelleri ortaya çıkar — FM'deki genç oyuncu gibi.

#### Hoca Geliştirme

```
Yeni Hoca Geldiğinde:
  Görünen stat'lar = Gerçek stat'lar ± belirsizlik bulutu
  Belirsizlik: İlk dönem ±15, her dönem ±3 azalır
  4-5 dönem sonra stat'lar netleşir (gerçek değer görünür)

  Örnek: Yeni Dr. Öğr. Üyesi geldi
    Gerçek Araştırma: 78  → Gösterilen: 65-90 arası (belirsiz)
    3 dönem sonra:        → Gösterilen: 74-82 arası (netleşiyor)
    5 dönem sonra:        → Gösterilen: 78 (kesin)

Geliştirme (Stat Artışı):
  Hocalar sabit kalmaz — olanak sağladıkça BÜYÜR.

  Araştırma stat artışı:
    + İyi lab altyapısı: +1-2/dönem
    + Araştırma fonu verilmesi: +1-3/dönem
    + İyi lisansüstü öğrenci: +1-2/dönem
    + Yurt dışı konferans bütçesi: +1/dönem
    + Sabbatical (araştırma izni, 1 dönem): +5-8 (tek seferlik sıçrama)
    - Aşırı ders yükü: -1-2/dönem (gelişemez)
    - Lab yoksa: -1/dönem (gerileme)

  Eğitim stat artışı:
    + Pedagoji eğitimi (üniversite programı): +2-3/dönem
    + Az ders yükü (hazırlanma zamanı): +1/dönem
    + Öğrenci geri bildirimi iyi: +1/dönem (motivasyon)
    - Çok kalabalık sınıf: gelişemez (hayatta kalma modu)

  Potansiyel Tavana Dikkat:
    Stat artışı Potansiyel değerine kadar olur, sonra yavaşlar.
    Potansiyel 85 olan hoca → stat'lar 85'e kadar büyüyebilir
    Potansiyel 50 olan hoca → 50'de tavan, daha fazla yatırım boşa
    → Genç hocalara yatırım yaparken Potansiyel tahminini iyi yap!

  "Sürpriz Gelişme" Olayı (nadir):
    Düşük Potansiyel tahmin edilen hoca aslında yüksek Potansiyelli çıkar
    → "Bu hocada bir şey var!" bildirimi (keyifli an)
    Tersi de olur: Yüksek beklenti, düşük gerçek → hayal kırıklığı
```

#### Öğrenci Yetenek Keşfi

```
Kohort öğrencileri arasından yıldızlar "keşfedilir" — baştan bilinmez.

Keşif Mekanizması:
  Her dönem, kohort içindeki öğrencilerin küçük bir kısmı
  öne çıkar ve "yıldız öğrenci" kartına dönüşür.

  Keşif_Şansı(dönem başına) = Olanak_Kalitesi × Kohort_Yetenek_Ortalaması / 5000

  Olanak_Kalitesi:
    Lab altyapısı (araştırma yıldızı keşfi): +20
    Kulüp/etkinlik bütçesi (lider/sanatçı keşfi): +15
    Spor tesisi (sporcu keşfi): +15
    Girişimcilik merkezi / teknokent (girişimci keşfi): +20
    Mentorluk programı (akademik dâhi keşfi): +25
    Hiçbir olanak yoksa: Keşif şansı çok düşük (yetenek israf olur!)

  Örnek:
    1000 öğrencili bölüm, iyi lab + iyi kulüpler
    Her dönem 1-3 öğrenci "yıldız" olarak keşfedilir
    4 yıl = 8 dönem × 2 ortalama = ~16 yıldız keşfi (1000'den 16 = %1.6)

  Keşfedilmemiş Yetenek Kaybı:
    Olanak yoksa yıldızlar keşfedilmeden mezun olur → boşa gider
    Mezun olduktan SONRA başarılı olabilir (dışarıda keşfedilir)
    → "Keşke biz yatırım yapsaydık" olayı (pişmanlık)
    → Rakip üniversitenin mezunu olarak ün kazanır (acı)
```

### 4.1a-3 Kitle vs. Butik Üniversite Stratejisi

Oyuncu üniversitesini iki uçta konumlandırabilir. Her ikisi de kazanabilir.

```
┌─────────────────────────────────────────────────────────────────────────┐
│              KİTLE ÜNİVERSİTESİ  ←——→  BUTİK ÜNİVERSİTE              │
├─────────────────────────────┬───────────────────────────────────────── │
│ Çok öğrenci (5000+)        │ Az öğrenci (500-1500)                    │
│ Çok bölüm (15+)            │ Az bölüm (3-6), odaklı                  │
│ Büyük kampüs, çok bina     │ Küçük kampüs, kaliteli bina              │
│ Harç geliri × hacim = yüksek│ Harç geliri × fiyat = yüksek            │
│ Sınıf büyüklüğü: büyük    │ Sınıf büyüklüğü: küçük (15-25)         │
│ Hoca/öğrenci oranı: düşük  │ Hoca/öğrenci oranı: yüksek              │
│ Araştırma: geniş ama sığ   │ Araştırma: dar ama derin                 │
│ Mezun ağı: GENİŞ           │ Mezun ağı: DAR ama GÜÇLÜ                │
│ Yıldız keşfi: çok aday     │ Yıldız keşfi: az aday ama fark edilme ↑ │
├─────────────────────────────┼─────────────────────────────────────────│
│ Gelir modeli: Hacim         │ Gelir modeli: Marj                      │
│ Risk: Kalite kontrolü zor  │ Risk: Tek bölüm batarsa her şey batar   │
│ Büyüme: Hızlı, çok yönlü  │ Büyüme: Yavaş ama prestij/öğrenci ↑↑   │
│ Örnek: ODTÜ, İTÜ, Michigan │ Örnek: TOBB ETÜ, Caltech, MIT           │
└─────────────────────────────┴─────────────────────────────────────────┘

Mekanik Farklar:

  Kitle (5000+ öğrenci):
    + Harç geliri hacimle çarpılır → büyük bütçe
    + Çok bölüm → trend değişikliğine dayanıklı
    + Geniş mezun ağı → uzun vadede bağış gücü
    + Daha çok öğrenci = daha çok yıldız aday (sayısal avantaj)
    - Sınıflar kalabalık → öğrenme çarpanı düşük
    - Hoca başına öğrenci fazla → araştırma zamanı az
    - Yönetim karmaşıklığı yüksek → iyi idari kadro şart
    - Yıldız öğrenci fark edilmeyebilir (kalabalıkta kaybolur)
      Keşif_Şansı_Penaltı: Öğrenci/hoca > 25 ise ×0.8

  Butik (500-1500 öğrenci):
    + Küçük sınıflar → öğrenme ×1.2 (bireysel ilgi)
    + Hoca/öğrenci oranı yüksek → araştırmaya vakit
    + Her öğrenci "tanınır" → yıldız keşfi daha kolay
      Keşif_Bonusu: Öğrenci/hoca < 12 ise ×1.3
    + Premium fiyat → kişi başı gelir yüksek (prestij yeterliyse)
    + Yönetim basit → idari maliyet düşük
    - Toplam gelir düşük → yatırım kapasitesi sınırlı
    - Tek trend'e bağımlı → alan soğursa sıkışırsın
    - Dar mezun ağı → bağış geç başlar
    - Bir yıldız hocanın gitmesi bütün bölümü çökertir

  Melez Strateji:
    Az bölümle butik başla → prestij kas → sonra genişle
    VEYA kitleyle başla → gelir kazan → kaliteyi yavaş yavaş artır
    Her iki yol da geçerli ama geçiş dönemi acı verir.
```

### 4.1b Hoca Alan ve Çalışma Alanları

Her hocanın bir **ana alanı** ve bir veya birden fazla **çalışma alanı** (uzmanlık) vardır.

#### Ana Alanlar (Bölüm Kategorileriyle Eşleşir)

```
Mühendislik Alanları:
  bilgisayar_bilimi, elektrik_elektronik, makine, insaat, endustri,
  biyomedikal, yazilim, yapayzeka, cevre, gida

Temel Bilim Alanları:
  fizik, kimya, matematik, biyoloji, molekuler_biyoloji, istatistik

Sosyal Bilim Alanları:
  isletme, iktisat, hukuk, uluslararasi_iliskiler, psikoloji,
  siyaset_bilimi, sosyoloji, tarih, felsefe, dilbilim

Sağlık Alanları:
  tip, dis_hekimligi, eczacilik, hemsirelik
```

#### Çalışma Alanları (Alt Uzmanlıklar)

Her hoca 1-3 çalışma alanına sahiptir. Bu alanlar spesifik araştırma konularıdır.

```
Örnek — Ana Alan: bilgisayar_bilimi
  Çalışma Alanları: ["yapay_zeka", "dogal_dil_isleme"]

Örnek — Ana Alan: fizik
  Çalışma Alanları: ["kuantum_fizigi", "optoelektronik"]

Örnek — Ana Alan: isletme
  Çalışma Alanları: ["finans", "girisimcilik"]

Her çalışma alanının bir talep_sıcaklığı var (bölüm trendleriyle paralel).
Sıcak çalışma alanında çalışan hocanın öğrenci çekiciliği ve proje şansı artar.
```

#### Bölüm-Hoca Uyumu (Kritik Mekanik)

Bir hoca yanlış bölüme atanırsa verimlilik düşer.

```
Uyum Hesaplama:

  Tam Uyum (%100):
    Hocanın ana alanı = Bölümün ana alanı
    Örnek: bilgisayar_bilimi hocası → Bilgisayar Mühendisliği bölümü

  Yakın Uyum (%75):
    Hocanın ana alanı bölümle aynı kategoride ve ilişkili
    Örnek: yazilim hocası → Bilgisayar Mühendisliği bölümü
    Örnek: istatistik hocası → Matematik bölümü
    Örnek: fizik hocası → Elektrik-Elektronik bölümü

  Kısmi Uyum (%50):
    Hocanın çalışma alanlarından biri bölümle örtüşüyor
    Örnek: matematik hocası (çalışma alanı: kriptografi) → BM bölümü
    Örnek: fizik hocası (çalışma alanı: malzeme bilimi) → Makine bölümü

  Düşük Uyum (%25):
    Aynı fakülte ama farklı alan
    Örnek: inşaat hocası → Makine bölümünde ders veriyor

  Uyumsuz (%0):
    Tamamen farklı kategori, hiçbir çalışma alanı örtüşmüyor
    Örnek: tarih hocası → Bilgisayar Mühendisliği bölümü

Uyum Etkisi:
  Efektif_Araştırma = Araştırma × Uyum_Yüzdesi
  Efektif_Eğitim    = Eğitim × (0.5 + Uyum_Yüzdesi × 0.5)
    (Eğitim daha az etkilenir — iyi bir hoca yanlış alanda da fena değildir)

  Uyum < %50 ise:
    - Hoca motivasyonu her dönem -5
    - "Alanım dışında çalışıyorum" şikayeti
    - 3 dönem sonra transfer talebi riski
    - Öğrenci yorumu: "Hoca konuya hakim değil" → memnuniyet düşer
```

#### Yakın Alan İlişki Matrisi

```
bilgisayar_bilimi ↔ yazilim ↔ yapayzeka           (tam yakın)
bilgisayar_bilimi ↔ matematik ↔ istatistik         (yakın)
elektrik_elektronik ↔ fizik                         (yakın)
makine ↔ fizik ↔ malzeme                            (yakın)
kimya ↔ eczacilik ↔ molekuler_biyoloji              (yakın)
biyoloji ↔ molekuler_biyoloji ↔ tip                 (yakın)
iktisat ↔ isletme ↔ siyaset_bilimi                  (yakın)
psikoloji ↔ sosyoloji ↔ dilbilim                    (yakın)
hukuk ↔ siyaset_bilimi ↔ uluslararasi_iliskiler     (yakın)
matematik ↔ fizik ↔ istatistik                      (yakın)
```

### 4.1c Disiplinler Arası Araştırma

Bazı hocalar birden fazla alanın kesişiminde çalışır. Bu hem büyük avantaj hem yönetim zorluğudur.

#### Disiplinler Arası Hoca Profili

```
Disiplinler arası hoca olma koşulu:
  - 2+ farklı kategoriden çalışma alanı
  - VEYA aynı kategori içinde uzak alanlarda çalışma (fizik + biyoloji gibi)

Örnek Disiplinler Arası Profiller:
  "Biyoinformatik": bilgisayar_bilimi + molekuler_biyoloji
  "Nörobilim":      psikoloji + tip + bilgisayar_bilimi
  "Hesaplamalı Finans": matematik + isletme
  "Robotik Cerrahi": makine + tip
  "Yapay Zeka Etiği": yapayzeka + felsefe + hukuk
  "Çevre Ekonomisi": cevre + iktisat
  "Dijital Beşeri Bilimler": bilgisayar_bilimi + tarih + dilbilim
```

#### Disiplinler Arası Mekanikler

```
Avantajlar:
  - İki bölüm arasında sinerji bonusu tetikler (+%10 araştırma her iki bölüme)
  - Disiplinler arası projeler kazanma şansı +%20 (AB Horizon, ERC özellikle sever)
  - Yüksek etkili yayın şansı +%15 (Nature, Science gibi dergiler sever)
  - Yeni araştırma merkezi kurma imkanı açar (bkz. Bölüm 7)
  - Benzersiz ders açabilir → öğrenci çekiciliği bonusu

Dezavantajlar / Zorluklar:
  - Tek bölüme tam uyum sağlayamaz (max %75 uyum, hiçbir bölümde %100 değil)
  - İş yükü yönetimi zor — hangi bölüm ne kadar sahiplenecek?
  - İki bölüm de "bizim hocamız" demezse sahipsiz kalır → motivasyon düşer
  - Performans değerlendirme karışır (hangi bölümün yayını sayılacak?)

Çözüm Mekanikleri:
  - "Ortak Atama" (Joint Appointment): Hoca iki bölüme %50-%50 veya %70-%30 atanır
    Her bölüm kendi payı kadar araştırma puanı alır
    Maaş bölümler arası paylaşılır
  - "Araştırma Merkezi" atanması: Bölüm yerine merkeze bağlanır (bkz. 4.1d)
    Bölüm uyum sorunu ortadan kalkar ama eğitim yükü hafifler
```

### 4.1d Fakülte Yapısı ve Yeniden Yapılanma

Bölümler fakültelere bağlıdır. Fakülte yapısı performansı doğrudan etkiler.

#### Başlangıç Fakülte Yapısı (Varsayılan)

```
Mühendislik Fakültesi
  ├── Bilgisayar Mühendisliği
  ├── Elektrik-Elektronik Mühendisliği
  ├── Makine Mühendisliği
  ├── İnşaat Mühendisliği
  ├── Endüstri Mühendisliği
  └── (yeni açılanlar buraya düşer)

Fen-Edebiyat Fakültesi
  ├── Matematik
  ├── Fizik
  ├── Kimya
  ├── Biyoloji
  └── (sosyal bilimler de başlangıçta burada)

İktisadi ve İdari Bilimler Fakültesi
  ├── İşletme
  ├── İktisat
  └── Uluslararası İlişkiler

(Tıp Fakültesi, Hukuk Fakültesi vb. ayrı açılır)
```

#### Fakülte Etkisi

```
Her fakültenin bir Dekanı vardır (atanan hoca, Yönetim stat'ı önemli).

Fakülte Bonusu:
  İyi Dekan (Yönetim ≥ 70):
    - Fakülte içi tüm bölümlere motivasyon +5
    - Bütçe verimliliği +%10
    - İç çatışma riski -%20

  Kötü Dekan (Yönetim ≤ 40):
    - Motivasyon -5
    - Bürokratik yavaşlama: Proje başvuruları 1 dönem gecikebilir
    - Hoca şikayetleri artar

Fakülte Büyüklük Sorunu:
  Fakültedeki bölüm sayısı arttıkça yönetim zorlaşır:
    2-4 bölüm: Normal (bonus/penaltı yok)
    5-6 bölüm: Yönetim zorluğu +%10 (idari yük, toplantı enflasyonu)
    7+ bölüm:  Yönetim zorluğu +%25, bölümler arası kaynak kavgası
               Bazı bölümler "ihmal ediliyor" hisseder → motivasyon düşer
```

#### Fakülte Yeniden Yapılanma (Stratejik Reform)

Oyuncu bölümleri fakülteler arasında taşıyabilir veya yeni fakülte kurabilir.

```
Yeni Fakülte Kurma:
  Maliyet: 5M ₺ (idari yapılanma) + dekan ataması + bina tahsisi
  Süre: 1 dönem geçiş
  Prestij etkisi: Doğru yapılırsa +3, yanlış yapılırsa -2

Bölüm Taşıma (Fakülteler Arası):
  Maliyet: 1M ₺ + 1 dönem geçiş süresi
  Risk: Taşınan bölümdeki hocalar %30 ihtimalle mutsuz olur
        (özellikle eski fakülteye bağlılarsa)

Örnek Stratejik Yeniden Yapılanmalar:

  1. "Bilgisayar ve Yapay Zeka Fakültesi" Kurma
     ─────────────────────────────────────────
     Bilgisayar Müh. + Yapay Zeka Müh. + Yazılım Müh.
     → Mühendislik Fakültesinden ayrılır

     Sonuçlar:
     + Bu bölümler artık kendi bütçelerini kontrol eder
     + Mühendislik Fakültesi küçülür → yönetim kolaylaşır
     + BM/YZM odaklı dekan → araştırma fokus bonusu +%15
     + Hocalar "kendi evimiz" hisseder → motivasyon +8
     + Disiplinler arası BM-YZM işbirlikleri kolaylaşır
     + Öğrenci çekiciliği bonusu (trend alanı bağımsızlaştı)
     - Mühendislik Fakültesi prestij kaybedebilir (güçlü bölümler gitti)
     - İlk dönem geçiş sancısı (idari karışıklık)

  2. "Fen-Edebiyat" → "Fen Fakültesi" + "Edebiyat Fakültesi" Bölme
     ──────────────────────────────────────────────────────────────
     Fen: Matematik, Fizik, Kimya, Biyoloji
     Edebiyat/Sosyal: Tarih, Felsefe, Sosyoloji, Dilbilim

     Sonuçlar:
     + Her gruba uygun dekan atanır (bilimci vs. sosyal bilimci)
     + Kaynak dağılımı adilleşir (lab ihtiyaçları çok farklı)
     + Küçük fakülte bonusu (yönetim kolaylığı)
     - Çapraz ders verme zorlaşır
     - İki dekan maaşı (idari maliyet artar)

  3. "Sağlık Bilimleri Fakültesi" Altında Birleştirme
     ─────────────────────────────────────────────────
     Tıp + Hemşirelik + Eczacılık + Biyomedikal

     Sonuçlar:
     + Ortak lab altyapısı → maliyet -%15
     + Disiplinler arası sağlık araştırması bonusu
     + Hastane kaynaklarını paylaşma
     - Tıp fakültesi "bağımsızlığımızı kaybettik" diyebilir
     - Tıp hocaları küçük bölümlerle eşitlenmekten rahatsız olabilir
```

#### Fakülte Yapısı ve Hoca Mutluluğu İlişkisi

```
Bölüm-Fakülte Uyumsuzluğu:
  Bir bölüm kendi doğasına uymayan fakültede olduğunda:
    - Bölüm hocalarının motivasyonu -3/dönem
    - "Biz burada üvey evlat muamelesi görüyoruz" olayı tetiklenebilir
    - Kaynak dağılımında dezavantaj (dekan kendi alanını kayırır)

  Uyumsuzluk Örnekleri:
    ✗ Bilgisayar Müh. → Fen-Edebiyat Fakültesinde (gerçek hayatta bazen olur)
    ✗ Psikoloji → Mühendislik Fakültesinde
    ✗ İstatistik → Tıp Fakültesinde (ortak alan var ama idari sorun)

  Uyumlu Yerleşim:
    ✓ Bilgisayar Müh. → Mühendislik veya Bilgi Teknolojileri Fakültesi
    ✓ Psikoloji → Fen-Edebiyat veya Sosyal Bilimler Fakültesi
    ✓ Biyomedikal → Mühendislik veya Sağlık Bilimleri (her ikisi de uyumlu)
```

#### Araştırma Merkezleri (Disiplinler Arası Çözüm)

```
Fakülte yapısına ek olarak oyuncu "Araştırma Merkezi" kurabilir.
Merkezler fakülte dışı, çapraz yapılardır.

Araştırma Merkezi Kurma:
  Maliyet: 3M - 15M ₺ (alana göre)
  Gereksinim: En az 2 farklı bölümden 3+ hoca
  Direktör ataması gerekir (Araştırma ≥ 70 + Yönetim ≥ 60)

Merkez Etkileri:
  + Disiplinler arası hocalar buraya atanarak uyum sorunu çözülür
  + Merkezden çıkan yayınlar üniversite geneline prestij katar
  + AB/ERC proje başarı şansı +%25
  + Sektör işbirliği kolaylaşır (odaklı yapı)
  - Bölümler "hocamızı aldılar" diye şikayet edebilir
  - Ek yönetim maliyeti

Örnek Merkezler:
  "Yapay Zeka ve Veri Bilimi Araştırma Merkezi"
    Katılımcı bölümler: BM, Matematik, İstatistik, İşletme
  "Biyomedikal İnovasyon Merkezi"
    Katılımcı bölümler: Biyomedikal, Tıp, E-E, Makine
  "Sürdürülebilirlik ve Enerji Merkezi"
    Katılımcı bölümler: Çevre, Kimya, İktisat, E-E
```

### 4.2 Unvanlar ve Kariyer İlerlemesi

```
Araştırma Görevlisi (ArGö)
    ↓ [Doktora tamamlama: 4-6 dönem]
Dr. Öğr. Üyesi
    ↓ [Doçentlik Başvurusu]
Doçent
    ↓ [Profesörlük (üniversite ataması)]
Profesör
    ↓ [Olağanüstü performans]
Emeritus Profesör (özel durum)
```

#### Doçentlik Başvuru Kriterleri (YÖK benzeri)

```
Başvuru için gerekli minimum:
  - Q1/Q2 yayın sayısı ≥ 5 (araştırma ≥ 60 ise şans artar)
  - Doktora sonrası görev süresi ≥ 4 yıl (8 dönem)
  - Atıf sayısı ≥ 50

Başarı Şansı = (Araştırma_Stat - 40) × 1.5 + (Yayın_Puanı × 2) + (Atıf / 10)
Maksimum %95, minimum %5
Başarısız olursa 2 dönem bekleme (gerçek hayat gibi)
```

#### Profesörlük Kriterleri

```
Doçent sonrası minimum 3 yıl (6 dönem)
Araştırma ≥ 70 ve Eğitim ≥ 50
Atıf sayısı ≥ 200
Üniversitenin kadro açığı olmalı
```

### 4.2b Lisansüstü Öğrenciler ve Asistanlar

Lisansüstü öğrenciler (yüksek lisans ve doktora) üniversitenin araştırma motorunun vazgeçilmez parçasıdır. Geçicidirler — mezun olup giderler — ama olmadan ciddi araştırma yapılamaz.

#### Lisansüstü Öğrenci Tipleri

```
┌──────────────────┬──────────┬──────────┬────────────┬──────────────────────┐
│ Tip              │ Süre     │ Araştırma│ Eğitim     │ Mezun Olunca         │
│                  │          │ Katkısı  │ Katkısı    │                      │
├──────────────────┼──────────┼──────────┼────────────┼──────────────────────┤
│ Yüksek Lisans    │ 3-4 dönem│ Düşük-   │ Lab asist. │ Sektöre gider veya   │
│ Öğrencisi (YL)   │          │ Orta     │ ders asist.│ doktoraya başlar      │
├──────────────────┼──────────┼──────────┼────────────┼──────────────────────┤
│ Doktora          │ 6-10     │ YÜKSEK   │ Lab asist. │ Akademiye kalabilir   │
│ Öğrencisi (PhD)  │ dönem    │          │ ders verme │ (potansiyel hoca)     │
├──────────────────┼──────────┼──────────┼────────────┼──────────────────────┤
│ Araştırma        │ Sözleşme │ Orta-    │ Lab yönet. │ Kadro alırsa kalır,   │
│ Görevlisi (ArGö) │ bazlı    │ Yüksek   │ ders verme │ yoksa başka üniv.     │
└──────────────────┴──────────┴──────────┴────────────┴──────────────────────┘
```

#### Lisansüstü Öğrenci Profil Kartı

Her lisansüstü öğrencinin basitleştirilmiş bir profili vardır.

```
┌─────────────────────────────────────────────────────┐
│  Elif Demir               ★★★☆☆ (Doktora, 3. yıl) │
│  Danışman: Prof. Dr. Ayşe Kaya                      │
│  Alan: Yapay Zeka — Doğal Dil İşleme                │
│  Burs: Tam burs + ArGö maaşı                        │
│─────────────────────────────────────────────────────│
│  Yetenek     ██████████████████░░░░░░░  72           │
│  Çalışkanlık ████████████████████░░░░░  80           │
│  Bağımsızlık ████████████░░░░░░░░░░░░░  50           │
│─────────────────────────────────────────────────────│
│  Yayın: 2 (1×Q2, 1×konferans)                       │
│  Tez İlerlemesi: ████████░░░░ %65                    │
│  Asistanlık: BM201 Lab (12 saat/hafta)               │
│  Kalan Süre: ~3 dönem                                │
└─────────────────────────────────────────────────────┘

Stat'lar (1-100):
  Yetenek:      Ham akademik kabiliyet, araştırma çıktı kalitesini belirler
  Çalışkanlık:  Ne kadar zaman harcar, araştırma hızını belirler
  Bağımsızlık:  Danışmansız ne kadar iş çıkarır (düşükse danışman zamanı yer)
```

#### Lisansüstü Öğrenci Kalite Dağılımı

```
Lisansüstü öğrenciler de iyi ve kötü olur. Kaliteleri üniversitenin
prestijine ve bölümün itibarına bağlıdır.

Ortalama_Öğrenci_Kalitesi = Üniversite_Prestij × 0.4
                          + Bölüm_Araştırma_Puanı × 0.3
                          + Danışman_Ünü × 0.2
                          + Burs_Miktarı_Çarpanı × 0.1

Kalite dağılımı (normal dağılım):
  Prestij > 80: Ortalama yetenek 70, std 15 (çoğu iyi)
  Prestij 50:   Ortalama yetenek 50, std 20 (karışık)
  Prestij < 30: Ortalama yetenek 35, std 15 (çoğu zayıf)

Yıldız Doktora Öğrencisi (Yetenek ≥ 85):
  - Nadir ama bulduysan altın değerinde
  - Danışmana yayın üretir, projeleri taşır
  - Mezun olunca: Akademiye kalma ihtimali yüksek → potansiyel hoca
  - Herkes ister: Rakip üniversiteler burs teklif edebilir

Zayıf Öğrenci (Yetenek < 35):
  - Danışmanın zamanını yer, az çıktı verir
  - Tez süresi uzar (10+ dönem) → maliyet artar
  - Motivasyon düşerse bırakabilir → yatırım boşa gider
  - Asistanlık kalitesi düşük → lisans öğrencileri şikayetçi
```

#### Danışman-Öğrenci İlişkisi

```
Her lisansüstü öğrenci bir danışman hocaya bağlıdır.
Danışman hocanın Mentorluk stat'ı ilişkiyi belirler.

Danışman Kapasitesi:
  Bir hoca aynı anda max kaç lisansüstü öğrenci yönetebilir:
    Mentorluk < 40:  max 2 öğrenci (zorlanır)
    Mentorluk 40-69: max 4 öğrenci
    Mentorluk 70-89: max 6 öğrenci
    Mentorluk ≥ 90:  max 8 öğrenci (usta mentor)

Danışman Etkisi:
  Öğrenci_Efektif_Yetenek = Öğrenci_Yetenek
    + (Danışman_Mentorluk - 50) × 0.2
    + (Danışman_Araştırma - 50) × 0.1

  İyi danışman (Mentorluk 85, Araştırma 80):
    +7 + 3 = +10 efektif yetenek → zayıf öğrenciyi bile adam eder
  Kötü danışman (Mentorluk 30, Araştırma 40):
    -4 -1 = -5 efektif yetenek → iyi öğrenciyi bile batırabilir

Danışman Zamanı (bkz. 4.3c zaman bütçesi):
  Her lisansüstü öğrenci danışmandan zaman yer:
    Bağımsızlık yüksek (≥ 70): 0.5 birim/hafta (az zaman alır)
    Bağımsızlık orta (40-69):  1.0 birim/hafta
    Bağımsızlık düşük (< 40):  2.0 birim/hafta (çok zaman alır)

  → Zayıf ve bağımsız olmayan öğrenci danışmanın araştırma zamanını yer
  → İyi ve bağımsız öğrenci danışmana zaman kazandırır (kendi başına yayın üretir)
```

#### Lisansüstü Öğrencilerin Araştırma Katkısı

```
Lisansüstü öğrenciler hocanın araştırma çıktısını doğrudan artırır.
Ciddi araştırma yapmak için lisansüstü öğrenci ŞART.

Araştırma Çarpanı = 1.0 + Σ(Öğrenci_Katkısı)

Öğrenci_Katkısı (kişi başı):
  YL öğrencisi:  (Efektif_Yetenek × Çalışkanlık / 10000) × 0.3
    → İyi YL (70×80): +0.17 | Kötü YL (30×40): +0.04
  PhD öğrencisi: (Efektif_Yetenek × Çalışkanlık / 10000) × 0.6
    → İyi PhD (85×90): +0.46 | Kötü PhD (35×40): +0.08
  ArGö:          (Efektif_Yetenek × Çalışkanlık / 10000) × 0.5
    → İyi ArGö (75×80): +0.30

Örnek:
  Prof. Kaya: Araştırma stat 82, araştırma zamanı 15/20
  Öğrencileri: 2 iyi PhD (+0.46 + 0.40) + 1 orta YL (+0.10)
  Araştırma_Çarpanı = 1.0 + 0.96 = 1.96 (neredeyse 2 katı!)

  Aynı hoca öğrencisiz:
  Araştırma_Çarpanı = 1.0 (tek başına, yarı verimli)

  → Lisansüstü öğrenci olmadan hoca araştırma potansiyelinin
    yarısını bile kullanamaz. Bu gerçek hayattaki gibi.
```

#### Asistanlık Görevleri (Eğitim Katkısı)

```
Lisansüstü öğrenciler asistan olarak eğitime de katkı sağlar.
Bu hem hocayı rahatlatır hem öğrencinin deneyim kazanmasını sağlar.

Asistanlık Tipleri:

  Lab Asistanlığı:
    - Laboratuvar derslerinde öğrencilere yardım
    - Haftalık yük: 4-8 saat
    - Hocanın lab dersi yükünden -2 birim zaman tasarrufu
    - Lab dersi kalitesi: Asistan yeteneğine bağlı
      İyi asistan (Yetenek ≥ 60): Lab kalitesi nötr-pozitif
      Kötü asistan (Yetenek < 40): Lab kalitesi düşer, öğrenci şikayet

  Ders Asistanlığı:
    - Ödev toplama, not verme, ofis saati tutma
    - Haftalık yük: 4-6 saat
    - Hocanın ödev/sınav zaman yükünden -%40 tasarruf
    - Öğrenci deneyimi: İyi asistan → "asistan çok yardımcı" +5 memnuniyet
                        Kötü asistan → "asistan bir şey bilmiyor" -5

  Ders Verme (sadece ileri PhD ve ArGö):
    - Bir lisans dersini bağımsız verebilir
    - Koşul: PhD 4. yıl+ veya ArGö, Yetenek ≥ 60
    - Hocanın ders yükünden tam -1 ders tasarrufu
    - Eğitim kalitesi: Genelde düşük-orta (deneyimsiz)
      Öğrenci tepkisi: "Hocamız yok, asistan anlatıyor" -10 memnuniyet
      AMA bazı yıldız PhD'ler çok iyi anlatır (Yetenek ≥ 85): nötr

Asistanlık Yükü ve Araştırma Dengesi:
  Asistanlık öğrencinin kendi araştırma zamanını da yer!

  Öğrenci Zaman Bütçesi (haftalık, 50 birim):
    Kendi dersleri (YL: 3-4 ders, PhD: 1-2 ders): 8-16 birim
    Asistanlık görevi: 4-12 birim
    Tez/araştırma çalışması: KALAN
    Minimum araştırma zamanı: 15 birim (altı tehlikeli)

  Aşırı asistanlık yüklenen öğrenci:
    - Tez ilerlemesi yavaşlar → mezuniyet süresi uzar
    - Motivasyon düşer → kalite düşer veya bırakma riski
    - "Beni ucuz iş gücü olarak kullanıyorlar" şikayeti
    - Danışmanla ilişki bozulur

  Asistanlık yükü dengesi:
    4-6 saat/hafta: İdeal — deneyim kazanır, araştırma zamanı yeterli
    8-10 saat/hafta: Ağır — tez yavaşlar ama idare edilir
    12+ saat/hafta: Sömürü — tez durur, motivasyon düşer, bırakma riski
```

#### Lisansüstü Öğrenci Yaşam Döngüsü

```
YL Yaşam Döngüsü (3-4 dönem):
  Dönem 1: Dersler + lab adaptasyonu (katkısı düşük)
  Dönem 2: Dersler + tez araştırması başlar (katkı artmaya başlar)
  Dönem 3: Tez yoğun dönem (en yüksek katkı)
  Dönem 4: Tez teslimi + mezuniyet (katkı biter)
  → Toplam net katkı: DÜŞÜK-ORTA (süre kısa, yeni öğrenirken gidiyor)

PhD Yaşam Döngüsü (6-10 dönem):
  Dönem 1-2: Dersler + oryantasyon (düşük katkı, zaman yatırımı)
  Dönem 3-4: Araştırma hız kazanır (orta katkı)
  Dönem 5-6: EN VERİMLİ DÖNEM (yüksek katkı, yayın çıkar)
  Dönem 7-8: Tez yazımı (katkı azalır ama yayın devam eder)
  Dönem 9-10: Gecikme (olursa) — motivasyon düşer, maliyet artar

  → Doktora öğrencisi 2 yıl yatırım, 2 yıl verimli, 1 yıl tez yazımı
    Yatırım döneminde sabırlı olmak gerekir!

PhD Tez İlerleme Hızı:
  İlerleme/dönem = (Efektif_Yetenek × Çalışkanlık / 5000)
                 × Danışman_Çarpanı × Araştırma_Zamanı_Oranı

  İyi PhD (85, 90) + iyi danışman: %18/dönem → 6 dönemde biter
  Orta PhD (55, 60) + orta danışman: %9/dönem → 11+ dönem (uzar)
  Kötü PhD (35, 40) + kötü danışman: %4/dönem → 25+ dönem (bırakır)

  Tez tamamlanma = %100 olunca mezun olur.
  %100'e 12 dönemde ulaşamazsa: "Süre aşımı" uyarısı → 2 dönem ek hak
  Hâlâ bitmezse: İlişik kesilir (yatırım boşa gider)
```

#### Mezuniyet Sonrası: Akademiye Kalma Pipeline

```
İyi PhD öğrencileri mezun olunca potansiyel hocadır.
Bu üniversitenin kendi hocasını yetiştirme yoludur (transfer yerine).

Mezun PhD → Hoca Dönüşümü:
  Mezun_PhD_Araştırma = Efektif_Yetenek × 0.8
  Mezun_PhD_Eğitim = 35 + (Asistanlık_Deneyimi × 0.3)
    (Çok asistanlık yapan PhD eğitimde daha iyi başlar)
  Mezun_PhD_Potansiyel = Yetenek (değişmez)

  Kadro Teklifi:
    Üniversite mezun PhD'ye Dr. Öğr. Üyesi kadrosu teklif edebilir
    Kabul şansı: Üniversite_Prestij × 0.5 + Danışman_İlişki × 0.3 + Maaş_Cazipliği × 0.2
    Rakip üniversiteler de teklif gönderir!

  Avantaj (kendi yetiştirdiğin hoca):
    + Sadakat yüksek başlar (60-80)
    + Üniversite kültürünü biliyor
    + Danışmanla işbirliği devam eder (hemen yayın çıkar)
    + Transfer maliyeti yok

  Dezavantaj:
    - "Akademik akrabalık" (inbreeding) riski
      Aynı üniversiteden çok hoca alırsan: Fikir çeşitliliği düşer
      İnbreeding_Oranı > %40 ise: Araştırma yenilikçilik puanı -%10
    - Genç ve düşük stat'lı başlar (yetişmesi zaman alır)
```

#### Lisansüstü Program Stratejisi

```
Oyuncunun stratejik kararları:

1. Kontenjan: Kaç YL/PhD öğrenci alınacak?
   Çok alırsan: Asistan bolluğu ama kalite düşer, burs maliyeti artar
   Az alırsan: Kaliteli ama araştırma yavaşlar, asistan kıtlığı

2. Burs Politikası:
   Tam burs (harç + maaş): En iyi öğrenciyi çeker, pahalı
   Kısmi burs (sadece harç): Orta kalite, orta maliyet
   Burs yok: Sadece parası olan gelir — kalite çok düşük olabilir
   ArGö kadrosu: En iyisi, maaşlı ama kadro sınırlı

3. Asistanlık Yükü Politikası:
   Hafif (4-6 saat): Öğrenci mutlu, hızlı mezun — ama hocalar rahatlamaz
   Orta (8 saat): Dengeli
   Ağır (12+ saat): Hocalar rahat ama öğrenci mutsuz, tez gecikir, bırakma riski

4. Kendi Mezununu Alma vs. Dışarıdan Alma:
   İnbreeding oranını %40 altında tut
   Ama en iyi PhD'ni kaçırma — rakip kapmasın

5. Danışman Ataması:
   İyi mentorluk stat'lı hocalara daha çok öğrenci ver
   Ama onların zamanı da sınırlı — denge kur
```

### 4.3 Transfer Pazarı Mekanikleri

#### Scout Sistemi

```
Scout Aksiyonu: Bir hocayı gözetleme isteği (dönem başında, 3 hoca/dönem max)

Scout Sonucu (1 dönem sonra):
  - Araştırma: gerçek değer ± 10
  - Eğitim: gerçek değer ± 8
  - Potansiyel: gerçek değer ± 15
  - Mevcut maaşı ve memnuniyeti (tahmini)
  - Sözleşme bitiş tarihi

Scout Kalitesi arttıkça hata payı düşer.
Scout maliyeti: 50.000 ₺/dönem (sabit çalışan için)
```

#### Transfer Teklifi

```
Teklif Paketi:
  1. Maaş Teklifi (₺/ay)
  2. Araştırma Fonu (dönem başı, ₺)
  3. Ofis/Lab Olanakları (1-5 puan, binanıza bağlı)
  4. Unvan Vaadi (uygunsa terfi teklifi)
  5. Konut/Taşınma Desteği (tek seferlik, opsiyonel)

Kabul Olasılığı = f(Maaş_Farkı, Araştırma_Fonu, Lab_Kalitesi, Sadakat, Motivasyon)

Formül:
  Temel_İlgi = (Teklif_Maaş - Mevcut_Maaş) / Mevcut_Maaş × 50
  Araştırma_Cazipliği = (Teklif_Fon / 500000) × 20
  Lab_Cazipliği = (Teklif_Lab - Mevcut_Lab) × 5
  Sadakat_Direnç = Sadakat × 0.4

  Kabul_Şansı = min(95, max(5,
    40 + Temel_İlgi + Araştırma_Cazipliği + Lab_Cazipliği - Sadakat_Direnç))
```

#### Pazarlık Mekaniği

Teklif reddedilirse 1 karşı-teklif hakkı:

- Maaşı artır (+%10-30)
- Araştırma fonu ekle
- Lab yatırımı vaadi (2 dönem içinde gerçekleşmeli, aksi hâlde sadakat -10)

### 4.3b Personel Tipleri ve Çalışma Biçimleri

Üniversitede sadece tam zamanlı akademisyenler değil, farklı statülerde çalışanlar vardır.

#### Personel Tipleri

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Tip               │ Ders │ Araştırma │ Maaş        │ Özellik               │
├───────────────────┼──────┼──────────┼─────────────┼───────────────────────│
│ Tam Zamanlı       │ 2-4  │ Evet     │ Tam maaş    │ Ana kadro, her şeyi   │
│ Akademisyen       │      │          │             │ yapabilir              │
├───────────────────┼──────┼──────────┼─────────────┼───────────────────────│
│ Yarı Zamanlı      │ 1-2  │ Hayır    │ Ders başı   │ Dışarıdan, sadece ders│
│ Öğretim Görevlisi │      │          │ (3K-8K ₺/   │ verir, araştırma yok  │
│                   │      │          │  ders/hafta) │                       │
├───────────────────┼──────┼──────────┼─────────────┼───────────────────────│
│ Araştırma         │ 0-1  │ Evet     │ Proje bütçe-│ Doktora öğrencisi,    │
│ Görevlisi (ArGö)  │      │          │ sinden      │ lab dersi verebilir   │
├───────────────────┼──────┼──────────┼─────────────┼───────────────────────│
│ İdari Personel    │ 0-1  │ Kısıtlı  │ İdari maaş  │ Doktorası varsa ders  │
│ (Doktoralı)       │      │          │ + ek ders    │ verebilir, sınırlı    │
├───────────────────┼──────┼──────────┼─────────────┼───────────────────────│
│ Misafir           │ 1    │ Olabilir │ Sembolik /   │ 1 dönemlik, prestij   │
│ Öğretim Üyesi     │      │          │ davetli      │ bonusu, süreksiz      │
└───────────────────┴──────┴──────────┴─────────────┴───────────────────────┘
```

#### Yarı Zamanlı Öğretim Görevlisi Detayları

```
Neden gerekir?
  Bölümde yeterli tam zamanlı hoca yoksa müfredattaki dersler karşılanamaz.
  Bölüm başkanı ya ders yüklerini artırır (mevcut hocalar mutsuz),
  ya sınıf büyüklüğünü artırır (öğrenci mutsuz),
  ya da dışarıdan yarı zamanlı hoca getirir.

Yarı Zamanlı Hoca Profili:
  - Stat'ları var ama genelde düşük-orta (Eğitim: 30-65, Araştırma: N/A)
  - Alan uzmanlığı olabilir (sektörden gelen mühendis gibi)
    → Alan uyumu yüksekse Eğitim efektif değeri iyi olabilir
  - Araştırma katkısı: SIFIR (sadece ders verir)
  - Üniversiteye bağlılığı: ÇOK DÜŞÜK (sadakat: 5-15)

Avantajları:
  + Ucuz (tam zamanlının %20-30'u maliyet)
  + Hızlı çözüm (transfer gibi 1 dönem beklemez, hemen başlar)
  + Sektör deneyimi varsa pratik dersler için iyi olabilir
  + Kadro bağlamaz (istediğin dönem çağırır, istemezsen çağırmazsın)

Dezavantajları:
  - Öğrenci memnuniyeti düşer (tam zamanlıya kıyasla -15 puan)
    "Hoca hep acele ediyor, ofis saati yok, soru soramıyoruz"
  - Kurum kültürüne entegre değil → sinerji bonusu vermez
  - Ders materyali kalitesi düşük olabilir (hazırlanma zamanı az)
  - Sınav/not kalitesi tutarsız olabilir
  - Çok yarı zamanlı hoca = "bölüm ciddiye alınmıyor" algısı
    Bölüm hocalarının > %30'u yarı zamanlıysa: Prestij penaltı -3

Yarı Zamanlı Havuzu:
  Her şehirde/bölgede belirli sayıda yarı zamanlı aday var.
  Prestijli üniversiteler daha iyi yarı zamanlı çeker.
  Bazı sektörlerden (BT, finans) iyi yarı zamanlı bulunabilir.
  Niş alanlardan (felsefe, arkeoloji) yarı zamanlı bulmak zor.
```

#### İdari Personelin Ders Vermesi

```
Doktoralı idari personel (öğrenci işleri müdürü, BT direktörü vb.)
isteğe bağlı olarak 1 ders/dönem verebilir.

Koşullar:
  - Doktorası olan idari personel
  - İdari görevinden kalan zamanı yeterse
  - Alanı ders konusuyla uyumluysa

Etkisi:
  + Ders açığını ucuza kapatır (ek ders ücreti, yeni maaş yok)
  + Personel mutlu olur (akademik kimliğini korur)
  - İdari birim performansı -%5 (zamanı bölünüyor)
  - Eğitim kalitesi genelde düşük (odaklanamaz)
  - "İdari müdür niye ders veriyor?" öğrenci algısı (nötr-negatif)
```

### 4.3c Müfredat ve Ders Yönetimi Sistemi

Her bölümün bir müfredatı vardır ve bu müfredattaki dersleri karşılayacak yeterli ve uygun hoca gerekir.

#### Müfredat Yapısı

```
Her bölümün müfredatında:
  Zorunlu Dersler:     12-20 farklı ders (4 yıla yayılmış)
  Teknik Seçmeli:      5-10 farklı ders (hoca uzmanlığına göre açılır)
  Genel Seçmeli:       Fakülte/üniversite geneli havuz
  Laboratuvar Dersleri: 2-6 (bölüme göre, lab altyapısı gerekir)

Her dersin özellikleri:
  - Alan etiketi (hangi uzmanlık gerekir)
  - Seviye (1. sınıf → 4. sınıf / lisansüstü)
  - Haftalık saat (2-4 saat)
  - Minimum hoca yetkinliği (alan uyumu + eğitim stat eşiği)
  - Önerilen sınıf büyüklüğü (20-40 ideal, 40-80 amfi, 80+ dershane)
```

#### Ders Atama Süreci (Her Dönem Başında)

```
1. Müfredattaki açılması gereken dersleri listele
2. Mevcut tam zamanlı hocaları uygunluklarına göre eşleştir
3. Karşılanamayan dersleri tespit et ("ders açığı")
4. Açık için 4 seçenekten birini veya birkaçını uygula:

   Seçenek A: Mevcut hocaların ders yükünü artır
   Seçenek B: Sınıf büyüklüğünü artır (şubeleri birleştir)
   Seçenek C: Yarı zamanlı hoca getir
   Seçenek D: Dersi bu dönem açma (müfredat aksar)
```

#### Sınıf Büyüklüğü Mekaniği

```
Sınıf büyüklüğü hem eğitim kalitesini hem hoca iş yükünü doğrudan etkiler.

┌───────────────┬────────────┬────────────────┬──────────────────────────┐
│ Sınıf Boyutu  │ Tesis      │ Öğrenme Çarpanı│ Öğrenci Memnuniyeti      │
├───────────────┼────────────┼────────────────┼──────────────────────────┤
│ 15-25 (küçük) │ Normal sınıf│ ×1.20          │ +15 (bireysel ilgi)     │
│ 25-40 (ideal) │ Normal sınıf│ ×1.00          │ +5 (standart)            │
│ 40-60 (büyük) │ Büyük sınıf│ ×0.85          │ -5 (kalabalık)           │
│ 60-100 (amfi) │ Amfi       │ ×0.70          │ -15 (anonim hisseder)    │
│ 100-200 (dev) │ Büyük amfi │ ×0.55          │ -25 (kaybolmuş hisseder) │
│ 200+ (dershane)│ Konf.salonu│ ×0.40          │ -35 (üniversite mi bu?)  │
└───────────────┴────────────┴────────────────┴──────────────────────────┘

Öğrenme_Çarpanı etkisi:
  Öğrenci GPA'sı = Ham_GPA × Öğrenme_Çarpanı
  Mezuniyet başarısı düşer → mezun kalitesi düşer → uzun vadede prestij düşer

Sınıf Büyüklüğü ve Hoca İş Yükü İlişkisi:
  Bir hoca 30 kişilik 2 şubede aynı dersi verirse: 2 × ders saati
  Şubeleri birleştirip 60 kişilik 1 sınıf yaparsa: 1 × ders saati
    → Hoca ders yükü yarıya iner AMA öğrenciler mutsuz
    → Hoca ödev/sınav yükü hâlâ yüksek (60 kağıt okumak gerekir)

Sınav/Ödev Yükü (gizli maliyet):
  Toplam_Öğrenci_Yükü = Σ(ders başına öğrenci sayısı)
  Öğrenci_Yükü > 150: Hoca stres ×1.2 → motivasyon -3/dönem
  Öğrenci_Yükü > 250: Hoca stres ×1.5 → motivasyon -8/dönem
                       Sınav kalitesi düşer (çoktan seçmeli mecburiyeti)
  Öğrenci_Yükü > 400: Hoca tükenir → motivasyon -15/dönem
                       "Bu iş yükü insanlık dışı" olayı tetiklenir
```

#### Hoca Ders Yükü ve Zaman Yönetimi

Her hocanın haftada **40 zaman birimi** vardır. Bu birimler faaliyetlere dağıtılır.

```
Zaman Bütçesi (haftalık, 40 birim = %100):
┌────────────────────┬──────────┬─────────────────────────────────────┐
│ Faaliyet           │ Zaman    │ Açıklama                            │
├────────────────────┼──────────┼─────────────────────────────────────┤
│ Ders verme         │ Değişken │ Her ders 3-4 birim (hazırlık dahil) │
│ Ödev/sınav         │ Değişken │ Öğrenci sayısına bağlı              │
│ Araştırma          │ Kalan    │ Geriye kalan zaman araştırmaya gider│
│ İdari görev        │ Değişken │ Bölüm başkanı/dekan ise eklenir     │
│ Mentorluk          │ 2-4      │ Lisansüstü öğrenci rehberliği       │
│ Ofis saati         │ 2        │ Öğrenci danışmanlığı (sabit)        │
└────────────────────┴──────────┴─────────────────────────────────────┘

Zaman Hesaplama:

  Ders_Zamanı = Ders_Sayısı × 4 birim/ders
  Ödev_Sınav_Zamanı = Toplam_Öğrenci / 30 (her 30 öğrenci ≈ 1 birim)
    → Ders asistanı varsa: ×0.6 (asistan ödev/sınav yükünü %40 azaltır)
    → Lab asistanı varsa: Lab dersi zaman yükünden -2 birim
  İdari_Zaman:
    Bölüm Başkanı: 8 birim
    Dekan: 16 birim
    Rektör Yardımcısı: 20 birim
    Rektör: 30 birim (neredeyse hiç araştırma yapamaz)
  Mentorluk_Zamanı (bkz. 4.2b danışman-öğrenci ilişkisi):
    Her lisansüstü öğrenci bağımsızlık seviyesine göre 0.5-2.0 birim
    Toplam max 8 birim (kapasite aşılmamalı)

  Araştırma_Zamanı = 40 - (Ders + Ödev + İdari + Mentorluk + Ofis)

  NOT: Araştırma zamanı tek başına yetmez. Lisansüstü öğrenci yoksa
  Araştırma_Çarpanı = 1.0 kalır. Öğrenci varsa 2.0'a kadar çıkabilir (bkz. 4.2b).

  Araştırma_Zamanı < 0 ise: AŞIRI YÜK → motivasyon -10/dönem, tükenmişlik riski
```

#### Araştırma Zamanı → Araştırma Çıktısı İlişkisi

```
Araştırma_Verimi = Araştırma_Stat × (Araştırma_Zamanı / 20) × (Motivasyon / 100)

  20 birim = ideal araştırma zamanı (tam potansiyel)
  15 birim = ×0.75 (kabul edilebilir, 3 ders + normal yük)
  10 birim = ×0.50 (ciddi düşüş, 4 ders veya bölüm başkanlığı)
  5 birim  = ×0.25 (minimal, dekanlık + 2 ders)
  0 birim  = ×0.00 (araştırma durur — rektör, aşırı ders yükü)

Zaman Yönetimi Stat'ı (YENİ — Gizli, 1-100):
  Bazı hocalar zamanı çok iyi yönetir.
  Zaman_Yönetimi yüksekse efektif zaman artar:
    Efektif_Zaman = 40 + (Zaman_Yönetimi - 50) × 0.2
      Zaman_Yönetimi = 90 → Efektif_Zaman = 48 (8 bonus birim!)
      Zaman_Yönetimi = 30 → Efektif_Zaman = 36 (-4 birim, verimsiz)

  Bu yüzden bazı bölüm başkanları idari yük altında bile
  iyi araştırma yapmaya devam eder (yüksek zaman yönetimi)
  ve bazıları 2 ders bile verse araştırma yapamaz (düşük zaman yönetimi).

  Bu stat oyuncuya doğrudan gösterilmez.
  Gözlemlenerek anlaşılır: "Bu hoca 4 ders veriyor ama hâlâ yayın yapıyor?"
  Scout ile ±20 hata payıyla öğrenilebilir.
```

#### Ders-Hoca Uyumu (Alan Eşleşmesi)

```
Her dersin bir alan etiketi vardır.
Hoca o alana ne kadar uygunsa ders o kadar iyi gider.

Ders_Kalitesi = Hoca_Eğitim_Stat × Ders_Alan_Uyumu × Sınıf_Boyut_Çarpanı

Ders_Alan_Uyumu:
  Hocanın çalışma alanı = Dersin alanı:       ×1.0 (tam uyum)
  Hocanın ana alanı = Dersin genel alanı:      ×0.85 (yakın)
  Aynı kategori, farklı alan:                  ×0.60 (idare eder)
  Farklı kategori:                              ×0.30 (felaket)

Örnek:
  "Yapay Zeka" dersi:
    YZ çalışma alanlı BM hocası: ×1.0 → mükemmel
    Genel BM hocası (yazılım alanı): ×0.85 → iyi
    Matematik hocası (istatistik): ×0.60 → idare eder
    İnşaat hocası: ×0.30 → öğrenci isyanı

  Alanı uyumsuz hoca dersi verirse:
    - Öğrenci memnuniyeti -20
    - "Hoca konuya hakim değil" yorumları
    - Öğrenme çarpanı ek -%20
    - Hoca da mutsuz olur (alanım dışında ders veriyorum → motivasyon -5)
```

#### Bölüm Başkanının Ders Dağılım İkilemi

```
Bölüm başkanı (veya oyuncu) her dönem başında şu dengeleri kurar:

Senaryo: 10 zorunlu ders var, 6 tam zamanlı hoca var (her biri max 3 ders)
  Hoca kapasitesi: 6 × 3 = 18 ders slot
  Sorun yok — hatta seçmeli de açılabilir

Senaryo: 10 zorunlu ders, 4 tam zamanlı hoca
  Hoca kapasitesi: 4 × 3 = 12 ders slot (yetmiyor, seçmeli açılamaz)

  Seçenek A: Hocaları 4 ders'e çıkar
    4 × 4 = 16 → zorunlular karşılanır, 6 slot seçmeliye
    ✗ Tüm hocalar ağır yük → motivasyon düşer
    ✗ Araştırma zamanı azalır → yayın düşer
    ✗ "Sürekli ders veriyoruz, araştırmaya vakit yok" şikayeti

  Seçenek B: Şubeleri birleştir (sınıf büyüklüğü artır)
    30+30 → 60 kişilik amfi = 1 hoca yerine 1 hoca (ama amfi)
    ✓ Hoca ders yükü azalır
    ✗ Öğrenme kalitesi düşer, memnuniyet düşer
    ✗ Amfi gerekir (yoksa sorun)

  Seçenek C: 2 yarı zamanlı hoca getir
    2 × 2 = 4 ders slot → sorun çözülür
    ✓ Tam zamanlılar rahatlar
    ✗ Eğitim kalitesi yarı zamanlı derslerde düşük
    ✗ Ek maliyet (ders başı ücret)
    ✗ > %30 yarı zamanlı oranı → prestij kaybı

  Seçenek D: Bazı dersleri bu dönem açma
    ✗ Öğrenciler o dersi alamaz → mezuniyet uzar
    ✗ "Ders açılmıyor" şikayeti → memnuniyet -20
    ✗ Akreditasyon riski (zorunlu ders açılmıyorsa)

  En iyi strateji: A+B+C karışımı — biraz yük artır, biraz birleştir,
  kritik dersler için 1 yarı zamanlı al.
```

#### Ders Yükü Özet Tablosu

```
Haftalık Ders Sayısı → Etki:

  1 ders/dönem:  Araştırma zamanı ÇOK (×0.85-1.0)
                 Eğitim katkısı düşük, bölüme az fayda
                 Diğer hocalar: "Neden o az ders veriyor?" kıskançlık

  2 ders/dönem:  DENGE NOKTASI — araştırma iyi (×0.65-0.75)
                 Eğitim katkısı yeterli
                 Hoca mutlu (ideal yük)

  3 ders/dönem:  Normal yük — araştırma orta (×0.45-0.55)
                 Eğitim katkısı yüksek
                 Hoca idare eder, şikayet yok

  4 ders/dönem:  AĞIR YÜK — araştırma düşük (×0.25-0.35)
                 Motivasyon -5/dönem
                 "Ders makinesi oldum" şikayeti

  5+ ders/dönem: TÜKENMİŞLİK — araştırma neredeyse 0 (×0.05-0.15)
                 Motivasyon -15/dönem
                 Eğitim kalitesi de düşer (yorgun hoca kötü anlatır)
                 Transfer talebi veya istifa riski yüksek
                 Etik sınır: YÖK 5+ ders yüküne uyarı verebilir
```

### 4.4 Hoca Mutluluğu ve Mutsuzluk Spirali

```
Mutluluk_Puanı = Maaş_Memnuniyeti × 0.20
               + Araştırma_İmkanları × 0.15
               + Alan_Uyumu × 0.15
               + Ders_Yükü_Memnuniyeti × 0.15
               + Ofis_Kalitesi × 0.10
               + Fakülte_Memnuniyeti × 0.10
               + İdari_Verimlilik × 0.05
               + Sosyal_Ortam × 0.05
               + Adalet_Algısı × 0.05

Alan_Uyumu: Bölüm-Hoca uyum yüzdesi (bkz. 4.1b) × 100
  %100 uyum → 100 puan, %50 uyum → 50 puan, %0 → 0 puan

Fakülte_Memnuniyeti:
  Bölüm doğru fakültede → 80 baz puan
  İyi dekan (Yönetim ≥ 70) → +20
  Bölüm yanlış fakültede → 40 baz puan
  Kötü dekan → -20

Maaş_Memnuniyeti: Mevcut_Maaş / Piyasa_Beklentisi × 100 (max 100)
Piyasa_Beklentisi ≈ Stat_Ortalaması × 1200 ₺/ay

Ders_Yükü_Memnuniyeti:
  1-2 ders/dönem: 90 (mutlu, araştırmaya vakit var)
  3 ders/dönem:   70 (normal, şikayet yok)
  4 ders/dönem:   40 (ağır, şikayetçi)
  5+ ders/dönem:  10 (tükenmişlik)
  + Alan dışı ders veriyorsa: -20
  + Öğrenci yükü > 250 ise: -15

İdari_Verimlilik: Üniversitenin idari birim ortalaması (bkz. 4.5c)
  Maaş gecikirse, kağıt işleri aksarsa hoca mutsuz olur

Adalet_Algısı:
  Bölüm içinde ders yükleri eşitse: 80
  Bazı hocalar az ders, bazıları çok veriyorsa: 40
  Başkan kendi grubunu kayırıyorsa: 20
  (Bölüm başkanı kalitesine bağlı — iyi başkan adil dağıtır)
```

#### Mutsuzluk Sonuçları

| Mutluluk | Sonuç |
|---|---|
| 70-100 | Normal, sadakat ++, verimli |
| 50-69 | Performans -10%, yüzde 20 ihtimalle transfer kulağı |
| 30-49 | Transfer kulağı yüksek, rakip teklif arama başlar |
| 0-29 | Aktif transfer talebi, bir sonraki dönem kaçma riski %60+ |

### 4.5 Rakip Üniversite Transfer Tehlikesi

Her dönem rakip üniversiteler mutsuz hocalara teklif gönderir:

```
Teklif_Gönderme_Şansı = (100 - Hoca_Mutluluk) × Rakip_Bütçe_Çarpanı / 100

Rakip teklif gelirse:
  - Oyuncu bildirim alır
  - 1 dönemin başında karşı teklif hakkı
  - Karşı teklif vermezse veya yetersizse hoca gider
  - Hoca gidince: Araştırma çıktısı düşer, öğrenci memnuniyeti düşer, diğer hocalar gözlemler
```

---

### 4.5b Akademik Yöneticilik Sistemi

Üniversitede akademik yönetim pozisyonları (rektör, dekan, bölüm başkanı) performansı doğrudan etkiler. Yanlış kişiyi yönetime atamak ciddi hasar verir.

#### Yönetim Pozisyonları Hiyerarşisi

```
Rektör (1 adet — oyuncunun alter-egosu veya atanan hoca)
  ├── Rektör Yardımcıları (2-4 adet)
  │     ├── Akademik İşler
  │     ├── Araştırma ve Geliştirme
  │     ├── İdari ve Mali İşler
  │     └── Öğrenci İşleri (opsiyonel)
  ├── Dekanlar (her fakülte için 1)
  │     └── Bölüm Başkanları (her bölüm için 1)
  └── Araştırma Merkezi Direktörleri
```

#### Yöneticilik Yetkinlik Formülü

Bir hocanın yöneticilik etkinliği sadece Yönetim stat'ına değil, akademik kredibilitesine de bağlıdır.

```
Efektif_Yönetim = Yönetim_Stat × Kredibilite_Çarpanı × (Motivasyon / 100)

Kredibilite_Çarpanı (akademik saygınlık etkisi):
  Araştırma ≥ 70: Çarpan = 1.0   (saygın araştırmacı, sözü dinlenir)
  Araştırma 50-69: Çarpan = 0.85  (orta düzey, bazıları ciddiye almaz)
  Araştırma 30-49: Çarpan = 0.65  (zayıf araştırmacı, "sen kim oluyorsun" etkisi)
  Araştırma < 30:  Çarpan = 0.40  (akademik olarak ciddiye alınmaz)

Neden?
  Akademide yönetici seçilince meslektaşlarınız sizi yönetir.
  Araştırması zayıf biri "yayın hedefimiz şu" dediğinde kimse dinlemez.
  Güçlü araştırmacı aynı şeyi söylediğinde herkes kabul eder.
  → Kötü araştırmacı, iyi yönetim stat'ına sahip olsa bile
    etkinliği çarpan yüzünden düşer.

Unvan Etkisi (ek çarpan):
  Profesör yönetici:       ×1.0 (beklenen)
  Doçent yönetici:         ×0.90 (kabul edilir ama "neden prof değil" denir)
  Dr. Öğr. Üyesi yönetici: ×0.70 (ciddi direnç, "daha yeni geldi" algısı)
  ArGö yönetici:           ATANAMAZ (YÖK kuralı)
```

#### Pozisyon Bazında Yöneticilik Etkileri

##### Rektör

```
Rektör Modu Seçimi (oyun başında):
  A) Oyuncu = Rektör: Tüm kararlar doğrudan oyuncunun
  B) Atanmış Rektör: Bir hocayı rektör atarsın, otomatik kararları etkiler

Atanmış Rektör ise:
  Efektif_Yönetim ≥ 70: "Güçlü Rektör"
    + Tüm fakültelere motivasyon +3
    + Devlet/YÖK ilişkileri iyi → ödenek +%10
    + Kriz yönetimi başarılı (negatif olay etkisi -%30)
    + Stratejik kararlar için bonus seçenekler açılır

  Efektif_Yönetim 40-69: "Ortalama Rektör"
    Bonus/penaltı yok, nötr etki

  Efektif_Yönetim < 40: "Zayıf Rektör"
    - Fakülte motivasyonu -5
    - Bürokratik tıkanıklık: İnşaat/proje onayları 1 dönem gecikir
    - Hocalar "rektör değişmeli" kampanyası başlatır (olay tetiklenir)
    - Dış ilişkiler zayıflar → sponsorluk geliri -%15
    - Skandal riski +%20 (kötü kriz yönetimi)

Rektörün Araştırma Geçmişi Etkisi:
  Araştırma ≥ 80: "Araştırma rektörü" — araştırma odaklı kararlarda bonus
  Eğitim ≥ 80:    "Eğitimci rektör" — eğitim kalitesi kararlarında bonus
  Popülerlik ≥ 80: "Kamuoyu rektörü" — PR ve dış ilişkilerde bonus
  Hiçbiri yüksek değil: Nötr, belirgin yönlendirme yok
```

##### Dekan

```
Dekan Atama:
  Fakültedeki profesör veya doçentlerden seçilir.
  Görev süresi: 4 dönem (2 yıl), yeniden atanabilir.
  Dekan olan hoca: Araştırma verimi -%30, Eğitim verimi -%50 (zamanı yönetimde)

Dekan Kalitesi = Efektif_Yönetim (yukarıdaki formül)

İyi Dekan (Efektif_Yönetim ≥ 70):
  + Fakülte içi motivasyon +5
  + Bölümler arası kaynak dağılımı adil → şikayet az
  + Bütçe verimliliği +%10 (israf azalır)
  + İç çatışma riski -%20
  + Hoca alımlarında ikna bonusu +%10 (aday "iyi yönetim var" der)
  + Proje başvurularında bürokratik gecikme yok

Kötü Dekan (Efektif_Yönetim < 40):
  - Fakülte motivasyonu -8
  - Kaynak dağılımı adaletsiz → güçlü bölüm kayırılır, zayıflar ihmal
  - Bürokratik kaos: Proje başvuruları %20 ihtimalle 1 dönem gecikir
  - Hocalar arası çatışma riski +%30
  - İyi hocalar "bu fakültede çalışılmaz" → transfer talebi
  - "Dekan değişmeli" dilekçesi olayı (3 dönem üst üste kötüyse)

Özel Durum — "Araştırması Zayıf Dekan":
  Yönetim ≥ 75 AMA Araştırma < 40 olan dekan:
  → İdari işleri iyi yapar ama akademik saygınlığı düşük
  → Araştırma odaklı hocalar: "Bu adam yayın nedir bilmiyor, bize nasıl
     araştırma hedefi koyuyor?" → Araştırma motivasyonu -10 (sadece araştırma)
  → Eğitim odaklı hocalar: Etkilenmez
  → Net etki: İdari verimlilik + ama araştırma çıktısı -
```

##### Bölüm Başkanı

```
Bölüm Başkanı Atama:
  Bölümdeki en az Dr. Öğr. Üyesi unvanlı hocalardan seçilir.
  Görev süresi: 6 dönem (3 yıl).
  Bölüm başkanı: Araştırma verimi -%15, Eğitim verimi -%20

Bölüm Başkanı Kalitesi = Efektif_Yönetim (ama eşik daha düşük)

İyi Başkan (Efektif_Yönetim ≥ 60):
  + Bölüm içi ders dağılımı adil → hoca memnuniyeti
  + Kontenjan/müfredat kararları isabetli → öğrenci memnuniyeti +5
  + Hocalar arası iletişim iyi → sinerji bonusu +%5
  + Lab/kaynak kullanımı verimli

Kötü Başkan (Efektif_Yönetim < 35):
  - Ders dağılımı adaletsiz → bazı hocalar aşırı yüklü
  - Müfredat güncellenmez → öğrenci şikayeti
  - Lab kaynak israfı → araştırma verimliliği -%10
  - "Bölüm içi klik" oluşur → motivasyon -5
  - Başkanın kendi araştırma grubu kayırılır (bias)
```

#### Yöneticilik Tuzağı: "Peter Prensibi"

```
Oyunda sık karşılaşılacak ikilem:

  En iyi araştırmacınızı dekan yaparsanız:
    ✓ Akademik kredibilitesi yüksek → herkes dinler
    ✗ Araştırma verimi -%30 (zamanı yönetimde)
    ✗ En iyi yayın makinenizi kaybettiniz

  Ortalama araştırmacıyı dekan yaparsanız:
    ✓ Araştırma kaybı az
    ✗ Kredibilite düşük → etkinlik azalır
    ✗ "Neden o seçildi?" tepkisi

  İdeal profil (nadir):
    Araştırma ≥ 70 + Yönetim ≥ 70 → "Doğal Lider" arketipi
    Bu profil çok nadir, bulursan sakla!

  Gerçekçi strateji:
    - Kariyerinin sonunda, yayın ivmesi düşmüş ama saygın profesörler
      en iyi dekan adaylarıdır (araştırma kaybı az, kredibilite yüksek)
    - Genç ve üretken hocaları yönetime ATAMA — araştırma kaybı çok büyük
```

---

### 4.5c İdari Personel Sistemi

Akademik kadronun yanında üniversiteyi fiilen çalıştıran idari personel vardır. İdari kadro görünmez ama etkisi büyüktür — kötü idari yapı her şeyi yavaşlatır.

#### İdari Birimler

```
İdari yapı bireysel değil birim bazlı yönetilir (hoca gibi tek tek değil).
Her birimin bir Kalite puanı (1-100) ve Kadro Doluluk oranı (%0-150) vardır.

┌─────────────────────────────────────────────────────────────┐
│  İDARİ BİRİMLER                                            │
├─────────────────┬────────────┬───────────────────────────── │
│  Birim          │ Etki Alanı │ Yetersizlik Sonucu           │
├─────────────────┼────────────┼───────────────────────────── │
│  Öğrenci İşleri │ Kayıt, not,│ Öğrenci memnuniyeti -10,     │
│                 │ mezuniyet  │ kayıt hataları, gecikmeler   │
├─────────────────┼────────────┼───────────────────────────── │
│  Mali İşler     │ Bütçe,     │ Maaş gecikmeleri → hoca      │
│                 │ maaş, satın│ motivasyon -15, tedarik       │
│                 │ alma       │ gecikmeleri, bütçe israfı +%10│
├─────────────────┼────────────┼───────────────────────────── │
│  İnsan          │ Kadro,     │ İşe alım 1 dönem gecikir,    │
│  Kaynakları     │ özlük, izin│ hoca şikayetleri artar       │
├─────────────────┼────────────┼───────────────────────────── │
│  Bilgi          │ Sunucu, ağ,│ Sistem çökmeleri, e-posta     │
│  Teknolojileri  │ yazılım    │ kesintisi, uzaktan eğitim     │
│                 │            │ sorunları, araştırma verimi -5│
├─────────────────┼────────────┼───────────────────────────── │
│  Teknik İşler / │ Bina bakım,│ Bina kalitesi hızla düşer,   │
│  Yapı İşleri    │ onarım,    │ inşaat gecikmeleri +%30 süre, │
│                 │ inşaat     │ güvenlik riskleri             │
├─────────────────┼────────────┼───────────────────────────── │
│  Kütüphane ve   │ Kaynak,    │ Araştırma verimliliği -5,     │
│  Dokümantasyon  │ veritabanı │ öğrenci memnuniyeti -3        │
├─────────────────┼────────────┼───────────────────────────── │
│  Hukuk          │ Sözleşme,  │ Hukuki risk, skandal          │
│  Müşavirliği    │ dava, uyum │ yönetimi başarısız            │
├─────────────────┼────────────┼───────────────────────────── │
│  Uluslararası   │ Erasmus,   │ Uluslararasılaşma puanı      │
│  İlişkiler      │ anlaşma    │ düşer, yabancı öğrenci azalır│
├─────────────────┼────────────┼───────────────────────────── │
│  Basın ve       │ Tanıtım,   │ Prestij büyümesi yavaşlar,   │
│  Halkla İlişk.  │ web, medya │ kriz iletişimi başarısız     │
└─────────────────┴────────────┴──────────────────────────────┘
```

#### İdari Birim Kalitesi

```
Birim_Kalitesi = Personel_Yetkinliği × Kadro_Doluluk_Çarpanı × Teknoloji_Çarpanı

Personel_Yetkinliği (1-100):
  Oyuncu yatırım yaparak artırır:
    - Eğitim/sertifika programları: +5/dönem, maliyet 200K ₺
    - Deneyimli personel transfer: +10 anında, maliyet 500K ₺
    - Doğal artış: +1/dönem (deneyim kazanımı)
    - Motivasyon düşükse: -2/dönem (iyi personel istifa eder)

Kadro_Doluluk_Çarpanı:
  %100 doluluk (ideal): ×1.0
  %80-99 doluluk:       ×0.90 (hafif yavaşlama)
  %60-79 doluluk:       ×0.70 (ciddi sorunlar başlar)
  %40-59 doluluk:       ×0.45 (kriz modu, her şey gecikir)
  < %40 doluluk:        ×0.20 (fiilen çalışmıyor)
  > %100 doluluk:       ×1.0 + verimsiz harcama (fazla personel = israf)
    %120: ×1.0, maliyet +%20 (faydasız)
    %150: ×1.0, maliyet +%50 (ciddi israf, bütçe kara deliği)

Teknoloji_Çarpanı:
  BT altyapısına yapılan yatırıma göre:
    Eski sistem (Excel/kağıt): ×0.7
    Temel otomasyon:           ×0.9
    Modern ERP/otomasyon:      ×1.0
    İleri dijitalleşme:       ×1.15
  Yatırım maliyeti: 1M - 5M ₺ (kademeli)
```

#### İdari Kadro Maaş ve Bütçe Etkisi

```
İdari Maaş Kütlesi = Akademik_Maaş_Kütlesi × İdari_Oran

İdari_Oran (oyuncunun tercihi):
  Minimum: %20 (tehlikeli derecede az — her birim yetersiz kalır)
  Önerilen: %30-40 (dengeli)
  Yüksek: %50+ (lüks ama verimli — bütçeyi yer)

İdari_Oran düşükse:
  - Kadro dolulukları düşer → birim kaliteleri düşer
  - Domino etkisi: Mali İşler kötüyse → maaş gecikir → hoca mutsuz
                   BT kötüyse → araştırma altyapısı aksıyor
                   Yapı İşleri kötüyse → binalar çürüyor

İdari_Oran çok yüksekse:
  - Kadro doluluk > %100 → israf, fayda artmıyor
  - Bütçeyi gereksiz yiyor
  - "Şişkin bürokrasi" olayı tetiklenebilir → prestij -2
```

#### İdari Performans → Akademik Çıktı İlişkisi

```
Genel İdari Verimlilik = Tüm birimlerin kalite ortalaması

Verimlilik ≥ 80:  "Yağlı Makine"
  + Tüm işlemler zamanında
  + Hoca/öğrenci memnuniyeti bonusu +5
  + İnşaat süreleri -%10
  + Proje bürokratik süreçleri hızlı

Verimlilik 50-79:  "Normal"
  Bonus/penaltı yok

Verimlilik 30-49:  "Aksayan Bürokrasi"
  - Tüm işlemlerde %20 gecikme riski
  - Hoca motivasyonu -5
  - Öğrenci şikayetleri artar
  - İnşaat gecikmeleri +%20

Verimlilik < 30:  "Felç"
  - Maaşlar gecikir → tüm hocalar motivasyon -15
  - Öğrenci kaydı karışır → kontenjan %10 boş kalır
  - Binalar bakımsız → kalite 1 yıldız/dönem düşer
  - Araştırma projeleri raporlama gecikir → fon kesilme riski
  - Skandal riski +%40
  - "Üniversite fiilen işlemiyor" haberi → prestij -10

  ⚠ Bu durum oyunu kaybetmenin en sinsi yoludur.
    Akademik kadroya odaklanıp idariyi ihmal eden oyuncu,
    her şey iyi görünürken birden çöküş yaşar.
```

#### Özel Pozisyon: Genel Sekreter

```
Genel Sekreter = İdari yapının başı (akademik değil, idari personel).
Oyuncu tarafından atanır veya terfi ettirilir.

Genel Sekreter Kalitesi (1-100):
  Scout ile bulunabilir veya mevcut personelden terfi.
  Maaş: 80.000 - 200.000 ₺/ay

İyi Genel Sekreter (Kalite ≥ 75):
  + Tüm idari birimlerin kalitesine +10 bonus
  + Bütçe israfı -%15 (sıkı denetim)
  + Akademik kadroyla iyi iletişim → hoca şikayeti azalır
  + Kriz anında hızlı müdahale

Kötü Genel Sekreter (Kalite < 40):
  - Tüm birimlere -10 penaltı
  - Kayırmacılık → bazı birimler şişer, bazıları boş kalır
  - "İç denetim" olayı tetiklenebilir
  - İdari personel motivasyonu düşer → iyi personel istifa eder

Genel Sekreter olmadan:
  - Tüm idari birimler bağımsız çalışır (koordinasyon yok)
  - Birimler arası çatışma riski +%20
  - Verimlilik tavanı 70 (ne kadar yatırım yapsan aşamaz)
```

#### İdari Personel Olayları

| Olay | Tetikleyici | Etki |
|---|---|---|
| Maaş gecikmesi krizi | Mali İşler kalitesi < 30 | Tüm personel motivasyon -20, 1 dönem |
| Sistem çökmesi | BT kalitesi < 25 | 1 hafta (dönemin %5'i) tüm online işlemler durur |
| Öğrenci kayıt kabusu | Öğrenci İşleri < 30 + dönem başı | Kontenjan %15 boş kalır, memnuniyet -15 |
| İdari personel grevi | Genel memnuniyet < 20 | 1 dönem idari verimlilik ×0.3 |
| Verimlilik ödülü | Genel kalite ≥ 85, 3 dönem üst üste | Prestij +2, idari maliyet -%5 (morali yüksek) |
| Dijital dönüşüm başarısı | BT kalitesi ≥ 80 + yatırım | Tüm birimler +5, öğrenci memnuniyeti +3 |
| İç denetim skandalı | Genel Sekreter kalitesi < 30 | Prestij -5, YÖK soruşturma riski |

---

## 4.6 Akademik Bölümler ve Alan Farklılaşması

Oyundaki her bölüm farklı dinamiklere sahiptir. Bölüm açma, kapatma ve yatırım kararları oyunun en kritik stratejik katmanını oluşturur.

### Bölüm Kategorileri

Bölümler 4 ana kategoriye ayrılır. Her kategorinin araştırma profili, maliyet yapısı ve öğrenci talebi farklıdır.

#### Kategori 1: Mühendislik ve Teknoloji

| Bölüm | Başlangıç Maliyeti | Araştırma Potansiyeli | Lab Gereksinimi |
|---|---|---|---|
| Bilgisayar Mühendisliği | 8M ₺ | ★★★★★ | Orta (sunucu, yazılım) |
| Elektrik-Elektronik Müh. | 12M ₺ | ★★★★★ | Çok yüksek (VLSI, ölçüm lab) |
| Makine Mühendisliği | 15M ₺ | ★★★★☆ | Çok yüksek (atölye, CNC) |
| İnşaat Mühendisliği | 10M ₺ | ★★★☆☆ | Yüksek (malzeme lab) |
| Biyomedikal Mühendisliği | 14M ₺ | ★★★★★ | Çok yüksek (tıbbi cihaz) |
| Endüstri Mühendisliği | 6M ₺ | ★★★☆☆ | Düşük (simülasyon lab) |
| Yapay Zeka Mühendisliği | 10M ₺ | ★★★★★ | Orta-yüksek (GPU küme) |

```
Profil:
  - Yayın üretkenliği: YÜKSEK (Q1-Q2 dergi oranı %40-60)
  - Proje kapasitesi: YÜKSEK (TÜBİTAK, AB Horizon, SAYEM, BAP)
  - Patent potansiyeli: YÜKSEK
  - Ortalama yayın/hoca/yıl: 2.5 - 4.0
  - Ortalama proje bütçesi: 1M - 10M ₺
  - Endüstri işbirliği: YÜKSEK (Ar-Ge merkezleri, teknokent)
  - Mezun maaşı: YÜKSEK → iyi bağış potansiyeli
  - Hoca maaş beklentisi: YÜKSEK (sektör alternatifi var, özellikle BM/YZM)
  - Hoca tutma zorluğu: YÜKSEK (sektöre kayma riski — Google, Meta vb.)
```

#### Kategori 2: Temel Bilimler

| Bölüm | Başlangıç Maliyeti | Araştırma Potansiyeli | Lab Gereksinimi |
|---|---|---|---|
| Fizik | 10M ₺ | ★★★★☆ | Yüksek (optik, kuantum lab) |
| Kimya | 12M ₺ | ★★★★☆ | Çok yüksek (kimya lab, güvenlik) |
| Matematik | 3M ₺ | ★★★★☆ | Çok düşük (kalem kağıt + bilgisayar) |
| Biyoloji | 11M ₺ | ★★★★☆ | Çok yüksek (mikrobiyoloji, genetik) |
| Moleküler Biyoloji | 14M ₺ | ★★★★★ | Çok yüksek |

```
Profil:
  - Yayın üretkenliği: YÜKSEK (Q1 dergi oranı %30-50, teorik alanlarda daha yüksek)
  - Proje kapasitesi: ORTA-YÜKSEK (TÜBİTAK 1001/1003, ERC)
  - Patent potansiyeli: DÜŞÜK-ORTA (kimya/biyoloji hariç)
  - Ortalama yayın/hoca/yıl: 2.0 - 3.5
  - Endüstri işbirliği: DÜŞÜK (akademi odaklı)
  - Mezun maaşı: DÜŞÜK-ORTA (çoğu akademiye yönelir)
  - Hoca maaş beklentisi: ORTA (sektör alternatifi az)
  - Hoca tutma zorluğu: DÜŞÜK (yurt dışı hariç gidecek yer az)
  - ÖNEMLİ: Temel bilimler üniversitenin akademik itibarının omurgasıdır.
    Temel bilim bölümü olmadan mühendislik bölümleri tam prestij alamaz.
    Prestij_Penaltı: Temel bilim bölümü yoksa genel araştırma puanı ×0.85
```

#### Kategori 3: Sosyal Bilimler ve İşletme

| Bölüm | Başlangıç Maliyeti | Araştırma Potansiyeli | Lab Gereksinimi |
|---|---|---|---|
| İşletme / MBA | 5M ₺ | ★★☆☆☆ | Yok |
| İktisat | 4M ₺ | ★★★☆☆ | Yok |
| Hukuk | 6M ₺ | ★★☆☆☆ | Yok (duruşma salonu simülasyonu) |
| Uluslararası İlişkiler | 4M ₺ | ★★☆☆☆ | Yok |
| Psikoloji | 5M ₺ | ★★★☆☆ | Orta (deney lab) |
| Siyaset Bilimi | 3M ₺ | ★★☆☆☆ | Yok |

```
Profil:
  - Yayın üretkenliği: DÜŞÜK-ORTA
    • SSCI/AHCI dergi süreçleri çok uzun (1-3 yıl)
    • Kitap/kitap bölümü önemli (dergi dışı çıktı)
    • Ortalama yayın/hoca/yıl: 0.8 - 1.5
    • Q1 oranı: %15-25
  - Proje kapasitesi: DÜŞÜK
    • TÜBİTAK SOBAG projeleri küçük bütçeli (200K-1M ₺)
    • AB projeleri mümkün ama nadir
  - Patent potansiyeli: YOK
  - Endüstri işbirliği: DÜŞÜK-ORTA (danışmanlık ağırlıklı)
  - Mezun maaşı: DEĞİŞKEN (hukuk/işletme yüksek, diğerleri düşük)
  - Hoca maaş beklentisi: DÜŞÜK-ORTA
  - Hoca tutma zorluğu: DÜŞÜK

  ANCAK stratejik değer:
    • Öğrenci sayısı çok yüksek (ucuz bölüm, çok kontenjan)
    • Harç geliri/maliyet oranı EN YÜKSEK
    • Kampüs sosyal hayatını zenginleştirir → öğrenci memnuniyeti bonusu
    • İşletme/Hukuk mezunları yönetici olur → uzun vadede yüksek bağış
    • Bölümler arası çapraz dersler (mühendislere iş hukuku, girişimcilik)
```

#### Kategori 4: Sağlık Bilimleri

| Bölüm | Başlangıç Maliyeti | Araştırma Potansiyeli | Lab Gereksinimi |
|---|---|---|---|
| Tıp Fakültesi | 80M ₺ | ★★★★★ | Devasa (hastane zorunlu) |
| Diş Hekimliği | 40M ₺ | ★★★☆☆ | Çok yüksek |
| Eczacılık | 25M ₺ | ★★★★☆ | Çok yüksek |
| Hemşirelik | 8M ₺ | ★★☆☆☆ | Orta |

```
Profil:
  - Yayın üretkenliği: YÜKSEK (özellikle klinik araştırmalar)
    • Ortalama yayın/hoca/yıl: 2.0 - 5.0 (tıp en yüksek)
    • Çok yazarlı yayın yaygın → kişi başı yayın sayısı şişik görünür
  - Proje kapasitesi: YÜKSEK (TÜBİTAK SBAG, ilaç firması destekleri)
  - Patent potansiyeli: ORTA-YÜKSEK (ilaç, tıbbi cihaz)
  - Döner sermaye: ÇOK YÜKSEK (hastane gelirleri)
    • Tıp fakültesi hastanesi: 5M-30M ₺/dönem döner sermaye
    • Diş hekimliği kliniği: 2M-8M ₺/dönem
  - Hoca maaş beklentisi: ÇOK YÜKSEK (özel hastane alternatifi)
  - Hoca tutma zorluğu: ÇOK YÜKSEK (özel sektör 3-5× maaş teklif eder)
  - UYARI: Tıp fakültesi açmak dev yatırım gerektirir ama başarılı olursa
    en büyük gelir ve prestij kaynağı olur (risk-ödül dengesi).
```

### Bölümler Arası Yayın ve Proje Karşılaştırması

```
Yıllık Ortalama Yayın/Hoca (bölüm kategorisine göre):

  Mühendislik:      ████████████████████ 3.0
  Temel Bilimler:   ██████████████████   2.7
  Sağlık:           ███████████████████████ 3.5 (çok yazarlı)
  Sosyal Bilimler:  ████████             1.2

Yıllık Proje Bütçesi/Bölüm (ortalama):

  Mühendislik:      ████████████████████████ 4.0M ₺
  Temel Bilimler:   ████████████████     2.5M ₺
  Sağlık:           ██████████████████████████████ 6.0M ₺
  Sosyal Bilimler:  ████                 0.6M ₺

Hoca Tutma Zorluğu:

  Mühendislik:      ████████████████████ YÜKSEK (sektör çekiyor)
  Temel Bilimler:   ████████             DÜŞÜK
  Sağlık:           ████████████████████████ ÇOK YÜKSEK (özel hastane)
  Sosyal Bilimler:  ██████               DÜŞÜK

Harç Geliri / Maliyet Oranı (verimlilik):

  Sosyal Bilimler:  ████████████████████████ EN YÜKSEK
  Endüstri Müh.:    ████████████████████ YÜKSEK
  Mühendislik:      ████████████         ORTA
  Sağlık:           ████████             DÜŞÜK (ama döner sermaye telafi eder)
```

### Öğrenci Talep Dinamikleri (Yıllara Göre Değişim)

Bölümlere olan talep sabit değildir. Trendler oyun dünyasında döngüsel olarak değişir.

```
Talep Değişim Sistemi:

Her 3-5 yıl (6-10 dönem) bir "trend döngüsü" yaşanır.
Sistem her dönem başında talep çarpanlarını günceller.

Talep_Çarpanı(bölüm) = Temel_Talep × Trend_Etkisi × Prestij_Etkisi

Trend Etkisi Hesaplaması:
  Her bölümün bir "sıcaklık" değeri var (0.5 - 2.0 arası)
  Sıcaklık her dönem ±0.05-0.15 arasında rastgele değişir
  Sıcaklık bazı olaylara bağlı sıçrama yapabilir (bkz. aşağı)
```

#### Trend Tetikleyicileri

| Olay | Etkilenen Bölümler | Talep Etkisi |
|---|---|---|
| Yapay zeka patlaması | BM, YZM, Matematik, E-E | +%40-60, 4-6 dönem sürer |
| Ekonomik kriz | İşletme, İktisat ↑ / Mühendislik ↓ | ±%20-30 |
| Pandemi / salgın | Tıp, Biyoloji, Eczacılık ↑↑ | +%50-80, 3-5 dönem |
| Büyük deprem | İnşaat ↑, Jeoloji ↑ | +%30, 2-4 dönem |
| Startup ekosistemi büyümesi | BM, İşletme, Endüstri | +%20-40 |
| Hukuk reformu | Hukuk ↑ | +%25, 2-3 dönem |
| Uzay/havacılık yatırımı | Makine, E-E, Fizik | +%30, 3-5 dönem |
| Yeşil enerji dönüşümü | Çevre Müh., E-E, Kimya | +%35, uzun vadeli |
| Siber güvenlik krizi | BM, E-E, Matematik | +%40, 2-4 dönem |

#### Zamana Bağlı Genel Trendler

```
Oyun başlangıcında (2025 civarı):

  Çok Sıcak (talep ×1.8):  Bilgisayar Müh., Yapay Zeka, Yazılım
  Sıcak (talep ×1.4):      Biyomedikal, Moleküler Biyoloji, Veri Bilimi
  Normal (talep ×1.0):      E-E, Makine, İşletme, Tıp, Hukuk
  Soğuk (talep ×0.7):       İnşaat, Kimya, Fizik
  Çok Soğuk (talep ×0.5):   Tarih, Felsefe, Sosyoloji

Ancak trendler döngüseldir:
  - Bugün soğuk olan bölüm 10 yıl sonra sıcak olabilir
  - "Herkes BM açtı" → arz fazlası → mezun işsizliği → talep düşer
  - Arz-talep dengesi: Çok üniversite aynı bölümü açarsa piyasa doyar
    Doyma_Etkisi = 1.0 - (Toplam_Kontenjan_Ülke / Talep_Havuzu) × 0.3
```

### Bölüm Açma/Kapatma Stratejisi

```
Bölüm Açma Gereksinimleri:
  1. Yeterli bütçe (başlangıç maliyeti + 4 dönem işletme)
  2. Minimum hoca sayısı: Mühendislik 8, Sosyal 5, Tıp 30
  3. Lab/bina altyapısı (kategori bazında)
  4. YÖK onayı (prestij ≥ 20 ise otomatik, altıysa 1 dönem bekleme)
  5. İlk öğrenci alımına kadar 1 dönem hazırlık süresi

Bölüm Kapatma:
  - Mevcut öğrenciler mezun olana kadar (4-6 dönem) öğretim sürer
  - Hocalar başka bölümlere aktarılabilir veya sözleşme feshedilir
  - Kapatma prestij maliyeti: -3 (başarısızlık algısı)
  - Stratejik kapatma: Kâr etmeyen bölümü kapatıp kaynağı verimli bölüme aktarma
```

### Bölümler Arası Sinerji

```
Bazı bölüm çiftleri birlikte olduğunda bonus üretir:

  BM + Matematik:           Araştırma kalitesi +%15 (teorik altyapı)
  BM + İşletme:             Girişimci mezun oranı +%25
  E-E + Fizik:              Proje başarısı +%10
  Tıp + Biyomedikal:        Patent potansiyeli +%30, ortak lab
  Tıp + Moleküler Biyoloji: Yayın kalitesi +%20
  Hukuk + İşletme:          Mezun bağış potansiyeli +%20
  Kimya + Eczacılık:        Lab maliyeti -%15 (paylaşım), patent +%15
  İşletme + tüm Mühendislik: Girişimcilik ekosistemi bonusu

Sinerji, her iki bölüm de en az 3 dönemdir aktifse devreye girer.
```

---

## 5. Öğrenci Sistemi

### 5.0 Öğrenci Modelleme Yaklaşımı: Hibrit Sistem

Binlerce öğrenciyi tek tek simüle etmek hem gereksiz hem performans sorunu yaratır.
Çözüm: **Kohort + Yıldız Öğrenci** hibrit sistemi.

```
KOHORT (Toplu Simülasyon — öğrencilerin %90-95'i):
  Her bölüm-angajman yılında bir "kohort" vardır.
  Kohort = İstatistiksel profil (birey değil, grup)

  Örnek: "BM 2026 Güz Kohortu"
    Öğrenci sayısı: 80
    Ortalama sınav puanı: 72
    Ortalama GPA: 3.1
    Memnuniyet: 68
    Burslu oranı: %25
    → Tüm ekonomi/başarı hesaplamaları kohort üzerinden

YILDIZ ÖĞRENCİ (Bireysel Kart — %5-10):
  Bazı öğrenciler özel yeteneklerle gelir.
  Bunlar bireysel kart olarak oyuncuya gösterilir.
  FM'deki "genç yetenek" (wonderkid) gibi.
  Her dönem 0-5 yıldız öğrenci gelebilir (prestije bağlı).
```

#### Yıldız Öğrenci Profil Kartı

```
┌─────────────────────────────────────────────────────────────┐
│  ★ Deniz Akarsu              YILDIZ ÖĞRENCİ                │
│  Bölüm: Bilgisayar Müh.     Sınıf: 2. yıl                 │
│  Tip: Girişimci Dâhi         Burs: %75 Merit                │
│─────────────────────────────────────────────────────────────│
│  Akademik    ████████████████████░░░░░  78                   │
│  Yaratıcılık ██████████████████████████ 95                   │
│  Liderlik    ████████████████████░░░░░  80                   │
│  Spor        ████████░░░░░░░░░░░░░░░░░  35                   │
│  Sanat       ██████████████░░░░░░░░░░░  58                   │
│  Karizma     ████████████████████░░░░░  82                   │
│─────────────────────────────────────────────────────────────│
│  Özel Yetenek: "Startup Vizyoneri"                           │
│    → Mezun olunca startup kurma şansı %60 (normal: %5)       │
│    → Öğrenci kulübü kurdu: "Yazılım Atölyesi" (+5 memnuniyet)│
│  Potansiyel Mezun Etkisi: ★★★★☆                             │
│  Risk: GPA düşük (3.0) — burs koşulunu zor tutuyor          │
└─────────────────────────────────────────────────────────────┘

Yıldız Öğrenci Stat'ları (1-100):
  Akademik:    Ders başarısı, GPA, araştırma potansiyeli
  Yaratıcılık: Proje/startup/sanat/inovasyon kapasitesi
  Liderlik:    Kulüp, takım, topluluk organize etme
  Spor:        Atletik yetenek (ABD'de çok önemli)
  Sanat:       Müzik, tiyatro, tasarım, yazarlık
  Karizma:     Sosyal etki, ağ kurma, insanları peşinden sürükleme
```

#### Yıldız Öğrenci Tipleri

```
┌─────────────────┬──────────────────┬────────────────────────────────────┐
│ Tip             │ Tanıma Koşulu    │ Üniversiteye Etkisi                │
├─────────────────┼──────────────────┼────────────────────────────────────┤
│ Akademik Dâhi   │ Akademik ≥ 90    │ Lisansüstüye kalma şansı yüksek,  │
│                 │                  │ araştırma asistanı olarak katkı,   │
│                 │                  │ mezun olunca akademisyen/bilim insanı│
├─────────────────┼──────────────────┼────────────────────────────────────┤
│ Girişimci Dâhi  │ Yaratıcılık ≥ 85 │ Startup kurar (okurkenyken bile),  │
│                 │ + Liderlik ≥ 70  │ teknokente değer katar, mezun olunca│
│                 │                  │ bağış + prestij potansiyeli DEV     │
├─────────────────┼──────────────────┼────────────────────────────────────┤
│ Spor Yıldızı    │ Spor ≥ 90       │ Takım başarısı → okul ünü,         │
│                 │                  │ ABD: NIL geliri, stadyum doluluk,   │
│                 │                  │ TR: lig/şampiyona temsili           │
│                 │                  │ Risk: Akademik başarısızlık         │
├─────────────────┼──────────────────┼────────────────────────────────────┤
│ Sanat Yıldızı   │ Sanat ≥ 90      │ Kampüs kültürü +10, festival/      │
│                 │                  │ etkinlik bonusu, mezun olunca       │
│                 │                  │ ünlü sanatçı → PR prestiji          │
├─────────────────┼──────────────────┼────────────────────────────────────┤
│ Sosyal Lider    │ Liderlik ≥ 85   │ Öğrenci memnuniyeti +5 (kendi      │
│                 │ + Karizma ≥ 80   │ bölümünde), kulüp kurma, kampüs    │
│                 │                  │ hayatını canlandırır. Mezun olunca  │
│                 │                  │ yönetici → yüksek bağış potansiyeli │
├─────────────────┼──────────────────┼────────────────────────────────────┤
│ Çok Yönlü       │ 3+ stat ≥ 75    │ Nadir. Akademik + lider + sporcu.  │
│ (Polymath)      │                  │ Her alanda katkı, "üniversitenin   │
│                 │                  │ yüzü" olabilir. Devasa mezun etkisi│
├─────────────────┼──────────────────┼────────────────────────────────────┤
│ Sessiz Deha     │ Akademik ≥ 95,  │ Kimse fark etmez, sessiz çalışır.  │
│                 │ Karizma < 30     │ Mezun olunca Nobel/Turing potansiyel│
│                 │                  │ AMA kampüse sıfır katkı, burs yer  │
└─────────────────┴──────────────────┴────────────────────────────────────┘
```

#### Yıldız Öğrenci Gelmesi Nasıl Belirlenir?

```
Her yıl (Güz dönemi) sistem yıldız öğrenci adayları üretir.

Yıldız_Aday_Sayısı = floor(Prestij / 20) + Rastgele(0, 2)
  Prestij 20:  0-3 aday
  Prestij 50:  2-4 aday
  Prestij 80:  4-6 aday
  Prestij 95:  4-7 aday (tavan)

Her aday üniversiteye gelme kararı verir:
  Gelme_Şansı = f(Prestij, Burs_Teklifi, Bölüm_Ünü, Kampüs_Kalitesi, Rakipler)

  Akademik Dâhi çekme:
    Hoca kalitesi × 0.4 + Araştırma altyapısı × 0.3 + Burs × 0.3
  Girişimci çekme:
    Teknokent × 0.3 + Şehir × 0.2 + Burs × 0.2 + Prestij × 0.3
  Sporcu çekme (ABD):
    Antrenör ünü × 0.3 + Tesis × 0.3 + Burs × 0.2 + NIL potansiyeli × 0.2
  Sporcu çekme (TR):
    Spor tesisi × 0.4 + Burs × 0.3 + Şehir × 0.3
  Sanatçı çekme:
    Kampüs kültürü × 0.4 + Şehir × 0.3 + Burs × 0.3

Rakip üniversiteler de aynı yıldız öğrencileri ister!
  → "Recruiting war" — hoca transferi gibi ama öğrenci için
  → Oyuncu: Ekstra burs teklif edebilir, özel davet (kampüs turu) yapabilir
```

#### Yıldız Öğrenci Yaşam Döngüsü ve Olayları

```
Yıldız öğrenci 4 yıl boyunca olaylar tetikler:

1. yıl: Adaptasyon
   - Kulüp kurabilir, arkadaş grubu oluşturur
   - Risk: Uyum sorunu → yıldız öğrenci transfer olabilir (!)
   - Sporcu: İlk sezon performansı

2. yıl: Parlama
   - Akademik dâhi: Araştırma asistanlığı başlar → hocaya katkı
   - Girişimci: İlk proje/hackathon → teknokent bağlantısı
   - Sporcu: Lig/turnuva etkisi, takım başarısı
   - Sanatçı: Festival/sergi → kampüs kültürü bonusu

3. yıl: Zirve
   - Akademik: Yayın çıkarabilir (hoca ile ortak)
   - Girişimci: Startup kurar (okurkenyken!) → teknokent
   - Sporcu: Şampiyonluk yarışı, milli takım
   - Lider: Öğrenci konseyi başkanı → memnuniyet etkisi

4. yıl: Mezuniyet + Miras
   - Mezun profili belirlenir → mezun sistemine geçer (Bölüm 6)
   - "Ünlü Mezun" olma şansı hesaplanır
   - Bazıları lisansüstüye kalır → araştırma pipeline

Yıldız Öğrenci Olayları (rastgele):
  + "Uluslararası ödül kazandı!" → Prestij +3
  + "Startup'ı yatırım aldı!" → Teknokent geliri + PR
  + "Milli takıma seçildi!" → Spor prestiji +5
  + "Viral sosyal medya içeriği!" → Başvuru sayısı +%5 (o dönem)
  - "Akademik dürüstlük ihlali" → Skandal riski, prestij -2
  - "Transfer istedi" → Başka üniversiteye geçebilir (kaybedersin!)
  - "Sakatlık" (sporcu) → Sezon kaybı, burs devam ediyor ama katkı yok
  - "Motivasyon kaybı" → GPA düşer, potansiyel israf olur
```

#### Kohort Sistemi Detayları

```
Kohort = Bir bölümde aynı yıl başlayan öğrenci grubu.

Kohort Profili:
  bölüm: "bilgisayar_muhendisligi"
  giriş_yılı: 2026
  öğrenci_sayısı: 80
  ortalama_sınav_puanı: 72
  ortalama_GPA: 0 (henüz başlamadı)
  memnuniyet: 70
  burslu_oran: 0.25
  burslu_ortalama_miktar: 50000
  mezuniyet_oran_tahmini: 0.82
  yıldız_öğrenci_sayısı: 2 (bireysel kartları ayrı)

Her dönem kohort istatistikleri güncellenir:
  GPA = f(Hoca_Kalitesi, Sınıf_Büyüklüğü, Memnuniyet, Giriş_Puanı)
  Memnuniyet = f(Eğitim, Sosyal, Yurt, Yemek, Spor, Burs, Kariyer)
  Ayrılma_Oranı = f(GPA, Memnuniyet, Ekonomik_Durum)

Kohort mezun olduğunda:
  → Mezun havuzuna eklenir (Bölüm 6)
  → Kalite metrikleri mezun başarısını etkiler
  → Yıldız öğrenciler bireysel olarak izlenmeye devam eder
```

### 5.1 Öğrenci Alımı

```
Alım sistemi üniversite tipine göre değişir:

TR — ÖSYM Sistemi:
  Her dönem Güz'de:
    1. Oyuncu bölüm bazında kontenjan belirler
    2. ÖSYM sınav sonuçlarına göre öğrenci yerleşir
    3. Öğrenci tercih sıralaması: Prestij × 0.5 + Bölüm_Ünü × 0.3 + Şehir × 0.2
    4. Ücret etkisi (vakıf): Ödeme kapasitesi < ücret ise tercih etmez
    5. Burs etkisi: Burslu kontenjan → düşük gelirli yetenekler çekilir

ABD — Holistic Admission:
  Her yıl güz'de:
    1. Oyuncu kabul oranını belirler (selectivity)
    2. Başvuru: SAT/ACT + GPA + extracurricular + essay
    3. Kabul Skoru = SAT × 0.3 + GPA × 0.3 + Aktivite × 0.2 + Çeşitlilik × 0.1 + Legacy × 0.1
    4. Financial Aid paketi → kabul edilen gelir mi?
    5. "Yield" (kabul edilip gelme oranı): Prestije bağlı
       Prestij < 30: Yield %30 (çoğu gelmez)
       Prestij 50:   Yield %50
       Prestij > 80: Yield %75+ (herkes gelir)
       Ivy League:   Yield %85+ (nereye kabul edildiyse gider)

  ABD'de Sporcu Alımı (Athletic Recruiting):
    Ayrı bütçe ve süreç
    Scout: Lise sporcularını izle
    Teklif: Tam sporcu bursu + tesis kalitesi + antrenör ünü
    "Letter of Intent" → Sporcu commit eder
    Sporcu kontenjanı NCAA kurallarına göre sınırlı

Başvuru Sayısı = Kontenjan × Başvuru_Çarpanı
Başvuru_Çarpanı:
  Prestij < 30: 1.5× (az ilgi)
  Prestij 30-60: 3× (normal)
  Prestij 60-80: 6× (popüler)
  Prestij > 80: 10×+ (çok popüler)
```

### 5.2 Öğrenci Tipleri ve Oranları

```
Öğrenci tipleri kohort bazında dağıtılır.
Yıldız öğrenciler bu dağılımdan bağımsız, bireysel olarak üretilir.

Kohort İçi Tip Dağılımı:
```

| Tip | TR Oran | ABD Oran | Güçlü Yön | Mezun Etkisi |
|---|---|---|---|---|
| Akademik Odaklı | %20 | %25 | Yüksek GPA, araştırma | Akademisyen, bilim insanı |
| Girişimci Ruhlu | %15 | %20 | İnovasyon, ağ kurma | Startup, patent, bağış |
| Sosyal Lider | %15 | %10 | Kulüp, etkinlik, motivasyon | Yönetici, politikacı, bağışçı |
| Spor Odaklı | %5 | %15 (D1) | Takım başarısı, kampüs ruhu | Marka, bağış (ABD'de dev) |
| Sanatçı/Kültürel | %10 | %10 | Festival, kampüs kültürü | Ünlü sanatçı, PR |
| Kariyer Odaklı | %15 | %10 | Staj, networking | Hızlı iş bulma, orta bağış |
| Ortalama | %20 | %10 | Dengeli | Mezun ağının hacmi |

```
ABD Ek Öğrenci Tipleri:
  Legacy Student: Mezun çocuğu (%5-10 oranında)
    + Kabul avantajı (tartışmalı ama gerçek)
    + Ebeveyn bağışı tetiklenir (kabul edilirse)
    - Ortalama yetenek (garanti iyi değil)

  International Student: Yabancı öğrenci (%10-25)
    + Yüksek ücret öder (financial aid sınırlı)
    + Çeşitlilik bonusu → sıralama puanı
    + Bazıları çok yetenekli (Çin, Hindistan, Kore)
    - Uyum zorluğu, sosyal izolasyon riski
    - Vize/göç politikası değişikliği riski (rastgele olay)

  First-Generation: Ailede üniversiteye giden ilk kişi (%15-20)
    + İhtiyaç bursu gerektirir
    + Başarırsa: Devasa sosyal etki → prestij bonusu
    - Ayrılma riski yüksek (ekonomik + sosyal zorluk)
```

### 5.3 Öğrenci Memnuniyeti Faktörleri

```
TR Modeli:
  Öğrenci_Memnuniyeti =
      Eğitim_Kalitesi       × 0.30
    + Sosyal_Ortam           × 0.12
    + Yurt_Kalitesi          × 0.12
    + Yemek_Kalitesi         × 0.08
    + Spor_Tesisi            × 0.06
    + Ulaşım                 × 0.05
    + Burs_İmkanı            × 0.10
    + Kariyer_Desteği        × 0.10
    + Ücret_Değer_Algısı     × 0.07 (ödediğime değiyor mu?)

ABD Modeli:
  Öğrenci_Memnuniyeti =
      Eğitim_Kalitesi       × 0.25
    + Kampüs_Hayatı          × 0.15 (kulüpler, Greek life, etkinlikler)
    + Yurt_Kalitesi          × 0.10
    + Dining_Kalitesi         × 0.05
    + Spor_ve_Okul_Ruhu      × 0.12 (game day, NCAA turnuvası)
    + Kariyer_Servisi         × 0.12 (internship, career fair, alumni network)
    + Financial_Aid_Yeterliliği × 0.10
    + Kampüs_Güvenliği       × 0.05
    + Çeşitlilik             × 0.06 (DEI programları, uluslararası öğrenci oranı)
```

### 5.4 Öğrenci Başarısı

```
Kohort_GPA = (Hoca_Eğitim_Kalitesi × 0.35)
           + (Giriş_Puanı_Norm × 0.25)
           + (Sınıf_Büyüklüğü_Çarpanı × 0.15)
           + (Memnuniyet × 0.15)
           + (Burs_Motivasyonu × 0.10)

Yıldız_Öğrenci_GPA = Akademik_Stat / 25 (max 4.0)
  Akademik 100 → 4.0, Akademik 75 → 3.0, Akademik 50 → 2.0

Mezuniyet Oranı:
  Baz: %75
  + Memnuniyet > 70: +%8
  + Ekonomik destek yüksek: +%5
  + Eğitim kalitesi yüksek: +%5
  - Hoca kalitesi düşük: -%10
  - Ücret/değer dengesizliği: -%8 (pahalı ama kötü)
  ABD'de sporcu mezuniyet oranı ayrı izlenir (genelde düşük):
    NCAA kural: Takım mezuniyet oranı < %50 ise ceza

Ortalama Mezuniyet Süresi:
  Normal: 4 yıl (8 dönem)
  Kötü koşullar: 4.5-5 yıl
  Co-op modeli: Ek süre ama staj dahil
  ABD: 4 yıl (zamanında bitirme oranı ayrı izlenir)
```

### 5.5 Kapasite Kısıtı

```
Maksimum Öğrenci = Σ(Tüm Sınıf Kapasiteleri)

Kapasite aşılırsa:
  - Kalabalık → memnuniyet -15, eğitim kalitesi -10
  - Sınıf büyüklüğü artar → öğrenme çarpanı düşer (bkz. 4.3c)

Optimum doluluk: %85-90 (gelir maksimum, kalite korunur)

ABD'de ek kısıt:
  NCAA sporcu oranı max %5-10 (D1)
  Uluslararası öğrenci oranı: Çeşitlilik bonusu ama >%30 ise "Amerikan okulu mu bu?" tepkisi
```

### 5.6 Uluslararasılaşma ve Yabancı Öğrenci/Hoca

```
Yabancı Öğrenci:
  - Ayrı ücret (TR: yerli ×2-3, ABD: financial aid sınırlı)
  - Uluslararasılaşma sıralama puanı (THE/QS: %5-10 ağırlık)
  - Kaynak ülke profili: Kalite + ödeme kapasitesi farklı
  - Yabancı öğrenci oranı ideal %10-20, >%30 ise yerli tepkisi
  - Yabancı öğrenci ofisi altyapısı gerekir (idari birim)

Yabancı Hoca:
  - Sıralama bonusu (uluslararası kadro oranı)
  - Genelde daha yüksek maaş beklentisi
  - Araştırma ağı getirisi (uluslararası işbirliği kolaylaşır)
  - Dil/kültür uyum maliyeti (ilk 1-2 dönem verimlilik düşük)

Makroekonomi Etkisi (basitleştirilmiş):
  Her 5-10 yıl bir "ekonomik döngü" olayı:
    Büyüme: Bütçe +%10-20, öğrenci ödeme kapasitesi artar
    Durgunluk: Bütçe -%10-15, devlet kesintisi, bağışlar düşer
    Kriz: Bütçe -%20-30, yabancı öğrenci kaçışı, maaş baskısı
    Enflasyon: Maaş/gider artar ama harç artışı politik olarak zor
  → Detaylı ekonomi modeli değil, rastgele olay olarak modellenir
```

---

## 6. Mezun Sistemi (Uzun Vadeli Yatırım)

### 6.1 Mezun Takibi

Her mezun oyun içinde bir entity olarak kalır (hafızaya alınır). Simüle edilen kariyer:

```
Kariyer_Yolu = f(Öğrenci_Tipi, GPA, Sektör_Seçimi, Rastgele)

Her yıl mezun için:
  - Kariyer_Seviyesi artar (Junior → Senior → Yönetici → Üst Yönetim)
  - Bağış_Potansiyeli güncellenir
  - Üniversiteye_Dönme_Şansı hesaplanır (akademisyen tipler için)
```

### 6.2 Mezun Kategorileri ve Etkileri

#### Sektöre Geçen Mezunlar

```
İstihdam_Oranı = Mezun_Ağı_Gücü × 0.4 + Üniversite_Prestiji × 0.3 + Öğrenci_GPA_Ort × 0.3
Yüksek istihdam oranı → tercih sırasında +puanlama → daha iyi öğrenci
```

#### Startup Kuran Mezunlar (Girişimci Tip)

```
Startup_Olasılığı = Öğrenci_Tipi == "Girişimci" ?
    (Prestij / 100 × 0.3 + Teknokent_Varlığı × 0.2 + Rastgele(0-0.1)) : 0.02

Başarılı startup:
  - 3-8 dönem sonra patent gelirleri başlar
  - Üniversiteye gelir paylaşımı (spin-off anlaşması)
  - Mezun bağışı artar
  - Diğer girişimci öğrencilere rol model → Girişimci_Öğrenci_Oranı ++
```

#### Akademiye Dönen Mezunlar

```
Akademiye_Dönme_Şansı = Öğrenci_Tipi == "Akademisyen" ? 0.20 : 0.03
Dönen mezun:
  - ArGö pozisyonunda başlar
  - Stat'ları GPA ve potansiyele göre
  - Kuruma bağlılık yüksek (Sadakat +20 bonus)
  - Maaş beklentisi düşük (başlangıçta)
```

### 6.3 Ünlü Mezun Sistemi

```
Ünlü_Mezun_Tetiklenme: Her dönem 2% şans (prestij ≥ 60 olan üniversitelerde)
Şans = Prestij / 50 × Mezun_Sayısı / 1000 × Rastgele_Faktör

Ünlü Mezun Etkileri (10 dönem boyunca):
  - Prestij: +5 (kalıcı)
  - Mezun_Bağış_Çarpanı: ×3 (5 dönem)
  - Başvuru_Çarpanı: ×1.5 (3 dönem)
  - Medya haberleri → Popülerlik ++
  - Olası bağış miktarı: 5M - 500M ₺ (tek seferlik büyük bağış şansı)

Ünlü Mezun Tipleri:
  - Şirketi halka açılan girişimci
  - Nobel/büyük ödül kazanan akademisyen
  - Ulusal siyasetçi/büyükelçi
  - Dünya çapında tanınan sporcu (spor tipi)
  - Oscar/ödüllü sanatçı (kültürel tip)
```

### 6.4 Mezun Ağı Gücü

```
Mezun_Ağı_Gücü = Σ(Mezun_Kariyer_Seviyesi × Sektör_Dağılım_Çarpanı) / Toplam_Mezun

Sektör_Çeşitliliği_Bonusu: 4+ sektörde güçlü mezun varsa +%20
Güçlü mezun ağı → kariyer hizmetleri kalitesi ++ → öğrenci memnuniyeti ++ → tercih ++
```

---

## 7. Kampüs ve Fiziki Altyapı

### 7.1 Bina Tipleri

| Bina | İnşaat Maliyeti | Bakım/Yıl | Kapasite | İnşaat Süresi | Etki |
|---|---|---|---|---|---|
| Fakülte Binası (küçük) | 15.000.000 ₺ | 750.000 ₺ | 300 öğrenci | 2 dönem | Sınıf kapasitesi |
| Fakülte Binası (büyük) | 30.000.000 ₺ | 1.200.000 ₺ | 700 öğrenci | 3 dönem | Sınıf kapasitesi |
| Araştırma Laboratuvarı | 20.000.000 ₺ | 1.500.000 ₺ | 20 araştırmacı | 2 dönem | Araştırma +20 |
| Kütüphane | 10.000.000 ₺ | 400.000 ₺ | Tüm kampüs | 2 dönem | Öğrenci GPA +5, Araştırma +5 |
| Yurt (100 oda) | 12.000.000 ₺ | 800.000 ₺ | 200 öğrenci | 2 dönem | Memnuniyet +8 |
| Yemekhane | 5.000.000 ₺ | 600.000 ₺ | 500 kişi/gün | 1 dönem | Memnuniyet +6 |
| Spor Tesisi (temel) | 8.000.000 ₺ | 400.000 ₺ | Tüm kampüs | 2 dönem | Memnuniyet +7 |
| Spor Tesisi (olimpik) | 25.000.000 ₺ | 1.000.000 ₺ | Tüm kampüs | 3 dönem | Memnuniyet +15, Prestij +3 |
| Konferans Salonu | 8.000.000 ₺ | 300.000 ₺ | 500 kişi | 1 dönem | Araştırma +5, Gelir (kiralama) |
| Araştırma Merkezi | 35.000.000 ₺ | 2.000.000 ₺ | 50 araştırmacı | 3 dönem | Araştırma +35, Patent ++ |
| Teknokent/Kuluçka | 45.000.000 ₺ | 1.500.000 ₺ | 20 firma | 4 dönem | Girişim ++, Gelir ++, Prestij +10 |
| Sağlık Merkezi | 6.000.000 ₺ | 500.000 ₺ | Tüm kampüs | 1 dönem | Memnuniyet +5 |
| Konuk Evi | 4.000.000 ₺ | 200.000 ₺ | 30 kişi | 1 dönem | Uluslararasılaşma +5 |

### 7.2 Bina Kalite Sistemi (1-5 Yıldız)

```
Yıldız Hesabı:
  Yeni bina: 5 yıldız
  Her dönem bakım yapılmazsa: -0.1 yıldız
  Bakım bütçesi kesilirse: -0.3/dönem
  Tamir yatırımı: +1 yıldız (maliyeti orijinalin %20'si)

Kalite Etkileri:
  5★: Tam etki + %10 bonus
  4★: Tam etki
  3★: Etki %85
  2★: Etki %60, şikayet başlar
  1★: Etki %30, skandal riski, memnuniyet -10
```

### 7.3 Arazi Sistemi

```
Başlangıç Arazisi: 10 arazi birimi (her bina 1-3 birim kaplar)
Arazi Genişletme:
  +5 arazi birimi: 20.000.000 ₺ (merkez kampüs yakını)
  +10 arazi birimi: 30.000.000 ₺ (ilçe dışı arazi)
  Maksimum: 50 arazi birimi (çok büyük kampüs)
```

### 7.4 Kapasite Planlama

```
Fakülte Binası Kapasitesi: Sınıf kapasitesini doğrudan belirler
Yurt Kapasitesi: Yurt isteyen öğrenci sayısını karşılamak → memnuniyet
Lab Kapasitesi: Araştırma hocası sayısını sınırlar
Yemekhane: Öğrenci sayısını karşılamıyorsa memnuniyet düşer (kuyruk sorunu)

Kapasite açığı toleransı:
  %10 aşım: Hafif memnuniyet düşüşü
  %25 aşım: Belirgin düşüş + uyarı
  %50 aşım: Acil durum, akreditasyon riski
```

---

## 8. Araştırma ve Yayın Sistemi

### 8.1 Araştırma Alanları

Oyun başında 2-3 alan seçilir (odak alanı), ileride yeni alan açılabilir:

| Alan | İdeal Hoca Profili | TÜBİTAK Fon Oranı | Sanayi İlgisi |
|---|---|---|---|
| Bilgisayar / Yapay Zeka | Araştırma ≥ 75 | Yüksek | Çok yüksek |
| Mühendislik (Elektrik, Makine) | Araştırma ≥ 65 | Yüksek | Yüksek |
| Tıp / Biyomedikal | Araştırma ≥ 70 | Çok yüksek | Yüksek |
| Fen Bilimleri (Fizik, Kimya) | Araştırma ≥ 70 | Orta | Orta |
| Sosyal Bilimler | Eğitim ≥ 70 | Düşük | Düşük |
| İşletme / İktisat | Popülerlik ≥ 65 | Düşük | Yüksek (özel sektör) |
| Hukuk | Eğitim ≥ 75 | Yok | Orta |
| Sanat ve Tasarım | Popülerlik ≥ 70 | Düşük | Orta |

### 8.2 TÜBİTAK Proje Döngüsü

```
Başvuru Koşulları:
  - Başvuran hoca Araştırma ≥ 50
  - Birim araştırma bütçesi >= 500.000 ₺/dönem
  - Aktif proje yoksa bonus

Başarı Şansı = Araştırmacı_Stat / 100 × 0.4
             + Lab_Kalitesi / 5 × 0.3
             + Geçmiş_Başarı_Bonusu × 0.2   (her önceki proje +5%)
             + Rastgele(-0.1, +0.1)

Proje Türleri:
  1001 (Araştırma): Bütçe 500K-2M ₺, 2-4 dönem
  1003 (Öncelikli): Bütçe 2M-8M ₺, 4-8 dönem, şans düşük
  TEYDEB (Sanayi): Bütçe 1M-5M ₺, teknokent varsa +%20 şans
  AB Horizon: Bütçe 5M-20M ₺, uluslararasılaşma ≥ 50 gerekir
```

### 8.3 Yayın Sistemi

```
Dönem_Yayın_Üretimi:
  Her araştırma yapan hoca için:
    Yayın_Şansı = Araştırma_Stat / 100 × Motivasyon / 100 × Lab_Kalitesi_Çarpanı

  Yayın Kalitesi Dağılımı (araştırma ≥ 70 hoca için):
    Q1: %25
    Q2: %35
    Q3: %25
    Q4: %15

  Yayın_Puanı:
    Q1 makale: 10 puan
    Q2 makale: 6 puan
    Q3 makale: 3 puan
    Q4 makale: 1 puan
    Kitap bölümü: 2 puan

Araştırma_Skoru = Σ(Son_4_Dönem_Yayın_Puanı) / Hoca_Sayısı × Lab_Çarpanı
```

### 8.4 Atıf Sistemi

```
Atıf birikimleri:
  Q1 makale: dönem başına +3-8 atıf (araştırma alanına göre değişken)
  Q2 makale: dönem başına +1-3 atıf

Atıf_Toplamı etkisi:
  - Hoca doçentlik başvurusunda kullanılır
  - Uluslararası sıralama puanına katkı
  - Prestij bonusu (atıf/hoca > 50 ise +5 prestij)
```

### 8.5 Patent Sistemi

```
Patent_Tetiklenme_Şansı:
  Araştırma_Stat ≥ 80 olan hoca: %8/dönem
  Teknokent varsa: +%5
  Girişimci öğrenci ile ortak proje: +%3

Patent Süreci:
  Başvuru → 2 dönem değerlendirme → Kabul/Red
  Kabul oranı: %40-70 (alan ve kaliteye bağlı)

Lisanslama:
  Patent üretildikten 2 dönem sonra lisans geliri başlar
  Gelir: 50.000 - 2.000.000 ₺/yıl
  Süre: 20 yıl (oyun içi 40 dönem, genelde oyun bitmeden)
```

---

## 9. Sıralama ve Prestij Sistemi

### 9.1 Prestij Puanı Bileşenleri (0-100)

```
Prestij = Eğitim_Kalitesi    × 0.25
        + Araştırma_Puanı    × 0.30
        + Mezun_Başarısı     × 0.20
        + Öğrenci_Memnuniyeti× 0.15
        + Uluslararasılaşma  × 0.10

Eğitim_Kalitesi:
  = Hoca_Eğitim_Ort × 0.5 + Altyapı_Kalitesi × 0.3 + Mezuniyet_Oranı × 0.2

Araştırma_Puanı:
  = Yayın_Skoru × 0.4 + TÜBİTAK_Aktif_Proje_Bütçesi/10M × 0.3 + Patent × 0.3

Mezun_Başarısı:
  = İstihdam_Oranı × 0.4 + Mezun_Ağı_Gücü × 0.4 + Ünlü_Mezun_Bonusu × 0.2

Uluslararasılaşma:
  = Yabancı_Öğrenci_Oranı × 0.3
  + Yabancı_Hoca_Oranı × 0.3
  + AB_Proje_Sayısı × 0.2
  + Erasmus_Ortaklık × 0.2
```

### 9.2 Ulusal Sıralama

```
10 üniversite (5 AI + oyuncu) ulusal sıralamada yarışır.
Sıralama = Prestij puanına göre (eşitlikte araştırma belirleyici)

Sıralama Etkisi:
  1-3 arası: Başvuru_Çarpanı ×10, en iyi öğrenci havuzu, prestij ++ feedback
  4-6 arası: Başvuru_Çarpanı ×5, iyi öğrenci havuzu
  7-10 arası: Başvuru_Çarpanı ×2, ortalama havuz
```

### 9.3 Uluslararası Sıralama (Geç Oyun)

```
Uluslararası sıralama 30 üniversite içinde (25 küresel + 5 Türk)
Ön koşul: Uluslararasılaşma ≥ 40 ve Araştırma_Puanı ≥ 60

Top 500 → Prestij +10 (büyük sıçrama)
Top 200 → Prestij +20
Top 100 → Çok nadir, oyunun en büyük başarısı
```

### 9.4 Akreditasyon Sistemi

```
Her fakülte bağımsız akredite edilir.

Akreditasyon Koşulları (hepsi sağlanmalı):
  - Hoca başına öğrenci oranı ≤ 30
  - Öğrenci memnuniyeti ≥ 50
  - Mezuniyet oranı ≥ 65%
  - Lab kalitesi ≥ 2 yıldız
  - Bütçe açığı yok (son 2 dönem)

Akreditasyon Kaybı:
  - Koşullar 3 dönem arka arkaya sağlanmazsa uyarı
  - 5. dönem sonunda kaybedilir
  - Kaybedilince: öğrenci alımı durdurulur, prestij -20, devlet ödeneği -50%

YÖK Denetimi:
  Borç > 30M veya skandal → YÖK denetim ekibi → 2 dönem bütçe kısıtı
```

---

## 10. Rakip Üniversiteler (AI)

### 10.1 Rakip Profilleri (5 varsayılan rakip)

| İsim | Güçlü | Zayıf | Başlangıç Prestij | Strateji |
|---|---|---|---|---|
| Teknik Üniversite | Mühendislik araştırması | Sosyal bilimler, memnuniyet | 65 | Araştırma ağırlıklı |
| Büyük Devlet Üniversitesi | Öğrenci sayısı, devlet ödeneği | Kalite, hoca maaşı | 50 | Kitle ağırlıklı |
| Vakıf Üniversitesi | Öğrenci memnuniyeti, altyapı | Araştırma, fon | 55 | Kalite/konfor |
| Tıp Üniversitesi | Tıp araştırması, prestij | Diğer alanlar | 70 | Niş uzmanlık |
| Yeni Kurulan Özel | Düşük (30) | Her şey | 30 | Agresif transfer |

### 10.2 AI Karar Motoru

Her dönem AI üniversiteler şunları yapar:

```
1. Bütçe Tahsisi:
   - Strateji tipine göre kaynak dağıtımı
   - "Agresif transfer" tipi → maaş bütçesi ↑
   - "Araştırma ağırlıklı" → lab yatırımı ↑

2. Transfer Aktivitesi:
   - Mutsuz hocaları hedef al (oyuncunun da dahil)
   - Bütçeye oranla teklif ver
   - AI asla aşırı teklif vermez (gerçekçi)

3. Öğrenci Çekme:
   - Prestij oranına göre tercih sırası
   - Burs kampanyası açabilir (agresif büyüme döneminde)

4. İnşaat:
   - Kapasite yetersizse otomatik inşaat başlatır
   - Teknokent: sadece prestij ≥ 60 ve bütçe ≥ 100M ise
```

### 10.3 Rakip Zorluk Seviyeleri

```
Kolay: AI %70 verimlilik, daha yavaş büyüme, hata yapar (bütçe açığı vb.)
Orta: AI %85 verimlilik, dengeli
Zor: AI %100 verimlilik, agresif transfer, prestij zirveye daha hızlı ulaşır
```

---

## 11. Rastgele Olaylar

### 11.1 Olay Kategorileri

Her dönem 0-3 olay tetiklenir. Olay şansı = `Temel + Prestij_Etkisi + Dönem_Durumu`.

#### Pozitif Olaylar (Şans %: dönem başı hesaplanır)

| Olay | Tetiklenme Koşulu | Etki |
|---|---|---|
| Büyük Bağış Teklifi | Prestij ≥ 50 | 5M-50M ₺ tek seferlik, kabul/ret kararı |
| Ünlü Mezun Başarısı | Mezun sistemi tetikler | Prestij +5, büyük medya |
| Uluslararası Ödül | Araştırma Puanı ≥ 70 | Prestij +8, araştırmacı motivasyon ++ |
| Erasmus Genişleme | Uluslararasılaşma ≥ 40 | Yeni ortak üniversite, öğrenci değişimi |
| Endüstri Ortaklığı | Teknokent var | 3 yıllık araştırma sözleşmesi |
| Devlet Teşvik | Araştırma öncelikli alan | Ekstra fon, 2 dönem |
| Yıldız Araştırmacı İlgisi | Prestij ≥ 65 | Transfer pazarında elit hoca çıkar |

#### Negatif Olaylar

| Olay | Tetiklenme Koşulu | Etki |
|---|---|---|
| Deprem/Afet | Rastgele (%1/dönem) | Bina hasarı, acil onarım maliyeti |
| Hoca Skandalı | Motivasyon < 30 + Rastgele | Prestij -10, medya krizi, karar gerektirir |
| Öğrenci Protestosu | Memnuniyet < 40 | 1 dönem eğitim aksaması, medya |
| Bütçe Kesintisi | Hükümet değişimi (rastgele) | Devlet ödeneği -%20, 2 dönem |
| Rakip Transfer Bombası | AI agresif dönem | Birden fazla hoca aynı anda istifası riski |
| Akreditasyon Uyarısı | Koşullar bozulunca | 2 dönem düzeltme süresi |
| Siber Saldırı | Rastgele | Araştırma verisi kaybı, 1 dönem aksama |
| İnşaat Gecikmesi | Büyük proje varken | +1 dönem bekleme |

### 11.2 Karar Gerektiren Olaylar (Etik İkilemler)

Bu olaylarda oyuncuya seçenek sunulur. Her seçeneğin kazanımı ve maliyeti vardır.

**Örnek 1 — Siyasi Baskı:**
> Bir bakanlık bağlı fonu karşılığında müfredatınıza belirli bir içerik eklenmesini talep ediyor.
> - [A] Kabul et → +15M ₺ fon, Akademik Özgürlük puanı -10, bazı hocalar istifa eder
> - [B] Red et → Fon yok, Akademik Özgürlük +5, o bakanlıkla ilişki bozulur

**Örnek 2 — Büyüme vs. Kalite:**
> Devlet size ekstra kontenjan açmanızı öneriyor (+300 öğrenci), ancak altyapınız yetersiz.
> - [A] Kabul et → +Gelir, -Kalite puanı 2 dönem, altyapı baskısı
> - [B] Red et → İlişki soğukluk, ama kalite korunur

**Örnek 3 — İntihal Vakası:**
> Yıldız hocanızın yayınında intihal iddiası var. Soruşturma başlatılırsa kariyer biter.
> - [A] Soruştur → Akademik bütünlük +10, hoca gidebilir, prestij geçici düşüş
> - [B] Örtbas et → Kısa vadeli kurtarma, skandal riski %40 her dönem

---

## 12. Zorluk Eğrisi ve Kazanma/Kaybetme Koşulları

### 12.1 Oyun Modları

| Mod | Açıklama |
|---|---|
| Kariyer (Ana Mod) | 30 yıl (60 dönem) içinde hedeflere ulaş |
| Sandbox | Sonsuz oyun, hedef yok, istediğin gibi oyna |
| Senaryo | Özel başlangıç koşulları (mali kriz, yeni kurulan üniversite vb.) |

### 12.2 Kariyer Modu Hedefleri

```
Birincil Hedef (1 adet, oyun başında seçilir):
  - "Araştırma Üniversitesi": 20 yılda Araştırma_Puanı ≥ 85
  - "Öğrenci Cenneti": 15 yılda Öğrenci_Memnuniyeti ≥ 90 ve ≥ 5000 öğrenci
  - "Ulusal Şampiyon": 25 yılda Ulusal Sıralama 1. sıraya çık
  - "Küresel Oyuncu": 30 yılda Uluslararası Top 300

İkincil Hedefler (bonus, 3-5 adet):
  - 10 yılda 100 patent
  - 5 ünlü mezun yetiştir
  - Teknokent kur ve 10 firma barındır
  - 50 hocalı kadro kur
  - Borçsuz 10 dönem geçir
```

### 12.3 Zorluk Seviyeleri

| Seviye | Başlangıç Bütçesi | AI Verimliliği | Olay Sıklığı | Pazar Rekabeti |
|---|---|---|---|---|
| Kolay | 80M ₺ | %70 | Düşük | Az |
| Orta | 50M ₺ | %85 | Normal | Dengeli |
| Zor | 30M ₺ | %100 | Yüksek | Agresif |
| Gerçekçi | 20M ₺ | %110 (bonus) | Çok yüksek | Çok agresif |

### 12.4 Kaybetme Koşulları

Aşağıdakilerden biri gerçekleşirse oyun biter:

1. **İflas:** Borç -60M ve 2 dönem toparlanamaz
2. **Kapanma:** Öğrenci sayısı 3 dönem boyunca minimum kapasiteyin %40 altında
3. **Akreditasyon Kaybı + Mali Kriz:** İkisi aynı anda olursa zorunlu kapanma
4. **YÖK Kapatma:** Skandal + borç + akreditasyon → otomatik kapanma kararı

### 12.5 Zorluk Eğrisi (Dönem Başına Beklentiler)

```
Dönem 1-4 (İlk 2 Yıl — Kuruluş):
  Hedef: Bütçeyi pozitife çevir, 3-5 iyi hoca transfer et
  Risk: Maaş kütlesi büyüklüğünü aşan harcama

Dönem 5-10 (3-5. Yıl — İstikrar):
  Hedef: İlk TÜBİTAK projesi, lab aç, yurt kapasitesini artır
  Risk: Hoca mutsuzluk sarmalı, bina bakım ihmali

Dönem 11-20 (6-10. Yıl — Büyüme):
  Hedef: Sıralama top 5'e gir, teknokent planı
  Risk: Agresif AI transferleri, kapasite darboğazı

Dönem 21-40 (11-20. Yıl — Olgunluk):
  Hedef: Uluslararası görünürlük, ünlü mezun
  Risk: Eski binaların kalitesi düşer, bakım maliyeti artar

Dönem 41-60 (21-30. Yıl — Zirve):
  Hedef: Birincil hedefe ulaş
  Risk: Kurumsallaşma — büyük kadro yönetimi karmaşıklaşır
```

---

## 13. UI/UX Tasarımı

### 13.1 Ana Ekran Düzeni

```
┌─────────────────────────────────────────────────────┐
│  ŞEHİR ÜNİVERSİTESİ   [Güz 2024]  [Dönem Geç ▶]    │
│  Prestij: ██████░░░░ 58/100   Sıra: #4              │
├─────────┬───────────────────────────────────────────┤
│ SEKMELER│  ANA PANEL                                 │
│         │                                            │
│ Genel   │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│ Bütçe   │  │ Bütçe    │ │ Kadro    │ │Öğrenciler│  │
│ Kadro   │  │ +2.4M ₺  │ │ 42 Hoca  │ │ 1.850    │  │
│ Öğrenci │  │ Rezerv:  │ │ Mutl: 72 │ │ Memn: 68 │  │
│ Kampüs  │  │ 12.3M ₺  │ │          │ │          │  │
│ Araştır │  └──────────┘ └──────────┘ └──────────┘  │
│ Sıralama│                                            │
│ Olaylar │  SON OLAYLAR                               │
│         │  ⚠ Prof. Yılmaz'a rakip teklif geldi      │
│         │  ✓ TÜBİTAK projesi onaylandı (+3.2M ₺)   │
│         │  ℹ Yurt doluluk oranı %95'i aştı          │
│         │                                            │
│ [Ayarlar│  [DÖNEM GEÇMEDEN ÖNCE 3 KRİTİK KARAR]    │
│  Kayıt] │  > Hoca teklifine yanıt ver               │
└─────────┴───────────────────────────────────────────┘
```

### 13.2 Sekme İçerikleri

#### Bütçe Sekmesi

- Gelir/gider pasta grafiği (SVG)
- Dönem özeti tablosu
- Kaynak tahsis sliderları (her kategoriye % tahsis)
- Gelecek dönem tahmin kartı
- Borçlanma butonu (onay gerektirir)

#### Kadro Sekmesi

- Hoca listesi (filtrelenebilir: unvan, alan, mutluluk)
- Her hoca için mini kart: isim, unvan, stat barları, mutluluk ikonsu
- "Transfer Pazarı" alt sekmesi: Scout, Teklif Gönder, Gelen Teklifler
- "İş Yükü Yönetimi": ders dağıtımı

#### Öğrenci Sekmesi

- Öğrenci sayısı ve kapasite göstergesi
- Tip dağılımı pasta grafiği
- Memnuniyet bileşen breakdown
- GPA dağılımı histogram
- Mezun takibi (son 10 mezun listesi)

#### Kampüs Sekmesi

- Arazi ızgara görünümü (emoji/ikon tabanlı, CSS Grid)
- Her hücreye tıklayınca bina detayı
- "İnşaat Başlat" paneli
- Bakım durumu uyarıları

#### Araştırma Sekmesi

- Aktif projeler listesi (ilerleme barları)
- Yayın istatistikleri (dönem/toplam)
- Patent portföyü
- "Yeni Proje Başvurusu" akışı
- Alan bazlı araştırma kapasitesi

#### Sıralama Sekmesi

- Ulusal sıralama tablosu (10 üniversite)
- Prestij bileşen çubuğu (5 bileşen)
- Tarihsel prestij grafiği (SVG çizgi grafik)
- Akreditasyon durumu (fakülte bazlı)

#### Olaylar Sekmesi

- Güncel dönem olayları listesi
- Bekleyen kararlar (karar gerektiren olaylar kırmızı köşeyle vurgulanır)
- Geçmiş olaylar arşivi

### 13.3 Dönem Geçiş Ekranı

Modal dialog olarak açılır. Kart slayt formatında:

```
Kart 1: "Dönem Özeti — Güz 2024"
  Mali: +2.4M ₺ net, Rezerv: 12.3M ₺

Kart 2: "Kadro Haberleri"
  Prof. Kaya doçentlik aldı! / ArGö Demir istifa etti.

Kart 3: "Araştırma Çıktıları"
  3 Q1 makale, 1 patent başvurusu

Kart 4: "Öğrenci Gelişmeleri"
  Mezuniyet: 187 öğrenci / Memnuniyet: 72 (▲3)

Kart 5: "Sıralama"
  Ulusal Sıra: #4 → #3 ▲1

[◀ Geri] [İleri ▶] [Bahar 2025'e Geç →]
```

### 13.4 Bildirim Sistemi

```
Kritik (kırmızı, modal): Hoca istifası, borç uyarısı, akreditasyon kaybı
Önemli (turuncu, toast): Proje onayı, transfer teklifi, rakip hamlesi
Bilgi (mavi, küçük): Mezun başarısı, bina tamamlama, dönem istatistikleri

Her bildirim log'a kaydedilir, Olaylar sekmesinden görülebilir.
```

### 13.5 Renk Paleti ve Stil

```css
/* Ana Renkler */
--primary: #1a3a5c;        /* Koyu lacivert — akademik ciddiyet */
--primary-light: #2d6a9f;  /* Açık mavi — interaktif elementler */
--accent: #c8960c;         /* Altın/amber — başarı, prestij */
--success: #2d7a4f;        /* Koyu yeşil — pozitif göstergeler */
--warning: #b85c00;        /* Turuncu — uyarılar */
--danger: #8b1a1a;         /* Koyu kırmızı — kritik durumlar */
--bg-main: #f4f1eb;        /* Krem/bej — kağıt hissi */
--bg-card: #ffffff;        /* Beyaz kartlar */
--text-main: #1e1e2e;      /* Neredeyse siyah metin */
--border: #d4cfc4;         /* Yumuşak sınır rengi */

/* Font */
font-family: 'Georgia', serif;  /* Başlıklar — akademik */
font-family: 'Verdana', sans-serif; /* İçerik — okunabilir */
```

---

## 13b. Çok Oyunculu (Multiplayer) Sistem

### Üç Multiplayer Modeli

Oyun üç farklı çok oyunculu deneyim sunar. Teknik zorlukları farklıdır.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    MULTIPLAYER MODEL KARŞILAŞTIRMASI                     │
├────────────────┬───────────────────┬─────────────────┬──────────────────┤
│                │ A: Liderlik       │ B: Asenkron      │ C: Canlı        │
│                │ Tablosu           │ Ortak Dünya      │ Rekabetçi       │
├────────────────┼───────────────────┼─────────────────┼──────────────────┤
│ Nasıl çalışır  │ Herkes kendi      │ Aynı dünyada     │ 2-6 oyuncu aynı │
│                │ oyununu oynar,    │ ama farklı       │ anda aynı       │
│                │ sonuçlar          │ zamanlarda.      │ dünyada, tur    │
│                │ karşılaştırılır   │ Kararlar birbirine│ bazlı eşzamanlı│
│                │                   │ yansır           │                  │
├────────────────┼───────────────────┼─────────────────┼──────────────────┤
│ Etkileşim      │ YOK (solo + skor)│ DOLAYLI          │ DOĞRUDAN         │
├────────────────┼───────────────────┼─────────────────┼──────────────────┤
│ Teknik zorluk  │ ★☆☆☆☆           │ ★★★☆☆          │ ★★★★★           │
├────────────────┼───────────────────┼─────────────────┼──────────────────┤
│ Eğlence        │ ★★☆☆☆           │ ★★★★☆          │ ★★★★★           │
├────────────────┼───────────────────┼─────────────────┼──────────────────┤
│ Altyapı        │ Basit API        │ Veritabanı +     │ WebSocket +      │
│                │                   │ REST API         │ Sunucu mantığı   │
├────────────────┼───────────────────┼─────────────────┼──────────────────┤
│ Geliştirme     │ v0.2'de eklenebilir│ v0.3'te        │ v1.0+ (ileri)    │
│ aşaması        │                   │                  │                  │
└────────────────┴───────────────────┴─────────────────┴──────────────────┘
```

### Model A: Liderlik Tablosu (En Basit — İlk Aşama)

```
Nasıl çalışır:
  1. Herkes kendi tek oyunculu oyununu oynar (AI rakiplerle)
  2. Dönem sonunda üniversite metrikleri sunucuya gönderilir
  3. Global liderlik tablosu oluşturulur

Sıralama Kategorileri:
  - Genel Prestij Puanı (20. yıl sonunda)
  - Araştırma Sıralaması
  - Öğrenci Memnuniyeti
  - Mali Sürdürülebilirlik (hiç borçlanmadan en yüksek prestij)
  - En Hızlı Büyüme (10 yılda en çok prestij artışı)
  - Sporcu Başarısı (ABD modu)
  - "Iron Man": En zor ayarlarla en yüksek puan

Haftalık/Aylık Yarışmalar:
  "Bu hafta: 20 yılda en yüksek araştırma puanına ulaşın"
  "Bu ay: Vakıf üniversitesiyle iflas etmeden prestij 80'e çıkın"
  Sabit seed (aynı rastgele olaylar) → adil yarışma

Teknik Gereksinim:
  - Basit REST API (Node.js / Cloudflare Workers)
  - Veritabanı: Skor tablosu (oyuncu_id, metrikler, tarih)
  - Anti-cheat: Oyun state hash doğrulama (basit)
  - İstemci tarafında oyun çalışır, sadece sonuçlar gönderilir
```

### Model B: Asenkron Ortak Dünya (Orta Zorluk — En İyi Oran)

```
Nasıl çalışır:
  1. 10-20 oyuncu aynı "dünyaya" katılır
  2. Her oyuncu kendi üniversitesini yönetir
  3. AI rakipler YOKTUR — rakipler gerçek oyuncular
  4. Herkes kendi hızında oynar (tur bazlı, eşzamanlı değil)
  5. Her tur sonunda kararlar sunucuya gider
  6. Sunucu tüm oyuncuların turlarını toplar ve dünyayı günceller

Bu modelin büyüsü: Aynı havuzdan yarışıyorsun.
  - Transfer pazarındaki hocalar ORTAK → sen alırsan ben alamam
  - Öğrenci havuzu ORTAK → senin prestijin artarsa benim öğrencim azalır
  - Sıralama GERÇEK → yanındaki üniversite bir insanın yönettiği üniversite

Etkileşim Türleri:

  Rekabet (dolaylı):
    - Aynı hocaya teklif: Kim daha iyi paket sunarsa alır
    - Öğrenci çekme: Prestij + ücret + burs yarışı
    - Sıralama: Gerçek oyuncularla sıralama mücadelesi
    - Trend yarışı: Herkes BM açarsa piyasa doyar → stratejik fark

  İşbirliği (opsiyonel):
    - Ortak araştırma projesi: İki üniversite birlikte başvuru
      → Proje bütçesi büyür, başarı şansı artar
      → Yayın paylaşılır (her iki üniversiteye puan)
    - Öğrenci değişimi (Erasmus benzeri):
      → Her iki taraf öğrenci memnuniyeti + uluslararasılaşma bonusu
    - Hoca takas anlaşması:
      → Geçici (1 dönem) hoca değişimi
      → Her iki tarafın zayıf alanını güçlendirir

  Saldırgan Eylemler:
    - Rakibin yıldız hocasına transfer teklifi → açık savaş
    - Rakibin burs politikasını altına girerek öğrenci çalma
    - Aynı alanda bölüm açarak rakibi zayıflatma

Asenkron Tur Yönetimi:
  - Her oyuncuya "tur süresi" verilir: max 24 saat
  - Turunu bitiren "hazır" işaretler
  - Tüm oyuncular hazır olunca (veya süre dolunca) dünya güncellenir
  - AFK oyuncuların üniversitesi AI tarafından "otopilot" yönetilir
  - Oyuncu geri dönünce kontrolü devralır

  Hızlı Mod: Tur süresi 5 dakika (canlı gibi ama asenkron)
  Normal Mod: Tur süresi 24 saat (gün başı günde 1 tur)
  Yavaş Mod: Tur süresi 48 saat (rahat oynama)

Dünya Başlatma:
  "Oda" oluşturulur, ayarlar belirlenir:
    - Oyuncu sayısı: 4-20
    - Ülke: Türkiye / ABD / Karışık
    - Zorluk: Kolay / Normal / Zor
    - Oyun süresi: 20 / 50 / 100 yıl (tur sayısı)
    - Tur hızı: Hızlı (5dk) / Normal (24sa) / Yavaş (48sa)
    - Başlangıç eşitliği: Herkes aynı / Rastgele farklı / Draft

Draft Sistemi (opsiyonel):
  Oyun başında oyuncular sırayla şehir + başlangıç hocası seçer.
  İlk seçen avantajlı ama son seçen telafi bonusu alır (yılan draft).

Teknik Gereksinim:
  - Node.js sunucu + WebSocket (bildirimler için)
  - PostgreSQL veritabanı (dünya state'i)
  - REST API (tur gönderme, dünya okuma)
  - Oda yönetimi (oluştur, katıl, ayarla)
  - AI otopilot (AFK oyuncular için)
```

### Model C: Canlı Rekabetçi (İleri — Uzun Vadeli Hedef)

```
Nasıl çalışır:
  2-6 oyuncu aynı anda aynı dünyada, eşzamanlı tur bazlı.
  Her tur için herkes aynı anda kararlarını verir (zamanlayıcı ile).
  Kararlar "reveal" ile açılır → piyasa güncellenir → sonraki tur.

  Poker turnuvası gibi: Aynı masada, aynı anda, stratejik kararlar.

Tur Akışı:
  1. KARAR FAZI (3-5 dakika):
     Tüm oyuncular aynı anda kararlarını girer
     (transfer teklifi, ücret ayarı, bina kararı vb.)
     Kimse diğerinin ne yaptığını görmez

  2. ÇÖZÜMLEME FAZI (30 saniye, otomatik):
     Tüm kararlar aynı anda uygulanır
     Transfer çakışması: En iyi teklif kazanır (açık artırma)
     Öğrenci dağılımı: Prestij + ücret + burs → paylaştırılır
     Olaylar tetiklenir

  3. SONUÇ FAZI (1 dakika):
     Herkes sonuçları görür
     "Bu dönem neler oldu" özeti
     Sıralama güncellenir, diplomatik mesajlar gönderilebilir

  4. SONRAKİ TUR → 1'e dön

Diplomasi Sistemi:
  - Oyuncular birbirine mesaj gönderebilir
  - Anlaşma teklif edebilir (ortak araştırma, öğrenci değişimi)
  - İttifak kurulabilir (2-3 üniversite birlikte)
  - İttifak bozulabilir (ihanet! → güven puanı düşer)
  - "Savaş ilanı": Hoca avlama + fiyat kırma agresif strateji

Gözlemci Modu:
  Diğer oyuncuların bazı bilgileri görülür (gerçek sıralama gibi)
  ama bütçe detayları, transfer teklifleri gizlidir.
  Scout kullanarak rakip hakkında bilgi edinebilirsin.

Teknik Gereksinim:
  - WebSocket sunucu (gerçek zamanlı)
  - Tur zamanlayıcı (server-side)
  - Çakışma çözümleme motoru (transfer, öğrenci)
  - Lobby/matchmaking sistemi
  - Replay sistemi (oyun sonrası izleme)
```

### Multiplayer Ekonomik Dengeler

```
Çok oyunculu modda ekonomi değişir çünkü kaynaklar GERÇEKTEN kıt:

Hoca Pazarı:
  Tek oyunculu: Sınırsız hoca havuzu (ama kaliteli olan nadir)
  Çok oyunculu: Hoca havuzu PAYLAŞILIR
    → 5 oyuncu varsa aynı yıldız hocaya 5 kişi teklif verebilir
    → Fiyatlar şişer → maaş enflasyonu
    → "Gentlemen's agreement" yapılabilir (maaşları baskılama)
    → Veya bozulabilir (birisi kırar → herkes kırar)

Öğrenci Havuzu:
  Her ülke/bölgede toplam öğrenci sayısı SABİT.
  Bir oyuncu çok öğrenci çekerse diğerleri bulamaz.
  Fiyat kırma savaşı riski (race to bottom)
  AMA çok ucuz = kalite düşer → uzun vadede kaybedersin

Araştırma Fonları:
  TÜBİTAK / NSF bütçesi sınırlı → herkes başvuruyor, az kişi kazanıyor
  Çok oyunculu: Kabul oranı düşer (daha çok başvuru)
  İşbirliği avantajı: Ortak proje daha kolay kazanır

Trend Dalgalanmaları:
  Herkes aynı trend'e yönelirse: Doyma daha hızlı olur
  "Herkes BM açtı" → piyasa 3 yıl erken doyar
  Stratejik farklılaşma ZORUNLU hale gelir
```

### Sosyal Özellikler

```
Profil ve İstatistikler:
  Her oyuncunun bir profili var:
    - Toplam oynanan oyun sayısı
    - En yüksek prestij puanı (tüm zamanlar)
    - Kazanılan yarışma sayısı
    - Favori strateji (araştırma odaklı, spor odaklı vb.)
    - Başarımlar (achievement)
    - ELO benzeri sıralama puanı (çok oyunculu için)

Başarımlar (Achievements):
  "İlk 100": Prestij 100'e ulaş
  "Hoca Avcısı": Aynı dönem 3 yıldız hoca transfer et
  "Burslu Ordu": %50+ öğrenciye burs ver ve prestij 80'e ulaş
  "David vs Goliath": En düşük bütçeyle çok oyunculu oyun kazan
  "Nobel Fabrikası": 3 ünlü mezun yetiştir
  "March Madness": NCAA turnuvasını kazan (ABD modu)
  "İflastan Dönüş": -50M borçtan toparlanıp pozitife geç
  "Akademik Akraba Yok": İnbreeding oranı %10 altında tut, 20 yıl

Arkadaş Listesi / Davet:
  - Link ile oda daveti (kayıt gerektirmeden)
  - Arkadaş listesi (kayıtlı kullanıcılar)
  - "Rövanş" butonu (aynı ayarlarla yeni oyun)

Seyirci Modu:
  Devam eden oyunları izleyebilirsin (gecikmeli, 1 tur arkadan)
  Canlı yayın desteği: OBS entegrasyonu için özel "seyirci görünümü"
```

### Çok Oyunculu Teknik Mimari

```
Model A (Liderlik Tablosu):
  İstemci: Mevcut tek oyunculu oyun + skor gönderme
  Sunucu: Cloudflare Workers (sunucusuz, ucuz)
  Veri: KV Store veya D1 SQLite
  Maliyet: Neredeyse sıfır (sunucusuz)

Model B (Asenkron):
  İstemci: Mevcut oyun + çok oyunculu UI eklentisi
  Sunucu: Node.js + Express
  Veri: PostgreSQL (dünya state) + Redis (bildirimler)
  İletişim: REST API + WebSocket (bildirim push)
  Maliyet: Düşük-orta (VPS veya Railway/Fly.io)

Model C (Canlı):
  İstemci: Yeniden tasarlanmış UI (zamanlayıcı, canlı göstergeler)
  Sunucu: Node.js + Socket.IO
  Veri: PostgreSQL + Redis
  İletişim: WebSocket (tüm iletişim gerçek zamanlı)
  Ek: Tur zamanlayıcı, çakışma çözücü, matchmaking
  Maliyet: Orta-yüksek (aktif sunucu gerekli)
```

### Geliştirme Yol Haritası (Multiplayer)

```
v0.2: Model A — Liderlik Tablosu
  - Oyun bitişinde skor gönderme
  - Global/haftalık liderlik tablosu
  - Basit profil sistemi
  - Teknik: Cloudflare Workers + KV

v0.3: Model B — Asenkron Ortak Dünya
  - Oda oluşturma/katılma
  - Ortak hoca/öğrenci pazarı
  - Tur süresi yönetimi
  - AI otopilot (AFK)
  - Basit diplomasi (mesaj + anlaşma)
  - Teknik: Node.js sunucu, PostgreSQL

v0.4: Kart Takas Pazarı
  - Oyuncular yetiştirdikleri hoca/öğrenci kartlarını takas edebilir
  - Satış: Oyun içi para veya "prestij puanı" ile alım/satım
  - Değiş tokuş: Hoca↔Hoca, Yıldız Öğrenci↔Yıldız Öğrenci
  - Kart değeri: Stat'lara + potansiyele + nadirlığe göre dinamik fiyat
  - "Transfer Pazarı" modeli: Açık artırma veya sabit fiyat
  - Kart koleksiyonu: Yetiştirdiğin tüm kartlar galerinde kalır
  - Nadir kartlar: 5★ hoca / Polymath öğrenci → koleksiyon değeri

v1.0+: Model C — Canlı Rekabetçi
  - Eşzamanlı tur sistemi
  - Gelişmiş diplomasi
  - Matchmaking / ELO
  - Seyirci modu
  - Turnuva sistemi
```

**ÖNCELİK NOTU**: Çok oyunculu özellikler v0.2+ için planlanmıştır.
v0.1 MVP tamamen tek oyunculu, tarayıcıda çalışan, LocalStorage ile
kayıt eden bir oyun olacaktır. Çekirdek oyun mekaniği sağlam çalışmadan
çok oyuncuya geçilmeyecektir.

---

## 14. Teknik Mimari

### 14.1 Teknoloji Kararları

- **Vanilla HTML + CSS + JavaScript** — hiçbir framework yok (tek oyunculu)
- **Tek HTML dosyası** giriş noktası, modüler JS dosyaları `<script type="module">` ile yüklenir
- **LocalStorage** ile kayıt/yükleme (tek oyunculu, birden fazla kayıt slotu)
- **ES6 Modules** — `import/export` ile modüler yapı
- **SVG** — grafikler için (pasta, çizgi grafik)
- **CSS Grid + Flexbox** — responsive layout
- **Çok oyunculu eklenti**: Node.js sunucu + WebSocket (v0.2+)

### 14.2 Dosya Yapısı

```
university-tycoon/
├── index.html              # Tek giriş noktası
├── style.css               # Global stiller
├── js/
│   ├── main.js             # Uygulama başlatıcı, init
│   ├── game.js             # Ana oyun döngüsü, tur yönetimi
│   ├── economy.js          # Gelir/gider hesaplamaları
│   ├── faculty.js          # Hoca sistemi, transfer pazarı
│   ├── students.js         # Öğrenci sistemi, alım, GPA
│   ├── campus.js           # Bina yönetimi, arazi
│   ├── research.js         # Araştırma, yayın, patent
│   ├── ranking.js          # Prestij ve sıralama hesabı
│   ├── events.js           # Rastgele olay motoru
│   ├── ai.js               # Rakip üniversite AI
│   ├── ui.js               # DOM güncelleme, render fonksiyonları
│   ├── data.js             # Sabit veriler, şablonlar, başlangıç değerleri
│   └── save.js             # LocalStorage kayıt/yükleme
├── css/
│   ├── components.css      # Kart, buton, modal stilleri
│   ├── panels.css          # Sekme paneli stilleri
│   └── animations.css      # Geçiş animasyonları
└── assets/
    ├── icons/              # SVG ikonlar
    └── sounds/             # Opsiyonel ses efektleri
```

### 14.3 Modül Sorumlulukları

```javascript
// game.js — Ana döngü
export function nextTurn()           // Tur geçişini yönetir
export function runTurnSimulation()  // Tüm modülleri sırayla çalıştırır
export function checkWinLose()       // Kazanma/kaybetme kontrolü

// economy.js
export function calculateIncome(state)   // Toplam geliri hesapla
export function calculateExpenses(state) // Toplam gideri hesapla
export function applyBudget(state)       // Bütçeyi state'e uygula

// faculty.js
export function generateTransferMarket() // Dönem pazarını üret
export function makeOffer(facultyId, offer) // Teklif mekanizması
export function updateSatisfaction(state)   // Mutluluk güncelle
export function processPromotion(facultyId) // Doçentlik/profesörlük

// ranking.js
export function calculatePrestige(state)   // 5 bileşenli prestij
export function updateRankings(state)      // Ulusal sıralama güncelle
```

### 14.4 State Yönetimi

```javascript
// Tek merkezi state objesi
const GameState = {
  meta: { turn, year, semester, difficulty, playerName },
  university: { name, budget, debt, prestige, ranking },
  faculty: [ ...FacultyEntity ],
  students: { total, capacity, satisfaction, byType },
  alumni: [ ...AlumnusEntity ],
  buildings: [ ...BuildingEntity ],
  research: { activeProjects, publications, patents },
  rivals: [ ...RivalUniversity ],
  events: { current, history },
  stats: { /* historical data for charts */ }
}
```

### 14.5 LocalStorage Kayıt

```javascript
// Kayıt formatı
{
  version: "0.1",
  timestamp: Date.now(),
  slotName: "Kayıt 1",
  state: GameState  // JSON.stringify ile serileştirilmiş
}

// 3 kayıt slotu: "save_slot_1", "save_slot_2", "save_slot_3"
// Otomatik kayıt: "save_auto" (her dönem sonu)
```

---

## 15. Veri Yapıları

### 15.1 FacultyEntity (Hoca)

```json
{
  "id": "fac_001",
  "name": "Prof. Dr. Ayşe Kaya",
  "title": "professor",
  "field": "computer_science",
  "age": 45,
  "stats": {
    "research": 82,
    "teaching": 74,
    "popularity": 68,
    "loyalty": 71,
    "motivation": 85,
    "potential": 88
  },
  "salary": 220000,
  "contract": {
    "startTurn": 3,
    "endTurn": 15,
    "researchFund": 500000
  },
  "satisfaction": 76,
  "publications": {
    "q1": 12, "q2": 8, "q3": 4, "q4": 2,
    "totalCitations": 340
  },
  "activeProjects": ["proj_003", "proj_007"],
  "careerHistory": [
    { "turn": 1, "event": "hired", "university": "player" }
  ],
  "promotionEligible": false,
  "promotionTurn": 18
}
```

### 15.2 StudentBatch (Öğrenci Kohortu)

```json
{
  "id": "cohort_2024_fall",
  "enrollTurn": 4,
  "count": 320,
  "capacity": 320,
  "distribution": {
    "academic": 0.14,
    "entrepreneur": 0.22,
    "social_leader": 0.16,
    "athlete": 0.09,
    "artist": 0.11,
    "average": 0.28
  },
  "avgScore": 72.4,
  "avgGpa": 0.0,
  "satisfaction": 0.0,
  "expectedGradTurn": 12,
  "status": "enrolled"
}
```

### 15.3 AlumnusRecord (Mezun)

```json
{
  "id": "alum_2018_001",
  "cohortId": "cohort_2018_fall",
  "type": "entrepreneur",
  "graduationTurn": 12,
  "gpa": 3.1,
  "careerLevel": 3,
  "sector": "technology",
  "donationPotential": 45000,
  "isNotable": false,
  "startupId": "startup_015",
  "returnedToAcademia": false
}
```

### 15.4 BuildingEntity (Bina)

```json
{
  "id": "bld_003",
  "type": "faculty_large",
  "name": "Mühendislik Fakültesi A Blok",
  "capacity": 700,
  "qualityStars": 4,
  "constructionTurn": 2,
  "completionTurn": 5,
  "status": "active",
  "maintenanceCost": 1200000,
  "lastMaintenanceTurn": 8,
  "gridPosition": { "x": 2, "y": 3 }
}
```

### 15.5 ResearchProject (Araştırma Projesi)

```json
{
  "id": "proj_003",
  "type": "tubitak_1001",
  "title": "Derin Öğrenme ile Tıbbi Görüntü Analizi",
  "leadFacultyId": "fac_001",
  "field": "computer_science",
  "budget": 1800000,
  "startTurn": 5,
  "endTurn": 9,
  "progress": 60,
  "overheadIncome": 360000,
  "status": "active",
  "publications": ["pub_012"],
  "patents": []
}
```

### 15.6 RivalUniversity (Rakip)

```json
{
  "id": "rival_001",
  "name": "Teknik Üniversite",
  "strategy": "research_heavy",
  "prestige": 68,
  "ranking": 2,
  "budget": 85000000,
  "facultyCount": 62,
  "studentCount": 4200,
  "stats": {
    "researchScore": 75,
    "teachingQuality": 58,
    "studentSatisfaction": 61,
    "internationalization": 45,
    "alumniSuccess": 64
  },
  "aggressionLevel": 0.6,
  "targetFields": ["engineering", "physics"]
}
```

### 15.7 GameEvent (Olay)

```json
{
  "id": "evt_turn8_001",
  "turn": 8,
  "type": "negative",
  "category": "faculty",
  "title": "Hoca Transfer Teklifi",
  "description": "Prof. Dr. Kaya'ya Teknik Üniversite'den teklif geldi.",
  "requiresDecision": true,
  "options": [
    {
      "label": "Karşı Teklif Yap",
      "cost": 500000,
      "effects": { "faculty_fac_001_salary": 30000, "budget": -500000 }
    },
    {
      "label": "Serbest Bırak",
      "cost": 0,
      "effects": { "faculty_remove": "fac_001", "prestige": -2 }
    }
  ],
  "deadline": 9,
  "resolved": false,
  "resolution": null
}
```

---

## 16. Geliştirme Yol Haritası

### v0.1 — MVP (Minimum Viable Product)

**Hedef:** Oynanabilir çekirdek döngü.

- [ ] HTML/CSS temel şablonu, sekme navigasyonu
- [ ] GameState yapısı ve başlangıç verisi (data.js)
- [ ] Dönem geçiş sistemi (game.js) — Güz/Bahar döngüsü
- [ ] Temel ekonomi: gelir/gider hesaplama, bütçe güncelleme (economy.js)
- [ ] Hoca sistemi: liste görünümü, basit transfer teklifi, maaş pazarlığı (faculty.js)
- [ ] Öğrenci alımı: Güz döneminde kontenjan belirleme, basit simülasyon (students.js)
- [ ] Dönem sonu raporu (modal kart)
- [ ] LocalStorage kayıt/yükleme (save.js)
- [ ] 3 rakip üniversite (statik, AI yok)

**Başarı Kriteri:** 10 dönem oynanabilir, çökmez, bütçe döngüsü çalışır.

---

### v0.2 — Kampüs ve Araştırma

**Hedef:** Fiziksel büyüme ve araştırma etkisi.

- [ ] Kampüs ızgara görünümü (CSS Grid, emoji ikonlu binalar)
- [ ] Bina inşaatı: seçim, maliyet, tamamlanma bekleme
- [ ] Bina kalite (yıldız) sistemi ve bozulma
- [ ] Araştırma projesi başvurusu ve simülasyonu (research.js)
- [ ] Yayın üretimi (Q1-Q4 dağılımı)
- [ ] Prestij hesaplama (5 bileşen) ve sıralama tablosu (ranking.js)
- [ ] Rastgele olaylar motoru — 10 temel olay (events.js)
- [ ] Karar gerektiren 3 etik ikilem

**Başarı Kriteri:** 30 dönem oynanabilir, kampüs büyüme hissedilir.

---

### v0.3 — Mezun Sistemi ve Rakip AI

**Hedef:** Uzun vadeli döngüler ve rekabet.

- [ ] Mezun takip sistemi: kariyer simülasyonu, bağış akışı
- [ ] Startup ve ünlü mezun tetikleyicisi
- [ ] Mezun ağı gücü hesabı → öğrenci tercih etkisi
- [ ] Rakip AI motoru: bütçe tahsisi, transfer aktivitesi (ai.js)
- [ ] 5 rakip üniversite tam profili
- [ ] Akreditasyon sistemi
- [ ] Uluslararasılaşma bileşeni
- [ ] Patent gelir akışı
- [ ] Hoca kariyer ilerlemesi: doçentlik/profesörlük simülasyonu

**Başarı Kriteri:** 60 dönem oynanabilir, farklı stratejiler deneniyor.

---

### v0.4 — Cila ve Denge

**Hedef:** Oyun keyfi ve denge.

- [ ] Zorluk eğrisi testi ve sayısal denge
- [ ] UI animasyonları (kart geçişleri, loading)
- [ ] Grafik ve chart iyileştirmeleri (SVG)
- [ ] Tooltip sistemi (tüm stat'lar için açıklama)
- [ ] Gelişmiş bildirim sistemi
- [ ] Opsiyonel ses efektleri (Web Audio API)
- [ ] Mobil responsive iyileştirme
- [ ] Performans optimizasyonu (büyük state yönetimi)
- [ ] Erişilebilirlik (ARIA etiketleri)

**Başarı Kriteri:** Harici test oyuncuları pozitif geri bildirim verir.

---

### v1.0 — Tam Oyun

**Hedef:** Yayın kalitesi.

- [ ] Tüm 5 rakip tam AI profili ile
- [ ] Senaryo modu (3 senaryo)
- [ ] Sandbox modu
- [ ] Başarım sistemi (achievement) — LocalStorage bazlı
- [ ] Oyun içi yardım (?) butonu ile bağlamsal açıklamalar
- [ ] Çoklu dil desteği altyapısı (TR/EN)
- [ ] Hata yönetimi ve edge case kapsamı
- [ ] Oyun sonu ekranı (kazanma/kaybetme sinematik metni)

---

## Ek: Denge Özeti Tablosu

| Parametre | Düşük | Orta | Yüksek |
|---|---|---|---|
| Başlangıç bütçesi | 30M ₺ | 50M ₺ | 80M ₺ |
| Hoca sayısı (başlangıç) | 25 | 45 | 65 |
| Öğrenci sayısı (başlangıç) | 800 | 1.200 | 2.000 |
| Prestij (başlangıç) | 20 | 35 | 50 |
| İflas eşiği | -60M ₺ | -60M ₺ | -60M ₺ |
| Hedef prestij (10. yıl) | 45 | 55 | 65 |
| Hedef prestij (20. yıl) | 65 | 75 | 80 |

---

*Bu belge yaşayan bir dokümandır. Her major geliştirme versiyonunda güncellenmelidir.*
