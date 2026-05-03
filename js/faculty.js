/**
 * Rektör Oldum — Hoca/Kadro Sistemi (faculty.js)
 * Araştırma görevlisinden profesöre tüm akademik kadro yönetimi.
 * ES6 module, Türkçe yorumlar.
 */

import {
  FACULTY_NAME_POOL,
  FACULTY_TITLES,
  DEPARTMENTS,
  SALARY_SCALES,
} from './data.js?v=0.4.19';

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI FONKSİYONLAR
// ─────────────────────────────────────────────────────────────────────────────

/** [min, max] aralığında rastgele tam sayı (her iki uç dahil) */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** [min, max] aralığında rastgele ondalıklı sayı */
function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

/** Diziden rastgele bir eleman seç */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Benzersiz hoca ID üreteci.
 *  Eski sürümlerde sadece artan sayaç kullanılıyordu; sayfa yenilendiğinde
 *  veya kayıt yüklendiğinde sayaç 1'e sıfırlanıyor, yeni adayların id'si
 *  mevcut hocalarla çakışıyordu (kadroda yanlış hoca açılması — Emir/X 03.05).
 *  Şimdi zaman + sayaç birleşimi: aynı oturumda da çakışmaz, oturumlar
 *  arasında da çakışmaz. */
let _idCounter = 1;
const _idSessionSeed = Date.now().toString(36);
function nextId() {
  return `${_idSessionSeed}_${_idCounter++}`;
}

/** Mevcut state'i tarayıp en yüksek sayıyı bulamayız çünkü artık ID format'ı
 *  rasgele. Çakışma migration'ı game.js setState içinde id seti üzerinden
 *  yapılır (yinelenen id'lere yeni unique id atanır). */
