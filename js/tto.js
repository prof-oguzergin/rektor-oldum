/**
 * Rektör Oldum — Teknoloji Transfer Ofisi Modülü (tto.js)
 * v0.3: Patent lisanslama, spin-off şirketler, sektör anlaşmaları
 */

// ─────────────────────────────────────────────────────────────────────────────
// SABİTLER
// ─────────────────────────────────────────────────────────────────────────────

export const TTO_CONFIG = {
  establishCost: 5_000_000,
  semesterOpCost: 800_000,
  maxLevel: 3,
  levelUpCost: [0, 3_000_000, 6_000_000, 10_000_000],
  patentLicenseBase: 400_000,       // ₺/aktif patent/dönem
  spinoffBaseRevenue: [500_000, 1_000_000],  // min-max yıllık gelir
  industryDealTypes: [
    { id: 'kisa_vadeli', name: 'Kısa Vadeli İşbirliği', duration: 2, revenueRange: [1_000_000, 3_000_000], icon: '🤝' },
    { id: 'orta_vadeli', name: 'Orta Vadeli Ar-Ge Anlaşması', duration: 4, revenueRange: [3_000_000, 8_000_000], icon: '🔬' },
    { id: 'uzun_vadeli', name: 'Stratejik Ortaklık', duration: 8, revenueRange: [8_000_000, 20_000_000], icon: '🏢' },
  ],
  dealOfferChance: 0.15,            // her dönem yeni teklif ihtimali
  spinoffChancePerPatent: 0.08,     // patent başına spin-off ihtimali
  levelBonuses: {
    1: { dealChanceBonus: 0, revenueMultiplier: 1.0, maxDeals: 2 },
    2: { dealChanceBonus: 0.05, revenueMultiplier: 1.2, maxDeals: 4 },
    3: { dealChanceBonus: 0.10, revenueMultiplier: 1.5, maxDeals: 6 },
  },
};

// Şirket adları havuzu
const COMPANY_NAMES = [
  'TeknoVadi A.Ş.', 'İnovasyon Sistemleri', 'Akıllı Çözümler Ltd.', 'BilişimPro',
  'Dijital Dönüşüm A.Ş.', 'Yeşil Teknoloji', 'Nano Araştırma Ltd.', 'Veri Analitik A.Ş.',
  'Robotik Sistemler', 'Enerji İnovasyon', 'Biyoteknoloji A.Ş.', 'Savunma Teknolojileri',
  'Yapay Zeka Çözümleri', 'Kuantum Bilişim', 'Akıllı Malzeme Ltd.',
];

const SPINOFF_NAMES = [
  'UniTek', 'KampüsLab', 'AkademiSpin', 'InnoStart', 'TezTek',
  'ProtoLab', 'BilgiTek', 'AraşTek', 'ÜniGirişim', 'PatentPro',
];

let _nextSpinoffId = 1;
let _nextDealId = 1;

// ─────────────────────────────────────────────────────────────────────────────
// STATE BAŞLATMA
// ─────────────────────────────────────────────────────────────────────────────

