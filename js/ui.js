/**
 * UI Bridge — Modüler ve Legacy UI arasında köprü görevi görür.
 * Bu dosya main.js tarafından içe aktarılır.
 */

import * as Legacy from './ui_legacy.js';
import * as Modular from './ui/ui_modular.js?v=0.4.76';

// Modüler UI artık varsayılan (Legacy devre dışı)
const isModular = () => true;

console.log(`[UI Bridge] Sistem Başlatıldı. Mod: MODÜLER (Default)`);

/**
 * Dinamik Dispatcher: Modlar arasında kesin ayrım yapar.
 */
function dispatch(fnName, ...args) {
  const useModular = isModular();
  
  if (useModular && typeof Modular[fnName] === 'function') {
    return Modular[fnName](...args);
  }

  if (typeof Legacy[fnName] === 'function') {
    return Legacy[fnName](...args);
  }

  console.warn(`[UI Bridge] DİKKAT: "${fnName}" henüz implemente edilmedi!`);
  if (fnName.startsWith('render') && fnName.endsWith('Panel')) {
    const panelId = 'tab-' + fnName.replace('render', '').replace('Panel', '').toLowerCase();
    const panel = document.getElementById(panelId);
    if (panel) panel.innerHTML = `<div style="padding:40px; text-align:center; color:#888;">
      <div style="font-size:48px; margin-bottom:16px;">🚧</div>
      <h3>${fnName}</h3>
      <p>Bu sayfa henüz hazır değil.</p>
    </div>`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS (main.js'nin beklediği tüm fonksiyonlar)
// ─────────────────────────────────────────────────────────────────────────────

export const el  = (...args) => dispatch('el', ...args);
export const on  = (...args) => dispatch('on', ...args);
export const showScreen = (...args) => dispatch('showScreen', ...args);
export const showModal  = (...args) => dispatch('showModal', ...args);
export const hideModal  = (...args) => dispatch('hideModal', ...args);
export const initSafeModalBackdropDismiss = (...args) => dispatch('initSafeModalBackdropDismiss', ...args);
export const showNotification = (...args) => dispatch('showNotification', ...args);
export const showSettingsModal = (...args) => dispatch('showSettingsModal', ...args);
export const initMenuScreen = (...args) => dispatch('initMenuScreen', ...args);
export const initSetupScreen = (...args) => dispatch('initSetupScreen', ...args);
export const initTabNavigation = (...args) => dispatch('initTabNavigation', ...args);
export const updateTopBar = (...args) => dispatch('updateTopBar', ...args);

// Paneller
export const renderDashboard = (...args) => dispatch('renderDashboard', ...args);
export const renderDepartmentsPanel = (...args) => dispatch('renderDepartmentsPanel', ...args);
export const renderBolumlerPanel = (...args) => dispatch('renderBolumlerPanel', ...args);
export const renderFacultyPanel = (...args) => dispatch('renderFacultyPanel', ...args);
export const renderStudentsPanel = (...args) => dispatch('renderStudentsPanel', ...args);
export const renderCampusPanel = (...args) => dispatch('renderCampusPanel', ...args);
export const renderBudgetPanel = (...args) => dispatch('renderBudgetPanel', ...args);
export const renderResearchPanel = (...args) => dispatch('renderResearchPanel', ...args);
export const renderAlumniPanel = (...args) => dispatch('renderAlumniPanel', ...args);
export const renderAdminPanel = (...args) => dispatch('renderAdminPanel', ...args);
export const renderClubsPanel = (...args) => dispatch('renderClubsPanel', ...args);
export const renderSportsPanel = (...args) => dispatch('renderSportsPanel', ...args);
export const renderAccreditationPanel = (...args) => dispatch('renderAccreditationPanel', ...args);
export const renderAchievementsPanel = (...args) => dispatch('renderAchievementsPanel', ...args);
export const renderLeaderboardPanel = (...args) => dispatch('renderLeaderboardPanel', ...args);
export const renderInternationalRankingPanel = (...args) => dispatch('renderInternationalRankingPanel', ...args);

// Modallar ve bildirimler
export const renderTransferMarket = (...args) => dispatch('renderTransferMarket', ...args);
export const removeTransferMarketCandidate = (...args) => dispatch('removeTransferMarketCandidate', ...args);
export const renderOpenPositionModal = (...args) => dispatch('renderOpenPositionModal', ...args);
export const renderTurnSummary = (...args) => dispatch('renderTurnSummary', ...args);
export const renderEvent = (...args) => dispatch('renderEvent', ...args);
export const renderQuotaModal = (...args) => dispatch('renderQuotaModal', ...args);
export const renderAdminHireModal = (...args) => dispatch('renderAdminHireModal', ...args);
export const showAchievementNotification = (...args) => dispatch('showAchievementNotification', ...args);
export const renderRandomEventModal = (...args) => dispatch('renderRandomEventModal', ...args);
export const showAccreditationModal = (...args) => dispatch('showAccreditationModal', ...args);
export const showChangelogModal = (...args) => dispatch('showChangelogModal', ...args);
export const showGameWonModal = (...args) => dispatch('showGameWonModal', ...args);

// Bazı yardımcılar export olarak kalmalı (modül seviyesinde kullanılanlar)
export const qs = (...args) => dispatch('qs', ...args);
export const qsa = (...args) => dispatch('qsa', ...args);
export const formatMoney = (...args) => dispatch('formatMoney', ...args);
export const formatNumber = (...args) => dispatch('formatNumber', ...args);
