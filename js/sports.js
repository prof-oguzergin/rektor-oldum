/**
 * Rektör Oldum — Üniversite Sporları (sports.js)
 * Takım kurma, lig simülasyonu, maç sonuçları
 */

// ─────────────────────────────────────────────────────────────────────────────
// SPOR DALLARI
// ─────────────────────────────────────────────────────────────────────────────

export const SPORTS = {
  basketbol: {
    id: 'basketbol', name: 'Basketbol', icon: '🏀',
    coachSalary: 150_000, semesterBudget: 200_000,
    foundingCost: 500_000, requiresFacility: true,
    maxLevel: 5, upgradeMultiplier: 1.5,
    upgradeCosts: [0, 300_000, 600_000, 1_000_000, 1_500_000],
    basePower: 20, description: 'Üniversiteler arası basketbol takımı',
    allowsDraw: false,  // basketbol uzatma ile karara bağlanır
  },
  futbol: {
    id: 'futbol', name: 'Futbol', icon: '⚽',
    coachSalary: 200_000, semesterBudget: 300_000,
    foundingCost: 700_000, requiresFacility: true,
    maxLevel: 5, upgradeMultiplier: 1.5,
    upgradeCosts: [0, 400_000, 800_000, 1_200_000, 2_000_000],
    basePower: 20, description: 'Üniversiteler arası futbol takımı',
    allowsDraw: true,
  },
  voleybol: {
    id: 'voleybol', name: 'Voleybol', icon: '🏐',
    coachSalary: 120_000, semesterBudget: 150_000,
    foundingCost: 400_000, requiresFacility: true,
    maxLevel: 5, upgradeMultiplier: 1.5,
    upgradeCosts: [0, 250_000, 500_000, 800_000, 1_200_000],
    basePower: 20, description: 'Üniversiteler arası voleybol takımı',
    allowsDraw: false,  // voleybolda 5 set, beraberlik yok
  },
  yuzme: {
    id: 'yuzme', name: 'Yüzme', icon: '🏊',
    coachSalary: 100_000, semesterBudget: 180_000,
    foundingCost: 600_000, requiresFacility: true,
    maxLevel: 5, upgradeMultiplier: 1.5,
    upgradeCosts: [0, 350_000, 700_000, 1_000_000, 1_500_000],
    basePower: 18, description: 'Üniversiteler arası yüzme takımı',
    allowsDraw: false,
  },
  atletizm: {
    id: 'atletizm', name: 'Atletizm', icon: '🏃',
    coachSalary: 80_000, semesterBudget: 100_000,
    foundingCost: 300_000, requiresFacility: false,
    maxLevel: 5, upgradeMultiplier: 1.5,
    upgradeCosts: [0, 200_000, 400_000, 600_000, 1_000_000],
    basePower: 15, description: 'Üniversite atletizm takımı (tesis gerekmez)',
    allowsDraw: false,
  },
  espor: {
    id: 'espor', name: 'E-Spor', icon: '🎮',
    coachSalary: 60_000, semesterBudget: 80_000,
    foundingCost: 200_000, requiresFacility: false,
    maxLevel: 5, upgradeMultiplier: 1.5,
    upgradeCosts: [0, 150_000, 300_000, 500_000, 800_000],
    basePower: 15, description: 'Üniversite e-spor takımı (tesis gerekmez)',
    allowsDraw: false,
  },
};

let _nextTeamId = 1;

// ─────────────────────────────────────────────────────────────────────────────
// STATE BAŞLATMA
// ─────────────────────────────────────────────────────────────────────────────

