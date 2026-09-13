import { el, qs, qsa, on, showModal, hideModal, showNotification } from './ui_base.js';

// ─────────────────────────────────────────────────────────────────────────────
// EKRAN YÖNETİMİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Belirtilen ekranı göster, diğerlerini gizle.
 * @param {string} screenId — 'screen-menu' | 'screen-setup' | 'screen-game' | 'screen-event'
 */
export function showScreen(screenId) {
  qsa('.screen').forEach(s => s.classList.remove('active'));
  const target = el(screenId);
  if (target) {
    target.classList.add('active');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EKRAN 1: ANA MENÜ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ana menü event listener'larını bağla.
 * @param {Function} onNewGame    — Yeni oyun callback
 * @param {Function} onLoadGame   — Kayıt yükle callback
 */
export function initMenuScreen(onNewGame, onLoadGame) {
  on(el('btn-new-game'),  'click', onNewGame);
  on(el('btn-load-game'), 'click', onLoadGame || (() => showNotification('Kayıt bulunamadı.', 'warning')));
  on(el('btn-settings'),  'click', () => showSettingsModal());
}

// ─────────────────────────────────────────────────────────────────────────────
// AYARLAR MODALI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ses ayarlarını içeren ayarlar modalını göster.
 */
export function showSettingsModal() {
  const audioSettings = (typeof window.getAudioSettings === 'function')
    ? window.getAudioSettings()
    : { musicVol: 0.3, sfxVol: 0.6, muted: false };

  const musicPct = Math.round((audioSettings.musicVol ?? 0.3) * 100);
  const sfxPct   = Math.round((audioSettings.sfxVol ?? 0.6) * 100);

  const body = `
    <div class="settings-group" style="display:flex;flex-direction:column;gap:20px;padding:4px 0;">
      <div>
        <h4 style="margin:0 0 14px;font-size:15px;font-weight:700;">🔊 Ses Ayarları</h4>
        <div style="display:flex;flex-direction:column;gap:14px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <label style="min-width:100px;font-size:13px;color:var(--text-muted);">Müzik Sesi</label>
            <input type="range" min="0" max="100" value="${musicPct}"
                   style="flex:1;"
                   oninput="window._onMusicVolChange && window._onMusicVolChange(this.value)">
            <span style="min-width:36px;text-align:right;font-size:13px;font-weight:600;">${musicPct}%</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <label style="min-width:100px;font-size:13px;color:var(--text-muted);">Efekt Sesi</label>
            <input type="range" min="0" max="100" value="${sfxPct}"
                   style="flex:1;"
                   oninput="window._onSFXVolChange && window._onSFXVolChange(this.value)">
            <span style="min-width:36px;text-align:right;font-size:13px;font-weight:600;">${sfxPct}%</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;margin-top:4px;">
            <label style="min-width:100px;font-size:13px;color:var(--text-muted);">Ses Durumu</label>
            <button class="btn btn-secondary btn-sm" id="settings-mute-btn"
                    onclick="window._onToggleMute && window._onToggleMute(); this.textContent = (window.isMuted && window.isMuted()) ? '🔇 Sessiz' : '🔊 Açık';"
                    style="min-width:90px;">
              ${audioSettings.muted ? '🔇 Sessiz' : '🔊 Açık'}
            </button>
          </div>
        </div>
      </div>
      <hr style="border:none;border-top:1px solid var(--border-color);margin:0;">
      <div style="font-size:12px;color:var(--text-muted);text-align:center;">
        Ses ayarları otomatik kaydedilir.
      </div>
    </div>
  `;

  showModal('Ayarlar', body);

  const modalBody = el('general-modal-body');
  if (modalBody) {
    modalBody.querySelectorAll('input[type="range"]').forEach(slider => {
      slider.addEventListener('input', () => {
        const span = slider.nextElementSibling;
        if (span) span.textContent = slider.value + '%';
      });
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SÜRÜM NOTLARI (CHANGELOG) MODALI
// ─────────────────────────────────────────────────────────────────────────────

const _CHANGELOG_TYPE_META = {
  feat:     { icon: '✨', label: 'Yeni',      color: '#5dd6c0' },
  fix:      { icon: '🛠️', label: 'Düzeltme',  color: '#f5a623' },
  balance:  { icon: '⚖️', label: 'Denge',     color: '#7e57c2' },
  security: { icon: '🔒', label: 'Güvenlik',  color: '#e74c3c' },
};

export function showChangelogModal(changelog, currentVersion) {
  const safeList = Array.isArray(changelog) ? changelog : [];
  const html = `
    <div style="max-width:680px;">
      <p style="color:var(--text-muted,#aaa);font-size:13px;margin:0 0 16px;">
        En son değişiklikler aşağıda. Yeni sürüm yüklendiğinde bu pencere otomatik açılır.
      </p>
      ${safeList.map((entry, i) => {
        const isCurrent = entry.version === currentVersion;
        const items = (entry.items || []).map(it => {
          const meta = _CHANGELOG_TYPE_META[it.type] || _CHANGELOG_TYPE_META.fix;
          return `
            <li style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px;line-height:1.5;">
              <span style="flex-shrink:0;display:inline-flex;align-items:center;gap:4px;
                           background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:4px;
                           font-size:11px;font-weight:600;color:${meta.color};
                           border:1px solid ${meta.color}33;min-width:80px;justify-content:center;">
                ${meta.icon} ${meta.label}
              </span>
              <span style="flex:1;font-size:13px;color:var(--text,#e0e0e0);">${_escHtml(it.text || '')}</span>
            </li>`;
        }).join('');
        return `
          <div style="margin-bottom:20px; padding:14px; border-radius:8px;
                      background:${isCurrent ? 'rgba(93,214,192,0.06)' : 'rgba(255,255,255,0.02)'};
                      border:1px solid ${isCurrent ? 'rgba(93,214,192,0.25)' : 'rgba(255,255,255,0.06)'};">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px;">
              <div style="display:flex;align-items:baseline;gap:10px;">
                <span style="font-size:16px;font-weight:700;color:${isCurrent ? '#5dd6c0' : 'var(--text)'};">
                  v${_escHtml(entry.version || '?')}
                </span>
                ${isCurrent ? '<span style="font-size:10px;background:#5dd6c0;color:#0a0a0a;padding:2px 8px;border-radius:10px;font-weight:700;">ŞU AN</span>' : ''}
              </div>
              <span style="font-size:11px;color:var(--text-muted,#888);">${_escHtml(entry.date || '')}</span>
            </div>
            <ul style="list-style:none;padding:0;margin:0;">${items}</ul>
          </div>`;
      }).join('')}
    </div>`;

  showModal('📋 Yenilikler', html, { wide: true });
}

function _escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Oyun kazanıldığında kutlama modal'ını gösterir.
 * @param {object} state — Oyun durumu
 * @param {string} winReason — checkWinLose().reason değeri
 * @param {Function} calculateScore — Skor hesaplama fonksiyonu (leaderboard.js'ten enjekte)
 * @param {Function} scoreBreakdown — Skor kırılımı fonksiyonu
 * @param {Function} onSubmitScore — Leaderboard skor gönderme callback'i
 */
export function showGameWonModal(state, winReason, calculateScore, scoreBreakdown, onSubmitScore) {
  const scenarioId = state?.meta?.scenario || null;

  // Senaryo bazlı özel mesajlar
  const scenarioMessages = {
    vakif_kurtarma: 'Üniversiteyi mali krizden çıkardınız! Bütçeyi 10 dönem boyunca pozitif tuttunuz.',
    yeni_kurulan:   'Üniversitenizin saygınlık hedefine ulaştınız! 60 puanı geçtiniz.',
    koklu_devlet:   'Sıralama hedefini tutturdunuz! İlk 30\'a girdiniz.',
  };

  // Kazanma nedeni mesajı
  const reasonMessages = {
    scenario_budget_positive: scenarioMessages[scenarioId] || 'Bütçeyi peş peşe pozitif tuttunuz.',
    scenario_prestige:        scenarioMessages[scenarioId] || 'Saygınlık hedefine ulaştınız.',
    scenario_ranking:         scenarioMessages[scenarioId] || 'Sıralama hedefini tutturdunuz.',
    prestige_max:             'Üniversiteniz dünya çapında lider oldu! Saygınlık 90 puanın üzerine çıktı.',
    ranking_first:            'Üniversiteniz ulusal sıralamada 1. sıraya yükseldi!',
  };

  const winMessage = reasonMessages[winReason]
    || scenarioMessages[scenarioId]
    || 'Üniversiteniz başarıyla hedeflerine ulaştı!';

  const score     = calculateScore ? calculateScore(state) : 0;
  const breakdown = scoreBreakdown ? scoreBreakdown(state) : [];

  const breakdownHtml = breakdown.length
    ? `<ul style="margin:10px 0 0;padding-left:18px;list-style:disc;">
        ${breakdown.map(line => `<li style="font-size:12px;color:var(--text-muted,#aaa);margin:2px 0;">${line}</li>`).join('')}
       </ul>`
    : '';

  const bodyHtml = `
    <div style="display:flex;flex-direction:column;gap:18px;padding:4px 0;text-align:center;">
      <div style="font-size:48px;line-height:1;">🏆</div>
      <div>
        <div style="font-size:22px;font-weight:700;color:#f5a623;margin-bottom:8px;">
          Tebrikler! Hedefe Ulaştınız!
        </div>
        <p style="margin:0;font-size:14px;line-height:1.6;color:var(--text-secondary,#ccc);">
          ${winMessage}
        </p>
      </div>
      <div style="background:rgba(93,214,192,0.08);border:1px solid rgba(93,214,192,0.3);
                  border-radius:10px;padding:16px;">
        <div style="font-size:32px;font-weight:700;color:var(--accent,#5dd6c0);">
          ${score.toLocaleString('tr-TR')} puan
        </div>
        <div style="font-size:12px;color:var(--text-muted,#aaa);margin-top:4px;">Final Skoru</div>
        ${breakdownHtml}
      </div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        <button id="won-leaderboard-btn" class="btn btn-primary btn-sm">
          🏆 Leaderboard'a Gönder
        </button>
        <button id="won-freemode-btn" class="btn btn-success btn-sm">
          ⏩ Serbest Devam Et
        </button>
        <button id="won-new-game-btn" class="btn btn-ghost btn-sm">
          🎮 Yeni Oyuna Başla
        </button>
      </div>
    </div>`;

  showModal('🏆 Oyun Kazanıldı!', bodyHtml);

  document.getElementById('won-leaderboard-btn')?.addEventListener('click', () => {
    hideModal();
    if (onSubmitScore) onSubmitScore();
  });

  document.getElementById('won-freemode-btn')?.addEventListener('click', () => {
    if (typeof window._onEnableFreeMode === 'function') window._onEnableFreeMode();
  });

  document.getElementById('won-new-game-btn')?.addEventListener('click', () => {
    hideModal();
    showScreen('screen-menu');
  });
}

