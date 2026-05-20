# Rektör Oldum — Üniversite Yönetim Oyunu

- GitHub: https://github.com/prof-oguzergin/rektor-oldum (private)
- Yayında: https://prof-oguzergin.github.io/rektor-oldum/
- Durum: v0.4.54 — aktif geliştirme, oyuncu rapor akışı (Erdinç, Emir, Burak, AkaDemi, Yusuf, Fatih)
- Dizin: C:\Users\Z GAMES\Yapay Zeka\university-tycoon

## Teknik
Web tabanlı simülasyon oyunu (HTML + CSS + JS, sunucu gerektirmez).
GDD.md: 4300+ satırlık tasarım belgesi. README.md: genel açıklama.

### Dosya Yapısı
- `js/game.js` — Ana oyun motoru, simülasyon, state yönetimi
- `js/ui.js` — Tüm UI render fonksiyonları (~6000 satır)
- `js/data.js` — Sabitler, bölüm/bina/maaş tanımları
- `js/economy.js` — Gelir/gider hesaplamaları
- `js/faculty.js` — Hoca üretimi, maaş baremi
- `js/students.js` — Öğrenci memnuniyeti, kontenjan
- `js/ranking.js` — Sıralama ve rakip üniversiteler
- `js/save.js` — Kayıt/yükleme (localStorage, 3 slot + otosave)
- `js/tutorial.js` — 11 adımlık interaktif rehber
- `js/alumni_events_achievements.js` — Mezun, olay, başarım sistemleri
- `js/clubs.js` — Öğrenci kulüpleri sistemi
- `js/tto.js` — Teknoloji Transfer Ofisi
- `js/audio.js` — Ses efektleri ve müzik
- `js/main.js` — Event handler'lar, UI bağlantıları

### Çalıştırma
`OYUNU-BASLAT.bat` çift tıkla → tarayıcıda `localhost:8080`

## Sürüm Geçmişi

Tam liste: `js/changelog.js` (oyun içi "Yenilikler" panelinde de gösterilir, başa eklenir).

