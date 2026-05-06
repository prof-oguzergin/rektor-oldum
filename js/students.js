/**
 * Rektör Oldum — Öğrenci Sistemi v2 (students.js)
 * YKS sıralama, kontenjan, sınıf yılı, yatay geçiş, başarı bursu.
 */

import {
  DEPARTMENTS,
  STUDENT_NAME_POOL,
  TURNS_PER_YEAR,
  ADMIN_UNITS,
} from './data.js?v=0.4.24';

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCILAR
// ─────────────────────────────────────────────────────────────────────────────

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(val, min = 0, max = 100) {
  return Math.max(min, Math.min(max, val));
}

function randomName() {
  const pool   = STUDENT_NAME_POOL;
  const isMale = Math.random() < 0.5;
  const first  = isMale
    ? pool.male[randInt(0, pool.male.length - 1)]
    : pool.female[randInt(0, pool.female.length - 1)];
  const last   = pool.surname[randInt(0, pool.surname.length - 1)];
  return `${first} ${last}`;
}

function getDeptTemplate(departmentId) {
  return DEPARTMENTS[departmentId] || null;
}

let _starStudentCounter = 1;
function nextStarId() {
  return `star_${Date.now()}_${_starStudentCounter++}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// YKS SIRALAMASI — Burs türüne ve prestije göre öğrenci kalitesi
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Burs türüne, üniversite prestijine ve bölüm talebine göre YKS sıralaması üret.
 * Daha düşük sıralama = daha iyi öğrenci (gerçek Türkiye modeli).
 *
 * @param {'tam_burslu'|'yari_burslu'|'ucretli'} scholarshipType
 * @param {number} prestige — 0-100
 * @param {number} deptDemand — bölüm talep çarpanı (1.0 = ortalama)
 * @returns {number} YKS sıralaması
 */
export function generateYKSRanking(scholarshipType, prestige, deptDemand = 1.0) {
  // Prestij arttıkça daha iyi öğrenciler çekilir (daha düşük sıralama)
  const prestigeFactor = 1 - (prestige / 100) * 0.6;  // 0.40 - 1.0 çarpanı
  // Talep yüksek bölümlerde (CS gibi) daha iyi öğrenciler gelir
  const demandFactor = 1 / Math.max(0.5, deptDemand);

  let baseMin, baseMax;
  switch (scholarshipType) {
    case 'tam_burslu':
      baseMin = 500;
      baseMax = 20_000;
      break;
    case 'yari_burslu':
      baseMin = 10_000;
      baseMax = 60_000;
      break;
    case 'ucretli':
    default:
      baseMin = 25_000;
      baseMax = 200_000;
      break;
  }

  const adjustedMin = Math.round(baseMin * prestigeFactor * demandFactor);
  const adjustedMax = Math.round(baseMax * prestigeFactor * demandFactor);
  // En az 1000 olsun
  const min = Math.max(500, adjustedMin);
  const max = Math.max(min + 1000, adjustedMax);

  return randInt(min, max);
}

// ─────────────────────────────────────────────────────────────────────────────
// generateInitialStudentsByDept — Başlangıç öğrenci dağılımı (bölüm+sınıf bazlı)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Oyun başlangıcında her bölüm için 4 sınıf öğrenci oluşturur.
 *
 * @param {object[]} departments — Bölüm listesi
 * @param {string} universityType — 'devlet' | 'vakif'
 * @param {number} totalStudents — Toplam hedef öğrenci sayısı
 * @param {number} prestige — Başlangıç prestij
 * @returns {object} state.students yapısı
 */
export function generateInitialStudents(departments, universityType, totalStudents, prestige) {
  const byDepartment = {};
  const quotas       = {};
  const starStudents = [];

  const deptCount  = departments.length;
  if (deptCount === 0) {
    return {
      byDepartment: {},
      quotas: {},
      starStudents: [],
      overallSatisfaction: 60,
      totalEnrolled: 0,
    };
  }

  // Her bölüme eşit dağıt (basit başlangıç)
  const perDept = Math.floor(totalStudents / deptCount);

  departments.forEach((dept, idx) => {
    const deptId     = dept.id;
    const deptTempl  = getDeptTemplate(deptId);
    const demand     = deptTempl?.baseStudentDemand ?? 1.0;

    // Varsayılan kontenjan (4 sınıfa dağıtılmış)
    // Yeni alım: perDept ÷ 4 per sınıf yaklaşık
    const perYear = Math.max(5, Math.floor(perDept / 4));

    // 4 sınıf oluştur (sınıf 1 en az — sonraki yıllarda bırakanlar oldu)
    const yr4 = Math.max(1, Math.floor(perYear * 0.80));
    const yr3 = Math.max(1, Math.floor(perYear * 0.88));
    const yr2 = Math.max(1, Math.floor(perYear * 0.94));
    const yr1 = perYear;

    // Başlangıç burs dağılımı (yaklaşık)
    function makeBurslu(count, prestige) {
      const tamPct  = 0.15;
      const yariPct = 0.20;
      return {
        tamBurslu:   Math.round(count * tamPct),
        yariBurslu:  Math.round(count * yariPct),
        ucretli:     count - Math.round(count * tamPct) - Math.round(count * yariPct),
      };
    }

    function makeYearData(count, year, prestige, demand) {
      const burslu = makeBurslu(count, prestige);
      const avgYKS = Math.round(
        (generateYKSRanking('tam_burslu', prestige, demand) * burslu.tamBurslu +
         generateYKSRanking('yari_burslu', prestige, demand) * burslu.yariBurslu +
         generateYKSRanking('ucretli', prestige, demand) * burslu.ucretli) / Math.max(1, count)
      );
      // YKS bazlı taban GPA (geniş varyans — gerçekçi başlangıç)
      function yksToBaseGPA(yks) {
        if (yks < 5000)   return 3.4 + Math.random() * 0.4;   // 3.4–3.8
        if (yks < 15000)  return 3.1 + Math.random() * 0.5;   // 3.1–3.6
        if (yks < 30000)  return 2.8 + Math.random() * 0.5;   // 2.8–3.3
        if (yks < 60000)  return 2.5 + Math.random() * 0.5;   // 2.5–3.0
        if (yks < 100000) return 2.2 + Math.random() * 0.5;   // 2.2–2.7
        return 1.8 + Math.random() * 0.6;                      // 1.8–2.4
      }
      // Yıl olgunluk düzeltmesi: üst sınıflar hafif daha iyi (zayıflar ayrıldı)
      const yearOffset = { 1: 0, 2: 0.05, 3: 0.10, 4: 0.15 };
      // Burs dağılımına göre ücretli oranı
      const totalBurs = burslu.tamBurslu + burslu.yariBurslu + burslu.ucretli;
      const ucRatio   = totalBurs > 0 ? burslu.ucretli / totalBurs : 0.65;
      const bursAdj   = ucRatio > 0.5 ? -0.1 + Math.random() * 0.3 : 0.05 + Math.random() * 0.05;

      const baseGPA = Math.min(4.0, yksToBaseGPA(avgYKS) + (yearOffset[year] || 0) + bursAdj);
      return {
        count,
        avgYKS,
        avgGPA: parseFloat(Math.min(4.0, Math.max(1.5, baseGPA)).toFixed(2)),
        satisfaction: randInt(55, 72),
        ...burslu,
      };
    }

    byDepartment[deptId] = {
      year1: makeYearData(yr1, 1, prestige, demand),
      year2: makeYearData(yr2, 2, prestige, demand),
      year3: makeYearData(yr3, 3, prestige, demand),
      year4: makeYearData(yr4, 4, prestige, demand),
      get totalStudents() {
        return this.year1.count + this.year2.count + this.year3.count + this.year4.count;
      },
    };

    // Başlangıç kontenjan
    quotas[deptId] = {
      tamBurslu:  Math.round(yr1 * 0.15),
      yariBurslu: Math.round(yr1 * 0.20),
      ucretli:    yr1 - Math.round(yr1 * 0.15) - Math.round(yr1 * 0.20),
    };
  });

  return {
    byDepartment,
    quotas,
    starStudents,
    overallSatisfaction: 65,
    totalEnrolled: Object.values(byDepartment).reduce((s, d) =>
      s + d.year1.count + d.year2.count + d.year3.count + d.year4.count, 0),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getTotalEnrolled — Toplam öğrenci sayısını hesapla
// ─────────────────────────────────────────────────────────────────────────────

export function getTotalEnrolled(state) {
  const byDept = state.students?.byDepartment || {};
  let total = 0;
  for (const dept of Object.values(byDept)) {
    total += (dept.year1?.count ?? 0) + (dept.year2?.count ?? 0) +
             (dept.year3?.count ?? 0) + (dept.year4?.count ?? 0);
  }
  return total;
}

// ─────────────────────────────────────────────────────────────────────────────
// generateStarStudent — Yıldız öğrenci kartı oluştur
// ─────────────────────────────────────────────────────────────────────────────

export function generateStarStudent(departmentId, universityPrestige) {
  const dept     = getDeptTemplate(departmentId);
  const category = dept ? dept.category : 'muhendislik';

  const typeWeights = {
    muhendislik: ['akademik_dahi', 'girisimci', 'polymath', 'sessiz_deha'],
    temel_bilim: ['akademik_dahi', 'polymath', 'sessiz_deha', 'lider'],
    sosyal:      ['girisimci', 'lider', 'sanatci', 'charismatik'],
    saglik:      ['akademik_dahi', 'lider', 'sessiz_deha', 'polymath'],
  };
  const typePools = typeWeights[category] || ['akademik_dahi', 'girisimci', 'sporcu', 'sanatci', 'lider', 'polymath', 'sessiz_deha'];
  const ALL_TYPES = ['akademik_dahi', 'girisimci', 'sporcu', 'sanatci', 'lider', 'polymath', 'sessiz_deha'];
  const useGeneral = Math.random() < 0.30;
  const pool       = useGeneral ? ALL_TYPES : typePools;
  const type       = pool[randInt(0, pool.length - 1)];

  const baseStats = { academic: 50, creativity: 50, leadership: 50, sport: 50, art: 50, charisma: 50 };
  const boosts    = {
    akademik_dahi: { academic: 35, creativity: 10 },
    girisimci:     { creativity: 25, leadership: 20, charisma: 10 },
    sporcu:        { sport: 40, leadership: 10, charisma: 10 },
    sanatci:       { art: 40, creativity: 20 },
    lider:         { leadership: 35, charisma: 25 },
    polymath:      { academic: 15, creativity: 15, leadership: 10 },
    sessiz_deha:   { academic: 30, creativity: 20 },
  };

  const stats  = { ...baseStats };
  const boost  = boosts[type] || {};
  Object.keys(boost).forEach(key => { stats[key] = clamp(stats[key] + boost[key] + randInt(-10, 10)); });
  Object.keys(stats).forEach(key => { if (!boost[key]) stats[key] = clamp(stats[key] + randInt(-15, 15)); });

  // Yıldız öğrenciler bireysel olarak üstün: en az 3.5 GPA garantili
  const gpa = parseFloat(clamp(
    3.5 + (stats.academic / 100) * 0.5 + randBetween(-0.05, 0.1),
    3.5, 4.0
  ).toFixed(2));

  const scholarshipType = stats.academic >= 80 ? 'tam_burslu'
    : stats.academic >= 65 ? 'yari_burslu' : 'ucretli';

  const yksRanking = generateYKSRanking(scholarshipType, universityPrestige, 1.0);

  const maxStat = Math.max(...Object.values(stats));
  let potentialAlumniImpact;
  if (maxStat >= 90)      potentialAlumniImpact = 5;
  else if (maxStat >= 80) potentialAlumniImpact = 4;
  else if (maxStat >= 70) potentialAlumniImpact = 3;
  else if (maxStat >= 60) potentialAlumniImpact = 2;
  else                    potentialAlumniImpact = 1;

  return {
    id:                   nextStarId(),
    name:                 randomName(),
    department:           departmentId,
    type,
    year:                 1,
    yksRanking,
    scholarshipType,
    stats,
    gpa,
    events:               [],
    potentialAlumniImpact,
    enrollmentYear:       null,  // initGame / processAdmissions tarafından doldurulur
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// discoverStarStudents — Bölüm öğrencileri arasından yıldız keşfi
// ─────────────────────────────────────────────────────────────────────────────

export function discoverStarStudents(state) {
  const discovered = [];
  const prestige   = state.university.prestige;

  const avgEdQuality = state.departments.length > 0
    ? state.departments.reduce((s, d) => s + (d.educationQuality || 50), 0) / state.departments.length
    : 50;

  const baseDiscoveryChance = 0.05 + (prestige / 100) * 0.10 + (avgEdQuality / 100) * 0.10;

  state.departments.forEach(dept => {
    if (!dept.isOpen) return;

    const deptData = state.students.byDepartment[dept.id];
    if (!deptData) return;

    const totalDeptStudents = (deptData.year1?.count ?? 0) + (deptData.year2?.count ?? 0) +
                              (deptData.year3?.count ?? 0) + (deptData.year4?.count ?? 0);
    if (totalDeptStudents === 0) return;

    const roll = Math.random();
    let starCount = 0;
    if (roll < baseDiscoveryChance * 0.4) starCount = 2;
    else if (roll < baseDiscoveryChance)  starCount = 1;

    for (let i = 0; i < starCount; i++) {
      const star = generateStarStudent(dept.id, prestige);
      star.enrollmentYear = state.meta.year;
      state.students.starStudents.push(star);
      discovered.push(star);
    }
  });

  return discovered;
}

// ─────────────────────────────────────────────────────────────────────────────
// updateStudentYears — Dönem sonu GPA, memnuniyet, bırakma güncelle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Her bölüm her sınıf için GPA, memnuniyet ve bırakma hesapla.
 * Bahar sonunda çağrıldığında sınıf ilerlemesi de yapılır.
 *
 * @param {object} state
 * @param {boolean} advanceYears — true ise yıl ilerle (bahar sonunda)
 * @returns {object} güncelleme özeti
 */
export function updateStudentYears(state, advanceYears = false) {
  const summary = { updatedDepts: 0, dropouts: 0, repeatYear: 0 };

  state.departments.forEach(dept => {
    if (!dept.isOpen) return;

    const deptData = state.students.byDepartment[dept.id];
    if (!deptData) return;

    const deptFaculty = state.faculty.filter(f => (f.departmentId || f.department) === dept.id);
    const avgTeaching = deptFaculty.length > 0
      ? deptFaculty.reduce((s, f) => s + (f.stats?.teaching || f.teachingScore || 50), 0) / deptFaculty.length
      : 50;

    const totalInDept = (deptData.year1?.count ?? 0) + (deptData.year2?.count ?? 0) +
                        (deptData.year3?.count ?? 0) + (deptData.year4?.count ?? 0);
    const capacity    = dept.studentCapacity || 100;
    const fillRatio   = capacity > 0 ? totalInDept / capacity : 1;
    const sizeMult    = fillRatio <= 0.70 ? 1.0
                      : fillRatio <= 0.90 ? 0.95
                      : fillRatio <= 1.00 ? 0.88
                      : 0.78;

    // Her sınıf katmanı güncelle
    for (const yearKey of ['year1', 'year2', 'year3', 'year4']) {
      const yr = deptData[yearKey];
      if (!yr || yr.count <= 0) continue;

      // YKS bazlı taban GPA (kohort potansiyeli — belirsizlik geniş)
      const yks = yr.avgYKS || 50000;
      let baseGPA;
      if      (yks < 5000)   baseGPA = 3.4 + Math.random() * 0.4;   // 3.4–3.8
      else if (yks < 15000)  baseGPA = 3.1 + Math.random() * 0.5;   // 3.1–3.6
      else if (yks < 30000)  baseGPA = 2.8 + Math.random() * 0.5;   // 2.8–3.3
      else if (yks < 60000)  baseGPA = 2.5 + Math.random() * 0.5;   // 2.5–3.0
      else if (yks < 100000) baseGPA = 2.2 + Math.random() * 0.5;   // 2.2–2.7
      else                   baseGPA = 1.8 + Math.random() * 0.6;   // 1.8–2.4

      // Burs türü etkisi: tam burslu hafif avantajlı, ücretli daha geniş varyans
      const totalInYear  = (yr.tamBurslu || 0) + (yr.yariBurslu || 0) + (yr.ucretli || 0);
      const ucretliRatio = totalInYear > 0 ? (yr.ucretli || 0) / totalInYear : 0.65;
      // Ücretli kohortlar: bazıları çok çalışır, bazıları çalışmaz → -0.1 ile +0.2 arasında
      const bursBonus = ucretliRatio > 0.5
        ? -0.1 + Math.random() * 0.3       // ağırlıklı ücretli → daha geniş varyans
        : 0.05 + Math.random() * 0.05;     // ağırlıklı burslu → hafif üstün

      // Öğretim kalitesi bonusu: iyi öğretim GPA'yı ciddi etkiler (±0.15)
      const teachingBonus = ((avgTeaching || 60) - 60) / 200; // –0.15 ile +0.20 arası

      // Memnuniyet bonusu: mutlu öğrenci daha iyi çalışır (±0.10)
      const satBonus = ((yr.satisfaction ?? 60) - 60) / 300;  // –0.10 ile +0.13 arası

      // Sınıf yılı olgunluk etkisi: üst sınıflar hafif daha yüksek GPA (zayıflar bıraktı)
      const yearKey2 = yearKey; // 'year1'..'year4'
      const yearNum  = yearKey2 === 'year1' ? 1 : yearKey2 === 'year2' ? 2 : yearKey2 === 'year3' ? 3 : 4;
      const yearBonus = (yearNum - 1) * 0.05;  // +0.00, +0.05, +0.10, +0.15

      // Sınıf kalabalığı düzeltmesi
      const sizeAdjust = (sizeMult - 1.0) * 0.2;  // 0.78→-0.044, 1.0→0

      const rawGPA = baseGPA + bursBonus + teachingBonus + satBonus + yearBonus + sizeAdjust;

      if (yr.avgGPA === 0) {
        yr.avgGPA = parseFloat(clamp(rawGPA, 1.5, 4.0).toFixed(2));
      } else {
        yr.avgGPA = parseFloat(clamp(yr.avgGPA * 0.70 + rawGPA * 0.30, 1.5, 4.0).toFixed(2));
      }

      // Bırakma riski: GPA < 1.8 ise akademik başarısızlık, düşük memnuniyet de etkiler
      const dropRisk = Math.max(0, (1.8 - yr.avgGPA) * 0.015 + (50 - (yr.satisfaction ?? 60)) * 0.0008);
      const dropouts = Math.round(yr.count * dropRisk);
      yr.count = Math.max(0, yr.count - dropouts);
      summary.dropouts += dropouts;

      // Başarı bursu kontrolü (ücretli öğrenci GPA > 3.5 ise)
      if (yr.avgGPA > 3.5 && yr.ucretli > 0 && advanceYears) {
        const eligible = Math.round(yr.ucretli * 0.3);  // ücretsizlerin %30'u
        yr._meritScholarship = (yr._meritScholarship || 0) + eligible;
      }
    }

    summary.updatedDepts++;
  });

  return summary;
}

// ─────────────────────────────────────────────────────────────────────────────
// advanceYearClasses — Sınıf ilerlet (Bahar sonunda)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 4.sınıf mezun eder, diğerleri bir üst sınıfa çıkar.
 * @param {object} state
 * @returns {object} mezuniyet özeti
 */
export function advanceYearClasses(state) {
  const result = { totalGraduates: 0, newAlumni: [] };

  state.departments.forEach(dept => {
    if (!dept.isOpen) return;

    const deptData = state.students.byDepartment[dept.id];
    if (!deptData) return;

    const yr4 = deptData.year4;
    if (yr4 && yr4.count > 0) {
      // 4. sınıf mezun
      result.totalGraduates += yr4.count;
      const alumniRecord = {
        id:            `alumni_dept_${dept.id}_yr${state.meta.year}`,
        name:          null,
        departmentId:  dept.id,
        type:          'normal',
        count:         yr4.count,
        avgGPA:        yr4.avgGPA,
        potentialImpact: Math.round(yr4.avgGPA / 4.0 * 3 + 1),
        graduationYear: state.meta.year,
        donationScore:  0,
      };
      state.alumni.push(alumniRecord);
      result.newAlumni.push(alumniRecord);
    }

    // Yıl ilerlet: 3→4, 2→3, 1→2
    deptData.year4 = { ...(deptData.year3 || { count: 0, avgYKS: 50000, avgGPA: 2.5, satisfaction: 60, tamBurslu: 0, yariBurslu: 0, ucretli: 0 }) };
    deptData.year3 = { ...(deptData.year2 || { count: 0, avgYKS: 50000, avgGPA: 2.5, satisfaction: 60, tamBurslu: 0, yariBurslu: 0, ucretli: 0 }) };
    deptData.year2 = { ...(deptData.year1 || { count: 0, avgYKS: 50000, avgGPA: 2.5, satisfaction: 60, tamBurslu: 0, yariBurslu: 0, ucretli: 0 }) };
    // 1. sınıf sıfırlanır — processNewEnrollment hemen ardından dolduracak
    deptData.year1 = { count: 0, avgYKS: 0, avgGPA: 0, satisfaction: 70, tamBurslu: 0, yariBurslu: 0, ucretli: 0 };
  });

  // Bellek koruması: state.alumni budanır.
  // Korunan: yıldız mezunlar (donationScore > 0) veya 'normal' dışı tipler.
  // Geri kalan normal kohortların en yeni 20'si tutulur (~10 yıl).
  if (state.alumni && state.alumni.length > 60) {
    const protectedAlumni = state.alumni.filter(a =>
      a.donationScore > 0 || a.type !== 'normal'
    );
    const normalAlumni = state.alumni.filter(a =>
      !(a.donationScore > 0 || a.type !== 'normal')
    );
    normalAlumni.sort((a, b) => (a.graduationYear || 0) - (b.graduationYear || 0));
    const recentNormal = normalAlumni.slice(-20);
    state.alumni = [...protectedAlumni, ...recentNormal];
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// processNewEnrollment — Kontenjan bazlı yeni öğrenci kaydı (Güz)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Oyuncu tarafından belirlenen kontenjanları kullanarak 1. sınıfa öğrenci alır.
 * Yalnızca güz döneminde çağrılmalıdır.
 *
 * @param {object} state
 * @returns {object} alım özeti
 */
export function processNewEnrollment(state) {
  // Alım Bahar dönemi sonunda (advanceYearClasses'dan sonra) veya manuel çağrıyla yapılır.
  // Eski güz kontrolü kaldırıldı — çağıran kod doğru dönemde çağırmalı.

  const prestige = state.university.prestige;
  const quotas   = state.students.quotas || {};
  const summary  = { enrolled: [], totalAdmitted: 0 };

  state.departments.forEach(dept => {
    if (!dept.isOpen) return;

    const deptId   = dept.id;
    const quota    = quotas[deptId];
    if (!quota) return;

    const deptTempl  = getDeptTemplate(deptId);
    const demand     = deptTempl?.baseStudentDemand ?? 1.0;

    const tamBurslu  = quota.tamBurslu  || 0;
    const yariBurslu = quota.yariBurslu || 0;
    const ucretli    = quota.ucretli    || 0;
    const total      = tamBurslu + yariBurslu + ucretli;
    if (total === 0) return;

    // Akreditasyon YKS bonusu (dept._accreditationYKSBonus: negatif değer → daha iyi sıralama)
    const yksBonus = dept._accreditationYKSBonus || 0;

    // Ortalama YKS sıralaması (ağırlıklı)
    const sumYKS = tamBurslu  * generateYKSRanking('tam_burslu', prestige, demand)
                 + yariBurslu * generateYKSRanking('yari_burslu', prestige, demand)
                 + ucretli    * generateYKSRanking('ucretli', prestige, demand);
    // YKS bonusu uygula (negatif = sıralama iyileşir = daha yetenekli öğrenci)
    const avgYKS = Math.round(Math.max(1, sumYKS / total + yksBonus));

    // Yüksek prestijli üniversite → yıldız öğrenci şansı
    if (prestige >= 40 && Math.random() < 0.10 + prestige * 0.002) {
      const star = generateStarStudent(deptId, prestige);
      star.enrollmentYear = state.meta.year;
      state.students.starStudents.push(star);
    }

    // Defansif lazy init: byDepartment[deptId] yoksa oluştur (R-Fatih Issue #10).
    // Eski kayıtlardan açılan ve byDepartment'a hiç eklenmemiş bölümler için
    // — game.js YÖK onayı artık init ediyor, bu son güvenlik ağı.
    let deptData = state.students.byDepartment[deptId];
    if (!deptData) {
      deptData = state.students.byDepartment[deptId] = {
        year1: { count: 0, avgYKS: 0, avgGPA: 0, satisfaction: 70, tamBurslu: 0, yariBurslu: 0, ucretli: 0 },
        year2: { count: 0, avgYKS: 0, avgGPA: 0, satisfaction: 70, tamBurslu: 0, yariBurslu: 0, ucretli: 0 },
        year3: { count: 0, avgYKS: 0, avgGPA: 0, satisfaction: 70, tamBurslu: 0, yariBurslu: 0, ucretli: 0 },
        year4: { count: 0, avgYKS: 0, avgGPA: 0, satisfaction: 70, tamBurslu: 0, yariBurslu: 0, ucretli: 0 },
      };
      console.warn(`[students] byDepartment[${deptId}] eksikti, lazy init edildi (yeni bölüm açılış akışı bug'ı).`);
    }
    deptData.year1 = {
      count:       total,
      avgYKS,
      avgGPA:      0,
      satisfaction: 70,
      tamBurslu,
      yariBurslu,
      ucretli,
    };

    summary.enrolled.push({ departmentId: deptId, total, avgYKS, tamBurslu, yariBurslu, ucretli });
    summary.totalAdmitted += total;
  });

  return summary;
}

