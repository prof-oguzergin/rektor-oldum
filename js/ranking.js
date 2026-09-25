/**
 * Rektör Oldum — Sıralama ve Prestij Sistemi (ranking.js)
 * ES6 module. Prestij hesaplama, rakip AI güncellemesi ve sıralama raporu.
 */

import {
  RANKING_WEIGHTS,
  MAX_PRESTIGE,
  INITIAL_RIVAL_UNIVERSITIES,
  DIFFICULTY_SETTINGS,
} from './data.js?v=0.7.0';

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

  // v0.7: akreditasyon eğitim kalitesinin dış kanıtıdır. Açık bölümlerin geçerli
  // akreditasyonlarından en güçlüsü sayılır (THEQA 0,7, MÜDEK 0,85, ABET 1); bölüm
  // ortalaması en çok 12 puan ekler. Eskiden akreditasyonun kalıcı etkisi yoktu.
  const score = (avgTeaching / 100) * sizeMultiplier * graduationRate * 100 + akreditasyonPuani(state);
  return clamp(Math.round(score));
}

const AKREDITASYON_AGIRLIK = { theqa: 0.7, mudek: 0.85, abet: 1.0 };
export const AKREDITASYON_TAVAN = 12;

/** v0.7: açık bölümlerin geçerli akreditasyonlarından eğitim puanına katkı (0-12). */
export function akreditasyonPuani(state) {
  const acik = (state.departments || []).filter(d => d && d.isOpen !== false);
  if (acik.length === 0) return 0;
  const tur = state.meta?.turn ?? 0;
  const toplam = acik.reduce((s, d) => {
    let en = 0;
    for (const [id, a] of Object.entries(d.accreditation || {})) {
      const gecerli = a && a.status === 'granted' && (a.expiresAt == null || a.expiresAt > tur);
      if (gecerli) en = Math.max(en, AKREDITASYON_AGIRLIK[id] || 0);
    }
    return s + en;
  }, 0);
  return AKREDITASYON_TAVAN * toplam / acik.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateResearchScore — Araştırma bileşeni puanı
// ─────────────────────────────────────────────────────────────────────────────

// v0.7: araştırma puanının bileşen ölçekleri. Dördü de hoca (öğretim üyesi) başına
// ölçülür; üniversite büyüdükçe kendiliğinden şişmez. Her bileşen taban değerde 0,
// tam değerde tavan puanı verir (arası doğrusal). Tabanlar, oyuncu hiçbir şey yapmazken
// kendiliğinden oluşan düzeyin biraz altında; tam puan fon, altyapı ve kadro kararı ister.
export const ARASTIRMA_OLCEK = {
  yayin:  { tavan: 35, taban: 1.0, tam: 5.0  },  // hoca başına yıllık yayın
  proje:  { tavan: 25, taban: 0.8, tam: 2.4  },  // öğretim üyesi başına etkin proje
  h:      { tavan: 30, taban: 8,   tam: 20   },  // öğretim üyelerinin ortalama h-indeksi
  patent: { tavan: 10, taban: 0,   tam: 0.15 },  // öğretim üyesi başına yıllık patent
  hKisiTavan: 40,                                // tek hocanın ortalamaya katkısı en çok 40 sayılır
};

/** Bileşen puanı: taban → 0, tam → tavan, arası doğrusal. */
function _bilesenPuani(deger, o) {
  return clamp(o.tavan * (deger - o.taban) / (o.tam - o.taban), 0, o.tavan);
}

/** Öğretim üyeleri (Dr. Öğr. Üyesi, Doçent, Profesör); araştırma görevlileri hariç. */
function _ogretimUyeleri(state) {
  return (state.faculty || []).filter(f => f && f.title !== 'argö');
}

/**
 * v0.7: üniversitenin h-indeksi değeri: öğretim üyelerinin h-indekslerinin ortalaması
 * (bir kişinin katkısı en çok 40). Hoca başına olduğundan kadro büyüdükçe şişmez;
 * güçlü araştırmacı almak yükseltir, zayıf kadro sulandırır. Araştırma sekmesindeki
 * h-indeksi kartı da bu değeri gösterir (game.js research.hIndex'e yazar).
 */
export function universiteHIndeksi(state) {
  const uyeler = _ogretimUyeleri(state);
  if (uyeler.length === 0) return 0;
  const toplam = uyeler.reduce((s, f) => s + Math.min(ARASTIRMA_OLCEK.hKisiTavan, Math.max(0, Number(f.hIndex) || 0)), 0);
  return Math.round(toplam / uyeler.length * 10) / 10;
}

/**
 * Araştırma puanı (0-100), v0.7:
 *   yayın (35): son iki yılın hoca başına yıllık yayın hızı
 *   proje (25): öğretim üyesi başına etkin araştırma projesi (dış çağrı + BAP)
 *   h-indeksi (30): öğretim üyelerinin ortalama h-indeksi
 *   patent (10): son iki yılda öğretim üyesi başına yıllık patent
 * Eskiden proje bileşeni artık dolmayan research.activeProjects'i, h-indeksi hiç
 * hesaplanmayan research.hIndex'i sayıyordu (45 puan ulaşılamazdı); yayın ve patent
 * bileşenleri ise edilgen oyunda bile tavana dayanıyordu.
 *
 * @param {object} state — Oyun durumu
 * @returns {number} 0-100 araştırma puanı
 */
export function calculateResearchScore(state) {
  return arastirmaPuaniAyrintisi(state).toplam;
}

/** Araştırma puanının bileşenleri (dönem özeti ve sınamalar için). */
export function arastirmaPuaniAyrintisi(state) {
  const research = state.research;
  if (!research) return { yayin: 0, proje: 0, h: 0, patent: 0, toplam: 0 };
  const O = ARASTIRMA_OLCEK;
  const hoca = Math.max(1, (state.faculty || []).length);
  const uye  = Math.max(1, _ogretimUyeleri(state).length);

  // Son iki yılın (dört dönem) kaydı; kayıt azsa eldeki en eski kayıt
  const gecmis    = state.stats?.history || [];
  const L         = gecmis.length;
  const eskiKayit = L >= 4 ? gecmis[L - 4] : (L > 0 ? gecmis[0] : null);
  const donemSay  = L >= 4 ? 4 : Math.max(1, L);

  // Yayın bileşeni: hoca başına yıllık yayın hızı
  const eskiYayin = eskiKayit ? (eskiKayit.publications || 0) : 0;
  const yillik    = Math.max(0, (research.publications || 0) - eskiYayin) / donemSay * 2;
  const yayin     = _bilesenPuani(yillik / hoca, O.yayin);

  // Proje bileşeni: öğretim üyesi başına etkin proje
  const etkin = (research.activeResearchProjects || []).filter(p => !p.status || p.status === 'active').length;
  const proje = _bilesenPuani(etkin / uye, O.proje);

  // h-indeksi bileşeni: öğretim üyelerinin ortalama h-indeksi
  const hOrt = universiteHIndeksi(state);
  const h    = _bilesenPuani(hOrt, O.h);

  // Patent bileşeni: son iki yılın patent hızı. Eski kayıtta dönem kaydında patent
  // yoksa oyun başından bu yana ortalama hız kullanılır.
  const patentSimdi = research.patents || 0;
  let patentYillik;
  if (eskiKayit && Number.isFinite(eskiKayit.patents)) {
    patentYillik = Math.max(0, patentSimdi - eskiKayit.patents) / donemSay * 2;
  } else {
    patentYillik = patentSimdi / Math.max(1, (state.meta?.turn || 1) / 2);
  }
  const patent = _bilesenPuani(patentYillik / uye, O.patent);

  const toplam = clamp(yayin + proje + h + patent);
  return { yayin, proje, h, patent, toplam, hOrt, etkinProje: etkin, yayinHizi: yillik / hoca };
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

  // Hoca mutluluğu: hoca ortalaması. v0.7: oyunun güncellediği alan f.happiness;
  // eskiden hiç yazılmayan f.happinessScore okunuyor, herkes 50 sayılıyordu.
  const faculty       = state.faculty || [];
  const avgFacultyHappy = faculty.length > 0
    ? faculty.reduce((s, f) => s + (Number.isFinite(f.happiness) ? f.happiness : (f.happinessScore || 50)), 0) / faculty.length
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
/**
 * v0.5.1: kurumsal birikim tavanı. İtibar on yıllar içinde birikir; kuruluşundan
 * bu yana geçen yıla göre ulaşılabilecek en yüksek saygınlık.
 *   0 yıl -> 50, 10 yıl -> 70, 20 yıl -> 80, 30 yıl -> 86, 50 yıl -> 92
 */
export function kurumsalTavan(yas) {
  return 50 + 45 * (1 - Math.exp(-Math.max(0, yas) / 18));
}

/**
 * v0.7: kalite puanının üst bölgesi. Bileşenlerin ağırlıklı toplamının eşiği aşan kısmı
 * (1 + çarpan) katıyla sayılır: 45 → 45, 60 → 62, 70 → 76, 80 → 90. Üstün kalite itibara
 * orantısından fazla yansır. Edilgen oyunun düzeyi (35-45) etkilenmez; v0.6'da dürüst
 * ölçülen iyi yönetim 70 dolayında kalıp ilk 10'daki rakiplerin (72-85) altında takılıyordu.
 */
export const KALITE_UST_ESIK   = 55;
export const KALITE_UST_CARPAN = 0.4;

/**
 * v0.5.1: üniversitenin o anki kalite puanı (0-100). Saygınlık bu puana her dönem
 * yavaşça yaklaşır (game.js _updatePrestige); kurumsal tavanı aşamaz.
 */
export function calculateQualityScore(state) {
  const education    = calculateEducationScore(state);
  const research     = calculateResearchScore(state);
  const alumni       = calculateAlumniScore(state);
  const satisfaction = calculateSatisfactionScore(state);
  const intlRatio    = state.university.internationalRatio || 0.02;
  const hasConference = state.buildings.some(b => b.type === 'konferans' && b.isCompleted);
  const internationalization = clamp(intlRatio * 500 + (hasConference ? 15 : 0));
  const w = RANKING_WEIGHTS;
  const ham = education * w.education + research * w.research + alumni * w.alumni +
    satisfaction * w.satisfaction + internationalization * w.internationalization;
  return clamp(ham + Math.max(0, ham - KALITE_UST_ESIK) * KALITE_UST_CARPAN);
}

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

    // v0.5.1: saygınlık, rakibin uzun vadeli seviyesinin çevresinde dalgalanır.
    // Seviye yavaşça kayar; hırslı (agresif) rakipler hafifçe yükselir, parasız
    // kalanlar geriler. Eskiden her rakip dönem dönem tırmanıp 98'e dayanıyordu.
    if (!Number.isFinite(rival.hedefPrestij)) rival.hedefPrestij = rival.prestige;
    const egilim = (agg - 0.5) * 0.04 * growthRate;
    rival.hedefPrestij = clamp(rival.hedefPrestij + (Math.random() - 0.5) * 0.4 + egilim, 10, 90);
    if ((rival.budget || 0) < 5_000_000) {
      rival.hedefPrestij = clamp(rival.hedefPrestij - 0.4, 10, 90);
      if (Math.random() < 0.3) change.actions.push(`${rival.name} bütçe sıkıntısı nedeniyle kalite kaybetti.`);
    }
    // Küçük adımlar, ondalıklı tutulur: yuvarlama sıçramaları sırayı karıştırmasın
    const oncekiPrestij = rival.prestige;
    const yeniPrestij = rival.prestige + (rival.hedefPrestij - rival.prestige) * 0.2 + (Math.random() - 0.5) * 0.3;
    rival.prestige = Math.round(clamp(yeniPrestij, 0, 95) * 10) / 10;
    change.prestigeDelta = rival.prestige - oncekiPrestij;

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
        rival.hedefPrestij = clamp(rival.hedefPrestij + 0.3, 10, 90);
        change.actions.push(`${rival.name} "${strongestDept.name}" bölümüne agresif yatırım yaptı.`);
      }
    }

    // Hoca işe alımı (olasılık: agresifliğe bağlı)
    if (Math.random() < agg * 0.25) {
      const hired = randInt(1, 3);
      rival.facultyCount = (rival.facultyCount || 30) + hired;
      change.actions.push(`${rival.name} ${hired} yeni öğretim üyesi kadrosuna kattı.`);
    }

    // Hoca kaybı (istifa/emeklilik): her dönem küçük şans
    if (Math.random() < 0.20) {
      const lost = randInt(1, 2);
      rival.facultyCount = Math.max(5, (rival.facultyCount || 30) - lost);
      // Çok hoca kaybeden rakibin seviyesi geriler
      if (rival.facultyCount < 20) rival.hedefPrestij = clamp(rival.hedefPrestij - 0.3, 10, 90);
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

  // v0.5.1: 50 rakipten her dönem onlarca haber gelmesin; oyuncuya saygınlıkça
  // en yakın rakiplerin haberlerinden en çok üçü gösterilir
  const oyuncuP = state.university?.prestige ?? 50;
  const haberler = [];
  changes.forEach(c => {
    const r = state.rivals.find(x => x.id === c.rivalId);
    c.actions.forEach(m => haberler.push({ c, m, fark: Math.abs((r?.prestige ?? 0) - oyuncuP) + Math.random() * 6 }));
    c.actions = [];
  });
  haberler.sort((a, b) => a.fark - b.fark).slice(0, 3).forEach(h => h.c.actions.push(h.m));

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
  // v0.5.1: saygınlık game.js _updatePrestige'de güncellenir; burada yalnız sıralanır

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
