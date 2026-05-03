/**
 * Rektör Oldum — Ana Oyun Motoru (game.js)
 * ES6 module. Tüm oyun döngüsü, state yönetimi ve karar uygulaması bu dosyadadır.
 */

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT: Sabit veriler
// ─────────────────────────────────────────────────────────────────────────────

import {
  UNIVERSITY_TYPES,
  UNIVERSITY_MODELS,
  USD_TO_TL,
  DIFFICULTY_SETTINGS,
  DEPARTMENTS,
  DEPARTMENT_CURRICULA,
  INITIAL_RIVAL_UNIVERSITIES,
  RANKING_WEIGHTS,
  TREND_CYCLES,
  MAX_PRESTIGE,
  BANKRUPTCY_DEFICIT_TURNS,
  TURNS_PER_YEAR,
  BUILDINGS,
  FACULTIES,
  DEPT_TO_FACULTY,
  PROJECT_TYPES,
  ADMIN_UNITS,
  ADMIN_TITLES,
  ADMIN_INITIAL_STAFF,
  ADMIN_UNIT_BUILDINGS,
  STUDENT_NAME_POOL,
  ACCREDITATION_BODIES,
  SCENARIOS,
  BANKS,
} from './data.js';

import { calculateEconomy, applyBudget, calculateLoanPayment, processLoanPayments } from './economy.js';
import { generateInitialFaculty, updateAllFacultyHappiness, generateApplicants, generateFaculty, getSalaryRange, calculateOverallRating, getFacultyRatingTrend } from './faculty.js';
import {
  generateInitialStudents,
  getTotalEnrolled,
  updateStudentYears,
  advanceYearClasses,
  processNewEnrollment,
  processYatayGecis,
  processMeritScholarship,
  calculateStudentSatisfaction,
  discoverStarStudents,
  getDefaultQuotas,
  getStudentSummary,
  // Uyumluluk alias'ları
  updateCohorts,
  processGraduation,
  processAdmissions,
} from './students.js';
import { calculatePrestige, updateRivals } from './ranking.js';
import { checkForEvents, applyEventEffects } from './events.js';
import {
  initAlumniState,
  processGraduatesForAlumni,
  advanceAlumniCareers,
  organizeAlumniEvent,
  rollRandomEvents,
  applyRandomEventChoice,
  checkAchievements,
  getAchievementStats,
  RANDOM_EVENTS,
  ACHIEVEMENTS,
} from './alumni_events_achievements.js';

export { RANDOM_EVENTS, ACHIEVEMENTS, getAchievementStats, organizeAlumniEvent, applyRandomEventChoice, ACCREDITATION_BODIES };

import { initTTOState, establishTTO, upgradeTTO, processTTO, acceptDeal, rejectDeal, TTO_CONFIG } from './tto.js';
export { establishTTO, upgradeTTO, acceptDeal, rejectDeal, TTO_CONFIG };

import { initClubsState, foundClub, upgradeClub, dissolveClub, processClubs, CLUB_TYPES, CLUB_CATEGORIES } from './clubs.js';
export { foundClub, upgradeClub, dissolveClub, CLUB_TYPES, CLUB_CATEGORIES };

import { SPORTS, initSportsState, foundTeam, upgradeTeam, dissolveTeam, processSports } from './sports.js';
export { SPORTS, foundTeam, upgradeTeam, dissolveTeam };

import { initCampusState, assignBuildingPosition, BUILDING_FOOTPRINTS } from './campus-layout.js';

// ─────────────────────────────────────────────────────────────────────────────
// YARDİMCI: Derin kopya (state immutability için)
// ─────────────────────────────────────────────────────────────────────────────

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDİMCI: Rastgele sayı üretici yardımcıları
// ─────────────────────────────────────────────────────────────────────────────

function randBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, max) {
  return Math.floor(randBetween(min, max + 1));
}