export function generateUniqueFacultyId() {
  return `fac_${nextId()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ALAN HARİTASI
// Her bölüm için çalışma alanları (uzmanlık seçenekleri)
// ─────────────────────────────────────────────────────────────────────────────

export const DEPARTMENT_FIELDS = {
  bilgisayar_muh:      ['Yazılım Mühendisliği', 'Ağ Sistemleri', 'Veri Tabanları', 'Gömülü Sistemler', 'Bilgisayar Mimarisi', 'Güvenlik', 'Görüntü İşleme'],
  elektrik_elektronik: ['Güç Sistemleri', 'Sinyal İşleme', 'Mikrodenetleyiciler', 'Devre Tasarımı', 'Haberleşme', 'Antenler ve Yayılım'],
  makine:              ['Termodinamik', 'Akışkanlar Mekaniği', 'Malzeme Bilimi', 'İmalat', 'Mekatronik', 'Enerji Sistemleri'],
  insaat:              ['Yapı Mühendisliği', 'Geoteknik', 'Ulaştırma', 'Su Kaynakları', 'Çevre Mühendisliği', 'Deprem Mühendisliği'],
  endustri:            ['Operasyon Araştırması', 'Üretim Sistemleri', 'Lojistik', 'Kalite Yönetimi', 'İnsan Faktörleri'],
  biyomedikal:         ['Tıbbi Görüntüleme', 'Biyomekanik', 'Biyoelektronik', 'Doku Mühendisliği', 'Protez Tasarımı'],
  yapay_zeka:          ['Makine Öğrenmesi', 'Derin Öğrenme', 'Doğal Dil İşleme', 'Bilgisayarla Görü', 'Robotik', 'Pekiştirmeli Öğrenme'],
  fizik:               ['Kuantum Fiziği', 'Parçacık Fiziği', 'Yoğun Madde', 'Astrofizik', 'Optik', 'Teorik Fizik'],
  kimya:               ['Organik Kimya', 'Anorganik Kimya', 'Fizikokimya', 'Analitik Kimya', 'Polimer Kimyası'],
  matematik:           ['Analiz', 'Cebir', 'Topoloji', 'İstatistik', 'Uygulamalı Matematik', 'Sayısal Yöntemler'],
  biyoloji:            ['Moleküler Biyoloji', 'Genetik', 'Ekoloji', 'Mikrobiyoloji', 'Biyokimya', 'Evrimsel Biyoloji'],
  isletme:             ['Finans', 'Pazarlama', 'Stratejik Yönetim', 'Girişimcilik', 'İnsan Kaynakları', 'Muhasebe'],
  iktisat:             ['Makroekonomi', 'Mikroekonomi', 'Ekonometri', 'Kalkınma Ekonomisi', 'Para Teorisi'],
  hukuk:               ['Medeni Hukuk', 'Ticaret Hukuku', 'Ceza Hukuku', 'Anayasa Hukuku', 'Uluslararası Hukuk'],
  psikoloji:           ['Klinik Psikoloji', 'Bilişsel Psikoloji', 'Sosyal Psikoloji', 'Nöropsikoloji', 'Gelişim Psikolojisi'],
  tip:                 ['Kardiyoloji', 'Onkoloji', 'Nöroloji', 'Dahiliye', 'Cerrahi', 'Pediatri', 'Radyoloji'],
  dis_hekimligi:       ['Ortodonti', 'Oral Cerrahi', 'Endodonti', 'Periodontoloji', 'Protetik Diş Tedavisi'],
  eczacilik:           ['Farmakoloji', 'Farmasötik Kimya', 'Klinik Eczacılık', 'Farmakognozy'],
  hemsirelik:          ['Dahiliye Hemşireliği', 'Cerrahi Hemşirelik', 'Toplum Sağlığı', 'Yoğun Bakım'],
};

// Ana alan adları (her bölüm için birincil alan)
export const DEPARTMENT_MAIN_FIELD = {
  bilgisayar_muh:      'Bilgisayar Mühendisliği',
  elektrik_elektronik: 'Elektrik-Elektronik Mühendisliği',
  makine:              'Makine Mühendisliği',
  insaat:              'İnşaat Mühendisliği',
  endustri:            'Endüstri Mühendisliği',
  biyomedikal:         'Biyomedikal Mühendisliği',
  yapay_zeka:          'Yapay Zeka',
  fizik:               'Fizik',
  kimya:               'Kimya',
  matematik:           'Matematik',
  biyoloji:            'Biyoloji',
  isletme:             'İşletme',
  iktisat:             'İktisat',
  hukuk:               'Hukuk',
  psikoloji:           'Psikoloji',
  tip:                 'Tıp',
  dis_hekimligi:       'Diş Hekimliği',
  eczacilik:           'Eczacılık',
  hemsirelik:          'Hemşirelik',
};

// Bölüm kategorisine göre baz maaşlar (aylık ₺)
const BASE_SALARY_BY_CATEGORY = {
  muhendislik: 30_000,
  temel_bilim:  22_000,
  sosyal:       20_000,
  saglik:       35_000,
};

// Unvana göre maaş çarpanları (baz maaş × çarpan)
const TITLE_SALARY_MULTIPLIER = {
  argö:          1.0,
  dr_ogr_uyesi:  1.8,
  docent:        2.3,
  profesor:      3.0,
};

// ─────────────────────────────────────────────────────────────────────────────
// MAAŞ BAREMI HESAPLAMA
// Üniversite tipine ve hoca kıdemine göre maaş hesapla
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Üniversite tipine göre doğru baremi seç.
 * @param {string} universityType — 'devlet' | 'vakif' | 'us_private'
 * @returns {object} Barem objesi
 */
export function getSalaryScale(universityType) {
  if (universityType === 'devlet')     return SALARY_SCALES.tr_devlet;
  if (universityType === 'us_private') return SALARY_SCALES.us_private;
  return SALARY_SCALES.tr_vakif;
}

/**
 * Hocanın maaşını unvan, bölüm kategorisi ve kıdemine göre hesapla.
 * @param {string} title          — 'argö' | 'dr_ogr_uyesi' | 'docent' | 'profesor'
 * @param {string} universityType — 'devlet' | 'vakif' | 'us_private'
 * @param {number} [seniority]    — Kıdem yılı (varsayılan 0)
 * @param {string} [category]     — Bölüm kategorisi (mühendislik/saglik vb. küçük çarpan)
 * @returns {number} Aylık maaş (₺)
 */
export function calculateFacultySalary(title, universityType, seniority = 0, category = 'muhendislik') {
  const scale = getSalaryScale(universityType);
  const range = scale[title] || scale['dr_ogr_uyesi'];

  // Baz maaş: barem ortası
  let base = Math.round((range.min + range.max) / 2);

  // Sağlık bölümleri biraz daha yüksek, sosyal biraz daha düşük
  if (category === 'saglik')      base = Math.round(base * 1.15);
  if (category === 'sosyal')      base = Math.round(base * 0.90);
  if (category === 'temel_bilim') base = Math.round(base * 0.95);

  // Kıdem bonusu
  const seniorityMultiplier = 1 + Math.min(seniority, 30) * scale.seniorityBonus;
  let salary = Math.round(base * seniorityMultiplier);

  // Barem sınırları (devlette aşılamaz, vakıfta maxOverscale kadar)
  const maxAllowed = Math.round(range.max * (scale.maxOverscale || 1.0));
  salary = Math.min(salary, maxAllowed);
  salary = Math.max(salary, range.min);

  return salary;
}

/**
 * Barem bilgisini okunabilir formatta döndür.
 * @param {string} title          — Unvan
 * @param {string} universityType — Üniversite tipi
 * @returns {{ min: number, max: number, scaleName: string }}
 */
export function getSalaryRange(title, universityType) {
  const scale = getSalaryScale(universityType);
  const range = scale[title] || scale['dr_ogr_uyesi'];
  return { min: range.min, max: range.max, scaleName: scale.name };
}

// Unvana göre başlangıç yayın sayıları
const TITLE_PUBLICATION_BASE = {
  argö:          { min: 0,  max: 3  },
  dr_ogr_uyesi:  { min: 3,  max: 12 },
  docent:        { min: 10, max: 30 },
  profesor:      { min: 25, max: 80 },
};

// Unvana göre yaş aralıkları
const TITLE_AGE_RANGE = {
  argö:          { min: 25, max: 30 },
  dr_ogr_uyesi:  { min: 30, max: 40 },
  docent:        { min: 35, max: 50 },
  profesor:      { min: 45, max: 65 },
};

// Unvana göre stat ağırlıkları (araştırma odaklı mı, eğitim odaklı mı)
const TITLE_STAT_BIAS = {
  argö:          { research: [20, 60], teaching: [30, 70] },
  dr_ogr_uyesi:  { research: [35, 75], teaching: [35, 75] },
  docent:        { research: [45, 85], teaching: [40, 80] },
  profesor:      { research: [55, 95], teaching: [45, 85] },
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. generateFaculty — Rastgele hoca üret
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verilen seçeneklere göre rastgele bir hoca objesi üretir.
 * @param {object} options
 * @param {string} [options.department]  - Bölüm id (ör. 'bilgisayar_muh')
 * @param {string} [options.title]       - Unvan: 'argö'|'dr_ogr_uyesi'|'docent'|'profesor'
 * @param {number} [options.minQuality]  - Minimum genel kalite (1-100, stat ortalaması)
 * @param {number} [options.maxQuality]  - Maksimum genel kalite (1-100)
 * @param {number} [options.currentTurn] - Geçerli oyun dönemi (sözleşme başlangıcı için)
 * @returns {object} Hoca objesi
 */
export function generateFaculty(options = {}) {
  const {
    department = null,
    title = null,
    minQuality = 1,
    maxQuality = 100,
    currentTurn = 1,
    universityType = 'vakif',
  } = options;

  // Unvan belirle
  const resolvedTitle = title || pick(['argö', 'dr_ogr_uyesi', 'docent', 'profesor']);

  // Cinsiyet ve isim
  const gender = Math.random() < 0.45 ? 'female' : 'male';
  const firstName = pick(FACULTY_NAME_POOL[gender]);
  const surname = pick(FACULTY_NAME_POOL.surname);
  const name = `${firstName} ${surname}`;

  // Yaş
  const ageRange = TITLE_AGE_RANGE[resolvedTitle];
  const age = randInt(ageRange.min, ageRange.max);

  // Bölüm
  const resolvedDept = department || pick(Object.keys(DEPARTMENTS));
  const deptData = DEPARTMENTS[resolvedDept];
  const category = deptData ? deptData.category : 'muhendislik';

  // Alan
  const mainField = DEPARTMENT_MAIN_FIELD[resolvedDept] || resolvedDept;
  const fieldPool = DEPARTMENT_FIELDS[resolvedDept] || [mainField];
  const specCount = randInt(1, 3);
  const shuffled = [...fieldPool].sort(() => Math.random() - 0.5);
  const specializations = shuffled.slice(0, Math.min(specCount, shuffled.length));

  // Stat üretimi — kalite kısıtına uyarak
  const statBias = TITLE_STAT_BIAS[resolvedTitle];
  const qualityFactor = (minQuality + maxQuality) / 2 / 100;

  function genStat(range) {
    const raw = randInt(range[0], range[1]);
    // Kalite faktörüyle ölçekle
    const scaled = Math.round(raw * (0.6 + qualityFactor * 0.8));
    return Math.min(100, Math.max(1, scaled));
  }

  const researchStat  = genStat(statBias.research);
  const teachingStat  = genStat(statBias.teaching);
  const manageStat    = randInt(10, 70);
  const mentorStat    = randInt(15, 75);
  const popularityStat = randInt(10, 80);
  const loyaltyStat   = randInt(40, 90);
  const motivationStat = randInt(60, 90);

  // Gizli özellikler
  const potential = randInt(
    Math.max(researchStat, teachingStat),
    Math.min(100, Math.max(researchStat, teachingStat) + randInt(5, 30))
  );
  const timeManagement = randInt(20, 90);

  // Stat belirsizliği (ilk dönem ±15)
  const UNCERTAINTY = 15;
  const revealed = {
    research: {
      min: Math.max(1, researchStat - UNCERTAINTY),
      max: Math.min(100, researchStat + UNCERTAINTY),
      exact: false,
    },
    teaching: {
      min: Math.max(1, teachingStat - UNCERTAINTY),
      max: Math.min(100, teachingStat + UNCERTAINTY),
      exact: false,
    },
  };

  // Kıdem (yaş - başlangıç yaşı tahmini)
  const titleStartAge = TITLE_AGE_RANGE[resolvedTitle]?.min ?? 25;
  const seniority = Math.max(0, age - titleStartAge);

  // Maaş hesapla — barem bazlı
  const salary = calculateFacultySalary(resolvedTitle, universityType, seniority, category);

  // Barem aralığı (UI'da göstermek için)
  const salaryRange = getSalaryRange(resolvedTitle, universityType);

  // Yayın ve atıf
  const pubRange = TITLE_PUBLICATION_BASE[resolvedTitle];
  const publications = randInt(pubRange.min, pubRange.max);
  const citationMultiplier = randFloat(1.5, 8.0);
  const citations = Math.round(publications * citationMultiplier);
  const hIndex = Math.floor(Math.sqrt(citations));

  // Deneyim yılı
  const expRanges = { argö: { min:0, max:3 }, dr_ogr_uyesi: { min:3, max:10 }, docent: { min:10, max:20 }, profesor: { min:20, max:35 } };
  const expR = expRanges[resolvedTitle] || { min: 0, max: 5 };
  const yearsExperience = randInt(expR.min, expR.max);

  // Aktif proje sayısı
  const activeProjects = resolvedTitle === 'argö'
    ? randInt(0, 1)
    : resolvedTitle === 'dr_ogr_uyesi'
      ? randInt(0, 2)
      : randInt(1, 3);

  // Araştırma alanları
  const researchAreas = [...specializations];

  // Önceki üniversite (inline havuz)
  const _prevUniPool = [
    'ODTÜ', 'Boğaziçi Üniversitesi', 'İTÜ', 'Hacettepe Üniversitesi',
    'Bilkent Üniversitesi', 'Koç Üniversitesi', 'Sabancı Üniversitesi',
    'Ankara Üniversitesi', 'İstanbul Üniversitesi', 'Ege Üniversitesi',
    'Gazi Üniversitesi', 'Dokuz Eylül Üniversitesi', 'Yıldız Teknik Üniversitesi',
    'Gebze Teknik Üniversitesi', 'TOBB ETÜ', 'Marmara Üniversitesi',
    'Karadeniz Teknik Üniversitesi', 'Erciyes Üniversitesi', 'Selçuk Üniversitesi',
    'Akdeniz Üniversitesi', 'Uludağ Üniversitesi', 'Pamukkale Üniversitesi',
  ];
  const _phdPrestigiousPool = [
    'MIT', 'Stanford Üniversitesi', 'Carnegie Mellon', 'ETH Zürich',
    'Oxford Üniversitesi', 'Cambridge Üniversitesi', 'Caltech',
    'Princeton Üniversitesi', 'UC Berkeley', 'Imperial College London',
    'EPFL', 'Georgia Tech', 'University of Michigan',
  ];
  const previousUniversity = pick(_prevUniPool);
  const previousDepartment = mainField;

  // Doktora bilgisi
  const phdYear = new Date().getFullYear() - yearsExperience - randInt(1, 3);
  const usePrestigious = resolvedTitle === 'profesor' || (resolvedTitle === 'docent' && Math.random() < 0.4);
  const phdUni = usePrestigious ? pick(_phdPrestigiousPool) : pick(_prevUniPool);
  const education = {
    phd:  `${phdUni} — ${mainField}`,
    year: Math.max(1990, Math.min(new Date().getFullYear() - 1, phdYear)),
  };

  // Öğrenci değerlendirme puanı
  const teachingScore = resolvedTitle === 'argö'
    ? randInt(40, 75)
    : resolvedTitle === 'dr_ogr_uyesi'
      ? randInt(50, 85)
      : randInt(55, 95);

  // Sözleşme
  const contract = {
    startTurn: currentTurn,
    endTurn: resolvedTitle === 'argö'
      ? currentTurn + randInt(4, 8)   // Araştırma görevlisi: 2-4 yıl (dönem başına)
      : null,                          // Diğerleri: belirsiz süreli
  };

  // Arketip
  const stats = { research: researchStat, teaching: teachingStat, management: manageStat, mentoring: mentorStat, popularity: popularityStat };
  const archetype = determineFacultyArchetype(stats);

  // Başlangıç mutluluğu (state olmadığı için basit hesap)
  const happiness = Math.round(50 + (loyaltyStat - 50) * 0.3 + (motivationStat - 70) * 0.2);

  return {
    id: `fac_${nextId()}`,
    name,
    gender,
    age,
    title: resolvedTitle,
    department: resolvedDept,
    field: mainField,
    specializations,
    stats: {
      research:   researchStat,
      teaching:   teachingStat,
      management: manageStat,
      mentoring:  mentorStat,
      popularity: popularityStat,
      loyalty:    loyaltyStat,
      motivation: motivationStat,
    },
    hidden: {
      potential,
      timeManagement,
    },
    revealed,
    salary,
    salaryRange,
    seniority,
    contract,
    happiness: Math.max(10, Math.min(100, happiness)),
    publications,
    citations,
    hIndex,
    yearsExperience,
    activeProjects,
    researchAreas,
    previousUniversity,
    previousDepartment,
    education,
    teachingScore,
    currentLoad: {
      courses:    0,
      adminRole:  null,
      gradStudents: 0,
    },
    archetype,
    avatar: _generateAvatar(resolvedTitle, gender),
    ratingHistory: [],
    overallRating: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 5: AVATAR SİSTEMİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hoca için görsel avatar özellikleri üretir.
 */
function _generateAvatar(title, gender) {
  const skinTones = ['#F5D6B8', '#D4A574', '#8D5524', '#C68642', '#E8BEAC'];
  const hairColors = ['#2C1810', '#4A3728', '#8B7355', '#1A1A2E', '#463E3F'];
  const grayHair   = '#A0A0A0';

  // Unvana göre yaş görünümü
  const ageMap = { argö: 'young', dr_ogr_uyesi: 'mid', docent: 'senior', profesor: 'old' };
  const ageAppearance = ageMap[title] || 'mid';

  // Yaşlı/orta yaşlı hocanın saçı gri/beyaz olabilir
  let hairColor;
  if (ageAppearance === 'old') {
    hairColor = Math.random() < 0.7 ? grayHair : pick(hairColors);
  } else if (ageAppearance === 'senior') {
    hairColor = Math.random() < 0.3 ? grayHair : pick(hairColors);
  } else {
    hairColor = pick(hairColors);
  }

  const maleHairStyles   = ['short', 'medium', 'bald', 'receding', 'short'];
  const femaleHairStyles = ['long', 'medium', 'long', 'short', 'bun'];
  const hairStyle = gender === 'female' ? pick(femaleHairStyles) : pick(maleHairStyles);

  // Yaşlı erkekler daha sık kel/çekilmiş
  const finalHairStyle = (ageAppearance === 'old' && gender === 'male' && Math.random() < 0.5)
    ? 'bald' : hairStyle;

  const beardOptions = ['none', 'none', 'none', 'short', 'goatee', 'mustache', 'full'];
  const beardStyle   = gender === 'male' ? pick(beardOptions) : 'none';

  const accessories = [null, null, null, 'tie', 'bowtie'];
  if (title === 'profesor' || title === 'docent') accessories.push('tie', 'tie');
  const accessory = pick(accessories);

  return {
    skinTone:      pick(skinTones),
    hairColor,
    hairStyle:     finalHairStyle,
    gender,
    glasses:       Math.random() > (ageAppearance === 'young' ? 0.65 : 0.4),
    beardStyle,
    accessory,
    ageAppearance,
  };
}

/**
 * SVG avatar oluşturur ve HTML string olarak döndürür.
 * @param {object} avatar — _generateAvatar() çıktısı
 * @param {number} [size] — px cinsinden boyut (varsayılan 48)
 * @returns {string} SVG HTML string
 */
export function renderFacultyAvatar(avatar, size = 48) {
  if (!avatar) return '';

  const { skinTone, hairColor, hairStyle, gender, glasses, beardStyle, accessory, ageAppearance } = avatar;
  const s = size;
  const cx = s / 2;
  const cy = s / 2;

  // Arka plan rengi (unvan/cinsiyet bazlı)
  const bgColor = gender === 'female' ? '#f0e6f6' : '#e6eef6';
  const accentColor = gender === 'female' ? '#9b59b6' : '#2980b9';

  // ── Saç şekilleri ──────────────────────────────────────────────────────────
  function hairPath() {
    if (hairStyle === 'bald') return '';
    if (hairStyle === 'receding') {
      return `<ellipse cx="${cx}" cy="${cy * 0.62}" rx="${s * 0.28}" ry="${s * 0.13}" fill="${hairColor}"/>`;
    }
    if (hairStyle === 'short') {
      return `<ellipse cx="${cx}" cy="${cy * 0.60}" rx="${s * 0.31}" ry="${s * 0.18}" fill="${hairColor}"/>`;
    }
    if (hairStyle === 'medium') {
      return `<ellipse cx="${cx}" cy="${cy * 0.58}" rx="${s * 0.32}" ry="${s * 0.20}" fill="${hairColor}"/>
              <rect x="${cx - s*0.31}" y="${cy * 0.70}" width="${s * 0.10}" height="${s * 0.22}" rx="3" fill="${hairColor}"/>
              <rect x="${cx + s*0.21}" y="${cy * 0.70}" width="${s * 0.10}" height="${s * 0.22}" rx="3" fill="${hairColor}"/>`;
    }
    if (hairStyle === 'long') {
      return `<ellipse cx="${cx}" cy="${cy * 0.56}" rx="${s * 0.33}" ry="${s * 0.20}" fill="${hairColor}"/>
              <rect x="${cx - s*0.32}" y="${cy * 0.68}" width="${s * 0.11}" height="${s * 0.38}" rx="4" fill="${hairColor}"/>
              <rect x="${cx + s*0.21}" y="${cy * 0.68}" width="${s * 0.11}" height="${s * 0.38}" rx="4" fill="${hairColor}"/>`;
    }
    if (hairStyle === 'bun') {
      return `<ellipse cx="${cx}" cy="${cy * 0.58}" rx="${s * 0.32}" ry="${s * 0.19}" fill="${hairColor}"/>
              <circle cx="${cx}" cy="${cy * 0.32}" r="${s * 0.10}" fill="${hairColor}"/>`;
    }
    return `<ellipse cx="${cx}" cy="${cy * 0.60}" rx="${s * 0.31}" ry="${s * 0.18}" fill="${hairColor}"/>`;
  }

  // ── Sakal/bıyık ────────────────────────────────────────────────────────────
  function beardPath() {
    if (beardStyle === 'none' || gender === 'female') return '';
    const faceY = cy * 1.05;
    if (beardStyle === 'mustache') {
      return `<ellipse cx="${cx}" cy="${faceY * 0.88}" rx="${s * 0.12}" ry="${s * 0.04}" fill="${hairColor}" opacity="0.85"/>`;
    }
    if (beardStyle === 'goatee') {
      return `<ellipse cx="${cx}" cy="${faceY * 0.88}" rx="${s * 0.10}" ry="${s * 0.04}" fill="${hairColor}" opacity="0.85"/>
              <ellipse cx="${cx}" cy="${faceY * 0.97}" rx="${s * 0.08}" ry="${s * 0.06}" fill="${hairColor}" opacity="0.80"/>`;
    }
    if (beardStyle === 'short') {
      return `<ellipse cx="${cx}" cy="${faceY * 0.92}" rx="${s * 0.20}" ry="${s * 0.10}" fill="${hairColor}" opacity="0.60"/>`;
    }
    if (beardStyle === 'full') {
      return `<ellipse cx="${cx}" cy="${faceY * 0.95}" rx="${s * 0.22}" ry="${s * 0.13}" fill="${hairColor}" opacity="0.75"/>`;
    }
    return '';
  }

  // ── Gözlük ────────────────────────────────────────────────────────────────
  function glassesPath() {
    if (!glasses) return '';
    const gy = cy * 0.85;
    const lx = cx - s * 0.12;
    const rx2 = cx + s * 0.04;
    const r  = s * 0.09;
    return `<circle cx="${lx}" cy="${gy}" r="${r}" fill="none" stroke="#555" stroke-width="${s*0.025}"/>
            <circle cx="${rx2}" cy="${gy}" r="${r}" fill="none" stroke="#555" stroke-width="${s*0.025}"/>
            <line x1="${lx + r}" y1="${gy}" x2="${rx2 - r}" y2="${gy}" stroke="#555" stroke-width="${s*0.02}"/>
            <line x1="${lx - r}" y1="${gy}" x2="${cx - s*0.32}" y2="${gy - s*0.01}" stroke="#555" stroke-width="${s*0.018}"/>
            <line x1="${rx2 + r}" y1="${gy}" x2="${cx + s*0.28}" y2="${gy - s*0.01}" stroke="#555" stroke-width="${s*0.018}"/>`;
  }

  // ── Aksesuar (kravat/papyon) ───────────────────────────────────────────────
  function accessoryPath() {
    if (!accessory) return '';
    const ay = s * 0.80;
    if (accessory === 'tie') {
      return `<polygon points="${cx-s*0.04},${ay} ${cx+s*0.04},${ay} ${cx+s*0.025},${ay+s*0.15} ${cx},${ay+s*0.18} ${cx-s*0.025},${ay+s*0.15}"
                fill="#c0392b"/>
              <rect x="${cx-s*0.04}" y="${ay-s*0.01}" width="${s*0.08}" height="${s*0.04}" rx="2" fill="#e74c3c"/>`;
    }
    if (accessory === 'bowtie') {
      return `<polygon points="${cx-s*0.08},${ay} ${cx-s*0.01},${ay+s*0.04} ${cx-s*0.01},${ay-s*0.04}" fill="#2c3e50"/>
              <polygon points="${cx+s*0.08},${ay} ${cx+s*0.01},${ay+s*0.04} ${cx+s*0.01},${ay-s*0.04}" fill="#2c3e50"/>
              <circle cx="${cx}" cy="${ay}" r="${s*0.025}" fill="#34495e"/>`;
    }
    return '';
  }

  // ── Kırışık efekti (yaşlı) ──────────────────────────────────────────────────
  function wrinklesPath() {
    if (ageAppearance !== 'old') return '';
    return `<path d="M ${cx-s*0.15} ${cy*0.80} Q ${cx-s*0.10} ${cy*0.82} ${cx-s*0.05} ${cy*0.80}"
                  stroke="${skinTone === '#F5D6B8' ? '#c8a880' : '#6b4226'}" stroke-width="${s*0.015}" fill="none" opacity="0.5"/>
            <path d="M ${cx+s*0.05} ${cy*0.80} Q ${cx+s*0.10} ${cy*0.82} ${cx+s*0.15} ${cy*0.80}"
                  stroke="${skinTone === '#F5D6B8' ? '#c8a880' : '#6b4226'}" stroke-width="${s*0.015}" fill="none" opacity="0.5"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <!-- Arka plan -->
    <circle cx="${cx}" cy="${cy}" r="${s/2}" fill="${bgColor}"/>
    <!-- Omuz/gövde -->
    <ellipse cx="${cx}" cy="${s * 0.95}" rx="${s * 0.30}" ry="${s * 0.20}" fill="${accentColor}" opacity="0.85"/>
    <!-- Saç (arka) -->
    ${hairPath()}
    <!-- Yüz -->
    <ellipse cx="${cx}" cy="${cy * 0.90}" rx="${s * 0.25}" ry="${s * 0.28}" fill="${skinTone}"/>
    <!-- Gözler -->
    <circle cx="${cx - s*0.08}" cy="${cy * 0.82}" r="${s * 0.045}" fill="white"/>
    <circle cx="${cx + s*0.08}" cy="${cy * 0.82}" r="${s * 0.045}" fill="white"/>
    <circle cx="${cx - s*0.08}" cy="${cy * 0.83}" r="${s * 0.025}" fill="#333"/>
    <circle cx="${cx + s*0.08}" cy="${cy * 0.83}" r="${s * 0.025}" fill="#333"/>
    <circle cx="${cx - s*0.07}" cy="${cy * 0.82}" r="${s * 0.01}" fill="white"/>
    <circle cx="${cx + s*0.09}" cy="${cy * 0.82}" r="${s * 0.01}" fill="white"/>
    <!-- Kırışıklar -->
    ${wrinklesPath()}
    <!-- Gözlük -->
    ${glassesPath()}
    <!-- Burun -->
    <ellipse cx="${cx}" cy="${cy * 0.95}" rx="${s * 0.025}" ry="${s * 0.03}" fill="${skinTone === '#F5D6B8' ? '#e0b896' : '#7a4520'}" opacity="0.5"/>
    <!-- Ağız (hafif gülümseme) -->
    <path d="M ${cx - s*0.08} ${cy * 1.04} Q ${cx} ${cy * 1.10} ${cx + s*0.08} ${cy * 1.04}"
          stroke="${skinTone === '#F5D6B8' ? '#c07050' : '#5a2d0c'}" stroke-width="${s * 0.025}" fill="none" stroke-linecap="round"/>
    <!-- Sakal/bıyık -->
    ${beardPath()}
    <!-- Aksesuar -->
    ${accessoryPath()}
  </svg>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 3: GENEL PUAN HESAPLAMA
// ─────────────────────────────────────────────────────────────────────────────

// Unvana göre beklenen yayın sayıları (normalizasyon için)
const EXPECTED_PUBS_BY_TITLE = {
  argö:         5,
  dr_ogr_uyesi: 15,
  docent:       40,
  profesor:     80,
};

const EXPECTED_CITS_BY_TITLE = {
  argö:         10,
  dr_ogr_uyesi: 50,
  docent:       200,
  profesor:     500,
};

/**
 * Hoca için 0-100 arası genel puan hesaplar.
 * @param {object} faculty — Hoca objesi
 * @returns {number} 0-100 arası genel puan
 */
export function calculateOverallRating(faculty) {
  const stats = faculty.stats || {};
  const research    = stats.research    ?? 50;
  const teaching    = stats.teaching    ?? 50;
  const management  = stats.management  ?? 30;
  const happiness   = faculty.happiness ?? 70;

  const pubExpected = EXPECTED_PUBS_BY_TITLE[faculty.title] || 15;
  const citExpected = EXPECTED_CITS_BY_TITLE[faculty.title] || 50;
  const pubNorm = Math.min(100, ((faculty.publications || 0) / pubExpected) * 100);
  const citNorm = Math.min(100, ((faculty.citations    || 0) / citExpected) * 100);

  return Math.round(
    research   * 0.30 +
    teaching   * 0.25 +
    pubNorm    * 0.20 +
    citNorm    * 0.10 +
    management * 0.05 +
    happiness  * 0.10
  );
}

/**
 * Hocanın rating trendini döndürür: 'up' | 'stable' | 'down'
 * @param {object} faculty — Hoca objesi
 * @returns {{ trend: string, arrow: string, color: string }}
 */
export function getFacultyRatingTrend(faculty) {
  const history = faculty.ratingHistory || [];
  if (history.length < 2) return { trend: 'stable', arrow: '→', color: '#a0aec0' };

  const last   = history[history.length - 1].rating;
  const prev   = history[history.length - 2].rating;
  const delta  = last - prev;

  if (delta >= 3)  return { trend: 'up',     arrow: '↑', color: '#38a169' };
  if (delta <= -3) return { trend: 'down',   arrow: '↓', color: '#e53e3e' };
  return              { trend: 'stable', arrow: '→', color: '#a0aec0' };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. generateInitialFaculty — Başlangıç kadrosu oluştur
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Üniversite başlangıcında tüm bölümler için kadro oluşturur.
 * Her bölüme 5-8 hoca; unvan dağılımı: 2 Prof, 2 Doçent, 2 Dr, 1-2 ArGö
 * @param {string[]} departments   - Aktif bölüm id listesi
 * @param {string}   universityType - 'devlet'|'vakif'
 * @param {number}   [count]        - Toplam hoca sayısı (null ise otomatik)
 * @returns {object[]} Hoca objesi dizisi
 */
export function generateInitialFaculty(departments, universityType, count = null) {
  const allFaculty = [];

  // Üniversite tipine göre kalite aralığı
  const qualityRange = universityType === 'devlet'
    ? { min: 30, max: 75 }
    : { min: 20, max: 65 };

  // Vakıf üniversitelerinde profesörler biraz daha düşük
  const qualityAdjust = universityType === 'vakif' ? -10 : 0;

  for (const deptId of departments) {
    // Bölüm başına hoca sayısı
    const deptCount = count
      ? Math.round(count / departments.length)
      : randInt(5, 8);

    // Unvan dağılımı planı
    // 5-6 hoca: 2P, 2D, 1Dr, 1ArGö
    // 7-8 hoca: 2P, 2D, 2Dr, 1-2ArGö
    const titlePlan = [];
    titlePlan.push('profesor', 'profesor');
    titlePlan.push('docent', 'docent');
    titlePlan.push('dr_ogr_uyesi', 'dr_ogr_uyesi');
    const remaining = deptCount - titlePlan.length;
    for (let i = 0; i < Math.max(1, remaining); i++) {
      titlePlan.push('argö');
    }

    // Fazla veya eksik hocayı düzelt
    while (titlePlan.length > deptCount) titlePlan.pop();
    while (titlePlan.length < deptCount) titlePlan.push('argö');

    for (const title of titlePlan) {
      // Unvana göre kalite aralığı ayarla
      let qMin = qualityRange.min + qualityAdjust;
      let qMax = qualityRange.max + qualityAdjust;

      if (title === 'profesor') {
        qMin += 15;
        qMax = Math.min(95, qMax + 20);
      } else if (title === 'docent') {
        qMin += 5;
        qMax = Math.min(85, qMax + 10);
      } else if (title === 'argö') {
        qMax = Math.max(qMin + 10, qMax - 15);
      }

      const faculty = generateFaculty({
        department: deptId,
        title,
        minQuality: Math.max(1, qMin),
        maxQuality: Math.min(100, qMax),
        currentTurn: 1,
      });
      allFaculty.push(faculty);
    }
  }

  return allFaculty;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. calculateHappiness — Hoca mutluluk puanı
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 9 bileşenin ağırlıklı ortalamasıyla hoca mutluluğunu hesaplar (0-100).
 * @param {object} faculty - Hoca objesi
 * @param {object} state   - Oyun durumu (bütçe, binalar, bölüm vb.)
 * @returns {number} Mutluluk puanı (0-100)
 */
export function calculateHappiness(faculty, state) {
  // ── 1. Maaş memnuniyeti (%20) ────────────────────────────────────────────
  // Piyasa maaşını unvana ve bölüme göre tahmin et
  const deptData = state.departments?.[faculty.department];
  const category = deptData?.category || 'muhendislik';
  const baseSalary = BASE_SALARY_BY_CATEGORY[category] || 25_000;
  const expectedSalary = baseSalary * TITLE_SALARY_MULTIPLIER[faculty.title];
  const salaryRatio = faculty.salary / expectedSalary;
  // 1.0 = tam beklenti → 75 puan; 1.5 = çok iyi → ~100; 0.7 = kötü → ~30
  const salaryScore = Math.min(100, Math.max(0, (salaryRatio - 0.5) / 1.0 * 100));

  // ── 2. Araştırma imkanları (%15) ─────────────────────────────────────────
  // Lab varlığı ve araştırma fonu
  const hasLab = state.buildings?.some(b => b.type === 'lab' && b.department === faculty.department) ?? false;
  const hasResearchCenter = state.buildings?.some(b => b.type === 'arastirma_merkezi') ?? false;
  const researchFundScore = Math.min(100, (state.researchBudgetPerFaculty ?? 0) / 50_000 * 100);
  const researchOpScore = (hasLab ? 40 : 0) + (hasResearchCenter ? 20 : 0) + researchFundScore * 0.4;

  // ── 3. Alan uyumu (%15) ──────────────────────────────────────────────────
  const fieldMatchScore = calculateFieldMatch(faculty, faculty.department) * 100;

  // ── 4. Ders yükü (%15) ──────────────────────────────────────────────────
  // Maksimum yük eşiği: 3 ders / dönem
  const courseLoad = faculty.currentLoad?.courses ?? 0;
  let loadScore;
  if (courseLoad <= 1)      loadScore = 90;
  else if (courseLoad <= 2) loadScore = 75;
  else if (courseLoad <= 3) loadScore = 55;
  else if (courseLoad <= 4) loadScore = 35;
  else                      loadScore = 15;

  // ── 5. Ofis kalitesi (%10) ───────────────────────────────────────────────
  const buildingCount = state.buildings?.filter(b => b.type === 'fakulte_binasi').length ?? 0;
  const facultyCount  = state.faculty?.length ?? 1;
  const spaciousness  = Math.min(1, buildingCount * 800 / (facultyCount * 15));
  const officeScore   = Math.round(spaciousness * 100);

  // ── 6. Fakülte memnuniyeti / genel atmosfer (%10) ────────────────────────
  const avgFacultyHappiness = state.faculty
    ? state.faculty.reduce((s, f) => s + (f.happiness ?? 60), 0) / state.faculty.length
    : 60;
  const atmosphereScore = avgFacultyHappiness; // dairesel; başlangıç değeri kullanılır

  // ── 7. İdari verimlilik (%5) ─────────────────────────────────────────────
  // YÖK kısıtları, bütçe sağlığı ve bürokratik yük
  const adminBurden = faculty.currentLoad?.adminRole ? 30 : 80;
  const budgetHealth = state.budget > 0
    ? Math.min(100, (state.budget / (state.monthlyFixedCost ?? 5_000_000)) * 10)
    : 10;
  const adminScore = Math.round((adminBurden + budgetHealth) / 2);

  // ── 8. Sosyal ortam (%5) ─────────────────────────────────────────────────
  const hasCafeteria = state.buildings?.some(b => b.type === 'yemekhane') ?? false;
  const hasSports    = state.buildings?.some(b => b.type === 'spor_tesisi') ?? false;
  const socialScore  = 40 + (hasCafeteria ? 30 : 0) + (hasSports ? 20 : 0) + randInt(-5, 5);

  // ── 9. Adalet algısı (%5) ────────────────────────────────────────────────
  // Aynı unvandaki hocalar arasında maaş farkı
  const peersInDept = state.faculty?.filter(
    f => f.id !== faculty.id && f.title === faculty.title && f.department === faculty.department
  ) ?? [];
  let fairnessScore = 75; // varsayılan
  if (peersInDept.length > 0) {
    const avgPeerSalary = peersInDept.reduce((s, f) => s + f.salary, 0) / peersInDept.length;
    const salaryGapRatio = faculty.salary / avgPeerSalary;
    if (salaryGapRatio >= 1.0)      fairnessScore = 90;
    else if (salaryGapRatio >= 0.9) fairnessScore = 70;
    else if (salaryGapRatio >= 0.8) fairnessScore = 50;
    else                            fairnessScore = 25;
  }

  // ── Ağırlıklı toplam ────────────────────────────────────────────────────
  const happiness =
    salaryScore      * 0.20 +
    researchOpScore  * 0.15 +
    fieldMatchScore  * 0.15 +
    loadScore        * 0.15 +
    officeScore      * 0.10 +
    atmosphereScore  * 0.10 +
    adminScore       * 0.05 +
    socialScore      * 0.05 +
    fairnessScore    * 0.05;

  return Math.min(100, Math.max(0, Math.round(happiness)));
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. updateAllFacultyHappiness — Tüm hocaların mutluluğunu güncelle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Her hoca için mutluluk puanını hesaplar ve state'i günceller.
 * @param {object} state - Oyun durumu (state.faculty dizisini değiştirir)
 * @returns {object} Güncellenmiş state
 */
export function updateAllFacultyHappiness(state) {
  if (!state.faculty) return state;

  for (const faculty of state.faculty) {
    faculty.happiness = calculateHappiness(faculty, state);
  }

  return state;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. calculateFieldMatch — Hoca-bölüm alan uyumu
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hocanın uzmanlık alanının verilen bölümle örtüşme oranını döner (0.0 - 1.0).
 * @param {object} faculty      - Hoca objesi
 * @param {string} departmentId - Bölüm id
 * @returns {number} Uyum oranı (0.0 tam uyumsuz, 1.0 tam uyumlu)
 */
export function calculateFieldMatch(faculty, departmentId) {
  const deptFieldPool = DEPARTMENT_FIELDS[departmentId];
  if (!deptFieldPool) return 0.5; // bilinmeyen bölüm — orta değer

  // Ana alan eşleşmesi
  const mainMatch = faculty.field === (DEPARTMENT_MAIN_FIELD[departmentId] || departmentId);

  // Uzmanlık örtüşmesi
  const specs = faculty.specializations || [];
  if (specs.length === 0) return mainMatch ? 1.0 : 0.3;

  const matchCount = specs.filter(s => deptFieldPool.includes(s)).length;
  const specScore  = matchCount / specs.length;

  // Ana alan eşleşiyorsa yüksek taban, yoksa uzmanlığa bak
  if (mainMatch) {
    return Math.min(1.0, 0.6 + specScore * 0.4);
  } else {
    // Farklı ana alan ama uzmanlık örtüşüyor olabilir (disiplinlerarası)
    return Math.min(1.0, specScore * 0.7);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. generateTransferMarket — Dönemlik transfer pazarı
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Her dönem başında transfer pazarında yer alacak hocanın listesini üretir.
 * Yüksek prestijli üniversiteler daha iyi havuzdan çeker.
 * @param {object} state - Oyun durumu (state.prestige, state.departments vb.)
 * @returns {object[]} Transfer pazarındaki hoca listesi (5-10 hoca)
 */
export function generateTransferMarket(state) {
  const prestige     = state.prestige ?? 30;
  const marketCount  = randInt(5, 10);
  const activeDepts  = state.departments ? Object.keys(state.departments) : Object.keys(DEPARTMENTS);

  // Prestije göre kalite aralığı
  // Prestij 20 → düşük havuz; Prestij 80+ → yüksek havuz
  const qualityBonus = Math.floor(prestige * 0.4);
  const minQ = Math.max(10, 20 + qualityBonus);
  const maxQ = Math.min(100, 55 + qualityBonus);

  // Prestij 70+ ise profesör olasılığı artar
  const titleWeights = prestige >= 70
    ? ['argö', 'dr_ogr_uyesi', 'dr_ogr_uyesi', 'docent', 'docent', 'profesor', 'profesor']
    : prestige >= 45
      ? ['argö', 'argö', 'dr_ogr_uyesi', 'dr_ogr_uyesi', 'docent', 'docent', 'profesor']
      : ['argö', 'argö', 'argö', 'dr_ogr_uyesi', 'dr_ogr_uyesi', 'docent'];

  const market = [];
  for (let i = 0; i < marketCount; i++) {
    const dept  = pick(activeDepts);
    const title = pick(titleWeights);

    const faculty = generateFaculty({
      department:     dept,
      title,
      minQuality:     minQ,
      maxQuality:     maxQ,
      currentTurn:    state.currentTurn ?? 1,
      universityType: state.meta?.universityType ?? 'vakif',
    });

    // Transfer pazarındaki hocanın talep ettiği maaş — transfer primi %20-40
    faculty.askingSalary = Math.round(faculty.salary * randFloat(1.20, 1.40));
    // Transfer ücreti (rakip üniversiteye tazminat)
    faculty.transferFee  = faculty.title === 'profesor'
      ? randInt(500_000, 2_000_000)
      : faculty.title === 'docent'
        ? randInt(200_000, 800_000)
        : randInt(50_000, 200_000);

    market.push(faculty);
  }

  return market;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. generateApplicants — Açık kadro ilanına başvuran üret
// ─────────────────────────────────────────────────────────────────────────────

// Başvuranların gelebileceği önceki üniversite havuzu
const PREVIOUS_UNIVERSITY_POOL = [
  'ODTÜ', 'Boğaziçi Üniversitesi', 'İTÜ', 'Hacettepe Üniversitesi',
  'Bilkent Üniversitesi', 'Koç Üniversitesi', 'Sabancı Üniversitesi',
  'Ankara Üniversitesi', 'İstanbul Üniversitesi', 'Ege Üniversitesi',
  'Gazi Üniversitesi', 'Dokuz Eylül Üniversitesi', 'Yıldız Teknik Üniversitesi',
  'Gebze Teknik Üniversitesi', 'TOBB ETÜ', 'Atılım Üniversitesi',
  'Çankaya Üniversitesi', 'Başkent Üniversitesi', 'Karadeniz Teknik Üniversitesi',
  'Erciyes Üniversitesi', 'Selçuk Üniversitesi', 'Akdeniz Üniversitesi',
  'Marmara Üniversitesi', 'Anadolu Üniversitesi', 'Fırat Üniversitesi',
  'Kahramanmaraş Sütçü İmam Üniversitesi', 'Pamukkale Üniversitesi',
  'Uludağ Üniversitesi', 'Cumhuriyet Üniversitesi', 'İnönü Üniversitesi',
];

// Prestijli doktora üniversiteleri (profesörler / doçentler için)
const PHD_UNIVERSITY_POOL_PRESTIGIOUS = [
  'MIT', 'Stanford Üniversitesi', 'Carnegie Mellon', 'ETH Zürich',
  'Oxford Üniversitesi', 'Cambridge Üniversitesi', 'Delft Teknoloji Üniversitesi',
  'Caltech', 'Princeton Üniversitesi', 'UC Berkeley', 'Imperial College London',
  'EPFL', 'University of Toronto', 'Georgia Tech', 'University of Michigan',
];

const PHD_UNIVERSITY_POOL_NORMAL = [
  'ODTÜ', 'Boğaziçi Üniversitesi', 'İTÜ', 'Hacettepe Üniversitesi',
  'Bilkent Üniversitesi', 'Koç Üniversitesi', 'Sabancı Üniversitesi',
  'Ankara Üniversitesi', 'İstanbul Üniversitesi', 'Ege Üniversitesi',
  'Gazi Üniversitesi', 'Dokuz Eylül Üniversitesi', 'Yıldız Teknik Üniversitesi',
  'Gebze Teknik Üniversitesi', 'TOBB ETÜ', 'Marmara Üniversitesi',
  'Karadeniz Teknik Üniversitesi', 'Erciyes Üniversitesi', 'Selçuk Üniversitesi',
];

// Unvana göre deneyim yılı aralıkları
const TITLE_EXPERIENCE_RANGE = {
  argö:          { min: 0,  max: 3  },
  dr_ogr_uyesi:  { min: 3,  max: 10 },
  docent:        { min: 10, max: 20 },
  profesor:      { min: 20, max: 35 },
};

// Unvana göre kesin yayın/atıf aralıkları (generateApplicants için, generateFaculty'den daha zengin)
const APPLICANT_PUB_RANGES = {
  argö:          { pubMin: 0,   pubMax: 5,   citMultMin: 0,  citMultMax: 5  },
  dr_ogr_uyesi:  { pubMin: 5,   pubMax: 25,  citMultMin: 4,  citMultMax: 12 },
  docent:        { pubMin: 25,  pubMax: 60,  citMultMin: 8,  citMultMax: 20 },
  profesor:      { pubMin: 60,  pubMax: 150, citMultMin: 15, citMultMax: 45 },
};

/**
 * Açık kadro ilanına gelen başvuruları üretir.
 * Her dönem, ilanlar için bu fonksiyon çağrılır.
 * @param {object} position — İlan objesi { id, department, title, field, offeredSalary, researchFund, hasLab }
 * @param {object} state    — Oyun durumu
 * @returns {object[]} Başvuranlar dizisi
 */
export function generateApplicants(position, state) {
  const prestige   = state.university?.prestige ?? state.prestige ?? 30;
  const uniType    = state.meta?.universityType ?? 'vakif';
  const scale      = getSalaryScale(uniType);
  const range      = scale[position.title] || scale['dr_ogr_uyesi'];

  // Çoklu alan desteği: position.allFields veya position.fields dizisi
  // Geriye dönük uyumluluk: eski kayıtlarda sadece position.field olabilir
  const posAllFields = position.allFields === true;
  const posFields    = Array.isArray(position.fields) && position.fields.length > 0
    ? position.fields
    : (position.field && position.field !== 'Tüm Alanlar' ? [position.field] : []);

  // Kaç başvuran?
  // Maaş -> pazar oranına göre
  const midSalary    = (range.min + range.max) / 2;
  const salaryRatio  = (position.offeredSalary || midSalary) / midSalary;

  // Araştırma fonu çarpanı
  const fundBonus    = position.researchFund > 0 ? 1 + Math.min(0.5, position.researchFund / 2_000_000) : 1.0;

  // Prestij çarpanı
  const prestigeBonus = 1 + Math.min(0.5, prestige / 100);

  // Toplam beklenen başvuru sayısı
  const baseCnt   = salaryRatio >= 1.2 ? 5 : salaryRatio >= 1.0 ? 3 : salaryRatio >= 0.8 ? 1 : 0;
  const finalCnt  = Math.round(baseCnt * fundBonus * prestigeBonus);
  const cnt       = Math.min(8, Math.max(0, finalCnt + randInt(-1, 1)));

  const applicants = [];
  for (let i = 0; i < cnt; i++) {
    // Kaliteli aday: maaş iyi + prestij yüksekse kalite artar
    const minQ = salaryRatio >= 1.1 ? 40 : 20;
    const maxQ = Math.min(90, 40 + Math.round(prestige * 0.5));

    const fac = generateFaculty({
      department:     position.department,
      title:          position.title,
      minQuality:     minQ,
      maxQuality:     maxQ,
      currentTurn:    state.meta?.turn ?? 1,
      universityType: uniType,
    });

    // Belirli alanlar istendiyse adayın uzmanlıklarını o alanlara yönlendir
    // (Tüm Alanlar seçiliyse herhangi bir müdahale yapma)
    if (!posAllFields && posFields.length > 0) {
      // %70 ihtimalle adayın en az bir uzmanlığı istenen alanlardan olsun
      if (Math.random() < 0.70) {
        const targetField = posFields[Math.floor(Math.random() * posFields.length)];
        if (!(fac.specializations || []).includes(targetField)) {
          if (!fac.specializations) fac.specializations = [];
          // Listedeki son uzmanlığı istenen alanla değiştir veya ekle
          if (fac.specializations.length > 0) {
            fac.specializations[fac.specializations.length - 1] = targetField;
          } else {
            fac.specializations.push(targetField);
          }
        }
      }
    }

    // Başvuranın maaş beklentisi: ilan maaşı ± %15
    const salaryExpectation = Math.round(
      (position.offeredSalary || midSalary) * randFloat(0.85, 1.15)
    );

    // ── Zenginleştirilmiş akademik profil ────────────────────────────────────
    const titleKey = fac.title || 'dr_ogr_uyesi';

    // Deneyim yılı
    const expRange = TITLE_EXPERIENCE_RANGE[titleKey] || { min: 0, max: 5 };
    const yearsExperience = randInt(expRange.min, expRange.max);

    // Yayın ve atıf (ilanına özel aralıklar — generateFaculty'den bağımsız)
    const pubR = APPLICANT_PUB_RANGES[titleKey] || APPLICANT_PUB_RANGES['dr_ogr_uyesi'];
    const enrichedPublications = randInt(pubR.pubMin, pubR.pubMax);
    const enrichedCitations    = Math.round(enrichedPublications * randFloat(pubR.citMultMin, pubR.citMultMax));
    const enrichedHIndex       = Math.floor(Math.sqrt(enrichedCitations));

    // Aktif proje sayısı
    const activeProjects = titleKey === 'argö'
      ? randInt(0, 1)
      : titleKey === 'dr_ogr_uyesi'
        ? randInt(0, 2)
        : randInt(1, 3);

    // Araştırma alanları (uzmanlıklardan türet)
    const researchAreas = [...(fac.specializations || [])];

    // Önceki üniversite
    const previousUniversity = pick(PREVIOUS_UNIVERSITY_POOL);

    // Önceki bölüm adı (mainField benzeri)
    const previousDepartment = fac.field || (DEPARTMENT_MAIN_FIELD[position.department] || position.department);

    // Eğitim bilgisi
    const phdYear = new Date().getFullYear() - yearsExperience - randInt(1, 3);
    const usePrestigiousPhdPool = titleKey === 'profesor' || (titleKey === 'docent' && Math.random() < 0.4);
    const phdUniversity = usePrestigiousPhdPool
      ? pick(PHD_UNIVERSITY_POOL_PRESTIGIOUS)
      : pick(PHD_UNIVERSITY_POOL_NORMAL);
    const phdField = fac.field || (DEPARTMENT_MAIN_FIELD[position.department] || 'Mühendislik');
    const education = {
      phd: `${phdUniversity} — ${phdField}`,
      year: Math.max(1990, Math.min(new Date().getFullYear() - 1, phdYear)),
    };

    // Eğitim puanı (önceki üni'deki öğrenci değerlendirmesi)
    const teachingScore = titleKey === 'argö'
      ? randInt(40, 75)
      : titleKey === 'dr_ogr_uyesi'
        ? randInt(50, 85)
        : randInt(55, 95);

    applicants.push({
      ...fac,
      // Zenginleştirilmiş alanlar (generateFaculty'nin basit değerlerini geçersiz kıl)
      publications:       enrichedPublications,
      citations:          enrichedCitations,
      hIndex:             enrichedHIndex,
      yearsExperience,
      previousUniversity,
      previousDepartment,
      teachingScore,
      activeProjects,
      researchAreas,
      education,
      // Başvuru meta
      applicationSource:  'open_position',
      positionId:         position.id,
      salaryExpectation,
      availableIn:        randInt(0, 1),  // 0 = hemen, 1 = gelecek dönem
      applicationDate:    state.meta?.turn ?? 1,
    });
  }

  return applicants;
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. processTransferOffer — Transfer teklifi sonucu
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Oyuncunun transfer pazarından bir hocaya yaptığı teklifin sonucunu belirler.
 * @param {object} state     - Oyun durumu
 * @param {string} facultyId - Hoca id
 * @param {object} offer     - Teklif detayları
 *   @param {number}  offer.salary        - Teklif edilen maaş (₺/ay)
 *   @param {number}  offer.researchFund  - Araştırma fonu (₺)
 *   @param {number}  offer.labQuality    - Lab kalitesi (0-100)
 *   @param {boolean} offer.titlePromise  - Unvan vaadi var mı
 * @returns {{ accepted: boolean, reason: string, probability: number }}
 */
export function processTransferOffer(state, facultyId, offer) {
  // Hocayı transfer pazarında bul
  const faculty = state.transferMarket?.find(f => f.id === facultyId);
  if (!faculty) {
    return { accepted: false, reason: 'Hoca transfer pazarında bulunamadı.', probability: 0 };
  }

  const { salary = 0, researchFund = 0, labQuality = 0, titlePromise = false } = offer;

  // Maaş çekiciliği (en büyük faktör, %40)
  const salaryAttr = Math.min(1, salary / (faculty.askingSalary || faculty.salary));
  let acceptProb = salaryAttr * 0.40;

  // Araştırma fonu çekiciliği (%20) — araştırma statı yüksekse daha önemli
  const researchWeight = 0.10 + (faculty.stats.research / 100) * 0.10;
  const researchAttr   = Math.min(1, researchFund / 1_000_000);
  acceptProb += researchAttr * researchWeight;

  // Lab kalitesi (%15)
  const labAttr = labQuality / 100;
  acceptProb += labAttr * 0.15;

  // Unvan vaadi (%15) — sadece doçent olmayı bekleyenler için değerli
  if (titlePromise && (faculty.title === 'dr_ogr_uyesi' || faculty.title === 'argö')) {
    acceptProb += 0.15;
  } else if (titlePromise) {
    acceptProb += 0.05;
  }

  // Üniversite prestiji bonusu (%10)
  const prestigeScore = Math.min(1, (state.prestige ?? 30) / 80);
  acceptProb += prestigeScore * 0.10;

  // Sadakat malus — yüksek sadakatli hocalar zor ikna olur
  const loyaltyPenalty = (faculty.stats.loyalty - 50) / 100 * 0.15;
  acceptProb = Math.max(0.05, acceptProb - loyaltyPenalty);

  acceptProb = Math.min(0.95, acceptProb);

  const accepted = Math.random() < acceptProb;
  let reason;

  if (accepted) {
    reason = salary >= faculty.askingSalary
      ? 'Teklif beklentileri karşıladı, hoca kabul etti.'
      : 'Araştırma imkanları ve genel paket hocayı ikna etti.';
  } else {
    if (salaryAttr < 0.8) {
      reason = 'Maaş teklifi beklentilerin çok altında kaldı.';
    } else if (faculty.stats.loyalty > 75) {
      reason = 'Hoca mevcut kurumuna çok bağlı, teklifi reddetti.';
    } else {
      reason = 'Hoca bu dönem transfer olmak istemedi.';
    }
  }

  return { accepted, reason, probability: Math.round(acceptProb * 100) };
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. processRivalOffers — Rakiplerin mutsuz hocalara teklif göndermesi
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Her dönem sonunda mutsuz hocalara rakip üniversite teklifleri oluşturur.
 * Mutluluk < 50 olan hocalar risk altındadır.
 * @param {object} state - Oyun durumu
 * @returns {{ events: object[] }} Teklif olayları listesi
 */
export function processRivalOffers(state) {
  const events = [];
  if (!state.faculty || !state.rivals) return { events };

  const rivals = state.rivals;
  const aggressiveness = state.difficulty?.rivalAggressiveness ?? 0.65;

  for (const faculty of state.faculty) {
    if (faculty.happiness >= 50) continue;

    // Mutsuzluk derinliğine göre teklif olasılığı
    const unhappinessFactor = (50 - faculty.happiness) / 50; // 0-1
    const offerChance = unhappinessFactor * aggressiveness * 0.6;

    if (Math.random() > offerChance) continue;

    // Teklif yapacak rakibi seç
    const rival = pick(rivals);

    // Teklif paketi — rakip biraz daha iyi bir maaş önerir
    const salaryMultiplier = 1.0 + randFloat(0.10, 0.40);
    const offerSalary = Math.round(faculty.salary * salaryMultiplier);

    const offerResearchFund = faculty.title === 'profesor' || faculty.title === 'docent'
      ? randInt(200_000, 1_500_000)
      : randInt(50_000, 300_000);

    events.push({
      type:          'rival_offer',
      facultyId:     faculty.id,
      facultyName:   faculty.name,
      rivalName:     rival.name,
      offer: {
        salary:       offerSalary,
        researchFund: offerResearchFund,
        labQuality:   randInt(40, 85),
        titlePromise: faculty.title !== 'profesor' && Math.random() < 0.3,
      },
      // Oyuncu bu döneme kadar yanıt vermezse otomatik sonuç
      autoDecideTurn: (state.currentTurn ?? 1) + 1,
      description: `${rival.name} üniversitesi ${faculty.name} adlı hocanıza cazip bir teklif sundu!`,
    });
  }

  return { events };
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. updateFacultyDevelopment — Hoca gelişimi (dönem sonu güncelleme)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Her dönem sonunda hocaların statlarını günceller.
 * Araştırma imkanları, ders yükü ve motivasyon gelişimi etkiler.
 * @param {object} state - Oyun durumu
 * @returns {object} Güncellenmiş state ve değişim logları
 */
export function updateFacultyDevelopment(state) {
  if (!state.faculty) return { state, changes: [] };

  const changes = [];
  const hasLab            = deptId => state.buildings?.some(b => b.type === 'lab' && b.department === deptId) ?? false;
  const hasResearchCenter  = state.buildings?.some(b => b.type === 'arastirma_merkezi') ?? false;
  const researchFundLevel  = Math.min(3, Math.floor((state.researchBudgetPerFaculty ?? 0) / 200_000)); // 0-3

  for (const faculty of state.faculty) {
    const delta = { id: faculty.id, name: faculty.name, changes: {} };

    // ── Araştırma stat değişimi ──────────────────────────────────────────
    let researchDelta = 0;
    if (hasLab(faculty.department)) researchDelta += randInt(1, 2);
    if (hasResearchCenter)          researchDelta += 1;
    if (researchFundLevel >= 1)     researchDelta += randInt(1, researchFundLevel);
    if (faculty.currentLoad.courses >= 4) researchDelta -= randInt(1, 2); // aşırı yük

    // Potansiyel tavanı
    const researchCap = faculty.hidden.potential;
    const newResearch = Math.min(researchCap, Math.max(1, faculty.stats.research + researchDelta));
    if (newResearch !== faculty.stats.research) {
      delta.changes.research = newResearch - faculty.stats.research;
      faculty.stats.research = newResearch;
    }

    // ── Eğitim stat değişimi ─────────────────────────────────────────────
    let teachingDelta = 0;
    if (faculty.currentLoad.courses >= 2) teachingDelta += randInt(0, 1); // tecrübe
    if (faculty.currentLoad.courses >= 4) teachingDelta -= randInt(0, 1); // yorgunluk
    if (faculty.currentLoad.gradStudents >= 2) teachingDelta += 1;        // mentoring deneyimi

    const teachingCap = Math.min(faculty.hidden.potential, 95);
    const newTeaching = Math.min(teachingCap, Math.max(1, faculty.stats.teaching + teachingDelta));
    if (newTeaching !== faculty.stats.teaching) {
      delta.changes.teaching = newTeaching - faculty.stats.teaching;
      faculty.stats.teaching = newTeaching;
    }

    // ── Motivasyon değişimi ──────────────────────────────────────────────
    let motivDelta = 0;
    if (faculty.happiness >= 75) motivDelta += randInt(1, 3);
    else if (faculty.happiness < 40) motivDelta -= randInt(1, 3);
    else motivDelta += randInt(-1, 1);

    const newMotiv = Math.min(100, Math.max(0, faculty.stats.motivation + motivDelta));
    if (newMotiv !== faculty.stats.motivation) {
      delta.changes.motivation = newMotiv - faculty.stats.motivation;
      faculty.stats.motivation = newMotiv;
    }

    // ── Sadakat değişimi ─────────────────────────────────────────────────
    let loyaltyDelta = 0;
    if (faculty.happiness >= 70) loyaltyDelta += 1;
    else if (faculty.happiness < 40) loyaltyDelta -= 2;

    const newLoyalty = Math.min(100, Math.max(0, faculty.stats.loyalty + loyaltyDelta));
    faculty.stats.loyalty = newLoyalty;

    // ── Yaş ─────────────────────────────────────────────────────────────
    // Her 2 dönemde bir yaş artır (dönem=yarıyıl)
    if ((state.currentTurn ?? 1) % 2 === 0) {
      faculty.age += 1;
    }

    // ── Stat belirsizliği — açığa çıkarma ───────────────────────────────
    // 3 dönem sonra araştırma/eğitim statları kesin değere yaklaşır
    const turnsWorked = (state.currentTurn ?? 1) - (faculty.contract?.startTurn ?? 1);
    if (turnsWorked >= 3 && !faculty.revealed.research.exact) {
      faculty.revealed.research = { min: faculty.stats.research, max: faculty.stats.research, exact: true };
      faculty.revealed.teaching = { min: faculty.stats.teaching, max: faculty.stats.teaching, exact: true };
    } else if (!faculty.revealed.research.exact) {
      // Aralığı daralt
      const unc = Math.max(5, 15 - turnsWorked * 4);
      faculty.revealed.research.min = Math.max(1, faculty.stats.research - unc);
      faculty.revealed.research.max = Math.min(100, faculty.stats.research + unc);
      faculty.revealed.teaching.min = Math.max(1, faculty.stats.teaching - unc);
      faculty.revealed.teaching.max = Math.min(100, faculty.stats.teaching + unc);
    }

    // ── Arketip yeniden değerlendir ──────────────────────────────────────
    faculty.archetype = determineFacultyArchetype(faculty.stats);

    if (Object.keys(delta.changes).length > 0) {
      changes.push(delta);
    }
  }

  return { state, changes };
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. determineFacultyArchetype — Arketip belirle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stat profiline göre hoca arketipini belirler.
 * Arketip en baskın özelliğe ve kombinasyona göre atanır.
 * @param {object} stats - { research, teaching, management, mentoring, popularity }
 * @returns {string} Arketip etiketi
 */
export function determineFacultyArchetype(stats) {
  const { research = 50, teaching = 50, management = 50, mentoring = 50, popularity = 50 } = stats;

  const avg = (research + teaching + management + mentoring + popularity) / 5;

  // "Yıldız" — her şeyde yüksek
  if (avg >= 75) return 'Yıldız';

  // "Tek Boyutlu" — sadece bir stat çok yüksek, geri kalan düşük
  const vals = [research, teaching, management, mentoring, popularity];
  const max  = Math.max(...vals);
  const secondMax = vals.filter(v => v !== max).reduce((a, b) => Math.max(a, b), 0);
  if (max >= 80 && secondMax < 45) return 'Tek Boyutlu';

  // "Araştırma Makinesi" — araştırma baskın
  if (research >= 75 && research > teaching + 15) return 'Araştırma Makinesi';

  // "Hoca'nın Hocası" — eğitim baskın
  if (teaching >= 75 && teaching > research + 15) return "Hoca'nın Hocası";

  // "Doğal Lider" — yönetim baskın
  if (management >= 70 && management > research && management > teaching) return 'Doğal Lider';

  // "Mentor" — mentorluk baskın
  if (mentoring >= 70 && mentoring > research && mentoring > teaching) return 'Mentor';

  // "Medya Yüzü" — popülarite baskın
  if (popularity >= 70 && popularity > research && popularity > teaching) return 'Medya Yüzü';

  // "Disiplinler Arası" — araştırma + eğitim dengeli ve her ikisi de ortalama üstü
  if (research >= 55 && teaching >= 55 && Math.abs(research - teaching) < 15) return 'Disiplinler Arası';

  // "Bürokrat" — yönetim orta-yüksek, diğerleri ortalama
  if (management >= 55 && research < 55 && teaching < 55) return 'Bürokrat';

  // Varsayılan
  return 'Disiplinler Arası';
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. calculateEffectiveManagement — Efektif yönetim puanı
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hocanın etkin yönetim kapasitesini hesaplar.
 * Yönetim stat × Araştırma kredibilitesi × Unvan çarpanı
 * @param {object} faculty - Hoca objesi
 * @returns {number} Efektif yönetim puanı (0-100)
 */
export function calculateEffectiveManagement(faculty) {
  const manageStat = faculty.stats?.management ?? 50;
  const researchStat = faculty.stats?.research ?? 50;

  // Araştırma kredibilitesi: araştırması yüksek hocaların yönetimi daha inandırıcı
  // Araştırma 30 → 0.7 kredibilite; 70 → 1.0; 90 → 1.1
  const credibility = Math.min(1.2, 0.5 + (researchStat / 100) * 0.7);

  // Unvan çarpanı — profesörün otoritesi daha yüksek
  const titleMultiplier = {
    argö:          0.6,
    dr_ogr_uyesi:  0.8,
    docent:        0.95,
    profesor:      1.15,
  }[faculty.title] ?? 1.0;

  const effective = manageStat * credibility * titleMultiplier;
  return Math.min(100, Math.max(0, Math.round(effective)));
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. calculateTimeAllocation — Zaman bütçesi hesapla
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hocanın 40 birimlik haftalık zaman bütçesini aktivitelere dağıtır.
 * Kalan birimler araştırma zamanına gider.
 * @param {object} faculty - Hoca objesi
 * @returns {object} Zaman dağılımı objesi
 */
export function calculateTimeAllocation(faculty) {
  const TOTAL_TIME = 40; // haftalık birim

  // Ders hazırlığı + sunum: her ders 4 birim
  const courseLoad   = faculty.currentLoad?.courses ?? 0;
  const coursesTime  = courseLoad * 4;

  // Ödev ve sınav değerlendirme: her ders 2 birim
  const gradingTime  = courseLoad * 2;

  // İdari görev
  const adminRole    = faculty.currentLoad?.adminRole;
  let adminTime      = 0;
  if (adminRole === 'department_head')    adminTime = 10;
  else if (adminRole === 'dean')          adminTime = 14;
  else if (adminRole === 'committee')     adminTime = 4;
  else if (adminRole)                     adminTime = 3;

  // Lisansüstü öğrenci danışmanlığı: her öğrenci 1.5 birim
  const gradStudents   = faculty.currentLoad?.gradStudents ?? 0;
  const mentoringTime  = Math.round(gradStudents * 1.5);

  // Ofis saatleri (sabit)
  const officeTime = 3;

  const usedTime = coursesTime + gradingTime + adminTime + mentoringTime + officeTime;

  // Zaman yönetimi becerisi — iyi planlayıcılar daha çok araştırma zamanı bulur
  const tmBonus = Math.round((faculty.hidden?.timeManagement ?? 50) / 100 * 3); // 0-3 bonus birim
  const researchTime = Math.max(0, TOTAL_TIME - usedTime + tmBonus);

  // Aşırı yük kontrolü (toplamın 40'ı geçmesi mümkün; bu durumda stres üretir)
  const overload = Math.max(0, usedTime - TOTAL_TIME);

  return {
    total:         TOTAL_TIME,
    courses:       coursesTime,
    grading:       gradingTime,
    admin:         adminTime,
    mentoring:     mentoringTime,
    officeHours:   officeTime,
    research:      researchTime,
    overload,
    isOverloaded:  overload > 0,
    // Araştırma etkinliği (0-1) — zaman + motivasyon × time management
    researchEfficiency: Math.min(1.0, (researchTime / 12) * ((faculty.stats?.motivation ?? 70) / 100)),
  };
}
