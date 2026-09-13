import { el, qs, qsa, delegate, formatMoney, formatNumber } from './ui_base.js';
import { calculateIntlPillars, calculateIntlTotalScore, findIntlRank } from '../intl_ranking.js?v=0.4.73';
import { THE_2024 } from '../intl_rankings_the2024.js?v=0.4.65';

/**
 * Üst barda üniversite bilgilerini güncelle.
 * @param {object} state — Oyun durumu
 */
export function updateTopBar(state) {
  if (!state) return;

  const uni  = state.university;
  const meta = state.meta;

  // Üniversite adı
  const nameEl = el('uni-name-display');
  if (nameEl) {
    nameEl.textContent = uni.name;
  }

  // Dönem/yıl
  const termEl = el('term-display');
  if (termEl) {
    const sem = meta.semester === 'güz' ? 'Güz' : 'Bahar';
    termEl.textContent = `${meta.year}. Yıl · ${sem} Dönemi (Tur ${meta.turn})`;
  }

  // Bütçe
  const budgetEl = qs('#stat-budget .top-stat-value');
  if (budgetEl) {
    budgetEl.textContent = formatMoney(uni.budget);
    budgetEl.classList.toggle('text-bad', uni.budget < 0);
    budgetEl.classList.toggle('text-good', uni.budget > 0);
  }

  // Saygınlık
  const prestigeEl = qs('#stat-prestige .top-stat-value');
  if (prestigeEl) prestigeEl.textContent = Math.round(uni.prestige);

  // Dünya Sırası (Canlı THE 2024 Metodolojisi)
  const rankEl = qs('#stat-ranking .top-stat-value');
  if (rankEl) {
    let intlR = state.university?.intlRanking;
    try {
      const pillars = calculateIntlPillars(state);
      const total = calculateIntlTotalScore(pillars, THE_2024.pillarsWeights);
      const totalNum = typeof total === 'number' ? total : parseFloat(total) || 0;
      const liveScore = Math.round(totalNum * 10) / 10;
      const liveRank = findIntlRank(liveScore, THE_2024);
      if (liveRank) {
        intlR = liveRank;
        if (state.university) {
          state.university.intlRanking = liveRank;
          state.university.intlTotalScore = liveScore;
        }
      }
    } catch (e) {
      console.warn('[topBar] live rank calculation error:', e);
    }
    rankEl.textContent = intlR ? `🌍 #${intlR}` : '—';
  }

  // Öğrenci sayısı
  const studEl = qs('#stat-students .top-stat-value');
  if (studEl) studEl.textContent = formatNumber(state.students?.totalEnrolled ?? 0);

  // Kadro sayısı
  const facEl = qs('#stat-faculty .top-stat-value');
  if (facEl) facEl.textContent = formatNumber(state.faculty?.length ?? 0);

  // Sonraki Dönem butonu
  const nextBtn = el('btn-next-turn');
  if (nextBtn) {
    const isOver = !!(state.gameOver || state.gameWon);
    nextBtn.disabled = isOver;
    if (isOver) {
      nextBtn.textContent = '🎮 Yeni Oyuna Başla';
    } else {
      nextBtn.textContent = 'Sonraki Dönem →';
    }
  }
}

/**
 * Oyun ekranı sekme navigasyonunu başlat.
 * @param {Function} onTabChange — Sekme değiştirme callback (tabId alır)
 */
export function initTabNavigation(onTabChange) {
  delegate(qs('.sidebar'), '.sidebar-tab', 'click', (e, btn) => {
    const tabId = btn.dataset.tab;

    qsa('.sidebar-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');

    qsa('.tab-panel').forEach(p => p.classList.remove('active'));
    const panel = el(`tab-${tabId}`);
    if (panel) panel.classList.add('active');

    if (onTabChange) onTabChange(tabId);
  });

  // Üst bardaki Dünya Sırası widget'ına tıklandığında Uluslararası Sıralama sekmesini aç
  const rankWidget = el('stat-ranking');
  if (rankWidget && !rankWidget._hasClickNav) {
    rankWidget._hasClickNav = true;
    rankWidget.style.cursor = 'pointer';
    rankWidget.title = 'Uluslararası Sıralamayı (THE 2024) Görüntüle';
    rankWidget.addEventListener('click', () => {
      const tabBtn = qs('.sidebar-tab[data-tab="intl-ranking"]');
      if (tabBtn) tabBtn.click();
    });
  }
}
