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

export const FOREIGN_PHD_KEYWORDS = [
  'MIT', 'Stanford', 'Carnegie Mellon', 'ETH Zürich', 'ETH',
  'Oxford', 'Cambridge', 'Delft', 'Caltech', 'Princeton',
  'UC Berkeley', 'Imperial College', 'EPFL', 'University of Toronto',
  'Georgia Tech', 'University of Michigan', 'Harvard', 'Columbia'
];

export const isForeignPhd = (f) => {
  if (!f) return false;
  if (f.isInternational) return true;
  const phd = f.education?.phd || '';
  return FOREIGN_PHD_KEYWORDS.some(k => phd.includes(k));
};

/**
 * Bir projenin AB / Horizon / ERC projesi olup olmadığını tespit eder.
 * @param {object} p - Proje nesnesi
 * @returns {boolean}
 */
export function isEuProject(p) {
  if (!p) return false;
  if (p.isEuProject) return true;
  if (p.type === 'eu' || p.type === 'horizon' || p.type === 'horizon_europe') return true;
  if (p.fundingType === 'eu' || p.fundingType === 'horizon') return true;
  if (p.callId === 'horizon_europe' || (typeof p.callId === 'string' && (p.callId.includes('horizon') || p.callId.includes('eu_') || p.callId.includes('erc')))) return true;
  if (typeof p.callType === 'string' && (/horizon/i.test(p.callType) || /\bAB\b/i.test(p.callType) || /\bEU\b/i.test(p.callType) || /avrupa/i.test(p.callType) || /erc/i.test(p.callType))) return true;
  if (typeof p.projectName === 'string' && (/horizon/i.test(p.projectName) || /erc/i.test(p.projectName) || /marie curie/i.test(p.projectName))) return true;
  if (typeof p.name === 'string' && (/horizon/i.test(p.name) || /\bAB\b/i.test(p.name) || /erc/i.test(p.name))) return true;
  return false;
}

/**
 * Akreditasyonun aktif / yenilenmekte / geçerli olup olmadığını kontrol eder.
 * @param {object} acc - Akreditasyon nesnesi
 * @param {number} currentTurn - Mevcut oyun turu
 * @returns {boolean}
 */
export function isAccredited(acc, currentTurn = 0) {
  if (!acc) return false;
  if (acc.status === 'granted' || acc.status === 'accredited') return true;
  if (acc.isRenewing) return true;
  if (acc.status === 'applied' && acc.expiresAt != null && acc.expiresAt >= currentTurn) return true;
  if (acc.status === 'applied' && acc.grantedAt != null && (acc.expiresAt == null || acc.expiresAt >= currentTurn)) return true;
  return false;
}

/**
 * Bir projenin Özel Sektör / Sanayi Ar-Ge projesi olup olmadığını tespit eder.
 * @param {object} p - Proje nesnesi
 * @returns {boolean}
 */