export function initTTOState(state) {
  if (!state.tto) {
    state.tto = {
      established: false,
      establishedAt: null,
      level: 1,
      spinoffs: [],
      industryDeals: [],
      pendingDeals: [],
      totalRevenueGenerated: 0,
      lastTurnRevenue: { patents: 0, spinoffs: 0, deals: 0, total: 0 },
    };
  }
  // ID sayaçlarını güncelle
  _nextSpinoffId = Math.max(_nextSpinoffId, ...(state.tto.spinoffs || []).map(s => (s.id || 0) + 1), 1);
  _nextDealId = Math.max(_nextDealId, ...(state.tto.industryDeals || []).map(d => (d.id || 0) + 1), ...(state.tto.pendingDeals || []).map(d => (d.id || 0) + 1), 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// TTO KURMA
// ─────────────────────────────────────────────────────────────────────────────

export function establishTTO(state) {
  if (state.tto?.established) return { success: false, message: 'TTO zaten kurulu.' };
  if (state.university.budget < TTO_CONFIG.establishCost) {
    return { success: false, message: `Yetersiz bütçe. Gerekli: ${(TTO_CONFIG.establishCost / 1_000_000).toFixed(0)}M ₺` };
  }

  state.university.budget -= TTO_CONFIG.establishCost;
  state.tto = {
    established: true,
    establishedAt: state.meta.turn,
    level: 1,
    spinoffs: [],
    industryDeals: [],
    pendingDeals: [],
    totalRevenueGenerated: 0,
    lastTurnRevenue: { patents: 0, spinoffs: 0, deals: 0, total: 0 },
  };

  return { success: true, message: 'Teknoloji Transfer Ofisi kuruldu!' };
}

// ─────────────────────────────────────────────────────────────────────────────
// SEVİYE YÜKSELTME
// ─────────────────────────────────────────────────────────────────────────────

export function upgradeTTO(state) {
  const tto = state.tto;
  if (!tto?.established) return { success: false, message: 'TTO henüz kurulmadı.' };
  if (tto.level >= TTO_CONFIG.maxLevel) return { success: false, message: 'TTO maksimum seviyede.' };

  const cost = TTO_CONFIG.levelUpCost[tto.level];
  if (state.university.budget < cost) {
    return { success: false, message: `Yetersiz bütçe. Gerekli: ${(cost / 1_000_000).toFixed(0)}M ₺` };
  }

  state.university.budget -= cost;
  tto.level++;

  return { success: true, message: `TTO Seviye ${tto.level}'e yükseltildi!` };
}

// ─────────────────────────────────────────────────────────────────────────────
// DÖNEM SİMÜLASYONU
// ─────────────────────────────────────────────────────────────────────────────

export function processTTO(state, results) {
  const tto = state.tto;
  if (!tto?.established) return;

  const levelBonus = TTO_CONFIG.levelBonuses[tto.level] || TTO_CONFIG.levelBonuses[1];
  let turnRevenue = { patents: 0, spinoffs: 0, deals: 0, total: 0 };

  // 1. İşletme gideri
  state.university.budget -= TTO_CONFIG.semesterOpCost;

  // 2. Patent lisans geliri
  const patents = state.research?.patents || 0;
  const patentRevenue = Math.round(patents * TTO_CONFIG.patentLicenseBase * levelBonus.revenueMultiplier);
  turnRevenue.patents = patentRevenue;
  state.university.budget += patentRevenue;

  // 3. Aktif sektör anlaşmaları
  const activeDeals = tto.industryDeals.filter(d => d.turnsRemaining > 0);
  for (const deal of activeDeals) {
    const revenue = Math.round(deal.perTurnRevenue * levelBonus.revenueMultiplier);
    turnRevenue.deals += revenue;
    state.university.budget += revenue;
    deal.turnsRemaining--;
    if (deal.turnsRemaining <= 0) {
      deal.status = 'completed';
      results.events.push({
        type: 'tto_deal_complete',
        message: `TTO: "${deal.company}" ile ${deal.typeName} sona erdi.`,
      });
    }
  }
  // Tamamlanan anlaşmaları kaldır
  tto.industryDeals = tto.industryDeals.filter(d => d.turnsRemaining > 0);

  // 4. Spin-off geliri
  for (const spinoff of tto.spinoffs) {
    const revenue = Math.round((spinoff.annualRevenue / 2) * levelBonus.revenueMultiplier);
    turnRevenue.spinoffs += revenue;
    state.university.budget += revenue;
    // Spin-off büyümesi (%5 ihtimalle gelir artışı)
    if (Math.random() < 0.05) {
      spinoff.annualRevenue = Math.round(spinoff.annualRevenue * 1.15);
    }
  }

  // 5. Yeni spin-off ihtimali (patent bazlı)
  if (patents > 0) {
    const spinoffChance = TTO_CONFIG.spinoffChancePerPatent * patents * (1 + levelBonus.dealChanceBonus);
    if (Math.random() < Math.min(0.30, spinoffChance)) {
      const name = SPINOFF_NAMES[Math.floor(Math.random() * SPINOFF_NAMES.length)] + '-' + _nextSpinoffId;
      const annualRev = TTO_CONFIG.spinoffBaseRevenue[0] +
        Math.floor(Math.random() * (TTO_CONFIG.spinoffBaseRevenue[1] - TTO_CONFIG.spinoffBaseRevenue[0]));
      tto.spinoffs.push({
        id: _nextSpinoffId++,
        name,
        foundedAt: state.meta.turn,
        annualRevenue: annualRev,
      });
      results.events.push({
        type: 'tto_spinoff',
        message: `TTO: Yeni spin-off şirket "${name}" kuruldu!`,
      });
    }
  }

  // 6. Yeni sektör teklifi üretimi
  const dealChance = TTO_CONFIG.dealOfferChance + levelBonus.dealChanceBonus;
  if (Math.random() < dealChance && tto.pendingDeals.length < 3) {
    const typeIdx = Math.floor(Math.random() * TTO_CONFIG.industryDealTypes.length);
    const dealType = TTO_CONFIG.industryDealTypes[typeIdx];
    const company = COMPANY_NAMES[Math.floor(Math.random() * COMPANY_NAMES.length)];
    const totalValue = dealType.revenueRange[0] +
      Math.floor(Math.random() * (dealType.revenueRange[1] - dealType.revenueRange[0]));

    tto.pendingDeals.push({
      id: _nextDealId++,
      company,
      typeId: dealType.id,
      typeName: dealType.name,
      icon: dealType.icon,
      duration: dealType.duration,
      totalValue,
      perTurnRevenue: Math.round(totalValue / dealType.duration),
      offeredAt: state.meta.turn,
    });
    results.events.push({
      type: 'tto_deal_offer',
      message: `TTO: "${company}" şirketinden ${dealType.name} teklifi geldi.`,
    });
  }

  // 7. Toplam gelir güncelle
  turnRevenue.total = turnRevenue.patents + turnRevenue.spinoffs + turnRevenue.deals;
  tto.lastTurnRevenue = turnRevenue;
  tto.totalRevenueGenerated += turnRevenue.total;
}

// ─────────────────────────────────────────────────────────────────────────────
// ANLAŞMA KABUL / RED
// ─────────────────────────────────────────────────────────────────────────────

export function acceptDeal(state, dealId) {
  const tto = state.tto;
  if (!tto?.established) return { success: false, message: 'TTO kurulu değil.' };

  const idx = tto.pendingDeals.findIndex(d => d.id === dealId);
  if (idx === -1) return { success: false, message: 'Teklif bulunamadı.' };

  const levelBonus = TTO_CONFIG.levelBonuses[tto.level] || TTO_CONFIG.levelBonuses[1];
  if (tto.industryDeals.length >= levelBonus.maxDeals) {
    return { success: false, message: `Maksimum aktif anlaşma sayısına ulaşıldı (${levelBonus.maxDeals}).` };
  }

  const deal = tto.pendingDeals.splice(idx, 1)[0];
  tto.industryDeals.push({
    ...deal,
    acceptedAt: state.meta.turn,
    turnsRemaining: deal.duration,
    status: 'active',
  });

  return { success: true, message: `"${deal.company}" ile anlaşma imzalandı!` };
}

export function rejectDeal(state, dealId) {
  const tto = state.tto;
  if (!tto) return { success: false, message: 'TTO kurulu değil.' };

  const idx = tto.pendingDeals.findIndex(d => d.id === dealId);
  if (idx === -1) return { success: false, message: 'Teklif bulunamadı.' };

  tto.pendingDeals.splice(idx, 1);
  return { success: true, message: 'Teklif reddedildi.' };
}

// ─────────────────────────────────────────────────────────────────────────────
// GELİR HESABI (economy.js için)
// ─────────────────────────────────────────────────────────────────────────────

export function getTTORevenue(state) {
  return state.tto?.lastTurnRevenue?.total || 0;
}
