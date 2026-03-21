/**
 * Rektör Oldum — Ekonomi/Bütçe Motoru (economy.js)
 * ES6 module. Tüm gelir/gider hesaplamaları ve bütçe uygulaması bu dosyadadır.
 * data.js sabitleriyle tam uyumludur.
 */

import {
  UNIVERSITY_TYPES,
  UNIVERSITY_MODELS,
  USD_TO_TL,
  DEPARTMENTS,
  BUILDINGS,
  SEMESTER_MONTHS,
  TUITION_MULTIPLIER_TIP,
  TUITION_MULTIPLIER_MUH,
  TUITION_MULTIPLIER_HUK,
  TUITION_MULTIPLIER_FEN,
  TUITION_MULTIPLIER_SOS,
} from './data.js';

// ─────────────────────────────────────────────────────────────────────────────
// EKONOMİ SABİTLERİ
// Tüm formüllerde kullanılan denge parametreleri.
// ─────────────────────────────────────────────────────────────────────────────

// Devlet ödeneği (₺/dönem)
const STATE_GRANT_BASE              = 20_000_000;   // baz sabit ödenek
const STATE_GRANT_PER_STUDENT       = 4_000;        // öğrenci başı ödenek (₺/dönem)
const STATE_GRANT_RESEARCH_BONUS    = 5_000_000;    // araştırma üniversitesi ek bonusu

// Araştırma fonu
const RESEARCH_OVERHEAD_RATE        = 0.15;         // proje bütçesinin %15'i overhead
const PATENT_LICENSE_FEE            = 500_000;      // aktif patent başına lisans bedeli (₺/dönem)

// Döner sermaye (sağlık birimleri)
const HOSPITAL_BASE_REVENUE         = 8_000_000;    // hastane temel geliri (₺/dönem)
const CLINIC_BASE_REVENUE           = 3_000_000;    // klinik temel geliri (₺/dönem)
const LAB_SERVICE_REVENUE_PER_DEPT  = 200_000;      // lab hizmeti bölüm başına (₺/dönem)

// Mezun bağışları
const ALUMNI_BASE_DONATION          = 15_000;       // ortalama kişi başı bağış (₺/yıl)
const ALUMNI_DONATION_RATE          = 0.03;         // mezunların bağış yapma oranı (baz)
const ALUMNI_PRESTIGE_SCALE         = 0.015;        // prestij × bu sayı = bağış oranı çarpanı

// Sponsorluk / Teknokent
const TECHNOPARKBASE_REVENUE        = 2_000_000;    // teknokent temel dönem geliri
const TECHNOPARKSTUDENT_RATE        = 500;          // öğrenci başı ek endüstri katkısı (₺)
const INDUSTRY_TIE_PER_POINT        = 50_000;       // sektör bağlantı puanı başına (₺/dönem)

// Maaşlar
const ADMIN_SALARY_RATIO            = 0.25;         // idari maaş = akademik toplam maaş × oran
const PART_TIME_COST_PER_COURSE     = 15_000;       // yarı zamanlı ders başı ücret (₺/dönem)

// Bina bakım
const MAINTENANCE_QUALITY_SCALE     = 0.5;          // kalite düşükse bakım artar

// Burs
const SCHOLARSHIP_AMOUNT_MERIT      = 30_000;       // başarı bursu (₺/dönem)
const SCHOLARSHIP_AMOUNT_NEED       = 20_000;       // ihtiyaç bursu (₺/dönem)
const SCHOLARSHIP_AMOUNT_MIXED      = 25_000;       // karma burs (₺/dönem)

// Genel giderler (öğrenci başı)
const OVERHEAD_PER_STUDENT          = 3_500;        // ₺/dönem enerji+su+temizlik vb.
const OVERHEAD_FIXED                = 1_500_000;    // sabit genel gider (₺/dönem)

// Borç faiz oranları
const DEBT_INTEREST_STAGE2          = 0.03;         // %3/dönem (aşama 2)
const DEBT_INTEREST_STAGE3          = 0.05;         // %5/dönem (aşama 3)

// Fiyat elastikliği sabitleri
const ELASTICITY_BASE_LOW           = -0.5;         // düşük prestij elastikiyeti
const ELASTICITY_BASE_MED           = -1.0;         // orta prestij elastikiyeti
const ELASTICITY_BASE_HIGH          = -1.5;         // yüksek prestij elastikiyeti
const TUITION_REFERENCE_VAKIF       = 65_000;       // ₺ — referans harç tutarı (elastiklik baz noktası)

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI: NaN'a karşı güvenli sayı dönüştürücü
// Tüm gelir/gider aritmetiğinde kullanılır.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bir değeri sayıya çevirir; undefined/null/NaN/Infinity durumunda 0 döner.
 * @param {*} val
 * @returns {number}
 */