export function isIndustryProject(p) {
  if (!p) return false;
  if (p.isPrivateSector) return true;
  if (p.fundingType === 'industry' || p.fundingType === 'private_sector') return true;
  const idStr = String(p.callId || p.typeId || p.id || '');
  if (/sanayi|ozel_sektor|teknoloji_firmasi|savunma_sanayi|ilac_firmasi|industry|private/i.test(idStr)) return true;
  const typeStr = String(p.callType || p.name || '');
  if (/sanayi|özel sektör|ozel sektor|teknoloji firması|savunma sanayi|ilaç firması|sektör|industry/i.test(typeStr)) return true;
  const nameStr = String(p.projectName || '');
  if (/sanayi|özel sektör|ozel sektor|endüstri|industry/i.test(nameStr)) return true;
  return false;
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
  const activeProj    = (research.activeResearchProjects || research.activeProjects || []).length;
  const hVal          = (research.hIndex != null && research.hIndex > 0)
    ? research.hIndex
    : (faculty.length > 0 ? (faculty.reduce((s, f) => s + (f.hIndex || 0), 0) / faculty.length) : 0);
  const hIndex        = hVal;
  const pubCount      = research.publications || 0;

  // Bütçe katkısı: araştırmaya ayrılan genel pay veya hoca başına araştırma fonu (tavan 25 puan)
  const resAloc          = uni.budgetAllocation?.research || 0.20;
  const facultyFundRatio = Math.min(0.35, (state.researchBudgetPerFaculty || 50000) / 750000);
  const effectiveBudget  = Math.max(resAloc, facultyFundRatio);
  const budgetBonus      = clamp(Math.round(effectiveBudget * 80), 0, 25);

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

  // ── International (Uluslararası Görünüm — THE Metodolojisi) ─────────────────
  // 1. Uluslararası Öğrenci Çekiciliği (tavan 35 puan):
  //    Baz yabancı oranı + Uluslararası Ofis seviyesi + Üniversite Saygınlığı + Akreditasyonlar
  const currentTurn       = state.meta?.turn || 0;
  const baseIntlRatio     = uni.internationalRatio || 0.02;
  const intlOfficeLevel   = state.adminUnits?.uluslararasi_ofis?.level || 1;
  const intlOfficeBonus   = intlOfficeLevel === 3 ? 0.08 : intlOfficeLevel === 2 ? 0.05 : 0.02;
  const prestige          = state.university?.prestige ?? state.prestige ?? 30;
  const prestigeIntlBonus = Math.max(0, (prestige - 40) / 200); // Yüksek saygınlık yabancı öğrenci çeker (90 prestij -> +0.25)
  const abetCount         = (state.departments || []).filter(d => isAccredited(d.accreditation?.abet, currentTurn)).length;
  const theqaCount        = (state.departments || []).filter(d => isAccredited(d.accreditation?.theqa, currentTurn)).length;
  const accredIntlBonus   = Math.min(0.10, (abetCount * 0.03) + (theqaCount * 0.02));
  const effectiveIntlRatio = Math.min(0.35, baseIntlRatio + intlOfficeBonus + prestigeIntlBonus + accredIntlBonus);
  const studentIntlScore  = clamp(Math.round(effectiveIntlRatio * 100), 0, 35);

  // 2. Uluslararası Akademik Kadro (tavan 25 puan):
  //    f.isInternational bayrağı veya prestijli yabancı doktora
  const intlFacultyRatio  = faculty.length > 0
    ? faculty.filter(isForeignPhd).length / faculty.length
    : 0.05;
  const facultyIntlScore  = clamp(Math.round(intlFacultyRatio * 100), 0, 25);

  // 3. Uluslararası Araştırma İşbirlikleri & Ortak Yayınlar (tavan 25 puan):
  //    AB (EU) projeleri ve küresel yayın hacmi
  const activeProjs       = research.activeResearchProjects || research.activeProjects || [];
  const euProjects        = activeProjs.filter(isEuProject).length;
  const completedProjs    = research.completedProjects || [];
  const euCompletedCount  = completedProjs.filter(isEuProject).length;
  const euCompleted       = Math.max(research.euProjects || 0, euCompletedCount);
  const euScore           = clamp((euProjects * 6) + (euCompleted * 4), 0, 20);
  const pubCollabScore    = clamp(Math.round(Math.log10((research.publications || 0) + 1) * 4.5), 0, 15);
  const intlResearchScore = clamp(
    Math.max(euScore + (pubCollabScore > 0 ? 5 : 0), pubCollabScore + (euProjects * 4) + (euCompleted * 2)),
    0, 25
  );

  // 4. Küresel Tesisler & Uluslararası Akreditasyonlar (tavan 20 puan):
  const confBuilding      = (state.buildings || []).find(b => b.type === 'konferans' && b.isCompleted);
  const confScore         = confBuilding ? (8 + (confBuilding.level || 1) * 3) : 0; // Level 1: 11, Level 2: 14, Level 3: 17
  const globalAccredScore = clamp((abetCount * 4) + (theqaCount * 2), 0, 12);
  const facilityScore     = clamp(confScore + globalAccredScore, 0, 20);

  const international = clamp(Math.round(studentIntlScore + facultyIntlScore + intlResearchScore + facilityScore));

  // ── Industry (Sanayi Geliri ve Ticarileşme — THE Metodolojisi) ───────────────
  // 1. Teknoloji Transfer Ofisi (TTO) ve Girişimcilik (tavan 35 puan):
  const tto = state.tto;
  let ttoTotal = 0;
  const isTtoEstablished = tto?.established || tto?.isEstablished;
  if (isTtoEstablished) {
    const ttoBase       = 12 + ((tto.level || 1) - 1) * 6; // Level 1: 12, Level 2: 18, Level 3: 24
    const dealsCount    = (tto.industryDeals || []).length;
    const spinoffCount  = (tto.spinoffs || []).length;
    const activityBonus = clamp((dealsCount * 3) + (spinoffCount * 4), 0, 15);
    const ttoRevenue    = tto.totalRevenueGenerated || tto.totalRevenue || (tto.lastTurnRevenue?.total || 0) * 4;
    const revScore      = clamp(Math.round(Math.log10(Math.max(1, ttoRevenue) / 100_000) * 5), 0, 10);
    ttoTotal            = clamp(ttoBase + activityBonus + revScore, 0, 35);
  }

  // 2. Patentler ve Telif Gelirleri (tavan 30 puan):
  const patents          = research.patents || 0;
  const patentCountScore = clamp(patents * 1.5, 0, 20);
  const royalties        = research.patentRoyalties || 0;
  const royaltyScore     = clamp(Math.round((royalties / 25_000) * 5), 0, 10);
  const patentTotal      = clamp(patentCountScore + royaltyScore, 0, 30);

  // 3. Teknokent Ekosistemi (tavan 22 puan):
  const teknoBuilding    = (state.buildings || []).find(b => b.type === 'teknokent' && b.isCompleted);
  const teknoScore       = teknoBuilding ? (10 + (teknoBuilding.level || 1) * 4) : 0; // Level 1: 14, Level 2: 18, Level 3: 22

  // 4. Özel Sektör ve Sanayi Araştırma Projeleri (tavan 25 puan):
  const industryProjects  = activeProjs.filter(isIndustryProject).length;
  const completedIndustry = (research.completedProjects || []).filter(isIndustryProject).length;
  const projIndustryScore = clamp((industryProjects * 4) + (completedIndustry * 2), 0, 25);

  const industry = clamp(Math.round(ttoTotal + patentTotal + teknoScore + projIndustryScore));

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
  return Math.round(clamp(raw) * 10) / 10;
}

// ─────────────────────────────────────────────────────────────────────────────
// getPillarBreakdown — Detaylı Pillar Alt Metrik & Kayıp Puan Analizi
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Belirli bir THE WUR pillar'ı için detaylı alt metrik, kayıp analizi ve rektör eylem planını döner.
 * @param {string} pillarKey - 'teaching' | 'researchEnvironment' | 'citations' | 'international' | 'industry'
 * @param {object} state - Oyun durumu
 * @returns {object|null} Detaylı analiz nesnesi
 */
