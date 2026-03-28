/**
 * Rektör Oldum — Öğrenci Kulüpleri Modülü (clubs.js)
 * v0.3: Kulüp kurma, yönetme, etkinlikler
 */

// ─────────────────────────────────────────────────────────────────────────────
// KULÜP TÜRLERİ
// ─────────────────────────────────────────────────────────────────────────────

export const CLUB_TYPES = {
  // ── Teknoloji ──
  robotik: {
    id: 'robotik', name: 'Robotik Topluluğu', icon: '🤖', category: 'tech',
    foundingCost: 500_000, semesterCost: 150_000, maxLevel: 3,
    levelUpCost: [0, 300_000, 700_000],
    satisfactionBonus: [0, 2, 4, 7],
    prestigeBonus: [0, 0, 1, 2],
    description: 'Robot tasarım ve yarışma topluluğu.',
  },
  yazilim: {
    id: 'yazilim', name: 'Yazılım Geliştirme Topluluğu', icon: '💻', category: 'tech',
    foundingCost: 300_000, semesterCost: 100_000, maxLevel: 3,
    levelUpCost: [0, 200_000, 500_000],
    satisfactionBonus: [0, 3, 5, 8],
    prestigeBonus: [0, 0, 1, 2],
    description: 'Hackathon ve açık kaynak proje topluluğu.',
  },
  yapay_zeka: {
    id: 'yapay_zeka', name: 'Yapay Zeka Topluluğu', icon: '🧠', category: 'tech',
    foundingCost: 400_000, semesterCost: 120_000, maxLevel: 3,
    levelUpCost: [0, 250_000, 600_000],
    satisfactionBonus: [0, 2, 4, 6],
    prestigeBonus: [0, 1, 2, 3],
    description: 'YZ araştırma ve uygulama topluluğu.',
  },
  girisimcilik: {
    id: 'girisimcilik', name: 'Girişimcilik Topluluğu', icon: '🚀', category: 'tech',
    foundingCost: 350_000, semesterCost: 100_000, maxLevel: 3,
    levelUpCost: [0, 200_000, 500_000],
    satisfactionBonus: [0, 2, 3, 5],
    prestigeBonus: [0, 0, 1, 3],
    description: 'Startup ve iş geliştirme topluluğu.',
  },
  // ── Akademik ──
  munazara: {
    id: 'munazara', name: 'Münazara Topluluğu', icon: '🎙️', category: 'akademik',
    foundingCost: 200_000, semesterCost: 80_000, maxLevel: 3,
    levelUpCost: [0, 150_000, 350_000],
    satisfactionBonus: [0, 2, 4, 6],
    prestigeBonus: [0, 1, 2, 3],
    description: 'Tartışma ve hitabet topluluğu.',
  },
  model_bm: {
    id: 'model_bm', name: 'Model Birleşmiş Milletler', icon: '🌍', category: 'akademik',
    foundingCost: 300_000, semesterCost: 100_000, maxLevel: 3,
    levelUpCost: [0, 200_000, 450_000],
    satisfactionBonus: [0, 2, 3, 5],
    prestigeBonus: [0, 1, 2, 4],
    description: 'Uluslararası ilişkiler ve diplomasi topluluğu.',
  },
  bilim_olimpiyat: {
    id: 'bilim_olimpiyat', name: 'Bilim Olimpiyatları', icon: '🔬', category: 'akademik',
    foundingCost: 350_000, semesterCost: 120_000, maxLevel: 3,
    levelUpCost: [0, 250_000, 500_000],
    satisfactionBonus: [0, 2, 3, 5],
    prestigeBonus: [0, 1, 3, 5],
    description: 'Ulusal ve uluslararası bilim yarışmaları.',
  },
  // ── Sanat ──
  tiyatro: {
    id: 'tiyatro', name: 'Tiyatro Topluluğu', icon: '🎭', category: 'sanat',
    foundingCost: 250_000, semesterCost: 80_000, maxLevel: 3,
    levelUpCost: [0, 150_000, 350_000],
    satisfactionBonus: [0, 3, 5, 8],
    prestigeBonus: [0, 0, 1, 1],
    description: 'Sahne sanatları ve drama topluluğu.',
  },
  muzik: {
    id: 'muzik', name: 'Müzik Topluluğu', icon: '🎵', category: 'sanat',
    foundingCost: 300_000, semesterCost: 100_000, maxLevel: 3,
    levelUpCost: [0, 200_000, 450_000],
    satisfactionBonus: [0, 3, 5, 7],
    prestigeBonus: [0, 0, 1, 2],
    description: 'Koro, orkestra ve müzik etkinlikleri topluluğu.',
  },
  fotograf: {
    id: 'fotograf', name: 'Fotoğrafçılık Topluluğu', icon: '📷', category: 'sanat',
    foundingCost: 200_000, semesterCost: 60_000, maxLevel: 3,
    levelUpCost: [0, 120_000, 280_000],
    satisfactionBonus: [0, 2, 3, 5],
    prestigeBonus: [0, 0, 0, 1],
    description: 'Fotoğraf sergisi ve atölye topluluğu.',
  },
  // ── Sosyal ──
  cevre: {
    id: 'cevre', name: 'Çevre Topluluğu', icon: '🌿', category: 'sosyal',
    foundingCost: 200_000, semesterCost: 60_000, maxLevel: 3,
    levelUpCost: [0, 120_000, 280_000],
    satisfactionBonus: [0, 2, 3, 5],
    prestigeBonus: [0, 0, 1, 2],
    description: 'Sürdürülebilirlik ve çevre bilinci.',
  },
  gonulluluk: {
    id: 'gonulluluk', name: 'Gönüllülük Topluluğu', icon: '❤️', category: 'sosyal',
    foundingCost: 150_000, semesterCost: 50_000, maxLevel: 3,
    levelUpCost: [0, 100_000, 250_000],
    satisfactionBonus: [0, 3, 5, 7],
    prestigeBonus: [0, 0, 1, 2],
    description: 'Toplumsal sorumluluk ve yardım projeleri.',
  },
};

