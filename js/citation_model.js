/**
 * Rektör Oldum — Atıf Etkisi Modeli (citation_model.js)
 *
 * Oyuncunun yayınlarından türev "ortalama atıf etkisi" hesaplar.
 * Sırf yayın sayısını artırmak yetmez; hoca kalitesi ve uluslararası
 * işbirliği oranı belirleyicidir.
 */

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI
// ─────────────────────────────────────────────────────────────────────────────

function clamp(val, min = 0, max = 100) {
  return Math.max(min, Math.min(max, val));
}

// ─────────────────────────────────────────────────────────────────────────────
// avgFacultyQuality — State'teki hocaların öğretim puanı ortalaması (0-100)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} state
 * @returns {number} Ortalama hoca kalitesi (0-100)
 */
export function avgFacultyQuality(state) {
  const faculty = state.faculty || [];
  if (faculty.length === 0) return 30;   // henüz hoca yoksa düşük başlangıç
  const total = faculty.reduce((sum, f) => {
    // teaching skoru, genel overall veya fallback
    const q = f.stats?.teaching ?? f.teachingScore ?? f.overallScore ?? 50;
    return sum + q;
  }, 0);
  return total / faculty.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateCitationScore — 0-100 atıf skoru
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Yayın sayısı + hoca kalitesi + uluslararası işbirliği oranından
 * atıf etkisi skoru üretir.
 *
 * Formül:
 *   avgImpact  = (facultyQuality / 100) × intlBonus
 *   volumeF    = log10(pubCount + 1) / 3    → 1000 yayın ≈ 1.0
 *   score      = avgImpact × volumeF × 100
 *
 * Doyum noktası: 10 000+ yayın olsa bile kalite düşükse skor düşük.
 * Yüksek kaliteli 200 yayın, düşük kaliteli 5000 yayından daha yüksek skor üretebilir.
 *
 * @param {object} state — Oyun durumu
 * @returns {number} 0-100 atıf skoru
 */
export function calculateCitationScore(state) {
  const pubCount = state.research?.publications || 0;
  if (pubCount === 0) return 0;

  const facultyQ  = avgFacultyQuality(state);
  const intlRatio = state.university?.internationalRatio || 0.02;

  // Uluslararası işbirliği bonusu: intlRatio %2 → bonus 1.04; %20 → 1.40
  const intlBonus = 1 + Math.min(intlRatio * 2, 0.8);

  // Ortalama etki: hoca kalitesi × uluslararası çarpanı, 0-1 aralığında
  const avgImpact = (facultyQ / 100) * intlBonus;

  // Hacim faktörü: log10 ölçeği, 1000 yayın ≈ 1.0, 10 000 yayın ≈ 1.33 (doyum)
  const volumeFactor = Math.log10(pubCount + 1) / 3;

  return clamp(Math.floor(avgImpact * volumeFactor * 100));
}
