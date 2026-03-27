/**
 * Rektör Oldum — Veri Katmanı (data.js)
 * Tüm sabit veriler, şablonlar ve başlangıç değerleri burada tanımlanır.
 * GDD v0.1-taslak'a göre hazırlanmıştır.
 */

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI SABİTLER
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_FACULTY_STATS        = 100;   // Hoca stat tavanı (araştırma, eğitim, prestij vb.)
export const SEMESTER_MONTHS          = 5;     // Bir dönemin yaklaşık ay sayısı
export const TURNS_PER_YEAR           = 2;     // Yılda kaç dönem (Güz + Bahar, yaz okulu hariç)
export const TURNS_PER_YEAR_COOP      = 3;     // 3-dönem co-op modelinde yılda dönem sayısı
export const MAX_PRESTIGE             = 100;   // Prestij tavanı
export const BANKRUPTCY_DEFICIT_TURNS = 3;    // Kaç dönem üst üste açık verilirse vakıf kapanır
export const COOP_EMPLOYMENT_BONUS    = 0.30;  // Co-op mezun istihdam artışı
export const COOP_SPONSOR_BONUS       = 0.20;  // Co-op sponsorluk geliri artışı
export const COOP_MAINTENANCE_MALUS   = 0.15;  // Co-op kampüs bakım maliyeti artışı
export const BASE_ENDOWMENT_SPEND_PCT = 0.05;  // Endowment yıllık harcama oranı (%5)
export const TUITION_MULTIPLIER_TIP   = 2.0;  // Tıp bölümü harç çarpanı
export const TUITION_MULTIPLIER_MUH   = 1.3;  // Mühendislik bölümü harç çarpanı
export const TUITION_MULTIPLIER_HUK   = 1.2;  // Hukuk/İşletme harç çarpanı
export const TUITION_MULTIPLIER_FEN   = 1.0;  // Fen bilimleri baz çarpanı
export const TUITION_MULTIPLIER_SOS   = 0.9;  // Sosyal bilimler harç çarpanı

// ─────────────────────────────────────────────────────────────────────────────
// ÜNİVERSİTE TİPLERİ
// Oyun başında seçilen tüm ekonomiyi belirleyen temel parametre.
// ─────────────────────────────────────────────────────────────────────────────