export const CLUB_CATEGORIES = {
  tech:     { name: 'Teknoloji', icon: '💻' },
  akademik: { name: 'Akademik',  icon: '📚' },
  sanat:    { name: 'Sanat',     icon: '🎨' },
  sosyal:   { name: 'Sosyal',    icon: '🤝' },
};

let _nextClubId = 1;

// ─────────────────────────────────────────────────────────────────────────────
// STATE BAŞLATMA
// ─────────────────────────────────────────────────────────────────────────────

export function initClubsState(state) {
  if (!state.clubs) {
    state.clubs = {
      active: [],
      totalSatisfactionBonus: 0,
      totalPrestigeBonus: 0,
    };
  }
  _nextClubId = Math.max(_nextClubId, ...(state.clubs.active || []).map(c => (c.id || 0) + 1), 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// KULÜP KURMA
// ─────────────────────────────────────────────────────────────────────────────

export function foundClub(state, clubTypeId) {
  const type = CLUB_TYPES[clubTypeId];
  if (!type) return { success: false, message: 'Bilinmeyen topluluk türü.' };

  // Aynı türden zaten var mı?
  if (state.clubs.active.some(c => c.typeId === clubTypeId)) {
    return { success: false, message: `${type.name} zaten kurulu.` };
  }

  if (state.university.budget < type.foundingCost) {
    return { success: false, message: `Yetersiz bütçe. Gerekli: ${(type.foundingCost / 1_000_000).toFixed(1)}M ₺` };
  }

  state.university.budget -= type.foundingCost;
  state.clubs.active.push({
    id: _nextClubId++,
    typeId: clubTypeId,
    name: type.name,
    level: 1,
    foundedAt: state.meta.turn,
    totalInvestment: type.foundingCost,
  });

  return { success: true, message: `${type.name} kuruldu!` };
}

// ─────────────────────────────────────────────────────────────────────────────
// SEVİYE YÜKSELTME
// ─────────────────────────────────────────────────────────────────────────────

export function upgradeClub(state, clubId) {
  const club = state.clubs.active.find(c => c.id === clubId);
  if (!club) return { success: false, message: 'Topluluk bulunamadı.' };

  const type = CLUB_TYPES[club.typeId];
  if (!type) return { success: false, message: 'Topluluk türü bulunamadı.' };
  if (club.level >= type.maxLevel) return { success: false, message: 'Topluluk maksimum seviyede.' };

  const cost = type.levelUpCost[club.level];
  if (state.university.budget < cost) {
    return { success: false, message: `Yetersiz bütçe. Gerekli: ${(cost / 1_000_000).toFixed(1)}M ₺` };
  }

  state.university.budget -= cost;
  club.level++;
  club.totalInvestment += cost;

  return { success: true, message: `${club.name} Seviye ${club.level}'e yükseltildi!` };
}

// ─────────────────────────────────────────────────────────────────────────────
// KULÜP KAPATMA
// ─────────────────────────────────────────────────────────────────────────────

export function dissolveClub(state, clubId) {
  const idx = state.clubs.active.findIndex(c => c.id === clubId);
  if (idx === -1) return { success: false, message: 'Topluluk bulunamadı.' };

  const club = state.clubs.active[idx];
  state.clubs.active.splice(idx, 1);

  return { success: true, message: `${club.name} kapatıldı.` };
}

// ─────────────────────────────────────────────────────────────────────────────
// DÖNEM SİMÜLASYONU
// ─────────────────────────────────────────────────────────────────────────────

export function processClubs(state, results) {
  if (!state.clubs?.active?.length) {
    state.clubs = state.clubs || { active: [], totalSatisfactionBonus: 0, totalPrestigeBonus: 0 };
    state.clubs.totalSatisfactionBonus = 0;
    state.clubs.totalPrestigeBonus = 0;
    return;
  }

  let totalSatBonus  = 0;
  let totalPresBonus = 0;
  let totalCost      = 0;

  for (const club of state.clubs.active) {
    const type = CLUB_TYPES[club.typeId];
    if (!type) continue;

    // Dönemlik gider
    totalCost += type.semesterCost;

    // Seviye bazlı bonuslar
    const level = club.level || 1;
    totalSatBonus  += type.satisfactionBonus[level] || 0;
    totalPresBonus += type.prestigeBonus[level] || 0;

    // %15 ihtimalle kulüp etkinliği
    if (Math.random() < 0.15) {
      const eventTypes = ['yarışma', 'etkinlik', 'sergi', 'turnuva', 'konferans'];
      const eventType  = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      results.events.push({
        type: 'club_event',
        message: `${type.icon} ${club.name} bir ${eventType} düzenledi! Memnuniyet +1`,
      });
      totalSatBonus += 1;
    }
  }

  // Gideri uygula
  state.university.budget -= totalCost;

  // Memnuniyet bonusu (overallSatisfaction'a doğrudan ekle)
  if (state.students) {
    state.students.overallSatisfaction = Math.min(100,
      (state.students.overallSatisfaction || 50) + totalSatBonus * 0.3);
  }

  // Prestij bonusu
  if (totalPresBonus > 0) {
    state.university.prestige = Math.min(100,
      (state.university.prestige || 0) + Math.min(2, totalPresBonus * 0.3));
  }

  state.clubs.totalSatisfactionBonus = totalSatBonus;
  state.clubs.totalPrestigeBonus     = totalPresBonus;
}
