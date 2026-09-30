# Rektör Oldum — Üniversite Yönetim Oyunu

- GitHub: https://github.com/prof-oguzergin/rektor-oldum (private)
- Yayında: https://prof-oguzergin.github.io/rektor-oldum/
- Durum: v0.7.0 başkana devretme + yeni ekonomi + araştırma puanı (25 Eyl 2026, canlıda); aktif geliştirme, oyuncu rapor akışı (Erdinç, Emir, Burak, AkaDemi, Yusuf, Fatih)
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

### Skor tablosu, sezonlar ve geri bildirim (Firebase, v0.7.1)
- Proje `rektor-oldum` (Firestore + anonim Auth + App Check reCAPTCHA v3). Kurallar `firestore.rules`; Console > Firestore Database > Rules'a elle yapıştırılıp yayımlanır. Başsız Chromium'da App Check doğrulaması düşer (403), Firestore okuma/yazma çalışmaz; sınamalar hata yolunu ve arayüzü denetler.
- **Sezonlar:** v0.7.0 dengesi oyunu yavaşlattı, eski hızlı sürümlerin skorları aşılamıyordu. Yeni skorlar `scores_s2`'ye yazılır (belge kimliği anonim uid, `scores` ile aynı doğrulama, güncelleme yalnız daha yüksek skorla). En İyiler'de iki görünüm: "Sezon 2 (v0.7 ve sonrası)" varsayılan, `scores_s2` ile `scores`'un kesimden (2026-09-25T00:00:00Z, `leaderboard.js SEZON_KESIM_MS`, ui.js'te `_LB_SEZON_KESIM_MS` aynı) sonraki kayıtlarının birleşimi, aynı uid iki yerdeyse yüksek olan; "Eski sezon (v0.6 ve öncesi)" `scores`'un kesimden önceki kayıtları ("Eski sistem" notu ve "Eski TR" rozeti). Oyuncunun kendi satırı (bu cihazın anonim uid'i) iki görünümde de vurgulanır, ilk 50'nin dışındaysa altta sırasıyla gösterilir. Taşıma yok; `scores` bloğu önbellekteki eski istemciler için olduğu gibi açık. Yerel yedek skor (`saveLocalScore`) `sezon` alanı taşır. Bileşik dizin gerekmez (kesim süzgeci tek alanlı, sıra sayımı `getCountFromServer`).
- **Öneri/şikâyet formu:** Ana menüdeki "Bildir" ve oyun içi ☰ menüsündeki "Geri Bildirim" oyun içinde pencere açar (`ui.js showFeedbackModal`, `main.js _openFeedback`); ileti GitHub hesabı istemeden `feedback` koleksiyonuna yazılır (`leaderboard.js submitFeedback`, rastgele belge kimliği). Alanlar: `uid`, `tur` (hata / oneri / baska), `ileti` (10-2000 karakter), `iletisim` (0-100, isteğe bağlı), `baglam` {surum, yil, donem, tip, senaryo, ekran, tarayici}, `createdAt`. Bağlam gönderilmeden pencerede gösterilir. İstemci iki gönderim arasında 60 saniye bekletir (localStorage `rektor_oldum_geri_bildirim_son`); hatada metin yerinde kalır, GitHub bağlantısı yedek.
- **Geri bildirimleri okumak:** Kurallar `feedback`'in okunmasını kapatır; yalnız geliştirici okur.
  - Firebase Console > Firestore Database > Data > `feedback` (belgeleri `createdAt`'e göre sırala).
  - Ya da `scripts/oku-feedback.js`: Console > Project Settings > Service Accounts > "Generate new private key" ile inen dosyayı `scripts/service-account.json` olarak kaydet (.gitignore'da), depo kökünde bir kez `npm i firebase-admin`, sonra `node scripts/oku-feedback.js` (`--son 20`, `--tur hata`, `--json`). Betik yalnız okur; dosya yoksa ne yapılacağını yazar.
- **Yayına alma sırası:** önce kurallar (Rules Playground'da `scores_s2` create/update ve `feedback` create denenir), sonra kod. Kurallar yüklenmeden `scores_s2`'ye skor yazılamaz ve `feedback` reddedilir; Sezon 2 görünümü bu arada yalnız v0.7.0 kayıtlarını gösterir.

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
  - v0.4.55 (21 May 2026): Tutorial mobil tam ekran modal — @media (max-width: 768px) override, highlight efekti mobilde devre dışı, body scroll lock (tutorial-active class), "Atla / Sonraki" sticky footer (enesduran Issue #24).
  - v0.4.56 (28 May 2026): Birim yöneticisi atama regresyonu — v0.4.53 birim unvanları sonrası main.js `_onAssignUnitManager` hâlâ eski `s.title === 'Müdür' || 'Müdür Yrd.'` arıyordu, yeni unvanlar (Öğrenci İşleri Müdürü vb.) tanınmıyordu → isUnitManagerTitle(unitId, title) kullanıldı; ayrıca hireAdminStaff sonuna _assignUnitManagers eklendi (yönetici seviyesi personel alınca otomatik atama). ui.js cache-bust 0.4.52'de takılıydı, 0.4.56'ya çekildi (EfekanSalman Issue #25).
  - v0.4.57 (9 Haz 2026): Kontenjan exploit kapatıldı — applyQuotas (game.js) hiç doğrulama yapmıyordu, oyuncu DevTools'tan HTML max="500" kısıtlamasını bypass edip büyük sayılar girerek harçtan dev gelir elde edebiliyordu. Sunucu tarafı doğrulama: _calcDeptClassroomCapacity ile her bölüm için derslik kapasitesi × 1.1 (veya 800 absolute max) tavanı; NaN/negatif değerler 0'a klamplanır; aşırı toplam orantılı kırpılır. Skor güvenliği etkilendi (Esovarta73 Issue #26).
  - v0.4.59 (10 Haz 2026): Sağlık bilimleri proje konuları (23 uzmanlık için TÜBİTAK/BAP tarzı template + obje havuzu), kadro panelinde bölüm gruplaması (details/summary collapse), yanıtsız ilan başvuruları 2 dönem sonra otomatik geri çekilme + dönem özeti mesajı, migrateState applicationDate backfill (kocamane18 Issue #27).
  - v0.4.58 (9 Haz 2026): Serbest devam modu + erken uyarı sistemi — kazanma modalında "Serbest Devam Et" butonu; _state._internal.freeMode=true yapılır, _gameWon sıfırlanır, scenarioWinCondition kaldırılır; checkWinLose freeMode'da kazanma koşullarını atlar (kaybetme kontrolü devam eder); üst çubukta altın "Serbest Mod" rozeti; serbest moddayken liderlik tablosuna skor gönderilmez. Erken uyarılar: senaryo bitişine 2 dönem kala, 3 dönem ardışık açık, 3 dönem düşük öğrenci — summary.earlyWarnings dizisi aracılığıyla main.js gösterir. Senaryo kartlarında tahmini süre etiketi (Issue #26, Issue #27).
  - v0.4.54 (21 May 2026): iOS Safari mobil kullanılabilirlik paketi — viewport-fit=cover, 100dvh, safe-area-inset env() tüm fixed elementlere uygulandı, tutorial overlay sticky footer, input otomatik zoom engeli (enesduran Issue #24).
  - v0.4.53 (20 May 2026): Birim bazlı unvan havuzu - her idari birim için göreve özel 5 unvan tanımlandı (Ulaşım: Şoför/Kıdemli Şoför/Tamirci/Servis Sorumlusu/Ulaşım Müdürü vb.); ADMIN_UNITS.titles alanı; getUnitTitles/getUnitTitleSalary/isUnitManagerTitle helper'ları; eski kayıtlarda migration (Memur→birim unvanı); modal birim unvanlarını gösterir (EfekanSalman Issue #17).
  - v0.4.52 (16 May 2026): BAP bildirim spam + Olaylar UI — renderResearchPanel'de .proj-decision-btn delegate listener her UI yenilemesinde birikiyordu; panel._projDecisionDelegateAttached flag ile tek seferlik ekleme sağlandı (Issue #22). Bu Dönem Olaylar'da description'sız event'ler "Olay" placeholder gösteriyordu; validEvents filtresi + "Bu dönemde önemli bir olay yaşanmadı." boş durum mesajı (Issue #21). Her ikisi EfekanSalman raporu.

- v0.5.0 (23 Eyl 2026) Görsel Sürüm:
  - Görseller Codex (gpt-5.6-sol, imagegen) ile macenta zeminli sayfalar olarak çizildi; çalışma klasörü `C:\repos\_codex-rektor` (istem_*.txt, dilimle_genel.py anahtarlama ve dilimleme, sprite_paketle.py, paketle_arayuz.py).
  - `assets/buildings/`: 47 bina görseli (`<tür>_<düzey>.webp`, `insaat_1..3`, `meydan`) + 15 süsleme (ağaç türleri, fener, bank ...). Ölçüler `js/building-sprites.js` (BUILDING_SPRITES zemin plakası, PROP_SPRITES dayanak noktası). Bina, taban izine zemin plakasından ölçeklenir.
  - `campus-layout.js` düzen 2 (LAYOUT_VERSION=2): artı yollar, 3x3 meydan, 1 karo boşluk, bölge bantları, BFS patikalar. `ensureCampusLayout` eski kayıtları bir kez yeniden yerleştirir. Konumlar yalnız çizicide kullanılır, oyun mantığını etkilemez.
  - `campus-renderer.js`: 1600x1000 tuval + kamera (binaların bölgesine odak), görsel yoksa yer tutucu, gölge, mevsimlik ağaç.
  - `css/theme.css` (tema), `assets/ui/ikonlar.webp` (6x4 ikon atlası, `.ikon--<ad>`), `assets/ui/portreler.webp` (6x8 portre atlası; çift sütun kadın, satır yaş grubu; `renderFacultyPortrait` faculty.js).
  - Mobil: alt gezinme sekmeleri 1120 px genişliyordu (width:100% + max-content), Sonraki Dönem çubuğu uzun sayfada içeriğin arkasında kalıyordu; ikisi theme.css'te düzeltildi (#24).

- v0.5.1 (23 Eyl 2026): Hoca yaşam döngüsü (game.js `_processFacultyLifecycle`: yaş her güz başında +1, 67'de yaş haddi, 61+ erken emeklilik, yaşa bağlı düşük vefat olasılığı, boşalan başkanlığa `_autoAssignDeptHeads`; `state.facultyDepartures` son 40 ayrılış). Portre `portreYasi` ile işe girişteki yaşa sabit. Senaryo süresi dolunca oyun bitmez (`scenarioEnded`, `meta.scenarioTimedOut`, sonraki dönem serbest mod). Yeni Oyun Kur ekranı yeniden tasarlandı (senaryo kapakları `assets/ui/senaryo_*.webp`, bölüm ikon atlası `assets/ui/bolumler.webp` + ui.js `bolumIkonu()`), yapışkan alt düğme çubuğu. Haritada binanın görünen piksellerine göre seçim ve bilgi kutusu (campus-renderer `pickBuildingAt`).
  - Oyun hızı dengesi (eskiden devlet üniversitesi 2 yılda 1. oluyordu): 50 rakip (`data.js` `_TEMEL_RAKIPLER` + `_EK_RAKIPLER`, `_rakipUret`); saygınlık tek yerde, dönem sonunda `game.js _updatePrestige` ile güncellenir: kalite puanı (`ranking.js calculateQualityScore`) ile kurumsal tavanın (`kurumsalTavan(yas)`, yaş = `foundedYearsAgo` + geçen yıl) küçüğüne dönem başına %5, en çok 1 puan kayar; olay/ödül gibi doğrudan eklemelerin %12'si kalır (en çok ±0,4). Araştırma puanı toplam yayına değil son 2 yılın hoca başına yayın hızına bakar. Rakipler yavaş kayan `hedefPrestij`e döner, `updateRankings` artık saygınlığa dokunmaz, yalnız sıralar. Ölçüm (Playwright vekili): pasif oyunda 2 yılda en çok 3-4 sıra; çok iyi yönetimde devlet ilk 10'a ~15. yılda, köklü devlet ~10. yılda, vakıf (75 tavanı) ~23. yılda. Senaryo hedefleri: köklü devlet "15 yılda ilk 10", yeni kurulan "15 yılda ilk 30" (30 dönem). migrateState eski kayıtları 50 rakibe tamamlar, şişkin saygınlık dönem başına ~1 puan iner.
  - Skor tablosu: puan saygınlık ve sıraya bağlı, eski sürümde şişen skorlar yeni dengede aşılamaz; sezon ayrımı / "eski sistem" rozeti Oğuz'un kararına bırakıldı.
  - Sürüm notları kısa: en çok 4 madde, madde başına bir iki cümle (Oğuz, 23 Eyl 2026: "çok uzun yazıyorsun").

- v0.5.2 (24 Eyl 2026) Düzeltme paketi. İki bağımsız oynanabilirlik incelemesinden (Claude alt ajanı + Codex; sonuç sayfası https://claude.ai/artifact/8xYosih8arWZtvS4eqcToo, ham raporlar `C:\repos\_inceleme-rektor\`) çıktı; iki alt ajan ayrı git worktree'lerinde (mekanik / arayüz, dosya sahipliği ayrık) çalıştı, dallar master'da birleşti.
  - İlk dönem Genel Bakış: `initGame` kalite puanını hesaplar; `migrateState` eksik kalite ve tavanı doldurur, `updateRankings` çağırır.
  - Kapasite: bölüm kapasitesi = derslik koltuğu × 4 (bir koltuk bir yıllık alım, `applyQuotas` kabulü); atanmamış binalar binası olmayan bölümlerin ortak alanı; `dept.studentCapacity` ve `stats.capacity` her dönem yazılır, cezalar ve Yerleşke Özeti aynı ölçüyü kullanır. Kontenjan penceresindeki "Yeni Alım İçin Yer" de koltuk × 4 üzerinden.
  - Saygınlık geri bildirimi: olay seçimi saygınlığı anında yazmaz, `university._olaySayginlik` kanalında birikir (dönem başına en çok ±0,4); `kaliciSayginlikEtkisi(d)` seçenek kartında ve bildirimde kalıcı etkiyi verir; dönem özetinde `prestigeBreakdown {onceki, sonraki, kalite, olay}`; iletilerde ham puan yok ("saygınlığa katkı"). Başarımlar saygınlık güncellemesinden sonra denetlenir.
  - Yaşam döngüsü: ayrılıştan sonra ders ataması yeniden yapılır, projeler bölümdeki başka hocaya devredilir ya da sonlanır.
  - Transfer pazarı: aday `department` = açık bölüm kimliği, saygınlık `university.prestige`'ten; işe alım adayın bölümüne. Yeni bölüm "Min." hoca sayısına ulaşmadan öğrenci almaz. İdari yöneticiler başta atanır, elle atama `elleAtandi` ile korunur.
  - Arayüz: senaryo hedef göstergesi, Genel Bakış tahmini `calculateIncome/Expenses`, kredi borcu kartı, bölüm memnuniyeti `byDepartment`'tan, dönem özetinde "Devam" + Esc, olay penceresinde ✕ yok, inşaat onayı, sekme değişince başa kaydırma, sayı ekleri (2'ye, 6'ya), rehber hedefleri durumdan.
  - Köklü Devlet hedefi "15 yılda ilk 15" oldu (Oğuz onayı, 24 Eyl): gerçekçi iyi yönetim vekili 15. yılda 13.-14. sırada, ilk 10'a en erken 17,5 yılda. `migrateState` hedefi 30 ya da 10 olan köklü kayıtları 15'e çeker.
  - Bilinen: araştırma puanının proje ve h-indeks bileşenleri gerçek oyunda dolmuyor (kalite puanında 45/100 ulaşılamaz); iyi yönetimde devlet ilk 10'a 25-30 yılda. Düzeltmesi dengeyi değiştirir, ayrı sürümde ölçerek; sonra köklü hedefi yeniden ilk 10 olabilir. Ölçüm betikleri `C:\repos\_v052\birlesik\hiz_olc.py`, `hiz_iyi.py`.

- v0.6.0 (24 Eyl 2026) Bölüm Sayfası (Oğuz'un isteği: "bir bölümün her şeyini göreceğim sayfa"). `ui.js` `renderDeptPage(state, deptId)` (~3987), yardımcıları ~3120-4010; açma `window._openDeptPage(deptId)` (main.js ~788-820), açıkken `refreshGameUI` aynı bölümle yeniden çizer. Başlık, 8 gösterge, "Dikkat" kutusu (7 veri kuralı; ders vermeyen hoca uyarısı en az 3 kişi ve kadronun %30'u), 7 iç sekme: Kadro, Dersler (`_mufredatHtml` Bölümler sekmesiyle ortak), Öğrenciler ve Kontenjan, Araştırma, Yerleşke, Akreditasyon (`checkAccreditationRequirements`), Bütçe (gelir `calculateIncome` toplamının öğrenci payı, "tahmin" diye yazılı). Giriş: Genel Bakış bölüm satırları, Bölümler kartları, Fakülteler, Kadro grup başlığı, Öğrenciler tablosu. Eylemler var olan kararlara gider (ilan bölüm seçili, transfer bölüme süzülü, başkan, taşı, zorluk, kontenjan vurgusu). Başkana devretme YOK (ayrı iş). Sınama betikleri `C:\repos\_v060\sina_*.py`.

- v0.6.1 (24 Eyl 2026) Tutarlı görünüm (Oğuz: eski sayfalar "hafif uyumsuz"). Ortak bileşenler `theme.css` "ortak bileşenler" bölümü (`ob-` önekli: `ob-kart`, `ob-kutu(lar)`, `ob-tablo(-kap)`, `ob-rozet--*`, `ob-puan` (yıldız yerine), `ob-not`, `ob-bos`, `ob-ayar`, `ob-kimlik`, `pencere-yigin`), işaretleme yardımcıları `ui.js` başında (`_obKutu`, `_obPuan`, `_obSatir`, `_obBaslik`, `_dersTuruRozeti`, `_eslesmeRozeti`, `hocaAyrintisiHtml`). 16 sekme ve başlıca pencereler bu bileşenlere geçti (satır içi stil ~844'ten ~23'e). Yeni sayfa ya da pencere yazarken satır içi stil değil bu sınıflar kullanılmalı. Denetim listesi ve önce/sonra fotoğrafları `C:\repos\_v061\`. Sınama betikleri oyun durumuna `import('./js/game.js?v=<güncel sürüm>')` ile eriştiği için game.js sürümü değişince betiklerdeki adres de güncellenmeli (yoksa boş ikinci kopyaya bakarlar). Bilinen: devlette burs gideri görünüyor (kontenjan penceresi "hepsi ücretsiz" diyor; v0.7'de giderildi), telefonda Rehber düğmesi pencerelerin üstüne biniyor.

- v0.7.0 (25 Eyl 2026) Başkana devretme + yeni ekonomi + araştırma puanı. İki ajan ayrı worktree'lerde (`v07-devret`, `v07-denge`), master'da birleşti (tek çakışma theme.css sonu).
  - Devretme: `js/baskan.js` (`baskanDonemi(state, sonuc, {applyDecision, applyQuotas, setCourseDifficulty})`, game.js `nextTurn` içinde yaşam döngüsünden hemen sonra tek çağrı). `dept.policy = {kip:'dogrudan'|'devret', odak:'egitim'|'arastirma'|'dengeli'|'tasarruf', hocaOrani, donemlikAlimTavani, kontenjanKurali}`; başkan yalnız var olan kararları kullanır (ekonomi kuralları ona da uygulanır), yönetim puanı düşükse yanılır; işten çıkarma/bina/program yok; başkan ayrılınca doğrudana döner. Arayüz: Bölüm Sayfası başlığında yönetim seçimi ve politika formu, özette katlanır "Başkanların kararları", listelerde "Başkanda" rozeti. `applyDecision` `set_dept_policy`.
  - Araştırma puanı (`ranking.js`): bileşenler hoca başına; proje bileşeni gerçek `activeResearchProjects`; üniversite h-indeksi hocaların ortalaması (game.js'te hesaplanır).
  - Ekonomi: altı bütçe dağılımı kaydırıcısı kaldırıldı; yerine gidere yazılan hoca başı araştırma fonu, öğrenci hizmetleri, tanıtım. Devlet kısıtları uygulanıyor (norm kadro + 2 dönem kadro talebi, maaşlar ≤ %60, yıl sonu fazlası Hazine'ye; eski kasa "devreden birikim" sayılır, iadeden muaf). Devlette burs yok. Kontenjan "yer" kadar alınır. YÖK taban ödeneği 50 mn'den 4 mn'ye, vakıf katkısı 2 mn'ye indi; proje bütçesi kasaya girmez, patent geliri eskir; hocasız ders, kıdem zammı, transfer ücreti gider. Vakıf kasası 3 dönem üst üste -30 mn altında kalırsa kapanır (önceden uyarı).
  - Sabitler: SAYGINLIK_HIZ 0,065; kalite puanının 55 üstü 1,4 kat; öğrenci başı genel gider 5 bin; yarı zamanlı ders ücreti 75 bin.
  - Dürüst hız ölçümü: `C:\repos\_v070\denge\olc.py` + `vekil.js` (edilgen / iyi / savurgan vekil, yalnız oyuncu kararlarıyla; durum alanı elle yazılmaz), tablo `D4_tablo.md`. İyi devlet ilk 10'a 14,5-18,5 yılda; edilgen 2 yılda en çok 4 sıra; savurgan açık/iflas; Köklü "15 yılda ilk 15" iyi oyunla 3/3, "ilk 10" desteklenmiyor. Riskler: edilgen vakıf kasası hâlâ birikiyor; iyi vekil devlette 25-28. yılda birinci; orta sıralarda iyi oyun 2 yılda 6-8 sıra atlayabiliyor; Kurtarma ve Yeni Kurulan'da iyi oyunun payı ince; devlet iflas etmez.

- v0.7.1 (26 Eyl 2026) Yeni sezon, öneri formu, toplu işlemler (duyuru sonrası X ve LinkedIn geri bildiriminden). İki ajan ayrı worktree'lerde (`v071-sezon`, `v071-toplu`).
  - Sezon 2: `scores_s2` koleksiyonu; Sezon 2 görünümü = `scores_s2` ∪ `scores` içinde 2026-09-25T00:00Z sonrası kayıtlar (uid başına en yüksek). En İyiler'de "Sezon 2 / Eski sezon" sekmeleri. Skor ve ileti gönderimine 20 sn zaman aşımı (reCAPTCHA engellenince "Gönderiliyor"da kalıyordu).
  - Öneri formu: "Bildir" oyun içi pencere, `feedback` koleksiyonu (yalnız create). Okuma yolu yukarıda. Kurallar `firestore.rules`; yayına alırken kurallar koddan ÖNCE yüklenir (`firebase login` bir kez Oğuz tarafından, sonra `firebase deploy --only firestore:rules`, ya da Console'a yapıştır).
  - Toplu işlemler ve idari otomatik personel: `js/idari_otomatik.js`; Kadro'da ölçütlü "Uygun başvuruları kabul et / Kalanları reddet", "Hazır olanların hepsini yükselt"; İdari'de birim başına otomatik personel + kademe sınırı (varsayılan kapalı). Toplu işlemler tekil kararları döngüyle çağırır (norm kadro, %60 sınırı uygulanır). Bilinen: `promote_faculty` %60 sınırına bakmıyor; %60 kuralı idari maaşları saymıyor; idari personel kimlik sayacı her açılışta 1'den başlıyordu (otomatik/elle alım ve kayıt yüklemede onarıldı).
  - Araştırma merkezine atama (oyuncu e-postası, 27 Eyl 2026): bina atama penceresi dersliği olmayan binaya atamayı "Taşı" akışıyla yapıyor, bölüm fakülte binasından çıkıyor, v0.7.0'daki derslik yeri sınırı yüzünden alım duruyordu. `ui.js` `derslikliBina`: taşıma yalnız derslikli binalar arasında, dersliksiz binaya atama "Bağla". Sınama `C:\repos\_v071\birlesik\arastirma_atama_sina.py` + `tasima_sina.py` (olağan taşıma bozulmadı). Eski kayıtlarda taşınmış bölüm kendiliğinden onarılmaz, oyuncu fakülte binasına yeniden atar.
  - Birleştirme dersi: iki dal da theme.css'i aynı kapanış satırıyla bitirince git ortak "}" satırını tek sayıyor, bir @media bloğu açık kalıyor. Çakışma çözümünden sonra süslü parantez dengesi denetlenmeli (`C:\repos\_v070\cakisma_coz.py` artık denetliyor; `C:\repos\_v072\cakisma_coz.py` eksik "}" satırını kendisi ekliyor).

- v0.7.2 (28 Eyl 2026) Yerleşke düzeni, Bina Sayfası, laboratuvar odaları (oyuncu e-postası, 27 Eyl). v0.7.1 canlıya çıkmadan onunla birlikte hazırlandı. Dallar `v072-yerleske`, `v072-bina`, `v072-lab`, `v072-dogruluk`, `v072-yazim`; tümleştirme dalı `v072` (`C:\repos\rektor-wt-v072`). Sürüm betiği `C:\repos\_v072\surum_072.py`, son sınama `C:\repos\_v072\son\hepsini_kos.sh` (sunucu 8095).
  - Yerleşke düzenleme: `campus-layout.js` `_yerlesimSorunu` tek kural (otomatik yerleşim ve taşıma aynı kuralı kullanır), `checkBuildingMove`, `moveBuilding`; `game.js` `move_building` (ücretsiz, tur harcamaz). Elle konan bina `gridManual` taşır, ileride LAYOUT_VERSION değişse de uygun kaldıkça yerinde kalır. `window._yerleskeDuzenle(id)`. Yerleşim yalnız görsel, oyun etkisi yok.
  - Bina Sayfası: `js/bina_sayfasi.js` (game.js'i içe aktarmaz), `window._binaSayfasiniAc(id)`, `[data-bina-git]`. Bina etki metinleri tek kaynakta (`binaEtkiOzeti`, `binaKartEtkileri`, `yukseltmeEtkisi`); kart, inşaat ve yükseltme onayı buradan okur. data.js `effects`/`qualityEffects` oyun hesabında okunmuyor, `benefitText` gösterilmiyor. Memnuniyet etkileri "en çok" diye yazılır (idari birim ve puan sınırları gerçek artışı düşürebilir).
  - Laboratuvar: ihtiyaç ceil(öğrenci/60), yalnız labRequirement ≥ 2 bölümlerde (altındakilerin labScore'u hiçbir yerde okunmuyor, 100). Laboratuvar binası `linkedDepartments`'a, araştırma merkezi `assignedDepartments`'a oda verir; ihtiyaca oranlı paylaşım; labScore = 30 + 70 × karşılama. Türetilmiş alanlar `labPaylari`, `labIhtiyaci`, `labAyrilan`, `labKarsilama`. Yeniden dağıtım dönem sonunda, bağla/çözde, yüklemede ve kayıt/mezuniyetten sonra yayın ile akreditasyondan önce. Verilmiş akreditasyon geri alınmaz; sürmekte olan başvuru eski puanla değerlendirilir (`acc.eskiLabPuani`).
  - Hız ölçümü `C:\repos\_v072\denge\` (A eski, B yeni kural, C yeni kural + hasLab; senaryo başına 8 koşu, 30 yıl): iyi oyuncuda fark 1,5 yıldan az, Köklü "15 yılda ilk 15" 8/8.
  - Teknokent: tamamlanınca `hasTechnoPark` açılır (sponsorluk geliri, kariyer +15). Saygınlık 40 ve 3000 öğrencide dönemde 4,1 M ₺. Önceden bina hiçbir şey yapmıyordu.
  - Bakım: `economy.js` `binaDonemBakimi`; kart, Yerleşke özeti ve Bina Sayfası ödenen tutarı (durum, düzey, zorluk dahil) gösterir.
  - Ölü kod: `faculty.js` `calculateHappiness` ve `updateFacultyDevelopment` hiçbir yerden çağrılmıyor (ilk commit'ten beri); hoca mutluluğu ve gelişimindeki laboratuvar etkisi (`LAB_HOCA_ETKISI`) bu yüzden oyunda işlemiyor.
  - firestore.rules: 25 Eylül 00:00 UTC öncesi `scores` kayıtları donduruldu (güncelleme için createdAt ≥ kesim). 28 Eyl sayımı: `scores` 229 kayıt, 150'si kesimden önce.
  - Codex incelemesi (gpt-5.6-sol, çıktı `C:\repos\_v072\codex_inceleme2.txt`): 9 bulgu. Uygulanan: sürüm dizgileri, kurallarda eski sezon dondurma, lab dağıtım zamanlaması, etki metni üst sınır. Tasarım gereği: kasa eksiyken toplu kabul yok. Ertelenen: liste dışı sıradaki eşitlik kuralı, öneri formunda zaman aşımı sonrası olası çift kayıt, eski koleksiyon okuma sınırları (kayıt sayısı sınırın çok altında), hasLab ölü kodu.
  - Yayın: v0.7.1 ile v0.7.2 birlikte 30 Eyl 2026'da canlıya çıktı (2819d93). Firestore kuralları önce yüklendi (`firebase deploy --only firestore:rules`); canlı kurallar yüklemeden önce Rules API ile okunup depodakiyle karşılaştırıldı, yorumlar dışında aynıydı. Firebase CLI oergin@gmail.com ile girişli. Oğuz bilgisayar başında değilken giriş `firebase login --non-interactive` (bağlantı + oturum kimliği) ve Chrome'da hesap seçimi/izin, ardından `firebase login <kod>` ile yapıldı (auth.firebase.tools sayfası "OAuth hatası" yazsa da adres çubuğundaki `code` geçerli).

- v0.7.3 (30 Eyl 2026) Hata düzeltmeleri (GitHub #32, #33 ve ardından bulunanlar). Dal `v073-hata` (`C:\repos\rektor-wt-hata`), sınamalar `C:\repos\_v073\`, sürüm betiği `surum_073.py` (TABAN 2819d93).
  - #33: oyun sonu yalnız `_state._internal.gameOver/gameWon`'a yazılıyordu, arayüz `state.gameOver`'a bakıyordu. Oyun bitince düğme kilitlenmiyor, Baharda kontenjan penceresi dönüp duruyordu (0.4.28'den beri; Burak'ın eski "kontenjan modal ilerlemiyor" raporu büyük olasılıkla bu). `ui.js` `oyunSonu(state)`; şerit ve pencere oyunun neden bittiğini yazar (kayıtta neden kodu ve iletisi).
  - #32 ve kütüphane: kartlar yeterliliği tek binanın kapasitesiyle hesaplıyordu; motor (students.js) aynı türün bütün binalarını toplar. Kart ve Bina Sayfası artık "Bu tesis / Yerleşke toplamı" gösterir.
  - Kredi: gecikme sınırı `KREDI_GECIKME_SINIRI = 3` adıyla (kural aynı); dönem özeti ve Genel Bakış "(1/3)", "(2/3)" uyarısı verir.
  - Sürüm betiği dersi: betik yalnız tabandan bu yana değişen modüllerin içe aktaranlarını yükseltiyordu. Bir modülün yalnız içe aktarma satırı değişince içeriği de değişmiş olur, onu çağıranlar eski etiketle kalıyordu (v0.7.2'de students.js, events.js, ranking.js, baskan.js; Pages önbelleği 10 dakika olduğu için kalıcı zarar yok). `C:\repos\_v073\surum_073.py` artık sabit noktaya dek yineler. Betiği sürüm notunu yazdıktan sonra çalıştır. JS yamasından sonra sözdizimini `node --check` ile değil, modülü içe aktararak denetle (`node --check` kaçan bir tırnağı yakalamadı).
  - migrateState her yüklemede eksi kasayı Kamu Bankası kredisine çevirip kasayı sıfırlıyordu; vakıf oyuncusu yeniden yükleyerek -30 M kapanmasından kaçabiliyordu. Artık yalnız kredi alanı olmayan (kredi sistemi öncesi) kayıtlara uygulanır.

## Aktif Oyuncu Raporcuları
Erdinç (en yoğun), AkaDemi, Emir, Burak Gökalp, Yusuf Sertkaya, R-Fatih (Issue #7, #9), X, serhattural, Kozmoloji (#32), cocijo1791-ux (#33)

## Bekleyen Raporlar
- Burak — kontenjan modal ilerlemiyor. v0.7.3'te bulunan #33 kök nedeniyle (oyun bitince Baharda kontenjan penceresi döngüsü) büyük olasılıkla aynı; ayrı doğrulanmadı.
- App Check — 4 May 2026 gece doğrulandı: **Auth %100 verified, 0% Unverified (Monitoring)**, entegrasyon çalışıyor. Cloud Firestore hâlâ **Unenforced**. Sabah Firebase Console > App Check > Cloud Firestore satırına tıklayıp **Enforce** edilecek (gece yapılmadı çünkü eski cache'li client riski). Sonra birkaç oyuncudan skor gönderme doğrulaması al.

## Enhancement Backlog (Sonraki Büyük Sürüm — v0.5.0?)

Şu an stabilizasyon modunda; yeni özellikler eklenmiyor, biriktirilip ciddi bir sürümde topluca değerlendirilecek.

- **Sosyal/bilimsel etkinlik sistemi** (Erdinç, 4 May 2026) — okul içi etkinlik düzenleme: konferans, festival, kongre, atölye. Memnuniyet/saygınlık/finansal etki.
- **Ders Müfredatı + Öğretim Elemanı Manuel Ekleme** ([Issue #8](https://github.com/prof-oguzergin/rektor-oldum/issues/8), R-Fatih) — sandbox tarzı özelleştirme.
- **v0.7 duyurusundan gelen öneriler (26 Eyl 2026, X ve LinkedIn):**
  - Yabancı öğrenci kontenjanı ve alımı (X @_sinansh: "bütçeyi doğrultmak için yabancı öğrenci").
  - "Liyakat" olay paketi: siyasi bağlantı / akraba kadrosu baskıları, kabul/ret bedeli (LinkedIn yorumlarından, şaka ama oyunun diline uygun).
  - Tarihî hocalar (Tesla, Edison, Turing; LinkedIn mesajı, Kaan Burak K.). Oğuz: "sonraya bırak". Yalnız hayatta olmayan tarihî isimler.
  - Oyunun adı "oturmuyor" (X @kemalkaya0); Oğuz "her türlü öneriye açığız" dedi, karar Oğuz'da.
- **E-posta ile gelen oyuncu önerileri (27 Eyl 2026):** yerleşim özgürlüğü, bina panelleri ve laboratuvar kapasitesi v0.7.2'de yapıldı; araştırma merkezi hatası v0.7.1'de düzeltildi. Açık kalan: laboratuvar uzmanlaşması (kapasite seçildi), yerleşimin oyun etkisi (komşuluk bonusu gibi; şimdi yalnız görsel).

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

## Türkçe Yazım Kuralları (Claude için)
- "detay/detaylı" YASAK → "ayrıntı/ayrıntılı"
- Em-dash (---) YASAK → kısa çizgi (-) veya virgül
- "çip/mikroçip" YASAK → "yonga"
- "kontrol edilecek" yerine **"denetlenecek"** (daha doğru Türkçe)
- "akademisyen" yerine "öğretim üyesi" (oyun içi gerekli yerlerde)
