# Rektör Oldum — Üniversite Yönetim Oyunu

- GitHub: https://github.com/prof-oguzergin/rektor-oldum (private)
- Yayında: https://prof-oguzergin.github.io/rektor-oldum/
- Durum: v0.4.24 — aktif geliştirme, oyuncu rapor akışı (Erdinç, Emir, Burak, AkaDemi, Yusuf, Fatih)
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
  - v0.4.27: Leaderboard'da kullanıcı başına yalnızca en iyi skor (R-Fatih önerisi). Doc id `uid_gameId` → `uid`. Yeni rules: create/update/delete + update koşulu `score > resource.data.score`. Migration: `scripts/migrate-leaderboard.js` (Node + firebase-admin, service-account.json gerektirir, .gitignore'da). 51 belge → 48 (1 oyuncuda 4→1 birleşme, 3 silme).

## Aktif Oyuncu Raporcuları
Erdinç (en yoğun), AkaDemi, Emir, Burak Gökalp, Yusuf Sertkaya, R-Fatih (Issue #7, #9), X, serhattural

## Bekleyen Raporlar
- Burak — kontenjan modal ilerlemiyor, console log bekleniyor
- Emir — özet ekranında tüm değerler 0, console log bekleniyor
- App Check — 200/403 doğrulaması kullanıcı browser'ında

## Sonraki Adımlar
- Ek senaryo paketleri
- Mobil uyumluluk iyileştirmeleri (v0.4.3'te temel atıldı, derinleştirilecek)

## Terminoloji
- "Prestij" → "Saygınlık" kullanılıyor
- "Dashboard" → "Genel Bakış"
- "Kampüs" → "Yerleşke"
- Tüm arayüz Türkçe