export function initSportsState(state) {
  if (!state.sports) {
    state.sports = { teams: [], leagueResults: [], totalBudget: 0 };
  }
  if (!state.sports.teams)        state.sports.teams        = [];
  if (!state.sports.leagueResults) state.sports.leagueResults = [];
  if (state.sports.totalBudget === undefined) state.sports.totalBudget = 0;

  // _nextTeamId'yi mevcut takımların üstüne ayarla
  if (state.sports.teams.length) {
    _nextTeamId = Math.max(...state.sports.teams.map(t => t.id || 0)) + 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TAKIM KURMA
// ─────────────────────────────────────────────────────────────────────────────

export function foundTeam(state, sportId) {
  const sport = SPORTS[sportId];
  if (!sport) return { success: false, message: 'Geçersiz spor dalı.' };

  if (state.sports.teams.some(t => t.sportId === sportId)) {
    return { success: false, message: 'Bu dalda zaten bir takımınız var.' };
  }

  if (sport.requiresFacility) {
    const hasSpor = (state.buildings || []).some(
      b => (b.type === 'spor_tesisi' || b.type === 'spor_merkezi') && b.isCompleted
    );
    if (!hasSpor) return { success: false, message: 'Spor Tesisi binası gerekli!' };
  }

  if (state.university.budget < sport.foundingCost) {
    return { success: false, message: 'Yetersiz kasa!' };
  }

  state.university.budget -= sport.foundingCost;
  state.sports.teams.push({
    id: _nextTeamId++,
    sportId,
    name: sport.name,
    icon: sport.icon,
    level: 1,
    wins: 0, losses: 0, draws: 0,
    seasonPoints: 0,
    leaguePosition: null,
    totalInvestment: sport.foundingCost,
    establishedTurn: state.turn || 1,
  });

  return { success: true, message: `${sport.name} takımı kuruldu!` };
}

// ─────────────────────────────────────────────────────────────────────────────
// SEVİYE YÜKSELTME
// ─────────────────────────────────────────────────────────────────────────────

export function upgradeTeam(state, teamId) {
  const team = state.sports.teams.find(t => t.id === teamId);
  if (!team) return { success: false, message: 'Takım bulunamadı.' };

  const sport = SPORTS[team.sportId];
  if (!sport) return { success: false, message: 'Spor dalı bulunamadı.' };
  if (team.level >= sport.maxLevel) return { success: false, message: 'Maksimum seviyeye ulaşıldı.' };

  const cost = sport.upgradeCosts[team.level];
  if (state.university.budget < cost) {
    return { success: false, message: 'Yetersiz kasa!' };
  }

  state.university.budget -= cost;
  team.level++;
  team.totalInvestment += cost;

  return { success: true, message: `${team.name} takımı Seviye ${team.level}'e yükseltildi!` };
}

// ─────────────────────────────────────────────────────────────────────────────
// TAKIM KAPATMA
// ─────────────────────────────────────────────────────────────────────────────

export function dissolveTeam(state, teamId) {
  const idx = state.sports.teams.findIndex(t => t.id === teamId);
  if (idx === -1) return { success: false, message: 'Takım bulunamadı.' };

  const team = state.sports.teams[idx];
  state.sports.teams.splice(idx, 1);

  return { success: true, message: `${team.name} takımı kapatıldı.` };
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI: Takım gücü hesabı
// ─────────────────────────────────────────────────────────────────────────────

function _getTeamPower(team, state) {
  const sport = SPORTS[team.sportId];
  const basePower = sport.basePower * team.level;

  const hasSpor = (state.buildings || []).some(
    b => (b.type === 'spor_tesisi' || b.type === 'spor_merkezi') && b.isCompleted
  );
  const facilityBonus = hasSpor ? 15 : 0;

  const talentBonus = Math.min(10, Math.floor((state.students?.totalEnrolled || 500) / 200));

  return basePower + facilityBonus + talentBonus;
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI: Tek maç simülasyonu
// ─────────────────────────────────────────────────────────────────────────────

function _simulateMatch(teamPower, opponentPower, allowsDraw = true) {
  const teamRoll = teamPower + Math.floor(Math.random() * 30) - 15;
  const oppRoll  = opponentPower + Math.floor(Math.random() * 30) - 15;
  if (teamRoll > oppRoll + 5) return 'win';
  if (oppRoll > teamRoll + 5) return 'loss';
  // Yakın sonuç: beraberliğe izin veriyorsa draw, aksi halde teamRoll daha yüksekse galip (tie-break)
  if (allowsDraw) return 'draw';
  return teamRoll >= oppRoll ? 'win' : 'loss';
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI: Rakip ismi
// ─────────────────────────────────────────────────────────────────────────────

function _getOpponentName(matchIndex) {
  const opponents = [
    'Boğaziçi', 'ODTÜ', 'İTÜ', 'Hacettepe', 'Bilkent',
    'Koç', 'Sabancı', 'Galatasaray Üni.', 'Yıldız Teknik', 'Ankara Üni.',
  ];
  return opponents[matchIndex % opponents.length] || ('Rakip ' + (matchIndex + 1));
}

// ─────────────────────────────────────────────────────────────────────────────
// DÖNEM SİMÜLASYONU
// ─────────────────────────────────────────────────────────────────────────────

export function processSports(state, results) {
  if (!state.sports?.teams?.length) return;

  let totalSatBonus  = 0;
  let totalPresBonus = 0;
  const seasonResults = [];

  for (const team of state.sports.teams) {
    const sport = SPORTS[team.sportId];
    if (!sport) continue;

    // Dönemlik maliyet
    const semesterCost = sport.semesterBudget + sport.coachSalary;
    state.university.budget -= semesterCost;

    // Sezon istatistiklerini sıfırla
    team.wins = 0; team.losses = 0; team.draws = 0; team.seasonPoints = 0;

    // 5 lig maçı simüle et
    const teamPower  = _getTeamPower(team, state);
    const matchResults = [];

    const sportInfo = SPORTS[team.sportId] || {};
    const allowsDraw = sportInfo.allowsDraw !== false;  // varsayılan true

    for (let i = 0; i < 5; i++) {
      const oppPower = 30 + Math.floor(Math.random() * 50);
      const oppName  = _getOpponentName(i);
      const result   = _simulateMatch(teamPower, oppPower, allowsDraw);

      if (result === 'win')       { team.wins++;   team.seasonPoints += 3; }
      else if (result === 'draw') { team.draws++;  team.seasonPoints += 1; }
      else                        { team.losses++; }

      matchResults.push({ opponent: oppName, result, teamPower, oppPower });
    }

    // Lig pozisyonu
    if (team.seasonPoints >= 12)      team.leaguePosition = 1;
    else if (team.seasonPoints >= 9)  team.leaguePosition = 2;
    else if (team.seasonPoints >= 6)  team.leaguePosition = 3;
    else if (team.seasonPoints >= 3)  team.leaguePosition = Math.floor(Math.random() * 4) + 4;
    else                              team.leaguePosition = Math.floor(Math.random() * 4) + 6;

    // Performans bonusları
    totalSatBonus  += team.wins * 0.5;
    totalPresBonus += team.wins * 0.3;

    // Şampiyonluk bonusu
    if (team.leaguePosition === 1) {
      totalPresBonus += 3;
      totalSatBonus  += 2;
      if (results?.events) {
        results.events.push({
          type: 'sports_championship',
          message: `🏆 ${team.name} takımı şampiyon oldu! (+3 saygınlık)`,
        });
      } else if (Array.isArray(results)) {
        results.push({
          type: 'sports_championship',
          message: `🏆 ${team.name} takımı şampiyon oldu! (+3 saygınlık)`,
        });
      }
    }

    seasonResults.push({
      sportId:  team.sportId,
      name:     team.name,
      icon:     team.icon,
      matches:  matchResults,
      position: team.leaguePosition,
      points:   team.seasonPoints,
      record:   allowsDraw
        ? `${team.wins}G-${team.draws}B-${team.losses}M`
        : `${team.wins}G-${team.losses}M`,
    });
  }

  // Bonusları uygula
  if (state.students) {
    state.students.overallSatisfaction = Math.min(100,
      (state.students.overallSatisfaction || 50) + totalSatBonus * 0.3);
  }
  state.university.prestige = Math.min(100,
    (state.university.prestige || 0) + Math.min(3, totalPresBonus * 0.3));

  state.sports.leagueResults = seasonResults;
  state.sports.totalBudget   = state.sports.teams.reduce((s, t) => {
    const sp = SPORTS[t.sportId];
    return s + (sp ? sp.semesterBudget + sp.coachSalary : 0);
  }, 0);
}