/** Güvenli sayı dönüşümü — NaN/Infinity yerine 0 döner */
function safeNum(val) {
  const n = Number(val);
  return (isFinite(n) && !isNaN(n)) ? n : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDİMCI: Bina kapasitesini belirli düzeyde hesapla
// ─────────────────────────────────────────────────────────────────────────────

function _buildingCapacityAtLevel(catalog, level) {
  if (!catalog.capacity) return {};
  const base   = catalog.capacity;
  const perLvl = catalog.capacityPerLevel || {};
  const result = {};
  for (const key of Object.keys(base)) {
    result[key] = (base[key] || 0) + (perLvl[key] || 0) * (level - 1);
  }
  return result;
}

function _emptyCapacity(capacityObj) {
  const result = {};
  for (const key of Object.keys(capacityObj || {})) {
    result[key] = 0;
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDİMCI: Bina kullanım kapasitesini hesapla
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bir binaya atanmış bölümlere göre kullanılan kapasite miktarını hesaplar.
 * @param {object} building — Bina nesnesi (assignedDepartments, type)
 * @param {object} state    — Oyun durumu
 * @returns {{ usedClassrooms, usedOffices, usedLabs, usedBeds }}
 */
function calculateBuildingUsage(building, state) {
  let usedClassrooms = 0;
  let usedOffices    = 0;
  let usedLabs       = 0;
  let totalProf      = 0;  // Prof/Doç — her zaman 1 ofis
  let totalDr        = 0;  // Dr.Öğr.Üyesi — boş ofis varsa 1, yoksa 2/ofis
  let totalArgo      = 0;  // ArGö — boş ofis varsa 1, yoksa 3/ofis

  // Lab binaları linkedDepartments üzerinden hesaplar (bölüm orada ofis/derslik tutmaz)
  const deptList = building.type === 'lab'
    ? (building.linkedDepartments || [])
    : (building.assignedDepartments || []);

  for (const deptId of deptList) {
    const dept = (state.departments || []).find(d => d.id === deptId);
    if (!dept) continue;

    // Bölümdeki toplam öğrenci sayısı
    const deptData      = state.students?.byDepartment?.[deptId];
    const studentCount  = deptData
      ? ((deptData.year1?.count || 0) + (deptData.year2?.count || 0) +
         (deptData.year3?.count || 0) + (deptData.year4?.count || 0))
      : 0;

    const deptFaculty   = (state.faculty || []).filter(f => (f.department || f.departmentId) === deptId);
    const profCount     = deptFaculty.filter(f => ['profesor', 'docent'].includes(f.title)).length;
    const drCount       = deptFaculty.filter(f => f.title === 'dr_ogr_uyesi').length;
    const argoCount     = deptFaculty.filter(f => f.title === 'argö').length;

    // Düzeye göre derslik kapasitesi: classroomSizeByLevel varsa kullan
    const catalog = BUILDINGS[building.type];
    const classroomSizeByLevel = catalog?.classroomSizeByLevel;
    const buildingLevel = building.level || 1;
    const classroomSize = classroomSizeByLevel
      ? (classroomSizeByLevel[buildingLevel] ?? classroomSizeByLevel[1] ?? 40)
      : (catalog?.classroomSize ?? 40);
    usedClassrooms     += classroomSize > 0 ? Math.ceil(studentCount / classroomSize) : 0;

    // Ofis ataması: Boş ofis varken herkes tek ofis alır.
    // Ofis yetersizse Dr.Öğr.Üyesi 2/ofis, ArGö 3/ofis olarak sıkıştırılır.
    totalProf  += profCount;
    totalDr    += drCount;
    totalArgo  += argoCount;

    // Mühendislik/fen bölümleri: laboratuvar gerektirir (60 öğrenciye 1 lab)
    if (dept.category === 'muhendislik' || dept.category === 'fen') {
      usedLabs += Math.ceil(studentCount / 60);
    }
  }

  // ── Akıllı ofis ataması ──────────────────────────────────────────────────
  // Prof/Doç her zaman tek ofis alır.
  // Kalan boş ofislere önce Dr.Öğr.Üyesi, sonra ArGö tek ofis alır.
  // Ofis yetmezse: Dr.Öğr.Üyesi 2/ofis, ArGö 3/ofis olarak sıkıştırılır.
  const bDef = BUILDINGS[building.type];
  const baseCap = bDef?.capacity?.offices ?? 0;
  const perLvl  = bDef?.capacityPerLevel?.offices ?? 0;
  const lvl     = building.level || 1;
  const availOffices = baseCap + (lvl - 1) * perLvl;

  // 1) Prof/Doç: her zaman 1 ofis
  usedOffices = totalProf;
  let remaining = Math.max(0, availOffices - usedOffices);

  // 2) Dr.Öğr.Üyesi: boş ofis varsa 1 kişi/ofis, yoksa 2 kişi/ofis
  if (totalDr > 0) {
    if (remaining >= totalDr) {
      // Herkes tek ofis alır
      usedOffices += totalDr;
      remaining -= totalDr;
    } else {
      // Kalan boş ofislere tek, gerisine paylaşımlı
      usedOffices += remaining; // boş olanlar tek
      const crowdedDr = totalDr - remaining;
      usedOffices += Math.ceil(crowdedDr / 2);
      remaining = 0;
    }
  }

  // 3) ArGö: boş ofis varsa 1 kişi/ofis, yoksa 3 kişi/ofis
  if (totalArgo > 0) {
    if (remaining >= totalArgo) {
      usedOffices += totalArgo;
      remaining -= totalArgo;
    } else {
      usedOffices += remaining;
      const crowdedArgo = totalArgo - remaining;
      usedOffices += Math.ceil(crowdedArgo / 3);
      remaining = 0;
    }
  }

  // Yurt yataği: toplam öğrencinin %40'ı yurtta kalır (yaklaşık)
  let usedBeds = 0;
  if (building.type === 'yurt') {
    const totalStudents = getTotalEnrolled(state) || 0;
    usedBeds = Math.round(totalStudents * 0.40);
  }

  return { usedClassrooms, usedOffices, usedLabs, usedBeds };
}

/**
 * Lab binalarına atanan bölümlerin labScore değerini yeniden hesaplar.
 * Bir bölüme atanmış her lab binası düzey × 25 puan katkı sağlar (maks 100).
 */
function _recalcDeptLabScores(state) {
  if (!state.departments || !state.buildings) return;

  // Önce tüm bölümlerin lab kaynaklı skorunu sıfırla
  for (const dept of state.departments) {
    dept._labBuildingScore = 0;
  }

  // Bağlı lab binalarından puan ekle
  for (const building of state.buildings) {
    if (building.type !== 'lab' || !building.isCompleted) continue;
    const level = building.level || 1;
    const bonus = 25 * level;
    for (const deptId of (building.linkedDepartments || [])) {
      const dept = state.departments.find(d => d.id === deptId);
      if (dept) {
        dept._labBuildingScore = (dept._labBuildingScore || 0) + bonus;
      }
    }
  }

  // labScore'u güncelle: bölümün kendi bazı + bina bonusu, maks 100
  for (const dept of state.departments) {
    if (dept.labRequirement > 0 || (dept._labBuildingScore || 0) > 0) {
      const base = dept.labRequirement > 0 ? 30 : 100;
      dept.labScore = Math.min(100, base + (dept._labBuildingScore || 0));
    }
  }
}

/**
 * Tüm tamamlanmış binaların usedCapacity değerini günceller.
 * Her dönem simülasyonu sonunda çağrılır.
 */
function _updateAllBuildingUsage(state) {
  const totalStudents = getTotalEnrolled(state) || 0;
  const totalFaculty  = (state.faculty || []).length;

  for (const building of (state.buildings || [])) {
    if (!building.isCompleted) continue;
    if (!building.usedCapacity) building.usedCapacity = {};

    if (building.type === 'yurt') {
      // Yurt: toplam öğrencinin ~%40'ı yurtta (kapasite ile sınırlı)
      const beds = (building.currentCapacity?.beds) || 0;
      building.usedCapacity.beds = Math.min(beds, Math.round(totalStudents * 0.40));

    } else if (building.type === 'yemekhane') {
      // Yemekhane: hizmet ettiği öğrenci + hoca sayısı (kapasite ile sınırlı)
      const dailyMeals = (building.currentCapacity?.dailyMeals) || 0;
      building.usedCapacity.dailyMeals = Math.min(dailyMeals, totalStudents + totalFaculty);

    } else if (building.type === 'kutuphane') {
      // Kütüphane: eş zamanlı kullanım ~öğrencilerin %25'i (kapasite ile sınırlı)
      const sim = (building.currentCapacity?.simultaneous) || 0;
      const dly = (building.currentCapacity?.daily) || 0;
      building.usedCapacity.simultaneous = Math.min(sim, Math.round(totalStudents * 0.25));
      building.usedCapacity.daily        = Math.min(dly, totalStudents);

    } else if (building.type === 'spor_tesisi') {
      // Spor tesisi: günlük kullanıcı ~öğrencilerin %60'ı (kapasite ile sınırlı)
      const du = (building.currentCapacity?.dailyUsers) || 0;
      building.usedCapacity.dailyUsers = Math.min(du, Math.round(totalStudents * 0.60));

    } else {
      // Fakülte, araştırma merkezi, amfi vb. — bölüm bazlı hesap
      const usage = calculateBuildingUsage(building, state);
      building.usedCapacity.classrooms = usage.usedClassrooms;
      building.usedCapacity.offices    = usage.usedOffices;
      building.usedCapacity.labs       = usage.usedLabs;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDİMCI: Trend ısısını hesapla
// ─────────────────────────────────────────────────────────────────────────────

function initTrendHeats() {
  // TREND_CYCLES.initialHeat nesnesini kopyala
  return { ...TREND_CYCLES.initialHeat };
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDİMCI: İdari birim başlangıç değerleri (eski — geriye dönük uyumluluk)
// ─────────────────────────────────────────────────────────────────────────────

function buildAdminUnits() {
  // Yeni sistemde adminUnits ayrı tutulur; bu fonksiyon eski state.admin.units için korunur
  return {
    rektorluk: {
      id: 'rektorluk',
      name: 'Rektörlük',
      staffCount: 5,
      efficiency: 70,
      budget: 2_000_000,
    },
    mali_isler: {
      id: 'mali_isler',
      name: 'Mali İşler',
      staffCount: 6,
      efficiency: 70,
      budget: 1_200_000,
    },
    insan_kaynaklari: {
      id: 'insan_kaynaklari',
      name: 'İnsan Kaynakları',
      staffCount: 4,
      efficiency: 65,
      budget: 1_000_000,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDİMCI: Yeni idari birim state nesneleri oluştur
// ─────────────────────────────────────────────────────────────────────────────

function buildAdminUnitStates(totalStudents) {
  const result = {};
  for (const [unitId, template] of Object.entries(ADMIN_UNITS)) {
    const staffNeeded = Math.max(
      template.baseStaffNeeded,
      Math.ceil(totalStudents * template.staffPerStudentRatio)
    );
    result[unitId] = {
      id: unitId,
      level: 1,
      staffCount: 0,           // gerçek personel sayısı sonradan doldurulur
      staffNeeded,
      staffQuality: 0,         // personel alındıktan sonra hesaplanır
      budget: staffNeeded * 18_000 * 5,  // tahmini dönemlik işletme bütçesi
      satisfaction: 50,
      isActive: true,
    };
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDİMCI: İdari personel oluştur
// ─────────────────────────────────────────────────────────────────────────────

let _adminIdCounter = 1;

function _randomAdminName() {
  const pool = STUDENT_NAME_POOL;
  const isMale = Math.random() < 0.5;
  const first = isMale
    ? pool.male[randInt(0, pool.male.length - 1)]
    : pool.female[randInt(0, pool.female.length - 1)];
  const last = pool.surname[randInt(0, pool.surname.length - 1)];
  return `${first} ${last}`;
}

function generateAdminStaffMember(unitId, title) {
  const salaryRange = ADMIN_TITLES[title] || { min: 14_000, max: 18_000 };
  const salary = randInt(salaryRange.min, salaryRange.max);
  const efficiency    = randInt(45, 80);
  const communication = randInt(40, 75);
  const leadership    = randInt(30, 70);
  const techSkills    = randInt(45, 80);
  const quality = Math.round((efficiency + communication + leadership + techSkills) / 4);
  const totalExperience = randInt(1, 15);
  return {
    id: `admin_${_adminIdCounter++}`,
    name: _randomAdminName(),
    unit: unitId,
    title,
    salary,
    quality,
    experience: totalExperience,
    happiness: randInt(55, 80),
    // Kariyer sistemi
    yearsInPosition:      randInt(0, 3),
    totalExperience,
    promotionEligible:    false,
    semestersSinceEligible: 0,
    performanceHistory:   [],
    loyalty:              randInt(60, 85),
    efficiency,
    communication,
    leadership,
    techSkills,
  };
}

function generateInitialAdminStaff(totalStudents) {
  const staff = [];
  for (const entry of ADMIN_INITIAL_STAFF) {
    for (let i = 0; i < entry.count; i++) {
      staff.push(generateAdminStaffMember(entry.unit, entry.title));
    }
  }
  return staff;
}

// Birim state'lerindeki staffCount ve staffQuality'yi gerçek personele göre güncelle
// buildings parametresi verilirse fiziksel bina bonusları da uygulanır
function syncAdminUnitStats(adminUnits, adminStaff, buildings) {
  // Eski kayıtlar için eksik alanları doldur (göç)
  for (const member of adminStaff) {
    if (member.efficiency    == null) member.efficiency    = member.quality || 60;
    if (member.communication == null) member.communication = Math.max(40, (member.quality || 60) - 5);
    if (member.leadership    == null) member.leadership    = Math.max(30, (member.quality || 60) - 15);
    if (member.techSkills    == null) member.techSkills    = member.quality || 60;
    if (member.yearsInPosition      == null) member.yearsInPosition      = 0;
    if (member.totalExperience      == null) member.totalExperience      = member.experience || 3;
    if (member.promotionEligible    == null) member.promotionEligible    = false;
    if (member.semestersSinceEligible == null) member.semestersSinceEligible = 0;
    if (!Array.isArray(member.performanceHistory)) member.performanceHistory = [];
    if (member.loyalty == null) member.loyalty = 70;
  }

  // Sayıları sıfırla
  for (const unit of Object.values(adminUnits)) {
    unit.staffCount = 0;
    unit._qualitySum = 0;
  }
  // Personeli say
  for (const member of adminStaff) {
    const unit = adminUnits[member.unit];
    if (!unit) continue;
    unit.staffCount++;
    unit._qualitySum = (unit._qualitySum || 0) + member.quality;
  }
  // Ortalama kalite hesapla
  for (const unit of Object.values(adminUnits)) {
    unit.staffQuality = unit.staffCount > 0
      ? Math.round(unit._qualitySum / unit.staffCount)
      : 0;
    delete unit._qualitySum;

    // Performans skoru: personel oranı × kalite
    const ratio = unit.staffNeeded > 0 ? Math.min(1, unit.staffCount / unit.staffNeeded) : 0;
    unit.satisfaction = Math.round(
      30 +
      ratio * unit.staffQuality * 0.55 +
      (ADMIN_UNITS[unit.id]?.levelBonuses?.[unit.level]?.satisfactionBonus || 0)
    );
  }

  // Fiziksel bina bonusları (opsiyonel)
  if (buildings && buildings.length > 0) {
    _applyAdminBuildingBonuses(adminUnits, buildings);
  }
}

/**
 * Fiziksel binalara göre idari birimlere verimlilik ve memnuniyet bonusu uygular.
 * ADMIN_UNIT_BUILDINGS sabiti üzerinden çalışır — tek kaynak of truth.
 * syncAdminUnitStats tarafından çağrılır (buildings mevcut ise).
 */
function _applyAdminBuildingBonuses(adminUnits, buildings) {
  const getBuildingObj = (type) => buildings.find(b => b.type === type && b.isCompleted) || null;
  const completed      = (type) => !!getBuildingObj(type);
  const getBuildingLevel = (type) => {
    const b = getBuildingObj(type);
    return b ? (b.level || 1) : 0;
  };

  // Bina icon eşlemesi (UI'de gösterilir)
  const BUILDING_ICONS = {
    kutuphane:      '📚',
    yemekhane:      '🍽️',
    saglik_merkezi: '🏥',
    idari_bina:     '🏛️',
    ulasim_merkezi: '🚌',
  };
  // Bina başına verimlilik bonusu
  const BUILDING_EFFICIENCY = {
    kutuphane:      10,
    yemekhane:      10,
    saglik_merkezi: 15,
    ulasim_merkezi: 10,
  };

  // 1. ADMIN_UNIT_BUILDINGS eşlemesine göre her birimin assignedBuilding/buildingBonus'unu güncelle
  for (const [unitId, buildingType] of Object.entries(ADMIN_UNIT_BUILDINGS)) {
    const unit = adminUnits[unitId];
    if (!unit) continue;

    const buildingObj = getBuildingObj(buildingType);
    if (buildingObj) {
      // Bina mevcut ve tamamlandı — birimi bu binaya ata
      unit.assignedBuilding = buildingType;
      unit.buildingName     = buildingObj.name || buildingType;
      const eff = BUILDING_EFFICIENCY[buildingType];
      if (eff) {
        unit.buildingBonus = {
          type:       buildingType,
          icon:       BUILDING_ICONS[buildingType] || '🏢',
          efficiency: eff,
        };
        unit.satisfaction = Math.min(100, unit.satisfaction + eff);
      }
    } else {
      // Bina yok — atamaları temizle
      unit.assignedBuilding = null;
      unit.buildingName     = null;
      if (unit.buildingBonus?.type === buildingType) unit.buildingBonus = null;
    }
  }

  // 2. İdari bina → tüm birimlere seviyeye göre verimlilik bonusu (özel kural)
  const idariLevel    = getBuildingLevel('idari_bina');
  const idariBonusMap = { 1: 10, 2: 15, 3: 20 };
  const idariBonus    = idariLevel > 0 ? (idariBonusMap[idariLevel] || 10) : 0;
  for (const unit of Object.values(adminUnits)) {
    if (idariBonus > 0) {
      unit.idariBonus   = idariBonus;
      unit.satisfaction = Math.min(100, unit.satisfaction + Math.round(idariBonus * 0.3));
    } else {
      unit.idariBonus = 0;
    }
  }

  // 3. Spor tesisi → tüm birimlerde memnuniyet +2
  if (completed('spor_tesisi')) {
    for (const unit of Object.values(adminUnits)) {
      unit.satisfaction = Math.min(100, unit.satisfaction + 2);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// İDARİ PERSONEL KARİYER SİSTEMİ
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_TITLE_ORDER = ['Memur', 'Uzman', 'Şef', 'Müdür Yrd.', 'Müdür'];

/** Unvanın bir üstünü döndürür (yoksa null) */
function _nextAdminTitle(title) {
  const idx = ADMIN_TITLE_ORDER.indexOf(title);
  return idx >= 0 && idx < ADMIN_TITLE_ORDER.length - 1
    ? ADMIN_TITLE_ORDER[idx + 1]
    : null;
}

/** Maaş barem orta noktasını döndürür */
function _titleMidpoint(title) {
  const range = ADMIN_TITLES[title] || { min: 14_000, max: 18_000 };
  return Math.round((range.min + range.max) / 2);
}

/**
 * Terfi uygunluğunu kontrol eder ve staff.promotionEligible'ı günceller.
 * Kriter:
 *   Memur → Uzman:     2+ yıl, quality > 55, efficiency > 50
 *   Uzman → Şef:       3+ yıl, quality > 65, leadership > 55
 *   Şef → Müdür Yrd.:  3+ yıl, quality > 70, leadership > 65
 *   Müdür Yrd. → Müdür:4+ yıl, quality > 75, leadership > 70
 */
function _checkPromotionEligibility(staff) {
  const t = staff.title;
  const yip = safeNum(staff.yearsInPosition);
  const q   = safeNum(staff.quality);
  const eff = safeNum(staff.efficiency);
  const led = safeNum(staff.leadership);

  let eligible = false;
  if (t === 'Memur')      eligible = yip >= 2 && q > 55 && eff > 50;
  else if (t === 'Uzman') eligible = yip >= 3 && q > 65 && led > 55;
  else if (t === 'Şef')   eligible = yip >= 3 && q > 70 && led > 65;
  else if (t === 'Müdür Yrd.') eligible = yip >= 4 && q > 75 && led > 70;

  if (eligible && !staff.promotionEligible) {
    // Yeni uygunluk başladı
    staff.promotionEligible = true;
    staff.semestersSinceEligible = 0;
  } else if (!eligible) {
    staff.promotionEligible = false;
    staff.semestersSinceEligible = 0;
  }
}

/**
 * Her dönem idari personel performansını hesaplar ve deneyimi günceller.
 */
function _updateAdminStaffPerformance(staff) {
  // Alt istatistikleri hafifçe geliştir (deneyim etkisi)
  staff.efficiency    = Math.min(100, safeNum(staff.efficiency)    + randInt(0, 2));
  staff.techSkills    = Math.min(100, safeNum(staff.techSkills)    + randInt(0, 1));
  // Liderlik: Şef ve üstü unvanlarda daha hızlı gelişir
  const titleIdx = ADMIN_TITLE_ORDER.indexOf(staff.title);
  if (titleIdx >= 2) {
    staff.leadership = Math.min(100, safeNum(staff.leadership) + randInt(0, 1));
  }

  // Genel kaliteyi alt istatistiklerden yeniden hesapla
  staff.quality = Math.round(
    safeNum(staff.efficiency)    * 0.3 +
    safeNum(staff.communication) * 0.2 +
    safeNum(staff.leadership)    * 0.25 +
    safeNum(staff.techSkills)    * 0.25
  );

  // Dönem performans skoru
  const perfScore = Math.round(
    safeNum(staff.efficiency)    * 0.3 +
    safeNum(staff.communication) * 0.2 +
    safeNum(staff.leadership)    * 0.2 +
    safeNum(staff.techSkills)    * 0.2 +
    (safeNum(staff.happiness) / 100) * 10
  );

  if (!Array.isArray(staff.performanceHistory)) staff.performanceHistory = [];
  staff.performanceHistory.push(perfScore);
  if (staff.performanceHistory.length > 4) staff.performanceHistory.shift();

  // Deneyim güncelle
  staff.totalExperience = safeNum(staff.totalExperience) + 0.5; // Her dönem = 0.5 yıl
  staff.yearsInPosition = safeNum(staff.yearsInPosition) + 0.5;

  // Mutluluk: maaş vs. barem etkisi
  const midpoint = _titleMidpoint(staff.title);
  const range = ADMIN_TITLES[staff.title] || { min: 14_000, max: 25_000 };
  if (safeNum(staff.salary) > midpoint) {
    staff.happiness = Math.min(100, safeNum(staff.happiness) + randInt(0, 3));
  } else if (safeNum(staff.salary) < range.min) {
    staff.happiness = Math.max(0, safeNum(staff.happiness) - randInt(2, 5));
  } else {
    staff.happiness = Math.max(0, Math.min(100, safeNum(staff.happiness) + randInt(-2, 2)));
  }
}

/**
 * Devir-daim (işten ayrılma) simülasyonu. Ayrılan personeli döndürür.
 */
function _calculateAdminTurnover(adminStaff) {
  const departures = [];
  for (const staff of adminStaff) {
    let leaveChance = 0.02;

    const midpoint = _titleMidpoint(staff.title);
    if (safeNum(staff.salary) < midpoint) leaveChance += 0.05;
    if (staff.promotionEligible && safeNum(staff.semestersSinceEligible) > 3) leaveChance += 0.08;
    if (safeNum(staff.happiness) < 40) leaveChance += 0.06;
    if (safeNum(staff.quality) > 75) leaveChance += 0.03;
    if (safeNum(staff.happiness) > 80 && safeNum(staff.salary) > midpoint) leaveChance -= 0.03;

    leaveChance = Math.max(0, Math.min(0.5, leaveChance));
    if (Math.random() < leaveChance) {
      departures.push(staff);
    }
  }
  return departures;
}

/**
 * Birim yöneticisi atama: her birime Müdür/Müdür Yrd. olan en yüksek liderlikli personeli ata.
 */
function _assignUnitManagers(adminUnits, adminStaff) {
  // Önce tüm birimlerin manager'ını temizle
  for (const unit of Object.values(adminUnits)) {
    unit.managerId   = unit.managerId   || null;
    unit.managerName = unit.managerName || null;
    unit.managerLeadership = unit.managerLeadership || 0;
  }

  for (const [unitId, unit] of Object.entries(adminUnits)) {
    const eligible = adminStaff.filter(
      s => s.unit === unitId && (s.title === 'Müdür' || s.title === 'Müdür Yrd.')
    );
    if (eligible.length === 0) {
      unit.managerId   = null;
      unit.managerName = null;
      unit.managerLeadership = 0;
      continue;
    }
    // En yüksek liderlikli olanı seç
    eligible.sort((a, b) => safeNum(b.leadership) - safeNum(a.leadership));
    const mgr = eligible[0];
    unit.managerId         = mgr.id;
    unit.managerName       = mgr.name;
    unit.managerLeadership = safeNum(mgr.leadership);
  }
}

/**
 * Yönetici liderliğine göre birim satisfaction bonusu ekler.
 */
function _applyManagerBonus(adminUnits) {
  for (const unit of Object.values(adminUnits)) {
    let bonus = 0;
    if (unit.managerId) {
      // İyi yönetici (liderlik > 60): bonus, kötü yönetici (< 40): ceza
      const led = safeNum(unit.managerLeadership);
      if (led > 70) bonus = 8;
      else if (led > 60) bonus = 4;
      else if (led < 40) bonus = -5;
    } else {
      bonus = -8; // Yönetici yok: ceza
    }
    unit.satisfaction = Math.max(0, Math.min(100, safeNum(unit.satisfaction) + bonus));
  }
}

/**
 * Terfi uygula: state'te staff nesnesini günceller.
 * @returns {{ success: boolean, message: string }}
 */
export function promoteAdminStaff(staffId) {
  if (!_state) return { success: false, message: 'Oyun başlatılmamış.' };
  const staff = (_state.adminStaff || []).find(s => s.id === staffId);
  if (!staff) return { success: false, message: 'Personel bulunamadı.' };
  const nextTitle = _nextAdminTitle(staff.title);
  if (!nextTitle) return { success: false, message: 'Bu unvan zaten en yüksek.' };

  const newRange = ADMIN_TITLES[nextTitle];
  const newSalary = Math.round((newRange.min + newRange.max) / 2); // Yeni baremde orta noktadan başla
  staff.title                  = nextTitle;
  staff.salary                 = Math.max(staff.salary, newSalary); // Mevcut maaş düşmesin
  staff.yearsInPosition        = 0;
  staff.promotionEligible      = false;
  staff.semestersSinceEligible = 0;
  staff.happiness              = Math.min(100, safeNum(staff.happiness) + 15);
  // Liderlik terfi ile artar
  staff.leadership = Math.min(100, safeNum(staff.leadership) + randInt(3, 7));
  syncAdminUnitStats(_state.adminUnits, _state.adminStaff, _state.buildings);
  _assignUnitManagers(_state.adminUnits, _state.adminStaff);
  return { success: true, message: `${staff.name} terfi ettirildi: ${nextTitle}` };
}

/**
 * İdari personeli işten çıkar (tazminat: 2 ay maaş).
 * @returns {{ success: boolean, message: string, severance: number }}
 */
export function fireAdminStaff(staffId) {
  if (!_state) return { success: false, message: 'Oyun başlatılmamış.' };
  const idx = (_state.adminStaff || []).findIndex(s => s.id === staffId);
  if (idx === -1) return { success: false, message: 'Personel bulunamadı.' };
  const [staff] = _state.adminStaff.splice(idx, 1);
  const severance = safeNum(staff.salary) * 2;
  _state.university.budget = safeNum(_state.university.budget) - severance;
  syncAdminUnitStats(_state.adminUnits, _state.adminStaff, _state.buildings);
  _assignUnitManagers(_state.adminUnits, _state.adminStaff);
  return { success: true, message: `${staff.name} iş akdi feshedildi.`, severance, staffName: staff.name };
}

/**
 * İdari personel maaşını günceller.
 */
export function updateAdminStaffSalary(staffId, newSalary) {
  if (!_state) return { success: false, message: 'Oyun başlatılmamış.' };
  const staff = (_state.adminStaff || []).find(s => s.id === staffId);
  if (!staff) return { success: false, message: 'Personel bulunamadı.' };
  const parsed = safeNum(newSalary);
  if (parsed <= 0) return { success: false, message: 'Geçersiz maaş.' };
  staff.salary = parsed;
  return { success: true };
}

/**
 * Birim yöneticisini değiştir (staffId: null = yönetici yok).
 */
export function assignUnitManager(unitId, staffId) {
  if (!_state) return { success: false, message: 'Oyun başlatılmamış.' };
  const unit = _state.adminUnits?.[unitId];
  if (!unit) return { success: false, message: 'Birim bulunamadı.' };
  if (!staffId) {
    unit.managerId = null; unit.managerName = null; unit.managerLeadership = 0;
    return { success: true };
  }
  const staff = (_state.adminStaff || []).find(s => s.id === staffId);
  if (!staff) return { success: false, message: 'Personel bulunamadı.' };
  if (staff.title !== 'Müdür' && staff.title !== 'Müdür Yrd.') {
    return { success: false, message: 'Sadece Müdür veya Müdür Yrd. yönetici atanabilir.' };
  }
  unit.managerId         = staff.id;
  unit.managerName       = staff.name;
  unit.managerLeadership = safeNum(staff.leadership);
  return { success: true };
}

// İdari personel adayı üret (işe alma modalı için)
export function generateAdminCandidates(unitId, title, count = 3) {
  const candidates = [];
  for (let i = 0; i < count; i++) {
    candidates.push(generateAdminStaffMember(unitId, title));
  }
  return candidates;
}

// İdari personel işe al
export function hireAdminStaff(candidate) {
  if (!_state) return;
  if (!_state.adminStaff) _state.adminStaff = [];
  _state.adminStaff.push({ ...candidate });
  // Birim istatistiklerini güncelle
  syncAdminUnitStats(_state.adminUnits, _state.adminStaff, _state.buildings);
}

// İdari birim yükselt
export function upgradeAdminUnit(unitId) {
  if (!_state) return { success: false, message: 'Oyun başlatılmamış.' };
  const unit = _state.adminUnits?.[unitId];
  const template = ADMIN_UNITS[unitId];
  if (!unit || !template) return { success: false, message: 'Birim bulunamadı.' };
  if (unit.level >= template.maxLevel) return { success: false, message: 'Zaten maksimum düzeyde.' };

  const cost = template.upgradeCost[unit.level] || 0;
  if (_state.university.budget < cost) return { success: false, message: 'Yetersiz bütçe.' };

  _state.university.budget -= cost;
  unit.level++;
  // staffNeeded'ı yeniden hesapla
  const totalStudents = _state.students?.totalEnrolled || 0;
  unit.staffNeeded = Math.max(
    template.baseStaffNeeded,
    Math.ceil(totalStudents * template.staffPerStudentRatio)
  );
  syncAdminUnitStats(_state.adminUnits, _state.adminStaff || [], _state.buildings);
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDİMCI: Seçilen bölümleri state formatına dönüştür
// ─────────────────────────────────────────────────────────────────────────────

function buildDepartmentState(deptId) {
  const template = DEPARTMENTS[deptId];
  if (!template) return null;

  return {
    id:                  template.id,
    name:                template.name,
    shortName:           template.shortName,
    category:            template.category,
    icon:                template.icon,

    // Ekonomi
    tuitionMultiplier:   template.tuitionMultiplier,
    annualOperatingCost: template.annualOperatingCost,
    revenueEfficiency:   template.revenueEfficiency,

    // Öğrenci
    studentCapacity:     100,           // varsayılan başlangıç kontenjanı
    enrolledStudents:    0,             // dönem başında doldurulacak
    baseStudentDemand:   template.baseStudentDemand,
    waitlistCount:       0,

    // Araştırma
    researchPotential:   template.researchPotential,
    labRequirement:      template.labRequirement,
    avgPublicationPerFaculty: template.avgPublicationPerFaculty,
    projectBudgetRange:  template.projectBudgetRange,
    activeResearchBudget: 0,

    // Hoca
    facultyRetentionDifficulty: template.facultyRetentionDifficulty,
    assignedFacultyIds:  [],           // hoca id referansları
    headId:              null,         // bölüm başkanı hoca id'si

    // Kalite göstergeleri
    educationQuality:    50,           // 0-100
    studentSatisfaction: 50,
    labScore:            template.labRequirement > 0 ? 30 : 100,

    // Durum
    isOpen:              true,
    turnsOpen:           0,
    accreditationStatus: 'pending',    // pending | provisional | full | suspended
    accreditationScore:  0,

    // Akreditasyon sistemi (MÜDEK/ABET/THEQA)
    accreditation: {
      mudek: { status: 'none', appliedAt: null, grantedAt: null, expiresAt: null, processTime: null },
      abet:  { status: 'none', appliedAt: null, grantedAt: null, expiresAt: null, processTime: null },
      theqa: { status: 'none', appliedAt: null, grantedAt: null, expiresAt: null, processTime: null },
    },

    // Opsiyonel özellikler (bölüme özgü)
    requiresHospital:    template.requiresHospital    || false,
    requiresClinic:      template.requiresClinic      || false,
    donerSermayeMultiplier: template.donerSermayeMultiplier || 1.0,
    trendSensitivity:    template.trendSensitivity    || 'normal',

    // ── Feature 1: Lisansüstü Programlar ──────────────────────────────────
    programs: {
      lisans: {
        active: true,
        quota: 50,
        students: {
          year1: { count: 0, avgGPA: 0 },
          year2: { count: 0, avgGPA: 0 },
          year3: { count: 0, avgGPA: 0 },
          year4: { count: 0, avgGPA: 0 },
        },
        graduatedTotal: 0,
      },
      yuksek_lisans: {
        active: false,
        quota: 0,
        students: {
          year1: { count: 0, avgGPA: 0 },
          year2: { count: 0, avgGPA: 0 },
        },
        thesisStudents: 0,
        graduatedTotal: 0,
        stipendPerStudent: 8000,
        yok_approval_turn: null,
      },
      doktora: {
        active: false,
        quota: 0,
        students: {
          year1: { count: 0, avgGPA: 0 },
          year2: { count: 0, avgGPA: 0 },
          year3: { count: 0, avgGPA: 0 },
          year4: { count: 0, avgGPA: 0 },
        },
        dissertationStudents: 0,
        graduatedTotal: 0,
        stipendPerStudent: 12000,
        yok_approval_turn: null,
      },
    },
  };
}

// generateInitialFaculty → faculty.js'den import edildi.

// generateInitialStudents → students.js'den import edildi

// ─────────────────────────────────────────────────────────────────────────────
// YARDİMCI: Başlangıç binalarını oluştur (mevcut üniversite senaryosu)
// ─────────────────────────────────────────────────────────────────────────────

function _buildInitialBuildings() {
  // Oyuncu mevcut bir üniversiteyi devraldığı için temel binalar hazır başlar.
  const now = new Date().toISOString();
  return [
    {
      id:                  'init_fakülte_1',
      type:                'fakulte_binasi',
      name:                'Fakülte Binası',
      level:               2,
      isCompleted:         true,
      status:              'operational',
      constructionProgress: 100,
      turnsRemaining:      0,
      area:                4500,
      condition:           85,
      currentCapacity:     { offices: 45, classrooms: 15, labs: 0 },
      usedCapacity:        { offices: 0, classrooms: 0, labs: 0 },
      assignedDepartments: [],
      assignedFaculty:     [],
      maintenanceCost:     225_000,
      builtAt:             now,
    },
    {
      id:                  'init_kutuphane_1',
      type:                'kutuphane',
      name:                'Kütüphane',
      level:               1,
      isCompleted:         true,
      status:              'operational',
      constructionProgress: 100,
      turnsRemaining:      0,
      area:                2000,
      condition:           80,
      currentCapacity:     { simultaneous: 200, daily: 800 },
      usedCapacity:        { simultaneous: 0, daily: 0 },
      maintenanceCost:     80_000,
      builtAt:             now,
    },
    {
      id:                  'init_yurt_1',
      type:                'yurt',
      name:                'Yurt',
      level:               1,
      isCompleted:         true,
      status:              'operational',
      constructionProgress: 100,
      turnsRemaining:      0,
      area:                4000,
      condition:           75,
      currentCapacity:     { beds: 200 },
      usedCapacity:        { beds: 0 },
      maintenanceCost:     140_000,
      builtAt:             now,
    },
    {
      id:                  'init_yemekhane_1',
      type:                'yemekhane',
      name:                'Yemekhane',
      level:               1,
      isCompleted:         true,
      status:              'operational',
      constructionProgress: 100,
      turnsRemaining:      0,
      area:                1000,
      condition:           78,
      currentCapacity:     { dailyMeals: 500 },
      usedCapacity:        { dailyMeals: 0 },
      maintenanceCost:     60_000,
      builtAt:             now,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDİMCI: Fakülte yapısı state nesnesi oluştur
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Seçili bölümlere göre fakülte state nesnesi oluşturur.
 * Her fakülte için hangi bölümlerin aktif olduğunu belirler.
 * @param {object[]} departments — Aktif bölüm nesneleri
 * @returns {object} Fakülte state haritası
 */
function _buildFakultelerState(departments) {
  const result = {};
  const activeDeptIds = new Set(departments.map(d => d.id));

  for (const [fId, fDef] of Object.entries(FACULTIES)) {
    // Bu fakülteye ait aktif bölümleri bul
    const activeDepts = fDef.departments.filter(dId => activeDeptIds.has(dId));
    if (activeDepts.length === 0) continue; // Bölüm yoksa fakülteyi ekleme

    result[fId] = {
      id:          fId,
      name:        fDef.name,
      icon:        fDef.icon,
      departments: activeDepts,
      deanId:      null,   // Dekan (atanabilir)
      headCount:   0,      // Toplam hoca
      studentCount: 0,     // Toplam öğrenci
    };
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDİMCI: Bölüm başkanı otomatik ata
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Her bölüme başlangıçta en yüksek yönetim statına sahip Prof veya Doç'u atar.
 * @param {object} state — Oyun durumu (doğrudan güncellenir)
 */
function _autoAssignDeptHeads(state) {
  const eligibleTitles = new Set(['profesor', 'docent']);

  for (const dept of (state.departments || [])) {
    // Zaten bir başkan varsa atlamla
    if (dept.headId) continue;

    // Bölümdeki Prof/Doç listesi, yönetim statına göre sıralı
    const candidates = (state.faculty || [])
      .filter(f => f.department === dept.id && eligibleTitles.has(f.title))
      .sort((a, b) => (b.stats?.management ?? 0) - (a.stats?.management ?? 0));

    if (candidates.length > 0) {
      const head = candidates[0];
      dept.headId = head.id;
      // Başkanın adminRole'ünü işaretle
      if (head.currentLoad) {
        head.currentLoad.adminRole = 'bolum_baskani';
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MERKEZI STATE (modül-özel — dışarıya doğrudan verilmez)
// ─────────────────────────────────────────────────────────────────────────────

let _state = null;

// Kaybetme koşulu sayaçları (state dışında takip)
let _bankruptcyTurns   = 0;   // üst üste açık veren tur sayısı
let _lowStudentTurns   = 0;   // düşük öğrenci kapasitesi tur sayısı
let _gameOver          = false;
let _gameWon           = false;

// ─────────────────────────────────────────────────────────────────────────────
// initGame — Yeni oyun başlat
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Yeni bir oyun başlatır ve state'i sıfırlar.
 *
 * @param {string} playerName           — Oyuncu adı
 * @param {string} universityName       — Üniversite adı
 * @param {string} universityType       — 'devlet' | 'vakif' | 'us_private'
 * @param {string} difficulty           — 'kolay' | 'normal' | 'zor'
 * @param {string[]} selectedDepartments — Açılacak bölüm id'leri
 * @returns {object} Başlangıç state özeti
 */
export function initGame(playerName, universityName, universityType, difficulty, selectedDepartments, scenarioId = null) {
  // Geçerlilik kontrolleri
  // us_private için UNIVERSITY_TYPES'ta doğrudan karşılık yok; vakif template'ini baz al
  const baseTypeKey  = universityType === 'us_private' ? 'vakif' : universityType;
  if (!UNIVERSITY_TYPES[baseTypeKey]) {
    throw new Error(`Bilinmeyen üniversite tipi: ${universityType}`);
  }
  if (!DIFFICULTY_SETTINGS[difficulty]) {
    throw new Error(`Bilinmeyen zorluk seviyesi: ${difficulty}`);
  }

  const uniTemplate  = UNIVERSITY_TYPES[baseTypeKey];
  const diffSettings = DIFFICULTY_SETTINGS[difficulty];

  // Bölümleri state formatına dönüştür
  const departments = selectedDepartments
    .filter(id => DEPARTMENTS[id])
    .map(id => buildDepartmentState(id));

  // Başlangıç hocaları (faculty.js: generateInitialFaculty(departments, universityType, count))
  const faculty = generateInitialFaculty(departments.map(d => d.id), universityType);

  // Başlangıç öğrencileri (yeni YKS/kontenjan sistemi)
  const startPrestige = uniTemplate.startPrestige + (uniTemplate.publicPrestigeBonus || 0);
  const studentData   = generateInitialStudents(
    departments,
    universityType,
    uniTemplate.startStudents,
    startPrestige,
  );

  // Bütçeyi zorluk çarpanıyla ayarla
  const startBudget = Math.floor(uniTemplate.startBudget * diffSettings.startBudgetMultiplier);

  // Rakipleri kopyala (AI simülasyonu bu kopyalar üzerinde çalışır)
  const rivals = INITIAL_RIVAL_UNIVERSITIES.map(r => ({
    ...deepClone(r),
    // Zorluk seviyesine göre agresifliği ölçekle
    aggressiveness: Math.min(1, r.aggressiveness * diffSettings.rivalAggressiveness / 0.65),
  }));

  // Trend ısılarını başlat
  const trendHeats = initTrendHeats();

  // State oluştur
  _state = {
    // ── Meta bilgiler ──────────────────────────────────────────────────────
    meta: {
      playerName,
      turn:           1,
      year:           1,
      semester:       'güz',          // 'güz' | 'bahar'
      difficulty,
      universityType,
      isSandbox:      false,          // sandbox: kazanma koşulu yok
      startDate:      new Date().toISOString(),
    },

    // ── Üniversite profili ─────────────────────────────────────────────────
    university: {
      name:           universityName,
      budget:         startBudget,
      debt:           0,
      prestige:       startPrestige,
      ranking:        50,             // başlangıç sıralaması (1 en iyi)
      type:           universityType,

      // Finansal geçmiş (son N dönem)
      budgetHistory:  [],
      tuitionPerSemester: universityType === 'us_private'
        ? Math.round((UNIVERSITY_MODELS.us_private.revenueStreams.tuition.perStudentUSD * USD_TO_TL) / 2)
        : uniTemplate.tuitionPerSemester,
      tuitionControl: uniTemplate.tuitionControl,

      // Endowment (ABD modeli; TR modellerde 0)
      endowment: universityType === 'us_private'
        ? UNIVERSITY_MODELS.us_private.revenueStreams.endowment.base
        : 0,
      // Financial aid oranı (ABD modeli; TR vakıfta burs sistem ayrı)
      financialAidRate: universityType === 'us_private' ? 0.45 : 0,

      // Kapasite metrikleri
      totalStudentCapacity: uniTemplate.startStudents * 1.2,
      dormBeds:       0,
      internationalRatio: 0.02,       // başlangıç yabancı öğrenci oranı

      // Özellikler
      hasHospital:    false,
      hasClinic:      false,
      hasTechnoPark:  false,

      // Sıralama bileşen puanları
      scores: {
        education:           50,
        research:            30,
        alumni:              20,
        satisfaction:        55,
        internationalization: 10,
      },

      // Trend verileri
      trendHeats,

      // Bütçe dağılım hedefleri (oyuncu ayarlar, %100 toplamı gerekli)
      budgetAllocation: {
        faculty:    0.40,             // hoca maaş ve gelişim
        research:   0.20,             // araştırma fonu
        students:   0.20,             // burs, yurt, sosyal
        marketing:  0.10,             // tanıtım, rekrutman
        it:         0.05,             // BT altyapı
        reserve:    0.05,             // acil rezerv
      },

      // ── Kredi sistemi ──────────────────────────────────────────────────
      loans:        [],               // aktif kredi listesi
      totalDebt:    0,                // toplam kalan borç (₺)
      loanDefault:  false,            // 3+ dönem ödeme atlanırsa true → iflas
    },

    // ── Bölümler ───────────────────────────────────────────────────────────
    departments,

    // ── Hocalar ────────────────────────────────────────────────────────────
    faculty,

    // ── Öğrenciler (v2: YKS + Kontenjan sistemi) ───────────────────────────
    students: {
      // Bölüm bazlı sınıf verileri
      byDepartment:  studentData.byDepartment,
      // Oyuncu kontenjanları (güzde değiştirilir)
      quotas:        studentData.quotas,
      // Yıldız öğrenciler
      starStudents:  studentData.starStudents,
      // Toplam kayıtlı (hesaplanmış)
      totalEnrolled: studentData.totalEnrolled,
      // Memnuniyet
      overallSatisfaction: studentData.overallSatisfaction,
      satisfactionBreakdown: null,
      // Kontenjan belirleme ekranının gösterilip gösterilmediği
      quotaScreenShown: false,
    },

    // ── Mezunlar ───────────────────────────────────────────────────────────
    alumni: [],

    // ── Mezun Sistemi (v0.2) ───────────────────────────────────────────────
    alumniData: {
      totalGraduates: 0,
      notableAlumni: [],
      alumniByDecade: {},
      annualDonations: 0,
      alumniPrestigeBonus: 0,
      alumniNetwork: 0,
      totalDonations: 0,
    },

    // ── Başarımlar (v0.2) ──────────────────────────────────────────────────
    achievements: {},

    // ── Rastgele Olay Geçmişi (v0.2) ──────────────────────────────────────
    _randomEventsState: { history: [], pendingEvents: [] },

    // ── Bekleyen Rastgele Olaylar (v0.2) ───────────────────────────────────
    pendingRandomEvents: [],

    // ── Binalar ────────────────────────────────────────────────────────────
    buildings: _buildInitialBuildings(),

    // ── Araştırma ──────────────────────────────────────────────────────────
    research: {
      activeProjects:              [],   // geriye dönük uyumluluk için
      activeResearchProjects:      [],
      completedProjects:           [],
      pendingProjectApplications:  [],   // oyuncunun onayını bekleyen başvurular
      externalCalls:               [],   // bu dönem açık dış çağrılar
      activeBapCall:               null, // aktif BAP çağrısı (veya null)
      bapApplications:             [],   // BAP başvuruları
      publications:    0,
      patents:         0,
      patentRoyalties: 0,               // yıllık patent telif geliri toplamı (₺)
      totalCitations:  0,
      hIndex:          0,
      tubitakProjects: 0,
      euProjects:      0,
    },

    // ── Üniversite Ayarları ────────────────────────────────────────────────
    universitySettings: {
      overheadRate: 0.15,               // proje genel gider kesinti oranı (0–1)
    },

    // ── Rakipler ───────────────────────────────────────────────────────────
    rivals,

    // ── Olaylar ────────────────────────────────────────────────────────────
    events: {
      current:  null,
      history:  [],
      pendingDecision: null,          // oyuncunun cevap bekleyen kararı
    },

    // ── İdari birimler (eski — geriye dönük uyumluluk) ─────────────────────
    admin: {
      units:            buildAdminUnits(),
      generalSecretary: null,
    },

    // ── Yeni idari birimler (ADMIN_UNITS sistemine göre) ────────────────────
    // adminUnits ve adminStaff aşağıda doldurulacak
    adminUnits:  null,
    adminStaff:  null,

    // ── İstatistik geçmişi (her tur sonunda kaydedilir) ───────────────────
    stats: {
      history: [],
    },

    // ── Dahili sayaçlar ────────────────────────────────────────────────────
    _internal: {
      consecutiveDeficitTurns: 0,
      consecutiveLowStudentTurns: 0,
      gameOver: false,
      gameWon: false,
    },

    // ── Araştırma bütçesi (hoca başına dönemlik fon) ───────────────────────
    researchBudgetPerFaculty: 50_000,

    // ── Fakülte yapısı (Mühendislik, Fen-Ed, İşletme, ...) ─────────────────
    fakulteler: _buildFakultelerState(departments),

    // ── Açık Kadro İlanları ────────────────────────────────────────────────
    openPositions:    [],   // { id, department, title, field, offeredSalary, researchFund, hasLab, postedTurn }

    // ── Bekleyen Başvurular ────────────────────────────────────────────────
    pendingApplicants: [],  // generateApplicants() tarafından üretilir, oyuncu onaylar

    // ── İlan Dışı (Spontane) Başvurular ────────────────────────────────────
    spontaneousApplicants: [],  // Her dönem otomatik olarak gelir

    // ── Feature 2: YÖK Onay Bekleyen Başvurular ────────────────────────────
    pendingApplications: [],  // { id, type, deptId, facultyId, programType, turnsRemaining, submittedTurn, requirements }

    // ── Feature 1: Lisansüstü Öğrenci Verisi ──────────────────────────────
    gradStudents: {
      byDepartment: {},  // { deptId: { yuksek_lisans: {...}, doktora: {...} } }
      totalYL: 0,
      totalPhD: 0,
    },
  };

  // Yeni idari birimler — state kurulumundan sonra başlatılır
  const initStudentCount = _state.students?.totalEnrolled || uniTemplate.startStudents;
  _state.adminUnits = buildAdminUnitStates(initStudentCount);
  _state.adminStaff = generateInitialAdminStaff(initStudentCount);
  syncAdminUnitStats(_state.adminUnits, _state.adminStaff, _state.buildings);

  // Bölüm başkanı atama: her bölüme en yüksek yönetim statına sahip Prof/Doç ata
  _autoAssignDeptHeads(_state);

  // Sayaçları sıfırla
  _bankruptcyTurns = 0;
  _lowStudentTurns = 0;
  _gameOver        = false;
  _gameWon         = false;

  // Başlangıç ders ataması — eğitim kalitesi ve hoca yükleri için
  assignCourses(_state);

  // Başlangıç bölüm istatistiklerini hesapla
  calculateDepartmentStats(_state);

  // Başlangıç memnuniyet kırılımı hesapla
  const initSatResult = calculateStudentSatisfaction(_state);
  _state.students.overallSatisfaction   = initSatResult.score ?? initSatResult;
  _state.students.satisfactionBreakdown = initSatResult.breakdown || null;

  // Bölüm istatistiklerini senkronize et
  calculateDepartmentStats(_state);

  // ── v0.3 Feature: TTO state başlat ───────────────────────────────────────
  initTTOState(_state);

  // ── v0.3 Feature: Kulüpler state başlat ──────────────────────────────────
  initClubsState(_state);

  // ── v0.4 Feature: Spor takımları state başlat ────────────────────────────
  initSportsState(_state);

  // ── v0.4 Feature: Kampüs grid layout başlat ──────────────────────────────
  try {
    initCampusState(_state);
  } catch (e) {
    console.error('[game] initCampusState HATASI:', e.message, e.stack);
  }

  // ── Senaryo kurallarını uygula ────────────────────────────────────────────
  if (scenarioId && SCENARIOS[scenarioId]) {
    const scenario = SCENARIOS[scenarioId];
    _state.meta.scenarioId          = scenarioId;
    _state.meta.scenarioRules       = scenario.specialRules || null;
    _state.meta.scenarioWinCondition = scenario.winCondition || null;
    _state.meta.scenarioPositiveTurns = 0; // budget_positive sayacı

    // Başlangıç bütçe override
    if (scenario.startBudgetOverride != null) {
      _state.university.budget = scenario.startBudgetOverride;
    }
    // Başlangıç prestij override
    if (scenario.startPrestigeOverride != null) {
      _state.university.prestige = scenario.startPrestigeOverride;
    }
    // Borç (vakıf kurtarma veya köklü devlet)
    if (scenario.specialRules?.startingDebt) {
      _state.university.debt = scenario.specialRules.startingDebt;
    }
    if (scenario.specialRules?.legacyDebt) {
      _state.university.debt = scenario.specialRules.legacyDebt;
    }
    // Yıpranmış binalar (agingInfrastructure)
    if (scenario.specialRules?.agingInfrastructure) {
      _state.buildings.forEach(b => {
        if (b.condition != null) b.condition = Math.min(b.condition, 60);
      });
    }
  } else {
    _state.meta.scenarioId           = null;
    _state.meta.scenarioRules        = null;
    _state.meta.scenarioWinCondition = null;
    _state.meta.scenarioPositiveTurns = 0;
  }

  return {
    success: true,
    message: `${universityName} kuruldu! ${difficulty} modda oyun başlıyor.`,
    initialBudget: _state.university.budget,
    departmentCount: departments.length,
    facultyCount: faculty.length,
    studentCount: _state.students.totalEnrolled,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// applyQuotas — Oyuncunun kontenjan kararlarını kaydet
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Oyuncunun kontenjan belirleme ekranından onayladığı değerleri state'e yazar.
 *
 * @param {object} quotas — { deptId: { tamBurslu, yariBurslu, ucretli }, ... }
 */
export function applyQuotas(quotas) {
  if (!_state) throw new Error('Oyun başlatılmamış.');
  _state.students.quotas = { ..._state.students.quotas, ...quotas };
  _state.students.quotaScreenShown = true;
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// assignCourses — Dersleri Hocalara Ata
// Her bölüm için müfredatı alır ve uzmanlık eşleşmesine göre hocalara atar.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tüm bölümlerin derslerini uygun hocalara atar.
 * Uzmanlık eşleşmesi: hoca specializations içinde dersin requiredExpertise'i varsa tam eşleşme.
 * Kısmi eşleşme veya eşleşme yoksa düşük kalite atama yapılır.
 * Sonuçlar state'e yazılır: faculty.currentLoad.courses, dept.courseAssignments
 *
 * @param {object} state — Oyun durumu (doğrudan güncellenir)
 * @returns {object} Atama özeti
 */
export function assignCourses(state) {
  // Tüm hocaların ders yükünü sıfırla
  state.faculty.forEach(f => {
    f.currentLoad = f.currentLoad || {};
    f.currentLoad.courses = 0;
    f.currentLoad.assignedCourses = [];
    f.currentLoad.adminRole  = f.currentLoad.adminRole  || null;
    f.currentLoad.gradStudents = f.currentLoad.gradStudents || 0;
  });

  const summary = {
    totalCourses: 0,
    coveredCourses: 0,
    uncoveredCourses: [],
    expertiseMatchRate: 0,
    partTimeHires: 0,
    departmentResults: {},
  };

  let totalAssigned = 0;
  let totalExpertiseMatch = 0;

  state.departments.forEach(dept => {
    if (!dept.isOpen) return;

    const curriculum = DEPARTMENT_CURRICULA[dept.id] || [];
    const deptFaculty = state.faculty.filter(f => (f.department || f.departmentId) === dept.id);

    // Her hoca maksimum 3 ders verebilir (haftada ~12 saat)
    const MAX_COURSES_PER_FACULTY = 3;
    const deptResult = {
      courses: [],
      uncovered: [],
      partTimeHires: 0,
    };

    // Önce zorunlu dersler, sonra seçmeli
    const sorted = [...curriculum].sort((a, b) => {
      if (a.type === 'zorunlu' && b.type !== 'zorunlu') return -1;
      if (a.type !== 'zorunlu' && b.type === 'zorunlu') return  1;
      return b.difficulty - a.difficulty;  // zorluk azalan sıra
    });

    sorted.forEach(course => {
      summary.totalCourses++;

      // Uzmanlık eşleşmesine göre hoca bul
      // Önce tam eşleşme (expertise doğrudan derse uyuyor)
      let assignee = null;
      let matchQuality = 0; // 0=yok, 1=kısmi, 2=tam

      // Tam eşleşme: hoca specializations'ında dersin requiredExpertise'i var
      const fullMatches = deptFaculty.filter(f => {
        const load = (f.currentLoad?.assignedCourses || []).length;
        if (load >= MAX_COURSES_PER_FACULTY) return false;
        return (f.specializations || []).some(s =>
          s.toLowerCase() === (course.requiredExpertise || '').toLowerCase()
        );
      });

      if (fullMatches.length > 0) {
        // En düşük yükü olan tam eşleşen hocayı seç
        assignee = fullMatches.reduce((best, f) =>
          (f.currentLoad?.assignedCourses || []).length <
          (best.currentLoad?.assignedCourses || []).length ? f : best
        );
        matchQuality = 2;
      } else {
        // Kısmi eşleşme: aynı bölümde, henüz dolmamış herhangi bir hoca
        const available = deptFaculty.filter(f =>
          (f.currentLoad?.assignedCourses || []).length < MAX_COURSES_PER_FACULTY
        );
        if (available.length > 0) {
          // Eğitim puanı en yüksek olanı seç
          assignee = available.reduce((best, f) =>
            (f.stats?.teaching || 50) > (best.stats?.teaching || 50) ? f : best
          );
          matchQuality = 1;
        }
      }

      if (assignee) {
        if (!assignee.currentLoad.assignedCourses) assignee.currentLoad.assignedCourses = [];
        assignee.currentLoad.assignedCourses.push({
          courseId:     course.id,
          courseName:   course.name,
          matchQuality, // 1=kısmi, 2=tam
          type:         course.type,
          difficulty:   course.difficulty,
        });
        assignee.currentLoad.courses = assignee.currentLoad.assignedCourses.length;

        deptResult.courses.push({
          course,
          assignedTo: assignee.id,
          assignedName: assignee.name,
          matchQuality,
        });
        summary.coveredCourses++;
        totalAssigned++;
        if (matchQuality === 2) totalExpertiseMatch++;
      } else {
        // Hoca yok — dışarıdan (part-time) öğretim görevlisi gerekli
        deptResult.uncovered.push(course);
        deptResult.partTimeHires++;
        summary.partTimeHires++;
        summary.uncoveredCourses.push({ deptId: dept.id, deptName: dept.name, course });
      }
    });

    // Bölüm sonuçlarını dept state'ine yaz
    dept.courseAssignments = deptResult.courses;
    dept.uncoveredCourses  = deptResult.uncovered;
    dept.partTimeHires     = deptResult.partTimeHires;

    // Bölüm öğretim kalitesini güncelle (expertise match oranı ve hoca eğitim puanı)
    const assignedCount = deptResult.courses.length;
    if (assignedCount > 0) {
      const avgMatchScore = deptResult.courses.reduce((s, c) =>
        s + (c.matchQuality === 2 ? 1.0 : c.matchQuality === 1 ? 0.6 : 0), 0
      ) / assignedCount;

      const avgTeachingStat = deptFaculty.length > 0
        ? deptFaculty.reduce((s, f) => s + (f.stats?.teaching || 50), 0) / deptFaculty.length
        : 50;

      const coverageRatio = curriculum.length > 0
        ? assignedCount / curriculum.length
        : 1;

      // Eğitim kalitesi: %40 uzmanlık eşleşme, %40 hoca eğitim puanı, %20 kapsama oranı
      dept.educationQuality = Math.round(
        avgMatchScore    * 0.40 * 100 +
        avgTeachingStat  * 0.40       +
        coverageRatio    * 0.20 * 100
      );
      dept.educationQuality = Math.max(0, Math.min(100, dept.educationQuality));
    }

    summary.departmentResults[dept.id] = deptResult;
  });

  summary.expertiseMatchRate = totalAssigned > 0
    ? Math.round((totalExpertiseMatch / totalAssigned) * 100)
    : 0;

  return summary;
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateDepartmentStats — Bölüm ve ders istatistiklerini hesapla
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Her bölüm için öğrenci dağılımı, akademik performans ve ders istatistiklerini hesaplar.
 * Sonuçlar doğrudan dept.stats nesnesine yazılır.
 *
 * @param {object} state — Oyun durumu (doğrudan güncellenir)
 */
export function calculateDepartmentStats(state) {
  state.departments.forEach(dept => {
    if (!dept.isOpen) return;

    // ── Öğrenci dağılımı (yeni byDepartment yapısı) ───────────────────────────
    const deptData = state.students.byDepartment?.[dept.id];

    const yr1data = deptData?.year1 || { count: 0, avgGPA: 0, satisfaction: 60 };
    const yr2data = deptData?.year2 || { count: 0, avgGPA: 0, satisfaction: 60 };
    const yr3data = deptData?.year3 || { count: 0, avgGPA: 0, satisfaction: 60 };
    const yr4data = deptData?.year4 || { count: 0, avgGPA: 0, satisfaction: 60 };

    const byYear = {
      1: yr1data.count || 0,
      2: yr2data.count || 0,
      3: yr3data.count || 0,
      4: yr4data.count || 0,
    };
    const totalEnrolled = byYear[1] + byYear[2] + byYear[3] + byYear[4];

    // Ağırlıklı ortalama GPA ve satisfaction
    const avgGPAWeighted = totalEnrolled > 0
      ? [yr1data, yr2data, yr3data, yr4data].reduce((s, y) => s + (y.avgGPA || 0) * (y.count || 0), 0) / totalEnrolled
      : 0;
    const avgSatWeighted = totalEnrolled > 0
      ? [yr1data, yr2data, yr3data, yr4data].reduce((s, y) => s + (y.satisfaction || 60) * (y.count || 0), 0) / totalEnrolled
      : 60;

    let totalDropouts = totalEnrolled * 0.02;  // yaklaşık bırakma tahmini

    const capacity = dept.studentCapacity || 100;

    // ── Bölüm hocaları ────────────────────────────────────────────────────────
    const deptFaculty = state.faculty.filter(f => (f.department || f.departmentId) === dept.id);
    const avgTeaching = deptFaculty.length > 0
      ? deptFaculty.reduce((s, f) => s + (f.stats?.teaching || f.teachingScore || 50), 0) / deptFaculty.length
      : 50;

    // ── Müfredat zorluk ortalaması (1-5 ölçeği) ───────────────────────────────
    const curriculum = DEPARTMENT_CURRICULA[dept.id] || [];
    const avgCourseDifficulty = curriculum.length > 0
      ? curriculum.reduce((s, c) => s + (c.difficulty || 3), 0) / curriculum.length
      : 3;

    // ── Başarısızlık oranı ────────────────────────────────────────────────────
    // Zorluk, sınıf büyüklüğü ve hoca kalitesi etkiler
    const fillRatio = capacity > 0 ? totalEnrolled / capacity : 0;
    const sizePenalty = fillRatio > 1.0 ? 0.10 : fillRatio > 0.90 ? 0.05 : 0;
    const difficultyFactor = (avgCourseDifficulty - 1) / 4;  // 0-1 arası
    const teachingFactor   = 1 - (avgTeaching / 100);        // düşük hoca kalitesi = yüksek başarısızlık

    const baseFailureRate = 0.05 + difficultyFactor * 0.20 + teachingFactor * 0.15 + sizePenalty;
    // Hafif rastgele varyasyon (±2%)
    const failureRate = Math.min(0.60, Math.max(0, baseFailureRate + (Math.random() * 0.04 - 0.02)));

    // ── Ortalama GPA ──────────────────────────────────────────────────────────
    const avgGPA = avgGPAWeighted;

    // ── Mezuniyet oranı ───────────────────────────────────────────────────────
    // Başarısızlık ve bırakma oranından türet: yüksek kalite = yüksek mezuniyet
    const dropoutRate    = totalEnrolled > 0 ? Math.min(0.30, totalDropouts / Math.max(1, totalEnrolled)) : 0;
    const graduationRate = Math.max(0, 1 - failureRate * 0.5 - dropoutRate);

    // ── Ders istatistikleri (ders bazlı öğrenci/not dağılımı) ─────────────────
    const assignments = dept.courseAssignments || [];
    const courseStats = curriculum.map(course => {
      const assign     = assignments.find(a => a.course?.id === course.id);
      const isUncovered = (dept.uncoveredCourses || []).some(u => u.id === course.id);

      // Derse kayıtlı öğrenci tahmini: idealClassSize'a göre ölçekle
      const idealSize  = course.idealClassSize || 40;
      const enrolled   = Math.min(totalEnrolled, Math.round(idealSize * Math.min(1.2, fillRatio + 0.3)));

      // Ders not ortalaması: hoca kalitesi + dersin zor/kolay olmasına göre
      const teachingBonus = assign ? (assign.matchQuality === 2 ? 10 : assign.matchQuality === 1 ? 0 : -10) : -15;
      const diffPenalty   = (course.difficulty - 1) * 5;
      const courseAvgGrade = Math.max(40, Math.min(95,
        60 + teachingBonus - diffPenalty + Math.round(avgTeaching * 0.2)
      ));

      // Geçme/kalma oranı
      const coursePassRate = Math.max(0.40, Math.min(1.0,
        1 - failureRate * (course.difficulty / 3)
      ));

      return {
        id:          course.id,
        name:        course.name,
        type:        course.type,
        difficulty:  course.difficulty,
        enrolled,
        passRate:    parseFloat(coursePassRate.toFixed(2)),
        avgGrade:    courseAvgGrade,
        facultyName: assign ? (assign.assignedName || '—') : (isUncovered ? 'Dışarıdan hoca' : '—'),
        matchQuality: assign ? assign.matchQuality : 0,
      };
    });

    // ── Bölüm başkanı etkisi ──────────────────────────────────────────────────
    // Bölüm başkanı varsa yönetim statına göre bonus/ceza uygula
    let headMgmtBonus = 0;  // eğitim kalitesine etki
    let headSatBonus  = 0;  // memnuniyete etki
    if (dept.headId) {
      const head = (state.faculty || []).find(f => f.id === dept.headId);
      if (head) {
        const mgmt = head.stats?.management ?? 50;
        // Yönetim 75+ → +5 eğitim/memnuniyet; 50-75 → 0; altı → -5
        headMgmtBonus = mgmt >= 75 ? 5 : mgmt >= 50 ? 0 : -5;
        headSatBonus  = mgmt >= 75 ? 4 : mgmt >= 50 ? 0 : -4;
      }
    } else {
      // Başkansız bölüm: -5 eğitim kalitesi cezası
      headMgmtBonus = -5;
      headSatBonus  = -3;
    }

    // Eğitim kalitesini ve memnuniyeti güncelle
    dept.educationQuality  = Math.max(0, Math.min(100, (dept.educationQuality || 50) + headMgmtBonus));
    dept.studentSatisfaction = Math.max(0, Math.min(100, (dept.studentSatisfaction || 50) + headSatBonus));

    // ── Sonuçları dept.stats nesnesine yaz ────────────────────────────────────
    dept.stats = {
      // Öğrenci dağılımı
      byYear,
      totalEnrolled,
      capacity,

      // Akademik performans
      failureRate:    parseFloat(failureRate.toFixed(3)),
      avgGPA:         parseFloat(avgGPA.toFixed(2)),
      difficultyRating: parseFloat(avgCourseDifficulty.toFixed(1)),
      graduationRate: parseFloat(graduationRate.toFixed(3)),
      dropoutRate:    parseFloat(dropoutRate.toFixed(3)),

      // Ders istatistikleri
      courseStats,

      // Bölüm başkanı bilgisi
      headId:         dept.headId || null,
      headMgmtBonus,
    };

    // enrolledStudents alanını da güncelle (getDepartmentSummaries uyumluluğu)
    dept.enrolledStudents = totalEnrolled;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// applyStudentAttrition — Öğrenci ayrılış ve yatay geçiş simülasyonu
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Her dönem öğrenci kaybı ve yatay geçiş hesaplar.
 * Akademik başarısızlık, memnuniyetsizlik ve prestij farkı nedeniyle ayrılma.
 * @param {object} state — Oyun durumu
 * @returns {{ totalDropouts, totalTransferOut, totalTransferIn, failDropouts, dissatisfiedDropouts }}
 */
function applyStudentAttrition(state) {
  const byDept   = state.students?.byDepartment || {};
  const prestige = isNaN(state.university.prestige) ? 0 : (state.university.prestige || 0);

  let totalDropouts    = 0;
  let totalTransferOut = 0;
  let totalTransferIn  = 0;
  let failDropouts     = 0;
  let dissatisfiedDropouts = 0;

  const depts = state.departments.filter(d => d.isOpen);

  for (const dept of depts) {
    const deptStudents = byDept[dept.id];
    if (!deptStudents) continue;

    const deptSatisfaction = dept.studentSatisfaction ?? 60;

    for (const yearKey of ['year1', 'year2', 'year3', 'year4']) {
      const yr = deptStudents[yearKey];
      if (!yr || !yr.count || yr.count <= 0) continue;

      let dropouts = 0;
      let transfersOut = 0;

      // 1. Akademik başarısızlık ile ayrılma
      const avgGPA = yr.avgGPA || 2.5;
      if (avgGPA < 2.0) {
        // GPA < 2.0: %5 × (2.0 - GPA) oranında ayrılma
        dropouts += Math.floor(yr.count * 0.05 * Math.max(0, 2.0 - avgGPA));
        failDropouts += dropouts;
      }

      // 2. Memnuniyetsizlik nedeniyle bırakma
      if (deptSatisfaction < 50) {
        const dissDrops = Math.floor(yr.count * 0.02 * (50 - deptSatisfaction) / 50);
        dropouts += dissDrops;
        dissatisfiedDropouts += dissDrops;
      }

      // 3. Yatay geçiş çıkışı (sadece 2. ve 3. sınıf)
      if ((yearKey === 'year2' || yearKey === 'year3') && prestige < 60) {
        const transferChance = 0.02 * (1 + (deptSatisfaction < 50 ? 0.5 : 0));
        transfersOut = Math.floor(yr.count * transferChance);
      }

      // Toplam sayıyı düş
      const loss = Math.min(yr.count, dropouts + transfersOut);
      yr.count = Math.max(0, yr.count - loss);

      totalDropouts    += dropouts;
      totalTransferOut += transfersOut;
    }

    // 4. Yatay geçiş girişi (2. ve 3. sınıfa, prestij > 30 ise)
    if (prestige > 30) {
      const maxIn = Math.floor(Math.random() * (prestige / 30));
      if (maxIn > 0) {
        const inYear2 = Math.ceil(maxIn / 2);
        const inYear3 = Math.floor(maxIn / 2);
        if (deptStudents.year2) deptStudents.year2.count += inYear2;
        if (deptStudents.year3) deptStudents.year3.count += inYear3;
        totalTransferIn += maxIn;
      }
    }
  }

  return { totalDropouts, totalTransferOut, totalTransferIn, failDropouts, dissatisfiedDropouts };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dış Proje / Fon Sistemi — Hoca Başvuru Tabanlı
// ─────────────────────────────────────────────────────────────────────────────

// Proje adı şablonları (alan bazlı)
const _PROJECT_NAME_TEMPLATES = {
  'Yazılım Mühendisliği':    ['{obj} için Yazılım Kalite Güvence Çerçevesi', 'Açık Kaynak {obj} Geliştirme Platformu', '{obj} Yazılım Test Otomasyon Sistemi'],
  'Ağ Sistemleri':           ['5G/6G Ağlarda {obj} Protokol Tasarımı', 'IoT Tabanlı {obj} İzleme Sistemi', 'Yazılım Tanımlı Ağlarda {obj} Güvenliği'],
  'Veri Tabanları':          ['Büyük Veri Ortamlarında {obj} Yönetim Sistemi', 'Dağıtık {obj} Veritabanı Mimarisi', 'Gerçek Zamanlı {obj} Veri Analitiği Platformu'],
  'Gömülü Sistemler':        ['{obj} için Düşük Güçlü Gömülü Sistem Tasarımı', 'FPGA Tabanlı {obj} Hızlandırıcı Tasarımı', 'Gerçek Zamanlı {obj} Gömülü Kontrol Sistemi'],
  'Bilgisayar Mimarisi':     ['Yüksek Başarımlı {obj} İşlemci Mimarisi', '{obj} için Yeni Nesil Çip Mimarisi', 'Nöromorfik {obj} Hesaplama Mimarisi'],
  'Güvenlik':                ['{obj} Siber Güvenlik Tehdit Modelleme Sistemi', 'Yapay Zeka Tabanlı {obj} Saldırı Tespit Sistemi', 'Kriptografik {obj} Veri Koruma Altyapısı'],
  'Görüntü İşleme':          ['Derin Öğrenme Tabanlı {obj} Görüntü Analizi', 'Tıbbi {obj} Görüntü Segmentasyon Sistemi', '{obj} Nesne Tanıma ve Sınıflandırma Modeli'],
  'Makine Öğrenmesi':        ['{obj} için Federe Öğrenme Modeli', 'Açıklanabilir {obj} Makine Öğrenmesi Sistemi', 'Az Örnekli {obj} Öğrenme Algoritmaları'],
  'Derin Öğrenme':           ['Büyük Dil Modelleri ile {obj} Analizi', 'Otonom {obj} Sistemlerinde Pekiştirmeli Öğrenme', 'Derin Öğrenme Tabanlı {obj} Karar Destek Sistemi'],
  'Doğal Dil İşleme':        ['{obj} için Türkçe NLP Model Geliştirme', 'Büyük Dil Modeli Tabanlı {obj} Asistan Sistemi', '{obj} Duygu Analizi ve Metin Madenciliği Platformu'],
  'Bilgisayarla Görü':       ['{obj} Görsel Kalite Kontrol Sistemi', 'Gerçek Zamanlı {obj} Kamera Tabanlı Algılama', 'Stereoskopik {obj} 3 Boyutlu Yeniden Yapılandırma'],
  'Robotik':                 ['Robotik {obj} Kontrol Sistemi Tasarımı', 'Otonom {obj} için Adaptif Kontrol Algoritmaları', 'İnsan-Robot Etkileşiminde {obj} Güvenlik Sistemi'],
  'Pekiştirmeli Öğrenme':    ['{obj} için Çok Ajanlı Pekiştirmeli Öğrenme', 'Simüle Ortamda {obj} Politika Optimizasyonu', 'Güvenli {obj} Pekiştirmeli Öğrenme Çerçevesi'],
  'Güç Sistemleri':          ['Yenilenebilir Enerji Kaynaklı {obj} Şebeke Entegrasyonu', 'Akıllı Şebeke için {obj} Enerji Yönetimi', 'Elektrikli Araçlarda {obj} Güç Elektroniği Tasarımı'],
  'Sinyal İşleme':           ['{obj} için Gelişmiş Sinyal İşleme Teknikleri', 'Radar Tabanlı {obj} Algılama Sistemi', 'Biyomedikal {obj} Sinyal Analizi'],
  'Mikrodenetleyiciler':     ['Düşük Güçlü {obj} VLSI Tasarımı', '{obj} için Gömülü Mikrodenetleyici Platformu', 'Endüstriyel {obj} IoT Denetleyici Tasarımı'],
  'Devre Tasarımı':          ['{obj} için Analog Devre Optimizasyonu', 'Düşük Gürültülü {obj} Devre Tasarım Metodolojisi', 'Yüksek Frekanslı {obj} RF Devre Analizi'],
  'Haberleşme':              ['Milimetre Dalga {obj} Haberleşme Sistemi', 'Çok Antenli {obj} MIMO Alıcı-Verici Tasarımı', '{obj} Kablosuz Kanal Modelleme ve Analizi'],
  'Termodinamik':            ['Isı Transferi ile {obj} Verimlilik Artırma', '{obj} için Termal Yönetim Sistemi', 'Yenilenebilir {obj} Enerji Dönüşüm Sistemi'],
  'Akışkanlar Mekaniği':     ['{obj} Akışkan Dinamiği Simülasyonu', '{obj} için Hesaplamalı Akışkanlar Analizi', 'Türbülanslı {obj} Akış Optimizasyonu'],
  'Malzeme Bilimi':          ['Nano Yapılı {obj} Malzeme Sentezi', 'Kompozit {obj} Malzemelerde Dayanım Optimizasyonu', 'İleri {obj} Malzeme Karakterizasyonu'],
  'Enerji Sistemleri':       ['Hibrit {obj} Enerji Depolama Sistemi', 'Akıllı {obj} Enerji Verimliliği Optimizasyonu', 'Yenilenebilir {obj} Enerji Entegrasyon Modeli'],
  'Yapı Mühendisliği':       ['Depreme Dayanıklı {obj} Yapı Tasarımı', '{obj} Betonarme Yapıların Güçlendirilmesi', 'Akıllı {obj} Yapısal Sağlık İzleme Sistemi'],
  'Deprem Mühendisliği':     ['{obj} Yapıların Sismik Analizi', 'Sismik İzolasyon ile {obj} Performans Değerlendirmesi', 'Türkiye Deprem Riskinde {obj} Azaltma Yöntemleri'],
  'Geoteknik':               ['{obj} Zemin Güçlendirme Teknikleri', '{obj} Temel Mühendisliğinde Yenilikçi Yaklaşımlar', 'Afet Sonrası {obj} Zemin Stabilizasyonu'],
  'Operasyon Araştırması':   ['{obj} Tedarik Zinciri Optimizasyonu', 'Üretim Sistemlerinde {obj} Çizelgeleme', '{obj} Lojistik Ağ Tasarımı ve Optimizasyonu'],
  'Finans':                  ['{obj} Finansal Risk Modelleme ve Yönetimi', 'Fintek Tabanlı {obj} Ödeme Sistemi', 'Sürdürülebilir {obj} Yatırım Analizi'],
  'Pazarlama':               ['Dijital {obj} Pazarlama Stratejisi Analizi', '{obj} Tüketici Davranışı ve Karar Süreçleri', 'Sosyal Medya {obj} Marka Yönetimi Modeli'],
  'Stratejik Yönetim':       ['{obj} Kurumsal Yönetişim ve Strateji', 'KOBİ\'lerde {obj} Dijital Dönüşüm', '{obj} Rekabet Stratejisi ve Sürdürülebilirlik'],
  'İnsan Kaynakları':        ['İnsan Kaynakları {obj} Yönetim Modeli', '{obj} Çalışan Bağlılığı ve Performans Sistemi', 'Uzaktan Çalışma Ortamında {obj} Yönetimi'],
  'Makroekonomi':            ['Makroekonomik {obj} Modelleme ve Tahmin', '{obj} Para Politikası Etkinlik Analizi', 'Dijital {obj} Ekonomi Dönüşümü Analizi'],
  'Mikroekonomi':            ['{obj} Piyasalarında Davranışsal Analiz', '{obj} Piyasa Tasarımı ve Refah Analizi', 'Bilgi Asimetrisi ve {obj} Piyasa Başarısızlıkları'],
  'Klinik Psikoloji':        ['{obj} Hastalıklarında Yeni Tanı Yöntemleri', 'Kişiselleştirilmiş {obj} Tedavi Yaklaşımları', '{obj} Biyobelirteçlerinin Klinik Değerlendirmesi'],
  'Kardiyoloji':             ['İleri Evre {obj} Kardiyak Tanı Yöntemi', '{obj} Kalp Yetmezliği Erken Tespit Sistemi', 'Yapay Zeka Destekli {obj} EKG Analizi'],
  'Onkoloji':                ['{obj} Kanser Erken Tanı Biyobelirteçleri', 'Hedefe Yönelik {obj} Kanser Tedavi Modeli', 'İmmünoterapi Tabanlı {obj} Kanser Araştırması'],
  'Medeni Hukuk':            ['Dijital {obj} Hakların Korunması', 'Yapay Zeka ve {obj} Hukuku Karşılaştırmalı Analiz', '{obj} Kişisel Veri Gizliliği Hukuk Çerçevesi'],
  'Ticaret Hukuku':          ['E-Ticaret {obj} Hukuki Düzenleme Analizi', 'Uluslararası {obj} Hukuk Normları Araştırması', 'Fintech {obj} Regülasyon Çerçevesi'],
  'default': [
    '{obj} Alanında Yenilikçi Yaklaşımlar',
    '{obj} Sistemlerinin Analizi ve Geliştirilmesi',
    '{obj} için Disiplinlerarası Araştırma Projesi',
    'Türkiye\'de {obj} Uygulamaları ve Gelecek Perspektifleri',
    '{obj} Tabanlı Çözüm Yöntemlerinin Araştırılması',
  ],
};

// Alan bazlı nesne havuzu ({obj} yerine konulacak)
const _PROJECT_OBJECTS = {
  'Yazılım Mühendisliği':    ['Sağlık Sistemi', 'E-Devlet', 'Finans', 'Eğitim', 'Lojistik'],
  'Ağ Sistemleri':           ['Araç İçi', 'Endüstriyel', 'Kampüs', 'Uydu', 'Sualtı'],
  'Veri Tabanları':          ['Sağlık', 'E-Ticaret', 'Coğrafi', 'Zaman Serisi', 'Akıllı Şehir'],
  'Görüntü İşleme':          ['Medikal', 'Trafik', 'Tarımsal', 'Sanayi', 'Güvenlik'],
  'Makine Öğrenmesi':        ['Sağlık', 'Finans', 'İklim', 'Tarım', 'Enerji'],
  'Derin Öğrenme':           ['Medikal Görüntü', 'Doğal Dil', 'Trafik', 'Tarımsal Verim', 'Otonom Araç'],
  'Doğal Dil İşleme':        ['Haber', 'Hukuk Metni', 'Tıbbi Kayıt', 'Eğitim', 'Müşteri Hizmet'],
  'Bilgisayarla Görü':       ['Patoloji', 'Kalite Kontrol', 'Tarla', 'Üretim Hattı', 'Kent'],
  'Robotik':                 ['Drone', 'İnsansız Kara Aracı', 'Cerrahi Robot', 'CNC', 'Lojistik Robot'],
  'Güç Sistemleri':          ['Rüzgar', 'Güneş', 'Hidrojen', 'Batarya', 'Yakıt Pili'],
  'Sinyal İşleme':           ['Konuşma', 'EEG', 'Titreşim', 'Akustik', 'Radar'],
  'Yapı Mühendisliği':       ['Köprü', 'Yüksek Bina', 'Tünel', 'Baraj', 'Prefabrik'],
  'Operasyon Araştırması':   ['Hastane', 'Liman', 'Havalimanı', 'Depo', 'Üretim'],
  'Finans':                  ['Kripto', 'Sigortacılık', 'Banka', 'Yatırım Fonu', 'Emeklilik'],
  'default':                 ['Sürdürülebilir Kalkınma', 'Çevresel', 'Toplumsal', 'Eğitim', 'Sağlık', 'Enerji', 'Ulaşım', 'Dijital'],
};

/**
 * Hoca uzmanlıklarına göre proje adı üretir.
 * @param {string[]} specializations — Hoca uzmanlık listesi
 * @returns {string}
 */
function _generateProjectName(specializations) {
  const spec = (specializations && specializations.length > 0) ? specializations[0] : null;
  const templates = (spec && _PROJECT_NAME_TEMPLATES[spec]) ? _PROJECT_NAME_TEMPLATES[spec] : _PROJECT_NAME_TEMPLATES['default'];
  const objects   = (spec && _PROJECT_OBJECTS[spec])   ? _PROJECT_OBJECTS[spec]   : _PROJECT_OBJECTS['default'];
  const template  = templates[Math.floor(Math.random() * templates.length)];
  const obj       = objects[Math.floor(Math.random() * objects.length)];
  return template.replace('{obj}', obj);
}

/**
 * Her dönem 3-6 dış çağrı üretir ve state.research.externalCalls'a ekler.
 * @param {object} state
 */
function _generateExternalCalls(state) {
  if (!state.research) state.research = {};
  if (!state.research.externalCalls) state.research.externalCalls = [];

  const openDepts  = state.departments.filter(d => d.isOpen);
  const prestige   = isNaN(state.university.prestige) ? 0 : (state.university.prestige || 0);

  // Geçmiş dönem çağrılarını temizle
  state.research.externalCalls = state.research.externalCalls.filter(c => c.deadline >= state.meta.turn);

  const count = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    // BAP hariç dış çağrı tipleri
    const eligible = PROJECT_TYPES.filter(pt => pt.id !== 'bap' && (
      pt.requiredCategories.length === 0 ||
      openDepts.some(d => pt.requiredCategories.includes(d.category))
    ));
    if (eligible.length === 0) continue;

    const template  = eligible[Math.floor(Math.random() * eligible.length)];
    const funding   = Math.round(randBetween(template.fundingMin, template.fundingMax) / 50_000) * 50_000;
    const fieldOpts = ['any', ...openDepts.map(d => d.category)];
    const field     = fieldOpts[Math.floor(Math.random() * fieldOpts.length)];

    // Çağrı zaten varsa ekleme
    const dupKey = `${template.id}_${state.meta.turn}_${i}`;
    if (state.research.externalCalls.some(c => c.id === dupKey)) continue;

    state.research.externalCalls.push({
      id:          dupKey,
      typeId:      template.id,
      name:        template.name,
      description: template.description,
      icon:        template.icon,
      fundingMin:  template.fundingMin,
      fundingMax:  template.fundingMax,
      funding,
      duration:    template.duration,
      deadline:    state.meta.turn + 1,
      field,
      announced:   state.meta.turn,
      prestigeReward:   template.prestigeReward,
      publicationBonus: template.publicationBonus,
      baseSuccessChance: template.baseSuccessChance,
    });
  }
}

/**
 * Başarı olasılığını hesapla (hoca araştırma skoru + prestij + baz şans).
 * @param {object} faculty
 * @param {object} call
 * @param {object} state
 * @returns {number} 0–1 arasında olasılık
 */
function _calcSuccessProb(faculty, call, state) {
  const researchScore = faculty.stats?.research || faculty.researchScore || 40;
  const prestige      = isNaN(state.university.prestige) ? 0 : (state.university.prestige || 0);
  const base          = call.baseSuccessChance || 0.30;
  const prob          = base * (1 + researchScore / 100) * (1 + prestige / 200);
  return Math.min(0.92, parseFloat(prob.toFixed(2)));
}

/**
 * Her dönem hocalar dış çağrılara otomatik başvurur ve sonuç hemen belirlenir.
 * Dış projeler oyuncu onayı gerektirmez; BAP ayrı sisteme devam eder.
 * Sonuçlar state.research.lastApplicationResults'a kaydedilir (UI için).
 * @param {object} state
 */
function _generateFacultyApplications(state) {
  if (!state.research) state.research = {};
  // pendingProjectApplications artık sadece eski kayıtlar için (geriye dönük uyumluluk)
  if (!state.research.pendingProjectApplications) state.research.pendingProjectApplications = [];
  if (!state.research.activeResearchProjects)     state.research.activeResearchProjects = [];
  if (!state.research.completedProjects)          state.research.completedProjects = [];
  if (!state.universitySettings)                  state.universitySettings = { overheadRate: 0.15 };
  if (!state.research.externalCalls) return;

  const openCalls      = state.research.externalCalls.filter(c => c.deadline >= state.meta.turn);
  const activeProjects = state.research.activeResearchProjects;

  // Bu dönem işlenen başvuru sonuçlarını sıfırla
  state.research.lastApplicationResults = {
    turn:      state.meta.turn,
    total:     0,
    accepted:  [],
    rejected:  [],
  };
  const res = state.research.lastApplicationResults;

  // Genel gider kesinti oranına göre hoca başvuru motivasyonu belirle
  const uniOverheadRate = state.universitySettings?.overheadRate ?? 0.15;
  let overheadPenalty = 1.0;
  if (uniOverheadRate > 0.30) overheadPenalty = 0.4;
  else if (uniOverheadRate > 0.25) overheadPenalty = 0.6;
  else if (uniOverheadRate > 0.20) overheadPenalty = 0.8;

  state.faculty.forEach(f => {
    // ArGö'ler nadiren başvurur
    if (f.title === 'argö' && Math.random() > 0.15) return;

    // Aktif projede olan hoca ek başvuru yapmaz (aşırı yük)
    const alreadyPI = activeProjects.some(p => p.piId === f.id);
    if (alreadyPI && Math.random() > 0.2) return;

    const researchScore = f.stats?.research || f.researchScore || 40;
    const courseLoad    = (f.currentLoad?.courses || 0);
    const baseApply     = (researchScore / 200) * Math.max(0.1, 1 - courseLoad / 8);
    const applyChance   = baseApply * overheadPenalty;

    openCalls.forEach(call => {
      // Bu dönem bu hoca bu çağrıya zaten başvurduysa veya aktif projesi varsa atla
      const alreadySubmitted = res.accepted.some(a => a.facultyId === f.id && a.callId === call.id)
        || res.rejected.some(a => a.facultyId === f.id && a.callId === call.id);
      if (alreadySubmitted) return;

      if (Math.random() < applyChance) {
        const projectName = _generateProjectName(f.specializations || f.researchAreas);
        const reqFunding  = Math.round(randBetween(call.fundingMin * 0.6, call.fundingMax) / 50_000) * 50_000;
        const titleMap    = { argö: 'ArGö', dr_ogr_uyesi: 'Dr.Öğr.Üyesi', docent: 'Doç.', profesor: 'Prof. Dr.' };
        const titleStr    = titleMap[f.title] || f.title || '';

        const successProb = _calcSuccessProb(f, call, state);
        const accepted    = Math.random() < successProb;

        res.total++;

        const appEntry = {
          id:                    `app_${state.meta.turn}_${f.id}_${call.id}`,
          facultyId:             f.id,
          facultyName:           `${titleStr} ${f.name}`,
          facultyTitle:          f.title,
          facultyDept:           f.department,
          callId:                call.id,
          callType:              call.name,
          callIcon:              call.icon,
          isPrivateSector:       call.isPrivateSector || false,
          callOverheadRate:      call.overheadRate ?? null,
          projectName,
          requestedFunding:      reqFunding,
          duration:              call.duration,
          estimatedPublications: Math.max(1, Math.floor(1 + researchScore / 30)),
          successProbability:    successProb,
          prestigeReward:        call.prestigeReward,
          publicationBonus:      call.publicationBonus,
          semester:              state.meta.turn,
        };

        if (accepted) {
          res.accepted.push({ ...appEntry, status: 'accepted' });
          // Aktif projeye ekle
          activeProjects.push({
            ...appEntry,
            status:       'active',
            piId:         f.id,
            piName:       `${titleStr} ${f.name}`,
            currentTurn:  0,
            progress:     0,
            successChance: successProb,
            funding:      reqFunding,
          });
        } else {
          res.rejected.push({ ...appEntry, status: 'rejected' });
        }
      }
    });
  });

  // Eski pendingProjectApplications listesini temizle (artık kullanılmıyor)
  state.research.pendingProjectApplications = [];
}

/**
 * Aktif araştırma projelerini dönem sonunda ilerletir.
 * @param {object} state
 * @param {object} results — simülasyon sonuçları
 */
function _advanceActiveProjects(state, results) {
  if (!state.research?.activeResearchProjects) return;

  const toRemove = [];
  state.research.activeResearchProjects.forEach(proj => {
    proj.currentTurn = (proj.currentTurn || 0) + 1;
    proj.progress    = Math.round((proj.currentTurn / proj.duration) * 100);

    if (proj.currentTurn >= proj.duration) {
      const roll = Math.random();
      if (roll < (proj.successChance || 0.4)) {
        proj.status = 'completed';
        const projFunding = proj.requestedFunding || proj.funding || 0;
        state.university.budget   = (isNaN(state.university.budget) ? 0 : state.university.budget)
          + (isNaN(projFunding) ? 0 : projFunding);
        state.university.prestige = Math.min(MAX_PRESTIGE, (state.university.prestige || 0) + (proj.prestigeReward || 0));
        state.research.publications = (state.research.publications || 0) + (proj.publicationBonus || proj.estimatedPublications || 1);

        // Patent üretimi
        if (!state.research.patents) state.research.patents = 0;
        if (!state.research.patentRoyalties) state.research.patentRoyalties = 0;
        const patentChance = proj.isPrivateSector ? 0.15 : 0.05;
        if (Math.random() < patentChance) {
          state.research.patents += 1;
          const royalty = proj.isPrivateSector
            ? (50_000 + Math.random() * 150_000)
            : (30_000 + Math.random() * 100_000);
          state.research.patentRoyalties += Math.round(royalty);
          proj.generatedPatent = true;
          results.events.push({
            type: 'patent_generated',
            description: `🏅 "${proj.projectName}" projesinden patent alındı! Yıllık +${formatMoneyShort(royalty)} telif geliri.`,
            prestigeBonus: 1,
          });
        }

        // Patent royalty azalması (3 yıl → 6 dönem sonra süresi dolabilir, basitçe %10/dönem azalt)
        if (state.research.patentRoyalties > 0) {
          state.research.patentRoyalties = Math.round(state.research.patentRoyalties * 0.97);
        }

        results.events.push({
          type: 'project_completed',
          description: `${proj.callIcon || '📋'} ${proj.projectName} projesi başarıyla tamamlandı! +${proj.prestigeReward || 0} saygınlık, ${formatMoneyShort(proj.requestedFunding || 0)} kazanıldı.${proj.generatedPatent ? ' 🏅 Patent alındı!' : ''}`,
          prestigeBonus: proj.prestigeReward || 0,
        });
      } else {
        proj.status = 'failed';
        results.events.push({
          type: 'project_failed',
          description: `${proj.callIcon || '📋'} ${proj.projectName} projesi sonuçlanamadı.`,
          prestigeBonus: 0,
        });
      }
      toRemove.push(proj.id);
    }
  });

  if (!state.research.completedProjects) state.research.completedProjects = [];
  state.research.activeResearchProjects.forEach(p => {
    if (toRemove.includes(p.id)) {
      state.research.completedProjects.push(p);
    }
  });
  state.research.activeResearchProjects = state.research.activeResearchProjects.filter(p => !toRemove.includes(p.id));
}

/** Para kısaltma (etkinlik mesajları için) */
function formatMoneyShort(amount) {
  if (!amount) return '—';
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M ₺`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}K ₺`;
  return `${amount} ₺`;
}

// ─────────────────────────────────────────────────────────────────────────────
// generateSemesterEvents — Dönem olaylarını üret
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Her dönem gerçekleşebilecek rastgele olayları üretir.
 * @param {object} state — Oyun durumu
 * @returns {object[]} Olay listesi
 */
function generateSemesterEvents(state) {
  const events  = [];
  const prestige = isNaN(state.university.prestige) ? 0 : (state.university.prestige || 0);
  const faculty  = state.faculty || [];
  const avgSatisfaction = state.students?.overallSatisfaction ?? 60;

  // Zorluk ayarlarını al — olay sıklığı ve şiddeti için
  const diffKey      = state.meta?.difficulty || 'normal';
  const diffSettings = DIFFICULTY_SETTINGS[diffKey] || DIFFICULTY_SETTINGS.normal;
  const eventFreq    = diffSettings.eventFrequency ?? 1.0;
  const eventSev     = diffSettings.eventSeverity  ?? 1.0;

  // Olay şiddeti uygulayan yardımcı (prestij bonuslarını ölçekler)
  const scaledPrestige = (base) => Math.round(base * eventSev);

  // 1. Araştırma atılımı (en iyi araştırmacı)
  if (Math.random() < 0.15 * eventFreq && faculty.length > 0) {
    const sorted = [...faculty].sort((a, b) =>
      ((b.stats?.research || b.researchScore || 40)) - ((a.stats?.research || a.researchScore || 40))
    );
    const top = sorted[0];
    const titleMap = { argö: 'ArGö', dr_ogr_uyesi: 'Dr.Öğr.Üyesi', docent: 'Doç.', profesor: 'Prof. Dr.' };
    const titleStr = titleMap[top.title] || top.title || '';
    const bonus2 = scaledPrestige(2);
    events.push({
      type: 'research_breakthrough',
      description: `${titleStr} ${top.name} önemli bir araştırma yayınladı. (+${bonus2} saygınlık)`,
      prestigeBonus: bonus2,
    });
    state.university.prestige = Math.min(MAX_PRESTIGE, prestige + bonus2);
  }

  // 2. Öğrenci başarısı — ulusal yarışma
  if (Math.random() < 0.10 * eventFreq) {
    const bonus3 = scaledPrestige(3);
    events.push({
      type: 'student_achievement',
      description: `Öğrencileriniz ulusal yarışmada derece aldı. (+${bonus3} saygınlık)`,
      prestigeBonus: bonus3,
    });
    state.university.prestige = Math.min(MAX_PRESTIGE, (state.university.prestige || prestige) + bonus3);
  }

  // 3. TÜBİTAK burs haberi
  if (Math.random() < 0.12 * eventFreq) {
    const count = Math.floor(Math.random() * 4) + 2;
    const bonus1 = scaledPrestige(1);
    events.push({
      type: 'tubitak_scholarship',
      description: `${count} öğrenciniz TÜBİTAK bursu kazandı. (+${bonus1} saygınlık)`,
      prestigeBonus: bonus1,
    });
    state.university.prestige = Math.min(MAX_PRESTIGE, (state.university.prestige || prestige) + bonus1);
  }

  // 4. Akreditasyon haberi
  if (Math.random() < 0.08 * eventFreq && state.departments?.length > 0) {
    const openDepts = state.departments.filter(d => d.isOpen);
    if (openDepts.length > 0) {
      const randDept = openDepts[Math.floor(Math.random() * openDepts.length)];
      const bonus4 = scaledPrestige(2);
      events.push({
        type: 'accreditation',
        description: `${randDept.shortName || randDept.name} bölümü akreditasyon başvurusunda ilerledi. (+${bonus4} saygınlık)`,
        prestigeBonus: bonus4,
      });
      state.university.prestige = Math.min(MAX_PRESTIGE, (state.university.prestige || prestige) + bonus4);
    }
  }

  // 5. Olumsuz: öğrenci memnuniyetsizliği basına yansıdı
  if (avgSatisfaction < 50 && Math.random() < 0.20 * eventFreq) {
    const penalty = scaledPrestige(2);
    events.push({
      type: 'negative_press',
      description: `Öğrenci memnuniyetsizliği basına yansıdı. (-${penalty} saygınlık)`,
      prestigeBonus: -penalty,
    });
    state.university.prestige = Math.max(0, (state.university.prestige || prestige) - penalty);
  }

  // 6. Hoca kaçırma teklifi
  if (Math.random() < 0.10 * eventFreq && faculty.length > 5) {
    const unhappy = faculty.filter(f => (f.happiness || 70) < 50);
    if (unhappy.length > 0) {
      const target = unhappy[Math.floor(Math.random() * unhappy.length)];
      const titleMap2 = { argö: 'ArGö', dr_ogr_uyesi: 'Dr.Öğr.Üyesi', docent: 'Doç.', profesor: 'Prof. Dr.' };
      const tStr = titleMap2[target.title] || target.title || '';
      events.push({
        type: 'faculty_poaching',
        description: `${tStr} ${target.name} rakip üniversiteden iş teklifi aldı!`,
        prestigeBonus: 0,
      });
    }
  }

  // 7. Patent haberi
  if (Math.random() < 0.07 * eventFreq && (state.research?.publications ?? 0) > 20) {
    const bonus7 = scaledPrestige(1);
    events.push({
      type: 'patent',
      description: `Araştırma merkezi yeni bir patent başvurusu yaptı. (+${bonus7} saygınlık)`,
      prestigeBonus: bonus7,
    });
    state.university.prestige = Math.min(MAX_PRESTIGE, (state.university.prestige || prestige) + bonus7);
  }

  // 8. Altyapı sorunu
  if (Math.random() < 0.09) {
    const issues = [
      'Yemekhane kapasitesi yetersiz kaldı, öğrenci şikayetleri arttı.',
      'Kütüphane kaynakları yetersiz bulundu, bölüm talepleri yığıldı.',
      'İnternet altyapısı kesintileri eğitimi aksattı.',
    ];
    const issue = issues[Math.floor(Math.random() * issues.length)];
    events.push({
      type: 'infrastructure_issue',
      description: issue,
      prestigeBonus: 0,
    });
  }

  // 9. Dış fon / bağış haberi
  if (Math.random() < 0.08 && prestige > 40) {
    const amount = Math.floor(Math.random() * 5 + 1);
    events.push({
      type: 'donation',
      description: `Hayırsever mezundan ${amount}M ₺ bağış alındı. (+1 saygınlık)`,
      prestigeBonus: 1,
    });
    state.university.prestige = Math.min(MAX_PRESTIGE, (state.university.prestige || prestige) + 1);
    state.university.budget = (state.university.budget || 0) + amount * 1_000_000;
  }

  // 10. Uluslararası işbirliği
  if (Math.random() < 0.06 && prestige > 50) {
    events.push({
      type: 'international_cooperation',
      description: 'Yabancı üniversiteyle ortak araştırma anlaşması imzalandı. (+2 saygınlık)',
      prestigeBonus: 2,
    });
    state.university.prestige = Math.min(MAX_PRESTIGE, (state.university.prestige || prestige) + 2);
  }

  return events;
}

// ─────────────────────────────────────────────────────────────────────────────
// runSimulation — Bir dönemin iç simülasyonu
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bir dönem boyunca tüm alt sistemleri çalıştırır.
 * nextTurn() tarafından çağrılır; doğrudan çağrılmamalıdır.
 *
 * @returns {object} Simülasyon sonuçları (delta değerleri)
 */
function runSimulation() {
  if (!_state) throw new Error('Oyun başlatılmamış. Önce initGame() çağırın.');

  const results = {
    budgetDelta:      0,
    prestigeDelta:    0,
    rankingDelta:     0,
    newPublications:  0,
    events:           [],
    warnings:         [],
  };

  const diffSettings = DIFFICULTY_SETTINGS[_state.meta.difficulty];

  // ── 1. EKONOMİ HESABI ──────────────────────────────────────────────────────
  const economyResult = calculateEconomy(_state);
  // calculateEconomy → applyBudget zaten bütçeyi günceller
  // Son güvenlik: applyBudget sonrası da NaN kontrolü
  if (!isFinite(_state.university.budget) || isNaN(_state.university.budget)) {
    console.error('[game] runSimulation sonrası bütçe NaN/Infinity; son bilinen değere geri alınıyor.');
    _state.university.budget = (_state._lastGoodBudget != null && isFinite(_state._lastGoodBudget))
      ? _state._lastGoodBudget : 0;
  }
  // Son bilinen iyi bütçeyi güncelle
  _state._lastGoodBudget = _state.university.budget;
  const safeDelta = isFinite(economyResult.netCashFlow) && !isNaN(economyResult.netCashFlow)
    ? economyResult.netCashFlow : 0;
  results.budgetDelta    = safeDelta;
  results.economyIncome  = economyResult.income;
  results.economyExpenses = economyResult.expenses;
  results.economyBudget  = economyResult.budget;

  // ── 1b. DERS ATAMASI ────────────────────────────────────────────────────────
  // Müfredatı hocalara ata; eğitim kalitesi ve ders yükleri burada güncellenir
  const courseAssignmentResult = assignCourses(_state);
  results.courseAssignment = courseAssignmentResult;

  // Karşılanmayan zorunlu dersler için uyarı
  if (courseAssignmentResult.partTimeHires > 0) {
    results.warnings.push({
      type: 'staffing',
      message: `${courseAssignmentResult.partTimeHires} ders için dışarıdan öğretim görevlisi gerekiyor.`,
      uncoveredCourses: courseAssignmentResult.uncoveredCourses,
    });
  }

  // ── 2. HOCA MUTLULUĞU ──────────────────────────────────────────────────────
  // Ders yükü ve uzmanlık eşleşmesi mutluluğu etkiler
  _state.faculty.forEach(f => {
    const load = (f.currentLoad?.assignedCourses || []).length;
    const matchedCourses = (f.currentLoad?.assignedCourses || []).filter(c => c.matchQuality === 2).length;
    const mismatchPenalty = load > 0 ? ((load - matchedCourses) / load) * 8 : 0;
    const overloadPenalty = load > 2 ? (load - 2) * 5 : 0;
    const delta = randInt(-2, 2) - mismatchPenalty - overloadPenalty;
    f.happiness = Math.max(0, Math.min(100, (f.happiness || 60) + delta));
  });

  // ── 3. ÖĞRENCİ SİMÜLASYONU ────────────────────────────────────────────────
  // 3a. GPA, memnuniyet ve bırakma güncelle
  const isSpring      = _state.meta.semester === 'bahar';
  const updateSummary = updateStudentYears(_state, isSpring);
  results.cohortUpdate = updateSummary;

  // 3b. Genel memnuniyet hesapla
  const satisfactionResult = calculateStudentSatisfaction(_state);
  const newSatisfaction    = satisfactionResult.score ?? satisfactionResult;
  _state.students.satisfactionBreakdown = satisfactionResult.breakdown || null;
  _state.students.overallSatisfaction   = newSatisfaction;

  // Her bölüm sınıfının memnuniyetini genel skora göre güncelle (±10 sapma)
  const byDept = _state.students.byDepartment || {};
  for (const deptData of Object.values(byDept)) {
    for (const yr of [deptData.year1, deptData.year2, deptData.year3, deptData.year4]) {
      if (!yr) continue;
      const variance = randInt(-10, 10);
      yr.satisfaction = Math.max(0, Math.min(100, newSatisfaction + variance));
    }
  }

  // 3c. Yatay geçiş
  const yatayEvents = processYatayGecis(_state);
  if (yatayEvents.length > 0) {
    results.events.push(...yatayEvents.map(e => ({ type: e.type, message: e.message })));
  }

  // 3d. Bahar sonunda: başarı bursu + sınıf ilerlemesi + mezuniyet + yeni alım
  let graduationResult = { totalGraduates: 0, newAlumni: [] };
  let admissionsResult = { skipped: true };
  if (isSpring) {
    // Başarı bursu
    const meritResult = processMeritScholarship(_state);
    if (meritResult.totalEligible > 0) {
      results.events.push({
        type: 'merit_scholarship',
        message: `${meritResult.totalEligible} öğrenci başarı bursu kazandı.`,
      });
    }
    // Sınıf ilerlemesi + mezuniyet (4.sn → mezun, 3→4, 2→3, 1→2, yeni 1.sn = 0)
    graduationResult = advanceYearClasses(_state);
    // Yeni öğrenci alımı: sınıf ilerlemesinin ardından hemen yap,
    // böylece Güz dönemine geçildiğinde 1.sn görüntüde dolu görünür.
    // Oyuncu kontenjanları Bahar dönemi içinde (Sonraki Dönem öncesinde) belirler.
    // Akreditasyon YKS bonusunu her bölüme geçici alan olarak ekle
    for (const dept of _state.departments) {
      dept._accreditationYKSBonus = getAccreditationYKSBonus(dept);
    }
    admissionsResult = processNewEnrollment(_state);
  }
  results.graduates = graduationResult.totalGraduates;
  results.newAlumni = graduationResult.newAlumni;
  results.admissions = admissionsResult;

  // ── 3e. MEZUN SİSTEMİ (v0.2) ────────────────────────────────────────────
  if (isSpring && graduationResult.totalGraduates > 0) {
    processGraduatesForAlumni(_state, graduationResult.totalGraduates);
  }
  const alumniEvents = advanceAlumniCareers(_state);
  alumniEvents.forEach(ev => results.events.push({ type: ev.type, message: ev.message, alumniId: ev.alumniId }));

  // 3f. Yıldız öğrenci keşfi
  const newStars = discoverStarStudents(_state);
  results.newStarStudents = newStars;

  // 3g. Toplam kayıt güncelle
  _state.students.totalEnrolled = getTotalEnrolled(_state);

  // 3g. Bölüm istatistiklerini hesapla (öğrenci dağılımı, GPA, başarısızlık oranı, ders istatistikleri)
  calculateDepartmentStats(_state);

  // 3h. İdari birim staffNeeded güncelle (öğrenci sayısı değişebilir)
  if (_state.adminUnits) {
    const curStudents = _state.students.totalEnrolled || 0;
    for (const [unitId, unit] of Object.entries(_state.adminUnits)) {
      const template = ADMIN_UNITS[unitId];
      if (!template) continue;
      unit.staffNeeded = Math.max(
        template.baseStaffNeeded,
        Math.ceil(curStudents * template.staffPerStudentRatio)
      );
    }
    syncAdminUnitStats(_state.adminUnits, _state.adminStaff || [], _state.buildings);
  }

  // ── 3i. İDARİ PERSONEL KARİYER SİMÜLASYONU ────────────────────────────────
  if (_state.adminStaff && _state.adminUnits) {
    // 1. Deneyim, performans ve mutluluk güncelle
    for (const staff of _state.adminStaff) {
      _updateAdminStaffPerformance(staff);
      _checkPromotionEligibility(staff);
      // Terfi uygunsa sayacı artır
      if (staff.promotionEligible) {
        staff.semestersSinceEligible = safeNum(staff.semestersSinceEligible) + 1;
        // Uzun süredir terfi edilmeyenlerin mutluluğu düşer
        if (staff.semestersSinceEligible > 3) {
          staff.happiness = Math.max(0, safeNum(staff.happiness) - 5);
        }
      }
    }

    // 2. Birim yöneticileri ata
    _assignUnitManagers(_state.adminUnits, _state.adminStaff);

    // 3. Yönetici bonusunu uygula
    _applyManagerBonus(_state.adminUnits);

    // 4. Devir-daim: ayrılan personel
    const departures = _calculateAdminTurnover(_state.adminStaff);
    for (const departed of departures) {
      const unitTemplate = ADMIN_UNITS[departed.unit];
      const unitName = unitTemplate ? unitTemplate.name : departed.unit;
      results.events.push({
        type: 'admin_departure',
        message: `${departed.title} ${departed.name} (${unitName}) görevden ayrıldı.`,
      });
      const dIdx = _state.adminStaff.indexOf(departed);
      if (dIdx !== -1) _state.adminStaff.splice(dIdx, 1);
    }

    // 5. Birim istatistiklerini güncelle
    syncAdminUnitStats(_state.adminUnits, _state.adminStaff, _state.buildings);
  }

  // ── 4. ARAŞTIRMA İLERLEMESİ ────────────────────────────────────────────────
  // Her hoca için araştırma puanı ve bölüm potansiyeline göre yayın üret
  let newPubs = 0;
  let starFacultyPrestigeBonus = 0;
  let starFacultySatBonus = 0;

  _state.departments.forEach(dept => {
    // Faculty objects use f.department (not f.departmentId) from faculty.js generator
    const deptFaculty = _state.faculty.filter(f => (f.department || f.departmentId) === dept.id);
    deptFaculty.forEach(f => {
      const researchStatVal = (f.stats && f.stats.research) || f.researchScore || 40;
      const teachingStatVal = (f.stats && f.stats.teaching) || f.teachingScore || 40;
      const avgStat = (researchStatVal + teachingStatVal + ((f.stats && f.stats.management) || 40)) / 3;

      // ── Yüksek araştırma statına göre ek yayın şansı (yıldız hoca etkisi) ──
      const baseChance    = (dept.avgPublicationPerFaculty / 2) * (researchStatVal / 100);
      // Araştırma 80+ ise ekstra +%30 yayın şansı
      const starBonus     = researchStatVal >= 80 ? 0.30 : researchStatVal >= 70 ? 0.15 : 0;
      const pubChance     = Math.min(0.95, baseChance * (1 + starBonus));
      if (Math.random() < pubChance) {
        f.publications = (f.publications || 0) + 1;
        newPubs++;
        _state.research.publications++;
      }

      // ── Yıldız hoca: eğitim etkisi → öğrenci memnuniyetine katkı ──
      if (teachingStatVal >= 80) {
        // Her yüksek-teaching hoca bölüm memnuniyetine katkı sağlar
        const teachBonus = Math.round((teachingStatVal - 70) / 10);
        starFacultySatBonus += teachBonus;
        // Bölümdeki kohortları doğrudan etkile
        // Bölüm sınıflarının memnuniyetini artır
        const deptYrs = _state.students.byDepartment?.[dept.id];
        if (deptYrs) {
          for (const yr of [deptYrs.year1, deptYrs.year2, deptYrs.year3, deptYrs.year4]) {
            if (yr) yr.satisfaction = Math.min(100, (yr.satisfaction || 70) + teachBonus);
          }
        }
      }

      // ── Yıldız hoca: prestij katkısı ──
      if (avgStat >= 80 && (f.title === 'profesor' || f.title === 'docent')) {
        const presBonus = Math.round((avgStat - 75) / 8);
        starFacultyPrestigeBonus += presBonus;
      }
    });
  });
  results.newPublications     = newPubs;
  results.starFacultyPrestige = starFacultyPrestigeBonus;

  // Geriye dönük uyumluluk: eski activeProjects formatı (varsa)
  (_state.research.activeProjects || []).forEach(project => {
    project.turnsRemaining = Math.max(0, (project.turnsRemaining || 2) - 1);
    if (project.turnsRemaining === 0 && !project.completed) {
      project.completed = true;
      _state.research.publications += project.expectedPublications || 1;
      _state.university.budget     += project.budget || 0;
      results.events.push({ type: 'research_complete', projectId: project.id });
    }
  });

  // ── 4b. YILDIZ ÖĞRENCİ ETKİLERİ ──────────────────────────────────────────
  // Yıldız öğrenciler: yarışma, yayın işbirliği, mezuniyet olayları
  const starStudents = _state.students.starStudents || [];
  starStudents.forEach(star => {
    if (!star.events) star.events = [];
    const stats   = star.stats || {};
    const academic = stats.academic ?? 50;
    const creativity = stats.creativity ?? 50;
    const leadership = stats.leadership ?? 50;

    // ── Yarışma olayı: akademik/liderlik statına göre ──
    const compChance = 0.05 + (Math.max(academic, creativity, leadership) - 50) / 200;
    if (Math.random() < compChance) {
      const presBonus = Math.max(1, Math.round((Math.max(academic, creativity, leadership) - 60) / 8));
      _state.university.prestige = Math.min(MAX_PRESTIGE, (_state.university.prestige || 0) + presBonus);
      const eventDesc = `Yıldız öğrenci ${star.name} ulusal yarışma kazandı! Saygınlık +${presBonus}`;
      results.events.push({
        type: 'star_student_competition',
        studentId: star.id,
        description: eventDesc,
        prestigeBonus: presBonus,
      });
      star.events.push({ type: 'competition_win', description: `Bu dönem yarışma kazandı! +${presBonus} saygınlık`, turn: _state.meta.turn });
    }

    // ── Yayın işbirliği: yüksek akademik + araştırma hocası varsa ──
    if (academic >= 75) {
      const deptFaculty = _state.faculty.filter(f => (f.department || f.departmentId) === star.department);
      const researchHoca = deptFaculty.find(f => (f.stats?.research ?? 0) >= 70);
      if (researchHoca && Math.random() < 0.20) {
        const pubBonus = 1;
        _state.research.publications += pubBonus;
        newPubs += pubBonus;
        results.newPublications = newPubs;
        const eventDesc = `Yıldız öğrenci ${star.name} hocayla ortak yayın yaptı (+${pubBonus} yayın)`;
        results.events.push({
          type: 'star_student_publication',
          studentId: star.id,
          description: eventDesc,
          prestigeBonus: 0,
        });
        star.events.push({ type: 'publication', description: `Bu dönem ${researchHoca.name || 'hoca'} ile yayın yaptı`, turn: _state.meta.turn });
      }
    }

    // Yıldız öğrenci yaşını artır (yıl ilerlemesi cohort sisteminden zaten oluyor; biz sadece event tarihçesini takip edelim)
    star.year = (star.year || 1);
  });

  // ── 4c. MEZUNİYET SONRASI YILDIZ ÖĞRENCİ ETKİSİ (alumni) ──────────────────
  // Yeni mezun olan yıldız öğrenci alumni'leri prestij ve bağış bonusu sağlar
  (_state.alumni || []).forEach(alumni => {
    if (alumni.type === 'normal' || alumni._prestigeApplied) return;
    if (alumni.potentialImpact && alumni.potentialImpact >= 3) {
      const presBonus = alumni.potentialImpact;
      _state.university.prestige = Math.min(MAX_PRESTIGE, (_state.university.prestige || 0) + presBonus);
      alumni._prestigeApplied = true;
      results.events.push({
        type: 'star_student_graduated',
        description: `Mezun ${alumni.name || 'yıldız öğrenci'} kariyer başarısıyla üniversiteye saygınlık kattı! +${presBonus} saygınlık`,
        prestigeBonus: presBonus,
      });
    }
  });

  // ── 5. BİNA İNŞAAT İLERLEMESİ ─────────────────────────────────────────────
  _state.buildings.forEach(building => {
    const isInProgress = !building.isCompleted &&
      (building.status === 'under_construction' || building.status === 'upgrading');
    if (!isInProgress) return;

    building.turnsRemaining = Math.max(0, (building.turnsRemaining ?? 1) - 1);
    const total = building.totalTurns || 1;
    const done  = total - building.turnsRemaining;
    building.constructionProgress = Math.round((done / total) * 100);

    if (building.turnsRemaining === 0) {
      const catalog = BUILDINGS[building.type];

      if (building.status === 'upgrading' && building._pendingLevel) {
        // Düzey yükseltme tamamlandı
        building.level    = building._pendingLevel;
        delete building._pendingLevel;
        if (catalog) {
          building.area            = (catalog.baseArea ?? 1000) + (catalog.areaPerLevel ?? 0) * (building.level - 1);
          building.currentCapacity = _buildingCapacityAtLevel(catalog, building.level);
          building.maintenanceCost = Math.round(building.area * (catalog.maintenanceCostPerM2 ?? 50));
        }
        results.events.push({ type: 'upgrade_complete', buildingId: building.id, buildingName: building.name, newLevel: building.level });
      } else {
        // İlk inşaat tamamlandı
        if (catalog) {
          building.area            = catalog.baseArea ?? 1000;
          building.currentCapacity = _buildingCapacityAtLevel(catalog, 1);
          building.maintenanceCost = Math.round(building.area * (catalog.maintenanceCostPerM2 ?? 50));
        }
        results.events.push({ type: 'construction_complete', buildingId: building.id, buildingName: building.name });
      }

      building.isCompleted          = true;
      building.status               = 'operational';
      building.constructionProgress = 100;
    }
  });

  // ── 3h. ÖĞRENCİ AYRILIŞ / YATAY GEÇİŞ SİMÜLASYONU ────────────────────────
  const attritionResult = applyStudentAttrition(_state);
  results.students = results.students || {};
  results.semesterDropouts   = attritionResult.totalDropouts;
  results.semesterTransferOut = attritionResult.totalTransferOut;
  results.semesterTransferIn  = attritionResult.totalTransferIn;
  results.semesterFailDropouts = attritionResult.failDropouts;
  results.semesterDissatisfiedDropouts = attritionResult.dissatisfiedDropouts;
  // Toplam kayıt güncelle (attrition sonrası)
  _state.students.totalEnrolled = getTotalEnrolled(_state);

  // ── 3i. DIŞ ÇAĞRILAR VE HOCA BAŞVURULARI ────────────────────────────────────
  _generateExternalCalls(_state);
  _generateFacultyApplications(_state);

  // ── 3j. AKTİF PROJE İLERLEMESİ ─────────────────────────────────────────────
  _advanceActiveProjects(_state, results);

  // ── 6. DÖNEM OLAYLARI ──────────────────────────────────────────────────────
  const semesterEvents = generateSemesterEvents(_state);
  semesterEvents.forEach(ev => results.events.push(ev));

  // ── 7. RAKİP AI HAMLESİ ────────────────────────────────────────────────────
  const rivalChanges = updateRivals(_state);
  rivalChanges.forEach(change => {
    change.actions.forEach(msg => results.events.push({ type: 'rival_action', message: msg }));
  });

  // TODO: ranking.js'den: const rankResult = calculateRanking(_state);
  // Placeholder prestige güncelleme
  const researchScore   = Math.min(100, (_state.research.publications / 10) * 30);
  const avgSatisfaction = _state.students.overallSatisfaction ?? 50;
  const avgFacultyHappy = _state.faculty.length > 0
    ? _state.faculty.reduce((s, f) => s + (f.happiness || 60), 0) / _state.faculty.length
    : 50;

  const prestigeContrib =
    researchScore   * RANKING_WEIGHTS.research      +
    avgSatisfaction * RANKING_WEIGHTS.satisfaction   +
    avgFacultyHappy * RANKING_WEIGHTS.education;

  const currentPrestige = isNaN(_state.university.prestige) ? 0 : _state.university.prestige;
  const targetPrestige = Math.round((isNaN(prestigeContrib) ? currentPrestige : prestigeContrib) * 0.4 + currentPrestige * 0.6);
  let prestigeDelta  = Math.sign(targetPrestige - currentPrestige) || 0;

  // Yatırım yapılmadığında prestij durgunlaşır veya geriler
  // Araştırma yatırımı yoksa ve memnuniyet düşükse negatif etki
  const researchInvesting = (_state.research?.activeResearchProjects?.length || 0) > 0
    || (_state.research?.publications || 0) > 0;
  const budgetHealthy = _state.university.budget > 0;
  if (!researchInvesting && !budgetHealthy) {
    prestigeDelta = Math.min(prestigeDelta, -1);  // yatırım yok + bütçe açık → prestij düşer
  } else if (!researchInvesting && avgFacultyHappy < 50) {
    prestigeDelta = Math.min(prestigeDelta, 0);   // yatırım yok + mutsuz hocalar → prestij stagnate
  }

  // Yıldız hoca prestij bonusunu ekle (dönem başına maks +3)
  prestigeDelta += Math.min(3, starFacultyPrestigeBonus);

  // Dönem başına maks +3 / maks -3 ile sınırla (çok ani değişimleri önle)
  prestigeDelta = Math.max(-3, Math.min(3, prestigeDelta));

  _state.university.prestige = Math.max(0, Math.min(MAX_PRESTIGE,
    currentPrestige + prestigeDelta));

  results.prestigeDelta = prestigeDelta;

  // Trend ısılarını dönem sonunda güncelle
  _updateTrendHeats();

  // ── UNVAN YÜKSELTME OTOMATİK KONTROL ──────────────────────────────────────
  // Her dönem hocaların yükseltme kriterlerini kontrol et
  _state.faculty.forEach(f => {
    if (!f.promotionEligible) f.promotionEligible = false;
    if (!f.promotionEligibleSince) f.promotionEligibleSince = null;

    const pubs = f.publications || 0;
    const cits = f.citations    || 0;
    const exp  = f.yearsExperience || 0;

    let eligible = false;
    if (f.title === 'dr_ogr_uyesi') {
      // Dr.Öğr.Üyesi → Doçent: 40+ yayın, 200+ atıf, 10+ yıl
      eligible = pubs >= 40 && cits >= 200 && exp >= 10;
    } else if (f.title === 'docent') {
      // Doçent → Profesör: 80+ yayın, 500+ atıf, 15+ yıl
      eligible = pubs >= 80 && cits >= 500 && exp >= 15;
    }

    if (eligible && !f.promotionEligible) {
      f.promotionEligible      = true;
      f.promotionEligibleSince = _state.meta.turn;
    } else if (!eligible) {
      f.promotionEligible      = false;
      f.promotionEligibleSince = null;
    }

    // Uzun süre bekleyen hoca mutsuzlaşır
    if (f.promotionEligible && f.promotionEligibleSince != null) {
      const waitingTurns = _state.meta.turn - f.promotionEligibleSince;
      if (waitingTurns >= 4) {
        const penalty = Math.min(20, (waitingTurns - 3) * 4);
        f.happiness = Math.max(0, (f.happiness || 60) - penalty * 0.1);
        f._promotionAnxiety = true;
      }
    } else {
      f._promotionAnxiety = false;
    }

    // Maaş memnuniyeti etkisi
    if (f.salaryRange) {
      const mid = (f.salaryRange.min + f.salaryRange.max) / 2;
      if (f.salary < f.salaryRange.min * 1.05) {
        // Bareminin altında: mutsuzluk
        f._salaryUnhappy = true;
        f.happiness = Math.max(0, (f.happiness || 60) - 0.5);
      } else if (f.salary > mid * 1.1) {
        // Ortalamanın üzerinde: hafif mutluluk
        f._salaryUnhappy = false;
        f.happiness = Math.min(100, (f.happiness || 60) + 0.2);
      } else {
        f._salaryUnhappy = false;
      }
    }

    // Ödül süresi kontrolü (3 dönem bonusu)
    if (f.activeAwards && f.activeAwards.length > 0) {
      f.activeAwards = f.activeAwards.filter(a => {
        const remaining = (a.expiresAtTurn || 0) - _state.meta.turn;
        return remaining > 0;
      });
    }

    // ── Feature 3: Genel Puan ve Rating Tarihçesi ────────────────────────────
    const newRating = calculateOverallRating(f);
    f.overallRating = newRating;
    if (!f.ratingHistory) f.ratingHistory = [];
    // Tarihçeyi max 10 dönem sakla
    f.ratingHistory.push({ semester: _state.meta.turn, rating: newRating });
    if (f.ratingHistory.length > 10) f.ratingHistory.shift();
  });

  // ── Feature 1: LİSANSÜSTÜ SİMÜLASYONU ────────────────────────────────────
  _simulateGradPrograms(_state, results);

  // ── Feature 2: YÖK Onay Süreci İlerlet ────────────────────────────────────
  _processYokApplications(_state, results);

  // ── v0.3 Feature: AKREDİTASYON İŞLEME ────────────────────────────────────
  _processAccreditations(_state, results);

  // ── v0.3 Feature: TEKNOLOJİ TRANSFER OFİSİ ────────────────────────────────
  processTTO(_state, results);

  // ── v0.3 Feature: ÖĞRENCİ KULÜPLERİ ────────────────────────────────────
  processClubs(_state, results);

  // ── v0.4 Feature: ÜNİVERSİTE SPORLARI ───────────────────────────────────
  processSports(_state, results);

  // ── v0.2 Feature: RASTGELE OLAYLAR ────────────────────────────────────────
  const rolledEvents = rollRandomEvents(_state);
  if (rolledEvents.length > 0) {
    // Bekleyen olayları state'e kaydet (UI'da modal gösterilecek)
    if (!_state.pendingRandomEvents) _state.pendingRandomEvents = [];
    _state.pendingRandomEvents.push(...rolledEvents);
    results.pendingRandomEvents = rolledEvents;
  }

  // ── v0.2 Feature: BAŞARIMLAR ───────────────────────────────────────────────
  const newAchievements = checkAchievements(_state);
  results.newAchievements = newAchievements;

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDİMCI: Trend ısılarını güncelle
// ─────────────────────────────────────────────────────────────────────────────

function _updateTrendHeats() {
  const heats = _state.university.trendHeats;
  const rules = TREND_CYCLES.rules;

  Object.keys(heats).forEach(deptId => {
    const heat = heats[deptId];
    if (heat > 70) {
      heats[deptId] = Math.max(0, heat + rules.coolingRate);
    } else if (heat < 30) {
      heats[deptId] = Math.min(100, heat + rules.warmingRate);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature 1: Lisansüstü Program Simülasyonu
// ─────────────────────────────────────────────────────────────────────────────

function _simulateGradPrograms(state, results) {
  let totalYL  = 0;
  let totalPhD = 0;
  let totalStipend = 0;

  for (const dept of state.departments) {
    if (!dept.isOpen) continue;
    const programs = dept.programs;
    if (!programs) continue;

    const deptFaculty = state.faculty.filter(f => (f.department || f.departmentId) === dept.id);
    // Danışman kapasitesi: her hoca max 5 YL + 3 PhD danışabilir
    const advisorCapacity = {
      yl:  deptFaculty.filter(f => ['dr_ogr_uyesi','docent','profesor'].includes(f.title)).length * 5,
      phd: deptFaculty.filter(f => ['docent','profesor'].includes(f.title)).length * 3,
    };

    // ── Yüksek Lisans ──────────────────────────────────────────────────────
    const yl = programs.yuksek_lisans;
    if (yl && yl.active && yl.quota > 0) {
      const yl1 = yl.students.year1;
      const yl2 = yl.students.year2;

      // Bahar: 2. sınıf tez savunması → mezuniyet
      if (state.meta.semester === 'bahar') {
        const thesisGrad = Math.round((yl2.count || 0) * 0.75);
        yl.graduatedTotal += thesisGrad;
        // Mezun PhD adayları biraz prestij katar
        state.university.prestige = Math.min(MAX_PRESTIGE,
          (state.university.prestige || 0) + Math.floor(thesisGrad / 5));
        yl.thesisStudents = Math.max(0, (yl2.count || 0) - thesisGrad);

        // Sınıf ilerle: 1→2
        yl.students.year2 = { count: yl1.count || 0, avgGPA: yl1.avgGPA || 3.0 };
        yl.students.year1 = { count: 0, avgGPA: 0 };

        // Yeni alım (Güz'de olur, Bahar'da yoktur — ama sonraki Güz için sıfırla)
        const newStudents = Math.min(yl.quota, advisorCapacity.yl);
        const prestige = state.university.prestige || 20;
        // YL öğrencileri lisans mezunları — baz GPA daha yüksek
        const newGPA   = Math.min(4.0, 3.2 + (prestige / 100) * 0.7);
        yl.students.year1 = { count: newStudents, avgGPA: parseFloat(newGPA.toFixed(2)) };
      }

      yl.thesisStudents = Math.max(0, Math.min(yl.students.year2.count, advisorCapacity.yl));
      const ylTotal = (yl.students.year1.count || 0) + (yl.students.year2.count || 0);
      totalYL += ylTotal;

      // Burs gideri
      totalStipend += ylTotal * (yl.stipendPerStudent || 8000);

      // YL öğrencileri araştırmaya katkı sağlar
      const ylResearchBonus = Math.floor(ylTotal / 3);
      state.research.publications += ylResearchBonus * 0.1;
    }

    // ── Doktora ───────────────────────────────────────────────────────────
    const phd = programs.doktora;
    if (phd && phd.active && phd.quota > 0) {
      const phdYrs = phd.students;

      if (state.meta.semester === 'bahar') {
        // 4. yıl öğrencileri tez savunması
        const y4 = phdYrs.year4 || { count: 0 };
        const gradCount = Math.round((y4.count || 0) * 0.60);
        phd.graduatedTotal += gradCount;
        // PhD mezunları önemli prestij kaynağı
        state.university.prestige = Math.min(MAX_PRESTIGE,
          (state.university.prestige || 0) + Math.floor(gradCount / 2));
        // Bazı PhD mezunları yeni hoca adayı olabilir
        results.newPhDGraduates = (results.newPhDGraduates || 0) + gradCount;

        // Sınıf ilerle: 3→4, 2→3, 1→2
        phdYrs.year4 = { count: phdYrs.year3?.count || 0, avgGPA: phdYrs.year3?.avgGPA || 3.5 };
        phdYrs.year3 = { count: phdYrs.year2?.count || 0, avgGPA: phdYrs.year2?.avgGPA || 3.5 };
        phdYrs.year2 = { count: phdYrs.year1?.count || 0, avgGPA: phdYrs.year1?.avgGPA || 3.5 };

        // Yeni Güz alımı
        const newPhD    = Math.min(phd.quota, advisorCapacity.phd);
        const prestige  = state.university.prestige || 20;
        // Doktora öğrencileri YL mezunları — baz GPA çok yüksek
        const newGPAPhD = Math.min(4.0, 3.5 + (prestige / 100) * 0.5);
        phdYrs.year1 = { count: newPhD, avgGPA: parseFloat(newGPAPhD.toFixed(2)) };

        phd.dissertationStudents = (phdYrs.year3?.count || 0) + (phdYrs.year4?.count || 0);
      }

      const phdTotal = (phdYrs.year1?.count || 0) + (phdYrs.year2?.count || 0) +
                       (phdYrs.year3?.count || 0) + (phdYrs.year4?.count || 0);
      totalPhD += phdTotal;

      // PhD öğrenci burs gideri
      totalStipend += phdTotal * (phd.stipendPerStudent || 12000);

      // PhD öğrencileri araştırmaya daha fazla katkı sağlar
      const phdResearchBonus = Math.floor(phdTotal / 2);
      state.research.publications += phdResearchBonus * 0.2;
    }
  }

  // Toplam lisansüstü öğrenci güncelle
  if (!state.gradStudents) state.gradStudents = { byDepartment: {}, totalYL: 0, totalPhD: 0 };
  state.gradStudents.totalYL  = totalYL;
  state.gradStudents.totalPhD = totalPhD;

  // Burs gideri bütçeden düş
  if (totalStipend > 0) {
    state.university.budget -= totalStipend;
    results.gradStipendCost = totalStipend;
  }

  // TA etkisi: YL öğrencileri öğretim yükü azaltır
  if (totalYL > 0) {
    // Her 5 YL öğrencisi 1 hocanın ders yükünü hafifletir (mutluluk bonus)
    const taBonus = Math.min(5, Math.floor(totalYL / 5));
    state.faculty.forEach(f => {
      if ((f.currentLoad?.courses || 0) >= 2) {
        f.happiness = Math.min(100, (f.happiness || 60) + taBonus * 0.5);
      }
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature 2: YÖK Onay Süreçlerini İlerlet
// ─────────────────────────────────────────────────────────────────────────────

function _processYokApplications(state, results) {
  if (!state.pendingApplications) state.pendingApplications = [];

  const justApproved = [];
  const stillPending = [];

  for (const app of state.pendingApplications) {
    app.turnsRemaining = Math.max(0, (app.turnsRemaining || 1) - 1);

    if (app.turnsRemaining === 0) {
      // Onaylandı
      justApproved.push(app);

      if (app.type === 'yeni_bolum') {
        // Yeni bölüm başvurusu onaylandı → bölümü aç
        const template = AVAILABLE_NEW_DEPARTMENTS.find(d => d.id === app.deptId);
        if (template) {
          // data.js'de tanımlı bölüm varsa buildDepartmentState, yoksa minimal state oluştur
          let newDept = buildDepartmentState(app.deptId);
          if (!newDept) {
            // Minimal state: AVAILABLE_NEW_DEPARTMENTS şablonundan üret
            newDept = {
              id:                  template.id,
              name:                template.name,
              shortName:           template.name.substring(0, 8),
              category:            template.category,
              icon:                template.icon || '🏫',
              tuitionMultiplier:   template.category === 'saglik' ? 1.8 : template.category === 'muhendislik' ? 1.3 : 1.0,
              annualOperatingCost: 3_000_000,
              revenueEfficiency:   0.7,
              studentCapacity:     40,
              enrolledStudents:    0,
              baseStudentDemand:   0.6,
              waitlistCount:       0,
              researchPotential:   0.5,
              labRequirement:      template.category === 'muhendislik' ? 2 : 0,
              avgPublicationPerFaculty: 0.5,
              projectBudgetRange:  [100_000, 500_000],
              activeResearchBudget: 0,
              facultyRetentionDifficulty: 'medium',
              assignedFacultyIds:  [],
              headId:              null,
              educationQuality:    40,
              studentSatisfaction: 50,
              labScore:            template.category === 'muhendislik' ? 30 : 100,
              isOpen:              true,
              turnsOpen:           0,
              accreditationStatus: 'pending',
              accreditationScore:  0,
              accreditation: {
                mudek: { status: 'none', appliedAt: null, grantedAt: null, expiresAt: null, processTime: null },
                abet:  { status: 'none', appliedAt: null, grantedAt: null, expiresAt: null, processTime: null },
                theqa: { status: 'none', appliedAt: null, grantedAt: null, expiresAt: null, processTime: null },
              },
              requiresHospital:    template.category === 'saglik' && template.id === 'tip',
              requiresClinic:      false,
              donerSermayeMultiplier: 1.0,
              trendSensitivity:    'normal',
              programs: {
                lisans: { active: true, quota: 30, students: { year1:{count:0,avgGPA:0}, year2:{count:0,avgGPA:0}, year3:{count:0,avgGPA:0}, year4:{count:0,avgGPA:0} }, graduatedTotal: 0 },
                yuksek_lisans: { active: false, quota: 0, students: { year1:{count:0,avgGPA:0}, year2:{count:0,avgGPA:0} }, thesisStudents: 0, graduatedTotal: 0, stipendPerStudent: 8000, yok_approval_turn: null },
                doktora: { active: false, quota: 0, students: { year1:{count:0,avgGPA:0}, year2:{count:0,avgGPA:0}, year3:{count:0,avgGPA:0}, year4:{count:0,avgGPA:0} }, dissertationStudents: 0, graduatedTotal: 0, stipendPerStudent: 12000, yok_approval_turn: null },
              },
            };
          }
          if (newDept) {
            newDept.isOpen   = true;
            newDept.turnsOpen = 0;
            state.departments.push(newDept);
            // Fakülte yapısını güncelle
            const fak = state.fakulteler[template.faculty];
            if (fak) {
              fak.departments.push(app.deptId);
            } else {
              state.fakulteler[template.faculty] = {
                id: template.faculty,
                name: template.name,
                icon: '🏫',
                departments: [app.deptId],
                deanId: null,
                headCount: 0,
                studentCount: 0,
              };
            }
            results.events.push({
              type: 'dept_approved',
              message: `YÖK onayı geldi: ${newDept.name} bölümü açıldı!`,
            });
          }
        }

      } else if (app.type === 'yuksek_lisans' || app.type === 'doktora') {
        // Lisansüstü program onaylandı → bölümde programı aktif et
        const dept = state.departments.find(d => d.id === app.deptId);
        if (dept && dept.programs && dept.programs[app.type]) {
          dept.programs[app.type].active = true;
          dept.programs[app.type].quota  = app.requestedQuota || 10;
          results.events.push({
            type: 'program_approved',
            message: `${dept.name} bölümünde ${app.type === 'yuksek_lisans' ? 'Yüksek Lisans' : 'Doktora'} programı YÖK onayı aldı!`,
          });
        }
      }

    } else {
      stillPending.push(app);
    }
  }

  state.pendingApplications = stillPending;
  results.yokApprovals = justApproved.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature 2: Mevcut olmayan bölümler listesi
// ─────────────────────────────────────────────────────────────────────────────

export const AVAILABLE_NEW_DEPARTMENTS = [
  { id: 'yazilim_muh',    name: 'Yazılım Mühendisliği',  faculty: 'muhendislik', category: 'muhendislik', icon: '💻', minFaculty: 3, cost: 2_500_000 },
  { id: 'biyomedikal',    name: 'Biyomedikal Müh.',      faculty: 'muhendislik', category: 'muhendislik', icon: '🏥', minFaculty: 3, cost: 3_000_000 },
  { id: 'mekatronik',     name: 'Mekatronik Müh.',       faculty: 'muhendislik', category: 'muhendislik', icon: '🤖', minFaculty: 3, cost: 2_800_000 },
  { id: 'cevre_muh',      name: 'Çevre Mühendisliği',   faculty: 'muhendislik', category: 'muhendislik', icon: '🌿', minFaculty: 3, cost: 2_200_000 },
  { id: 'gida_muh',       name: 'Gıda Mühendisliği',    faculty: 'muhendislik', category: 'muhendislik', icon: '🍎', minFaculty: 3, cost: 2_000_000 },
  { id: 'mimarlik',       name: 'Mimarlık',              faculty: 'mimarlik',    category: 'mimarlik',    icon: '🏛️', minFaculty: 3, cost: 2_500_000 },
  { id: 'tip',            name: 'Tıp',                   faculty: 'tip',         category: 'saglik',      icon: '🩺', minFaculty: 5, cost: 15_000_000 },
  { id: 'eczacilik',      name: 'Eczacılık',             faculty: 'eczacilik',   category: 'saglik',      icon: '💊', minFaculty: 4, cost: 5_000_000 },
  { id: 'dis_hekimligi',  name: 'Diş Hekimliği',        faculty: 'dis_hekim',   category: 'saglik',      icon: '🦷', minFaculty: 4, cost: 6_000_000 },
  { id: 'isletme',        name: 'İşletme',               faculty: 'isletme',     category: 'sosyal',      icon: '💼', minFaculty: 3, cost: 1_800_000 },
  { id: 'iktisat',        name: 'İktisat',               faculty: 'isletme',     category: 'sosyal',      icon: '📊', minFaculty: 3, cost: 1_800_000 },
  { id: 'siyaset_bilimi', name: 'Siyaset Bilimi',        faculty: 'isletme',     category: 'sosyal',      icon: '🏛️', minFaculty: 3, cost: 1_500_000 },
  { id: 'iletisim',       name: 'İletişim',              faculty: 'iletisim',    category: 'sosyal',      icon: '📡', minFaculty: 3, cost: 1_500_000 },
  { id: 'guzel_sanatlar', name: 'Güzel Sanatlar',        faculty: 'guzel_sanat', category: 'sanat',       icon: '🎨', minFaculty: 3, cost: 1_500_000 },
];

// ─────────────────────────────────────────────────────────────────────────────
// nextTurn — Ana oyun döngüsü (tur geçişi)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bir tur ilerler: simülasyon çalıştırır, sayaçları artırır, kazanma/kaybetme kontrol eder.
 *
 * @returns {object} Tur sonu özet objesi (getTurnSummary() çıktısı + gameOver/gameWon bayrakları)
 */
export function nextTurn() {
  if (!_state) throw new Error('Oyun başlatılmamış. Önce initGame() çağırın.');
  if (_gameOver || _gameWon) {
    return { gameOver: _gameOver, gameWon: _gameWon, message: 'Oyun zaten bitti.' };
  }

  // Bekleyen karar varsa tur geçişine izin verme
  if (_state.events.pendingDecision) {
    return {
      blocked:  true,
      message:  'Bekleyen bir karar var. Önce applyDecision() ile yanıtlayın.',
      decision: _state.events.pendingDecision,
    };
  }

  // Dönem başı: bölüm açılma süre sayacını artır
  _state.departments.forEach(dept => {
    if (dept.isOpen) dept.turnsOpen++;
  });

  // Simülasyonu çalıştır
  const simResults = runSimulation();

  // Dönem sonu: öğrenci toplamını güncelle (yeni byDepartment yapısı)
  _state.students.totalEnrolled = getTotalEnrolled(_state);

  // Bina kullanım kapasitesini güncelle
  _updateAllBuildingUsage(_state);
  // Lab binalarına göre bölüm labScore'larını güncelle
  _recalcDeptLabScores(_state);

  // Bütçe geçmişine ekle
  _state.university.budgetHistory.push({
    turn:   _state.meta.turn,
    budget: _state.university.budget,
    delta:  simResults.budgetDelta,
  });
  if (_state.university.budgetHistory.length > 20) {
    _state.university.budgetHistory.shift();  // son 20 turu tut
  }

  // İstatistikleri kaydet
  _saveStats(simResults);

  // Tur sayacı ve yarıyıl değiştir
  const prevSemester = _state.meta.semester;
  _state.meta.semester = _state.meta.semester === 'güz' ? 'bahar' : 'güz';
  if (prevSemester === 'bahar') {
    _state.meta.year++;
  }
  _state.meta.turn++;

  // Açık ilanlar için başvurucu üret
  if (_state.openPositions && _state.openPositions.length > 0) {
    if (!_state.pendingApplicants) _state.pendingApplicants = [];
    const newApplicants = [];
    for (const pos of _state.openPositions) {
      const applicants = generateApplicants(pos, _state);
      newApplicants.push(...applicants);
    }
    _state.pendingApplicants.push(...newApplicants);
    // İlan verildikten 2 dönem sonra kapat (ya da oyuncu kapatana kadar)
    _state.openPositions = _state.openPositions.filter(pos =>
      (_state.meta.turn - pos.postedTurn) < 2
    );
  }

  // ── İLAN DIŞI (SPONTANE) BAŞVURULAR ─────────────────────────────────────
  // Her dönem prestije bağlı olarak 0-3 spontane başvuru gelir
  {
    if (!_state.spontaneousApplicants) _state.spontaneousApplicants = [];

    // Önce süresi geçmiş olanları kaldır (2 dönem sonra çekilir)
    _state.spontaneousApplicants = _state.spontaneousApplicants.filter(a =>
      (_state.meta.turn - (a.applicationDate || 0)) < 2
    );

    // Kaç spontane başvuru gelecek?
    const prestige = _state.university.prestige || 0;
    const maxNew = Math.floor(1 + prestige / 30);    // 0→1, 30→2, 60→3
    const spontaneousCount = Math.floor(Math.random() * (maxNew + 1));

    const uniType = _state.meta.universityType || 'vakif';
    const depts   = _state.departments.filter(d => d.isOpen);

    for (let i = 0; i < spontaneousCount; i++) {
      // Rastgele bir bölüm seç (açık bölümlerden)
      const randomDept = depts[Math.floor(Math.random() * depts.length)];
      if (!randomDept) break;

      // Unvan dağılımı: %10 Prof, %25 Doçent, %40 Dr, %25 ArGö
      const roll = Math.random();
      const title = roll < 0.10 ? 'profesor'
                  : roll < 0.35 ? 'docent'
                  : roll < 0.75 ? 'dr_ogr_uyesi'
                  : 'argö';

      const minQ = Math.round(20 + prestige * 0.4);
      const maxQ = Math.min(90, Math.round(40 + prestige * 0.5));

      const fac = generateFaculty({
        department:     randomDept.id,
        title,
        minQuality:     Math.max(10, minQ),
        maxQuality:     Math.max(minQ + 10, maxQ),
        currentTurn:    _state.meta.turn,
        universityType: uniType,
      });

      const salaryRange = getSalaryRange(title, uniType);
      const midSalary   = Math.round((salaryRange.min + salaryRange.max) / 2);
      const salaryExpectation = Math.round(midSalary * (0.90 + Math.random() * 0.20));

      _state.spontaneousApplicants.push({
        ...fac,
        applicationSource:  'spontaneous',
        salaryExpectation,
        salaryRange,
        availableIn:        Math.random() < 0.7 ? 0 : 1,
        applicationDate:    _state.meta.turn,
        preferredDept:      randomDept.id,
      });
    }
  }

  // Kazanma/kaybetme kontrolü
  const winLoseResult = checkWinLose();

  // Özet oluştur
  const summary = getTurnSummary(simResults);

  return {
    ...summary,
    ...winLoseResult,
    simWarnings: simResults.warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// _saveStats — İstatistik kaydı
// ─────────────────────────────────────────────────────────────────────────────

function _saveStats(simResults) {
  _state.stats.history.push({
    turn:            _state.meta.turn,
    year:            _state.meta.year,
    semester:        _state.meta.semester,
    budget:          _state.university.budget,
    debt:            _state.university.debt,
    prestige:        _state.university.prestige,
    ranking:         _state.university.ranking,
    totalStudents:   _state.students.totalEnrolled,
    facultyCount:    _state.faculty.length,
    publications:    _state.research.publications,
    budgetDelta:     simResults.budgetDelta,
    prestigeDelta:   simResults.prestigeDelta,
  });

  // Bellek tasarrufu: son 40 tur saklansın
  if (_state.stats.history.length > 40) {
    _state.stats.history.shift();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AKREDİTASYON — Yardımcı Fonksiyonlar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bir bölümün akreditasyon gereksinimlerini kontrol eder.
 * @returns {{ allMet: boolean, checks: object[] }}
 */
export function checkAccreditationRequirements(state, dept, body) {
  const req = body.requirements;
  const deptFaculty = state.faculty.filter(f =>
    (f.department || f.departmentId) === dept.id
  );
  const profOrDoc = deptFaculty.filter(f =>
    f.title === 'profesor' || f.title === 'docent'
  ).length;
  const avgResearch = deptFaculty.length > 0
    ? deptFaculty.reduce((s, f) => s + (f.stats?.research ?? 0), 0) / deptFaculty.length
    : 0;
  const avgTeaching = deptFaculty.length > 0
    ? deptFaculty.reduce((s, f) => s + (f.stats?.teaching ?? 0), 0) / deptFaculty.length
    : 0;

  // Laboratuvar sayısı: labScore üzerinden tahmin (veya labRequirement)
  const labCount = Math.floor((dept.labScore ?? 0) / 25);

  // Müfredat kapsaması: assignCourses sonuçlarından veya educationQuality'den türet
  const curriculumCoverage = Math.min(1, (dept.educationQuality ?? 50) / 100 + 0.2);

  const avgPubPerFaculty = deptFaculty.length > 0
    ? (dept.avgPublicationPerFaculty ?? 0)
    : 0;

  const checks = [
    {
      key: 'minFaculty',
      label: 'Öğretim üyesi sayısı',
      current: deptFaculty.length,
      required: req.minFaculty,
      met: deptFaculty.length >= (req.minFaculty || 0),
    },
    {
      key: 'minProfOrDoc',
      label: 'Prof/Doç sayısı',
      current: profOrDoc,
      required: req.minProfOrDoc,
      met: profOrDoc >= (req.minProfOrDoc || 0),
    },
    {
      key: 'minAvgResearch',
      label: 'Ort. araştırma puanı',
      current: Math.round(avgResearch),
      required: req.minAvgResearch,
      met: avgResearch >= (req.minAvgResearch || 0),
    },
    {
      key: 'minAvgTeaching',
      label: 'Ort. eğitim puanı',
      current: Math.round(avgTeaching),
      required: req.minAvgTeaching,
      met: avgTeaching >= (req.minAvgTeaching || 0),
    },
    {
      key: 'minLabCount',
      label: 'Laboratuvar sayısı',
      current: labCount,
      required: req.minLabCount,
      met: req.minLabCount == null || labCount >= req.minLabCount,
    },
    {
      key: 'minCurriculumCoverage',
      label: 'Müfredat kapsaması',
      current: `%${Math.round(curriculumCoverage * 100)}`,
      required: `%${Math.round((req.minCurriculumCoverage || 0) * 100)}`,
      met: curriculumCoverage >= (req.minCurriculumCoverage || 0),
    },
    {
      key: 'minStudentSatisfaction',
      label: 'Öğrenci memnuniyeti',
      current: dept.studentSatisfaction ?? 50,
      required: req.minStudentSatisfaction,
      met: (dept.studentSatisfaction ?? 50) >= (req.minStudentSatisfaction || 0),
    },
    {
      key: 'hasDeptHead',
      label: 'Bölüm başkanı',
      current: dept.headId ? 'Atanmış' : 'Atanmamış',
      required: 'Atanmış',
      met: req.hasDeptHead ? !!dept.headId : true,
    },
  ];

  if (req.minPublicationsPerFaculty != null) {
    checks.push({
      key: 'minPublicationsPerFaculty',
      label: 'Yayın / öğretim üyesi',
      current: avgPubPerFaculty.toFixed(1),
      required: req.minPublicationsPerFaculty,
      met: avgPubPerFaculty >= req.minPublicationsPerFaculty,
    });
  }

  // Yalnızca tanımlı gereksinimleri dahil et
  const relevantChecks = checks.filter(c => c.required != null);
  const allMet = relevantChecks.every(c => c.met);
  return { allMet, checks: relevantChecks };
}

/**
 * Akreditasyon başvurusu yap.
 * @returns {{ success: boolean, message: string }}
 */
export function applyForAccreditation(deptId, bodyId) {
  if (!_state) return { success: false, message: 'Oyun başlatılmamış.' };
  const dept = _state.departments.find(d => d.id === deptId);
  if (!dept) return { success: false, message: 'Bölüm bulunamadı.' };
  const body = ACCREDITATION_BODIES[bodyId];
  if (!body) return { success: false, message: 'Akreditasyon kuruluşu bulunamadı.' };

  // Bölüm kategorisi kontrolü
  if (!body.applicableTo.includes('all') && !body.applicableTo.includes(dept.category)) {
    return { success: false, message: `${body.name} akreditasyonu bu bölüm kategorisi için uygulanamaz.` };
  }

  // accreditation alanı yoksa başlat
  if (!dept.accreditation) {
    dept.accreditation = {
      mudek: { status: 'none', appliedAt: null, grantedAt: null, expiresAt: null, processTime: null },
      abet:  { status: 'none', appliedAt: null, grantedAt: null, expiresAt: null, processTime: null },
      theqa: { status: 'none', appliedAt: null, grantedAt: null, expiresAt: null, processTime: null },
    };
  }

  const acc = dept.accreditation[bodyId];
  if (!acc) return { success: false, message: 'Akreditasyon verisi bulunamadı.' };

  if (acc.status === 'applied' || acc.status === 'under_review') {
    return { success: false, message: `${body.name} başvurusu zaten devam ediyor.` };
  }
  if (acc.status === 'granted') {
    return { success: false, message: `${body.name} akreditasyonu zaten mevcut.` };
  }

  const cost = (acc.status === 'expired') ? body.renewalCost : body.cost;
  if (_state.university.budget < cost) {
    return { success: false, message: `Yetersiz bütçe. Gerekli: ${cost.toLocaleString('tr-TR')} ₺` };
  }

  _state.university.budget -= cost;
  acc.status = 'applied';
  acc.appliedAt = _state.meta.turn;
  acc.processTime = body.processingTime.min +
    Math.floor(Math.random() * (body.processingTime.max - body.processingTime.min + 1));

  return {
    success: true,
    message: `${dept.name} bölümü için ${body.name} başvurusu yapıldı. Değerlendirme ${acc.processTime} dönem sürecek.`,
  };
}

/**
 * Her dönem akreditasyon durumlarını işler (runSimulation içinden çağrılır).
 */
function _processAccreditations(state, results) {
  const MAX_P = MAX_PRESTIGE;
  state.departments.forEach(dept => {
    if (!dept.isOpen) return;
    if (!dept.accreditation) return;

    Object.entries(dept.accreditation).forEach(([bodyId, acc]) => {
      const body = ACCREDITATION_BODIES[bodyId];
      if (!body) return;

      // Başvuru değerlendirme
      if (acc.status === 'applied') {
        const elapsed = state.meta.turn - acc.appliedAt;
        const pt = acc.processTime || body.processingTime.min;
        if (elapsed >= pt) {
          const reqResult = checkAccreditationRequirements(state, dept, body);
          if (reqResult.allMet) {
            acc.status = 'granted';
            acc.grantedAt = state.meta.turn;
            acc.expiresAt = state.meta.turn + body.duration;
            state.university.prestige = Math.min(MAX_P,
              (state.university.prestige || 0) + body.prestigeBonus
            );
            results.events.push({
              type: 'accreditation_granted',
              description: `🏅 ${dept.name} bölümü ${body.name} akreditasyonu aldı! (+${body.prestigeBonus} saygınlık)`,
            });
          } else {
            acc.status = 'rejected';
            results.events.push({
              type: 'accreditation_rejected',
              description: `⚠️ ${dept.name} bölümünün ${body.name} başvurusu reddedildi.`,
            });
          }
        }
      }

      // Süre dolumu kontrolü
      if (acc.status === 'granted' && acc.expiresAt != null && state.meta.turn >= acc.expiresAt) {
        acc.status = 'expired';
        const penalty = Math.floor(body.prestigeBonus / 2);
        state.university.prestige = Math.max(0, (state.university.prestige || 0) - penalty);
        results.events.push({
          type: 'accreditation_expired',
          description: `⏰ ${dept.name} bölümünün ${body.name} akreditasyonu süresi doldu! (-${penalty} saygınlık)`,
        });
      }

      // Yaklaşan süre uyarısı (2 dönem kala)
      if (acc.status === 'granted' && acc.expiresAt != null &&
          (acc.expiresAt - state.meta.turn) === 2) {
        results.events.push({
          type: 'accreditation_expiring_soon',
          description: `⚠️ ${dept.name} bölümünün ${body.name} akreditasyonu 2 dönem sonra sona eriyor! Yenilemeyi unutmayın.`,
        });
      }
    });
  });
}

/**
 * Akreditasyonun YKS etkisini hesapla (öğrenci kayıt kalitesi için).
 * @param {object} dept
 * @returns {number} YKS sıralama düzeltmesi (negatif = daha iyi öğrenci)
 */
export function getAccreditationYKSBonus(dept) {
  if (!dept.accreditation) return 0;
  let bonus = 0;
  Object.entries(dept.accreditation).forEach(([bodyId, acc]) => {
    if (acc.status === 'granted') {
      const body = ACCREDITATION_BODIES[bodyId];
      if (body) bonus += (body.yksBonus || 0);
    }
  });
  return bonus;
}

/**
 * Bir bölümün akreditasyon saygınlık bonusunu döndürür (ranking için).
 * @param {object} dept
 * @returns {number}
 */
export function getAccreditationPrestigeBonus(dept) {
  if (!dept.accreditation) return 0;
  let bonus = 0;
  Object.entries(dept.accreditation).forEach(([bodyId, acc]) => {
    if (acc.status === 'granted') {
      const body = ACCREDITATION_BODIES[bodyId];
      if (body) bonus += (body.prestigeBonus || 0);
    }
  });
  return bonus;
}

// ─────────────────────────────────────────────────────────────────────────────
// checkWinLose — Kazanma / kaybetme koşulları
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kazanma ve kaybetme koşullarını kontrol eder.
 * Sandbox modda kazanma koşulu yoktur.
 *
 * @returns {{ gameOver: boolean, gameWon: boolean, reason: string|null }}
 */
export function checkWinLose() {
  if (!_state) return { gameOver: false, gameWon: false, reason: null };

  // ── KAYBETME KOŞULU 1: İflas ───────────────────────────────────────────────
  // Kredi sistemi: herhangi bir kredi 3 dönem ödenemezse loanDefault = true → iflas

  if (_state.university.loanDefault === true || _state._internal?.bankruptcyTriggered) {
    _gameOver = true;
    _state._internal.gameOver = true;
    return {
      gameOver: true,
      gameWon:  false,
      reason:   'bankruptcy',
      message:  'Üniversite iflas etti! Bir kredi 3 dönem üst üste ödenemedi.',
    };
  }

  // ── KAYBETME KOŞULU 2: Öğrenci kaybı ──────────────────────────────────────
  // 3 dönem üst üste kapasitenin %40'ından az öğrenci
  const STUDENT_CAPACITY_THRESHOLD = 0.40;
  const STUDENT_TURNS_LIMIT = 3;
  const capacityRatio = _state.students.totalEnrolled / _state.university.totalStudentCapacity;

  if (capacityRatio < STUDENT_CAPACITY_THRESHOLD) {
    _state._internal.consecutiveLowStudentTurns++;
  } else {
    _state._internal.consecutiveLowStudentTurns = 0;
  }

  if (_state._internal.consecutiveLowStudentTurns >= STUDENT_TURNS_LIMIT) {
    _gameOver = true;
    _state._internal.gameOver = true;
    return {
      gameOver: true,
      gameWon:  false,
      reason:   'enrollment_collapse',
      message:  `Öğrenci sayısı ${STUDENT_TURNS_LIMIT} dönem boyunca kapasitenin %40'ının altında kaldı. Üniversite kapandı.`,
    };
  }

  // ── KAZANMA KOŞULLARI (sandbox'ta aktif değil) ────────────────────────────
  if (!_state.meta.isSandbox) {
    // ── Senaryo kazanma/kaybetme koşulları ──────────────────────────────────
    const scenarioWin = _state.meta.scenarioWinCondition;
    if (scenarioWin) {
      const turn = _state.meta.turn;

      // Senaryo: prestij hedefi
      if (scenarioWin.type === 'prestige' && _state.university.prestige >= scenarioWin.target) {
        _gameWon = true;
        _state._internal.gameWon = true;
        return {
          gameOver: false,
          gameWon:  true,
          reason:   'scenario_prestige',
          message:  `Senaryo tamamlandı! Üniversitenizin saygınlığı ${_state.university.prestige}'e ulaştı. Hedef: ${scenarioWin.target}`,
        };
      }

      // Senaryo: sıralama hedefi (düşük sayı daha iyi)
      if (scenarioWin.type === 'ranking' && _state.university.ranking <= scenarioWin.target) {
        _gameWon = true;
        _state._internal.gameWon = true;
        return {
          gameOver: false,
          gameWon:  true,
          reason:   'scenario_ranking',
          message:  `Senaryo tamamlandı! Üniversiteniz ${_state.university.ranking}. sıraya yükseldi. Hedef: İlk ${scenarioWin.target}`,
        };
      }

      // Senaryo: ardışık pozitif bütçe dönemleri
      if (scenarioWin.type === 'budget_positive') {
        if (_state.university.budget > 0) {
          _state.meta.scenarioPositiveTurns = (_state.meta.scenarioPositiveTurns || 0) + 1;
        } else {
          _state.meta.scenarioPositiveTurns = 0;
        }
        if (_state.meta.scenarioPositiveTurns >= (scenarioWin.consecutiveTurns || 10)) {
          _gameWon = true;
          _state._internal.gameWon = true;
          return {
            gameOver: false,
            gameWon:  true,
            reason:   'scenario_budget_positive',
            message:  `Senaryo tamamlandı! Üniversite ${scenarioWin.consecutiveTurns} dönem boyunca pozitif bütçeyle yönetildi.`,
          };
        }
      }

      // Senaryo: maxTurns aşıldıysa başarısız
      if (scenarioWin.maxTurns && turn > scenarioWin.maxTurns) {
        _gameOver = true;
        _state._internal.gameOver = true;
        return {
          gameOver: true,
          gameWon:  false,
          reason:   'scenario_timeout',
          message:  `Senaryo başarısız! ${scenarioWin.maxTurns} dönem içinde hedefe ulaşılamadı.`,
        };
      }
    } else {
      // Standart kazanma koşulları (senaryo seçilmemişse)

      // Kazanma 1: Prestij 90+
      if (_state.university.prestige >= 90) {
        _gameWon = true;
        _state._internal.gameWon = true;
        return {
          gameOver: false,
          gameWon:  true,
          reason:   'prestige_max',
          message:  `Tebrikler! Üniversitenizin saygınlık puanı ${_state.university.prestige}'e ulaştı.`,
        };
      }

      // Kazanma 2: Sıralama 1. oldu
      if (_state.university.ranking === 1) {
        _gameWon = true;
        _state._internal.gameWon = true;
        return {
          gameOver: false,
          gameWon:  true,
          reason:   'ranking_first',
          message:  'Tebrikler! Üniversiteniz ulusal sıralamada 1. sıraya yükseldi!',
        };
      }
    }
  }

  return { gameOver: false, gameWon: false, reason: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// getTurnSummary — Dönem sonu özeti
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bir dönem sonundaki özet objesini oluşturur.
 * nextTurn() içinden çağrılır; bağımsız da kullanılabilir.
 *
 * @param {object} [simResults] — runSimulation() çıktısı (opsiyonel)
 * @returns {object} Dönem özeti
 */
export function getTurnSummary(simResults = {}) {
  if (!_state) return { error: 'Oyun başlatılmamış.' };

  const totalFacultyHappiness = _state.faculty.length > 0
    ? Math.round(_state.faculty.reduce((s, f) => s + (f.happiness || 60), 0) / _state.faculty.length)
    : 0;

  const totalStudentSatisfaction = _state.students.overallSatisfaction ?? 0;

  // Ağırlıklı ortalama GPA (yeni byDepartment yapısından)
  const byDeptGPA = _state.students.byDepartment || {};
  let gpaSum = 0, gpaCount = 0;
  for (const d of Object.values(byDeptGPA)) {
    for (const yr of [d.year1, d.year2, d.year3, d.year4]) {
      if (yr && yr.count && yr.avgGPA > 0) { gpaSum += yr.avgGPA * yr.count; gpaCount += yr.count; }
    }
  }
  const avgGPA = gpaCount > 0 ? (gpaSum / gpaCount).toFixed(2) : '0.00';

  // Tamamlanan dönem bilgisi: nextTurn() sayaçları artırdıktan sonra çağrılır,
  // bu yüzden mevcut semester/year bir sonraki dönemi gösterir → tersine çevir
  const _curSem = _state.meta?.semester;
  const completedSemester = (_curSem === 'güz')   ? 'bahar'
                          : (_curSem === 'bahar') ? 'güz'
                          : 'güz';  // fallback (state corruption durumu)
  // Yıl: bahar→güz geçişinde artar, dolayısıyla "tamamlanan bahar"ın yılı bir azdır
  const _curYear = (typeof _state.meta?.year === 'number' && _state.meta.year > 0)
                  ? _state.meta.year : 1;
  const completedYear = (completedSemester === 'bahar' && _curYear > 1)
                       ? _curYear - 1
                       : _curYear;

  // Mali veriler: runSimulation()'dan gelen economyResult veya geriye dönük hesap
  // Use || 0 instead of ?? 0 to catch NaN (which ?? does NOT catch)
  const revenue   = (simResults.economyIncome?.total  || 0);
  const costs     = (simResults.economyExpenses?.total || 0);
  const rawNet    = simResults.budgetDelta ?? (revenue - costs);
  const net       = isNaN(rawNet) ? (revenue - costs) : rawNet;
  const rawBudget = simResults.economyBudget?.newBudget ?? _state.university.budget;
  const newBudget = isNaN(rawBudget) ? _state.university.budget : rawBudget;

  return {
    // ui.js renderTurnSummary'nin beklediği iç içe yapı
    meta: {
      turn:     _state.meta.turn - 1,
      year:     completedYear,
      semester: completedSemester,
    },

    financial: {
      revenue,
      costs,
      net,
      newBudget,
      budgetStatus:   _state.university.budget >= 0 ? 'pozitif' : 'negatif',
      projectOverhead: simResults.economyIncome?.projectOverhead || 0,
      patentRoyalties: simResults.economyIncome?.patentRoyalties || 0,
    },

    academic: {
      prestige:           isNaN(_state.university.prestige) ? 0 : _state.university.prestige,
      prestigeDelta:      isNaN(simResults.prestigeDelta) ? 0 : (simResults.prestigeDelta ?? 0),
      newRanking:         _state.university.ranking,
      rankingDelta:       isNaN(simResults.rankingDelta) ? 0 : (simResults.rankingDelta ?? 0),
      publications:       _state.research.publications,
      newPublications:    simResults.newPublications  ?? 0,
      avgFacultyHappiness: totalFacultyHappiness,
    },

    students: {
      totalEnrolled:   _state.students.totalEnrolled,
      avgGPA,
      avgSatisfaction: totalStudentSatisfaction,
      newAdmissions:   simResults.admissions?.totalAdmitted ?? 0,
      graduates:       simResults.graduates ?? 0,
      newStarStudents: simResults.newStarStudents?.length ?? 0,
      dropouts:        (simResults.semesterDropouts ?? 0),
      failDropouts:    (simResults.semesterFailDropouts ?? 0),
      dissatisfiedDropouts: (simResults.semesterDissatisfiedDropouts ?? 0),
      transferOut:     (simResults.semesterTransferOut ?? 0),
      transferIn:      (simResults.semesterTransferIn ?? 0),
    },

    // Düz alanlar (geriye dönük uyumluluk ve nextTurn() için)
    turn:            _state.meta.turn - 1,
    year:            completedYear,
    semester:        completedSemester,
    budget:          _state.university.budget,
    debt:            _state.university.debt,
    budgetDelta:     net,
    prestige:        _state.university.prestige,
    ranking:         _state.university.ranking,
    totalStudents:   _state.students.totalEnrolled,
    facultyCount:    _state.faculty.length,
    facultyHappiness: totalFacultyHappiness,
    openDepartments: _state.departments.filter(d => d.isOpen).length,

    events:   simResults.events ?? [],
    gameOver: _gameOver,
    gameWon:  _gameWon,

    // Proje başvuru sonuçları (bu dönem otomatik işlendi)
    projectApplications: _state.research.lastApplicationResults || null,

    // v0.2: Yeni başarımlar ve bekleyen olaylar
    newAchievements: simResults.newAchievements || [],
    pendingRandomEvents: simResults.pendingRandomEvents || [],

    // v0.2: Mezun özeti
    alumni: {
      totalGraduates: _state.alumniData?.totalGraduates || 0,
      notableCount: (_state.alumniData?.notableAlumni || []).length,
      alumniNetwork: _state.alumniData?.alumniNetwork || 0,
      annualDonations: _state.alumniData?.annualDonations || 0,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getState — Mevcut state'i döndür (immutable kopya)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Oyun state'ini dışarıya verir.
 * Derin kopya yapılır; dış kod state'i doğrudan değiştiremez.
 *
 * @returns {object} State'in derin kopyası
 */
export function getState() {
  if (!_state) return null;
  return deepClone(_state);
}

// ─────────────────────────────────────────────────────────────────────────────
// migrateState — Eski kayıtlara v0.3 alanlarını ekler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Yüklenen state'e eksik v0.3 alanlarını varsayılan değerlerle ekler.
 * Tüm eski versiyon kayıtlarına karşı güvenlidir.
 *
 * @param {object} state — Düzenlenecek oyun durumu (in-place)
 */
function migrateState(state) {
  // v0.3 Feature 1: Senaryolar
  if (!state.meta.scenarioId) state.meta.scenarioId = null;
  if (!state.meta.scenarioRules) state.meta.scenarioRules = null;
  if (!state.meta.scenarioWinCondition) state.meta.scenarioWinCondition = null;

  // v0.3 Feature 2: Akreditasyon (dept.accreditation eski kayıtlarda eksik olabilir)
  for (const dept of (state.departments || [])) {
    if (!dept.accreditation) {
      dept.accreditation = {
        mudek: { status: 'none', appliedAt: null, grantedAt: null, expiresAt: null, processTime: null },
        abet:  { status: 'none', appliedAt: null, grantedAt: null, expiresAt: null, processTime: null },
        theqa: { status: 'none', appliedAt: null, grantedAt: null, expiresAt: null, processTime: null },
      };
    }
  }

  // v0.3 Feature 3: TTO — initTTOState ayrıca çağrılıyor (setState içinde)
  // v0.3 Feature 4: Kulüpler — initClubsState ayrıca çağrılıyor (setState içinde)

  // v0.4 Feature: Spor takımları state başlat ve eski kulüplerden migrate et
  initSportsState(state);
  if (state.clubs?.active) {
    const sportClubIds = ['basketbol', 'voleybol', 'espor'];
    const sportClubs   = state.clubs.active.filter(c => sportClubIds.includes(c.typeId));
    for (const club of sportClubs) {
      if (!state.sports.teams.some(t => t.sportId === club.typeId)) {
        state.sports.teams.push({
          id: Date.now() + Math.random(),
          sportId: club.typeId,
          name:    SPORTS[club.typeId]?.name || club.name,
          icon:    SPORTS[club.typeId]?.icon || '⚽',
          level:   Math.min(club.level || 1, 5),
          wins: 0, losses: 0, draws: 0,
          seasonPoints: 0, leaguePosition: null,
          totalInvestment: club.totalInvestment || 0,
          establishedTurn: club.foundedAt || 1,
        });
      }
    }
    state.clubs.active = state.clubs.active.filter(c => !sportClubIds.includes(c.typeId));
  }

  // v0.4 Feature: Kampüs grid layout
  if (!state.campus) {
    initCampusState(state);
  }

  // v0.4 Feature: Banka kredileri sistemi
  if (!state.university.loans) state.university.loans = [];
  if (state.university.totalDebt === undefined || state.university.totalDebt === null) {
    state.university.totalDebt = 0;
  }
  if (state.university.loanDefault === undefined || state.university.loanDefault === null) {
    state.university.loanDefault = false;
  }

  // Negatif bütçeyi kredi dönüşümü (eski kayıtlar için)
  if (state.university.budget < 0) {
    const debtAmount = Math.abs(state.university.budget);
    const migrationBank = BANKS.find(b => b.id === 'kamu_bankasi');
    if (migrationBank) {
      const termSemesters = 12;
      const semesterPayment = calculateLoanPayment(debtAmount, migrationBank.interestRate, termSemesters);
      state.university.loans.push({
        bankId:          'kamu_bankasi',
        bankName:        migrationBank.name,
        bankIcon:        migrationBank.icon,
        principal:       debtAmount,
        remainingAmount: debtAmount,
        interestRate:    migrationBank.interestRate,
        termSemesters,
        remainingTerms:  termSemesters,
        semesterPayment,
        startTurn:       state.meta?.turn || 1,
        overdue:         false,
        overdueCount:    0,
        migratedFromDebt: true,
      });
      state.university.budget  = 0;
      state.university.totalDebt = debtAmount;
    }
  }

  // v0.4 Feature: Lab binalarında linkedDepartments (eski kayıtlarda assignedDepartments kullanılıyordu)
  for (const building of (state.buildings || [])) {
    if (building.type === 'lab') {
      if (!building.linkedDepartments) building.linkedDepartments = [];
      // Eski kayıtlarda assignedDepartments içinde bölümler varsa linkedDepartments'a taşı
      if (building.assignedDepartments && building.assignedDepartments.length > 0) {
        for (const deptId of building.assignedDepartments) {
          if (!building.linkedDepartments.includes(deptId)) {
            building.linkedDepartments.push(deptId);
          }
        }
        building.assignedDepartments = [];
      }
    }
  }
}

// setState — Yüklenen state'i doğrudan uygula (kayıt yükleme için)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kaydedilmiş bir state'i doğrudan oyun state'i olarak ayarlar.
 * Yüklenen state eksik alanlar içeriyorsa varsayılan değerler eklenir.
 *
 * @param {object} loadedState — Yüklenen oyun durumu
 * @returns {boolean} Başarılı mı?
 */
export function setState(loadedState) {
  if (!loadedState || typeof loadedState !== 'object') {
    console.error('[game] setState: geçersiz state');
    return false;
  }

  try {
    // Derin kopya al (referans sorunlarını önle)
    const s = deepClone(loadedState);

    // Eksik üst düzey alanları varsayılanlarla tamamla
    if (!s.meta)         s.meta         = { turn: 1, year: 1, semester: 'güz', difficulty: 'normal' };
    if (s.meta.semester === 'guz') s.meta.semester = 'güz'; // eski kayıtları düzelt
    if (!s.university)   s.university   = {};
    if (!s.departments)  s.departments  = [];
    if (!s.faculty)      s.faculty      = [];
    if (!s.buildings)    s.buildings    = [];
    if (!s.students)     s.students     = { byDepartment: {}, cohorts: [], totalEnrolled: 0, quotas: {}, starStudents: [], overallSatisfaction: 70 };
    else {
      if (s.students.totalEnrolled    === undefined) s.students.totalEnrolled    = 0;
      if (s.students.quotas           === undefined) s.students.quotas           = {};
      if (s.students.starStudents     === undefined) s.students.starStudents     = [];
      if (s.students.overallSatisfaction === undefined) s.students.overallSatisfaction = 70;
    }
    if (!s.economy)      s.economy      = {};
    if (!s.research)     s.research     = { activeProjects: [], completedProjects: [], budget: 0 };
    if (!s.rankings)     s.rankings     = { national: 999, international: null };
    if (!s.rivals)       s.rivals       = [];
    if (!s.events)       s.events       = { history: [], pending: [] };
    if (!s.adminUnits)   s.adminUnits   = {};
    else if (Array.isArray(s.adminUnits)) s.adminUnits = {}; // eski dizi kayıtlarını düzelt
    if (!s.adminStaff)   s.adminStaff   = [];
    if (!s.openPositions)  s.openPositions  = [];
    if (!s.applicants)     s.applicants     = [];
    if (!s.trendHeats)     s.trendHeats     = {};
    if (!s.budgetAllocation) s.budgetAllocation = {};
    if (s.university.budget === undefined || s.university.budget === null) {
      s.university.budget = 0;
    }

    // v0.2: Eksik alumni/başarım alanlarını tamamla
    if (!s.alumniData) s.alumniData = {
      totalGraduates: 0, notableAlumni: [], alumniByDecade: {},
      annualDonations: 0, alumniPrestigeBonus: 0, alumniNetwork: 0, totalDonations: 0,
    };
    if (!s.achievements) s.achievements = {};
    if (!s._randomEventsState) s._randomEventsState = { history: [], pendingEvents: [] };
    if (!s.pendingRandomEvents) s.pendingRandomEvents = [];
    if (!s.stats) s.stats = {};
    if (s.stats.crisesHandled === undefined) s.stats.crisesHandled = 0;

    // v0.3: Akreditasyon alanlarını tamamla (eski kayıtlar için)
    (s.departments || []).forEach(dept => {
      if (!dept.accreditation) {
        dept.accreditation = {
          mudek: { status: 'none', appliedAt: null, grantedAt: null, expiresAt: null, processTime: null },
          abet:  { status: 'none', appliedAt: null, grantedAt: null, expiresAt: null, processTime: null },
          theqa: { status: 'none', appliedAt: null, grantedAt: null, expiresAt: null, processTime: null },
        };
      } else {
        ['mudek', 'abet', 'theqa'].forEach(bid => {
          if (!dept.accreditation[bid]) {
            dept.accreditation[bid] = { status: 'none', appliedAt: null, grantedAt: null, expiresAt: null, processTime: null };
          }
        });
      }
    });

    // v0.3: Eksik alanları tamamla (senaryo, akreditasyon vb.)
    migrateState(s);

    // v0.3: TTO state'ini tamamla (eski kayıtlar için)
    initTTOState(s);

    // v0.3: Kulüpler state'ini tamamla (eski kayıtlar için)
    initClubsState(s);

    // v0.4: Spor takımları state'ini tamamla (eski kayıtlar için)
    // Not: migrateState zaten initSportsState'i çağırıyor, bu idempotent çağrıdır
    initSportsState(s);

    // v0.4: Kampüs grid layout'unu tamamla (eski kayıtlar için)
    if (!s.campus) initCampusState(s);

    // Yükleme sonrası sayaçları sıfırla
    _bankruptcyTurns = 0;
    _lowStudentTurns = 0;
    _gameOver        = false;
    _gameWon         = false;

    _state = s;
    console.log(`[game] setState() tamamlandı → ${s.university?.name}, Tur ${s.meta?.turn}`);
    return true;
  } catch (err) {
    console.error('[game] setState hatası:', err);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// applyDecision — Oyuncu kararını state'e uygula
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Oyuncunun verdiği kararı state'e yansıtır.
 * Desteklenen decision.type değerleri:
 *   'hire_faculty'           — Yeni hoca işe al
 *   'fire_faculty'           — Hoca görevden çıkar
 *   'set_tuition'            — Harç miktarını değiştir
 *   'start_construction'     — Bina inşaatı başlat
 *   'set_budget_allocation'  — Bütçe dağılımı güncelle
 *   'open_department'        — Yeni bölüm aç
 *   'close_department'       — Bölümü kapat
 *   'set_scholarship_policy' — Burs politikasını değiştir
 *
 * @param {object} decision — { type, ...params }
 * @returns {object} İşlem sonucu { success, message, ...changes }
 */
export function applyDecision(decision) {
  if (!_state) throw new Error('Oyun başlatılmamış. Önce initGame() çağırın.');
  if (!decision || !decision.type) {
    return { success: false, message: 'Geçersiz karar: type alanı zorunlu.' };
  }

  switch (decision.type) {

    // ── Hoca İşe Al ──────────────────────────────────────────────────────────
    case 'hire_faculty': {
      const { facultyData } = decision;
      if (!facultyData) return { success: false, message: 'facultyData eksik.' };

      const dept = _state.departments.find(d => d.id === facultyData.departmentId);
      if (!dept) return { success: false, message: `Bölüm bulunamadı: ${facultyData.departmentId}` };

      const uniTemplate = UNIVERSITY_TYPES[_state.meta.universityType];

      // Maaş tavanı kontrolü (devlet üniversiteleri için)
      if (uniTemplate.facultySalaryCap && facultyData.salary > uniTemplate.facultySalaryCap) {
        return {
          success: false,
          message: `Maaş tavan aşıldı. Maksimum: ₺${uniTemplate.facultySalaryCap.toLocaleString('tr-TR')}/ay`,
        };
      }

      // İşe alma gecikmesi (devlet'te 1 dönem)
      const delay = uniTemplate.hiringDelay || 0;

      // Transfer pazarından gelen hocalar zaten tam stats objesine sahip (facultyData.stats)
      // Manuel oluşturulan hocalar için de geriye dönük uyumlu stat çıkarma
      const incomingStats = facultyData.stats || {
        research:   facultyData.researchScore  || 40,
        teaching:   facultyData.teachingScore  || 45,
        management: facultyData.managementScore || 40,
        mentoring:  facultyData.mentoringScore  || 40,
        popularity: facultyData.popularityScore || 40,
        loyalty:    facultyData.loyaltyScore    || 50,
        motivation: facultyData.motivationScore || 60,
      };

      // Yıldız hoca kontrolü: ortalama stat 80+
      const avgIncomingStat = Object.values(incomingStats).reduce((a, b) => a + b, 0) / Object.values(incomingStats).length;
      const isStarFaculty = avgIncomingStat >= 80;

      const newFaculty = {
        id:            facultyData.id || `faculty_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name:          facultyData.name          || 'İsimsiz Hoca',
        title:         facultyData.title         || 'dr_ogr_uyesi',
        department:    facultyData.departmentId  || facultyData.department,
        departmentId:  facultyData.departmentId  || facultyData.department,
        field:         facultyData.field         || null,
        archetype:     facultyData.archetype     || null,
        age:           facultyData.age           || null,
        specializations: facultyData.specializations || [],
        stats:         incomingStats,
        happiness:     facultyData.happiness     || 70,
        salary:        facultyData.salary        || 80_000,
        yearsAtUni:    0,
        publications:  facultyData.publications  || 0,
        hIndex:        facultyData.hIndex        || 0,
        isStarFaculty,
        retirementTurn: randInt(20, 40),
        currentLoad:   { assignedCourses: [], courses: 0 },
        revealed:      facultyData.revealed      || {},
        // Gecikme: devlet üniversitesinde atama sonraki dönem
        activeFromTurn: _state.meta.turn + delay,
      };

      _state.faculty.push(newFaculty);
      dept.assignedFacultyIds.push(newFaculty.id);

      return {
        success:  true,
        message:  delay > 0
          ? `${newFaculty.name} işe alındı. ${delay} dönem sonra göreve başlayacak.`
          : `${newFaculty.name} göreve başladı.`,
        facultyId: newFaculty.id,
      };
    }

    // ── Hoca Görevden Çıkar ───────────────────────────────────────────────────
    case 'fire_faculty': {
      const { facultyId } = decision;
      if (!facultyId) return { success: false, message: 'facultyId eksik.' };

      const idx = _state.faculty.findIndex(f => f.id === facultyId);
      if (idx === -1) return { success: false, message: `Hoca bulunamadı: ${facultyId}` };

      const uniTemplate = UNIVERSITY_TYPES[_state.meta.universityType];

      // Kadrolu (devlet) personeli çıkarma zorluğu
      if (uniTemplate.firingDifficulty === 'very_high') {
        // Tazminat hesapla
        const fired = _state.faculty[idx];
        const severancePay = fired.salary * 6;  // 6 aylık tazminat
        _state.university.budget -= severancePay;

        // Hoca memnuniyeti düşür (moral etkisi)
        _state.faculty.forEach(f => {
          if (f.id !== facultyId) {
            f.happiness = Math.max(0, (f.happiness || 60) - 5);
          }
        });

        const firedName = fired.name;
        _state.faculty.splice(idx, 1);

        // Bölüm referansından kaldır
        _state.departments.forEach(dept => {
          dept.assignedFacultyIds = dept.assignedFacultyIds.filter(id => id !== facultyId);
        });

        return {
          success:      true,
          message:      `${firedName} kadrodan çıkarıldı. Tazminat: ₺${severancePay.toLocaleString('tr-TR')}`,
          severancePay,
          moraleImpact: -5,
        };
      }

      // Sözleşmeli personel
      const firedName = _state.faculty[idx].name;
      _state.faculty.splice(idx, 1);
      _state.departments.forEach(dept => {
        dept.assignedFacultyIds = dept.assignedFacultyIds.filter(id => id !== facultyId);
      });

      return { success: true, message: `${firedName} sözleşmesi sonlandırıldı.` };
    }

    // ── Harç Miktarı Değiştir ─────────────────────────────────────────────────
    case 'set_tuition': {
      const { amount } = decision;
      if (typeof amount !== 'number' || amount < 0) {
        return { success: false, message: 'Geçersiz harç miktarı.' };
      }

      // Devlet üniversitelerinde harç sabit (YÖK belirler)
      if (_state.university.tuitionControl === 'fixed') {
        return {
          success: false,
          message: 'Devlet üniversitelerinde harç miktarı YÖK tarafından belirlenir; değiştirilemez.',
        };
      }

      const prevTuition = _state.university.tuitionPerSemester;
      const changeRatio = amount / prevTuition;

      // Büyük artışlar öğrenci memnuniyetini düşürür
      if (changeRatio > 1.2) {
        const satisfactionPenalty = Math.round((changeRatio - 1.2) * 50);
        // Tüm bölüm sınıflarının memnuniyetini düşür
        const byDeptTuition = _state.students.byDepartment || {};
        for (const d of Object.values(byDeptTuition)) {
          for (const yr of [d.year1, d.year2, d.year3, d.year4]) {
            if (yr) yr.satisfaction = Math.max(0, (yr.satisfaction || 60) - satisfactionPenalty);
          }
        }
        _state.students.overallSatisfaction = Math.max(0,
          (_state.students.overallSatisfaction || 60) - satisfactionPenalty);
        _state.university.tuitionPerSemester = amount;
        return {
          success:     true,
          message:     `Harç ₺${amount.toLocaleString('tr-TR')}'ye güncellendi. Yüksek artış öğrenci memnuniyetini ${satisfactionPenalty} puan düşürdü.`,
          satisfactionPenalty: -satisfactionPenalty,
        };
      }

      _state.university.tuitionPerSemester = amount;
      return {
        success: true,
        message: `Harç ₺${amount.toLocaleString('tr-TR')}'ye güncellendi.`,
      };
    }

    // ── Bina İnşaatı Başlat ───────────────────────────────────────────────────
    case 'start_construction': {
      const { buildingType, name } = decision;

      if (!buildingType) return { success: false, message: 'buildingType eksik.' };

      const catalog = BUILDINGS[buildingType];
      if (!catalog) return { success: false, message: `Bilinmeyen bina tipi: ${buildingType}.` };

      const cost       = catalog.baseCost ?? catalog.constructionCost;
      const totalTurns = catalog.constructionTurns ?? catalog.constructionTime ?? 2;
      const baseArea   = catalog.baseArea ?? 1000;

      if (_state.university.budget < cost) {
        return {
          success: false,
          message: `Yetersiz bütçe. İnşaat için en az ₺${cost.toLocaleString('tr-TR')} gerekli.`,
        };
      }

      // canHaveMultiple=false olanlar zaten mevcutsa engelle
      const sameTypeBuildings = _state.buildings.filter(b => b.type === buildingType);
      if (!catalog.canHaveMultiple && sameTypeBuildings.length > 0) {
        return { success: false, message: `${catalog.name} zaten mevcut veya yapım aşamasında.` };
      }

      // Aynı tipte yapım aşamasındaki bina varsa engelle (canHaveMultiple=true için de)
      const inProgress = sameTypeBuildings.some(b => !b.isCompleted);
      if (inProgress) {
        return { success: false, message: `${catalog.name} zaten yapım aşamasında.` };
      }

      // Benzersiz id oluştur (tip + sıra no)
      const typeCount = _state.buildings.filter(b => b.type === buildingType).length + 1;
      const buildingId = `${buildingType}_${typeCount}`;

      // Kapasite hesapla (seviye 1)
      const currentCapacity = _buildingCapacityAtLevel(catalog, 1);
      const maintenanceCost = Math.round(baseArea * (catalog.maintenanceCostPerM2 ?? 50));

      const building = {
        id:                   buildingId,
        type:                 buildingType,
        name:                 name || `${catalog.name} ${typeCount > 1 ? typeCount : ''}`.trim(),
        level:                1,
        area:                 baseArea,
        status:               'under_construction',
        turnsRemaining:       totalTurns,
        totalTurns:           totalTurns,
        constructionProgress: 0,
        isCompleted:          false,
        constructionCost:     cost,
        condition:            100,
        assignedDepartments:  [],
        ...(buildingType === 'lab' ? { linkedDepartments: [] } : {}),
        assignedFaculty:      [],
        currentCapacity,
        usedCapacity:         _emptyCapacity(currentCapacity),
        maintenanceCost,
      };

      _state.university.budget -= cost;
      _state.buildings.push(building);

      // v0.4: Kampüs haritasına yerleştir
      assignBuildingPosition(_state, building);

      return {
        success:    true,
        message:    `${building.name} inşaatı başladı. ${totalTurns} dönem sonra tamamlanacak.`,
        buildingId: building.id,
        cost,
      };
    }

    // ── Bina Düzey Yükselt ────────────────────────────────────────────────────
    case 'upgrade_building': {
      const { buildingId } = decision;
      if (!buildingId) return { success: false, message: 'buildingId eksik.' };

      const building = _state.buildings.find(b => b.id === buildingId);
      if (!building) return { success: false, message: `Bina bulunamadı: ${buildingId}` };
      if (!building.isCompleted) return { success: false, message: 'Bina henüz tamamlanmamış.' };
      if (building.status === 'upgrading') return { success: false, message: 'Bina zaten yükseltiliyor.' };

      const catalog = BUILDINGS[building.type];
      if (!catalog) return { success: false, message: 'Bina tipi bulunamadı.' };

      const maxLevel = catalog.maxLevel ?? 3;
      if (building.level >= maxLevel) {
        return { success: false, message: `${building.name} zaten maksimum düzeyde (${maxLevel}).` };
      }

      const upgradeCostMult = catalog.upgradeCostMultiplier ?? 1.5;
      const baseCost        = catalog.baseCost ?? catalog.constructionCost;
      const upgradeCost     = Math.round(baseCost * Math.pow(upgradeCostMult, building.level));
      const totalTurns      = catalog.constructionTurns ?? catalog.constructionTime ?? 2;

      if (_state.university.budget < upgradeCost) {
        return {
          success: false,
          message: `Yetersiz bütçe. Yükseltme için ₺${upgradeCost.toLocaleString('tr-TR')} gerekli.`,
        };
      }

      _state.university.budget -= upgradeCost;
      building.status           = 'upgrading';
      building.turnsRemaining   = totalTurns;
      building.totalTurns       = totalTurns;
      building.constructionProgress = 0;
      building.isCompleted      = false;
      building._pendingLevel    = building.level + 1;

      return {
        success:     true,
        message:     `${building.name} Düzey ${building.level + 1}'e yükseltme başladı. ${totalTurns} dönem sürer.`,
        upgradeCost,
      };
    }

    // ── Bölüm Binaya Ata ──────────────────────────────────────────────────────
    case 'assign_department_to_building': {
      const { buildingId, departmentId } = decision;
      if (!buildingId || !departmentId) return { success: false, message: 'buildingId veya departmentId eksik.' };

      const building = _state.buildings.find(b => b.id === buildingId);
      if (!building) return { success: false, message: `Bina bulunamadı: ${buildingId}` };
      if (!building.isCompleted) return { success: false, message: 'Bina henüz tamamlanmamış.' };

      const dept = _state.departments.find(d => d.id === departmentId);
      if (!dept) return { success: false, message: `Bölüm bulunamadı: ${departmentId}` };

      if (building.type === 'lab') {
        // Lab binası: bölümü taşıma — sadece linkedDepartments'a ekle
        if (!building.linkedDepartments) building.linkedDepartments = [];
        if (!building.linkedDepartments.includes(departmentId)) {
          building.linkedDepartments.push(departmentId);
        }
        _recalcDeptLabScores(_state);
      } else {
        // Normal bina: assignedDepartments'a ekle
        if (!building.assignedDepartments.includes(departmentId)) {
          building.assignedDepartments.push(departmentId);
        }
        // Kullanım kapasitesini anında güncelle
        const usage = calculateBuildingUsage(building, _state);
        if (!building.usedCapacity) building.usedCapacity = {};
        building.usedCapacity.classrooms = usage.usedClassrooms;
        building.usedCapacity.offices    = usage.usedOffices;
        building.usedCapacity.labs       = usage.usedLabs;
      }

      return {
        success: true,
        message: building.type === 'lab'
          ? `${dept.name} bölümü ${building.name} lab binasına bağlandı.`
          : `${dept.name} bölümü ${building.name} binasına atandı.`,
      };
    }

    // ── Bölümü Binadan Çıkar ──────────────────────────────────────────────────
    case 'unassign_department_from_building': {
      const { buildingId, departmentId } = decision;
      if (!buildingId || !departmentId) return { success: false, message: 'buildingId veya departmentId eksik.' };

      const building = _state.buildings.find(b => b.id === buildingId);
      if (!building) return { success: false, message: `Bina bulunamadı: ${buildingId}` };

      if (building.type === 'lab') {
        // Lab binası: linkedDepartments'tan kaldır
        building.linkedDepartments = (building.linkedDepartments || []).filter(d => d !== departmentId);
        _recalcDeptLabScores(_state);
      } else {
        building.assignedDepartments = building.assignedDepartments.filter(d => d !== departmentId);
        // Kullanım kapasitesini anında güncelle
        const usageAfterRemove = calculateBuildingUsage(building, _state);
        if (!building.usedCapacity) building.usedCapacity = {};
        building.usedCapacity.classrooms = usageAfterRemove.usedClassrooms;
        building.usedCapacity.offices    = usageAfterRemove.usedOffices;
        building.usedCapacity.labs       = usageAfterRemove.usedLabs;
      }

      return { success: true, message: 'Bölüm ataması kaldırıldı.' };
    }

    // ── Bina Yeniden Adlandır ─────────────────────────────────────────────────
    case 'rename_building': {
      const { buildingId, newName } = decision;
      if (!buildingId || !newName) return { success: false, message: 'buildingId veya newName eksik.' };
      const building = _state.buildings.find(b => b.id === buildingId);
      if (!building) return { success: false, message: `Bina bulunamadı: ${buildingId}` };
      building.name = newName.trim();
      return { success: true, message: `Bina adı "${building.name}" olarak güncellendi.` };
    }

    // ── Bütçe Dağılımı Güncelle ───────────────────────────────────────────────
    case 'set_budget_allocation': {
      const { allocation } = decision;
      if (!allocation) return { success: false, message: 'allocation objesi eksik.' };

      // Toplam %100 kontrolü
      const total = Object.values(allocation).reduce((s, v) => s + v, 0);
      if (Math.abs(total - 1.0) > 0.01) {
        return {
          success: false,
          message: `Bütçe dağılımı toplamı 1.0 (%%100) olmalı. Mevcut toplam: ${total.toFixed(2)}`,
        };
      }

      // Geçerli anahtarları doğrula
      const validKeys = Object.keys(_state.university.budgetAllocation);
      for (const key of Object.keys(allocation)) {
        if (!validKeys.includes(key)) {
          return { success: false, message: `Bilinmeyen bütçe kalemi: ${key}` };
        }
      }

      _state.university.budgetAllocation = { ...allocation };

      return {
        success:    true,
        message:    'Bütçe dağılımı güncellendi.',
        allocation: _state.university.budgetAllocation,
      };
    }

    // ── Bölüm Aç ──────────────────────────────────────────────────────────────
    case 'open_department': {
      const { departmentId } = decision;
      if (!departmentId) return { success: false, message: 'departmentId eksik.' };

      // Zaten açık mı?
      if (_state.departments.find(d => d.id === departmentId && d.isOpen)) {
        return { success: false, message: `${departmentId} bölümü zaten açık.` };
      }

      const template = DEPARTMENTS[departmentId];
      if (!template) return { success: false, message: `Bilinmeyen bölüm: ${departmentId}` };

      // Açılış maliyeti kontrolü
      if (_state.university.budget < template.startCost) {
        return {
          success: false,
          message: `Yetersiz bütçe. ${template.name} için ₺${template.startCost.toLocaleString('tr-TR')} gerekli.`,
        };
      }

      // YÖK kısıtı (devlet üniversiteleri)
      const uniTemplate = UNIVERSITY_TYPES[_state.meta.universityType];
      if (uniTemplate.yokRestrictions) {
        // TODO: YÖK onay simülasyonu — şimdilik %70 onay şansı
        if (Math.random() > 0.7) {
          return {
            success: false,
            message: `${template.name} için YÖK onayı alınamadı. Bir sonraki dönem tekrar başvurabilirsiniz.`,
          };
        }
      }

      _state.university.budget -= template.startCost;

      // Mevcut listede kapalı halde varsa yeniden aç
      const existing = _state.departments.find(d => d.id === departmentId);
      if (existing) {
        existing.isOpen = true;
        return { success: true, message: `${template.name} yeniden açıldı.`, cost: template.startCost };
      }

      // Yeni bölüm olarak ekle
      const newDept = buildDepartmentState(departmentId);
      _state.departments.push(newDept);

      return {
        success: true,
        message: `${template.name} açıldı. Açılış maliyeti: ₺${template.startCost.toLocaleString('tr-TR')}`,
        cost:    template.startCost,
      };
    }

    // ── Bölüm Kapat ───────────────────────────────────────────────────────────
    case 'close_department': {
      const { departmentId } = decision;
      if (!departmentId) return { success: false, message: 'departmentId eksik.' };

      const dept = _state.departments.find(d => d.id === departmentId);
      if (!dept || !dept.isOpen) {
        return { success: false, message: `${departmentId} bölümü zaten kapalı veya mevcut değil.` };
      }

      // En az 1 bölüm açık kalmalı
      const openCount = _state.departments.filter(d => d.isOpen).length;
      if (openCount <= 1) {
        return { success: false, message: 'En az bir bölüm açık kalmalıdır.' };
      }

      dept.isOpen = false;

      // Bölüm öğrencileri transfere zorlanır (memnuniyet düşer)
      const deptDataClose = _state.students.byDepartment?.[departmentId];
      let affectedStudentCount = 0;
      if (deptDataClose) {
        for (const yr of [deptDataClose.year1, deptDataClose.year2, deptDataClose.year3, deptDataClose.year4]) {
          if (yr) {
            yr.satisfaction = Math.max(0, (yr.satisfaction || 60) - 20);
            affectedStudentCount += yr.count || 0;
          }
        }
      }

      return {
        success:         true,
        message:         `${dept.name} kapatıldı. Mevcut öğrenciler etkilenebilir.`,
        affectedStudents: affectedStudentCount,
      };
    }

    // ── Araştırma Bütçesi (hoca başına dönemlik fon) ──────────────────────────
    case 'research_budget': {
      const { amount } = decision;
      if (typeof amount !== 'number' || amount < 0) {
        return { success: false, message: 'Geçersiz araştırma bütçesi miktarı.' };
      }
      _state.researchBudgetPerFaculty = amount;
      return {
        success: true,
        message: `Araştırma bütçesi hoca başına ${amount.toLocaleString('tr-TR')} ₺ olarak güncellendi.`,
      };
    }

    // ── Genel Gider Kesinti Oranı ─────────────────────────────────────────────
    case 'set_overhead_rate': {
      const { rate } = decision;
      if (typeof rate !== 'number' || rate < 0 || rate > 0.50) {
        return { success: false, message: 'Geçersiz genel gider oranı. 0 ile 0.50 arasında olmalıdır.' };
      }
      if (!_state.universitySettings) _state.universitySettings = {};
      _state.universitySettings.overheadRate = rate;
      let msg = `Genel gider kesinti oranı %${Math.round(rate * 100)} olarak güncellendi.`;
      if (rate > 0.30) msg += ' ⚠️ Hocalar proje başvurusundan büyük ölçüde kaçınacak!';
      else if (rate > 0.25) msg += ' ⚠️ Hocalar proje başvurusunu azaltabilir.';
      else if (rate > 0.20) msg += ' ℹ️ Hocalar başvuru konusunda biraz isteksiz olabilir.';
      return { success: true, message: msg };
    }

    // ── Burs Politikası Değiştir ──────────────────────────────────────────────
    case 'set_scholarship_policy': {
      const { policy, budgetRatio } = decision;
      const validPolicies = ['merit', 'need', 'mixed', 'none'];

      if (policy && !validPolicies.includes(policy)) {
        return { success: false, message: `Geçersiz burs politikası: ${policy}. Geçerli: ${validPolicies.join(', ')}` };
      }

      // Eski API uyumluluğu — yeni sistemde kontenjan tabanlı burs
      if (budgetRatio !== undefined) {
        _state.students._legacyScholarshipRatio = budgetRatio;
      }
      if (policy) {
        _state.students._legacyScholarshipPolicy = policy;
      }

      // Burs politikası öğrenci memnuniyetini ve talebini etkiler
      const policyEffects = {
        merit:  { satisfactionDelta: +3, demandDelta: +0.03 },
        need:   { satisfactionDelta: +5, demandDelta: +0.05 },
        mixed:  { satisfactionDelta: +4, demandDelta: +0.04 },
        none:   { satisfactionDelta: -5, demandDelta: -0.05 },
      };

      const effect = policyEffects[policy || 'merit'];
      if (effect) {
        // Tüm bölüm sınıflarının memnuniyetini güncelle
        const byDeptPol = _state.students.byDepartment || {};
        for (const d of Object.values(byDeptPol)) {
          for (const yr of [d.year1, d.year2, d.year3, d.year4]) {
            if (yr) yr.satisfaction = Math.max(0, Math.min(100, (yr.satisfaction || 60) + effect.satisfactionDelta));
          }
        }
        _state.students.overallSatisfaction = Math.max(0, Math.min(100,
          (_state.students.overallSatisfaction || 60) + effect.satisfactionDelta));
      }

      return {
        success: true,
        message: `Burs politikası "${policy || 'merit'}" olarak güncellendi.`,
        effect,
      };
    }

    // ── Açık Kadro İlanı Ver ─────────────────────────────────────────────────
    case 'post_open_position': {
      const { position } = decision;
      if (!position) return { success: false, message: 'position verisi eksik.' };
      if (!_state.openPositions) _state.openPositions = [];
      _state.openPositions.push(position);
      const _alanMesaj = position.allFields
        ? 'Tüm alanlarda'
        : (Array.isArray(position.fields) && position.fields.length > 0
            ? position.fields.join(', ') + ' alanında'
            : (position.field ? position.field + ' alanında' : 'Belirtilen alanda'));
      return {
        success: true,
        message: `${_alanMesaj} kadro ilanı verildi.`,
      };
    }

    // ── Başvurucu Kabul Et ────────────────────────────────────────────────────
    case 'accept_applicant': {
      const { applicantId } = decision;
      if (!applicantId) return { success: false, message: 'applicantId eksik.' };
      if (!_state.pendingApplicants) _state.pendingApplicants = [];

      const appIdx = _state.pendingApplicants.findIndex(a => a.id === applicantId);
      if (appIdx === -1) return { success: false, message: 'Başvurucu bulunamadı.' };

      const applicant = _state.pendingApplicants[appIdx];

      // Bölümü bul
      const dept = _state.departments.find(d => d.id === applicant.department && d.isOpen)
        || _state.departments.find(d => d.isOpen);
      if (!dept) return { success: false, message: 'Uygun açık bölüm bulunamadı.' };

      const rawSalaryA = applicant.salaryExpectation || applicant.salary || 80_000;
      const newFaculty = {
        ...applicant,
        departmentId:  dept.id,
        department:    dept.id,
        salary:        isNaN(rawSalaryA) ? 80_000 : rawSalaryA,
        currentLoad:   { assignedCourses: [], courses: 0 },
        activeFromTurn: _state.meta.turn,
        applicationSource: 'open_position',
      };

      _state.faculty.push(newFaculty);
      if (!dept.assignedFacultyIds) dept.assignedFacultyIds = [];
      dept.assignedFacultyIds.push(newFaculty.id);

      // Başvurucuyu listeden çıkar
      _state.pendingApplicants.splice(appIdx, 1);

      return {
        success: true,
        message: `${applicant.name} kadromuza katıldı! Maaş: ${(applicant.salaryExpectation || 0).toLocaleString('tr-TR')} ₺/ay`,
        facultyId: newFaculty.id,
      };
    }

    // ── Başvurucu Reddet ──────────────────────────────────────────────────────
    case 'reject_applicant': {
      const { applicantId } = decision;
      if (!applicantId) return { success: false, message: 'applicantId eksik.' };
      if (!_state.pendingApplicants) _state.pendingApplicants = [];

      const appIdx = _state.pendingApplicants.findIndex(a => a.id === applicantId);
      if (appIdx !== -1) {
        _state.pendingApplicants.splice(appIdx, 1);
      }
      return { success: true, message: 'Başvuru reddedildi.' };
    }

    // ── Spontane Başvurucu Kabul Et ───────────────────────────────────────────
    case 'accept_spontaneous': {
      const { applicantId, targetDeptId } = decision;
      if (!applicantId) return { success: false, message: 'applicantId eksik.' };
      if (!_state.spontaneousApplicants) _state.spontaneousApplicants = [];

      const appIdx = _state.spontaneousApplicants.findIndex(a => a.id === applicantId);
      if (appIdx === -1) return { success: false, message: 'Spontane başvurucu bulunamadı.' };

      const applicant = _state.spontaneousApplicants[appIdx];

      // Hedef bölümü belirle
      const assignDeptId = targetDeptId || applicant.preferredDept || applicant.department;
      const dept = _state.departments.find(d => d.id === assignDeptId && d.isOpen)
        || _state.departments.find(d => d.isOpen);
      if (!dept) return { success: false, message: 'Uygun açık bölüm bulunamadı.' };

      const rawSalaryS = applicant.salaryExpectation || applicant.salary || 80_000;
      const newFaculty = {
        ...applicant,
        departmentId:  dept.id,
        department:    dept.id,
        salary:        isNaN(rawSalaryS) ? 80_000 : rawSalaryS,
        currentLoad:   { assignedCourses: [], courses: 0 },
        activeFromTurn: _state.meta.turn,
        applicationSource: 'spontaneous',
      };

      _state.faculty.push(newFaculty);
      if (!dept.assignedFacultyIds) dept.assignedFacultyIds = [];
      dept.assignedFacultyIds.push(newFaculty.id);

      // Listeden kaldır
      _state.spontaneousApplicants.splice(appIdx, 1);

      return {
        success:   true,
        message:   `${applicant.name} ${dept.name} bölümüne kadromuza katıldı! Maaş: ${(applicant.salaryExpectation || 0).toLocaleString('tr-TR')} ₺/ay`,
        facultyId: newFaculty.id,
      };
    }

    // ── Spontane Başvurucu Reddet ─────────────────────────────────────────────
    case 'reject_spontaneous': {
      const { applicantId } = decision;
      if (!applicantId) return { success: false, message: 'applicantId eksik.' };
      if (!_state.spontaneousApplicants) _state.spontaneousApplicants = [];

      const idx = _state.spontaneousApplicants.findIndex(a => a.id === applicantId);
      if (idx !== -1) _state.spontaneousApplicants.splice(idx, 1);
      return { success: true, message: 'Spontane başvuru reddedildi.' };
    }

    // ── Hoca Sözleşme Feshi (Zenginleştirilmiş + Feature 4: Akıllı Çıkarma) ──
    case 'fire_faculty_confirmed': {
      const { facultyId } = decision;
      if (!facultyId) return { success: false, message: 'facultyId eksik.' };

      const idx = _state.faculty.findIndex(f => f.id === facultyId);
      if (idx === -1) return { success: false, message: `Hoca bulunamadı: ${facultyId}` };

      const fired = _state.faculty[idx];

      // Bölüm başkanı kontrolü
      const deptOfFired = _state.departments.find(d => d.headId === facultyId);
      if (deptOfFired) {
        return {
          success: false,
          message: `${fired.name} ${deptOfFired.name} bölüm başkanıdır. Önce başkanlık görevini sonlandırın.`,
        };
      }

      // Kıdem tazminatı: 3 aylık maaş
      const severancePay = (fired.salary || 0) * 3;
      if (_state.university.budget < severancePay) {
        return {
          success: false,
          message: `Kıdem tazminatı için yeterli bütçe yok. Gereken: ₺${severancePay.toLocaleString('tr-TR')}`,
        };
      }
      _state.university.budget -= severancePay;

      // ── Feature 4: Akıllı Çıkarma Moral Etkisi ──────────────────────────────
      const firedDeptId    = fired.department || fired.departmentId;
      const deptFacultyArr = _state.faculty.filter(f =>
        f.id !== facultyId && (f.department || f.departmentId) === firedDeptId
      );
      const deptAvgRating  = deptFacultyArr.length > 0
        ? deptFacultyArr.reduce((s, f) => s + (f.overallRating || calculateOverallRating(f)), 0) / deptFacultyArr.length
        : 50;
      const firedRating    = fired.overallRating || calculateOverallRating(fired);

      let moraleDelta = -3;
      let moraleMessage = 'Kadro değişikliği bölümü etkiledi.';

      if (firedRating < deptAvgRating - 5) {
        // Niteliksiz birini çıkardık
        moraleDelta    = +3;
        moraleMessage  = 'Niteliksiz bir hocanın ayrılığı bölüm kadrosunu güçlendirdi, moral arttı.';
      } else if (firedRating > deptAvgRating + 15) {
        // İyi birini kaybettik
        moraleDelta    = -8;
        moraleMessage  = 'Değerli bir hocanın ayrılığı moralleri bozdu.';
      }

      const uniPenalty  = moraleDelta < 0 ? 1 : 0;

      _state.faculty.forEach(f => {
        if (f.id === facultyId) return;
        const sameDept = (f.department || f.departmentId) === firedDeptId;
        if (sameDept) {
          f.happiness = Math.max(0, Math.min(100, (f.happiness || 60) + moraleDelta));
        } else {
          f.happiness = Math.max(0, (f.happiness || 60) - uniPenalty);
        }
      });

      const firedName = fired.name;
      const affectedCourses = (fired.currentLoad?.assignedCourses || []).map(c => c.courseName);

      _state.faculty.splice(idx, 1);

      // Bölüm referansından kaldır
      _state.departments.forEach(dept => {
        if (dept.assignedFacultyIds) {
          dept.assignedFacultyIds = dept.assignedFacultyIds.filter(id => id !== facultyId);
        }
      });

      return {
        success:         true,
        message:         `${firedName} sözleşmesi feshedildi. Kıdem tazminatı: ₺${severancePay.toLocaleString('tr-TR')}. ${moraleMessage}`,
        severancePay,
        moraleImpact:    { dept: moraleDelta, uni: -uniPenalty },
        moraleMessage,
        affectedCourses,
        firedRating,
        deptAvgRating: Math.round(deptAvgRating),
      };
    }

    // ── Feature 2: Yeni Bölüm / Program Başvurusu ─────────────────────────────
    case 'apply_new_program': {
      const { appType, deptId, programType, requestedQuota } = decision;
      const type = appType || programType;

      if (!type) return { success: false, message: 'Başvuru tipi (appType) eksik.' };
      if (!_state.pendingApplications) _state.pendingApplications = [];

      // Zaten bekleyen başvuru var mı?
      const existingApp = _state.pendingApplications.find(a =>
        a.deptId === deptId && a.type === type
      );
      if (existingApp) {
        return { success: false, message: 'Bu bölüm/program için bekleyen bir başvuru zaten var.' };
      }

      if (type === 'yeni_bolum') {
        // Yeni bölüm başvurusu
        const template = AVAILABLE_NEW_DEPARTMENTS.find(d => d.id === deptId);
        if (!template) return { success: false, message: `Bilinmeyen bölüm: ${deptId}` };

        // Bölüm zaten açık mı?
        const alreadyOpen = _state.departments.find(d => d.id === deptId);
        if (alreadyOpen) return { success: false, message: 'Bu bölüm zaten açık.' };

        // Maliyet kontrolü
        const cost = template.cost || 2_500_000;
        if (_state.university.budget < cost) {
          return { success: false, message: `Yeterli bütçe yok. Gereken: ₺${cost.toLocaleString('tr-TR')}` };
        }
        _state.university.budget -= cost;

        // YÖK onay süresi (2-4 dönem; prestij yüksekse daha hızlı)
        const prestige = _state.university.prestige || 20;
        const minTurns = prestige >= 60 ? 2 : 3;
        const maxTurns = prestige >= 60 ? 3 : 4;
        const turnsRemaining = randInt(minTurns, maxTurns);

        _state.pendingApplications.push({
          id:             `app_${Date.now()}_${deptId}`,
          type:           'yeni_bolum',
          deptId,
          name:           template.name,
          submittedTurn:  _state.meta.turn,
          turnsRemaining,
          cost,
        });

        return {
          success: true,
          message: `${template.name} bölüm başvurusu YÖK'e gönderildi. Onay süresi: ${turnsRemaining} dönem. Başvuru maliyeti: ₺${cost.toLocaleString('tr-TR')}`,
          turnsRemaining,
          cost,
        };

      } else if (type === 'yuksek_lisans' || type === 'doktora') {
        // Lisansüstü program başvurusu
        if (!deptId) return { success: false, message: 'Bölüm ID eksik.' };
        const dept = _state.departments.find(d => d.id === deptId);
        if (!dept) return { success: false, message: `Bölüm bulunamadı: ${deptId}` };

        // Gereksinim kontrolü
        const deptFaculty = _state.faculty.filter(f => (f.department || f.departmentId) === deptId);
        const drPlus = deptFaculty.filter(f => ['dr_ogr_uyesi','docent','profesor'].includes(f.title)).length;
        const profCount = deptFaculty.filter(f => f.title === 'profesor').length;

        if (type === 'yuksek_lisans' && drPlus < 3) {
          return { success: false, message: `YL programı için en az 3 Dr.Öğr.Üyesi+ gerekli. Mevcut: ${drPlus}` };
        }
        if (type === 'doktora' && profCount < 2) {
          return { success: false, message: `Doktora programı için en az 2 Profesör gerekli. Mevcut: ${profCount}` };
        }

        // Zaten aktif mi?
        if (dept.programs?.[type]?.active) {
          return { success: false, message: `Bu bölümde ${type === 'yuksek_lisans' ? 'Yüksek Lisans' : 'Doktora'} programı zaten aktif.` };
        }

        const cost = type === 'doktora' ? 500_000 : 200_000;
        if (_state.university.budget < cost) {
          return { success: false, message: `Yeterli bütçe yok. Gereken: ₺${cost.toLocaleString('tr-TR')}` };
        }
        _state.university.budget -= cost;

        const prestige = _state.university.prestige || 20;
        const turnsRemaining = prestige >= 50 ? 1 : 2;

        _state.pendingApplications.push({
          id:              `app_${Date.now()}_${deptId}_${type}`,
          type,
          deptId,
          programType:     type,
          requestedQuota:  requestedQuota || 10,
          submittedTurn:   _state.meta.turn,
          turnsRemaining,
          cost,
        });

        const label = type === 'yuksek_lisans' ? 'Yüksek Lisans' : 'Doktora';
        return {
          success: true,
          message: `${dept.name} — ${label} programı YÖK'e başvuruldu. Onay süresi: ${turnsRemaining} dönem.`,
          turnsRemaining,
          cost,
        };

      } else {
        return { success: false, message: `Bilinmeyen başvuru tipi: ${type}` };
      }
    }

    // ── Maaş Ayarla ──────────────────────────────────────────────────────────
    case 'adjust_salary': {
      const { facultyId, newSalary } = decision;
      if (!facultyId) return { success: false, message: 'facultyId eksik.' };
      if (typeof newSalary !== 'number' || newSalary <= 0) {
        return { success: false, message: 'Geçersiz maaş değeri.' };
      }

      const fac = _state.faculty.find(f => f.id === facultyId);
      if (!fac) return { success: false, message: `Hoca bulunamadı: ${facultyId}` };

      const oldSalary   = fac.salary || 0;
      const monthlyCost = newSalary - oldSalary;
      fac.salary = newSalary;

      // Maaş artışı mutluluğu etkiler
      if (newSalary > oldSalary) {
        const happBonus = Math.min(15, Math.round((newSalary - oldSalary) / oldSalary * 50));
        fac.happiness = Math.min(100, (fac.happiness || 60) + happBonus);
        fac._salaryUnhappy = false;
      } else if (newSalary < oldSalary) {
        fac.happiness = Math.max(0, (fac.happiness || 60) - 10);
      }

      return {
        success:     true,
        message:     `${fac.name} maaşı güncellendi: ₺${newSalary.toLocaleString('tr-TR')}/ay`,
        oldSalary,
        newSalary,
        monthlyCostDelta: monthlyCost,
      };
    }

    // ── Ödül Ver ─────────────────────────────────────────────────────────────
    case 'give_award': {
      const { facultyId, awardType } = decision;
      if (!facultyId) return { success: false, message: 'facultyId eksik.' };

      const fac = _state.faculty.find(f => f.id === facultyId);
      if (!fac) return { success: false, message: `Hoca bulunamadı: ${facultyId}` };

      const AWARD_DEFS = {
        arastirma: { label: 'Araştırma Ödülü', morale: 5,  prestige: 0,  cost: 50_000  },
        egitim:    { label: 'Eğitim Ödülü',    morale: 5,  prestige: 0,  cost: 30_000  },
        yilin:     { label: 'Yılın Hocası',    morale: 10, prestige: 3,  cost: 100_000 },
      };

      const awardDef = AWARD_DEFS[awardType];
      if (!awardDef) return { success: false, message: `Bilinmeyen ödül tipi: ${awardType}` };

      if (_state.university.budget < awardDef.cost) {
        return {
          success: false,
          message: `Ödül için yeterli bütçe yok. Gereken: ₺${awardDef.cost.toLocaleString('tr-TR')}`,
        };
      }

      _state.university.budget -= awardDef.cost;
      fac.happiness = Math.min(100, (fac.happiness || 60) + awardDef.morale);

      if (awardDef.prestige > 0) {
        _state.university.prestige = Math.min(100, (_state.university.prestige || 0) + awardDef.prestige);
      }

      // Aktif ödülleri kaydet (3 dönem sürer)
      if (!fac.activeAwards) fac.activeAwards = [];
      if (!fac.awardHistory) fac.awardHistory = [];
      fac.activeAwards.push({
        type:          awardType,
        label:         awardDef.label,
        morale:        awardDef.morale,
        givenAtTurn:   _state.meta.turn,
        expiresAtTurn: _state.meta.turn + 3,
      });
      fac.awardHistory.push({
        type:        awardType,
        label:       awardDef.label,
        givenAtTurn: _state.meta.turn,
      });

      return {
        success:     true,
        message:     `${fac.name} "${awardDef.label}" ödülüne layık görüldü. Moral +${awardDef.morale}`,
        cost:        awardDef.cost,
        moraleBonus: awardDef.morale,
        prestigeBonus: awardDef.prestige,
      };
    }

    // ── Unvan Yükselt ─────────────────────────────────────────────────────────
    case 'promote_faculty': {
      const { facultyId } = decision;
      if (!facultyId) return { success: false, message: 'facultyId eksik.' };

      const fac = _state.faculty.find(f => f.id === facultyId);
      if (!fac) return { success: false, message: `Hoca bulunamadı: ${facultyId}` };

      if (!fac.promotionEligible) {
        return { success: false, message: `${fac.name} henüz yükseltme kriterlerini karşılamıyor.` };
      }

      const TITLE_ORDER = ['argö', 'dr_ogr_uyesi', 'docent', 'profesor'];
      const currentIdx  = TITLE_ORDER.indexOf(fac.title);
      if (currentIdx === -1 || currentIdx >= TITLE_ORDER.length - 1) {
        return { success: false, message: `${fac.name} zaten en yüksek unvanda (Profesör).` };
      }

      const newTitle = TITLE_ORDER[currentIdx + 1];
      const oldTitle = fac.title;
      fac.title      = newTitle;

      // Maaş baremi yükseltilmiş unvana göre güncelle
      const uniType     = _state.meta.universityType || 'vakif';
      const newRange    = getSalaryRange(newTitle, uniType);
      fac.salaryRange   = newRange;
      // Yeni unvanın barem minimumuna yükselt (zaten daha yüksekse değiştirme)
      if (fac.salary < newRange.min) {
        fac.salary = newRange.min;
      }

      fac.promotionEligible      = false;
      fac.promotionEligibleSince = null;
      fac._promotionAnxiety      = false;
      fac.happiness = Math.min(100, (fac.happiness || 60) + 15);

      const TITLE_LABELS = { dr_ogr_uyesi: 'Dr. Öğr. Üyesi', docent: 'Doçent', profesor: 'Profesör', argö: 'ArGö' };

      return {
        success:   true,
        message:   `${fac.name} ${TITLE_LABELS[newTitle]} unvanına yükseltildi! Moral +15`,
        oldTitle,
        newTitle,
        newSalary: fac.salary,
      };
    }

    // ── Hoca Başvurusunu Onayla ───────────────────────────────────────────────
    case 'approve_project_application': {
      const { applicationId } = decision;
      if (!applicationId) return { success: false, message: 'applicationId eksik.' };

      if (!_state.research) _state.research = {};
      if (!_state.research.pendingProjectApplications) _state.research.pendingProjectApplications = [];
      if (!_state.research.activeResearchProjects) _state.research.activeResearchProjects = [];

      const appIdx = _state.research.pendingProjectApplications.findIndex(a => a.id === applicationId);
      if (appIdx === -1) return { success: false, message: 'Başvuru bulunamadı.' };

      const app = _state.research.pendingProjectApplications[appIdx];

      // Dış kurum kararı simüle et
      const accepted = Math.random() < (app.successProbability || 0.35);
      _state.research.pendingProjectApplications.splice(appIdx, 1);

      if (accepted) {
        const activeProj = {
          ...app,
          id:          `proj_${Date.now()}_${app.facultyId}`,
          piId:        app.facultyId,
          piName:      app.facultyName,
          currentTurn: 0,
          progress:    0,
          status:      'active',
          startedTurn: _state.meta.turn,
          successChance: app.successProbability,
          funding:     app.requestedFunding,
        };
        _state.research.activeResearchProjects.push(activeProj);
        return {
          success: true,
          accepted: true,
          message: `✅ ${app.callType} — "${app.projectName}" kabul edildi! PI: ${app.facultyName}`,
          project: activeProj,
        };
      } else {
        return {
          success: true,
          accepted: false,
          message: `❌ ${app.callType} — "${app.projectName}" fon kurumu tarafından reddedildi.`,
        };
      }
    }

    // ── Hoca Başvurusunu Reddet ───────────────────────────────────────────────
    case 'reject_project_application': {
      const { applicationId } = decision;
      if (!applicationId) return { success: false, message: 'applicationId eksik.' };

      if (!_state.research?.pendingProjectApplications) return { success: false, message: 'Başvuru listesi yok.' };

      const idx = _state.research.pendingProjectApplications.findIndex(a => a.id === applicationId);
      if (idx === -1) return { success: false, message: 'Başvuru bulunamadı.' };

      const app = _state.research.pendingProjectApplications[idx];
      _state.research.pendingProjectApplications.splice(idx, 1);
      return { success: true, message: `"${app.projectName}" başvurusu reddedildi.` };
    }

    // ── BAP Çağrısı Aç ────────────────────────────────────────────────────────
    case 'open_bap_call': {
      const { totalBudget, maxPerProject, field } = decision;
      if (!totalBudget || totalBudget <= 0) return { success: false, message: 'Geçersiz bütçe.' };
      if (_state.university.budget < totalBudget) return { success: false, message: 'Yetersiz üniversite bütçesi.' };

      if (!_state.research) _state.research = {};

      if (_state.research.activeBapCall) return { success: false, message: 'Zaten aktif bir BAP çağrısı var.' };

      _state.research.activeBapCall = {
        id:            `bap_${_state.meta.turn}`,
        totalBudget,
        maxPerProject: maxPerProject || Math.round(totalBudget / 5),
        field:         field || 'any',
        remainingBudget: totalBudget,
        openedTurn:    _state.meta.turn,
      };
      _state.university.budget -= totalBudget;
      _state.research.bapApplications = [];

      // Hocalar anında başvurusunu oluşturur (iç çağrı, daha yüksek katılım)
      _state.faculty.forEach(f => {
        if (f.title === 'argö' && Math.random() > 0.3) return;
        const researchScore = f.stats?.research || f.researchScore || 40;
        const applyChance   = Math.min(0.85, (researchScore / 120));
        if (Math.random() < applyChance) {
          const reqFunding = Math.min(
            _state.research.activeBapCall.maxPerProject,
            Math.round(randBetween(30_000, _state.research.activeBapCall.maxPerProject) / 10_000) * 10_000
          );
          const titleMap = { argö: 'ArGö', dr_ogr_uyesi: 'Dr.Öğr.Üyesi', docent: 'Doç.', profesor: 'Prof. Dr.' };
          const titleStr = titleMap[f.title] || f.title || '';
          _state.research.bapApplications.push({
            id:           `bap_app_${_state.meta.turn}_${f.id}`,
            facultyId:    f.id,
            facultyName:  `${titleStr} ${f.name}`,
            facultyTitle: f.title,
            facultyDept:  f.department,
            projectName:  _generateProjectName(f.specializations || f.researchAreas),
            requestedFunding: reqFunding,
            duration:     2,
            estimatedPublications: Math.max(1, Math.floor(researchScore / 40)),
            status:       'pending_approval',
          });
        }
      });

      return {
        success: true,
        message: `BAP çağrısı açıldı. Toplam bütçe: ${formatMoneyShort(totalBudget)}. ${_state.research.bapApplications.length} başvuru geldi.`,
        applicationCount: _state.research.bapApplications.length,
      };
    }

    // ── BAP Başvurusunu Onayla ────────────────────────────────────────────────
    case 'approve_bap_application': {
      const { applicationId } = decision;
      if (!applicationId) return { success: false, message: 'applicationId eksik.' };
      if (!_state.research?.activeBapCall) return { success: false, message: 'Aktif BAP çağrısı yok.' };

      const idx = (_state.research.bapApplications || []).findIndex(a => a.id === applicationId);
      if (idx === -1) return { success: false, message: 'BAP başvurusu bulunamadı.' };

      const app = _state.research.bapApplications[idx];
      const bap = _state.research.activeBapCall;

      if (bap.remainingBudget < app.requestedFunding) {
        return { success: false, message: 'BAP bütçesi yetersiz.' };
      }

      bap.remainingBudget -= app.requestedFunding;
      _state.research.bapApplications.splice(idx, 1);

      if (!_state.research.activeResearchProjects) _state.research.activeResearchProjects = [];
      const activeProj = {
        ...app,
        id:           `bap_proj_${Date.now()}_${app.facultyId}`,
        callType:     'BAP',
        callIcon:     '📋',
        piId:         app.facultyId,
        piName:       app.facultyName,
        currentTurn:  0,
        progress:     0,
        status:       'active',
        startedTurn:  _state.meta.turn,
        successChance: 0.75,
        funding:      app.requestedFunding,
        prestigeReward: 1,
        publicationBonus: app.estimatedPublications,
      };
      _state.research.activeResearchProjects.push(activeProj);

      // BAP bütçesi bittiyse çağrıyı kapat
      if (bap.remainingBudget < 30_000) {
        _state.research.activeBapCall = null;
      }

      return {
        success: true,
        message: `BAP projesi onaylandı: "${app.projectName}" — PI: ${app.facultyName}`,
        project: activeProj,
      };
    }

    // ── BAP Başvurusunu Reddet ────────────────────────────────────────────────
    case 'reject_bap_application': {
      const { applicationId } = decision;
      if (!applicationId) return { success: false, message: 'applicationId eksik.' };

      const idx = (_state.research?.bapApplications || []).findIndex(a => a.id === applicationId);
      if (idx === -1) return { success: false, message: 'BAP başvurusu bulunamadı.' };

      const app = _state.research.bapApplications[idx];
      _state.research.bapApplications.splice(idx, 1);
      return { success: true, message: `BAP başvurusu reddedildi: "${app.projectName}"` };
    }

    // ── v0.2: Alumni Etkinliği ────────────────────────────────────────────────
    case 'organize_alumni_event': {
      const result = organizeAlumniEvent(_state, decision.eventType);
      return result;
    }

    // ── v0.2: Rastgele Olay Seçimi ─────────────────────────────────────────
    case 'apply_random_event': {
      const result = applyRandomEventChoice(_state, decision.eventId, decision.choiceIndex);
      // Bekleyen listeden bu olayı kaldır
      if (_state.pendingRandomEvents) {
        _state.pendingRandomEvents = _state.pendingRandomEvents.filter(e => e.id !== decision.eventId);
      }
      return result;
    }

    // ── Kredi Çek ─────────────────────────────────────────────────────────────
    case 'take_loan': {
      const { bankId, amount, termSemesters } = decision;

      // Banka var mı?
      const bank = BANKS.find(b => b.id === bankId);
      if (!bank) return { success: false, message: `Banka bulunamadı: ${bankId}` };

      // Miktar kontrolü
      if (!amount || amount <= 0) return { success: false, message: 'Kredi miktarı sıfırdan büyük olmalı.' };
      if (amount > bank.maxLoan) {
        return {
          success: false,
          message: `${bank.name} maksimum ₺${bank.maxLoan.toLocaleString('tr-TR')} kredi verebilir.`,
        };
      }

      // Vade kontrolü
      if (!termSemesters || !bank.terms.includes(termSemesters)) {
        return {
          success: false,
          message: `Geçersiz vade. ${bank.name} için geçerli vadeler: ${bank.terms.join(', ')} dönem.`,
        };
      }

      // minResearchScore kontrolü
      if (bank.minResearchScore) {
        const researchScore = safeNum(_state.research?.researchScore ?? _state.research?.publications ?? 0);
        if (researchScore < bank.minResearchScore) {
          return {
            success: false,
            message: `${bank.name} için araştırma puanı ≥ ${bank.minResearchScore} gerekli. Mevcut: ${researchScore}.`,
          };
        }
      }

      // Taksit hesapla
      const semesterPayment = calculateLoanPayment(amount, bank.interestRate, termSemesters);

      // Krediyi kaydet
      if (!_state.university.loans) _state.university.loans = [];
      _state.university.loans.push({
        bankId,
        bankName:       bank.name,
        bankIcon:       bank.icon,
        principal:      amount,
        remainingAmount: amount,
        interestRate:   bank.interestRate,
        termSemesters,
        remainingTerms: termSemesters,
        semesterPayment,
        startTurn:      _state.turn || _state.meta?.turn || 1,
        overdue:        false,
        overdueCount:   0,
      });

      // Bütçeye ekle
      _state.university.budget += amount;

      // totalDebt güncelle
      _state.university.totalDebt = (_state.university.loans || [])
        .reduce((s, l) => s + safeNum(l.remainingAmount), 0);

      return {
        success: true,
        message: `${bank.name}'dan ₺${amount.toLocaleString('tr-TR')} kredi alındı. ` +
                 `Dönem taksiti: ₺${semesterPayment.toLocaleString('tr-TR')} × ${termSemesters} dönem.`,
        semesterPayment,
      };
    }

    // ── Kredi Erken Öde ───────────────────────────────────────────────────────
    case 'repay_loan_early': {
      const { loanIndex } = decision;
      const loans = _state.university.loans || [];

      if (loanIndex < 0 || loanIndex >= loans.length) {
        return { success: false, message: 'Geçersiz kredi indeksi.' };
      }

      const loan = loans[loanIndex];
      const repayAmount = safeNum(loan.remainingAmount);

      if (safeNum(_state.university.budget) < repayAmount) {
        return {
          success: false,
          message: `Erken ödeme için yeterli bütçe yok. Gerekli: ₺${repayAmount.toLocaleString('tr-TR')}`,
        };
      }

      // Ödemeyi yap
      _state.university.budget -= repayAmount;
      loans.splice(loanIndex, 1);
      _state.university.loans = loans;

      // totalDebt güncelle
      _state.university.totalDebt = loans.reduce((s, l) => s + safeNum(l.remainingAmount), 0);

      return {
        success: true,
        message: `Kredi tamamen ödendi. ₺${repayAmount.toLocaleString('tr-TR')} bütçeden düşüldü.`,
      };
    }

    // ── Topluluk Kur ──────────────────────────────────────────────────────────
    case 'found_club': {
      return foundClub(_state, decision.typeId);
    }
    case 'upgrade_club': {
      return upgradeClub(_state, decision.clubId);
    }
    case 'dissolve_club': {
      return dissolveClub(_state, decision.clubId);
    }

    // ── Spor Takımı Kur ────────────────────────────────────────────────────────
    case 'found_team': {
      const result = foundTeam(_state, decision.sportId);
      return result;
    }

    // ── Spor Takımı Yükselt ─────────────────────────────────────────────────────
    case 'upgrade_team': {
      const result = upgradeTeam(_state, decision.teamId);
      return result;
    }

    // ── Spor Takımı Kapat ───────────────────────────────────────────────────────
    case 'dissolve_team': {
      const result = dissolveTeam(_state, decision.teamId);
      return result;
    }

    // ── Bilinmeyen Karar Tipi ─────────────────────────────────────────────────
    default:
      return {
        success: false,
        message: `Bilinmeyen karar tipi: ${decision.type}. Desteklenen tipler: hire_faculty, fire_faculty, set_tuition, start_construction, set_budget_allocation, open_department, close_department, set_scholarship_policy, post_open_position, accept_applicant, reject_applicant, approve_project_application, reject_project_application, open_bap_call, approve_bap_applications, reject_bap_application, set_overhead_rate, organize_alumni_event, apply_random_event, take_loan, repay_loan_early`,
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sandbox mod açma/kapama (UI için)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sandbox modunu açar/kapatır.
 * Sandbox'ta kazanma koşulları devre dışıdır.
 *
 * @param {boolean} enabled
 */
export function setSandboxMode(enabled) {
  if (!_state) throw new Error('Oyun başlatılmamış.');
  _state.meta.isSandbox = !!enabled;
}

// ─────────────────────────────────────────────────────────────────────────────
// İstatistik sorgu yardımcıları
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Son N tura ait bütçe geçmişini döndürür.
 *
 * @param {number} [n=10] — Kaç tur geriye bakılsın
 * @returns {object[]}
 */
export function getBudgetHistory(n = 10) {
  if (!_state) return [];
  return _state.university.budgetHistory.slice(-n);
}

/**
 * Aktif bölümlerin güncel anlık özetini döndürür.
 *
 * @returns {object[]}
 */
export function getDepartmentSummaries() {
  if (!_state) return [];
  return _state.departments.filter(d => d.isOpen).map(dept => ({
    id:              dept.id,
    name:            dept.name,
    enrolledStudents: dept.enrolledStudents,
    facultyCount:    dept.assignedFacultyIds.length,
    educationQuality: dept.educationQuality,
    studentSatisfaction: dept.studentSatisfaction,
    researchPotential: dept.researchPotential,
    accreditationStatus: dept.accreditationStatus,
  }));
}

/**
 * Rakip üniversitelerin güncel durumunu döndürür.
 *
 * @returns {object[]}
 */
export function getRivalsSummary() {
  if (!_state) return [];
  return _state.rivals.map(r => ({
    id:           r.id,
    name:         r.name,
    prestige:     r.prestige,
    studentCount: r.studentCount,
    facultyCount: r.facultyCount,
    strengthDept: r.strengthDept,
    avgYKS:       r.avgYKS,
    publicationsPerSemester: r.publicationsPerSemester,
    ranking:      r.ranking,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// assignDeptHead — Bölüm başkanı ata
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bir bölüme bölüm başkanı atar.
 * Sadece Prof veya Doç atanabilir; eski başkanın adminRole'ü temizlenir.
 * @param {string} deptId    — Bölüm id
 * @param {string} facultyId — Atanacak hocanın id'si
 * @returns {{ success: boolean, message: string }}
 */
export function assignDeptHead(deptId, facultyId) {
  if (!_state) return { success: false, message: 'Oyun başlatılmamış.' };

  const dept = (_state.departments || []).find(d => d.id === deptId);
  if (!dept) return { success: false, message: 'Bölüm bulunamadı.' };

  const hoca = (_state.faculty || []).find(f => f.id === facultyId);
  if (!hoca) return { success: false, message: 'Hoca bulunamadı.' };

  if (!['profesor', 'docent'].includes(hoca.title)) {
    return { success: false, message: 'Bölüm başkanı yalnızca Prof. Dr. veya Doç. Dr. unvanlı kişiler arasından seçilebilir.' };
  }

  if (hoca.department !== deptId) {
    return { success: false, message: 'Hoca bu bölümde görev yapmıyor. Önce bölüme atayın.' };
  }

  // Eski başkanın adminRole'ünü temizle
  if (dept.headId) {
    const oldHead = (_state.faculty || []).find(f => f.id === dept.headId);
    if (oldHead && oldHead.currentLoad?.adminRole === 'bolum_baskani') {
      oldHead.currentLoad.adminRole = null;
    }
  }

  // Yeni başkanı ata
  dept.headId = facultyId;
  if (hoca.currentLoad) {
    hoca.currentLoad.adminRole = 'bolum_baskani';
  }

  return { success: true, message: `${hoca.name} "${dept.name}" bölüm başkanı olarak atandı.` };
}

// ─────────────────────────────────────────────────────────────────────────────
// reassignFacultyToDept — Hocayı farklı bölüme taşı
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bir hocayı farklı bir bölüme taşır.
 * Uzmanlık uyuşmazlığı varsa uyarı mesajı eklenir.
 * @param {string} facultyId  — Hoca id
 * @param {string} newDeptId  — Hedef bölüm id
 * @returns {{ success: boolean, message: string, warning?: string }}
 */
export function reassignFacultyToDept(facultyId, newDeptId) {
  if (!_state) return { success: false, message: 'Oyun başlatılmamış.' };

  const hoca = (_state.faculty || []).find(f => f.id === facultyId);
  if (!hoca) return { success: false, message: 'Hoca bulunamadı.' };

  const targetDept = (_state.departments || []).find(d => d.id === newDeptId);
  if (!targetDept) return { success: false, message: 'Hedef bölüm bulunamadı.' };

  const oldDeptId = hoca.department;

  // Eğer bu kişi eski bölümün başkanıysa başkanlığı kaldır
  if (oldDeptId) {
    const oldDept = (_state.departments || []).find(d => d.id === oldDeptId);
    if (oldDept && oldDept.headId === facultyId) {
      oldDept.headId = null;
    }
    // assignedFacultyIds listesini güncelle
    if (oldDept && oldDept.assignedFacultyIds) {
      oldDept.assignedFacultyIds = oldDept.assignedFacultyIds.filter(id => id !== facultyId);
    }
  }

  // Yeni bölüme ata
  hoca.department = newDeptId;
  if (!targetDept.assignedFacultyIds) targetDept.assignedFacultyIds = [];
  if (!targetDept.assignedFacultyIds.includes(facultyId)) {
    targetDept.assignedFacultyIds.push(facultyId);
  }

  // Uzmanlık uyuşmazlığı kontrolü
  let warning = null;
  const { DEPT_TO_FACULTY: _ } = {}; // imported at top
  // Basit kontrol: kategorisi farklıysa uyar
  const DEPT_CATS = { bilgisayar_muh: 'muhendislik', elektrik_elektronik: 'muhendislik', makine: 'muhendislik', insaat: 'muhendislik', endustri: 'muhendislik', biyomedikal: 'muhendislik', yapay_zeka: 'muhendislik', matematik: 'temel_bilim', fizik: 'temel_bilim', kimya: 'temel_bilim', biyoloji: 'temel_bilim', psikoloji: 'sosyal', isletme: 'sosyal', iktisat: 'sosyal', hukuk: 'sosyal', tip: 'saglik', dis_hekimligi: 'saglik', eczacilik: 'saglik', hemsirelik: 'saglik' };
  const originalCat = DEPT_CATS[oldDeptId];
  const targetCat   = DEPT_CATS[newDeptId];
  if (originalCat && targetCat && originalCat !== targetCat) {
    warning = `Uyarı: ${hoca.name} uzmanlık alanı bu bölümle tam uyuşmuyor. Eğitim kalitesi ve hoca memnuniyeti olumsuz etkilenebilir.`;
  }

  if (hoca.currentLoad?.adminRole === 'bolum_baskani') {
    hoca.currentLoad.adminRole = null;
  }

  return {
    success: true,
    message: `${hoca.name} "${targetDept.name}" bölümüne taşındı.`,
    warning,
  };
}