// ─────────────────────────────────────────────────────────────────────────────
// processYatayGecis — Yatay geçiş (ayrılma + gelen)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Memnuniyeti düşük öğrenciler ayrılır; prestij yüksekse öğrenci gelir.
 * @param {object} state
 * @returns {object[]} olaylar listesi
 */
export function processYatayGecis(state) {
  const events  = [];
  const prestige = state.university.prestige;

  state.departments.forEach(dept => {
    if (!dept.isOpen) return;

    const deptData = state.students.byDepartment[dept.id];
    if (!deptData) return;

    // Ayrılma: memnuniyet < 35 olan sınıflardan
    for (const yearKey of ['year2', 'year3']) {
      const yr = deptData[yearKey];
      if (!yr || yr.count <= 0) continue;

      if (yr.satisfaction < 35) {
        const leaveCount = Math.round(yr.count * 0.05 * Math.max(1, (35 - yr.satisfaction) / 10));
        if (leaveCount > 0) {
          yr.count = Math.max(0, yr.count - leaveCount);
          // burs dağılımından orantılı düş
          const total0 = yr.tamBurslu + yr.yariBurslu + yr.ucretli;
          if (total0 > 0) {
            yr.tamBurslu  = Math.max(0, yr.tamBurslu  - Math.round(leaveCount * yr.tamBurslu / total0));
            yr.yariBurslu = Math.max(0, yr.yariBurslu - Math.round(leaveCount * yr.yariBurslu / total0));
            yr.ucretli    = Math.max(0, yr.ucretli    - Math.round(leaveCount * yr.ucretli / total0));
          }
          events.push({
            type: 'yatay_gecis_giden',
            departmentId: dept.id,
            year: yearKey === 'year2' ? 2 : 3,
            count: leaveCount,
            message: `${dept.shortName} ${yearKey === 'year2' ? '2' : '3'}. sınıftan ${leaveCount} öğrenci yatay geçiş ile ayrıldı.`,
          });
        }
      }
    }

    // Gelen: prestij 55+ ise 2. veya 3. sınıfa transfer öğrencisi
    if (prestige >= 55 && Math.random() < (prestige - 50) * 0.01) {
      const targetKey = Math.random() < 0.6 ? 'year2' : 'year3';
      const yr = deptData[targetKey];
      if (yr) {
        const incoming = randInt(1, 3);
        yr.count += incoming;
        yr.ucretli += incoming;  // yatay geçiş öğrencileri ücretli sayılır
        events.push({
          type: 'yatay_gecis_gelen',
          departmentId: dept.id,
          year: targetKey === 'year2' ? 2 : 3,
          count: incoming,
          message: `${dept.shortName} bölümüne ${incoming} yatay geçiş öğrencisi kabul edildi.`,
        });
      }
    }
  });

  return events;
}

