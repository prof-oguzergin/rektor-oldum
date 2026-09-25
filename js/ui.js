/**
 * Rektör Oldum — UI Render Modülü (ui.js)
 * ES6 module. Tüm DOM manipülasyonu ve render fonksiyonları burada.
 * Vanilla JS, framework yok.
 */

import { DEPARTMENTS, DEPARTMENT_CURRICULA, UNIVERSITY_TYPES, UNIVERSITY_MODELS, USD_TO_TL, DIFFICULTY_SETTINGS, BUILDINGS, SEMESTER_MONTHS, FACULTIES, DEPT_TO_FACULTY, SALARY_SCALES, ADMIN_UNITS, ADMIN_TITLES, ADMIN_UNIT_BUILDINGS, ACCREDITATION_BODIES, SCENARIOS, BANKS } from './data.js?v=0.6.1';
import { DEPARTMENT_FIELDS, getSalaryRange, renderFacultyAvatar, renderFacultyPortrait, calculateOverallRating, getFacultyRatingTrend } from './faculty.js?v=0.6.1';
import { AVAILABLE_NEW_DEPARTMENTS, getCourseEffectiveDifficulty, getUnitTitles, getUnitTitleSalary, isUnitManagerTitle, calculateCampusUsageSummary, kaliciSayginlikEtkisi, checkAccreditationRequirements } from './game.js?v=0.6.1';
import { calculateIncome, calculateExpenses, calculateLoanPayment } from './economy.js?v=0.6.1';
// v0.7 ekonomi: Bütçe sekmesinin harcama kararları ve devlet kısıtları, kontenjan penceresinin
// alım yeri ve vakıf başvuru tahmini, Genel Bakış'ın Hazine iadesi tahmini
import { harcamaKararlari, arastirmaFonuCarpani, ogrenciHizmetiEtkisi, tanitimEtkisi, kadroDurumu, maasGelirDurumu, hazineIadesiTahmini } from './economy.js?v=0.6.1';
import { bolumAlimYeri, vakifBasvuruTahmini } from './students.js?v=0.6.1';
import { HARCAMA_KARARLARI } from './data.js?v=0.6.1';
import { renderCampusMap, handleCampusClick, handleCampusHover, clearHover } from './campus-renderer.js?v=0.5.1';
import { ODAKLAR, KONTENJAN_KURALLARI, POLITIKA_SINIRLARI, KARAR_TURLERI, politikaOku, devirDurumu, yonetimKademesi, donemAdi } from './baskan.js?v=0.6.1';

// ─────────────────────────────────────────────────────────────────────────────
// DOM YARDIMCILARI
// ─────────────────────────────────────────────────────────────────────────────

/** ID ile element seç */
export const el  = id  => document.getElementById(id);

/** CSS seçici ile ilk eşleşen elementi seç */
export const qs  = sel => document.querySelector(sel);

/** CSS seçici ile tüm eşleşen elementleri seç (Array döner) */
export const qsa = sel => [...document.querySelectorAll(sel)];

/** Bir elemente event listener ekle */
export const on  = (element, event, handler) => {
  if (element) element.addEventListener(event, handler);
};

/** Delegate event (parent üzerinden child event yakalama) */
export function delegate(parent, selector, event, handler) {
  if (!parent) return;
  parent.addEventListener(event, e => {
    const target = e.target.closest(selector);
    if (target && parent.contains(target)) handler(e, target);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT YARDIMCILARI
// ─────────────────────────────────────────────────────────────────────────────

// v0.5.0: bölüm ikon atlası (assets/ui/bolumler.webp, 6 sütun x 5 satır, sıra atlasla aynı)
const _BOLUM_IKON_SIRA = [
  'bilgisayar_muh', 'yazilim_muh', 'elektrik_elektronik', 'makine', 'insaat', 'endustri',
  'biyomedikal', 'yapay_zeka', 'fizik', 'kimya', 'matematik', 'biyoloji',
  'isletme', 'iktisat', 'hukuk', 'psikoloji', 'iletisim', 'siyaset_bilimi',
  'mekatronik', 'mimarlik', 'guzel_sanatlar', 'tip', 'dis_hekimligi', 'eczacilik',
  'hemsirelik', 'cevre_muh', 'gida_muh', 'rektor', 'zorluk', 'kimlik',
];

/** Bölümün atlas ikonu (HTML); atlasta yoksa verilen yedek (emoji) döner. */
export function bolumIkonu(id, boyut = 34, yedek = '🏫') {
  const i = _BOLUM_IKON_SIRA.indexOf(id);
  if (i < 0) return yedek;
  return `<i class="bikon" style="width:${boyut}px;height:${boyut}px;background-position:${(i % 6) * 20}% ${Math.floor(i / 6) * 25}%;" aria-hidden="true"></i>`;
}

/**
 * Para formatla: 1500000 → "1.500.000 ₺"
 * Büyük sayılar: 1200000 → "1,2M ₺"
 */
export function formatMoney(amount) {
  if (amount === null || amount === undefined) return '—';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(1).replace('.', ',')}Mrd ₺`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1).replace('.', ',')}M ₺`;
  }
  // Kuruş gösterilmez (kredi anaparası gibi kesirli tutarlar "23.978.696,42 ₺" çıkıyordu)
  return `${sign}${Math.round(abs).toLocaleString('tr-TR')} ₺`;
}

/**
 * Para tam formatla: 1500000 → "1.500.000 ₺" (kısaltma yok)
 */
export function formatMoneyFull(amount) {
  if (amount === null || amount === undefined) return '—';
  const sign = amount < 0 ? '-' : '';
  return `${sign}${Math.round(Math.abs(amount)).toLocaleString('tr-TR')} ₺`;
}

/**
 * Sayı formatla: 1234 → "1.234"
 */
export function formatNumber(num) {
  if (num === null || num === undefined) return '—';
  return Math.round(num).toLocaleString('tr-TR');
}

/**
 * Yüzde formatla: 0.153 → "%15"
 */
export function formatPercent(ratio, decimals = 0) {
  return `%${(ratio * 100).toFixed(decimals)}`;
}

/**
 * Not ortalaması (4,00 ölçeği) Türkçe ondalıkla: 3.456 → "3,46"
 */
export function formatGPA(gpa) {
  return typeof gpa === 'number' && Number.isFinite(gpa) ? gpa.toFixed(2).replace('.', ',') : '—';
}

/**
 * Ondalık sayıyı Türkçe yazar: 0.4 → "0,4", 12 → "12", 52.6000001 → "52,6".
 * @param {number} deger
 * @param {number} [basamak=1]: en çok kaç ondalık basamak
 */
export function ondalikYaz(deger, basamak = 1) {
  const n = Number(deger);
  if (!Number.isFinite(n)) return '—';
  const yuvarlak = Math.round(n * 10 ** basamak) / 10 ** basamak;
  return (Object.is(yuvarlak, -0) ? 0 : yuvarlak).toLocaleString('tr-TR', { maximumFractionDigits: basamak });
}

/** Puanı tam sayıya yuvarlar; sayı değilse yedeği döner (52.60000000000002 → 53). */
export function tamPuan(deger, yedek = '—') {
  const n = Number(deger);
  return (deger === null || deger === undefined || deger === '' || !Number.isFinite(n)) ? yedek : Math.round(n);
}

/** İşaretli ondalık: +0,4 / -1,2 / 0 (değişim göstermek için). */
export function isaretliYaz(deger, basamak = 1) {
  const n = Number(deger);
  if (!Number.isFinite(n)) return '—';
  const metin = ondalikYaz(n, basamak);
  return (Math.round(n * 10 ** basamak) > 0 ? '+' : '') + metin;
}

// Sayıların okunuşundaki son sözcük: ünlü uyumu ve ek biçimi buna göre seçilir.
// [son ünlü, ünlüyle mi bitiyor, sert ünsüzle mi bitiyor]
const _SAYI_SON_SOZCUK = {
  birler:   { 1: ['i', 0, 0], 2: ['i', 1, 0], 3: ['ü', 0, 1], 4: ['ö', 0, 1], 5: ['e', 0, 1],
              6: ['ı', 1, 0], 7: ['i', 1, 0], 8: ['i', 0, 0], 9: ['u', 0, 0] },
  onlar:    { 1: ['o', 0, 0], 2: ['i', 1, 0], 3: ['u', 0, 0], 4: ['ı', 0, 1], 5: ['i', 1, 0],
              6: ['ı', 0, 1], 7: ['i', 0, 1], 8: ['e', 0, 0], 9: ['a', 0, 0] },
  yuz:      ['ü', 0, 0], bin: ['i', 0, 0], milyon: ['o', 0, 0], milyar: ['a', 0, 0], sifir: ['ı', 0, 0],
};

function _sayiSonSozcuk(n) {
  n = Math.abs(Math.trunc(n));
  if (n === 0) return _SAYI_SON_SOZCUK.sifir;
  if (n % 10) return _SAYI_SON_SOZCUK.birler[n % 10];
  if (n % 100) return _SAYI_SON_SOZCUK.onlar[(n % 100) / 10];
  if (n % 1000) return _SAYI_SON_SOZCUK.yuz;
  if (n % 1_000_000) return _SAYI_SON_SOZCUK.bin;
  if (n % 1_000_000_000) return _SAYI_SON_SOZCUK.milyon;
  return _SAYI_SON_SOZCUK.milyar;
}

/**
 * Sayıya kesme işaretiyle doğru eki ekler: sayiEkle(2) → "2'ye", sayiEkle(6) → "6'ya",
 * sayiEkle(3, 'de') → "3'te", sayiEkle(10, 'in') → "10'un", sayiEkle(16, 'si') → "16'sı" ("24 hocadan 16'sı").
 * @param {number} sayi
 * @param {'e'|'de'|'den'|'in'|'i'|'si'} [tur='e']: yönelme, bulunma, ayrılma, tamlayan, belirtme, iyelik (3. kişi)
 * @param {string} [gosterim]: sayının ekrandaki yazılışı (verilmezse sayının kendisi)
 */
export function sayiEkle(sayi, tur = 'e', gosterim = null) {
  const [unlu, unluyleBiter, sertBiter] = _sayiSonSozcuk(Number(sayi) || 0);
  const kalin  = 'aıou'.includes(unlu);
  const iki    = kalin ? 'a' : 'e';
  const dort   = { a: 'ı', ı: 'ı', o: 'u', u: 'u', e: 'i', i: 'i', ö: 'ü', ü: 'ü' }[unlu];
  const d      = sertBiter ? 't' : 'd';
  const ekler  = {
    e:   (unluyleBiter ? 'y' : '') + iki,
    de:  d + iki,
    den: d + iki + 'n',
    in:  (unluyleBiter ? 'n' : '') + dort,
    i:   (unluyleBiter ? 'y' : '') + dort,
    si:  (unluyleBiter ? 's' : '') + dort,
  };
  return `${gosterim ?? sayi}'${ekler[tur] ?? ekler.e}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ORTAK BİLEŞEN YARDIMCILARI (v0.6.1)
// theme.css "ORTAK BİLEŞENLER (ob-)" bölümünün işaretlemesini üretir.
// ─────────────────────────────────────────────────────────────────────────────

/** Değeri durum sınıfına çevirir: x ≥ iyi → 'ob-iyi', x ≥ orta → 'ob-uyari', değilse 'ob-kritik'. */
function _obKademe(x, iyi, orta) {
  const n = Number(x);
  if (!Number.isFinite(n)) return '';
  return n >= iyi ? 'ob-iyi' : n >= orta ? 'ob-uyari' : 'ob-kritik';
}

/**
 * Puan göstergesi: 1-5 gibi değerler için dolu ve boş elmaslar (yıldız karakteri yerine CSS).
 * Metin karşılığı ("Zorluk: 3/5") ekran okuyucuya ve fare ipucuna yazılır.
 * @param {number} deger
 * @param {number} [enCok=5]
 * @param {{ etiket?: string, renk?: ''|'iyi'|'uyari'|'kritik' }} [secenek]
 */
function _obPuan(deger, enCok = 5, { etiket = 'Puan', renk = '' } = {}) {
  const n = Math.max(0, Math.min(enCok, Math.round(Number(deger) || 0)));
  const yazi = `${etiket}: ${n}/${enCok}`;
  const elmaslar = Array.from({ length: enCok }, (_, i) => (i < n ? '<i class="on"></i>' : '<i></i>')).join('');
  return `<span class="ob-puan${renk ? ` ob-puan--${renk}` : ''}" role="img" aria-label="${yazi}" title="${yazi}">${elmaslar}</span>`;
}

/**
 * Gösterge kutusu: küçük büyük harfli etiket, büyük değer, alt satır (Bölüm Sayfası göstergeleriyle aynı görünüm).
 * @param {string} etiket
 * @param {string|number} deger
 * @param {string} [alt]          alt satır (HTML)
 * @param {string} [degerSinifi]  ör. 'ob-iyi', 'ob-kutu-s--metin'
 * @param {string} [kutuSinifi]   ör. 'ob-kutu--cukur' (kartın içinde)
 */
function _obKutu(etiket, deger, alt = '', degerSinifi = '', kutuSinifi = '') {
  return `
    <div class="ob-kutu${kutuSinifi ? ` ${kutuSinifi}` : ''}">
      <div class="ob-kutu-e">${etiket}</div>
      <div class="ob-kutu-s${degerSinifi ? ` ${degerSinifi}` : ''}">${deger}</div>
      ${alt ? `<div class="ob-kutu-a">${alt}</div>` : ''}
    </div>`;
}

/** Ders türü rozeti: harf yerine tam yazı (Zorunlu / Seçmeli). */
function _dersTuruRozeti(tur) {
  return tur === 'zorunlu'
    ? '<span class="ob-rozet ob-rozet--zorunlu ob-rozet--kucuk" title="Zorunlu ders">Zorunlu</span>'
    : '<span class="ob-rozet ob-rozet--secmeli ob-rozet--kucuk" title="Seçmeli ders">Seçmeli</span>';
}

/**
 * Ders ile hocanın uzmanlık eşleşmesi: 2 tam, 1 kısmi, 0 uzmanlık dışı; atanmamış ders hocasız ya da boş.
 * @param {number|null} kalite  courseAssignments[].matchQuality (atama yoksa null)
 * @param {boolean} hocasiz     ders uncoveredCourses içinde mi
 */
function _eslesmeRozeti(kalite, hocasiz = false) {
  if (kalite === 2) return '<span class="ob-rozet ob-rozet--iyi ob-rozet--kucuk" title="Hocanın uzmanlığı dersle tam eşleşiyor">Tam</span>';
  if (kalite === 1) return '<span class="ob-rozet ob-rozet--uyari ob-rozet--kucuk" title="Hocanın uzmanlığı dersle kısmen eşleşiyor">Kısmi</span>';
  if (kalite === 0) return '<span class="ob-rozet ob-rozet--kritik ob-rozet--kucuk" title="Dersi uzmanlığı dışındaki bir hoca veriyor">Uzmanlık dışı</span>';
  if (hocasiz) return '<span class="ob-rozet ob-rozet--kritik ob-rozet--kucuk" title="Bölümde bu dersi verecek hoca yok; dışarıdan öğretim görevlisi veriyor">Hocasız</span>';
  return '<span class="ob-soluk">—</span>';
}

/** Genel puan eğilimi oku (faculty.js getFacultyRatingTrend): yükseldi, düştü, aynı kaldı. */
function _egilimHtml(f) {
  const e = getFacultyRatingTrend(f);
  const yazi = e.trend === 'up' ? 'Genel puan son dönemde yükseldi' : e.trend === 'down' ? 'Genel puan son dönemde düştü' : 'Genel puan son dönemde değişmedi';
  return `<span class="ob-egilim ob-egilim--${e.trend}" title="${yazi}" aria-label="${yazi}">${e.arrow}</span>`;
}

/** Gider tutarı: sıfırsa eksi işareti yazılmaz ("-0 ₺" çıkıyordu). */
function _eksiPara(tutar) {
  const n = Number(tutar) || 0;
  return n > 0 ? `-${formatMoney(n)}` : formatMoney(0);
}

/** Bölüm kimliğinden kısa ad (açık bölüm ya da tanım); bulunamazsa kimliğin kendisi. */
function _bolumKisaAdi(id, depts = []) {
  if (!id) return '—';
  const d = depts.find(x => x.id === id) || DEPARTMENTS[id];
  return d ? (d.shortName || d.name) : id;
}

/**
 * Satır: etiket solda, değer sağda (theme.css .ob-satir). 2. aşamada kart ve pencere gövdelerinde ortak.
 * @param {string} etiket
 * @param {string|number} deger  HTML olabilir
 * @param {string} [degerSinifi] ör. 'ob-iyi', 'ob-kritik'
 */
function _obSatir(etiket, deger, degerSinifi = '') {
  return `<div class="ob-satir"><span>${etiket}</span><b${degerSinifi ? ` class="${degerSinifi}"` : ''}>${deger}</b></div>`;
}

/**
 * Bölüm başlığı: ikon atlasından ikon, altın başlık, isteğe bağlı sayı rozeti (.section-title + .ob-sayi).
 * @param {string} ikon   theme.css .ikon--<ad> (ör. 'yerleske', 'idari')
 * @param {string} metin
 * @param {number|string|null} [sayi]
 */
function _obBaslik(ikon, metin, sayi = null) {
  return `<div class="section-title"><i class="ikon ikon--${ikon}" aria-hidden="true"></i>${metin}${sayi != null && sayi !== '' ? ` <span class="ob-sayi">${sayi}</span>` : ''}</div>`;
}

/**
 * Veri dosyalarından gelen metni arayüz diline uydurur: uzun tire virgül olur, iç adlar ("labScore")
 * Türkçeleşir, "akademisyen" yerine "öğretim üyesi" yazılır. Veri dosyalarına dokunmadan yalnız gösterimde.
 */
function _veriMetni(metin) {
  return String(metin ?? '')
    .replace(/\s+—\s+/g, ', ')
    .replace(/labScore/g, 'laboratuvar puanı')
    .replace(/akademisyenlere/g, 'öğretim üyelerine')
    .replace(/akademisyen/g, 'öğretim üyesi');
}

// ─────────────────────────────────────────────────────────────────────────────
// KADRO YARDIMCI FONKSİYONLARI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hocanın verebileceği dersleri hesaplar: uzmanlık alanları × DEPARTMENT_CURRICULA
 * @param {object}   fac         — Hoca objesi (specializations, department)
 * @param {string[]} activeDepts — Oyuncunun açık bölüm id'leri
 * @returns {{ deptId, deptShortName, courseName, type }[]}
 */
function _getTeachableCourses(fac, activeDepts) {
  const specs = fac.specializations || [];
  const result = [];

  for (const deptId of activeDepts) {
    const curriculum = DEPARTMENT_CURRICULA[deptId];
    if (!curriculum) continue;
    const deptData = DEPARTMENTS[deptId];
    const deptShort = deptData?.shortName || deptId;

    for (const course of curriculum) {
      // Uzmanlık ile ders gereksiniminin eşleşmesi (tam veya kısmi)
      const matches = specs.some(spec =>
        spec === course.requiredExpertise ||
        spec.toLowerCase().includes((course.requiredExpertise || '').toLowerCase().substring(0, 5)) ||
        (course.requiredExpertise || '').toLowerCase().includes(spec.toLowerCase().substring(0, 5))
      );
      if (matches) {
        result.push({
          deptId,
          deptShortName: deptShort,
          courseName:    course.name,
          type:          course.type,
        });
      }
    }
  }
  return result;
}

/**
 * Bölüm uyum yüzdesi: hoca kaç ders karşılayabilir / toplam ders sayısı
 * @param {object}   fac     — Hoca
 * @param {string}   deptId  — Bölüm id
 * @param {string[]} activeDepts — Açık bölümler
 * @returns {{ count: number, total: number, pct: number }}
 */
function _getDeptCompatibility(fac, deptId, activeDepts) {
  const curriculum = DEPARTMENT_CURRICULA[deptId];
  if (!curriculum) return { count: 0, total: 0, pct: 0 };
  const teachable = _getTeachableCourses(fac, [deptId]);
  const count = teachable.length;
  const total = curriculum.length;
  const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
  return { count, total, pct };
}

// ─────────────────────────────────────────────────────────────────────────────
// EKRAN YÖNETİMİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Belirtilen ekranı göster, diğerlerini gizle.
 * @param {string} screenId — 'screen-menu' | 'screen-setup' | 'screen-game' | 'screen-event'
 */
export function showScreen(screenId) {
  qsa('.screen').forEach(s => s.classList.remove('active'));
  const target = el(screenId);
  if (target) {
    target.classList.add('active');
  }
}

/** Kilitli pencere (ör. rastgele olay): ✕, Esc ve arka plan tıklaması kapatmaz, oyuncu seçim yapmalı. */
let _pencereKilitli = false;

/**
 * Modal overlay göster / gizle.
 * @param {string} title    — Modal başlığı
 * @param {string} bodyHtml — İçerik HTML
 * @param {object} [opts]   Seçenekler: { wide: true } geniş modal için,
 *                            { kilitli: true } oyuncu kapatamasın (yalnız içerikteki seçimle kapanır)
 */
export function showModal(title, bodyHtml, opts = {}) {
  const overlay  = el('modal-overlay');
  const titleEl  = el('general-modal-title');
  const bodyEl   = el('general-modal-body');
  const modalEl  = el('general-modal');
  if (!overlay || !titleEl || !bodyEl) return;

  // Kilitli pencere (rastgele olay) açıkken başka pencere üstüne yazamaz (ör. Ctrl+S kayıt penceresi);
  // yazsaydı olayın seçimi hiç yapılmaz, dönem özeti açılmazdı. Seçim önce hideModal ile kilidi açar.
  if (_pencereKilitli && !opts.kilitli && !overlay.classList.contains('hidden')) {
    showNotification('Önce açık olaydaki seçimi yapın.', 'info');
    return;
  }

  titleEl.textContent = title;
  bodyEl.innerHTML    = bodyHtml;

  // Genişlik sınıfı ayarla
  if (modalEl) {
    modalEl.classList.toggle('modal-wide', !!opts.wide);
  }

  _pencereKilitli = !!opts.kilitli;
  const kapatBtn = el('btn-close-modal');
  if (kapatBtn) kapatBtn.style.display = _pencereKilitli ? 'none' : '';

  overlay.classList.remove('hidden');
  overlay.classList.add('active');

  // Body scroll lock (Lafontane6 raporu — mobilde modal acikken arka plan
  // sayfasi da kayiyordu, icerikler ust uste biniyordu).
  document.body.style.overflow = 'hidden';
  // Uzun modal'larda body'yi en uste kaydir
  if (bodyEl.scrollTo) {
    bodyEl.scrollTo({ top: 0, behavior: 'instant' });
  } else {
    bodyEl.scrollTop = 0;
  }
}

export function hideModal() {
  const overlay = el('modal-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.classList.remove('active');
  }
  _pencereKilitli = false;
  const kapatBtn = el('btn-close-modal');
  if (kapatBtn) kapatBtn.style.display = '';
  // Body scroll lock kaldir
  document.body.style.overflow = '';
}

/**
 * Oyuncunun kapatma isteği (✕, Esc, arka plana tıklama). Kilitli pencerede yok sayılır.
 * @returns {boolean} pencere kapandıysa true
 */
export function dismissModal() {
  if (_pencereKilitli) return false;
  const overlay = el('modal-overlay');
  const acikti = !!overlay && !overlay.classList.contains('hidden');
  hideModal();
  return acikti;
}

/**
 * Oyun penceresinde onay adımı: "Onayla" / "Vazgeç".
 * @param {string}   baslik
 * @param {string}   icerikHtml
 * @param {Function} onOnay       Onayla'ya basınca (pencere kapandıktan sonra) çağrılır
 * @param {object}   [secenek]    { onayMetni, vazgecMetni, onVazgec, tehlikeli }
 */
export function showConfirmModal(baslik, icerikHtml, onOnay, secenek = {}) {
  const { onayMetni = 'Onayla', vazgecMetni = 'Vazgeç', onVazgec = null, tehlikeli = false } = secenek;
  showModal(baslik, `
    <div class="onay-icerik">${icerikHtml}</div>
    <div class="onay-dugmeler">
      <button class="btn btn-secondary" id="btn-onay-vazgec" type="button">${vazgecMetni}</button>
      <button class="btn ${tehlikeli ? 'btn-danger' : 'btn-primary'}" id="btn-onay-tamam" type="button">${onayMetni}</button>
    </div>`);
  on(el('btn-onay-vazgec'), 'click', () => { hideModal(); if (onVazgec) onVazgec(); });
  on(el('btn-onay-tamam'), 'click', () => { hideModal(); if (onOnay) onOnay(); });
}

// ─────────────────────────────────────────────────────────────────────────────
// SÜRÜM NOTLARI (CHANGELOG) MODALI
// ─────────────────────────────────────────────────────────────────────────────

const _CHANGELOG_TYPE_META = {
  feat:     { icon: '✨', label: 'Yeni',      color: '#5dd6c0' },
  fix:      { icon: '🛠️', label: 'Düzeltme',  color: '#f5a623' },
  balance:  { icon: '⚖️', label: 'Denge',     color: '#7e57c2' },
  security: { icon: '🔒', label: 'Güvenlik',  color: '#e74c3c' },
};

/**
 * Oyun kazanıldığında kutlama modal'ını gösterir.
 * @param {object} state — Oyun durumu
 * @param {string} winReason — checkWinLose().reason değeri
 * @param {Function} calculateScore — Skor hesaplama fonksiyonu (leaderboard.js'ten enjekte)
 * @param {Function} scoreBreakdown — Skor kırılımı fonksiyonu
 * @param {Function} onSubmitScore — Leaderboard skor gönderme callback'i
 */
export function showGameWonModal(state, winReason, calculateScore, scoreBreakdown, onSubmitScore) {
  // Senaryo kimliği meta.scenarioId'de (eski kayıtlarda meta.scenario olabilir)
  const scenarioId = state?.meta?.scenarioId || state?.meta?.scenario || null;

  // Senaryo iletileri hedefin kendisinden üretilir (data.js SCENARIOS), hedef değişirse ileti de değişir
  const hedefIletisi = (id) => {
    const wc = SCENARIOS[id]?.winCondition;
    if (!wc) return null;
    const sure = wc.maxTurns ? `${Math.round(wc.maxTurns / 2)} yılda ` : '';
    if (wc.type === 'ranking') {
      const sira = state?.university?.ranking;
      return `Sıralama hedefini tutturdunuz! ${sure}Türkiye'de ilk ${sayiEkle(wc.target)} girme hedefine ulaştınız`
        + (sira ? `; üniversiteniz şimdi ${sira}. sırada.` : '.');
    }
    if (wc.type === 'prestige') {
      return `Saygınlık hedefine ulaştınız! ${sure}saygınlığı ${wc.target} puana çıkarma hedefini tutturdunuz.`;
    }
    if (wc.type === 'budget_positive') {
      return `Üniversiteyi mali krizden çıkardınız! Kasayı ${wc.consecutiveTurns || 10} dönem üst üste artıda tuttunuz.`;
    }
    return null;
  };
  const scenarioMessages = {
    vakif_kurtarma: hedefIletisi('vakif_kurtarma'),
    yeni_kurulan:   hedefIletisi('yeni_kurulan'),
    koklu_devlet:   hedefIletisi('koklu_devlet'),
  };

  // Kazanma nedeni mesajı
  const reasonMessages = {
    scenario_budget_positive: scenarioMessages[scenarioId] || 'Bütçeyi peş peşe pozitif tuttunuz.',
    scenario_prestige:        scenarioMessages[scenarioId] || 'Saygınlık hedefine ulaştınız.',
    scenario_ranking:         scenarioMessages[scenarioId] || 'Sıralama hedefini tutturdunuz.',
    prestige_max:             'Üniversiteniz dünya çapında lider oldu! Saygınlık 90 puanın üzerine çıktı.',
    ranking_first:            'Üniversiteniz ulusal sıralamada 1. sıraya yükseldi!',
  };

  const winMessage = reasonMessages[winReason]
    || scenarioMessages[scenarioId]
    || 'Üniversiteniz başarıyla hedeflerine ulaştı!';

  const score     = calculateScore ? calculateScore(state) : 0;
  const breakdown = scoreBreakdown ? scoreBreakdown(state) : [];

  const breakdownHtml = breakdown.length
    ? `<ul style="margin:10px 0 0;padding-left:18px;list-style:disc;">
        ${breakdown.map(line => `<li style="font-size:12px;color:var(--text-muted,#aaa);margin:2px 0;">${line}</li>`).join('')}
       </ul>`
    : '';

  const bodyHtml = `
    <div style="display:flex;flex-direction:column;gap:18px;padding:4px 0;text-align:center;">
      <div style="font-size:48px;line-height:1;">🏆</div>
      <div>
        <div style="font-size:22px;font-weight:700;color:#f5a623;margin-bottom:8px;">
          Tebrikler! Hedefe Ulaştınız!
        </div>
        <p style="margin:0;font-size:14px;line-height:1.6;color:var(--text-secondary,#ccc);">
          ${winMessage}
        </p>
      </div>
      <div style="background:rgba(93,214,192,0.08);border:1px solid rgba(93,214,192,0.3);
                  border-radius:10px;padding:16px;">
        <div style="font-size:32px;font-weight:700;color:var(--accent,#5dd6c0);">
          ${score.toLocaleString('tr-TR')} puan
        </div>
        <div style="font-size:12px;color:var(--text-muted,#aaa);margin-top:4px;">Final Skoru</div>
        ${breakdownHtml}
      </div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        <button id="won-leaderboard-btn" class="btn btn-primary btn-sm">
          🏆 Skorumu Gönder
        </button>
        <button id="won-freemode-btn" class="btn btn-success btn-sm">
          ⏩ Serbest Devam Et
        </button>
        <button id="won-new-game-btn" class="btn btn-ghost btn-sm">
          🎮 Yeni Oyuna Başla
        </button>
      </div>
    </div>`;

  showModal('🏆 Oyun Kazanıldı!', bodyHtml);

  document.getElementById('won-leaderboard-btn')?.addEventListener('click', () => {
    hideModal();
    if (onSubmitScore) onSubmitScore();
  });

  document.getElementById('won-freemode-btn')?.addEventListener('click', () => {
    if (typeof window._onEnableFreeMode === 'function') window._onEnableFreeMode();
  });

  document.getElementById('won-new-game-btn')?.addEventListener('click', () => {
    hideModal();
    showScreen('screen-menu');
  });
}

/**
 * Sürüm notları modalını gösterir.
 * @param {Array} changelog — CHANGELOG dizisi (changelog.js)
 * @param {string} currentVersion — Aktif sürüm (en üstte vurgulanır)
 */
export function showChangelogModal(changelog, currentVersion) {
  const safeList = Array.isArray(changelog) ? changelog : [];

  const html = `
    <div style="max-width:680px;">
      <p style="color:var(--text-muted,#aaa);font-size:13px;margin:0 0 16px;">
        En son değişiklikler aşağıda. Yeni sürüm yüklendiğinde bu pencere otomatik açılır.
      </p>
      ${safeList.map((entry, i) => {
        const isCurrent = entry.version === currentVersion;
        const dateStr   = entry.date || '';
        const items = (entry.items || []).map(it => {
          const meta = _CHANGELOG_TYPE_META[it.type] || _CHANGELOG_TYPE_META.fix;
          return `
            <li style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px;line-height:1.5;">
              <span style="flex-shrink:0;display:inline-flex;align-items:center;gap:4px;
                           background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:4px;
                           font-size:11px;font-weight:600;color:${meta.color};
                           border:1px solid ${meta.color}33;min-width:80px;justify-content:center;">
                ${meta.icon} ${meta.label}
              </span>
              <span style="flex:1;font-size:13px;color:var(--text,#e0e0e0);">${_escHtml(it.text || '')}</span>
            </li>`;
        }).join('');
        return `
          <div style="margin-bottom:${i === safeList.length - 1 ? '0' : '20px'};
                      padding:14px;border-radius:8px;
                      background:${isCurrent ? 'rgba(93,214,192,0.06)' : 'rgba(255,255,255,0.02)'};
                      border:1px solid ${isCurrent ? 'rgba(93,214,192,0.25)' : 'rgba(255,255,255,0.06)'};">
            <div style="display:flex;justify-content:space-between;align-items:baseline;
                        margin-bottom:${entry.title ? '4px' : '12px'};gap:12px;flex-wrap:wrap;">
              <div style="display:flex;align-items:baseline;gap:10px;">
                <span style="font-size:16px;font-weight:700;color:${isCurrent ? '#5dd6c0' : 'var(--text)'};">
                  v${_escHtml(entry.version || '?')}
                </span>
                ${isCurrent ? '<span style="font-size:10px;background:#5dd6c0;color:#0a0a0a;padding:2px 8px;border-radius:10px;font-weight:700;">ŞU AN</span>' : ''}
              </div>
              <span style="font-size:11px;color:var(--text-muted,#888);">${_escHtml(dateStr)}</span>
            </div>
            ${entry.title ? `<div style="font-size:13px;color:var(--text-muted,#aaa);margin-bottom:12px;">${_escHtml(entry.title)}</div>` : ''}
            <ul style="list-style:none;padding:0;margin:0;">${items}</ul>
          </div>`;
      }).join('')}
    </div>`;

  showModal('📋 Yenilikler', html, { wide: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// AKREDİTASYON MODALI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Akreditasyon başvuru modalını gösterir.
 * @param {object} state         — Oyun durumu
 * @param {string} deptId        — Bölüm id'si
 * @param {string} bodyId        — Akreditasyon kuruluşu id'si
 * @param {object} reqResult     — checkAccreditationRequirements() sonucu
 * @param {Function} onApply     — Başvur callback: (deptId, bodyId) => void
 */
export function showAccreditationModal(state, deptId, bodyId, reqResult, onApply) {
  const dept = (state.departments || []).find(d => d.id === deptId);
  const body = ACCREDITATION_BODIES[bodyId];
  if (!dept || !body) return;

  const acc = dept.accreditation?.[bodyId];
  // Süresi dolmuş ya da son 2 dönemine girmiş akreditasyon yenilenir (game.js applyForAccreditation yenileme ücretini alır)
  const isRenewal = acc?.status === 'expired' || acc?.status === 'granted';
  const cost = isRenewal ? body.renewalCost : body.cost;

  // v0.6.1: gereksinimler ortak satırlarla; karşılanmayan satır kırmızı (eskiden "← KARŞILANMIYOR")
  const checksHtml = reqResult.checks.map(c =>
    _obSatir(c.label, `${c.current} / ${c.required}${c.met ? '' : ' · eksik'}`, c.met ? 'ob-iyi' : 'ob-kritik')
  ).join('');

  const failedCount = reqResult.checks.filter(c => !c.met).length;
  const allMet = reqResult.allMet;

  const statusHtml = allMet
    ? '<div class="ob-not ob-not--iyi">Tüm gereksinimler karşılanıyor.</div>'
    : `<div class="ob-not ob-not--kritik">${failedCount} gereksinim karşılanmıyor; başvuru reddedilebilir.</div>`;

  const bodyHtml = `
    <div class="pencere-yigin">
      <p class="pencere-metin akr-pencere-ust"><b>${dept.name}</b> · ${body.fullName}</p>

      <div class="ob-kart">
        <div class="ob-kart-baslik"><span>Gereksinimler</span><span class="ob-rozet ${allMet ? 'ob-rozet--iyi' : 'ob-rozet--kritik'} ob-rozet--kucuk">${reqResult.checks.length - failedCount}/${reqResult.checks.length} karşılanıyor</span></div>
        ${checksHtml}
      </div>

      ${statusHtml}

      <div class="ob-kutular">
        ${_obKutu(isRenewal ? 'Yenileme ücreti' : 'Başvuru ücreti', formatMoney(cost), 'şimdi kasadan düşer')}
        ${_obKutu('Değerlendirme', `${body.processingTime.min}-${body.processingTime.max}<small>dönem</small>`, 'sonuç bu sürede gelir')}
        ${_obKutu('Kazanım', `+${body.prestigeBonus}`, 'saygınlık', 'ob-iyi')}
      </div>

      <div class="onay-dugmeler">
        <button type="button" class="btn btn-secondary" id="acc-modal-cancel">İptal</button>
        <button type="button" class="btn ${allMet ? 'btn-primary' : 'btn-warning'}" id="acc-modal-apply">
          ${allMet ? (isRenewal ? 'Yenile' : 'Başvur') : (isRenewal ? 'Yenile (riskli)' : 'Başvur (riskli)')}
        </button>
      </div>
    </div>`;

  showModal(`${body.icon} ${body.name} ${isRenewal ? 'Akreditasyon Yenileme' : 'Akreditasyon Başvurusu'}`, bodyHtml);

  setTimeout(() => {
    const cancelBtn = document.getElementById('acc-modal-cancel');
    const applyBtn  = document.getElementById('acc-modal-apply');
    if (cancelBtn) cancelBtn.addEventListener('click', hideModal);
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        hideModal();
        if (onApply) onApply(deptId, bodyId);
      });
    }
  }, 50);
}

// ─────────────────────────────────────────────────────────────────────────────
// EKRAN 1: ANA MENÜ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ana menü event listener'larını bağla.
 * @param {Function} onNewGame    — Yeni oyun callback
 * @param {Function} onLoadGame   — Kayıt yükle callback
 */
export function initMenuScreen(onNewGame, onLoadGame) {
  on(el('btn-new-game'),  'click', onNewGame);
  on(el('btn-load-game'), 'click', onLoadGame || (() => showNotification('Kayıt bulunamadı.', 'warning')));
  on(el('btn-settings'),  'click', () => _showSettingsModal());
}

// ─────────────────────────────────────────────────────────────────────────────
// AYARLAR MODALI (Ana Menü)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ses ayarlarını içeren ayarlar modalını göster.
 * window._onMusicVolChange / _onSFXVolChange / _onToggleMute callback'lerine bağlanır.
 * Hem ana menüden hem oyun içinden çağrılabilir.
 */
export function showSettingsModal() { _showSettingsModal(); }

function _showSettingsModal() {
  // Mevcut ses ayarlarını al (window üzerinden, yoksa varsayılan)
  const audioSettings = (typeof window.getAudioSettings === 'function')
    ? window.getAudioSettings()
    : { musicVol: 0.3, sfxVol: 0.6, muted: false };

  const musicPct = Math.round((audioSettings.musicVol ?? 0.3) * 100);
  const sfxPct   = Math.round((audioSettings.sfxVol ?? 0.6) * 100);

  // v0.6.1: ortak ayar satırı ve kaydırıcı; yüzde Türkçe yazımla (%30)
  const body = `
    <div class="pencere-yigin">
      <div class="ob-kart">
        <div class="ob-kart-baslik"><span>Ses</span></div>
        <div class="ob-ayar ob-ayar--satir">
          <label class="ob-ayar-e" for="ayar-muzik">Müzik sesi</label>
          <input type="range" id="ayar-muzik" class="ob-kaydirici" min="0" max="100" value="${musicPct}"
                 oninput="window._onMusicVolChange && window._onMusicVolChange(this.value)">
          <span class="ob-ayar-d">%${musicPct}</span>
        </div>
        <div class="ob-ayar ob-ayar--satir">
          <label class="ob-ayar-e" for="ayar-efekt">Efekt sesi</label>
          <input type="range" id="ayar-efekt" class="ob-kaydirici" min="0" max="100" value="${sfxPct}"
                 oninput="window._onSFXVolChange && window._onSFXVolChange(this.value)">
          <span class="ob-ayar-d">%${sfxPct}</span>
        </div>
        <div class="ayar-ses-durumu">
          <span class="ob-ayar-e">Ses durumu</span>
          <button class="btn btn-secondary btn-sm" id="settings-mute-btn" type="button"
                  onclick="window._onToggleMute && window._onToggleMute(); this.textContent = (window.isMuted && window.isMuted()) ? '🔇 Sessiz' : '🔊 Açık';">
            ${audioSettings.muted ? '🔇 Sessiz' : '🔊 Açık'}
          </button>
        </div>
      </div>
      <div class="ob-aciklama">Ses ayarları kendiliğinden kaydedilir.</div>
    </div>
  `;

  // Kaydırıcıların canlı değeri için oninput kullanılır
  showModal('Ayarlar', body);

  // Kaydırıcı değer etiketlerini canlı güncelle
  const modalBody = el('general-modal-body') || el('modal-body');
  if (modalBody) {
    modalBody.querySelectorAll('input[type="range"]').forEach(slider => {
      slider.addEventListener('input', () => {
        const span = slider.nextElementSibling;
        if (span) span.textContent = '%' + slider.value;
      });
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EKRAN 2: KURULUM
// ─────────────────────────────────────────────────────────────────────────────

/** Kurulum ekranı dahili state */
const _setup = {
  playerName:   '',
  uniName:      '',
  uniType:      'devlet',
  difficulty:   'kolay',   // HTML'de "kolay" kartı varsayılan seçili
  departments:  new Set(),
  scenarioId:   null,       // seçilen senaryo id'si (null = serbest oyun)
};

/**
 * Kurulum ekranı event listener'larını bağla ve bölüm listesini render et.
 * @param {Function} onStart — Oyun başlatma callback (setup objesini alır)
 */
export function initSetupScreen(onStart) {
  // Geri butonu
  on(el('btn-back-menu'), 'click', () => showScreen('screen-menu'));

  // ── ADIM 0: Senaryo seçimi ────────────────────────────────────────────────
  _renderScenarioCards();

  on(el('btn-scenario-next'), 'click', () => {
    if (!_setup.scenarioId) return;
    if (_setup.scenarioId === 'serbest') {
      // Serbest oyun: senaryo uygulanmaz
      _setup.scenarioId = null;
    } else {
      _applyScenarioToSetup(_setup.scenarioId);
    }
    _showSetupStep(1);
  });

  // ── ADIM 1 ← 0 ──────────────────────────────────────────────────────────
  on(el('btn-step1-back'), 'click', () => _showSetupStep(0));

  // ── ADIM 1 → 2 ──────────────────────────────────────────────────────────
  on(el('btn-step1-next'), 'click', () => {
    const name = el('input-player-name').value.trim();
    const uni  = el('input-uni-name').value.trim();
    if (!name) { showNotification('Rektör adı boş bırakılamaz.', 'warning'); return; }
    if (!uni)  { showNotification('Üniversite adı boş bırakılamaz.', 'warning'); return; }
    _setup.playerName = name;
    _setup.uniName    = uni;
    _showSetupStep(2);
  });

  // ── ADIM 2: Tip seçimi ───────────────────────────────────────────────────
  delegate(el('type-cards'), '.type-card', 'click', (e, card) => {
    qsa('#type-cards .type-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    _setup.uniType = card.dataset.type;
  });
  // Devlet varsayılan seçili
  const defaultType = qs('#type-cards .type-card[data-type="devlet"]');
  if (defaultType) defaultType.classList.add('selected');

  // ── ADIM 2: Zorluk seçimi ────────────────────────────────────────────────
  delegate(el('difficulty-cards'), '.difficulty-card', 'click', (e, card) => {
    qsa('#difficulty-cards .difficulty-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    _setup.difficulty = card.dataset.difficulty;
  });

  on(el('btn-step2-back'), 'click', () => _showSetupStep(1));
  on(el('btn-step2-next'), 'click', () => {
    _showSetupStep(3);
    _renderDeptSelection();
    // Senaryo seçildiyse zorunlu bölümleri önceden seç
    if (_setup.scenarioId && SCENARIOS[_setup.scenarioId]) {
      const scenario = SCENARIOS[_setup.scenarioId];
      _setup.departments = new Set(scenario.forcedDepartments || []);
      _renderDeptSelection();
    }
  });

  // ── ADIM 3: Bölüm filtreleri ─────────────────────────────────────────────
  delegate(el('dept-filter-bar'), '.dept-filter-btn', 'click', (e, btn) => {
    qsa('#dept-filter-bar .dept-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _renderDeptSelection(btn.dataset.cat);
  });

  on(el('btn-step3-back'), 'click', () => _showSetupStep(2));

  on(el('btn-start-game'), 'click', () => {
    if (_setup.departments.size < 2) {
      showNotification('En az 2 bölüm seçmelisiniz.', 'warning');
      return;
    }
    onStart({ ..._setup, departments: [..._setup.departments] });
  });
}

/** Senaryo kartlarını render et */
function _renderScenarioCards() {
  const container = el('scenario-cards');
  if (!container) return;

  const diffLabels = { kolay: 'Kolay', normal: 'Normal', zor: 'Zor', serbest: 'Serbest' };
  const diffClass  = { kolay: 'easy', normal: 'normal', zor: 'hard', serbest: 'easy' };

  // v0.5.0: her senaryonun kapak resmi (Codex ile çizildi); resmi olmayan senaryoda emoji
  const KAPAK = {
    serbest:        'senaryo_serbest',
    yeni_kurulan:   'senaryo_yeni_kurulan',
    koklu_devlet:   'senaryo_koklu_devlet',
    vakif_kurtarma: 'senaryo_vakif_kurtarma',
  };
  const kapak = (id, emoji) => KAPAK[id]
    ? `<div class="sc2-art" style="background-image:url('assets/ui/${KAPAK[id]}.webp?v=0.5.0');"></div>`
    : `<div class="sc2-art" style="display:grid;place-items:center;font-size:54px;">${emoji || ''}</div>`;
  const SAAT = '<svg class="menu-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';

  // "Serbest Oyun" sanal kartı: senaryo olmadan başlangıç
  const serbestCard = `
    <div class="scenario-card" data-scenario-id="serbest">
      ${kapak('serbest', '🎮')}
      <span class="sc2-check" aria-hidden="true">✓</span>
      <div class="sc2-body">
        <div class="scenario-card-header">
          <div class="scenario-card-title-block">
            <div class="scenario-card-name">Serbest Oyun</div>
            <div class="scenario-card-subtitle">Hazır senaryosuz, sıfırdan</div>
          </div>
          <span class="scenario-diff-badge scenario-diff-easy">Serbest</span>
        </div>
        <div class="scenario-card-desc">Üniversite tipini, zorluğu ve bölümleri sen seç. Hiçbir senaryo kısıtı yok, klasik açılış.</div>
        <div class="scenario-card-footer">
          <span class="scenario-flavor">"Boş tuval, sınırsız olasılık."</span>
          <span class="sc2-sure">${SAAT} Süre sınırı yok</span>
        </div>
      </div>
    </div>
  `;

  // Senaryo süre etiketi hesabı
  function _scenarioDuration(winCondition) {
    if (!winCondition) return 'Açık uçlu';
    if (winCondition.maxTurns) {
      const t = winCondition.maxTurns;
      return `Hedef ${t} dönemde (~${Math.round(t / 2)} yıl)`;
    }
    if (winCondition.consecutiveTurns) {
      const t = winCondition.consecutiveTurns;
      return `En az ${t} dönem (~${Math.round(t / 2)} yıl)`;
    }
    return 'Açık uçlu';
  }

  const realCards = Object.values(SCENARIOS).map(s => `
    <div class="scenario-card" data-scenario-id="${s.id}">
      ${kapak(s.id, s.icon)}
      <span class="sc2-check" aria-hidden="true">✓</span>
      <div class="sc2-body">
        <div class="scenario-card-header">
          <div class="scenario-card-title-block">
            <div class="scenario-card-name">${s.name}</div>
            <div class="scenario-card-subtitle">${s.subtitle}</div>
          </div>
          <span class="scenario-diff-badge scenario-diff-${diffClass[s.difficulty] || 'normal'}">${diffLabels[s.difficulty] || s.difficulty}</span>
        </div>
        <div class="scenario-card-desc">${s.description}</div>
        <div class="scenario-card-footer">
          <span class="scenario-flavor">${s.flavorText}</span>
          <span class="sc2-sure">${SAAT} ${_scenarioDuration(s.winCondition)}</span>
        </div>
      </div>
    </div>
  `).join('');

  container.innerHTML = serbestCard + realCards;

  // Varsayılan seçim: Serbest Oyun
  if (!_setup.scenarioId) _setup.scenarioId = 'serbest';
  const initial = container.querySelector(`.scenario-card[data-scenario-id="${_setup.scenarioId}"]`);
  if (initial) initial.classList.add('selected');
  _updateScenarioNextButton();

  delegate(container, '.scenario-card', 'click', (e, card) => {
    const id = card.dataset.scenarioId;
    qsa('#scenario-cards .scenario-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    _setup.scenarioId = id;
    _updateScenarioNextButton();
  });
}

function _updateScenarioNextButton() {
  const btn = el('btn-scenario-next');
  if (!btn) return;
  const isSerbest = !_setup.scenarioId || _setup.scenarioId === 'serbest';
  btn.textContent = isSerbest ? 'Serbest Oyna →' : 'Senaryoyla Başla →';
  btn.disabled = !_setup.scenarioId;
}

/** Senaryo seçimini _setup state'ine uygula (uni tipi, zorluk) */
function _applyScenarioToSetup(scenarioId) {
  const scenario = SCENARIOS[scenarioId];
  if (!scenario) return;

  // Uni tipi
  _setup.uniType = scenario.universityType || 'devlet';

  // Zorluk
  _setup.difficulty = scenario.difficulty || 'normal';

  // Adım 2'deki type kartını seç
  qsa('#type-cards .type-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.type === _setup.uniType);
  });

  // Adım 2'deki zorluk kartını seç
  qsa('#difficulty-cards .difficulty-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.difficulty === _setup.difficulty);
  });
}

/** Adım göster */
function _showSetupStep(step) {
  qsa('.setup-step').forEach(s => s.classList.add('hidden'));
  // Adım 0 için özel id kullan
  const targetId = step === 0 ? 'setup-step-scenario' : `setup-step-${step}`;
  const target = el(targetId);
  if (target) target.classList.remove('hidden');

  // Step indikatör güncelle (v0.5.0: geçilen adımlar "done")
  qsa('.setup-step-indicator .step').forEach(s => {
    const n = parseInt(s.dataset.step);
    s.classList.toggle('active', n === step);
    s.classList.toggle('done', n < step);
  });
  // Yeni adım baştan görünsün (masaüstünde ekran, telefonda sayfa kayar)
  el('screen-setup')?.scrollTo?.(0, 0);
  window.scrollTo(0, 0);
}

/** Bölüm seçim grid'ini render et */
function _renderDeptSelection(filter = 'hepsi') {
  const grid = el('dept-selection-grid');
  if (!grid) return;

  const catLabels = {
    muhendislik: 'Mühendislik',
    temel_bilim: 'Temel Bilim',
    sosyal:      'Sosyal',
    saglik:      'Sağlık',
    mimarlik:    'Mimarlık',
    sanat:       'Sanat',
  };

  const items = Object.values(DEPARTMENTS).filter(d => {
    if (filter === 'hepsi') return true;
    if (filter === 'sanat_mimarlik') return d.category === 'sanat' || d.category === 'mimarlik';
    return d.category === filter;
  });

  // Senaryo seçildiyse maxStartDepartments uygula
  const activeScenario = _setup.scenarioId ? SCENARIOS[_setup.scenarioId] : null;
  const maxDepts = activeScenario?.maxStartDepartments ?? 6;
  const forcedDepts = new Set(activeScenario?.forcedDepartments || []);

  grid.innerHTML = items.map(d => {
    const sel    = _setup.departments.has(d.id);
    const forced = forcedDepts.has(d.id);
    const dis    = !sel && _setup.departments.size >= maxDepts;
    const title  = dis
      ? `Limit doldu (${maxDepts}/${maxDepts}). Başka bölüm seçmek için önce bir tanesini kaldırman gerek.`
      : forced
      ? 'Bu bölüm senaryo için zorunludur.'
      : (sel ? 'Seçili. Kaldırmak için tekrar tıkla.' : 'Tıkla, seç.');
    return `
      <div class="dept-option${sel ? ' selected' : ''}${dis ? ' disabled' : ''}${forced ? ' forced' : ''}"
           data-dept-id="${d.id}" title="${title}">
        <span class="dept-option-icon">${bolumIkonu(d.id, 36, d.icon || '🏫')}</span>
        <div class="dept-option-info">
          <div class="dept-option-name">${d.name}${forced ? ' <span class="forced-badge">Zorunlu</span>' : ''}</div>
          <div class="dept-option-cat">${catLabels[d.category] || d.category}</div>
        </div>
      </div>`;
  }).join('');

  // Tıklama eventi
  delegate(grid, '.dept-option', 'click', (e, card) => {
    const id = card.dataset.deptId;
    if (card.classList.contains('disabled')) return;
    // Zorunlu bölümler kaldırılamaz
    if (forcedDepts.has(id) && _setup.departments.has(id)) {
      showNotification('Bu bölüm senaryo için zorunludur, kaldırılamaz.', 'warning');
      return;
    }

    if (_setup.departments.has(id)) {
      _setup.departments.delete(id);
      card.classList.remove('selected');
    } else {
      if (_setup.departments.size >= maxDepts) {
        showNotification(`Bu senaryo için en fazla ${maxDepts} bölüm seçilebilir.`, 'warning');
        return;
      }
      _setup.departments.add(id);
      card.classList.add('selected');
    }

    _updateDeptSelectionInfo();
    _renderDeptSelection(filter); // seçim değişti, disabled durumları güncelle
  });

  _updateDeptSelectionInfo();
}

/** Bölüm seçim bilgisini güncelle */
function _updateDeptSelectionInfo() {
  const countEl   = el('dept-selected-count');
  const maxEl     = el('dept-max-count');
  const namesEl   = el('dept-selection-names');
  const startBtn  = el('btn-start-game');
  const hintEl    = el('dept-selection-limit-hint');

  const activeScenario = _setup.scenarioId ? SCENARIOS[_setup.scenarioId] : null;
  const maxDepts = activeScenario?.maxStartDepartments ?? 6;

  const count = _setup.departments.size;
  if (countEl) countEl.textContent = count;
  if (maxEl)   maxEl.textContent   = maxDepts;

  if (namesEl) {
    const names = [..._setup.departments].map(id => DEPARTMENTS[id]?.shortName || id);
    namesEl.textContent = names.length > 0 ? '· ' + names.join(', ') : '';
  }

  if (hintEl) {
    if (activeScenario) {
      hintEl.textContent = `"${activeScenario.name}" senaryosu en fazla ${maxDepts} bölümle başlamana izin veriyor.`;
      hintEl.style.display = 'block';
    } else {
      hintEl.textContent = `Serbest oyunda en fazla ${maxDepts} bölümle başlayabilirsin. Sonradan yeni bölüm açılabilir.`;
      hintEl.style.display = 'block';
    }
  }

  if (startBtn) {
    startBtn.disabled = count < 2;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ÜST BAR GÜNCELLEMESİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Üst barda üniversite bilgilerini güncelle.
 * @param {object} state — Oyun durumu
 */
export function updateTopBar(state) {
  if (!state) return;

  const uni  = state.university;
  const meta = state.meta;

  // Üniversite adı
  const nameEl = el('uni-name-display');
  if (nameEl) nameEl.textContent = uni.name;

  // Dönem/yıl
  const termEl = el('term-display');
  if (termEl) {
    const sem = meta.semester === 'güz' ? 'Güz' : 'Bahar';
    termEl.textContent = `${meta.year}. Yıl · ${sem} Dönemi (Tur ${meta.turn})`;
  }

  // Bütçe
  const budgetEl = qs('#stat-budget .top-stat-value');
  if (budgetEl) {
    budgetEl.textContent = formatMoney(uni.budget);
    budgetEl.classList.toggle('text-bad', uni.budget < 0);
    budgetEl.classList.toggle('text-good', uni.budget > 0);
    budgetEl.classList.remove('budget-value');
  }

  // Saygınlık
  const prestigeEl = qs('#stat-prestige .top-stat-value');
  if (prestigeEl) prestigeEl.textContent = Math.round(uni.prestige);

  // Dünya Sırası
  const rankEl = qs('#stat-ranking .top-stat-value');
  if (rankEl) {
    const intlR = state.university?.intlRanking;
    rankEl.textContent = intlR ? `#${intlR}` : '—';
  }

  // Öğrenci sayısı
  const studEl = qs('#stat-students .top-stat-value');
  if (studEl) studEl.textContent = formatNumber(state.students?.totalEnrolled ?? 0);

  // Kadro sayısı
  const facEl = qs('#stat-faculty .top-stat-value');
  if (facEl) facEl.textContent = formatNumber(state.faculty?.length ?? 0);

  // Oyun bittiyse Sonraki Dönem butonunu devre dışı bırak, yeni oyun yönlendirmesi ekle
  const nextBtn = el('btn-next-turn');
  if (nextBtn) {
    const isOver = !!(state.gameOver || state.gameWon);
    nextBtn.disabled = isOver;
    if (isOver) {
      nextBtn.textContent = state.gameWon ? '🏆 Yeni Oyun' : '🎮 Yeni Oyun';
      nextBtn.onclick = () => showScreen('screen-menu');
    } else {
      nextBtn.textContent = 'Sonraki Dönem →';
      nextBtn.onclick = null;
    }
  }

  // Oyun bitti/kazanıldı banner'ı (top bar altında kalıcı uyarı)
  // gameWon → yeşil/altın, gameOver → kırmızı
  const gameScreen = el('screen-game');
  let bannerEl = el('game-over-banner');
  const isEnded = !!(state.gameOver || state.gameWon);
  if (isEnded && gameScreen) {
    if (!bannerEl) {
      bannerEl = document.createElement('div');
      bannerEl.id = 'game-over-banner';
      gameScreen.prepend(bannerEl);
    }
    if (state.gameWon) {
      bannerEl.style.cssText = 'background:linear-gradient(90deg,#1a6b3c,#2e8b57);color:#fff;text-align:center;padding:8px 16px;font-weight:600;font-size:14px;position:sticky;top:0;z-index:100;border-bottom:2px solid #f5a623;';
      bannerEl.textContent = '🏆 Oyunu kazandınız; yeni oyuna başlayabilirsiniz.';
    } else {
      bannerEl.style.cssText = 'background:#c0392b;color:#fff;text-align:center;padding:8px 16px;font-weight:600;font-size:14px;position:sticky;top:0;z-index:100;';
      bannerEl.textContent = '🔴 Oyun sona erdi; yeni oyuna başlayabilirsiniz.';
    }
    bannerEl.style.display = 'block';
  } else if (bannerEl) {
    bannerEl.style.display = 'none';
  }

  // Serbest mod rozeti (üst çubukta küçük altın rozet)
  let freeBadge = el('freemode-badge');
  if (state._internal?.freeMode) {
    if (!freeBadge) {
      freeBadge = document.createElement('div');
      freeBadge.id = 'freemode-badge';
      freeBadge.style.cssText = 'background:rgba(245,158,11,0.15);border:1px solid #f5a623;color:#f5a623;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;display:inline-block;margin-left:8px;vertical-align:middle;';
      freeBadge.textContent = '🆓 Serbest Mod';
      const nameEl2 = el('uni-name-display');
      if (nameEl2 && nameEl2.parentNode) nameEl2.parentNode.insertBefore(freeBadge, nameEl2.nextSibling);
    }
    freeBadge.style.display = 'inline-block';
  } else if (freeBadge) {
    freeBadge.style.display = 'none';
  }

  // v0.5.2: senaryo hedefi göstergesi. Masaüstünde dönem satırının altında, telefonda
  // kaynak haplarının altında ayrı satır (CSS hangisinin görüneceğini seçer).
  const hedef = _senaryoHedefi(state);
  const hedefYaz = (id, sinif, yerlestir) => {
    let kutu = el(id);
    if (!kutu) {
      kutu = document.createElement('div');
      kutu.id = id;
      kutu.className = `hedef-cubugu ${sinif}`;
      yerlestir(kutu);
    }
    kutu.hidden = !hedef;
    if (!hedef) return;
    kutu.innerHTML = `<span class="hedef-cubugu-ikon" aria-hidden="true">🎯</span><span class="hedef-cubugu-metin">${hedef.metin}</span>`;
    kutu.title = hedef.aciklama;
    kutu.classList.toggle('tuttu', hedef.tuttu);
    kutu.classList.toggle('kritik', !hedef.tuttu && hedef.kritik);
  };
  hedefYaz('hedef-cubugu', 'hedef-cubugu--masa', k => el('term-display')?.after(k));
  hedefYaz('hedef-cubugu-tel', 'hedef-cubugu--tel', k => qs('#screen-game .top-bar')?.appendChild(k));
}

/**
 * Senaryo hedefinin kısa adı: "Türkiye ilk 10", "saygınlık 60", "kasa 10 dönem üst üste artıda".
 * Sıralama hedefi Türkiye sırasıdır (university.ranking), dünya sırası değil.
 */
export function senaryoHedefTanimi(wc) {
  if (!wc) return 'senaryo hedefi';
  if (wc.type === 'ranking') return `Türkiye ilk ${wc.target}`;
  if (wc.type === 'prestige') return `saygınlık ${wc.target}`;
  if (wc.type === 'budget_positive') return `kasa ${wc.consecutiveTurns || 10} dönem üst üste artıda`;
  return 'senaryo hedefi';
}

/**
 * v0.5.2: senaryo hedefinin kısa metni: "Hedef: Türkiye ilk 10 · 21 dönem kaldı · şu an 24."
 * Hedef yoksa (serbest oyun, serbest mod, süresi dolmuş ya da bitmiş oyun) null döner.
 * Kalan dönem: hedef her dönem sonunda denetlenir, son denetim maxTurns. dönemin sonunda.
 */
function _senaryoHedefi(state) {
  const wc = state?.meta?.scenarioWinCondition;
  if (!wc || state._internal?.freeMode || state.meta?.isSandbox || state.meta?.scenarioTimedOut) return null;
  if (state.gameOver || state.gameWon || state._internal?.gameOver || state._internal?.gameWon) return null;

  const tur   = state.meta?.turn ?? 1;
  const kalan = wc.maxTurns ? Math.max(0, wc.maxTurns - tur + 1) : null;
  const kalanMetni = kalan == null ? null : kalan <= 1 ? 'son dönem' : `${kalan} dönem kaldı`;
  const sureMetni  = wc.maxTurns ? `${wc.maxTurns}. dönemin sonuna kadar ` : '';

  let hedef, simdi, aciklama, tuttu = false;
  if (wc.type === 'ranking') {
    const sira = state.university?.ranking;
    hedef    = `Türkiye ilk ${wc.target}`;
    simdi    = sira ? `şu an ${sira}.` : null;
    tuttu    = sira != null && sira <= wc.target;
    aciklama = `Senaryo hedefi: ${sureMetni}Türkiye sıralamasında ilk ${sayiEkle(wc.target)} girin. Sıra her dönem sonunda denetlenir.`;
  } else if (wc.type === 'prestige') {
    const p  = Math.round(state.university?.prestige ?? 0);
    hedef    = `Saygınlık ${wc.target}`;
    simdi    = `şu an ${p}`;
    tuttu    = p >= wc.target;
    aciklama = `Senaryo hedefi: ${sureMetni}saygınlığı ${wc.target} puana çıkarın.`;
  } else if (wc.type === 'budget_positive') {
    const n     = wc.consecutiveTurns || 10;
    const sayac = state.meta?.scenarioPositiveTurns || 0;
    hedef    = `Kasa ${n} dönem üst üste artıda`;
    simdi    = `şu an ${sayac}/${n} dönem`;
    aciklama = `Senaryo hedefi: kasayı ${n} dönem üst üste artıda tutun. Kasa bir dönem eksiye düşerse sayaç sıfırlanır.`;
  } else {
    return null;
  }
  const metin = [`Hedef: <b>${hedef}</b>`, kalanMetni, simdi].filter(Boolean).join(' · ');
  return { metin, aciklama, tuttu, kritik: kalan != null && kalan <= 4 };
}

// ─────────────────────────────────────────────────────────────────────────────
// SEKME YÖNETİMİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Oyun ekranı sekme navigasyonunu başlat.
 * @param {Function} onTabChange — Sekme değiştirme callback (tabId alır)
 */
export function initTabNavigation(onTabChange) {
  delegate(qs('.sidebar'), '.sidebar-tab', 'click', (e, btn) => {
    const tabId = btn.dataset.tab;

    _sekmeSiniflari(tabId);

    if (onTabChange) onTabChange(tabId);

    // Yeni sekme baştan görünsün: masaüstünde içerik kabı, telefonda ekran ya da sayfa kayar
    _sekmeyiBasaAl();
  });
  _bolumSayfasiGirisleriniBagla();
}

/** Yan menüde ve içerik alanında verilen sekmeyi etkin gösterir. */
function _sekmeSiniflari(tabId) {
  qsa('.sidebar-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
  qsa('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tabId}`));
}

/**
 * v0.6: sekmeyi kodla açar (yan menü tıklaması gibi, ama sekme değişikliği bildirimi olmadan).
 * Bölüm Sayfası başka bir sekmeden açılırken yan menüde "Bölümler" seçili olsun diye kullanılır.
 * @param {string} tabId
 */
export function sekmeyiEtkinlestir(tabId) {
  _sekmeSiniflari(tabId);
  // Telefonda alt gezinme yatay kayar: seçili sekme görünür olsun
  qs(`.sidebar-tab[data-tab="${tabId}"]`)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  _sekmeyiBasaAl();
}

/**
 * v0.6: data-bolum-git="<bölüm kimliği>" taşıyan her öğe Bölüm Sayfası'nı açar
 * (Genel Bakış, Bölümler, Fakülteler, Kadro, Öğrenciler). data-bolum-sekme açılışta seçilecek iç sekmedir.
 * Belge düzeyinde bir kez bağlanır; paneller yeniden çizilse de dinleyici birikmez.
 */
let _bolumGirisiBagli = false;
function _bolumSayfasiGirisleriniBagla() {
  if (_bolumGirisiBagli) return;
  _bolumGirisiBagli = true;
  const ac = (hedef) => {
    if (typeof window._openDeptPage === 'function') {
      window._openDeptPage(hedef.dataset.bolumGit, hedef.dataset.bolumSekme || null);
    }
  };
  document.addEventListener('click', (e) => {
    const hedef = e.target.closest?.('[data-bolum-git]');
    if (!hedef) return;
    // Satırın içindeki başka bir denetim (ör. Taşı düğmesi) kendi işini yapsın
    const icDenetim = e.target.closest('button, a, input, select, textarea, label');
    if (icDenetim && icDenetim !== hedef && hedef.contains(icDenetim)) return;
    // <summary> içindeki düğmede grubu katlama/açma olmasın
    e.preventDefault();
    ac(hedef);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const hedef = e.target.closest?.('[data-bolum-git][role="button"]');
    if (!hedef || hedef !== e.target) return;
    e.preventDefault();
    ac(hedef);
  });
}

/** İçerik kabını, oyun ekranını ve pencereyi en üste kaydırır. */
function _sekmeyiBasaAl() {
  for (const kap of [qs('#screen-game .main-content'), el('screen-game'), document.scrollingElement]) {
    if (kap && kap.scrollTop) kap.scrollTop = 0;
  }
  if (window.scrollY) window.scrollTo(0, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. DASHBOARD PANELİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genel Bakış: özet istatistikler, uyarılar, son olaylar.
 * @param {object} state — Oyun durumu
 */
export function renderDashboard(state) {
  const panel = el('tab-dashboard');
  if (!panel) return;

  const uni  = state.university;
  const meta = state.meta;

  // Dönem gelir/gider tahmini: Bütçe sekmesi ve dönem sonu hesabıyla aynı kaynak
  // (economy.js calculateIncome / calculateExpenses)
  const tahmin     = _donemTahmini(state);
  const netBalance = tahmin.net;

  // Uyarılar
  const warnings = _getWarnings(state);
  const donem = meta.semester === 'güz' ? 'Güz' : 'Bahar';

  // v0.5.0: ikonlu kaynak kartı
  const kart = (ikon, etiket, deger, alt, altSinif, vurgu) => `
    <div class="gb-card" style="--gb-accent:${vurgu};">
      <div class="gb-card-icon"><i class="ikon ikon--${ikon}"></i></div>
      <div class="gb-card-body">
        <div class="gb-card-label">${etiket}</div>
        <div class="gb-card-value">${deger}</div>
        <div class="gb-card-sub ${altSinif || ''}">${alt}</div>
      </div>
    </div>`;

  const kalite = (v) => {
    const renk = v >= 70 ? 'var(--teal)' : v >= 45 ? 'var(--gold-soft)' : '#ff8a9d';
    return `<span class="gb-quality">
      <span class="gb-quality-track"><span class="gb-quality-fill" style="width:${Math.max(0, Math.min(100, v))}%;background:${renk};"></span></span>
      <span class="gb-quality-num" style="color:${renk};">${Math.round(v)}</span>
    </span>`;
  };

  panel.innerHTML = `
    <div class="gb-hero">
      <div class="gb-welcome">
        <div class="gb-welcome-top">
          <div class="gb-crest"><i class="ikon ikon--yerleske"></i></div>
          <div>
            <div class="gb-uni">${uni.name}</div>
            <div class="gb-term"><i class="ikon ikon--donem"></i>${meta.year}. Yıl · ${donem} Dönemi</div>
          </div>
        </div>
        <div class="gb-prestige">
          ${createProgressRing(Math.round(uni.prestige), 100, 'Saygınlık', 76)}
          <div class="gb-prestige-text">
            <span class="gb-prestige-label">Saygınlık</span>
            <span class="gb-prestige-value">${Math.round(uni.prestige)} / 100</span>
            <span class="gb-prestige-sub">Türkiye'de ${uni.ranking ?? '—'}. sırada (${(state.rivals?.length ?? 0) + 1} üniversite)</span>
            <span class="gb-prestige-sub gb-prestige-kalite" title="Saygınlık her dönem kalite puanına yavaşça yaklaşır. Kurumsal birikim tavanı, üniversitenin kuruluşundan bu yana geçen yıllarla artar; saygınlık bu tavanı aşamaz.">Kalite ${uni.qualityScore ?? '—'} · birikim tavanı ${uni.prestigeCeiling ?? '—'}</span>
          </div>
        </div>
        <div class="gb-forecast">
          <div class="gb-forecast-title"><i class="ikon ikon--butce"></i>Bu Dönem Tahmini</div>
          ${tahmin.gelirler.map(k => `<div class="gb-forecast-row"><span>${k.ad}</span><b class="positive">${formatMoney(k.tutar)}</b></div>`).join('')}
          ${tahmin.giderler.map(k => `<div class="gb-forecast-row"><span>${k.ad}</span><b class="negative">-${formatMoney(k.tutar)}</b></div>`).join('')}
          <div class="gb-forecast-row gb-forecast-net"><span>Net</span><b class="${netBalance >= 0 ? 'positive' : 'negative'}">${netBalance >= 0 ? '+' : ''}${formatMoney(netBalance)}</b></div>
          ${tahmin.hazineIadesi > 0 ? `<div class="gb-forecast-row gb-forecast-hazine" title="Bahar dönemi kapanırken kasada bir dönemlik gideri ve kredi borcunu aşan para Hazine'ye döner (Bütçe sekmesi)."><span>Yıl sonu Hazine'ye iade (tahmini)</span><b class="negative">-${formatMoney(tahmin.hazineIadesi)}</b></div>` : ''}
        </div>
        ${warnings.length > 0 ? `
          <div class="gb-warnings">
            ${warnings.map(w => `
              <div class="notification ${w.type}" style="max-width:100%;">
                <span class="notification-icon">${w.icon}</span>
                <span class="notification-text">${w.message}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
      <div class="gb-campus" id="gb-campus" title="Yerleşkeye git" role="button" tabindex="0">
        <canvas id="dashboard-campus-canvas" width="1600" height="1000"></canvas>
        <span class="btn btn-secondary btn-sm gb-campus-cta"><i class="ikon ikon--yerleske"></i> Yerleşkeye git</span>
      </div>
    </div>

    <div class="gb-cards">
      ${kart('kasa', 'Kasa', formatMoney(uni.budget),
        netBalance >= 0 ? `+${formatMoney(netBalance)}/dönem` : `${formatMoney(netBalance)}/dönem`,
        netBalance >= 0 ? 'positive' : 'negative', '#f0c040')}
      ${kart('sayginlik', 'Saygınlık', Math.round(uni.prestige),
        `Türkiye #${uni.ranking ?? '—'} · ${(state.rivals?.length ?? 0) + 1} üniversite`, '', '#ffd866')}
      ${kart('ogrenci', 'Öğrenci', formatNumber(state.students?.totalEnrolled ?? 0),
        `${state.students?.starStudents?.length ?? 0} yıldız öğrenci`, '', '#4fa3e0')}
      ${kart('kadro', 'Kadro', formatNumber(state.faculty?.length ?? 0),
        `${state.departments?.length ?? 0} bölüm`, '', '#4ecca3')}
      ${kart('arastirma', 'Yayın', formatNumber(state.research?.publications ?? 0),
        `${state.research?.patents ?? 0} patent`, '', '#b38be8')}
      ${kart('mezunlar', 'Mezun', formatNumber(state.alumniData?.totalGraduates ?? 0),
        'Toplam mezun', '', '#e94560')}
    </div>

    <div class="gb-columns">

      <div>
        <div class="section-title"><i class="ikon ikon--bolumler"></i>Bölüm Durumu</div>
        <div class="card" style="padding:0;">
          <div class="gb-dept-row gb-dept-head">
            <span></span>
            <span>Bölüm</span>
            <span style="text-align:right">Öğrenci</span>
            <span>Kalite</span>
            <span></span>
          </div>
          ${(state.departments || []).map(d => `
            <div class="gb-dept-row gb-dept-row--git" data-bolum-git="${d.id}" role="button" tabindex="0"
                 title="${d.name}: Bölüm Sayfası" aria-label="${d.name} Bölüm Sayfası">
              <span class="gb-dept-icon">${bolumIkonu(d.id, 26, d.icon || '🏫')}</span>
              <span class="gb-dept-name">${d.shortName || d.name}</span>
              <span class="gb-dept-num">${formatNumber(d.enrolledStudents ?? 0)}</span>
              ${kalite(d.educationQuality ?? 50)}
              <span class="gb-dept-git" aria-hidden="true">›</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div>
        ${(() => {
          const activeProjs = state.research?.activeResearchProjects || [];
          if (activeProjs.length === 0) return '';
          const uniOhRate = state.universitySettings?.overheadRate ?? 0.15;
          const ohIncome = activeProjs.reduce((s, p) => {
            if (p.status !== 'active') return s;
            const sf = (p.requestedFunding || p.funding || 0) / Math.max(1, p.duration || 4);
            return s + sf * (p.callOverheadRate ?? uniOhRate);
          }, 0);
          const patRoy = Math.round((state.research?.patentRoyalties ?? 0) / 2);
          const total = Math.round(ohIncome) + patRoy;
          return `
            <div class="section-title mt-md"><i class="ikon ikon--arastirma"></i>Proje Gelirleri</div>
            <div class="card" style="padding:10px 14px;">
              <div class="summary-row">
                <span class="summary-row-label">Aktif proje sayısı</span>
                <span class="summary-row-value">${activeProjs.length}</span>
              </div>
              <div class="summary-row">
                <span class="summary-row-label">Genel gider geliri</span>
                <span class="summary-row-value positive">${formatMoney(Math.round(ohIncome))}/dönem</span>
              </div>
              ${patRoy > 0 ? `
              <div class="summary-row">
                <span class="summary-row-label">Patent gelirleri</span>
                <span class="summary-row-value positive">${formatMoney(patRoy)}/dönem</span>
              </div>` : ''}
              <div class="summary-row summary-total-row">
                <span class="summary-row-label">Toplam</span>
                <span class="summary-row-value positive">${formatMoney(total)}/dönem</span>
              </div>
            </div>
          `;
        })()}

        <div class="section-title mt-md"><i class="ikon ikon--bildirim"></i>Son Olaylar</div>
        <div class="card" style="padding:4px 0;">
          ${(state.events?.history?.slice(-5).reverse() || []).map(ev => `
            <div class="gb-event">
              <i class="ikon ikon--bildirim"></i>
              <span>${ev.description || ev.title || 'Geçmiş olay'}</span>
            </div>
          `).join('') || `
            <div class="empty-state" style="padding:16px;">
              <div style="font-size:12.5px;color:#7f8bb0;">Henüz olay yok.</div>
            </div>
          `}
        </div>
      </div>

    </div>
  `;

  // Canlı yerleşke görünümü; tıklayınca Yerleşke sekmesi açılır
  const cv = el('dashboard-campus-canvas');
  if (cv) {
    try { renderCampusMap(cv, state); } catch (e) { console.warn('[ui] Genel Bakış haritası çizilemedi:', e); }
  }
  const kutu = el('gb-campus');
  if (kutu) {
    const git = () => qs('.sidebar-tab[data-tab="campus"]')?.click();
    kutu.addEventListener('click', git);
    kutu.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); git(); } });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1b. BÖLÜMLER PANELİ: göstergeler + müfredat (v0.6.1: ortak bileşenlerle)
// ─────────────────────────────────────────────────────────────────────────────

/** Müfredat zorluğunun etkisini anlatan not (Bölümler sekmesinde bir kez, Bölüm Sayfası'nda derslerin üstünde). */
const _MUFREDAT_NOTU = `
  <div class="ob-not">
    <div class="ob-not-baslik">Müfredat zorluğu</div>
    <p><b>Zor müfredat</b> mezunları daha nitelikli kılar; saygınlık ve sıralama yükselir, ünlü mezun olasılığı artar. Buna karşılık öğrenci memnuniyeti ve geçme oranı düşer.</p>
    <p><b>Kolay müfredat</b> öğrencileri memnun eder, geçme oranı yükselir. Buna karşılık mezun kalitesi ve uzun vadede saygınlık düşer.</p>
    <p>Zorluk ayarı kaydırıcıyı bırakınca kaydedilir; geçme oranı ve notlar dönem sonunda yeniden hesaplanır.</p>
  </div>`;

/**
 * Bölümler sekmesi: her bölümün göstergeleri ve müfredatı.
 * @param {object} state — Oyun durumu
 */
export function renderDepartmentsPanel(state) {
  const panel = el('tab-departments');
  if (!panel) return;

  const depts   = state.departments || [];
  const faculty = state.faculty     || [];
  const tur     = state.meta?.turn || 1;
  const yuzde   = oran => `%${Math.round((Number(oran) || 0) * 100)}`;

  const kartlar = depts.map(dept => {
    const deptFaculty = faculty.filter(f => (f.department || f.departmentId) === dept.id);
    const stats       = dept.stats || {};
    const kalite      = dept.educationQuality ?? 50;
    const ogrenci     = stats.totalEnrolled ?? dept.enrolledStudents ?? 0;
    const kapasite    = stats.capacity ?? dept.studentCapacity ?? 100;
    const doluluk     = kapasite > 0 ? ogrenci / kapasite : 0;
    const byYear      = stats.byYear || { 1: 0, 2: 0, 3: 0, 4: 0 };
    const basarisiz   = stats.failureRate ?? 0;
    const not         = stats.avgGPA ?? 0;
    const zorluk      = stats.difficultyRating ?? 3;
    const mezuniyet   = stats.graduationRate ?? 0;
    const birakma     = stats.dropoutRate ?? 0;
    const dersYuku    = deptFaculty.reduce((s, f) => s + ((f.currentLoad?.assignedCourses || []).length), 0);
    const q           = state.students?.quotas?.[dept.id];
    const kontenjan   = q ? ((q.tamBurslu || 0) + (q.yariBurslu || 0) + (q.ucretli || 0)) : (dept.programs?.lisans?.quota ?? Math.round(kapasite / 4));
    const dolulukSinifi = doluluk > 1 ? 'ob-kritik' : doluluk > 0.85 ? 'ob-uyari' : 'ob-iyi';

    // Kapasite durumu: ipucu nedenini ve yapılacak işi söyler
    const kapasiteRozeti = doluluk > 1.0
      ? `<span class="ob-rozet ob-rozet--kritik" title="Öğrenci sayısı (${ogrenci}) bölüm kapasitesini (${kapasite}) aştı. Hoca ve derslik başına düşen öğrenci artar; eğitim kalitesi ve öğrenci memnuniyeti düşebilir. Yeni derslik ya da bina yapın veya sonraki dönem kontenjanı azaltın.">Kapasite aşıldı</span>`
      : doluluk > 0.85
        ? `<span class="ob-rozet ob-rozet--uyari" title="Bölüm kapasitesinin (${kapasite}) %85'inden fazlası dolu (${ogrenci} öğrenci). Önümüzdeki dönemlerde kapasiteyi artırmayı planlayın.">Kapasite dolmak üzere</span>`
        : `<span class="ob-rozet ob-rozet--iyi" title="Öğrenci sayısı (${ogrenci}) kapasite (${kapasite}) sınırları içinde.">Kapasite yeterli</span>`;

    // Akreditasyon: yalnız alınmış, değerlendirmede ya da süresi dolmuş olanlar (Bölüm Sayfası'yla aynı yazım)
    const akr = dept.accreditation || {};
    const akrRozetleri = Object.entries(ACCREDITATION_BODIES)
      .filter(([id]) => ['granted', 'applied', 'under_review', 'expired'].includes(akr[id]?.status))
      .map(([id, kurum]) => _bsAkrRozeti(kurum, akr[id], tur)).join('');

    return `
      <article class="ob-kart ob-kart--govde bolum-kart" data-bolum="${dept.id}">
        <header class="bolum-kart-ust">
          <span class="bolum-kart-ikon">${bolumIkonu(dept.id, 38, dept.icon || '🏫')}</span>
          <div class="bolum-kart-kimlik">
            <button type="button" class="bs-link bs-link--baslik" data-bolum-git="${dept.id}" title="${dept.name}: Bölüm Sayfası">${dept.name}</button>
            <div class="bolum-kart-alt">${deptFaculty.length} hoca · ${dersYuku} ders yükü</div>
            <div class="ob-dizi">${_devirRozeti(dept)}${kapasiteRozeti}${akrRozetleri}</div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm bs-git-dugme" data-bolum-git="${dept.id}">Bölüm Sayfası →</button>
        </header>
        <div class="ob-kutular bolum-kart-kutular">
          ${_obKutu('Öğrenci', formatNumber(ogrenci), `${byYear[1] || 0} · ${byYear[2] || 0} · ${byYear[3] || 0} · ${byYear[4] || 0} <span class="ob-tek">(1-4. sınıf)</span>`, '', 'ob-kutu--cukur')}
          ${_obKutu('Doluluk', yuzde(doluluk), `${formatNumber(ogrenci)}&nbsp;öğrenci, ${formatNumber(kapasite)}&nbsp;yer`, dolulukSinifi, 'ob-kutu--cukur')}
          ${_obKutu('Kontenjan', formatNumber(kontenjan), 'yıllık yeni alım', '', 'ob-kutu--cukur')}
          ${_obKutu('Eğitim kalitesi', Math.round(kalite), '100 üzerinden', _obKademe(kalite, 70, 45), 'ob-kutu--cukur')}
          ${_obKutu('Zorluk', `${ondalikYaz(zorluk, 1)}<small>/5</small>`, _obPuan(zorluk, 5, { etiket: 'Ortalama ders zorluğu' }), '', 'ob-kutu--cukur')}
          ${_obKutu('Başarısızlık', yuzde(basarisiz), 'dönemlik oran', basarisiz > 0.20 ? 'ob-kritik' : basarisiz > 0.10 ? 'ob-uyari' : 'ob-iyi', 'ob-kutu--cukur')}
          ${_obKutu('Not ortalaması', formatGPA(not), '4,00 üzerinden', _obKademe(not, 3.0, 2.5), 'ob-kutu--cukur')}
          ${_obKutu('Mezuniyet', yuzde(mezuniyet), `bırakma <span class="${birakma > 0.05 ? 'ob-kritik' : ''}">${yuzde(birakma)}</span>`, _obKademe(mezuniyet, 0.8, 0.6), 'ob-kutu--cukur')}
        </div>
        ${_mufredatHtml(dept, { notGoster: false })}
      </article>`;
  }).join('');

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-title">Bölümler &amp; İstatistikler</div>
        <div class="panel-subtitle">${depts.length} açık bölüm · göstergeler, müfredat ve ders zorluğu</div>
      </div>
    </div>
    <div class="ob-yigin ob-yigin--sik">
      ${depts.length ? _MUFREDAT_NOTU : ''}
      ${kartlar || `
        <div class="ob-bos">
          <i class="ikon ikon--bolumler" aria-hidden="true"></i>
          <div class="ob-bos-baslik">Henüz açık bölüm yok</div>
        </div>`}
    </div>
  `;
}

/**
 * Bölümün müfredat bölümü: eşleşme özeti ve ders tablosu (tür, ders, zorluk, kayıtlı, geçme, not,
 * eşleşme, veren hoca, zorluk ayarı). Bölümler sekmesi ve Bölüm Sayfası'nın Dersler sekmesi ortak kullanır.
 * Kaydırıcı sürüklenirken yalnız yanındaki sayı değişir; değer bırakınca kaydedilir
 * (her adımda sayfa yeniden çizilince sürükleme kopuyordu).
 * @param {object} dept
 * @param {{ notGoster?: boolean }} [secenek]  notGoster: zorluk notu tablonun üstünde (Bölümler sekmesi notu bir kez, en üstte gösterir)
 */
function _mufredatHtml(dept, { notGoster = true } = {}) {
  const curriculum  = DEPARTMENT_CURRICULA[dept.id] || [];
  const assignments = dept.courseAssignments || [];
  const uncovered   = dept.uncoveredCourses  || [];
  const courseStats = dept.stats?.courseStats || [];
  const tam         = assignments.filter(c => c.matchQuality === 2).length;
  const kismi       = assignments.filter(c => c.matchQuality === 1).length;
  const kapsama     = curriculum.length > 0 ? Math.round((assignments.length / curriculum.length) * 100) : 100;
  // Zorluk rengi: 1-2 kolay, 3 orta, 4-5 zor (eski kaydırıcı renkleriyle aynı eşikler)
  const zorlukRengi = z => z >= 4 ? 'kritik' : z >= 3 ? 'uyari' : 'iyi';

  if (curriculum.length === 0) {
    return `
      <div class="mufredat">
        <div class="mufredat-ust"><div class="ob-bos ob-bos--kucuk">Bu bölüm için müfredat tanımlanmamış.</div></div>
      </div>`;
  }

  const satirlar = curriculum.map(course => {
    const assign  = assignments.find(a => a.course?.id === course.id);
    const hocasiz = uncovered.some(u => u.id === course.id);
    const cStat   = courseStats.find(cs => cs.id === course.id);
    const zorluk  = getCourseEffectiveDifficulty(dept, course);
    const renk    = zorlukRengi(zorluk);
    const gecme   = cStat ? Number(cStat.passRate) : null;
    const hoca    = assign ? (assign.assignedName || '—') : hocasiz ? 'Dışarıdan öğretim görevlisi' : '—';
    return `
      <tr>
        <td>${_dersTuruRozeti(course.type)}</td>
        <td class="ob-ad ob-tek">${course.name}</td>
        <td>${_obPuan(zorluk, 5, { etiket: 'Zorluk', renk })}</td>
        <td class="n">${cStat ? formatNumber(cStat.enrolled) : '—'}</td>
        <td class="n ob-kalin ${gecme != null ? _obKademe(gecme, 0.8, 0.6) : ''}">${gecme != null ? `%${Math.round(gecme * 100)}` : '—'}</td>
        <td class="n">${cStat ? `${cStat.avgGrade}<span class="ob-soluk">/100</span>` : '—'}</td>
        <td>${_eslesmeRozeti(assign ? assign.matchQuality : null, hocasiz)}</td>
        <td class="ob-tek${assign ? '' : ' ob-soluk'}">${hoca}</td>
        <td>
          <div class="mufredat-ayar">
            <input type="range" min="1" max="5" step="1" value="${zorluk}" class="ob-kaydirici ob-kaydirici--${renk}"
              oninput="this.nextElementSibling.textContent = this.value"
              onchange="window._onSetCourseDifficulty('${dept.id}', '${course.id}', this.value)"
              title="Zorluk ayarı: 1 (kolay) - 5 (çok zor)" aria-label="${course.name} zorluğu">
            <span class="mufredat-ayar-sayi ob-${renk}">${zorluk}</span>
          </div>
        </td>
      </tr>`;
  }).join('');

  return `
    <div class="mufredat">
      <div class="mufredat-ust">
        <div class="ob-dizi">
          <span class="ob-rozet ob-rozet--iyi" title="Uzmanlığı dersle tam eşleşen hocaya atanmış ders">${tam} tam eşleşme</span>
          <span class="ob-rozet ob-rozet--uyari" title="Uzmanlığı dersle kısmen eşleşen hocaya atanmış ders">${kismi} kısmi eşleşme</span>
          ${uncovered.length > 0 ? `<span class="ob-rozet ob-rozet--kritik">${uncovered.length} hocasız ders</span>` : ''}
          ${dept.partTimeHires > 0 ? `<span class="ob-rozet">${dept.partTimeHires} dışarıdan öğretim görevlisi</span>` : ''}
          <span class="ob-rozet" title="Hoca atanmış derslerin müfredattaki derslere oranı">Kapsama %${kapsama}</span>
        </div>
        ${notGoster ? _MUFREDAT_NOTU : ''}
      </div>
      <div class="ob-tablo-kap ob-tablo-kap--ic">
        <table class="ob-tablo ob-tablo--genis mufredat-tablo">
          <thead>
            <tr>
              <th>Tür</th><th>Ders</th><th>Zorluk</th><th class="n">Kayıtlı</th><th class="n">Geçme</th>
              <th class="n">Not ort.</th><th>Eşleşme</th><th>Veren hoca</th><th>Zorluk ayarı</th>
            </tr>
          </thead>
          <tbody>${satirlar}</tbody>
        </table>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. KADRO PANELİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kadro sekmesi: maaş özeti, başvurular, açık ilanlar, hoca listesi (kart ya da tablo), transfer pazarı düğmesi.
 * v0.6.1: ortak bileşenler; başvuru kartları hoca kartının (fc2-) parçalarıyla kurulur.
 * @param {object} state — Oyun durumu
 * @param {Function} onTransferMarket — Transfer pazarı açma callback
 * @param {Function} onFacultyDetail  — Hoca ayrıntısı callback (facultyId alır)
 * @param {Function} onOpenPosition   — Kadro ilanı penceresi callback
 */
export function renderFacultyPanel(state, onTransferMarket, onFacultyDetail, onOpenPosition) {
  const panel = el('tab-faculty');
  if (!panel) return;

  const faculty    = state.faculty || [];
  const depts      = state.departments || [];
  const deptOpts   = depts.map(d =>
    `<option value="${d.id}">${d.shortName || d.name}</option>`
  ).join('');

  // Maaş özeti
  const totalMonthlySalary = faculty.reduce((s, f) => s + (f.salary || 0), 0);
  const avgSalary          = faculty.length > 0 ? Math.round(totalMonthlySalary / faculty.length) : 0;
  const sortedBySalary     = [...faculty].sort((a, b) => (b.salary || 0) - (a.salary || 0));
  const highestPaid        = sortedBySalary[0];
  const lowestPaid         = sortedBySalary[sortedBySalary.length - 1];

  // Açık pozisyonlar ve başvurular
  const openPositions         = state.openPositions || [];
  const applications          = state.pendingApplicants || [];
  const spontaneousApplicants = state.spontaneousApplicants || [];
  const myDeptIds             = depts.filter(d => d.isOpen).map(d => d.id);

  /** Başvuru kartının üstü: portre, ad, unvan, bölüm, genel puan ve akademik çıktı kutuları (hoca kartıyla aynı parçalar). */
  const adayUst = (app, bolumSatiri, ek = '') => {
    const puan  = calculateOverallRating(app);
    const renk  = puan >= 85 ? '#f0c040' : puan >= 70 ? '#4ecca3' : puan >= 55 ? '#f5a623' : '#ff6b81';
    const harf  = (app.name || '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    const simdi = app.previousUniversity ? `${app.previousUniversity}${app.previousDepartment ? ` · ${app.previousDepartment}` : ''}` : '';
    return `
      <div class="fc2-top">
        <div class="fc2-photo">
          ${(app.gender || app.avatar) ? renderFacultyPortrait(app, 72) : `<span class="aday-harf" aria-hidden="true">${harf}</span>`}
          <div class="fc2-rating" style="--rc:${renk};" title="Genel puan"><b>${puan}</b></div>
        </div>
        <div class="fc2-id">
          <div class="fc2-name" title="${app.name || ''}">${app.name || 'İsimsiz'}</div>
          <div class="fc2-line"><span class="badge badge-${app.title || 'dr_ogr_uyesi'}">${_BS_UNVAN[app.title] || app.title || ''}</span><span>${bolumSatiri}</span></div>
          ${simdi ? `<div class="fc2-sub" title="${simdi}">Şu an: ${simdi}</div>` : ''}
          ${ek}
        </div>
      </div>
      <div class="fc2-boxes">
        <div class="fc2-box"><span class="fc2-box-v">${app.publications ?? '—'}</span><span class="fc2-box-l">Yayın</span></div>
        <div class="fc2-box"><span class="fc2-box-v">${app.citations ?? '—'}</span><span class="fc2-box-l">Atıf</span></div>
        <div class="fc2-box"><span class="fc2-box-v">${app.hIndex ?? '—'}</span><span class="fc2-box-l">h-indeksi</span></div>
        <div class="fc2-box"><span class="fc2-box-v">${app.activeProjects ?? '—'}</span><span class="fc2-box-l">Proje</span></div>
      </div>`;
  };

  /** Maaş beklentisi satırı: beklenti, barem ve ne zaman başlayabileceği. */
  const adayMaas = (app, musaitlik = true) => `
    <div class="aday-maas">
      <span>Maaş beklentisi <b>${formatMoney(app.salaryExpectation)}/ay</b></span>
      ${app.salaryRange ? `<span>barem ${formatMoney(app.salaryRange.min)} - ${formatMoney(app.salaryRange.max)}</span>` : ''}
      ${musaitlik ? (app.availableIn === 0
        ? '<span class="ob-rozet ob-rozet--iyi ob-rozet--kucuk">Hemen başlayabilir</span>'
        : '<span class="ob-rozet ob-rozet--uyari ob-rozet--kucuk">Gelecek dönem başlar</span>') : ''}
    </div>`;

  /** İlana gelen başvurunun kartı. Düğme kimlikleri (btn-accept-/btn-reject-) ve data-applicant-id main.js'e bağlı. */
  const basvuruKarti = (app) => {
    const dept          = depts.find(d => d.id === app.department);
    const bolumAdi      = dept?.shortName || app.department || '—';
    const stats         = app.stats || {};
    const researchStat  = stats.research   ?? 50;
    const teachingStat  = stats.teaching   ?? 50;
    const manageStat    = stats.management ?? 30;
    const teachable     = _getTeachableCourses(app, myDeptIds);

    // Bölüm ortalamasıyla karşılaştırma (araştırma)
    const deptFaculty = faculty.filter(f => (f.department || f.departmentId) === app.department);
    const deptAvgResearch = deptFaculty.length > 0
      ? Math.round(deptFaculty.reduce((s, f) => s + (f.stats?.research ?? 50), 0) / deptFaculty.length)
      : 50;

    // Değerlendirme puanı: araştırma ortalamanın üstünde mi, kaç ders verebilir
    const researchAboveAvg = researchStat > deptAvgResearch;
    const teachableCount   = teachable.length;
    const evalScore        = (researchAboveAvg ? 1 : 0) + (teachableCount >= 3 ? 1 : 0) + (teachableCount >= 1 ? 1 : 0);
    const evalTur          = evalScore >= 3 ? 'iyi' : evalScore >= 2 ? 'uyari' : 'kritik';
    const evalLabel        = evalScore >= 3 ? 'çok uygun' : evalScore >= 2 ? 'orta' : 'zayıf';
    const doktora          = app.education ? String(app.education.phd || '').replace(' — ', ', ') : '';

    return `
      <article class="ob-kart ob-kart--govde aday-kart">
        ${adayUst(app, bolumAdi)}
        <div class="faculty-card-stats">
          ${createStatBar('Araştırma', researchStat, 100, _statColor(researchStat))}
          ${createStatBar('Eğitim', teachingStat, 100, _statColor(teachingStat))}
          ${createStatBar('Yönetim', manageStat, 100, _statColor(manageStat))}
          ${createStatBar('Öğrenci puanı', app.teachingScore ?? teachingStat, 100, _statColor(app.teachingScore ?? teachingStat))}
        </div>
        ${app.education ? `
          <div class="fc2-courses">
            <div class="fc2-courses-title">Doktora</div>
            <div class="fc2-course">${doktora} (${app.education.year})${app.yearsExperience != null ? ` · ${app.yearsExperience} yıl deneyim` : ''}</div>
          </div>` : ''}
        ${teachable.length > 0 ? `
          <div class="fc2-courses">
            <div class="fc2-courses-title">Verebileceği dersler (${teachable.length})</div>
            <div class="fc2-tags aday-etiketler">
              ${teachable.slice(0, 5).map(c => `<span class="fc2-tag" title="${c.deptShortName} · ${c.type === 'zorunlu' ? 'zorunlu' : 'seçmeli'} ders">${c.courseName}${c.deptId !== app.department ? ` · ${c.deptShortName}` : ''}</span>`).join('')}
              ${teachable.length > 5 ? `<span class="fc2-tag">+${teachable.length - 5} ders daha</span>` : ''}
            </div>
          </div>` : ''}
        ${(app.researchAreas || app.specializations || []).length > 0 ? `
          <div class="fc2-courses">
            <div class="fc2-courses-title">Araştırma alanları</div>
            <div class="fc2-tags aday-etiketler">
              ${(app.researchAreas || app.specializations || []).map(a => `<span class="fc2-tag">${a}</span>`).join('')}
            </div>
          </div>` : ''}
        ${adayMaas(app)}
        <div class="ob-not ob-not--${evalTur}">
          <div class="ob-not-baslik">Uyum: ${evalLabel}</div>
          <ul>
            <li>${researchAboveAvg ? '✓' : '✗'} Araştırma puanı bölüm ortalamasının ${researchAboveAvg ? 'üstünde' : 'altında'} (ortalama ${deptAvgResearch})</li>
            <li>${teachableCount > 0 ? `✓ ${teachableCount} ders verebilir` : '✗ Açık bölümlerin müfredatıyla ders örtüşmesi yok'}</li>
            ${app.activeProjects > 0 ? `<li>✓ ${app.activeProjects} etkin proje</li>` : ''}
          </ul>
        </div>
        <div class="aday-dugmeler">
          <button class="btn btn-success" data-applicant-id="${app.id}" id="btn-accept-${app.id}">Kabul et</button>
          <button class="btn btn-danger" data-applicant-id="${app.id}" id="btn-reject-${app.id}">Reddet</button>
        </div>
      </article>`;
  };

  /** İlan dışı başvurunun kartı: bölüm oyuncu seçer. Kimlikler (spont-dept-, btn-spont-accept-/reject-) main.js'e bağlı. */
  const spontaneKarti = (app) => {
    const tercih = app.preferredDept || app.department;
    const dept   = depts.find(d => d.id === tercih);
    const stats  = app.stats || {};
    const researchStat = stats.research ?? 50;
    const teachingStat = stats.teaching ?? 50;
    const deptSelectOpts = depts.filter(d => d.isOpen).map(d =>
      `<option value="${d.id}" ${d.id === tercih ? 'selected' : ''}>${d.shortName || d.name}</option>`
    ).join('');
    const turnsLeft = 2 - ((state.meta?.turn || 1) - (app.applicationDate || (state.meta?.turn || 1)));
    const kalan = `<span class="ob-rozet ${turnsLeft <= 1 ? 'ob-rozet--kritik' : 'ob-rozet--uyari'} ob-rozet--kucuk aday-kalan">${turnsLeft} dönem kaldı</span>`;
    return `
      <article class="ob-kart ob-kart--govde aday-kart">
        ${adayUst(app, `Tercih: ${dept?.shortName || tercih || '—'}`, kalan)}
        <div class="faculty-card-stats">
          ${createStatBar('Araştırma', researchStat, 100, _statColor(researchStat))}
          ${createStatBar('Eğitim', teachingStat, 100, _statColor(teachingStat))}
        </div>
        ${adayMaas(app, false)}
        <div class="aday-sec">
          <label for="spont-dept-${app.id}">Bölüm</label>
          <select class="filter-select ob-secim" id="spont-dept-${app.id}">
            ${deptSelectOpts}
          </select>
        </div>
        <div class="aday-dugmeler">
          <button class="btn btn-success" data-spont-id="${app.id}" id="btn-spont-accept-${app.id}">Kabul et</button>
          <button class="btn btn-danger" data-spont-id="${app.id}" id="btn-spont-reject-${app.id}">Reddet</button>
        </div>
      </article>`;
  };

  const maasOzeti = faculty.length === 0 ? '' : `
    <div class="ob-kutular">
      ${_obKutu('Aylık maaş gideri', formatMoney(totalMonthlySalary), `${faculty.length} öğretim üyesi`, 'ob-kritik')}
      ${_obKutu('Ortalama maaş', formatMoney(avgSalary), 'aylık')}
      ${_obKutu('En yüksek maaş', formatMoney(highestPaid?.salary), highestPaid?.name || '—')}
      ${_obKutu('En düşük maaş', formatMoney(lowestPaid?.salary), lowestPaid?.name || '—')}
    </div>`;

  const basvurularHtml = applications.length === 0 ? '' : `
    <section class="ob-bolum">
      <div class="section-title"><i class="ikon ikon--kadro" aria-hidden="true"></i>Bekleyen başvurular <span class="ob-sayi">${applications.length}</span></div>
      <div class="ob-aciklama">Kadro ilanlarınıza gelen başvurular. Yanıtlanmayan başvurular 2 dönem sonra geri çekilir.</div>
      <div id="applications-list" class="ob-kartlar">
        ${applications.map(basvuruKarti).join('')}
      </div>
    </section>`;

  const spontaneHtml = spontaneousApplicants.length === 0 ? '' : `
    <section class="ob-bolum">
      <div class="section-title"><i class="ikon ikon--bildirim" aria-hidden="true"></i>İlan dışı başvurular <span class="ob-sayi">${spontaneousApplicants.length}</span></div>
      <div class="ob-aciklama">Saygınlığınız arttıkça ilan açmadan da başvuru gelir; hocanın bölümünü siz seçersiniz. Başvurular 2 dönem içinde yanıtlanmazsa geri çekilir.</div>
      <div id="spontaneous-list" class="ob-kartlar">
        ${spontaneousApplicants.map(spontaneKarti).join('')}
      </div>
    </section>`;

  const ilanlarHtml = openPositions.length === 0 ? '' : `
    <section class="ob-bolum">
      <div class="section-title"><i class="ikon ikon--bildirim" aria-hidden="true"></i>Açık kadro ilanları <span class="ob-sayi">${openPositions.length}</span></div>
      <div class="ob-kart">
        ${openPositions.map(pos => {
          const dept = depts.find(d => d.id === pos.department);
          const alanlar = pos.allFields ? 'tüm alanlar' : (pos.fields && pos.fields.length > 0 ? pos.fields.join(', ') : pos.field || '');
          return `<div class="ob-satir"><span>${_BS_UNVAN[pos.title] || pos.title} · ${dept?.shortName || pos.department} · ${alanlar}</span><b>${formatMoney(pos.offeredSalary)}/ay</b></div>`;
        }).join('')}
        <div class="ob-aciklama">İlana başvurular dönem sonunda gelir; ilan 2 dönem açık kalır.</div>
      </div>
    </section>`;

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-title">Akademik Kadro</div>
        <div class="panel-subtitle">${faculty.length} öğretim üyesi${applications.length + spontaneousApplicants.length > 0 ? ` · ${applications.length + spontaneousApplicants.length} başvuru yanıt bekliyor` : ''}</div>
      </div>
      <div class="panel-dugmeler">
        <button class="btn btn-secondary" id="btn-open-position">Kadro ilanı ver</button>
        <button class="btn btn-secondary" id="btn-new-dept-program">Yeni bölüm / program</button>
        <button class="btn btn-primary" id="btn-open-transfer">Transfer pazarı</button>
      </div>
    </div>

    <div class="ob-yigin">
      ${maasOzeti}
      ${basvurularHtml}
      ${spontaneHtml}
      ${ilanlarHtml}

      <section class="ob-bolum">
        <div class="section-title"><i class="ikon ikon--kadro" aria-hidden="true"></i>Hocalar <span class="ob-sayi">${faculty.length}</span></div>
        <div class="kadro-arac">
          <select class="filter-select ob-secim" id="faculty-filter-dept" aria-label="Bölüme göre süz">
            <option value="">Tüm bölümler</option>
            ${deptOpts}
          </select>
          <select class="filter-select ob-secim" id="faculty-filter-title" aria-label="Unvana göre süz">
            <option value="">Tüm unvanlar</option>
            <option value="profesor">Profesör</option>
            <option value="docent">Doçent</option>
            <option value="dr_ogr_uyesi">Dr. Öğr. Üyesi</option>
            <option value="argö">Araştırma Görevlisi</option>
          </select>
          <input type="text" class="search-input ob-arama" id="faculty-search"
                 placeholder="Ad ya da alan ara..." aria-label="Hoca ara">
          <span class="kadro-arac-sayi" id="faculty-count-label">${faculty.length} hoca</span>
          <div class="ob-anahtar" role="group" aria-label="Görünüm">
            <button type="button" id="btn-faculty-view-card" class="secili" aria-pressed="true">Kart</button>
            <button type="button" id="btn-faculty-view-list" aria-pressed="false">Liste</button>
          </div>
        </div>
        <!-- Kartlar _renderCurrentView ile bölümlere göre gruplu çizilir -->
        <div id="faculty-view-container"></div>
      </section>
    </div>
  `;

  // Transfer pazarı
  on(el('btn-open-transfer'), 'click', () => {
    if (onTransferMarket) onTransferMarket();
  });

  // Kadro ilanı ver
  on(el('btn-open-position'), 'click', () => {
    if (onOpenPosition) onOpenPosition();
  });

  // Feature 2: Yeni Bölüm / Program Aç
  on(el('btn-new-dept-program'), 'click', () => {
    showNewDeptProgramModal(state);
  });

  // Hoca kartı tıklama
  delegate(el('faculty-view-container'), '.faculty-card', 'click', (e, card) => {
    const fid = card.dataset.facultyId;
    if (fid && onFacultyDetail) onFacultyDetail(fid);
  });

  // Liste görünümü satır tıklama
  delegate(el('faculty-view-container'), '.faculty-list-row', 'click', (e, row) => {
    const fid = row.dataset.facultyId;
    if (fid && onFacultyDetail) onFacultyDetail(fid);
  });

  // Görünüm toggle
  let _currentView = 'card';
  let _sortKey = null;
  let _sortAsc = true;

  function _getFilteredFaculty() {
    const deptF  = el('faculty-filter-dept')?.value || '';
    const titleF = el('faculty-filter-title')?.value || '';
    const search = (el('faculty-search')?.value || '').toLowerCase();
    return faculty.filter(f => {
      if (deptF  && f.department !== deptF) return false;
      if (titleF && f.title !== titleF) return false;
      if (search && !f.name.toLowerCase().includes(search) &&
          !f.field?.toLowerCase().includes(search)) return false;
      return true;
    });
  }

  function _renderCurrentView() {
    const filtered = _getFilteredFaculty();
    const container = el('faculty-view-container');
    const countLabel = el('faculty-count-label');
    if (countLabel) countLabel.textContent = `${filtered.length} hoca`;

    if (_currentView === 'list') {
      // Sırala
      let sorted = [...filtered];
      if (_sortKey) {
        sorted.sort((a, b) => {
          let va, vb;
          if (_sortKey === 'name') { va = a.name || ''; vb = b.name || ''; }
          else if (_sortKey === 'title') { va = a.title || ''; vb = b.title || ''; }
          else if (_sortKey === 'dept') { va = (depts.find(d => d.id === a.department)?.shortName || a.department || ''); vb = (depts.find(d => d.id === b.department)?.shortName || b.department || ''); }
          else if (_sortKey === 'rating') { va = calculateOverallRating(a); vb = calculateOverallRating(b); }
          else if (_sortKey === 'research') { va = a.stats?.research ?? 50; vb = b.stats?.research ?? 50; }
          else if (_sortKey === 'teaching') { va = a.stats?.teaching ?? 50; vb = b.stats?.teaching ?? 50; }
          else if (_sortKey === 'management') { va = a.stats?.management ?? 50; vb = b.stats?.management ?? 50; }
          else if (_sortKey === 'publications') { va = a.publications ?? 0; vb = b.publications ?? 0; }
          else if (_sortKey === 'citations') { va = a.citations ?? 0; vb = b.citations ?? 0; }
          else if (_sortKey === 'salary') { va = a.salary ?? 0; vb = b.salary ?? 0; }
          else if (_sortKey === 'courses') { va = (a.currentLoad?.assignedCourses || []).length; vb = (b.currentLoad?.assignedCourses || []).length; }
          else { va = 0; vb = 0; }
          if (typeof va === 'string') return _sortAsc ? va.localeCompare(vb, 'tr') : vb.localeCompare(va, 'tr');
          return _sortAsc ? va - vb : vb - va;
        });
      }

      // Başlık: tıklanınca o sütuna göre sıralar (dinleyici .faculty-list-th üzerinde)
      function colHead(key, label, sayisal = true) {
        const isCurrent = _sortKey === key;
        const arrow = isCurrent ? (_sortAsc ? ' ▲' : ' ▼') : '';
        return `<th class="faculty-list-th ob-sirala${sayisal ? ' n' : ''}${isCurrent ? ' sirali' : ''}" data-sort-key="${key}"
          aria-sort="${isCurrent ? (_sortAsc ? 'ascending' : 'descending') : 'none'}" title="${label}: sırala">${label}${arrow}</th>`;
      }

      // Özet
      const totalPubs = sorted.reduce((s, f) => s + (f.publications || 0), 0);
      const totalSalary = sorted.reduce((s, f) => s + (f.salary || 0), 0);
      const avgRating = sorted.length > 0
        ? Math.round(sorted.reduce((s, f) => s + calculateOverallRating(f), 0) / sorted.length)
        : 0;

      container.innerHTML = sorted.length === 0
        ? '<div class="ob-bos ob-bos--kucuk">Bu süzgeçle hoca bulunamadı.</div>'
        : `
        <div class="ob-tablo-kap">
          <table class="ob-tablo ob-tablo--genis kadro-liste">
            <thead>
              <tr>
                <th class="n">#</th>
                ${colHead('name', 'Hoca', false)}
                ${colHead('title', 'Unvan', false)}
                ${colHead('dept', 'Bölüm', false)}
                ${colHead('rating', 'Genel')}
                ${colHead('research', 'Araştırma')}
                ${colHead('teaching', 'Eğitim')}
                ${colHead('management', 'Yönetim')}
                ${colHead('publications', 'Yayın')}
                ${colHead('citations', 'Atıf')}
                ${colHead('salary', 'Maaş (ay)')}
                ${colHead('courses', 'Ders')}
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              ${sorted.map((f, idx) => {
                const dept   = depts.find(d => d.id === f.department);
                const r      = calculateOverallRating(f);
                const isHead = f.id === dept?.headId;
                const ders   = (f.currentLoad?.assignedCourses || []).length;
                const durum  = isHead
                  ? '<span class="ob-rozet ob-rozet--vurgu ob-rozet--kucuk">başkan</span>'
                  : f.promotionEligible ? '<span class="ob-rozet ob-rozet--iyi ob-rozet--kucuk">yükseltmeye uygun</span>' : '<span class="ob-soluk">—</span>';
                const deger  = v => `<td class="n ${_obKademe(v ?? 50, 70, 55)}">${v ?? '—'}</td>`;
                return `<tr class="faculty-list-row ob-git" data-faculty-id="${f.id}" title="${f.name}: ayrıntılar">
                  <td class="n ob-soluk">${idx + 1}</td>
                  <td class="ob-tek"><span class="kadro-liste-hoca">${renderFacultyPortrait(f, 28, 'portre--yuvarlak')}<span class="ob-ad">${f.name}</span></span></td>
                  <td class="ob-tek">${_BS_UNVAN[f.title] || f.title}</td>
                  <td class="ob-tek">${dept?.shortName || f.department || '—'}</td>
                  <td class="n ob-kalin ${_obKademe(r, 70, 55)}">${r}</td>
                  ${deger(f.stats?.research)}
                  ${deger(f.stats?.teaching)}
                  ${deger(f.stats?.management)}
                  <td class="n">${formatNumber(f.publications ?? 0)}</td>
                  <td class="n">${formatNumber(f.citations ?? 0)}</td>
                  <td class="n ob-tek">${formatMoney(f.salary)}</td>
                  <td class="n${ders === 0 ? ' ob-kritik ob-kalin' : ''}">${ders}</td>
                  <td>${durum}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div class="ob-tablo-dip">${sorted.length} hoca · ortalama genel puan ${avgRating} · toplam yayın ${formatNumber(totalPubs)} · aylık maaş gideri ${formatMoney(totalSalary)} · başlığa tıklayınca sıralanır, satıra tıklayınca hocanın ayrıntıları açılır</div>
      `;

      // Sıralama başlık tıklama
      qsa('.faculty-list-th').forEach(th => {
        th.addEventListener('click', () => {
          const key = th.dataset.sortKey;
          if (_sortKey === key) {
            _sortAsc = !_sortAsc;
          } else {
            _sortKey = key;
            _sortAsc = false; // ilk tıklamada azalan
          }
          _renderCurrentView();
        });
      });

    } else {
      // Kart görünümü: bölümlere göre gruplu (açık bölümler state sırasıyla, sonra "Diğer")
      const openDepts = depts.filter(d => d.isOpen);

      const byDept = {};
      const unassigned = [];
      for (const f of filtered) {
        const deptId = f.department || f.departmentId;
        const dept = openDepts.find(d => d.id === deptId);
        if (dept) {
          if (!byDept[deptId]) byDept[deptId] = { dept, members: [] };
          byDept[deptId].members.push(f);
        } else {
          unassigned.push(f);
        }
      }

      const groupsHtml = openDepts
        .filter(d => byDept[d.id])
        .map(d => {
          const { dept, members } = byDept[d.id];
          const icon = bolumIkonu(d.id, 24, dept.icon || '🏛');
          const name = dept.name || dept.shortName || d.id;
          const groupId = `faculty-group-${dept.id}`;
          return `
            <details open class="faculty-dept-group">
              <summary class="faculty-dept-group-header">
                <span class="faculty-dept-group-icon">${icon}</span>
                <span class="faculty-dept-group-name">${name}</span>
                <span class="faculty-dept-group-count">(${members.length})</span>
                <button type="button" class="bs-git-dugme bs-git-dugme--ince" data-bolum-git="${dept.id}" data-bolum-sekme="kadro"
                        title="${name}: Bölüm Sayfası">Bölüm Sayfası →</button>
              </summary>
              <div class="faculty-grid faculty-dept-grid" id="${groupId}">
                ${members.map(f => renderFacultyCard(f, depts)).join('')}
              </div>
            </details>`;
        }).join('');

      const unassignedHtml = unassigned.length > 0 ? `
        <details open class="faculty-dept-group">
          <summary class="faculty-dept-group-header">
            <span class="faculty-dept-group-icon">❓</span>
            <span class="faculty-dept-group-name">Diğer</span>
            <span class="faculty-dept-group-count">(${unassigned.length})</span>
          </summary>
          <div class="faculty-grid faculty-dept-grid">
            ${unassigned.map(f => renderFacultyCard(f, depts)).join('')}
          </div>
        </details>` : '';

      container.innerHTML = `
        ${groupsHtml}${unassignedHtml}
        ${filtered.length === 0 ? '<div class="ob-bos ob-bos--kucuk">Bu süzgeçle hoca bulunamadı.</div>' : ''}
      `;
    }
  }

  // Filtre fonksiyonunu güncelle (view farkındalı)
  on(el('faculty-filter-dept'),  'change', _renderCurrentView);
  on(el('faculty-filter-title'), 'change', _renderCurrentView);
  on(el('faculty-search'), 'input', _renderCurrentView);

  // Kart / Liste anahtarı: seçili düğme .secili ve aria-pressed ile işaretlenir
  const gorunumSec = (gorunum) => {
    _currentView = gorunum;
    const kart = el('btn-faculty-view-card');
    const liste = el('btn-faculty-view-list');
    kart?.classList.toggle('secili', gorunum === 'card');
    liste?.classList.toggle('secili', gorunum === 'list');
    kart?.setAttribute('aria-pressed', String(gorunum === 'card'));
    liste?.setAttribute('aria-pressed', String(gorunum === 'list'));
    _renderCurrentView();
  };
  on(el('btn-faculty-view-card'), 'click', () => gorunumSec('card'));
  on(el('btn-faculty-view-list'), 'click', () => gorunumSec('list'));

  // İlk görünüm: bölümlere göre gruplu kartlar (grup başlığından Bölüm Sayfası açılır)
  _renderCurrentView();

  // Başvuru kabul / ret butonları — event delegation
  const appsList = el('applications-list');
  if (appsList) {
    appsList.addEventListener('click', (e) => {
      const acceptBtn = e.target.closest('[id^="btn-accept-"]');
      const rejectBtn = e.target.closest('[id^="btn-reject-"]');
      if (acceptBtn) {
        const appId = acceptBtn.dataset.applicantId;
        if (onFacultyDetail && typeof onFacultyDetail._onAcceptApplicant === 'function') {
          onFacultyDetail._onAcceptApplicant(appId);
        } else {
          panel.dispatchEvent(new CustomEvent('accept-applicant', { detail: { appId }, bubbles: true }));
        }
      }
      if (rejectBtn) {
        const appId = rejectBtn.dataset.applicantId;
        panel.dispatchEvent(new CustomEvent('reject-applicant', { detail: { appId }, bubbles: true }));
      }
    });
  }

  // Spontane başvuru kabul / ret butonları
  const spontList = el('spontaneous-list');
  if (spontList) {
    spontList.addEventListener('click', (e) => {
      const acceptBtn = e.target.closest('[id^="btn-spont-accept-"]');
      const rejectBtn = e.target.closest('[id^="btn-spont-reject-"]');
      if (acceptBtn) {
        const appId = acceptBtn.dataset.spontId;
        const deptSelect = el(`spont-dept-${appId}`);
        const targetDeptId = deptSelect ? deptSelect.value : null;
        panel.dispatchEvent(new CustomEvent('accept-spontaneous', { detail: { appId, targetDeptId }, bubbles: true }));
      }
      if (rejectBtn) {
        const appId = rejectBtn.dataset.spontId;
        panel.dispatchEvent(new CustomEvent('reject-spontaneous', { detail: { appId }, bubbles: true }));
      }
    });
  }
}

/**
 * Tek hoca kartı HTML'i üretir.
 * @param {object} f     — Hoca objesi
 * @param {Array}  depts — Bölüm listesi
 * @returns {string} HTML string
 */
export function renderFacultyCard(f, depts = []) {
  const dept = depts.find(d => d.id === f.department) ||
               (f.departmentId ? depts.find(d => d.id === f.departmentId) : null);
  const deptName  = dept?.shortName || f.department || '—';
  const titleKey  = f.title || 'dr_ogr_uyesi';
  const titleDisp = _BS_UNVAN[titleKey] || f.title;
  const happiness = Math.round(f.happiness ?? 60);
  const happClass = happiness >= 70 ? 'high' : happiness >= 45 ? 'mid' : 'low';

  // Genel puan ve eğilim
  const overallRating = f.overallRating || calculateOverallRating(f);
  const ratingTrend   = getFacultyRatingTrend(f);
  const ratingColor   = overallRating >= 85 ? '#f0c040' : overallRating >= 70 ? '#4ecca3' : overallRating >= 55 ? '#f5a623' : '#ff6b81';

  const stats = f.stats || {};
  const statDefs = [
    { key: 'research',   label: 'Araştırma' },
    { key: 'teaching',   label: 'Eğitim' },
    { key: 'management', label: 'Yönetim' },
    { key: 'mentoring',  label: 'Mentorluk' },
    { key: 'popularity', label: 'Popülarite' },
    { key: 'loyalty',    label: 'Sadakat' },
    { key: 'motivation', label: 'Motivasyon' },
  ];

  // Belirsizlik kontrolü (henüz kesinleşmemiş statlar)
  const revealed = f.revealed || {};
  const maasBin  = Math.round((f.salary || 0) / 1000);
  const maasAralik = f.salaryRange ? `Aralık: ${formatMoney(f.salaryRange.min)} - ${formatMoney(f.salaryRange.max)}` : '';
  const courses  = f.currentLoad?.assignedCourses || [];
  const emeklilik = Number.isFinite(f.age) && f.age >= 62 ? `emekliliğe ${Math.max(0, 67 - f.age)} yıl` : '';
  const altBilgi = [f.age ? `${f.age} yaş` : '', emeklilik, f.field || ''].filter(Boolean).join(' · ');

  return `
    <div class="faculty-card fc2" data-faculty-id="${f.id}">
      <div class="fc2-top">
        <div class="fc2-photo">
          ${renderFacultyPortrait(f, 96)}
          <div class="fc2-rating" style="--rc:${ratingColor};" title="Genel puan">
            <b>${overallRating}</b><i class="ob-egilim--${ratingTrend.trend}">${ratingTrend.arrow}</i>
          </div>
        </div>
        <div class="fc2-id">
          <div class="fc2-name" title="${f.name || ''}">${f.name || 'İsimsiz'}</div>
          <div class="fc2-line">
            <span class="badge badge-${titleKey}">${titleDisp}</span>
            <span>${deptName}</span>
          </div>
          ${altBilgi ? `<div class="fc2-sub">${altBilgi}</div>` : ''}
          ${f.archetype ? `<span class="fc2-chip">${f.archetype}</span>` : ''}
        </div>
      </div>

      <div class="fc2-boxes">
        <div class="fc2-box"><span class="fc2-box-v">${f.publications ?? 0}</span><span class="fc2-box-l">Yayın</span></div>
        <div class="fc2-box"><span class="fc2-box-v">${f.hIndex ?? '—'}</span><span class="fc2-box-l">h-indeksi</span></div>
        <div class="fc2-box" title="${maasAralik}"><span class="fc2-box-v">${maasBin} bin</span><span class="fc2-box-l">₺ / ay</span></div>
        <div class="fc2-box fc2-box--${happClass}" title="Mutluluk: ${happiness}/100"><span class="fc2-box-v">${happiness}</span><span class="fc2-box-l">Mutluluk</span></div>
      </div>

      <div class="faculty-card-stats">
        ${statDefs.map(sd => {
          const val = stats[sd.key] ?? 50;
          // Araştırma ve eğitimde belirsizlik aralığı
          const isUncertain = (sd.key === 'research' || sd.key === 'teaching') &&
                              revealed[sd.key] && !revealed[sd.key].exact;
          const displayVal = isUncertain
            ? `${Math.round(revealed[sd.key].min)}-${Math.round(revealed[sd.key].max)}`
            : Math.round(val);
          return createStatBar(sd.label, val, 100, _statColor(val), isUncertain, displayVal);
        }).join('')}
      </div>

      ${(f.specializations && f.specializations.length > 0) ? `
        <div class="fc2-tags">
          ${f.specializations.map(sp => `<span class="fc2-tag">${sp}</span>`).join('')}
        </div>
      ` : ''}

      <div class="fc2-courses">
        ${courses.length === 0
          ? '<div class="fc2-course-none">Atanmış ders yok</div>'
          : `<div class="fc2-courses-title">Dersler (${courses.length})</div>
             ${courses.map(c => {
               const es = c.matchQuality === 2 ? ['✓', 'ob-iyi', 'uzmanlığıyla tam eşleşiyor'] : c.matchQuality === 1 ? ['~', 'ob-uyari', 'uzmanlığıyla kısmen eşleşiyor'] : ['✗', 'ob-kritik', 'uzmanlığı dışında'];
               return `<div class="fc2-course">
                 <span class="fc2-course-es ${es[1]}" title="Ders ${es[2]}">${es[0]}</span>
                 <span>${c.courseName}</span>
                 ${_dersTuruRozeti(c.type)}
               </div>`;
             }).join('')}`}
      </div>

      ${(f._salaryUnhappy || f.promotionEligible || f._promotionAnxiety || (f.activeAwards && f.activeAwards.length > 0)) ? `
      <div class="fc2-flags">
        ${f._salaryUnhappy ? '<span class="ob-rozet ob-rozet--kritik">Maaşından memnun değil</span>' : ''}
        ${f.promotionEligible ? '<span class="ob-rozet ob-rozet--iyi">Yükseltmeye uygun</span>' : ''}
        ${f._promotionAnxiety ? '<span class="ob-rozet ob-rozet--uyari">Yükseltme bekliyor</span>' : ''}
        ${(f.activeAwards || []).map(a => `<span class="ob-rozet ob-rozet--bilgi">🏆 ${a.label}</span>`).join('')}
      </div>
      ` : ''}
    </div>
  `;
}

/**
 * v0.6.1: hoca ayrıntısı penceresinin gövdesi (main.js _onFacultyDetail çağırır). Hoca kartıyla aynı
 * parçalar (portre, genel puan, çubuklar, ders satırları) ve ortak bileşenler. Düğme ve kaydırıcı
 * kimlikleri (salary-slider-, salary-display-, salary-cost-, btn-update-salary-, btn-award-*-,
 * btn-promote-, btn-fire-) main.js'teki dinleyicilere bağlı.
 * @param {object} f      hoca
 * @param {object} state  oyun durumu
 * @returns {string} HTML
 */
export function hocaAyrintisiHtml(f, state) {
  const titleMap   = { argö: 'Araştırma Görevlisi', dr_ogr_uyesi: 'Dr. Öğr. Üyesi', docent: 'Doçent', profesor: 'Profesör' };
  const depts      = state.departments || [];
  const dept       = depts.find(d => d.id === f.department);
  const deptName   = dept ? dept.name : (f.department || '—');
  const titleLabel = titleMap[f.title] || f.title || '—';
  const stats      = f.stats || {};
  const revealed   = f.revealed || {};

  // Çubuklar hoca kartıyla aynı: yedi puan, aynı renk eşikleri; araştırma ve eğitimde belirsizlik aralığı
  const statDefs = [
    { key: 'research',   label: 'Araştırma' },
    { key: 'teaching',   label: 'Eğitim' },
    { key: 'management', label: 'Yönetim' },
    { key: 'mentoring',  label: 'Mentorluk' },
    { key: 'popularity', label: 'Popülarite' },
    { key: 'loyalty',    label: 'Sadakat' },
    { key: 'motivation', label: 'Motivasyon' },
  ];
  const cubuklar = statDefs.map(sd => {
    const val = stats[sd.key] ?? 50;
    const isUncertain = (sd.key === 'research' || sd.key === 'teaching') && revealed[sd.key] && !revealed[sd.key].exact;
    const displayVal  = isUncertain ? `${Math.round(revealed[sd.key].min)}-${Math.round(revealed[sd.key].max)}` : Math.round(val);
    return createStatBar(sd.label, val, 100, _statColor(val), isUncertain, displayVal);
  }).join('');

  const happiness  = Math.round(f.happiness ?? 60);
  const courseLoad = f.currentLoad?.courses ?? 0;
  const assignedCourses = f.currentLoad?.assignedCourses || [];
  const specializations = f.specializations || [];

  // Maaş baremi
  const salaryRange   = f.salaryRange || {};
  const salaryMin     = salaryRange.min || 20000;
  const salaryMax     = salaryRange.max || 80000;
  const salaryMid     = Math.round((salaryMin + salaryMax) / 2);
  const currentSalary = f.salary || salaryMid;
  const tl            = v => `${Math.round(v).toLocaleString('tr-TR')} ₺`;

  // Yayın ve unvan yükseltme koşulları
  const pubs   = f.publications || 0;
  const cits   = f.citations || 0;
  const expYrs = f.yearsExperience || 0;
  let promotionTarget = null;
  let promotionReqs   = null;
  if (f.title === 'dr_ogr_uyesi') {
    promotionTarget = 'Doçent';
    promotionReqs   = { pubs: 40, cits: 200, exp: 10, curPubs: pubs, curCits: cits, curExp: expYrs };
  } else if (f.title === 'docent') {
    promotionTarget = 'Profesör';
    promotionReqs   = { pubs: 80, cits: 500, exp: 15, curPubs: pubs, curCits: cits, curExp: expYrs };
  }

  const isDeptHead   = depts.some(d => d.headId === f.id);
  const awardHistory = f.awardHistory || [];

  // Genel puan ve eğilim (hoca kartıyla aynı renkler)
  const overallRating = calculateOverallRating(f);
  const ratingColor   = overallRating >= 85 ? '#f0c040' : overallRating >= 70 ? '#4ecca3' : overallRating >= 55 ? '#f5a623' : '#ff6b81';
  const trendInfo     = getFacultyRatingTrend(f);

  const genderLabel = (f.avatar?.gender === 'male') ? 'Erkek' : (f.avatar?.gender === 'female') ? 'Kadın' : null;
  const ageLine = [genderLabel, f.age ? `${f.age} yaş` : null, expYrs ? `${expYrs} yıl deneyim` : null].filter(Boolean).join(' · ');

  const yukseltme = promotionTarget ? `
    <div class="ob-kart">
      <div class="ob-kart-baslik"><span>Unvan yükseltme</span><span class="ob-rozet ob-rozet--kucuk">${titleLabel} → ${promotionTarget}</span></div>
      ${['pubs', 'cits', 'exp'].map(key => {
        const labels = { pubs: 'Yayın', cits: 'Atıf', exp: 'Deneyim (yıl)' };
        const cur    = promotionReqs['cur' + key.charAt(0).toUpperCase() + key.slice(1)];
        const req    = promotionReqs[key];
        const pct    = Math.min(100, Math.round(cur / req * 100));
        const tur    = pct >= 100 ? 'iyi' : pct >= 70 ? 'uyari' : '';
        return `
          ${_obSatir(labels[key], `${cur}<span class="ob-soluk">/${req}</span>${pct >= 100 ? ' ✓' : ''}`, tur ? `ob-${tur}` : '')}
          <div class="ob-cubuk${tur ? ` ob-cubuk--${tur}` : ''}"><span style="width:${pct}%"></span></div>`;
      }).join('')}
      ${f.promotionEligible ? `
        <button type="button" class="btn btn-success hoca-tam" id="btn-promote-${f.id}" data-faculty-id="${f.id}">
          Yükselt: ${promotionTarget}
        </button>
      ` : '<div class="ob-aciklama">Koşullar henüz karşılanmadı.</div>'}
    </div>` : (f.title === 'profesor' ? '<div class="ob-not">Profesör en yüksek akademik unvandır.</div>' : '');

  return `
    <div class="pencere-yigin hoca-ayrinti">
      <div class="pencere-kimlik">
        <div class="fc2-photo hoca-foto">
          ${renderFacultyPortrait(f, 104)}
          <div class="fc2-rating" style="--rc:${ratingColor};" title="Genel puan">
            <b>${overallRating}</b><i class="ob-egilim--${trendInfo.trend}">${trendInfo.arrow}</i>
          </div>
        </div>
        <div class="ob-kimlik-govde">
          <div class="ob-kimlik-ad">${f.name || '—'}</div>
          <div class="ob-kimlik-alt"><span class="badge badge-${f.title || 'dr_ogr_uyesi'}">${titleLabel}</span>${deptName}</div>
          ${ageLine ? `<div class="ob-kimlik-alt">${ageLine}</div>` : ''}
          ${isDeptHead ? '<span class="ob-rozet ob-rozet--vurgu ob-rozet--kucuk hoca-baskan">Bölüm başkanı</span>' : ''}
        </div>
      </div>

      <div class="ob-kutular">
        ${_obKutu('Yayın', formatNumber(pubs), '', '', 'ob-kutu--cukur')}
        ${_obKutu('Atıf', formatNumber(cits), '', '', 'ob-kutu--cukur')}
        ${_obKutu('h-indeksi', f.hIndex || 0, '', '', 'ob-kutu--cukur')}
      </div>

      ${specializations.length > 0 ? `
        <div>
          <div class="ob-kart-baslik"><span>Uzmanlık alanları</span></div>
          <div class="fc2-tags hoca-etiketler">${specializations.map(s => `<span class="fc2-tag">${s}</span>`).join('')}</div>
        </div>` : ''}

      <div class="ob-kart pencere-cubuklar">
        <div class="ob-kart-baslik"><span>Puanlar</span></div>
        ${cubuklar}
      </div>

      <div class="ob-kutular">
        ${_obKutu('Mutluluk', `${happiness}<small>/100</small>`, '', _obKademe(happiness, 70, 45))}
        ${_obKutu('Ders yükü', `${courseLoad}<small>ders</small>`, '')}
        ${_obKutu('Maaş', tl(f.salary || 0), `aylık${f.salaryRange ? ` · barem ${tl(salaryMin)} - ${tl(salaryMax)}` : ''}${f.seniority ? ` · kıdem ${f.seniority} yıl` : ''}`)}
      </div>
      ${f._salaryUnhappy ? '<div class="ob-not ob-not--kritik">Maaşından memnun değil.</div>' : ''}

      <div class="ob-kart">
        <div class="ob-kart-baslik"><span>Atanmış dersler</span><span class="ob-sayi">${assignedCourses.length}</span></div>
        ${assignedCourses.length === 0
          ? '<div class="ob-aciklama">Bu dönem atanmış ders yok.</div>'
          : assignedCourses.map(c => `
            <div class="ob-satir hoca-ders"><span>${c.courseName}</span><b>${_eslesmeRozeti(c.matchQuality ?? 0)} ${_dersTuruRozeti(c.type)}</b></div>`).join('')}
      </div>

      <div class="section-title">Hoca yönetimi</div>

      <div class="ob-kart">
        <div class="ob-kart-baslik"><span>Maaş ayarlama</span></div>
        ${_obSatir('Şu an', `${tl(currentSalary)}/ay`)}
        ${_obSatir('Barem', `${tl(salaryMin)} - ${tl(salaryMax)}`)}
        <div class="ob-ayar hoca-maas">
          <input type="range" id="salary-slider-${f.id}" class="ob-kaydirici" aria-label="Yeni maaş"
                 min="${salaryMin}" max="${salaryMax}" step="1000" value="${currentSalary}"
                 oninput="document.getElementById('salary-display-${f.id}').textContent=(+this.value).toLocaleString('tr-TR')+' ₺/ay'; document.getElementById('salary-cost-${f.id}').textContent='Yıllık ek maliyet: '+(((+this.value)-${currentSalary})*12).toLocaleString('tr-TR')+' ₺';">
          <span class="ob-ayar-d" id="salary-display-${f.id}">${tl(currentSalary)}/ay</span>
        </div>
        <div class="ob-aciklama" id="salary-cost-${f.id}">Yıllık ek maliyet: 0 ₺</div>
        <button type="button" class="btn btn-primary hoca-tam" id="btn-update-salary-${f.id}" data-faculty-id="${f.id}">
          Maaşı güncelle
        </button>
      </div>

      <div class="ob-kart">
        <div class="ob-kart-baslik"><span>Ödüller</span></div>
        <div class="hoca-oduller">
          <button type="button" class="btn btn-secondary hoca-odul" id="btn-award-arastirma-${f.id}" data-faculty-id="${f.id}" data-award="arastirma">
            <span>Araştırma ödülü</span><span class="hoca-odul-etki">+5 moral · 50.000 ₺ prim</span>
          </button>
          <button type="button" class="btn btn-secondary hoca-odul" id="btn-award-egitim-${f.id}" data-faculty-id="${f.id}" data-award="egitim">
            <span>Eğitim ödülü</span><span class="hoca-odul-etki">+5 moral · 30.000 ₺ prim</span>
          </button>
          <button type="button" class="btn btn-secondary hoca-odul" id="btn-award-yilin-${f.id}" data-faculty-id="${f.id}" data-award="yilin">
            <span>Yılın hocası</span><span class="hoca-odul-etki">+10 moral · +3 saygınlık · 100.000 ₺ prim</span>
          </button>
        </div>
        ${awardHistory.length > 0 ? `<div class="ob-aciklama">Geçmiş ödüller: ${awardHistory.map(a => a.label).join(', ')}</div>` : ''}
      </div>

      ${yukseltme}

      <div class="ob-kart ob-kart--uyari">
        <div class="ob-kart-baslik"><span class="ob-kritik">Sözleşme feshi</span></div>
        ${isDeptHead ? `
          <div class="ob-aciklama">Bu hoca bölüm başkanı; sözleşmeyi feshetmek için önce başkanlık görevini sonlandırın.</div>
        ` : `
          ${_obSatir('Kıdem tazminatı (3 aylık maaş)', tl(currentSalary * 3), 'ob-kritik')}
          ${_obSatir('Etkilenen dersler', `${assignedCourses.length} ders`)}
          ${_obSatir('Moral etkisi', `bölüm -${happiness > 80 ? 8 : 5}, üniversite -${happiness > 80 ? 3 : 1}`)}
          <button type="button" class="btn btn-danger hoca-tam" id="btn-fire-${f.id}" data-faculty-id="${f.id}">
            Sözleşmeyi feshet
          </button>
        `}
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// AKREDİTASYON UI YARDIMCISI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fakülteler sekmesindeki bölüm kartının akreditasyon bölümü: alınmış ve değerlendirmedeki akreditasyonlar
 * rozetle, başvurulabilecekler düğmeyle. Düğme sınıfları (acc-apply-btn, acc-renew-btn) ve data-dept-id /
 * data-body-id renderBolumlerPanel'deki dinleyicilere bağlı.
 */
function renderDeptAccreditation(dept, state) {
  const accData = dept.accreditation;
  if (!accData) return '';

  const turn = state?.meta?.turn || 1;

  function turnToLabel(t) {
    // t = 1 → 1. yıl güz; t = 2 → 1. yıl bahar; ...
    const y = Math.ceil(t / 2);
    const s = (t % 2 === 1) ? 'güz' : 'bahar';
    return `${y}. yıl ${s}`;
  }

  const durumlar = [];
  const dugmeler = [];

  Object.entries(ACCREDITATION_BODIES).forEach(([bodyId, body]) => {
    // Bu bölüm için geçerli mi?
    const applicable = body.applicableTo.includes('all') ||
                       body.applicableTo.includes(dept.category || '');
    if (!applicable) return;

    const acc = accData[bodyId];
    if (!acc) return;

    if (acc.status === 'granted') {
      const remaining = acc.expiresAt != null ? (acc.expiresAt - turn) : null;
      const acil = remaining != null && remaining <= 2;
      durumlar.push(`
        <div class="fak-akr-satir">
          <span class="ob-rozet ${acil ? 'ob-rozet--uyari' : 'ob-rozet--iyi'}">${body.name}: akredite</span>
          <span class="ob-aciklama">bitiş ${acc.expiresAt != null ? turnToLabel(acc.expiresAt) : '—'}${remaining != null ? ` (${remaining} dönem kaldı)` : ''}</span>
          ${acil ? `<button class="btn btn-xs btn-warning acc-renew-btn"
            data-dept-id="${dept.id}" data-body-id="${bodyId}">Yenile (${formatMoney(body.renewalCost)})</button>` : ''}
        </div>`);
    } else if (acc.status === 'applied' || acc.status === 'under_review') {
      const elapsed = turn - (acc.appliedAt || turn);
      const pt = acc.processTime || body.processingTime.max;
      durumlar.push(`
        <div class="fak-akr-satir">
          <span class="ob-rozet ob-rozet--uyari">${body.name}: değerlendirmede</span>
          <span class="ob-aciklama">${elapsed}/${pt} dönem</span>
        </div>`);
    } else if (acc.status === 'expired') {
      durumlar.push(`
        <div class="fak-akr-satir"><span class="ob-rozet ob-rozet--kritik">${body.name}: süresi doldu</span></div>`);
      dugmeler.push(`
        <button class="btn btn-sm btn-warning acc-apply-btn"
          data-dept-id="${dept.id}" data-body-id="${bodyId}">${body.name}: yenile (${formatMoney(body.renewalCost)})</button>`);
    } else if (acc.status === 'rejected') {
      dugmeler.push(`
        <button class="btn btn-sm btn-secondary acc-apply-btn"
          data-dept-id="${dept.id}" data-body-id="${bodyId}">${body.name}: yeniden başvur (${formatMoney(body.cost)})</button>`);
    } else {
      // none
      dugmeler.push(`
        <button class="btn btn-sm btn-secondary acc-apply-btn"
          data-dept-id="${dept.id}" data-body-id="${bodyId}">${body.name} başvurusu (${formatMoney(body.cost)})</button>`);
    }
  });

  if (durumlar.length === 0 && dugmeler.length === 0) {
    return '';
  }

  return `
    <div class="dept-accreditation fak-ek">
      <div class="ob-kart-baslik"><span>Akreditasyon</span></div>
      ${durumlar.join('')}
      ${dugmeler.length > 0 ? `<div class="ob-dizi fak-akr-dugmeler">${dugmeler.join('')}</div>` : ''}
    </div>`;
}

/**
 * Bölüm memnuniyeti: year1..year4 sınıflarının memnuniyetinin öğrenci sayısıyla
 * ağırlıklı ortalaması. Hiç sınıf verisi yoksa null.
 * @param {object} byDept: state.students.byDepartment[deptId]
 */
function _bolumMemnuniyeti(byDept) {
  if (!byDept) return null;
  let toplam = 0, agirlik = 0;
  for (const yk of ['year1', 'year2', 'year3', 'year4']) {
    const sinif = byDept[yk];
    const sayi  = Number(sinif?.count) || 0;
    const memn  = Number(sinif?.satisfaction);
    if (sayi > 0 && Number.isFinite(memn)) { toplam += memn * sayi; agirlik += sayi; }
  }
  return agirlik > 0 ? toplam / agirlik : null;
}

/**
 * Bölüm başlığındaki akreditasyon rozeti, gerçek akreditasyon kaydından (dept.accreditation).
 * Eski accreditationStatus alanı hiç güncellenmiyor ("pending" kalıyordu), kullanılmaz.
 */
function _akreditasyonRozeti(dept) {
  const kayitlar = Object.entries(dept.accreditation || {});
  const alinan = kayitlar.filter(([, a]) => a?.status === 'granted')
    .map(([id]) => ACCREDITATION_BODIES[id]?.name || id);
  if (alinan.length > 0) {
    return `<span class="ob-rozet ob-rozet--iyi" title="Akredite: ${alinan.join(', ')}">Akredite: ${alinan.join(', ')}</span>`;
  }
  if (kayitlar.some(([, a]) => a?.status === 'applied' || a?.status === 'under_review')) {
    return '<span class="ob-rozet ob-rozet--uyari">Akreditasyon değerlendirmede</span>';
  }
  return '';
}

/** v0.7: Bölümler ve Fakülteler listelerinde başkana devredilmiş bölümün rozeti (doğrudan yönetimde boş). */
function _devirRozeti(dept) {
  const p = politikaOku(dept);
  if (p.kip !== 'devret') return '';
  return `<span class="ob-rozet ob-rozet--bilgi bolum-devir-rozeti" title="Bölüm başkana devredildi; odak ${ODAKLAR[p.odak].ad.toLocaleLowerCase('tr')}, kararlar dönem özetinde">Başkanda</span>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2b. FAKÜLTELER PANELİ (Fakülte yapısı + Bölüm başkanı + Kadro tablosu)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fakülteler sekmesi (panel kimliği tab-bolumler): fakülte başlıkları altında bölüm kartları;
 * göstergeler, hoca tablosu, lisansüstü programlar, akreditasyon ve bölüm başkanı atama.
 * @param {object}   state              — Oyun durumu
 * @param {Function} onAssignHead       — Bölüm başkanı atama callback (deptId, facultyId)
 * @param {Function} onReassignFaculty  — Hoca bölüm değiştirme callback (facultyId, newDeptId)
 */
export function renderBolumlerPanel(state, onAssignHead, onReassignFaculty) {
  const panel = el('tab-bolumler');
  if (!panel) return;

  const depts      = state.departments || [];
  const faculty    = state.faculty || [];
  const fakulteler = state.fakulteler || {};

  // Fakülteye ait olmayan bölümler için "Diğer bölümler" grubu
  const assignedDepts = new Set();
  for (const f of Object.values(fakulteler)) {
    for (const dId of f.departments) assignedDepts.add(dId);
  }
  const unassignedDepts = depts.filter(d => !assignedDepts.has(d.id));

  // Fakülte gruplarını oluştur
  const fakGroups = [];
  for (const [fId, fData] of Object.entries(FACULTIES)) {
    const activeDepts = depts.filter(d => fData.departments.includes(d.id));
    if (activeDepts.length === 0) continue;
    fakGroups.push({ id: fId, name: fData.name, icon: fData.icon, depts: activeDepts });
  }
  if (unassignedDepts.length > 0) {
    fakGroups.push({ id: 'diger', name: 'Diğer bölümler', icon: '🏫', depts: unassignedDepts });
  }

  /** Tek bölüm kartı. Sınıflar ve data-* öznitelikleri (dept-detail-card, btn-reassign-faculty,
   *  select-head-candidate, btn-assign-head) aşağıdaki dinleyicilere ve sınamalara bağlı. */
  function deptCard(dept) {
    const deptFaculty = faculty.filter(f => f.department === dept.id);
    const head        = dept.headId ? faculty.find(f => f.id === dept.headId) : null;
    const unvanlar    = [['profesor', 'Prof.'], ['docent', 'Doç.'], ['dr_ogr_uyesi', 'Dr.&nbsp;Öğr.'], ['argö', 'Arş.&nbsp;Gör.']]
      .map(([t, ad]) => [deptFaculty.filter(f => f.title === t).length, ad])
      .filter(([n]) => n > 0).map(([n, ad]) => `${n}&nbsp;${ad}`).join(' · ');

    // Öğrenci sayısı
    const byDept = state.students?.byDepartment?.[dept.id];
    const siniflar = ['year1', 'year2', 'year3', 'year4'].map(k => byDept?.[k]?.count || 0);
    const totalStudents = siniflar.reduce((a, b) => a + b, 0);

    // Hoca başına öğrenci
    const oran = deptFaculty.length > 0 ? totalStudents / deptFaculty.length : null;

    // Ağırlıklı not ortalaması (öğrenci sayısına göre)
    let _gpaSum = 0, _gpaCnt = 0;
    for (const yk of ['year1', 'year2', 'year3', 'year4']) {
      const yd = byDept?.[yk];
      if (yd && yd.count > 0 && yd.avgGPA > 0) { _gpaSum += yd.avgGPA * yd.count; _gpaCnt += yd.count; }
    }
    const avgGPA = _gpaCnt > 0 ? _gpaSum / _gpaCnt : null;

    // Ort. YKS (1. sınıf)
    const yks = byDept?.year1?.avgYKS || byDept?.avgYKS || 0;

    // Memnuniyet (v0.5.2): bölümün sınıflarındaki memnuniyetin öğrenci sayısıyla ağırlıklı
    // ortalaması. Sınıf verisi yoksa eskisi gibi üniversite geneli.
    const bolumMemnuniyeti = _bolumMemnuniyeti(byDept);
    const satisfaction = Math.round(bolumMemnuniyeti ?? state.students?.overallSatisfaction ?? dept.studentSatisfaction ?? 50);

    // Bölüm başkanı adayları
    const headCandidates = deptFaculty.filter(f => ['profesor', 'docent'].includes(f.title));
    const headSelectOptions = headCandidates.map(f =>
      `<option value="${f.id}" ${f.id === dept.headId ? 'selected' : ''}>${_BS_UNVAN[f.title] || f.title} ${f.name} (yönetim ${tamPuan(f.stats?.management)})</option>`
    ).join('');

    // Bölümün ortalama genel puanı
    const deptAvgRating = getDeptAvgRating(dept.id, faculty);

    // Hoca tablosu
    const facultyRows = deptFaculty.map(f => {
      const isHead  = f.id === dept.headId;
      const fRating = f.overallRating || calculateOverallRating(f);
      return `<tr>
        <td class="ob-ad ob-tek">${f.name}</td>
        <td><span class="badge badge-${f.title}">${_BS_UNVAN[f.title] || f.title}</span></td>
        <td class="n">${tamPuan(f.stats?.research)}</td>
        <td class="n">${tamPuan(f.stats?.teaching)}</td>
        <td class="n">${tamPuan(f.stats?.management)}</td>
        <td class="n">${f.currentLoad?.courses ?? 0}</td>
        <td class="n ob-kalin ${_obKademe(fRating, 70, 55)}">${fRating} ${_egilimHtml(f)}</td>
        <td>${isHead ? '<span class="ob-rozet ob-rozet--vurgu ob-rozet--kucuk">başkan</span>' : '<span class="ob-soluk">—</span>'}</td>
        <td class="n">
          <button class="btn btn-xs btn-secondary btn-reassign-faculty"
                  data-faculty-id="${f.id}" data-current-dept="${dept.id}"
                  title="Bölüm değiştir">Taşı</button>
        </td>
      </tr>`;
    }).join('') || '<tr><td colspan="9" class="ob-soluk">Bu bölümde hoca yok.</td></tr>';

    return `
      <article class="ob-kart dept-detail-card" data-dept-id="${dept.id}">
        <header class="fak-bolum-ust">
          <div class="fak-bolum-kimlik">
            <span>${bolumIkonu(dept.id, 30, dept.icon || '🏛️')}</span>
            <button type="button" class="bs-link bs-link--baslik" data-bolum-git="${dept.id}" title="${dept.name}: Bölüm Sayfası">${dept.name}</button>
            ${_akreditasyonRozeti(dept)}
            ${_devirRozeti(dept)}
          </div>
          <div class="fak-bolum-sag">
            <div class="fak-ort-puan ${_obKademe(deptAvgRating, 70, 55)}" title="Bölüm hocalarının ortalama genel puanı"><b>${deptAvgRating}</b><span>ort. puan</span></div>
            <button type="button" class="btn btn-secondary btn-sm bs-git-dugme" data-bolum-git="${dept.id}">Bölüm Sayfası →</button>
          </div>
        </header>

        <div class="ob-kutular">
          ${_obKutu('Bölüm başkanı', head ? head.name : 'Atanmamış',
            head ? `yönetim ${tamPuan(head.stats?.management)}/100` : (headCandidates.length ? 'aşağıdan atanabilir' : 'Prof. ya da Doç. yok'),
            `ob-kutu-s--metin${head ? '' : ' ob-kritik'}`, 'ob-kutu--cukur')}
          ${_obKutu('Kadro', formatNumber(deptFaculty.length), unvanlar || 'hoca yok', '', 'ob-kutu--cukur')}
          ${_obKutu('Öğrenci', formatNumber(totalStudents), `${siniflar.join(' · ')} <span class="ob-tek">(1-4. sınıf)</span>`, '', 'ob-kutu--cukur')}
          ${_obKutu('Hoca başına öğrenci', oran != null ? formatNumber(oran) : '—', 'ideal en çok 25', oran != null && oran > 30 ? 'ob-uyari' : '', 'ob-kutu--cukur')}
          ${_obKutu('Ort. YKS sırası', yks > 0 ? formatNumber(yks) : '—', '1. sınıfın ortalaması', '', 'ob-kutu--cukur')}
          ${_obKutu('Not ortalaması', avgGPA != null ? formatGPA(avgGPA) : '—', '4,00 üzerinden', avgGPA != null ? _obKademe(avgGPA, 3.0, 2.5) : '', 'ob-kutu--cukur')}
          ${_obKutu('Memnuniyet', satisfaction, bolumMemnuniyeti != null ? 'sınıfların ağırlıklı ortalaması' : 'bölüm verisi yok, üniversite geneli', _obKademe(satisfaction, 70, 45), 'ob-kutu--cukur')}
        </div>

        <details class="fak-hocalar">
          <summary>Hocalar <span class="ob-sayi">${deptFaculty.length}</span></summary>
          <div class="ob-tablo-kap">
            <table class="ob-tablo ob-tablo--genis">
              <thead>
                <tr>
                  <th>Hoca</th><th>Unvan</th><th class="n">Araştırma</th>
                  <th class="n">Eğitim</th><th class="n">Yönetim</th>
                  <th class="n">Ders</th><th class="n">Genel puan</th>
                  <th>Rol</th>
                  <th><span class="ob-gizli">İşlem</span></th>
                </tr>
              </thead>
              <tbody>${facultyRows}</tbody>
            </table>
          </div>
        </details>

        <!-- Lisansüstü program özeti -->
        ${renderGradProgramCard(dept, state)}

        <!-- Akreditasyon -->
        ${renderDeptAccreditation(dept, state)}

        <div class="fak-bas-ata">
          ${headCandidates.length > 0 ? `
            <label for="bas-sec-${dept.id}">Bölüm başkanı ata</label>
            <select id="bas-sec-${dept.id}" class="filter-select ob-secim select-head-candidate" data-dept-id="${dept.id}">
              <option value="">Seç...</option>
              ${headSelectOptions}
            </select>
            <button class="btn btn-sm btn-primary btn-assign-head" data-dept-id="${dept.id}">Ata</button>
          ` : '<span class="ob-aciklama">Bölümde başkan olabilecek Prof. ya da Doç. yok.</span>'}
        </div>
      </article>`;
  }

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-title">Fakülteler</div>
        <div class="panel-subtitle">${fakGroups.length} fakülte · ${depts.length} açık bölüm</div>
      </div>
    </div>
    <div id="bolumler-content" class="ob-yigin">
      ${fakGroups.map(fg => `
        <section class="ob-bolum">
          <div class="section-title"><i class="ikon ikon--fakulteler" aria-hidden="true"></i>${fg.name} <span class="ob-sayi">${fg.depts.length} bölüm</span></div>
          <div class="ob-yigin ob-yigin--sik">
            ${fg.depts.map(d => deptCard(d)).join('')}
          </div>
        </section>
      `).join('')}
    </div>
  `;

  // Bölüm başkanı atama butonları
  panel.querySelectorAll('.btn-assign-head').forEach(btn => {
    btn.addEventListener('click', () => {
      const deptId = btn.dataset.deptId;
      const sel    = panel.querySelector(`.select-head-candidate[data-dept-id="${deptId}"]`);
      const facId  = sel ? sel.value : '';
      if (!facId) { showNotification('Lütfen bir hoca seçin.', 'warning'); return; }
      if (onAssignHead) onAssignHead(deptId, facId);
    });
  });

  // Akreditasyon başvuru butonları
  panel.querySelectorAll('.acc-apply-btn, .acc-renew-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const deptId = btn.dataset.deptId;
      const bodyId = btn.dataset.bodyId;
      if (window._onShowAccreditationModal) {
        window._onShowAccreditationModal(deptId, bodyId);
      }
    });
  });

  // Hoca taşıma butonları (pencere Bölüm Sayfası ile ortak)
  panel.querySelectorAll('.btn-reassign-faculty').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const hoca = faculty.find(f => f.id === btn.dataset.facultyId);
      if (!hoca) return;
      const bolum = depts.find(d => d.id === btn.dataset.currentDept);
      _hocaTasiPenceresi(hoca, depts, onReassignFaculty, bolum?.headId === hoca.id);
    });
  });
}

/**
 * Hocayı başka bir bölüme taşıma penceresi (Fakülteler sekmesi ve Bölüm Sayfası ortak).
 * Karar main.js üzerinden reassignFacultyToDept'e gider.
 * @param {object}   hoca
 * @param {object[]} depts
 * @param {Function} onReassign  (facultyId, newDeptId)
 * @param {boolean}  [baskanMi]  hoca şu an bölümünün başkanıysa pencere başkanlığın boşalacağını söyler
 */
function _hocaTasiPenceresi(hoca, depts, onReassign, baskanMi = false) {
  const mevcut = hoca.department || hoca.departmentId;
  const digerleri = (depts || []).filter(d => d.id !== mevcut && d.isOpen !== false);
  if (digerleri.length === 0) {
    showNotification('Taşınacak başka bölüm yok.', 'warning');
    return;
  }
  showModal(`${hoca.name}: Bölüm Değiştir`, `
    <p class="pencere-metin">Hoca hangi bölüme taşınsın?${baskanMi
      ? ' <b>Bu hoca bölümünün başkanı;</b> taşınınca başkanlık boşalır.' : ''}</p>
    <select id="reassign-target-dept" class="filter-select ob-secim ob-secim--tam" aria-label="Hedef bölüm">
      ${digerleri.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
    </select>
    <div class="onay-dugmeler">
      <button class="btn btn-secondary" id="btn-reassign-vazgec" type="button">Vazgeç</button>
      <button class="btn btn-primary" id="btn-confirm-reassign" type="button">Taşı</button>
    </div>`);
  on(el('btn-reassign-vazgec'), 'click', hideModal);
  on(el('btn-confirm-reassign'), 'click', () => {
    const hedef = el('reassign-target-dept')?.value;
    if (!hedef) return;
    hideModal();
    if (onReassign) onReassign(hoca.id, hedef);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2c. BÖLÜM SAYFASI (v0.6): bir bölümün her şeyi tek sayfada
// Bölümler sekmesinin panelinde çizilir; yan menüde "Bölümler" seçili kalır.
// Veriler oyun durumundan okunur, eylemler var olan kararlara (main.js) gider.
// ─────────────────────────────────────────────────────────────────────────────

const _BS_UNVAN      = { profesor: 'Prof. Dr.', docent: 'Doç. Dr.', dr_ogr_uyesi: 'Dr. Öğr. Üyesi', 'argö': 'Arş. Gör.' };
const _BS_UNVAN_SIRA = { profesor: 4, docent: 3, dr_ogr_uyesi: 2, 'argö': 1 };
const _BS_SEKMELER   = [
  ['kadro', 'Kadro'], ['dersler', 'Dersler'], ['ogrenciler', 'Öğrenciler ve Kontenjan'], ['arastirma', 'Araştırma'],
  ['yerleske', 'Yerleşke'], ['akreditasyon', 'Akreditasyon'], ['butce', 'Bütçe'],
];
const _BS_LISTE_SINIRI = 10;   // uzun listelerde önce ilk 10 satır, sonra "tümünü göster"

/**
 * Sayfanın arayüz durumu (oyun durumuna yazılmaz): seçili iç sekme, kadro sıralaması,
 * açılmış listeler ve son çizimin girdileri (iç sekme değişince aynı veriyle yeniden çizmek için).
 */
const _bs = { bolumId: null, sekme: 'kadro', sirala: null, artan: false, tumu: {}, son: null, devirTaslak: false, devirAcik: false };

const _bsHocaBolumu = f => f?.department || f?.departmentId || null;
const _bsDersSayisi = f => (f?.currentLoad?.assignedCourses || []).length;
const _bsYuzde      = (oran, basamak = 0) => `%${ondalikYaz((Number(oran) || 0) * 100, basamak)}`;
const _bsNot        = g => (Number.isFinite(g) && g > 0) ? g.toFixed(2).replace('.', ',') : '—';
const _bsKademe     = (x, iyi, orta) => x >= iyi ? 'iyi' : x >= orta ? 'orta' : 'kotu';
const _bsSekmeAdi   = id => (_BS_SEKMELER.find(([k]) => k === id) || [id, id])[1];

/** Uzun listenin altındaki "Tümünü göster (N)" / "İlk 10'u göster" düğmesi; liste kısaysa boş. */
function _bsTumuDugmesi(liste, adet) {
  if (adet <= _BS_LISTE_SINIRI) return '';
  return `<button type="button" class="bs-link bs-link--kucuk bs-tumu" data-bs-eylem="tumu" data-liste="${liste}">${_bs.tumu[liste]
    ? `İlk ${sayiEkle(_BS_LISTE_SINIRI, 'i')} göster` : `Tümünü göster (${adet})`}</button>`;
}

/** Proje ya da başvurunun bölümü: yürütücü hâlâ kadrodaysa bugünkü bölümü, değilse kayıttaki bölüm. */
function _bsKayitBolumu(kayit, faculty) {
  const id   = kayit?.piId ?? kayit?.facultyId;
  const hoca = id != null ? faculty.find(f => f.id === id) : null;
  return hoca ? _bsHocaBolumu(hoca) : (kayit?.facultyDept ?? null);
}

/** Sayfanın bütün bölümlerinin ortak kullandığı veriler. */
function _bsVeri(state, dept) {
  const faculty  = state.faculty || [];
  const hocalar  = faculty.filter(f => _bsHocaBolumu(f) === dept.id);
  const byDept   = state.students?.byDepartment?.[dept.id] || {};
  const siniflar = ['year1', 'year2', 'year3', 'year4'].map(k => byDept[k] || {});
  const sayilar  = siniflar.map(s => Number(s.count) || 0);
  return {
    faculty, hocalar, byDept, siniflar, sayilar,
    bas:        dept.headId ? (faculty.find(f => f.id === dept.headId) || null) : null,
    ogrenci:    sayilar.reduce((a, b) => a + b, 0),
    kapasite:   Number(dept.studentCapacity) > 0 ? Number(dept.studentCapacity) : (Number(dept.stats?.capacity) || 0),
    mufredat:   DEPARTMENT_CURRICULA[dept.id] || [],
    hocasiz:    dept.uncoveredCourses || [],
    bosHoca:    hocalar.filter(f => _bsDersSayisi(f) === 0),
    enAz:       Number.isFinite(dept.minFaculty) ? dept.minFaculty : 3,
    memnuniyet: _bolumMemnuniyeti(byDept),
    kurumlar:   Object.entries(ACCREDITATION_BODIES)
                  .filter(([, b]) => b.applicableTo.includes('all') || b.applicableTo.includes(dept.category || '')),
    basvurular: (state.pendingApplicants || []).filter(a => a.department === dept.id),
    spontane:   (state.spontaneousApplicants || []).filter(a => (a.preferredDept || a.department) === dept.id),
    ilanlar:    (state.openPositions || []).filter(p => p.department === dept.id),
    projeler:   (state.research?.activeResearchProjects || []).filter(p => _bsKayitBolumu(p, faculty) === dept.id),
    tur:        state.meta?.turn || 1,
    bahar:      state.meta?.semester === 'bahar',
    // v0.7: başkana devir (politika, başkan, geçerlilik) ve başkanın son dönem kararları
    devir:      devirDurumu(state, dept),
    gunluk:     Array.isArray(dept.baskanGunlugu) ? dept.baskanGunlugu : [],
  };
}

/**
 * "Dikkat" kutusunun maddeleri: yalnız verilerden türeyen gerçek durumlar, önemliden önemsize.
 * @returns {{ metin: string, sekme: string }[]}
 */
function _bsUyarilar(dept, v) {
  const u = [];
  const ekle = (metin, sekme) => u.push({ metin, sekme });
  const akr = dept.accreditation || {};

  // v0.7: devrin başkanı ayrıldıysa bölüm dönem sonunda doğrudan yönetime döner
  if (v.devir.devredildi && !v.devir.gecerli) {
    ekle(`Başkana devir sona eriyor: ${v.devir.neden}. Bölüm dönem sonunda doğrudan yönetiminize döner.`, 'kadro');
  }
  if (v.hocalar.length < v.enAz) {
    ekle(`Öğretim üyesi sayısı en az sayının altında (${v.hocalar.length}/${v.enAz}); bölüm bu sayıya ulaşmadan yeni öğrenci alamaz.`, 'kadro');
  }
  if (v.kapasite > 0 && v.ogrenci > v.kapasite) {
    ekle(`Öğrenci sayısı (${formatNumber(v.ogrenci)}) kapasiteyi (${formatNumber(v.kapasite)}) aşıyor; kalabalık sınıflar başarısızlığı artırıyor.`, 'yerleske');
  }
  if (v.hocasiz.length > 0) {
    const adlar = v.hocasiz.slice(0, 3).map(c => c.name).join(', ')
      + (v.hocasiz.length > 3 ? ` ve ${v.hocasiz.length - 3} ders daha` : '');
    ekle(`${v.hocasiz.length} ders hocasız, dışarıdan öğretim görevlisi veriyor (${adlar}).`, 'dersler');
  }
  if (!v.bas) {
    const adayVar = v.hocalar.some(f => f.title === 'profesor' || f.title === 'docent');
    ekle(`Bölüm başkanı yok; başkansız bölüm eğitim kalitesinde 5 puan kaybeder.${adayVar ? '' : ' Bölümde başkan olabilecek Prof. ya da Doç. de yok.'}`, 'kadro');
  } else if (Number(v.bas.happiness ?? 60) < 40) {
    ekle(`Bölüm başkanı ${v.bas.name} mutsuz (mutluluk ${tamPuan(v.bas.happiness)}/100).`, 'kadro');
  }
  for (const [id, kurum] of v.kurumlar) {
    const a = akr[id];
    if (a?.status === 'expired') {
      ekle(`${kurum.name} akreditasyonunun süresi doldu; yenilenebilir.`, 'akreditasyon');
    } else if (a?.status === 'granted' && a.expiresAt != null && a.expiresAt - v.tur <= 2) {
      const kalan = a.expiresAt - v.tur;
      ekle(`${kurum.name} akreditasyonunun süresi ${kalan > 0 ? `${kalan} dönem sonra` : 'bu dönem'} doluyor; yenileme şimdi yapılabilir.`, 'akreditasyon');
    }
  }
  // Devredilmiş bölümün başvurularını başkan dönem sonunda değerlendirir; rektörün işi değil
  const bekleyen = v.basvurular.length + v.spontane.length;
  if (bekleyen > 0 && !v.devir.devredildi) ekle(`${bekleyen} kadro başvurusu yanıt bekliyor.`, 'kadro');
  // Müfredattan çok hoca olunca birkaç boşta hoca olağandır; uyarı yalnız boşta kalanlar
  // en az 3 kişi ve kadronun en az %30'u olunca çıkar
  if (v.hocalar.length > 0 && v.mufredat.length > 0 &&
      v.bosHoca.length >= 3 && v.bosHoca.length >= v.hocalar.length * 0.3) {
    ekle(`${v.hocalar.length} hocadan ${sayiEkle(v.bosHoca.length, 'si')} bu dönem ders vermiyor; müfredatta ${v.mufredat.length} ders var.`, 'kadro');
  }
  // Akredite değil ve değerlendirmede başvurusu yok (süresi dolanın kendi maddesi var)
  const durumu = id => akr[id]?.status || 'none';
  const etkin  = v.kurumlar.some(([id]) => ['granted', 'applied', 'under_review', 'expired'].includes(durumu(id)));
  if (v.kurumlar.length > 0 && !etkin) {
    const reddedilen = v.kurumlar.filter(([id]) => durumu(id) === 'rejected').map(([, b]) => b.name);
    ekle(reddedilen.length
      ? `Akreditasyon yok; ${reddedilen.join(', ')} başvurusu reddedildi, yeniden başvurulabilir.`
      : `Akreditasyon başvurusu yok (${v.kurumlar.map(([, b]) => b.name).join(', ')}).`, 'akreditasyon');
  }
  return u;
}

/**
 * Bölümün dönemlik bütçesi. Maaş ekonomi hesabıyla aynı (aylık maaş × SEMESTER_MONTHS), işletme gideri
 * yıllık tutarın yarısı. Gelir bölüme özgü tutulmadığından calculateIncome toplamı öğrenci payına bölünür (tahmin).
 */
function _bsButceHesabi(state, dept, v) {
  let toplamGelir = 0;
  try {
    toplamGelir = Number(calculateIncome(state)?.total) || 0;
  } catch (e) {
    console.warn('[ui] Bölüm Sayfası: gelir hesaplanamadı:', e);
  }
  const acik = new Set((state.departments || []).filter(d => d.isOpen !== false).map(d => d.id));
  let tumOgrenci = 0;
  for (const [id, d] of Object.entries(state.students?.byDepartment || {})) {
    if (!acik.has(id)) continue;
    for (const k of ['year1', 'year2', 'year3', 'year4']) tumOgrenci += Number(d?.[k]?.count) || 0;
  }
  if (tumOgrenci <= 0) tumOgrenci = Number(state.students?.totalEnrolled) || 0;
  const pay       = tumOgrenci > 0 ? v.ogrenci / tumOgrenci : 0;
  const gelir     = Math.round(toplamGelir * pay);
  const aylikMaas = v.hocalar.reduce((s, f) => s + (Number(f.salary) || 0), 0);
  const maas      = Math.round(aylikMaas * SEMESTER_MONTHS);
  const isletme   = Math.round((Number(dept.annualOperatingCost) || 0) / 2);
  const tumMaas   = (state.faculty || []).reduce((s, f) => s + (Number(f.salary) || 0), 0) * SEMESTER_MONTHS;
  return { toplamGelir, pay, gelir, aylikMaas, maas, isletme, net: gelir - maas - isletme, maasPayi: tumMaas > 0 ? maas / tumMaas : 0 };
}

/** Bölümün tamamlanmış binaları: derslik binaları, araştırma merkezleri ve bağlı laboratuvarlar. */
function _bsBinalari(state, dept) {
  const tamam = (state.buildings || []).filter(b => b.isCompleted);
  const atanmis = b => (b.assignedDepartments || []).includes(dept.id);
  return {
    derslik: tamam.filter(b => b.type !== 'lab' && b.type !== 'arastirma_merkezi' && atanmis(b)),
    merkez:  tamam.filter(b => b.type === 'arastirma_merkezi' && atanmis(b)),
    lab:     tamam.filter(b => b.type === 'lab' && (b.linkedDepartments || []).includes(dept.id)),
  };
}

/** Akreditasyon durum rozeti; ayrıntılı ise değerlendirmenin kaçıncı dönemde olduğunu da yazar. */
function _bsAkrRozeti(kurum, a, tur, ayrintili = false) {
  switch (a?.status) {
    case 'granted': {
      const kalan = a.expiresAt != null ? a.expiresAt - tur : null;
      return `<span class="bs-rozet bs-rozet--iyi">${kurum.name}: akredite${kalan != null ? ` (${kalan} dönem kaldı)` : ''}</span>`;
    }
    case 'applied':
    case 'under_review': {
      const sure = ayrintili ? ` (${Math.max(0, tur - (a.appliedAt ?? tur))}/${a.processTime || kurum.processingTime?.max || '?'} dönem)` : '';
      return `<span class="bs-rozet bs-rozet--bekle">${kurum.name}: değerlendirmede${sure}</span>`;
    }
    case 'expired':      return `<span class="bs-rozet bs-rozet--kotu">${kurum.name}: süresi doldu</span>`;
    case 'rejected':     return `<span class="bs-rozet bs-rozet--kotu">${kurum.name}: reddedildi</span>`;
    default:             return `<span class="bs-rozet">${kurum.name}: başvuru yok</span>`;
  }
}

function _bsUst(dept, v, uyariSayisi) {
  const fakulte = FACULTIES[DEPT_TO_FACULTY[dept.id]]?.name || '';
  const bas = v.bas
    ? `Başkan <b>${_BS_UNVAN[v.bas.title] || ''} ${v.bas.name}</b> (yönetim ${tamPuan(v.bas.stats?.management)}, mutluluk ${tamPuan(v.bas.happiness)})`
    : '<span class="bs-kotu-metin">Başkan atanmamış</span>';
  const akr = dept.accreditation || {};
  const devirRozeti = !v.devir.devredildi ? ''
    : v.devir.gecerli ? '<span class="bs-rozet ob-rozet--bilgi">Başkanda</span>'
    : '<span class="bs-rozet bs-rozet--kotu">Devir sona eriyor</span>';
  return `
    <div class="bs-ust">
      <div class="bs-ikon">${bolumIkonu(dept.id, 50, dept.icon || '🏫')}</div>
      <div class="bs-kimlik">
        <h2 class="bs-baslik">${dept.name}</h2>
        <div class="bs-alt">${fakulte ? `${fakulte} · ` : ''}${bas}</div>
        <div class="bs-rozetler">
          ${devirRozeti}
          ${v.kurumlar.map(([id, kurum]) => _bsAkrRozeti(kurum, akr[id], v.tur)).join('')}
          ${uyariSayisi > 0
            ? `<span class="bs-rozet bs-rozet--kotu">${uyariSayisi} uyarı</span>`
            : '<span class="bs-rozet bs-rozet--iyi">Uyarı yok</span>'}
        </div>
      </div>
      ${_bsYonetimAnahtari(v)}
    </div>`;
}

// ── v0.7: Başkana devretme ──────────────────────────────────────────────────

/** Başlıktaki yönetim seçimi: Doğrudan / Başkana devret (ob-anahtar). */
function _bsYonetimAnahtari(v) {
  const devir  = v.devir.devredildi;
  const basYok = !devir && !v.bas;
  return `
    <div class="bs-yonetim">
      <span class="bs-yonetim-e" id="bs-yonetim-e">Yönetim</span>
      <div class="ob-anahtar" role="group" aria-labelledby="bs-yonetim-e">
        <button type="button" class="${devir ? '' : 'secili'}" aria-pressed="${!devir}" data-bs-eylem="kip-dogrudan"
                title="${devir ? 'Bölümü doğrudan yönetiminize alın' : 'Bölümü siz yönetiyorsunuz'}">Doğrudan</button>
        <button type="button" class="${devir ? 'secili' : ''}${basYok ? ' btn--pasif' : ''}" aria-pressed="${devir}" data-bs-eylem="kip-devret"
                title="${basYok ? 'Başkansız bölüm devredilemez' : devir ? 'Başkanın yetkilerini görün ve değiştirin' : 'Bölümü başkana devredin'}">Başkana devret</button>
      </div>
    </div>`;
}

/** Dönemlik alım tavanının yazısı: rozet için tam cümle, kaydırıcı için kısa. */
function _bsTavanYazisi(n, kisa = false) {
  if (kisa) return n > 0 ? `${n} hoca` : 'almaz';
  return n > 0 ? `Dönemde en çok ${n} hoca` : 'Hoca almaz';
}

/** Turun dönem adı: 1. tur 1. Yıl Güz, 2. tur 1. Yıl Bahar (oyun Güz'de başlar). */
function _bsTurDonemi(tur) {
  const t = Math.max(1, Number(tur) || 1);
  return `${Math.ceil(t / 2)}. Yıl ${t % 2 === 1 ? 'Güz' : 'Bahar'}`;
}

/** Başkanın karar listesi (Bölüm Sayfası ve dönem özeti ortak): tür rozeti, ne yapıldı, neden. */
function _baskanKararListesi(kararlar = []) {
  if (!Array.isArray(kararlar) || kararlar.length === 0) return '<p class="ob-aciklama">Bu dönem karar gerekmedi.</p>';
  return `<ul class="baskan-kararlar">${kararlar.map(k => {
    const t = KARAR_TURLERI[k.tur] || KARAR_TURLERI.bilgi;
    return `
      <li class="baskan-karar baskan-karar--${k.tur}">
        <span class="ob-rozet ob-rozet--kucuk${t.sinif ? ` ob-rozet--${t.sinif}` : ''}">${t.ad}</span>
        <div class="baskan-karar-govde"><div>${_escHtml(k.metin || '')}</div>${k.neden ? `<div class="ob-aciklama">Neden: ${_escHtml(k.neden)}</div>` : ''}</div>
      </li>`;
  }).join('')}</ul>`;
}

/** Devredilmiş bölümün son kararları (yalnız şimdiki devrin dönemleri); öncekiler katlanır. */
function _bsSonKararlar(v) {
  const baslangic = Number(v.devir.politika.devirTuru) || 0;
  const gunluk = v.gunluk.filter(k => (Number(k?.tur) || 0) >= baslangic);
  const son = gunluk[0];
  if (!son) {
    return '<p class="ob-aciklama">Başkan ilk kararlarını bu dönemin sonunda verecek; dönem özetinde "Başkanların kararları" bölümünde görünür.</p>';
  }
  const onceki = gunluk.slice(1);
  return `
    <div class="bs-devir-kararlar">
      <div class="bs-altbaslik">Son kararlar · ${donemAdi(son)} sonu</div>
      ${_baskanKararListesi(son.kararlar)}
      ${onceki.length ? `
        <details class="bs-devir-onceki">
          <summary>Önceki dönemler (${onceki.length})</summary>
          ${onceki.map(k => `<div class="bs-altbaslik">${donemAdi(k)} sonu</div>${_baskanKararListesi(k.kararlar)}`).join('')}
        </details>` : ''}
    </div>`;
}

/** Politika formu: odak, öğrenci/hoca hedefi, dönemlik alım tavanı, kontenjan kuralı ve kısa açıklama. */
function _bsDevirFormu(p, v, taslak) {
  const s    = POLITIKA_SINIRLARI;
  const oran = v.hocalar.length > 0 ? v.ogrenci / v.hocalar.length : null;
  const secenek = (ad, deger, secili, baslik, aciklama) => `
    <label class="bs-devir-secenek">
      <input type="radio" name="${ad}" value="${deger}"${secili ? ' checked' : ''}>
      <span><b>${baslik}</b><small>${aciklama}</small></span>
    </label>`;
  return `
    <div class="bs-devir-form" data-bs-devir-form>
      <fieldset class="bs-devir-alan">
        <legend class="ob-ayar-e">Odak</legend>
        <div class="bs-devir-secenekler">
          ${Object.entries(ODAKLAR).map(([id, o]) => secenek('bs-devir-odak', id, p.odak === id, o.ad, o.aciklama)).join('')}
        </div>
      </fieldset>
      <div class="ob-ayar">
        <label class="ob-ayar-e" for="bs-devir-oran">Öğrenci/hoca hedefi</label>
        <input type="range" id="bs-devir-oran" class="ob-kaydirici" min="${s.hocaOrani.enAz}" max="${s.hocaOrani.enCok}" step="1"
               value="${p.hocaOrani}" data-bs-devir-goster="oran">
        <output class="ob-ayar-d" id="bs-devir-oran-d" for="bs-devir-oran">${p.hocaOrani}</output>
        <div class="ob-aciklama">Şu an ${oran != null ? ondalikYaz(oran, 1) : '—'} (${formatNumber(v.ogrenci)} öğrenci, ${v.hocalar.length} hoca). Oran hedefi aşınca başkan hoca arar; tasarruf odağında yalnız hocasız ders ve kurucu kadro için arar.</div>
      </div>
      <div class="ob-ayar">
        <label class="ob-ayar-e" for="bs-devir-tavan">Dönemlik alım tavanı</label>
        <input type="range" id="bs-devir-tavan" class="ob-kaydirici" min="${s.donemlikAlimTavani.enAz}" max="${s.donemlikAlimTavani.enCok}" step="1"
               value="${p.donemlikAlimTavani}" data-bs-devir-goster="tavan">
        <output class="ob-ayar-d" id="bs-devir-tavan-d" for="bs-devir-tavan">${_bsTavanYazisi(p.donemlikAlimTavani, true)}</output>
        <div class="ob-aciklama">Başkan bir dönemde bundan çok hoca almaz; 0 seçilirse hiç almaz.</div>
      </div>
      <fieldset class="bs-devir-alan">
        <legend class="ob-ayar-e">Kontenjan kuralı</legend>
        <div class="bs-devir-secenekler">
          ${Object.entries(KONTENJAN_KURALLARI).map(([id, k]) => secenek('bs-devir-kontenjan', id, p.kontenjanKurali === id, k.ad, k.aciklama)).join('')}
        </div>
      </fieldset>
      <div class="ob-not">
        <div class="ob-not-baslik">Başkan ne yapar</div>
        <ul>
          <li>Her dönem sonunda hocasız ders, kurucu kadro eksiği ya da hedefi aşan öğrenci/hoca oranı varsa eşiği geçen başvuruları kabul eder; yetmezse eksik uzmanlık için ilan verir.</li>
          <li>Bahar başında gelecek yılın kontenjanını kurala göre koyar.</li>
          <li>Odağa göre bir dersin zorluğunu bir kademe değiştirir.</li>
          <li>İşten çıkarmaz, bina kurmaz, program açmaz; bunlar sizde kalır.</li>
        </ul>
        <p>Yönetim puanı düşük başkan zayıf adayı kabul edebilir. Kararlar dönem özetinde yazar; istediğiniz an doğrudan yönetime dönebilirsiniz.</p>
      </div>
      <div class="ob-dugmeler">
        <button type="button" class="btn btn-primary btn-sm" data-bs-eylem="devir-kaydet">${taslak ? 'Başkana devret' : 'Yetkileri kaydet'}</button>
        <button type="button" class="btn btn-secondary btn-sm" data-bs-eylem="devir-vazgec">Vazgeç</button>
      </div>
    </div>`;
}

/** Formdaki seçimler (Bölüm Sayfası açıkken). */
function _bsDevirFormuOku() {
  const kok = qs('#tab-departments [data-bs-devir-form]');
  if (!kok) return null;
  const secili = ad => kok.querySelector(`input[name="${ad}"]:checked`)?.value;
  return {
    odak:               secili('bs-devir-odak'),
    hocaOrani:          Number(kok.querySelector('#bs-devir-oran')?.value),
    donemlikAlimTavani: Number(kok.querySelector('#bs-devir-tavan')?.value),
    kontenjanKurali:    secili('bs-devir-kontenjan'),
  };
}

/**
 * Başkana devretme kartı (başlığın altında). Doğrudan yönetimde yalnız "Başkana devret"e basılınca açılır
 * (taslak form); devredilmiş bölümde başkan, yetkiler ve son kararlar görünür, form "Yetkileri değiştir"
 * ile açılır. Devrin başkanı ayrıldıysa uyarı ve iki seçenek.
 */
function _bsDevirKarti(dept, v) {
  const d = v.devir;
  if (!d.devredildi && !_bs.devirTaslak) return '';

  if (!d.devredildi && !v.bas) {
    return `
      <section class="ob-kart ob-kart--uyari bs-devir" aria-label="Başkana devret">
        <div class="ob-kart-baslik"><span>Başkana devret</span></div>
        <p class="ob-aciklama">Başkansız bölüm devredilemez. Önce bölüme başkan atayın; başkan yalnız Prof. ya da Doç. olabilir.</p>
        <div class="ob-dugmeler">
          <button type="button" class="btn btn-primary btn-sm" data-bs-eylem="baskan">Başkan ata</button>
          <button type="button" class="btn btn-secondary btn-sm" data-bs-eylem="devir-vazgec">Vazgeç</button>
        </div>
      </section>`;
  }

  if (d.devredildi && !d.gecerli) {
    const yeni = v.bas ? `${_BS_UNVAN[v.bas.title] || ''} ${_escHtml(v.bas.name)}` : null;
    const neden = String(d.neden || '');
    return `
      <section class="ob-kart ob-kart--uyari bs-devir" aria-label="Başkana devir">
        <div class="ob-kart-baslik"><span>Başkana devir sona eriyor</span></div>
        <p class="ob-aciklama">${_escHtml(neden.charAt(0).toLocaleUpperCase('tr') + neden.slice(1))}. Bölüm bu dönemin sonunda doğrudan yönetiminize döner.${yeni
          ? ` Bölümün şimdiki başkanı ${yeni}; devri ona aktarabilirsiniz.` : ' Yeniden devretmek için önce başkan atayın.'}</p>
        <div class="ob-dugmeler">
          ${yeni
            ? '<button type="button" class="btn btn-primary btn-sm" data-bs-eylem="devir-yenile">Yeni başkana devret</button>'
            : '<button type="button" class="btn btn-primary btn-sm" data-bs-eylem="baskan">Başkan ata</button>'}
          <button type="button" class="btn btn-secondary btn-sm" data-bs-eylem="kip-dogrudan">Şimdi doğrudan yönetime al</button>
        </div>
      </section>`;
  }

  const p      = d.politika;
  const bas    = v.bas;
  const kademe = yonetimKademesi(bas?.stats?.management);
  const basSatiri = `
    <div class="ob-kimlik bs-devir-bas">
      ${renderFacultyPortrait(bas, 40, 'portre--yuvarlak')}
      <div class="ob-kimlik-govde">
        <div class="bs-devir-bas-ad">${_BS_UNVAN[bas.title] || ''} ${_escHtml(bas.name)}</div>
        <div class="ob-kimlik-alt">yönetim ${tamPuan(bas.stats?.management)}/100 · <b class="ob-${kademe.sinif}">${kademe.ad}</b>: ${kademe.aciklama}</div>
      </div>
      <button type="button" class="btn btn-secondary btn-sm" data-bs-eylem="baskan">Başkanı değiştir</button>
    </div>`;

  if (!d.devredildi) {
    return `
      <section class="ob-kart bs-devir" aria-label="Başkana devret">
        <div class="ob-kart-baslik"><span>Başkana devret</span></div>
        ${basSatiri}
        ${_bsDevirFormu(p, v, true)}
      </section>`;
  }

  return `
    <section class="ob-kart bs-devir bs-devir--etkin" aria-label="Bölüm başkanda">
      <div class="ob-kart-baslik"><span>Bölüm başkanda</span>
        <span class="ob-rozet ob-rozet--bilgi">${_bsTurDonemi(p.devirTuru)} döneminden beri</span></div>
      ${d.baskanDegisti ? '<div class="ob-not ob-not--uyari">Başkan değişti; devir yeni başkanla sürüyor.</div>' : ''}
      ${basSatiri}
      <div class="ob-dizi">
        <span class="ob-rozet">Odak: ${ODAKLAR[p.odak].ad}</span>
        <span class="ob-rozet">Öğrenci/hoca hedefi ${p.hocaOrani}</span>
        <span class="ob-rozet">${_bsTavanYazisi(p.donemlikAlimTavani)}</span>
        <span class="ob-rozet">Kontenjan: ${KONTENJAN_KURALLARI[p.kontenjanKurali].ad.toLocaleLowerCase('tr')}</span>
      </div>
      ${_bsSonKararlar(v)}
      ${_bs.devirAcik ? _bsDevirFormu(p, v, false) : `
        <div class="ob-dugmeler ob-dugmeler--alt">
          <button type="button" class="btn btn-secondary btn-sm" data-bs-eylem="devir-ayarlar">Yetkileri değiştir</button>
          <button type="button" class="btn btn-warning btn-sm" data-bs-eylem="kip-dogrudan">Doğrudan yönetime dön</button>
        </div>`}
    </section>`;
}

function _bsKutu(etiket, deger, alt, sinif = '') {
  return `
    <div class="bs-kutu">
      <div class="bs-kutu-e">${etiket}</div>
      <div class="bs-kutu-s ${sinif}">${deger}</div>
      <div class="bs-kutu-a">${alt}</div>
    </div>`;
}

function _bsGostergeler(dept, v) {
  const st      = dept.stats || {};
  const kalite  = Number(dept.educationQuality);
  const basari  = Number(st.failureRate);
  const gpa     = Number(st.avgGPA);
  const mezun   = Number(st.graduationRate);
  const doluluk = v.kapasite > 0 ? v.ogrenci / v.kapasite : null;
  // Alt satırlarda sayı ile birimi ayrılmasın (bölünmez boşluk)
  const unvanlar = [['profesor', 'Prof.'], ['docent', 'Doç.'], ['dr_ogr_uyesi', 'Dr.&nbsp;Öğr.'], ['argö', 'Arş.&nbsp;Gör.']]
    .map(([t, ad]) => [v.hocalar.filter(f => f.title === t).length, ad])
    .filter(([n]) => n > 0).map(([n, ad]) => `${n}&nbsp;${ad}`).join(' · ');
  return `
    <div class="bs-gosterge">
      ${_bsKutu('Öğrenci', formatNumber(v.ogrenci), `${v.sayilar.join(' · ')} <span class="bs-nowrap">(1-4. sınıf)</span>`)}
      ${_bsKutu('Eğitim kalitesi', Number.isFinite(kalite) ? Math.round(kalite) : '—', '100 üzerinden',
        Number.isFinite(kalite) ? _bsKademe(kalite, 70, 45) : '')}
      ${_bsKutu('Başarısızlık', Number.isFinite(basari) ? _bsYuzde(basari) : '—', `ders zorluğu ${ondalikYaz(st.difficultyRating ?? 3, 1)}/5`,
        Number.isFinite(basari) ? (basari > 0.20 ? 'kotu' : basari > 0.10 ? 'orta' : 'iyi') : '')}
      ${_bsKutu('Not ortalaması', _bsNot(gpa), '4,00 üzerinden', gpa > 0 ? _bsKademe(gpa, 3.0, 2.5) : '')}
      ${_bsKutu('Mezuniyet', Number.isFinite(mezun) ? _bsYuzde(mezun) : '—', `bırakma ${_bsYuzde(st.dropoutRate ?? 0)}`,
        Number.isFinite(mezun) ? _bsKademe(mezun, 0.8, 0.6) : '')}
      ${_bsKutu('Memnuniyet', v.memnuniyet != null ? Math.round(v.memnuniyet) : '—', 'sınıfların ağırlıklı ortalaması',
        v.memnuniyet != null ? _bsKademe(v.memnuniyet, 70, 45) : '')}
      ${_bsKutu('Kadro', formatNumber(v.hocalar.length), unvanlar || 'hoca yok', v.hocalar.length < v.enAz ? 'kotu' : '')}
      ${_bsKutu('Kapasite', doluluk != null ? _bsYuzde(doluluk) : '—',
        v.kapasite > 0 ? `${formatNumber(v.ogrenci)}&nbsp;öğrenci, ${formatNumber(v.kapasite)}&nbsp;yer` : 'hesaplanmadı',
        doluluk == null ? '' : doluluk > 1 ? 'kotu' : doluluk > 0.85 ? 'orta' : 'iyi')}
    </div>`;
}

function _bsDikkat(uyarilar) {
  if (uyarilar.length === 0) return '';
  return `
    <div class="bs-dikkat" role="status">
      <div class="bs-dikkat-baslik">Dikkat</div>
      <ul>
        ${uyarilar.map(u => `<li>${u.metin} <button type="button" class="bs-link bs-link--kucuk" data-bs-sekme="${u.sekme}">${_bsSekmeAdi(u.sekme)} →</button></li>`).join('')}
      </ul>
    </div>`;
}

function _bsSekmeCubugu(v) {
  const sayac = { kadro: v.hocalar.length, dersler: v.mufredat.length, arastirma: v.projeler.length };
  return `
    <div class="bs-sekmeler" role="tablist" aria-label="Bölüm Sayfası sekmeleri">
      ${_BS_SEKMELER.map(([id, ad]) => `
        <button type="button" role="tab" class="bs-sekme${_bs.sekme === id ? ' secili' : ''}" aria-selected="${_bs.sekme === id}"
                data-bs-sekme="${id}">${ad}${sayac[id] != null ? ` <small>${sayac[id]}</small>` : ''}</button>`).join('')}
    </div>`;
}

function _bsYanKartlar(state, dept, v, butce, binalar) {
  const ilkBina  = binalar.derslik[0];
  const binaAdi  = ilkBina
    ? `${_escHtml(ilkBina.name || BUILDINGS[ilkBina.type]?.name || ilkBina.type)}, düzey ${ilkBina.level || 1}${binalar.derslik.length > 1 ? ` (+${binalar.derslik.length - 1})` : ''}`
    : (dept.kapasiteKaynagi === 'yedek' ? 'derslik yok' : 'ortak derslikler');
  const tumProje = (state.research?.activeResearchProjects || []).length;
  return `
    <div class="bs-kart bs-eylem">
      <div class="bs-kart-baslik"><span>Bu bölüm için</span></div>
      <div class="bs-dugmeler">
        <button type="button" class="bs-dugme" data-bs-eylem="ilan">Kadro ilanı ver</button>
        <button type="button" class="bs-dugme" data-bs-eylem="transfer">Transfer pazarı (yalnız bu bölüm)</button>
        <button type="button" class="bs-dugme" data-bs-eylem="baskan">Başkan ata</button>
        <button type="button" class="bs-dugme" data-bs-eylem="kontenjan"${v.bahar ? '' : ' disabled'}>Kontenjan${v.bahar ? '' : " (Bahar'da)"}</button>
        <button type="button" class="bs-dugme" data-bs-sekme="akreditasyon">Akreditasyon</button>
      </div>
      ${v.bahar ? '' : '<div class="bs-not">Kontenjan Bahar döneminde belirlenir.</div>'}
      ${v.devir.devredildi && v.devir.gecerli ? '<div class="bs-not">Bölüm başkanda: ilan, başvuru kabulü, kontenjan ve ders zorluğunu başkan dönem sonunda kararlaştırır; siz de bu eylemleri istediğiniz an yapabilirsiniz.</div>' : ''}
    </div>
    ${_bs.sekme === 'butce' ? '' : `
    <div class="bs-kart">
      <div class="bs-kart-baslik"><span>Bütçe (dönemlik)</span>
        <button type="button" class="bs-link bs-link--kucuk" data-bs-sekme="butce">Ayrıntı →</button></div>
      <div class="bs-satir"><span>Maaşlar</span><b class="eksi">-${formatMoney(butce.maas)}</b></div>
      <div class="bs-satir"><span>İşletme gideri</span><b class="eksi">-${formatMoney(butce.isletme)}</b></div>
      <div class="bs-satir"><span>Gelir payı (tahmin)</span><b class="arti">+${formatMoney(butce.gelir)}</b></div>
      <div class="bs-satir bs-satir--toplam"><span>Net</span>
        <b class="${butce.net >= 0 ? 'arti' : 'eksi'}">${butce.net >= 0 ? '+' : ''}${formatMoney(butce.net)}</b></div>
    </div>`}
    ${_bs.sekme === 'yerleske' || _bs.sekme === 'arastirma' ? '' : `
    <div class="bs-kart">
      <div class="bs-kart-baslik"><span>Yerleşke ve araştırma</span></div>
      <div class="bs-satir"><span>Bina</span><b>${binaAdi}</b></div>
      <div class="bs-satir"><span>Laboratuvar puanı</span><b>${tamPuan(dept.labScore)}/100</b></div>
      <div class="bs-satir"><span>Etkin proje</span><b>${v.projeler.length} (üniversitede ${tumProje})</b></div>
      <div class="bs-kart-alt">
        <button type="button" class="bs-link bs-link--kucuk" data-bs-sekme="yerleske">Yerleşke →</button>
        <button type="button" class="bs-link bs-link--kucuk" data-bs-sekme="arastirma">Araştırma →</button>
      </div>
    </div>`}`;
}

// ── İç sekmeler ─────────────────────────────────────────────────────────────

function _bsKadro(state, dept, v) {
  const anahtarlar = {
    ad:        f => String(f.name || ''),
    unvan:     f => _BS_UNVAN_SIRA[f.title] || 0,
    yas:       f => Number(f.age) || 0,
    ogretim:   f => Number(f.stats?.teaching) || 0,
    arastirma: f => Number(f.stats?.research) || 0,
    mutluluk:  f => Number(f.happiness ?? 60),
    ders:      _bsDersSayisi,
    maas:      f => Number(f.salary) || 0,
  };
  const liste = [...v.hocalar];
  const al = anahtarlar[_bs.sirala];
  if (al) {
    liste.sort((a, b) => {
      const x = al(a), y = al(b);
      const fark = typeof x === 'string' ? x.localeCompare(y, 'tr') : x - y;
      return _bs.artan ? fark : -fark;
    });
  } else {
    // Varsayılan: başkan, sonra unvan (Prof. önce), sonra ad
    liste.sort((a, b) => (b.id === dept.headId) - (a.id === dept.headId)
      || (_BS_UNVAN_SIRA[b.title] || 0) - (_BS_UNVAN_SIRA[a.title] || 0)
      || String(a.name || '').localeCompare(String(b.name || ''), 'tr'));
  }

  const baslik = (anahtar, ad, sayisal = true) => {
    const secili = _bs.sirala === anahtar;
    return `<th class="${sayisal ? 'n' : ''}${secili ? ' sirali' : ''}" aria-sort="${secili ? (_bs.artan ? 'ascending' : 'descending') : 'none'}">
      <button type="button" class="bs-th-dugme" data-bs-sirala="${anahtar}" title="${ad}: sırala">${ad}${secili ? (_bs.artan ? ' ▲' : ' ▼') : ''}</button></th>`;
  };

  const satirlar = liste.map(f => {
    const ders  = _bsDersSayisi(f);
    const mutlu = Number(f.happiness ?? 60);
    return `
      <tr data-bs-hoca="${f.id}" tabindex="0" title="${f.name}: ayrıntılar">
        <td><span class="bs-hoca-ad">${renderFacultyPortrait(f, 28, 'portre--yuvarlak')}<span>${f.name}</span>${f.id === dept.headId ? '<span class="bs-baskan-etiket">başkan</span>' : ''}</span></td>
        <td class="bs-nowrap">${_BS_UNVAN[f.title] || f.title || '—'}</td>
        <td class="n">${f.age ?? '—'}</td>
        <td class="n">${tamPuan(f.stats?.teaching)}</td>
        <td class="n">${tamPuan(f.stats?.research)}</td>
        <td class="n ${_bsKademe(mutlu, 70, 45)}">${tamPuan(f.happiness)}</td>
        <td class="n${ders === 0 ? ' bs-sifir' : ''}">${ders}</td>
        <td class="n bs-nowrap">${formatMoney(f.salary)}</td>
        <td class="bs-islem"><button type="button" class="btn btn-secondary btn-sm bs-tasi" data-bs-eylem="tasi" data-hoca="${f.id}"
            aria-label="${f.name}: başka bölüme taşı">Taşı</button></td>
      </tr>`;
  }).join('');

  const tablo = v.hocalar.length === 0 ? `
    <div class="bs-kart bs-bos">
      <div>Bu bölümde hoca yok. Kadro ilanı verin ya da transfer pazarına bakın.</div>
      <div class="bs-dugmeler">
        <button type="button" class="bs-dugme" data-bs-eylem="ilan">Kadro ilanı ver</button>
        <button type="button" class="bs-dugme" data-bs-eylem="transfer">Transfer pazarı</button>
      </div>
    </div>` : `
    <div class="bs-tablo-kap">
      <table class="bs-tablo bs-tablo--kadro">
        <thead><tr>
          ${baslik('ad', 'Hoca', false)}${baslik('unvan', 'Unvan', false)}${baslik('yas', 'Yaş')}${baslik('ogretim', 'Öğretim')}
          ${baslik('arastirma', 'Araştırma')}${baslik('mutluluk', 'Mutluluk')}${baslik('ders', 'Ders')}${baslik('maas', 'Maaş (ay)')}
          <th><span class="bs-gizli">İşlem</span></th>
        </tr></thead>
        <tbody>${satirlar}</tbody>
      </table>
    </div>
    <div class="bs-tablo-dip">${v.hocalar.length} hoca · aylık maaş toplamı ${formatMoney(v.hocalar.reduce((s, f) => s + (Number(f.salary) || 0), 0))}
      · ortalama genel puan ${getDeptAvgRating(dept.id, state.faculty || [])} · satıra tıklayınca hocanın ayrıntıları açılır</div>`;

  const basvuruSatiri = (a, spontane) => `
    <div class="bs-basvuru">
      ${(a.gender || a.avatar) ? renderFacultyPortrait(a, 44, 'portre--yuvarlak') : ''}
      <div class="bs-basvuru-bilgi">
        <div class="bs-basvuru-ad">${a.name || 'İsimsiz'} <span class="bs-rozet">${_BS_UNVAN[a.title] || a.title || ''}</span>${spontane ? ' <span class="bs-rozet bs-rozet--bekle">ilan dışı</span>' : ''}</div>
        <div class="bs-basvuru-alt">genel puan ${calculateOverallRating(a)} · araştırma ${tamPuan(a.stats?.research)} · eğitim ${tamPuan(a.stats?.teaching)} · beklenti ${formatMoney(a.salaryExpectation)}/ay</div>
      </div>
      <div class="bs-basvuru-dugmeler">
        <button type="button" class="btn btn-success btn-sm" data-bs-eylem="${spontane ? 'spontane-kabul' : 'basvuru-kabul'}" data-basvuru="${a.id}">Kabul et</button>
        <button type="button" class="btn btn-danger btn-sm" data-bs-eylem="${spontane ? 'spontane-ret' : 'basvuru-ret'}" data-basvuru="${a.id}">Reddet</button>
      </div>
    </div>`;
  const tumBasvurular = [...v.basvurular.map(a => [a, false]), ...v.spontane.map(a => [a, true])];
  const gosterilen = _bs.tumu.basvurular ? tumBasvurular : tumBasvurular.slice(0, _BS_LISTE_SINIRI);
  const basvurular = tumBasvurular.length === 0 ? '' : `
    <div class="bs-kart">
      <div class="bs-kart-baslik"><span>Bu bölüme gelen başvurular (${tumBasvurular.length})</span></div>
      <div class="bs-basvuru-liste">
        ${gosterilen.map(([a, spontane]) => basvuruSatiri(a, spontane)).join('')}
      </div>
      ${_bsTumuDugmesi('basvurular', tumBasvurular.length)}
      <div class="bs-not">Yanıtlanmayan başvurular 2 dönem sonra geri çekilir.${v.devir.devredildi && v.devir.gecerli
        ? ' Bölüm başkanda: başvuruları başkan dönem sonunda değerlendirir; siz de şimdi kabul edebilir ya da reddedebilirsiniz.' : ''}</div>
    </div>`;

  const ilanlar = v.ilanlar.length === 0 ? '' : `
    <div class="bs-kart">
      <div class="bs-kart-baslik"><span>Açık kadro ilanları (${v.ilanlar.length})</span></div>
      ${v.ilanlar.map(p => `
        <div class="bs-satir"><span>${_BS_UNVAN[p.title] || p.title} · ${p.allFields ? 'tüm alanlar' : (p.fields?.length ? p.fields.join(', ') : (p.field || ''))}${p.baskan
          ? ' <span class="bs-rozet ob-rozet--bilgi ob-rozet--kucuk">başkanın ilanı</span>' : ''}</span>
          <b>${formatMoney(p.offeredSalary)}/ay</b></div>`).join('')}
      <div class="bs-not">İlana başvurular dönem sonunda gelir; ilan 2 dönem açık kalır.</div>
    </div>`;

  return `${tablo}${basvurular}${ilanlar}`;
}

function _bsDersler(dept, v) {
  const hocasiz = v.hocasiz.length === 0 ? '' : `
    <div class="bs-kart bs-kart--uyari">
      <div class="bs-kart-baslik"><span>Hocasız dersler (${v.hocasiz.length})</span></div>
      <ul class="bs-liste">
        ${v.hocasiz.map(c => `<li><b>${c.name}</b>${c.requiredExpertise ? ` · gereken uzmanlık ${c.requiredExpertise}` : ''}</li>`).join('')}
      </ul>
      <div class="bs-not">Bölümün her hocası en çok 3 ders verebiliyor. Kadroya yeni hoca katılınca bu dersler Sonraki Dönem'deki atamada ona geçer; o zamana dek dışarıdan öğretim görevlisi verir.</div>
      <div class="bs-dugmeler"><button type="button" class="bs-dugme" data-bs-eylem="ilan">Kadro ilanı ver</button></div>
    </div>`;
  return `${hocasiz}<div class="bs-kart bs-kart--govde">${_mufredatHtml(dept)}</div>`;
}

function _bsOgrenciler(state, dept, v) {
  const burslu = (state.meta?.universityType || 'vakif') !== 'devlet';
  const agirlikli = alan => {
    let t = 0, n = 0;
    v.siniflar.forEach((s, i) => { const x = Number(s[alan]); if (v.sayilar[i] > 0 && x > 0) { t += x * v.sayilar[i]; n += v.sayilar[i]; } });
    return n > 0 ? t / n : null;
  };
  const satir = (ad, s, n) => `
    <tr>
      <td class="bs-nowrap">${ad}</td>
      <td class="n">${formatNumber(n)}</td>
      <td class="n ${n > 0 && s.satisfaction != null ? _bsKademe(Number(s.satisfaction), 70, 45) : ''}">${n > 0 && s.satisfaction != null ? Math.round(s.satisfaction) : '—'}</td>
      <td class="n">${n > 0 ? _bsNot(Number(s.avgGPA)) : '—'}</td>
      <td class="n">${n > 0 && Number(s.avgYKS) > 0 ? formatNumber(s.avgYKS) : '—'}</td>
      ${burslu ? `<td class="n">${formatNumber(s.tamBurslu || 0)}</td><td class="n">${formatNumber(s.yariBurslu || 0)}</td><td class="n">${formatNumber(s.ucretli || 0)}</td>` : ''}
    </tr>`;
  const toplamBurs = k => v.siniflar.reduce((s, x) => s + (Number(x[k]) || 0), 0);
  const ortYks = agirlikli('avgYKS');
  const tablo = `
    <div class="bs-tablo-kap">
      <table class="bs-tablo">
        <thead><tr>
          <th>Sınıf</th><th class="n">Öğrenci</th><th class="n">Memnuniyet</th><th class="n">Not ort.</th><th class="n">Ort. YKS sırası</th>
          ${burslu ? '<th class="n">Tam burslu</th><th class="n">Yarı burslu</th><th class="n">Ücretli</th>' : ''}
        </tr></thead>
        <tbody>
          ${v.siniflar.map((s, i) => satir(`${i + 1}. sınıf`, s, v.sayilar[i])).join('')}
          <tr class="bs-toplam">
            <td>Toplam</td><td class="n">${formatNumber(v.ogrenci)}</td>
            <td class="n">${v.memnuniyet != null ? Math.round(v.memnuniyet) : '—'}</td>
            <td class="n">${_bsNot(agirlikli('avgGPA'))}</td>
            <td class="n">${ortYks ? formatNumber(ortYks) : '—'}</td>
            ${burslu ? `<td class="n">${formatNumber(toplamBurs('tamBurslu'))}</td><td class="n">${formatNumber(toplamBurs('yariBurslu'))}</td><td class="n">${formatNumber(toplamBurs('ucretli'))}</td>` : ''}
          </tr>
        </tbody>
      </table>
    </div>
    <div class="bs-tablo-dip">YKS sırası küçüldükçe öğrenci daha başarılıdır. Memnuniyet sınıf sınıf izlenir; bölüm memnuniyeti bunların öğrenci sayısıyla ağırlıklı ortalaması.</div>`;

  const q = state.students?.quotas?.[dept.id];
  const qToplam = q ? (q.tamBurslu || 0) + (q.yariBurslu || 0) + (q.ucretli || 0) : null;
  const kontenjan = `
    <div class="bs-kart">
      <div class="bs-kart-baslik"><span>Kontenjan</span></div>
      <div class="bs-satir"><span>Yıllık kontenjan (yeni alım)</span><b>${qToplam != null ? formatNumber(qToplam) : 'belirlenmedi'}</b></div>
      ${burslu && q ? `<div class="bs-satir"><span>Dağılım</span><b>${q.tamBurslu || 0} tam burslu · ${q.yariBurslu || 0} yarı burslu · ${q.ucretli || 0} ücretli</b></div>` : ''}
      <div class="bs-satir"><span>Şu anki 1. sınıf</span><b>${formatNumber(v.sayilar[0])}</b></div>
      <div class="bs-satir"><span>Bölüm kapasitesi (4 sınıf)</span><b>${v.kapasite > 0 ? `${formatNumber(v.kapasite)} yer` : '—'}</b></div>
      ${v.hocalar.length < v.enAz ? `<div class="bs-not bs-not--uyari">Bölümün en az ${v.enAz} öğretim üyesi olmadıkça kontenjan uygulanmaz, yeni öğrenci alınmaz.</div>` : ''}
      ${v.devir.devredildi && v.devir.gecerli ? `<div class="bs-not">Bölüm başkanda: gelecek yılın kontenjanını başkan Bahar başında koyar (kural: ${KONTENJAN_KURALLARI[v.devir.politika.kontenjanKurali].ad.toLocaleLowerCase('tr')}). Kontenjan penceresinde değiştirirseniz sizin değeriniz geçerli olur.</div>` : ''}
      <div class="bs-kontenjan">
        ${v.bahar
          ? `<button type="button" class="btn btn-primary btn-sm" data-bs-eylem="kontenjan">Kontenjan penceresini aç</button>
             <div class="bs-not">Pencere bütün bölümleri gösterir, bu bölümün kartı vurgulanır. Yeni öğrenciler Bahar sonunda alınır; Sonraki Dönem'e basınca da bu pencere açılır.</div>`
          : `<button type="button" class="btn btn-secondary btn-sm" disabled>Kontenjan penceresi Bahar'da açılır</button>
             <div class="bs-not">Kontenjan Bahar döneminde belirlenir, çünkü yeni öğrenciler Bahar sonunda alınır. Şimdi Güz dönemi; Sonraki Dönem'den sonra bu düğme açılır.</div>`}
      </div>
    </div>`;

  const yildizlar = (state.students?.starStudents || []).filter(s => s.department === dept.id);
  const yildiz = `
    <div class="bs-kart">
      <div class="bs-kart-baslik"><span>Yıldız öğrenciler (${yildizlar.length})</span></div>
      ${yildizlar.length
        ? `<div class="bs-yildizlar">${yildizlar.map(s => renderStudentCard(s, state.departments || [])).join('')}</div>`
        : '<div class="bs-not">Bu bölümde keşfedilmiş yıldız öğrenci yok.</div>'}
    </div>`;
  return `${tablo}${kontenjan}${yildiz}`;
}

function _bsArastirma(state, dept, v) {
  const r       = state.research || {};
  const yayin   = v.hocalar.reduce((s, f) => s + (Number(f.publications) || 0), 0);
  const atif    = v.hocalar.reduce((s, f) => s + (Number(f.citations) || 0), 0);
  const hOrt    = v.hocalar.length ? v.hocalar.reduce((s, f) => s + (Number(f.hIndex) || 0), 0) / v.hocalar.length : null;
  const son     = r.lastApplicationResults || {};
  const kabul   = (son.accepted || []).filter(a => _bsKayitBolumu(a, v.faculty) === dept.id).length;
  const red     = (son.rejected || []).filter(a => _bsKayitBolumu(a, v.faculty) === dept.id).length;
  const biten   = (r.completedProjects || []).filter(p => _bsKayitBolumu(p, v.faculty) === dept.id);
  const patentli = biten.filter(p => p.generatedPatent).length;

  const projeler = _bs.tumu.projeler ? v.projeler : v.projeler.slice(0, _BS_LISTE_SINIRI);
  const projeTablosu = v.projeler.length === 0
    ? '<div class="bs-kart"><div class="bs-not">Bölümün yürüttüğü etkin proje yok. Hocalar dış çağrılara kendileri başvurur; BAP çağrısı açmak da proje sayısını artırır.</div></div>'
    : `
      <div class="bs-tablo-kap">
        <table class="bs-tablo">
          <thead><tr><th>Proje</th><th>Tür</th><th>Yürütücü</th><th class="n">Bütçe</th><th class="n">Kalan</th><th class="n">İlerleme</th></tr></thead>
          <tbody>
            ${projeler.map(p => {
              const kalan = Math.max(0, (Number(p.duration) || 0) - (Number(p.currentTurn) || 0));
              const ilerleme = Math.max(0, Math.min(100, Math.round(Number(p.progress ?? ((p.currentTurn || 0) / Math.max(1, p.duration || 1)) * 100) || 0)));
              return `<tr>
                <td class="bs-proje-ad">${p.projectName || p.name || 'Adsız proje'}</td>
                <td class="bs-nowrap">${p.callType || '—'}</td>
                <td class="bs-nowrap">${p.piName || '—'}</td>
                <td class="n bs-nowrap">${formatMoney(p.requestedFunding || p.funding || 0)}</td>
                <td class="n bs-nowrap">${kalan} dönem</td>
                <td class="n">%${ilerleme}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div class="bs-tablo-dip">${v.projeler.length} etkin proje${v.projeler.length > _BS_LISTE_SINIRI && !_bs.tumu.projeler ? `, ilk ${_BS_LISTE_SINIRI} tanesi gösteriliyor` : ''} ${_bsTumuDugmesi('projeler', v.projeler.length)}</div>`;

  const bap = r.activeBapCall;
  const bapListe = (r.bapApplications || []).filter(a => _bsKayitBolumu(a, v.faculty) === dept.id);
  const bapGoster = _bs.tumu.bap ? bapListe : bapListe.slice(0, _BS_LISTE_SINIRI);
  const bapKart = bap ? `
    <div class="bs-kart">
      <div class="bs-kart-baslik"><span>BAP başvuruları (${bapListe.length})</span></div>
      <div class="bs-not">Açık BAP çağrısında kalan bütçe ${formatMoney(bap.remainingBudget)}, proje başına en çok ${formatMoney(bap.maxPerProject)}${bap.expirationTurn != null ? `; çağrı ${Math.max(0, bap.expirationTurn - v.tur)} dönem sonra kapanır` : ''}.</div>
      ${bapListe.length === 0 ? '<div class="bs-not">Bu bölümden bekleyen BAP başvurusu yok.</div>' : `
        <div class="bs-basvuru-liste">
          ${bapGoster.map(a => `
            <div class="bs-basvuru">
              <div class="bs-basvuru-bilgi">
                <div class="bs-basvuru-ad">${a.projectName || 'Adsız proje'}</div>
                <div class="bs-basvuru-alt">${a.facultyName || '—'} · ${formatMoney(a.requestedFunding || 0)} · ${a.duration || 2} dönem · ~${a.estimatedPublications || 1} yayın</div>
              </div>
              <div class="bs-basvuru-dugmeler">
                <button type="button" class="btn btn-success btn-sm" data-bs-eylem="bap-onay" data-basvuru="${a.id}">Onayla</button>
                <button type="button" class="btn btn-danger btn-sm" data-bs-eylem="bap-ret" data-basvuru="${a.id}">Reddet</button>
              </div>
            </div>`).join('')}
        </div>
        ${_bsTumuDugmesi('bap', bapListe.length)}`}
    </div>` : `
    <div class="bs-kart">
      <div class="bs-kart-baslik"><span>BAP başvuruları</span></div>
      <div class="bs-not">Açık BAP çağrısı yok. Çağrı Araştırma sekmesinden açılır; başvurular bütün bölümlerin hocalarından gelir.</div>
      <div class="bs-dugmeler"><button type="button" class="bs-dugme" data-bs-eylem="git" data-sekme="research">Araştırma sekmesine git</button></div>
    </div>`;

  return `
    <div class="bs-gosterge bs-gosterge--dar">
      ${_bsKutu('Etkin proje', formatNumber(v.projeler.length), `üniversitede ${formatNumber((r.activeResearchProjects || []).length)}`)}
      ${_bsKutu('Yayın', formatNumber(yayin), 'bölüm hocalarının toplamı')}
      ${_bsKutu('Atıf', formatNumber(atif), 'bölüm hocalarının toplamı')}
      ${_bsKutu('h-indeksi', hOrt != null ? ondalikYaz(hOrt, 1) : '—', 'hoca ortalaması')}
    </div>
    <div class="bs-kart">
      <div class="bs-satir"><span>Son dönem dış proje başvuruları</span><b>${kabul + red} başvuru, ${kabul} kabul</b></div>
      <div class="bs-satir"><span>Son tamamlanan projeler</span><b>${biten.filter(p => p.status === 'completed').length} başarılı, ${biten.filter(p => p.status !== 'completed').length} sonuçsuz</b></div>
      <div class="bs-not">Yayın ve atıf, hocaların kariyerleri boyunca biriktirdiği sayılardır. Patentler bölüm bazında tutulmuyor; üniversitede toplam ${formatNumber(r.patents || 0)} patent var, bu bölümün son tamamlanan projelerinden ${patentli} tanesi patent getirdi (oyun son 50 projeyi saklar).</div>
    </div>
    <div class="bs-altbaslik">Etkin projeler</div>
    ${projeTablosu}
    ${bapKart}`;
}

function _bsYerleske(state, dept, v, binalar) {
  const depts   = state.departments || [];
  const doluluk = v.kapasite > 0 ? v.ogrenci / v.kapasite : null;
  const kaynak  = {
    bina:  'Kapasite, bölümün atandığı binaların dersliklerinden hesaplanıyor. Her koltuk bir yıllık alımı taşır; dört sınıf için koltuk × 4.',
    ortak: 'Bölüm bir derslik binasına atanmamış. Hiçbir bölüme atanmamış binaların dersliklerini, kendine binası olmayan öteki bölümlerle paylaşıyor.',
    yedek: 'Bölümün kullanabileceği derslik yok; kapasite tek derslik varsayılarak hesaplanıyor.',
  }[dept.kapasiteKaynagi] || '';

  const binaSatiri = (b, ek = '') => {
    const tanim   = BUILDINGS[b.type] || {};
    const duzey   = b.level || 1;
    const boy     = _derslikBoyu(tanim, duzey);
    const derslik = b.currentCapacity?.classrooms || 0;
    const ortak   = ((b.type === 'lab' ? b.linkedDepartments : b.assignedDepartments) || [])
      .filter(id => id !== dept.id).map(id => depts.find(d => d.id === id)).filter(Boolean).map(d => d.shortName || d.name);
    const ad      = b.name || tanim.name || b.type;
    // Oyuncu binayı yeniden adlandırdıysa türü de yazılır
    const turAdi  = tanim.name && tanim.name !== ad ? `${tanim.name} · ` : '';
    return `
      <div class="bs-bina">
        ${_binaGorseli(b.type, Math.min(duzey, tanim.maxLevel || 3), 56)}
        <div class="bs-bina-bilgi">
          <div class="bs-bina-ad">${_escHtml(ad)}</div>
          <div class="bs-bina-alt">${turAdi}Düzey ${duzey}${b.status === 'upgrading' ? ' (yükseltiliyor)' : ''}${derslik && boy ? ` · ${derslik} derslik × ${boy} kişi = ${formatNumber(derslik * boy)} koltuk` : ''}</div>
          ${ortak.length ? `<div class="bs-bina-alt">Birlikte kullanan bölümler: ${ortak.join(', ')}</div>` : ''}
          ${ek}
        </div>
      </div>`;
  };

  const labPuani = Number(dept.labScore) || 0;
  const gereksinim = Number(dept.labRequirement) || 0;
  const labKart = `
    <div class="bs-kart">
      <div class="bs-kart-baslik"><span>Laboratuvar</span></div>
      <div class="bs-satir"><span>Laboratuvar puanı</span><b>${Math.round(labPuani)}/100</b></div>
      <div class="bs-cubuk"><span style="width:${Math.max(0, Math.min(100, labPuani))}%"></span></div>
      <div class="bs-satir"><span>Laboratuvar gereksinimi</span><b>${gereksinim}/5</b></div>
      <div class="bs-satir"><span>Akreditasyonda sayılan laboratuvar</span><b>${Math.floor(labPuani / 25)}</b></div>
      ${gereksinim === 0
        ? '<div class="bs-not">Bu bölüm laboratuvar gerektirmiyor.</div>'
        : `<div class="bs-not">Akreditasyonda her 25 puan bir laboratuvar sayılır. Bölüme bağlı her Laboratuvar binası düzey × 25 puan ekler.</div>
           ${binalar.lab.length
             ? binalar.lab.map(b => binaSatiri(b, `<div class="bs-bina-alt bs-iyi-metin">Laboratuvar puanına +${25 * (b.level || 1)}</div>`)).join('')
             : `<div class="bs-not bs-not--uyari">Bölüme bağlı laboratuvar binası yok. Yerleşke sekmesinde Laboratuvar binasının "Bölüm bağla" düğmesiyle bağlanır.</div>`}`}
    </div>`;

  const derslikler = binalar.derslik.length || binalar.merkez.length ? `
    ${binalar.derslik.map(b => binaSatiri(b)).join('')}
    ${binalar.merkez.map(b => binaSatiri(b, '<div class="bs-bina-alt bs-iyi-metin">Bölüm hocalarının dış proje başarı olasılığı ×1,15 (merkez sayısıyla en çok ×1,30)</div>')).join('')}`
    : '<div class="bs-not bs-not--uyari">Bölüm hiçbir binaya atanmamış.</div>';

  return `
    <div class="bs-kart">
      <div class="bs-kart-baslik"><span>Derslik kapasitesi</span></div>
      <div class="bs-satir"><span>Öğrenci / yer</span><b>${formatNumber(v.ogrenci)} / ${v.kapasite > 0 ? formatNumber(v.kapasite) : '—'}${doluluk != null ? ` (${_bsYuzde(doluluk)})` : ''}</b></div>
      <div class="bs-cubuk ${doluluk == null ? '' : doluluk > 1 ? 'kotu' : doluluk > 0.85 ? 'orta' : 'iyi'}"><span style="width:${doluluk != null ? Math.min(100, Math.round(doluluk * 100)) : 0}%"></span></div>
      ${kaynak ? `<div class="bs-not">${kaynak}</div>` : ''}
    </div>
    <div class="bs-kart">
      <div class="bs-kart-baslik"><span>Bölümün binaları</span></div>
      ${derslikler}
    </div>
    ${labKart}
    <div class="bs-kart">
      <div class="bs-not">Bölümü bir binaya atamak ya da laboratuvar bağlamak için Yerleşke sekmesinde binanın kartındaki "Bölüm ata" düğmesini (laboratuvarda "Bölüm bağla") kullanın.</div>
      <div class="bs-dugmeler"><button type="button" class="bs-dugme" data-bs-eylem="git" data-sekme="campus">Yerleşke sekmesine git</button></div>
    </div>`;
}

function _bsAkreditasyon(state, dept, v) {
  if (v.kurumlar.length === 0) {
    return '<div class="bs-kart"><div class="bs-not">Bu bölüm için tanımlı akreditasyon kuruluşu yok.</div></div>';
  }
  const akr = dept.accreditation || {};
  return v.kurumlar.map(([id, kurum]) => {
    const a = akr[id] || { status: 'none' };
    let denetim = null;
    try {
      denetim = checkAccreditationRequirements(state, dept, kurum);
    } catch (e) {
      console.warn('[ui] Bölüm Sayfası: akreditasyon koşulları okunamadı:', e);
    }
    const kalan = a.expiresAt != null ? a.expiresAt - v.tur : null;
    const dugme = (metin, birincil) =>
      `<button type="button" class="btn ${birincil ? 'btn-primary' : 'btn-secondary'} btn-sm" data-bs-eylem="akr" data-kurum="${id}">${metin}</button>`;
    let eylem = '';
    switch (a.status) {
      case 'granted':
        eylem = kalan != null && kalan <= 2
          ? dugme(`Yenile (${formatMoney(kurum.renewalCost)})`, true)
          : '<span class="bs-not">Yenileme son 2 dönemde açılır.</span>';
        break;
      case 'applied':
      case 'under_review':
        eylem = '<span class="bs-not">Sonuç değerlendirme süresi dolunca dönem sonunda gelir.</span>';
        break;
      case 'expired':
        eylem = dugme(`Yenile (${formatMoney(kurum.renewalCost)})`, true);
        break;
      case 'rejected':
        eylem = dugme(`Yeniden başvur (${formatMoney(kurum.cost)})`, !!denetim?.allMet);
        break;
      default:
        eylem = dugme(`Başvur (${formatMoney(kurum.cost)})`, !!denetim?.allMet);
    }
    const eksik = denetim ? denetim.checks.filter(c => !c.met).length : 0;
    return `
      <div class="bs-kart bs-akr">
        <div class="bs-akr-ust">
          <div>
            <div class="bs-akr-ad">${kurum.name}</div>
            <div class="bs-akr-tam">${kurum.fullName || ''}</div>
          </div>
          ${_bsAkrRozeti(kurum, a, v.tur, true)}
        </div>
        ${denetim ? `
          <ul class="bs-kosullar">
            ${denetim.checks.map(c => `<li class="${c.met ? 'tamam' : 'eksik'}"><span>${c.met ? '✓' : '✗'} ${c.label}</span><b>${c.current} / ${c.required}</b></li>`).join('')}
          </ul>
          <div class="bs-not ${eksik ? 'bs-not--uyari' : ''}">${eksik ? `${eksik} koşul karşılanmıyor; başvuru reddedilebilir.` : 'Bütün koşullar karşılanıyor.'}</div>` : ''}
        <div class="bs-not">Değerlendirme ${kurum.processingTime.min}-${kurum.processingTime.max} dönem sürer, akreditasyon ${kurum.duration} dönem geçerlidir. Başvuru ${formatMoney(kurum.cost)}, yenileme ${formatMoney(kurum.renewalCost)}.</div>
        ${eylem ? `<div class="bs-dugmeler">${eylem}</div>` : ''}
      </div>`;
  }).join('');
}

function _bsButce(dept, v, b) {
  const satir = (ad, alt, tutar, sinif) => `
    <tr>
      <td><div class="bs-butce-ad">${ad}</div><div class="bs-butce-alt">${alt}</div></td>
      <td class="n bs-nowrap ${sinif}">${tutar}</td>
    </tr>`;
  return `
    <div class="bs-tablo-kap">
      <table class="bs-tablo bs-tablo--butce">
        <thead><tr><th>Kalem (dönemlik)</th><th class="n">Tutar</th></tr></thead>
        <tbody>
          ${satir('Gelir payı (tahmin, öğrenci payına göre)', `Üniversitenin bu dönemki tahmini geliri ${formatMoney(b.toplamGelir)} × bölümün öğrenci payı ${_bsYuzde(b.pay, 1)}`, `+${formatMoney(b.gelir)}`, 'arti')}
          ${satir('Hoca maaşları', `${v.hocalar.length} hoca, aylık ${formatMoney(b.aylikMaas)} × ${SEMESTER_MONTHS} ay; üniversitenin akademik maaşlarının ${_bsYuzde(b.maasPayi, 1)}`, `-${formatMoney(b.maas)}`, 'eksi')}
          ${satir('İşletme gideri', `yıllık ${formatMoney(dept.annualOperatingCost || 0)}, dönemde yarısı`, `-${formatMoney(b.isletme)}`, 'eksi')}
          <tr class="bs-toplam">
            <td>Net</td>
            <td class="n bs-nowrap ${b.net >= 0 ? 'arti' : 'eksi'}">${b.net >= 0 ? '+' : ''}${formatMoney(b.net)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="bs-kart">
      <div class="bs-not">Gelir bir tahmindir. Oyun bölüme özgü gelir tutmuyor; üniversitenin toplam geliri öğrenci sayısına göre bölüştürüldü. Bina bakımı, idari kadro, burslar ve genel giderler bölümlere dağıtılmadı; net, bu ortak giderler düşülmeden önceki katkıdır.</div>
    </div>`;
}

function _bsIcerik(state, dept, v, butce, binalar) {
  switch (_bs.sekme) {
    case 'dersler':      return _bsDersler(dept, v);
    case 'ogrenciler':   return _bsOgrenciler(state, dept, v);
    case 'arastirma':    return _bsArastirma(state, dept, v);
    case 'yerleske':     return _bsYerleske(state, dept, v, binalar);
    case 'akreditasyon': return _bsAkreditasyon(state, dept, v);
    case 'butce':        return _bsButce(dept, v, butce);
    default:             return _bsKadro(state, dept, v);
  }
}

/** Başkan atama penceresi: bölümün Prof. ve Doç. hocaları, yönetim puanına göre. */
function _bsBaskanPenceresi(state, dept, islemler) {
  const adaylar = (state.faculty || [])
    .filter(f => _bsHocaBolumu(f) === dept.id && (f.title === 'profesor' || f.title === 'docent'))
    .sort((a, b) => (Number(b.stats?.management) || 0) - (Number(a.stats?.management) || 0));
  const not = 'Başkanın yönetim puanı 75 ve üstündeyse bölümün eğitim kalitesi 5 puan artar, 50\'nin altındaysa 5 puan düşer; başkansız bölüm de 5 puan kaybeder.'
    + (politikaOku(dept).kip === 'devret' ? ' Bölüm başkanda: başkanı değiştirirseniz devir yeni başkanla sürer; yönetim puanı başkanın kararlarının niteliğini belirler.' : '');
  showModal(`Başkan Ata: ${dept.name}`, adaylar.length === 0 ? `
    <p style="margin:0 0 12px;font-size:13.5px;line-height:1.5;">Bölümde başkan olabilecek Prof. ya da Doç. yok. Kadro ilanında unvanı Doçent ya da Profesör seçerek aday arayabilirsiniz.</p>
    <div class="onay-dugmeler"><button class="btn btn-secondary" id="btn-bs-baskan-kapat" type="button">Kapat</button></div>` : `
    <p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#b8c4e6;">${not}</p>
    <div class="yonetici-liste">
      ${adaylar.map(f => `
        <div class="yonetici-satir${f.id === dept.headId ? ' secili' : ''}">
          ${renderFacultyPortrait(f, 40, 'portre--yuvarlak')}
          <div class="yonetici-bilgi">
            <div class="yonetici-ad">${_BS_UNVAN[f.title] || ''} ${f.name}</div>
            <div class="yonetici-alt">yönetim ${tamPuan(f.stats?.management)} · mutluluk ${tamPuan(f.happiness)} · ${_bsDersSayisi(f)} ders</div>
          </div>
          ${f.id === dept.headId
            ? '<span class="bs-rozet bs-rozet--iyi">Şu anki başkan</span>'
            : `<button class="btn btn-primary btn-sm" type="button" data-bs-baskan="${f.id}">Ata</button>`}
        </div>`).join('')}
    </div>
    <div class="onay-dugmeler"><button class="btn btn-secondary" id="btn-bs-baskan-kapat" type="button">Vazgeç</button></div>`);
  on(el('btn-bs-baskan-kapat'), 'click', hideModal);
  qsa('#general-modal-body [data-bs-baskan]').forEach(btn => {
    btn.addEventListener('click', () => {
      hideModal();
      islemler.onAssignHead?.(dept.id, btn.dataset.bsBaskan);
    });
  });
}

function _bsEylem(ad, dugme, state, deptId, islemler) {
  const dept = (state.departments || []).find(d => d.id === deptId);
  if (!dept) return;
  const id = dugme.dataset.basvuru;
  switch (ad) {
    case 'geri':           islemler.onGeri?.(); break;
    case 'ilan':           islemler.onOpenPosition?.(deptId); break;
    case 'transfer':       islemler.onTransferMarket?.(deptId); break;
    case 'baskan':         _bsBaskanPenceresi(state, dept, islemler); break;
    case 'kontenjan':      islemler.onOpenQuota?.(deptId); break;
    case 'akr':            islemler.onAccreditation?.(deptId, dugme.dataset.kurum); break;
    case 'basvuru-kabul':  islemler.onAcceptApplicant?.(id); break;
    case 'basvuru-ret':    islemler.onRejectApplicant?.(id); break;
    case 'spontane-kabul': islemler.onAcceptSpontaneous?.(id, deptId); break;
    case 'spontane-ret':   islemler.onRejectSpontaneous?.(id); break;
    case 'bap-onay':       islemler.onProjectDecision?.('approve_bap_application', id, {}); break;
    case 'bap-ret':        islemler.onProjectDecision?.('reject_bap_application', id, {}); break;
    // v0.7: yönetim seçimi ve başkanın yetkileri (karar main.js üzerinden applyDecision 'set_dept_policy')
    case 'kip-dogrudan':
      if (politikaOku(dept).kip === 'devret') {
        _bs.devirTaslak = false;
        _bs.devirAcik = false;
        islemler.onSetPolicy?.(deptId, { kip: 'dogrudan' });
      } else if (_bs.devirTaslak) {
        _bs.devirTaslak = false;
        _bsYenidenCiz();
      }
      break;
    case 'kip-devret':
      if (politikaOku(dept).kip === 'devret') _bs.devirAcik = !_bs.devirAcik;
      else _bs.devirTaslak = true;
      _bsYenidenCiz();
      qs('#tab-departments .bs-devir')?.scrollIntoView?.({ block: 'nearest' });
      break;
    case 'devir-ayarlar':
      _bs.devirAcik = true;
      _bsYenidenCiz();
      qs('#tab-departments [data-bs-devir-form]')?.scrollIntoView?.({ block: 'nearest' });
      break;
    case 'devir-vazgec':
      _bs.devirTaslak = false;
      _bs.devirAcik = false;
      _bsYenidenCiz();
      break;
    case 'devir-kaydet': {
      const secim = _bsDevirFormuOku();
      if (!secim) break;
      _bs.devirTaslak = false;
      _bs.devirAcik = false;
      islemler.onSetPolicy?.(deptId, { ...secim, kip: 'devret' });
      break;
    }
    case 'devir-yenile':
      islemler.onSetPolicy?.(deptId, { kip: 'devret' });
      break;
    case 'tumu':
      _bs.tumu[dugme.dataset.liste] = !_bs.tumu[dugme.dataset.liste];
      _bsYenidenCiz();
      break;
    case 'git':            qs(`.sidebar-tab[data-tab="${dugme.dataset.sekme}"]`)?.click(); break;
    case 'tasi': {
      const hoca = (state.faculty || []).find(f => f.id === dugme.dataset.hoca);
      if (hoca) _hocaTasiPenceresi(hoca, state.departments || [], islemler.onReassignFaculty, dept.headId === hoca.id);
      break;
    }
    default: break;
  }
}

/** Son çizimin verisiyle sayfayı yeniden çizer (iç sekme, sıralama, liste açma: oyun durumu değişmez). */
function _bsYenidenCiz() {
  if (!_bs.son) return;
  const { state, deptId, islemler } = _bs.son;
  renderDeptPage(state, deptId, islemler);
}

function _bsSekmeyeGec(sekme) {
  if (!_BS_SEKMELER.some(([id]) => id === sekme)) return;
  _bs.sekme = sekme;
  _bsYenidenCiz();
  // Seçili sekme görünür olsun (telefonda sekme çubuğu yatay kayar, yan karttan gelinmişse sayfa sekmelere iner)
  const dugme = qs(`#tab-departments .bs-sekme[data-bs-sekme="${sekme}"]`);
  dugme?.focus({ preventScroll: true });
  qs('#tab-departments .bs-sekmeler')?.scrollIntoView?.({ block: 'nearest' });
  dugme?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
}

/** Panel dinleyicileri bir kez bağlanır; her çizimde birikmez (araştırma panelindeki sorun, Issue #22). */
function _bsDinleyicileriKur(panel) {
  if (panel._bsDinleyiciBagli) return;
  panel._bsDinleyiciBagli = true;
  panel.addEventListener('click', (e) => {
    if (!_bs.son || !e.target.closest('.bs-sayfa')) return;
    const { state, deptId, islemler } = _bs.son;
    const sekme = e.target.closest('[data-bs-sekme]');
    if (sekme) { _bsSekmeyeGec(sekme.dataset.bsSekme); return; }
    const sirala = e.target.closest('[data-bs-sirala]');
    if (sirala) {
      const anahtar = sirala.dataset.bsSirala;
      if (_bs.sirala === anahtar) _bs.artan = !_bs.artan;
      else { _bs.sirala = anahtar; _bs.artan = anahtar === 'ad'; }
      _bsYenidenCiz();
      qs(`#tab-departments [data-bs-sirala="${anahtar}"]`)?.focus({ preventScroll: true });
      return;
    }
    const eylem = e.target.closest('[data-bs-eylem]');
    if (eylem) {
      if (!eylem.disabled) _bsEylem(eylem.dataset.bsEylem, eylem, state, deptId, islemler);
      return;
    }
    const satir = e.target.closest('tr[data-bs-hoca]');
    if (satir) islemler.onFacultyDetail?.(satir.dataset.bsHoca);
  });
  panel.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const satir = e.target.closest?.('tr[data-bs-hoca]');
    if (!satir || satir !== e.target || !_bs.son) return;
    e.preventDefault();
    _bs.son.islemler.onFacultyDetail?.(satir.dataset.bsHoca);
  });
  // v0.7: başkanın yetki formundaki kaydırıcılar sürüklenirken yanındaki değer güncellenir
  panel.addEventListener('input', (e) => {
    const kaydirici = e.target.closest?.('[data-bs-devir-goster]');
    if (!kaydirici) return;
    const cikti = panel.querySelector(`#${kaydirici.id}-d`);
    if (!cikti) return;
    const n = Number(kaydirici.value);
    cikti.textContent = kaydirici.dataset.bsDevirGoster === 'tavan' ? _bsTavanYazisi(n, true) : String(n);
  });
}

/**
 * v0.6 Bölüm Sayfası: tek bölümün göstergeleri, uyarıları, kadrosu, dersleri, öğrencileri, araştırması,
 * binaları, akreditasyonu ve bütçesi. Bölümler sekmesinin panelinde çizilir.
 * @param {object} state
 * @param {string} deptId
 * @param {object} [islemler]  main.js kararları: onGeri, onOpenPosition(deptId), onTransferMarket(deptId),
 *   onAssignHead(deptId, facId), onReassignFaculty(facId, deptId), onFacultyDetail(facId), onOpenQuota(deptId),
 *   onAccreditation(deptId, bodyId), onAcceptApplicant(id), onRejectApplicant(id), onAcceptSpontaneous(id, deptId),
 *   onRejectSpontaneous(id), onProjectDecision(tur, id, ek), onSetPolicy(deptId, politika) (v0.7 başkana devretme)
 * @param {object} [secenek]   { icSekme }: açılışta seçilecek iç sekme (kadro, dersler, ogrenciler, arastirma,
 *   yerleske, akreditasyon, butce); verilmezse son seçili sekme kalır
 */
export function renderDeptPage(state, deptId, islemler = {}, secenek = {}) {
  const panel = el('tab-departments');
  if (!panel || !state) return;
  const dept = (state.departments || []).find(d => d.id === deptId);
  if (!dept) {
    panel.innerHTML = '<div class="empty-state"><div class="empty-state-title">Bölüm bulunamadı</div></div>';
    return;
  }
  if (_bs.bolumId !== deptId) {
    Object.assign(_bs, { bolumId: deptId, sekme: 'kadro', sirala: null, artan: false, tumu: {}, devirTaslak: false, devirAcik: false });
  }
  if (secenek.icSekme && _BS_SEKMELER.some(([id]) => id === secenek.icSekme)) _bs.sekme = secenek.icSekme;
  _bs.son = { state, deptId, islemler };

  const v        = _bsVeri(state, dept);
  const uyarilar = _bsUyarilar(dept, v);
  const butce    = _bsButceHesabi(state, dept, v);
  const binalar  = _bsBinalari(state, dept);

  panel.innerHTML = `
    <div class="bs-sayfa" data-bolum="${dept.id}">
      <button type="button" class="bs-geri" data-bs-eylem="geri">← Bölümler</button>
      ${_bsUst(dept, v, uyarilar.length)}
      ${_bsDevirKarti(dept, v)}
      ${_bsGostergeler(dept, v)}
      ${_bsDikkat(uyarilar)}
      ${_bsSekmeCubugu(v)}
      <div class="bs-govde">
        <div class="bs-ana" role="tabpanel" aria-label="${_bsSekmeAdi(_bs.sekme)}">${_bsIcerik(state, dept, v, butce, binalar)}</div>
        <div class="bs-yan">${_bsYanKartlar(state, dept, v, butce, binalar)}</div>
      </div>
    </div>`;
  _bsDinleyicileriKur(panel);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ÖĞRENCİ PANELİ (v2: YKS + kontenjan sistemi; v0.6.1: ortak bileşenler)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Öğrenci sekmesi: özet göstergeler, bölümlere göre öğrenci tablosu, memnuniyet kırılımı,
 * yıldız öğrenciler ve kontenjanlar.
 * @param {object}   state             — Oyun durumu
 * @param {Function} onOpenQuotaScreen — Kontenjan belirleme ekranı callback
 */
export function renderStudentsPanel(state, onOpenQuotaScreen) {
  const panel = el('tab-students');
  if (!panel) return;

  const students     = state.students || {};
  const byDept       = students.byDepartment || {};
  const starStudents = students.starStudents || [];
  const depts        = state.departments || [];
  const overall      = students.overallSatisfaction ?? 0;
  const breakdown    = students.satisfactionBreakdown;
  // Devlet kontenjanında burs türü seçilmez (yalnız toplam); kontenjan tablosunda burs sütunları vakıf ve özel üniversitede
  const burslu       = (state.meta?.universityType || 'vakif') !== 'devlet';

  // Özet hesapla
  let total = 0, yr1 = 0, yr2 = 0, yr3 = 0, yr4 = 0;
  let tamTotal = 0, yariTotal = 0, ucretliTotal = 0;
  let sumYKS = 0, sumGPA = 0, countGPA = 0;

  for (const [dId, d] of Object.entries(byDept)) {
    for (const [k, yr] of [['year1', d.year1], ['year2', d.year2], ['year3', d.year3], ['year4', d.year4]]) {
      if (!yr || !yr.count) continue;
      const c = yr.count;
      total += c;
      if (k === 'year1') yr1 += c; else if (k === 'year2') yr2 += c;
      else if (k === 'year3') yr3 += c; else yr4 += c;
      tamTotal     += yr.tamBurslu  || 0;
      yariTotal    += yr.yariBurslu || 0;
      ucretliTotal += yr.ucretli    || 0;
      if (yr.avgYKS > 0) sumYKS += yr.avgYKS * c;
      if (yr.avgGPA > 0) { sumGPA += yr.avgGPA * c; countGPA += c; }
    }
  }
  const avgYKS = total > 0 ? Math.round(sumYKS / total) : 0;
  const avgGPA = countGPA > 0 ? sumGPA / countGPA : null;

  const isBahar = state.meta?.semester === 'bahar';

  // Bölümlere göre öğrenci tablosu (satır ve bölüm adı Bölüm Sayfası'nı açar: data-bolum-git)
  const satirlar = depts.map(dept => {
    const d = byDept[dept.id];
    if (!d) return '';
    const y1 = d.year1?.count ?? 0;
    const y2 = d.year2?.count ?? 0;
    const y3 = d.year3?.count ?? 0;
    const y4 = d.year4?.count ?? 0;
    const tot = y1 + y2 + y3 + y4;
    if (tot === 0) return '';
    // Ağırlıklı ortalamalar (YKS, not, memnuniyet)
    const yksSum = (d.year1?.avgYKS ?? 0) * y1 + (d.year2?.avgYKS ?? 0) * y2 +
                   (d.year3?.avgYKS ?? 0) * y3 + (d.year4?.avgYKS ?? 0) * y4;
    const dAvgYKS = tot > 0 ? Math.round(yksSum / tot) : 0;
    const gpaSum = (d.year1?.avgGPA ?? 0) * y1 + (d.year2?.avgGPA ?? 0) * y2 +
                   (d.year3?.avgGPA ?? 0) * y3 + (d.year4?.avgGPA ?? 0) * y4;
    const dAvgGPA = tot > 0 ? gpaSum / tot : null;
    const satSum = (d.year1?.satisfaction ?? 60) * y1 + (d.year2?.satisfaction ?? 60) * y2 +
                   (d.year3?.satisfaction ?? 60) * y3 + (d.year4?.satisfaction ?? 60) * y4;
    const dAvgSat = tot > 0 ? Math.round(satSum / tot) : 60;
    return `
      <tr class="bs-satir-git ob-git" data-bolum-git="${dept.id}" data-bolum-sekme="ogrenciler">
        <td class="ob-tek">
          <button type="button" class="bs-link" data-bolum-git="${dept.id}" data-bolum-sekme="ogrenciler"
                  title="${dept.name}: Bölüm Sayfası">${dept.shortName || dept.name} <span aria-hidden="true">›</span></button>
        </td>
        <td class="n">${y1 || '—'}</td>
        <td class="n">${y2 || '—'}</td>
        <td class="n">${y3 || '—'}</td>
        <td class="n">${y4 || '—'}</td>
        <td class="n ob-kalin">${formatNumber(tot)}</td>
        <td class="n ob-soluk">${dAvgYKS > 0 ? formatNumber(dAvgYKS) : '—'}</td>
        <td class="n ob-kalin ${dAvgGPA != null ? _obKademe(dAvgGPA, 3.0, 2.5) : ''}">${dAvgGPA != null ? formatGPA(dAvgGPA) : '—'}</td>
        <td class="n ${_obKademe(dAvgSat, 70, 45)}">${dAvgSat}</td>
      </tr>`;
  }).join('');

  const tablo = Object.keys(byDept).length === 0 ? `
    <div class="ob-bos">
      <i class="ikon ikon--ogrenci" aria-hidden="true"></i>
      <div class="ob-bos-baslik">Henüz öğrenci yok</div>
    </div>` : `
    <div class="ob-tablo-kap">
      <table class="ob-tablo">
        <thead>
          <tr>
            <th>Bölüm</th><th class="n">1. sınıf</th><th class="n">2. sınıf</th><th class="n">3. sınıf</th><th class="n">4. sınıf</th>
            <th class="n">Toplam</th><th class="n">Ort. YKS</th><th class="n">Not ort.</th><th class="n">Memnuniyet</th>
          </tr>
        </thead>
        <tbody>${satirlar}</tbody>
      </table>
    </div>
    <div class="ob-tablo-dip">YKS sırası küçüldükçe öğrenci daha başarılıdır. Satıra tıklayınca bölümün sayfası açılır.</div>`;

  // Memnuniyet kırılımı: her etkenin puanı ve genel memnuniyetteki ağırlığı
  const kirilim = breakdown ? `
    <section class="ob-bolum">
      <div class="section-title"><i class="ikon ikon--ogrenci" aria-hidden="true"></i>Memnuniyet kırılımı</div>
      <div class="ob-kart">
        <div class="memnuniyet-izgara">
          ${Object.values(breakdown).map(factor => {
            const s = tamPuan(factor.score, 0);
            const k = _obKademe(s, 70, 45);
            return `
              <div class="memnuniyet-oge">
                <div class="memnuniyet-oge-ust">
                  <span>${factor.label}</span>
                  <small title="Genel memnuniyetteki ağırlığı">%${Math.round((factor.weight || 0) * 100)}</small>
                  <b class="${k}">${s}</b>
                </div>
                <div class="ob-cubuk ob-cubuk--${k.replace('ob-', '')}"><span style="width:${Math.max(0, Math.min(100, s))}%"></span></div>
              </div>`;
          }).join('')}
        </div>
        <div class="ob-aciklama">Yüzdeler her etkenin genel memnuniyetteki ağırlığıdır.</div>
      </div>
    </section>` : '';

  // Kontenjanlar (yıllık yeni alım)
  const kontenjanSatirlari = depts.map(dept => {
    const q = students.quotas?.[dept.id];
    if (!q) return '';
    const tot = (q.tamBurslu || 0) + (q.yariBurslu || 0) + (q.ucretli || 0);
    return `
      <tr>
        <td class="ob-ad ob-tek">${dept.shortName || dept.name}</td>
        ${burslu ? `<td class="n">${q.tamBurslu || 0}</td><td class="n">${q.yariBurslu || 0}</td><td class="n">${q.ucretli || 0}</td>` : ''}
        <td class="n ob-kalin">${tot}</td>
      </tr>`;
  }).join('');

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-title">Öğrenciler</div>
        <div class="panel-subtitle">${formatNumber(total)} kayıtlı öğrenci · ${starStudents.length} yıldız öğrenci</div>
      </div>
      <button class="btn ${isBahar ? 'btn-primary' : 'btn-secondary btn--pasif'}" id="btn-open-quota-screen"
              title="${isBahar ? 'Gelecek yılın kontenjanlarını belirle (Bahar sonunda uygulanır)' : 'Kontenjan yalnız Bahar döneminde belirlenir'}">
        Kontenjan belirleme${isBahar ? '' : ' (Bahar\'da)'}
      </button>
    </div>

    <div class="ob-yigin">
      <div class="ob-kutular">
        ${_obKutu('Toplam öğrenci', formatNumber(total), `${formatNumber(yr1)} · ${formatNumber(yr2)} · ${formatNumber(yr3)} · ${formatNumber(yr4)} <span class="ob-tek">(1-4. sınıf)</span>`)}
        ${_obKutu('Burs dağılımı', `${formatNumber(tamTotal)} / ${formatNumber(yariTotal)} / ${formatNumber(ucretliTotal)}`, 'tam burslu / yarı burslu / ücretli')}
        ${_obKutu('Ort. YKS sırası', avgYKS > 0 ? formatNumber(avgYKS) : '—', 'küçük sıra daha başarılı')}
        ${_obKutu('Not ortalaması', avgGPA != null ? formatGPA(avgGPA) : '—', '4,00 üzerinden', avgGPA != null ? _obKademe(avgGPA, 3.0, 2.5) : '')}
        ${_obKutu('Memnuniyet', Math.round(overall), 'genel, 100 üzerinden', _obKademe(overall, 70, 45))}
      </div>

      <div class="ob-ana-yan">
        <div class="ob-yigin">
          <section class="ob-bolum">
            <div class="section-title"><i class="ikon ikon--bolumler" aria-hidden="true"></i>Bölümlere göre öğrenciler</div>
            ${tablo}
          </section>
          ${kirilim}

          <section class="ob-bolum">
            <div class="section-title"><i class="ikon ikon--ogrenci" aria-hidden="true"></i>Kontenjanlar</div>
            ${kontenjanSatirlari ? `
              <div class="ob-tablo-kap">
                <table class="ob-tablo ob-tablo--dar">
                  <thead>
                    <tr>
                      <th>Bölüm</th>
                      ${burslu ? '<th class="n">Tam burslu</th><th class="n">Yarı burslu</th><th class="n">Ücretli</th>' : ''}
                      <th class="n">Toplam</th>
                    </tr>
                  </thead>
                  <tbody>${kontenjanSatirlari}</tbody>
                </table>
              </div>
              <div class="ob-tablo-dip">Yıllık yeni alım. ${isBahar ? 'Bu yılın kontenjanı Bahar sonunda uygulanır.' : 'Kontenjan Bahar döneminde belirlenir.'}</div>`
              : '<div class="ob-bos ob-bos--kucuk">Kontenjan belirlenmedi.</div>'}
          </section>
        </div>

        <div class="ob-yigin">
          <section class="ob-bolum">
            <div class="section-title"><i class="ikon ikon--sayginlik" aria-hidden="true"></i>Yıldız öğrenciler <span class="ob-sayi">${starStudents.length}</span></div>
            ${starStudents.length ? `
              <div class="yildiz-liste">${starStudents.slice(0, 8).map(s => renderStudentCard(s, depts)).join('')}</div>
              ${starStudents.length > 8 ? '<div class="ob-aciklama">İlk 8 yıldız öğrenci gösteriliyor.</div>' : ''}`
              : '<div class="ob-bos ob-bos--kucuk">Keşfedilen yıldız öğrenci yok.</div>'}
          </section>
        </div>
      </div>
    </div>
  `;

  // Kontenjan belirleme butonu
  on(el('btn-open-quota-screen'), 'click', () => {
    if (!isBahar) {
      showNotification('Kontenjan belirleme yalnızca Bahar döneminde yapılabilir.', 'warning');
      return;
    }
    if (onOpenQuotaScreen) onOpenQuotaScreen();
  });
}

/**
 * Tek yıldız öğrenci kartı HTML'i (Öğrenciler sekmesi ve Bölüm Sayfası'nın Öğrenciler iç sekmesi).
 * Mezun olarak etkisi (potentialAlumniImpact, 1-5) puan göstergesiyle, 4 ve üstü altın çerçeveyle gösterilir.
 */
export function renderStudentCard(s, depts = []) {
  const dept = depts.find(d => d.id === s.department);
  const typeLabels = {
    akademik_dahi: '🎯 Akademik dahi',
    girisimci:     '💡 Girişimci',
    sporcu:        '🏆 Sporcu',
    sanatci:       '🎨 Sanatçı',
    lider:         '👑 Lider',
    polymath:      '🌐 Polimatik',
    sessiz_deha:   '🔬 Sessiz deha',
    charismatik:   '✨ Karizmatik',
  };

  // Mezuniyet sonrası kariyer olasılığı
  const careerOutcomes = {
    akademik_dahi: 'Mezun olunca: öğretim üyesi ya da araştırmacı olma olasılığı yüksek',
    girisimci:     'Mezun olunca: girişim şirketi kurma olasılığı yüksek',
    sporcu:        'Mezun olunca: ulusal düzeyde spor kariyeri',
    sanatci:       'Mezun olunca: yaratıcı sektörlerde öncü',
    lider:         'Mezun olunca: yönetici, sektör lideri',
    polymath:      'Mezun olunca: disiplinlerarası kariyer, danışmanlık',
    sessiz_deha:   'Mezun olunca: büyük şirkette Ar-Ge, patent',
  };

  const initials = (s.name || '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const impact = s.potentialAlumniImpact ?? 1;

  // Bu dönemki etkinlikler/katkılar (son 3)
  const recentEvents = (s.events || []).slice(-3);
  const olayIkonu = t => t === 'competition_win' ? '🏆' : t === 'publication' ? '📄' : t === 'graduation' ? '🎓' : '✨';

  // Öne çıkan stat (en yüksek)
  const stats = s.stats || {};
  const statLabels = { academic: 'Akademik', creativity: 'Yaratıcılık', leadership: 'Liderlik', sport: 'Spor', art: 'Sanat', charisma: 'Karizma' };
  const topStatKey = Object.keys(stats).reduce((a, b) => (stats[a] ?? 0) >= (stats[b] ?? 0) ? a : b, 'academic');
  const topStatVal = stats[topStatKey] ?? 0;

  // Yıldız kalitesi: mezun olarak etkisi 4+ altın, 3 gümüş (yeşil) çerçeve
  const sinif = impact >= 4 ? ' yildiz-kart--altin' : impact >= 3 ? ' yildiz-kart--gumus' : '';

  return `
    <div class="yildiz-kart${sinif}">
      <div class="yildiz-harf" aria-hidden="true">${initials}</div>
      <div class="yildiz-govde">
        <div class="yildiz-ust">
          <div class="yildiz-ad">${s.name || 'İsimsiz'}</div>
          ${_obPuan(impact, 5, { etiket: 'Mezun olarak etkisi' })}
        </div>
        <div class="yildiz-alt">${dept?.shortName || s.department || '—'} · ${s.year}. sınıf · not ort. ${formatGPA(s.gpa)}</div>
        <div class="ob-dizi">
          <span class="ob-rozet ob-rozet--kucuk">${typeLabels[s.type] || s.type}</span>
          ${s.scholarship ? '<span class="ob-rozet ob-rozet--iyi ob-rozet--kucuk">Burslu</span>' : ''}
          <span class="ob-rozet ob-rozet--kucuk${topStatVal >= 80 ? ' ob-rozet--iyi' : ''}" title="En güçlü yönü">${statLabels[topStatKey] || topStatKey} ${topStatVal}</span>
        </div>
        ${recentEvents.length > 0 ? `
          <ul class="yildiz-olaylar">
            ${recentEvents.map(ev => `<li>${olayIkonu(ev.type)} ${ev.description || ''}</li>`).join('')}
          </ul>` : ''}
        ${impact >= 3 ? `<div class="yildiz-kariyer">${careerOutcomes[s.type] || 'Kariyer olasılığı yüksek'}</div>` : ''}
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// KONTENJAN BELİRLEME MODALI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bahar dönemi öncesi kontenjan belirleme modalını açar (yeni alım Bahar sonunda yapılır).
 *
 * @param {object}   state        — Oyun durumu
 * @param {Function} onConfirm    — Onaylama callback: onConfirm(quotas)
 * @param {object}   [secenek]    { donemiBaslatir }: Bahar'daki zorunlu adım;
 *                                { odakBolum }: v0.6, bu bölümün kartına kaydırılır ve vurgulanır
 */
export function renderQuotaModal(state, onConfirm, secenek = {}) {
  // Sonraki Dönem'in Bahar'da açtığı zorunlu adımda onay dönemi de işler;
  // Öğrenciler sekmesinden açılınca yalnız kaydeder.
  const donemiBaslatir = !!secenek.donemiBaslatir;
  const depts    = state.departments.filter(d => d.isOpen);
  const quotas   = state.students?.quotas || {};
  const byDept   = state.students?.byDepartment || {};
  const prestige = state.university?.prestige || 20;
  const year     = state.meta?.year || 1;
  const baseTuition = state.university?.tuitionPerSemester || 65_000;
  const uniType  = state.meta?.universityType || 'vakif';

  // ── Kapasite hesapla ──────────────────────────────────────────────────────
  // Tamamlanan tüm binaların gerçek derslik koltuk kapasitesi
  const completedBuildings = (state.buildings || []).filter(b => b.isCompleted);
  const totalClassroomCap  = completedBuildings.reduce((s, b) => {
    const classrooms  = b.currentCapacity?.classrooms || 0;
    const bldgDef     = BUILDINGS[b.type];
    // Düzeye göre derslik kapasitesi
    const bldgLevel   = b.level || 1;
    const clsSzByLvl  = bldgDef?.classroomSizeByLevel;
    const clsSize     = clsSzByLvl
      ? (clsSzByLvl[bldgLevel] ?? clsSzByLvl[1] ?? bldgDef?.classroomSize ?? 40)
      : (bldgDef?.classroomSize ?? 40);
    // Koltuk sayısı = derslik adedi × derslik büyüklüğü
    const seats       = classrooms * clsSize;
    // Geriye dönük uyumluluk: eski binaların students/classroom alanı
    const legacyCap   = b.currentCapacity?.students || b.currentCapacity?.classroom || 0;
    return s + (seats > 0 ? seats : legacyCap);
  }, 0);

  // Bölüm bazlı gerçek derslik kapasitesi (atanmış binalardan)
  const deptClassroomCapacity = {};
  for (const dept of (state.departments || [])) {
    let seats = 0;
    for (const b of completedBuildings) {
      if ((b.assignedDepartments || []).includes(dept.id)) {
        const classrooms  = b.currentCapacity?.classrooms || 0;
        const bldgDef     = BUILDINGS[b.type];
        const bLevel      = b.level || 1;
        const szByLvl     = bldgDef?.classroomSizeByLevel;
        const clsSize     = szByLvl
          ? (szByLvl[bLevel] ?? szByLvl[1] ?? bldgDef?.classroomSize ?? 40)
          : (bldgDef?.classroomSize ?? 40);
        seats += classrooms * clsSize;
      }
    }
    deptClassroomCapacity[dept.id] = seats;
  }

  // Hoca başına en çok öğrenci tahmini (1 hoca ≈ 30 öğrenci)
  const totalFaculty       = (state.faculty || []).length;
  const maxStudentsByFaculty = totalFaculty * 30;

  // v0.5.2: bir koltuk bir yıllık alımı taşır (applyQuotas), dört sınıfın toplam
  // yeri koltuk × 4'tür; üst sınıflar (2-4) bununla kıyaslanır (game.js bölüm kapasitesiyle aynı ölçü)
  const dortSinifKoltuk = totalClassroomCap * 4;

  // v0.7: "Yeni alım için yer" bölüm bölüm oyunun uyguladığı sayıdır (students.js bolumAlimYeri:
  // bölümün dört sınıflık derslik kapasitesi eksi gelecek yıl 2-4. sınıf olacak öğrenciler).
  // Alım bu sayıyla sınırlıdır; eskiden pencere hoca kapasitesiyle "yer 0" deyip alımı sınırlamıyordu.
  const bolumYeri = {};
  for (const dept of depts) bolumYeri[dept.id] = bolumAlimYeri(state, dept);
  const remainingCapacity = Object.values(bolumYeri).reduce((s, v) => s + v, 0);

  // Devlet modelinde YKS sıralaması var ama burs kategorisi yok; ABD modeli farklı
  const isDevlet    = uniType === 'devlet';
  const isUSPrivate = uniType === 'us_private';
  const isVakif     = !isDevlet && !isUSPrivate;

  // YKS tahmini aralığı (saygınlığa göre)
  function yksRange(type) {
    const pf = 1 - (prestige / 100) * 0.6;
    const ranges = {
      tam_burslu:  [Math.round(500 * pf), Math.round(20000 * pf)],
      yari_burslu: [Math.round(10000 * pf), Math.round(60000 * pf)],
      ucretli:     [Math.round(25000 * pf), Math.round(200000 * pf)],
    };
    const [min, max] = ranges[type] || [0, 0];
    return `~${formatNumber(Math.max(500, min))}-${formatNumber(Math.max(min+1000, max))}`;
  }

  function netRevenue(tam, yari, ucret, mult = 1.0) {
    if (isDevlet) {
      // Devlet: harç yok, yalnız katkı payı
      const katkiPayi = UNIVERSITY_MODELS.devlet.revenueStreams.ogrenciKatkiPayi?.perStudent ?? 2_000;
      return (tam + yari + ucret) * katkiPayi;
    }
    if (isUSPrivate) {
      const aidRate    = state.university?.financialAidRate ?? 0.45;
      const merritRate = tam / Math.max(1, tam + yari + ucret); // tam = başarı bursu
      const avgNet     = baseTuition * (1 - aidRate * (1 - merritRate));
      return (tam + yari + ucret) * avgNet;
    }
    // Vakıf: tam burslu = 0, yarı = %50, ücretli = tam
    const income = (yari * baseTuition * mult * 0.50) + (ucret * baseTuition * mult * 1.0);
    const burs   = (tam * baseTuition * mult * 1.0) + (yari * baseTuition * mult * 0.50);
    return income - burs;
  }

  // Başlangıç kontenjanı (devlette burs kategorisi yok)
  function defaultQuota(id) {
    if (isDevlet) return { tamBurslu: 0, yariBurslu: 0, ucretli: 50 };
    if (isUSPrivate) return { tamBurslu: 10, yariBurslu: 20, ucretli: 30 };
    return { tamBurslu: 5, yariBurslu: 10, ucretli: 30 };
  }

  // Sütun başlıkları (v0.6.1: ABD özelinde de Türkçe; harç notu ayrı satırda)
  const col1Label = isUSPrivate ? 'Başarı bursu' : 'Tam burslu';
  const col2Label = isUSPrivate ? 'İhtiyaç bursu' : '%50 burslu';
  const col3Label = isUSPrivate ? 'Tam ücretli (sınırlı)' : 'Ücretli';

  const katkiPayi = UNIVERSITY_MODELS.devlet.revenueStreams.ogrenciKatkiPayi?.perStudent ?? 2_000;
  const bilgiRozetleri = isDevlet
    ? [`Bütçe tahsisi: YÖK`, `Harç yok, katkı payı ${formatMoney(katkiPayi)}/dönem`, `Saygınlık ${Math.round(prestige)}`]
    : isUSPrivate
      ? [`Harç ${formatMoney(baseTuition)}/dönem`, `Ortalama burs indirimi %${Math.round((state.university?.financialAidRate ?? 0.45) * 100)}`, `Saygınlık ${Math.round(prestige)}`]
      : [`Temel harç ${formatMoney(baseTuition)}/dönem`, `Saygınlık ${Math.round(prestige)}`, 'Vakıf üniversitesi'];

  // Yeni alım için yer: az kaldıysa kırmızı, orta ise sarı
  const capClass = remainingCapacity < 20 ? 'ob-kritik' : remainingCapacity < 60 ? 'ob-uyari' : 'ob-iyi';

  /** Kontenjan girdisi: etiket, harç notu ve YKS aralığı üstte. data-field ve .quota-input dinleyicilere bağlı. */
  const girdi = (etiket, not, alan, deger, enCok, yks) => `
    <label class="kont-girdi">
      <span class="ob-ayar-e">${etiket}</span>
      <span class="kont-girdi-not">${not}${yks ? ` · YKS ${yks}` : ''}</span>
      <input type="number" min="0" max="${enCok}" value="${deger}" class="quota-input ob-arama" data-field="${alan}">
    </label>`;

  const bodyHtml = `
    <div class="pencere-yigin">
      <p class="pencere-metin kont-giris">
        ${year + 1}-${year + 2} eğitim yılı için bölüm kontenjanlarını belirleyin. Bahar dönemi sonunda sınıflar
        ilerledikten sonra bu kontenjanlar kadar yeni 1. sınıf öğrencisi alınır.
      </p>
      ${isDevlet ? '<div class="ob-not ob-not--iyi">Devlet modelinde öğrenciler harç ödemez; gelir YÖK tahsisinden gelir.</div>' : ''}
      ${donemiBaslatir ? '<div class="ob-not ob-not--uyari">Kaydettiğinizde Bahar dönemi işlenir ve bir sonraki döneme geçilir.</div>' : ''}

      <div class="ob-dizi">${bilgiRozetleri.map(r => `<span class="ob-rozet">${r}</span>`).join('')}</div>

      <div class="ob-kutular">
        ${_obKutu('Sınıf kapasitesi', dortSinifKoltuk > 0 ? formatNumber(dortSinifKoltuk) : '—', '4 sınıf, bitmiş binalar')}
        ${_obKutu('Hoca kapasitesi', formatNumber(maxStudentsByFaculty), `${totalFaculty} hoca × 30 öğrenci`)}
        ${_obKutu('Yeni alım için yer', formatNumber(remainingCapacity), 'derslik yeri eksi üst sınıflar', capClass)}
      </div>
      <div class="ob-aciklama">Bir bölüme en çok "yeni alım için yer" kadar öğrenci alınır; fazlası kırpılır. Yer, bölümün derslik payı (atanmış binalar ya da ortak derslikler, dört sınıf) eksi gelecek yıl 2-4. sınıfa geçecek öğrencilerdir.${isVakif ? ' Vakıfta kontenjan, beklenen başvuru kadar dolar; başvuruyu harç, saygınlık, tanıtım ve bölüm talebi belirler.' : ''}</div>

      <div id="quota-form" class="kont-liste" data-remaining-cap="${remainingCapacity}">
        ${depts.map(dept => {
          const q      = quotas[dept.id] || defaultQuota(dept.id);
          const d      = byDept[dept.id] || {};
          const cur    = (d.year1?.count||0) + (d.year2?.count||0) + (d.year3?.count||0) + (d.year4?.count||0);
          const mult   = (isVakif ? (dept.tuitionMultiplier || 1.0) : 1.0);
          const net    = netRevenue(q.tamBurslu||0, q.yariBurslu||0, q.ucretli||0, mult);

          // v0.7: bölümün alım yeri (oyunun uyguladığı sınır) ve vakıfta beklenen başvuru
          const yer     = bolumYeri[dept.id] ?? 0;
          const basvuru = isVakif ? vakifBasvuruTahmini(state, dept) : null;

          // Devlet modelinde üç girdi yerine tek "Toplam kontenjan"
          const inputCols = isDevlet
            ? `<div class="kont-girdiler kont-girdiler--tek">
                 ${girdi('Toplam kontenjan', 'devlet kontenjanı', 'ucretli', (q.tamBurslu||0)+(q.yariBurslu||0)+(q.ucretli||0), Math.min(800, yer), yksRange('ucretli'))}
               </div>`
            : `<div class="kont-girdiler">
                 ${girdi(col1Label, basvuru ? `harç yok · başvuru ~${formatNumber(basvuru.tamBurslu)}` : 'harç yok', 'tamBurslu', q.tamBurslu||0, Math.min(200, yer), yksRange('tam_burslu'))}
                 ${girdi(col2Label, basvuru ? `yarı harç · başvuru ~${formatNumber(basvuru.yariBurslu)}` : 'yarı harç', 'yariBurslu', q.yariBurslu||0, Math.min(200, yer), yksRange('yari_burslu'))}
                 ${girdi(col3Label, basvuru ? `tam harç · başvuru ~${formatNumber(basvuru.ucretli)}` : 'tam harç', 'ucretli', q.ucretli||0, Math.min(500, yer), yksRange('ucretli'))}
               </div>`;

          const netLabel = isDevlet
            ? `<span>Katkı payı <b class="qs-net ob-iyi">${formatMoney(net)}/dönem</b></span>`
            : `<span>Net etki <b class="qs-net ${net >= 0 ? 'ob-iyi' : 'ob-kritik'}">${formatMoney(net)}/dönem</b></span>`;

          // Bölüm hocası sayısı: gelecek yıl hoca başına öğrenci (öneri en çok 30)
          const deptFacultyCount = (state.faculty || []).filter(f => (f.departmentId || f.department) === dept.id).length;
          const deptMaxByFaculty = deptFacultyCount * 30;
          const thisQuotaTotal   = (q.tamBurslu||0) + (q.yariBurslu||0) + (q.ucretli||0);
          const ustSinif         = (d.year1?.count||0) + (d.year2?.count||0) + (d.year3?.count||0);
          const exceedsCapacity  = deptMaxByFaculty > 0 && ustSinif + thisQuotaTotal > deptMaxByFaculty;
          const exceedsDersklik  = thisQuotaTotal > yer;
          const talepAsimi       = !!basvuru && ((q.ucretli||0) > basvuru.ucretli || (q.yariBurslu||0) > basvuru.yariBurslu || (q.tamBurslu||0) > basvuru.tamBurslu);

          // Atanmış binaların derslik koltuğu (bilgi amaçlı)
          const deptSeats = deptClassroomCapacity[dept.id] || 0;

          // Atanmış binalar
          const assignedBuildingDetails = completedBuildings
            .filter(b => (b.assignedDepartments || []).includes(dept.id))
            .map(b => {
              const bldgDef  = BUILDINGS[b.type];
              const clsCount = b.currentCapacity?.classrooms || 0;
              const bLvl     = b.level || 1;
              const szByLvl  = bldgDef?.classroomSizeByLevel;
              const clsSize  = szByLvl
                ? (szByLvl[bLvl] ?? szByLvl[1] ?? bldgDef?.classroomSize ?? 40)
                : (bldgDef?.classroomSize ?? 40);
              return `${b.name || b.type}: ${clsCount} derslik × ${clsSize} kişi`;
            }).join(', ');

          return `
            <article class="ob-kart card kont-kart" data-dept="${dept.id}">
              <header class="ob-kimlik">
                <span class="kont-ikon">${bolumIkonu(dept.id, 30, dept.icon || '🏛️')}</span>
                <div class="ob-kimlik-govde">
                  <div class="kont-ad">${dept.name}</div>
                  <div class="ob-kimlik-alt">${formatNumber(cur)} öğrenci · ${deptFacultyCount} hoca</div>
                </div>
              </header>
              <div class="ob-dizi kont-kapasite">
                <span class="ob-rozet ob-rozet--kucuk kont-yer ${exceedsDersklik ? 'ob-rozet--kritik' : 'ob-rozet--iyi'}"
                      title="Dört sınıflık derslik kapasitesi (${formatNumber(dept.studentCapacity || 0)}) eksi 1-3. sınıflar (${formatNumber(ustSinif)})">Yeni alım için yer ${formatNumber(yer)}</span>
                <span class="ob-rozet ob-rozet--kucuk ${deptMaxByFaculty > 0 ? (exceedsCapacity ? 'ob-rozet--uyari' : 'ob-rozet--iyi') : ''}"
                      title="Bölüm hocası × 30 öğrenci; gelecek yılın öğrenci sayısıyla kıyaslanır">Hoca kapasitesi ${deptMaxByFaculty > 0 ? formatNumber(deptMaxByFaculty) : '—'}</span>
                <span class="ob-rozet ob-rozet--kucuk"
                      ${assignedBuildingDetails ? `title="${assignedBuildingDetails}"` : ''}>${deptSeats > 0 ? `Derslik ${formatNumber(deptSeats)} koltuk` : 'Ortak derslikler'}</span>
              </div>
              ${assignedBuildingDetails ? `<div class="ob-aciklama kont-binalar">${assignedBuildingDetails}</div>` : ''}

              <div class="dept-cap-warning ob-not ob-not--kritik kont-uyari"${exceedsDersklik ? '' : ' hidden'}>
                ${exceedsDersklik ? `Kontenjan (${thisQuotaTotal}) bölümün yerini (${yer}) aşıyor; fazlası alınmaz. Derslik binası yapın ya da bölüme bina atayın.` : ''}
              </div>
              <div class="dept-hoca-uyari ob-not ob-not--uyari kont-uyari"${exceedsCapacity ? '' : ' hidden'}>
                ${exceedsCapacity ? `Gelecek yıl hoca başına ${Math.round((ustSinif + thisQuotaTotal) / Math.max(1, deptFacultyCount))} öğrenci düşer (öneri en çok 30): eğitim puanı düşer, dışarıdan ders ücreti artar.` : ''}
              </div>
              <div class="dept-talep-uyari ob-not ob-not--uyari kont-uyari"${talepAsimi ? '' : ' hidden'}>
                ${talepAsimi ? 'Beklenen başvurunun üstündeki kontenjan dolmaz; harcı düşürmek, tanıtım ve saygınlık başvuruyu artırır.' : ''}
              </div>

              ${inputCols}

              <div class="quota-summary kont-ozet" data-dept="${dept.id}">
                <span>Toplam <b class="qs-total">${thisQuotaTotal}</b></span>
                ${netLabel}
                ${isVakif ? `<span class="ob-soluk">Harç çarpanı ×${ondalikYaz(mult, 2)}</span>` : ''}
              </div>
            </article>
          `;
        }).join('')}
      </div>

      <!-- Toplam kontenjan uyarısı -->
      <div id="quota-total-warning" class="ob-not ob-not--kritik" hidden>
        Toplam yeni alım, bölümlerin yerinin toplamını (${formatNumber(remainingCapacity)}) aşıyor; yeri aşan kontenjan alınmaz.
      </div>

      <div class="onay-dugmeler">
        <button type="button" class="btn btn-secondary" id="btn-quota-cancel">${donemiBaslatir ? 'Vazgeç' : 'İptal'}</button>
        <button type="button" class="btn btn-primary" id="btn-quota-confirm">${donemiBaslatir ? 'Kaydet ve Dönemi Başlat' : 'Kaydet'}</button>
      </div>
    </div>
  `;

  showModal('Kontenjan Belirleme', bodyHtml, { wide: true });

  // v0.6: Bölüm Sayfası'ndan açılınca o bölümün kartı görünür ve vurgulu olsun
  if (secenek.odakBolum) {
    const odak = document.querySelector(`#quota-form [data-dept="${secenek.odakBolum}"].card`);
    if (odak) {
      odak.classList.add('kontenjan-odak');
      odak.scrollIntoView({ block: 'center' });
    }
  }

  // Canlı güncelleme: toplam, net gelir ve kapasite uyarısı
  function updateSummary(deptId) {
    const deptEl = document.querySelector(`[data-dept="${deptId}"].card`);
    if (!deptEl) return;
    const tam  = parseInt(deptEl.querySelector('[data-field="tamBurslu"]')?.value || 0);
    const yari = parseInt(deptEl.querySelector('[data-field="yariBurslu"]')?.value || 0);
    const uret = parseInt(deptEl.querySelector('[data-field="ucretli"]')?.value || 0);
    const dept = depts.find(d => d.id === deptId);
    const mult = isVakif ? (dept?.tuitionMultiplier || 1.0) : 1.0;
    const net  = netRevenue(tam, yari, uret, mult);
    const total = tam + yari + uret;

    const sumEl = document.querySelector(`.quota-summary[data-dept="${deptId}"]`);
    if (!sumEl) return;
    sumEl.querySelector('.qs-total').textContent = total;
    const netEl = sumEl.querySelector('.qs-net');
    if (netEl) {
      netEl.textContent = formatMoney(net) + '/dönem';
      const olumlu = isDevlet || net >= 0;
      netEl.classList.toggle('ob-iyi', olumlu);
      netEl.classList.toggle('ob-kritik', !olumlu);
    }

    // v0.7: bölümün yeri (kesin sınır), hoca başına öğrenci (öneri) ve vakıfta beklenen başvuru
    const yer          = bolumYeri[deptId] ?? 0;
    const bd           = byDept[deptId] || {};
    const ust          = (bd.year1?.count || 0) + (bd.year2?.count || 0) + (bd.year3?.count || 0);
    const deptFacCount = (state.faculty || []).filter(f => (f.departmentId || f.department) === deptId).length;
    const deptMaxFac   = deptFacCount * 30;
    const capWarnEl    = deptEl.querySelector('.dept-cap-warning');
    if (capWarnEl) {
      capWarnEl.hidden = !(total > yer);
      capWarnEl.textContent = total > yer
        ? `Kontenjan (${total}) bölümün yerini (${yer}) aşıyor; fazlası alınmaz. Derslik binası yapın ya da bölüme bina atayın.` : '';
    }
    const yerRozet = deptEl.querySelector('.kont-yer');
    if (yerRozet) {
      yerRozet.classList.toggle('ob-rozet--kritik', total > yer);
      yerRozet.classList.toggle('ob-rozet--iyi', total <= yer);
    }
    const hocaUyari = deptEl.querySelector('.dept-hoca-uyari');
    if (hocaUyari) {
      const asim = deptMaxFac > 0 && ust + total > deptMaxFac;
      hocaUyari.hidden = !asim;
      hocaUyari.textContent = asim
        ? `Gelecek yıl hoca başına ${Math.round((ust + total) / Math.max(1, deptFacCount))} öğrenci düşer (öneri en çok 30): eğitim puanı düşer, dışarıdan ders ücreti artar.` : '';
    }
    const talepUyari = deptEl.querySelector('.dept-talep-uyari');
    const basvuru    = isVakif && dept ? vakifBasvuruTahmini(state, dept) : null;
    if (talepUyari && basvuru) {
      const asim = uret > basvuru.ucretli || yari > basvuru.yariBurslu || tam > basvuru.tamBurslu;
      talepUyari.hidden = !asim;
      talepUyari.textContent = asim ? 'Beklenen başvurunun üstündeki kontenjan dolmaz; harcı düşürmek, tanıtım ve saygınlık başvuruyu artırır.' : '';
    }

    // Toplam kapasite uyarısı
    let grandTotal = 0;
    document.querySelectorAll('[data-dept].card').forEach(card => {
      const t = parseInt(card.querySelector('[data-field="tamBurslu"]')?.value || 0);
      const y = parseInt(card.querySelector('[data-field="yariBurslu"]')?.value || 0);
      const u = parseInt(card.querySelector('[data-field="ucretli"]')?.value || 0);
      grandTotal += t + y + u;
    });
    const warnEl = document.getElementById('quota-total-warning');
    if (warnEl) warnEl.hidden = !(grandTotal > remainingCapacity);
  }

  document.querySelectorAll('.quota-input').forEach(input => {
    input.addEventListener('input', () => {
      const card = input.closest('[data-dept]');
      if (card) updateSummary(card.dataset.dept);
    });
  });

  on(el('btn-quota-cancel'), 'click', () => hideModal());

  on(el('btn-quota-confirm'), 'click', () => {
    const newQuotas = {};
    depts.forEach(dept => {
      const card = document.querySelector(`[data-dept="${dept.id}"].card`);
      if (!card) return;
      const tam  = Math.max(0, parseInt(card.querySelector('[data-field="tamBurslu"]')?.value || 0));
      const yari = Math.max(0, parseInt(card.querySelector('[data-field="yariBurslu"]')?.value || 0));
      const uret = Math.max(0, parseInt(card.querySelector('[data-field="ucretli"]')?.value || 0));
      newQuotas[dept.id] = { tamBurslu: tam, yariBurslu: yari, ucretli: uret };
    });

    hideModal();
    if (onConfirm) onConfirm(newQuotas);
    showNotification('Kontenjanlar belirlendi. Bahar dönemi sonunda uygulanacak.', 'success');
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. YERLEŞKE PANELİ
// ─────────────────────────────────────────────────────────────────────────────

// Bina katalogunu data.js'deki BUILDINGS'den türet
const BUILDING_CATALOG = Object.values(BUILDINGS).map(b => ({
  type:             b.id,
  name:             b.name,
  icon:             b.icon,
  desc:             b.description,
  cost:             b.baseCost ?? b.constructionCost,
  constructionTime: b.constructionTurns ?? b.constructionTime,
  baseArea:         b.baseArea,
  maxLevel:         b.maxLevel ?? 1,
  canHaveMultiple:  b.canHaveMultiple ?? false,
  maintenanceCostPerM2: b.maintenanceCostPerM2,
  classroomSize:         b.classroomSize ?? 40,
  classroomSizeByLevel:  b.classroomSizeByLevel ?? null,
  capacity:              b.capacity || {},
  capacityPerLevel: b.capacityPerLevel || {},
  effects:          b.effects || {},
  qualityEffects:   b.qualityEffects || {},
  prerequisite:     b.prerequisite || null,
  assignable:       b.assignable ?? false,
  benefitText:      b.benefitText ?? null,
}));

/** Bina etki nesnesini Türkçe kısa etiketlere çevirir */
function _formatBuildingEffects(effects) {
  // Ondalıklar Türkçe virgülle (0.3 → 0,3)
  const s = (v) => ondalikYaz(v, 2);
  const labelMap = {
    educationQuality:       (v) => `+${s(v)} eğitim kalitesi`,
    studentSatisfaction:    (v) => `+${s(v)} öğrenci memnuniyeti`,
    researchOutput:         (v) => `+${s(v)} araştırma çıktısı`,
    researchBoost:          (v) => `+%${Math.round(v * 100)} araştırma bonusu`,
    labScore:               (v) => `+${s(v)} laboratuvar puanı`,
    publicationRate:        (v) => `+${s(v)} yayın/hoca/yıl`,
    studentGPA:             (v) => `+${s(v)} not ortalaması`,
    facultyHappiness:       (v) => `+${s(v)} hoca memnuniyeti`,
    studentDemandBonus:     (v) => `+%${Math.round(v * 100)} öğrenci talebi`,
    revenuePerBed:          (v) => `+${formatMoney(v)}/dönem yurt geliri (yatak başına)`,
    prestige:               ()  => 'saygınlığa katkı',
    internationalization:   (v) => `+${s(v)} uluslararasılaşma`,
    internationalVisibility:(v) => `+${s(v)} uluslararası görünürlük`,
    eventRevenuePerTurn:    (v) => `+${formatMoney(v)}/dönem etkinlik geliri`,
    tubitakSuccessRate:     (v) => `+%${Math.round(v * 100)} TÜBİTAK başarı şansı`,
    industryTieBonus:       (v) => `+${s(v)} sektör bağı`,
    coopPartnerQuality:     (v) => `+${s(v)} co-op kalitesi`,
    annualRentalRevenue:    (v) => `+${formatMoney(v)}/yıl kira geliri`,
    alumniBonus:            (v) => `+${s(v)} mezun bonusu`,
    coopStressReduction:    (v) => `−${s(v)} co-op stresi`,
    classroomCapacity:      (v) => `+${s(v)} derslik kapasitesi`,
    officeCapacity:         (v) => `+${s(v)} ofis kapasitesi`,
    dormCapacity:           (v) => `+${s(v)} yatak`,
    interdisciplinaryBonus: ()  => 'Disiplinlerarası bonus',
    spinoffRevenue:         ()  => 'Spin-off geliri',
  };
  return Object.entries(effects)
    .map(([k, v]) => labelMap[k] ? labelMap[k](v) : null)
    .filter(Boolean);
}

/** v0.6.1: kullanım oranına göre durum sınıfı: doluluk %100'ü aştıysa kritik, %85'i aştıysa uyarı. */
function _kullanimSinifi(kullanilan, toplam) {
  if (!toplam) return '';
  const oran = kullanilan / toplam;
  return oran > 1 ? 'ob-kritik' : oran > 0.85 ? 'ob-uyari' : '';
}

/** Kapasite satırı ve doluluğa göre renklenen çubuk ("Ofis 18 / 10"). Toplam yoksa boş döner. */
function _capacityBar(label, used, total) {
  if (total == null || total === 0) return '';
  const oran = used / total;
  const tur  = oran >= 0.9 ? 'kritik' : oran >= 0.7 ? 'uyari' : 'iyi';
  return `
    ${_obSatir(label, `${formatNumber(used)}<span class="ob-soluk"> / ${formatNumber(total)}</span>`, `ob-${tur}`)}
    <div class="ob-cubuk ob-cubuk--${tur}"><span style="width:${Math.min(100, Math.round(oran * 100))}%"></span></div>`;
}

/**
 * Hizmet binasının yeterliliği: talebin kapasiteye oranı rozetle ve çubukla.
 * %100'e kadar yeterli, sinirda'ya kadar sınırda, üstü yetersiz (eskiden "✅ %157 — Yetersiz").
 */
function _yeterlilik(yuzde, sinirda = 130) {
  const tur  = yuzde <= 100 ? 'iyi' : yuzde <= sinirda ? 'uyari' : 'kritik';
  const yazi = yuzde <= 100 ? 'yeterli' : yuzde <= sinirda ? 'sınırda' : 'yetersiz';
  return `
    <div class="ob-satir"><span>Yeterlilik</span><span class="ob-rozet ob-rozet--${tur} ob-rozet--kucuk">%${yuzde} · ${yazi}</span></div>
    <div class="ob-cubuk ob-cubuk--${tur}"><span style="width:${Math.min(100, Math.max(0, yuzde))}%"></span></div>`;
}

/** Bina kartında başlıklı alt bölüm (Derslikler, Ofisler, Etkileri ...); içerik boşsa hiç yazılmaz. */
function _binaBolumu(baslik, icerik) {
  return icerik ? `<div class="bina-bolum"><div class="ob-kart-baslik">${baslik}</div>${icerik}</div>` : '';
}

/**
 * Yerleşke sekmesi: yerleşke özeti, mevcut binalar ve inşaat seçenekleri.
 * @param {object}   state          — Oyun durumu
 * @param {Function} onBuildStart   — İnşaat başlat callback (buildingType alır)
 * @param {Function} onDecision     — Karar callback (upgrade_building, assign_department_to_building vb.)
 */
/**
 * v0.5.0: haritada binanın bilgi kutusu (adı, türü, düzeyi, durumu).
 * Konum imlecin sağ altı; kapsayıcıdan taşacaksa imlecin öbür yanına geçer.
 */
function _binaIpucu(tooltip, b, e) {
  if (!tooltip) return;
  if (!b) { tooltip.style.display = 'none'; return; }
  const cat  = BUILDINGS[b.type] || {};
  const tur  = cat.name || b.type;
  const ad   = b.name || tur;
  const max  = cat.maxLevel || 3;
  const yuzde = Math.round(b.constructionProgress || 0);
  const durum = !b.isCompleted
    ? `<span class="ct-durum ct-insaat">İnşaat %${yuzde}${b.turnsRemaining != null ? ` · ${b.turnsRemaining} dönem kaldı` : ''}</span>`
    : b.status === 'upgrading'
      ? `<span class="ct-durum ct-yukselt">Düzey ${(b._pendingLevel ?? (b.level || 1) + 1)} için yükseltiliyor · %${yuzde}</span>`
      : `<span class="ct-durum ct-aktif">Aktif</span>`;
  tooltip.innerHTML = `
    <strong>${ad}</strong>
    ${ad.startsWith(tur) ? '' : `<span class="ct-tur">${tur}</span>`}
    <span class="ct-duzey">Düzey ${b.level || 1}/${max} · ${(b.area || 0).toLocaleString('tr-TR')} m²</span>
    ${durum}`;
  tooltip.style.display = 'flex';
  const kap = (tooltip.offsetParent || tooltip.parentElement).getBoundingClientRect();
  const mx = e.clientX - kap.left, my = e.clientY - kap.top;
  const tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
  let x = mx + 16, y = my + 18;
  if (x + tw > kap.width - 8) x = mx - tw - 16;
  if (y + th > kap.height - 8) y = my - th - 14;
  tooltip.style.left = Math.max(8, x) + 'px';
  tooltip.style.top  = Math.max(8, y) + 'px';
}

/**
 * v0.5.0: binanın görseli (assets/buildings). Düzey üst sınırı aşılırsa sınıra çekilir;
 * inşaat sürüyorsa ilerlemeye göre inşaat aşaması gösterilir.
 */
function _binaGorseli(tur, duzey, boyut = 64, insaatYuzde = null) {
  const anahtar = insaatYuzde != null
    ? `insaat_${insaatYuzde < 34 ? 1 : insaatYuzde < 67 ? 2 : 3}`
    : `${tur}_${Math.max(1, Math.floor(duzey || 1))}`;
  return `<img class="bina-gorsel" src="assets/buildings/${anahtar}.webp?v=0.5.0" alt=""
    width="${boyut}" height="${boyut}" loading="lazy" onerror="this.style.visibility='hidden'">`;
}

/** v0.5.2: bina kapasitesinin kısa Türkçe dökümü ("10 derslik (40 kişilik) · 30 ofis"). */
function _kapasiteParcalari(kap, derslikBoyu) {
  const k = kap || {};
  const sayi = (v) => (Number(v) || 0).toLocaleString('tr-TR');
  const parcalar = [];
  if (k.classrooms) parcalar.push(`${sayi(k.classrooms)} derslik${derslikBoyu ? ` (${derslikBoyu} kişilik)` : ''}`);
  if (k.offices) parcalar.push(`${sayi(k.offices)} ofis`);
  if (k.labs) parcalar.push(`${sayi(k.labs)} laboratuvar`);
  if (k.beds) parcalar.push(`${sayi(k.beds)} yatak`);
  if (k.simultaneous) parcalar.push(`aynı anda ${sayi(k.simultaneous)} kişi`);
  if (k.daily) parcalar.push(`günde ${sayi(k.daily)} kişi`);
  if (k.dailyMeals) parcalar.push(`günde ${sayi(k.dailyMeals)} öğün`);
  if (k.dailyUsers) parcalar.push(`günde ${sayi(k.dailyUsers)} kullanıcı`);
  if (k.dailyPatients) parcalar.push(`günde ${sayi(k.dailyPatients)} hasta`);
  return parcalar;
}

/** Düzeydeki kapasite: temel + düzey başına artış × (düzey − 1). */
function _duzeyKapasitesi(tanim, duzey) {
  const temel = tanim?.capacity || {};
  const artis = tanim?.capacityPerLevel || {};
  const sonuc = {};
  for (const k of Object.keys(temel)) sonuc[k] = (temel[k] || 0) + (artis[k] || 0) * (duzey - 1);
  return sonuc;
}

function _derslikBoyu(tanim, duzey) {
  const tablo = tanim?.classroomSizeByLevel;
  return tablo ? (tablo[duzey] ?? tablo[1] ?? tanim?.classroomSize ?? 40) : (tanim?.classroomSize ?? null);
}

function _onaySatirlari(satirlar) {
  return `<div class="onay-liste">${satirlar.filter(Boolean).map(([ad, deger]) =>
    `<div class="onay-satir"><span>${ad}</span><b>${deger}</b></div>`).join('')}</div>`;
}

/** Yeni bina inşaatı onay penceresinin içeriği: maliyet, süre, alan, bakım, kazanç. */
function _insaatOnayIcerigi(katalog, kasa) {
  const tanim   = BUILDINGS[katalog.type] || {};
  const kazanc  = [
    ..._kapasiteParcalari(_duzeyKapasitesi(tanim, 1), _derslikBoyu(tanim, 1)),
    ..._formatBuildingEffects({ ...katalog.qualityEffects, ...katalog.effects }),
  ];
  if (katalog.benefitText) kazanc.push(_veriMetni(katalog.benefitText));
  const bakim = katalog.baseArea && katalog.maintenanceCostPerM2
    ? formatMoney(katalog.baseArea * katalog.maintenanceCostPerM2) : null;
  return `
    <div class="onay-bina">
      ${_binaGorseli(katalog.type, 1, 72)}
      <div><div class="onay-bina-ad">${katalog.name}</div><div class="onay-bina-aciklama">${_veriMetni(katalog.desc)}</div></div>
    </div>
    ${_onaySatirlari([
      ['Maliyet', `${formatMoney(katalog.cost)} (şimdi kasadan düşer)`],
      ['Süre', `${katalog.constructionTime} dönem`],
      ['Alan', `${(katalog.baseArea || 0).toLocaleString('tr-TR')} m²`],
      bakim ? ['Dönemlik bakım', `~${bakim} (bina bitince)`] : null,
      ['İnşaattan sonra kasa', formatMoney(kasa - katalog.cost)],
    ])}
    ${kazanc.length ? `<div class="onay-kazanc"><div class="onay-kazanc-baslik">Ne kazandırır</div>
      <ul>${kazanc.map(k => `<li>${k}</li>`).join('')}</ul></div>` : ''}`;
}

/** Düzey yükseltme onay penceresinin içeriği; bina yükseltilemiyorsa null. */
function _yukseltmeOnayIcerigi(bina, kasa) {
  const tanim = BUILDINGS[bina.type];
  if (!tanim) return null;
  const duzey  = bina.level || 1;
  const sonraki = duzey + 1;
  const enCok  = tanim.maxLevel ?? 3;
  if (sonraki > enCok) return null;
  // Maliyet ve süre game.js upgrade_building ile aynı formül
  const maliyet = Math.round((tanim.baseCost ?? tanim.constructionCost ?? 0) * Math.pow(tanim.upgradeCostMultiplier ?? 1.5, duzey));
  const sure    = tanim.constructionTurns ?? tanim.constructionTime ?? 2;
  const simdi   = _kapasiteParcalari(bina.currentCapacity || _duzeyKapasitesi(tanim, duzey), _derslikBoyu(tanim, duzey));
  const sonra   = _kapasiteParcalari(_duzeyKapasitesi(tanim, sonraki), _derslikBoyu(tanim, sonraki));
  const ad      = bina.name || tanim.name;
  return {
    maliyet,
    baslik: `${ad}: Düzey ${sayiEkle(sonraki)} Yükseltme`,
    html: `
      <div class="onay-bina">
        ${_binaGorseli(bina.type, Math.min(sonraki, enCok), 72)}
        <div><div class="onay-bina-ad">${ad}</div><div class="onay-bina-aciklama">Düzey ${duzey} → ${sonraki} (en çok ${enCok})</div></div>
      </div>
      ${_onaySatirlari([
        ['Maliyet', `${formatMoney(maliyet)} (şimdi kasadan düşer)`],
        ['Süre', `${sure} dönem; bu sürede bina mevcut kapasitesiyle çalışır`],
        ['Yükseltmeden sonra kasa', formatMoney(kasa - maliyet)],
      ])}
      ${sonra.length ? `<div class="onay-kazanc"><div class="onay-kazanc-baslik">Ne kazandırır</div>
        <ul>
          <li>Şimdi: ${simdi.join(' · ') || 'kapasite yok'}</li>
          <li>Düzey ${sonraki}: <b>${sonra.join(' · ')}</b></li>
          ${bina.type === 'lab' ? `<li>Bağlı bölümlere laboratuvar puanı: +${25 * duzey} → <b>+${25 * sonraki}</b></li>` : ''}
        </ul></div>` : `<div class="onay-kazanc"><div class="onay-kazanc-baslik">Ne kazandırır</div>
        <ul><li>Bu binanın düzeye bağlı bir kapasitesi yok${tanim.benefitText ? ` (${_veriMetni(tanim.benefitText)})` : ''}.</li></ul></div>`}`,
  };
}

export function renderCampusPanel(state, onBuildStart, onDecision) {
  const panel = el('tab-campus');
  if (!panel) return;

  const buildings = state.buildings || [];
  const budget    = state.university?.budget ?? 0;
  const depts     = state.departments || [];

  // İstatistikler
  const completedBuildings = buildings.filter(b => b.isCompleted);
  const inProgressBuildings = buildings.filter(b => !b.isCompleted);

  let totalArea = 0, totalMaintenance = 0;
  completedBuildings.forEach(b => {
    totalArea        += b.area || 0;
    totalMaintenance += b.maintenanceCost || 0;
  });

  // Kapasite/kullanım özeti: her bölüm bir kez sayılır (çift sayım önlenir, Issue #28)
  const _usage = calculateCampusUsageSummary(state);
  const { totalOffices, usedOffices, totalClassrooms, usedClassrooms, totalLabs, usedLabs, totalBeds } = _usage;

  // Katalog sözlüğü
  const catalogMap = {};
  BUILDING_CATALOG.forEach(c => { catalogMap[c.type] = c; });

  // Mevcut tiplerin sayısı (canHaveMultiple=false olanlar için)
  const existingTypeCounts = {};
  buildings.forEach(b => {
    existingTypeCounts[b.type] = (existingTypeCounts[b.type] || 0) + 1;
  });

  const totalStudents = state.students ? (state.students.totalEnrolled || 0) : 0;
  const totalFaculty  = (state.faculty || []).length;
  const sayi = v => formatNumber(v || 0);
  const kullanim = (kullanilan, toplam) => `${sayi(kullanilan)}<small>/${sayi(toplam)}</small>`;

  // v0.6.1: yerleşke özeti ortak gösterge kutularıyla (eskiden emojili düz kutular)
  const ozetHtml = `
    <div class="ob-kutular">
      ${_obKutu('Toplam alan', `${sayi(totalArea)}<small>m²</small>`, `${completedBuildings.length} bitmiş bina`)}
      ${_obKutu('Derslikler', kullanim(usedClassrooms, totalClassrooms), 'kullanımda / toplam', _kullanimSinifi(usedClassrooms, totalClassrooms))}
      ${_obKutu('Ofisler', kullanim(usedOffices, totalOffices), 'kullanımda / toplam', _kullanimSinifi(usedOffices, totalOffices))}
      ${_obKutu('Laboratuvarlar', kullanim(usedLabs, totalLabs), 'kullanımda / toplam', _kullanimSinifi(usedLabs, totalLabs))}
      ${_obKutu('Yurt yatağı', sayi(totalBeds), `${sayi(totalStudents)} öğrenci için`)}
      ${_obKutu('Dönemlik bakım', formatMoney(totalMaintenance), 'bitmiş binaların bakımı')}
    </div>`;

  /** Mevcut bina kartı: kimlik satırı, alan ve bakım, türe göre ayrıntı, yükseltme ve atama düğmeleri. */
  const binaKarti = (b) => {
    const cat    = catalogMap[b.type] || {};
    const maxLvl = cat.maxLevel || 3;
    const ad     = b.name || cat.name || b.type;

    if (!b.isCompleted) {
      // Yapım / yükseltme aşamasındaki kart
      const pct   = Math.round(b.constructionProgress ?? 0);
      const isUpg = b.status === 'upgrading';
      const kalan = b.turnsRemaining != null ? `${b.turnsRemaining} dönem kaldı` : 'yapım sürüyor';
      return `
        <article class="ob-kart bina-kart bina-kart--yapim">
          <header class="ob-kimlik">
            <span class="ob-kimlik-ikon ob-kimlik-ikon--gorsel">${isUpg
              ? _binaGorseli(b.type, Math.min(b.level || 1, maxLvl), 56)
              : _binaGorseli(b.type, 1, 56, pct)}</span>
            <div class="ob-kimlik-govde">
              <div class="ob-kimlik-ad">${ad}</div>
              <div class="ob-kimlik-alt">${isUpg ? `Düzey ${sayiEkle(b._pendingLevel ?? b.level + 1)} yükseltiliyor` : 'Yapım aşamasında'}</div>
            </div>
            <span class="ob-rozet ob-rozet--uyari ob-rozet--kucuk">${kalan}</span>
          </header>
          ${_obSatir(isUpg ? 'Yükseltme' : 'Yapım', `%${pct}`)}
          <div class="ob-cubuk ob-cubuk--uyari"><span style="width:${Math.min(100, pct)}%"></span></div>
        </article>`;
    }

    const upgCost = b.level < maxLvl
      ? Math.round((cat.cost || 0) * Math.pow((BUILDINGS[b.type]?.upgradeCostMultiplier ?? 1.5), b.level))
      : 0;
    // Yükseltme süresi (dönem): oyuncu düğmeye basmadan önce görsün
    const upgTurns = BUILDINGS[b.type]?.constructionTurns ?? cat.constructionTime ?? 2;

    // Kapasite referansları
    const cap  = b.currentCapacity || {};
    const used = b.usedCapacity || {};

    // Düzeye göre derslik kapasitesi
    const currentLevel   = b.level || 1;
    const clsSizeByLvl   = cat.classroomSizeByLevel;
    const clsSize        = clsSizeByLvl
      ? (clsSizeByLvl[currentLevel] ?? clsSizeByLvl[1] ?? cat.classroomSize ?? 40)
      : (cat.classroomSize ?? (b.type === 'amfi' ? 150 : 40));
    const nextLevel      = currentLevel + 1;
    const sonrakiVar     = nextLevel <= maxLvl;
    const nextLvlClsSize = clsSizeByLvl ? (clsSizeByLvl[nextLevel] ?? clsSize) : clsSize;
    const nextLvlCap     = BUILDINGS[b.type] ? _duzeyKapasitesi(BUILDINGS[b.type], nextLevel) : {};
    const sonrakiNot     = metin => sonrakiVar ? `<div class="ob-aciklama">Düzey ${sayiEkle(nextLevel, 'de')}: ${metin}</div>` : '';

    // Türe göre ayrıntı
    let detailsHtml = '';

    if (b.type === 'fakulte_binasi' || b.type === 'amfi') {
      const studentCapacity = cap.classrooms ? cap.classrooms * clsSize : 0;
      const nextStudentCap  = nextLvlCap.classrooms ? nextLvlCap.classrooms * nextLvlClsSize : 0;
      const assignedDepts   = (b.assignedDepartments || []).map(dId => {
        const d = depts.find(dep => dep.id === dId);
        if (!d) return null;
        const dDeptData = state.students?.byDepartment?.[dId];
        const dStudents = dDeptData
          ? ((dDeptData.year1?.count || 0) + (dDeptData.year2?.count || 0) +
             (dDeptData.year3?.count || 0) + (dDeptData.year4?.count || 0))
          : 0;
        const dFaculty  = (state.faculty || []).filter(f => (f.department || f.departmentId) === dId).length;
        return _obSatir(d.shortName || d.name, `${sayi(dStudents)} öğrenci · ${dFaculty} hoca`);
      }).filter(Boolean).join('');

      detailsHtml = `
        ${cap.classrooms ? _binaBolumu('Derslikler', `
          ${_obSatir('Kapasite', `${cap.classrooms} × ${clsSize} kişi = ${sayi(studentCapacity)} öğrenci`)}
          ${_obSatir('Kullanılan / boş', `${used.classrooms ?? 0} / ${Math.max(0, cap.classrooms - (used.classrooms ?? 0))}`)}
          ${nextLvlCap.classrooms ? sonrakiNot(`${nextLvlCap.classrooms} derslik × ${nextLvlClsSize} kişi = ${sayi(nextStudentCap)} öğrenci${nextLvlClsSize > clsSize ? ` (derslikler ${clsSize} kişiden ${nextLvlClsSize} kişiye büyür)` : ''}.`) : ''}`) : ''}
        ${cap.offices ? _binaBolumu('Ofisler', `
          ${_obSatir('Ofis', cap.offices)}
          ${_obSatir('Kullanılan / boş', `${used.offices ?? 0} / ${Math.max(0, cap.offices - (used.offices ?? 0))}`)}
          <div class="ob-aciklama">Boş ofis varken her hocaya bir ofis düşer; yetmezse Dr. Öğr. Üyeleri ikişer, araştırma görevlileri üçer kişi paylaşır.</div>
          ${nextLvlCap.offices ? sonrakiNot(`${nextLvlCap.offices} ofis.`) : ''}`) : ''}
        ${cap.labs != null ? _binaBolumu('Laboratuvarlar', cap.labs === 0
          ? _obSatir('Laboratuvar', '0 <span class="ob-soluk">(laboratuvar binası gerekir)</span>')
          : `${_obSatir('Laboratuvar', cap.labs)}${_obSatir('Kullanılan / boş', `${used.labs ?? 0} / ${Math.max(0, cap.labs - (used.labs ?? 0))}`)}`) : ''}
        ${_binaBolumu('Atanmış bölümler', assignedDepts || '<div class="ob-aciklama">Henüz bölüm atanmadı; aşağıdaki "Bölüm ata" düğmesiyle ekleyebilirsiniz.</div>')}`;
    } else if (b.type === 'kutuphane') {
      const simCap   = cap.simultaneous || 200;
      const dailyCap = cap.daily || 800;
      const nextSim  = nextLvlCap.simultaneous || 0;
      const nextDly  = nextLvlCap.daily || 0;
      const pct      = totalStudents > 0 ? Math.round((totalStudents / dailyCap) * 100) : 0;
      detailsHtml = `
        ${_binaBolumu('Hizmet kapasitesi', `
          ${_obSatir('Aynı anda çalışabilen', `${sayi(simCap)} öğrenci`)}
          ${_obSatir('Günlük kapasite', `~${sayi(dailyCap)} öğrenci`)}
          ${_obSatir('Öğrenci sayısı', sayi(totalStudents))}
          ${_yeterlilik(pct)}
          ${pct > 100 ? `<div class="ob-aciklama ob-aciklama--kritik">Öğrenci sayısı günlük kapasiteyi (${sayi(dailyCap)}) aşıyor.</div>` : ''}
          ${sonrakiNot(`aynı anda ${sayi(nextSim)}, günde ${sayi(nextDly)} öğrenci.`)}`)}
        ${_binaBolumu('Etkileri', `
          ${_obSatir('Öğrenci memnuniyeti', '+5', 'ob-iyi')}
          ${_obSatir('Araştırma bonusu', '+%5', 'ob-iyi')}
          ${_obSatir('Not ortalaması', '+0,1', 'ob-iyi')}`)}`;
    } else if (b.type === 'yemekhane') {
      const mealsBuildings = (state.buildings || []).filter(bld => bld.type === 'yemekhane' && bld.isCompleted);
      const totalMealCap   = mealsBuildings.reduce((s, bld) => s + ((bld.currentCapacity?.dailyMeals) || 0), 0);
      const need           = totalStudents + totalFaculty;
      const pct            = need > 0 && totalMealCap > 0 ? Math.round((need / totalMealCap) * 100) : 0;
      const myCap          = cap.dailyMeals || 0;
      const nextCap2       = nextLvlCap.dailyMeals || 0;
      const yeterli        = pct <= 100;
      detailsHtml = `
        ${_binaBolumu('Hizmet kapasitesi', `
          ${_obSatir('Bu yemekhane', `günde ${sayi(myCap)} öğün`)}
          ${_obSatir('Yerleşke toplamı', `günde ${sayi(totalMealCap)} öğün`)}
          ${_obSatir('İhtiyaç', `${sayi(totalStudents)} öğrenci + ${sayi(totalFaculty)} hoca = ${sayi(need)}`)}
          ${_yeterlilik(pct)}
          ${pct > 100 ? '<div class="ob-aciklama ob-aciklama--kritik">Kuyruklar uzuyor, memnuniyet düşüyor.</div>' : ''}
          ${sonrakiNot(`günde ${sayi(nextCap2)} öğün.`)}`)}
        ${_binaBolumu('Etkileri', `
          ${_obSatir('Öğrenci memnuniyeti', yeterli ? '+6' : '-3', yeterli ? 'ob-iyi' : 'ob-kritik')}
          ${_obSatir('Hoca memnuniyeti', yeterli ? '+4' : '-2', yeterli ? 'ob-iyi' : 'ob-kritik')}`)}`;
    } else if (b.type === 'yurt') {
      const totalBedCap = ((state.buildings || []).filter(bld => bld.type === 'yurt' && bld.isCompleted)
        .reduce((s, bld) => s + ((bld.currentCapacity?.beds) || 0), 0));
      const dormPct  = totalBedCap > 0 && totalStudents > 0
        ? Math.round((Math.min(totalBedCap, totalStudents) / totalStudents) * 100)
        : 0;
      const usedBeds = used.beds ?? Math.min(totalStudents, cap.beds || 0);
      const freeBeds = Math.max(0, (cap.beds || 0) - usedBeds);
      const ocpPct   = cap.beds ? Math.round((usedBeds / cap.beds) * 100) : 0;
      const dormRev  = usedBeds * 5_000;
      const nextBeds = nextLvlCap.beds || 0;
      detailsHtml = `
        ${_binaBolumu('Yatak kapasitesi', `
          ${_obSatir('Yatak', sayi(cap.beds || 0))}
          ${_obSatir('Dolu / boş', `${sayi(usedBeds)} / ${sayi(freeBeds)}`)}
          ${_obSatir('Doluluk', `%${ocpPct}`)}
          ${_obSatir('Yurt imkânı', `%${dormPct} <span class="ob-soluk">(yatak / öğrenci)</span>`)}
          ${sonrakiNot(`${sayi(nextBeds)} yatak.`)}`)}
        ${_binaBolumu('Etkileri', `
          ${_obSatir('Yurtlu öğrenci memnuniyeti', '+8', 'ob-iyi')}
          ${dormPct < 40 ? '<div class="ob-aciklama ob-aciklama--kritik">Yurtsuz öğrenci oranı yüksek; memnuniyet düşer.</div>' : ''}`)}
        ${_binaBolumu('Gelir', _obSatir('Yurt geliri', `${sayi(usedBeds)} × 5.000 ₺ = ${formatMoney(dormRev)}/dönem`, 'ob-iyi'))}`;
    } else if (b.type === 'spor_tesisi') {
      const sporCap  = cap.dailyUsers || 500;
      const nextSCap = nextLvlCap.dailyUsers || 0;
      const pct      = totalStudents > 0 ? Math.round((totalStudents / sporCap) * 100) : 0;
      detailsHtml = `
        ${_binaBolumu('Hizmet kapasitesi', `
          ${_obSatir('Günlük kapasite', `${sayi(sporCap)} kullanıcı`)}
          ${_obSatir('Öğrenci sayısı', sayi(totalStudents))}
          ${_yeterlilik(pct)}
          ${sonrakiNot(`günde ${sayi(nextSCap)} kullanıcı.`)}`)}
        ${_binaBolumu('Etkileri', `
          ${_obSatir('Öğrenci memnuniyeti', '+6', 'ob-iyi')}
          ${_obSatir('Saygınlık', 'katkı sağlar', 'ob-iyi')}
          ${pct > 130 ? '<div class="ob-aciklama ob-aciklama--kritik">Kapasite aşıldı; öğrenci şikâyeti artıyor.</div>' : ''}`)}`;
    } else if (b.type === 'idari_bina') {
      const adminStaffCount = (state.adminStaff || []).length;
      const offices         = cap.offices || 0;
      const pct             = offices > 0 ? Math.round((adminStaffCount / offices) * 100) : 0;
      detailsHtml = `
        ${_binaBolumu('Ofis kapasitesi', `
          ${_obSatir('Ofis', `${offices} <span class="ob-soluk">(Düzey ${b.level || 1})</span>`)}
          ${_obSatir('İdari personel', `${adminStaffCount} kişi`)}
          ${_yeterlilik(pct, 100)}
          ${nextLvlCap.offices ? sonrakiNot(`${nextLvlCap.offices} ofis.`) : ''}`)}
        ${_binaBolumu('Etkileri', `
          ${_obSatir('İdari verimlilik', '+%15', 'ob-iyi')}
          ${_obSatir('Öğrenci memnuniyeti', '+3', 'ob-iyi')}`)}`;
    } else if (b.type === 'lab') {
      // Laboratuvar binası: bağlı bölümler ve laboratuvar puanı katkısı
      const labBonus    = 25 * (b.level || 1);
      const labTotalCap = cap.labs || 0;
      const linkedLabDepts = (b.linkedDepartments || []).map(dId => {
        const d = (state.departments || []).find(dep => dep.id === dId);
        if (!d) return null;
        return _obSatir(d.shortName || d.name, `+${labBonus} laboratuvar puanı`, 'ob-iyi');
      }).filter(Boolean).join('');
      detailsHtml = `
        ${_binaBolumu('Laboratuvar kapasitesi', `
          ${_obSatir('Laboratuvar', `${labTotalCap} <span class="ob-soluk">(Düzey ${b.level || 1})</span>`)}
          ${_obSatir('Bağlı bölüme katkı', `+${labBonus} laboratuvar puanı`, 'ob-iyi')}
          <div class="ob-aciklama">Katkı düzey başına 25 puandır.</div>`)}
        ${_binaBolumu('Bağlı bölümler', linkedLabDepts || '<div class="ob-aciklama">Henüz bağlı bölüm yok; aşağıdaki "Bölüm bağla" düğmesiyle ekleyebilirsiniz.</div>')}`;
    } else {
      // Öteki binalar (araştırma merkezi, konferans vb.): kapasite çubukları
      const capBarsHtml = [
        cap.offices    ? _capacityBar('Ofis',        used.offices    ?? 0, cap.offices)    : '',
        cap.classrooms ? _capacityBar('Derslik',     used.classrooms ?? 0, cap.classrooms) : '',
        cap.labs       ? _capacityBar('Laboratuvar', used.labs       ?? 0, cap.labs)       : '',
        cap.beds       ? _capacityBar('Yatak',       used.beds       ?? 0, cap.beds)       : '',
      ].join('');
      detailsHtml = `
        ${_binaBolumu('Kapasite', capBarsHtml)}
        ${cat.benefitText ? `<div class="ob-aciklama">${_veriMetni(cat.benefitText)}</div>` : ''}`;
    }

    const durumRozeti = b.status === 'upgrading'
      ? `<span class="ob-rozet ob-rozet--uyari ob-rozet--kucuk">Düzey ${sayiEkle(b._pendingLevel ?? currentLevel + 1)} yükseltiliyor</span>`
      : '<span class="ob-rozet ob-rozet--iyi ob-rozet--kucuk">Etkin</span>';

    return `
      <article class="ob-kart bina-kart" data-building-id="${b.id}">
        <header class="ob-kimlik">
          <span class="ob-kimlik-ikon ob-kimlik-ikon--gorsel">${_binaGorseli(b.type, Math.min(b.level || 1, maxLvl), 56)}</span>
          <div class="ob-kimlik-govde">
            <div class="ob-kimlik-ad">
              <span class="building-name-text" data-building-id="${b.id}">${b.name || cat.name} <button type="button" class="btn-rename" data-building-id="${b.id}" title="Yeniden adlandır" aria-label="${b.name || cat.name}: yeniden adlandır">✏️</button></span>
            </div>
            <div class="ob-kimlik-alt">${_obPuan(currentLevel, maxLvl, { etiket: 'Düzey' })} Düzey ${currentLevel}/${maxLvl}</div>
          </div>
          ${durumRozeti}
        </header>
        <div class="bina-kart-meta">${sayi(b.area || 0)} m² · bakım ${formatMoney(b.maintenanceCost || 0)}/dönem</div>
        <div class="bina-kart-govde">${detailsHtml}</div>
        <div class="ob-dugmeler ob-dugmeler--alt">
          ${upgCost > 0 ? `
            <button type="button" class="btn btn-primary btn-sm btn-campus-upgrade" data-building-id="${b.id}"
                    ${budget < upgCost ? 'disabled title="Yetersiz bütçe"' : ''}>
              Düzey ${sayiEkle(nextLevel)} yükselt · ${formatMoney(upgCost)} · ${upgTurns} dönem
            </button>` : '<span class="ob-rozet ob-rozet--iyi ob-rozet--kucuk">En üst düzeyde</span>'}
          ${cat.assignable ? `
            <button type="button" class="btn btn-ghost btn-sm btn-campus-assign" data-building-id="${b.id}">
              ${b.type === 'lab' ? 'Bölüm bağla' : 'Bölüm ata'}
            </button>` : ''}
        </div>
      </article>`;
  };

  /** İnşaat seçeneği kartı: tıklanınca onay penceresi açılır (dinleyici .building-card.available üzerinde). */
  const secenekKarti = (b) => {
    const count         = existingTypeCounts[b.type] || 0;
    const inProgress    = buildings.some(bld => bld.type === b.type && !bld.isCompleted);
    const blockedSingle = !b.canHaveMultiple && count > 0;
    const canAfford     = budget >= b.cost;
    const effects       = _formatBuildingEffects({ ...b.qualityEffects, ...b.effects });
    const disabled      = blockedSingle || inProgress;
    const maintEst      = b.baseArea && b.maintenanceCostPerM2 ? formatMoney(b.baseArea * b.maintenanceCostPerM2) : null;
    const durum = blockedSingle
      ? '<span class="ob-rozet ob-rozet--iyi">Yapıldı</span>'
      : inProgress
        ? '<span class="ob-rozet ob-rozet--uyari">Yapım sürüyor</span>'
        : `<span class="ob-rozet ${canAfford ? 'ob-rozet--vurgu' : 'ob-rozet--kritik'}">${formatMoney(b.cost)}${canAfford ? '' : ' · yetersiz bütçe'}</span>`;
    return `
      <article class="ob-kart building-card available bina-secenek${disabled ? ' bina-secenek--pasif' : ''}"
               data-build-type="${b.type}"${disabled ? ' aria-disabled="true"' : ''}>
        <header class="ob-kimlik">
          <span class="ob-kimlik-ikon ob-kimlik-ikon--gorsel">${_binaGorseli(b.type, 1, 56)}</span>
          <div class="ob-kimlik-govde">
            <div class="ob-kimlik-ad">${b.name}</div>
            <div class="ob-kimlik-alt">${_veriMetni(b.desc)}</div>
          </div>
        </header>
        ${effects.length ? `<ul class="ob-madde ob-madde--iyi">${effects.map(e => `<li>${e}</li>`).join('')}</ul>` : ''}
        <div class="bina-secenek-alt">
          <span class="bina-secenek-meta">${b.constructionTime} dönem · ${sayi(b.baseArea || 0)} m²${maintEst ? ` · bakım ~${maintEst}/dönem` : ''}${b.canHaveMultiple ? ' · birden çok yapılabilir' : ''}</span>
          ${durum}
        </div>
      </article>`;
  };

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-title">Yerleşke</div>
        <div class="panel-subtitle">${completedBuildings.length} etkin bina · ${inProgressBuildings.length} yapım aşamasında</div>
      </div>
    </div>

    <div class="campus-layout">
      <div class="campus-main">

    <!-- Yerleşke haritası: sekmenin ana görünümü (v0.5.0) -->
    <div class="campus-hero">
      <canvas id="campus-canvas" width="1600" height="1000"></canvas>
      <div id="campus-tooltip" class="campus-tooltip" style="display:none;"></div>
      <button class="campus-hero-expand" id="campus-map-expand" type="button" title="Haritayı büyüt">⛶ Büyüt</button>
    </div>

        <div class="ob-yigin">
          <section class="ob-bolum">
            ${_obBaslik('yerleske', 'Yerleşke özeti')}
            ${ozetHtml}
          </section>

          ${buildings.length > 0 ? `
          <section class="ob-bolum">
            ${_obBaslik('yerleske', 'Binalar', buildings.length)}
            <div class="ob-kartlar bina-kartlar">
              ${buildings.map(binaKarti).join('')}
            </div>
          </section>` : ''}

          <section class="ob-bolum">
            ${_obBaslik('kasa', 'İnşaat seçenekleri')}
            <div class="ob-aciklama">Bir binayı seçince maliyeti, süresi ve kazandırdıkları gösterilir; inşaat onayladığınızda başlar.</div>
            <div class="ob-kartlar bina-kartlar">
              ${BUILDING_CATALOG.map(secenekKarti).join('')}
            </div>
          </section>
        </div>

      </div><!-- /campus-main -->
    </div><!-- /campus-layout -->

    <!-- Tam ekran harita katmanı (varsayılan: gizli) -->
    <div class="campus-map-fullscreen" id="campus-map-fullscreen" style="display:none;">
      <div class="campus-map-fullscreen-header">
        <span>Yerleşke Haritası</span>
        <button class="campus-map-close" id="campus-map-close">✕</button>
      </div>
      <div style="position:relative;width:90%;max-width:1200px;">
        <canvas id="campus-canvas-full" width="1600" height="1000"></canvas>
        <div id="campus-tooltip-full" class="campus-tooltip" style="display:none;"></div>
      </div>
    </div>
  `;

  // Yerleşke haritası canvas: innerHTML her yenilendiğinde yeniden bağlanmalı
  const campusCanvas = document.getElementById('campus-canvas');
  if (campusCanvas) {
    renderCampusMap(campusCanvas, state);

    campusCanvas.addEventListener('click', (e) => {
      const building = handleCampusClick(e, campusCanvas, state);
      renderCampusMap(campusCanvas, state);
      _binaIpucu(document.getElementById('campus-tooltip'), building, e);
    });

    campusCanvas.addEventListener('mousemove', (e) => {
      const building = handleCampusHover(e, campusCanvas, state);
      renderCampusMap(campusCanvas, state);
      _binaIpucu(document.getElementById('campus-tooltip'), building, e);
    });

    campusCanvas.addEventListener('mouseleave', () => {
      clearHover();
      renderCampusMap(campusCanvas, state);
      const tooltip = document.getElementById('campus-tooltip');
      if (tooltip) tooltip.style.display = 'none';
    });
  }

  // Tam ekran harita: önizlemeye tıklanınca aç
  const expandBtn   = document.getElementById('campus-map-expand');
  const fullscreen  = document.getElementById('campus-map-fullscreen');
  const closeBtn    = document.getElementById('campus-map-close');
  const fullCanvas  = document.getElementById('campus-canvas-full');

  function openFullscreen() {
    if (!fullscreen || !fullCanvas) return;
    fullscreen.style.display = 'flex';
    renderCampusMap(fullCanvas, state);

    // Tam ekran kanvasında da bilgi kutusu ve üstüne gelme
    fullCanvas.addEventListener('click', _fullCanvasClick);
    fullCanvas.addEventListener('mousemove', _fullCanvasMove);
    fullCanvas.addEventListener('mouseleave', _fullCanvasLeave);
  }

  function closeFullscreen() {
    if (!fullscreen) return;
    fullscreen.style.display = 'none';
    clearHover();
    fullCanvas.removeEventListener('click', _fullCanvasClick);
    fullCanvas.removeEventListener('mousemove', _fullCanvasMove);
    fullCanvas.removeEventListener('mouseleave', _fullCanvasLeave);
    const tt = document.getElementById('campus-tooltip-full');
    if (tt) tt.style.display = 'none';
  }

  function _fullCanvasClick(e) {
    const building = handleCampusClick(e, fullCanvas, state);
    renderCampusMap(fullCanvas, state);
    _binaIpucu(document.getElementById('campus-tooltip-full'), building, e);
  }

  function _fullCanvasMove(e) {
    const building = handleCampusHover(e, fullCanvas, state);
    renderCampusMap(fullCanvas, state);
    _binaIpucu(document.getElementById('campus-tooltip-full'), building, e);
  }

  function _fullCanvasLeave() {
    clearHover();
    renderCampusMap(fullCanvas, state);
    const tt = document.getElementById('campus-tooltip-full');
    if (tt) tt.style.display = 'none';
  }

  if (expandBtn) {
    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openFullscreen();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeFullscreen();
    });
  }

  if (fullscreen) {
    // Arka plana tıklayınca kapat (header veya canvas dışı)
    fullscreen.addEventListener('click', (e) => {
      if (e.target === fullscreen) closeFullscreen();
    });
  }

  // Escape tuşuyla kapat: her çizimde eski dinleyiciyi temizle
  if (panel._escListener) {
    document.removeEventListener('keydown', panel._escListener);
  }
  panel._escListener = (e) => {
    if (e.key === 'Escape' && fullscreen && fullscreen.style.display !== 'none') {
      closeFullscreen();
    }
  };
  document.addEventListener('keydown', panel._escListener);

  // Olay dinleyicilerini yalnızca bir kez bağla (her çizimde tekrar ekleme)
  if (!panel._campusListenersAttached) {
    panel._campusListenersAttached = true;

    // İnşaat başlat tıklama (yapılmış ya da yapımı süren tek binalık türler pasif)
    delegate(panel, '.building-card.available', 'click', (e, card) => {
      if (card.getAttribute('aria-disabled') === 'true') return;
      const btype = card.dataset.buildType;
      const catalog = BUILDING_CATALOG.find(c => c.type === btype);
      if (!catalog) return;

      const currentBudget = panel._currentBudget ?? 0;
      if (currentBudget < catalog.cost) {
        showNotification(`Yetersiz bütçe. Gerekli: ${formatMoney(catalog.cost)}`, 'danger');
        return;
      }

      // v0.5.2: tek tıkla para harcanmasın; önce maliyet, süre ve kazanç gösterilir
      showConfirmModal(`${catalog.name} İnşaatı`, _insaatOnayIcerigi(catalog, currentBudget), () => {
        if (panel._onBuildStart) panel._onBuildStart(btype, catalog);
      }, { onayMetni: `Onayla (${formatMoney(catalog.cost)})` });
    });

    // Düzey yükselt butonu tıklama
    delegate(panel, '.btn-campus-upgrade', 'click', (e, btn) => {
      e.stopPropagation();
      const buildingId = btn.dataset.buildingId;
      if (!buildingId) return;
      const building = (panel._currentState?.buildings || []).find(b => b.id === buildingId);
      const onay = building ? _yukseltmeOnayIcerigi(building, panel._currentBudget ?? 0) : null;
      if (!onay) {
        if (panel._onDecision) panel._onDecision({ type: 'upgrade_building', buildingId });
        return;
      }
      showConfirmModal(onay.baslik, onay.html, () => {
        if (panel._onDecision) panel._onDecision({ type: 'upgrade_building', buildingId });
      }, { onayMetni: `Onayla (${formatMoney(onay.maliyet)})` });
    });

    // Bölüm ata butonu tıklama
    delegate(panel, '.btn-campus-assign', 'click', (e, btn) => {
      e.stopPropagation();
      const buildingId = btn.dataset.buildingId;
      if (!buildingId) return;
      const building = (panel._currentState?.buildings || []).find(b => b.id === buildingId);
      if (!building) return;
      _showDepartmentAssignModal(panel._currentState, building, panel._onDecision);
    });

    // Bina yeniden adlandır
    delegate(panel, '.btn-rename', 'click', (e, btn) => {
      e.stopPropagation();
      const buildingId = btn.dataset.buildingId;
      if (!buildingId) return;
      const building = (panel._currentState?.buildings || []).find(b => b.id === buildingId);
      if (!building) return;

      const nameSpan = panel.querySelector(`.building-name-text[data-building-id="${buildingId}"]`);
      if (!nameSpan) return;
      if (nameSpan.querySelector('input')) return; // zaten düzenleme modunda

      const currentName = building.name || building.type;
      const input = document.createElement('input');
      input.type = 'text';
      input.value = currentName;
      input.className = 'ob-arama bina-ad-girdi';
      input.setAttribute('aria-label', 'Binanın yeni adı');

      const originalContent = nameSpan.innerHTML;
      nameSpan.innerHTML = '';
      nameSpan.appendChild(input);
      input.focus();
      input.select();

      let _savedOnce = false;
      function saveName() {
        if (_savedOnce) return;
        _savedOnce = true;
        const newName = input.value.trim();
        if (newName && newName !== currentName) {
          building.name = newName;
          if (panel._onDecision) {
            panel._onDecision({ type: 'rename_building', buildingId, newName });
          }
        }
        nameSpan.innerHTML = originalContent.replace(
          /^[^<]*/,
          (building.name || currentName) + ' '
        );
      }

      input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') { saveName(); }
        if (ke.key === 'Escape') { _savedOnce = true; nameSpan.innerHTML = originalContent; }
      });
      input.addEventListener('blur', saveName);
    });
  }

  // Her çizimde güncel geri çağrı, durum ve kasa referanslarını sakla
  panel._currentState  = state;
  panel._currentBudget = budget;
  panel._onBuildStart  = onBuildStart;
  panel._onDecision    = onDecision;
}

/**
 * Bölüm atama penceresi (prompt() yerine tam arayüz). Satırlar (.dept-assign-row, data-action,
 * data-dept-id, data-from-building-id) pencere gövdesindeki dinleyiciye bağlı.
 * @param {object}   state      — Oyun durumu
 * @param {object}   building   — Hedef bina nesnesi
 * @param {Function} onDecision — Karar callback
 */
function _showDepartmentAssignModal(state, building, onDecision) {
  const allDepts     = state.departments || [];
  const allBuildings = state.buildings || [];
  const isLab        = building.type === 'lab';

  /** Pencere içeriğini üretir */
  function _buildModalBody() {
    if (allDepts.length === 0) {
      return '<div class="ob-bos ob-bos--kucuk">Henüz hiç bölüm kurulmamış.</div>';
    }

    const rows = allDepts.map(dept => {
      let statusBadge = '';
      let actionHint  = '';
      let dataAttr    = '';

      if (isLab) {
        // Laboratuvar binası: linkedDepartments üzerinden denetim
        const linkedHere = (building.linkedDepartments || []).includes(dept.id);

        if (linkedHere) {
          statusBadge = '<span class="ob-rozet ob-rozet--iyi ob-rozet--kucuk">Bağlı</span>';
          actionHint  = '<span class="atama-eylem ob-kritik">Kaldır</span>';
          dataAttr    = `data-action="unassign" data-dept-id="${dept.id}"`;
        } else {
          // Hangi fakülte binasında olduğunu göster (bilgi amaçlı)
          const facultyBuilding = allBuildings.find(b => b.type !== 'lab' && (b.assignedDepartments || []).includes(dept.id));
          if (facultyBuilding) {
            statusBadge = `<span class="ob-rozet ob-rozet--bilgi ob-rozet--kucuk" title="Bölümün bulunduğu bina">${facultyBuilding.name || facultyBuilding.id}</span>`;
          }
          actionHint  = '<span class="atama-eylem ob-iyi">Bağla</span>';
          dataAttr    = `data-action="assign" data-dept-id="${dept.id}"`;
        }
      } else {
        // Normal bina: assignedDepartments üzerinden denetim
        const assignedHere  = (building.assignedDepartments || []).includes(dept.id);
        const otherBuilding = assignedHere ? null :
          allBuildings.find(b => b.id !== building.id && b.type !== 'lab' && (b.assignedDepartments || []).includes(dept.id));

        if (assignedHere) {
          statusBadge = '<span class="ob-rozet ob-rozet--iyi ob-rozet--kucuk">Bu binada</span>';
          actionHint  = '<span class="atama-eylem ob-kritik">Kaldır</span>';
          dataAttr    = `data-action="unassign" data-dept-id="${dept.id}"`;
        } else if (otherBuilding) {
          statusBadge = `<span class="ob-rozet ob-rozet--uyari ob-rozet--kucuk" title="Bölümün şu an bulunduğu bina">${otherBuilding.name || otherBuilding.id}</span>`;
          actionHint  = '<span class="atama-eylem ob-uyari">Taşı</span>';
          dataAttr    = `data-action="move" data-dept-id="${dept.id}" data-from-building-id="${otherBuilding.id}"`;
        } else {
          actionHint  = '<span class="atama-eylem ob-soluk">Ata</span>';
          dataAttr    = `data-action="assign" data-dept-id="${dept.id}"`;
        }
      }

      return `
        <div class="dept-assign-row atama-satir" ${dataAttr}>
          <span class="atama-ikon">${bolumIkonu(dept.id, 28, dept.icon || '🏫')}</span>
          <div class="atama-bilgi">
            <div class="atama-ad">${dept.name}</div>
            ${dept.shortName ? `<div class="atama-alt">${dept.shortName}</div>` : ''}
          </div>
          ${statusBadge}
          ${actionHint}
        </div>`;
    }).join('');

    const hint = isLab
      ? 'Bir bölüme tıklayarak bu laboratuvar binasına bağlayabilirsiniz. Bölüm, fakülte binasında kalmaya devam eder.'
      : 'Bir bölüme tıklayarak atama yapabilir, kaldırabilir ya da başka binadan taşıyabilirsiniz.';

    return `
      <p class="pencere-metin">${hint}</p>
      <div id="dept-assign-list" class="atama-liste">
        ${rows}
      </div>`;
  }

  // İlk açılış
  const modalTitle = isLab ? `${building.name}: Bölüm Bağla` : `${building.name}: Bölüm Ata`;
  showModal(modalTitle, _buildModalBody());

  // Olay dinleyicisi: pencere gövdesi üzerinde delegasyon.
  // Her açılışta yeni dinleyici birikmesin diye önce eskisi kaldırılır.
  const modalBody = el('general-modal-body');
  if (!modalBody) return;

  if (modalBody._deptAssignHandler) {
    modalBody.removeEventListener('click', modalBody._deptAssignHandler);
  }

  modalBody._deptAssignHandler = function _modalClickHandler(ev) {
    const row = ev.target.closest('.dept-assign-row');
    if (!row) return;

    const action      = row.dataset.action;
    const deptId      = row.dataset.deptId;
    const fromBuildId = row.dataset.fromBuildingId;

    if (!action || !deptId) return;

    if (action === 'assign') {
      onDecision && onDecision({ type: 'assign_department_to_building', buildingId: building.id, departmentId: deptId });
      if (isLab) {
        // Yerel durumu anında güncelle: linkedDepartments
        if (!building.linkedDepartments) building.linkedDepartments = [];
        if (!building.linkedDepartments.includes(deptId)) building.linkedDepartments.push(deptId);
      } else {
        // Yerel durumu anında güncelle: assignedDepartments
        if (!building.assignedDepartments) building.assignedDepartments = [];
        if (!building.assignedDepartments.includes(deptId)) building.assignedDepartments.push(deptId);
      }
      // Pencereyi yenile
      modalBody.innerHTML = _buildModalBody();

    } else if (action === 'unassign') {
      onDecision && onDecision({ type: 'unassign_department_from_building', buildingId: building.id, departmentId: deptId });
      // Yerel durumu anında güncelle
      if (isLab) {
        building.linkedDepartments = (building.linkedDepartments || []).filter(id => id !== deptId);
      } else {
        building.assignedDepartments = (building.assignedDepartments || []).filter(id => id !== deptId);
      }
      modalBody.innerHTML = _buildModalBody();

    } else if (action === 'move') {
      // Taşıma (yalnız normal binalar): önce satır içi onay
      const dept = (state.departments || []).find(d => d.id === deptId);
      const srcBuilding = (state.buildings || []).find(b => b.id === fromBuildId);
      const deptName = dept ? dept.name : deptId;
      const srcName  = srcBuilding ? (srcBuilding.name || srcBuilding.id) : fromBuildId;

      // Açık bir onay kutusu varsa kaldır
      const existingConfirm = modalBody.querySelector('.move-confirm-panel');
      if (existingConfirm) existingConfirm.remove();

      const confirmPanel = document.createElement('div');
      confirmPanel.className = 'move-confirm-panel ob-not ob-not--uyari';
      confirmPanel.innerHTML = `
        <div class="ob-not-baslik">Bölümü taşı</div>
        <p><strong>${deptName}</strong> şu an <strong>${srcName}</strong> içinde. Bu binaya taşımak istiyor musunuz?</p>
        <div class="ob-dugmeler">
          <button type="button" class="btn btn-warning btn-sm btn-move-confirm" data-dept-id="${deptId}" data-from-building-id="${fromBuildId}">Evet, taşı</button>
          <button type="button" class="btn btn-secondary btn-sm btn-move-cancel">Vazgeç</button>
        </div>`;

      // Listenin üstüne ekle
      const list = modalBody.querySelector('#dept-assign-list');
      if (list) {
        list.insertAdjacentElement('beforebegin', confirmPanel);
      } else {
        modalBody.insertAdjacentElement('afterbegin', confirmPanel);
      }

      confirmPanel.querySelector('.btn-move-cancel').addEventListener('click', () => {
        confirmPanel.remove();
      });

      confirmPanel.querySelector('.btn-move-confirm').addEventListener('click', () => {
        confirmPanel.remove();
        if (fromBuildId) {
          onDecision && onDecision({ type: 'unassign_department_from_building', buildingId: fromBuildId, departmentId: deptId });
          if (srcBuilding) {
            srcBuilding.assignedDepartments = (srcBuilding.assignedDepartments || []).filter(id => id !== deptId);
          }
        }
        onDecision && onDecision({ type: 'assign_department_to_building', buildingId: building.id, departmentId: deptId });
        if (!building.assignedDepartments) building.assignedDepartments = [];
        if (!building.assignedDepartments.includes(deptId)) building.assignedDepartments.push(deptId);
        modalBody.innerHTML = _buildModalBody();
      });
    }

    // Delegasyon zaten pencere gövdesinde; innerHTML sonrası kendiliğinden çalışır
  };

  modalBody.addEventListener('click', modalBody._deptAssignHandler);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. BÜTÇE PANELİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bütçe sekmesi: özet göstergeler, gelir/gider tablosu, harcama kararları (v0.7: eski bütçe
 * dağılımı yerine), harç ayarı, devlet kısıtları (v0.7), banka kredileri ve yeni kredi formu.
 * @param {object}   state           — Oyun durumu
 * @param {Function} onAllocChange   — Bütçe kararı işleyicisi (v0.7: karar nesnesi alır, sonucu döner:
 *                                     'research_budget', 'set_harcama', 'kadro_talebi')
 * @param {Function} onLoanAction    — Kredi kararı ({ type: 'take_loan' | 'repay_loan_early', ... })
 * @param {Function} onTuitionChange — Harç değişimi
 * @param {Function} onAidChange     — Burs indirimi oranı değişimi (ABD özel üniversitesi)
 */
export function renderBudgetPanel(state, onAllocChange, onLoanAction, onTuitionChange, onAidChange) {
  const panel = el('tab-budget');
  if (!panel) return;

  const uni    = state.university || {};
  const budget = uni.budget ?? 0;

  // Bütçe sayfası, dönem özetindeki gerçek ekonomi hesabıyla aynı kaynağı kullanır
  // (v0.7: zorluk çarpanları da uygulanır; dönem sonunda kasaya yazılan tutarlar)
  const { incomeDetail, expenseDetail } = _zorlukluGelirGider(state);
  const revenue = incomeDetail.total || 0;
  const costs   = expenseDetail.total || 0;
  const net     = revenue - costs;
  const tipDevlet = (state.meta?.universityType || uni.type) === 'devlet';

  // Kredi borcu: aşağıdaki kredi tablosuyla aynı kaynak (kalan anaparaların toplamı).
  // uni.debt yalnız kasa eksiye düştüğünde dolar; o ayrıca "kasa açığı" olarak yazılır.
  const krediler    = Array.isArray(uni.loans) ? uni.loans : [];
  const krediBorcu  = krediler.length > 0
    ? krediler.reduce((s, l) => s + (Number(l.remainingAmount) || 0), 0)
    : (uni.totalDebt || 0);
  const kasaAcigi   = budget < 0 ? -budget : 0;
  const borcAltYazi = kasaAcigi > 0
    ? `ayrıca kasa açığı ${formatMoney(kasaAcigi)}`
    : krediler.length > 0 ? `${krediler.length} etkin kredi` : 'etkin kredi yok';

  const giderSatiri = (ad, tutar, id = '') =>
    `<tr><td>${ad}</td><td class="n ob-kritik ob-tek"${id ? ` id="${id}"` : ''}>${_eksiPara(tutar)}</td></tr>`;

  const gelirGider = `
    <div class="ob-tablo-kap">
      <table class="ob-tablo ob-tablo--dar">
        <thead>
          <tr><th>Kalem</th><th class="n">Dönemlik tutar</th></tr>
        </thead>
        <tbody>
          <tr class="ob-grup"><td colspan="2">Gelirler</td></tr>
          ${_revenueLineItems(state, revenue, incomeDetail)}
          <tr class="ob-toplam"><td>Toplam gelir</td><td class="n ob-iyi ob-tek">${formatMoney(revenue)}</td></tr>
          <tr class="ob-grup"><td colspan="2">Giderler</td></tr>
          ${giderSatiri('Hoca maaşları', expenseDetail.salariesAcademic)}
          ${giderSatiri('Yerleşke bakımı', expenseDetail.maintenance)}
          ${giderSatiri('İdari harcamalar', (expenseDetail.salariesAdmin || 0) + (expenseDetail.adminOperating || 0) + (expenseDetail.partTime || 0))}
          ${giderSatiri('Araştırma fonu', expenseDetail.researchInvestment, 'budget-research-cost')}
          ${giderSatiri('Öğrenci hizmetleri', expenseDetail.studentServices || 0, 'budget-services-cost')}
          ${giderSatiri('Tanıtım ve uluslararası ilişkiler', expenseDetail.promotion || 0, 'budget-promotion-cost')}
          ${tipDevlet ? '' : giderSatiri('Burs ödemeleri', expenseDetail.scholarships, 'budget-scholarship-cost')}
          ${giderSatiri('Genel giderler', (expenseDetail.overhead || 0) + (expenseDetail.construction || 0))}
          <tr class="ob-toplam"><td>Toplam gider</td><td class="n ob-kritik ob-tek">${_eksiPara(costs)}</td></tr>
        </tbody>
      </table>
    </div>
    ${tipDevlet ? '<div class="ob-tablo-dip">Devlette öğrenciler harçsız okur; üniversite burs ödemez.</div>' : ''}`;

  // v0.7: Harcama kararları. Eski "bütçe dağılımı" yüzdeleri hiçbir hesaba girmiyordu;
  // yerine gidere yazılan ve etkisi burada yazan üç karar geldi.
  const hk      = harcamaKararlari(state);
  const HKS     = HARCAMA_KARARLARI;
  const hocaSay = (state.faculty || []).length;
  const ogrSay  = state.students?.totalEnrolled || 0;
  const tipVakif = (state.meta?.universityType || uni.type) === 'vakif';
  const harcamaAyari = (anahtar, etiket, deger, s) => `
    <div class="ob-ayar">
      <label class="ob-ayar-e" for="harcama-${anahtar}">${etiket}</label>
      <input type="range" class="ob-kaydirici harcama-kaydirici" id="harcama-${anahtar}" data-harcama="${anahtar}"
             min="${s.enAz}" max="${s.enCok}" step="${s.adim}" value="${deger}">
      <div class="ob-ayar-d" id="harcama-${anahtar}-deger">${formatMoney(deger)}</div>
      <div class="ob-aciklama harcama-etki" id="harcama-${anahtar}-etki"></div>
    </div>`;
  const harcamalar = `
    <div class="ob-kart harcama-kart">
      ${harcamaAyari('arastirmaFonu', 'Araştırma fonu (hoca başına, dönemlik)', hk.arastirmaFonu, HKS.arastirmaFonu)}
      ${harcamaAyari('ogrenciHizmetleri', 'Öğrenci hizmetleri (öğrenci başına, dönemlik)', hk.ogrenciHizmetleri, HKS.ogrenciHizmetleri)}
      ${harcamaAyari('tanitim', 'Tanıtım ve uluslararası ilişkiler (dönemlik)', hk.tanitim, HKS.tanitim)}
      <div class="ob-satir harcama-toplam"><span>Bu kararların dönemlik gideri</span><b class="ob-kritik" id="harcama-toplam">${_eksiPara((expenseDetail.researchFund || 0) + (expenseDetail.studentServices || 0) + (expenseDetail.promotion || 0))}</b></div>
      <button class="btn btn-success" id="btn-apply-harcama">Harcamaları uygula</button>
      <div class="ob-aciklama">Tutarlar dönem sonunda gidere yazılır. Eski bütçe dağılımı yüzdeleri hiçbir hesaba girmediği için kaldırıldı: maaşlar kişi başına belirlenir, BT hizmetini İdari Birimler'deki Bilgi Teknolojileri birimi görür, acil durum payı kasanın kendisidir.</div>
    </div>`;

  const harcAyari = (uni.type === 'vakif' || uni.type === 'us_private') ? `
    <section class="ob-bolum">
      <div class="section-title"><i class="ikon ikon--ogrenci" aria-hidden="true"></i>${uni.type === 'us_private' ? 'Harç ve burs indirimi' : 'Harç ayarı'}</div>
      <div class="ob-kart">
        <div class="ob-ayar">
          <label class="ob-ayar-e" for="tuition-slider">Dönemlik harç</label>
          <input type="range" class="ob-kaydirici" id="tuition-slider"
                 min="${uni.type === 'us_private' ? 500000 : 10000}"
                 max="${uni.type === 'us_private' ? 2000000 : 150000}"
                 step="${uni.type === 'us_private' ? 50000 : 5000}"
                 value="${uni.tuitionPerSemester ?? (uni.type === 'us_private' ? 935000 : 40000)}">
          <div class="ob-ayar-d" id="tuition-value">${formatMoney(uni.tuitionPerSemester ?? (uni.type === 'us_private' ? 935000 : 40000))}</div>
        </div>
        ${uni.type === 'us_private' ? `
        <div class="ob-ayar">
          <label class="ob-ayar-e" for="aid-slider">Burs indirimi oranı (ortalama)</label>
          <input type="range" class="ob-kaydirici" id="aid-slider"
                 min="0" max="80" step="5"
                 value="${Math.round((uni.financialAidRate ?? 0.45) * 100)}">
          <div class="ob-ayar-d" id="aid-value">%${Math.round((uni.financialAidRate ?? 0.45) * 100)}</div>
        </div>
        <div class="ob-aciklama">Yüksek indirim daha geniş öğrenci havuzu, daha düşük net harç geliri demektir.</div>
        ` : ''}
      </div>
    </section>` : '';

  // v0.7: devlet kısıtları uygulanıyor; önceden ve açıkça burada gösterilir
  // (eskiden bu notta yazılıydı ama hiçbir hesap okumuyordu)
  const kd = tipDevlet ? kadroDurumu(state) : null;
  const mg = tipDevlet ? maasGelirDurumu(state) : null;
  const hz = tipDevlet ? hazineIadesiTahmini(state) : null;
  let devletBilgisi = '';
  if (kd && mg && hz) {
    const bekleyen   = kd.bekleyen[0];
    const turSimdi   = state.meta?.turn ?? 1;
    const kalanDonem = bekleyen ? Math.max(1, (bekleyen.onayDonemi ?? turSimdi) - turSimdi + 1) : 0;
    const oranYuzde  = Math.round(mg.oran * 100);
    const sinirYuzde = Math.round(mg.sinir * 100);
    const oranKademe = mg.oran > mg.sinir ? 'kritik' : mg.oran > mg.sinir * 0.9 ? 'uyari' : 'iyi';
    const devreden   = Math.max(0, Number(uni.devredenBirikim) || 0);
    devletBilgisi = `
      <section class="ob-bolum">
        <div class="section-title"><i class="ikon ikon--kadro" aria-hidden="true"></i>Devlet kısıtları</div>
        <div class="ob-kart devlet-kisit">
          <div class="ob-kart-baslik"><span>Norm kadro</span></div>
          <div class="ob-satir"><span>Dolu / norm kadro</span><b>${formatNumber(kd.dolu)} / ${formatNumber(kd.norm)}</b></div>
          <div class="ob-satir"><span>Boş kadro</span><b class="${kd.bos > 0 ? 'ob-iyi' : 'ob-kritik'}" id="kadro-bos">${formatNumber(kd.bos)}</b></div>
          ${bekleyen ? `<div class="ob-satir"><span>Onay bekleyen talep</span><b>${bekleyen.adet} kadro, ${kalanDonem} dönem sonra</b></div>` : ''}
          <div class="ob-ayar ob-ayar--satir kadro-talep">
            <label class="ob-ayar-e" for="kadro-talep-adet">Yeni kadro talebi</label>
            <input type="number" class="ob-arama kadro-talep-adet" id="kadro-talep-adet" min="1" max="${kd.talepEnCok}"
                   value="${kd.talepEnCok}"${bekleyen ? ' disabled' : ''}>
            <button class="btn btn-primary btn-sm" id="btn-kadro-talep"${bekleyen ? ' disabled title="Onay bekleyen talep var"' : ''}>Talep et</button>
          </div>
          <div class="ob-aciklama">Öğretim elemanı yalnız boş kadroya alınır (ilan, transfer ve ilan dışı başvuru). Bir talepte en çok ${kd.talepEnCok} kadro istenir, onay ${kd.bekleme} dönem sürer; yeni bölüm açılınca kurucu kadro ayrıca verilir.</div>

          <div class="ob-kart-baslik"><span>Maaş sınırı</span></div>
          <div class="ob-satir"><span>Hoca maaşları / dönem geliri</span><b class="ob-${oranKademe}" id="maas-gelir-orani">%${oranYuzde} (sınır %${sinirYuzde})</b></div>
          <div class="ob-cubuk ob-cubuk--${oranKademe}"><span style="width:${Math.max(0, Math.min(100, oranYuzde / Math.max(1, sinirYuzde) * 100))}%"></span></div>
          <div class="ob-aciklama">Maaşların dönem gelirinin %${sinirYuzde}'ını aşmasına yol açacak işe alım, zam ve kadro talebi yapılamaz.</div>

          <div class="ob-kart-baslik"><span>Yıl sonu Hazine iadesi</span></div>
          <div class="ob-satir"><span>Bahar sonunda Hazine'ye dönecek (tahmini)</span><b class="${hz.iade > 0 ? 'ob-kritik' : 'ob-iyi'}" id="hazine-iadesi">${hz.iade > 0 ? _eksiPara(hz.iade) : 'yok'}</b></div>
          <div class="ob-aciklama">Bahar dönemi kapanırken kasada bir dönemlik gideri (${formatMoney(hz.gider)}) ve kredi borcunu aşan para Hazine'ye döner. Tahmin, yılın kalan ${hz.kalanDonem === 1 ? 'dönemi' : 'iki dönemi'} bugünkü gelir ve giderle geçerse kasanın ${formatMoney(hz.yilSonuKasa)} olacağını varsayar.${devreden > 0 ? ` Önceki sürümden devreden ${formatMoney(devreden)} iadeden muaftır; harcadıkça azalır.` : ''}</div>
          <div class="ob-aciklama">Harç yok; sembolik katkı payını YÖK belirler. YÖK tahsisi taban ödenek, öğrenci, kadro ve açık bölüm sayısından oluşur.</div>
        </div>
      </section>`;
  }

  const krediTablosu = krediler.length === 0
    ? '<div class="ob-bos ob-bos--kucuk">Etkin kredi yok.</div>'
    : `
      <div class="ob-tablo-kap">
        <table class="ob-tablo">
          <thead>
            <tr>
              <th>Banka</th>
              <th class="n">Kalan borç</th>
              <th class="n">Dönem taksiti</th>
              <th class="n">Kalan dönem</th>
              <th>Durum</th>
              <th><span class="ob-gizli">İşlem</span></th>
            </tr>
          </thead>
          <tbody>
            ${krediler.map((loan, idx) => {
              const durum = loan.overdue
                ? `<span class="ob-rozet ob-rozet--kritik ob-rozet--kucuk">Gecikti (${loan.overdueCount}/3)</span>`
                : '<span class="ob-rozet ob-rozet--iyi ob-rozet--kucuk">Ödeniyor</span>';
              const canRepay = budget >= loan.remainingAmount;
              return `<tr>
                <td class="ob-ad ob-tek">${loan.bankIcon || '🏦'} ${loan.bankName}</td>
                <td class="n ob-tek">${formatMoneyFull(loan.remainingAmount)}</td>
                <td class="n ob-kritik ob-tek">-${formatMoneyFull(loan.semesterPayment)}</td>
                <td class="n">${loan.remainingTerms} dönem</td>
                <td>${durum}</td>
                <td class="n">
                  <button class="btn btn-sm ${canRepay ? 'btn-warning' : 'btn-secondary'}"
                          data-loan-idx="${idx}"
                          id="btn-repay-loan-${idx}"
                          ${canRepay ? '' : 'disabled title="Yeterli bütçe yok"'}>
                    Erken öde
                  </button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div class="ob-tablo-dip">Toplam borç <b class="ob-kritik">${formatMoneyFull(krediBorcu)}</b>. Erken ödemede kalan borcun %5'i erken kapatma cezası olarak eklenir.</div>`;

  const krediFormu = `
    <div class="kredi-form">
      <button class="btn btn-primary" id="btn-show-loan-form">+ Yeni kredi çek</button>
      <div id="loan-form-section" style="display:none;">
        <div class="bank-kartlar">
          ${BANKS.map(bank => `
            <div class="ob-kart ob-kart--tiklanir bank-card" data-bank-id="${bank.id}">
              <div class="bank-ust"><span class="bank-ikon">${bank.icon}</span><span class="bank-ad">${bank.name}</span></div>
              <div class="ob-aciklama">${bank.description}</div>
              <div class="ob-satir"><span>Faiz</span><b>%${(bank.interestRate * 100).toFixed(0)} / yıl</b></div>
              <div class="ob-satir"><span>Üst sınır</span><b>${formatMoney(bank.maxLoan)}</b></div>
              <div class="ob-satir"><span>Vade</span><b>${bank.terms.join(', ')} dönem</b></div>
              ${bank.minResearchScore ? `<div class="ob-aciklama ob-aciklama--kritik">Araştırma puanı en az ${bank.minResearchScore} olmalı.</div>` : ''}
            </div>`).join('')}
        </div>

        <div id="loan-config-section" class="ob-kart" style="display:none;">
          <div class="ob-kart-baslik"><span id="loan-selected-bank-name">Seçilen banka</span></div>
          <div class="ob-ayar">
            <label class="ob-ayar-e" for="loan-amount-slider">Kredi miktarı</label>
            <input type="range" class="ob-kaydirici" id="loan-amount-slider" min="1000000" max="60000000" step="1000000" value="5000000">
            <div class="ob-ayar-d" id="loan-amount-display">${formatMoneyFull(5000000)}</div>
          </div>
          <div class="kredi-ayar">
            <label for="loan-term-select">Vade (dönem)</label>
            <select id="loan-term-select" class="ob-secim">
              <option value="">Seçin…</option>
            </select>
          </div>
          <div class="ob-aciklama" id="loan-payment-preview">Vade seçin…</div>
          <div class="kredi-ayar"><button class="btn btn-success" id="btn-confirm-loan">Krediyi onayla</button></div>
        </div>
      </div>
    </div>`;

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-title">Bütçe Yönetimi</div>
        <div class="panel-subtitle">
          Kasa: <strong class="${budget >= 0 ? 'ob-iyi' : 'ob-kritik'}">${formatMoneyFull(budget)}</strong>
        </div>
      </div>
    </div>

    <div class="ob-yigin">
      <div class="ob-kutular">
        ${_obKutu('Dönem geliri', formatMoney(revenue), 'bu dönem, tahmin', 'ob-iyi')}
        ${_obKutu('Dönem gideri', formatMoney(costs), 'bu dönem, tahmin', 'ob-kritik')}
        ${_obKutu('Net', `${net >= 0 ? '+' : ''}${formatMoney(net)}`, net >= 0 ? 'artı bakiye' : 'açık', net >= 0 ? 'ob-iyi' : 'ob-kritik')}
        ${_obKutu('Kredi borcu', formatMoney(krediBorcu), borcAltYazi, krediBorcu > 0 ? 'ob-kritik' : '')}
      </div>
      ${budget < -30_000_000 ? `
      <div class="ob-not ob-not--kritik">
        <div class="ob-not-baslik">Derin kasa açığı</div>
        <p>${tipDevlet
          ? 'Kasa açığı 30 M ₺ sınırını aştı: YÖK denetimi sürüyor, yeni işe alım ve inşaat donduruldu.'
          : `Kasa açığı 30 M ₺ sınırını aştı (${(state._internal?.consecutiveDeficitTurns || 0)}. dönem). Açık 3 dönem üst üste sürerse vakıf üniversitesi kapanır; yeni işe alım ve inşaat donduruldu.`}
          Kredi çekmek ya da harcama kararlarını azaltmak açığı kapatır.</p>
      </div>` : ''}

      <div class="ob-iki">
        <section class="ob-bolum">
          <div class="section-title"><i class="ikon ikon--butce" aria-hidden="true"></i>Gelir ve gider ayrıntısı</div>
          ${gelirGider}
        </section>

        <div class="ob-yigin">
          <section class="ob-bolum">
            <div class="section-title"><i class="ikon ikon--kasa" aria-hidden="true"></i>Harcama kararları</div>
            ${harcamalar}
          </section>
          ${harcAyari}
          ${devletBilgisi}
        </div>
      </div>

      <section class="ob-bolum">
        <div class="section-title"><i class="ikon ikon--kasa" aria-hidden="true"></i>Banka kredileri${krediler.length ? ` <span class="ob-sayi">${krediler.length}</span>` : ''}</div>
        <div class="ob-yigin ob-yigin--sik">
          ${krediTablosu}
          ${krediFormu}
        </div>
      </section>
    </div>
  `;

  // v0.7: Harcama kararları. Kaydırıcı her oynadığında tutar, gider ve etki yazılır;
  // "Harcamaları uygula" kararları oyun motoruna gönderir (onAllocChange: karar işleyicisi).
  const ir = Number(uni.internationalRatio) || 0.02;
  const yuzdeYaz = (x) => `%${ondalikYaz(Math.round(x * 1000) / 10, 1)}`;
  const harcamaEtkisi = (anahtar, v) => {
    if (anahtar === 'arastirmaFonu') {
      const c  = arastirmaFonuCarpani(v);
      const c0 = arastirmaFonuCarpani(HKS.arastirmaFonu.varsayilan);
      const mutluluk = Math.abs(c - c0) < 0.01 ? 'hoca mutluluğuna etkisi yok'
        : c > c0 ? 'hoca mutluluğu her dönem artar' : 'hoca mutluluğu her dönem düşer';
      return {
        gider: v * hocaSay,
        metin: `${formatNumber(hocaSay)} hoca × ${formatMoney(v)} = ${formatMoney(v * hocaSay)}/dönem. Yayın ve dış proje başvurusu ×${ondalikYaz(Math.round(c * 100) / 100, 2)}; ${mutluluk}.`,
      };
    }
    if (anahtar === 'ogrenciHizmetleri') {
      return {
        gider: v * ogrSay,
        metin: `${formatNumber(ogrSay)} öğrenci × ${formatMoney(v)} = ${formatMoney(v * ogrSay)}/dönem. Öğrenci memnuniyetine +${ondalikYaz(Math.round(ogrenciHizmetiEtkisi(v) * 10) / 10, 1)} puan.`,
      };
    }
    const t = tanitimEtkisi(v);
    return {
      gider: v,
      metin: `Yabancı öğrenci oranı hedefine +${yuzdeYaz(t.yabanci).slice(1)} puan (oran şu an ${yuzdeYaz(ir)}; Uluslararası Ofis birimi en çok 2 puan ekler); aday öğrencilerin YKS sırası iyileşir.${tipVakif ? ` Başvurular +%${Math.round(t.talep * 100)}.` : ''}`,
    };
  };
  const harcamaYenile = () => {
    let toplam = 0;
    qsa('.harcama-kaydirici').forEach(sl => {
      const v = parseInt(sl.value) || 0;
      const e = harcamaEtkisi(sl.dataset.harcama, v);
      toplam += e.gider;
      const d = el(`harcama-${sl.dataset.harcama}-deger`);
      if (d) d.textContent = formatMoney(v);
      const m = el(`harcama-${sl.dataset.harcama}-etki`);
      if (m) m.textContent = e.metin;
    });
    const t = el('harcama-toplam');
    if (t) t.textContent = _eksiPara(toplam);
  };
  qsa('.harcama-kaydirici').forEach(sl => on(sl, 'input', harcamaYenile));
  harcamaYenile();

  on(el('btn-apply-harcama'), 'click', () => {
    const deger = (a) => parseInt(el(`harcama-${a}`)?.value) || 0;
    if (!onAllocChange) return;
    const r1 = onAllocChange({ type: 'research_budget', amount: deger('arastirmaFonu') }, { sessiz: true });
    const r2 = onAllocChange({ type: 'set_harcama', ogrenciHizmetleri: deger('ogrenciHizmetleri'), tanitim: deger('tanitim') });
    const hata = [r1, r2].find(r => r && r.success === false);
    showNotification(hata ? (hata.message || 'Harcama kararları uygulanamadı.') : 'Harcama kararları güncellendi; dönem sonunda gidere yazılır.', hata ? 'warning' : 'success');
  });

  // v0.7: kadro talebi (devlet)
  on(el('btn-kadro-talep'), 'click', () => {
    const adet = parseInt(el('kadro-talep-adet')?.value) || 0;
    if (!onAllocChange) return;
    const r = onAllocChange({ type: 'kadro_talebi', adet });
    showNotification(r?.message || 'Kadro talebi gönderilemedi.', r?.success ? 'success' : 'warning');
  });

  // Harç slider
  const tuitionSlider = el('tuition-slider');
  const tuitionVal    = el('tuition-value');
  if (tuitionSlider && tuitionVal) {
    // 'input' her hareketinde sadece görüntüyü güncelle
    on(tuitionSlider, 'input', () => {
      tuitionVal.textContent = formatMoney(parseInt(tuitionSlider.value));
    });
    // 'change' kullanıcı slider'ı bıraktığında tetiklenir → state'e yaz
    // (Önceden hiç save yoktu, sadece görüntü güncelleniyordu — Burak Gökalp raporu)
    on(tuitionSlider, 'change', () => {
      const amount = parseInt(tuitionSlider.value);
      if (onTuitionChange) {
        const result = onTuitionChange(amount);
        if (result && result.success === false) {
          showNotification(result.message || 'Harç ayarlanamadı.', 'warning');
        } else {
          showNotification(`Dönemlik harç ${formatMoney(amount)} olarak ayarlandı.`, 'success');
        }
      }
    });
  }

  // Burs indirimi slider (us_private)
  const aidSlider = el('aid-slider');
  const aidVal    = el('aid-value');
  if (aidSlider && aidVal) {
    on(aidSlider, 'input', () => {
      aidVal.textContent = `%${aidSlider.value}`;
    });
    on(aidSlider, 'change', () => {
      const rate = parseInt(aidSlider.value) / 100;
      if (onAidChange) {
        const result = onAidChange(rate);
        if (result && result.success === false) {
          showNotification(result.message || 'Burs oranı ayarlanamadı.', 'warning');
        }
      }
    });
  }

  // ── Erken Ödeme butonları ─────────────────────────────────────────────────
  const loans = (state.university || {}).loans || [];
  loans.forEach((loan, idx) => {
    const btn = el(`btn-repay-loan-${idx}`);
    on(btn, 'click', () => {
      if (!onLoanAction) return;
      const result = onLoanAction({ type: 'repay_loan_early', loanIndex: idx });
      if (result && result.success) {
        showNotification(result.message, 'success');
        // Paneli yenile (main.js'teki renderBudget çağrısı aracılığıyla)
        if (window._onBudgetTabRefresh) window._onBudgetTabRefresh();
      } else {
        showNotification(result ? result.message : 'İşlem başarısız.', 'error');
      }
    });
  });

  // ── Yeni Kredi Formu ──────────────────────────────────────────────────────
  let _selectedBankId   = null;
  let _selectedBankData = null;

  const btnShowLoanForm = el('btn-show-loan-form');
  const loanFormSection = el('loan-form-section');
  on(btnShowLoanForm, 'click', () => {
    if (!loanFormSection) return;
    const isVisible = loanFormSection.style.display !== 'none';
    loanFormSection.style.display = isVisible ? 'none' : 'block';
    btnShowLoanForm.textContent = isVisible ? '+ Yeni kredi çek' : '− Formu kapat';
  });

  // Banka kartı seçimi
  qsa('.bank-card').forEach(card => {
    on(card, 'click', () => {
      const bankId = card.dataset.bankId;
      const bank   = BANKS.find(b => b.id === bankId);
      if (!bank) return;

      _selectedBankId   = bankId;
      _selectedBankData = bank;

      // Seçili kart altın çerçeveyle
      qsa('.bank-card').forEach(c => c.classList.remove('secili'));
      card.classList.add('secili');

      // Ayar bölümünü göster
      const configSection = el('loan-config-section');
      if (configSection) configSection.style.display = 'block';

      // Banka adını güncelle
      const bankNameEl = el('loan-selected-bank-name');
      if (bankNameEl) bankNameEl.textContent = `Seçilen banka: ${bank.icon} ${bank.name}`;

      // Slider max değerini güncelle
      const amtSlider = el('loan-amount-slider');
      if (amtSlider) {
        amtSlider.max   = bank.maxLoan;
        amtSlider.value = Math.min(parseInt(amtSlider.value), bank.maxLoan);
        const amtDisplay = el('loan-amount-display');
        if (amtDisplay) amtDisplay.textContent = formatMoneyFull(parseInt(amtSlider.value));
      }

      // Vade seçeneklerini güncelle
      const termSelect = el('loan-term-select');
      if (termSelect) {
        termSelect.innerHTML = '<option value="">Seçin…</option>';
        bank.terms.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t;
          opt.textContent = `${t} dönem`;
          termSelect.appendChild(opt);
        });
      }

      _updateLoanPreview();
    });
  });

  // Taksit önizleme güncelle
  function _updateLoanPreview() {
    if (!_selectedBankData) return;
    const amtSlider   = el('loan-amount-slider');
    const termSelect  = el('loan-term-select');
    const previewEl   = el('loan-payment-preview');
    if (!amtSlider || !termSelect || !previewEl) return;

    const amount = parseInt(amtSlider.value) || 0;
    const term   = parseInt(termSelect.value) || 0;

    if (!term) {
      previewEl.textContent = 'Vade seçin…';
      return;
    }

    const payment = calculateLoanPayment(amount, _selectedBankData.interestRate, term);
    previewEl.innerHTML =
      `Dönem taksiti <b class="ob-kritik">${formatMoneyFull(payment)}</b> × ${term} dönem · ` +
      `toplam geri ödeme <b>${formatMoneyFull(payment * term)}</b>`;
  }

  const amtSlider = el('loan-amount-slider');
  const amtDisplay = el('loan-amount-display');
  on(amtSlider, 'input', () => {
    if (amtDisplay) amtDisplay.textContent = formatMoneyFull(parseInt(amtSlider.value));
    _updateLoanPreview();
  });

  on(el('loan-term-select'), 'change', _updateLoanPreview);

  // Krediyi Onayla
  on(el('btn-confirm-loan'), 'click', () => {
    if (!_selectedBankId || !_selectedBankData) {
      showNotification('Lütfen önce bir banka seçin.', 'warning');
      return;
    }
    const amtSldr  = el('loan-amount-slider');
    const termSel  = el('loan-term-select');
    const amount        = parseInt(amtSldr?.value) || 0;
    const termSemesters = parseInt(termSel?.value)  || 0;

    if (!amount || !termSemesters) {
      showNotification('Kredi miktarı ve vadeyi seçin.', 'warning');
      return;
    }

    if (!onLoanAction) {
      showNotification('Oyun motoru hazır değil.', 'error');
      return;
    }

    const result = onLoanAction({
      type: 'take_loan',
      bankId: _selectedBankId,
      amount,
      termSemesters,
    });

    if (result && result.success) {
      showNotification(result.message, 'success');
      if (window._onBudgetTabRefresh) window._onBudgetTabRefresh();
    } else {
      showNotification(result ? result.message : 'Kredi alınamadı.', 'error');
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. SIRALAMA PANELİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sıralama sekmesi: rakip detayları dahil kapsamlı karşılaştırma tablosu.
 * @param {object} state — Oyun durumu
 */
// ─────────────────────────────────────────────────────────────────────────────
// 7. ARAŞTIRMA PANELİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Araştırma sekmesi: özet, proje gelir yönetimi, dönemin proje başvuruları, BAP, etkin ve tamamlanan projeler,
 * araştırma bütçesi, bölüm araştırma potansiyeli; ikinci alt sekmede Teknoloji Transfer Ofisi.
 * v0.6.1: ortak bileşenler; uzun kart listeleri yerine tablolar (Bölüm Sayfası'nın Araştırma sekmesiyle aynı dil).
 * @param {object}   state            — Oyun durumu
 * @param {Function} onResearchBudget — Araştırma bütçesi değişim callback
 * @param {Function} onProjectDecision — Proje kararı callback (decisionType, applicationId)
 */
export function renderResearchPanel(state, onResearchBudget, onProjectDecision) {
  const panel = el('tab-research');
  if (!panel) return;

  const research       = state.research || {};
  const activeProjects = research.activeResearchProjects || [];
  const lastApps       = research.lastApplicationResults || null;
  const bapApps        = research.bapApplications || [];
  const activeBap      = research.activeBapCall || null;
  const completedProjs = research.completedProjects || [];
  const depts          = state.departments || [];
  const totalProjectBudget = activeProjects.reduce((s, p) => s + (p.requestedFunding || p.funding || 0), 0);
  const uniOverheadRate  = state.universitySettings?.overheadRate ?? 0.15;
  // Dönem genel gider geliri tahmini
  const estimatedOverheadIncome = activeProjects.reduce((s, p) => {
    if (p.status !== 'active') return s;
    const semFund = (p.requestedFunding || p.funding || 0) / Math.max(1, p.duration || 4);
    const rate = p.callOverheadRate ?? uniOverheadRate;
    return s + semFund * rate;
  }, 0);
  const uniShareTotal = activeProjects.reduce((s, p) => {
    const semFund = (p.requestedFunding || p.funding || 0) / Math.max(1, p.duration || 4);
    const rate = p.callOverheadRate ?? uniOverheadRate;
    return s + semFund * rate;
  }, 0);

  // TTO verileri
  const tto = state.tto || {};

  // Genel gider kesinti oranının hoca başvurularına etkisi (kaydırıcıyla birlikte güncellenir)
  const kesintiNotu = r => r > 0.30 ? ['Hocalar proje başvurusundan büyük ölçüde kaçınıyor.', 'ob-kritik']
    : r > 0.25 ? ['Hocalar başvuruyu azaltabilir.', 'ob-uyari']
    : r > 0.20 ? ['Hocalar biraz isteksiz olabilir.', 'ob-uyari']
    : ['Hocalar normal düzeyde başvuruyor.', 'ob-iyi'];

  // TTO alt paneli
  function _renderTTOPanel() {
    if (!tto.established) {
      const kasa = state.university?.budget || 0;
      return `
        <div class="ob-kart">
          <div class="tto-ust"><div class="tto-ad">Teknoloji Transfer Ofisi</div></div>
          <div class="ob-aciklama">Patent lisanslama, spin-off şirketler ve sektör anlaşmalarıyla üniversitenin araştırma çıktısını gelire dönüştürün.</div>
          <div class="ob-kutular tto-kutular">
            ${_obKutu('📜 Patent lisansı', formatMoney(400_000), 'patent başına, her dönem', '', 'ob-kutu--cukur')}
            ${_obKutu('🚀 Spin-off şirket', '0,5-1M ₺', 'yıllık gelir', '', 'ob-kutu--cukur')}
            ${_obKutu('🤝 Sektör anlaşması', '1-20M ₺', 'toplam değer', '', 'ob-kutu--cukur')}
          </div>
          <div class="ob-dizi tto-kur">
            <button class="btn btn-primary" onclick="window._onEstablishTTO && window._onEstablishTTO()">TTO kur (${formatMoney(5_000_000)})</button>
            <span class="ob-aciklama">Kasa: <b class="${kasa >= 5_000_000 ? 'ob-iyi' : 'ob-kritik'}">${formatMoney(kasa)}</b></span>
          </div>
        </div>
      `;
    }

    // TTO kurulu ise ayrıntı paneli
    const ttoLevel = tto.level || 1;
    const upgradeCosts = [0, 3_000_000, 6_000_000, 10_000_000];
    const levelNames = { 1: 'Temel', 2: 'Gelişmiş', 3: 'Uluslararası' };
    const levelMaxDeals = { 1: 2, 2: 4, 3: 6 };
    const lastRev = tto.lastTurnRevenue || { patents: 0, spinoffs: 0, deals: 0, total: 0 };
    const spinoffs = tto.spinoffs || [];
    const activeDeals = tto.industryDeals || [];
    const pendingDeals = tto.pendingDeals || [];

    const upgradeBtn = ttoLevel < 3
      ? `<button class="btn btn-success btn-sm" onclick="window._onUpgradeTTO && window._onUpgradeTTO()">
           Düzey ${sayiEkle(ttoLevel + 1)} yükselt (${formatMoney(upgradeCosts[ttoLevel])})
         </button>`
      : '<span class="ob-rozet ob-rozet--iyi">En üst düzey</span>';

    return `
      <div class="ob-yigin">
        <div class="ob-kart">
          <div class="tto-ust">
            <div>
              <div class="tto-ad">Teknoloji Transfer Ofisi</div>
              <div class="ob-dizi">
                <span class="ob-rozet ob-rozet--bilgi">Düzey ${ttoLevel} · ${levelNames[ttoLevel] || ''}</span>
                <span class="ob-aciklama tto-sinir">en çok ${levelMaxDeals[ttoLevel]} anlaşma</span>
              </div>
            </div>
            ${upgradeBtn}
          </div>
          <div class="ob-kutular">
            ${_obKutu('Dönem geliri', formatMoney(lastRev.total), 'TTO toplamı', '', 'ob-kutu--cukur')}
            ${_obKutu('Patent lisansı', formatMoney(lastRev.patents), 'bu dönem', '', 'ob-kutu--cukur')}
            ${_obKutu('Spin-off', formatMoney(lastRev.spinoffs), 'bu dönem', '', 'ob-kutu--cukur')}
            ${_obKutu('Toplam gelir', formatMoney(tto.totalRevenueGenerated || 0), 'tüm zamanlar', '', 'ob-kutu--cukur')}
          </div>
        </div>

        ${pendingDeals.length > 0 ? `
          <section class="ob-bolum">
            <div class="section-title"><i class="ikon ikon--bildirim" aria-hidden="true"></i>Bekleyen sektör teklifleri <span class="ob-sayi">${pendingDeals.length}</span></div>
            <div class="ob-basvuru-liste">
              ${pendingDeals.map(deal => `
                <div class="ob-basvuru">
                  <div class="ob-basvuru-bilgi">
                    <div class="ob-basvuru-ad">${deal.icon || '🤝'} ${deal.company}</div>
                    <div class="ob-basvuru-alt">${deal.typeName} · ${deal.duration} dönem · toplam ${formatMoney(deal.totalValue)} · dönem başına ${formatMoney(deal.perTurnRevenue)}</div>
                  </div>
                  <div class="ob-basvuru-dugmeler">
                    <button class="btn btn-success btn-sm" onclick="window._onAcceptDeal && window._onAcceptDeal(${deal.id})">Kabul et</button>
                    <button class="btn btn-danger btn-sm" onclick="window._onRejectDeal && window._onRejectDeal(${deal.id})">Reddet</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </section>
        ` : ''}

        <section class="ob-bolum">
          <div class="section-title"><i class="ikon ikon--kasa" aria-hidden="true"></i>Etkin anlaşmalar <span class="ob-sayi">${activeDeals.length}/${levelMaxDeals[ttoLevel]}</span></div>
          ${activeDeals.length > 0 ? `
            <div class="ob-tablo-kap">
              <table class="ob-tablo">
                <thead><tr><th>Şirket</th><th>Tür</th><th class="n">Dönem başına</th><th class="n">Kalan</th></tr></thead>
                <tbody>
                  ${activeDeals.map(deal => `
                    <tr>
                      <td class="ob-ad ob-tek">${deal.icon || '🤝'} ${deal.company}</td>
                      <td class="ob-tek">${deal.typeName}</td>
                      <td class="n ob-tek ob-iyi">${formatMoney(deal.perTurnRevenue)}</td>
                      <td class="n ob-tek">${deal.turnsRemaining} dönem</td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
          ` : '<div class="ob-bos ob-bos--kucuk">Etkin anlaşma yok. Dönem sonunda sektör teklifleri gelebilir.</div>'}
        </section>

        <section class="ob-bolum">
          <div class="section-title"><i class="ikon ikon--arastirma" aria-hidden="true"></i>Spin-off şirketler <span class="ob-sayi">${spinoffs.length}</span></div>
          ${spinoffs.length > 0 ? `
            <div class="ob-tablo-kap">
              <table class="ob-tablo ob-tablo--dar">
                <thead><tr><th>Şirket</th><th>Kuruluş</th><th class="n">Yıllık gelir</th></tr></thead>
                <tbody>
                  ${spinoffs.map(sof => `
                    <tr>
                      <td class="ob-ad ob-tek">🏭 ${sof.name}</td>
                      <td class="ob-tek">${sof.foundedAt ? `${sof.foundedAt}. dönem` : 'bilinmiyor'}</td>
                      <td class="n ob-tek ob-iyi">${formatMoney(sof.annualRevenue)}</td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
          ` : '<div class="ob-bos ob-bos--kucuk">Henüz spin-off şirket yok. Patentler arttıkça spin-off kurulabilir.</div>'}
        </section>

        <div class="ob-kart">
          <div class="ob-kart-baslik"><span>TTO özeti</span></div>
          <div class="tto-ozet">
            <div class="ob-satir"><span>Toplam patent</span><b>${research.patents || 0}</b></div>
            <div class="ob-satir"><span>Spin-off şirket</span><b>${spinoffs.length}</b></div>
            <div class="ob-satir"><span>Etkin anlaşma</span><b>${activeDeals.length}</b></div>
            <div class="ob-satir"><span>Bekleyen teklif</span><b>${pendingDeals.length}</b></div>
            <div class="ob-satir"><span>TTO düzeyi</span><b>${ttoLevel}/3</b></div>
            <div class="ob-satir"><span>İşletme gideri (dönem)</span><b class="ob-kritik">-${formatMoney(800_000)}</b></div>
          </div>
        </div>
      </div>
    `;
  }

  // BAP başvurusu satırı. Karar düğmeleri .proj-decision-btn + data-app-id / data-decision (aşağıdaki dinleyici)
  const bapSatiri = (app) => {
    const puan = (state.faculty || []).find(f => f.id === app.facultyId)?.stats?.research;
    return `
      <div class="ob-basvuru">
        <div class="ob-basvuru-bilgi">
          <div class="ob-basvuru-ad">${app.projectName}</div>
          <div class="ob-basvuru-alt">${app.facultyName} · ${_bolumKisaAdi(app.facultyDept, depts)}${puan != null ? ` · araştırma ${tamPuan(puan)}` : ''} · ${formatMoney(app.requestedFunding)} · ${app.duration} dönem · ~${app.estimatedPublications} yayın</div>
        </div>
        <div class="ob-basvuru-dugmeler">
          <button class="btn btn-success btn-sm proj-decision-btn"
            data-app-id="${app.id}" data-decision="approve_bap_application">Onayla</button>
          <button class="btn btn-danger btn-sm proj-decision-btn"
            data-app-id="${app.id}" data-decision="reject_bap_application">Reddet</button>
        </div>
      </div>
    `;
  };

  // Bu dönemin dış proje başvuruları (önce kabul edilenler)
  const basvuruSatiri = (a, kabul) => `
    <tr>
      <td>${kabul ? '<span class="ob-rozet ob-rozet--iyi ob-rozet--kucuk">Kabul</span>' : '<span class="ob-rozet ob-rozet--kritik ob-rozet--kucuk">Red</span>'}</td>
      <td class="arastirma-proje">${a.projectName}</td>
      <td class="ob-tek">${a.facultyName}</td>
      <td class="ob-tek">${_bolumKisaAdi(a.facultyDept, depts)}</td>
      <td class="ob-tek">${a.callIcon || '📋'} ${a.callType || '—'}</td>
      <td class="n ob-tek">${formatMoney(a.requestedFunding)}</td>
      <td class="n ob-tek">${a.duration != null ? `${a.duration} dönem` : '—'}</td>
      <td class="n">${a.estimatedPublications != null ? `~${a.estimatedPublications}` : '—'}</td>
    </tr>`;

  const basvurular = !lastApps || lastApps.total === 0 ? `
    <div class="ob-bos">
      <i class="ikon ikon--arastirma" aria-hidden="true"></i>
      <div class="ob-bos-baslik">Bu dönem proje başvurusu yapılmadı</div>
      <div>Açık dış çağrı varsa hocalar sonraki dönemde başvuracak.</div>
    </div>
  ` : `
    <div class="ob-dizi arastirma-sonuc">
      <span class="ob-rozet">Toplam başvuru ${lastApps.total}</span>
      <span class="ob-rozet ob-rozet--iyi">Kabul ${(lastApps.accepted || []).length}</span>
      <span class="ob-rozet ob-rozet--kritik">Red ${(lastApps.rejected || []).length}</span>
    </div>
    <div class="ob-tablo-kap">
      <table class="ob-tablo ob-tablo--genis">
        <thead>
          <tr><th>Sonuç</th><th>Proje</th><th>Yürütücü</th><th>Bölüm</th><th>Çağrı</th><th class="n">Tutar</th><th class="n">Süre</th><th class="n">Yayın</th></tr>
        </thead>
        <tbody>
          ${(lastApps.accepted || []).map(a => basvuruSatiri(a, true)).join('')}
          ${(lastApps.rejected || []).map(r => basvuruSatiri(r, false)).join('')}
        </tbody>
      </table>
    </div>
  `;

  const projeSatiri = (p) => {
    const turnsLeft = Math.max(0, (p.duration || 2) - (p.currentTurn || 0));
    const prog = p.progress ?? Math.round(((p.currentTurn || 0) / Math.max(1, p.duration || 2)) * 100);
    const progWidth = Math.max(0, Math.min(100, Math.round(prog)));
    const projFunding = p.requestedFunding || p.funding || 0;
    const projSemFund = projFunding / Math.max(1, p.duration || 4);
    const projRate = p.callOverheadRate ?? uniOverheadRate;
    const projUniShare = Math.round(projSemFund * projRate);
    const yayin = p.publicationBonus || p.estimatedPublications;
    return `
      <tr>
        <td class="arastirma-proje"><span class="ob-ad">${p.callIcon || '📋'} ${p.projectName || p.name || 'Adsız proje'}</span>${p.isPrivateSector ? ' <span class="ob-rozet ob-rozet--uyari ob-rozet--kucuk">özel sektör</span>' : ''}</td>
        <td class="ob-tek">${p.callType || p.description || '—'}</td>
        <td class="ob-tek">${p.piName || '—'}</td>
        <td class="n ob-tek">${formatMoney(projFunding)}</td>
        <td class="n ob-tek ob-iyi">${formatMoney(projUniShare)}</td>
        <td class="n ob-tek">${turnsLeft} dönem</td>
        <td class="n">${yayin ? `+${yayin}` : '—'}</td>
        <td><div class="arastirma-ilerleme"><div class="ob-cubuk"><span style="width:${progWidth}%"></span></div><span class="ob-tek">%${progWidth}</span></div></td>
      </tr>`;
  };

  const bekleyenTeklif = tto.established ? (tto.pendingDeals || []).length : 0;
  const [notMetni, notSinifi] = kesintiNotu(uniOverheadRate);

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-title">Araştırma Yönetimi</div>
        <div class="panel-subtitle">${activeProjects.length} etkin proje · üniversite payı ${formatMoney(estimatedOverheadIncome)}/dönem · ${lastApps ? `son dönem ${(lastApps.accepted || []).length} kabul, ${(lastApps.rejected || []).length} red` : 'henüz başvuru yok'}</div>
      </div>
    </div>

    <!-- Araştırma alt sekmeleri -->
    <div class="ob-sekmeler research-subtabs" role="tablist" aria-label="Araştırma alt sekmeleri">
      <button type="button" role="tab" class="ob-sekme research-subtab secili" aria-selected="true" data-subtab="projects">Projeler</button>
      <button type="button" role="tab" class="ob-sekme research-subtab" aria-selected="false" data-subtab="tto">Teknoloji transfer${bekleyenTeklif > 0 ? ` <small class="acil">${bekleyenTeklif}</small>` : ''}</button>
    </div>

    <!-- Alt sekme: Projeler -->
    <div id="research-subtab-projects" class="ob-yigin">

      <div class="ob-kutular">
        ${_obKutu('Toplam yayın', formatNumber(research.publications ?? 0), 'makale')}
        ${_obKutu('h-indeksi', ondalikYaz(research.hIndex ?? 0, 1), 'öğretim üyesi ortalaması')}
        ${_obKutu('Etkin proje', formatNumber(activeProjects.length), 'devam ediyor')}
        ${_obKutu('Tamamlanan', formatNumber(completedProjs.filter(p => p.status === 'completed').length), 'başarılı proje')}
        ${_obKutu('Üniversite payı', formatMoney(uniShareTotal), 'dönemlik genel gider kesintisi', 'ob-iyi')}
      </div>

      <div class="ob-iki">
        <section class="ob-bolum">
          <div class="section-title"><i class="ikon ikon--kasa" aria-hidden="true"></i>Proje gelir yönetimi</div>
          <div class="ob-kart">
            <div class="ob-ayar">
              <label class="ob-ayar-e" for="overhead-rate-slider">Genel gider kesinti oranı</label>
              <input type="range" class="ob-kaydirici" id="overhead-rate-slider" min="5" max="40" step="1"
                     value="${Math.round(uniOverheadRate * 100)}">
              <div class="ob-ayar-d" id="overhead-rate-value">%${Math.round(uniOverheadRate * 100)}</div>
            </div>
            <div id="overhead-rate-note" class="ob-aciklama ${notSinifi}">${notMetni}</div>
            <div class="arastirma-ozet">
              <div class="ob-satir"><span>Bu dönem proje genel gider geliri</span><b class="ob-iyi">${formatMoney(estimatedOverheadIncome)}</b></div>
              <div class="ob-satir"><span>Etkin projelerin toplam bütçesi</span><b>${formatMoney(totalProjectBudget)}</b></div>
              <div class="ob-satir"><span>Patent sayısı</span><b>${research.patents ?? 0}</b></div>
              ${(research.patentRoyalties ?? 0) > 0 ? `<div class="ob-satir"><span>Patent telifi (dönem)</span><b class="ob-iyi">${formatMoney(Math.round((research.patentRoyalties ?? 0) / 2))}</b></div>` : ''}
            </div>
            <div class="ob-aciklama">Oran %20'yi aşarsa hocalar %20, %25'i aşarsa %40 daha az başvurur; %30'un üstünde çok az başvuru gelir.</div>
            <button class="btn btn-success btn-sm arastirma-tam" id="btn-apply-overhead-rate">Oranı güncelle</button>
          </div>
        </section>

        <section class="ob-bolum">
          <div class="section-title"><i class="ikon ikon--butce" aria-hidden="true"></i>Araştırma bütçesi</div>
          <div class="ob-kart">
            <div class="ob-ayar">
              <label class="ob-ayar-e" for="research-budget-slider">Hoca başına dönemlik fon</label>
              <input type="range" class="ob-kaydirici" id="research-budget-slider"
                     min="0" max="500000" step="10000"
                     value="${state.researchBudgetPerFaculty ?? 50000}">
              <div class="ob-ayar-d" id="research-budget-value">${formatMoney(state.researchBudgetPerFaculty ?? 50000)}</div>
            </div>
            <div id="research-budget-preview" class="arastirma-onizleme"></div>
            <button class="btn btn-success btn-sm arastirma-tam" id="btn-apply-research-budget">Bütçeyi güncelle</button>
          </div>
        </section>
      </div>

      <!-- Hoca başvuru sonuçları -->
      <section class="ob-bolum">
        <div class="section-title"><i class="ikon ikon--arastirma" aria-hidden="true"></i>Bu dönem proje başvuruları</div>
        <div class="ob-aciklama">Hocalar dış çağrılara kendileri başvurur; sonuçlar dönem sonunda açıklanır.</div>
        <div id="proj-applications-list">${basvurular}</div>
      </section>

      <!-- BAP -->
      <section class="ob-bolum">
        <div class="section-title"><i class="ikon ikon--fakulteler" aria-hidden="true"></i>BAP (üniversite içi projeler)${activeBap ? ` <span class="ob-sayi">${bapApps.length} başvuru</span>` : ''}</div>
        ${activeBap ? `
          <div class="ob-yigin ob-yigin--sik">
            <div class="ob-kart">
              <div class="ob-kart-baslik"><span>Açık BAP çağrısı</span>${activeBap.expirationTurn != null ? `<span class="ob-rozet ob-rozet--uyari">${Math.max(0, activeBap.expirationTurn - (state.meta?.turn || 0))} dönem sonra kapanır</span>` : ''}</div>
              <div class="arastirma-ozet">
                <div class="ob-satir"><span>Toplam bütçe</span><b>${formatMoney(activeBap.totalBudget)}</b></div>
                <div class="ob-satir"><span>Kalan</span><b class="ob-iyi">${formatMoney(activeBap.remainingBudget)}</b></div>
                <div class="ob-satir"><span>Proje başına en çok</span><b>${formatMoney(activeBap.maxPerProject)}</b></div>
              </div>
            </div>
            <div id="bap-applications-list" class="ob-basvuru-liste">
              ${bapApps.length === 0
                ? '<div class="ob-bos ob-bos--kucuk">Bekleyen BAP başvurusu yok.</div>'
                : bapApps.map(app => bapSatiri(app)).join('')}
            </div>
          </div>
        ` : `
          <div class="ob-kart">
            <div class="ob-aciklama">Açık BAP çağrısı yok. Çağrı açarak hocaların üniversite fonundan proje yürütmesini sağlayın.</div>
            <div class="ob-iki bap-ayarlar">
              <div class="ob-ayar">
                <label class="ob-ayar-e" for="bap-total-slider">Toplam BAP bütçesi</label>
                <input type="range" class="ob-kaydirici" id="bap-total-slider" min="100000" max="5000000" step="100000" value="500000">
                <div class="ob-ayar-d" id="bap-total-value">${formatMoney(500000)}</div>
              </div>
              <div class="ob-ayar">
                <label class="ob-ayar-e" for="bap-max-slider">Proje başına en çok</label>
                <input type="range" class="ob-kaydirici" id="bap-max-slider" min="30000" max="500000" step="10000" value="100000">
                <div class="ob-ayar-d" id="bap-max-value">${formatMoney(100000)}</div>
              </div>
            </div>
            <div class="ob-dizi arastirma-dugme"><button class="btn btn-primary btn-sm" id="btn-open-bap">BAP çağrısı yayınla</button></div>
          </div>
        `}
      </section>

      <!-- Etkin projeler -->
      <section class="ob-bolum">
        <div class="section-title"><i class="ikon ikon--arastirma" aria-hidden="true"></i>Etkin projeler <span class="ob-sayi">${activeProjects.length}</span></div>
        ${activeProjects.length ? `
          <div class="ob-aciklama">Toplam bütçe ${formatMoney(totalProjectBudget)} · üniversite payı ${formatMoney(uniShareTotal)}/dönem</div>
          <div class="ob-tablo-kap">
            <table class="ob-tablo ob-tablo--genis">
              <thead>
                <tr><th>Proje</th><th>Tür</th><th>Yürütücü</th><th class="n">Bütçe</th><th class="n">Üniversite payı</th><th class="n">Kalan</th><th class="n">Yayın</th><th>İlerleme</th></tr>
              </thead>
              <tbody>${activeProjects.map(projeSatiri).join('')}</tbody>
            </table>
          </div>
          <div class="ob-tablo-dip">Üniversite payı projenin dönemlik bütçesinden alınan genel gider kesintisidir.</div>
        ` : `
          <div class="ob-bos">
            <i class="ikon ikon--arastirma" aria-hidden="true"></i>
            <div class="ob-bos-baslik">Etkin proje yok</div>
            <div>Hocalar dış çağrılara kendileri başvurur; kabul edilenler buraya eklenir.</div>
          </div>
        `}
      </section>

      <div class="ob-iki">
        <!-- Tamamlanan projeler (son 5) -->
        <section class="ob-bolum">
          <div class="section-title"><i class="ikon ikon--kazanim" aria-hidden="true"></i>Tamamlanan projeler${completedProjs.length ? ` <span class="ob-sayi">son ${Math.min(5, completedProjs.length)}</span>` : ''}</div>
          ${completedProjs.length > 0 ? `
            <div class="ob-tablo-kap">
              <table class="ob-tablo ob-tablo--dar">
                <thead><tr><th>Sonuç</th><th>Proje</th><th>Yürütücü</th><th class="n">Yayın</th></tr></thead>
                <tbody>
                  ${[...completedProjs].reverse().slice(0, 5).map(p => `
                    <tr>
                      <td>${p.status === 'completed' ? '<span class="ob-rozet ob-rozet--iyi ob-rozet--kucuk">Başarılı</span>' : '<span class="ob-rozet ob-rozet--kritik ob-rozet--kucuk">Sonuçsuz</span>'}</td>
                      <td title="${p.callType || ''}">${p.projectName || p.name || 'Adsız proje'}</td>
                      <td class="ob-tek">${p.piName || '—'}</td>
                      <td class="n">${p.status === 'completed' ? `+${p.publicationBonus || p.estimatedPublications || 0}` : '—'}</td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
          ` : '<div class="ob-bos ob-bos--kucuk">Henüz tamamlanan proje yok.</div>'}
        </section>

        <!-- Bölüm araştırma potansiyeli: bölüm türünün 1-5 arası sabit özelliği (data.js). Eskiden 100 üzerinden
             çubukla gösteriliyor, 5 puanlık bölüm bile kırmızı ve boş görünüyordu. -->
        <section class="ob-bolum">
          <div class="section-title"><i class="ikon ikon--bolumler" aria-hidden="true"></i>Bölüm araştırma potansiyeli</div>
          <div class="ob-tablo-kap">
            <table class="ob-tablo ob-tablo--dar">
              <thead><tr><th>Bölüm</th><th>Potansiyel</th></tr></thead>
              <tbody>
                ${depts.filter(d => d.isOpen).map(d => {
                  const v = Math.max(0, Math.min(5, Math.round(Number(d.researchPotential) || 0)));
                  return `
                    <tr>
                      <td class="ob-ad ob-tek">${d.shortName || d.name}</td>
                      <td class="ob-tek">${_obPuan(v, 5, { etiket: 'Araştırma potansiyeli', renk: v >= 4 ? 'iyi' : v >= 3 ? 'uyari' : 'kritik' })} <span class="ob-soluk">${v}/5</span></td>
                    </tr>`;
                }).join('') || '<tr><td colspan="2" class="ob-soluk">Bölüm yok.</td></tr>'}
              </tbody>
            </table>
          </div>
          <div class="ob-tablo-dip">Bölüm türünün araştırmaya yatkınlığı, 5 üzerinden.</div>
        </section>
      </div>

    </div><!-- /research-subtab-projects -->

    <!-- Alt sekme: TTO -->
    <div id="research-subtab-tto" style="display:none;">
      ${_renderTTOPanel()}
    </div>

  `;

  // ── Alt sekme geçişi ────────────────────────────────────────────────────────
  panel.querySelectorAll('.research-subtab').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.subtab;
      panel.querySelectorAll('.research-subtab').forEach(b => {
        const secili = b === btn;
        b.classList.toggle('secili', secili);
        b.setAttribute('aria-selected', String(secili));
      });
      const projectsDiv = panel.querySelector('#research-subtab-projects');
      const ttoDiv = panel.querySelector('#research-subtab-tto');
      if (projectsDiv) projectsDiv.style.display = target === 'projects' ? '' : 'none';
      if (ttoDiv) ttoDiv.style.display = target === 'tto' ? '' : 'none';
    });
  });

  // ── Olay bağlantıları ──────────────────────────────────────────────────────

  const slider = el('research-budget-slider');
  const valEl  = el('research-budget-value');
  const previewEl = el('research-budget-preview');

  function _updateResearchPreview(newVal) {
    if (!previewEl) return;
    const facultyCount  = (state.faculty || []).length;
    const currentBudget = state.university?.budget ?? 0;
    const currentPerFac = state.researchBudgetPerFaculty ?? 50000;
    const currentTotal  = currentPerFac * facultyCount;
    const newTotal      = newVal * facultyCount;
    const diff          = newTotal - currentTotal;
    const projectedBudget = currentBudget - diff;
    const diffSign      = diff >= 0 ? '+' : '';
    const diffArrow     = diff > 0 ? '▲' : (diff < 0 ? '▼' : '');
    let effectNote = '';
    if (newVal > currentPerFac) {
      const artis = Math.round(((newVal - currentPerFac) / Math.max(currentPerFac, 1)) * 100);
      effectNote = `<div class="ob-aciklama ob-iyi">Araştırma çıktısı +%${artis}; hoca memnuniyeti artar.</div>`;
    } else if (newVal < currentPerFac) {
      effectNote = '<div class="ob-aciklama ob-kritik">Araştırma çıktısı azalır; hoca memnuniyeti düşebilir.</div>';
    }
    previewEl.innerHTML = `
      <div class="ob-kart-baslik"><span>Maliyet etkisi</span></div>
      <div class="ob-satir"><span>Şu an</span><b>${facultyCount} × ${formatMoney(currentPerFac)} = ${formatMoney(currentTotal)}/dönem</b></div>
      <div class="ob-satir"><span>Yeni</span><b>${facultyCount} × ${formatMoney(newVal)} = ${formatMoney(newTotal)}/dönem</b></div>
      <div class="ob-satir"><span>Fark</span><b class="${diff > 0 ? 'ob-kritik' : diff < 0 ? 'ob-iyi' : ''}">${diffSign}${formatMoney(diff)}/dönem ${diffArrow}</b></div>
      <div class="ob-satir"><span>Kasa</span><b>${formatMoney(currentBudget)}</b></div>
      <div class="ob-satir"><span>Dönem sonu tahmini</span><b class="${projectedBudget >= 0 ? 'ob-iyi' : 'ob-kritik'}">${formatMoney(projectedBudget)}</b></div>
      ${effectNote}
    `;
  }

  if (slider && valEl) {
    _updateResearchPreview(parseInt(slider.value));
    on(slider, 'input', () => {
      const v = parseInt(slider.value);
      valEl.textContent = formatMoney(v);
      _updateResearchPreview(v);
    });
  }

  on(el('btn-apply-research-budget'), 'click', () => {
    if (onResearchBudget) onResearchBudget(parseInt(el('research-budget-slider')?.value ?? 50000));
    showNotification('Araştırma bütçesi güncellendi.', 'success');
  });

  // Genel gider kesinti oranı kaydırıcısı
  const overheadSlider  = el('overhead-rate-slider');
  const overheadValEl   = el('overhead-rate-value');
  const overheadNoteEl  = el('overhead-rate-note');
  if (overheadSlider && overheadValEl) {
    on(overheadSlider, 'input', () => {
      const pct = parseInt(overheadSlider.value);
      overheadValEl.textContent = `%${pct}`;
      if (overheadNoteEl) {
        const [metin, sinif] = kesintiNotu(pct / 100);
        overheadNoteEl.textContent = metin;
        overheadNoteEl.className = `ob-aciklama ${sinif}`;
      }
    });
  }
  on(el('btn-apply-overhead-rate'), 'click', () => {
    const pct  = parseInt(el('overhead-rate-slider')?.value ?? 15);
    const rate = pct / 100;
    if (onProjectDecision) onProjectDecision('set_overhead_rate', null, { rate });
  });

  // BAP slider güncellemeleri
  const bapTotalSlider = el('bap-total-slider');
  const bapMaxSlider   = el('bap-max-slider');
  if (bapTotalSlider) {
    on(bapTotalSlider, 'input', () => {
      const bapValEl = el('bap-total-value');
      if (bapValEl) bapValEl.textContent = formatMoney(parseInt(bapTotalSlider.value));
    });
  }
  if (bapMaxSlider) {
    on(bapMaxSlider, 'input', () => {
      const bapMaxValEl = el('bap-max-value');
      if (bapMaxValEl) bapMaxValEl.textContent = formatMoney(parseInt(bapMaxSlider.value));
    });
  }

  // BAP çağrısı aç
  on(el('btn-open-bap'), 'click', () => {
    const totalBudget    = parseInt(el('bap-total-slider')?.value || 500000);
    const maxPerProject  = parseInt(el('bap-max-slider')?.value  || 100000);
    if (onProjectDecision) {
      onProjectDecision('open_bap_call', null, { totalBudget, maxPerProject, field: 'any' });
    }
  });

  // Proje onay/ret butonları (hem dış hem BAP başvuruları)
  // Guard: panel aynı DOM elementi olduğu için delegate listener'lar her
  // renderResearchPanel çağrısında birikmez; yalnızca bir kez eklenir.
  // (Birden fazla eklenseydi BAP onayında "BAP bütçesi yetersiz" bildirimi
  // N kez geliyordu, EfekanSalman Issue #22.)
  if (!panel._projDecisionDelegateAttached) {
    panel._projDecisionDelegateAttached = true;
    delegate(panel, '.proj-decision-btn', 'click', (e, btn) => {
      const appId    = btn.dataset.appId;
      const decision = btn.dataset.decision;
      if (!appId || !decision) return;
      // onProjectDecision her render çağrısında güncellenir; panel üzerindeki
      // referans en güncel callback'i göstersin diye wrapper kullan.
      if (panel._onProjectDecision) {
        panel._onProjectDecision(decision, appId, {});
      }
    });
  }
  // Her render'da callback referansını güncelle
  panel._onProjectDecision = onProjectDecision;
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. TRANSFER PAZARI MODAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transfer pazarındaki bir hoca için kompakt liste kartı HTML'i üretir.
 * Sol panelde gösterilir; tıklanınca sağ panel detayı açar.
 */
/**
 * Transfer adayının bölüm adı. Aday department alanında bölüm kimliği taşır ('bilgisayar_muh');
 * eski veride dizi sırası ('2') gelebilir, o zaman bölüm belirsiz sayılır.
 * @returns {{ ad: string, acik: boolean }}
 */
export function adayBolumu(f, depts = []) {
  const id   = f?.department ?? f?.departmentId;
  const acik = depts.find(d => d.id === id && d.isOpen !== false);
  if (acik) return { ad: acik.shortName || acik.name, acik: true };
  const tanim = (typeof id === 'string') ? DEPARTMENTS[id] : null;
  if (tanim) return { ad: tanim.shortName || tanim.name, acik: false };
  return { ad: 'bölümü belirsiz', acik: false };
}

function _renderTransferFacultyCard(f, depts, state) {
  const deptName  = adayBolumu(f, depts).ad;
  const titleKey  = f.title || 'dr_ogr_uyesi';
  const titleDisp = _BS_UNVAN[titleKey] || f.title;
  const stats     = f.stats || {};

  const research   = stats.research   ?? 50;
  const teaching   = stats.teaching   ?? 50;

  // Genel puan (hoca kartıyla aynı eşik ve renkler)
  const overall = calculateOverallRating(f);
  const renk    = overall >= 85 ? '#f0c040' : overall >= 70 ? '#4ecca3' : overall >= 55 ? '#f5a623' : '#ff6b81';

  // Portre ya da baş harfler
  const avatarHtml = (f.gender || f.avatar)
    ? renderFacultyPortrait(f, 46)
    : `<span class="aday-harf transfer-harf" aria-hidden="true">${(f.name || '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}</span>`;

  const pubCount = f.publications ?? null;

  // v0.6.1: alt satır kısaltmasız ("Ar:72 Eğ:77" yerine "Araştırma 72 · Eğitim 77")
  return `
    <div class="transfer-market-card transfer-kart" data-faculty-id="${f.id}" tabindex="0" role="button"
         aria-label="${f.name || 'Hoca'}: ayrıntı ve teklif">
      <div class="transfer-kart-ust">
        <span class="transfer-kart-foto">${avatarHtml}</span>
        <div class="transfer-kart-kimlik">
          <div class="transfer-kart-ad">${f.name || 'İsimsiz'}</div>
          <div class="transfer-kart-alt">${titleDisp} · ${deptName}</div>
        </div>
        <span class="transfer-puan" style="--rc:${renk};" title="Genel puan">${overall}</span>
      </div>
      <div class="transfer-kart-dip">
        <span>Araştırma <b class="${_obKademe(research, 70, 55)}">${tamPuan(research)}</b></span>
        <span>Eğitim <b class="${_obKademe(teaching, 70, 55)}">${tamPuan(teaching)}</b></span>
        ${pubCount !== null ? `<span><b>${pubCount}</b> yayın</span>` : ''}
        <b class="transfer-kart-maas">${formatMoney(f.askingSalary ?? f.salary)}/ay</b>
      </div>
    </div>
  `;
}

/**
 * Sağ panel: seçili hocanın ayrıntısı ve teklif formu. Kimlikler (offer-salary, offer-research-fund,
 * offer-lab-quality, offer-title-promise, btn-send-offer) renderTransferMarket'teki dinleyicilere bağlı.
 */
function _renderTransferRightPanel(fac, depts, state) {
  if (!fac) {
    return `
      <div class="ob-bos transfer-bos">
        <div class="ob-bos-baslik">Soldan bir hoca seçin</div>
        Karta tıklayınca hocanın ayrıntıları ve teklif formu burada açılır.
      </div>`;
  }

  const titleKey  = fac.title || 'dr_ogr_uyesi';
  const titleDisp = _BS_UNVAN[titleKey] || fac.title || '';
  const stats     = fac.stats || {};
  const research  = stats.research   ?? 50;
  const teaching  = stats.teaching   ?? 50;
  const mgmt      = stats.management ?? 50;
  const avgStat   = Math.round((research + teaching + mgmt) / 3);

  // Genel puan (hoca kartıyla aynı renkler)
  const overallRating = calculateOverallRating(fac);
  const renk          = overallRating >= 85 ? '#f0c040' : overallRating >= 70 ? '#4ecca3' : overallRating >= 55 ? '#f5a623' : '#ff6b81';

  const myDepts       = (state.departments || []).filter(d => d.isOpen);
  const myDeptIds     = myDepts.map(d => d.id);
  const teachable     = _getTeachableCourses(fac, myDeptIds);
  const deptCompat    = myDepts.map(d => ({
    dept: d,
    compat: _getDeptCompatibility(fac, d.id, myDeptIds),
  })).filter(x => x.compat.count > 0).sort((a, b) => b.compat.pct - a.compat.pct);

  const adayBolum  = adayBolumu(fac, state.departments || []);
  const deptName   = adayBolum.ad;

  const isHighRated   = avgStat > 70;
  const pubEstimate   = isHighRated ? Math.max(1, Math.round((research - 50) / 15)) : 0;
  const satEstimate   = isHighRated ? Math.max(1, Math.round((teaching  - 50) / 12)) : 0;
  const prestEstimate = isHighRated ? Math.max(1, Math.round((avgStat   - 60) / 10)) : 0;
  const gradStudents  = (titleKey === 'profesor' || titleKey === 'docent') ? Math.max(1, Math.round((research - 50) / 20)) : 0;
  const totalCost     = (fac.askingSalary ?? fac.salary ?? 0) + (fac.transferFee ?? 0);
  const initials      = (fac.name || '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  const avatarHtmlRight = (fac.gender || fac.avatar)
    ? renderFacultyPortrait(fac, 88)
    : `<span class="aday-harf" aria-hidden="true">${initials}</span>`;
  const simdi = fac.previousUniversity || fac.currentUniversity || '';

  return `
    <div class="pencere-yigin">
      <div class="pencere-kimlik">
        <div class="fc2-photo">
          ${avatarHtmlRight}
          <div class="fc2-rating" style="--rc:${renk};" title="Genel puan"><b>${overallRating}</b></div>
        </div>
        <div class="ob-kimlik-govde">
          <div class="ob-kimlik-ad">${fac.name || 'İsimsiz'}</div>
          <div class="ob-kimlik-alt"><span class="badge badge-${titleKey}">${titleDisp}</span>${deptName}</div>
          ${simdi ? `<div class="ob-kimlik-alt">Şu an: ${simdi}</div>` : ''}
        </div>
      </div>

      <div class="ob-kart pencere-cubuklar">
        ${createStatBar('Araştırma', research, 100, _statColor(research))}
        ${createStatBar('Eğitim', teaching, 100, _statColor(teaching))}
        ${createStatBar('Yönetim', mgmt, 100, _statColor(mgmt))}
      </div>

      ${(fac.publications != null || fac.citations != null) ? `
        <div class="ob-kutular transfer-kutular">
          ${_obKutu('Yayın', fac.publications ?? '—', '', '', 'ob-kutu--cukur')}
          ${_obKutu('Atıf', fac.citations ?? '—', '', '', 'ob-kutu--cukur')}
          ${_obKutu('h-indeksi', fac.hIndex ?? '—', '', '', 'ob-kutu--cukur')}
          ${_obKutu('Proje', fac.activeProjects != null ? fac.activeProjects : '—', '', '', 'ob-kutu--cukur')}
        </div>` : ''}

      ${fac.education ? `
        <div class="ob-kart">
          ${_obSatir('Doktora', `${_veriMetni(String(fac.education.phd || '').replace(' — ', ', '))} <span class="ob-soluk">(${fac.education.year})</span>`)}
          ${fac.yearsExperience != null ? _obSatir('Deneyim', `${fac.yearsExperience} yıl`) : ''}
        </div>` : ''}

      ${(fac.specializations && fac.specializations.length > 0) ? `
        <div class="fc2-tags transfer-etiketler">
          ${fac.specializations.map(s => `<span class="fc2-tag">${s}</span>`).join('')}
        </div>` : ''}

      ${teachable.length > 0 ? `
        <div class="ob-kart">
          <div class="ob-kart-baslik"><span>Verebileceği dersler</span><span class="ob-sayi">${teachable.length}</span></div>
          ${teachable.slice(0, 6).map(c => `
            <div class="ob-satir transfer-ders"><span>${c.courseName}</span><b><span class="ob-soluk">${c.deptShortName}</span> ${_dersTuruRozeti(c.type)}</b></div>`).join('')}
          ${teachable.length > 6 ? `<div class="ob-aciklama">${teachable.length - 6} ders daha verebilir.</div>` : ''}
        </div>
      ` : `
        <div class="ob-not ob-not--uyari">Bu hocanın uzmanlığı bölümlerinizin dersleriyle örtüşmüyor.</div>
      `}

      ${deptCompat.length > 0 ? `
        <div class="ob-kart">
          <div class="ob-kart-baslik"><span>Bölüm uyumu</span></div>
          ${deptCompat.map(x => {
            const pct = x.compat.pct;
            const tur = pct >= 60 ? 'iyi' : pct >= 30 ? 'uyari' : 'kritik';
            return `
              ${_obSatir(x.dept.shortName || x.dept.name, `%${pct} <span class="ob-soluk">(${x.compat.count} ders)</span>`, `ob-${tur}`)}
              <div class="ob-cubuk ob-cubuk--${tur}"><span style="width:${Math.max(0, Math.min(100, pct))}%"></span></div>`;
          }).join('')}
        </div>
      ` : ''}

      <div class="ob-kart">
        ${_obSatir('Transfer maaş talebi', `${formatMoney(fac.askingSalary ?? fac.salary)}/ay`, 'ob-uyari')}
        ${fac.salaryRange ? _obSatir('Barem', `${formatMoney(fac.salaryRange.min)} - ${formatMoney(fac.salaryRange.max)}`) : ''}
        ${fac.transferFee ? _obSatir('Tazminat', formatMoney(fac.transferFee), 'ob-kritik') : ''}
        ${fac.currentUniversity ? _obSatir('Nereden', fac.currentUniversity) : ''}
        <div class="ob-satir"><span>Katılacağı bölüm</span>${adayBolum.acik
          ? `<b>${adayBolum.ad}</b>`
          : '<b class="ob-uyari" title="Adayın bölümü sizde açık değil">teklifte seçmeniz istenecek</b>'}</div>
      </div>

      ${isHighRated ? `
        <div class="ob-not ob-not--iyi">
          <div class="ob-not-baslik">Bu hocayı alırsanız</div>
          <ul>
            ${pubEstimate   > 0 ? `<li>Araştırma: dönemde yaklaşık <b>+${pubEstimate} yayın</b></li>` : ''}
            ${satEstimate   > 0 ? `<li>Eğitim: öğrenci memnuniyeti <b>+${satEstimate}</b></li>` : ''}
            ${prestEstimate > 0 ? `<li>Saygınlık: <b>+${prestEstimate}</b></li>` : ''}
            ${gradStudents  > 0 ? `<li>Lisansüstü: dönemde <b>+${gradStudents} öğrenci</b></li>` : ''}
          </ul>
        </div>
      ` : ''}

      <div class="ob-kart transfer-teklif">
        <div class="ob-kart-baslik"><span>Teklif</span></div>
        <div class="teklif-satir">
          <label for="offer-salary">Teklif maaşı (₺/ay)</label>
          <input type="number" class="ob-arama" id="offer-salary"
                 value="${fac.askingSalary ?? fac.salary ?? ''}"
                 placeholder="Ör. 180000" min="0" step="5000">
        </div>
        <div class="teklif-satir">
          <label for="offer-research-fund">Araştırma fonu (₺)</label>
          <input type="number" class="ob-arama" id="offer-research-fund"
                 placeholder="Ör. 500000" min="0" step="50000">
        </div>
        <div class="teklif-satir">
          <label for="offer-lab-quality">Laboratuvar kalitesi (0-100)</label>
          <input type="number" class="ob-arama" id="offer-lab-quality"
                 placeholder="0-100" min="0" max="100" step="5">
        </div>
        <label class="teklif-onay">
          <input type="checkbox" id="offer-title-promise">
          Unvan yükseltme sözü
        </label>
        ${_obSatir('İlk ay toplam maliyet', formatMoney(totalCost), 'ob-kritik')}
        <button class="btn btn-success teklif-gonder" id="btn-send-offer" type="button"
                data-faculty-id="${fac.id}">
          Teklif gönder
        </button>
      </div>
    </div>
  `;
}

/**
 * Transfer pazarı penceresi.
 * @param {object}   state   — Oyun durumu
 * @param {Array}    market  — Transfer pazarındaki hoca listesi
 * @param {Function} onOffer — Teklif gönderme callback (facultyId, offer) => void
 * @param {object}   [secenek] v0.6: { bolumId } pazar yalnız bu bölümün adaylarına süzülür (Bölüm Sayfası);
 *                             { onTumPazar } süzülmüş pazarda "Tüm pazarı göster" düğmesinin işi
 */
export function renderTransferMarket(state, market, onOffer, secenek = {}) {
  const depts = state.departments || [];
  let selectedFacultyId = null;
  const tumu   = market || [];
  const bolum  = secenek.bolumId ? depts.find(d => d.id === secenek.bolumId) : null;
  const liste  = bolum ? tumu.filter(f => (f.department ?? f.departmentId) === bolum.id) : tumu;

  // Sol panel: kompakt kart listesi
  const leftCards = liste.map(f => _renderTransferFacultyCard(f, depts, state)).join('');
  const bosMetin = bolum
    ? `Pazarda şu an ${bolum.name} adayı yok.${tumu.length > 0 ? ` Pazardaki ${tumu.length} aday başka bölümlerden.` : ''}`
    : 'Bu dönem transfer pazarında uygun aday yok.';

  const html = `
    <div class="transfer-izgara">
      <!-- Sol: hoca listesi -->
      <div class="transfer-sol">
        <div class="section-title">${bolum ? 'Bu bölümün adayları' : 'Pazardaki hocalar'} <span class="ob-sayi">${bolum ? `${liste.length}/${tumu.length}` : tumu.length}</span></div>
        <div id="transfer-faculty-list" class="transfer-liste">
          ${leftCards || `
            <div class="ob-bos">
              <div class="ob-bos-baslik">${bolum ? 'Bu bölümden aday yok' : 'Pazar boş'}</div>
              ${bosMetin}
              ${bolum && tumu.length > 0 && secenek.onTumPazar
                ? '<button class="btn btn-secondary btn-sm" id="btn-transfer-tum-pazar" type="button">Tüm pazarı göster</button>' : ''}
            </div>
          `}
        </div>
      </div>

      <!-- Sağ: ayrıntı ve teklif formu -->
      <div class="transfer-sagkolon">
        <div class="section-title">Ayrıntı ve teklif</div>
        <div class="transfer-sag" id="transfer-right-panel">
          ${_renderTransferRightPanel(null, depts, state)}
        </div>
      </div>
    </div>
  `;

  showModal(bolum ? `Transfer Pazarı: ${bolum.name}` : 'Transfer Pazarı', html, { wide: true });
  on(el('btn-transfer-tum-pazar'), 'click', () => secenek.onTumPazar?.());

  /** Kartı seçer, sağ paneli çizer ve teklif düğmesini bağlar. */
  const kartSec = (card) => {
    selectedFacultyId = card.dataset.facultyId;
    const fac = tumu.find(f => f.id === selectedFacultyId);
    if (!fac) return;

    // Seçili kart altın çerçeveyle
    qsa('#transfer-faculty-list .transfer-market-card').forEach(c => {
      c.classList.toggle('secili', c.dataset.facultyId === selectedFacultyId);
    });

    // Sağ paneli yenile
    const panel = el('transfer-right-panel');
    if (panel) {
      panel.innerHTML = _renderTransferRightPanel(fac, depts, state);

      // Teklif gönder düğmesi
      on(el('btn-send-offer'), 'click', () => {
        const offer = {
          facultyId:    fac.id,
          salary:       parseInt(el('offer-salary')?.value   || fac.askingSalary || fac.salary || 0),
          researchFund: parseInt(el('offer-research-fund')?.value || 0),
          labQuality:   parseInt(el('offer-lab-quality')?.value   || 0),
          titlePromise: el('offer-title-promise')?.checked || false,
        };
        if (onOffer) onOffer(fac.id, offer);
      });

      // Dar ekranda (tek sütun) ayrıntı listenin altında kalır; seçilince ona kaydır
      const izgara = panel.closest('.transfer-izgara');
      if (izgara && getComputedStyle(izgara).gridTemplateColumns.trim().split(/\s+/).length === 1) {
        panel.closest('.transfer-sagkolon')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    }
  };

  // Hoca kartı tıklama (ya da Enter): sağ paneli güncelle
  delegate(el('transfer-faculty-list'), '.transfer-market-card', 'click', (e, card) => kartSec(card));
  delegate(el('transfer-faculty-list'), '.transfer-market-card', 'keydown', (e, card) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); kartSec(card); }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 8b. KADRO İLANI VER MODAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kadro ilanı verme modalını gösterir.
 * @param {object}   state    — Oyun durumu
 * @param {Function} onSubmit — İlan gönderme callback: (position) => void
 * @param {object}   [secenek] v0.6: { bolumId } bölüm önceden seçili gelir (Bölüm Sayfası)
 */
export function renderOpenPositionModal(state, onSubmit, secenek = {}) {
  const depts      = (state.departments || []).filter(d => d.isOpen);
  const uniType    = state.meta?.universityType ?? 'vakif';
  const scaleMap   = { devlet: SALARY_SCALES.tr_devlet, vakif: SALARY_SCALES.tr_vakif, us_private: SALARY_SCALES.us_private };
  const scale      = scaleMap[uniType] || SALARY_SCALES.tr_vakif;

  // Başlangıç değerleri
  const firstDept  = depts.find(d => d.id === secenek.bolumId) || depts[0];

  const deptOptions = depts.map(d =>
    `<option value="${d.id}"${d === firstDept ? ' selected' : ''}>${d.shortName || d.name}</option>`
  ).join('');
  const firstTitle = 'dr_ogr_uyesi';
  const firstRange = scale[firstTitle] || { min: 28000, max: 55000 };
  const initSalary = Math.round((firstRange.min + firstRange.max) / 2);

  // Alan kutucukları (seçili bölüme göre)
  function _buildFieldCheckboxes(fields) {
    return fields.map(f =>
      `<label class="field-checkbox ilan-alan">
        <input type="checkbox" class="field-cb" value="${f}">
        <span>${f}</span>
      </label>`
    ).join('');
  }
  const firstFields = firstDept ? (DEPARTMENT_FIELDS[firstDept.id] || []) : [];
  const firstFieldCbs = _buildFieldCheckboxes(firstFields);

  const titleOptions = [
    `<option value="argö">Araştırma Görevlisi</option>`,
    `<option value="dr_ogr_uyesi" selected>Dr. Öğr. Üyesi</option>`,
    `<option value="docent">Doçent</option>`,
    `<option value="profesor">Profesör</option>`,
  ].join('');

  const baremMetni = r => `Barem: ${r.min.toLocaleString('tr-TR')} - ${r.max.toLocaleString('tr-TR')} ₺`;

  // v0.6.1: ortak ayar satırları, kaydırıcılar ve bilgi notu (eskiden mavi kutular, tarayıcının mavi kaydırıcısı)
  const html = `
    <div class="pencere-yigin">
      <div class="ob-iki ilan-secimler">
        <div>
          <label class="ob-ayar-e" for="pos-dept">Bölüm</label>
          <select class="filter-select ob-secim ob-secim--tam" id="pos-dept">${deptOptions}</select>
        </div>
        <div>
          <label class="ob-ayar-e" for="pos-title">Unvan</label>
          <select class="filter-select ob-secim ob-secim--tam" id="pos-title">${titleOptions}</select>
        </div>
      </div>

      <div>
        <div class="ob-ayar-e">Aranan alanlar</div>
        <div id="pos-field-container" class="field-selection ilan-alanlar">
          <label class="field-checkbox field-checkbox--all ilan-hepsi">
            <input type="checkbox" id="field-all" checked>
            <span>Tüm alanlar</span>
          </label>
          <div id="pos-field-list" class="ilan-alan-listesi ilan-alan-listesi--kapali">
            ${firstFieldCbs}
          </div>
        </div>
      </div>

      <div class="ob-kart">
        <div class="ob-ayar">
          <label class="ob-ayar-e" for="pos-salary-slider">Maaş teklifi (aylık)</label>
          <input type="range" id="pos-salary-slider" class="ob-kaydirici"
                 min="${firstRange.min}" max="${Math.round(firstRange.max * 1.5)}"
                 step="1000" value="${initSalary}">
          <div class="ob-ayar-d" id="pos-salary-display">${initSalary.toLocaleString('tr-TR')} ₺/ay</div>
          <div class="ob-aciklama ilan-barem" id="pos-salary-range-label">${baremMetni(firstRange)}</div>
        </div>
        <div class="ob-ayar">
          <label class="ob-ayar-e" for="pos-fund-slider">Araştırma fonu (dönemlik)</label>
          <input type="range" id="pos-fund-slider" class="ob-kaydirici" min="0" max="2000000" step="50000" value="0">
          <div class="ob-ayar-d" id="pos-fund-display">0 ₺</div>
        </div>
        <label class="teklif-onay ilan-lab">
          <input type="checkbox" id="pos-lab">
          Özel laboratuvar alanı sağlanacak
        </label>
      </div>

      <!-- Tahmini başvuru -->
      <div id="pos-estimate" class="ob-not">
        Maaş ve koşulları belirleyin; tahmini başvuru sayısı burada görünecek.
      </div>

      <div class="onay-dugmeler">
        <button type="button" class="btn btn-secondary" id="btn-pos-cancel">İptal</button>
        <button type="button" class="btn btn-primary" id="btn-pos-submit">İlan ver</button>
      </div>
    </div>
  `;

  showModal('Kadro İlanı Ver', html);

  /** "Tüm alanlar" seçiliyken tek tek alan kutucukları kapalı (soluk, tıklanmaz). */
  const alanListesiniAyarla = () => {
    const allCb     = el('field-all');
    const fieldList = el('pos-field-list');
    if (fieldList) fieldList.classList.toggle('ilan-alan-listesi--kapali', !!(allCb && allCb.checked));
  };

  // Dinamik hesaplama
  function _updateEstimate() {
    const deptId    = el('pos-dept')?.value || '';
    const titleVal  = el('pos-title')?.value || 'dr_ogr_uyesi';
    const salary    = parseInt(el('pos-salary-slider')?.value || 0);
    const fund      = parseInt(el('pos-fund-slider')?.value  || 0);
    const range     = scale[titleVal] || { min: 28000, max: 55000 };
    const mid       = (range.min + range.max) / 2;
    const salaryRatio = salary / mid;

    // Alan listesini güncelle (bölüm değişince)
    const fieldList = el('pos-field-list');
    if (fieldList && deptId) {
      const fields = DEPARTMENT_FIELDS[deptId] || [];
      fieldList.innerHTML = _buildFieldCheckboxes(fields);
      alanListesiniAyarla();
    }

    // Barem etiketini güncelle
    const rangeLabel = el('pos-salary-range-label');
    if (rangeLabel) rangeLabel.textContent = baremMetni(range);
    const slider = el('pos-salary-slider');
    if (slider) { slider.min = range.min; slider.max = Math.round(range.max * 1.5); }

    const prestige = state.university?.prestige ?? state.prestige ?? 30;
    const baseCnt  = salaryRatio >= 1.2 ? '4-6' : salaryRatio >= 1.0 ? '2-4' : salaryRatio >= 0.8 ? '0-2' : '0';
    const quality  = salaryRatio >= 1.2 ? 'iyi kalite' : salaryRatio >= 1.0 ? 'orta kalite' : 'düşük kalite';
    const fundNote = fund > 0 ? ', araştırma odaklı adaylar' : '';
    const presNote = prestige >= 60 ? ', yüksek saygınlık çekiciliği' : '';
    const tur      = salaryRatio >= 1.0 ? 'iyi' : salaryRatio >= 0.8 ? 'uyari' : 'kritik';

    const estimateEl = el('pos-estimate');
    if (estimateEl) {
      estimateEl.className = `ob-not ob-not--${tur}`;
      estimateEl.innerHTML = `
        <div class="ob-not-baslik">Tahmini başvuru</div>
        <p>Bu koşullarla <b>yaklaşık ${baseCnt} aday</b> bekleniyor (1-2 dönem içinde).</p>
        <p class="ob-soluk">Beklenen nitelik: ${quality}${fundNote}${presNote}</p>
        <p class="ob-${tur}">${salaryRatio >= 1.2 ? 'Maaş baremin üstünde: daha çok ve daha iyi aday gelir.' :
          salaryRatio >= 1.0 ? 'Maaş barem içinde: olağan talep.' :
          'Maaş baremin altında: az ya da zayıf aday gelir.'}</p>
      `;
    }
  }

  // Kaydırıcılar
  on(el('pos-salary-slider'), 'input', () => {
    const v = el('pos-salary-slider')?.value;
    const disp = el('pos-salary-display');
    if (disp) disp.textContent = `${parseInt(v).toLocaleString('tr-TR')} ₺/ay`;
    _updateEstimate();
  });
  on(el('pos-fund-slider'), 'input', () => {
    const v = el('pos-fund-slider')?.value;
    const disp = el('pos-fund-display');
    if (disp) disp.textContent = `${parseInt(v).toLocaleString('tr-TR')} ₺`;
    _updateEstimate();
  });
  on(el('pos-dept'),  'change', _updateEstimate);
  on(el('pos-title'), 'change', () => {
    const titleVal = el('pos-title')?.value || 'dr_ogr_uyesi';
    const range = scale[titleVal] || { min: 28000, max: 55000 };
    const mid   = Math.round((range.min + range.max) / 2);
    const slider = el('pos-salary-slider');
    if (slider) { slider.min = range.min; slider.max = Math.round(range.max * 1.5); slider.value = mid; }
    const disp = el('pos-salary-display');
    if (disp) disp.textContent = `${mid.toLocaleString('tr-TR')} ₺/ay`;
    _updateEstimate();
  });

  // "Tüm alanlar" kutucuğu: tek tek alan kutucuklarını açar ya da kapatır
  on(el('field-all'), 'change', alanListesiniAyarla);

  on(el('btn-pos-cancel'), 'click', hideModal);
  on(el('btn-pos-submit'), 'click', () => {
    const allCb    = el('field-all');
    const allFields = allCb ? allCb.checked : true;
    const selectedFields = allFields
      ? []
      : qsa('#pos-field-list .field-cb:checked').map(cb => cb.value);

    if (!allFields && selectedFields.length === 0) {
      showNotification('Lütfen en az bir alan seçin.', 'warning');
      return;
    }

    const position = {
      id:            `pos_${Date.now()}`,
      department:    el('pos-dept')?.value || '',
      title:         el('pos-title')?.value || 'dr_ogr_uyesi',
      fields:        selectedFields,
      allFields:     allFields,
      // Geriye dönük uyumluluk için field alanını da doldur
      field:         allFields ? 'Tüm Alanlar' : selectedFields.join(', '),
      offeredSalary: parseInt(el('pos-salary-slider')?.value || 0),
      researchFund:  parseInt(el('pos-fund-slider')?.value  || 0),
      hasLab:        el('pos-lab')?.checked || false,
      postedTurn:    state.meta?.turn ?? 1,
    };
    if (!position.department) {
      showNotification('Lütfen bir bölüm seçin.', 'warning');
      return;
    }
    hideModal();
    if (onSubmit) onSubmit(position);
  });

  // İlk hesap
  _updateEstimate();
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. DÖNEM SONU ÖZET
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dönem sonu özet kartlarını göster.
 * @param {object}   summary     — Dönem özeti objesi
 * @param {Function} onNextTurn  — "Sonraki Dönem" callback
 */
export function renderTurnSummary(summary, onNextTurn) {
  const bodyEl  = el('summary-modal-body');
  const titleEl = el('summary-modal-title');
  const overlay = el('turn-summary-overlay');
  if (!bodyEl || !overlay) return;

  const meta = summary.meta || {};
  if (titleEl) {
    const sem = meta.semester === 'güz'   ? 'Güz'
              : meta.semester === 'bahar' ? 'Bahar'
              : '';
    const yil = (typeof meta.year === 'number' && meta.year > 0) ? `${meta.year}. Yıl ` : '';
    const baslik = (yil || sem)
      ? `${yil}${sem}${sem ? ' Dönemi ' : ''}Özeti`.replace(/\s+/g, ' ').trim()
      : 'Dönem Özeti';
    titleEl.textContent = baslik;
  }

  const fin   = summary.financial || {};
  const acad  = summary.academic  || {};
  const stud  = summary.students  || {};
  const events = summary.events   || [];
  const projApps = summary.projectApplications || null;

  // v0.5.2: saygınlık dökümü (varsa): "51 → 52 (kalite +0,7 · olaylar +0,3)"
  const dokum = summary.prestigeBreakdown || acad.prestigeBreakdown || null;
  const sayginlikDokumu = (dokum && Number.isFinite(Number(dokum.onceki)) && Number.isFinite(Number(dokum.sonraki)))
    ? `${Math.round(dokum.onceki)} → ${Math.round(dokum.sonraki)}`
      + ((dokum.kalite != null || dokum.olay != null)
        ? ` (kalite ${isaretliYaz(dokum.kalite ?? 0)} · olaylar ${isaretliYaz(dokum.olay ?? 0)})`
        : '')
    : null;

  // v0.6.1: satırlar ortak .ob-satir; "summary-row" ve "summary-row-dokum" sınamaların okuduğu işaret olarak kalır
  const satir = (ad, deger, sinif = '', ek = '') =>
    `<div class="ob-satir summary-row${ek ? ` ${ek}` : ''}"><span>${ad}</span><b${sinif ? ` class="${sinif}"` : ''}>${deger}</b></div>`;
  const kart = (ikon, baslik, icerik, ek = '') => `
    <article class="ob-kart ozet-kart${ek ? ` ${ek}` : ''}">
      <div class="ob-kart-baslik"><span class="ozet-baslik"><span class="ozet-ikon" aria-hidden="true">${ikon}</span>${baslik}</span></div>
      ${icerik}
    </article>`;

  const net = fin.net ?? 0;
  const maliKart = kart('💰', 'Mali durum', `
    ${satir('Toplam gelir', formatMoney(fin.revenue ?? 0), 'ob-iyi')}
    ${satir('Toplam gider', _eksiPara(fin.costs ?? 0), 'ob-kritik')}
    ${satir('Net değişim', `${net >= 0 ? '+' : ''}${formatMoney(net)}`, net >= 0 ? 'ob-iyi' : 'ob-kritik', 'ob-satir--toplam')}
    ${satir('Kasa', formatMoney(fin.newBudget ?? 0))}`);

  const projeGeliri = (fin.projectOverhead ?? 0) + (fin.patentRoyalties ?? 0);
  const projeKart = projeGeliri > 0 ? kart('💼', 'Proje gelirleri', `
    ${(fin.projectOverhead ?? 0) > 0 ? satir('Genel gider kesintisi', formatMoney(fin.projectOverhead), 'ob-iyi') : ''}
    ${(fin.patentRoyalties ?? 0) > 0 ? satir('Patent telifleri', formatMoney(fin.patentRoyalties), 'ob-iyi') : ''}
    ${satir('Toplam', formatMoney(projeGeliri), 'ob-iyi', 'ob-satir--toplam')}`) : '';

  const prestijDelta = acad.prestigeDelta ?? 0;
  const akademikKart = kart('🎓', 'Akademik gelişme', `
    ${satir('Saygınlık değişimi', isaretliYaz(prestijDelta), prestijDelta >= 0 ? 'ob-iyi' : 'ob-kritik')}
    ${sayginlikDokumu ? `<div class="ob-aciklama summary-row-dokum ozet-dokum">${sayginlikDokumu}</div>` : ''}
    ${satir('Sıralama', `#${acad.newRanking ?? '—'}${acad.rankingDelta ? ` <span class="ob-soluk">(${acad.rankingDelta > 0 ? '+' : ''}${acad.rankingDelta})</span>` : ''}`)}
    ${satir('Yeni yayın', formatNumber(acad.newPublications ?? 0), 'ob-iyi')}
    ${satir('Hoca memnuniyeti', `${tamPuan(acad.avgFacultyHappiness)}<span class="ob-soluk">/100</span>`)}`);

  const ayrilan = (stud.dropouts ?? 0) + (stud.transferOut ?? 0);
  const ogrenciKart = kart('👩‍🎓', 'Öğrenci hareketleri', `
    ${satir('Yeni kayıt', formatNumber(stud.newAdmissions ?? 0), 'ob-iyi')}
    ${satir('Mezun', formatNumber(stud.graduates ?? 0), 'ob-iyi')}
    ${satir('Ayrılan', formatNumber(ayrilan), ayrilan > 0 ? 'ob-kritik' : '')}
    <div class="ob-aciklama ozet-dokum">başarısızlık ${stud.failDropouts ?? 0} · bırakma ${stud.dissatisfiedDropouts ?? 0} · yatay geçişle giden ${stud.transferOut ?? 0}</div>
    ${satir('Yatay geçişle gelen', `+${stud.transferIn ?? 0}`, 'ob-iyi')}
    ${satir('Ortalama memnuniyet', `${tamPuan(stud.avgSatisfaction)}<span class="ob-soluk">/100</span>`)}`);

  // Olaylar: yalnız açıklaması olanlar (EfekanSalman Issue #21); yıldız öğrenci olayları ayrı kartta (iki kez görünüyordu)
  // v0.7: başkanların kararları olay listesinde değil, aşağıdaki katlanır bölümde
  const validEvents = events.filter(ev => ev.type !== 'baskan_kararlari' && !!(ev.description || ev.message || ev.title));
  const olaylarKart = (() => {
    const otherEvents = validEvents.filter(ev => !_YILDIZ_OGRENCI_OLAYLARI.includes(ev.type));
    const starEvents  = otherEvents.filter(ev => ev.type === 'star_faculty_hired');
    const shownEvents = [...starEvents, ...otherEvents.filter(ev => !starEvents.includes(ev))].slice(0, 8);
    const yildizVar   = validEvents.some(ev => _YILDIZ_OGRENCI_OLAYLARI.includes(ev.type));
    const icerik = shownEvents.length === 0
      ? `<div class="ob-aciklama">${yildizVar ? 'Bu dönemin öne çıkanları yıldız öğrenci başarıları.' : 'Bu dönemde önemli bir olay yaşanmadı.'}</div>`
      : `<ul class="ozet-olaylar">${shownEvents.map(ev => {
          const isStarFaculty = ev.type === 'star_faculty_hired';
          // Açıklama kendi emojisiyle başlıyorsa ikon odur (iki ikon yan yana çıkmasın)
          const metin = _veriMetni(ev.description || ev.message || ev.title);
          const bastaki = metin.match(/^([^\p{L}\p{N}\s"'(]+)\s+/u);
          const icon = bastaki ? bastaki[1]
            : isStarFaculty ? '🌟' : ev.type === 'construction_complete' ? '🏗' : ev.type === 'research_complete' ? '📄' : '📣';
          return `
            <li class="ozet-olay${isStarFaculty ? ' ozet-olay--yildiz' : ''}">
              <span class="ozet-olay-ikon" aria-hidden="true">${icon}</span>
              <span class="ozet-olay-metin">${bastaki ? metin.slice(bastaki[0].length) : metin}</span>
              ${(ev.prestigeBonus ?? 0) > 0 ? `<span class="ob-rozet ob-rozet--iyi ob-rozet--kucuk">${isaretliYaz(ev.prestigeBonus)} saygınlık</span>` : ''}
            </li>`;
        }).join('')}</ul>`;
    return kart('📣', 'Bu dönemin olayları', icerik);
  })();

  // Yıldız öğrenci başarıları
  const yildizKart = (() => {
    const starAchievements = validEvents.filter(ev => _YILDIZ_OGRENCI_OLAYLARI.includes(ev.type));
    if (starAchievements.length === 0) return '';
    return kart('⭐', 'Yıldız öğrenci başarıları', `
      <ul class="ozet-olaylar">${starAchievements.map(ev => `
        <li class="ozet-olay">
          <span class="ozet-olay-metin">${_veriMetni(ev.description || ev.message || ev.title)}</span>
          ${(ev.prestigeBonus ?? 0) > 0 ? `<span class="ob-rozet ob-rozet--iyi ob-rozet--kucuk">${isaretliYaz(ev.prestigeBonus)} saygınlık</span>` : ''}
        </li>`).join('')}</ul>`, 'ozet-kart--altin');
  })();

  // Proje başvuru sonuçları (Araştırma sekmesindeki başvuru tablosuyla aynı dil)
  const projeKarti = (() => {
    if (!projApps || projApps.total === 0) return '';
    const accepted = projApps.accepted || [];
    const rejected = projApps.rejected || [];
    const hepsi = [
      ...accepted.map(a => ({ ...a, kabul: true })),
      ...rejected.map(r => ({ ...r, kabul: false })),
    ];
    // Uzun listede önce ilk 10 satır (Bölüm Sayfası'ndaki gibi), "Tümünü göster" ile hepsi
    const satirlar = hepsi.map((p, i) => `
      <tr${i >= _BS_LISTE_SINIRI ? ' class="ozet-fazla"' : ''}>
        <td>${p.kabul ? '<span class="ob-rozet ob-rozet--iyi ob-rozet--kucuk">Kabul</span>' : '<span class="ob-rozet ob-rozet--kritik ob-rozet--kucuk">Red</span>'}</td>
        <td class="ob-ad">${p.projectName}</td>
        <td class="ob-tek">${p.facultyName}</td>
        <td class="ob-tek">${p.callIcon || '📋'} ${p.callType}</td>
        <td class="n ob-tek">${formatMoney(p.requestedFunding)}</td>
        <td class="n ob-tek">${p.kabul && p.duration ? `${p.duration} dönem` : '<span class="ob-soluk">—</span>'}</td>
      </tr>`).join('');
    return `
      <section class="ob-bolum ozet-projeler">
        <div class="section-title">Bu dönemin proje başvuruları</div>
        <div class="ob-dizi ozet-proje-sayilar">
          <span class="ob-rozet">Toplam ${projApps.total}</span>
          <span class="ob-rozet ob-rozet--iyi">Kabul ${accepted.length}</span>
          <span class="ob-rozet ob-rozet--kritik">Red ${rejected.length}</span>
        </div>
        ${satirlar ? `
        <div class="ob-tablo-kap">
          <table class="ob-tablo">
            <thead><tr><th>Sonuç</th><th>Proje</th><th>Yürütücü</th><th>Çağrı</th><th class="n">Tutar</th><th class="n">Süre</th></tr></thead>
            <tbody>${satirlar}</tbody>
          </table>
        </div>` : ''}
        ${hepsi.length > _BS_LISTE_SINIRI ? `<button type="button" class="bs-link bs-link--kucuk ozet-tumu" data-adet="${hepsi.length}">Tümünü göster (${hepsi.length})</button>` : ''}
      </section>`;
  })();

  // v0.7: başkana devredilen bölümlerde başkanların bu dönemki kararları (katlanır; devir sona erdiyse açık gelir)
  const baskanKarti = (() => {
    const kayit    = events.find(ev => ev.type === 'baskan_kararlari');
    const bolumler = Array.isArray(kayit?.bolumler) ? kayit.bolumler : [];
    if (bolumler.length === 0) return '';
    const say = (...turler) => bolumler.reduce((s, b) => s + (b.kararlar || []).filter(k => turler.includes(k.tur)).length, 0);
    const rozetler = [
      [say('kabul'), 'hoca alındı', 'iyi'], [say('ilan'), 'ilan', 'bilgi'], [say('kontenjan'), 'kontenjan', ''],
      [say('zorluk'), 'zorluk ayarı', ''], [say('bap', 'proje'), 'araştırma onayı', 'iyi'], [say('uyari'), 'uyarı', 'kritik'],
    ].filter(([n]) => n > 0)
      .map(([n, ad, sinif]) => `<span class="ob-rozet ob-rozet--kucuk${sinif ? ` ob-rozet--${sinif}` : ''}">${n} ${ad}</span>`).join('');
    const acik = say('uyari') > 0;
    return `
      <details class="ob-kart ozet-baskan"${acik ? ' open' : ''}>
        <summary class="ozet-baskan-ozet">
          <span class="ozet-baslik"><span class="ozet-ikon" aria-hidden="true">🏛️</span>Başkanların kararları</span>
          <span class="ob-dizi"><span class="ob-rozet ob-rozet--kucuk">${bolumler.length} bölüm</span>${rozetler}</span>
        </summary>
        <div class="ozet-baskan-govde">
          ${bolumler.map(b => `
            <section class="ozet-baskan-bolum" data-bolum="${b.deptId}">
              <div class="ozet-baskan-ust">
                <div class="ozet-baskan-kimlik">
                  <b>${_escHtml(b.ad || b.deptId)}</b>
                  <span class="ob-aciklama">${b.baskan ? `Başkan ${_escHtml(b.baskan)}${Number.isFinite(b.yonetim) ? `, yönetim ${Math.round(b.yonetim)}` : ''} · ` : ''}odak ${(ODAKLAR[b.odak]?.ad || '').toLocaleLowerCase('tr')}</span>
                </div>
                <div class="ob-dugmeler">
                  <button type="button" class="bs-link bs-link--kucuk" data-ozet-bolum="${b.deptId}">Bölüm Sayfası →</button>
                  ${b.devirde ? `<button type="button" class="btn btn-secondary btn-xs" data-ozet-dogrudan="${b.deptId}">Doğrudan yönetime al</button>` : ''}
                </div>
              </div>
              ${_baskanKararListesi(b.kararlar)}
            </section>`).join('')}
        </div>
      </details>`;
  })();

  bodyEl.innerHTML = `
    <div class="pencere-yigin">
      <div class="ozet-izgara">
        ${maliKart}
        ${projeKart}
        ${akademikKart}
        ${ogrenciKart}
        ${olaylarKart}
        ${yildizKart}
      </div>
      ${baskanKarti}
      ${projeKarti}
    </div>
  `;

  // Proje başvuruları: "Tümünü göster" / "İlk 10'u göster"
  const tumuDugmesi = bodyEl.querySelector('.ozet-tumu');
  if (tumuDugmesi) {
    tumuDugmesi.addEventListener('click', () => {
      const bolum = tumuDugmesi.closest('.ozet-projeler');
      const acik  = bolum.classList.toggle('ozet-projeler--acik');
      tumuDugmesi.textContent = acik ? `İlk ${sayiEkle(_BS_LISTE_SINIRI, 'i')} göster` : `Tümünü göster (${tumuDugmesi.dataset.adet})`;
    });
  }

  // v0.5.2: "Devam" düğmesi pencerenin altında yapışkan alt çubukta (içerik kaysa da görünür)
  let altCubuk = el('summary-modal-footer');
  if (!altCubuk) {
    altCubuk = document.createElement('div');
    altCubuk.id = 'summary-modal-footer';
    altCubuk.className = 'summary-modal-footer';
    bodyEl.after(altCubuk);
  }
  altCubuk.innerHTML = `
    <button class="btn btn-primary" id="btn-confirm-next-turn" type="button">Devam</button>`;

  overlay.classList.remove('hidden');
  overlay.classList.add('active');
  if (bodyEl.scrollTo) bodyEl.scrollTo({ top: 0, behavior: 'instant' }); else bodyEl.scrollTop = 0;

  // Devam, Esc ve arka plana tıklama aynı geri çağrıyı bir kez çalıştırır
  let kapandi = false;
  const kapat = () => {
    if (kapandi) return;
    kapandi = true;
    if (_ozetiKapat === kapat) _ozetiKapat = null;
    overlay.classList.add('hidden');
    overlay.classList.remove('active');
    overlay.onclick = null;
    if (onNextTurn) onNextTurn();
  };
  _ozetiKapat = kapat;
  on(el('btn-confirm-next-turn'), 'click', kapat);

  // v0.7: başkanların kararları: bölümün sayfasına git (özet Devam gibi kapanır) ya da hemen doğrudan yönetime al
  bodyEl.querySelectorAll('[data-ozet-bolum]').forEach(dugme => {
    dugme.addEventListener('click', () => {
      const id = dugme.dataset.ozetBolum;
      kapat();
      window._openDeptPage?.(id);
    });
  });
  bodyEl.querySelectorAll('[data-ozet-dogrudan]').forEach(dugme => {
    dugme.addEventListener('click', () => {
      const sonuc = window._onSetDeptPolicy?.(dugme.dataset.ozetDogrudan, { kip: 'dogrudan' });
      if (sonuc?.success) {
        dugme.disabled = true;
        dugme.textContent = 'Doğrudan yönetimde';
      }
    });
  });
  overlay.onclick = (e) => {
    if (e.target === overlay || e.target.classList?.contains('modal-backdrop')) kapat();
  };
  el('btn-confirm-next-turn')?.focus({ preventScroll: true });
}

/** Açık dönem özetini kapatan işlev (Devam ile aynı); özet kapalıysa null. */
let _ozetiKapat = null;

/**
 * Dönem özeti açıksa "Devam" ile aynı biçimde kapatır (Esc için).
 * @returns {boolean} özet açıktı ve kapandıysa true
 */
export function dismissTurnSummary() {
  if (!_ozetiKapat) return false;
  _ozetiKapat();
  return true;
}

// Yıldız öğrenci olay türleri (dönem özetinde ayrı kartta yazılır)
const _YILDIZ_OGRENCI_OLAYLARI = ['star_student_competition', 'star_student_publication', 'star_student_graduated'];

// ─────────────────────────────────────────────────────────────────────────────
// 10. OLAY EKRANI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Olay/karar ekranını render et.
 * @param {object}   event        — Olay objesi
 * @param {Function} onChoice     — Seçenek seçme callback (choiceIndex alır)
 * @param {Function} onSkip       — Atlama callback
 */
export function renderEvent(event, onChoice, onSkip) {
  if (!event) return;

  const categoryEl   = el('event-category');
  const titleEl      = el('event-title');
  const descEl       = el('event-description');
  const detailEl     = el('event-details');
  const choicesEl    = el('event-choices');
  const footerInfoEl = el('event-footer-info');

  if (categoryEl) categoryEl.textContent = event.category || 'Olay';
  if (titleEl)    titleEl.textContent    = event.title || 'Başlık';
  if (descEl)     descEl.textContent     = event.description || '';

  if (detailEl) {
    detailEl.innerHTML = event.details
      ? `<div>${event.details}</div>`
      : '';
    detailEl.style.display = event.details ? 'block' : 'none';
  }

  if (choicesEl) {
    const choices = event.choices || [];
    if (choices.length > 0) {
      choicesEl.innerHTML = choices.map((c, i) => `
        <button class="event-choice-btn" data-choice-index="${i}">
          <span class="event-choice-key">${String.fromCharCode(65 + i)}</span>
          <div class="event-choice-content">
            <div class="event-choice-label">${c.label || c.text || 'Seçenek'}</div>
            ${c.description ? `<div class="event-choice-desc">${c.description}</div>` : ''}
            ${c.effects && c.effects.length > 0 ? `
              <div class="event-choice-effects">
                ${c.effects.map(ef => `
                  <span class="effect-tag ${ef.type || 'neu'}">${ef.label}</span>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </button>
      `).join('');
    } else {
      choicesEl.innerHTML = `
        <button class="btn btn-primary" id="btn-event-ok" style="width:100%;justify-content:center;">
          Tamam
        </button>
      `;
      on(el('btn-event-ok'), 'click', () => {
        if (onChoice) onChoice(0);
        showScreen('screen-game');
      });
    }
  }

  if (footerInfoEl && event.turnDeadline) {
    footerInfoEl.textContent = `Karar son tarihi: Tur ${event.turnDeadline}`;
  }

  // Seçenek buton eventleri
  delegate(el('event-choices'), '.event-choice-btn', 'click', (e, btn) => {
    const idx = parseInt(btn.dataset.choiceIndex);
    if (onChoice) onChoice(idx);
    showScreen('screen-game');
  });

  // Atlama
  const skipBtn = el('btn-event-skip');
  if (skipBtn) {
    skipBtn.style.display = event.skippable === false ? 'none' : '';
    on(skipBtn, 'click', () => {
      if (onSkip) onSkip();
      showScreen('screen-game');
    });
  }

  showScreen('screen-event');
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. TOAST BİLDİRİM
// ─────────────────────────────────────────────────────────────────────────────

const NOTIFICATION_ICONS = {
  success: '✓',
  warning: '⚠',
  danger:  '✕',
  info:    'ℹ',
};

/**
 * Toast bildirim göster.
 * @param {string} message  — Bildirim metni
 * @param {string} type     — 'success' | 'warning' | 'danger' | 'info'
 * @param {number} duration — Görünme süresi ms (varsayılan 3500)
 */
export function showNotification(message, type = 'info', duration = 3500) {
  const container = el('toast-container');
  if (!container) return;

  const icon = NOTIFICATION_ICONS[type] || 'ℹ';
  const div  = document.createElement('div');
  div.className = `notification ${type}`;
  div.innerHTML = `
    <span class="notification-icon">${icon}</span>
    <span class="notification-text">${message}</span>
    <button class="notification-close">✕</button>
  `;

  container.appendChild(div);

  // Kapatma butonu
  div.querySelector('.notification-close')?.addEventListener('click', () => _removeToast(div));

  // Otomatik kaldır
  setTimeout(() => _removeToast(div), duration);
}

function _removeToast(div) {
  div.classList.add('fadeout');
  setTimeout(() => div.remove(), 300);
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI UI BİLEŞENLERİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stat çubuğu HTML'i döndür.
 * @param {string}  label     — Etiket metni
 * @param {number}  value     — Değer (0-max)
 * @param {number}  max       — Maksimum değer
 * @param {string}  color     — CSS rengi veya 'auto' (değere göre otomatik)
 * @param {boolean} uncertain — Belirsizlik modu
 * @param {string}  displayVal — Gösterilecek değer (ör. "40-60")
 * @returns {string} HTML string
 */
export function createStatBar(label, value, max = 100, color = 'auto', uncertain = false, displayVal = null) {
  const pct   = Math.min(100, Math.max(0, (value / max) * 100));
  const shown = displayVal !== null ? displayVal : Math.round(value);
  // v0.6.1: renk kademesi sınıfla (theme.css .stat-bar-fill--* / .stat-bar-value--*), satır içi renk yok.
  // Kademeler _statColor ile aynı (85 altın, 70 iyi, 40 orta); _statColor dışında bir renk verilirse o kullanılır.
  const kademe   = value >= 85 ? 'altin' : value >= 70 ? 'iyi' : value >= 40 ? 'orta' : 'dusuk';
  const ozelRenk = !uncertain && color !== 'auto' && color !== _statColor(value);
  const dolgu    = uncertain ? 'uncertain' : ozelRenk ? '' : `stat-bar-fill--${kademe}`;

  return `
    <div class="stat-bar">
      <div class="stat-bar-label">${label}</div>
      <div class="stat-bar-track">
        <div class="stat-bar-fill ${dolgu}" style="width:${pct}%;${ozelRenk ? `background:${color};` : ''}"></div>
      </div>
      <div class="stat-bar-value stat-bar-value--${uncertain ? 'belirsiz' : kademe}">
        ${shown}
      </div>
    </div>
  `;
}

/**
 * Yıldız derecelendirmesi (v0.6.1): yıldız karakteri yerine ortak puan göstergesi (_obPuan, theme.css .ob-puan).
 * @param {number} filled — Dolu sayısı
 * @param {number} total  — Toplam
 * @returns {string} HTML string
 */
export function createStarRating(filled, total = 5) {
  return _obPuan(filled, total);
}

/**
 * Dairesel ilerleme (SVG) HTML'i döndür.
 * @param {number} value   — Değer
 * @param {number} max     — Maksimum değer
 * @param {string} label   — Alt etiket
 * @param {number} size    — SVG boyutu (px)
 * @returns {string} HTML string
 */
export function createProgressRing(value, max = 100, label = '', size = 80) {
  const radius      = (size / 2) - 8;
  const circumf     = 2 * Math.PI * radius;
  const pct         = Math.min(1, Math.max(0, value / max));
  const dashOffset  = circumf * (1 - pct);

  return `
    <div class="progress-ring-wrapper" style="width:${size}px;height:${size}px;">
      <svg class="progress-ring" width="${size}" height="${size}">
        <circle class="progress-ring-track" cx="${size/2}" cy="${size/2}" r="${radius}" stroke-width="6"/>
        <circle class="progress-ring-fill" cx="${size/2}" cy="${size/2}" r="${radius}" stroke-width="6"
                stroke-dasharray="${circumf}" stroke-dashoffset="${dashOffset}"/>
      </svg>
      <div class="progress-ring-label">
        <span class="progress-ring-value">${Math.round(value)}</span>
        ${label ? `<span class="progress-ring-sublabel">${label}</span>` : ''}
      </div>
    </div>
  `;
}

/**
 * Mini sparkline (SVG) HTML'i döndür.
 * @param {number[]} data   — Değer dizisi
 * @param {number}   width  — SVG genişliği
 * @param {number}   height — SVG yüksekliği
 * @param {string}   color  — Çizgi rengi
 * @returns {string} HTML string
 */
export function createSparkline(data, width = 80, height = 28, color = '#4ecca3') {
  if (!data || data.length < 2) return '';

  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const range  = Math.max(1, maxVal - minVal);

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - minVal) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const lastPt = pts.split(' ').pop().split(',');

  return `
    <svg class="sparkline" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <polyline class="sparkline-polyline" points="${pts}" stroke="${color}" style="stroke:${color}"/>
      <circle cx="${parseFloat(lastPt[0])}" cy="${parseFloat(lastPt[1])}" r="2" fill="${color}"/>
    </svg>
  `;
}

/**
 * Basit pasta grafik (SVG) HTML'i döndür.
 * @param {Array<{label,value,color}>} slices — Dilimler
 * @param {number} size — SVG boyutu
 * @returns {string} HTML string
 */
export function createPieChart(slices, size = 120) {
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) return '';

  const cx = size / 2;
  const cy = size / 2;
  const r  = size / 2 - 4;

  let startAngle = -Math.PI / 2;
  const paths = slices.map(sl => {
    const angle = (sl.value / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;

    const path = `M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${largeArc},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z`;
    startAngle = endAngle;

    return `<path d="${path}" fill="${sl.color}" opacity="0.9"/>`;
  }).join('');

  const legend = slices.map(sl => `
    <div class="pie-legend-item">
      <div class="pie-legend-color" style="background:${sl.color}"></div>
      <div class="pie-legend-label">${sl.label}</div>
      <div class="pie-legend-value">${formatPercent(sl.value)}</div>
    </div>
  `).join('');

  return `
    <div class="pie-chart-wrapper">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        ${paths}
        <circle cx="${cx}" cy="${cy}" r="${r * 0.45}" fill="var(--bg-card)"/>
      </svg>
      <div class="pie-legend">${legend}</div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// İÇ YARDIMCILAR (export edilmez)
// ─────────────────────────────────────────────────────────────────────────────

/** Stat değerine göre CSS rengi; createStatBar bu rengi görünce kademe sınıfını kullanır (satır içi renk yazmaz) */
function _statColor(val) {
  if (val >= 85) return '#d4af37';
  if (val >= 70) return 'var(--stat-high)';
  if (val >= 40) return 'var(--stat-mid)';
  return 'var(--stat-low)';
}

/** Memnuniyet için renk */
function _satColor(sat) {
  if (sat >= 70) return 'var(--accent-green)';
  if (sat >= 45) return 'var(--accent-yellow)';
  return 'var(--accent)';
}

/** Kalite yüzdesini renkli çubuk simgesiyle göster */
function _qualityBar(val) {
  const color = _statColor(val);
  return `<span style="color:${color};font-weight:700;font-size:12px;">${val}</span>`;
}

/**
 * Genel Bakış "Bu Dönem Tahmini": Bütçe sekmesiyle aynı hesap (calculateIncome/calculateExpenses).
 * Kalem adları üniversite tipine göre (devlette harç yok, YÖK tahsisi var).
 * @returns {{ gelirler: {ad, tutar}[], giderler: {ad, tutar}[], gelir: number, gider: number, net: number }}
 */
/**
 * v0.7: gelir ve gider ayrıntısı zorluk çarpanlarıyla (dönem sonunda calculateEconomy'nin
 * kasaya yazacağı tutarlar). Eskiden Bütçe sekmesi ve Genel Bakış çarpansız tutar gösteriyordu.
 */
function _zorlukluGelirGider(state) {
  const d  = DIFFICULTY_SETTINGS[state.meta?.difficulty || 'normal'] || DIFFICULTY_SETTINGS.normal;
  const gc = d.incomeMultiplier ?? 1;
  const xc = d.expenseMultiplier ?? 1;
  const olcekle = (o, c) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) =>
    [k, (typeof v === 'number' && !k.startsWith('_')) ? Math.round(v * c) : v]));
  return { incomeDetail: olcekle(calculateIncome(state), gc), expenseDetail: olcekle(calculateExpenses(state), xc) };
}

function _donemTahmini(state) {
  let gelir = null, gider = null;
  try {
    ({ incomeDetail: gelir, expenseDetail: gider } = _zorlukluGelirGider(state));
  } catch (e) {
    console.warn('[ui] Dönem tahmini hesaplanamadı:', e);
  }
  const toplamGelir = gelir?.total || 0;
  const toplamGider = gider?.total || 0;
  const tip = state.meta?.universityType || state.university?.type || 'vakif';

  const gelirler = [];
  if (tip === 'devlet') {
    gelirler.push({ ad: 'YÖK tahsisi ve katkı payı', tutar: (gelir?.stateGrant || 0) + (gelir?.tuition || 0) });
  } else if (tip === 'us_private') {
    gelirler.push({ ad: 'Öğrenim ücretleri', tutar: gelir?.tuition || 0 });
    gelirler.push({ ad: 'Bağış fonu getirisi', tutar: gelir?.stateGrant || 0 });
  } else {
    gelirler.push({ ad: 'Öğrenci ücretleri', tutar: gelir?.tuition || 0 });
    gelirler.push({ ad: 'Vakıf katkısı', tutar: gelir?.stateGrant || 0 });
  }
  const anaGelir = gelirler.reduce((s, k) => s + k.tutar, 0);
  gelirler.push({ ad: 'Diğer gelirler', tutar: Math.max(0, toplamGelir - anaGelir) });

  const giderler = [{ ad: 'Hoca maaşları', tutar: gider?.salariesAcademic || 0 }];
  if ((gider?.scholarships || 0) > 0) giderler.push({ ad: 'Burs ödemeleri', tutar: gider.scholarships });
  // v0.7: harcama kararları (araştırma fonu, öğrenci hizmetleri, tanıtım) ayrı satırda
  const kararGideri = (gider?.researchFund || 0) + (gider?.studentServices || 0) + (gider?.promotion || 0);
  if (kararGideri > 0) giderler.push({ ad: 'Harcama kararları', tutar: kararGideri });
  const anaGider = giderler.reduce((s, k) => s + k.tutar, 0);
  giderler.push({ ad: 'Diğer giderler', tutar: Math.max(0, toplamGider - anaGider) });

  // v0.7: devlette yıl sonu Hazine iadesi (Bahar sonunda kasada bir dönemlik gideri aşan para)
  let hazine = null;
  try { hazine = hazineIadesiTahmini(state); } catch (e) { hazine = null; }

  return { gelirler, giderler, gelir: toplamGelir, gider: toplamGider, net: toplamGelir - toplamGider,
           hazineIadesi: hazine && hazine.iade > 0 ? hazine.iade : 0 };
}

/** Bütçe sekmesi — Hoca maaş gideri (akademik, dönemlik) */
function _budgetFacultyPayroll(state) {
  return Math.round((state.faculty || []).reduce((s, f) => s + (f.salary ?? 0), 0) * SEMESTER_MONTHS);
}

/** Bütçe sekmesi — Araştırma yatırım gideri (hoca başı fon × hoca sayısı) */
function _budgetResearchCost(state) {
  const perFac = state.researchBudgetPerFaculty ?? 50000;
  const facCount = (state.faculty || []).length;
  return Math.round(perFac * facCount);
}

/** Bütçe sekmesi — Burs gideri tahmini (yeni kontenjan sistemine göre) */
function _budgetScholarshipCost(state) {
  const baseTuition  = state.university?.tuitionPerSemester ?? 65_000;
  const byDeptBurs   = state.students?.byDepartment || {};
  const depts        = state.departments || [];
  const uniType      = state.meta?.universityType || 'vakif';

  // Devlet modelinde harç olmadığından üniversiteye burs maliyeti yoktur
  if (uniType === 'devlet') return 0;

  // ABD modelinde financial aid = tuition × aid_rate × enrolled (net revenue hesabında zaten düşülür)
  if (uniType === 'us_private') {
    const aidRate  = state.university?.financialAidRate ?? 0.45;
    const enrolled = state.students?.totalEnrolled ?? 0;
    return Math.round(enrolled * baseTuition * aidRate);
  }

  let cost = 0;
  for (const dept of depts) {
    if (!dept.isOpen) continue;
    const d    = byDeptBurs[dept.id];
    if (!d) continue;
    const mult = dept.tuitionMultiplier || 1.0;
    for (const yr of [d.year1, d.year2, d.year3, d.year4]) {
      if (!yr || !yr.count) continue;
      cost += (yr.tamBurslu  || 0) * baseTuition * mult;
      cost += (yr.yariBurslu || 0) * baseTuition * mult * 0.50;
    }
  }
  return Math.round(cost);
}

/** Bütçe sekmesi — Bina bakım gideri */
function _budgetMaintenance(state) {
  const buildingCost = (state.buildings || []).filter(b => b.isCompleted).reduce((s, b) => {
    const template = BUILDINGS[b.type];
    if (!template) return s;
    if (template.maintenanceCostPerM2 != null && b.area) {
      return s + b.area * template.maintenanceCostPerM2;
    } else if (b.maintenanceCost) {
      return s + b.maintenanceCost;
    }
    const cost  = template.constructionCost || template.baseCost || 0;
    const ratio = template.maintenanceCostRatio || 0.05;
    return s + (cost * ratio) / 2;
  }, 0);
  const deptCost = (state.departments || []).filter(d => d.isOpen).reduce((s, d) => s + (d.annualOperatingCost || 0) / 2, 0);
  return Math.round(buildingCost + deptCost);
}

/** Bütçe sekmesi — İdari giderler */
function _budgetAdmin(state) {
  return Math.round(Object.values(state.admin?.units ?? {}).reduce((s, u) => s + (u.budget || 0), 0));
}

/** Bütçe sekmesi — Genel giderler (enerji, su, vb.) */
function _budgetOverhead(state) {
  const OVERHEAD_PER_STUDENT = 3500;
  const OVERHEAD_FIXED       = 1500000;
  return Math.round(OVERHEAD_FIXED + (state.students?.totalEnrolled ?? 0) * OVERHEAD_PER_STUDENT);
}

/**
 * Bütçe paneli: üniversite modeline göre gelir satırları (v0.6.1: ortak tablo sınıfları, Türkçe kalem adları).
 * @param {object} state   — Oyun state'i
 * @param {number} revenue — Toplam tahmini gelir (dağılım için)
 * @returns {string} HTML satırları
 */
function _revenueLineItems(state, revenue, incomeDetail) {
  const satir = (ad, tutar) => `<tr><td>${ad}</td><td class="n ob-iyi ob-tek">${formatMoney(tutar)}</td></tr>`;
  // Dönem özeti ile tutarlılık için calculateIncome detayını kullan
  if (incomeDetail) {
    const uniType2 = state.meta?.universityType || state.university?.type || 'vakif';
    const projOverheadRow = (incomeDetail.projectOverhead || 0) > 0 ? satir('Proje genel gider kesintisi', incomeDetail.projectOverhead || 0) : '';
    const patentRoyRow = (incomeDetail.patentRoyalties || 0) > 0 ? satir('Patent telif gelirleri', incomeDetail.patentRoyalties || 0) : '';
    if (uniType2 === 'devlet') {
      return `
        ${satir('YÖK bütçe tahsisi ve katkı payı', (incomeDetail.stateGrant || 0) + (incomeDetail.tuition || 0))}
        ${satir('Araştırma fonları', incomeDetail.researchFunds || 0)}
        ${projOverheadRow}
        ${patentRoyRow}
        ${satir('Döner sermaye', incomeDetail.revolving || 0)}
        ${satir('Bağışlar', incomeDetail.donations || 0)}
        ${satir('Sponsorluk ve diğer', (incomeDetail.sponsorship || 0) + (incomeDetail.patents || 0))}
      `;
    }
    if (uniType2 === 'us_private') {
      return `
        ${satir('Öğrenim ücretleri', incomeDetail.tuition || 0)}
        ${satir('Bağış fonu getirisi', incomeDetail.stateGrant || 0)}
        ${satir('Araştırma hibeleri', incomeDetail.researchFunds || 0)}
        ${satir('Mezun bağışları', incomeDetail.donations || 0)}
        ${satir('Spor ve lisanslama', incomeDetail.revolving || 0)}
      `;
    }
    // Vakıf
    return `
      ${satir('Öğrenci ücretleri', incomeDetail.tuition || 0)}
      ${satir('Vakıf katkısı', incomeDetail.stateGrant || 0)}
      ${satir('Araştırma fonları', incomeDetail.researchFunds || 0)}
      ${projOverheadRow}
      ${patentRoyRow}
      ${satir('Döner sermaye', incomeDetail.revolving || 0)}
      ${satir('Bağış ve sponsorluk', (incomeDetail.donations || 0) + (incomeDetail.sponsorship || 0) + (incomeDetail.patents || 0))}
    `;
  }

  // Yedek (incomeDetail yoksa eski tahmin mantığı)
  const uniType = state.meta?.universityType || state.university?.type || 'vakif';
  const students = state.students?.totalEnrolled ?? 0;
  const researchRevenue = ((state.research?.activeResearchProjects?.length ?? 0) + (state.research?.activeProjects?.length ?? 0)) * 500_000;
  if (uniType === 'devlet') {
    const yokModel = UNIVERSITY_MODELS.devlet.revenueStreams.yokTahsisi;
    const yokBase  = yokModel.base + students * yokModel.perStudent + (state.faculty?.length ?? 0) * yokModel.perFaculty;
    const katkiPayi = students * (UNIVERSITY_MODELS.devlet.revenueStreams.ogrenciKatkiPayi?.perStudent ?? 2_000);
    return `
      ${satir('YÖK bütçe tahsisi', yokBase)}
      ${satir('TÜBİTAK ve BAP fonları', researchRevenue * 0.8)}
      ${satir('Döner sermaye', UNIVERSITY_MODELS.devlet.revenueStreams.donerSermaye.base)}
      ${satir('Öğrenci katkı payı', katkiPayi)}
    `;
  }
  return `
    ${satir('Öğrenci ücretleri', revenue * 0.6)}
    ${satir('Araştırma ve diğer', revenue * 0.4)}
  `;
}

/** Oyun durumuna göre uyarılar listesi */
function _getWarnings(state) {
  const warnings = [];
  const uni = state.university || {};
  const faculty = state.faculty || [];

  if (uni.budget < 0) {
    warnings.push({ type: 'danger', icon: '🚨', message: 'Bütçe negatife düştü! Acil önlem alın.' });
  }

  const unhappyCount = faculty.filter(f => (f.happiness ?? 60) < 40).length;
  if (unhappyCount > 0) {
    warnings.push({ type: 'warning', icon: '⚠', message: `${unhappyCount} hoca mutsuz. Transfer riski var.` });
  }

  if (uni.prestige < 20) {
    warnings.push({ type: 'warning', icon: '📉', message: 'Saygınlık çok düşük. Öğrenci talebi azalıyor.' });
  }

  const pendingEvents = state.events?.history?.filter(e => e.autoDecideTurn === state.meta?.turn) || [];
  if (pendingEvents.length > 0) {
    warnings.push({ type: 'info', icon: '📬', message: `${pendingEvents.length} bekleyen karar var.` });
  }

  // Karşılanmayan dersler uyarısı
  const totalUncovered = (state.departments || []).reduce((s, d) => s + (d.uncoveredCourses?.length || 0), 0);
  if (totalUncovered > 0) {
    warnings.push({ type: 'warning', icon: '📚', message: `${totalUncovered} ders için yeterli hoca yok. Dışarıdan öğretim görevlisi gerekiyor.` });
  }

  // Uzmanlık eşleşmesi düşük uyarısı
  const lowMatchDepts = (state.departments || []).filter(d => {
    const assignments = d.courseAssignments || [];
    if (assignments.length === 0) return false;
    const fullMatchCount = assignments.filter(a => a.matchQuality === 2).length;
    return (fullMatchCount / assignments.length) < 0.5;
  });
  if (lowMatchDepts.length > 0) {
    warnings.push({ type: 'warning', icon: '🎯', message: `${lowMatchDepts.length} bölümde hoca-ders uzmanlık eşleşmesi düşük. Öğrenci memnuniyeti etkileniyor.` });
  }

  return warnings;
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature 2: Yeni Bölüm / Program Başvurusu Modalı
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Yeni bölüm veya lisansüstü program başvurusu için modal gösterir.
 * @param {object} state — Oyun durumu
 */
export function showNewDeptProgramModal(state) {
  const depts   = state.departments || [];
  const faculty = state.faculty     || [];
  const budget  = state.university?.budget || 0;

  // Mevcut bölüm kimlikleri
  const openDeptIds = new Set(depts.map(d => d.id));

  // Açılabilecek yeni bölümler
  const availableNewDepts = AVAILABLE_NEW_DEPARTMENTS.filter(d => !openDeptIds.has(d.id));

  // Yüksek lisans / doktora için uygun bölümler
  const ylEligible  = depts.filter(d => {
    const df = faculty.filter(f => (f.department || f.departmentId) === d.id);
    const drPlus = df.filter(f => ['dr_ogr_uyesi','docent','profesor'].includes(f.title)).length;
    return drPlus >= 3 && !d.programs?.yuksek_lisans?.active;
  });
  const phdEligible = depts.filter(d => {
    const df = faculty.filter(f => (f.department || f.departmentId) === d.id);
    const profCount = df.filter(f => f.title === 'profesor').length;
    return profCount >= 2 && !d.programs?.doktora?.active;
  });

  // Bekleyen başvurular
  const pending = state.pendingApplications || [];
  const basvuruTuru = t => t === 'yeni_bolum' ? 'yeni bölüm' : t === 'yuksek_lisans' ? 'yüksek lisans programı' : 'doktora programı';

  /** Program satırı (yüksek lisans ya da doktora): bölüm, kontenjan girdisi, Başvur. */
  const programSatiri = (d, girdiKimligi, min, max, deger, dataAttr) => `
    <div class="ndp-satir">
      <span class="ndp-ikon">${bolumIkonu(d.id, 30, d.icon || '🏫')}</span>
      <div class="ndp-bilgi">
        <div class="ndp-ad">${d.name}</div>
        <label class="ndp-kontenjan">Kontenjan
          <input type="number" id="${girdiKimligi}" class="ob-arama" min="${min}" max="${max}" value="${deger}"> öğrenci/yıl
        </label>
      </div>
      <button type="button" class="btn btn-secondary btn-sm" ${dataAttr}>Başvur</button>
    </div>`;

  // v0.6.1: ortak alt sekmeler, satırlar ve rozetler (eskiden satır içi stilli mavi kutular)
  const bodyHtml = `
    <div class="pencere-yigin">
      <div class="ob-kutular">
        ${_obKutu('Kasa', formatMoney(budget), 'başvuru ücreti kasadan düşer', budget > 5_000_000 ? 'ob-iyi' : 'ob-uyari')}
        ${_obKutu('Bekleyen başvuru', pending.length, 'YÖK onayı bekliyor', pending.length ? 'ob-uyari' : '')}
      </div>

      ${pending.length > 0 ? `
        <div class="ob-kart">
          <div class="ob-kart-baslik"><span>Bekleyen başvurular</span><span class="ob-sayi">${pending.length}</span></div>
          ${pending.map(a => `
            <div class="ob-satir"><span><b class="ndp-bekleyen">${a.name || a.deptId}</b> · ${basvuruTuru(a.type)}</span>
              <span class="ob-rozet ob-rozet--uyari ob-rozet--kucuk">${a.turnsRemaining} dönem kaldı</span></div>
          `).join('')}
        </div>
      ` : ''}

      <div>
        <div class="ob-sekmeler ndp-sekmeler" role="tablist" aria-label="Başvuru türü">
          <button type="button" class="ndp-tab-btn ob-sekme secili" data-tab="lisans" id="ndp-tab-lisans" role="tab" aria-selected="true">Yeni lisans bölümü</button>
          <button type="button" class="ndp-tab-btn ob-sekme" data-tab="yl" id="ndp-tab-yl" role="tab" aria-selected="false">Yüksek lisans</button>
          <button type="button" class="ndp-tab-btn ob-sekme" data-tab="phd" id="ndp-tab-phd" role="tab" aria-selected="false">Doktora</button>
        </div>

        <!-- Lisans bölümü seçimi -->
        <div id="ndp-panel-lisans" role="tabpanel">
          <div class="ob-aciklama ndp-aciklama">Açılabilecek yeni bölümler. YÖK onayından sonra bölüm açılır; en az sayıda öğretim üyesine ulaşmadan öğrenci almaz.</div>
          <div class="ndp-liste">
            ${availableNewDepts.length === 0
              ? '<div class="ob-bos ob-bos--kucuk">Açılabilecek bütün bölümler zaten açık.</div>'
              : availableNewDepts.map(d => {
                  const canAfford  = budget >= d.cost;
                  // R-Fatih Issue #6: bu bölüm için YÖK'te bekleyen başvuru var mı?
                  const pendingApp = pending.find(p => p.deptId === d.id && p.type === 'yeni_bolum');
                  const isPending  = !!pendingApp;
                  return `
                  <div class="ndp-satir ndp-dept-row${canAfford && !isPending ? '' : ' ndp-cant-afford'}"
                       data-dept-id="${d.id}" data-cost="${d.cost}">
                    <span class="ndp-ikon">${bolumIkonu(d.id, 30, d.icon || '🏫')}</span>
                    <div class="ndp-bilgi">
                      <div class="ndp-ad">${d.name}</div>
                      <div class="ndp-alt">en az ${d.minFaculty} öğretim üyesi · maliyet ${formatMoney(d.cost)}</div>
                    </div>
                    ${isPending
                      ? `<button type="button" class="btn btn-secondary btn-sm" disabled>Başvuruldu (${pendingApp.turnsRemaining} dönem)</button>`
                      : canAfford
                        ? `<button type="button" class="btn btn-secondary btn-sm" data-apply-dept="${d.id}">Başvur</button>`
                        : '<span class="ob-rozet ob-rozet--kritik ob-rozet--kucuk">Yetersiz bütçe</span>'
                    }
                  </div>`;
                }).join('')
            }
          </div>
        </div>

        <!-- Yüksek lisans programı -->
        <div id="ndp-panel-yl" role="tabpanel" hidden>
          <div class="ob-aciklama ndp-aciklama">Gereksinim: en az 3 doktoralı öğretim üyesi · YÖK onayı 1-2 dönem · maliyet ${formatMoney(200_000)}</div>
          <div class="ndp-liste">
            ${ylEligible.length === 0
              ? '<div class="ob-bos ob-bos--kucuk">Yüksek lisans programı açabilecek bölüm yok (en az 3 doktoralı öğretim üyesi gerekir).</div>'
              : ylEligible.map(d => programSatiri(d, `yl-quota-${d.id}`, 5, 30, 10, `data-apply-yl="${d.id}"`)).join('')
            }
          </div>
        </div>

        <!-- Doktora programı -->
        <div id="ndp-panel-phd" role="tabpanel" hidden>
          <div class="ob-aciklama ndp-aciklama">Gereksinim: en az 2 profesör · YÖK onayı 1-2 dönem · maliyet ${formatMoney(500_000)}</div>
          <div class="ndp-liste">
            ${phdEligible.length === 0
              ? '<div class="ob-bos ob-bos--kucuk">Doktora programı açabilecek bölüm yok (en az 2 profesör gerekir).</div>'
              : phdEligible.map(d => programSatiri(d, `phd-quota-${d.id}`, 2, 15, 5, `data-apply-phd="${d.id}"`)).join('')
            }
          </div>
        </div>
      </div>
    </div>
  `;

  showModal('Yeni Bölüm / Program Başvurusu', bodyHtml, { wide: true });

  // Sekme değiştirme (seçili sekme .secili ve aria-selected; paneller hidden ile)
  const panels = { lisans: 'ndp-panel-lisans', yl: 'ndp-panel-yl', phd: 'ndp-panel-phd' };
  qsa('.ndp-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      qsa('.ndp-tab-btn').forEach(b => {
        b.classList.toggle('secili', b === btn);
        b.setAttribute('aria-selected', String(b === btn));
      });
      Object.entries(panels).forEach(([sekme, pid]) => {
        const p = el(pid);
        if (p) p.hidden = sekme !== btn.dataset.tab;
      });
    });
  });

  // Yeni bölüm başvur düğmeleri
  qsa('[data-apply-dept]').forEach(btn => {
    btn.addEventListener('click', () => {
      const deptId = btn.dataset.applyDept;
      document.dispatchEvent(new CustomEvent('apply-new-dept', { detail: { type: 'yeni_bolum', deptId } }));
    });
  });

  // Yüksek lisans başvur düğmeleri
  qsa('[data-apply-yl]').forEach(btn => {
    btn.addEventListener('click', () => {
      const deptId = btn.dataset.applyYl;
      const quota  = parseInt(el(`yl-quota-${deptId}`)?.value || '10');
      document.dispatchEvent(new CustomEvent('apply-new-dept', {
        detail: { type: 'yuksek_lisans', deptId, requestedQuota: quota }
      }));
    });
  });

  // Doktora başvur düğmeleri
  qsa('[data-apply-phd]').forEach(btn => {
    btn.addEventListener('click', () => {
      const deptId = btn.dataset.applyPhd;
      const quota  = parseInt(el(`phd-quota-${deptId}`)?.value || '5');
      document.dispatchEvent(new CustomEvent('apply-new-dept', {
        detail: { type: 'doktora', deptId, requestedQuota: quota }
      }));
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature 1: Lisansüstü Program Paneli (Bölümler sekmesine ek)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bölümün lisansüstü program kartı HTML'ini üretir.
 * @param {object} dept    — Bölüm objesi
 * @param {object} state   — Oyun durumu
 * @returns {string} HTML
 */
export function renderGradProgramCard(dept, state) {
  const programs  = dept.programs;
  if (!programs) return '';

  const faculty   = state.faculty || [];
  const deptFaculty = faculty.filter(f => (f.department || f.departmentId) === dept.id);
  const drPlus    = deptFaculty.filter(f => ['dr_ogr_uyesi','docent','profesor'].includes(f.title)).length;
  const profCount = deptFaculty.filter(f => f.title === 'profesor').length;
  const advisorCapYL  = drPlus * 5;
  const advisorCapPhD = deptFaculty.filter(f => ['docent','profesor'].includes(f.title)).length * 3;

  const yl  = programs.yuksek_lisans;
  const phd = programs.doktora;

  if (!yl?.active && !phd?.active) return '';

  const ylStudents  = yl?.active  ? (yl.students.year1.count  || 0) + (yl.students.year2.count  || 0) : 0;
  const phdStudents = phd?.active ? (
    (phd.students.year1?.count || 0) + (phd.students.year2?.count || 0) +
    (phd.students.year3?.count || 0) + (phd.students.year4?.count || 0)
  ) : 0;

  // v0.6.1: ortak bileşenler (Fakülteler sekmesindeki bölüm kartının içinde)
  return `
    <div class="fak-ek">
      <div class="ob-kart-baslik"><span>Lisansüstü programlar</span></div>
      <div class="fak-lisansustu">
        ${yl?.active ? `
          <div>
            <div class="ob-satir"><span><b>Yüksek lisans</b> öğrencisi</span><b>${ylStudents} / ${yl.quota}</b></div>
            <div class="ob-satir"><span>1. yıl · 2. yıl</span><b>${yl.students.year1.count || 0} · ${yl.students.year2.count || 0}</b></div>
            <div class="ob-satir"><span>Tez aşamasında</span><b>${yl.thesisStudents || 0}</b></div>
            <div class="ob-satir"><span>Toplam mezun</span><b>${yl.graduatedTotal || 0}</b></div>
            <div class="ob-satir"><span>Burs (dönemlik)</span><b>${formatMoney((ylStudents * (yl.stipendPerStudent || 8000)))}</b></div>
          </div>
        ` : ''}
        ${phd?.active ? `
          <div>
            <div class="ob-satir"><span><b>Doktora</b> öğrencisi</span><b>${phdStudents} / ${phd.quota}</b></div>
            <div class="ob-satir"><span>Tez aşamasında</span><b>${phd.dissertationStudents || 0}</b></div>
            <div class="ob-satir"><span>Toplam mezun</span><b>${phd.graduatedTotal || 0}</b></div>
            <div class="ob-satir"><span>Burs (dönemlik)</span><b>${formatMoney((phdStudents * (phd.stipendPerStudent || 12000)))}</b></div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature 3: Fakülte Bölümü Ortalama Rating
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bir bölümdeki hocaların ortalama genel puanını hesaplar.
 * @param {string}   deptId  — Bölüm ID
 * @param {object[]} faculty — Tüm hocalar
 * @returns {number} 0-100 arası ortalama puan
 */
export function getDeptAvgRating(deptId, faculty) {
  const deptFaculty = faculty.filter(f => (f.department || f.departmentId) === deptId);
  if (deptFaculty.length === 0) return 0;
  const sum = deptFaculty.reduce((s, f) => s + (f.overallRating || calculateOverallRating(f)), 0);
  return Math.round(sum / deptFaculty.length);
}

// ─────────────────────────────────────────────────────────────────────────────
// İDARİ BİRİMLER PANELİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * İdari birimler sekmesini render eder.
 * @param {object}   state          — Oyun state'i
 * @param {Function} onHireAdmin    — Personel al callback (unitId, title)
 * @param {Function} onUpgradeUnit  — Birim yükselt callback (unitId)
 */
export function renderAdminPanel(state, onHireAdmin, onUpgradeUnit) {
  const panel = el('tab-admin');
  if (!panel) return;

  const adminUnits = state.adminUnits || {};
  const adminStaff = state.adminStaff || [];

  // Özet istatistikler
  const totalStaff  = adminStaff.length;
  const totalNeeded = Object.values(adminUnits).reduce((s, u) => s + (u.staffNeeded || 0), 0);
  const totalSalary = adminStaff.reduce((s, m) => s + (m.salary || 0), 0);
  const avgQuality  = totalStaff > 0
    ? Math.round(adminStaff.reduce((s, m) => s + (m.quality || 0), 0) / totalStaff)
    : 0;

  const staffPct = totalNeeded > 0 ? Math.round(totalStaff / totalNeeded * 100) : 100;

  // Genel puan rengi (hoca kartıyla aynı eşikler)
  const _puanRengi = q => q >= 85 ? '#f0c040' : q >= 70 ? '#4ecca3' : q >= 55 ? '#f5a623' : '#ff6b81';

  // Baş harfler (portre yerine)
  const _initials = name => (name || '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  // Birim içindeki bir üst unvan (terfi için)
  function _nextTitle(title, unitId) {
    const titles = getUnitTitles(unitId);
    const idx = titles.indexOf(title);
    return (idx >= 0 && idx < titles.length - 1) ? titles[idx + 1] : null;
  }

  const statDefs = [
    { key: 'efficiency',    label: 'Verimlilik' },
    { key: 'communication', label: 'İletişim'   },
    { key: 'leadership',    label: 'Liderlik'   },
    { key: 'techSkills',    label: 'Teknik'     },
  ];

  /** Personel kartı: hoca kartının (fc2-) parçalarıyla; terfiye hazır olan altın çerçeveli (.terfi-hazir). */
  function _adminStaffCard(m) {
    const quality       = m.quality || 0;
    const nextTitleName = _nextTitle(m.title, m.unit);
    const terfi         = !!(m.promotionEligible && nextTitleName);
    const expYears      = Math.round((m.totalExperience || m.experience || 0) * 2) / 2;
    const happiness     = Math.round(m.happiness ?? 60);
    const happClass     = happiness >= 70 ? 'high' : happiness >= 45 ? 'mid' : 'low';
    const titleRange    = getUnitTitleSalary(m.unit, m.title);
    return `
      <article class="faculty-card fc2 admin-staff-card personel-kart${terfi ? ' terfi-hazir' : ''}" data-admin-staff-id="${m.id}"
               title="${m.name || 'Personel'}: ayrıntılar">
        <div class="fc2-top">
          <div class="fc2-photo">
            <span class="aday-harf personel-harf" aria-hidden="true">${_initials(m.name)}</span>
            <div class="fc2-rating" style="--rc:${_puanRengi(quality)};" title="Genel puan"><b>${quality}</b></div>
          </div>
          <div class="fc2-id">
            <div class="fc2-name" title="${m.name || ''}">${m.name || 'İsimsiz'}</div>
            <div class="fc2-line"><span class="ob-rozet ob-rozet--kucuk">${m.title || '—'}</span></div>
            <div class="fc2-sub">${ADMIN_UNITS[m.unit]?.name || m.unit || '—'}</div>
          </div>
        </div>
        <div class="fc2-boxes fc2-boxes--uc">
          <div class="fc2-box"><span class="fc2-box-v">${ondalikYaz(expYears, 1)}</span><span class="fc2-box-l">Yıl deneyim</span></div>
          <div class="fc2-box" title="Barem: ${formatMoney(titleRange.min)} - ${formatMoney(titleRange.max)}"><span class="fc2-box-v">${Math.round((m.salary || 0) / 1000)} bin</span><span class="fc2-box-l">₺ / ay</span></div>
          <div class="fc2-box fc2-box--${happClass}" title="Mutluluk: ${happiness}/100"><span class="fc2-box-v">${happiness}</span><span class="fc2-box-l">Mutluluk</span></div>
        </div>
        <div class="faculty-card-stats">
          ${statDefs.map(s => createStatBar(s.label, m[s.key] || 0, 100, _statColor(m[s.key] || 0))).join('')}
        </div>
        ${terfi ? `<div class="fc2-flags"><span class="ob-rozet ob-rozet--iyi">Terfiye uygun: ${nextTitleName}</span></div>` : ''}
        <div class="ob-dugmeler personel-dugmeler">
          ${terfi ? `<button type="button" class="btn btn-sm btn-success" onclick="event.stopPropagation();window._onPromoteAdminStaff('${m.id}')">Terfi et</button>` : ''}
          <button type="button" class="btn btn-sm btn-secondary" onclick="event.stopPropagation();window._onAdjustAdminSalary('${m.id}')">Maaş</button>
          <button type="button" class="btn btn-sm btn-danger" onclick="event.stopPropagation();window._onFireAdminStaff('${m.id}')">Feshet</button>
        </div>
      </article>`;
  }

  /** Liste görünümü satırı (tıklanınca personel ayrıntısı açılır). */
  function _adminStaffListRow(m, idx) {
    const quality       = m.quality || 0;
    const nextTitleName = _nextTitle(m.title, m.unit);
    const expYears      = Math.round((m.totalExperience || m.experience || 0) * 2) / 2;
    const deger = v => `<td class="n ${_obKademe(v || 0, 70, 55)}">${v || 0}</td>`;
    return `
      <tr class="admin-staff-list-row ob-git" data-admin-staff-id="${m.id}" tabindex="0" title="${m.name || 'Personel'}: ayrıntılar">
        <td class="n ob-soluk">${idx + 1}</td>
        <td class="ob-ad ob-tek">${m.name || '—'}</td>
        <td class="ob-tek">${m.title || '—'}</td>
        <td class="n ob-kalin ${_obKademe(quality, 70, 55)}">${quality}</td>
        ${deger(m.efficiency)}
        ${deger(m.communication)}
        ${deger(m.leadership)}
        ${deger(m.techSkills)}
        <td class="n ob-tek">${formatMoney(m.salary)}</td>
        <td class="n ob-tek">${ondalikYaz(expYears, 1)} yıl</td>
        <td>${m.promotionEligible && nextTitleName ? '<span class="ob-rozet ob-rozet--iyi ob-rozet--kucuk">terfiye uygun</span>' : '<span class="ob-soluk">—</span>'}</td>
      </tr>`;
  }

  // Birim kartları (her birimde personel Kart / Liste anahtarıyla)
  const unitCards = Object.values(ADMIN_UNITS).map(template => {
    const unit      = adminUnits[template.id] || { level: 1, staffCount: 0, staffNeeded: template.baseStaffNeeded, staffQuality: 0, satisfaction: 30 };
    const unitStaff = adminStaff.filter(m => m.unit === template.id);
    const eksik     = Math.max(0, unit.staffNeeded - unit.staffCount);
    const perf      = Math.round(unit.satisfaction || 30);
    const unitId    = template.id;
    const personelSinifi = unit.staffCount >= unit.staffNeeded ? 'ob-iyi' : unit.staffCount >= unit.staffNeeded * 0.7 ? 'ob-uyari' : 'ob-kritik';
    const perfTur   = perf >= 70 ? 'iyi' : perf >= 50 ? 'uyari' : 'kritik';

    // Yükseltme
    const nextLevel     = unit.level + 1;
    const canUpgrade    = nextLevel <= template.maxLevel;
    const upgradeCost   = canUpgrade ? template.upgradeCost[unit.level] : 0;
    const nextLevelDesc = canUpgrade ? (template.levelBonuses[nextLevel]?.description || '') : '';
    const upgradeBtn = canUpgrade
      ? `<button type="button" class="btn btn-sm btn-primary" onclick="window._onUpgradeAdminUnit('${unitId}')"
           title="${nextLevelDesc}">Düzey ${sayiEkle(nextLevel)} yükselt · ${formatMoney(upgradeCost)}</button>`
      : '<span class="ob-rozet ob-rozet--iyi ob-rozet--kucuk">En üst düzeyde</span>';

    const levelDesc = template.levelBonuses[unit.level]?.description || '';
    const satBonus  = template.levelBonuses[unit.level]?.satisfactionBonus || 0;

    // Birim yöneticisi satırı (düğme metinleri "Ata" / "Değiştir" sınamalarda aranır)
    const mgrRow = unit.managerId
      ? `<div class="birim-yonetici">
           <span>Birim yöneticisi <b>${unit.managerName}</b> <span class="ob-soluk">(liderlik ${unit.managerLeadership})</span></span>
           <button type="button" class="btn btn-xs btn-secondary" onclick="window._onAssignUnitManager('${unitId}')">Değiştir</button>
         </div>`
      : `<div class="birim-yonetici birim-yonetici--yok">
           <span class="ob-kritik">Birim yöneticisi atanmamış (performans cezası)</span>
           <button type="button" class="btn btn-xs btn-warning" onclick="window._onAssignUnitManager('${unitId}')">Ata</button>
         </div>`;

    // Konum ve bonus rozetleri
    const naturalBuilding = ADMIN_UNIT_BUILDINGS[unitId];
    const rozetler = [
      unit.assignedBuilding && unit.buildingName
        ? `<span class="ob-rozet ob-rozet--iyi ob-rozet--kucuk" title="Birimin çalıştığı bina">Konum: ${unit.buildingName}</span>`
        : naturalBuilding ? '<span class="ob-rozet ob-rozet--kucuk" title="İlgili binayı inşa edin">Konum atanmamış</span>' : '',
      unit.buildingBonus ? `<span class="ob-rozet ob-rozet--bilgi ob-rozet--kucuk">Bina bonusu: +%${unit.buildingBonus.efficiency} verimlilik</span>` : '',
      unit.idariBonus > 0 ? `<span class="ob-rozet ob-rozet--bilgi ob-rozet--kucuk">İdari bina: +%${unit.idariBonus} verimlilik</span>` : '',
    ].filter(Boolean).join('');

    return `
      <article class="ob-kart ob-kart--sutun admin-unit-card birim-kart">
        <header class="ob-kimlik">
          <span class="ob-kimlik-ikon">${template.icon}</span>
          <div class="ob-kimlik-govde">
            <div class="ob-kimlik-ad">${template.name}</div>
            <div class="ob-kimlik-alt">${template.description}</div>
          </div>
          <div class="ob-kimlik-sag">
            ${_obPuan(unit.level, template.maxLevel, { etiket: 'Birim düzeyi' })}
            <span class="birim-duzey">Düzey ${unit.level}/${template.maxLevel}</span>
          </div>
        </header>
        ${rozetler ? `<div class="ob-dizi">${rozetler}</div>` : ''}
        ${mgrRow}
        <div class="ob-kutular birim-kutular">
          ${_obKutu('Personel', `${unit.staffCount}<small>/${unit.staffNeeded}</small>`, eksik > 0 ? `${eksik} eksik` : 'kadro tam', personelSinifi, 'ob-kutu--cukur')}
          ${_obKutu('Kalite', `${tamPuan(unit.staffQuality, 0)}<small>/100</small>`, 'personel ortalaması', _obKademe(unit.staffQuality || 0, 70, 55), 'ob-kutu--cukur')}
          ${_obKutu('Performans', `%${perf}`, `<div class="ob-cubuk ob-cubuk--${perfTur}"><span style="width:${Math.max(0, Math.min(100, perf))}%"></span></div>`, `ob-${perfTur}`, 'ob-kutu--cukur')}
        </div>
        ${levelDesc || satBonus > 0 ? `<div class="ob-aciklama">Düzey ${unit.level}: ${levelDesc}${satBonus > 0 ? `${levelDesc ? ' · ' : ''}memnuniyet +${satBonus}` : ''}</div>` : ''}
        ${eksik > 0 ? '<div class="ob-aciklama ob-aciklama--kritik">Personel yetersiz; birim düşük performansla çalışıyor.</div>' : ''}
        <div class="ob-dugmeler">
          <button type="button" class="btn btn-sm btn-secondary" onclick="window._onHireAdminStaff('${unitId}')">Personel al</button>
          ${upgradeBtn}
        </div>
        ${unitStaff.length > 0 ? `
        <div class="birim-personel">
          <div class="birim-personel-ust">
            <div class="ob-kart-baslik"><span>Personel <span class="ob-sayi">${unitStaff.length}</span></span></div>
            <div class="ob-anahtar" role="group" aria-label="${template.name}: görünüm">
              <button type="button" class="admin-view-card-btn secili" data-unit="${unitId}" aria-pressed="true">Kart</button>
              <button type="button" class="admin-view-list-btn" data-unit="${unitId}" aria-pressed="false">Liste</button>
            </div>
          </div>
          <div class="admin-staff-view-container" data-unit="${unitId}">
            <div class="faculty-grid admin-staff-grid" id="admin-staff-grid-${unitId}">
              ${unitStaff.map(m => _adminStaffCard(m)).join('')}
            </div>
          </div>
        </div>` : ''}
      </article>`;
  }).join('');

  // Terfi bekleyen personel
  const promotionCount = adminStaff.filter(m => {
    if (!m.promotionEligible) return false;
    const unitTitlesArr = getUnitTitles(m.unit);
    return unitTitlesArr.indexOf(m.title) < unitTitlesArr.length - 1;
  }).length;
  const terfiNotu = promotionCount === 0 ? '' : `
    <div class="ob-not ob-not--uyari idari-terfi">
      <div class="ob-not-baslik">${promotionCount} personel terfiye hazır</div>
      <p>Terfiye hazır personelin kartı altın çerçevelidir; kartındaki "Terfi et" düğmesiyle yükseltebilirsiniz.</p>
      <div class="ob-dugmeler">
        <button type="button" class="btn btn-warning btn-sm"
                onclick="document.querySelector('#tab-admin .admin-staff-card.terfi-hazir')?.scrollIntoView({behavior:'smooth',block:'center'})">İlk kartı göster</button>
      </div>
    </div>`;

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-title">İdari Birimler</div>
        <div class="panel-subtitle">${Object.keys(ADMIN_UNITS).length} birim · ${totalStaff} idari personel</div>
      </div>
    </div>

    <div class="ob-yigin">
      <div class="ob-kutular">
        ${_obKutu('Toplam personel', `${totalStaff}<small>/${totalNeeded}</small>`, `gerekenin ${sayiEkle(staffPct, 'si', `%${staffPct}`)}`, staffPct >= 90 ? 'ob-iyi' : staffPct >= 70 ? 'ob-uyari' : 'ob-kritik')}
        ${_obKutu('Aylık idari maaş', formatMoney(totalSalary), `dönemlik ${formatMoney(totalSalary * 5)}`, 'ob-kritik')}
        ${_obKutu('Ortalama kalite', `${avgQuality}<small>/100</small>`, `${totalStaff} personel`, _obKademe(avgQuality, 70, 55))}
      </div>

      ${terfiNotu}

      <section class="ob-bolum">
        ${_obBaslik('idari', 'Birimler', Object.keys(ADMIN_UNITS).length)}
        <div class="ob-yigin ob-yigin--sik">
          ${unitCards}
        </div>
      </section>
    </div>
  `;

  // Kart / Liste görünümü (birim başına)
  const _adminViewState = {};

  function _renderAdminUnitView(unitId, view) {
    const container = panel.querySelector(`.admin-staff-view-container[data-unit="${unitId}"]`);
    if (!container) return;
    const unitStaffLocal = adminStaff.filter(m => m.unit === unitId);

    if (view === 'list') {
      // Sıralama
      const sortKey = _adminViewState[unitId]?.sortKey || null;
      const sortAsc = _adminViewState[unitId]?.sortAsc ?? true;
      let sorted = [...unitStaffLocal];
      if (sortKey) {
        sorted.sort((a, b) => {
          let va = a[sortKey] ?? 0;
          let vb = b[sortKey] ?? 0;
          if (sortKey === 'name') { va = a.name || ''; vb = b.name || ''; }
          if (sortKey === 'title') { va = getUnitTitles(a.unit).indexOf(a.title); vb = getUnitTitles(b.unit).indexOf(b.title); }
          if (sortKey === 'experience') { va = a.totalExperience || a.experience || 0; vb = b.totalExperience || b.experience || 0; }
          if (typeof va === 'string') return sortAsc ? va.localeCompare(vb, 'tr') : vb.localeCompare(va, 'tr');
          return sortAsc ? va - vb : vb - va;
        });
      }

      // Başlık: tıklanınca o sütuna göre sıralar (dinleyici .admin-list-th üzerinde)
      function colHead(key, label, sayisal = true) {
        const isCurrent = sortKey === key;
        const arrow = isCurrent ? (sortAsc ? ' ▲' : ' ▼') : '';
        return `<th class="admin-list-th ob-sirala${sayisal ? ' n' : ''}${isCurrent ? ' sirali' : ''}" data-sort-key="${key}" data-unit="${unitId}"
          aria-sort="${isCurrent ? (sortAsc ? 'ascending' : 'descending') : 'none'}" title="${label}: sırala">${label}${arrow}</th>`;
      }

      const ortKalite = sorted.length > 0 ? Math.round(sorted.reduce((s, m) => s + (m.quality || 0), 0) / sorted.length) : 0;
      container.innerHTML = `
        <div class="ob-tablo-kap">
          <table class="ob-tablo ob-tablo--genis">
            <thead>
              <tr>
                <th class="n">#</th>
                ${colHead('name', 'Ad', false)}
                ${colHead('title', 'Unvan', false)}
                ${colHead('quality', 'Genel')}
                ${colHead('efficiency', 'Verimlilik')}
                ${colHead('communication', 'İletişim')}
                ${colHead('leadership', 'Liderlik')}
                ${colHead('techSkills', 'Teknik')}
                ${colHead('salary', 'Maaş (ay)')}
                ${colHead('experience', 'Deneyim')}
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              ${sorted.map((m, i) => _adminStaffListRow(m, i)).join('')}
            </tbody>
          </table>
        </div>
        <div class="ob-tablo-dip">${sorted.length} personel · ortalama kalite ${ortKalite} · aylık maaş ${formatMoney(sorted.reduce((s, m) => s + (m.salary || 0), 0))} · başlığa tıklayınca sıralanır</div>
      `;

      // Sıralama başlık tıklama
      container.querySelectorAll('.admin-list-th').forEach(th => {
        th.addEventListener('click', () => {
          const key = th.dataset.sortKey;
          if (!_adminViewState[unitId]) _adminViewState[unitId] = {};
          if (_adminViewState[unitId].sortKey === key) {
            _adminViewState[unitId].sortAsc = !_adminViewState[unitId].sortAsc;
          } else {
            _adminViewState[unitId].sortKey = key;
            _adminViewState[unitId].sortAsc = false;
          }
          _renderAdminUnitView(unitId, 'list');
        });
      });

    } else {
      container.innerHTML = `
        <div class="faculty-grid admin-staff-grid">
          ${unitStaffLocal.map(m => _adminStaffCard(m)).join('')}
        </div>
      `;
    }

    // Liste satırı tıklama (ya da Enter) → ayrıntı penceresi
    container.querySelectorAll('.admin-staff-list-row').forEach(row => {
      row.addEventListener('click', () => {
        const mid = row.dataset.adminStaffId;
        if (mid) _showAdminStaffDetail(mid, adminStaff);
      });
      row.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const mid = row.dataset.adminStaffId;
        if (mid) _showAdminStaffDetail(mid, adminStaff);
      });
    });

    // Kart tıklama → ayrıntı penceresi
    container.querySelectorAll('.admin-staff-card').forEach(card => {
      card.addEventListener('click', () => {
        const mid = card.dataset.adminStaffId;
        if (mid) _showAdminStaffDetail(mid, adminStaff);
      });
    });
  }

  // Kart / Liste anahtarı: seçili düğme .secili ve aria-pressed ile işaretlenir
  const gorunumSec = (uid, view) => {
    if (!_adminViewState[uid]) _adminViewState[uid] = {};
    _adminViewState[uid].view = view;
    const kart  = panel.querySelector(`.admin-view-card-btn[data-unit="${uid}"]`);
    const liste = panel.querySelector(`.admin-view-list-btn[data-unit="${uid}"]`);
    kart?.classList.toggle('secili', view === 'card');
    liste?.classList.toggle('secili', view === 'list');
    kart?.setAttribute('aria-pressed', String(view === 'card'));
    liste?.setAttribute('aria-pressed', String(view === 'list'));
    _renderAdminUnitView(uid, view);
  };
  panel.querySelectorAll('.admin-view-card-btn').forEach(btn => {
    btn.addEventListener('click', () => gorunumSec(btn.dataset.unit, 'card'));
  });
  panel.querySelectorAll('.admin-view-list-btn').forEach(btn => {
    btn.addEventListener('click', () => gorunumSec(btn.dataset.unit, 'list'));
  });

  // İlk yükleme: kart görünümünde tıklama bağla
  panel.querySelectorAll('.admin-staff-card').forEach(card => {
    card.addEventListener('click', () => {
      const mid = card.dataset.adminStaffId;
      if (mid) _showAdminStaffDetail(mid, adminStaff);
    });
  });
}

/**
 * İdari personel ayrıntısı penceresi: kimlik, puanlar, mutluluk ve maaş, terfi durumu, geçmiş performans, eylemler.
 */
function _showAdminStaffDetail(staffId, adminStaff) {
  const m = adminStaff.find(s => s.id === staffId);
  if (!m) return;

  const unitTitlesForDetail = getUnitTitles(m.unit);
  const titleRange  = getUnitTitleSalary(m.unit, m.title);
  const nextTitleName = (() => {
    const idx = unitTitlesForDetail.indexOf(m.title);
    return (idx >= 0 && idx < unitTitlesForDetail.length - 1) ? unitTitlesForDetail[idx + 1] : null;
  })();
  const expYears    = Math.round((m.totalExperience || m.experience || 0) * 2) / 2;
  const happiness   = Math.round(m.happiness ?? 60);
  const quality     = m.quality || 0;
  const initials    = (m.name || '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const puanRengi   = quality >= 85 ? '#f0c040' : quality >= 70 ? '#4ecca3' : quality >= 55 ? '#f5a623' : '#ff6b81';

  const statDefs = [
    { key: 'efficiency',    label: 'Verimlilik' },
    { key: 'communication', label: 'İletişim'   },
    { key: 'leadership',    label: 'Liderlik'   },
    { key: 'techSkills',    label: 'Teknik'     },
  ];

  // Geçmiş performans (son 4 dönem, varsa)
  const perfHistory = (m.performanceHistory || []).slice(-4);
  const perfHistoryHtml = perfHistory.length > 0 ? `
    <section class="ob-bolum">
      <div class="ob-kart-baslik"><span>Geçmiş performans</span></div>
      <div class="ob-kutular">
        ${perfHistory.map((p, i) => _obKutu(`${perfHistory.length - i} dönem önce`, p, '', _obKademe(p, 70, 55), 'ob-kutu--cukur')).join('')}
      </div>
    </section>` : '';

  const bodyHtml = `
    <div class="pencere-yigin">
      <div class="pencere-kimlik">
        <div class="fc2-photo">
          <span class="aday-harf personel-harf" aria-hidden="true">${initials}</span>
          <div class="fc2-rating" style="--rc:${puanRengi};" title="Genel puan"><b>${quality}</b></div>
        </div>
        <div class="ob-kimlik-govde">
          <div class="ob-kimlik-ad">${m.name || 'İsimsiz'}</div>
          <div class="ob-kimlik-alt"><span class="ob-rozet ob-rozet--kucuk">${m.title || '—'}</span>${ADMIN_UNITS[m.unit]?.name || m.unit || '—'}</div>
          <div class="ob-kimlik-alt">${ondalikYaz(expYears, 1)} yıl deneyim</div>
        </div>
      </div>

      <div class="ob-kart pencere-cubuklar">
        ${statDefs.map(s => createStatBar(s.label, m[s.key] || 0, 100, _statColor(m[s.key] || 0))).join('')}
      </div>

      <div class="ob-kutular">
        ${_obKutu('Mutluluk', `${happiness}<small>/100</small>`, '', _obKademe(happiness, 70, 40))}
        ${_obKutu('Maaş', formatMoney(m.salary), `aylık · barem ${formatMoney(titleRange.min)} - ${formatMoney(titleRange.max)}`)}
      </div>

      ${m.promotionEligible && nextTitleName ? `
        <div class="ob-not ob-not--iyi">
          <div class="ob-not-baslik">Terfiye uygun</div>
          <p>${m.title} unvanından ${nextTitleName} unvanına yükseltilebilir.</p>
        </div>
      ` : `
        <div class="ob-not">
          <div class="ob-not-baslik">Terfi koşulları</div>
          <p>Mevcut unvanda ${m.semestersInTitle || 0}/4 dönem · kalite en az 70 olmalı (şu an ${quality}).</p>
        </div>
      `}

      ${perfHistoryHtml}

      <div class="ob-dugmeler ob-dugmeler--alt">
        ${m.promotionEligible && nextTitleName
          ? `<button type="button" class="btn btn-success" onclick="window._onPromoteAdminStaff('${m.id}');document.getElementById('modal-overlay')?.classList.add('hidden');">Terfi et</button>`
          : ''}
        <button type="button" class="btn btn-secondary" onclick="window._onAdjustAdminSalary('${m.id}');document.getElementById('modal-overlay')?.classList.add('hidden');">Maaş ayarla</button>
        <button type="button" class="btn btn-danger" onclick="window._onFireAdminStaff('${m.id}');document.getElementById('modal-overlay')?.classList.add('hidden');">Feshet</button>
      </div>
    </div>
  `;

  showModal(m.name || 'Personel', bodyHtml);
}

/**
 * İdari personel işe alma penceresi.
 * @param {string}   unitId        — Birim ID'si
 * @param {object}   candidates    — Aday listesi
 * @param {Function} onHire        — İşe al callback (candidate)
 * @param {string}   currentLevel  — Seçili deneyim seviyesi (Yenile tuşu sonrası korunur)
 */
export function renderAdminHireModal(unitId, candidates, onHire, currentLevel, secenek = {}) {
  const template = ADMIN_UNITS[unitId];
  if (!template) return;

  // Birim bazlı unvan listesi
  const unitTitleList = getUnitTitles(unitId);
  // v0.5.2: "Ata" düğmesinden, birimde yönetici yokken açıldıysa yönetici rütbesi önceden seçili gelir
  const yoneticiIcin     = !!secenek.yoneticiIcin;
  const yoneticiRutbeler = unitTitleList.filter(t => isUnitManagerTitle(unitId, t));
  const seciliRutbe = (sugT) => (yoneticiIcin && !isUnitManagerTitle(unitId, sugT) && yoneticiRutbeler.length)
    ? yoneticiRutbeler[0] : sugT;

  // Deneyim seviyesi seçenekleri
  const levelOptions = [
    { value: 'junior', label: 'Giriş seviye aday' },
    { value: 'mid',    label: 'Orta düzey aday' },
    { value: 'senior', label: 'Kıdemli aday' },
  ].map(opt =>
    `<option value="${opt.value}" ${opt.value === (currentLevel || 'mid') ? 'selected' : ''}>${opt.label}</option>`
  ).join('');

  // Adayları global önbelleğe yaz (onclick için)
  window._adminCandidateCache = candidates;

  const candidateRows = candidates.map((c, idx) => {
    const sugT   = c.suggestedTitle || unitTitleList[1] || unitTitleList[0] || 'Uzman';
    const secili = seciliRutbe(sugT);
    const titleOpts = unitTitleList.map(t => {
      const bar = getUnitTitleSalary(unitId, t);
      return `<option value="${t}" ${t === secili ? 'selected' : ''}>${t}${isUnitManagerTitle(unitId, t) ? ' · yönetici' : ''} (${formatMoney(bar.min)} - ${formatMoney(bar.max)}/ay)</option>`;
    }).join('');

    return `
    <article class="ob-kart alim-aday">
      <header class="ob-kimlik">
        <span class="aday-harf alim-harf" aria-hidden="true">${(c.name || '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}</span>
        <div class="ob-kimlik-govde">
          <div class="ob-kimlik-ad">${c.name}</div>
          <div class="ob-kimlik-alt">${c.experience || c.totalExperience || 0} yıl deneyim · kalite <b class="${_obKademe(c.quality || 0, 70, 55)}">${c.quality}</b>/100</div>
          <div class="ob-kimlik-alt">Verimlilik ${c.efficiency || 0} · İletişim ${c.communication || 0} · Liderlik ${c.leadership || 0}</div>
        </div>
        <div class="ob-kimlik-sag"><span class="ob-kutu-e">Önerilen</span><span class="alim-oneri">${sugT}</span></div>
      </header>
      <div class="alim-secim">
        <label class="ob-ayar-e" for="admin-hire-chosentitle-${idx}">Bu adayı hangi rütbeyle alacaksınız?</label>
        <select id="admin-hire-chosentitle-${idx}" class="ob-secim ob-secim--tam"
          onchange="window._onAdminTitleSelectionChange(${idx}, this.value)">
          ${titleOpts}
        </select>
        <div id="admin-hire-warning-${idx}" class="alim-uyari"></div>
      </div>
      <div class="alim-alt">
        <div class="alim-maas" id="admin-hire-salary-${idx}">${formatMoney(c.salaryExpectation || c.salary)}/ay (tahmini)</div>
        <button type="button" class="btn btn-sm btn-primary" onclick="window._onHireAdminCandidateByIdx(${idx})">Bu rütbeyle al</button>
      </div>
    </article>
  `}).join('');

  // Gövde düz tutulur: yönetici notu gövdenin ilk <div>'i (sina4 U15 onu okur)
  showModal(
    `${template.icon} ${template.name}: ${yoneticiIcin ? 'Yönetici Alımı' : 'Personel Alımı'}`,
    `
      <p class="pencere-metin">${template.description}</p>
      ${yoneticiIcin ? `
      <div class="ob-not ob-not--uyari alim-not">
        Bu birimde yönetici rütbesinde (<strong>${yoneticiRutbeler.join(' ya da ')}</strong>) personel yok.
        Aşağıdaki adaylardan birini bu rütbeyle alırsanız birim yöneticisi olarak kendiliğinden atanır.
      </div>` : ''}
      <div class="ob-kart alim-ayar">
        <label class="ob-ayar-e" for="admin-hire-title">Deneyim seviyesi</label>
        <div class="alim-ayar-satir">
          <select id="admin-hire-title" class="ob-secim" data-yonetici="${yoneticiIcin ? '1' : ''}">
            ${levelOptions}
          </select>
          <button type="button" class="btn btn-sm btn-secondary" onclick="window._onRefreshAdminCandidates('${unitId}')">Adayları Yenile</button>
        </div>
      </div>
      <div class="section-title">Adaylar <span class="ob-sayi">${candidates.length}</span></div>
      <div class="alim-adaylar">
        ${candidateRows}
      </div>
    `
  );

  // Önerilenden farklı rütbe önceden seçildiyse maaş tahmini ve uyarı ona göre yazılsın
  candidates.forEach((c, idx) => {
    const sugT = c.suggestedTitle || unitTitleList[1] || unitTitleList[0] || 'Uzman';
    const secili = seciliRutbe(sugT);
    if (secili !== sugT && typeof window._onAdminTitleSelectionChange === 'function') {
      window._onAdminTitleSelectionChange(idx, secili);
    }
  });
}

/**
 * v0.5.2: birim yöneticisi seçme penceresi (prompt() yerine). Uygun personel listelenir,
 * oyuncu birine "Ata" der; yönetici varsa kaldırma seçeneği de çıkar.
 * @param {string}   unitId
 * @param {object[]} uygunlar      yönetici rütbesindeki personel
 * @param {string|null} mevcutId   şimdiki yöneticinin kimliği
 * @param {Function} onSec         (staffId | null) => void; null = yöneticiyi kaldır
 */
export function renderUnitManagerModal(unitId, uygunlar, mevcutId, onSec) {
  const template = ADMIN_UNITS[unitId];
  const satirlar = [...uygunlar]
    .sort((a, b) => (b.leadership || 0) - (a.leadership || 0))
    .map(s => `
      <div class="yonetici-satir${s.id === mevcutId ? ' secili' : ''}">
        <div class="yonetici-bilgi">
          <div class="yonetici-ad">${s.name}${s.id === mevcutId ? ' <span class="ob-rozet ob-rozet--iyi ob-rozet--kucuk">Şimdiki yönetici</span>' : ''}</div>
          <div class="yonetici-alt">${s.title} · Liderlik ${tamPuan(s.leadership, 0)} · Kalite ${tamPuan(s.quality, 0)} · Mutluluk ${tamPuan(s.happiness, 0)}</div>
        </div>
        ${s.id === mevcutId ? '' : `<button class="btn btn-sm btn-primary btn-yonetici-ata" data-staff-id="${s.id}" type="button">Ata</button>`}
      </div>`).join('');

  showModal(`${template?.icon || ''} ${template?.name || 'Birim'}: Yönetici Seçimi`, `
    <p class="pencere-metin">
      Yönetici, birimin en üst iki rütbesindeki personelden seçilir. Liderliği yüksek yönetici birimin performansını artırır.
    </p>
    <div class="yonetici-liste">${satirlar}</div>
    <div class="onay-dugmeler">
      ${mevcutId ? '<button class="btn btn-secondary" id="btn-yonetici-kaldir" type="button">Yöneticiyi Kaldır</button>' : ''}
      <button class="btn btn-secondary" id="btn-yonetici-vazgec" type="button">Vazgeç</button>
    </div>`);

  qsa('#general-modal-body .btn-yonetici-ata').forEach(btn => {
    btn.addEventListener('click', () => { hideModal(); if (onSec) onSec(btn.dataset.staffId); });
  });
  on(el('btn-yonetici-kaldir'), 'click', () => { hideModal(); if (onSec) onSec(null); });
  on(el('btn-yonetici-vazgec'), 'click', () => hideModal());
}

// ─────────────────────────────────────────────────────────────────────────────
// v0.2 — MEZUN PANELİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mezun sistemini render et.
 * @param {object} state
 * @param {function} onAlumniEvent — (type) callback
 */
export function renderAlumniPanel(state, onAlumniEvent) {
  const panel = el('tab-alumni');
  if (!panel) return;

  const ad = state.alumniData || {};
  const notableList = ad.notableAlumni || [];
  const totalGrad = ad.totalGraduates || 0;
  const network = ad.alumniNetwork || 0;
  const annualDon = ad.annualDonations || 0;
  const totalDon = ad.totalDonations || 0;

  // v0.6.1: ünlü mezun kartı ortak kart ve kimlik satırıyla (eskiden kırmızı sol kenarlı, kritik gibi okunuyordu)
  const notableHtml = notableList.length === 0
    ? `<div class="ob-bos">
         <i class="ikon ikon--mezunlar" aria-hidden="true"></i>
         <div class="ob-bos-baslik">Henüz ünlü mezun yok</div>
         Mezunlar zaman içinde kariyer yapacak; öne çıkanlar burada izlenir.
       </div>`
    : `<div class="ob-kartlar">${notableList.slice().reverse().map(alum => {
        const cp = alum.careerPath;
        const levelTitle = _getAlumniLevelTitle(cp?.type, alum.careerLevel);
        // Kariyer yolu adı ("Akademisyen" yerine öğretim üyeliğine giden yol)
        const kariyerAdi = cp ? (cp.type === 'academic' ? 'Akademik kariyer' : cp.name) : null;
        const duzey = Math.max(0, Math.min(5, Number(alum.careerLevel) || 0));
        const totalDonated = alum.totalDonated || 0;
        const harf = (alum.name || '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
        return `
          <article class="ob-kart ob-kart--sutun mezun-kart">
            <header class="ob-kimlik">
              <span class="aday-harf mezun-harf" aria-hidden="true">${harf}</span>
              <div class="ob-kimlik-govde">
                <div class="ob-kimlik-ad">${alum.name}</div>
                <div class="ob-kimlik-alt">${alum.departmentName || alum.department || '—'} · ${alum.graduationYear}. yıl mezunu</div>
              </div>
              ${alum.fame > 0 ? `<div class="ob-kimlik-sag">${_obPuan(Math.floor(alum.fame / 20), 5, { etiket: 'Ün' })}<span class="mezun-un">ün ${alum.fame}/100</span></div>` : ''}
            </header>
            <div>
              ${kariyerAdi ? _obSatir(kariyerAdi, levelTitle) : _obSatir('Kariyer', 'henüz belirlenmedi', 'ob-soluk')}
              ${_obSatir('Kariyer düzeyi', `${duzey}<span class="ob-soluk">/5</span>`)}
              <div class="ob-cubuk"><span style="width:${duzey * 20}%"></span></div>
              ${totalDonated > 0 ? _obSatir('Toplam bağış', formatMoney(totalDonated), 'ob-iyi') : ''}
            </div>
            ${alum.achievement ? `<div class="ob-aciklama mezun-basari">"${alum.achievement}"</div>` : ''}
          </article>`;
      }).join('')}</div>`;

  // Etkinlikler: etkiler alumni_events_achievements.js organizeAlumniEvent'ten
  const etkinlikler = [
    { tur: 'reunion',           ikon: '🤝', ad: 'Mezun buluşması',  etki: 'Mezun ağı +5; saygınlığa katkısı dönem sonunda yansır.', ucret: 500_000 },
    { tur: 'career_day',        ikon: '💼', ad: 'Kariyer günü',     etki: 'Öğrenci memnuniyeti +5.', ucret: 200_000 },
    { tur: 'donation_campaign', ikon: '💝', ad: 'Bağış kampanyası', etki: 'Sonraki dönem mezun bağışları artar.', ucret: 300_000 },
  ];

  const agSinifi = network >= 70 ? 'ob-iyi' : '';

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-title">Mezunlar</div>
        <div class="panel-subtitle">Mezun ağı, bağışlar ve ünlü mezunların kariyeri</div>
      </div>
    </div>

    <div class="ob-yigin">
      <div class="ob-kutular">
        ${_obKutu('Toplam mezun', formatNumber(totalGrad), 'bugüne kadar')}
        ${_obKutu('Ünlü mezun', formatNumber(notableList.length), 'kariyeri izlenen')}
        ${_obKutu('Bu yıl bağış', formatMoney(annualDon), 'mezun bağışı', annualDon > 0 ? 'ob-iyi' : '')}
        ${_obKutu('Toplam bağış', formatMoney(totalDon), 'tüm zamanlar')}
      </div>

      <div class="ob-iki">
        <section class="ob-bolum">
          ${_obBaslik('mezunlar', 'Mezun ağı gücü')}
          <div class="ob-kart">
            ${_obSatir('Ağ gücü', `${network}<span class="ob-soluk">/100</span>`, agSinifi)}
            <div class="ob-cubuk"><span style="width:${Math.max(0, Math.min(100, network))}%"></span></div>
            <div class="ob-aciklama">Güçlü mezun ağı öğrenci çekimini ve bağışları artırır. Mezun buluşmaları ağı güçlendirir.</div>
          </div>
        </section>

        <section class="ob-bolum">
          ${_obBaslik('kasa', 'Mezun etkinlikleri')}
          <div class="ob-kart mezun-etkinlikler">
            ${etkinlikler.map(e => `
              <div class="mezun-etkinlik">
                <span class="ob-kimlik-ikon">${e.ikon}</span>
                <div class="ob-kimlik-govde">
                  <div class="mezun-etkinlik-ad">${e.ad}</div>
                  <div class="ob-kimlik-alt">${e.etki}</div>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" onclick="window._alumniEvent('${e.tur}')">Düzenle · ${formatMoney(e.ucret)}</button>
              </div>`).join('')}
          </div>
        </section>
      </div>

      <section class="ob-bolum">
        ${_obBaslik('mezunlar', 'Ünlü mezunlar', notableList.length)}
        ${notableHtml}
      </section>
    </div>
  `;

  // Global olay bağlama
  window._alumniEvent = (type) => {
    if (onAlumniEvent) onAlumniEvent(type);
  };
}

function _getAlumniLevelTitle(careerType, level) {
  const titles = {
    tech_ceo:   ['Yazılım Geliştirici', 'Kıdemli Mühendis', 'Teknik Direktör', 'CTO', 'CEO', 'Efsane CEO'],
    corporate:  ['Uzman', 'Yönetici', 'Direktör', 'Genel Müdür Yardımcısı', 'CEO', 'İş Dünyası Lideri'],
    academic:   ['Araştırma Görevlisi', 'Dr.', 'Doç. Dr.', 'Prof. Dr.', 'Rektör Yardımcısı', 'Dünya Bilgini'],
    politician: ['Danışman', 'Yetkili', 'Genel Müdür', 'Milletvekili', 'Bakan', 'Cumhurbaşkanı'],
    artist:     ['Acemi', 'Sanatçı', 'Tanınan Sanatçı', 'Ünlü', 'Efsane', 'Kültür İkonu'],
    engineer:   ['Mühendis', 'Kıdemli Mühendis', 'Baş Mühendis', 'Teknik Lider', 'Teknik Direktör', 'Endüstri Ustası'],
  };
  const list = titles[careerType] || titles.engineer;
  return list[Math.min(level, list.length - 1)] || '—';
}

// ─────────────────────────────────────────────────────────────────────────────
// v0.2 — BAŞARIM PANELİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Başarımlar panelini render et.
 */
export function renderAchievementsPanel(state, achievements, stats) {
  const panel = el('tab-achievements');
  if (!panel) return;

  const unlocked = state.achievements || {};
  // Kategori adı ve ikon atlasındaki karşılığı (başlıkta emoji yerine atlas ikonu)
  const categories = {
    kadro:        ['Kadro', 'kadro'],
    ogrenci:      ['Öğrenciler', 'ogrenci'],
    prestij:      ['Saygınlık', 'sayginlik'],
    siralama:     ['Sıralama', 'dunya'],
    arastirma:    ['Araştırma', 'arastirma'],
    finans:       ['Finans', 'kasa'],
    kampus:       ['Yerleşke', 'yerleske'],
    bolum:        ['Bölüm', 'bolumler'],
    akreditasyon: ['Akreditasyon', 'akreditasyon'],
    ozel:         ['Özel', 'kazanim'],
  };

  // Kategorilere göre grupla
  const grouped = {};
  for (const ach of achievements) {
    if (!grouped[ach.category]) grouped[ach.category] = [];
    grouped[ach.category].push(ach);
  }

  const progressPct = stats.percent || 0;
  // Adın başındaki emoji büyük ikonla aynı; kartta bir kez görünsün
  const ikonsuzAd = ad => String(ad || '').replace(/^[^\p{L}\p{N}]+/u, '').trim() || ad;

  const catHtml = Object.entries(categories).map(([catId, [catName, catIkon]]) => {
    const list = grouped[catId] || [];
    if (list.length === 0) return '';
    const items = list.map(ach => {
      const info = unlocked[ach.id];
      const isUnlocked = !!info;
      return `
        <article class="ob-kart kazanim-kart ${isUnlocked ? 'kazanim-kart--acik' : 'kazanim-kart--kilitli'}" title="${ach.description}">
          <div class="ob-kimlik">
            <span class="ob-kimlik-ikon${isUnlocked ? '' : ' ob-kimlik-ikon--soluk'}" aria-hidden="true">${ach.icon}</span>
            <div class="ob-kimlik-govde">
              <div class="ob-kimlik-ad">${ikonsuzAd(ach.name)}</div>
              <div class="ob-kimlik-alt">${ach.description}</div>
              ${isUnlocked ? `<div class="kazanim-tarih">${info.year}. yıl ${info.semester === 'güz' ? 'Güz' : 'Bahar'} döneminde açıldı</div>` : ''}
            </div>
            ${isUnlocked
              ? '<span class="ob-rozet ob-rozet--iyi ob-rozet--kucuk">Açıldı</span>'
              : '<span class="ob-rozet ob-rozet--kucuk">Kilitli</span>'}
          </div>
        </article>`;
    }).join('');

    const catUnlocked = list.filter(a => unlocked[a.id]).length;
    return `
      <section class="ob-bolum">
        ${_obBaslik(catIkon, catName, `${catUnlocked}/${list.length}`)}
        <div class="ob-kartlar kazanim-liste">${items}</div>
      </section>`;
  }).join('');

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-title">Kazanımlar</div>
        <div class="panel-subtitle">${stats.unlocked}/${stats.total} kazanım açıldı</div>
      </div>
    </div>

    <div class="ob-yigin">
      <div class="ob-kart">
        ${_obSatir('Açılan kazanımlar', `${stats.unlocked}<span class="ob-soluk">/${stats.total}</span> · %${progressPct}`)}
        <div class="ob-cubuk"><span style="width:${Math.max(0, Math.min(100, progressPct))}%"></span></div>
      </div>
      ${catHtml}
    </div>
  `;
}

/**
 * Başarım bildirimleri için kuyruk sistemi.
 * Aynı anda en fazla _ACH_MAX bildirim gösterilir; fazlası sıraya alınır.
 */
const _achQueue   = [];  // bekleyen başarımlar
let   _achVisible = 0;   // şu anda ekranda görünen sayısı
const _ACH_MAX    = 4;   // aynı anda gösterilecek maksimum
const _ACH_DURATION = 4000; // ms — otomatik kapanma süresi

function _achShowNext() {
  if (_achQueue.length === 0 || _achVisible >= _ACH_MAX) return;
  const ach = _achQueue.shift();
  _achVisible++;

  const container = el('toast-container') || document.body;
  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.innerHTML = `
    <span class="achievement-toast-icon">${ach.icon}</span>
    <div class="achievement-toast-body">
      <div class="achievement-toast-label">🏆 KAZANIM AÇILDI!</div>
      <div class="achievement-toast-name">${ach.name}</div>
      <div class="achievement-toast-desc">${ach.description}</div>
    </div>
    <button class="achievement-toast-close" title="Kapat">✕</button>`;

  container.appendChild(toast);

  const dismiss = () => {
    if (toast._dismissed) return;
    toast._dismissed = true;
    toast.classList.add('fadeout');
    setTimeout(() => {
      toast.remove();
      _achVisible--;
      _achShowNext(); // sıradaki varsa göster
    }, 420);
  };

  toast.querySelector('.achievement-toast-close').addEventListener('click', dismiss);
  setTimeout(dismiss, _ACH_DURATION);
}

/**
 * Başarım açıldığında toast bildirim göster.
 * Birden fazla çağrı gelirse kuyruğa alır, aynı anda en fazla 4 gösterir.
 */
export function showAchievementNotification(ach) {
  _achQueue.push(ach);
  _achShowNext();
}

// ─────────────────────────────────────────────────────────────────────────────
// v0.2 — RASTGELE OLAY MODAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rastgele olay modalını göster (oyuncu seçim yapar).
 * @param {object} event — RANDOM_EVENTS elemanı
 * @param {function} onChoice — (choiceIndex) callback
 */
export function renderRandomEventModal(event, onChoice) {
  const isCrisis = event.isCrisis;
  const rozet = (metin, iyi) => `<span class="ob-rozet ${iyi ? 'ob-rozet--iyi' : 'ob-rozet--kritik'} ob-rozet--kucuk">${metin}</span>`;

  // v0.6.1: seçenekler tıklanır kart (düğme), etkiler rozet; renkler ortak durum sınıflarıyla
  const choicesHtml = event.choices.map((c, i) => {
    const budgetText = c.budgetDelta
      ? rozet(`Kasa ${c.budgetDelta > 0 ? '+' : ''}${formatMoney(c.budgetDelta)}`, c.budgetDelta > 0)
      : '';
    // v0.5.2: seçeneğin ham puanı değil, dönem sonunda saygınlığa yansıyacak kalıcı etkisi
    const kaliciPay = c.prestigeDelta ? kaliciSayginlikEtkisi(c) : 0;
    const prestigeText = kaliciPay
      ? rozet(`Saygınlık ${isaretliYaz(kaliciPay)} (dönem sonunda)`, kaliciPay > 0)
      : '';
    const satText = c.satisfactionDelta
      ? rozet(`Memnuniyet ${isaretliYaz(c.satisfactionDelta)}`, c.satisfactionDelta > 0)
      : '';

    const effectTags = [budgetText, prestigeText, satText].filter(Boolean).join('');

    return `
      <button type="button" class="ob-kart ob-kart--tiklanir random-event-choice olay-secenek" data-choice="${i}">
        <span class="olay-secenek-ad">${c.text}</span>
        ${effectTags ? `<span class="ob-dizi">${effectTags}</span>` : ''}
        ${c.description ? `<span class="olay-secenek-aciklama">${c.description}</span>` : ''}
      </button>`;
  }).join('');

  const body = `
    <div class="pencere-yigin olay">
      <div class="ob-not ${isCrisis ? 'ob-not--kritik' : 'ob-not--iyi'} olay-ozet">
        <div class="ob-not-baslik">${isCrisis ? 'Kriz' : 'Olay'}</div>
        <div class="olay-ad">${event.name}</div>
        <p>${event.description}</p>
      </div>
      <div>
        <div class="section-title">Ne yapacaksınız?</div>
        <div class="ob-aciklama olay-yonerge">Devam etmek için bir seçenek seçin.</div>
      </div>
      <div id="random-event-choices" class="olay-secenekler">${choicesHtml}</div>
    </div>
  `;

  // v0.5.2: olay penceresi kilitli (✕, Esc, arka plan yok); kapanırsa dönem özeti hiç açılmıyordu
  showModal(isCrisis ? '⚠️ Kriz!' : '📢 Olay', body, { wide: false, kilitli: true });

  // Seçeneklere tıklama bağla (üstüne gelme görünümü CSS'te: .ob-kart--tiklanir)
  setTimeout(() => {
    const choiceEls = document.querySelectorAll('.random-event-choice');
    choiceEls.forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.choice, 10);
        if (onChoice) onChoice(idx);
      });
    });
  }, 50);
}

// ─────────────────────────────────────────────────────────────────────────────
// AKREDİTASYON PANELİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Akreditasyon sekmesi: tüm bölümlerin akreditasyon durumu, başvuru ve yenileme.
 * @param {object}   state    — Oyun durumu
 * @param {Function} onApply  — Başvur callback (deptId, bodyId)
 * @param {Function} onRenew  — Yenile callback (deptId, bodyId)
 */
export function renderAccreditationPanel(state, onApply, onRenew) {
  const panel = el('tab-accreditation');
  if (!panel) return;

  const depts = state.departments || [];
  const turn  = state?.meta?.turn || 1;

  function turnToLabel(t) {
    const y = Math.ceil(t / 2);
    const s = (t % 2 === 1) ? 'Güz' : 'Bahar';
    return `${y}. yıl ${s}`;
  }

  // Özet istatistikler
  let totalAccredited = 0;
  let totalPending    = 0;
  let totalExpired    = 0;
  for (const dept of depts) {
    if (!dept.accreditation) continue;
    for (const acc of Object.values(dept.accreditation)) {
      if (acc.status === 'granted')  totalAccredited++;
      if (acc.status === 'applied' || acc.status === 'under_review') totalPending++;
      if (acc.status === 'expired')  totalExpired++;
    }
  }
  const acikBolumler = depts.filter(d => d.isOpen && d.accreditation);

  // Hücre içeriği: durum rozeti, ayrıntı satırı, gerekirse düğme (onclick → window._onShowAccreditationModal)
  const hucre = (rozet, alt = '', dugme = '') =>
    `<div class="akr-hucre">${rozet}${alt ? `<span class="akr-hucre-alt">${alt}</span>` : ''}${dugme}</div>`;
  const pencereDugmesi = (deptId, bodyId, sinif, metin) =>
    `<button type="button" class="btn btn-xs ${sinif}" onclick="window._onShowAccreditationModal('${deptId}','${bodyId}')">${metin}</button>`;

  // Bölüm satırları
  const deptRows = acikBolumler.map(dept => {
    const bodies = Object.entries(ACCREDITATION_BODIES);

    const bodyColumns = bodies.map(([bodyId, body]) => {
      // Bu bölüme uygulanabilir mi?
      const applicable = body.applicableTo.includes('all') ||
                         body.applicableTo.includes(dept.category || '');
      const acc = applicable ? dept.accreditation?.[bodyId] : null;
      if (!acc) {
        return `<td class="o"><span class="ob-soluk" title="${applicable ? 'Kayıt yok' : 'Bu kurum bu bölüme uygulanmıyor'}">—</span></td>`;
      }

      let cellContent = '';

      if (acc.status === 'granted') {
        const remaining = acc.expiresAt != null ? (acc.expiresAt - turn) : null;
        const expLabel  = acc.expiresAt != null ? turnToLabel(acc.expiresAt) : '—';
        const urgent    = typeof remaining === 'number' && remaining <= 2;
        cellContent = hucre(
          `<span class="ob-rozet ${urgent ? 'ob-rozet--uyari' : 'ob-rozet--iyi'} ob-rozet--kucuk">Akredite</span>`,
          `bitiş ${expLabel}${remaining != null ? ` · <b class="${urgent ? 'ob-uyari' : ''}">${remaining} dönem kaldı</b>` : ''}`,
          urgent ? pencereDugmesi(dept.id, bodyId, 'btn-warning', 'Yenile') : '');
      } else if (acc.status === 'applied' || acc.status === 'under_review') {
        const elapsed = turn - (acc.appliedAt || turn);
        const pt      = acc.processTime || body.processingTime.max;
        cellContent = hucre('<span class="ob-rozet ob-rozet--uyari ob-rozet--kucuk">Değerlendirmede</span>', `${elapsed}/${pt} dönem`);
      } else if (acc.status === 'expired') {
        cellContent = hucre('<span class="ob-rozet ob-rozet--kritik ob-rozet--kucuk">Süresi doldu</span>', '',
          pencereDugmesi(dept.id, bodyId, 'btn-warning', `Yenile · ${formatMoney(body.renewalCost)}`));
      } else if (acc.status === 'rejected') {
        cellContent = hucre('<span class="ob-rozet ob-rozet--kritik ob-rozet--kucuk">Reddedildi</span>', '',
          pencereDugmesi(dept.id, bodyId, 'btn-secondary', 'Yeniden başvur'));
      } else {
        // Başvuru yok: gereksinimler penceresinde gösterilir
        cellContent = hucre('', '', pencereDugmesi(dept.id, bodyId, 'btn-secondary', `Başvur · ${formatMoney(body.cost)}`));
      }

      return `<td class="o">${cellContent}</td>`;
    }).join('');

    // Etkin akreditasyon sayısı
    const accCount = Object.values(dept.accreditation).filter(a => a.status === 'granted').length;

    return `
      <tr>
        <td>
          <div class="akr-bolum">
            <span class="akr-bolum-ikon">${bolumIkonu(dept.id, 30, dept.icon || '🏫')}</span>
            <div>
              <div class="ob-ad">${dept.name}</div>
              <div class="akr-bolum-alt">${dept.shortName && dept.shortName !== dept.name ? dept.shortName : ''}${accCount > 0 ? ` <span class="ob-rozet ob-rozet--iyi ob-rozet--kucuk">${accCount} etkin</span>` : ''}</div>
            </div>
          </div>
        </td>
        ${bodyColumns}
      </tr>`;
  }).join('');

  // Tablo başlıkları
  const headerCols = Object.values(ACCREDITATION_BODIES).map(body =>
    `<th class="o">${body.icon} ${body.name}</th>`
  ).join('');

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-title">Akreditasyon Yönetimi</div>
        <div class="panel-subtitle">MÜDEK, ABET ve THEQA akreditasyonlarını yönetin</div>
      </div>
    </div>

    <div class="ob-yigin">
      <div class="ob-kutular">
        ${_obKutu('Etkin akreditasyon', totalAccredited, 'bölüm ve kurum', totalAccredited > 0 ? 'ob-iyi' : '')}
        ${_obKutu('Değerlendirmede', totalPending, 'başvuru', totalPending > 0 ? 'ob-uyari' : '')}
        ${_obKutu('Süresi dolan', totalExpired, 'yenilenmeli', totalExpired > 0 ? 'ob-kritik' : '')}
        ${_obKutu('Başvurabilir bölüm', acikBolumler.length, 'açık bölüm')}
      </div>

      <div class="ob-not">
        <div class="ob-not-baslik">Akreditasyon hakkında</div>
        <ul>
          <li><b>MÜDEK:</b> Türk mühendislik bölümleri için ulusal kalite güvencesi; mühendislik bölümlerine uygulanır.</li>
          <li><b>ABET:</b> Uluslararası mühendislik akreditasyonu; YKS sıralamasını iyileştirir, uluslararası tanınırlık sağlar.</li>
          <li><b>THEQA:</b> Körfez bölgesi yükseköğretim akreditasyonu; uluslararası öğrenci çekmeye yardımcı olur.</li>
        </ul>
        <p class="akr-not-alt">Her kurumun kendi gereksinimleri vardır; "Başvur" düğmesi gereksinimleri ve ücreti gösterir.</p>
      </div>

      <section class="ob-bolum">
        ${_obBaslik('akreditasyon', 'Bölümlerin akreditasyon durumu', acikBolumler.length || null)}
        ${acikBolumler.length === 0 ? `
          <div class="ob-bos">
            <i class="ikon ikon--akreditasyon" aria-hidden="true"></i>
            <div class="ob-bos-baslik">Akreditasyon yapısı kurulmamış</div>
            Mühendislik bölümleri açıldığında akreditasyon seçenekleri burada görünecek.
          </div>
        ` : `
          <div class="ob-tablo-kap">
            <table class="ob-tablo ob-tablo--genis akr-tablo">
              <thead>
                <tr>
                  <th>Bölüm</th>
                  ${headerCols}
                </tr>
              </thead>
              <tbody>${deptRows}</tbody>
            </table>
          </div>
        `}
      </section>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// KULÜPLER PANELİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Öğrenci Kulüpleri panelini render et.
 * Callbacks: window._onFoundClub(typeId), window._onUpgradeClub(clubId), window._onDissolveClub(clubId)
 */
export function renderClubsPanel(state) {
  const panel = el('tab-clubs');
  if (!panel) return;

  // CLUB_TYPES / CLUB_CATEGORIES main.js'te window üzerinden verilir
  const CLUB_TYPES      = window._CLUB_TYPES || {};
  const CLUB_CATEGORIES = window._CLUB_CATEGORIES || {};

  const clubs       = state.clubs?.active || [];
  const budget      = state.university?.budget || 0;

  // ── Özet ──────────────────────────────────────────────────────────────────
  const totalSatBonus  = state.clubs?.totalSatisfactionBonus || 0;
  const totalPresBonus = state.clubs?.totalPrestigeBonus     || 0;
  const totalCost      = clubs.reduce((sum, c) => {
    const t = CLUB_TYPES[c.typeId];
    return sum + (t ? t.semesterCost : 0);
  }, 0);

  const summaryBar = `
    <div class="ob-kutular">
      ${_obKutu('Etkin topluluk', clubs.length, 'kurulu topluluk')}
      ${_obKutu('Memnuniyet katkısı', `+${ondalikYaz(totalSatBonus, 1)}`, 'öğrenci memnuniyetine', totalSatBonus > 0 ? 'ob-iyi' : '')}
      ${_obKutu('Saygınlık katkısı', `+${ondalikYaz(totalPresBonus, 1)}`, 'dönem sonunda yansır', totalPresBonus > 0 ? 'ob-iyi' : '')}
      ${_obKutu('Dönemlik gider', formatMoney(totalCost), 'toplulukların gideri', totalCost > 0 ? 'ob-kritik' : '')}
    </div>`;

  // ── Etkin topluluklar ──────────────────────────────────────────────────────
  let activeSection = '';
  if (clubs.length === 0) {
    activeSection = `
      <div class="ob-bos">
        <i class="ikon ikon--topluluk" aria-hidden="true"></i>
        <div class="ob-bos-baslik">Henüz topluluk yok</div>
        Aşağıdaki katalogdan bir topluluk kurabilirsiniz.
      </div>`;
  } else {
    const cards = clubs.map(club => {
      const type  = CLUB_TYPES[club.typeId] || {};
      const level = club.level || 1;
      const maxLevel = type.maxLevel || 3;
      const satB  = type.satisfactionBonus?.[level] || 0;
      const presB = type.prestigeBonus?.[level]     || 0;
      const canUpgrade    = level < maxLevel;
      const upgradeCost   = canUpgrade ? (type.levelUpCost?.[level] || 0) : 0;
      const canAffordUpg  = budget >= upgradeCost;

      const upgradeBtn = canUpgrade
        ? `<button type="button" class="btn btn-sm btn-primary" onclick="window._onUpgradeClub(${club.id})" ${canAffordUpg ? '' : 'disabled'} title="${canAffordUpg ? '' : 'Yetersiz bütçe'}">
             Düzey ${sayiEkle(level + 1)} geliştir · ${formatMoney(upgradeCost)}
           </button>`
        : '<span class="ob-rozet ob-rozet--iyi ob-rozet--kucuk">En üst düzeyde</span>';

      return `
        <article class="ob-kart ob-kart--sutun topluluk-kart">
          <header class="ob-kimlik">
            <span class="ob-kimlik-ikon">${type.icon || '🎭'}</span>
            <div class="ob-kimlik-govde">
              <div class="ob-kimlik-ad">${club.name}</div>
              <div class="ob-kimlik-alt">${_obPuan(level, maxLevel, { etiket: 'Topluluk düzeyi' })} Düzey ${level}/${maxLevel}</div>
            </div>
          </header>
          <div class="ob-dizi">
            <span class="ob-rozet ob-rozet--iyi ob-rozet--kucuk">+${satB} memnuniyet</span>
            ${presB > 0 ? '<span class="ob-rozet ob-rozet--iyi ob-rozet--kucuk">saygınlığa katkı</span>' : ''}
            <span class="ob-rozet ob-rozet--kucuk">${formatMoney(type.semesterCost || 0)}/dönem</span>
          </div>
          <div class="ob-dugmeler ob-dugmeler--alt">
            ${upgradeBtn}
            <button type="button" class="btn btn-sm btn-danger" onclick="window._onDissolveClub(${club.id})"
                    title="Topluluğu kapat" aria-label="${club.name}: topluluğu kapat">Kapat</button>
          </div>
        </article>
      `;
    }).join('');

    activeSection = `<div class="ob-kartlar">${cards}</div>`;
  }

  // ── Topluluk kataloğu (kategoriye göre gruplu) ────────────────────────────
  const foundedTypeIds = new Set(clubs.map(c => c.typeId));

  const catalogSections = Object.entries(CLUB_CATEGORIES).map(([catId, cat]) => {
    const typeItems = Object.values(CLUB_TYPES).filter(t => t.category === catId);
    if (!typeItems.length) return '';

    const items = typeItems.map(type => {
      const alreadyFounded = foundedTypeIds.has(type.id);
      const canAfford      = budget >= type.foundingCost;
      const disabled       = alreadyFounded || !canAfford;
      const disabledReason = alreadyFounded ? 'Kurulu' : (!canAfford ? 'Yetersiz bütçe' : '');

      const satBonus1  = type.satisfactionBonus?.[1] || 0;
      const presBonus1 = type.prestigeBonus?.[1]     || 0;

      return `
        <article class="ob-kart ob-kart--sutun topluluk-secenek${alreadyFounded ? ' topluluk-secenek--kurulu' : ''}">
          <header class="ob-kimlik">
            <span class="ob-kimlik-ikon">${type.icon}</span>
            <div class="ob-kimlik-govde">
              <div class="ob-kimlik-ad">${type.name}</div>
              <div class="ob-kimlik-alt">${type.description}</div>
            </div>
          </header>
          <div class="ob-dizi">
            <span class="ob-rozet ob-rozet--iyi ob-rozet--kucuk">+${satBonus1} memnuniyet</span>
            ${presBonus1 > 0 ? '<span class="ob-rozet ob-rozet--iyi ob-rozet--kucuk">saygınlığa katkı</span>' : ''}
            <span class="ob-rozet ob-rozet--kucuk">${formatMoney(type.semesterCost)}/dönem</span>
          </div>
          <div class="ob-dugmeler ob-dugmeler--alt">
            <button type="button" class="btn btn-sm ${alreadyFounded ? 'btn-ghost' : 'btn-primary'}"
              onclick="window._onFoundClub('${type.id}')"
              ${disabled ? 'disabled' : ''}
              title="${disabledReason}">
              ${alreadyFounded ? 'Kurulu' : `Kur · ${formatMoney(type.foundingCost)}`}
            </button>
          </div>
        </article>
      `;
    }).join('');

    return `
      <div class="topluluk-kategori">
        <div class="ob-kart-baslik topluluk-kategori-baslik"><span>${cat.icon} ${cat.name}</span></div>
        <div class="ob-kartlar">${items}</div>
      </div>
    `;
  }).join('');

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-title">Öğrenci Toplulukları</div>
        <div class="panel-subtitle">Topluluklar öğrenci memnuniyetini ve saygınlığı artırır.</div>
      </div>
    </div>

    <div class="ob-yigin">
      ${summaryBar}

      <section class="ob-bolum">
        ${_obBaslik('topluluk', 'Etkin topluluklar', clubs.length || null)}
        ${activeSection}
      </section>

      <section class="ob-bolum">
        ${_obBaslik('topluluk', 'Topluluk kataloğu')}
        <div class="ob-aciklama">Kurmak istediğiniz topluluğu seçin; her topluluğun dönemlik bir gideri vardır.</div>
        <div class="ob-yigin ob-yigin--sik">
          ${catalogSections}
        </div>
      </section>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// SPOR PANELİ
// ─────────────────────────────────────────────────────────────────────────────

export function renderSportsPanel(state) {
  const panel = el('tab-sports');
  if (!panel) return;

  const sports      = state.sports || { teams: [], leagueResults: [], totalBudget: 0 };
  const teams       = sports.teams || [];
  const SPORTS_DATA = window._SPORTS || {};
  const hasFacility = (state.buildings || []).some(
    b => (b.type === 'spor_tesisi' || b.type === 'spor_merkezi') && b.isCompleted
  );

  const totalWins   = teams.reduce((s, t) => s + (t.wins   || 0), 0);
  const totalLosses = teams.reduce((s, t) => s + (t.losses || 0), 0);
  const champions   = teams.filter(t => t.leaguePosition === 1).length;
  // Dönemlik gider takımlardan hesaplanır (sports.js'teki totalBudget ile aynı formül; o yalnız sezon sonunda
  // güncellendiği için yeni kurulan takım bir dönem boyunca 0 ₺ görünüyordu). Spor verisi yoksa kayıttaki değer.
  const donemlikGider = Object.keys(SPORTS_DATA).length
    ? teams.reduce((s, t) => {
        const sp = SPORTS_DATA[t.sportId];
        return s + (sp ? (sp.semesterBudget || 0) + (sp.coachSalary || 0) : 0);
      }, 0)
    : (sports.totalBudget || 0);

  const availableSports = Object.values(SPORTS_DATA).filter(
    s => !teams.some(t => t.sportId === s.id)
  );

  // Sezon dökümü kısaltmasız ("3 galibiyet · 1 beraberlik · 2 mağlubiyet"; eskiden "3G-1B-2M")
  const sezonMetni = (g, b, m, beraberlikVar) =>
    [`${g} galibiyet`, beraberlikVar ? `${b} beraberlik` : null, `${m} mağlubiyet`].filter(Boolean).join(' · ');
  const siraRozeti = sira => sira === 1
    ? '<span class="ob-rozet ob-rozet--vurgu ob-rozet--kucuk">Şampiyon</span>'
    : sira ? `<span class="ob-rozet ob-rozet--kucuk">Ligde ${sira}.</span>` : '';

  const takimKartlari = teams.map(t => {
    const sport      = SPORTS_DATA[t.sportId] || {};
    const maxLevel   = sport.maxLevel || 5;
    const semCost    = (sport.semesterBudget || 0) + (sport.coachSalary || 0);
    const upgCost    = sport.upgradeCosts?.[t.level] || 0;
    const canUpgrade = t.level < maxLevel && state.university.budget >= upgCost;
    return `
      <article class="ob-kart ob-kart--sutun takim-kart">
        <header class="ob-kimlik">
          <span class="ob-kimlik-ikon">${t.icon}</span>
          <div class="ob-kimlik-govde">
            <div class="ob-kimlik-ad">${t.name}</div>
            <div class="ob-kimlik-alt">${_obPuan(t.level, maxLevel, { etiket: 'Takım düzeyi' })} Düzey ${t.level}/${maxLevel}</div>
          </div>
          ${siraRozeti(t.leaguePosition)}
        </header>
        <div>
          ${_obSatir('Sezon', sezonMetni(t.wins || 0, t.draws || 0, t.losses || 0, sport.allowsDraw !== false))}
          ${_obSatir('Sezon puanı', t.seasonPoints || 0)}
          ${_obSatir('Dönem maliyeti', formatMoney(semCost))}
        </div>
        <div class="ob-dugmeler ob-dugmeler--alt">
          ${t.level < maxLevel
            ? `<button type="button" class="btn btn-sm btn-primary" onclick="window._onUpgradeTeam(${t.id})" ${canUpgrade ? '' : 'disabled title="Yetersiz bütçe"'}>Düzey ${sayiEkle(t.level + 1)} yükselt · ${formatMoney(upgCost)}</button>`
            : '<span class="ob-rozet ob-rozet--iyi ob-rozet--kucuk">En üst düzeyde</span>'}
          <button type="button" class="btn btn-sm btn-danger" onclick="window._onDissolveTeam(${t.id})" title="Takımı kapat" aria-label="${t.name}: takımı kapat">Kapat</button>
        </div>
      </article>`;
  }).join('');

  const sonuclar = (sports.leagueResults || []).map(r => {
    const maclar = r.matches || [];
    const say    = sonuc => maclar.filter(m => m.result === sonuc).length;
    // Maç listesi yoksa kayıttaki "5G-2B-1M" dizgisi de kısaltmasız yazılır
    const kayitSayisi = harf => Number((String(r.record || '').match(new RegExp(`(\\d+)${harf}`)) || [])[1] || 0);
    const kayit  = maclar.length
      ? sezonMetni(say('win'), say('draw'), say('loss'), maclar.some(m => m.result === 'draw') || /B/.test(r.record || ''))
      : r.record ? sezonMetni(kayitSayisi('G'), kayitSayisi('B'), kayitSayisi('M'), /B/.test(r.record)) : '';
    return `
      <article class="ob-kart takim-sonuc">
        <header class="ob-kimlik">
          <span class="ob-kimlik-ikon">${r.icon}</span>
          <div class="ob-kimlik-govde">
            <div class="ob-kimlik-ad">${r.name}</div>
            <div class="ob-kimlik-alt">${kayit} · ${r.points} puan</div>
          </div>
          ${siraRozeti(r.position)}
        </header>
        ${maclar.length ? `<div class="ob-dizi takim-maclar">
          ${maclar.map(m => `<span class="ob-rozet ${m.result === 'win' ? 'ob-rozet--iyi' : m.result === 'draw' ? 'ob-rozet--uyari' : 'ob-rozet--kritik'} ob-rozet--kucuk"
            title="${m.result === 'win' ? 'Galibiyet' : m.result === 'draw' ? 'Beraberlik' : 'Mağlubiyet'}">${m.result === 'win' ? '✓' : m.result === 'draw' ? '=' : '✗'} ${m.opponent}</span>`).join('')}
        </div>` : ''}
      </article>`;
  }).join('');

  const yeniTakimlar = availableSports.map(s => {
    const needsFac  = s.requiresFacility && !hasFacility;
    const canAfford = state.university.budget >= s.foundingCost;
    const disabled  = needsFac || !canAfford;
    return `
      <article class="ob-kart ob-kart--sutun takim-secenek${disabled ? ' takim-secenek--pasif' : ''}">
        <header class="ob-kimlik">
          <span class="ob-kimlik-ikon">${s.icon}</span>
          <div class="ob-kimlik-govde">
            <div class="ob-kimlik-ad">${s.name}</div>
            <div class="ob-kimlik-alt">${s.description}</div>
          </div>
        </header>
        <div class="ob-dizi">
          <span class="ob-rozet ob-rozet--kucuk">${formatMoney(s.semesterBudget + s.coachSalary)}/dönem</span>
          ${s.requiresFacility
            ? (hasFacility
              ? '<span class="ob-rozet ob-rozet--iyi ob-rozet--kucuk">Tesis var</span>'
              : '<span class="ob-rozet ob-rozet--kritik ob-rozet--kucuk">Spor tesisi gerekli</span>')
            : '<span class="ob-rozet ob-rozet--kucuk">Tesis gerekmez</span>'}
        </div>
        <div class="ob-dugmeler ob-dugmeler--alt">
          <button type="button" class="btn btn-sm btn-primary" onclick="window._onFoundTeam('${s.id}')" ${disabled ? `disabled title="${needsFac ? 'Spor tesisi gerekli' : 'Yetersiz bütçe'}"` : ''}>
            Kur · ${formatMoney(s.foundingCost)}
          </button>
        </div>
      </article>`;
  }).join('');

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-title">Üniversite Sporları</div>
        <div class="panel-subtitle">${teams.length} etkin takım${hasFacility ? '' : ' · spor tesisi yok'}</div>
      </div>
    </div>

    <div class="ob-yigin">
      <div class="ob-kutular">
        ${_obKutu('Etkin takım', teams.length, 'kurulu takım')}
        ${_obKutu('Şampiyonluk', champions, 'bu sezon', champions > 0 ? 'ob-iyi' : '')}
        ${_obKutu('Galibiyet', totalWins, `${totalLosses} mağlubiyet`)}
        ${_obKutu('Dönemlik bütçe', formatMoney(donemlikGider), 'takımların gideri')}
      </div>

      ${hasFacility ? '' : `
        <div class="ob-not ob-not--uyari">
          <div class="ob-not-baslik">Spor tesisi yok</div>
          <p>Tesis gerektiren takımlar kurulamaz. Yerleşke sekmesinden spor tesisi yapabilirsiniz.</p>
        </div>`}

      ${teams.length > 0 ? `
        <section class="ob-bolum">
          ${_obBaslik('spor', 'Etkin takımlar', teams.length)}
          <div class="ob-kartlar">${takimKartlari}</div>
        </section>
      ` : ''}

      ${sonuclar ? `
        <section class="ob-bolum">
          ${_obBaslik('spor', 'Son sezon sonuçları')}
          <div class="ob-yigin ob-yigin--sik">${sonuclar}</div>
        </section>
      ` : ''}

      ${availableSports.length > 0 ? `
        <section class="ob-bolum">
          ${_obBaslik('spor', 'Yeni takım kur')}
          <div class="ob-kartlar">${yeniTakimlar}</div>
        </section>
      ` : ''}
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// LEADERBOARD PANELİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Leaderboard panelini render eder.
 * Firestore verilerini alıp #leaderboard-list div'ine yazar.
 * @param {Function} getTopScoresFn  leaderboard.js'ten gelen getTopScores fonksiyonu
 */
export async function renderLeaderboardPanel(getTopScoresFn) {
  // v0.6.1: sekmenin başlığı öteki sekmelerle aynı panel başlığı. index.html'deki satır içi stilli
  // başlık ilk çizimde bir kez değiştirilir; #leaderboard-list kimliği korunur.
  const panel = document.getElementById('tab-leaderboard');
  if (panel && !panel.querySelector('.panel-header')) {
    panel.innerHTML = `
      <div class="panel-header">
        <div>
          <div class="panel-title">En İyi Rektörler</div>
          <div class="panel-subtitle">Dünya genelindeki en başarılı rektörlerin listesi</div>
        </div>
        <div class="panel-dugmeler">
          <button id="lb-refresh-btn" class="btn btn-secondary btn-sm" type="button">Yenile</button>
        </div>
      </div>
      <div id="leaderboard-list"></div>`;
  }
  const container = document.getElementById('leaderboard-list');
  if (!container) return;

  container.innerHTML = '<div id="lb-content"><div class="ob-bos ob-bos--kucuk">Yükleniyor…</div></div>';

  // Yenile düğmesi başlıkta kalıcı; dinleyici bir kez bağlanır, güncel işlevi çağırır
  const yenile = document.getElementById('lb-refresh-btn');
  if (yenile) {
    yenile._getTopScoresFn = getTopScoresFn;
    if (!yenile._bagli) {
      yenile._bagli = true;
      yenile.addEventListener('click', () => renderLeaderboardPanel(yenile._getTopScoresFn));
    }
  }

  const contentEl = document.getElementById('lb-content');
  const madalya = pos => pos <= 3 ? ['🥇', '🥈', '🥉'][pos - 1] : `${pos}.`;

  try {
    const rows = await getTopScoresFn(50);

    if (!rows || rows.length === 0) {
      contentEl.innerHTML = `
        <div class="ob-bos">
          <i class="ikon ikon--eniyiler" aria-hidden="true"></i>
          <div class="ob-bos-baslik">Henüz skor yok</div>
          İlk skoru siz gönderebilirsiniz.
        </div>`;
      return;
    }

    // v0.4.42: rank artık Dünya Sırası (THE 2024). Bu tarihten önceki kayıtlar
    // eski TR sırasını (1-50) tutuyor; arayüzde "Eski TR" rozetiyle ayırt ediliyor.
    const _LB_INTL_CUTOFF_MS = new Date('2026-05-07T17:00:00Z').getTime();
    const tableRows = rows.map((r, idx) => {
      const pos    = idx + 1;
      const tsMs   = r.createdAt?.toDate ? r.createdAt.toDate().getTime()
                  : (r.createdAt?.seconds ? r.createdAt.seconds * 1000 : 0);
      const date   = tsMs ? new Date(tsMs).toLocaleDateString('tr-TR') : '—';
      // Eski TR rozeti: rank 1-50 aralığındaysa (eski sistem en çok 50) VE tarih kesim öncesindeyse.
      // rank > 50 olan kayıtlar zaten kesin yeni dünya sırası (eski sistemde olanaksız değer).
      const isOld  = r.rank != null && r.rank <= 50 && tsMs > 0 && tsMs < _LB_INTL_CUTOFF_MS;
      const rankCell = r.rank == null
        ? '<span class="ob-soluk">—</span>'
        : isOld
          ? `<span class="ob-rozet ob-rozet--kucuk" title="Eski Türkiye sıralaması (7 Mayıs 2026 öncesi kayıt)">Eski TR</span> <span class="ob-soluk">#${r.rank}</span>`
          : `#${r.rank}`;
      return `
        <tr class="${pos <= 3 ? `lb-ilk lb-ilk--${pos}` : ''}">
          <td class="o lb-sira">${madalya(pos)}</td>
          <td class="${pos <= 3 ? 'ob-ad' : ''}">${_escHtml(r.name ?? 'Anonim')}</td>
          <td class="n ob-kalin lb-skor">${(r.score ?? 0).toLocaleString('tr-TR')}</td>
          <td class="n">${r.year ?? '—'}. yıl</td>
          <td class="n ob-tek">${rankCell}</td>
          <td class="n">${r.prestige ?? '—'}</td>
          <td class="n ob-soluk">${date}</td>
        </tr>`;
    }).join('');

    contentEl.innerHTML = `
      <div class="ob-tablo-kap">
        <table class="ob-tablo lb-tablo">
          <thead>
            <tr>
              <th class="o">#</th>
              <th>Rektör</th>
              <th class="n">Skor</th>
              <th class="n">Yıl</th>
              <th class="n">Dünya sırası</th>
              <th class="n">Saygınlık</th>
              <th class="n">Tarih</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    // Çevrimiçi skor tablosu hatasında bu cihazdaki yedek skorları göster
    let localScores = [];
    try {
      localScores = JSON.parse(localStorage.getItem('rektor_oldum_local_scores') || '[]');
    } catch (e) { /* localStorage okunamadı */ }

    const banner = `
      <div class="ob-not ob-not--uyari lb-uyari">
        <div class="ob-not-baslik">Çevrimiçi skor tablosu şu an kullanılamıyor</div>
        <p>${localScores.length ? 'Aşağıda bu cihazda kayıtlı skorlar gösteriliyor.' : 'Bu cihazda da kayıtlı skor yok.'}</p>
      </div>`;

    if (!localScores.length) {
      contentEl.innerHTML = banner;
      return;
    }

    const localRows = localScores.slice(0, 50).map((r, idx) => {
      const pos = idx + 1;
      const date = r.savedAt ? new Date(r.savedAt).toLocaleDateString('tr-TR') : '—';
      return `
        <tr class="${pos <= 3 ? `lb-ilk lb-ilk--${pos}` : ''}">
          <td class="o lb-sira">${madalya(pos)}</td>
          <td class="${pos <= 3 ? 'ob-ad' : ''}">${_escHtml(r.name ?? 'Anonim')}</td>
          <td class="n ob-kalin lb-skor">${(r.score ?? 0).toLocaleString('tr-TR')}</td>
          <td class="n">${r.year ?? '—'}. yıl</td>
          <td class="n">${r.prestige ?? '—'}</td>
          <td class="n ob-soluk">${date}</td>
        </tr>`;
    }).join('');

    contentEl.innerHTML = banner + `
      <div class="ob-tablo-kap">
        <table class="ob-tablo lb-tablo">
          <thead>
            <tr>
              <th class="o">#</th>
              <th>Rektör</th>
              <th class="n">Skor</th>
              <th class="n">Yıl</th>
              <th class="n">Saygınlık</th>
              <th class="n">Tarih</th>
            </tr>
          </thead>
          <tbody>${localRows}</tbody>
        </table>
      </div>`;
  }
}

/** HTML özel karakterlerini kaçış için küçük yardımcı. */
function _escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────────────────────────────────────
// ULUSLARARASI SIRALAMA PANELİ (THE WUR 2024)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uluslararası sıralama panelini render eder.
 * tab-intl-ranking div'ine yazar.
 *
 * @param {object} state       — Oyun durumu
 * @param {object} theList     — THE_2024 verisi (intl_rankings_the2024.js)
 * @param {Function} calcPillars  — calculateIntlPillars(state)
 * @param {Function} calcTotal    — calculateIntlTotalScore(pillars, weights)
 * @param {Function} findRank     — findIntlRank(total, theList)
 * @param {Function} getNeighborsF — getNeighbors(total, theList, 5)
 * @param {Function} filterCountry — filterByCountry(theList, code)
 */
export function renderInternationalRankingPanel(
  state, theList,
  calcPillars, calcTotal, findRank, getNeighborsF, filterCountry,
) {
  const panel = el('tab-intl-ranking');
  if (!panel) return;

  const pillars    = calcPillars(state);
  const total      = calcTotal(pillars, theList.pillarsWeights);
  const worldRank  = findRank(total, theList);
  const { above, below } = getNeighborsF(total, theList, 5);

  // Türkiye sıralaması
  const trUnis     = filterCountry(theList, 'TR');
  const trRanked   = trUnis.filter(u => u.total > 0)
    .sort((a, b) => b.total - a.total);
  // Oyuncunun Türkiye sırası: kaç Türk üniversitesi oyuncudan yüksek puanlı
  const trRank     = trRanked.filter(u => u.total > total).length + 1;
  const trTotal    = trRanked.length;

  // THE'nin beş ana ölçütü (v0.6.1: tek renk çubuk; ağırlıklar Türkçe ondalıkla)
  const pillarDefs = [
    { key: 'teaching',            label: 'Eğitim',             pct: 29.5 },
    { key: 'researchEnvironment', label: 'Araştırma ortamı',   pct: 29.0 },
    { key: 'citations',           label: 'Atıflar',            pct: 30.0 },
    { key: 'international',       label: 'Uluslararası görünüm', pct: 7.5 },
    { key: 'industry',            label: 'Sanayi',             pct:  4.0 },
  ];

  const uniAdi   = u => _escHtml(u.nameTr || u.name);
  const siraAdi  = u => u.rank ? `#${u.rank}` : (u.rankBand || '—');
  const puan     = _dunyaPuani;
  const benSatiri = siraMetni => `
    <tr class="dunya-sen">
      <td class="n ob-kalin">${siraMetni}</td>
      <td class="ob-ad">${_escHtml(state.university?.name || '—')} <span class="ob-rozet ob-rozet--vurgu ob-rozet--kucuk">Siz</span></td>
      <td>Türkiye</td>
      <td class="n ob-kalin">${puan(total)}</td>
    </tr>`;
  const uniSatiri = (u, sira) => `
    <tr>
      <td class="n ob-soluk">${sira}</td>
      <td>${uniAdi(u)}</td>
      <td class="ob-soluk">${u.countryTr || u.country}</td>
      <td class="n">${puan(u.total)}</td>
    </tr>`;
  const tablo = (govde, siraBasligi = 'Sıra') => `
    <div class="ob-tablo-kap">
      <table class="ob-tablo dunya-tablo">
        <thead>
          <tr><th class="n">${siraBasligi}</th><th>Üniversite</th><th>Ülke</th><th class="n">Puan</th></tr>
        </thead>
        <tbody>${govde}</tbody>
      </table>
    </div>`;

  // İlk 10 (listenin ilk 10 kaydı)
  const top10Rows = theList.universities.slice(0, 10).map((u, i) => `
    <tr>
      <td class="n ob-kalin${i === 0 ? ' dunya-bir' : ''}">${i + 1}</td>
      <td class="${i < 3 ? 'ob-ad' : ''}">${uniAdi(u)}</td>
      <td class="ob-soluk">${u.countryTr || u.country}</td>
      <td class="n">${puan(u.total)}</td>
    </tr>`).join('');

  // Komşular: üsttekiler, siz, alttakiler. getNeighbors üsttekileri en yakından başlayarak verir;
  // tabloda sıra numarası yukarıdan aşağı artsın diye ters çevrilir (eski tabloda #108, #98, #94 ... diye ters diziliyordu)
  const neighborsRows = [
    ...[...above].reverse().map(u => uniSatiri(u, siraAdi(u))),
    benSatiri(`#${worldRank}`),
    ...below.map(u => uniSatiri(u, siraAdi(u))),
  ].join('');

  // Türkiye: ilk 8 Türk üniversitesi; sizin yeriniz araya (ya da aradan sonra sona) yazılır,
  // sizden sonraki üniversitelerin sırası bir kayar
  const trIlk = trRanked.slice(0, 8);
  const trSatirlari = trIlk.map((u, i) => {
    const onceBen = trRank === i + 1 ? benSatiri(`${trRank}.`) : '';
    return onceBen + uniSatiri(u, `${i + 1 + (trRank <= i + 1 ? 1 : 0)}.`);
  }).join('')
    + (trRank > trIlk.length + 1 ? '<tr class="dunya-arada"><td colspan="4">…</td></tr>' : '')
    + (trRank > trIlk.length ? benSatiri(`${trRank}.`) : '');

  // Ülke süzgeci; tablo _renderIntlFilteredTable ile #intl-filtered-table'a yazılır
  const countryOptions = [
    { code: 'ALL', label: 'Tüm ülkeler' },
    { code: 'TR',  label: 'Türkiye' },
    { code: 'US',  label: 'ABD' },
    { code: 'GB',  label: 'Birleşik Krallık' },
    { code: 'DE',  label: 'Almanya' },
    { code: 'CH',  label: 'İsviçre' },
    { code: 'CN',  label: 'Çin' },
    { code: 'JP',  label: 'Japonya' },
    { code: 'SG',  label: 'Singapur' },
    { code: 'AU',  label: 'Avustralya' },
    { code: 'CA',  label: 'Kanada' },
  ].map(o => `<option value="${o.code}">${o.label}</option>`).join('');

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-title">Dünya Sırası</div>
        <div class="panel-subtitle">Times Higher Education (THE) 2024 dünya üniversite sıralamasına göre konumunuz</div>
      </div>
    </div>

    <div class="ob-yigin">
      <div class="ob-kutular">
        ${_obKutu('Toplam puan', `${ondalikYaz(total, 1)}<small>/100</small>`, 'THE yöntemiyle')}
        ${_obKutu('Dünya sırası', `#${formatNumber(worldRank)}`, `${formatNumber(theList.totalRanked)} üniversite içinde`)}
        ${_obKutu('Türkiye sırası', `#${trRank}`, `${trTotal} Türk üniversitesi içinde`)}
      </div>

      <div class="ob-iki">
        <section class="ob-bolum">
          ${_obBaslik('dunya', 'Ölçüt puanlarınız')}
          <div class="ob-kart dunya-olcutler">
            ${pillarDefs.map(p => `
              <div class="dunya-olcut">
                ${_obSatir(p.label, `${ondalikYaz(pillars[p.key], 1)}<span class="ob-soluk">/100 · ağırlık %${ondalikYaz(p.pct, 1)}</span>`)}
                <div class="ob-cubuk"><span style="width:${Math.max(0, Math.min(100, Number(pillars[p.key]) || 0))}%"></span></div>
              </div>`).join('')}
            <div class="ob-aciklama">Toplam puan bu beş ölçütün ağırlıklı ortalamasıdır.</div>
          </div>
        </section>

        <section class="ob-bolum">
          ${_obBaslik('dunya', 'Sıralamada komşularınız')}
          ${tablo(neighborsRows)}
        </section>
      </div>

      <div class="ob-iki">
        <section class="ob-bolum">
          ${_obBaslik('dunya', "Türkiye'deki konumunuz")}
          ${trIlk.length ? tablo(trSatirlari) : '<div class="ob-bos ob-bos--kucuk">Türk üniversitesi verisi bulunamadı.</div>'}
        </section>

        <section class="ob-bolum">
          ${_obBaslik('dunya', 'Dünyanın en iyi 10 üniversitesi')}
          ${tablo(top10Rows)}
        </section>
      </div>

      <section class="ob-bolum">
        ${_obBaslik('dunya', 'Sıralama tablosu')}
        <div class="kadro-arac dunya-arac">
          <label class="dunya-arac-e" for="intl-country-filter">Ülke</label>
          <select id="intl-country-filter" class="ob-secim">
            ${countryOptions}
          </select>
        </div>
        <div id="intl-filtered-table"></div>
      </section>

      <div class="ob-tablo-dip">
        Kaynak: Times Higher Education World University Rankings 2024. Ölçüt puanlarınız oyunun işleyişinden
        türetilir; gerçek bir ölçüm değildir.
      </div>
    </div>
  `;

  // Ülke süzgeci: her sayfa açılışında taze çizim
  const filterSel = document.getElementById('intl-country-filter');
  if (filterSel) {
    filterSel.addEventListener('change', () => {
      _renderIntlFilteredTable(filterSel.value, theList, filterCountry);
    });
    _renderIntlFilteredTable('ALL', theList, filterCountry);
  }
}

/** Dünya Sırası tablolarında puan: tek ondalık basamak, Türkçe virgül (96.4 → "96,4", 46 → "46,0"). */
function _dunyaPuani(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—';
}

/**
 * Ülke süzgeçli tabloyu #intl-filtered-table'a yazar.
 * @param {string}   countryCode
 * @param {object}   theList
 * @param {Function} filterCountry
 */
function _renderIntlFilteredTable(countryCode, theList, filterCountry) {
  const container = document.getElementById('intl-filtered-table');
  if (!container) return;

  let unis;
  if (countryCode === 'ALL') {
    // Tüm ülkeler: ilk 30 kayıt
    unis = theList.universities.slice(0, 30);
  } else {
    unis = filterCountry(theList, countryCode);
  }

  if (!unis || unis.length === 0) {
    container.innerHTML = '<div class="ob-bos ob-bos--kucuk">Bu ülkeden kayıtlı üniversite yok.</div>';
    return;
  }

  const rows = unis.map(u => `
    <tr>
      <td class="n ob-soluk">${u.rank ? `#${u.rank}` : (u.rankBand || '—')}</td>
      <td>${_escHtml(u.nameTr || u.name)}</td>
      <td class="ob-soluk">${u.countryTr || u.country}</td>
      <td class="n">${_dunyaPuani(u.total)}</td>
    </tr>`).join('');

  container.innerHTML = `
    <div class="ob-kart-baslik dunya-tablo-baslik">
      <span>${countryCode === 'ALL' ? 'İlk 30 üniversite' : `${unis[0]?.countryTr || countryCode} üniversiteleri`}</span>
      <span class="ob-sayi">${unis.length}</span>
    </div>
    <div class="ob-tablo-kap">
      <table class="ob-tablo dunya-tablo">
        <thead>
          <tr><th class="n">Sıra</th><th>Üniversite</th><th>Ülke</th><th class="n">Puan</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}