function safeNum(val) {
  const n = Number(val);
  return (isFinite(n) && !isNaN(n)) ? n : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI: Bölüm kategorisine göre harç çarpanını bul
// ─────────────────────────────────────────────────────────────────────────────

function _getCategoryTuitionMultiplier(category) {
  switch (category) {
    case 'saglik':        return TUITION_MULTIPLIER_TIP;
    case 'muhendislik':   return TUITION_MULTIPLIER_MUH;
    case 'sosyal':        return TUITION_MULTIPLIER_HUK;
    case 'temel_bilim':   return TUITION_MULTIPLIER_FEN;
    default:              return TUITION_MULTIPLIER_SOS;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI: Burs miktarını politikaya göre belirle
// ─────────────────────────────────────────────────────────────────────────────

function _getScholarshipAmount(policy) {
  switch (policy) {
    case 'merit':  return SCHOLARSHIP_AMOUNT_MERIT;
    case 'need':   return SCHOLARSHIP_AMOUNT_NEED;
    case 'mixed':  return SCHOLARSHIP_AMOUNT_MIXED;
    default:       return SCHOLARSHIP_AMOUNT_MERIT;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI: Borç aşamasını döndür
// ─────────────────────────────────────────────────────────────────────────────

function _getDebtStage(budget) {
  if (budget >= 0)           return 0;   // Normal
  if (budget >= -10_000_000) return 1;   // Uyarı
  if (budget >= -30_000_000) return 2;   // Faiz uygulanır
  if (budget >= -60_000_000) return 3;   // YÖK denetimi
  return 4;                              // İflas eşiği
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateIncome — Dönem gelirini kalem kalem hesapla
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dönem toplam gelirini hesaplar.
 *
 * @param {object} state — Tam oyun state'i (getState() çıktısı)
 * @returns {{
 *   tuition: number,
 *   stateGrant: number,
 *   researchFunds: number,
 *   revolving: number,
 *   donations: number,
 *   sponsorship: number,
 *   patents: number,
 *   total: number
 * }}
 */
export function calculateIncome(state) {
  const uniType    = state.meta.universityType;
  const uniData    = UNIVERSITY_TYPES[uniType] || UNIVERSITY_TYPES['vakif'];
  const uniModel   = UNIVERSITY_MODELS[uniType] || UNIVERSITY_MODELS['vakif'];
  // Guard against NaN prestige (can happen if avgFacultyHappy was NaN in a previous turn)
  const prestige   = safeNum(state.university.prestige);
  const openDeptCount = state.departments.filter(d => d.isOpen).length;

  // ── 1. HARÇ / ÖĞRENCİ GELİRİ ────────────────────────────────────────────────
  // Model: 'free' → sadece katkı payı | 'paid' → tam harç sistemi
  let tuition = 0;
  const baseTuition = state.university.tuitionPerSemester;
  const byDepartment = state.students?.byDepartment || {};

  if (uniModel.tuitionModel === 'free') {
    // Devlet: sembolik öğrenci katkı payı (sabit, tüm öğrencilerden)
    const katkiPayi = safeNum(uniModel.revenueStreams?.ogrenciKatkiPayi?.perStudent ?? 2_000);
    tuition = safeNum(state.students?.totalEnrolled) * katkiPayi;

  } else if (uniType === 'us_private') {
    // ABD özel: yüksek harç, financial aid indirimi
    const perStudentTL = safeNum(uniModel.revenueStreams?.tuition?.perStudentUSD ?? 55_000)
      * USD_TO_TL / 2; // $/yıl → ₺/dönem
    const aidRate      = safeNum(state.university.financialAidRate ?? 0.45);
    const enrolled     = safeNum(state.students?.totalEnrolled);
    tuition = enrolled * perStudentTL * (1 - aidRate);

  } else {
    // Vakıf (tr_vakif): tam burs/yarı burs/ücretli sistemi
    state.departments.forEach(dept => {
      if (!dept.isOpen) return;
      const deptData      = byDepartment[dept.id];
      if (!deptData) return;
      const deptMultiplier = safeNum(dept.tuitionMultiplier || _getCategoryTuitionMultiplier(dept.category));
      const safeTuition    = safeNum(baseTuition);
      for (const yr of [deptData.year1, deptData.year2, deptData.year3, deptData.year4]) {
        if (!yr || !yr.count) continue;
        tuition += safeNum(yr.yariBurslu) * safeTuition * deptMultiplier * 0.50;
        tuition += safeNum(yr.ucretli)    * safeTuition * deptMultiplier * 1.0;
      }
    });

    // Eski kayıt dosyası (cohort) uyumluluğu
    if (Object.keys(byDepartment).length === 0 && state.students?.cohorts?.length > 0) {
      state.students.cohorts.forEach(cohort => {
        const dept = state.departments.find(d => d.id === cohort.departmentId);
        const deptMultiplier = safeNum(dept
          ? (dept.tuitionMultiplier || _getCategoryTuitionMultiplier(dept.category))
          : 1.0);
        const scholarshipCount = _estimateScholarshipCount(cohort, state);
        const payingStudents   = Math.max(0, safeNum(cohort.count) - scholarshipCount);
        tuition += payingStudents * safeNum(baseTuition) * deptMultiplier;
      });
    }
  }

  // ── 2. DEVLET ÖDENEĞİ / ENDOWMENT ───────────────────────────────────────────
  let stateGrant = 0;

  if (uniType === 'devlet') {
    // YÖK bütçe tahsisi: baz + öğrenci başı + hoca başı
    const yokCfg    = uniModel.revenueStreams.yokTahsisi;
    stateGrant = safeNum(yokCfg.base)
      + safeNum(state.students?.totalEnrolled) * safeNum(yokCfg.perStudent)
      + safeNum(state.faculty?.length)         * safeNum(yokCfg.perFaculty);

    // Araştırma üniversitesi bonusu
    const isResearchUni = safeNum(state.research?.publications) > 50
      || safeNum(state.research?.tubitakProjects) > 3;
    if (isResearchUni) stateGrant += safeNum(yokCfg.researchBonus);

  } else if (uniType === 'us_private') {
    // Endowment getirisi: endowment × yıllık getiri / 2 (dönemlik)
    const endCfg  = uniModel.revenueStreams.endowment;
    const endSize = safeNum(state.university.endowment ?? endCfg.base);
    stateGrant    = endSize * safeNum(endCfg.returnRate) / 2;

  } else if (uniType === 'vakif') {
    // Vakıf katkısı (dönemlik)
    const vkCfg    = uniModel.revenueStreams.vakifKatkisi;
    const turn     = safeNum(state.meta?.turn ?? 1);
    const base     = safeNum(vkCfg.base);
    const growth   = safeNum(vkCfg.growthRate);
    stateGrant     = base * Math.pow(1 + growth, Math.floor(turn / 2));
    if (!isFinite(stateGrant)) stateGrant = base;
  }

  // ── 3. ARAŞTIRMA FONLARI ─────────────────────────────────────────────────────
  let researchFunds = 0;

  // ABD modelinde F&A oranı farklı
  const overheadRate = uniType === 'us_private'
    ? (uniModel.revenueStreams.researchGrants?.overheadRate ?? 0.26)
    : RESEARCH_OVERHEAD_RATE;

  (state.research.activeProjects || []).forEach(project => {
    if (!project.completed) {
      researchFunds += safeNum(project.budget) * safeNum(overheadRate);
    }
  });

  // Aktif araştırma projelerinden genel gider kesintisi (activeResearchProjects sistemi)
  let projectOverhead = 0;
  const uniOverheadRate = safeNum(state.universitySettings?.overheadRate ?? 0.15);
  (state.research.activeResearchProjects || []).forEach(project => {
    if (project.status === 'active') {
      const semesterFunding = safeNum(project.requestedFunding || project.funding || 0)
        / Math.max(1, safeNum(project.duration || 4));
      // Proje türüne özgü overhead oranı varsa onu kullan, yoksa üniversite ayarını kullan
      const projOverheadRate = safeNum(project.callOverheadRate ?? uniOverheadRate);
      projectOverhead += semesterFunding * projOverheadRate;
    }
  });

  // Patent telif gelirleri (patentRoyalties storedState'ten, yıllık → dönem bölü 2)
  const patentRoyalties = uniType === 'us_private'
    ? 0
    : safeNum(state.research?.patentRoyalties ?? 0) / 2;

  // ── 4. DÖNER SERMAYE ─────────────────────────────────────────────────────────
  let revolving = 0;

  if (state.university.hasHospital) {
    const tipDept       = state.departments.find(d => d.id === 'tip');
    const tipStudents   = safeNum(tipDept ? tipDept.enrolledStudents : 0);
    const tipMultiplier = safeNum(tipDept ? (tipDept.donerSermayeMultiplier || 1.0) : 1.0);
    revolving += HOSPITAL_BASE_REVENUE * tipMultiplier
      * (1 + tipStudents / 500)
      * (0.5 + prestige / 200);
  }

  if (state.university.hasClinic) {
    const disDept       = state.departments.find(d => d.id === 'dis_hekimligi');
    const disMultiplier = safeNum(disDept ? (disDept.donerSermayeMultiplier || 1.0) : 1.0);
    revolving += CLINIC_BASE_REVENUE * disMultiplier;
  }

  // Bölüm bazlı lab/danışmanlık dış hizmet + model bazlı döner sermaye
  if (uniType === 'us_private') {
    revolving += openDeptCount * LAB_SERVICE_REVENUE_PER_DEPT;
    // Teknoloji lisanslama
    const tlCfg = uniModel.revenueStreams.techLicensing;
    revolving  += safeNum(tlCfg.base) + safeNum(state.research?.patents) * safeNum(tlCfg.perPatent);
    // Spor gelirleri
    revolving  += safeNum(uniModel.revenueStreams.athleticRevenue?.base);
  } else {
    const dsBase    = safeNum(uniModel.revenueStreams?.donerSermaye?.base);
    const dsPerDept = safeNum(uniModel.revenueStreams?.donerSermaye?.perDept);
    revolving += dsBase + openDeptCount * dsPerDept;
  }

  // ── 5. BAĞIŞLAR ──────────────────────────────────────────────────────────────
  let donations = 0;

  if (uniType === 'us_private') {
    // ABD: mezun bağışları (daha büyük ölçek)
    const adCfg  = uniModel.revenueStreams.alumniDonations;
    donations    = safeNum(adCfg.base) + prestige * safeNum(adCfg.perPrestige);
  } else {
    // TR: mezun sayısı bazlı (mütevazı)
    const alumniCount  = safeNum(state.alumni?.length);
    const donationRate = safeNum(ALUMNI_DONATION_RATE + (prestige * ALUMNI_PRESTIGE_SCALE / 100));
    const avgDonation  = safeNum(ALUMNI_BASE_DONATION * (1 + prestige / 200));
    donations = alumniCount > 0
      ? Math.floor(alumniCount * donationRate * avgDonation / 2)
      : 0;

    // Model bazlı bağış baz katkısı
    const bagisBase  = safeNum(uniModel.revenueStreams?.bagis?.base);
    const bagisPerPr = safeNum(uniModel.revenueStreams?.bagis?.perPrestige);
    donations += bagisBase + prestige * bagisPerPr;
  }

  // ── 6. SPONSORLUK / ENDÜSTRİ KATKISI ────────────────────────────────────────
  let sponsorship = 0;

  if (state.university.hasTechnoPark) {
    sponsorship += TECHNOPARKBASE_REVENUE;
    sponsorship += safeNum(state.students?.totalEnrolled) * TECHNOPARKSTUDENT_RATE;
    const industryTiePoints = Math.floor(prestige * 0.3);
    sponsorship += industryTiePoints * INDUSTRY_TIE_PER_POINT;
  }

  // ── 7. PATENT LİSANS GELİRİ (TR modelleri) ──────────────────────────────────
  // ABD modeli techLicensing'i döner sermayeye dahil ettik; TR için ayrı
  const patents = uniType === 'us_private'
    ? 0
    : safeNum(state.research?.patents) * PATENT_LICENSE_FEE;

  // ── TOPLAM ───────────────────────────────────────────────────────────────────
  const rawTotal = tuition + stateGrant + researchFunds + projectOverhead
    + revolving + donations + sponsorship + patents + patentRoyalties;
  const total = isFinite(rawTotal) ? rawTotal : 0;

  return {
    tuition:          Math.round(tuition),
    stateGrant:       Math.round(stateGrant),
    researchFunds:    Math.round(researchFunds),
    projectOverhead:  Math.round(projectOverhead),
    patentRoyalties:  Math.round(patentRoyalties),
    revolving:        Math.round(revolving),
    donations:        Math.round(donations),
    sponsorship:      Math.round(sponsorship),
    patents:          Math.round(patents),
    total:            Math.round(total),
    // Etiket bilgisi (bütçe paneli için)
    _labels: uniModel.revenueLabels || {},
    _uniType: uniType,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI: Kohort içindeki burslu öğrenci sayısını tahmin et
// ─────────────────────────────────────────────────────────────────────────────

function _estimateScholarshipCount(cohort, state) {
  // Bütçenin burs oranı ve toplam öğrenci sayısına göre orantılı paylaştır
  const totalEnrolled  = Math.max(1, state.students.totalEnrolled);
  const scholarshipBudgetRatio = state.students.scholarshipBudgetRatio || 0.05;
  const policy         = state.students.scholarshipPolicy || 'merit';
  const perStudentAmt  = _getScholarshipAmount(policy);

  // Toplam bütçeden karşılanabilecek burslu öğrenci sayısı
  const uniData        = UNIVERSITY_TYPES[state.meta.universityType];
  const estimatedBudget = uniData.startBudget;   // Kaba yaklaşım; gerçek bütçe applyBudget'ta
  const totalScholarshipFund = estimatedBudget * scholarshipBudgetRatio;
  const maxScholarships = Math.floor(totalScholarshipFund / perStudentAmt);

  // Kohort içine orantısal düş
  const cohortShare = cohort.count / totalEnrolled;
  return Math.floor(maxScholarships * cohortShare);
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateExpenses — Dönem giderini kalem kalem hesapla
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dönem toplam giderini hesaplar.
 *
 * @param {object} state — Tam oyun state'i
 * @returns {{
 *   salariesAcademic: number,
 *   salariesAdmin: number,
 *   partTime: number,
 *   maintenance: number,
 *   scholarships: number,
 *   researchInvestment: number,
 *   construction: number,
 *   overhead: number,
 *   total: number
 * }}
 */
export function calculateExpenses(state) {
  // ── 1. AKADEMİK MAAŞLAR ─────────────────────────────────────────────────────
  // Her hocanın aylık maaşı × SEMESTER_MONTHS (5 ay/dönem)
  let salariesAcademic = 0;

  state.faculty.forEach(member => {
    const memberSalary = safeNum(member.salary);
    if (memberSalary === 0 && member.salary != null && member.salary !== 0) {
      console.warn('[economy] NaN maaş tespit edildi, hoca:', member.id, member.name, 'salary:', member.salary);
    }
    salariesAcademic += memberSalary * SEMESTER_MONTHS;
  });

  // ── 2. İDARİ MAAŞLAR ────────────────────────────────────────────────────────
  // Yeni sistem: gerçek idari personel maaşları (adminStaff listesi)
  let salariesAdmin = 0;
  let adminOperating = 0;

  if (state.adminStaff && state.adminStaff.length > 0) {
    // Gerçek maaşlar × dönem ay sayısı
    state.adminStaff.forEach(member => {
      salariesAdmin += safeNum(member.salary) * SEMESTER_MONTHS;
    });
    // Birim işletme bütçeleri (personel maaşı dışı: kırtasiye, yazılım lisansı, servis, vb.)
    if (state.adminUnits) {
      Object.values(state.adminUnits).forEach(unit => {
        // İşletme bütçesi = staffNeeded × 3000 ₺/ay × 5 ay (mütevazı sabit gider)
        adminOperating += safeNum(unit.staffNeeded) * 3_000 * SEMESTER_MONTHS;
      });
    }
  } else if (state.admin && state.admin.units) {
    // Eski fallback: birim bütçeleri
    Object.values(state.admin.units).forEach(unit => {
      salariesAdmin += safeNum(unit.budget);
    });
  } else {
    // Son fallback: akademik maaşların oranı
    salariesAdmin = salariesAcademic * ADMIN_SALARY_RATIO;
  }

  // ── 3. YARI ZAMANLI ÜCRETLER ─────────────────────────────────────────────────
  // Her açık bölüm için teorik ders sayısı üzerinden tahmin
  // (faculty.js entegrasyonuna kadar bölüm başı sabit)
  let partTime = 0;

  state.departments.forEach(dept => {
    if (!dept.isOpen) return;
    // Faculty objects may use f.department or f.departmentId
    const deptFacultyCount = state.faculty.filter(f => (f.departmentId || f.department) === dept.id).length;
    const studentCount     = safeNum(dept.enrolledStudents);

    // Öğrenci sayısı hocanın kapasitesini aşıyorsa yarı zamanlı ihtiyacı var
    const hoursNeeded       = Math.max(0, studentCount / 30 - deptFacultyCount);   // ~30 öğrenci/hoca
    const coursesNeeded     = Math.ceil(hoursNeeded);
    partTime += coursesNeeded * PART_TIME_COST_PER_COURSE;
  });

  // ── 4. ALTYAPI BAKIMI ───────────────────────────────────────────────────────
  // Yeni model: alan (m²) × maintenanceCostPerM2 (dönem başına)
  // Geriye dönük uyumluluk: eski model yapım maliyeti × maintenanceCostRatio
  let maintenance = 0;

  state.buildings.forEach(building => {
    if (!building.isCompleted) return;   // yapım aşamasındakiler bakım ödemez

    const template = BUILDINGS[building.type];
    if (!template) return;

    let semesterMaintenance;

    if (template.maintenanceCostPerM2 != null && building.area) {
      // Yeni alan bazlı model
      semesterMaintenance = safeNum(building.area) * safeNum(template.maintenanceCostPerM2);
    } else if (building.maintenanceCost) {
      // instance'a kaydedilmiş değer
      semesterMaintenance = safeNum(building.maintenanceCost);
    } else {
      // Eski model: yapım maliyeti × oran / 2 (yılda 2 dönem)
      const cost  = safeNum(template.constructionCost || template.baseCost);
      const ratio = safeNum(template.maintenanceCostRatio || 0.05);
      semesterMaintenance = (cost * ratio) / 2;
    }

    // Kalite düşükse bakım artar
    const qualityScore      = safeNum(building.condition || 80);
    const qualityMultiplier = 1 + (1 - qualityScore / 100) * MAINTENANCE_QUALITY_SCALE;

    maintenance += semesterMaintenance * qualityMultiplier;
  });

  // Bina yoksa bile bölüm işletme maliyetlerini ekle
  state.departments.forEach(dept => {
    if (!dept.isOpen) return;
    // Yıllık işletme maliyetinin dönem payı
    maintenance += safeNum(dept.annualOperatingCost) / 2;
  });

  // ── 5. BURS ÖDEMELERİ ──────────────────────────────────────────────────────
  // Yeni sistem: tam burslu öğrenci sayısı × dönemlik harç (üniversite üstlenir)
  // Yarı burslu için de üniversitenin karşıladığı fark hesaplanır.
  const scholarships = _calculateNewScholarshipCost(state);

  // ── 6. ARAŞTIRMA YATIRIMI ───────────────────────────────────────────────────
  // Oyuncunun budgetAllocation.research oranına göre tahsis edilen araştırma fonu
  const researchAllocationRate  = state.university.budgetAllocation.research || 0.20;
  // Dönem harcanacak araştırma bütçesi (toplam mevcut bütçenin oranı değil, gider kalemine dahil)
  // Bölümlerin aktif araştırma bütçelerini topla
  let researchInvestment = 0;

  state.departments.forEach(dept => {
    researchInvestment += safeNum(dept.activeResearchBudget);
  });

  // ── 7. İNŞAAT GİDERİ ────────────────────────────────────────────────────────
  // Devam eden inşaatların dönem maliyeti: toplam maliyet / inşaat süresi
  let construction = 0;

  // İnşaat maliyeti peşin alındığı için dönemlik ek gider yoktur.
  // Bu blok geriye dönük uyumluluk için korunmaktadır (paidAmount modeli).
  state.buildings.forEach(building => {
    const inProgress = building.underConstruction ||
      (building.status === 'under_construction' || building.status === 'upgrading');
    if (inProgress && building.paidAmount != null) {
      const template = BUILDINGS[building.type];
      if (!template) return;
      const remainingTurns = Math.max(1, building.turnsRemaining || 1);
      const paidSoFar = building.paidAmount || 0;
      const baseCost  = template.constructionCost || template.baseCost || 0;
      const remaining = baseCost - paidSoFar;
      if (remaining > 0) construction += remaining / remainingTurns;
    }
  });

  // ── 8. GENEL GİDERLER ───────────────────────────────────────────────────────
  // Enerji, su, temizlik vb.; öğrenci sayısına orantılı + sabit
  const overhead = OVERHEAD_FIXED + safeNum(state.students.totalEnrolled) * OVERHEAD_PER_STUDENT;

  // ── TOPLAM ──────────────────────────────────────────────────────────────────
  const rawExpTotal = salariesAcademic + salariesAdmin + (adminOperating || 0) + partTime + maintenance
    + scholarships + researchInvestment + construction + overhead;
  const total = isFinite(rawExpTotal) ? rawExpTotal : 0;

  return {
    salariesAcademic:   Math.round(salariesAcademic),
    salariesAdmin:      Math.round(salariesAdmin),
    adminOperating:     Math.round(adminOperating || 0),
    partTime:           Math.round(partTime),
    maintenance:        Math.round(maintenance),
    scholarships:       Math.round(scholarships),
    researchInvestment: Math.round(researchInvestment),
    construction:       Math.round(construction),
    overhead:           Math.round(overhead),
    total:              Math.round(total),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// applyBudget — Gelir-gider farkını bütçeye uygula
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dönem net nakit akışını bütçeye yansıtır.
 * Borç aşamalarını kontrol eder, faiz uygular, iflas tetikleyebilir.
 *
 * @param {object} state     — Oyun state'i (doğrudan değiştirilir)
 * @param {object} income    — calculateIncome() çıktısı
 * @param {object} expenses  — calculateExpenses() çıktısı
 * @returns {{
 *   netCashFlow: number,
 *   newBudget: number,
 *   debtStage: number,
 *   interestApplied: number,
 *   warnings: string[],
 *   bankrupt: boolean
 * }}
 */
export function applyBudget(state, income, expenses) {
  const safeIncome   = safeNum(income.total);
  const safeExpenses = safeNum(expenses.total);
  const netCashFlow  = safeIncome - safeExpenses;
  const warnings    = [];
  let interestApplied = 0;
  let bankrupt        = false;

  // Guard against NaN budget (can be corrupted if prestige went NaN)
  if (!isFinite(state.university.budget) || isNaN(state.university.budget)) {
    console.warn('[economy] Bütçe NaN/Infinity oldu; son bilinen değere geri alınıyor.');
    state.university.budget = safeNum(state._lastGoodBudget) || 0;
  }

  // Son bilinen iyi bütçeyi kaydet (düzeltme için kullanılır)
  state._lastGoodBudget = state.university.budget;

  // Bütçeye uygula
  state.university.budget += netCashFlow;

  // Uygulama sonrası NaN kontrolü
  if (!isFinite(state.university.budget) || isNaN(state.university.budget)) {
    console.error('[economy] applyBudget sonrası bütçe NaN oldu! netCashFlow:', netCashFlow, 'income:', safeIncome, 'expenses:', safeExpenses);
    state.university.budget = safeNum(state._lastGoodBudget) || 0;
  }

  // Borç takibi
  if (state.university.budget < 0) {
    state.university.debt = Math.abs(state.university.budget);
  } else {
    state.university.debt = 0;
  }

  const debtStage = _getDebtStage(state.university.budget);

  switch (debtStage) {
    case 0:
      // Normal: borç yok, her şey yolunda
      break;

    case 1:
      // Aşama 1 (0 ile -10M): Uyarı bildirimi
      warnings.push(
        `Mali uyarı: Bütçe ₺${Math.abs(state.university.budget).toLocaleString('tr-TR')} açıkta. ` +
        `Gelirlerinizi artırın veya giderlerinizi kısın.`
      );
      break;

    case 2:
      // Aşama 2 (-10M ile -30M): %3/dönem faiz uygulanır
      interestApplied = Math.abs(state.university.budget) * DEBT_INTEREST_STAGE2;
      state.university.budget -= interestApplied;
      state.university.debt    = Math.abs(state.university.budget);
      warnings.push(
        `Borç faizi: ₺${Math.round(interestApplied).toLocaleString('tr-TR')} faiz eklendi. ` +
        `Toplam borç: ₺${state.university.debt.toLocaleString('tr-TR')}.`
      );
      break;

    case 3:
      // Aşama 3 (-30M ile -60M): YÖK denetimi + %5 faiz + harcama kısıtı
      interestApplied = Math.abs(state.university.budget) * DEBT_INTEREST_STAGE3;
      state.university.budget -= interestApplied;
      state.university.debt    = Math.abs(state.university.budget);
      warnings.push(
        `YÖK denetimi başladı! Borç ₺${state.university.debt.toLocaleString('tr-TR')}. ` +
        `Faiz: ₺${Math.round(interestApplied).toLocaleString('tr-TR')}. ` +
        `Yeni hoca işe alımı ve bina inşaatı donduruldu.`
      );
      // Kısıt bayrağını state'e işle (game.js/UI bu bayrağı okur)
      if (!state._internal) state._internal = {};
      state._internal.spendingRestricted = true;
      break;

    case 4:
      // Aşama 4 (-60M altı): İflas tetikle
      bankrupt = true;
      warnings.push(
        `İFLAS: Bütçe ₺60M sınırının altına düştü! ` +
        `Üniversite kapatılma sürecine girdi.`
      );
      if (!state._internal) state._internal = {};
      state._internal.bankruptcyTriggered = true;
      break;
  }

  // Aşama 3 kısıtı kalkması: borç azalırsa kilidi aç
  if (debtStage < 3 && state._internal && state._internal.spendingRestricted) {
    state._internal.spendingRestricted = false;
  }

  return {
    netCashFlow:     Math.round(netCashFlow),
    newBudget:       Math.round(state.university.budget),
    debtStage,
    interestApplied: Math.round(interestApplied),
    warnings,
    bankrupt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getFinancialReport — Dönem mali raporu (UI için)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dönem sonunda UI'a sunulmak üzere kapsamlı mali rapor üretir.
 *
 * @param {object} state    — Oyun state'i
 * @param {object} income   — calculateIncome() çıktısı
 * @param {object} expenses — calculateExpenses() çıktısı
 * @param {object} budgetResult — applyBudget() çıktısı
 * @returns {object} Mali rapor objesi
 */
export function getFinancialReport(state, income, expenses, budgetResult) {
  const totalStudents = Math.max(1, state.students.totalEnrolled);
  const netProfit     = income.total - expenses.total;
  const profitMargin  = income.total > 0
    ? ((netProfit / income.total) * 100).toFixed(1)
    : '0.0';

  // Önceki dönem verileri (stats.history'den)
  const history      = state.stats.history;
  const prevTurn     = history.length >= 2 ? history[history.length - 2] : null;
  const prevBudget   = prevTurn ? prevTurn.budget : state.university.budget;
  const prevStudents = prevTurn ? prevTurn.totalStudents : totalStudents;

  // Kişi başı hesaplamalar
  const revenuePerStudent  = Math.round(income.total   / totalStudents);
  const expensePerStudent  = Math.round(expenses.total / totalStudents);

  // Gelir karşılaştırması (önceki döneme göre değişim)
  const budgetChange       = state.university.budget - prevBudget;
  const studentChange      = totalStudents - prevStudents;

  // Gelir kalemleri yüzdeleri (UI için)
  const incomeBreakdown = income.total > 0 ? {
    tuitionPct:          ((income.tuition          / income.total) * 100).toFixed(1),
    stateGrantPct:       ((income.stateGrant       / income.total) * 100).toFixed(1),
    researchPct:         ((income.researchFunds    / income.total) * 100).toFixed(1),
    projectOverheadPct:  ((income.projectOverhead  / income.total) * 100).toFixed(1),
    patentRoyaltiesPct:  ((income.patentRoyalties  / income.total) * 100).toFixed(1),
    revolvingPct:        ((income.revolving        / income.total) * 100).toFixed(1),
    donationsPct:        ((income.donations        / income.total) * 100).toFixed(1),
    sponsorshipPct:      ((income.sponsorship      / income.total) * 100).toFixed(1),
    patentsPct:          ((income.patents          / income.total) * 100).toFixed(1),
  } : {};

  // Gider kalemleri yüzdeleri
  const expenseBreakdown = expenses.total > 0 ? {
    academicSalaryPct:  ((expenses.salariesAcademic   / expenses.total) * 100).toFixed(1),
    adminSalaryPct:     ((expenses.salariesAdmin       / expenses.total) * 100).toFixed(1),
    partTimePct:        ((expenses.partTime            / expenses.total) * 100).toFixed(1),
    maintenancePct:     ((expenses.maintenance         / expenses.total) * 100).toFixed(1),
    scholarshipsPct:    ((expenses.scholarships        / expenses.total) * 100).toFixed(1),
    researchPct:        ((expenses.researchInvestment  / expenses.total) * 100).toFixed(1),
    constructionPct:    ((expenses.construction        / expenses.total) * 100).toFixed(1),
    overheadPct:        ((expenses.overhead            / expenses.total) * 100).toFixed(1),
  } : {};

  // Borç aşaması açıklaması
  const debtStageLabels = {
    0: 'Sağlıklı',
    1: 'Uyarı Aşaması',
    2: 'Borç Faizi Uygulanıyor',
    3: 'YÖK Denetimi / Kısıt',
    4: 'İflas Eşiği',
  };

  return {
    // Dönem kimliği
    turn:     state.meta.turn,
    year:     state.meta.year,
    semester: state.meta.semester,

    // Özet
    totalIncome:   income.total,
    totalExpenses: expenses.total,
    netProfit:     Math.round(netProfit),
    profitMargin:  `${profitMargin}%`,
    currentBudget: Math.round(state.university.budget),
    currentDebt:   Math.round(state.university.debt),

    // Borç durumu
    debtStage:      budgetResult.debtStage,
    debtStageLabel: debtStageLabels[budgetResult.debtStage] || 'Bilinmiyor',
    interestApplied: budgetResult.interestApplied,
    warnings:        budgetResult.warnings,

    // Detay — gelir
    income,
    incomeBreakdown,

    // Detay — gider
    expenses,
    expenseBreakdown,

    // Önceki dönemle karşılaştırma
    comparison: {
      budgetChange,
      budgetChangePct: prevBudget !== 0
        ? ((budgetChange / Math.abs(prevBudget)) * 100).toFixed(1) + '%'
        : 'N/A',
      studentChange,
    },

    // Kişi başı metrikler
    perStudent: {
      revenue: revenuePerStudent,
      expense: expensePerStudent,
      net:     revenuePerStudent - expensePerStudent,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateTuitionEffect — Harç miktarının talep ve kaliteye etkisi
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Belirlenen harç miktarının öğrenci talebine ve algılanan kaliteye etkisini hesaplar.
 * Fiyat elastikliği prestije göre değişir: yüksek prestijli üniversiteler daha az esnektir.
 *
 * @param {number} tuitionAmount      — Dönemlik harç tutarı (₺)
 * @param {string} departmentId       — Bölüm id'si (DEPARTMENTS anahtarı)
 * @param {number} universityPrestige — 0-100 arası prestij puanı
 * @returns {{
 *   demandMultiplier: number,
 *   qualityMultiplier: number,
 *   revenuePerStudent: number
 * }}
 */
export function calculateTuitionEffect(tuitionAmount, departmentId, universityPrestige) {
  const dept         = DEPARTMENTS[departmentId];
  const baseDemand   = dept ? dept.baseStudentDemand : 1.0;
  const deptMultiplier = dept ? dept.tuitionMultiplier : 1.0;

  // Referans harç (elastiklik hesaplama baz noktası)
  const referencePrice = TUITION_REFERENCE_VAKIF * deptMultiplier;

  // Fiyat değişim oranı: (gerçek fiyat - referans) / referans
  const priceChangePct = (tuitionAmount - referencePrice) / referencePrice;

  // Elastiklik: düşük prestij → daha duyarlı, yüksek prestij → daha az duyarlı
  let elasticity;
  if (universityPrestige >= 70) {
    elasticity = ELASTICITY_BASE_LOW;      // -0.5 (az duyarlı)
  } else if (universityPrestige >= 40) {
    elasticity = ELASTICITY_BASE_MED;      // -1.0
  } else {
    elasticity = ELASTICITY_BASE_HIGH;     // -1.5 (çok duyarlı)
  }

  // Talep çarpanı: 1 + elastiklik × fiyat değişim oranı
  // Örnek: prestij 30, %50 zam → 1 + (-1.5 × 0.5) = 0.25 (talep çöker)
  const demandMultiplier = Math.max(0.1, 1 + elasticity * priceChangePct);

  // Kalite algısı: çok ucuz bölüm kalitesiz algılanır (Veblen etkisi tersine işler)
  // Harç referansın %30 altındaysa kalite algısı düşer
  let qualityMultiplier = 1.0;
  if (tuitionAmount < referencePrice * 0.7) {
    qualityMultiplier = 0.85;   // ucuz = düşük kalite algısı
  } else if (tuitionAmount > referencePrice * 1.5) {
    qualityMultiplier = 1.10;   // pahalı = yüksek kalite algısı (Veblen)
  }

  // Öğrenci başına efektif gelir (harç × talep çarpanı baz ölçekli)
  const revenuePerStudent = Math.round(tuitionAmount * demandMultiplier);

  return {
    demandMultiplier:  Math.round(demandMultiplier * 1000) / 1000,
    qualityMultiplier: Math.round(qualityMultiplier * 1000) / 1000,
    revenuePerStudent,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateScholarshipCost — Eski API (uyumluluk için)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @deprecated Yeni sistem _calculateNewScholarshipCost kullanır.
 * Geriye dönük uyumluluk için korunmaktadır.
 */
export function calculateScholarshipCost(policy, cohorts, budgetRatio = 0.05, state = null) {
  if (state) return _calculateNewScholarshipCost(state);
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// _calculateNewScholarshipCost — Yeni burs maliyet hesabı
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tam burslu öğrencilerin harç maliyetini + yarı burslu farkı hesaplar.
 * Üniversite bu tutarı karşılar (gelir değil, gider).
 *
 * @param {object} state
 * @returns {number}
 */
function _calculateNewScholarshipCost(state) {
  const baseTuition  = safeNum(state.university?.tuitionPerSemester || 65_000);
  const uniType      = state.meta?.universityType || 'vakif';
  const byDepartment = state.students?.byDepartment || {};
  let cost = 0;

  state.departments?.forEach(dept => {
    if (!dept.isOpen) return;
    const deptData = byDepartment[dept.id];
    if (!deptData) return;

    const deptMultiplier = safeNum(uniType === 'vakif'
      ? (dept.tuitionMultiplier || 1.0)
      : 1.0);

    for (const yr of [deptData.year1, deptData.year2, deptData.year3, deptData.year4]) {
      if (!yr || !yr.count) continue;
      // Tam burslu → üniversite tam harç öder
      cost += safeNum(yr.tamBurslu)  * baseTuition * deptMultiplier * 1.0;
      // Yarı burslu → üniversite %50 öder
      const halfRate = uniType === 'devlet' ? 0.25 : 0.50;
      cost += safeNum(yr.yariBurslu) * baseTuition * deptMultiplier * halfRate;
    }
  });

  // Eski kohort sistemi fallback
  if (Object.keys(byDepartment).length === 0 && state.students?.cohorts?.length > 0) {
    const policy = state.students.scholarshipPolicy || 'merit';
    const amount = _getScholarshipAmount(policy);
    state.students.cohorts.forEach(c => {
      cost += Math.floor(safeNum(c.count) * safeNum(c.scholarshipRate || 0.10)) * amount;
    });
  }

  const rounded = Math.round(cost);
  return isFinite(rounded) ? rounded : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateEconomy — Tek çağrı sarmalayıcı (game.js entegrasyonu için)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gelir, gider ve bütçe uygulamasını tek seferde çalıştırır.
 * game.js'deki TODO yorum satırının tam karşılığıdır.
 *
 * @param {object} state — Oyun state'i (doğrudan değiştirilir)
 * @returns {{
 *   income: object,
 *   expenses: object,
 *   budget: object,
 *   report: object,
 *   netCashFlow: number
 * }}
 */
export function calculateEconomy(state) {
  const income      = calculateIncome(state);
  const expenses    = calculateExpenses(state);
  const budget      = applyBudget(state, income, expenses);
  const report      = getFinancialReport(state, income, expenses, budget);

  return {
    income,
    expenses,
    budget,
    report,
    netCashFlow: budget.netCashFlow,
  };
}