export function getPillarBreakdown(pillarKey, state) {
  if (!state) return null;
  const uni      = state.university || {};
  const research = state.research   || {};
  const faculty  = state.faculty    || [];

  if (pillarKey === 'teaching') {
    const avgTeaching   = faculty.length > 0
      ? faculty.reduce((s, f) => s + (f.stats?.teaching ?? f.teachingScore ?? 50), 0) / faculty.length
      : 30;

    const studentCount  = state.students?.totalEnrolled || 0;
    const facultyCount  = faculty.length || 1;
    const ratio         = studentCount / facultyCount;
    let ratioBonus, ratioTierName, ratioLoss;
    if (ratio <= 12) {
      ratioBonus = 15; ratioTierName = 'En Üst Düzey (≤12:1)'; ratioLoss = 0;
    } else if (ratio <= 18) {
      ratioBonus = 10; ratioTierName = 'İyi Düzey (≤18:1)'; ratioLoss = 5;
    } else if (ratio <= 25) {
      ratioBonus = 0; ratioTierName = 'Orta Düzey (≤25:1)'; ratioLoss = 15;
    } else if (ratio <= 35) {
      ratioBonus = -8; ratioTierName = 'Kalabalık Dilim (≤35:1)'; ratioLoss = 23;
    } else {
      ratioBonus = -18; ratioTierName = 'Aşırı Yoğun Dilim (>35:1)'; ratioLoss = 33;
    }

    const byDept = state.students?.byDepartment || {};
    let totSt = 0, passSt = 0;
    for (const d of Object.values(byDept)) {
      for (const yr of [d?.year1, d?.year2, d?.year3, d?.year4]) {
        if (!yr?.count) continue;
        totSt  += yr.count;
        passSt += yr.count * (yr.avgGPA >= 2.0 ? 1.0 : yr.avgGPA >= 1.5 ? 0.6 : 0.3);
      }
    }
    const gradRate  = totSt > 0 ? passSt / totSt : 0.70;
    const gradBonus = (gradRate - 0.70) * 30;
    const gradLoss  = Math.max(0, 9 - gradBonus);

    const score     = clamp(Math.round(avgTeaching + ratioBonus + gradBonus));
    const lostScore = Math.max(0, 100 - score);

    const lostPointsSummary = [];
    if (ratioLoss > 0) {
      lostPointsSummary.push({
        title: 'Öğrenci / Hoca Oranı Yüksekliği',
        loss: `-${ratioLoss} Puan`,
        desc: `Üniversitenizde hoca başına ${ratio.toFixed(1)} öğrenci düşüyor (${ratioTierName}). THE standartlarında en yüksek bonus olan +15 puan dilimine (≤12:1) veya +10 puan dilimine (≤18:1) henüz ulaşılamadığı için ${ratioLoss} puan kaçırıyorsunuz.`
      });
    }
    const teachingDeficit = Math.max(0, 100 - Math.round(avgTeaching));
    if (teachingDeficit > 0 && score < 100) {
      lostPointsSummary.push({
        title: 'Kadro Öğretim Kalitesi Eksikliği',
        loss: `~${teachingDeficit} Puan Baz Kayıp`,
        desc: `Akademik kadronuzun ortalama öğretim puanı ${avgTeaching.toFixed(1)} / 100 seviyesinde. Yüksek öğretim skorlu hocalar istihdam edilerek baz puan doğrudan artırılabilir.`
      });
    }
    if (gradLoss > 1 && score < 100) {
      lostPointsSummary.push({
        title: 'Mezuniyet ve Ders Geçme Başarısı',
        loss: `-${Math.round(gradLoss)} Puan`,
        desc: `Öğrencilerin ders başarı ve mezuniyet oranı %${Math.round(gradRate * 100)}. %95+ seviyesinde +9 puanlık tam bonusa ulaşılır.`
      });
    }
    if (lostPointsSummary.length === 0) {
      lostPointsSummary.push({
        title: 'Mükemmel Öğretim Performansı',
        loss: '0 Puan',
        desc: 'Eğitim sütununda 100/100 tam puana sahipsiniz! Kadro yetkinliğiniz ve hoca-öğrenci oranınız dünya zirvesindedir.'
      });
    }

    return {
      key: 'teaching',
      label: 'Eğitim (Teaching)',
      icon: '🎓',
      color: '#4f9cf7',
      score,
      maxScore: 100,
      lostScore,
      weightPct: 29.5,
      description: 'Times Higher Education Eğitim (Teaching) sütunu, üniversitedeki öğrenme ortamını, öğretim kalitesini, sınıf yoğunluğunu ve mezuniyet başarısını değerlendirir.',
      metrics: [
        {
          name: 'Kadro Öğretim Kalitesi (Teaching Score)',
          current: `${avgTeaching.toFixed(1)} / 100`,
          score: `${Math.round(avgTeaching)} Puan (Baz)`,
          status: avgTeaching >= 85 ? 'good' : avgTeaching >= 70 ? 'warning' : 'bad',
          statusText: avgTeaching >= 85 ? 'Yüksek' : 'Orta',
          tip: 'Tüm fakülte üyelerinin Teaching nitelik ortalaması.'
        },
        {
          name: 'Öğrenci / Hoca Oranı',
          current: `${studentCount.toLocaleString('tr-TR')} öğr. / ${facultyCount} hoca = ${ratio.toFixed(1)} : 1`,
          score: `${ratioBonus >= 0 ? '+' : ''}${ratioBonus} Puan (Max: +15)`,
          status: ratioBonus >= 10 ? 'good' : ratioBonus >= 0 ? 'warning' : 'bad',
          statusText: ratioTierName,
          tip: '≤12:1 için +15, ≤18:1 için +10, ≤25:1 için 0, >25:1 için ceza uygulanır.'
        },
        {
          name: 'Mezuniyet & Akademik Başarı (GPA ≥ 2.0)',
          current: `%${Math.round(gradRate * 100)}`,
          score: `${gradBonus >= 0 ? '+' : ''}${gradBonus.toFixed(1)} Puan (Max: +9)`,
          status: gradRate >= 0.85 ? 'good' : gradRate >= 0.70 ? 'warning' : 'bad',
          statusText: `%${Math.round(gradRate * 100)} Başarı`,
          tip: 'Öğrencilerin sınıf geçme ve mezuniyet başarısına göre bonus verilir.'
        }
      ],
      lostPointsSummary,
      recommendations: [
        { icon: '👨‍🏫', action: 'Kadro Büyütün:', text: `Mevcut oranınız ${ratio.toFixed(1)}:1. Hoca sayısını ${Math.ceil(studentCount / 18)} seviyesine (oran ≤18:1) çıkararak +10 puan, ${Math.ceil(studentCount / 12)} seviyesine (oran ≤12:1) çıkararak +15 puan tavan bonus alabilirsiniz.` },
        { icon: '⭐', action: 'Yüksek Nitelikli Hoca İstihdamı:', text: 'Yeni kadro ilanlarında ve spontane başvurularda Teaching (Öğretim) puanı 85-90+ olan hocaları kadronuza katarak baz puanınızı yükseltin.' },
        { icon: '📖', action: 'Müfredat ve Ders Destekleri:', text: 'Zor derslerin zorluk ayarını hafifleterek ve eşleşmeyen ders kalmamasını sağlayarak öğrencilerin geçme oranını artırın.' }
      ]
    };
  }

  if (pillarKey === 'researchEnvironment') {
    const activeProj    = (research.activeResearchProjects || research.activeProjects || []).length;
    const hVal          = (research.hIndex != null && research.hIndex > 0)
      ? research.hIndex
      : (faculty.length > 0 ? (faculty.reduce((s, f) => s + (f.hIndex || 0), 0) / faculty.length) : 0);
    const hIndex        = hVal;
    const pubCount      = research.publications || 0;

    const resAloc          = uni.budgetAllocation?.research || 0.20;
    const facultyFundRatio = Math.min(0.35, (state.researchBudgetPerFaculty || 50000) / 750000);
    const effectiveBudget  = Math.max(resAloc, facultyFundRatio);
    const budgetBonus      = clamp(Math.round(effectiveBudget * 80), 0, 25);
    const hBonus           = clamp(hIndex * 2.5, 0, 25);
    const projBonus        = clamp(activeProj * 3, 0, 18);
    const pubBonus         = clamp(Math.floor(pubCount / 10) * 4, 0, 20);

    const researchFacultyQ = faculty.length > 0
      ? faculty.reduce((s, f) => s + (f.stats?.research ?? f.researchScore ?? 50), 0) / faculty.length
      : 30;
    const facultyResBonus  = Math.round(researchFacultyQ * 0.17);

    const score = clamp(Math.round(budgetBonus + hBonus + projBonus + pubBonus + facultyResBonus));
    const lostScore = Math.max(0, 100 - score);

    const lostPointsSummary = [];
    if (budgetBonus < 25) {
      lostPointsSummary.push({
        title: 'Araştırma Bütçesi ve Fon Tahsisi',
        loss: `-${25 - budgetBonus} Puan`,
        desc: `Araştırma fonu katkınız 25 üzerinden ${budgetBonus} puanda. Bütçeden araştırmaya ayrılan payı veya hoca başına araştırma fonunu artırarak 25 tam puana ulaşabilirsiniz.`
      });
    }
    if (hBonus < 25) {
      lostPointsSummary.push({
        title: 'Kurumsal H-İndeks',
        loss: `-${25 - Math.round(hBonus)} Puan`,
        desc: `Mevcut H-İndeksiniz ${hIndex.toFixed(1)}. H-İndeks 10 ve üzerine ulaştığında 25 tam puan alınır.`
      });
    }
    if (projBonus < 18) {
      lostPointsSummary.push({
        title: 'Aktif Araştırma Projeleri',
        loss: `-${18 - projBonus} Puan`,
        desc: `Şu anda ${activeProj} aktif araştırma projesi yürütülüyor. 6 veya daha fazla aktif projeyle 18 tam puan alınır.`
      });
    }
    if (pubBonus < 20) {
      lostPointsSummary.push({
        title: 'Bilimsel Yayın Hacmi',
        loss: `-${20 - pubBonus} Puan`,
        desc: `Toplam ${pubCount} yayınınız var. 50 ve üzeri yayında 20 tam puan elde edilir.`
      });
    }
    if (lostPointsSummary.length === 0) {
      lostPointsSummary.push({
        title: 'Zirve Araştırma Ortamı',
        loss: '0 Puan',
        desc: 'Tebrikler! Araştırma bütçeniz, H-indeksiniz, aktif projeleriniz ve yayın hacminizle 100/100 tam puana sahipsiniz.'
      });
    }

    return {
      key: 'researchEnvironment',
      label: 'Araştırma Ortamı (Research Environment)',
      icon: '🔬',
      color: '#9b6ff5',
      score,
      maxScore: 100,
      lostScore,
      weightPct: 29.0,
      description: 'Times Higher Education Araştırma Ortamı sütunu, kurumun araştırma bütçesini, kurumsal H-indeksini, aktif proje portföyünü, yayın hacmini ve hocaların araştırma yetkinliğini ölçer.',
      metrics: [
        {
          name: 'Araştırma Bütçesi & Fon Payı',
          current: `%${Math.round(resAloc * 100)} bütçe payı · ₺${((state.researchBudgetPerFaculty || 50000)).toLocaleString('tr-TR')}/hoca`,
          score: `${budgetBonus} / 25 Puan`,
          status: budgetBonus >= 20 ? 'good' : budgetBonus >= 14 ? 'warning' : 'bad',
          statusText: `${budgetBonus}/25`,
          tip: 'Bütçe sekmesinden araştırma payı veya fon artırılarak 25 puana ulaşılır.'
        },
        {
          name: 'Kurumsal H-İndeks Katkısı',
          current: `H-İndeks: ${hIndex.toFixed(1)}`,
          score: `${Math.round(hBonus)} / 25 Puan`,
          status: hBonus >= 20 ? 'good' : hBonus >= 12 ? 'warning' : 'bad',
          statusText: `${Math.round(hBonus)}/25`,
          tip: 'H-indeks ≥ 10 olduğunda 25 tam puan sağlanır.'
        },
        {
          name: 'Aktif Araştırma Projeleri',
          current: `${activeProj} aktif proje`,
          score: `${projBonus} / 18 Puan`,
          status: projBonus >= 15 ? 'good' : projBonus >= 9 ? 'warning' : 'bad',
          statusText: `${projBonus}/18`,
          tip: 'Her aktif proje +3 puan kazandırır (max 6 proje = 18 puan).'
        },
        {
          name: 'Bilimsel Yayın Sayısı',
          current: `${pubCount} yayın`,
          score: `${pubBonus} / 20 Puan`,
          status: pubBonus >= 16 ? 'good' : pubBonus >= 8 ? 'warning' : 'bad',
          statusText: `${pubBonus}/20`,
          tip: 'Her 10 yayın +4 puan kazandırır (max 50 yayın = 20 puan).'
        },
        {
          name: 'Kadro Araştırma Niteliği',
          current: `Ortalama: ${researchFacultyQ.toFixed(1)} / 100`,
          score: `${facultyResBonus} / 17 Puan`,
          status: facultyResBonus >= 14 ? 'good' : 'warning',
          statusText: `${facultyResBonus}/17`,
          tip: 'Hocaların Research yetkinlik puanlarının katkısı.'
        }
      ],
      lostPointsSummary,
      recommendations: [
        { icon: '💰', action: 'Bütçeyi Yükseltin:', text: 'Ekonomi sekmesinden araştırma bütçesi oranını %25-30 bandına çıkarın veya hoca başına araştırma fonunu artırın.' },
        { icon: '🔬', action: 'Yeni Projeler Başlatın:', text: 'Araştırma sekmesinden TÜBİTAK, BAP ve AB destekli yeni araştırma projeleri başlatın.' },
        { icon: '⭐', action: 'H-İndeksi Yüksek Doçent/Profesör Alımı:', text: 'Yayın ve atıf birikimi yüksek kıdemli öğretim üyelerini kadronuza katın.' }
      ]
    };
  }

  if (pillarKey === 'citations') {
    const pubCount     = research.publications || 0;
    const facultyQ     = avgFacultyQuality(state);
    const intlRatio    = state.university?.internationalRatio || 0.02;
    const intlBonus    = 1 + Math.min(intlRatio * 2, 0.8);
    const volumeFactor = Math.log10(pubCount + 1) / 3;
    const score        = calculateCitationScore(state);
    const lostScore    = Math.max(0, 100 - score);

    const lostPointsSummary = [];
    if (volumeFactor < 1.0) {
      lostPointsSummary.push({
        title: 'Yayın Hacmi Doyum Sınırı',
        loss: `-${Math.round((1 - volumeFactor) * 40)} Puan Potansiyel`,
        desc: `Toplam ${pubCount} yayınınız var (Doyum faktörü: ×${volumeFactor.toFixed(2)}). THE WUR standartlarında 1.000+ yayın tam doyuma ulaşır.`
      });
    }
    if (facultyQ < 90) {
      lostPointsSummary.push({
        title: 'Kadro Nitelik Ortalaması',
        loss: `-${Math.round((95 - facultyQ) * 0.5)} Puan`,
        desc: `Hoca kalite ortalamanız %${Math.round(facultyQ)}. Yüksek etki değerli dergilerde atıf toplayabilmek için hoca niteliği kritik önem taşır.`
      });
    }
    if (intlRatio < 0.20) {
      lostPointsSummary.push({
        title: 'Uluslararası İşbirliği Çarpanı',
        loss: `-${Math.round((1.40 - intlBonus) * 30)} Puan`,
        desc: `Yabancı öğrenci/hoca oranınız %${Math.round(intlRatio * 100)}. Uluslararası işbirlikleri atıf etki çarpanınızı ×${intlBonus.toFixed(2)}'den ×1.40'a kadar yükseltebilir.`
      });
    }
    if (lostPointsSummary.length === 0) {
      lostPointsSummary.push({
        title: 'Küresel Atıf Lideri',
        loss: '0 Puan',
        desc: 'Tebrikler! Atıf etki değeriniz ve akademik kalitenizle dünya çapında 100/100 tam puandasınız.'
      });
    }

    return {
      key: 'citations',
      label: 'Atıflar & Etki Değeri (Citations)',
      icon: '📑',
      color: '#5dd6c0',
      score,
      maxScore: 100,
      lostScore,
      weightPct: 30.0,
      description: 'Times Higher Education Atıf sütunu, üniversitenin yayınladığı araştırmaların dünya çapındaki bilimsel etkisini, hoca kalitesini ve uluslararası işbirliklerini değerlendirir.',
      metrics: [
        {
          name: 'Akademik Kadro Nitelik Katsayısı',
          current: `%${Math.round(facultyQ)} Kalite Ortalaması`,
          score: `${(facultyQ/100).toFixed(2)} Baz Çarpan`,
          status: facultyQ >= 85 ? 'good' : 'warning',
          statusText: `%${Math.round(facultyQ)}`,
          tip: 'Hocaların öğretim ve araştırma puanları yayınların kalitesini belirler.'
        },
        {
          name: 'Uluslararası İşbirliği Çarpanı',
          current: `%${Math.round(intlRatio * 100)} Yabancı Oranı`,
          score: `×${intlBonus.toFixed(2)} Atıf Çarpanı (Max: ×1.40)`,
          status: intlBonus >= 1.25 ? 'good' : 'warning',
          statusText: `×${intlBonus.toFixed(2)}`,
          tip: 'Uluslararası ortaklı araştırmalar küresel çapta katbekat daha fazla atıf alır.'
        },
        {
          name: 'Toplam Yayın Hacmi & Doyum Faktörü',
          current: `${pubCount} Yayın`,
          score: `×${volumeFactor.toFixed(2)} Hacim Katsayısı (1.000 yayında 1.0)`,
          status: volumeFactor >= 0.90 ? 'good' : volumeFactor >= 0.60 ? 'warning' : 'bad',
          statusText: `${pubCount} yayın`,
          tip: 'log10 ölçeğinde 1.000 yayın 1.0 doyuma ulaşır.'
        }
      ],
      lostPointsSummary,
      recommendations: [
        { icon: '📚', action: 'Yayın Sayısını Artırın:', text: 'Araştırma bütçesini yüksek tutarak ve hoca kadrosunun düzenli makale basmasını sağlayarak yayın hacmini 1.000 sınırına yaklaştırın.' },
        { icon: '🌐', action: 'Uluslararası Ortaklıklar:', text: 'Yabancı hoca istihdamı ve AB projeleriyle ortak yayın oranını yükseltip atıf çarpanını artırın.' }
      ]
    };
  }

  if (pillarKey === 'international') {
    const currentTurn       = state.meta?.turn || 0;
    const baseIntlRatio     = uni.internationalRatio || 0.02;
    const intlOfficeLevel   = state.adminUnits?.uluslararasi_ofis?.level || 1;
    const intlOfficeBonus   = intlOfficeLevel === 3 ? 0.08 : intlOfficeLevel === 2 ? 0.05 : 0.02;
    const prestige          = state.university?.prestige ?? state.prestige ?? 30;
    const prestigeIntlBonus = Math.max(0, (prestige - 40) / 200);
    const abetCount         = (state.departments || []).filter(d => isAccredited(d.accreditation?.abet, currentTurn)).length;
    const theqaCount        = (state.departments || []).filter(d => isAccredited(d.accreditation?.theqa, currentTurn)).length;
    const accredIntlBonus   = Math.min(0.10, (abetCount * 0.03) + (theqaCount * 0.02));
    const effectiveIntlRatio = Math.min(0.35, baseIntlRatio + intlOfficeBonus + prestigeIntlBonus + accredIntlBonus);
    const studentIntlScore  = clamp(Math.round(effectiveIntlRatio * 100), 0, 35);

    const intlFacultyRatio  = faculty.length > 0
      ? faculty.filter(isForeignPhd).length / faculty.length
      : 0.05;
    const facultyIntlScore  = clamp(Math.round(intlFacultyRatio * 100), 0, 25);

    const activeProjs       = research.activeResearchProjects || research.activeProjects || [];
    const euProjects        = activeProjs.filter(isEuProject).length;
    const completedProjs    = research.completedProjects || [];
    const euCompletedCount  = completedProjs.filter(isEuProject).length;
    const euCompleted       = Math.max(research.euProjects || 0, euCompletedCount);
    const euScore           = clamp((euProjects * 6) + (euCompleted * 4), 0, 20);
    const pubCollabScore    = clamp(Math.round(Math.log10((research.publications || 0) + 1) * 4.5), 0, 15);
    const intlResearchScore = clamp(
      Math.max(euScore + (pubCollabScore > 0 ? 5 : 0), pubCollabScore + (euProjects * 4) + (euCompleted * 2)),
      0, 25
    );

    const confBuilding      = (state.buildings || []).find(b => b.type === 'konferans' && b.isCompleted);
    const confScore         = confBuilding ? (8 + (confBuilding.level || 1) * 3) : 0;
    const globalAccredScore = clamp((abetCount * 4) + (theqaCount * 2), 0, 12);
    const facilityScore     = clamp(confScore + globalAccredScore, 0, 20);

    const score = clamp(Math.round(studentIntlScore + facultyIntlScore + intlResearchScore + facilityScore));
    const lostScore = Math.max(0, 100 - score);

    const lostPointsSummary = [];
    if (studentIntlScore < 35) {
      lostPointsSummary.push({
        title: 'Uluslararası Öğrenci Oranı',
        loss: `-${35 - studentIntlScore} Puan`,
        desc: `Etkin yabancı öğrenci oranınız %${(effectiveIntlRatio * 100).toFixed(1)} (35 üzerinden ${studentIntlScore} puan). Uluslararası Ofis seviyesini yükselterek veya küresel saygınlığı artırarak 35 tam puana ulaşılabilir.`
      });
    }
    if (facultyIntlScore < 25) {
      lostPointsSummary.push({
        title: 'Yabancı / Yurtdışı Doktoralı Kadro',
        loss: `-${25 - facultyIntlScore} Puan`,
        desc: `Yurtdışı doktoralı veya yabancı uyruklu hoca oranınız %${Math.round(intlFacultyRatio * 100)} (25 üzerinden ${facultyIntlScore} puan). MIT, Stanford, Oxford, ETH gibi okullardan mezun hocaları kadroya katarak 25 tam puana ulaşabilirsiniz.`
      });
    }
    if (intlResearchScore < 25) {
      lostPointsSummary.push({
        title: 'AB / Uluslararası Araştırma Projeleri',
        loss: `-${25 - intlResearchScore} Puan`,
        desc: `Aktif AB projeniz ${euProjects} adet, tamamlanan ${euCompleted} adet (25 üzerinden ${intlResearchScore} puan). Daha fazla AB Horizon/ERC projesi yürüterek ve tamamlayarak 25 tam puana çıkabilirsiniz.`
      });
    }
    if (facilityScore < 20) {
      const accredText = (abetCount + theqaCount > 0)
        ? `${abetCount} ABET, ${theqaCount} THEQA akreditasyonu (+${globalAccredScore} puan)`
        : 'aktif uluslararası akreditasyonunuz yok';
      lostPointsSummary.push({
        title: 'Küresel Tesisler & Akreditasyonlar',
        loss: `-${20 - facilityScore} Puan`,
        desc: `Konferans Merkezi (${confBuilding ? `Düzey ${confBuilding.level || 1}` : 'Yok'}) ve ${accredText} ile ${facilityScore} / 20 puan alıyorsunuz. Düzey 3 Konferans Merkezi ve ABET/THEQA akreditasyonlarıyla 20 tam puana ulaşabilirsiniz.`
      });
    }
    if (lostPointsSummary.length === 0) {
      lostPointsSummary.push({
        title: 'Küresel Uluslararası Liderlik',
        loss: '0 Puan',
        desc: 'Tebrikler! Uluslararası öğrenci, hoca, AB projeleri ve küresel akreditasyonlarınızla 100/100 tam puandasınız.'
      });
    }

    return {
      key: 'international',
      label: 'Uluslararası Görünüm (International Outlook)',
      icon: '🌐',
      color: '#f5a623',
      score,
      maxScore: 100,
      lostScore,
      weightPct: 7.5,
      description: 'Times Higher Education Uluslararası Görünüm sütunu; yabancı öğrenci oranını, uluslararası hoca oranını, AB araştırma işbirliklerini ve küresel tesisleri/akreditasyonları değerlendirir.',
      metrics: [
        {
          name: 'Uluslararası Öğrenci Oranı & Çekicilik',
          current: `%${(effectiveIntlRatio * 100).toFixed(1)} Etkin Oran`,
          score: `${studentIntlScore} / 35 Puan`,
          status: studentIntlScore >= 30 ? 'good' : 'warning',
          statusText: `${studentIntlScore}/35`,
          tip: 'Uluslararası ofis düzeyi, saygınlık ve akreditasyonlarla desteklenir.'
        },
        {
          name: 'Uluslararası Akademik Kadro',
          current: `%${Math.round(intlFacultyRatio * 100)} Yurtdışı Doktora/Yabancı`,
          score: `${facultyIntlScore} / 25 Puan`,
          status: facultyIntlScore >= 20 ? 'good' : 'warning',
          statusText: `${facultyIntlScore}/25`,
          tip: 'MIT, Stanford, Oxford, ETH vb. prestijli yabancı doktoralı hoca oranı.'
        },
        {
          name: 'AB (Horizon) Araştırma İşbirlikleri',
          current: `${euProjects} aktif, ${euCompleted} tamamlanan AB projesi`,
          score: `${intlResearchScore} / 25 Puan`,
          status: intlResearchScore >= 20 ? 'good' : 'warning',
          statusText: `${intlResearchScore}/25`,
          tip: 'AB Horizon/ERC projeleri ve uluslararası ortak yayınlar.'
        },
        {
          name: 'Konferans Merkezi & Küresel Akreditasyon',
          current: `${confBuilding ? `Konferans Mrk. Düzey ${confBuilding.level || 1}` : 'Konferans Binası Yok'} · ${abetCount} ABET, ${theqaCount} THEQA`,
          score: `${facilityScore} / 20 Puan`,
          status: facilityScore >= 16 ? 'good' : 'warning',
          statusText: `${facilityScore}/20`,
          tip: 'Düzey 3 Konferans Merkezi + ABET & THEQA akreditasyonları 20 tam puan verir.'
        }
      ],
      lostPointsSummary,
      recommendations: [
        { icon: '🏛️', action: 'Konferans Merkezi:', text: 'Kampüs sekmesinden Konferans Merkezi inşa edin veya Düzey 3\'e yükseltin (+17 puana kadar katkı).' },
        { icon: '🇪🇺', action: 'AB Araştırma Projeleri:', text: 'Araştırma sekmesinden AB (Horizon/ERC) projeleri başlatın ve tamamlayın.' },
        { icon: '🎓', action: 'Yurtdışı Doktoralı Hoca Alımı:', text: 'İlanlarda prestijli dünya üniversitelerinden doktoralı hocaları kadronuza katarak hoca puanını 25\'e tamamlayın.' },
        { icon: '🏢', action: 'Uluslararası Ofis:', text: 'Yönetim birimlerinden Uluslararası Ofis\'i Düzey 3\'e yükselterek yabancı öğrenci çekiciliğini artırın.' }
      ]
    };
  }

  if (pillarKey === 'industry') {
    const tto = state.tto;
    let ttoTotal = 0;
    const isTtoEstablished = tto?.established || tto?.isEstablished;
    if (isTtoEstablished) {
      const ttoBase       = 12 + ((tto.level || 1) - 1) * 6;
      const dealsCount    = (tto.industryDeals || []).length;
      const spinoffCount  = (tto.spinoffs || []).length;
      const activityBonus = clamp((dealsCount * 3) + (spinoffCount * 4), 0, 15);
      const ttoRevenue    = tto.totalRevenueGenerated || tto.totalRevenue || (tto.lastTurnRevenue?.total || 0) * 4;
      const revScore      = clamp(Math.round(Math.log10(Math.max(1, ttoRevenue) / 100_000) * 5), 0, 10);
      ttoTotal            = clamp(ttoBase + activityBonus + revScore, 0, 35);
    }

    const patents          = research.patents || 0;
    const patentCountScore = clamp(patents * 1.5, 0, 20);
    const royalties        = research.patentRoyalties || 0;
    const royaltyScore     = clamp(Math.round((royalties / 25_000) * 5), 0, 10);
    const patentTotal      = clamp(patentCountScore + royaltyScore, 0, 30);

    const teknoBuilding    = (state.buildings || []).find(b => b.type === 'teknokent' && b.isCompleted);
    const teknoScore       = teknoBuilding ? (10 + (teknoBuilding.level || 1) * 4) : 0;

    const activeProjs       = research.activeResearchProjects || research.activeProjects || [];
    const industryProjects  = activeProjs.filter(isIndustryProject).length;
    const completedIndustry = (research.completedProjects || []).filter(isIndustryProject).length;
    const projIndustryScore = clamp((industryProjects * 4) + (completedIndustry * 2), 0, 25);

    const score = clamp(Math.round(ttoTotal + patentTotal + teknoScore + projIndustryScore));
    const lostScore = Math.max(0, 100 - score);

    const lostPointsSummary = [];
    if (teknoScore < 22) {
      lostPointsSummary.push({
        title: 'Teknokent Ekosistemi',
        loss: `-${22 - teknoScore} Puan`,
        desc: teknoBuilding
          ? `Teknokent binanız Düzey ${teknoBuilding.level || 1} seviyesinde (${teknoScore}/22 puan). Düzey 3'e yükselterek doğrudan 22 tam puana ulaşabilirsiniz.`
          : 'Kampüsünüzde tamamlanmış bir Teknokent bulunmuyor (-22 puan kayıp).'
      });
    }
    if (patentTotal < 30) {
      lostPointsSummary.push({
        title: 'Patentler ve Telif Gelirleri',
        loss: `-${30 - patentTotal} Puan`,
        desc: `${patents} patent ve ₺${royalties.toLocaleString('tr-TR')} telif geliriyle 30 üzerinden ${patentTotal} puandasınız. Daha fazla patent tescil ederek ve lisanslayarak 30 puana çıkabilirsiniz.`
      });
    }
    if (ttoTotal < 35) {
      lostPointsSummary.push({
        title: 'TTO & Sanayi Anlaşmaları',
        loss: `-${35 - ttoTotal} Puan`,
        desc: isTtoEstablished
          ? `TTO seviyeniz Düzey ${tto.level || 1} (35 üzerinden ${ttoTotal} puan). Yeni sanayi ortaklıkları ve spin-off şirketlerle 35 tam puan alınabilir.`
          : 'Teknoloji Transfer Ofisi (TTO) henüz kurulmamış (-35 puan kayıp).'
      });
    }
    if (projIndustryScore < 25) {
      lostPointsSummary.push({
        title: 'Özel Sektör Sanayi Projeleri',
        loss: `-${25 - projIndustryScore} Puan`,
        desc: `Şu anda ${industryProjects} aktif, ${completedIndustry} tamamlanan özel sektör projesi yürütülüyor (25 üzerinden ${projIndustryScore} puan). Daha fazla özel sektör Ar-Ge ve sanayi ortaklı proje yürüterek 25 tam puana ulaşabilirsiniz.`
      });
    }
    if (lostPointsSummary.length === 0) {
      lostPointsSummary.push({
        title: 'Zirve Sanayi İşbirliği',
        loss: '0 Puan',
        desc: 'Tebrikler! Teknokent, TTO, patentler ve sanayi projeleriyle 100/100 tam puandasınız.'
      });
    }

    return {
      key: 'industry',
      label: 'Endüstri & Sanayi Geliri (Industry)',
      icon: '🏭',
      color: '#e0644e',
      score,
      maxScore: 100,
      lostScore,
      weightPct: 4.0,
      description: 'Times Higher Education Endüstri sütunu; sanayiden elde edilen araştırma gelirlerini, patentleri, Teknokent ekosistemini ve teknoloji transferi faaliyetlerini ölçer.',
      metrics: [
        {
          name: 'Teknoloji Transfer Ofisi (TTO) & Girişimcilik',
          current: isTtoEstablished ? `Düzey ${tto.level || 1} · ${(tto.industryDeals || []).length} Anlaşma · ${(tto.spinoffs || []).length} Spin-off` : 'Kurulmadı',
          score: `${ttoTotal} / 35 Puan`,
          status: ttoTotal >= 28 ? 'good' : 'warning',
          statusText: `${ttoTotal}/35`,
          tip: 'TTO düzeyi, sanayi sözleşmeleri ve spin-off şirketler.'
        },
        {
          name: 'Patentler ve Lisans Telif Gelirleri',
          current: `${patents} Patent · ₺${royalties.toLocaleString('tr-TR')} Telif Geliri`,
          score: `${patentTotal} / 30 Puan`,
          status: patentTotal >= 24 ? 'good' : 'warning',
          statusText: `${patentTotal}/30`,
          tip: 'Patent sayısı (max 20) ve telif gelirleri (max 10).'
        },
        {
          name: 'Teknokent Ekosistemi',
          current: teknoBuilding ? `Teknokent Düzey ${teknoBuilding.level || 1}` : 'Teknokent Yok',
          score: `${teknoScore} / 22 Puan`,
          status: teknoScore === 22 ? 'good' : teknoScore > 0 ? 'warning' : 'bad',
          statusText: `${teknoScore}/22`,
          tip: 'Düzey 1: 14, Düzey 2: 18, Düzey 3: 22 tam puan.'
        },
        {
          name: 'Özel Sektör ve Sanayi Projeleri',
          current: `${industryProjects} Aktif · ${completedIndustry} Tamamlanan`,
          score: `${projIndustryScore} / 25 Puan`,
          status: projIndustryScore >= 20 ? 'good' : 'warning',
          statusText: `${projIndustryScore}/25`,
          tip: 'Özel sektör destekli projeler.'
        }
      ],
      lostPointsSummary,
      recommendations: [
        { icon: '🏢', action: 'Teknokent\'i Yükseltin:', text: 'Kampüs sekmesinden Teknokent binasını Düzey 3\'e yükselterek 22 tam puan alın.' },
        { icon: '💡', action: 'Patent Başvuruları:', text: 'Araştırma sekmesinde tamamlanan projeler için patent tescil başvurusu yapın ve lisanslayın.' },
        { icon: '🤝', action: 'TTO Anlaşmaları İmzala:', text: 'TTO sekmesinden özel sektör Ar-Ge anlaşmaları imzalayın ve spin-off şirketleri destekleyin.' },
        { icon: '🏭', action: 'Sanayi Fonlu Projeler:', text: 'Hocalarınızı sanayi ortaklı araştırma projelerine yönlendirin.' }
      ]
    };
  }

  return null;
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
  const above = unis.slice(Math.max(0, idx - count), idx);
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
