/**
 * Rektör Oldum — Sıralama ve Prestij Sistemi (ranking.js)
 * ES6 module. Prestij hesaplama, rakip AI güncellemesi ve sıralama raporu.
 */

import {
  RANKING_WEIGHTS,
  MAX_PRESTIGE,
  INITIAL_RIVAL_UNIVERSITIES,
  DIFFICULTY_SETTINGS,
} from './data.js?v=0.4.12';

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI: 0-100 aralığına sıkıştır
// ─────────────────────────────────────────────────────────────────────────────

function clamp(val, min = 0, max = 100) {
  return Math.max(min, Math.min(max, val));
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI: Rastgele tam sayı (dahil, dahil)
// ─────────────────────────────────────────────────────────────────────────────

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateEducationScore — Eğitim bileşeni puanı
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Eğitim puanı:
 *   hoca öğretim ortalaması × sınıf büyüklüğü çarpanı × mezuniyet oranı
 *
 * @param {object} state — Oyun durumu
 * @returns {number} 0-100 eğitim puanı
 */
export function calculateEducationScore(state) {
  if (!state.faculty || state.faculty.length === 0) return 0;

  // Hoca ortalama öğretim puanı
  const avgTeaching = state.faculty.reduce((s, f) => s + (f.stats?.teaching || f.teachingScore || 50), 0) / state.faculty.length;

  // Sınıf büyüklüğü çarpanı: öğrenci/hoca oranına bakılır
  // İdeal oran ≤ 20; 40'ın üzerinde ciddi düşüş
  const studentCount  = state.students ? (state.students.totalEnrolled || 0) : 0;
  const facultyCount  = state.faculty.length;
  const ratio         = facultyCount > 0 ? studentCount / facultyCount : 30;
  let sizeMultiplier;
  if      (ratio <= 15) sizeMultiplier = 1.10;
  else if (ratio <= 20) sizeMultiplier = 1.00;
  else if (ratio <= 30) sizeMultiplier = 0.90;
  else if (ratio <= 40) sizeMultiplier = 0.78;
  else                  sizeMultiplier = 0.65;

  // Mezuniyet oranı tahmini: byDepartment verisinden GPA > 2.0 oranı
  const byDeptRank    = state.students?.byDepartment || {};
  let totalStudents   = 0;
  let passingStudents = 0;
  for (const d of Object.values(byDeptRank)) {
    for (const yr of [d?.year1, d?.year2, d?.year3, d?.year4]) {
      if (!yr || !yr.count) continue;
      const passFraction = yr.avgGPA >= 2.0 ? 1.0 : (yr.avgGPA >= 1.5 ? 0.6 : 0.3);
      totalStudents   += yr.count;
      passingStudents += yr.count * passFraction;
    }
  }
  // Eski cohort fallback
  if (totalStudents === 0 && state.students?.cohorts?.length > 0) {
    const cohorts = state.students.cohorts;
    totalStudents   = cohorts.reduce((s, c) => s + c.count, 0);
    passingStudents = cohorts.reduce((s, c) => {
      const pf = c.avgGPA >= 2.0 ? 1.0 : (c.avgGPA >= 1.5 ? 0.6 : 0.3);
      return s + c.count * pf;
    }, 0);
  }
  const graduationRate = totalStudents > 0 ? passingStudents / totalStudents : 0.75;

  const score = (avgTeaching / 100) * sizeMultiplier * graduationRate * 100;
  return clamp(Math.round(score));
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateResearchScore — Araştırma bileşeni puanı
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Araştırma puanı:
 *   yayın sayısı, aktif proje sayısı, h-indeks ortalaması, patent sayısı
 *   bileşenlerinden ağırlıklı hesaplanır.
 *
 * @param {object} state — Oyun durumu
 * @returns {number} 0-100 araştırma puanı
 */
export function calculateResearchScore(state) {
  const research = state.research;
  if (!research) return 0;

  // Yayın bileşeni: her 5 yayın ~10 puan (tavan 40)
  const pubScore  = clamp(Math.floor(research.publications / 5) * 10, 0, 40);

  // Proje bileşeni: aktif proje başına 4 puan (tavan 20)
  const projCount = (research.activeProjects || []).length;
  const projScore = clamp(projCount * 4, 0, 20);

  // H-indeks bileşeni: h-indeks puanı (tavan 25)
  const hScore    = clamp((research.hIndex || 0) * 2.5, 0, 25);

  // Patent bileşeni: patent başına 3 puan (tavan 15)
  const patScore  = clamp((research.patents || 0) * 3, 0, 15);

  return clamp(pubScore + projScore + hScore + patScore);
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateAlumniScore — Mezun başarı bileşeni puanı
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mezun puanı:
 *   mezun sayısı × ortalama potansiyel etki × ünlü mezun bonusu
 *
 * @param {object} state — Oyun durumu
 * @returns {number} 0-100 mezun puanı
 */
export function calculateAlumniScore(state) {
  const alumni = state.alumni || [];
  if (alumni.length === 0) return 0;

  // Toplam mezun sayısı (normal kayıtlar count alanı içerir)
  const totalCount = alumni.reduce((s, a) => s + (a.count || 1), 0);

  // Ortalama potansiyel etki (1-5)
  const avgImpact  = alumni.reduce((s, a) => {
    const n = a.count || 1;
    return s + (a.potentialImpact || 1) * n;
  }, 0) / totalCount;

  // Ünlü mezun bonusu: potansiyel etkisi ≥ 4 olan bireysel kayıtlar
  const famousCount = alumni.filter(a => !a.count && (a.potentialImpact || 0) >= 4).length;
  const famousBonus = Math.min(20, famousCount * 5);

  // Taban puan: her 100 mezun 5 puan (tavan 60)
  const baseScore  = clamp(Math.floor(totalCount / 100) * 5, 0, 60);

  // Etki çarpanı: ortalama etki 1-5 → çarpan 0.6-1.4
  const impactMul  = 0.6 + ((avgImpact - 1) / 4) * 0.8;

  return clamp(Math.round(baseScore * impactMul + famousBonus));
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateSatisfactionScore — Memnuniyet bileşeni puanı
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Öğrenci ve hoca memnuniyet ortalamalarının bileşik puanı.
 * Öğrenci memnuniyeti %70, hoca mutluluğu %30 ağırlıklı.
 *
 * @param {object} state — Oyun durumu
 * @returns {number} 0-100 memnuniyet puanı
 */
export function calculateSatisfactionScore(state) {
  // Öğrenci memnuniyeti: overallSatisfaction veya byDepartment ortalaması
  const avgStudentSat = state.students?.overallSatisfaction
    ?? (() => {
      // Eski cohort fallback
      const cohorts = state.students?.cohorts || [];
      const tot = cohorts.reduce((s, c) => s + c.count, 0);
      return tot > 0 ? cohorts.reduce((s, c) => s + c.satisfaction * c.count, 0) / tot : 50;
    })();

  // Hoca mutluluğu: hoca ortalaması
  const faculty       = state.faculty || [];
  const avgFacultyHappy = faculty.length > 0
    ? faculty.reduce((s, f) => s + (f.happinessScore || 50), 0) / faculty.length
    : 50;

  return clamp(Math.round(avgStudentSat * 0.70 + avgFacultyHappy * 0.30));
}

// ─────────────────────────────────────────────────────────────────────────────
// calculatePrestige — Prestij puanı hesapla (0-100)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Beş bileşenden ağırlıklı prestij puanı üretir.
 * RANKING_WEIGHTS kullanılır:
 *   education 0.25, research 0.30, alumni 0.20, satisfaction 0.15, internationalization 0.10
 *
 * @param {object} state — Oyun durumu
 * @returns {number} 0-100 prestij puanı
 */
export function calculatePrestige(state) {
  const education      = calculateEducationScore(state);
  const research       = calculateResearchScore(state);
  const alumni         = calculateAlumniScore(state);
  const satisfaction   = calculateSatisfactionScore(state);

  // Uluslararasılaşma: yabancı öğrenci oranı + uluslararası işbirliği binaları
  const intlRatio      = state.university.internationalRatio || 0.02;
  const hasConference  = state.buildings.some(b => b.type === 'konferans' && b.isCompleted);
  const internationalization = clamp(
    intlRatio * 500 + (hasConference ? 15 : 0)
  );

  const w = RANKING_WEIGHTS;
  const rawPrestige =
    education           * w.education           +
    research            * w.research            +
    alumni              * w.alumni              +
    satisfaction        * w.satisfaction        +
    internationalization * w.internationalization;

  // Vakıf üniversitesi prestij tavanı kontrolü
  const uniType = state.meta.universityType;
  const year    = state.meta.year || 1;
  let ceiling   = MAX_PRESTIGE;
  if (uniType === 'vakif' && year <= 30) {
    ceiling = 75;  // data.js vakif.prestigeCeiling
  }

  // Mevcut prestijle yumuşak geçiş (%80 eski, %20 yeni) — ani sıçramaları engeller
  const current     = state.university.prestige;
  const blended     = current * 0.80 + rawPrestige * 0.20;

  return clamp(Math.round(blended), 0, ceiling);
}

// ─────────────────────────────────────────────────────────────────────────────
// updateRivals — Rakip AI hamleleri simüle et
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Her rakip için dönemlik prestij ve bütçe değişimi hesaplanır.
 * Agresif rakip, oyuncunun en güçlü bölümüne yatırım yapar.
 *
 * @param {object} state — Oyun durumu (doğrudan güncellenir)
 * @returns {Array} Rakip değişim özet listesi
 */
export function updateRivals(state) {
  const changes = [];

  // Zorluk çarpanını al
  const diffKey      = state.meta?.difficulty || 'normal';
  const diffSettings = DIFFICULTY_SETTINGS[diffKey] || DIFFICULTY_SETTINGS.normal;
  const growthRate   = diffSettings.rivalGrowthRate ?? 1.0;

  // Oyuncunun en güçlü bölümü: en yüksek araştırma puanına sahip bölüm
  const strongestDept = state.departments.length > 0
    ? state.departments.reduce((best, d) =>
        (d.educationQuality || 0) > (best.educationQuality || 0) ? d : best
      , state.departments[0])
    : null;

  state.rivals.forEach(rival => {
    const change = { rivalId: rival.id, prestigeDelta: 0, budgetDelta: 0, actions: [] };
    const agg = rival.aggressiveness || 0.5;

    // Prestij büyümesi: agresifliğe ve zorluk büyüme oranına bağlı şans
    if (Math.random() < agg * growthRate) {
      const prestigeGain = Math.round(randInt(1, 3) * growthRate);
      rival.prestige     = clamp(rival.prestige + prestigeGain, 0, 98);
      change.prestigeDelta += prestigeGain;
    }

    // Rastgele prestij dalgalanması: hem yukarı hem aşağı (rakipler statik değil)
    if (Math.random() < 0.45) {
      const delta = randInt(-3, Math.ceil(2 * growthRate));
      rival.prestige = clamp(rival.prestige + delta, 0, 98);
      change.prestigeDelta += delta;
    }

    // Düşük bütçeli rakip prestij kaybedebilir
    if ((rival.budget || 0) < 5_000_000 && Math.random() < 0.4) {
      const decay = randInt(1, 3);
      rival.prestige = clamp(rival.prestige - decay, 0, 98);
      change.prestigeDelta -= decay;
      change.actions.push(`${rival.name} bütçe sıkıntısı nedeniyle kalite kaybetti.`);
    }

    // Bütçe değişimi: gelir - gider simülasyonu
    const budgetDelta = (rival.studentCount || 1000) * 30_000
                      - (rival.facultyCount  || 30)   * 600_000
                      + randInt(-5_000_000, 8_000_000);
    rival.budget       = Math.max(0, (rival.budget || 0) + budgetDelta);
    change.budgetDelta = budgetDelta;

    // Agresif rakip: oyuncunun güçlü bölümüne yatırım
    if (agg > 0.7 && strongestDept) {
      const targetsDept = rival.strengthDept === strongestDept.id
        || rival.strengthDept === strongestDept.category;
      if (targetsDept && Math.random() < agg * 0.4) {
        const extraGain = randInt(1, 2);
        rival.prestige  = clamp(rival.prestige + extraGain, 0, 98);
        change.prestigeDelta += extraGain;
        change.actions.push(`${rival.name} "${strongestDept.name}" bölümüne agresif yatırım yaptı.`);
      }
    }

    // Hoca işe alımı (olasılık: agresifliğe bağlı)
    if (Math.random() < agg * 0.25) {
      const hired = randInt(1, 3);
      rival.facultyCount = (rival.facultyCount || 30) + hired;
      rival.prestige     = clamp(rival.prestige + 1, 0, 98);
      change.prestigeDelta += 1;
      change.actions.push(`${rival.name} ${hired} yeni öğretim üyesi kadrosuna kattı.`);
    }

    // Hoca kaybı (istifa/emeklilik): her dönem küçük şans
    if (Math.random() < 0.20) {
      const lost = randInt(1, 2);
      rival.facultyCount = Math.max(5, (rival.facultyCount || 30) - lost);
      // Eğer çok fazla hoca kaybederse prestij düşer
      if (rival.facultyCount < 20 && Math.random() < 0.5) {
        rival.prestige = clamp(rival.prestige - 1, 0, 98);
        change.prestigeDelta -= 1;
      }
      change.actions.push(`${rival.name} ${lost} öğretim üyesini kadroda tutamadı.`);
    }

    // Öğrenci sayısı: iki yönlü dalgalanma
    if (Math.random() < 0.35) {
      const studentDelta = randInt(-80, 120);
      rival.studentCount = Math.max(200, (rival.studentCount || 1000) + studentDelta);
    }

    // Yayın sayısı: araştırma odaklı rakipler daha hızlı yayın üretir
    if (rival.researchFocus) {
      const pubDelta = randInt(0, 4);
      rival.publicationsPerSemester = (rival.publicationsPerSemester || 5) + pubDelta;
    } else {
      const pubDelta = randInt(-1, 2);
      rival.publicationsPerSemester = Math.max(0, (rival.publicationsPerSemester || 3) + pubDelta);
    }

    // Ortalama YKS: prestij arttıkça YKS ortalaması düşer (daha iyi öğrenci)
    if (rival.prestige > 60 && (rival.avgYKS || 0) > 1000) {
      const yksDelta = randInt(-500, 200);
      rival.avgYKS = Math.max(500, (rival.avgYKS || 10000) + yksDelta);
    } else if ((rival.avgYKS || 0) > 0) {
      const yksDelta = randInt(-200, 500);
      rival.avgYKS = Math.max(500, (rival.avgYKS || 50000) + yksDelta);
    }

    changes.push(change);
  });

  return changes;
}

// ─────────────────────────────────────────────────────────────────────────────
// updateRankings — Tüm üniversiteleri sırala
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Oyuncunun üniversitesi ve tüm rakipleri prestije göre sıralar;
 * her birine ranking atar (1 = en iyi).
 *
 * @param {object} state — Oyun durumu (doğrudan güncellenir)
 * @returns {Array} Sıralanmış üniversite listesi
 */
export function updateRankings(state) {
  // Oyuncunun güncel prestijini hesapla ve state'e yaz
  const newPrestige       = calculatePrestige(state);
  state.university.prestige = newPrestige;

  // Tüm üniversiteleri bir diziye topla
  const allUniversities = [
    {
      id:       'player',
      name:     state.university.name,
      prestige: state.university.prestige,
      isPlayer: true,
    },
    ...state.rivals.map(r => ({
      id:       r.id,
      name:     r.name,
      prestige: r.prestige,
      isPlayer: false,
    })),
  ];

  // Prestije göre azalan sırala
  allUniversities.sort((a, b) => b.prestige - a.prestige);

  // Ranking ata
  allUniversities.forEach((uni, idx) => {
    uni.ranking = idx + 1;
    if (uni.isPlayer) {
      state.university.ranking = uni.ranking;
    } else {
      const rival = state.rivals.find(r => r.id === uni.id);
      if (rival) rival.ranking = uni.ranking;
    }
  });

  return allUniversities;
}

// ─────────────────────────────────────────────────────────────────────────────
// getRankingReport — Sıralama detay raporu
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tüm sıralama bileşenlerini ve rakip karşılaştırmasını içeren rapor üretir.
 *
 * @param {object} state — Oyun durumu
 * @returns {object} Sıralama raporu
 */
export function getRankingReport(state) {
  // Bileşen puanları
  const education       = calculateEducationScore(state);
  const research        = calculateResearchScore(state);
  const alumni          = calculateAlumniScore(state);
  const satisfaction    = calculateSatisfactionScore(state);

  const intlRatio       = state.university.internationalRatio || 0.02;
  const hasConference   = state.buildings.some(b => b.type === 'konferans' && b.isCompleted);
  const internationalization = clamp(intlRatio * 500 + (hasConference ? 15 : 0));

  // Rakip tablosu
  const rivalTable = state.rivals.map(r => ({
    id:       r.id,
    name:     r.name,
    type:     r.type,
    prestige: r.prestige,
    ranking:  r.ranking || '—',
  }));

  // Sıralama
  rivalTable.push({
    id:       'player',
    name:     state.university.name,
    type:     state.meta.universityType,
    prestige: state.university.prestige,
    ranking:  state.university.ranking,
  });
  rivalTable.sort((a, b) => a.ranking - b.ranking);

  return {
    playerPrestige:      state.university.prestige,
    playerRanking:       state.university.ranking,
    totalUniversities:   rivalTable.length,
    components: {
      education,
      research,
      alumni,
      satisfaction,
      internationalization,
    },
    weights:             RANKING_WEIGHTS,
    rankingTable:        rivalTable,
    // Önceki dönemle kıyaslama (stats geçmişinden)
    previousPrestige: state.stats.history.length >= 2
      ? state.stats.history[state.stats.history.length - 2].prestige
      : null,
  };
}