- v0.1: Hata temizliği, oyun dengesi, zorluk seçimi, tutorial
- v0.2: Mezun sistemi, 16 rastgele olay, 25 başarım, idari birimler, proje sistemi
- v0.3: Senaryolar, akreditasyon UI, TTO, öğrenci kulüpleri, ses efektleri
- v0.4.x (3-4 May 2026, 22 sürüm — yoğun oyuncu rapor akışı):
  - v0.4.3-4.4: Mobil uyumluluk (kaydırma, alt gezinme, 44px dokunma), Co-op tipi fix, "Bahar undefined" başlık
  - v0.4.5-4.7: Skor hata iletisi, Firebase API key tipo, kredi amortizasyon + %5 erken kapatma cezası (exploit kapatıldı)
  - v0.4.8-4.9: Oyun içi "Yenilikler" modali (otomatik açılır), sürüm notları Türkçeleştirme
  - v0.4.10-4.13: Dönem geçiş takılması, erken oyun bitti eşiği (%40→%25, 3→6 dönem), hoca id çakışması, mükerrer skor + Firestore rules
  - v0.4.14: App Check (reCAPTCHA v3) — bot/betiklere karşı görünmez koruma
  - v0.4.16-4.18: Bütçe dağılımı aksiyon adı, "Bahar undefined" state migration + cache header, harç slider state
  - v0.4.19-4.21: Memnuniyet integer + spor beraberlik (R-Fatih), spor tesisi canHaveMultiple (AkaDemi), Yazılım Müh. tam veri + idari bina UI (Erdinç)
  - v0.4.22: AkaDemi MÜDEK + Emir idari memnuniyet 50 takılı kalma — bölüm yoksa overall'a fallback
  - v0.4.23: Akreditasyon erken yenileme — son 2 dönem kala renewal kabul (Erdinç)
  - v0.4.24: Ulaşım merkezi memnuniyet katkı, idari bina memnuniyet, araştırma merkezi "Bölüm Ata" → +%15 dış proje şansı (iki merkez +%30)
  - v0.4.25: İletişim bölümü tam veri (8 ders müfredatı + 7 uzmanlık alanı: Gazetecilik, Halkla İlişkiler, Reklam, Radyo-TV, Yeni Medya, İletişim Tasarımı, Medya Çalışmaları) — hoca alımında "ders örtüşmesi yok" uyarısı kapandı (Erdinç)
  - v0.4.26: Siyaset Bilimi bölümü tam veri (8 ders müfredatı + 7 uzmanlık: Siyaset Teorisi, Siyasi Düşünce, Karşılaştırmalı Siyaset, Türk Siyasal Hayatı, Uluslararası İlişkiler, Kamu Yönetimi, Siyaset Sosyolojisi) — Issue #5 (seyrekilyas09)
  - v0.4.27: Leaderboard'da kullanıcı başına yalnızca en iyi skor (R-Fatih önerisi). Doc id `uid_gameId` → `uid`. Yeni rules: create/update/delete + update koşulu `score > resource.data.score`. Migration: `scripts/migrate-leaderboard.js` (Node + firebase-admin, service-account.json gerektirir, .gitignore'da). 54 belge → 51 (3 duplicate silindi). Rules deploy: scripts/deploy-rules.js (REST API, geçici — sonra silindi).
  - v0.4.28: Oyun bitti/kazanıldı sonrası boş Dönem Özeti açılması düzeltildi (Emir raporu, console log ile teşhis). _onNextTurn handler en başta gameOver/gameWon kontrolü + nextTurn sonrası defensive katman. Bonus: main.js'deki save.js cache-bust sürümü 0.4.24'te kalmış, 0.4.28'e güncellendi.
  - v0.4.29: Sonradan açılan bölümlere öğrenci yerleşmiyor + fakülteler ekranında görünmüyor (R-Fatih Issue #10 + Emir raporu). 3 katman: (1) game.js YÖK onayında byDepartment[deptId] init + fakulteler.departments duplicate koruma; (2) students.js processNewEnrollment lazy init defansif; (3) game.js state migration'da her açık bölüm için byDepartment + fakulteler tutarlılığı.
  - v0.4.30: Kütüphane `canHaveMultiple: true` (Erdinç raporu). Spor tesisi (v0.4.20) pattern'ı.
  - v0.4.31: Mekatronik Müh., Mimarlık, Güzel Sanatlar bölümleri tam veri (her biri 8 ders + 7-8 uzmanlık). İletişim/Siyaset Bilimi pattern'ının aynısı (Erdinç raporu).
  - v0.4.32: Bina upgrade'de `isCompleted` false yapılıyordu → kapasite kaybı → "Yeni Alım İçin Yer: 0" → dönem başlatılamıyordu (Can GULDOGAN). Fix: upgrade boyunca isCompleted true kalır, ilerleme `status === 'upgrading'` ile takip edilir. State migration eski kayıtları da düzeltir.
  - v0.4.33: Mobilde modal açıkken body scroll kilitlenmiyor, arka plan kayıyordu (Lafontane6) — showModal/hideModal'da body.style.overflow toggle. Bonus: Yeni Bölüm Başvuru butonu zaten başvurulmuşsa "✅ Başvuruldu (X dönem)" disabled (Issue #6, R-Fatih).
  - v0.4.34 (5 May 2026): `updateRankings()` fonksiyonu yazılmış ama hiçbir yerden çağrılmıyordu — `state.university.ranking` başlangıç 50'den hiç değişmiyor, leaderboard'da herkes 50. sırada gözüküyordu. nextTurn akışında updateRivals'tan hemen sonra updateRankings(_state) çağrısı eklendi (kullanıcı raporu).
  - v0.4.46 (9 May 2026): İdari personel kişi-rütbe ayrımı — aday üretimi deneyim seviyesine (junior/mid/senior) göre; her adayın yanında rütbe dropdown'u; suggestedTitle + memnuniyet/sadakat etkisi; terfi bekleyenlere altın çerçeve + panel banner (EfekanSalman Issue #15).
  - v0.4.47 (9 May 2026): Deneyim seviyesi etiketleri tam Türkçe — "Junior aday/Mid-level aday/Senior aday" yerine "Giriş seviye aday/Orta düzey aday/Kıdemli aday". İç anahtarlar (junior/mid/senior) korundu, kayıtlı oyunlar etkilenmedi. Bu commit'te ayrıca cache-bust eksikliği düzeltildi (önceki sürüm bumpı yapılmamıştı, oyuncular eski etiketi görüyordu).
  - v0.4.48 (9 May 2026): Oyun sonu kararlılığı — Vakıf Kurtarma 40M borç loans[]'a dönüştürüldü (startingDebt migration + eski kayıt düzeltmesi); setState'te consecutiveLowStudentTurns/bankruptcyTurns sıfırlama; gameOver/gameWon sonrası "Sonraki Dönem" disabled + banner + menüye yönlendirme; enrollment_collapse mesajındaki %40 → %25 düzeltmesi (Issue #13, #16).
  - v0.4.49 (9 May 2026): Dönem ortası kayıt + BAP kalıcılığı — _persistState() yardımcısı eklendi, 20+ handler'da aksiyon bazlı autoSave; BAP çağrısı 3 dönem aktif kalıyor (expirationTurn), koşulsuz sıfırlama kaldırıldı; dış proje pendingProjectApplications state'ten okunuyor (Issue #14, meri-png).
  - v0.4.50 (9 May 2026): Müfredat zorluk kontrolü — her dersin zorluk seviyesi (1-5) Bölüm Ayrıntıları > Müfredat tablosunda slider ile ayarlanabilir; getCourseEffectiveDifficulty helper tüm başarısızlık/not/geçme hesaplamalarında etkin; eski kayıtlar curriculumOverrides:{} ile migrate edilir; trade-off info kutusu eklendi (R-Fatih Issue #8 Katman 1).
  - v0.4.51 (16 May 2026): Kazanma ekranı + kayıt koruma — gameWon'da senaryo bazlı özel mesajlı kutlama modal'ı (final skor kırılımı + leaderboard butonu); updateTopBar gameWon banner'ı yeşil/altın; setState'te gameOver/gameWon sıfırlanmıyor artık (state'ten okunuyor); yüklenen kayıtta gameWon true ise otomatik kazanma modal'ı açılıyor (Issue #19 BerkhanB, Issue #23 byalperr).
  - v0.4.54 (21 May 2026): iOS Safari mobil kullanılabilirlik paketi — viewport-fit=cover, 100dvh, safe-area-inset env() tüm fixed elementlere uygulandı, tutorial overlay sticky footer, input otomatik zoom engeli (enesduran Issue #24).
  - v0.4.53 (20 May 2026): Birim bazlı unvan havuzu - her idari birim için göreve özel 5 unvan tanımlandı (Ulaşım: Şoför/Kıdemli Şoför/Tamirci/Servis Sorumlusu/Ulaşım Müdürü vb.); ADMIN_UNITS.titles alanı; getUnitTitles/getUnitTitleSalary/isUnitManagerTitle helper'ları; eski kayıtlarda migration (Memur→birim unvanı); modal birim unvanlarını gösterir (EfekanSalman Issue #17).
  - v0.4.52 (16 May 2026): BAP bildirim spam + Olaylar UI — renderResearchPanel'de .proj-decision-btn delegate listener her UI yenilemesinde birikiyordu; panel._projDecisionDelegateAttached flag ile tek seferlik ekleme sağlandı (Issue #22). Bu Dönem Olaylar'da description'sız event'ler "Olay" placeholder gösteriyordu; validEvents filtresi + "Bu dönemde önemli bir olay yaşanmadı." boş durum mesajı (Issue #21). Her ikisi EfekanSalman raporu.

## Aktif Oyuncu Raporcuları
Erdinç (en yoğun), AkaDemi, Emir, Burak Gökalp, Yusuf Sertkaya, R-Fatih (Issue #7, #9), X, serhattural

## Bekleyen Raporlar
- Burak — kontenjan modal ilerlemiyor, console log bekleniyor (v0.4.32'de Can GULDOGAN raporu ile birlikte çözülmüş olabilir, doğrulama bekleniyor)
- App Check — 4 May 2026 gece doğrulandı: **Auth %100 verified, 0% Unverified (Monitoring)**, entegrasyon çalışıyor. Cloud Firestore hâlâ **Unenforced**. Sabah Firebase Console > App Check > Cloud Firestore satırına tıklayıp **Enforce** edilecek (gece yapılmadı çünkü eski cache'li client riski). Sonra birkaç oyuncudan skor gönderme doğrulaması al.

## Enhancement Backlog (Sonraki Büyük Sürüm — v0.5.0?)

Şu an stabilizasyon modunda; yeni özellikler eklenmiyor, biriktirilip ciddi bir sürümde topluca değerlendirilecek.

- **Sosyal/bilimsel etkinlik sistemi** (Erdinç, 4 May 2026) — okul içi etkinlik düzenleme: konferans, festival, kongre, atölye. Memnuniyet/saygınlık/finansal etki.
- **Ders Müfredatı + Öğretim Elemanı Manuel Ekleme** ([Issue #8](https://github.com/prof-oguzergin/rektor-oldum/issues/8), R-Fatih) — sandbox tarzı özelleştirme.

## Çözülmüş (sonraki cleanup'a kadar burada)
- Emir (özet ekranında tüm değerler 0) → v0.4.28'de gameOver/gameWon erken çıkış
- R-Fatih Issue #10 (sonradan açılan bölümlere öğrenci yerleşmiyor) → v0.4.29 byDepartment init
- Emir (3. mühendislik fakülteler ekranında listelenmiyor) → v0.4.29 fakulteler.departments duplicate koruma + state migration
- Erdinç (kütüphane tek tek inşa) → v0.4.30 canHaveMultiple: true
- Can GULDOGAN (mavi-check, fakülte binası upgrade sonrası "Yeni Alım İçin Yer: 0" + dönem başlatılamıyor) → v0.4.32 isCompleted upgrade boyunca true
- Lafontane6 (mobilde modal arka plan kayıyordu, oynanmıyordu) → v0.4.33 body scroll lock
- Issue #6 R-Fatih (Yeni Bölüm Başvuru butonu UX) → v0.4.33 "Başvuruldu" disabled buton

## Sonraki Adımlar
- Ek senaryo paketleri
- Mobil uyumluluk iyileştirmeleri (v0.4.3'te temel atıldı, derinleştirilecek)

## Terminoloji
- "Prestij" → "Saygınlık" kullanılıyor
- "Dashboard" → "Genel Bakış"
- "Kampüs" → "Yerleşke"
- Tüm arayüz Türkçe
