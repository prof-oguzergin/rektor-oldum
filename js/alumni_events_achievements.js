/**
 * Rektör Oldum — Mezun, Rastgele Olaylar ve Başarım Sistemi
 * v0.2 — Üç yeni özellik tek modülde.
 */

import { STUDENT_NAME_POOL } from './data.js?v=0.4.5';
import { CLUB_TYPES } from './clubs.js?v=0.4.5';

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI
// ─────────────────────────────────────────────────────────────────────────────

function safeNum(val) {
  const n = Number(val);
  return (isFinite(n) && !isNaN(n)) ? n : 0;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

let _idCounter = 1;
function generateId(prefix = 'alum') {
  return `${prefix}_${Date.now()}_${_idCounter++}`;
}

function generateTurkishName() {
  const pool = STUDENT_NAME_POOL;
  const isMale = Math.random() < 0.5;
  const first = isMale
    ? pool.male[randInt(0, pool.male.length - 1)]
    : pool.female[randInt(0, pool.female.length - 1)];
  const last = pool.surname[randInt(0, pool.surname.length - 1)];
  return `${first} ${last}`;
}

function weightedRandom(items) {
  const total = items.reduce((s, i) => s + (i.weight || 1), 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= (item.weight || 1);
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function randomCompany() {
  const list = ['Arçelik', 'Koç Holding', 'Sabancı', 'Turkcell', 'Aselsan',
    'Havelsan', 'Vestel', 'Trendyol', 'Getir', 'Insider', 'Peak Games'];
  return list[randInt(0, list.length - 1)];
}

function randomUniversity() {
  const list = ['ODTÜ', 'Boğaziçi', 'İTÜ', 'Bilkent', 'Koç', 'Sabancı',
    'Hacettepe', 'MIT', 'Stanford', 'ETH Zürich'];
  return list[randInt(0, list.length - 1)];
}

// ─────────────────────────────────────────────────────────────────────────────
// ÖZELLİK 1: MEZUN SİSTEMİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mezun state'ini sıfırla/başlat (geriye dönük uyumluluk için).
 */
export function initAlumniState(state) {
  if (!state.alumniData) {
    state.alumniData = {
      totalGraduates: 0,
      notableAlumni: [],
      alumniByDecade: {},
      annualDonations: 0,
      alumniPrestigeBonus: 0,
      alumniNetwork: 0,
      totalDonations: 0,
    };
  }
  // Eski state.alumni (dizi) ile uyumluluk
  if (!Array.isArray(state.alumni)) state.alumni = [];
}

/**
 * Mezuniyet sonrası notableAlumni adayı oluştur.
 * advanceYearClasses() sonucundaki totalGraduates için çağrılır.
 */
export function processGraduatesForAlumni(state, totalGraduates) {
  initAlumniState(state);
  if (!totalGraduates || totalGraduates <= 0) return;

  state.alumniData.totalGraduates += safeNum(totalGraduates);

  // On yıllık gruba ekle
  const decade = Math.floor(state.meta.year / 10) * 10;
  state.alumniData.alumniByDecade[decade] = (state.alumniData.alumniByDecade[decade] || 0) + totalGraduates;

  // Notabl aday üret
  const avgGPA = _estimateGradGPA(state);
  const notableChance = avgGPA > 3.5 ? 0.03 : 0.005;
  const potentialNotable = Math.floor(totalGraduates * notableChance);

  // Mevcut açık bölümlerden rastgele bölüm seç
  const openDepts = (state.departments || []).filter(d => d.isOpen);

  for (let i = 0; i < potentialNotable; i++) {
    const dept = openDepts.length > 0
      ? openDepts[randInt(0, openDepts.length - 1)]
      : null;

    state.alumniData.notableAlumni.push({
      id: generateId('alum'),
      name: generateTurkishName(),
      department: dept ? dept.id : 'bilinmiyor',
      departmentName: dept ? (dept.shortName || dept.name) : '—',
      graduationYear: state.meta.year,
      gpa: Math.min(4.0, Math.max(2.5, avgGPA + (Math.random() - 0.3) * 0.5)),
      currentAge: 22 + randInt(0, 2),
      careerPath: null,
      careerLevel: 0,
      yearsAfterGrad: 0,
      fame: 0,
      wealth: 0,
      donationHistory: [],
      totalDonated: 0,
      isActive: true,
    });
  }

  // Ağ gücünü güncelle
  state.alumniData.alumniNetwork = Math.min(100,
    Math.floor(state.alumniData.totalGraduates / 50));
}

function _estimateGradGPA(state) {
  const byDept = state.students?.byDepartment || {};
  const gpas = [];
  for (const deptData of Object.values(byDept)) {
    if (deptData.year4?.avgGPA) gpas.push(deptData.year4.avgGPA);
  }
  if (gpas.length === 0) return 2.8;
  return gpas.reduce((s, g) => s + g, 0) / gpas.length;
}

const CAREER_PATHS = [
  { type: 'tech_ceo',  name: 'Teknoloji Girişimcisi',   weight: 15 },
  { type: 'corporate', name: 'Şirket Yöneticisi',        weight: 25 },
  { type: 'academic',  name: 'Akademisyen',               weight: 20 },
  { type: 'politician',name: 'Siyasetçi/Bürokrat',        weight: 10 },
  { type: 'artist',    name: 'Sanatçı/Medya',             weight: 5  },
  { type: 'engineer',  name: 'Kıdemli Mühendis',          weight: 25 },
];

const CAREER_LEVEL_TITLES = {
  tech_ceo:   ['Junior Dev', 'Kıdemli Mühendis', 'Teknik Direktör', 'CTO', 'CEO'],
  corporate:  ['Uzman', 'Yönetici', 'Direktör', 'VP', 'CEO'],
  academic:   ['Araştırma Görevlisi', 'Dr.', 'Doç. Dr.', 'Prof. Dr.', 'Rektör Yrd.'],
  politician: ['Danışman', 'Yetkili', 'Genel Müdür', 'Milletvekili', 'Bakan'],
  artist:     ['Acemi', 'Sanatçı', 'Tanınan Sanatçı', 'Ünlü', 'Efsane'],
  engineer:   ['Mühendis', 'Kıdemli Müh.', 'Baş Müh.', 'Teknik Lider', 'Teknik Direktör'],
};

/**
 * Her dönem notableAlumni kariyerlerini ilerlet, bağış hesapla.
 * @returns {Array} Dönemde gerçekleşen alumni olayları
 */
export function advanceAlumniCareers(state) {
  initAlumniState(state);
  const events = [];

  // Dönem başında yıllık bağışı sıfırla
  state.alumniData.annualDonations = 0;

  for (const alum of state.alumniData.notableAlumni) {
    if (!alum.isActive) continue;
    alum.yearsAfterGrad = safeNum(alum.yearsAfterGrad) + 0.5;

    // Kariyer yolu ataması (mezuniyetten 3-5 yıl sonra)
    if (!alum.careerPath && alum.yearsAfterGrad >= 3) {
      alum.careerPath = weightedRandom(CAREER_PATHS);
    }

    if (!alum.careerPath) continue;

    // Kariyer yükselmesi
    const advanceChance = (safeNum(alum.gpa) / 4.0) * 0.10;
    if (Math.random() < advanceChance && alum.careerLevel < 5) {
      alum.careerLevel++;
      alum.fame = Math.min(100, safeNum(alum.fame) + 5 + alum.careerLevel * 3);
      alum.wealth = safeNum(alum.wealth) + alum.careerLevel * 2;

      // Önemli kariyer başarısı → olay üret
      if (alum.careerLevel >= 4) {
        state.alumniData.alumniPrestigeBonus = safeNum(state.alumniData.alumniPrestigeBonus) + 2;
        const ev = _generateAlumniEvent(state, alum);
        if (ev) events.push(ev);
      }
    }

    // Bağış hesabı
    if (alum.yearsAfterGrad > 5 && alum.wealth > 3) {
      const donationChance = 0.10 * (safeNum(alum.wealth) / 10);
      if (Math.random() < donationChance) {
        const amount = safeNum(alum.wealth) * 50_000 * (0.5 + Math.random());
        const rounded = Math.round(amount / 1000) * 1000;
        alum.donationHistory.push({ year: state.meta.year, amount: rounded });
        alum.totalDonated = safeNum(alum.totalDonated) + rounded;
        state.alumniData.annualDonations = safeNum(state.alumniData.annualDonations) + rounded;
        state.alumniData.totalDonations = safeNum(state.alumniData.totalDonations) + rounded;
      }
    }
  }

  // Bütçeye bağış ekle
  if (state.alumniData.annualDonations > 0) {
    state.university.budget = safeNum(state.university.budget) + state.alumniData.annualDonations;
  }

  // Prestij bonusunu yavaşça uygula (maks +2/dönem)
  if (state.alumniData.alumniPrestigeBonus > 0) {
    const apply = Math.min(2, state.alumniData.alumniPrestigeBonus);
    state.university.prestige = Math.min(100,
      safeNum(state.university.prestige) + apply);
    state.alumniData.alumniPrestigeBonus = Math.max(0,
      state.alumniData.alumniPrestigeBonus - apply);
  }

  return events;
}

function _generateAlumniEvent(state, alum) {
  const typeTemplates = {
    tech_ceo: [
      () => `Mezun ${alum.name} teknoloji şirketi kurdu ve ${Math.floor(safeNum(alum.wealth) * 10)}M₺ değerlemeye ulaştı!`,
      () => `${alum.name} Forbes 30 Under 30 listesine girdi!`,
      () => `${alum.name}'ın startup'ı uluslararası yatırım aldı!`,
    ],
    corporate: [
      () => `Mezun ${alum.name} ${randomCompany()} şirketinin CEO'su oldu!`,
      () => `${alum.name} Fortune 500 şirketinde üst düzey yönetici olarak atandı.`,
    ],
    academic: [
      () => `Mezun ${alum.name} ${randomUniversity()} üniversitesinde profesör oldu!`,
      () => `${alum.name} uluslararası bilim ödülü kazandı!`,
    ],
    politician: [
      () => `Mezun ${alum.name} milletvekili seçildi!`,
      () => `${alum.name} bakanlık görevine atandı!`,
    ],
    engineer: [
      () => `Mezun ${alum.name} Türkiye'nin en saygın mühendislik ödülünü aldı!`,
      () => `${alum.name} uluslararası bir projenin baş mühendisi oldu.`,
    ],
    artist: [
      () => `Mezun ${alum.name} uluslararası bir sanat ödülü kazandı!`,
      () => `${alum.name} ülkemizi uluslararası arenada temsil etti.`,
    ],
  };

  const templates = typeTemplates[alum.careerPath?.type] || typeTemplates.engineer;
  const tpl = templates[randInt(0, templates.length - 1)];
  alum.achievement = tpl();

  return {
    type: 'notable_alumni',
    alumniId: alum.id,
    alumniName: alum.name,
    message: alum.achievement,
    prestigeBonus: 2,
  };
}

/**
 * Alumni etkinliği düzenle — oyuncu etkileşimi.
 * type: 'reunion' | 'career_day' | 'donation_campaign'
 */
export function organizeAlumniEvent(state, type) {
  initAlumniState(state);
  const costs = {
    reunion:           500_000,
    career_day:        200_000,
    donation_campaign: 300_000,
  };
  const cost = safeNum(costs[type] || 300_000);
  if (safeNum(state.university.budget) < cost) {
    return { success: false, message: 'Yetersiz bütçe.' };
  }
  state.university.budget = safeNum(state.university.budget) - cost;

  let message = '';
  if (type === 'reunion') {
    state.alumniData.alumniNetwork = Math.min(100,
      safeNum(state.alumniData.alumniNetwork) + 5);
    state.university.prestige = Math.min(100,
      safeNum(state.university.prestige) + 2);
    message = 'Mezun buluşması düzenlendi. Ağ gücü +5, Saygınlık +2.';
  } else if (type === 'career_day') {
    state.students.overallSatisfaction = Math.min(100,
      safeNum(state.students.overallSatisfaction) + 5);
    message = 'Kariyer günü düzenlendi. Öğrenci memnuniyeti +5.';
  } else if (type === 'donation_campaign') {
    // Sonraki dönem bağışları %30 artsın (flag)
    state.alumniData._donationCampaignActive = true;
    message = 'Bağış kampanyası başlatıldı. Sonraki dönem bağışlar artacak.';
  }
  return { success: true, message };
}

// ─────────────────────────────────────────────────────────────────────────────
// ÖZELLİK 2: RASTGELE OLAYLAR / KRİZLER
// ─────────────────────────────────────────────────────────────────────────────

export const RANDOM_EVENTS = [
  {
    id: 'earthquake',
    name: '🏚️ Deprem',
    description: 'Bölgede orta şiddetli deprem meydana geldi. Bazı binalar hasar gördü.',
    probability: 0.02,
    isCrisis: true,
    choices: [
      {
        text: '🔨 Acil onarım yap',
        description: 'Hızlı müdahale saygınlık kazandırır.',
        budgetDelta: -5_000_000,
        prestigeDelta: 3,
        satisfactionDelta: 5,
      },
      {
        text: '💰 Bütçe ayır, yavaş onar',
        description: 'Ucuz ama öğrenciler mutsuz.',
        budgetDelta: -2_000_000,
        prestigeDelta: -2,
        satisfactionDelta: -5,
      },
    ],
  },
  {
    id: 'pandemic',
    name: '🦠 Salgın Hastalık',
    description: 'Kampüste salgın hastalık yayıldı. Online eğitime geçiş gerekebilir.',
    probability: 0.03,
    isCrisis: true,
    choices: [
      {
        text: '💻 Tam online eğitime geç',
        description: 'Güvenli ama eğitim kalitesi düşer.',
        budgetDelta: -1_000_000,
        satisfactionDelta: -10,
        teachingQualityDelta: -15,
      },
      {
        text: '🔀 Hibrit model uygula',
        description: 'Dengeli ama pahalı.',
        budgetDelta: -3_000_000,
        satisfactionDelta: -5,
        teachingQualityDelta: -5,
      },
      {
        text: '🏫 Yüz yüze devam et',
        description: 'Riskli, eleştiri alırsınız.',
        budgetDelta: -500_000,
        satisfactionDelta: -15,
        prestigeDelta: -5,
      },
    ],
  },
  {
    id: 'government_funding',
    name: '🏛️ Devlet Teşviki',
    description: 'Hükümet üniversitelere ek bütçe ayırdı!',
    probability: 0.08,
    isCrisis: false,
    choices: [
      {
        text: '🔬 Araştırmaya yatır',
        description: 'Araştırma kapasitesi artar.',
        budgetDelta: 5_000_000,
        researchBoostDelta: 10,
      },
      {
        text: '🏗️ Altyapıya yatır',
        description: 'Kampüs iyileşir.',
        budgetDelta: 5_000_000,
        satisfactionDelta: 8,
      },
    ],
  },
  {
    id: 'student_protest',
    name: '📢 Öğrenci Protestosu',
    description: 'Öğrenciler harç zamlarını protesto ediyor.',
    probability: 0.05,
    isCrisis: true,
    condition: (state) => safeNum(state.students?.overallSatisfaction) < 50,
    choices: [
      {
        text: '📉 Harçları %10 indir',
        description: 'Öğrenciler memnun.',
        budgetDelta: -2_000_000,
        satisfactionDelta: 15,
        prestigeDelta: 2,
      },
      {
        text: '🤝 Diyalog kur, burs artır',
        description: 'Kısmi çözüm.',
        budgetDelta: -1_000_000,
        satisfactionDelta: 8,
      },
      {
        text: '😶 Görmezden gel',
        description: 'Basına yansır.',
        budgetDelta: 0,
        satisfactionDelta: -10,
        prestigeDelta: -5,
      },
    ],
  },
  {
    id: 'famous_speaker',
    name: '🎤 Ünlü Konuşmacı',
    description: 'Dünyaca ünlü bir akademisyen kampüsünüzde konferans vermek istiyor.',
    probability: 0.07,
    isCrisis: false,
    choices: [
      {
        text: '🎉 Büyük organizasyon yap',
        description: 'Saygın bir etkinlik.',
        budgetDelta: -500_000,
        prestigeDelta: 5,
        satisfactionDelta: 5,
      },
      {
        text: '🙏 Mütevazı karşıla',
        description: 'Küçük ama etkili.',
        budgetDelta: -100_000,
        prestigeDelta: 2,
      },
    ],
  },
  {
    id: 'accreditation_visit',
    name: '📋 Akreditasyon Ziyareti',
    description: 'MÜDEK/ABET değerlendirme heyeti kampüsü ziyaret edecek.',
    probability: 0.06,
    isCrisis: false,
    choices: [
      {
        text: '📚 Kapsamlı hazırlık yap',
        description: 'İyi izlenim = akreditasyon.',
        budgetDelta: -1_000_000,
        prestigeDelta: 8,
        satisfactionDelta: 3,
      },
      {
        text: '📝 Normal düzende karşıla',
        description: 'Şansa bırak.',
        budgetDelta: -200_000,
        prestigeDelta: 3,
      },
    ],
  },
  {
    id: 'tech_company_partnership',
    name: '🤝 Şirket İşbirliği Teklifi',
    description: 'Büyük bir teknoloji şirketi üniversitenizle işbirliği yapmak istiyor.',
    probability: 0.08,
    isCrisis: false,
    choices: [
      {
        text: '🔬 Araştırma ortaklığı kur',
        description: 'Araştırma fonları ve saygınlık.',
        budgetDelta: 3_000_000,
        researchBoostDelta: 8,
        prestigeDelta: 3,
      },
      {
        text: '💼 Staj programı başlat',
        description: 'Öğrencilere iş imkanı.',
        budgetDelta: 1_000_000,
        satisfactionDelta: 5,
      },
      {
        text: '🚫 Reddet (bağımsızlık)',
        description: 'Akademik bağımsızlık korunur.',
        budgetDelta: 0,
        prestigeDelta: 1,
      },
    ],
  },
  {
    id: 'faculty_scandal',
    name: '😱 Akademik Skandal',
    description: 'Bir öğretim üyesinin intihal yaptığı ortaya çıktı.',
    probability: 0.03,
    isCrisis: true,
    choices: [
      {
        text: '🔍 Soruşturma aç, uzaklaştır',
        description: 'Doğru ama saygınlık kaybı.',
        budgetDelta: -500_000,
        prestigeDelta: -3,
      },
      {
        text: '🤫 Sessiz çöz',
        description: 'Risk: basın öğrenirse daha kötü.',
        budgetDelta: -200_000,
        prestigeDelta: -8,
      },
    ],
  },
  {
    id: 'international_ranking',
    name: '📊 Uluslararası Sıralama Yükselişi',
    description: 'THE sıralamasında beklenmedik bir yükseliş yaşandı!',
    probability: 0.05,
    isCrisis: false,
    condition: (state) => safeNum(state.university?.prestige) > 40,
    choices: [
      {
        text: '📣 Basın açıklaması yap',
        description: 'Görünürlük artar.',
        budgetDelta: -100_000,
        prestigeDelta: 5,
      },
      {
        text: '🤐 Sessiz kal',
        description: 'Bedava saygınlık.',
        budgetDelta: 0,
        prestigeDelta: 2,
      },
    ],
  },
  {
    id: 'donor_offer',
    name: '💰 Büyük Bağış Teklifi',
    description: 'Hayırsever bir iş insanı üniversitenize bağış yapmak istiyor.',
    probability: 0.06,
    isCrisis: false,
    choices: [
      {
        text: '🏷️ Kabul et (isim hakkı ver)',
        description: 'Büyük para ama bina bağışçının adını taşır.',
        budgetDelta: 10_000_000,
        prestigeDelta: 3,
      },
      {
        text: '🎁 Kabul et (koşulsuz)',
        description: 'Daha az para ama daha saygın.',
        budgetDelta: 5_000_000,
        prestigeDelta: 5,
      },
      {
        text: '✋ Nazikçe reddet',
        description: 'Bağımsızlık korunur.',
        budgetDelta: 0,
      },
    ],
  },
  {
    id: 'infrastructure_failure',
    name: '⚡ Altyapı Arızası',
    description: 'Kampüste elektrik/su arızası yaşandı. Dersler aksadı.',
    probability: 0.06,
    isCrisis: true,
    choices: [
      {
        text: '🔧 Acil tamir et',
        description: 'Hızlı çözüm.',
        budgetDelta: -2_000_000,
        satisfactionDelta: -3,
      },
      {
        text: '⏳ Geçici önlem al',
        description: 'Ucuz ama uzun sürer.',
        budgetDelta: -500_000,
        satisfactionDelta: -8,
      },
    ],
  },
  {
    id: 'brain_drain',
    name: '✈️ Beyin Göçü Dalgası',
    description: 'Birçok nitelikli hoca yurtdışı teklifler alıyor.',
    probability: 0.04,
    isCrisis: true,
    condition: (state) => (state.faculty?.length || 0) > 10,
    choices: [
      {
        text: '💵 Maaşları %15 artır',
        description: 'Maliyetli ama kadro korunur.',
        budgetDelta: -3_000_000,
        satisfactionDelta: 5,
      },
      {
        text: '🔬 Araştırma fonlarını artır',
        description: 'Araştırma odaklı tutma.',
        budgetDelta: -2_000_000,
        researchBoostDelta: 5,
      },
      {
        text: '🔄 Doğal sürecine bırak',
        description: 'En iyi 1-2 hoca gidebilir.',
        budgetDelta: 0,
      },
    ],
  },
  {
    id: 'sports_victory',
    name: '🏆 Spor Başarısı',
    description: 'Üniversite spor takımı ulusal şampiyonlukta finale kaldı!',
    probability: 0.05,
    isCrisis: false,
    choices: [
      {
        text: '🎊 Tam destek ver',
        description: 'Kampüs coşkusu!',
        budgetDelta: -500_000,
        prestigeDelta: 4,
        satisfactionDelta: 8,
      },
      {
        text: '👏 Moral desteği ver',
        description: 'Mütevazı destek.',
        budgetDelta: -100_000,
        prestigeDelta: 2,
        satisfactionDelta: 3,
      },
    ],
  },
  {
    id: 'curriculum_reform',
    name: '📚 Müfredat Reformu Talebi',
    description: 'Sektör temsilcileri müfredatın güncellenmesini talep ediyor.',
    probability: 0.06,
    isCrisis: false,
    choices: [
      {
        text: '📐 Kapsamlı güncelleme yap',
        description: 'Mezunlar daha iş bulur.',
        budgetDelta: -1_000_000,
        satisfactionDelta: 5,
        prestigeDelta: 3,
      },
      {
        text: '➕ Seçmeli dersler ekle',
        description: 'Kısmi iyileştirme.',
        budgetDelta: -300_000,
        satisfactionDelta: 3,
      },
    ],
  },
  {
    id: 'cyber_attack',
    name: '🔒 Siber Saldırı',
    description: 'Üniversite bilgi sistemlerine siber saldırı düzenlendi!',
    probability: 0.03,
    isCrisis: true,
    choices: [
      {
        text: '🛡️ Profesyonel güvenlik ekibi tut',
        description: 'Hızlı çözüm, hafif saygınlık kaybı.',
        budgetDelta: -2_000_000,
        prestigeDelta: -2,
      },
      {
        text: '🖥️ İç ekiple çöz',
        description: 'Yavaş çözüm, veri kaybı riski.',
        budgetDelta: -500_000,
        prestigeDelta: -5,
        satisfactionDelta: -5,
      },
    ],
  },
  {
    id: 'media_attention',
    name: '📺 Medya İlgisi',
    description: 'Üniversitenizle ilgili olumlu bir haber ulusal medyada yayınlandı.',
    probability: 0.07,
    isCrisis: false,
    choices: [
      {
        text: '📡 Medya kampanyası başlat',
        description: 'İlgiyi fırsata çevir.',
        budgetDelta: -300_000,
        prestigeDelta: 6,
      },
      {
        text: '🌊 Doğal akışına bırak',
        description: 'Ücretsiz reklam.',
        budgetDelta: 0,
        prestigeDelta: 3,
      },
    ],
  },
  {
    id: 'akreditasyon_denetimi',
    name: '🔍 Akreditasyon Denetimi',
    description: 'Akreditasyon denetçileri kampüsünüzü incelemeye geldi. Hazırlık durumunuz önemli.',
    probability: 0.04,
    isCrisis: false,
    condition: (state) => state.departments?.some(d =>
      d.accreditation && Object.values(d.accreditation).some(a => a.status === 'applied')
    ),
    choices: [
      {
        text: '🎯 Tam hazırlık yap',
        description: 'Tüm bölümleri denetim için hazırla',
        budgetDelta: -1_000_000,
        satisfactionDelta: 2,
        prestigeDelta: 3,
      },
      {
        text: '📋 Standart karşılama',
        description: 'Normal süreçle devam et',
        prestigeDelta: 1,
      },
    ],
  },
  {
    id: 'akreditasyon_firsat',
    name: '🌐 Uluslararası Akreditasyon Fırsatı',
    description: 'ABET akredite bölümleriniz uluslararası bir burs programına davet edildi.',
    probability: 0.03,
    isCrisis: false,
    condition: (state) => state.departments?.some(d => d.accreditation?.abet?.status === 'granted'),
    choices: [
      {
        text: '✅ Başvuru yap',
        description: 'Burs programına katıl',
        budgetDelta: 2_000_000,
        prestigeDelta: 3,
      },
      {
        text: '⏭️ Şimdilik pas geç',
        description: 'Bu dönem odaklanmayı tercih et',
      },
    ],
  },
  // ── v0.3: TTO Olayları ───────────────────────────────────────────────────────
  {
    id: 'tto_buyuk_anlasma',
    name: '🏭 Büyük Sanayi Anlaşması',
    description: 'Köklü bir sanayi kuruluşu, üniversitenizin araştırma altyapısını kullanmak için kapsamlı bir ortaklık teklif ediyor.',
    probability: 0.05,
    isCrisis: false,
    condition: (state) => state.tto?.established && safeNum(state.research?.patents) >= 3,
    choices: [
      {
        text: '🤝 Tam kapsamlı ortaklık imzala',
        description: 'Yüksek gelir, ama araştırma bağımsızlığından ödün verilir.',
        budgetDelta: 8_000_000,
        prestigeDelta: 4,
      },
      {
        text: '📋 Sınırlı kapsamlı anlaşma yap',
        description: 'Daha az gelir ama akademik özgürlük korunur.',
        budgetDelta: 3_000_000,
        prestigeDelta: 2,
        researchBoostDelta: 100_000,
      },
      {
        text: '🚫 Teklifi reddet',
        description: 'Bağımsızlığı koru, gelirden vazgeç.',
        budgetDelta: 0,
        prestigeDelta: 1,
        researchBoostDelta: 200_000,
      },
    ],
  },
  {
    id: 'tto_patent_ihlali',
    name: '⚖️ Patent İhlali Davası',
    description: 'Bir şirket, üniversitenizin sahip olduğu patentlerden birini izinsiz kullandığı iddiasıyla karşı karşıya geldiniz.',
    probability: 0.04,
    isCrisis: true,
    condition: (state) => state.tto?.established && safeNum(state.research?.patents) >= 5,
    choices: [
      {
        text: '⚖️ Hukuki süreç başlat',
        description: 'Uzun süreç ama tazminat alabilirsiniz.',
        budgetDelta: -1_500_000,
        prestigeDelta: 2,
      },
      {
        text: '🤝 Uzlaşma anlaşması yap',
        description: 'Hızlı çözüm ve lisans geliri.',
        budgetDelta: 2_000_000,
        prestigeDelta: -1,
      },
      {
        text: '🔕 Görmezden gel',
        description: 'Zaman ve enerji kaybetme, ama ihlal sürer.',
        budgetDelta: 0,
        prestigeDelta: -3,
      },
    ],
  },
  {
    id: 'tto_uluslararasi_isbirligi',
    name: '🌍 Uluslararası Ar-Ge İşbirliği',
    description: 'Yabancı bir teknoloji şirketi, TTO üzerinden uluslararası ortak Ar-Ge projesi başlatmayı teklif ediyor.',
    probability: 0.04,
    isCrisis: false,
    condition: (state) => state.tto?.established && safeNum(state.tto?.level) >= 2,
    choices: [
      {
        text: '🚀 Büyük ölçekli ortaklık kur',
        description: 'Yüksek yatırım ve prestij artışı.',
        budgetDelta: -2_000_000,
        prestigeDelta: 8,
        researchBoostDelta: 500_000,
      },
      {
        text: '📝 Pilot proje ile başla',
        description: 'Düşük risk, orta kazanım.',
        budgetDelta: 1_000_000,
        prestigeDelta: 4,
        researchBoostDelta: 200_000,
      },
    ],
  },
  // ── v0.3 Kulüp Olayları ──────────────────────────────────────────────────
  {
    id: 'kulup_yarismasi',
    name: '🏆 Topluluk Yarışma Başarısı',
    description: 'Topluluklarınızdan biri ulusal yarışmada derece yaptı!',
    probability: 0.05,
    isCrisis: false,
    condition: (state) => (state.clubs?.active?.length || 0) >= 3,
    choices: [
      { text: '📰 Basın açıklaması yap', description: 'Tanıtım fırsatını değerlendir', prestigeDelta: 3, satisfactionDelta: 2 },
      { text: '🎁 Öğrencilere ödül ver', description: 'Maddi ödül ver', budgetDelta: -200_000, satisfactionDelta: 5 },
    ],
  },
  {
    id: 'kulup_sponsor',
    name: '💰 Topluluk Sponsorluk Teklifi',
    description: 'Bir şirket topluluklarınıza sponsor olmak istiyor.',
    probability: 0.04,
    isCrisis: false,
    condition: (state) => (state.clubs?.active?.length || 0) >= 5,
    choices: [
      { text: '✅ Kabul et', description: 'Sponsorluğu kabul et', budgetDelta: 1_500_000, satisfactionDelta: 2 },
      { text: '❌ Reddet', description: 'Bağımsızlığı koru', prestigeDelta: 1 },
    ],
  },
  {
    id: 'kulup_krizi',
    name: '😤 Topluluk İç Çatışması',
    description: 'Bir topluluğun yönetiminde iç çatışma çıktı.',
    probability: 0.03,
    isCrisis: true,
    condition: (state) => (state.clubs?.active?.length || 0) >= 2,
    choices: [
      { text: '🤝 Arabuluculuk yap', description: 'Uzlaşma sağla', budgetDelta: -100_000, satisfactionDelta: -1 },
      { text: '🔨 Yönetimi değiştir', description: 'Yeni yönetim ata', satisfactionDelta: -3 },
    ],
  },
  {
    id: 'kulup_festivali',
    name: '🎉 Bahar Festivali',
    description: 'Topluluklar birlikte büyük bir kampüs festivali düzenlemek istiyor.',
    probability: 0.06,
    isCrisis: false,
    condition: (state) => (state.clubs?.active?.length || 0) >= 4,
    choices: [
      { text: '🎊 Tam destek ver', description: 'Büyük festival düzenle', budgetDelta: -500_000, satisfactionDelta: 8, prestigeDelta: 2 },
      { text: '📋 Küçük etkinlik yap', description: 'Mütevazı bir etkinlik', budgetDelta: -100_000, satisfactionDelta: 3 },
    ],
  },
];

/**
 * Her dönem çalıştırılır; 0-3 arası rastgele olay döndürür.
 * @returns {Array} Tetiklenen olaylar
 */
export function rollRandomEvents(state) {
  if (!state._randomEventsState) {
    state._randomEventsState = { history: [], pendingEvents: [] };
  }
  if (!state.stats) state.stats = {};
  if (!state.stats.crisesHandled) state.stats.crisesHandled = 0;

  const triggered = [];

  for (const event of RANDOM_EVENTS) {
    // Koşul kontrolü
    if (event.condition && !event.condition(state)) continue;

    // Son 6 dönem içinde aynı olay tekrar gelmesin (maks 1 kez)
    const recent = state._randomEventsState.history.slice(-6);
    if (recent.includes(event.id)) continue;

    if (Math.random() < event.probability) {
      triggered.push(event);
      if (triggered.length >= 2) break; // dönem başına maks 2 olay
    }
  }

  return triggered;
}

/**
 * Oyuncunun olay seçimini uygula.
 * @param {object} state
 * @param {string} eventId
 * @param {number} choiceIndex
 * @returns {{ success: boolean, message: string, effects: object }}
 */
export function applyRandomEventChoice(state, eventId, choiceIndex) {
  const event = RANDOM_EVENTS.find(e => e.id === eventId);
  if (!event) return { success: false, message: 'Olay bulunamadı.' };

  const choice = event.choices[choiceIndex];
  if (!choice) return { success: false, message: 'Geçersiz seçenek.' };

  // Etkileri uygula
  const effects = {};

  if (choice.budgetDelta) {
    state.university.budget = safeNum(state.university.budget) + safeNum(choice.budgetDelta);
    effects.budgetDelta = choice.budgetDelta;
  }
  if (choice.prestigeDelta) {
    state.university.prestige = Math.max(0, Math.min(100,
      safeNum(state.university.prestige) + safeNum(choice.prestigeDelta)));
    effects.prestigeDelta = choice.prestigeDelta;
  }
  if (choice.satisfactionDelta) {
    state.students.overallSatisfaction = Math.max(0, Math.min(100,
      safeNum(state.students.overallSatisfaction) + safeNum(choice.satisfactionDelta)));
    // Bölüm memnuniyetlerini de güncelle
    const byDept = state.students?.byDepartment || {};
    for (const deptData of Object.values(byDept)) {
      for (const yr of [deptData.year1, deptData.year2, deptData.year3, deptData.year4]) {
        if (yr) yr.satisfaction = Math.max(0, Math.min(100,
          safeNum(yr.satisfaction) + safeNum(choice.satisfactionDelta) * 0.5));
      }
    }
    effects.satisfactionDelta = choice.satisfactionDelta;
  }
  if (choice.researchBoostDelta) {
    // Araştırma bütçesine geçici boost (sonraki dönem etki)
    state.university._researchBoost = safeNum(state.university._researchBoost) + safeNum(choice.researchBoostDelta);
    effects.researchBoostDelta = choice.researchBoostDelta;
  }
  if (choice.teachingQualityDelta) {
    // Tüm bölümlerin eğitim kalitesini etkile
    for (const dept of (state.departments || [])) {
      dept.educationQuality = Math.max(0, Math.min(100,
        safeNum(dept.educationQuality) + safeNum(choice.teachingQualityDelta)));
    }
    effects.teachingQualityDelta = choice.teachingQualityDelta;
  }

  // Kriz olayı çözüldüyse sayacı artır
  if (event.isCrisis) {
    if (!state.stats) state.stats = {};
    state.stats.crisesHandled = safeNum(state.stats.crisesHandled) + 1;
  }

  // Geçmişe ekle
  if (!state._randomEventsState) state._randomEventsState = { history: [], pendingEvents: [] };
  state._randomEventsState.history.push(eventId);
  if (state._randomEventsState.history.length > 20) state._randomEventsState.history.shift();

  // Olayı geçmiş olaylar listesine ekle (özet ekranı için)
  if (!state.events) state.events = { current: null, history: [], pendingDecision: null };
  state.events.history.push({
    id: eventId,
    name: event.name,
    turn: state.meta.turn,
    choiceIndex,
    choiceText: choice.text,
    effects,
  });

  return {
    success: true,
    message: `${event.name}: "${choice.text}" seçildi.`,
    effects,
    event,
    choice,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ÖZELLİK 3: BAŞARIMLAR
// ─────────────────────────────────────────────────────────────────────────────

export const ACHIEVEMENTS = [
  // Büyüme
  { id: 'first_hire',      name: '🎓 İlk Transfer',       description: 'İlk hocanızı transfer edin.',                      icon: '🎓', category: 'kadro',     check: (s) => safeNum(s.stats?.totalHires) >= 1 || (s.faculty?.length || 0) >= 1 },
  { id: 'faculty_10',      name: '👨‍🏫 Kadro Kurucusu',      description: '10 öğretim üyesine ulaşın.',                       icon: '👨‍🏫', category: 'kadro',    check: (s) => (s.faculty?.length || 0) >= 10 },
  { id: 'faculty_50',      name: '🏛️ Akademik Güç',         description: '50 öğretim üyesine ulaşın.',                       icon: '🏛️', category: 'kadro',    check: (s) => (s.faculty?.length || 0) >= 50 },
  { id: 'students_1000',   name: '📚 Bin Öğrenci',          description: '1.000 öğrenciye ulaşın.',                          icon: '📚', category: 'ogrenci',  check: (s) => safeNum(s.students?.totalEnrolled) >= 1000 },
  { id: 'students_5000',   name: '🏟️ Dev Kampüs',           description: '5.000 öğrenciye ulaşın.',                          icon: '🏟️', category: 'ogrenci', check: (s) => safeNum(s.students?.totalEnrolled) >= 5000 },
  // Prestij
  { id: 'prestige_25',     name: '⭐ Yükselen Yıldız',      description: "Saygınlık 25'e ulaşsın.",                          icon: '⭐', category: 'prestij',  check: (s) => safeNum(s.university?.prestige) >= 25 },
  { id: 'prestige_50',     name: '🌟 Tanınan Üniversite',   description: "Saygınlık 50'ye ulaşsın.",                         icon: '🌟', category: 'prestij',  check: (s) => safeNum(s.university?.prestige) >= 50 },
  { id: 'prestige_80',     name: '💫 Elit Üniversite',       description: "Saygınlık 80'e ulaşsın.",                          icon: '💫', category: 'prestij',  check: (s) => safeNum(s.university?.prestige) >= 80 },
  // Sıralama
  { id: 'rank_40',         name: '📊 İlk 40',               description: 'Sıralamada 40. sıraya yükselin.',                  icon: '📊', category: 'siralama', check: (s) => safeNum(s.university?.ranking || 100) <= 40 },
  { id: 'rank_20',         name: '📈 İlk 20',               description: 'Sıralamada 20. sıraya yükselin.',                  icon: '📈', category: 'siralama', check: (s) => safeNum(s.university?.ranking || 100) <= 20 },
  { id: 'rank_10',         name: "🏆 İlk 10",               description: "Sıralamada ilk 10'a girin.",                       icon: '🏆', category: 'siralama', check: (s) => safeNum(s.university?.ranking || 100) <= 10 },
  { id: 'rank_1',          name: '👑 Zirve',                description: '1 numaralı üniversite olun!',                      icon: '👑', category: 'siralama', check: (s) => safeNum(s.university?.ranking || 100) === 1 },
  // Araştırma
  { id: 'first_project',   name: '🔬 İlk Proje',            description: 'İlk araştırma projeniz kabul edilsin.',            icon: '🔬', category: 'arastirma', check: (s) => (s.research?.activeResearchProjects?.length || 0) + (s.research?.completedProjects?.length || 0) >= 1 },
  { id: 'publications_100',name: '📄 100 Yayın',            description: 'Toplam 100 yayına ulaşın.',                        icon: '📄', category: 'arastirma', check: (s) => safeNum(s.research?.publications) >= 100 },
  { id: 'publications_500',name: '📚 Yayın Makinesi',        description: 'Toplam 500 yayına ulaşın.',                        icon: '📚', category: 'arastirma', check: (s) => safeNum(s.research?.publications) >= 500 },
  // Finansal
  { id: 'budget_100m',     name: '💰 100 Milyon',           description: "Bütçe 100M ₺'ye ulaşsın.",                        icon: '💰', category: 'finans',   check: (s) => safeNum(s.university?.budget) >= 100_000_000 },
  { id: 'budget_500m',     name: '💎 Yarım Milyar',         description: "Bütçe 500M ₺'ye ulaşsın.",                        icon: '💎', category: 'finans',   check: (s) => safeNum(s.university?.budget) >= 500_000_000 },
  { id: 'first_donation',  name: '🤝 İlk Bağış',           description: 'Mezunlardan ilk bağışı alın.',                     icon: '🤝', category: 'finans',   check: (s) => safeNum(s.alumniData?.annualDonations) > 0 || safeNum(s.alumniData?.totalDonations) > 0 },
  // Binalar
  { id: 'first_building',  name: '🏗️ İlk İnşaat',          description: 'İlk binanızı inşa edin.',                          icon: '🏗️', category: 'kampus',  check: (s) => (s.buildings?.length || 0) >= 2 },
  { id: 'buildings_10',    name: '🏘️ Kampüs Mimarı',        description: '10 bina inşa edin.',                               icon: '🏘️', category: 'kampus', check: (s) => (s.buildings?.length || 0) >= 10 },
  { id: 'max_level_building', name: '🏰 Düzey 5 Bina',      description: 'Bir binayı düzey 5\'e yükseltin.',                 icon: '🏰', category: 'kampus',  check: (s) => (s.buildings || []).some(b => b.level >= 5) },
  // Bölümler
  { id: 'new_department',  name: '📋 Yeni Bölüm',           description: 'İlk yeni bölümünüzü açın.',                        icon: '📋', category: 'bolum',   check: (s) => safeNum(s.stats?.departmentsOpened) >= 1 || (s.departments?.length || 0) > 3 },
  { id: 'departments_10',  name: '🎪 10 Bölüm',             description: '10 aktif bölüme ulaşın.',                          icon: '🎪', category: 'bolum',   check: (s) => (s.departments?.filter(d => d.isOpen)?.length || 0) >= 10 },
  // Özel
  { id: 'first_graduate',  name: '🎓 İlk Mezun',            description: 'İlk mezunlarınızı verin.',                         icon: '🎓', category: 'ozel',    check: (s) => safeNum(s.alumniData?.totalGraduates) > 0 || (s.alumni?.length || 0) > 0 },
  { id: 'notable_alumni',  name: '🌟 Ünlü Mezun',           description: 'İlk ünlü mezununuz ortaya çıksın.',                icon: '🌟', category: 'ozel',    check: (s) => (s.alumniData?.notableAlumni || []).some(a => a.careerLevel >= 3) },
  { id: 'survive_crisis',  name: '🛡️ Kriz Yöneticisi',     description: 'İlk krizi başarıyla atlatin.',                     icon: '🛡️', category: 'ozel',   check: (s) => safeNum(s.stats?.crisesHandled) >= 1 },
  // Akreditasyon
  { id: 'first_accreditation', name: '🏅 İlk Akreditasyon', description: 'Bir bölüm akreditasyon alsın.',                  icon: '🏅', category: 'akreditasyon', check: (s) => (s.departments || []).some(d => d.accreditation && Object.values(d.accreditation).some(a => a.status === 'granted')) },
  { id: 'abet_accreditation',  name: '🌍 ABET Akredite',    description: 'Bir bölüm ABET akreditasyonu alsın.',              icon: '🌍', category: 'akreditasyon', check: (s) => (s.departments || []).some(d => d.accreditation?.abet?.status === 'granted') },
  { id: 'all_accreditations',  name: '🏆 Tam Akredite',     description: 'Aynı bölüm hem MÜDEK hem ABET akreditasyonu alsın.', icon: '🏆', category: 'akreditasyon', check: (s) => (s.departments || []).some(d => d.accreditation?.mudek?.status === 'granted' && d.accreditation?.abet?.status === 'granted') },
  { id: 'akredite_universitesi', name: '🏅 Akredite Üniversite', description: 'En az 5 bölüm herhangi bir akreditasyon aldı.', icon: '🏅', category: 'akreditasyon', check: (s) => {
    const accDepts = (s.departments || []).filter(d =>
      d.accreditation && Object.values(d.accreditation).some(a => a.status === 'granted')
    );
    return accDepts.length >= 5;
  } },
  { id: 'uluslararasi_standart', name: '🌐 Uluslararası Standart', description: 'En az bir bölüm ABET akreditasyonu aldı.', icon: '🌐', category: 'akreditasyon', check: (s) => (s.departments || []).some(d => d.accreditation?.abet?.status === 'granted') },
  // v0.3: TTO Başarımları
  { id: 'teknoloji_uretici',  name: '📜 Teknoloji Üreticisi', description: '5 veya daha fazla patente sahip olun.',             icon: '📜', category: 'arastirma', check: (s) => safeNum(s.research?.patents) >= 5 },
  { id: 'spin_off_fabrikasi', name: '🚀 Spin-off Fabrikası',  description: '3 veya daha fazla spin-off şirket kurun.',          icon: '🚀', category: 'arastirma', check: (s) => (s.tto?.spinoffs?.length || 0) >= 3 },
  { id: 'sektor_ortagi',      name: '🤝 Sektör Ortağı',       description: "TTO üzerinden toplam 10M ₺ gelir elde edin.",       icon: '🤝', category: 'finans',    check: (s) => safeNum(s.tto?.totalRevenueGenerated) >= 10_000_000 },
  // v0.3: Kulüp Başarımları
  { id: 'kulup_kenti',    name: '🎭 Topluluk Kenti',    description: '8 veya daha fazla aktif topluluk kur.',                        icon: '🎭', category: 'ogrenci', check: (s) => (s.clubs?.active?.length || 0) >= 8 },
  { id: 'kulup_ustasi',   name: '⭐ Topluluk Ustası',   description: 'Bir topluluğu maksimum seviyeye yükselt.',                     icon: '⭐', category: 'ogrenci', check: (s) => (s.clubs?.active || []).some(c => c.level >= 3) },
  { id: 'sosyal_kampus',  name: '🏫 Sosyal Kampüs',  description: 'Her kategoriden en az bir topluluk kur (5 kategori).',        icon: '🏫', category: 'ogrenci', check: (s) => {
    const cats = new Set();
    for (const club of (s.clubs?.active || [])) {
      const type = CLUB_TYPES[club.typeId];
      if (type) cats.add(type.category);
    }
    return cats.size >= 5;
  } },
];

/**
 * Her dönem sonunda çalıştırılır; yeni açılan başarımları döndürür.
 * @returns {Array} Yeni açılan başarımlar
 */
export function checkAchievements(state) {
  if (!state.achievements) state.achievements = {};
  const newlyUnlocked = [];

  for (const ach of ACHIEVEMENTS) {
    if (state.achievements[ach.id]) continue; // Zaten açık

    try {
      if (ach.check(state)) {
        state.achievements[ach.id] = {
          unlockedAt: state.meta?.turn || 1,
          year: state.meta?.year || 1,
          semester: state.meta?.semester || 'güz',
        };
        newlyUnlocked.push(ach);
      }
    } catch (e) {
      // Sessizce atla
    }
  }

  return newlyUnlocked;
}

/**
 * Başarım istatistiklerini döndürür.
 */
export function getAchievementStats(state) {
  const total = ACHIEVEMENTS.length;
  const unlocked = Object.keys(state.achievements || {}).length;
  return { total, unlocked, percent: Math.round((unlocked / total) * 100) };
}