// ─────────────────────────────────────────────────────────────────────────────
// processMeritScholarship — Başarı bursu kontrolü (Bahar sonu)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GPA > 3.5 olan ücretli öğrencilere başarı bursu tanır.
 * @param {object} state
 * @returns {object} başarı bursu özeti
 */
export function processMeritScholarship(state) {
  let totalEligible = 0;
  const deptSummaries = [];

  state.departments.forEach(dept => {
    if (!dept.isOpen) return;

    const deptData = state.students.byDepartment[dept.id];
    if (!deptData) return;

    let deptEligible = 0;
    for (const yearKey of ['year1', 'year2', 'year3']) {
      const yr = deptData[yearKey];
      if (!yr || yr.count <= 0 || yr.ucretli <= 0) continue;

      if (yr.avgGPA >= 3.5) {
        const eligible = Math.round(yr.ucretli * 0.35);
        if (eligible > 0) {
          // Ücretli'den başarı burslu'ya geçirme (yarı burslu gibi sayıyoruz)
          yr.ucretli    = Math.max(0, yr.ucretli - eligible);
          yr.yariBurslu = (yr.yariBurslu || 0) + eligible;
          yr.satisfaction = Math.min(100, (yr.satisfaction || 70) + 5);
          deptEligible += eligible;
          totalEligible += eligible;
        }
      }
    }

    if (deptEligible > 0) {
      deptSummaries.push({ departmentId: dept.id, count: deptEligible });
    }
  });

  return { totalEligible, deptSummaries };
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDİMCI: İdari birim memnuniyet katkısı (0-100)
// ─────────────────────────────────────────────────────────────────────────────

function getAdminUnitScore(state, unitId) {
  const unit = state.adminUnits?.[unitId];
  if (!unit || !unit.isActive) return 30;  // birim yok veya pasif → çok düşük
  const template = ADMIN_UNITS?.[unitId];
  if (!template) return 40;

  const staffRatio  = unit.staffNeeded > 0 ? Math.min(1, unit.staffCount / unit.staffNeeded) : 0;
  const staffEffect = staffRatio * (unit.staffQuality || 0) / 100;
  const levelBonus  = template.levelBonuses[unit.level]?.satisfactionBonus || 0;
  return clamp(Math.round(30 + staffEffect * 50 + levelBonus), 0, 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateStudentSatisfaction — Öğrenci memnuniyeti
// ─────────────────────────────────────────────────────────────────────────────

export function calculateStudentSatisfaction(state) {
  const depts = state.departments || [];

  const avgEdQuality = depts.length > 0
    ? depts.reduce((s, d) => s + (d.educationQuality || 50), 0) / depts.length
    : 50;

  let totalMatchScore = 0;
  let totalAssignedCourses = 0;
  depts.forEach(d => {
    (d.courseAssignments || []).forEach(ca => {
      totalMatchScore += ca.matchQuality === 2 ? 100 : ca.matchQuality === 1 ? 60 : 30;
      totalAssignedCourses++;
    });
  });
  const expertiseMatchScore = totalAssignedCourses > 0 ? totalMatchScore / totalAssignedCourses : 50;

  let totalRequired = 0;
  let totalCovered  = 0;
  depts.forEach(d => {
    const curriculum = (d.courseAssignments || []).length + (d.uncoveredCourses || []).length;
    totalRequired += curriculum;
    totalCovered  += (d.courseAssignments || []).length;
  });
  const coverageScore = totalRequired > 0 ? (totalCovered / totalRequired) * 100 : 80;

  const avgFacultyHappiness = state.faculty.length > 0
    ? state.faculty.reduce((s, f) => s + (f.happiness || 60), 0) / state.faculty.length
    : 60;

  const egitimScore = clamp(
    avgEdQuality    * 0.45 +
    expertiseMatchScore * 0.30 +
    coverageScore   * 0.15 +
    avgFacultyHappiness * 0.10
  );

  // Bina yeterlilik skorları (kapasite bazlı)
  const completedBuildings = (state.buildings || []).filter(b => b.isCompleted);

  // Toplam öğrenci sayısını burada hesapla (aşağıda da kullanılır)
  const byDept = state.students?.byDepartment || {};
  let totalStudents = 0, totalBurslu = 0;
  for (const d of Object.values(byDept)) {
    for (const yr of [d.year1, d.year2, d.year3, d.year4]) {
      if (!yr) continue;
      totalStudents += yr.count || 0;
      totalBurslu += (yr.tamBurslu || 0) + (yr.yariBurslu || 0);
    }
  }
  const bursOrani  = totalStudents > 0 ? totalBurslu / totalStudents : 0.10;
  const bursScore  = clamp(bursOrani * 400, 20, 95);

  // Yurt yeterlilik — toplam yatak vs öğrenci
  const totalBeds    = completedBuildings.filter(b => b.type === 'yurt')
    .reduce((s, b) => s + ((b.currentCapacity?.beds) || 0), 0);
  const hasYurt      = totalBeds > 0;
  const yurtCoverage = totalStudents > 0 && totalBeds > 0
    ? Math.min(totalBeds, totalStudents) / totalStudents  // 0..1
    : 0;
  // Yurt skoru: hiç yurt yok → 30, tam kapsama → 85, fazla → 85
  const yurtScore    = !hasYurt ? 30 : clamp(30 + yurtCoverage * 55, 30, 85);

  // Yemekhane yeterlilik — günlük öğün vs öğrenci+hoca
  const totalFaculty2    = (state.faculty || []).length;
  const totalMealCap     = completedBuildings.filter(b => b.type === 'yemekhane')
    .reduce((s, b) => s + ((b.currentCapacity?.dailyMeals) || 0), 0);
  const hasYemek         = totalMealCap > 0;
  const mealDemand       = totalStudents + totalFaculty2;
  const mealRatio        = hasYemek && mealDemand > 0 ? totalMealCap / mealDemand : 0;
  // Yeterli (ratio≥1) → 70, yetersiz (%50 kapsama) → 35
  // Yemekhane yönetimi idari birim kalitesi bonusu eklenir
  const yemekhaneAdminBonus2 = state.adminUnits?.yemekhane_yonetimi
    ? Math.round((getAdminUnitScore(state, 'yemekhane_yonetimi') - 50) * 0.2)
    : 0;
  const yemekScore       = !hasYemek ? 30 : clamp(30 + Math.min(mealRatio, 1.2) * 33 + yemekhaneAdminBonus2, 30, 78);

  // Spor tesisi yeterlilik
  const totalSporCap     = completedBuildings.filter(b => b.type === 'spor_tesisi')
    .reduce((s, b) => s + ((b.currentCapacity?.dailyUsers) || 0), 0);
  const hasSport         = totalSporCap > 0;
  const sporRatio        = hasSport && totalStudents > 0 ? totalSporCap / totalStudents : 0;
  const sporScore        = !hasSport ? 38 : clamp(38 + Math.min(sporRatio, 1.2) * 28, 38, 72);

  // Kütüphane / konferans → sosyal skor
  const hasKutuphane     = completedBuildings.some(b => b.type === 'kutuphane');
  const hasKonferans     = completedBuildings.some(b => b.type === 'konferans');
  const totalLibCap      = completedBuildings.filter(b => b.type === 'kutuphane')
    .reduce((s, b) => s + ((b.currentCapacity?.daily) || 0), 0);
  const libRatio         = hasKutuphane && totalStudents > 0 ? totalLibCap / totalStudents : 0;
  // Kütüphane yeterliyse tam bonus; yetersizse kısmi
  const libBonus         = hasKutuphane ? Math.min(libRatio, 1.0) * 20 : 0;
  const konferansBonus   = hasKonferans ? 8 : 0;
  // Kütüphane hizmetleri yönetim kalitesi bonusu (idari birim varsa)
  const kutuphaneAdminBonus = state.adminUnits?.kutuphane_hizmetleri
    ? Math.round((getAdminUnitScore(state, 'kutuphane_hizmetleri') - 50) * 0.15)
    : 0;
  const sosyalScore      = clamp(42 + libBonus + konferansBonus + kutuphaneAdminBonus, 42, 75);

  // Ulaşım skoru: idari birim performansı + ulasim_merkezi binasının fiziksel etkisi
  // (Erdinç raporu: ulasim_merkezi inşa edildiği halde işlevsiz görünüyordu — bina
  //  effects'leri hesaba bağlanmamıştı.)
  const ulasimAdminScore = getAdminUnitScore(state, 'ulasim');
  const ulasimMerkeziLevels = completedBuildings
    .filter(b => b.type === 'ulasim_merkezi')
    .reduce((s, b) => s + (b.level || 1), 0);
  const ulasimMerkeziBonus = ulasimMerkeziLevels > 0
    ? Math.min(25, 12 + (ulasimMerkeziLevels - 1) * 6)
    : 0;
  const ulasimBaseScore = state.adminUnits?.ulasim ? ulasimAdminScore : 55;
  const ulasimScore = clamp(ulasimBaseScore + ulasimMerkeziBonus, 0, 100);

  // Kariyer skoru: kariyer merkezi + mezun ağı + teknokent
  const alumniCount   = state.alumni.length;
  const hasTechnopark = state.university.hasTechnoPark;
  const kariyerAdminScore = getAdminUnitScore(state, 'kariyer_merkezi');
  const kariyerBase   = state.adminUnits?.kariyer_merkezi
    ? kariyerAdminScore
    : clamp(30 + alumniCount * 0.2, 20, 70);
  const kariyerScore  = clamp(kariyerBase + (hasTechnopark ? 15 : 0) + alumniCount * 0.1, 20, 100);

  // Yemekhane yönetim kalitesi bonusu
  const yemekhaneYonetimBonus = state.adminUnits?.yemekhane_yonetimi
    ? Math.round((getAdminUnitScore(state, 'yemekhane_yonetimi') - 50) * 0.2)
    : 0;
  // Kütüphane yönetim bonusu (kütüphane binasına ek)
  const kutuphaneYonetimBonus = state.adminUnits?.kutuphane_hizmetleri
    ? Math.round((getAdminUnitScore(state, 'kutuphane_hizmetleri') - 50) * 0.15)
    : 0;

  const isVakif    = state.meta.universityType === 'vakif';
  const tuitionBase = isVakif ? 45 : 70;
  const ucretDeger  = clamp(tuitionBase + state.university.prestige * 0.3, 20, 100);

  // Sağlık Merkezi binası — fiziksel bina idari sağlık skorunu güçlendirir
  const hasSaglikBinasi  = completedBuildings.some(b => b.type === 'saglik_merkezi');
  const saglikBinaBonus  = hasSaglikBinasi ? 12 : 0;

  // İdari hizmet genel skoru (sağlık, güvenlik, temizlik, BT, uluslararası)
  const saglikScore      = clamp(getAdminUnitScore(state, 'saglik_merkezi') + saglikBinaBonus, 0, 100);
  const guvenlikScore    = getAdminUnitScore(state, 'guvenlik');
  const temizlikScore    = getAdminUnitScore(state, 'temizlik_bakim');
  const itScore          = getAdminUnitScore(state, 'bilgi_teknolojileri');
  const intlScore        = getAdminUnitScore(state, 'uluslararasi_ofis');

  // İdari bina varsa idari hizmetlere bonus (Erdinç raporu: bina effects bağlı değildi)
  const idariBinaLevels = completedBuildings
    .filter(b => b.type === 'idari_bina')
    .reduce((s, b) => s + (b.level || 1), 0);
  const idariBinaBonus  = idariBinaLevels > 0 ? Math.min(15, 6 + (idariBinaLevels - 1) * 4) : 0;

  const adminHizmetScore = state.adminUnits
    ? clamp(Math.round((saglikScore + guvenlikScore + temizlikScore + itScore + intlScore) / 5) + idariBinaBonus, 30, 95)
    : clamp(55 + idariBinaBonus, 30, 95);

  const satisfaction =
    egitimScore      * 0.27 +
    sosyalScore      * 0.10 +
    yurtScore        * 0.10 +
    yemekScore       * 0.07 +
    sporScore        * 0.05 +
    ulasimScore      * 0.05 +
    bursScore        * 0.09 +
    kariyerScore     * 0.09 +
    ucretDeger       * 0.06 +
    adminHizmetScore * 0.12;

  const score = Math.round(clamp(satisfaction));

  const breakdown = {
    egitim: {
      label: 'Eğitim Kalitesi', score: Math.round(egitimScore), weight: 0.27,
      factors: {
        dersKalitesi:      { label: 'Ders Kalitesi',          score: Math.round(avgEdQuality) },
        uzmanlikEslesme:   { label: 'Uzmanlık Eşleşmesi',     score: Math.round(expertiseMatchScore) },
        mufredatKapsama:   { label: 'Müfredat Kapsamı',       score: Math.round(coverageScore) },
        hocaMutluluguSizm: { label: 'Hoca Mutluluğu Sızmasi', score: Math.round(avgFacultyHappiness) },
      },
    },
    sosyal:  { label: 'Sosyal Yaşam',    score: Math.round(sosyalScore),  weight: 0.10 },
    yurt:    { label: 'Yurt İmkânı',     score: Math.round(yurtScore),    weight: 0.10,
      sufficiency: hasYurt ? Math.round(yurtCoverage * 100) : 0 },
    yemek:   { label: 'Yemekhane',       score: Math.round(yemekScore),   weight: 0.07,
      sufficiency: hasYemek ? Math.round(mealRatio * 100) : 0 },
    spor:    { label: 'Spor Tesisleri',  score: Math.round(sporScore),    weight: 0.05,
      sufficiency: hasSport ? Math.round(sporRatio * 100) : 0 },
    ulasim:  { label: 'Ulaşım',          score: Math.round(ulasimScore),  weight: 0.05 },
    burs:    { label: 'Burs İmkânı',     score: Math.round(bursScore),    weight: 0.09 },
    kariyer: { label: 'Kariyer Desteği', score: Math.round(kariyerScore), weight: 0.09 },
    ucret:   { label: 'Ücret-Değer',     score: Math.round(ucretDeger),   weight: 0.06 },
    adminHizmetler: {
      label: 'İdari Hizmetler', score: Math.round(adminHizmetScore), weight: 0.12,
      factors: {
        saglik:     { label: 'Sağlık Merkezi',    score: Math.round(saglikScore) },
        guvenlik:   { label: 'Güvenlik',          score: Math.round(guvenlikScore) },
        temizlik:   { label: 'Temizlik & Bakım',  score: Math.round(temizlikScore) },
        it:         { label: 'Bilgi Teknolojileri', score: Math.round(itScore) },
        uluslararasi: { label: 'Uluslararası Ofis', score: Math.round(intlScore) },
      },
    },
  };

  return { score, breakdown };
}

// ─────────────────────────────────────────────────────────────────────────────
// getDefaultQuotas — Bölüm için varsayılan kontenjan oluştur
// ─────────────────────────────────────────────────────────────────────────────

export function getDefaultQuotas(deptId, totalCapacity = 60) {
  const tam  = Math.max(1, Math.round(totalCapacity * 0.15));
  const yari = Math.max(1, Math.round(totalCapacity * 0.20));
  const uret = Math.max(1, totalCapacity - tam - yari);
  return { tamBurslu: tam, yariBurslu: yari, ucretli: uret };
}

// ─────────────────────────────────────────────────────────────────────────────
// getStudentSummary — Genel öğrenci özeti
// ─────────────────────────────────────────────────────────────────────────────

export function getStudentSummary(state) {
  const byDept = state.students?.byDepartment || {};
  let year1 = 0, year2 = 0, year3 = 0, year4 = 0;
  let totalTam = 0, totalYari = 0, totalUcretli = 0;
  let sumYKS = 0, sumGPA = 0, countGPA = 0;

  for (const d of Object.values(byDept)) {
    for (const [key, yr] of [['year1', d.year1], ['year2', d.year2], ['year3', d.year3], ['year4', d.year4]]) {
      if (!yr || !yr.count) continue;
      const c = yr.count;
      if (key === 'year1') year1 += c;
      else if (key === 'year2') year2 += c;
      else if (key === 'year3') year3 += c;
      else year4 += c;
      totalTam     += yr.tamBurslu  || 0;
      totalYari    += yr.yariBurslu || 0;
      totalUcretli += yr.ucretli    || 0;
      if (yr.avgYKS > 0) sumYKS += yr.avgYKS * c;
      if (yr.avgGPA > 0) { sumGPA += yr.avgGPA * c; countGPA += c; }
    }
  }

  const total = year1 + year2 + year3 + year4;
  return {
    total, year1, year2, year3, year4,
    totalTam, totalYari, totalUcretli,
    avgYKS: total > 0 ? Math.round(sumYKS / total) : 0,
    avgGPA: countGPA > 0 ? parseFloat((sumGPA / countGPA).toFixed(2)) : 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Eski API uyumluluğu için stub'lar (game.js bazı fonksiyonları import ediyor)
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Yeni sistem: updateStudentYears */
export function updateCohorts(state) {
  return updateStudentYears(state, state.meta.semester === 'bahar');
}

/** @deprecated Yeni sistem: advanceYearClasses */
export function processGraduation(state) {
  if (state.meta.semester !== 'bahar') return { totalGraduates: 0, newAlumni: [] };
  return advanceYearClasses(state);
}

/** @deprecated Yeni sistem: processNewEnrollment */
export function processAdmissions(state) {
  return processNewEnrollment(state);
}
