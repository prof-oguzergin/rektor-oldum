import { el, formatMoney } from './ui_base.js';
import { CLUB_TYPES, CLUB_CATEGORIES } from '../game.js?v=0.4.50';

/**
 * Öğrenci Kulüpleri panelini render et.
 * Callbacks: window._onFoundClub(typeId), window._onUpgradeClub(clubId), window._onDissolveClub(clubId)
 */
export function renderClubsPanel(state) {
  const panel = el('tab-clubs');
  if (!panel) return;

  const clubs       = state.clubs?.active || [];
  const budget      = state.university?.budget || 0;

  // ── Özet ──────────────────────────────────────────────────────────────────
  const totalSatBonus  = state.clubs?.totalSatisfactionBonus || 0;
  const totalPresBonus = state.clubs?.totalPrestigeBonus     || 0;
  const totalCost      = clubs.reduce((sum, c) => {
    const t = CLUB_TYPES[c.typeId];
    return sum + (t ? t.semesterCost : 0);
  }, 0);

  const summaryBar = `
    <div class="clubs-summary-bar">
      <div class="clubs-stat">
        <span class="clubs-stat-icon">🎭</span>
        <div>
          <div class="clubs-stat-value">${clubs.length}</div>
          <div class="clubs-stat-label">Aktif Topluluk</div>
        </div>
      </div>
      <div class="clubs-stat">
        <span class="clubs-stat-icon">😊</span>
        <div>
          <div class="clubs-stat-value">+${totalSatBonus.toFixed(1)}</div>
          <div class="clubs-stat-label">Memnuniyet Bonusu</div>
        </div>
      </div>
      <div class="clubs-stat">
        <span class="clubs-stat-icon">⭐</span>
        <div>
          <div class="clubs-stat-value">+${totalPresBonus.toFixed(1)}</div>
          <div class="clubs-stat-label">Saygınlık Bonusu</div>
        </div>
      </div>
      <div class="clubs-stat">
        <span class="clubs-stat-icon">💸</span>
        <div>
          <div class="clubs-stat-value">${formatMoney(totalCost)}</div>
          <div class="clubs-stat-label">Dönemlik Gider</div>
        </div>
      </div>
    </div>
  `;

  // ── Aktif Kulüpler ─────────────────────────────────────────────────────────
  let activeSection = '';
  if (clubs.length === 0) {
    activeSection = `<div class="empty-state"><p>Henüz hiç topluluk kurulmadı. Aşağıdan bir topluluk kurun!</p></div>`;
  } else {
    const cards = clubs.map(club => {
      const type  = CLUB_TYPES[club.typeId] || {};
      const level = club.level || 1;
      const stars = '★'.repeat(level) + '☆'.repeat((type.maxLevel || 3) - level);
      const satB  = type.satisfactionBonus?.[level] || 0;
      const presB = type.prestigeBonus?.[level]     || 0;
      const canUpgrade    = level < (type.maxLevel || 3);
      const upgradeCost   = canUpgrade ? (type.levelUpCost?.[level] || 0) : 0;
      const canAffordUpg  = budget >= upgradeCost;

      const upgradeBtn = canUpgrade
        ? `<button class="btn btn-sm btn-primary" onclick="window._onUpgradeClub(${club.id})" ${canAffordUpg ? '' : 'disabled'} title="${canAffordUpg ? '' : 'Yetersiz bütçe'}">
             Geliştir (${formatMoney(upgradeCost)})
           </button>`
        : `<span class="club-max-badge">Maks Seviye</span>`;

      return `
        <div class="club-card club-card-active">
          <div class="club-card-header">
            <span class="club-icon">${type.icon || '🎭'}</span>
            <div class="club-card-title">
              <div class="club-name">${club.name}</div>
              <div class="club-stars">${stars}</div>
            </div>
            <button class="btn btn-sm btn-danger club-dissolve-btn"
              onclick="window._onDissolveClub(${club.id})"
              title="Topluluğu kapat">✕</button>
          </div>
          <div class="club-card-body">
            <div class="club-bonuses">
              <span class="club-bonus-item">😊 +${satB} memnuniyet</span>
              <span class="club-bonus-item">⭐ +${presB} saygınlık</span>
              <span class="club-bonus-item">💸 ${formatMoney(type.semesterCost || 0)}/dönem</span>
            </div>
          </div>
          <div class="club-card-footer">
            ${upgradeBtn}
          </div>
        </div>
      `;
    }).join('');

    activeSection = `<div class="clubs-active-grid">${cards}</div>`;
  }

  // ── Kulüp Kataloğu (kategoriye göre gruplu) ────────────────────────────────
  const foundedTypeIds = new Set(clubs.map(c => c.typeId));

  const catalogSections = Object.entries(CLUB_CATEGORIES).map(([catId, cat]) => {
    const typeItems = Object.values(CLUB_TYPES).filter(t => t.category === catId);
    if (!typeItems.length) return '';

    const items = typeItems.map(type => {
      const alreadyFounded = foundedTypeIds.has(type.id);
      const canAfford      = budget >= type.foundingCost;
      const disabled       = alreadyFounded || !canAfford;
      const disabledReason = alreadyFounded ? 'Kurulu' : (!canAfford ? 'Yetersiz bütçe' : '');

      const satBonus1  = type.satisfactionBonus?.[1] || 0;
      const presBonus1 = type.prestigeBonus?.[1]     || 0;

      return `
        <div class="club-catalog-item ${alreadyFounded ? 'club-catalog-founded' : ''}">
          <div class="club-catalog-icon">${type.icon}</div>
          <div class="club-catalog-info">
            <div class="club-catalog-name">${type.name}</div>
            <div class="club-catalog-desc">${type.description}</div>
            <div class="club-catalog-bonuses">
              <span>😊 +${satBonus1}</span>
              <span>⭐ +${presBonus1}</span>
              <span>💸 ${formatMoney(type.semesterCost)}/dönem</span>
            </div>
          </div>
          <div class="club-catalog-action">
            <div class="club-catalog-cost">${formatMoney(type.foundingCost)}</div>
            <button class="btn btn-sm ${alreadyFounded ? 'btn-ghost' : 'btn-success'}"
              onclick="window._onFoundClub('${type.id}')"
              ${disabled ? 'disabled' : ''}
              title="${disabledReason}">
              ${alreadyFounded ? '✓ Kurulu' : 'Kur'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="clubs-category-section">
        <h4 class="clubs-category-title">${cat.icon} ${cat.name}</h4>
        <div class="clubs-catalog-list">${items}</div>
      </div>
    `;
  }).join('');

  panel.innerHTML = `
    <div class="panel-header">
      <h2 class="panel-title">🎭 Öğrenci Toplulukları</h2>
      <p class="panel-subtitle">Topluluklar öğrenci memnuniyetini ve saygınlığı artırır.</p>
    </div>

    ${summaryBar}

    <div class="panel-section">
      <h3 class="section-title">Aktif Topluluklar</h3>
      ${activeSection}
    </div>

    <div class="panel-section">
      <h3 class="section-title">Topluluk Kataloğu</h3>
      <p class="section-desc">Kurmak istediğiniz topluluğu seçin. Her topluluk dönem başına gider gerektirir.</p>
      ${catalogSections}
    </div>
  `;
}
