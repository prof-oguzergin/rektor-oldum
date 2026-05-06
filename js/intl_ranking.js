/**
 * Rektör Oldum — Uluslararası Sıralama Motoru (intl_ranking.js)
 *
 * THE WUR metodolojisini taklit eden 5-pillar hesaplama,
 * sıra bulma ve komşu/filtre yardımcıları.
 */

import { calculateCitationScore, avgFacultyQuality } from './citation_model.js?v=0.4.39';

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI
// ─────────────────────────────────────────────────────────────────────────────

function clamp(val, min = 0, max = 100) {
  return Math.max(min, Math.min(max, val));
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateIntlPillars — 5 pillar skoru (0-100)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Oyuncunun üniversitesi için THE'nin 5 pillar'ını hesaplar.
 *
 * Teaching (Eğitim):
 *   Hoca ortalama öğretim puanı + öğrenci/hoca oranı bonusu + mezuniyet oranı
 *
 * Research Environment (Araştırma Ortamı):
 *   Aktif proje sayısı + hoca kalitesi + h-indeks katkısı + bütçe dağılımı
 *
 * Citations (Atıflar):
 *   citation_model.js'teki calculateCitationScore()
 *
 * International (Uluslararasılık):
 *   Yabancı öğrenci oranı + uluslararası hoca katkısı + konferans binası
 *
 * Industry (Endüstri):
 *   TTO geliri payı + patent sayısı + aktif proje ortaklıkları
 *
 * @param {object} state — Oyun durumu
 * @returns {{ teaching, researchEnvironment, citations, international, industry }}
 */
export function calculateIntlPillars(state) {
  const uni      = state.university || {};
  const research = state.research   || {};
  const faculty  = state.faculty    || [];

  // ── Teaching ───────────────────────────────────────────────────────────────
  const avgTeaching   = faculty.length > 0
    ? faculty.reduce((s, f) => s + (f.stats?.teaching ?? f.teachingScore ?? 50), 0) / faculty.length
    : 30;

  const studentCount  = state.students?.totalEnrolled || 0;
  const facultyCount  = faculty.length || 1;
  const ratio         = studentCount / facultyCount;
  let ratioBonus;
  if      (ratio <= 12) ratioBonus = 15;
  else if (ratio <= 18) ratioBonus = 10;
  else if (ratio <= 25) ratioBonus = 0;
  else if (ratio <= 35) ratioBonus = -8;
  else                  ratioBonus = -18;

  // Mezuniyet oranı proxy
  const byDept    = state.students?.byDepartment || {};
  let totSt = 0, passSt = 0;
  for (const d of Object.values(byDept)) {
    for (const yr of [d?.year1, d?.year2, d?.year3, d?.year4]) {
      if (!yr?.count) continue;
      totSt  += yr.count;
      passSt += yr.count * (yr.avgGPA >= 2.0 ? 1.0 : yr.avgGPA >= 1.5 ? 0.6 : 0.3);
    }
  }
  const gradRate  = totSt > 0 ? passSt / totSt : 0.70;
  const gradBonus = (gradRate - 0.70) * 30;   // %70 baz; her %10 artış ~3 puan

  const teaching = clamp(Math.round(avgTeaching + ratioBonus + gradBonus));

  // ── Research Environment ────────────────────────────────────────────────────
  const activeProj    = (research.activeResearchProjects || []).length;
  const hIndex        = research.hIndex || 0;
  const pubCount      = research.publications || 0;

  // Bütçe katkısı: araştırmaya ayrılan pay (0.0-1.0 → 0-20 puan)
  const resAloc       = uni.budgetAllocation?.research || 0.20;
  const budgetBonus   = Math.round(resAloc * 80);   // %20 ayrılırsa 16 puan

  // H-indeks katkısı: tavan 25 puan
  const hBonus        = clamp(hIndex * 2.5, 0, 25);

  // Proje katkısı: aktif proje başına 3 puan, tavan 18
  const projBonus     = clamp(activeProj * 3, 0, 18);

  // Yayın katkısı: her 10 yayın 4 puan, tavan 20
  const pubBonus      = clamp(Math.floor(pubCount / 10) * 4, 0, 20);

  // Hoca kalitesi (araştırma boyutu)
  const researchFacultyQ = faculty.length > 0
    ? faculty.reduce((s, f) => s + (f.stats?.research ?? f.researchScore ?? 50), 0) / faculty.length
    : 30;
  const facultyResBonus  = Math.round(researchFacultyQ * 0.17);  // tavan ~17

  const researchEnvironment = clamp(Math.round(
    budgetBonus + hBonus + projBonus + pubBonus + facultyResBonus
  ));

  // ── Citations ──────────────────────────────────────────────────────────────
  const citations = calculateCitationScore(state);

  // ── International ──────────────────────────────────────────────────────────
  const intlRatio         = uni.internationalRatio || 0.02;
  const hasConference     = (state.buildings || []).some(b => b.type === 'konferans' && b.isCompleted);

  // Uluslararası hoca oranı tahmini (faculty'de flag yoksa intlRatio proxy)
  const intlFacultyRatio  = faculty.length > 0
    ? faculty.filter(f => f.isInternational).length / faculty.length
    : intlRatio * 0.5;

  // Konferans binası +12 puan
  const confBonus         = hasConference ? 12 : 0;

  // Öğrenci çarpanı: %2 yabancı → 10 puan; %30 yabancı → 150 (tavan 60)
  const studentIntlScore  = clamp(Math.round(intlRatio * 500), 0, 60);
  // Hoca çarpanı: tavan 20 puan
  const facultyIntlScore  = clamp(Math.round(intlFacultyRatio * 200), 0, 20);

  const international = clamp(Math.round(studentIntlScore + facultyIntlScore + confBonus));

  // ── Industry ───────────────────────────────────────────────────────────────
  const tto       = state.tto;
  const patents   = research.patents || 0;

  // TTO geliri payı
  let ttoScore = 0;
  if (tto?.isEstablished) {
    const ttoRevenue = tto.totalRevenue || 0;
    const totalBudget = Math.max(1, (state.stats?.history?.[state.stats.history.length - 1]?.income) || 100_000_000);
    const ttoPct     = ttoRevenue / totalBudget;
    ttoScore         = clamp(Math.round(ttoPct * 400), 0, 40);  // %10 TTO payı → 40 puan
  }

  // Patent katkısı: patent başına 4 puan, tavan 30
  const patentScore = clamp(patents * 4, 0, 30);

  // Aktif endüstri işbirliği (researchProjects ile proxy)
  const industryProjects = (research.activeResearchProjects || []).filter(p => p.fundingType === 'industry').length;
  const projIndustryScore = clamp(industryProjects * 5, 0, 25);

  const industry = clamp(Math.round(ttoScore + patentScore + projIndustryScore));

  return { teaching, researchEnvironment, citations, international, industry };
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateIntlTotalScore — Ağırlıklı toplam (0-100)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {{ teaching, researchEnvironment, citations, international, industry }} pillars
 * @param {{ teaching, researchEnvironment, citations, international, industry }} weights  — %'ler (toplam ~100)
 * @returns {number} 0-100 toplam skor
 */
export function calculateIntlTotalScore(pillars, weights) {
  const w = weights;
  const raw =
    pillars.teaching            * w.teaching            / 100 +
    pillars.researchEnvironment * w.researchEnvironment / 100 +
    pillars.citations           * w.citations           / 100 +
    pillars.international       * w.international       / 100 +
    pillars.industry            * w.industry            / 100;
  return Math.round(clamp(raw));
}

// ─────────────────────────────────────────────────────────────────────────────
// findIntlRank — Toplam skoru sıra numarasına çevir
// ─────────────────────────────────────────────────────────────────────────────

/**
 * THE_2024 listesinde oyuncunun toplam skoruna en yakın konumu bulur.
 * Liste, gerçek üniversiteleri içerir; oyuncu aynı skorda aynı sıraya girer.
 *
 * Algoritma: listedeki ilk üniversiteyi bul ki total <= player's total.
 * Bulunamazsa (oyuncu en yüksek skorlu), sıra 1 döner.
 * Oyuncu en düşükten de kötüyse, totalRanked döner.
 *
 * @param {number} totalScore    — 0-100
 * @param {object} theList       — THE_2024 objesi
 * @returns {number} Tahmini dünya sırası
 */
export function findIntlRank(totalScore, theList) {
  const unis = theList.universities;
  if (!unis || unis.length === 0) return theList.totalRanked;

  // Listeden en yüksek skoru bul, score'a göre sıralanmış değil ama top kısım sıralanmış
  // Tarama: ilk üniversiteyi bul ki onun total'i <= oyuncunun total'i
  // (liste skor azalan, yani rank küçük = skor büyük)
  for (let i = 0; i < unis.length; i++) {
    if (totalScore >= unis[i].total) {
      // Oyuncu bu üniversitenin önünde ya da eşit
      const u = unis[i];
      if (u.rank) return u.rank;
      // Bantlı kayıt: bant ortasını döndür
      return _bandMid(u.rankBand, theList.totalRanked);
    }
  }
  // Oyuncu listede en kötüden de düşük
  return theList.totalRanked;
}

/** Bant ortası hesaplama ('351-400' → 375, '1501+' → 1700) */
function _bandMid(band, total) {
  if (!band || band === '1501+') return Math.round(total * 0.92);
  const parts = band.split('-');
  if (parts.length === 2) {
    return Math.round((Number(parts[0]) + Number(parts[1])) / 2);
  }
  return Number(parts[0]) || 900;
}

// ─────────────────────────────────────────────────────────────────────────────
// filterByCountry — Ülke kodu filtresi
// ─────────────────────────────────────────────────────────────────────────────

/**
 * THE_2024 listesinden belirli ülke koduna ait üniversiteleri döndürür.
 * @param {object} theList
 * @param {string} countryCode — 'TR', 'GB', 'US', vb.
 * @returns {Array}
 */
export function filterByCountry(theList, countryCode) {
  return theList.universities.filter(u => u.country === countryCode);
}

// ─────────────────────────────────────────────────────────────────────────────
// getNeighbors — Oyuncunun ±N komşusu
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Oyuncunun toplam skoruna göre listede komşu üniversiteleri bulur.
 * Hem üstteki hem alttaki count kadar üniversiteyi döndürür.
 *
 * @param {number} totalScore    — Oyuncunun toplam skoru
 * @param {object} theList       — THE_2024
 * @param {number} count         — Her yönde kaç komşu (varsayılan 5)
 * @returns {{ above: Array, below: Array }}
 */
export function getNeighbors(totalScore, theList, count = 5) {
  const unis = theList.universities;
  // İndeks: oyuncunun skoru ile hizalı ilk konum
  let idx = unis.findIndex(u => u.total <= totalScore);
  if (idx < 0) idx = unis.length;   // oyuncu en altta

  // Üsttekiler (idx-count … idx-1, score oyuncudan yüksek)
  const above = unis.slice(Math.max(0, idx - count), idx).reverse();
  // Alttakiler (idx … idx+count-1, score oyuncudan düşük)
  const below = unis.slice(idx, idx + count);

  return { above, below };
}

// ─────────────────────────────────────────────────────────────────────────────
// getTurkishUniversities — Listedeki tüm Türk üniversiteleri
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} theList
 * @returns {Array}
 */
export function getTurkishUniversities(theList) {
  return filterByCountry(theList, 'TR');
}