export const UNIVERSITY_TYPES = {
  devlet: {
    id:              'devlet',
    name:            'Devlet Üniversitesi',
    difficultyStars: 3,

    // Başlangıç kaynakları
    startBudget:         50_000_000,   // ₺ — başlangıç kasası
    startStudents:       1200,
    startFaculty:        45,
    startPrestige:       35,
    startDepartments:    6,
    monthlyFixedCost:    8_000_000,    // ₺/dönem temel sabit gider

    // Maaş tavanı (ek ders + döner dahil, aylık)
    facultySalaryCap:    200_000,      // ₺/ay
    salaryFlexibility:   'low',        // low | medium | high

    // Kadro esnekliği
    hiringDelay:         1,            // dönem — merkezi atama gecikmesi
    firingDifficulty:    'very_high',  // sözleşme değil, kadrolu

    // Gelir yapısı (oran, bilgi amaçlı)
    revenueStructure: {
      stateGrant:       0.575,  // %50-65 orta
      tuitionFees:      0.125,  // çok düşük (sembolik)
      researchFunds:    0.15,
      donerSermaye:     0.075,
      other:            0.075,
    },

    // Kısıtlar
    yokRestrictions:   true,          // kontenjan/bölüm açma YÖK onayı gerektirir
    budgetSurplusLoss: true,          // yıl sonu harcanmayan bütçe kesilir
    bankruptcyRisk:    'very_low',    // kayyum atanır, oyun devam eder
    tuitionControl:    'fixed',       // sabit (YÖK belirler)
    tuitionPerSemester: 3_500,        // ₺ — sembolik katkı payı (baz)
    publicPrestigeBonus: 5,           // kurumsal saygınlık başlangıç bonusu

    // Spor (Türkiye modeli)
    sportsDivision:    null,
  },

  vakif: {
    id:              'vakif',
    name:            'Vakıf Üniversitesi',
    difficultyStars: 4,

    startBudget:         80_000_000,
    startStudents:       600,
    startFaculty:        25,
    startPrestige:       20,
    startDepartments:    3,
    monthlyFixedCost:    6_000_000,

    facultySalaryCap:    null,          // tavan yok
    salaryFlexibility:   'high',

    hiringDelay:         0,
    firingDifficulty:    'low',         // sözleşme bazlı

    revenueStructure: {
      stateGrant:       0,
      tuitionFees:      0.60,           // ANA GELİR KAYNAĞI
      foundationSupport: 0.15,
      researchFunds:    0.10,
      donerSermaye:     0.075,
      other:            0.075,
    },

    yokRestrictions:   false,
    budgetSurplusLoss: false,           // fazlayı yatırıma dönüştür
    bankruptcyRisk:    'high',
    tuitionControl:    'player',        // oyuncu belirler
    tuitionPerSemester: 65_000,         // ₺ — başlangıç önerisi (orta segmant)
    publicPrestigeBonus: -5,            // "paralı üniversite" algısı

    // Prestij tavanı kısıtı (ilk 30 yıl)
    prestigeCeilingYears: 30,
    prestigeCeiling:       75,

    sportsDivision: null,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ÜNİVERSİTE EKONOMİ MODELLERİ
// Oyun başında seçilen tipe göre gelir/gider yapısını ve kısıtları tanımlar.
// state.meta.universityType: 'devlet' | 'vakif' | 'us_private'
// ─────────────────────────────────────────────────────────────────────────────

export const UNIVERSITY_MODELS = {
  devlet: {
    name:         'Türkiye — Devlet Üniversitesi',
    tuitionModel: 'free',   // öğrenci ücretten muaf; sadece sembolik katkı payı
    revenueStreams: {
      // YÖK bütçe tahsisi
      yokTahsisi: {
        base:          50_000_000,   // ₺/dönem temel ödenek
        perStudent:    15_000,       // ₺/dönem öğrenci başı
        perFaculty:    80_000,       // ₺/dönem hoca başı
        researchBonus: 5_000_000,   // araştırma üniversitesi bonusu
      },
      // Öğrenci katkı payı (tam harç değil, sembolik)
      ogrenciKatkiPayi: {
        perStudent: 2_000,           // ₺/dönem (sabit, YÖK belirler)
      },
      // TÜBİTAK / BAP proje gelirleri (overhead)
      tubitak: {
        baseChance: 0.30,            // dönem başına proje kazanma olasılığı (bölüm başı)
        avgGrant:   500_000,         // ₺ — ortalama proje büyüklüğü
        overheadRate: 0.15,          // projenin %15'i üniversiteye overhead
      },
      // Döner sermaye (danışmanlık, sürekli eğitim, lab hizmetleri)
      donerSermaye: {
        base:       2_000_000,       // ₺/dönem baz
        perDept:    150_000,         // ₺/dönem açık bölüm başı
      },
      // Yurt / yemekhane gelirleri
      yurtGeliri: {
        perBed:     8_000,           // ₺/dönem yatak başı
      },
      // Bağışlar (sınırlı — devlet kurumu imajı)
      bagis: {
        base:       500_000,         // ₺/dönem
        perPrestige: 10_000,         // ₺/dönem prestij puanı başı
      },
    },
    constraints: {
      kadroSystem:          true,    // yeni kadro için hükümetten onay gerekir
      kadroWaitTurns:       2,       // onay için bekleme süresi (dönem)
      salaryFixed:          true,    // maaş skalası sabit (657/2914 sayılı K.)
      maxFacultyBudgetRatio: 0.60,   // bütçenin en fazla %60'ı maaşa gidebilir
      budgetSurplusLoss:    true,    // yıl sonu fazlası Hazine'ye döner
      yokApproval:          true,    // bölüm/kontenjan değişikliği YÖK onayına tabi
    },
    scholarshipModel: 'none',        // harç yok, burs sistemi gereksiz
    revenueLabels: {
      primary:   'YÖK Bütçe Tahsisi',
      secondary: 'TÜBİTAK / BAP Fonları',
      tertiary:  'Döner Sermaye',
      other:     'Katkı Payı & Bağışlar',
    },
  },

  vakif: {
    name:         'Türkiye — Vakıf Üniversitesi',
    tuitionModel: 'paid',   // ana gelir kaynağı harç
    revenueStreams: {
      // Öğrenci ücretleri (bölüme göre değişir)
      ogrenciUcreti: {
        // Her bölüm için tuitionMultiplier × baseTuition × öğrenci sayısı
        // tam_burslu → 0, yari_burslu → %50, ucretli → tam
      },
      // Vakıf katkısı (endowment benzeri)
      vakifKatkisi: {
        base:       10_000_000,   // ₺/dönem
        growthRate: 0.02,         // dönem başı büyüme
      },
      // Araştırma fonları
      arastirmaFonlari: {
        baseChance:  0.40,
        avgGrant:    300_000,
        overheadRate: 0.15,
      },
      // Döner sermaye
      donerSermaye: {
        base:    1_000_000,
        perDept: 100_000,
      },
      // Bağışlar & sponsorluk
      bagis: {
        base:        2_000_000,
        perPrestige: 25_000,
      },
    },
    constraints: {
      kadroSystem:   false,    // sözleşmeli istihdam, serbestçe işe al
      salaryFixed:   false,    // rekabetçi maaş teklifi yapılabilir
      yokApproval:   false,    // kontenjan esnekliği var (ama YÖK çerçevesinde)
    },
    scholarshipModel: 'quota',  // tam burslu / yarı burslu / ücretli
    revenueLabels: {
      primary:   'Öğrenci Ücretleri',
      secondary: 'Vakıf Katkısı',
      tertiary:  'Araştırma Fonları',
      other:     'Döner Sermaye & Bağışlar',
    },
  },

  us_private: {
    name:         'ABD — Özel Üniversite',
    tuitionModel: 'paid',   // yüksek harç; need-based financial aid
    revenueStreams: {
      // Harç (çok yüksek)
      tuition: {
        perStudentUSD: 55_000,    // $/yıl → ×34 TL karşılığı
        // Dönem geliri: öğrenci × (55000 × 34 / 2) × aid_adjusted
      },
      // Endowment getirileri
      endowment: {
        base:       100_000_000,  // ₺ başlangıç endowment
        returnRate: 0.05,         // yıllık %5 getiri → dönem: /2
      },
      // Araştırma hibeleri (NIH, NSF, vb.)
      researchGrants: {
        baseChance:   0.50,
        avgGrantUSD:  2_000_000,  // $ → ×34
        overheadRate: 0.26,       // F&A (facilities & admin) oranı
      },
      // Spor gelirleri (futbol/basketbol)
      athleticRevenue: {
        base: 5_000_000,          // ₺/dönem
      },
      // Mezun bağışları
      alumniDonations: {
        base:        10_000_000,
        perPrestige:   200_000,
      },
      // Teknoloji lisanslama / patent
      techLicensing: {
        base:       1_000_000,
        perPatent:    250_000,
      },
    },
    constraints: {
      kadroSystem:    false,
      salaryFixed:    false,
      tenureTrack:    true,    // tenure-track sistemi (işe alım → tenure review)
      yokApproval:    false,
    },
    scholarshipModel: 'financial_aid',  // ihtiyaç bazlı + başarı bursu
    revenueLabels: {
      primary:   'Tuition & Fees',
      secondary: 'Endowment Getirileri',
      tertiary:  'Araştırma Hibeleri',
      other:     'Bağışlar, Spor & Lisanslama',
    },
  },
};

// USD → TL dönüşüm sabiti (oyun içi sabit kur)
export const USD_TO_TL = 34;

// ─────────────────────────────────────────────────────────────────────────────
// BÖLÜMLER
// Her bölüm için tam veri seti. GDD ekonomi ve araştırma mekaniklerine uygun.
// ─────────────────────────────────────────────────────────────────────────────

export const DEPARTMENTS = {
  bilgisayar_muh: {
    id:                      'bilgisayar_muh',
    name:                    'Bilgisayar Mühendisliği',
    shortName:               'Bilg. Müh.',
    category:                'muhendislik',
    icon:                    '💻',

    // Açılış maliyeti (ilk kurulum, lab dahil)
    startCost:               15_000_000,  // ₺
    // Bölüm başına yıllık işletme maliyeti (sabit giderler dışında)
    annualOperatingCost:     4_000_000,

    // Araştırma kapasitesi (1-5 yıldız)
    researchPotential:       5,
    // Laboratuvar gereksinimi (0=hiç, 5=yoğun lab şart)
    labRequirement:          3,
    // Hoca başına yıllık ortalama yayın (SCI/SSCI)
    avgPublicationPerFaculty: 2.8,
    // TÜBİTAK/AB proje bütçe aralığı (₺)
    projectBudgetRange:      [500_000, 8_000_000],
    // Hoca elde tutma güçlüğü (1=kolay, 5=çok zor — sektör çekimi)
    facultyRetentionDifficulty: 5,
    // Öğrenci harç verimliliği (gelir/maliyet oranı baz = 1.0)
    revenueEfficiency:       1.4,
    // Öğrenci talebi çarpanı (1.0 = ortalama)
    baseStudentDemand:       1.6,
    // ÖSYM taban puan aralığı (baz, dönemsel trendlerle değişir)
    baseEntryScore:          [480, 530],
    // Harç çarpanı (TUITION_MULTIPLIER_MUH'u override eder)
    tuitionMultiplier:       1.35,
  },

  elektrik_elektronik: {
    id:                      'elektrik_elektronik',
    name:                    'Elektrik-Elektronik Mühendisliği',
    shortName:               'EE Müh.',
    category:                'muhendislik',
    icon:                    '⚡',
    startCost:               14_000_000,
    annualOperatingCost:     3_800_000,
    researchPotential:       5,
    labRequirement:          4,
    avgPublicationPerFaculty: 2.6,
    projectBudgetRange:      [400_000, 7_000_000],
    facultyRetentionDifficulty: 4,
    revenueEfficiency:       1.3,
    baseStudentDemand:       1.4,
    baseEntryScore:          [460, 515],
    tuitionMultiplier:       1.3,
  },

  makine: {
    id:                      'makine',
    name:                    'Makine Mühendisliği',
    shortName:               'Makine',
    category:                'muhendislik',
    icon:                    '⚙️',
    startCost:               12_000_000,
    annualOperatingCost:     3_500_000,
    researchPotential:       4,
    labRequirement:          4,
    avgPublicationPerFaculty: 2.2,
    projectBudgetRange:      [350_000, 6_000_000],
    facultyRetentionDifficulty: 3,
    revenueEfficiency:       1.2,
    baseStudentDemand:       1.3,
    baseEntryScore:          [440, 500],
    tuitionMultiplier:       1.3,
  },

  insaat: {
    id:                      'insaat',
    name:                    'İnşaat Mühendisliği',
    shortName:               'İnşaat',
    category:                'muhendislik',
    icon:                    '🏗️',
    startCost:               10_000_000,
    annualOperatingCost:     3_000_000,
    researchPotential:       3,
    labRequirement:          3,
    avgPublicationPerFaculty: 1.8,
    projectBudgetRange:      [300_000, 5_000_000],
    facultyRetentionDifficulty: 2,
    revenueEfficiency:       1.1,
    baseStudentDemand:       1.1,
    baseEntryScore:          [410, 470],
    tuitionMultiplier:       1.3,
  },

  endustri: {
    id:                      'endustri',
    name:                    'Endüstri Mühendisliği',
    shortName:               'End. Müh.',
    category:                'muhendislik',
    icon:                    '📊',
    startCost:               9_000_000,
    annualOperatingCost:     2_800_000,
    researchPotential:       3,
    labRequirement:          2,
    avgPublicationPerFaculty: 1.9,
    projectBudgetRange:      [250_000, 4_500_000],
    facultyRetentionDifficulty: 3,
    revenueEfficiency:       1.2,
    baseStudentDemand:       1.2,
    baseEntryScore:          [420, 480],
    tuitionMultiplier:       1.25,
  },

  biyomedikal: {
    id:                      'biyomedikal',
    name:                    'Biyomedikal Mühendisliği',
    shortName:               'Biyomed.',
    category:                'muhendislik',
    icon:                    '🔬',
    startCost:               16_000_000,
    annualOperatingCost:     4_500_000,
    researchPotential:       5,
    labRequirement:          5,
    avgPublicationPerFaculty: 3.0,
    projectBudgetRange:      [600_000, 9_000_000],
    facultyRetentionDifficulty: 4,
    revenueEfficiency:       1.3,
    baseStudentDemand:       1.2,
    baseEntryScore:          [450, 510],
    tuitionMultiplier:       1.4,
  },

  yapay_zeka: {
    id:                      'yapay_zeka',
    name:                    'Yapay Zeka Mühendisliği',
    shortName:               'YZ Müh.',
    category:                'muhendislik',
    icon:                    '🤖',
    startCost:               18_000_000,
    annualOperatingCost:     5_000_000,
    researchPotential:       5,
    labRequirement:          3,
    avgPublicationPerFaculty: 3.5,
    projectBudgetRange:      [700_000, 12_000_000],
    facultyRetentionDifficulty: 5,  // sektör çekimi çok güçlü
    revenueEfficiency:       1.6,
    baseStudentDemand:       1.8,   // trend bölüm
    baseEntryScore:          [490, 540],
    tuitionMultiplier:       1.5,
    // Trenddeki bölüm — talep dönemsel spike'lara çok duyarlı
    trendSensitivity:        'very_high',
  },

  fizik: {
    id:                      'fizik',
    name:                    'Fizik',
    shortName:               'Fizik',
    category:                'temel_bilim',
    icon:                    '⚛️',
    startCost:               11_000_000,
    annualOperatingCost:     3_200_000,
    researchPotential:       5,
    labRequirement:          4,
    avgPublicationPerFaculty: 3.2,
    projectBudgetRange:      [400_000, 7_000_000],
    facultyRetentionDifficulty: 2,
    revenueEfficiency:       0.8,
    baseStudentDemand:       0.7,
    baseEntryScore:          [400, 460],
    tuitionMultiplier:       1.0,
  },

  kimya: {
    id:                      'kimya',
    name:                    'Kimya',
    shortName:               'Kimya',
    category:                'temel_bilim',
    icon:                    '🧪',
    startCost:               10_500_000,
    annualOperatingCost:     3_100_000,
    researchPotential:       4,
    labRequirement:          5,
    avgPublicationPerFaculty: 2.9,
    projectBudgetRange:      [350_000, 6_000_000],
    facultyRetentionDifficulty: 2,
    revenueEfficiency:       0.85,
    baseStudentDemand:       0.75,
    baseEntryScore:          [390, 450],
    tuitionMultiplier:       1.0,
  },

  matematik: {
    id:                      'matematik',
    name:                    'Matematik',
    shortName:               'Mat.',
    category:                'temel_bilim',
    icon:                    '∑',
    startCost:               6_000_000,
    annualOperatingCost:     1_800_000,
    researchPotential:       4,
    labRequirement:          0,
    avgPublicationPerFaculty: 2.4,
    projectBudgetRange:      [200_000, 3_500_000],
    facultyRetentionDifficulty: 2,
    revenueEfficiency:       0.9,
    baseStudentDemand:       0.65,
    baseEntryScore:          [380, 445],
    tuitionMultiplier:       1.0,
  },

  biyoloji: {
    id:                      'biyoloji',
    name:                    'Biyoloji',
    shortName:               'Biyoloji',
    category:                'temel_bilim',
    icon:                    '🧬',
    startCost:               9_000_000,
    annualOperatingCost:     2_700_000,
    researchPotential:       4,
    labRequirement:          4,
    avgPublicationPerFaculty: 2.6,
    projectBudgetRange:      [300_000, 5_500_000],
    facultyRetentionDifficulty: 2,
    revenueEfficiency:       0.85,
    baseStudentDemand:       0.8,
    baseEntryScore:          [385, 450],
    tuitionMultiplier:       1.0,
  },

  isletme: {
    id:                      'isletme',
    name:                    'İşletme',
    shortName:               'İşletme',
    category:                'sosyal',
    icon:                    '📈',
    startCost:               7_000_000,
    annualOperatingCost:     2_000_000,
    researchPotential:       2,
    labRequirement:          1,
    avgPublicationPerFaculty: 1.4,
    projectBudgetRange:      [150_000, 2_500_000],
    facultyRetentionDifficulty: 3,  // danışmanlık geliri yüksek, sektöre çekilir
    revenueEfficiency:       1.4,   // düşük maliyet, yüksek talep
    baseStudentDemand:       1.5,
    baseEntryScore:          [380, 450],
    tuitionMultiplier:       1.2,
  },

  iktisat: {
    id:                      'iktisat',
    name:                    'İktisat',
    shortName:               'İktisat',
    category:                'sosyal',
    icon:                    '💰',
    startCost:               6_500_000,
    annualOperatingCost:     1_900_000,
    researchPotential:       3,
    labRequirement:          1,
    avgPublicationPerFaculty: 1.7,
    projectBudgetRange:      [150_000, 3_000_000],
    facultyRetentionDifficulty: 3,
    revenueEfficiency:       1.3,
    baseStudentDemand:       1.2,
    baseEntryScore:          [370, 440],
    tuitionMultiplier:       1.2,
  },

  hukuk: {
    id:                      'hukuk',
    name:                    'Hukuk',
    shortName:               'Hukuk',
    category:                'sosyal',
    icon:                    '⚖️',
    startCost:               8_000_000,
    annualOperatingCost:     2_200_000,
    researchPotential:       2,
    labRequirement:          0,
    avgPublicationPerFaculty: 1.2,
    projectBudgetRange:      [100_000, 2_000_000],
    facultyRetentionDifficulty: 4,  // avukatlık ile rekabet
    revenueEfficiency:       1.4,
    baseStudentDemand:       1.4,
    baseEntryScore:          [420, 490],
    tuitionMultiplier:       1.2,
  },

  psikoloji: {
    id:                      'psikoloji',
    name:                    'Psikoloji',
    shortName:               'Psikoloji',
    category:                'sosyal',
    icon:                    '🧠',
    startCost:               6_000_000,
    annualOperatingCost:     1_700_000,
    researchPotential:       3,
    labRequirement:          2,
    avgPublicationPerFaculty: 1.8,
    projectBudgetRange:      [120_000, 2_500_000],
    facultyRetentionDifficulty: 2,
    revenueEfficiency:       1.0,
    baseStudentDemand:       1.1,
    baseEntryScore:          [380, 445],
    tuitionMultiplier:       0.9,
  },

  tip: {
    id:                      'tip',
    name:                    'Tıp',
    shortName:               'Tıp',
    category:                'saglik',
    icon:                    '🏥',
    startCost:               40_000_000,  // hastane altyapısı dahil
    annualOperatingCost:     12_000_000,
    researchPotential:       5,
    labRequirement:          5,
    avgPublicationPerFaculty: 4.0,
    projectBudgetRange:      [1_000_000, 20_000_000],
    facultyRetentionDifficulty: 3,
    revenueEfficiency:       1.8,          // döner sermaye çok yüksek
    baseStudentDemand:       2.0,          // en yüksek talep
    baseEntryScore:          [540, 560],   // YKS neredeyse tavan
    tuitionMultiplier:       2.0,
    // Tıp'ta döner sermaye ek gelir kaynağı
    donerSermayeMultiplier:  2.5,
    // Hastane gereksinimi (inşaat)
    requiresHospital:        true,
  },

  dis_hekimligi: {
    id:                      'dis_hekimligi',
    name:                    'Diş Hekimliği',
    shortName:               'Diş Hek.',
    category:                'saglik',
    icon:                    '🦷',
    startCost:               25_000_000,
    annualOperatingCost:     7_000_000,
    researchPotential:       4,
    labRequirement:          5,
    avgPublicationPerFaculty: 2.8,
    projectBudgetRange:      [400_000, 6_000_000],
    facultyRetentionDifficulty: 3,
    revenueEfficiency:       1.7,
    baseStudentDemand:       1.7,
    baseEntryScore:          [510, 545],
    tuitionMultiplier:       1.8,
    donerSermayeMultiplier:  2.0,
    requiresClinic:          true,
  },

  eczacilik: {
    id:                      'eczacilik',
    name:                    'Eczacılık',
    shortName:               'Eczacılık',
    category:                'saglik',
    icon:                    '💊',
    startCost:               18_000_000,
    annualOperatingCost:     5_000_000,
    researchPotential:       4,
    labRequirement:          4,
    avgPublicationPerFaculty: 2.5,
    projectBudgetRange:      [350_000, 6_000_000],
    facultyRetentionDifficulty: 2,
    revenueEfficiency:       1.4,
    baseStudentDemand:       1.4,
    baseEntryScore:          [490, 530],
    tuitionMultiplier:       1.6,
  },

  hemsirelik: {
    id:                      'hemsirelik',
    name:                    'Hemşirelik',
    shortName:               'Hemşirelik',
    category:                'saglik',
    icon:                    '🩺',
    startCost:               10_000_000,
    annualOperatingCost:     3_000_000,
    researchPotential:       3,
    labRequirement:          3,
    avgPublicationPerFaculty: 1.6,
    projectBudgetRange:      [150_000, 3_000_000],
    facultyRetentionDifficulty: 3,  // göç, sektör çekimi
    revenueEfficiency:       1.1,
    baseStudentDemand:       1.2,
    baseEntryScore:          [380, 440],
    tuitionMultiplier:       1.2,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DERS MÜFREDATLARı
// Her bölüm için zorunlu ve seçmeli dersler. Uzmanlık alanı eşleştirmesi için
// requiredExpertise kullanılır (faculty.js'deki DEPARTMENT_FIELDS ile uyumlu).
// ─────────────────────────────────────────────────────────────────────────────

export const DEPARTMENT_CURRICULA = {
  bilgisayar_muh: [
    { id: 'bm01', name: 'Algoritma ve Karmaşıklık',   type: 'zorunlu', difficulty: 3, requiredExpertise: 'Yazılım Mühendisliği', idealClassSize: 50, hoursPerWeek: 4 },
    { id: 'bm02', name: 'Veri Yapıları',              type: 'zorunlu', difficulty: 3, requiredExpertise: 'Yazılım Mühendisliği', idealClassSize: 50, hoursPerWeek: 4 },
    { id: 'bm03', name: 'İşletim Sistemleri',         type: 'zorunlu', difficulty: 3, requiredExpertise: 'Gömülü Sistemler',     idealClassSize: 45, hoursPerWeek: 4 },
    { id: 'bm04', name: 'Bilgisayar Ağları',          type: 'zorunlu', difficulty: 3, requiredExpertise: 'Ağ Sistemleri',        idealClassSize: 45, hoursPerWeek: 3 },
    { id: 'bm05', name: 'Veri Tabanı Sistemleri',     type: 'zorunlu', difficulty: 2, requiredExpertise: 'Veri Tabanları',       idealClassSize: 50, hoursPerWeek: 3 },
    { id: 'bm06', name: 'Bilgisayar Mimarisi',        type: 'zorunlu', difficulty: 3, requiredExpertise: 'Bilgisayar Mimarisi', idealClassSize: 45, hoursPerWeek: 3 },
    { id: 'bm07', name: 'Yapay Zekaya Giriş',         type: 'seçmeli', difficulty: 3, requiredExpertise: 'Görüntü İşleme',       idealClassSize: 40, hoursPerWeek: 3 },
    { id: 'bm08', name: 'Siber Güvenlik',             type: 'seçmeli', difficulty: 3, requiredExpertise: 'Güvenlik',             idealClassSize: 35, hoursPerWeek: 3 },
  ],
  elektrik_elektronik: [
    { id: 'ee01', name: 'Devre Analizi',              type: 'zorunlu', difficulty: 3, requiredExpertise: 'Devre Tasarımı',       idealClassSize: 50, hoursPerWeek: 4 },
    { id: 'ee02', name: 'Sinyal ve Sistemler',        type: 'zorunlu', difficulty: 4, requiredExpertise: 'Sinyal İşleme',        idealClassSize: 45, hoursPerWeek: 4 },
    { id: 'ee03', name: 'Elektromanyetik Alan',       type: 'zorunlu', difficulty: 4, requiredExpertise: 'Antenler ve Yayılım',  idealClassSize: 40, hoursPerWeek: 4 },
    { id: 'ee04', name: 'Güç Elektroniği',            type: 'zorunlu', difficulty: 3, requiredExpertise: 'Güç Sistemleri',       idealClassSize: 45, hoursPerWeek: 3 },
    { id: 'ee05', name: 'Mikrodenetleyiciler',        type: 'zorunlu', difficulty: 3, requiredExpertise: 'Mikrodenetleyiciler',  idealClassSize: 45, hoursPerWeek: 3 },
    { id: 'ee06', name: 'Haberleşme Sistemleri',      type: 'seçmeli', difficulty: 3, requiredExpertise: 'Haberleşme',           idealClassSize: 35, hoursPerWeek: 3 },
  ],
  makine: [
    { id: 'mak01', name: 'Termodinamik',              type: 'zorunlu', difficulty: 3, requiredExpertise: 'Termodinamik',         idealClassSize: 50, hoursPerWeek: 4 },
    { id: 'mak02', name: 'Akışkanlar Mekaniği',       type: 'zorunlu', difficulty: 4, requiredExpertise: 'Akışkanlar Mekaniği', idealClassSize: 45, hoursPerWeek: 4 },
    { id: 'mak03', name: 'Malzeme Bilimi',            type: 'zorunlu', difficulty: 2, requiredExpertise: 'Malzeme Bilimi',       idealClassSize: 50, hoursPerWeek: 3 },
    { id: 'mak04', name: 'İmalat Teknolojileri',      type: 'zorunlu', difficulty: 2, requiredExpertise: 'İmalat',               idealClassSize: 45, hoursPerWeek: 3 },
    { id: 'mak05', name: 'Mekatronik Sistemler',      type: 'seçmeli', difficulty: 3, requiredExpertise: 'Mekatronik',            idealClassSize: 35, hoursPerWeek: 3 },
    { id: 'mak06', name: 'Enerji Sistemleri',         type: 'seçmeli', difficulty: 3, requiredExpertise: 'Enerji Sistemleri',    idealClassSize: 35, hoursPerWeek: 3 },
  ],
  insaat: [
    { id: 'ins01', name: 'Yapı Statiği',              type: 'zorunlu', difficulty: 3, requiredExpertise: 'Yapı Mühendisliği',   idealClassSize: 50, hoursPerWeek: 4 },
    { id: 'ins02', name: 'Geoteknik Mühendisliği',    type: 'zorunlu', difficulty: 3, requiredExpertise: 'Geoteknik',            idealClassSize: 45, hoursPerWeek: 3 },
    { id: 'ins03', name: 'Ulaştırma Mühendisliği',    type: 'zorunlu', difficulty: 2, requiredExpertise: 'Ulaştırma',            idealClassSize: 45, hoursPerWeek: 3 },
    { id: 'ins04', name: 'Su Kaynakları Mühendisliği', type: 'zorunlu', difficulty: 3, requiredExpertise: 'Su Kaynakları',        idealClassSize: 40, hoursPerWeek: 3 },
    { id: 'ins05', name: 'Deprem Mühendisliği',       type: 'seçmeli', difficulty: 4, requiredExpertise: 'Deprem Mühendisliği', idealClassSize: 35, hoursPerWeek: 3 },
  ],
  endustri: [
    { id: 'end01', name: 'Operasyon Araştırması',     type: 'zorunlu', difficulty: 4, requiredExpertise: 'Operasyon Araştırması', idealClassSize: 50, hoursPerWeek: 4 },
    { id: 'end02', name: 'Üretim Sistemleri',         type: 'zorunlu', difficulty: 3, requiredExpertise: 'Üretim Sistemleri',    idealClassSize: 50, hoursPerWeek: 3 },
    { id: 'end03', name: 'Tedarik Zinciri Yönetimi',  type: 'zorunlu', difficulty: 3, requiredExpertise: 'Lojistik',             idealClassSize: 45, hoursPerWeek: 3 },
    { id: 'end04', name: 'Kalite Yönetimi',           type: 'seçmeli', difficulty: 2, requiredExpertise: 'Kalite Yönetimi',      idealClassSize: 40, hoursPerWeek: 3 },
    { id: 'end05', name: 'İnsan Faktörleri',          type: 'seçmeli', difficulty: 2, requiredExpertise: 'İnsan Faktörleri',    idealClassSize: 35, hoursPerWeek: 3 },
  ],
  biyomedikal: [
    { id: 'bm_t01', name: 'Tıbbi Görüntüleme',       type: 'zorunlu', difficulty: 4, requiredExpertise: 'Tıbbi Görüntüleme',   idealClassSize: 35, hoursPerWeek: 4 },
    { id: 'bm_t02', name: 'Biyomekanik',              type: 'zorunlu', difficulty: 3, requiredExpertise: 'Biyomekanik',          idealClassSize: 35, hoursPerWeek: 3 },
    { id: 'bm_t03', name: 'Biyoelektronik',           type: 'zorunlu', difficulty: 4, requiredExpertise: 'Biyoelektronik',       idealClassSize: 35, hoursPerWeek: 4 },
    { id: 'bm_t04', name: 'Doku Mühendisliği',        type: 'seçmeli', difficulty: 4, requiredExpertise: 'Doku Mühendisliği',   idealClassSize: 25, hoursPerWeek: 3 },
    { id: 'bm_t05', name: 'Protez Tasarımı',          type: 'seçmeli', difficulty: 3, requiredExpertise: 'Protez Tasarımı',     idealClassSize: 25, hoursPerWeek: 3 },
  ],
  yapay_zeka: [
    { id: 'yz01', name: 'Makine Öğrenmesi',           type: 'zorunlu', difficulty: 4, requiredExpertise: 'Makine Öğrenmesi',    idealClassSize: 40, hoursPerWeek: 4 },
    { id: 'yz02', name: 'Derin Öğrenme',              type: 'zorunlu', difficulty: 5, requiredExpertise: 'Derin Öğrenme',       idealClassSize: 35, hoursPerWeek: 4 },
    { id: 'yz03', name: 'Doğal Dil İşleme',           type: 'zorunlu', difficulty: 4, requiredExpertise: 'Doğal Dil İşleme',   idealClassSize: 35, hoursPerWeek: 3 },
    { id: 'yz04', name: 'Bilgisayarla Görü',          type: 'zorunlu', difficulty: 4, requiredExpertise: 'Bilgisayarla Görü',  idealClassSize: 35, hoursPerWeek: 3 },
    { id: 'yz05', name: 'Robotik',                    type: 'seçmeli', difficulty: 4, requiredExpertise: 'Robotik',             idealClassSize: 30, hoursPerWeek: 4 },
    { id: 'yz06', name: 'Pekiştirmeli Öğrenme',       type: 'seçmeli', difficulty: 5, requiredExpertise: 'Pekiştirmeli Öğrenme', idealClassSize: 25, hoursPerWeek: 3 },
  ],
  fizik: [
    { id: 'fiz01', name: 'Kuantum Mekaniği',          type: 'zorunlu', difficulty: 5, requiredExpertise: 'Kuantum Fiziği',      idealClassSize: 35, hoursPerWeek: 4 },
    { id: 'fiz02', name: 'Klasik Mekanik',            type: 'zorunlu', difficulty: 4, requiredExpertise: 'Teorik Fizik',        idealClassSize: 40, hoursPerWeek: 4 },
    { id: 'fiz03', name: 'Elektromanyetik Teori',     type: 'zorunlu', difficulty: 4, requiredExpertise: 'Optik',               idealClassSize: 40, hoursPerWeek: 4 },
    { id: 'fiz04', name: 'Yoğun Madde Fiziği',        type: 'seçmeli', difficulty: 5, requiredExpertise: 'Yoğun Madde',         idealClassSize: 25, hoursPerWeek: 3 },
    { id: 'fiz05', name: 'Astrofizik',                type: 'seçmeli', difficulty: 4, requiredExpertise: 'Astrofizik',           idealClassSize: 30, hoursPerWeek: 3 },
  ],
  kimya: [
    { id: 'kim01', name: 'Organik Kimya',             type: 'zorunlu', difficulty: 4, requiredExpertise: 'Organik Kimya',       idealClassSize: 40, hoursPerWeek: 4 },
    { id: 'kim02', name: 'Anorganik Kimya',           type: 'zorunlu', difficulty: 3, requiredExpertise: 'Anorganik Kimya',     idealClassSize: 40, hoursPerWeek: 4 },
    { id: 'kim03', name: 'Fizikokimya',               type: 'zorunlu', difficulty: 4, requiredExpertise: 'Fizikokimya',         idealClassSize: 35, hoursPerWeek: 4 },
    { id: 'kim04', name: 'Analitik Kimya',            type: 'zorunlu', difficulty: 3, requiredExpertise: 'Analitik Kimya',      idealClassSize: 40, hoursPerWeek: 3 },
    { id: 'kim05', name: 'Polimer Kimyası',           type: 'seçmeli', difficulty: 3, requiredExpertise: 'Polimer Kimyası',     idealClassSize: 30, hoursPerWeek: 3 },
  ],
  matematik: [
    { id: 'mat01', name: 'Matematik Analiz I-II',     type: 'zorunlu', difficulty: 4, requiredExpertise: 'Analiz',              idealClassSize: 50, hoursPerWeek: 4 },
    { id: 'mat02', name: 'Cebir',                     type: 'zorunlu', difficulty: 4, requiredExpertise: 'Cebir',               idealClassSize: 45, hoursPerWeek: 4 },
    { id: 'mat03', name: 'Topoloji',                  type: 'zorunlu', difficulty: 5, requiredExpertise: 'Topoloji',            idealClassSize: 30, hoursPerWeek: 3 },
    { id: 'mat04', name: 'İstatistik ve Olasılık',    type: 'zorunlu', difficulty: 3, requiredExpertise: 'İstatistik',          idealClassSize: 50, hoursPerWeek: 3 },
    { id: 'mat05', name: 'Sayısal Yöntemler',         type: 'seçmeli', difficulty: 3, requiredExpertise: 'Sayısal Yöntemler',   idealClassSize: 40, hoursPerWeek: 3 },
    { id: 'mat06', name: 'Uygulamalı Matematik',      type: 'seçmeli', difficulty: 3, requiredExpertise: 'Uygulamalı Matematik', idealClassSize: 40, hoursPerWeek: 3 },
  ],
  biyoloji: [
    { id: 'bio01', name: 'Moleküler Biyoloji',        type: 'zorunlu', difficulty: 4, requiredExpertise: 'Moleküler Biyoloji',  idealClassSize: 40, hoursPerWeek: 4 },
    { id: 'bio02', name: 'Genetik',                   type: 'zorunlu', difficulty: 4, requiredExpertise: 'Genetik',             idealClassSize: 40, hoursPerWeek: 4 },
    { id: 'bio03', name: 'Mikrobiyoloji',             type: 'zorunlu', difficulty: 3, requiredExpertise: 'Mikrobiyoloji',       idealClassSize: 40, hoursPerWeek: 4 },
    { id: 'bio04', name: 'Biyokimya',                 type: 'zorunlu', difficulty: 4, requiredExpertise: 'Biyokimya',           idealClassSize: 40, hoursPerWeek: 4 },
    { id: 'bio05', name: 'Ekoloji',                   type: 'seçmeli', difficulty: 2, requiredExpertise: 'Ekoloji',             idealClassSize: 45, hoursPerWeek: 3 },
    { id: 'bio06', name: 'Evrimsel Biyoloji',         type: 'seçmeli', difficulty: 3, requiredExpertise: 'Evrimsel Biyoloji',   idealClassSize: 35, hoursPerWeek: 3 },
  ],
  isletme: [
    { id: 'isl01', name: 'Finans Yönetimi',           type: 'zorunlu', difficulty: 3, requiredExpertise: 'Finans',              idealClassSize: 55, hoursPerWeek: 3 },
    { id: 'isl02', name: 'Pazarlama',                 type: 'zorunlu', difficulty: 2, requiredExpertise: 'Pazarlama',           idealClassSize: 60, hoursPerWeek: 3 },
    { id: 'isl03', name: 'Stratejik Yönetim',         type: 'zorunlu', difficulty: 3, requiredExpertise: 'Stratejik Yönetim',  idealClassSize: 55, hoursPerWeek: 3 },
    { id: 'isl04', name: 'Muhasebe',                  type: 'zorunlu', difficulty: 2, requiredExpertise: 'Muhasebe',            idealClassSize: 60, hoursPerWeek: 3 },
    { id: 'isl05', name: 'Girişimcilik',              type: 'seçmeli', difficulty: 2, requiredExpertise: 'Girişimcilik',        idealClassSize: 40, hoursPerWeek: 3 },
    { id: 'isl06', name: 'İnsan Kaynakları Yönetimi', type: 'seçmeli', difficulty: 2, requiredExpertise: 'İnsan Kaynakları',   idealClassSize: 45, hoursPerWeek: 3 },
  ],
  iktisat: [
    { id: 'ikt01', name: 'Mikroekonomi',              type: 'zorunlu', difficulty: 3, requiredExpertise: 'Mikroekonomi',        idealClassSize: 55, hoursPerWeek: 4 },
    { id: 'ikt02', name: 'Makroekonomi',              type: 'zorunlu', difficulty: 3, requiredExpertise: 'Makroekonomi',        idealClassSize: 55, hoursPerWeek: 4 },
    { id: 'ikt03', name: 'Ekonometri',                type: 'zorunlu', difficulty: 4, requiredExpertise: 'Ekonometri',          idealClassSize: 45, hoursPerWeek: 4 },
    { id: 'ikt04', name: 'Para Teorisi ve Politikası', type: 'seçmeli', difficulty: 3, requiredExpertise: 'Para Teorisi',        idealClassSize: 40, hoursPerWeek: 3 },
    { id: 'ikt05', name: 'Kalkınma Ekonomisi',        type: 'seçmeli', difficulty: 3, requiredExpertise: 'Kalkınma Ekonomisi', idealClassSize: 40, hoursPerWeek: 3 },
  ],
  hukuk: [
    { id: 'huk01', name: 'Medeni Hukuk',              type: 'zorunlu', difficulty: 3, requiredExpertise: 'Medeni Hukuk',        idealClassSize: 60, hoursPerWeek: 4 },
    { id: 'huk02', name: 'Ticaret Hukuku',            type: 'zorunlu', difficulty: 3, requiredExpertise: 'Ticaret Hukuku',      idealClassSize: 55, hoursPerWeek: 4 },
    { id: 'huk03', name: 'Ceza Hukuku',               type: 'zorunlu', difficulty: 3, requiredExpertise: 'Ceza Hukuku',         idealClassSize: 60, hoursPerWeek: 4 },
    { id: 'huk04', name: 'Anayasa Hukuku',            type: 'zorunlu', difficulty: 3, requiredExpertise: 'Anayasa Hukuku',      idealClassSize: 60, hoursPerWeek: 3 },
    { id: 'huk05', name: 'Uluslararası Hukuk',        type: 'seçmeli', difficulty: 3, requiredExpertise: 'Uluslararası Hukuk', idealClassSize: 40, hoursPerWeek: 3 },
  ],
  psikoloji: [
    { id: 'psi01', name: 'Klinik Psikoloji',          type: 'zorunlu', difficulty: 3, requiredExpertise: 'Klinik Psikoloji',   idealClassSize: 40, hoursPerWeek: 4 },
    { id: 'psi02', name: 'Bilişsel Psikoloji',        type: 'zorunlu', difficulty: 3, requiredExpertise: 'Bilişsel Psikoloji', idealClassSize: 45, hoursPerWeek: 3 },
    { id: 'psi03', name: 'Sosyal Psikoloji',          type: 'zorunlu', difficulty: 2, requiredExpertise: 'Sosyal Psikoloji',   idealClassSize: 50, hoursPerWeek: 3 },
    { id: 'psi04', name: 'Nöropsikoloji',             type: 'seçmeli', difficulty: 4, requiredExpertise: 'Nöropsikoloji',      idealClassSize: 30, hoursPerWeek: 3 },
    { id: 'psi05', name: 'Gelişim Psikolojisi',       type: 'seçmeli', difficulty: 3, requiredExpertise: 'Gelişim Psikolojisi', idealClassSize: 40, hoursPerWeek: 3 },
  ],
  tip: [
    { id: 'tip01', name: 'Temel Tıp Bilimleri',       type: 'zorunlu', difficulty: 5, requiredExpertise: 'Dahiliye',            idealClassSize: 30, hoursPerWeek: 6 },
    { id: 'tip02', name: 'Kardiyoloji',                type: 'zorunlu', difficulty: 5, requiredExpertise: 'Kardiyoloji',         idealClassSize: 25, hoursPerWeek: 5 },
    { id: 'tip03', name: 'Onkoloji',                   type: 'zorunlu', difficulty: 5, requiredExpertise: 'Onkoloji',            idealClassSize: 25, hoursPerWeek: 5 },
    { id: 'tip04', name: 'Nöroloji',                   type: 'zorunlu', difficulty: 5, requiredExpertise: 'Nöroloji',            idealClassSize: 25, hoursPerWeek: 5 },
    { id: 'tip05', name: 'Cerrahi',                    type: 'zorunlu', difficulty: 5, requiredExpertise: 'Cerrahi',             idealClassSize: 20, hoursPerWeek: 5 },
    { id: 'tip06', name: 'Pediatri',                   type: 'seçmeli', difficulty: 4, requiredExpertise: 'Pediatri',            idealClassSize: 20, hoursPerWeek: 4 },
    { id: 'tip07', name: 'Radyoloji',                  type: 'seçmeli', difficulty: 4, requiredExpertise: 'Radyoloji',           idealClassSize: 20, hoursPerWeek: 4 },
  ],
  dis_hekimligi: [
    { id: 'dis01', name: 'Ortodonti',                  type: 'zorunlu', difficulty: 4, requiredExpertise: 'Ortodonti',           idealClassSize: 25, hoursPerWeek: 5 },
    { id: 'dis02', name: 'Oral Cerrahi',               type: 'zorunlu', difficulty: 5, requiredExpertise: 'Oral Cerrahi',        idealClassSize: 20, hoursPerWeek: 5 },
    { id: 'dis03', name: 'Endodonti',                  type: 'zorunlu', difficulty: 4, requiredExpertise: 'Endodonti',           idealClassSize: 25, hoursPerWeek: 4 },
    { id: 'dis04', name: 'Protetik Diş Tedavisi',      type: 'zorunlu', difficulty: 4, requiredExpertise: 'Protetik Diş Tedavisi', idealClassSize: 25, hoursPerWeek: 4 },
    { id: 'dis05', name: 'Periodontoloji',             type: 'seçmeli', difficulty: 4, requiredExpertise: 'Periodontoloji',      idealClassSize: 20, hoursPerWeek: 4 },
  ],
  eczacilik: [
    { id: 'ecz01', name: 'Farmakoloji',                type: 'zorunlu', difficulty: 4, requiredExpertise: 'Farmakoloji',         idealClassSize: 35, hoursPerWeek: 5 },
    { id: 'ecz02', name: 'Farmasötik Kimya',           type: 'zorunlu', difficulty: 4, requiredExpertise: 'Farmasötik Kimya',   idealClassSize: 35, hoursPerWeek: 4 },
    { id: 'ecz03', name: 'Klinik Eczacılık',           type: 'zorunlu', difficulty: 3, requiredExpertise: 'Klinik Eczacılık',   idealClassSize: 35, hoursPerWeek: 4 },
    { id: 'ecz04', name: 'Farmakognozy',               type: 'seçmeli', difficulty: 3, requiredExpertise: 'Farmakognozy',       idealClassSize: 30, hoursPerWeek: 3 },
  ],
  hemsirelik: [
    { id: 'hem01', name: 'Dahiliye Hemşireliği',       type: 'zorunlu', difficulty: 3, requiredExpertise: 'Dahiliye Hemşireliği', idealClassSize: 40, hoursPerWeek: 5 },
    { id: 'hem02', name: 'Cerrahi Hemşirelik',         type: 'zorunlu', difficulty: 3, requiredExpertise: 'Cerrahi Hemşirelik', idealClassSize: 35, hoursPerWeek: 5 },
    { id: 'hem03', name: 'Toplum Sağlığı',             type: 'zorunlu', difficulty: 2, requiredExpertise: 'Toplum Sağlığı',     idealClassSize: 45, hoursPerWeek: 4 },
    { id: 'hem04', name: 'Yoğun Bakım Hemşireliği',   type: 'seçmeli', difficulty: 4, requiredExpertise: 'Yoğun Bakım',        idealClassSize: 25, hoursPerWeek: 4 },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// BÖLÜM SİNERJİLERİ
// İki bölümün birlikte açık olması halinde elde edilen bonus.
// ─────────────────────────────────────────────────────────────────────────────

export const DEPARTMENT_SYNERGIES = [
  // Mühendislik kümeleri
  { dept1: 'bilgisayar_muh', dept2: 'yapay_zeka',       bonusType: 'research',    bonusValue: 0.25 },
  { dept1: 'bilgisayar_muh', dept2: 'elektrik_elektronik', bonusType: 'research', bonusValue: 0.15 },
  { dept1: 'bilgisayar_muh', dept2: 'matematik',         bonusType: 'research',    bonusValue: 0.10 },
  { dept1: 'elektrik_elektronik', dept2: 'fizik',        bonusType: 'research',    bonusValue: 0.15 },
  { dept1: 'makine', dept2: 'endustri',                  bonusType: 'revenue',     bonusValue: 0.10 },
  { dept1: 'makine', dept2: 'biyomedikal',               bonusType: 'research',    bonusValue: 0.12 },
  { dept1: 'endustri', dept2: 'isletme',                 bonusType: 'alumni',      bonusValue: 0.15 },

  // Temel bilim köprüleri
  { dept1: 'fizik', dept2: 'matematik',                  bonusType: 'research',    bonusValue: 0.20 },
  { dept1: 'kimya', dept2: 'biyoloji',                   bonusType: 'research',    bonusValue: 0.20 },
  { dept1: 'kimya', dept2: 'eczacilik',                  bonusType: 'research',    bonusValue: 0.18 },
  { dept1: 'biyoloji', dept2: 'tip',                     bonusType: 'research',    bonusValue: 0.22 },
  { dept1: 'biyoloji', dept2: 'biyomedikal',             bonusType: 'research',    bonusValue: 0.20 },
  { dept1: 'matematik', dept2: 'yapay_zeka',             bonusType: 'research',    bonusValue: 0.18 },

  // Sağlık ekosistemi
  { dept1: 'tip', dept2: 'dis_hekimligi',                bonusType: 'donerSermaye', bonusValue: 0.15 },
  { dept1: 'tip', dept2: 'eczacilik',                    bonusType: 'research',    bonusValue: 0.20 },
  { dept1: 'tip', dept2: 'hemsirelik',                   bonusType: 'satisfaction', bonusValue: 0.10 },
  { dept1: 'biyomedikal', dept2: 'tip',                  bonusType: 'research',    bonusValue: 0.25 },

  // Sosyal bilimler
  { dept1: 'isletme', dept2: 'iktisat',                  bonusType: 'revenue',     bonusValue: 0.12 },
  { dept1: 'hukuk', dept2: 'isletme',                    bonusType: 'alumni',      bonusValue: 0.10 },
  { dept1: 'psikoloji', dept2: 'hemsirelik',             bonusType: 'satisfaction', bonusValue: 0.08 },

  // Yapay zeka köprüleri
  { dept1: 'yapay_zeka', dept2: 'isletme',               bonusType: 'revenue',     bonusValue: 0.12 },
  { dept1: 'yapay_zeka', dept2: 'biyomedikal',           bonusType: 'research',    bonusValue: 0.15 },
];

// ─────────────────────────────────────────────────────────────────────────────
// HOCA İSİM HAVUZU
// ─────────────────────────────────────────────────────────────────────────────

export const FACULTY_NAME_POOL = {
  male: [
    'Ahmet', 'Mehmet', 'Mustafa', 'Ali', 'Hüseyin', 'İbrahim', 'Hasan',
    'Ömer', 'Yusuf', 'İsmail', 'Emre', 'Burak', 'Cem', 'Tolga', 'Oğuz',
    'Serkan', 'Murat', 'Tarık', 'Bülent', 'Ercan', 'Fatih', 'Kadir',
    'Selim', 'Alper', 'Berkay',
  ],
  female: [
    'Ayşe', 'Fatma', 'Zeynep', 'Elif', 'Hatice', 'Merve', 'Büşra',
    'Selin', 'Deniz', 'Pınar', 'Şule', 'Nilüfer', 'Gülçin', 'Ece',
    'Berna', 'Serap', 'Derya', 'Ceren', 'Neslihan', 'Sibel',
  ],
  surname: [
    'Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Yıldız', 'Yıldırım',
    'Öztürk', 'Aydın', 'Özdemir', 'Arslan', 'Doğan', 'Kılıç', 'Aslan',
    'Çetin', 'Koç', 'Erdoğan', 'Kurt', 'Özcan', 'Polat', 'Taş', 'Güneş',
    'Korkmaz', 'Aksoy', 'Avcı', 'Şimşek', 'Bulut', 'Güler', 'Keskin',
    'Ateş', 'Karaca', 'Duman', 'Söylemez', 'Ertürk', 'Baran',
  ],
};

// Hoca unvanları (araştırma puanına göre atanır)
export const FACULTY_TITLES = {
  araştırma_görevlisi: { minResearch: 0,  salaryMultiplier: 0.4, label: 'Arş. Gör.' },
  yardimci_docent:     { minResearch: 30, salaryMultiplier: 0.7, label: 'Dr. Öğr. Üyesi' },
  docent:              { minResearch: 55, salaryMultiplier: 0.9, label: 'Doç. Dr.' },
  profesor:            { minResearch: 75, salaryMultiplier: 1.0, label: 'Prof. Dr.' },
};

// ─────────────────────────────────────────────────────────────────────────────
// MAAŞ BAREMLERİ
// Türkiye devlet / vakıf ve ABD özel üniversite maaş aralıkları (aylık ₺)
// ─────────────────────────────────────────────────────────────────────────────

export const SALARY_SCALES = {
  tr_devlet: {
    name:          'Devlet Maaş Baremi',
    argö:          { min: 22_000, max: 28_000 },
    dr_ogr_uyesi:  { min: 28_000, max: 38_000 },
    docent:        { min: 38_000, max: 52_000 },
    profesor:      { min: 52_000, max: 75_000 },
    seniorityBonus: 0.02,   // kıdem başına %2 artış
    maxOverscale:   1.0,    // devlette üst barem aşılamaz
  },
  tr_vakif: {
    name:          'Vakıf Üniversitesi Baremi',
    argö:          { min: 25_000, max: 40_000 },
    dr_ogr_uyesi:  { min: 35_000, max: 55_000 },
    docent:        { min: 50_000, max: 80_000 },
    profesor:      { min: 70_000, max: 120_000 },
    seniorityBonus: 0.03,
    maxOverscale:   1.5,    // yıldız hoçalar için barem üstü ödeme mümkün
  },
  us_private: {
    name:          'ABD Özel Üniversite Baremi',
    argö:          { min: 80_000 * 34, max: 120_000 * 34 },
    dr_ogr_uyesi:  { min: 80_000 * 34, max: 120_000 * 34 },
    docent:        { min: 100_000 * 34, max: 150_000 * 34 },
    profesor:      { min: 130_000 * 34, max: 250_000 * 34 },
    seniorityBonus: 0.025,
    maxOverscale:   2.0,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ÖĞRENCİ İSİM HAVUZU
// ─────────────────────────────────────────────────────────────────────────────

export const STUDENT_NAME_POOL = {
  male: [
    'Ahmet', 'Mehmet', 'Can', 'Emre', 'Berkay', 'Tarık', 'Berk',
    'Enes', 'Kaan', 'Burak', 'Mert', 'Umut', 'Onur',
  ],
  female: [
    'Ayşe', 'Zeynep', 'Elif', 'Merve', 'Selin', 'Ece', 'Büşra',
    'Ceren', 'Deniz', 'Nisa', 'Yağmur', 'Buse', 'İrem',
  ],
  surname: [
    'Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Arslan', 'Doğan', 'Özkan',
    'Güneş', 'Şahin', 'Yıldız', 'Polat', 'Korkmaz', 'Aydın', 'Güler',
    'Taşdemir', 'Kurt', 'Duman', 'Bulut', 'Ateş', 'Kaplan',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// FAKÜLTELERİ TANIMLAYAN GRUPLAMA HARİTASI
// Her fakülte hangi bölümleri barındırabileceğini tanımlar.
// ─────────────────────────────────────────────────────────────────────────────

export const FACULTIES = {
  muhendislik: {
    id:          'muhendislik',
    name:        'Mühendislik Fakültesi',
    icon:        '⚙️',
    departments: ['bilgisayar_muh', 'elektrik_elektronik', 'makine', 'insaat', 'endustri', 'biyomedikal', 'yapay_zeka'],
  },
  fen_edebiyat: {
    id:          'fen_edebiyat',
    name:        'Fen-Edebiyat Fakültesi',
    icon:        '🔬',
    departments: ['matematik', 'fizik', 'kimya', 'biyoloji', 'psikoloji'],
  },
  isletme: {
    id:          'isletme',
    name:        'İşletme Fakültesi',
    icon:        '📊',
    departments: ['isletme', 'iktisat'],
  },
  hukuk: {
    id:          'hukuk',
    name:        'Hukuk Fakültesi',
    icon:        '⚖️',
    departments: ['hukuk'],
  },
  tip: {
    id:          'tip',
    name:        'Tıp Fakültesi',
    icon:        '🏥',
    departments: ['tip', 'dis_hekimligi', 'eczacilik', 'hemsirelik'],
  },
};

// Bölüm → Fakülte eşlemesi (yardımcı)
export const DEPT_TO_FACULTY = (() => {
  const map = {};
  for (const [fId, fData] of Object.entries(FACULTIES)) {
    for (const dId of fData.departments) {
      map[dId] = fId;
    }
  }
  return map;
})();

// ─────────────────────────────────────────────────────────────────────────────
// RAKIP ÜNİVERSİTELER
// ─────────────────────────────────────────────────────────────────────────────

export const INITIAL_RIVAL_UNIVERSITIES = [
  {
    id:           'bogazici_teknik',
    name:         'Boğaziçi Teknik Üniversitesi',
    type:         'devlet',
    prestige:     72,
    budget:       120_000_000,
    // En güçlü olduğu alan
    strengthDept: 'bilgisayar_muh',
    // En zayıf olduğu alan
    weakDept:     'saglik',
    aggressiveness: 0.7,  // 0-1 transfer saldırganlığı
    researchFocus:  true,
    avgYKS:         3_100,     // ortalama YKS sıralaması
    publicationsPerSemester: 45,
    facultyCount:   80,
    studentCount:   3500,
  },
  {
    id:           'anadolu_akademi',
    name:         'Anadolu Akademi Üniversitesi',
    type:         'vakif',
    prestige:     48,
    budget:       90_000_000,
    strengthDept: 'isletme',
    weakDept:     'temel_bilim',
    aggressiveness: 0.9,  // agresif transfer
    researchFocus:  false,
    avgYKS:         42_000,
    publicationsPerSemester: 8,
    facultyCount:   40,
    studentCount:   2200,
  },
  {
    id:           'ege_bilim',
    name:         'Ege Bilim Üniversitesi',
    type:         'devlet',
    prestige:     55,
    budget:       75_000_000,
    strengthDept: 'tip',
    weakDept:     'muhendislik',
    aggressiveness: 0.5,
    researchFocus:  true,
    avgYKS:         18_000,
    publicationsPerSemester: 28,
    facultyCount:   55,
    studentCount:   2800,
  },
  {
    id:           'karadeniz_uni',
    name:         'Karadeniz Üniversitesi',
    type:         'devlet',
    prestige:     42,
    budget:       60_000_000,
    strengthDept: 'insaat',
    weakDept:     'yapay_zeka',
    aggressiveness: 0.4,
    researchFocus:  false,
    avgYKS:         65_000,
    publicationsPerSemester: 12,
    facultyCount:   48,
    studentCount:   3000,
  },
  {
    id:           'akdeniz_vakif',
    name:         'Akdeniz Vakıf Üniversitesi',
    type:         'vakif',
    prestige:     35,
    budget:       110_000_000,
    strengthDept: 'isletme',
    weakDept:     'fizik',
    aggressiveness: 0.8,
    researchFocus:  false,
    avgYKS:         85_000,
    publicationsPerSemester: 5,
    facultyCount:   30,
    studentCount:   1800,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// OLAY HAVUZU
// Her dönem rastgele seçilen olaylar. probability: dönem başına tetiklenme şansı (0-1).
// ─────────────────────────────────────────────────────────────────────────────

export const EVENTS_POOL = [
  {
    id:          'tubitak_buyuk_proje',
    name:        'TÜBİTAK Büyük Proje Ödülü',
    description: 'Bir hocamız 5 yıllık büyük ölçekli TÜBİTAK projesine hibe aldı!',
    type:        'positive',
    probability: 0.08,
    effects: {
      budget:    3_000_000,   // ₺ tek seferlik
      prestige:  +4,
      researchBonus: { dept: null, value: 0.20 },  // null = rastgele bölüm
      facultyHappiness: +8,
    },
  },
  {
    id:          'deprem',
    name:        'Deprem',
    description: 'Bölgede büyük bir deprem meydana geldi. Yerleşke altyapısı hasar gördü.',
    type:        'negative',
    probability: 0.03,
    effects: {
      budget:          -8_000_000,
      prestige:        -5,
      buildingDamage:  0.15,   // binaların %15'i hasar
      studentMorale:   -15,
      semesterDelay:   1,      // dönem erteleme riski
    },
  },
  {
    id:          'pandemi',
    name:        'Salgın Hastalık',
    description: 'Ülke genelinde salgın yayılıyor. Uzaktan eğitime geçilmeli.',
    type:        'negative',
    probability: 0.04,
    effects: {
      budget:          -3_000_000,
      tuitionRevenue:  -0.15,  // harç gelirleri azalır
      studentMorale:   -10,
      facultyHappiness: -8,
      researchBonus:   { dept: null, value: -0.10 },
    },
    // Karar gerektiren varyant
    decision: {
      optionA: { label: 'Hızlı uzaktan eğitime geç',   extraCost: 2_000_000, satisfactionBonus: +5 },
      optionB: { label: 'Karma model uygula',           extraCost: 1_000_000, satisfactionBonus: +2 },
      optionC: { label: 'Mevcut planla devam et',       extraCost: 0,         prestigeMalus: -3  },
    },
  },
  {
    id:          'hoca_istifasi',
    name:        'Yıldız Hoca İstifası',
    description: 'Araştırma puanımız en yüksek hocalardan biri rakip üniversiteye transfer teklifi aldı!',
    type:        'decision',
    probability: 0.12,
    effects: {
      // Karar gerektirir: karşı teklif ver ya da bırak
    },
    decision: {
      optionA: { label: 'Karşı teklif ver (%50 maaş zammı)', budgetCost: 'faculty_salary * 0.5', retainChance: 0.75 },
      optionB: { label: 'Bırak git',                          prestigeLoss: -3, researchLoss: -8 },
    },
  },
  {
    id:          'mezun_bagisi',
    name:        'Başarılı Mezun Bağışı',
    description: 'Başarılı bir mezunumuz yeni laboratuvar için büyük bağış yaptı!',
    type:        'positive',
    probability: 0.07,
    effects: {
      budget:    5_000_000,
      prestige:  +3,
      alumni:    +5,
    },
  },
  {
    id:          'akademik_skandal',
    name:        'Akademik İntihal Skandalı',
    description: 'Bir hocamızın yayınında intihal iddiası gündeme geldi. Basın ilgi gösteriyor.',
    type:        'negative',
    probability: 0.05,
    effects: {
      prestige:        -8,
      research:        -5,
      facultyHappiness: -12,
    },
    decision: {
      optionA: { label: 'Kamuya açık soruşturma başlat', prestigeLoss: -3, trustBonus: +5 },
      optionB: { label: 'Sessiz kal, iç soruşturma yap', prestigeLoss: -1, riskOfLeak: 0.4 },
    },
  },
  {
    id:          'yabanci_isbirligi',
    name:        'Yabancı Üniversite İşbirliği',
    description: 'Avrupa\'dan önde gelen bir üniversite çift diploma programı için anlaşma teklif etti.',
    type:        'positive',
    probability: 0.06,
    effects: {
      prestige:           +6,
      internationalization: +10,
      studentDemand:      +0.08,
      cost:               500_000,  // anlaşma maliyeti
    },
  },
  {
    id:          'ekonomik_kriz',
    name:        'Ekonomik Kriz',
    description: 'Ülkede ekonomik dalgalanma. Öğrenci ücretlerini ödeyemeyenler artıyor.',
    type:        'negative',
    probability: 0.07,
    effects: {
      tuitionRevenue:  -0.20,
      studentDropout:  0.05,   // %5 öğrenci okuldan ayrılır
      budget:          -2_000_000,
      facultySalaryPressure: true,
    },
  },
  {
    id:          'ogrenci_protestosu',
    name:        'Öğrenci Protestosu',
    description: 'Harç artışı / yurt yetersizliği / yemek kalitesi gerekçesiyle öğrenciler eylemde.',
    type:        'decision',
    probability: 0.08,
    effects: {
      studentMorale:  -15,
      prestige:       -4,
    },
    decision: {
      optionA: { label: 'Talepleri karşıla (ek bütçe)',  cost: 1_500_000, moraleBonus: +12 },
      optionB: { label: 'Diyalog kur, kısmen kabul et', cost: 500_000,   moraleBonus: +5  },
      optionC: { label: 'Sert politika uygula',          cost: 0,         moraleBonus: -5, prestigeLoss: -3 },
    },
  },
  {
    id:          'teknoloji_patlamasi',
    name:        'Teknoloji Patlaması',
    description: 'Yapay zeka ve yazılım sektörü hızla büyüdü. İlgili bölümlere talep patladı!',
    type:        'positive',
    probability: 0.09,
    effects: {
      deptDemandBonus: { depts: ['bilgisayar_muh', 'yapay_zeka'], value: 0.30 },
      facultyMarketPressure: { depts: ['bilgisayar_muh', 'yapay_zeka'], salaryInflation: 0.15 },
      prestige:  +2,
    },
  },
  {
    id:          'akreditasyon_ziyareti',
    name:        'Akreditasyon Ziyareti',
    description: 'MÜDEK / ABET ekibi bölümlerinizi denetlemek için yerleşkeye geliyor.',
    type:        'decision',
    probability: 0.10,
    effects: { },
    decision: {
      optionA: { label: 'Kapsamlı hazırlık yap',    cost: 800_000,  accreditationBonus: +15, prestigeBonus: +5 },
      optionB: { label: 'Normal süreç uygula',       cost: 200_000,  accreditationBonus: +5                   },
      optionC: { label: 'Hazırlık yapma (risk al)',  cost: 0,        accreditationRisk: 0.4, prestigeLoss: -8  },
    },
  },
  {
    id:          'arge_merkezi_kurulumu',
    name:        'Özel Sektör AR-GE Merkezi Teklifi',
    description: 'Büyük bir teknoloji firması yerleşkede ortak AR-GE merkezi kurmak istiyor.',
    type:        'decision',
    probability: 0.05,
    effects: { },
    decision: {
      optionA: { label: 'Teklifi kabul et',  cost: 5_000_000, annualRevenue: 2_000_000, researchBonus: 0.25, industryTieBonus: 10 },
      optionB: { label: 'Reddet',            cost: 0,         prestigeLoss: -1 },
    },
  },
  {
    id:          'uydu_kampus_firsati',
    name:        'Uydu Yerleşke Fırsatı',
    description: 'Bir ilçe belediyesi arazi tahsis edecek, uydu yerleşke kurabilirsiniz.',
    type:        'positive',
    probability: 0.04,
    effects: {
      expansionOption: true,
      cost:            20_000_000,
      studentCapacityBonus: 500,
    },
  },
  {
    id:          'ulusal_siralamada_yukseliş',
    name:        'Ulusal Sıralamada Büyük Yükseliş',
    description: 'Üniversitemiz bu yılki ulusal sıralamada 5+ basamak yükseldi!',
    type:        'positive',
    probability: 0.06,
    effects: {
      prestige:      +8,
      studentDemand: +0.10,
      facultyMorale: +10,
    },
  },
  {
    id:          'hoca_odulu',
    name:        'Uluslararası Hoca Ödülü',
    description: 'Bir hocamız saygın bir uluslararası araştırma ödülü aldı!',
    type:        'positive',
    probability: 0.05,
    effects: {
      prestige:           +6,
      internationalization: +5,
      research:           +8,
      facultyHappiness:   +15,
    },
  },
  {
    id:          'bina_yangini',
    name:        'Yerleşke Yangını',
    description: 'Bir bina yangınında laboratuvar ekipmanları hasar gördü.',
    type:        'negative',
    probability: 0.03,
    effects: {
      budget:         -4_000_000,
      buildingDamage: 0.08,
      studentMorale:  -8,
      researchDelay:  1,  // dönem
    },
  },
  {
    id:          'yok_denetimi',
    name:        'YÖK Denetimi',
    description: 'YÖK denetçileri anlık denetim yapacak. Belgelerin hazır mı?',
    type:        'decision',
    probability: 0.07,
    effects: { },
    decision: {
      optionA: { label: 'Her şey hazır, sorun yok',       cost: 0,        result: 'prestige +2' },
      optionB: { label: 'Bazı eksikler var, düzelt',      cost: 500_000,  result: 'neutral'     },
      optionC: { label: 'Büyük eksikler var (ihmallet)', cost: 0,        prestigeLoss: -6, yokPenalty: true },
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// BİNALAR
// Her bina tipi için maliyet, kapasite ve kalite etkileri.
// constructionTime: inşaat tamamlanma süresi (dönem cinsinden)
// maintenanceCostRatio: yapım maliyetinin yıllık bakım yüzdesi
// ─────────────────────────────────────────────────────────────────────────────

export const BUILDINGS = {
  fakulte_binasi: {
    id:                    'fakulte_binasi',
    name:                  'Fakülte Binası',
    icon:                  '🏛️',
    description:           'Bölümlere ofis ve derslik alanı sağlar',
    assignable:            true,
    baseCost:              15_000_000,
    baseArea:              3000,           // m²
    upgradeCostMultiplier: 1.5,            // her düzey × 1.5
    maxLevel:              5,
    areaPerLevel:          1500,           // her düzey +1500 m²
    capacity:              { offices: 30, classrooms: 10, labs: 0 },
    capacityPerLevel:      { offices: 15, classrooms: 5,  labs: 0 },
    // Düzeye göre derslik kapasitesi (kişi/derslik)
    // Düzey 1-2: 40, Düzey 3-4: 50, Düzey 5: 60
    classroomSizeByLevel:  { 1: 40, 2: 40, 3: 50, 4: 50, 5: 60 },
    classroomSize:         40,             // düzey 1 varsayılanı (calculateBuildingUsage için)
    maintenanceCostPerM2:  50,             // ₺/m²/dönem
    constructionTurns:     2,
    canHaveMultiple:       true,
    effects: { classroomCapacity: 200, officeCapacity: 30 },
    // Geriye dönük uyumluluk için
    constructionCost:      15_000_000,
    maintenanceCostRatio:  0.04,
    constructionTime:      2,
    qualityEffects: {
      educationQuality:    +5,
      studentSatisfaction: +3,
    },
    prerequisite: null,
  },

  arastirma_merkezi: {
    id:                    'arastirma_merkezi',
    name:                  'Araştırma Merkezi',
    icon:                  '🔬',
    description:           'Disiplinlerarası araştırma. Birden fazla bölüm için yayın ve proje bonusu.',
    assignable:            false,
    benefitText:           'Hoca ataması yapılabilir (yakında)',
    baseCost:              25_000_000,
    baseArea:              2000,
    upgradeCostMultiplier: 1.5,
    maxLevel:              5,
    areaPerLevel:          1000,
    capacity:              { offices: 10, classrooms: 0, labs: 8 },
    capacityPerLevel:      { offices: 5,  classrooms: 0, labs: 4 },
    maintenanceCostPerM2:  80,
    constructionTurns:     3,
    canHaveMultiple:       true,
    effects: { researchBoost: 0.15 },
    // Geriye dönük uyumluluk
    constructionCost:      25_000_000,
    maintenanceCostRatio:  0.06,
    constructionTime:      3,
    qualityEffects: {
      researchOutput:         +20,
      publicationRate:        +0.5,
      tubitakSuccessRate:     +0.15,
      interdisciplinaryBonus: true,
    },
    prerequisite: null,
  },

  lab: {
    id:                    'lab',
    name:                  'Laboratuvar',
    icon:                  '🧪',
    description:           'Deneysel araştırma kapasitesini artırır. Bazı bölümler için zorunlu.',
    assignable:            false,
    benefitText:           'Bölüm laboratuvarı olarak kullanılır (yakında)',
    baseCost:              8_000_000,
    baseArea:              800,
    upgradeCostMultiplier: 1.5,
    maxLevel:              3,
    areaPerLevel:          400,
    capacity:              { offices: 0, classrooms: 0, labs: 4 },
    capacityPerLevel:      { offices: 0, classrooms: 0, labs: 2 },
    maintenanceCostPerM2:  100,
    constructionTurns:     1,
    canHaveMultiple:       true,
    effects: { researchBoost: 0.08 },
    // Geriye dönük uyumluluk
    constructionCost:      8_000_000,
    maintenanceCostRatio:  0.08,
    constructionTime:      1,
    qualityEffects: {
      researchOutput:  +10,
      labScore:        +15,
      publicationRate: +0.3,
    },
    prerequisite: null,
  },

  kutuphane: {
    id:                    'kutuphane',
    name:                  'Kütüphane',
    icon:                  '📚',
    description:           'Öğrenci başarısını ve hoca araştırma verimliliğini artırır.',
    assignable:            false,
    benefitText:           'Tüm öğrenci ve akademisyenlere açık',
    baseCost:              6_000_000,
    baseArea:              2000,
    upgradeCostMultiplier: 1.5,
    maxLevel:              3,
    areaPerLevel:          1000,
    capacity:              { simultaneous: 200, daily: 800 },
    capacityPerLevel:      { simultaneous: 200, daily: 800 },
    maintenanceCostPerM2:  40,
    constructionTurns:     2,
    canHaveMultiple:       false,
    effects: { studentSatisfaction: 5, researchBoost: 0.05 },
    // Geriye dönük uyumluluk
    constructionCost:      6_000_000,
    maintenanceCostRatio:  0.05,
    constructionTime:      2,
    qualityEffects: {
      studentGPA:          +0.1,
      researchOutput:      +5,
      studentSatisfaction: +5,
    },
    prerequisite: null,
  },

  yurt: {
    id:                    'yurt',
    name:                  'Öğrenci Yurdu',
    icon:                  '🏠',
    description:           'Yurt yatağı sayısını artırır. Şehir dışı öğrenci çekimini güçlendirir.',
    assignable:            false,
    benefitText:           'Tüm öğrencilere açık',
    baseCost:              12_000_000,
    baseArea:              4000,
    upgradeCostMultiplier: 1.5,
    maxLevel:              3,
    areaPerLevel:          2000,
    capacity:              { beds: 200 },
    capacityPerLevel:      { beds: 100 },
    revenuePerBedPerSemester: 5_000,    // ₺/yatak/dönem yurt geliri
    maintenanceCostPerM2:  35,
    constructionTurns:     2,
    canHaveMultiple:       true,
    effects: { studentSatisfaction: 8, dormCapacity: 200 },
    // Geriye dönük uyumluluk
    constructionCost:      12_000_000,
    maintenanceCostRatio:  0.06,
    constructionTime:      2,
    qualityEffects: {
      studentSatisfaction: +8,
      studentDemandBonus:  +0.05,
      revenuePerBed:       5_000,
    },
    prerequisite: null,
  },

  yemekhane: {
    id:                    'yemekhane',
    name:                  'Yemekhane',
    icon:                  '🍽️',
    description:           'Öğrenci ve hoca memnuniyetini artırır.',
    assignable:            false,
    benefitText:           'Yerleşke geneli hizmet',
    baseCost:              4_000_000,
    baseArea:              1000,
    upgradeCostMultiplier: 1.5,
    maxLevel:              3,
    areaPerLevel:          500,
    capacity:              { dailyMeals: 500 },
    capacityPerLevel:      { dailyMeals: 250 },
    maintenanceCostPerM2:  60,
    constructionTurns:     1,
    canHaveMultiple:       true,
    effects: { studentSatisfaction: 4 },
    // Geriye dönük uyumluluk
    constructionCost:      4_000_000,
    maintenanceCostRatio:  0.10,
    constructionTime:      1,
    qualityEffects: {
      studentSatisfaction: +6,
      facultyHappiness:    +4,
    },
    prerequisite: null,
  },

  spor_tesisi: {
    id:                    'spor_tesisi',
    name:                  'Spor Tesisi',
    icon:                  '⚽',
    description:           'Öğrenci refahını artırır. Co-op modunda öğrenci yoğunluğunu dengeler.',
    assignable:            false,
    benefitText:           'Tüm öğrencilere açık',
    baseCost:              5_000_000,
    baseArea:              3000,
    upgradeCostMultiplier: 1.5,
    maxLevel:              3,
    areaPerLevel:          1500,
    capacity:              { dailyUsers: 500 },
    capacityPerLevel:      { dailyUsers: 250 },
    maintenanceCostPerM2:  30,
    constructionTurns:     1,
    canHaveMultiple:       false,
    effects: { studentSatisfaction: 6, prestige: 2 },
    // Geriye dönük uyumluluk
    constructionCost:      5_000_000,
    maintenanceCostRatio:  0.07,
    constructionTime:      1,
    qualityEffects: {
      studentSatisfaction: +7,
      studentDemandBonus:  +0.03,
      coopStressReduction: +5,
    },
    prerequisite: null,
  },

  konferans: {
    id:                    'konferans',
    name:                  'Konferans Merkezi',
    icon:                  '🎤',
    description:           'Uluslararası etkinlikler ve konferanslar için. Saygınlık kazandırır.',
    assignable:            false,
    benefitText:           'Etkinlik ve konferanslar için',
    baseCost:              10_000_000,
    baseArea:              1500,
    upgradeCostMultiplier: 1.5,
    maxLevel:              3,
    areaPerLevel:          750,
    maintenanceCostPerM2:  45,
    constructionTurns:     2,
    canHaveMultiple:       false,
    effects: { prestige: 5, internationalVisibility: 3 },
    // Geriye dönük uyumluluk
    constructionCost:      10_000_000,
    maintenanceCostRatio:  0.04,
    constructionTime:      2,
    qualityEffects: {
      prestige:             +4,
      internationalization: +8,
      eventRevenuePerTurn:  800_000,
    },
    prerequisite: null,
  },

  amfi: {
    id:                    'amfi',
    name:                  'Amfi Binası',
    icon:                  '🏫',
    description:           'Büyük derslikler — kalabalık sınıflar için',
    assignable:            true,
    baseCost:              12_000_000,
    baseArea:              2500,
    upgradeCostMultiplier: 1.5,
    maxLevel:              3,
    areaPerLevel:          1200,
    capacity:              { offices: 0, classrooms: 4, labs: 0 },
    capacityPerLevel:      { offices: 0, classrooms: 2, labs: 0 },
    // Düzeye göre amfi kapasitesi (kişi/amfi)
    classroomSizeByLevel:  { 1: 150, 2: 180, 3: 200 },
    classroomSize:         150,
    maintenanceCostPerM2:  55,
    constructionTurns:     2,
    canHaveMultiple:       true,
    effects:               { classroomCapacity: 600 },
    constructionCost:      12_000_000,
    maintenanceCostRatio:  0.05,
    constructionTime:      2,
    qualityEffects: {
      educationQuality:    +3,
      studentSatisfaction: +2,
    },
    prerequisite: null,
  },

  teknokent: {
    id:                    'teknokent',
    name:                  'Teknokent',
    icon:                  '🏢',
    description:           'Girişimcilik ekosistemi. Spin-off şirket geliri, sektör bağlantısı, co-op eşleştirme kalitesi.',
    assignable:            false,
    benefitText:           'Yerleşke geneli sektör bağlantısı',
    baseCost:              35_000_000,
    baseArea:              5000,
    upgradeCostMultiplier: 1.6,
    maxLevel:              3,
    areaPerLevel:          2000,
    maintenanceCostPerM2:  25,
    constructionTurns:     4,
    canHaveMultiple:       false,
    effects: { prestige: 8, researchBoost: 0.10 },
    // Geriye dönük uyumluluk
    constructionCost:      35_000_000,
    maintenanceCostRatio:  0.03,
    constructionTime:      4,
    qualityEffects: {
      industryTieBonus:    +20,
      coopPartnerQuality:  +25,
      annualRentalRevenue: 2_000_000,
      spinoffRevenue:      true,
      prestige:            +8,
      alumniBonus:         +5,
    },
    prerequisite: 'arastirma_merkezi',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// TREND ÇEVRİMLERİ
// Bölüm taleplerini dönemsel olarak etkileyen piyasa trendleri.
// heat: 0-100 (0=soğuk, 100=kızgın trend)
// changePerTurn: her dönem heat nasıl değişir (negatif = soğuyor)
// ─────────────────────────────────────────────────────────────────────────────

export const TREND_CYCLES = {
  // Başlangıç ısıları (0-100)
  initialHeat: {
    yapay_zeka:         95,   // trend doruk
    bilgisayar_muh:     80,
    biyomedikal:        65,
    tip:                70,
    hukuk:              55,
    isletme:            60,
    psikoloji:          50,
    iktisat:            45,
    elektrik_elektronik: 60,
    makine:             50,
    insaat:             40,
    endustri:           55,
    fizik:              35,
    kimya:              30,
    matematik:          35,
    biyoloji:           40,
    dis_hekimligi:      65,
    eczacilik:          55,
    hemsirelik:         45,
  },

  // Dönem başına ısı değişim kuralları
  rules: {
    // Yüksek ısıdaki bölümler yavaşça soğur (normalleşme)
    coolingRate:    -1.5,       // her dönem -1.5 ısı (90+ ısılı bölümler için)
    // Düşük ısıdaki bölümler yavaşça ısınır
    warmingRate:    +0.5,       // her dönem +0.5 (30- ısılı bölümler için)
    // Olay tetikleyicisi bölümde ani spike yapabilir
    eventSpikeMax:  +20,
    eventDropMax:   -15,
    // Talep çarpanını ısıdan hesaplama
    heatToDemandFactor: 0.005,  // demand = baseStudentDemand * (1 + heat * factor)
    // Bir bölüm trend peak'ine ulaşırsa kaç dönem sonra düşmeye başlar
    peakDuration:   4,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SIRALAMA AĞIRLIKLARI
// Üniversite puanı bu bileşenlerin ağırlıklı ortalamasıdır.
// ─────────────────────────────────────────────────────────────────────────────

export const RANKING_WEIGHTS = {
  education:         0.25,  // eğitim kalitesi (öğrenci GPA, mezuniyet oranı, ders memnuniyeti)
  research:          0.30,  // araştırma (yayın sayısı, atıf, TÜBİTAK projeleri, h-index)
  alumni:            0.20,  // mezun başarısı (istihdam oranı, gelir, sektör konumu)
  satisfaction:      0.15,  // öğrenci ve hoca memnuniyeti
  internationalization: 0.10, // uluslararasılaşma (yabancı öğrenci, ortak program, yayın)
};

// ─────────────────────────────────────────────────────────────────────────────
// ZORLUK AYARLARI
// ─────────────────────────────────────────────────────────────────────────────

export const DIFFICULTY_SETTINGS = {
  kolay: {
    id:                    'kolay',
    label:                 'Kolay',
    description:           'Geniş bütçe, yavaş gider artışı. Öğrenmek için ideal.',
    startBudgetMultiplier: 1.5,    // başlangıç bütçesi ×1.5
    expenseMultiplier:     0.8,    // tüm giderler %20 azaltılır
    incomeMultiplier:      1.2,    // tüm gelirler %20 artırılır
    eventFrequency:        0.6,    // olaylar %40 daha seyrek
    eventSeverity:         0.5,    // olay etkileri yarı şiddetli
    rivalAggressiveness:   0.3,    // rakipler düşük agresiflik
    rivalGrowthRate:       0.7,    // rakipler yavaş büyür
    economicPressure:      0.7,    // ekonomik kriz etkileri %30 azaltılır
    facultyMarketPressure: 0.6,    // hoca maaş talebi düşük
  },
  normal: {
    id:                    'normal',
    label:                 'Normal',
    description:           'Dengeli ekonomi. GDD değerlerini tam yansıtır.',
    startBudgetMultiplier: 1.0,
    expenseMultiplier:     1.0,
    incomeMultiplier:      1.0,
    eventFrequency:        1.0,
    eventSeverity:         1.0,
    rivalAggressiveness:   0.65,
    rivalGrowthRate:       1.0,
    economicPressure:      1.0,
    facultyMarketPressure: 1.0,
  },
  zor: {
    id:                    'zor',
    label:                 'Zor',
    description:           'Kısıtlı bütçe, agresif rakipler. Her karar kritik.',
    startBudgetMultiplier: 0.7,
    expenseMultiplier:     1.2,    // tüm giderler %20 artar
    incomeMultiplier:      0.9,    // tüm gelirler %10 azalır
    eventFrequency:        1.4,    // olaylar daha sık
    eventSeverity:         1.5,    // olay etkileri daha ağır
    rivalAggressiveness:   0.9,    // rakipler çok agresif
    rivalGrowthRate:       1.3,    // rakipler hızlı büyür
    economicPressure:      1.4,
    facultyMarketPressure: 1.5,    // yıldız hocalar sürekli teklif alır
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DIŞ PROJE / FON TÜRLERİ
// Her dönem rastgele fırsatlar olarak sunulur.
// ─────────────────────────────────────────────────────────────────────────────

export const PROJECT_TYPES = [
  {
    id: 'tubitak_1001',
    name: 'TÜBİTAK 1001',
    description: 'Bilimsel ve Teknolojik Araştırma Projesi',
    fundingMin: 500_000,
    fundingMax: 2_000_000,
    duration: 4,   // dönem
    requiredCategories: ['muhendislik', 'fen', 'saglik'],
    baseSuccessChance: 0.30,
    prestigeReward: 5,
    publicationBonus: 3,
    icon: '🔬',
  },
  {
    id: 'tubitak_1002',
    name: 'TÜBİTAK 1002',
    description: 'Hızlı Destek Projesi',
    fundingMin: 100_000,
    fundingMax: 500_000,
    duration: 2,
    requiredCategories: [],   // herhangi bir bölüm
    baseSuccessChance: 0.50,
    prestigeReward: 2,
    publicationBonus: 1,
    icon: '⚡',
  },
  {
    id: 'horizon_europe',
    name: 'AB Horizon Europe',
    description: 'Avrupa Birliği Araştırma Projesi',
    fundingMin: 2_000_000,
    fundingMax: 10_000_000,
    duration: 6,
    requiredCategories: [],
    baseSuccessChance: 0.10,
    prestigeReward: 15,
    publicationBonus: 8,
    icon: '🌍',
  },
  {
    id: 'sanayi_isbirligi',
    name: 'Sanayi İşbirliği',
    description: 'Özel Sektör Ar-Ge Projesi',
    fundingMin: 200_000,
    fundingMax: 1_000_000,
    duration: 3,
    requiredCategories: ['muhendislik'],
    baseSuccessChance: 0.40,
    prestigeReward: 3,
    publicationBonus: 1,
    icon: '🏭',
  },
  {
    id: 'bap',
    name: 'BAP',
    description: 'Bilimsel Araştırma Projesi (Üniversite İçi)',
    fundingMin: 50_000,
    fundingMax: 200_000,
    duration: 2,
    requiredCategories: [],
    baseSuccessChance: 0.70,
    prestigeReward: 1,
    publicationBonus: 1,
    icon: '📋',
  },
  {
    id: 'tuba_odulu',
    name: 'TÜBA Ödülü',
    description: 'Türkiye Bilimler Akademisi Araştırma Ödülü',
    fundingMin: 100_000,
    fundingMax: 300_000,
    duration: 1,
    requiredCategories: [],
    baseSuccessChance: 0.05,
    prestigeReward: 10,
    publicationBonus: 0,
    icon: '🏆',
  },
  {
    id: 'ozel_sektor_arge',
    name: 'Özel Sektör Ar-Ge',
    description: 'Özel sektör firmasından Ar-Ge projesi',
    fundingMin: 200_000,
    fundingMax: 2_000_000,
    duration: 2,
    requiredCategories: ['muhendislik', 'fen'],
    baseSuccessChance: 0.45,
    prestigeReward: 2,
    publicationBonus: 1,
    overheadRate: 0.25,
    isPrivateSector: true,
    icon: '🏢',
  },
  {
    id: 'teknoloji_firmasi',
    name: 'Teknoloji Firması İşbirliği',
    description: 'Büyük teknoloji firmasıyla ortak Ar-Ge',
    fundingMin: 500_000,
    fundingMax: 5_000_000,
    duration: 3,
    requiredCategories: ['bilgisayar', 'elektrik', 'muhendislik'],
    baseSuccessChance: 0.30,
    prestigeReward: 5,
    publicationBonus: 2,
    overheadRate: 0.20,
    isPrivateSector: true,
    icon: '💻',
  },
  {
    id: 'savunma_sanayi',
    name: 'Savunma Sanayi Projesi',
    description: 'Savunma sanayi kuruluşuyla Ar-Ge projesi',
    fundingMin: 1_000_000,
    fundingMax: 10_000_000,
    duration: 4,
    requiredCategories: ['muhendislik'],
    baseSuccessChance: 0.20,
    prestigeReward: 4,
    publicationBonus: 1,
    overheadRate: 0.20,
    isPrivateSector: true,
    icon: '🛡️',
  },
  {
    id: 'ilac_firmasi',
    name: 'İlaç Firması Klinik Araştırma',
    description: 'İlaç firmasıyla klinik araştırma projesi',
    fundingMin: 500_000,
    fundingMax: 3_000_000,
    duration: 4,
    requiredCategories: ['saglik', 'tip'],
    baseSuccessChance: 0.25,
    prestigeReward: 3,
    publicationBonus: 3,
    overheadRate: 0.20,
    isPrivateSector: true,
    icon: '💊',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// İDARİ BİRİMLER
// Her birimin düzeyi, personel ihtiyacı ve etkileri burada tanımlanır.
// ─────────────────────────────────────────────────────────────────────────────

export const ADMIN_UNITS = {
  ogrenci_isleri: {
    id: 'ogrenci_isleri',
    name: 'Öğrenci İşleri',
    icon: '📋',
    description: 'Kayıt, transkript, belge işlemleri',
    baseStaffNeeded: 3,
    staffPerStudentRatio: 1 / 500,
    maxLevel: 3,
    upgradeCost: [0, 2_000_000, 5_000_000],
    levelBonuses: {
      1: { satisfactionBonus: 0,  efficiencyBonus: 0,   description: 'Temel hizmet' },
      2: { satisfactionBonus: 3,  efficiencyBonus: 0.1, description: 'Online başvuru sistemi' },
      3: { satisfactionBonus: 5,  efficiencyBonus: 0.2, description: 'Tam dijital otomasyon' },
    },
    satisfactionFactor: 'bureaucracy',
  },
  kariyer_merkezi: {
    id: 'kariyer_merkezi',
    name: 'Kariyer Merkezi',
    icon: '💼',
    description: 'Staj, iş bulma, kariyer danışmanlığı',
    baseStaffNeeded: 2,
    staffPerStudentRatio: 1 / 800,
    maxLevel: 3,
    upgradeCost: [0, 1_500_000, 4_000_000],
    levelBonuses: {
      1: { satisfactionBonus: 0,  careerBonus: 0,    description: 'Temel kariyer desteği' },
      2: { satisfactionBonus: 4,  careerBonus: 0.15, description: 'Sanayi işbirlikleri ağı' },
      3: { satisfactionBonus: 7,  careerBonus: 0.30, description: 'Uluslararası kariyer ağı' },
    },
    satisfactionFactor: 'kariyer',
  },
  ulasim: {
    id: 'ulasim',
    name: 'Ulaşım Hizmetleri',
    icon: '🚌',
    description: 'Servis, ring, ulaşım koordinasyonu',
    baseStaffNeeded: 2,
    staffPerStudentRatio: 1 / 1000,
    maxLevel: 3,
    upgradeCost: [0, 3_000_000, 8_000_000],
    levelBonuses: {
      1: { satisfactionBonus: 0,  routes: 2,  description: '2 hat servis' },
      2: { satisfactionBonus: 5,  routes: 5,  description: '5 hat servis ağı' },
      3: { satisfactionBonus: 8,  routes: 10, description: 'Metro/tramvay bağlantısı' },
    },
    satisfactionFactor: 'ulasim',
  },
  kutuphane_hizmetleri: {
    id: 'kutuphane_hizmetleri',
    name: 'Kütüphane Hizmetleri',
    icon: '📚',
    description: 'Kütüphane yönetimi, dijital kaynaklar',
    baseStaffNeeded: 2,
    staffPerStudentRatio: 1 / 600,
    maxLevel: 3,
    upgradeCost: [0, 1_000_000, 3_000_000],
    levelBonuses: {
      1: { satisfactionBonus: 0,  researchBonus: 0,    description: 'Temel kütüphane' },
      2: { satisfactionBonus: 3,  researchBonus: 0.05, description: 'Dijital kütüphane erişimi' },
      3: { satisfactionBonus: 5,  researchBonus: 0.10, description: 'Uluslararası veri tabanları' },
    },
    satisfactionFactor: 'kutuphane',
  },
  bilgi_teknolojileri: {
    id: 'bilgi_teknolojileri',
    name: 'Bilgi Teknolojileri',
    icon: '🖥️',
    description: 'BT altyapı, ağ, yazılım destek',
    baseStaffNeeded: 3,
    staffPerStudentRatio: 1 / 400,
    maxLevel: 3,
    upgradeCost: [0, 4_000_000, 10_000_000],
    levelBonuses: {
      1: { satisfactionBonus: 0,  techBonus: 0,    description: 'Temel BT altyapı' },
      2: { satisfactionBonus: 4,  techBonus: 0.10, description: 'Kampüs çapında WiFi 6' },
      3: { satisfactionBonus: 7,  techBonus: 0.20, description: 'HPC küme + bulut altyapı' },
    },
    satisfactionFactor: 'it',
  },
  saglik_merkezi: {
    id: 'saglik_merkezi',
    name: 'Sağlık Merkezi',
    icon: '🏥',
    description: 'Öğrenci ve personel sağlık hizmetleri',
    baseStaffNeeded: 2,
    staffPerStudentRatio: 1 / 1000,
    maxLevel: 3,
    upgradeCost: [0, 2_000_000, 5_000_000],
    levelBonuses: {
      1: { satisfactionBonus: 2,  description: 'Temel sağlık hizmetleri' },
      2: { satisfactionBonus: 5,  description: 'Psikolojik danışmanlık birimi' },
      3: { satisfactionBonus: 8,  description: 'Tam teşekküllü poliklinik' },
    },
    satisfactionFactor: 'saglik',
  },
  yemekhane_yonetimi: {
    id: 'yemekhane_yonetimi',
    name: 'Yemekhane Yönetimi',
    icon: '🍽️',
    description: 'Beslenme hizmetleri, kafeteryalar',
    baseStaffNeeded: 4,
    staffPerStudentRatio: 1 / 200,
    maxLevel: 3,
    upgradeCost: [0, 1_000_000, 3_000_000],
    levelBonuses: {
      1: { satisfactionBonus: 0,  description: 'Temel yemek hizmeti' },
      2: { satisfactionBonus: 4,  description: 'Çeşitli menü seçenekleri' },
      3: { satisfactionBonus: 7,  description: 'Premium yemek + diyet menü' },
    },
    satisfactionFactor: 'yemek_yonetim',
  },
  guvenlik: {
    id: 'guvenlik',
    name: 'Güvenlik',
    icon: '🛡️',
    description: 'Kampüs güvenliği, giriş kontrol',
    baseStaffNeeded: 4,
    staffPerStudentRatio: 1 / 300,
    maxLevel: 3,
    upgradeCost: [0, 1_500_000, 4_000_000],
    levelBonuses: {
      1: { satisfactionBonus: 0,  description: 'Temel güvenlik' },
      2: { satisfactionBonus: 3,  description: 'Kamera sistemi + kartlı geçiş' },
      3: { satisfactionBonus: 5,  description: '7/24 güvenlik + acil müdahale ekibi' },
    },
    satisfactionFactor: 'guvenlik',
  },
  temizlik_bakim: {
    id: 'temizlik_bakim',
    name: 'Temizlik ve Bakım',
    icon: '🧹',
    description: 'Kampüs temizliği, bina bakımı, peyzaj',
    baseStaffNeeded: 5,
    staffPerStudentRatio: 1 / 200,
    maxLevel: 3,
    upgradeCost: [0, 500_000, 1_500_000],
    levelBonuses: {
      1: { satisfactionBonus: 0,  description: 'Temel temizlik hizmetleri' },
      2: { satisfactionBonus: 3,  description: 'Profesyonel peyzaj ekibi' },
      3: { satisfactionBonus: 5,  description: 'Yeşil kampüs sertifikası' },
    },
    satisfactionFactor: 'temizlik',
  },
  uluslararasi_ofis: {
    id: 'uluslararasi_ofis',
    name: 'Uluslararası İlişkiler Ofisi',
    icon: '🌍',
    description: 'Erasmus, değişim programları, yabancı öğrenci',
    baseStaffNeeded: 2,
    staffPerStudentRatio: 1 / 1000,
    maxLevel: 3,
    upgradeCost: [0, 2_000_000, 5_000_000],
    levelBonuses: {
      1: { satisfactionBonus: 0,  intlBonus: 0,    description: 'Temel uluslararası ilişkiler' },
      2: { satisfactionBonus: 2,  intlBonus: 0.10, description: '10+ Erasmus anlaşması' },
      3: { satisfactionBonus: 4,  intlBonus: 0.25, description: 'Çift diploma programları' },
    },
    satisfactionFactor: 'uluslararasi',
  },
};

// İdari personel unvanları ve maaş aralıkları (₺/ay)
// ─────────────────────────────────────────────────────────────────────────────
// AKREDİTASYON KURULUŞLARI
// ─────────────────────────────────────────────────────────────────────────────

export const ACCREDITATION_BODIES = {
  mudek: {
    id: 'mudek',
    name: 'MÜDEK',
    fullName: 'Mühendislik Eğitim Programları Değerlendirme ve Akreditasyon Derneği',
    icon: '🏅',
    applicableTo: ['muhendislik'],
    duration: 10,
    processingTime: { min: 2, max: 4 },
    cost: 500000,
    renewalCost: 300000,
    prestigeBonus: 8,
    yksBonus: -5000,
    requirements: {
      minFaculty: 5,
      minProfOrDoc: 2,
      minAvgResearch: 50,
      minAvgTeaching: 55,
      minLabCount: 2,
      minCurriculumCoverage: 0.8,
      minStudentSatisfaction: 55,
      hasDeptHead: true,
    },
  },
  abet: {
    id: 'abet',
    name: 'ABET',
    fullName: 'Accreditation Board for Engineering and Technology',
    icon: '🌍',
    applicableTo: ['muhendislik'],
    duration: 12,
    processingTime: { min: 3, max: 5 },
    cost: 1000000,
    renewalCost: 600000,
    prestigeBonus: 15,
    yksBonus: -8000,
    requirements: {
      minFaculty: 7,
      minProfOrDoc: 3,
      minAvgResearch: 60,
      minAvgTeaching: 60,
      minLabCount: 3,
      minCurriculumCoverage: 0.85,
      minStudentSatisfaction: 60,
      hasDeptHead: true,
      minPublicationsPerFaculty: 3,
    },
  },
  theqa: {
    id: 'theqa',
    name: 'THEQA',
    fullName: 'Türkiye Yükseköğretim Kalite Kurulu',
    icon: '📋',
    applicableTo: ['all'],
    duration: 8,
    processingTime: { min: 2, max: 3 },
    cost: 300000,
    renewalCost: 200000,
    prestigeBonus: 5,
    yksBonus: -3000,
    requirements: {
      minFaculty: 3,
      minProfOrDoc: 1,
      minAvgResearch: 40,
      minAvgTeaching: 45,
      minCurriculumCoverage: 0.7,
      minStudentSatisfaction: 50,
      hasDeptHead: true,
    },
  },
};

export const ADMIN_TITLES = {
  'Memur':      { min: 14_000, max: 18_000 },
  'Uzman':      { min: 18_000, max: 25_000 },
  'Şef':        { min: 22_000, max: 30_000 },
  'Müdür Yrd.': { min: 28_000, max: 38_000 },
  'Müdür':      { min: 35_000, max: 50_000 },
};

// Başlangıç idari personel dağılımı (küçük üniversite için)
export const ADMIN_INITIAL_STAFF = [
  { unit: 'ogrenci_isleri',      title: 'Müdür',      count: 1 },
  { unit: 'ogrenci_isleri',      title: 'Uzman',       count: 1 },
  { unit: 'kariyer_merkezi',     title: 'Uzman',       count: 1 },
  { unit: 'ulasim',              title: 'Şef',         count: 1 },
  { unit: 'kutuphane_hizmetleri', title: 'Şef',        count: 1 },
  { unit: 'bilgi_teknolojileri', title: 'Uzman',       count: 1 },
  { unit: 'saglik_merkezi',      title: 'Uzman',       count: 1 },
  { unit: 'yemekhane_yonetimi',  title: 'Şef',         count: 1 },
  { unit: 'guvenlik',            title: 'Şef',         count: 1 },
  { unit: 'guvenlik',            title: 'Memur',       count: 1 },
  { unit: 'temizlik_bakim',      title: 'Şef',         count: 1 },
  { unit: 'temizlik_bakim',      title: 'Memur',       count: 1 },
  { unit: 'uluslararasi_ofis',   title: 'Uzman',       count: 1 },
];

// ─────────────────────────────────────────────────────────────────────────────
// SENARYOLAR (v0.3)
// ─────────────────────────────────────────────────────────────────────────────

export const SCENARIOS = {
  yeni_kurulan: {
    id: 'yeni_kurulan',
    name: 'Yeni Kurulan Üniversite',
    icon: '🌱',
    subtitle: 'Küçük bütçe, büyük potansiyel',
    description: 'Sıfırdan kurulan bir vakıf üniversitesini dünya sıralamasına taşıyın. Az bölümle başlayacak, hızlı büyümek zorunda kalacaksınız.',
    difficulty: 'normal',
    universityType: 'vakif',
    startBudgetOverride: 60_000_000,
    startPrestigeOverride: 10,
    forcedDepartments: ['bilgisayar_muh', 'isletme'],
    maxStartDepartments: 3,
    specialRules: {
      rapidGrowthBonus: 0.3,         // İlk 4 dönem öğrenci büyümesi +%30
    },
    winCondition: { type: 'prestige', target: 60, maxTurns: 20 },
    flavorText: '"Her büyük yolculuk küçük bir adımla başlar."',
  },

  koklu_devlet: {
    id: 'koklu_devlet',
    name: 'Köklü Devlet Üniversitesi',
    icon: '🏛️',
    subtitle: 'Miras ve bürokratik zorluklar',
    description: '50 yıllık geçmişi olan devlet üniversitesinin sıralama düşüşünü durdurun. Eski binalar ve bürokratik engeller sizi bekliyor.',
    difficulty: 'normal',
    universityType: 'devlet',
    startBudgetOverride: null,      // UNIVERSITY_TYPES.devlet default
    startPrestigeOverride: 45,
    forcedDepartments: ['bilgisayar_muh', 'elektrik_elektronik', 'makine', 'isletme', 'iktisat', 'hukuk'],
    maxStartDepartments: 6,
    specialRules: {
      legacyDebt: 15_000_000,
      agingInfrastructure: true,    // Binalar %60 durumda başlar
      bureaucracyPenalty: 0.15,     // İşlem gecikmesi +%15
    },
    winCondition: { type: 'ranking', target: 30, maxTurns: 25 },
    flavorText: '"Geleneği korurken geleceği inşa et."',
  },

  vakif_kurtarma: {
    id: 'vakif_kurtarma',
    name: 'Vakıf Üniversitesi Kurtarma',
    icon: '🆘',
    subtitle: 'Borç, düşüş, son şans',
    description: 'İflasın eşiğindeki vakıf üniversitesini kâra geçirin. 40 milyon borç, düşen kayıtlar ve alacaklı baskısıyla mücadele edin.',
    difficulty: 'zor',
    universityType: 'vakif',
    startBudgetOverride: 20_000_000,
    startPrestigeOverride: 15,
    forcedDepartments: ['bilgisayar_muh', 'isletme', 'psikoloji'],
    maxStartDepartments: 3,
    specialRules: {
      startingDebt: 40_000_000,
      decliningEnrollment: true,
      creditorPressure: 2_000_000,  // Her dönem min 2M₺ borç ödemesi
    },
    winCondition: { type: 'budget_positive', consecutiveTurns: 10 },
    flavorText: '"Kriz fırsat içinde gizlidir."',
  },
};
