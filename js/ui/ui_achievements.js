import { el, _inlineBar } from './ui_base.js';
import { checkAchievements, getAchievementStats } from '../alumni_events_achievements.js?v=0.4.24';

/**
 * Başarımlar panelini render et.
 */
export function renderAchievementsPanel(state, achievements, stats) {
  const panel = el('tab-achievements');
  if (!panel) return;

  stats = stats || getAchievementStats(state);

  const unlocked = state.achievements || {};
  const categories = {
    kadro:        '👨‍🏫 Kadro',
    ogrenci:      '🎓 Öğrenciler',
    prestij:      '⭐ Saygınlık',
    siralama:     '📊 Sıralama',
    arastirma:    '🔬 Araştırma',
    finans:       '💰 Finansal',
    kampus:       '🏛️ Yerleşke',
    bolum:        '📋 Bölüm',
    akreditasyon: '🏅 Akreditasyon',
    ozel:         '🌟 Özel',
  };

  // Kategorilere göre grupla
  const grouped = {};
  for (const ach of achievements) {
    if (!grouped[ach.category]) grouped[ach.category] = [];
    grouped[ach.category].push(ach);
  }

  const progressPct = stats.percent || 0;

  const catHtml = Object.entries(categories).map(([catId, catName]) => {
    const list = grouped[catId] || [];
    if (list.length === 0) return '';
    const items = list.map(ach => {
      const info = unlocked[ach.id];
      const isUnlocked = !!info;
      return `
        <div class="achievement-item ${isUnlocked ? 'achievement-unlocked' : 'achievement-locked'}"
             title="${ach.description}">
          <div class="achievement-icon">${ach.icon}</div>
          <div class="achievement-info">
            <div class="achievement-name">${ach.name}</div>
            <div class="achievement-desc">${isUnlocked ? ach.description : ach.description}</div>
            ${isUnlocked ? `<div class="achievement-date" style="font-size:10px;color:var(--success);margin-top:2px;">
              Açıldı: ${info.year}. yıl, ${info.semester === 'güz' ? 'Güz' : 'Bahar'} dönemi
            </div>` : ''}
          </div>
          ${isUnlocked ? '<span style="color:var(--success);font-size:16px;flex-shrink:0;">✓</span>' : '<span style="color:var(--text-muted);font-size:16px;flex-shrink:0;">🔒</span>'}
        </div>`;
    }).join('');

    const catUnlocked = list.filter(a => unlocked[a.id]).length;
    return `
      <div style="margin-bottom:20px;">
        <div class="section-title">${catName} (${catUnlocked}/${list.length})</div>
        <div class="achievements-grid">${items}</div>
      </div>`;
  }).join('');

  panel.innerHTML = `
    <div class="panel-header">
      <div class="panel-title">🏆 Kazanımlar</div>
      <div class="panel-subtitle">${stats.unlocked}/${stats.total} kazanım açıldı</div>
    </div>

    <div class="card" style="padding:12px;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="flex:1;">${_inlineBar(stats.unlocked, stats.total, 200)}</div>
        <div style="font-size:14px;font-weight:700;color:var(--accent);">%${progressPct}</div>
      </div>
    </div>

    ${catHtml}
  `;
}

/**
 * Başarım bildirimleri için kuyruk sistemi.
 */
const _achQueue   = [];  // bekleyen başarımlar
let   _achVisible = 0;   // şu anda ekranda görünen sayısı
const _ACH_MAX    = 4;   // aynı anda gösterilecek maksimum
const _ACH_DURATION = 4000; // ms — otomatik kapanma süresi

function _achShowNext() {
  if (_achQueue.length === 0 || _achVisible >= _ACH_MAX) return;
  const ach = _achQueue.shift();
  _achVisible++;

  const container = el('toast-container') || document.body;
  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.innerHTML = `
    <span class="achievement-toast-icon">${ach.icon}</span>
    <div class="achievement-toast-body">
      <div class="achievement-toast-label">🏆 KAZANIM AÇILDI!</div>
      <div class="achievement-toast-name">${ach.name}</div>
      <div class="achievement-toast-desc">${ach.description}</div>
    </div>
    <button class="achievement-toast-close" title="Kapat">✕</button>`;

  container.appendChild(toast);

  const dismiss = () => {
    if (toast._dismissed) return;
    toast._dismissed = true;
    toast.classList.add('fadeout');
    setTimeout(() => {
      toast.remove();
      _achVisible--;
      _achShowNext(); // sıradaki varsa göster
    }, 420);
  };

  toast.querySelector('.achievement-toast-close').addEventListener('click', dismiss);
  setTimeout(dismiss, _ACH_DURATION);
}

/**
 * Başarım açıldığında toast bildirim göster.
 */
export function showAchievementNotification(ach) {
  _achQueue.push(ach);
  _achShowNext();
}
