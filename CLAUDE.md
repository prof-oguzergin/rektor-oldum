# Rektör Oldum — Üniversite Yönetim Oyunu

- GitHub: https://github.com/prof-oguzergin/rektor-oldum (private)
- Durum: v0.2 tamamlandı, v0.3 planlanıyor
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
- `js/tutorial.js` — 8 adımlık interaktif rehber
- `js/alumni_events_achievements.js` — Mezun, olay, başarım sistemleri
- `js/main.js` — Event handler'lar, UI bağlantıları

### Çalıştırma
`OYUNU-BASLAT.bat` çift tıkla → tarayıcıda `localhost:8080`

## Sürüm Geçmişi
- v0.1: Hata temizliği, oyun dengesi, zorluk seçimi, tutorial
- v0.2: Mezun sistemi, 16 rastgele olay, 25 başarım, idari birimler, proje sistemi

## Sonraki Adımlar (v0.3)
- Öğrenci kulüpleri
- Teknoloji transfer ofisi
- Akreditasyon (MÜDEK/ABET)
- Senaryolar (3 farklı başlangıç)
- Sesler/müzik

## Terminoloji
- "Prestij" → "Saygınlık" kullanılıyor
- "Dashboard" → "Genel Bakış"
- "Kampüs" → "Yerleşke"
- Tüm arayüz Türkçe
