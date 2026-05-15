/**
 * Rektör Oldum — Giriş Noktası (main.js)
 * ES6 module. Tüm modülleri bağlar, event listener'ları kurar, oyun akışını yönetir.
 */
console.log('[main] main.js modülü yükleniyor...');

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT
// ─────────────────────────────────────────────────────────────────────────────

import { initGame, nextTurn, getState, setState, applyDecision, assignCourses, applyQuotas, assignDeptHead, reassignFacultyToDept, generateAdminCandidates, hireAdminStaff, upgradeAdminUnit, promoteAdminStaff, fireAdminStaff, updateAdminStaffSalary, assignUnitManager, RANDOM_EVENTS, ACHIEVEMENTS, getAchievementStats, organizeAlumniEvent, applyRandomEventChoice, ACCREDITATION_BODIES, applyForAccreditation, checkAccreditationRequirements, establishTTO, upgradeTTO, acceptDeal, rejectDeal, foundClub, upgradeClub, dissolveClub, CLUB_TYPES, CLUB_CATEGORIES, SPORTS, foundTeam, upgradeTeam, dissolveTeam, setCourseDifficulty } from './game.js?v=0.4.51';
import { ADMIN_TITLES } from './data.js?v=0.4.49';

import {
  showScreen,
  showModal,
  hideModal,
  showNotification,
  showSettingsModal,
  initMenuScreen,
  initSetupScreen,
  initTabNavigation,
  updateTopBar,
  renderDashboard,
  renderDepartmentsPanel,
  renderBolumlerPanel,
  renderFacultyPanel,
  renderStudentsPanel,
  renderCampusPanel,
  renderBudgetPanel,
  renderResearchPanel,
  renderTransferMarket,
  renderOpenPositionModal,
  renderTurnSummary,
  renderEvent,
  renderQuotaModal,
  renderAdminPanel,
  renderAdminHireModal,
  renderAlumniPanel,
  renderAchievementsPanel,
  renderAccreditationPanel,
  renderClubsPanel,
  renderSportsPanel,
  showAchievementNotification,
  renderRandomEventModal,
  showAccreditationModal,
  renderLeaderboardPanel,
  renderInternationalRankingPanel,
  showChangelogModal,
  showGameWonModal,
  el,
  on,
} from './ui.js?v=0.4.51';

import { CHANGELOG, hasUnseenChanges, setLastSeenVersion } from './changelog.js?v=0.4.51';

import { saveGame, loadGame, autoSave, getSaveSlots, deleteSave, exportSave, importSave, sanitizeForSave } from './save.js?v=0.4.28';
import { calculateScore, scoreBreakdown, submitScore, getTopScores, initFirebase, isLeaderboardUnavailable, saveLocalScore, getLocalScores } from './leaderboard.js?v=0.4.45';
import { showTutorialIfNeeded, replayTutorial } from './tutorial.js?v=0.4.24';
import { initAudio, playSound, toggleMute, isMuted, startMusic, stopMusic, setMusicVolume, setSFXVolume, getAudioSettings } from './audio.js?v=0.4.24';

import { generateTransferMarket, renderFacultyAvatar, calculateOverallRating, getFacultyRatingTrend } from './faculty.js?v=0.4.39';
import { resolveDecision } from './events.js?v=0.4.24';

// Uluslararası sıralama modülleri
import { THE_2024 } from './intl_rankings_the2024.js?v=0.4.39';
import {
  calculateIntlPillars,
  calculateIntlTotalScore,
  findIntlRank,
  getNeighbors as getIntlNeighbors,
  filterByCountry as filterIntlByCountry,
} from './intl_ranking.js?v=0.4.39';

// ─────────────────────────────────────────────────────────────────────────────
// UYGULAMA DURUMU
// ─────────────────────────────────────────────────────────────────────────────

/** Aktif sekme ID'si */
let _activeTab = 'dashboard';

/** Transfer pazarı verisi (fakulte.js gelince gerçek değer alacak) */
let _transferMarket = null;

// ─────────────────────────────────────────────────────────────────────────────
// AKSIYON BAZLI OTOMATIK KAYIT YARDIMCISI (FIX A — v0.4.49)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Anlık state'i localStorage'a kaydeder.
 * Her başarılı aksiyon sonrası çağrılır; dönem sonu beklenmez.
 * localStorage I/O ~1 ms, debouncing gerekmez.
 */
function _persistState() {
  try {
    const state = getState();
    if (!state) return;
    const safe = sanitizeForSave ? sanitizeForSave(state) : state;
    autoSave(safe);
  } catch (e) {
    console.warn('[main] _persistState hatası:', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BAŞLANGIÇ
// ─────────────────────────────────────────────────────────────────────────────

// Module script'ler DOMContentLoaded'dan sonra çalışır,
// bu yüzden DOM zaten hazır. Doğrudan init() çağır.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[main] DOM yüklendi (event), oyun başlatılıyor...');
    init();
  });
} else {
  console.log('[main] DOM zaten hazır, oyun başlatılıyor...');
  try {
    init();
  } catch (e) {
    console.error('[main] init() HATASI:', e.message, e.stack);
  }
}

/**
 * Uygulama başlangıcı.
 * Ana menü gösterilir, tüm temel event listener'lar bağlanır.
 */
function init() {
  console.log('[main] init()');

  // Ses modülünü başlat (AudioContext kullanıcı etkileşimine kadar bekler)
  initAudio();

  // Global ses callback'leri (HTML onclick ve settings modal için)
  window._onToggleMute = () => {
    const muted = toggleMute();
    const btn = document.getElementById('btn-toggle-mute');
    if (btn) btn.textContent = muted ? '🔇' : '🔊';
    if (!muted) startMusic();
  };
  window._onMusicVolChange = (val) => setMusicVolume(Number(val) / 100);
  window._onSFXVolChange   = (val) => setSFXVolume(Number(val) / 100);
  // Durum sorgulama (ui.js settings modal için)
  window.isMuted          = isMuted;
  window.getAudioSettings = getAudioSettings;

  showScreen('screen-menu');

  // Ana menü butonları
  initMenuScreen(
    _onNewGame,
    _onLoadGameMenu,
  );

  // Modal kapatma butonları
  on(el('btn-close-modal'), 'click', () => hideModal());
  on(el('modal-backdrop'), 'click', (e) => {
    // Backdrop'a tıklanırsa kapat (modal içine tıklanırsa kapatma)
    if (e.target.id === 'modal-backdrop') hideModal();
  });

  // Oyun içi Ayarlar butonu (top-bar'daki ⚙️) — ses ayarları modalını açar
  on(el('btn-game-settings'), 'click', () => {
    playSound('click');
    showSettingsModal();
  });

  // Oyun içi Ana Menü butonu (top-bar'daki ☰) — açılır menü gösterir
  on(el('btn-main-menu'), 'click', (e) => {
    e.stopPropagation();
    playSound('click');
    _toggleMainMenuDropdown();
  });

  // Ana menüdeki Geri Bildirim butonu — GitHub Issues sayfasını yeni sekmede açar
  on(el('btn-feedback'), 'click', () => {
    playSound('click');
    _openFeedback();
  });

  // Ana menüdeki Yenilikler butonu — sürüm notları modalı
  on(el('btn-changelog'), 'click', () => {
    playSound('click');
    _showChangelog();
  });

  // Klavye kısayolları
  _bindKeyboardShortcuts();

  // Sayfa yüklendiğinde kayıt varlığını kontrol et
  _checkSaveOnLoad();

  // Yeni sürüm yüklendiyse otomatik aç (ilk ziyaret veya APP_VERSION değiştiyse)
  _checkChangelogOnLoad();

  // Firebase'i arka planda sessizce başlat (ilk tıklamada gecikmeyi önler)
  initFirebase().catch(err => console.warn('[main] Firebase önyükleme başarısız (önemli değil):', err.message));

  console.log('[main] Başlangıç tamamlandı.');
}

/**
 * Sayfa ilk açıldığında otomatik kayıt veya slot kaydı varsa
 * ana menüde "Kayıtlı oyun bulundu" bildirimi gösterir.
 */
function _checkSaveOnLoad() {
  const slots = getSaveSlots();
  const hasAny = slots.some(s => !s.isEmpty);
  if (!hasAny) return;

  // "Kayıt Yükle" butonunu vurgula
  const loadBtn = el('btn-load-game');
  if (loadBtn) {
    loadBtn.classList.add('btn-has-save');
    loadBtn.innerHTML = '<span class="btn-icon">💾</span> Kayıtlı Oyunu Yükle';
  }

  // Kısa bildirim — bildirim sistemi henüz DOM'a bağlanmadıysa gecikmeli göster
  setTimeout(() => {
    showNotification('Kayıtlı oyun bulundu. Devam etmek için "Kayıtlı Oyunu Yükle" butonuna basın.', 'info', 5000);
  }, 300);

  console.log('[main] Kayıtlı oyun bulundu:', slots.filter(s => !s.isEmpty).map(s => s.slotName).join(', '));
}

// ─────────────────────────────────────────────────────────────────────────────
// OYUN İÇİ ANA MENÜ DROPDOWN (top-bar ☰)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Top-bar'daki ☰ butonuna tıklayınca açılan küçük dropdown menü.
 * Tekrar tıklanırsa veya dış alana tıklanırsa kapanır.
 */
function _toggleMainMenuDropdown() {
  const existing = document.getElementById('main-menu-dropdown');
  if (existing) {
    existing.remove();
    return;
  }

  const btn = el('btn-main-menu');
  if (!btn) return;
  const rect = btn.getBoundingClientRect();

  const dd = document.createElement('div');
  dd.id = 'main-menu-dropdown';
  dd.style.cssText = `
    position: fixed;
    top: ${rect.bottom + 6}px;
    right: ${window.innerWidth - rect.right}px;
    z-index: 9999;
    min-width: 220px;
    background: var(--surface, #1a2332);
    border: 1px solid var(--border-color, rgba(255,255,255,0.1));
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  `;

  const items = [
    { action: 'settings',   icon: '⚙️',  label: 'Ayarlar' },
    { action: 'save',       icon: '💾',  label: 'Kaydet' },
    { action: 'load',       icon: '📂',  label: 'Kayıt Yükle' },
    { action: 'export',     icon: '📤',  label: 'Kaydı Dışa Aktar' },
    { action: 'tutorial',   icon: '📚',  label: 'Tutorial Tekrarla' },
    { action: 'feedback',   icon: '💬',  label: 'Geri Bildirim' },
    { action: 'separator' },
    { action: 'leaderboard-submit', icon: '🏆', label: 'Skorumu Gönder' },
    { action: 'separator' },
    { action: 'menu',       icon: '🚪',  label: 'Ana Menüye Dön' },
  ];

  items.forEach(it => {
    if (it.action === 'separator') {
      const hr = document.createElement('div');
      hr.style.cssText = 'height:1px;background:var(--border-color,rgba(255,255,255,0.08));margin:4px 0;';
      dd.appendChild(hr);
      return;
    }
    const b = document.createElement('button');
    b.className = 'btn btn-ghost';
    b.dataset.action = it.action;
    b.innerHTML = `<span style="margin-right:8px;">${it.icon}</span>${it.label}`;
    b.style.cssText = `
      display:flex;align-items:center;justify-content:flex-start;
      width:100%;padding:8px 12px;font-size:13px;text-align:left;
      background:transparent;border:none;border-radius:6px;cursor:pointer;
      color:var(--text,#fff);
    `;
    b.addEventListener('mouseenter', () => { b.style.background = 'rgba(255,255,255,0.06)'; });
    b.addEventListener('mouseleave', () => { b.style.background = 'transparent'; });
    dd.appendChild(b);
  });

  document.body.appendChild(dd);

  // Eylem yöneticisi
  dd.addEventListener('click', (ev) => {
    const action = ev.target.closest('button')?.dataset?.action;
    if (!action) return;
    dd.remove();
    playSound('click');
    _handleMainMenuAction(action);
  });

  // Dışa tıklamada kapat (bir sonraki tick'te dinleyici kur, mevcut click'i yutmasın)
  setTimeout(() => {
    const closeOnOutside = (ev) => {
      if (!dd.contains(ev.target) && ev.target.id !== 'btn-main-menu') {
        dd.remove();
        document.removeEventListener('click', closeOnOutside);
      }
    };
    document.addEventListener('click', closeOnOutside);
  }, 0);
}

/**
 * Sürüm notları modalını gösterir.
 * Mevcut sürüm changelog'un ilk entry'sinden alınır.
 */
function _showChangelog() {
  const currentVersion = CHANGELOG[0]?.version || '?';
  showChangelogModal(CHANGELOG, currentVersion);
  setLastSeenVersion(currentVersion);
}

/**
 * Sayfa açılışında yeni sürüm yüklendiyse changelog'u otomatik göster.
 * Kullanıcı önceki sürümü görmüşse (lastSeen === current) sessizce geçer.
 */
function _checkChangelogOnLoad() {
  const currentVersion = CHANGELOG[0]?.version;
  if (!currentVersion) return;
  if (!hasUnseenChanges(currentVersion)) return;

  // İlk ziyareti yorma — sadece sürüm değişiminde aç
  // (boş localStorage'da kullanıcıyı oyunla buluşmaya bırak, ilk seferde popup spam yok)
  // Ama Yusuf/SerHan vb. için: önceki sürümleri görmüş olduklarını varsay
  const seen = (() => { try { return localStorage.getItem('rektor_oldum_last_seen_version'); } catch { return null; } })();
  if (seen === null) {
    // İlk ziyaret: otomatik açma, sadece "görüldü" olarak işaretle ki sonraki sürümlerde popup gelsin
    setLastSeenVersion(currentVersion);
    return;
  }

  // 1.5 sn gecikme — menü ekranı oturana kadar
  setTimeout(() => _showChangelog(), 1500);
}

/**
 * Geri Bildirim modali — kullanıcıyı GitHub Issues'a yönlendirir.
 * 3 kategori (hata / öneri / genel) ayrı template'lere link verir.
 */
function _openFeedback() {
  const REPO = 'prof-oguzergin/rektor-oldum';
  const baseUrl = `https://github.com/${REPO}/issues/new`;

  const body = `
    <div style="display:flex;flex-direction:column;gap:14px;padding:4px 0;">
      <p style="margin:0;font-size:14px;color:var(--text-muted,#aaa);line-height:1.5;">
        Oyunla ilgili hata bildirebilir, öneri yazabilir veya soru sorabilirsin.
        Yorumların <strong>GitHub</strong>'da herkese açık olarak görünür.
        Yanıt almak için GitHub hesabın gerekir (1 dakikada açılır).
      </p>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <a href="${baseUrl}?template=bug.yml&labels=bug" target="_blank" rel="noopener"
           class="btn btn-secondary"
           style="display:flex;align-items:center;justify-content:flex-start;gap:10px;padding:12px 14px;text-decoration:none;">
          <span style="font-size:22px;">🐛</span>
          <div style="display:flex;flex-direction:column;align-items:flex-start;gap:2px;">
            <strong style="font-size:14px;">Hata Bildir</strong>
            <span style="font-size:11px;opacity:0.7;">Oyunda bir şey çalışmıyor mu?</span>
          </div>
        </a>
        <a href="${baseUrl}?template=feature.yml&labels=enhancement" target="_blank" rel="noopener"
           class="btn btn-secondary"
           style="display:flex;align-items:center;justify-content:flex-start;gap:10px;padding:12px 14px;text-decoration:none;">
          <span style="font-size:22px;">💡</span>
          <div style="display:flex;flex-direction:column;align-items:flex-start;gap:2px;">
            <strong style="font-size:14px;">Öneri / Yeni Özellik</strong>
            <span style="font-size:11px;opacity:0.7;">Hangi özellik eklensin?</span>
          </div>
        </a>
        <a href="${baseUrl}?labels=question" target="_blank" rel="noopener"
           class="btn btn-secondary"
           style="display:flex;align-items:center;justify-content:flex-start;gap:10px;padding:12px 14px;text-decoration:none;">
          <span style="font-size:22px;">❓</span>
          <div style="display:flex;flex-direction:column;align-items:flex-start;gap:2px;">
            <strong style="font-size:14px;">Genel Soru / Yorum</strong>
            <span style="font-size:11px;opacity:0.7;">Aklındaki başka bir şey</span>
          </div>
        </a>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted,#888);margin-top:6px;">
        <a href="https://github.com/${REPO}/issues" target="_blank" rel="noopener" style="color:var(--accent,#5dd6c0);text-decoration:none;">📋 Tüm Bildirimleri Gör</a>
        <span>Yöneticiler bildirimleri inceler.</span>
      </div>
    </div>
  `;
  showModal('💬 Geri Bildirim', body);
}

function _handleMainMenuAction(action) {
  switch (action) {
    case 'settings':
      showSettingsModal();
      break;
    case 'save':
      _showSaveModal();
      break;
    case 'load':
      _showLoadModal();
      break;
    case 'export':
      try {
        exportSave(getState());
        showNotification('Kayıt JSON olarak indirildi.', 'success');
      } catch (e) {
        showNotification('Dışa aktarma başarısız.', 'error');
      }
      break;
    case 'tutorial':
      try { replayTutorial(); }
      catch (e) { showNotification('Tutorial başlatılamadı.', 'error'); }
      break;
    case 'feedback':
      _openFeedback();
      break;
    case 'leaderboard-submit':
      _showLeaderboardSubmitModal();
      break;
    case 'menu':
      if (confirm('Ana menüye dönmek istiyor musun? Kaydetmediğin işler korunmaz.')) {
        stopMusic();
        showScreen('screen-menu');
      }
      break;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MENÜ AKIŞI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * "Yeni Oyun" butonuna basıldığında kurulum ekranına geç.
 */
function _onNewGame() {
  console.log('[main] Yeni oyun başlatılıyor → kurulum ekranı');
  showScreen('screen-setup');
  initSetupScreen(_onSetupComplete);
}

/**
 * "Devam Et" butonuna basıldığında son otomatik kaydı yükle.
 */
function _onLoadGameMenu() {
  console.log('[main] Devam et → otomatik kayıt aranıyor...');

  const state = loadGame('autosave');
  if (state) {
    _applyLoadedState(state);
    showNotification('Oyun kaldığı yerden devam ediyor.', 'success');
  } else {
    console.log('[main] Otomatik kayıt bulunamadı, slot listesi gösteriliyor.');
    _showLoadModal();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// KURULUM TAMAMLANDI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kurulum ekranındaki "Oyunu Başlat" butonuna basıldığında çağrılır.
 * @param {object} setup — { playerName, uniName, uniType, difficulty, departments }
 */
function _onSetupComplete(setup) {
  console.log('[main] Kurulum tamamlandı:', setup);

  const state = initGame(
    setup.playerName,
    setup.uniName,
    setup.uniType,
    setup.difficulty,
    setup.departments,
    setup.scenarioId || null,
  );

  console.log('[main] initGame() tamamlandı, oyun ekranına geçiliyor.');
  _startGameWithState(state);
  showNotification(`${setup.uniName} kuruldu! İyi yönetimler, Rektör ${setup.playerName}.`, 'success');

  // İlk oyun başlangıcında rehberi göster
  setTimeout(() => showTutorialIfNeeded(), 600);
}

/**
 * Verilen state ile oyun ekranını aç ve UI'ı hazırla.
 * @param {object} state — Oyun durumu
 */
function _startGameWithState(state) {
  showScreen('screen-game');
  _bindGameScreenEvents();
  // Akreditasyon callback'lerini global alana kaydet (ui.js butonları için)
  window._onShowAccreditationModal = _onShowAccreditationModal;
  window._checkAccreditationRequirements = checkAccreditationRequirements;

  // Kulüp verilerini ve callback'lerini global alana kaydet (ui.js butonları için)
  window._CLUB_TYPES      = CLUB_TYPES;
  window._CLUB_CATEGORIES = CLUB_CATEGORIES;
  window._onFoundClub = (typeId) => {
    const result = applyDecision({ type: 'found_club', typeId });
    showNotification(result.message, result.success ? 'success' : 'error');
    if (result.success) _persistState();
    refreshGameUI();
  };
  window._onUpgradeClub = (clubId) => {
    const result = applyDecision({ type: 'upgrade_club', clubId });
    showNotification(result.message, result.success ? 'success' : 'error');
    if (result.success) _persistState();
    refreshGameUI();
  };
  window._onDissolveClub = (clubId) => {
    if (!confirm('Bu topluluğu kapatmak istediğinize emin misiniz?')) return;
    const result = applyDecision({ type: 'dissolve_club', clubId });
    showNotification(result.message, result.success ? 'success' : 'error');
    if (result.success) _persistState();
    refreshGameUI();
  };

  // Spor verilerini ve callback'lerini global alana kaydet (ui.js butonları için)
  window._SPORTS = SPORTS;
  window._onFoundTeam = (sportId) => {
    const result = applyDecision({ type: 'found_team', sportId });
    showNotification(result.message, result.success ? 'success' : 'error');
    if (result.success) _persistState();
    refreshGameUI();
  };
  window._onUpgradeTeam = (teamId) => {
    const result = applyDecision({ type: 'upgrade_team', teamId });
    showNotification(result.message, result.success ? 'success' : 'error');
    if (result.success) _persistState();
    refreshGameUI();
  };
  window._onDissolveTeam = (teamId) => {
    if (!confirm('Bu takımı kapatmak istediğinize emin misiniz?')) return;
    const result = applyDecision({ type: 'dissolve_team', teamId });
    showNotification(result.message, result.success ? 'success' : 'error');
    if (result.success) _persistState();
    refreshGameUI();
  };

  // Ders zorluk ayarı (Issue #8 Katman 1) — slider'dan çağrılır
  window._onSetCourseDifficulty = (deptId, courseId, newDifficulty) => {
    const result = setCourseDifficulty(deptId, courseId, parseInt(newDifficulty, 10));
    if (result.success) {
      _persistState();
      refreshGameUI();
    }
  };

  refreshGameUI();
  // Ambient müziği başlat (mute değilse)
  if (!isMuted()) startMusic();
  console.log('[main] Oyun ekranı hazır. Dönem:', state?.meta?.turn, '| Bütçe:', state?.university?.budget);

  // Yüklenen kayıtta oyun kazanılmışsa veya bitmişse kullanıcıya bildir
  if (state?._internal?.gameWon) {
    setTimeout(() => {
      showGameWonModal(
        state,
        null,
        calculateScore,
        scoreBreakdown,
        () => _showLeaderboardSubmitModal(true),
      );
    }, 600);
  } else if (state?._internal?.gameOver) {
    setTimeout(() => {
      showNotification('Bu kayıt oyunun bittiği bir noktadan. Yeni oyun başlatabilirsiniz.', 'info', 6000);
    }, 600);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OYUN EKRANI — UI YENİLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tüm oyun UI'ını güncel state'e göre yenile.
 * Aktif sekmeye göre ilgili panel render edilir.
 */
function refreshGameUI() {
  const state = getState();
  if (!state) {
    console.warn('[main] refreshGameUI: state yok, yenileme atlandı.');
    return;
  }

  console.log(`[main] refreshGameUI() → aktif sekme: ${_activeTab}, tur: ${state.meta?.turn}`);

  // Üst bar
  updateTopBar(state);

  // Aktif paneli render et
  switch (_activeTab) {
    case 'dashboard':
      renderDashboard(state);
      break;
    case 'faculty':
      renderFacultyPanel(
        state,
        _onOpenTransferMarket,
        _onFacultyDetail,
        _onOpenPositionModal,
      );
      // Başvuru butonlarını dinle
      _bindApplicantButtons();
      break;
    case 'students':
      renderStudentsPanel(state, _onOpenQuotaScreen);
      break;
    case 'departments':
      renderDepartmentsPanel(state);
      break;
    case 'bolumler':
      renderBolumlerPanel(state, _onAssignDeptHead, _onReassignFaculty);
      break;
    case 'campus':
      renderCampusPanel(state, _onBuildStart, _onCampusDecision);
      break;
    case 'budget':
      renderBudgetPanel(state, _onAllocChange, _onLoanAction, _onTuitionChange, _onAidChange);
      break;
    case 'research':
      renderResearchPanel(state, _onResearchBudget, _onProjectDecision);
      break;
    case 'admin':
      renderAdminPanel(state, _onHireAdminStaff, _onUpgradeAdminUnit);
      break;
    case 'alumni':
      renderAlumniPanel(state, _onAlumniEvent);
      break;
    case 'sports':
      renderSportsPanel(state);
      break;
    case 'clubs':
      renderClubsPanel(state);
      break;
    case 'accreditation':
      renderAccreditationPanel(state, _onApplyAccreditation, _onRenewAccreditation);
      break;
    case 'achievements':
      renderAchievementsPanel(state, ACHIEVEMENTS, getAchievementStats(state));
      break;
    case 'leaderboard':
      renderLeaderboardPanel(getTopScores).catch(err => {
        showNotification('Skor tablosu yüklenemedi: ' + err.message, 'error');
      });
      break;
    case 'intl-ranking':
      _onShowIntlRankingPanel(state);
      break;
    default:
      console.warn(`[main] Bilinmeyen sekme: ${_activeTab}`);
      renderDashboard(state);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ULUSLARARASI SIRALAMA PANELİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uluslararası Sıralama sekmesi açıldığında çağrılır.
 * Pillar hesabını yapıp ui.js renderInternationalRankingPanel'e aktarır.
 * @param {object} state — Oyun durumu
 */
function _onShowIntlRankingPanel(state) {
  renderInternationalRankingPanel(
    state,
    THE_2024,
    calculateIntlPillars,
    calculateIntlTotalScore,
    findIntlRank,
    getIntlNeighbors,
    filterIntlByCountry,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OYUN EKRANI — EVENT LISTENER'LAR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Akreditasyon modalını göster ve başvuru işlemini yönet.
 * ui.js içindeki butonların window._onShowAccreditationModal üzerinden çağırdığı callback.
 */
function _onShowAccreditationModal(deptId, bodyId) {
  const state = getState();
  if (!state) return;
  const dept = state.departments.find(d => d.id === deptId);
  const body = ACCREDITATION_BODIES[bodyId];
  if (!dept || !body) return;

  const reqResult = checkAccreditationRequirements(state, dept, body);

  showAccreditationModal(state, deptId, bodyId, reqResult, (dId, bId) => {
    const result = applyForAccreditation(dId, bId);
    if (result.success) {
      showNotification(result.message, 'success');
      _persistState();
      refreshGameUI();
    } else {
      showNotification(result.message, 'error');
    }
  });
}

/**
 * Akreditasyon panelinden "Başvur" butonuna basıldığında çağrılır.
 */
function _onApplyAccreditation(deptId, bodyId) {
  _onShowAccreditationModal(deptId, bodyId);
}

/**
 * Akreditasyon panelinden "Yenile" butonuna basıldığında çağrılır.
 * Motor, süresi dolmuş akreditasyonlar için renewal maliyetini otomatik uygular.
 */
function _onRenewAccreditation(deptId, bodyId) {
  _onShowAccreditationModal(deptId, bodyId);
}

/** Oyun ekranına ait tüm event listener'ları bağla (bir kez çağrılır). */
function _bindGameScreenEvents() {
  console.log('[main] Oyun ekranı event listener\'ları bağlanıyor...');

  // ── Sekme navigasyonu ───────────────────────────────────────────────────
  initTabNavigation((tabId) => {
    console.log(`[main] Sekme değişti → ${tabId}`);
    _activeTab = tabId;
    playSound('click');
    refreshGameUI();
  });

  // ── Sonraki Dönem butonu ────────────────────────────────────────────────
  on(el('btn-next-turn'), 'click', _onNextTurn);

  // ── Kaydet butonu (toolbar) ─────────────────────────────────────────────
  on(el('btn-save-game'), 'click', () => {
    console.log('[main] Kaydet butonuna basıldı.');
    _showSaveModal();
  });

  // ── Modal kapat butonu ──────────────────────────────────────────────────
  // HTML'de id="btn-close-modal" (modal-close-btn değil)
  on(el('btn-close-modal'), 'click', hideModal);
  on(el('modal-overlay'), 'click', (e) => {
    if (e.target === el('modal-overlay') || e.target.id === 'modal-backdrop') hideModal();
  });

  // ── ❓ Rehber butonu ────────────────────────────────────────────────────
  _injectTutorialReplayButton();

  console.log('[main] Oyun ekranı event listener\'ları bağlandı.');
}

/**
 * Oyun ekranına sabit "❓ Rehber" butonunu ekler.
 * Zaten varsa tekrar eklenmez.
 */
function _injectTutorialReplayButton() {
  if (document.getElementById('tutorial-replay-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'tutorial-replay-btn';
  btn.className = 'tutorial-replay-btn';
  btn.innerHTML = '❓ Rehber';
  btn.title = 'Rehberi yeniden başlat';
  btn.addEventListener('click', () => replayTutorial());
  document.getElementById('screen-game')?.appendChild(btn);
}

// ─────────────────────────────────────────────────────────────────────────────
// KLAVYE KISAYOLLARI
// ─────────────────────────────────────────────────────────────────────────────

function _bindKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+S → Kaydet
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      const state = getState();
      if (!state) return;
      console.log('[main] Ctrl+S → kaydetme modalı');
      _showSaveModal();
    }

    // Escape → Modal kapat
    if (e.key === 'Escape') {
      hideModal();
    }
  });

  console.log('[main] Klavye kısayolları bağlandı (Ctrl+S: kaydet, Esc: modal kapat)');
}

// ─────────────────────────────────────────────────────────────────────────────
// SONRAKI DÖNEM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * "Sonraki Dönem" butonuna basıldığında çalışır.
 * Güz döneminden önce kontenjan modalı zorunlu olarak gösterilir.
 * Tur ilerletir, otomatik kaydeder, özeti gösterir.
 */
function _onNextTurn() {
  console.log('[main] Sonraki dönem başlıyor...');

  const currentState = getState();
  if (!currentState) return;

  // Oyun bittiyse/kazanıldıysa simülasyon yapma (Emir raporu — boş özet
  // modal'ı açılıyordu çünkü nextTurn() "Oyun zaten bitti." döndürüp
  // erken çıkıyor, ama UI hâlâ özet render ediyordu).
  if (currentState.gameOver || currentState.gameWon) {
    showNotification(
      currentState.gameWon
        ? '🏆 Oyun kazanıldı. Yeni oyun başlatabilirsin.'
        : 'Oyun bitti. Yeni oyun başlatabilirsin.',
      'info',
      5000,
    );
    return;
  }

  // Bahar dönemi simüle edilecekse → önce kontenjan modalı ZORUNLU
  // (Bahar sonunda sınıf ilerlemesi + yeni alım birlikte yapılır;
  //  oyuncu bir sonraki yılın kontenjanlarını Bahar öncesinde belirler.)
  const currentSemester = currentState.meta?.semester;
  if (currentSemester === 'bahar') {
    console.log('[main] Bahar dönemi → kontenjan modalı gösteriliyor (zorunlu).');
    renderQuotaModal(currentState, (quotas) => {
      console.log('[main] Kontenjan onaylandı (Bahar öncesi):', quotas);
      applyQuotas(quotas);
      _runTurnAfterQuotas();
    });
    return; // Kullanıcı onaylayana kadar bekle
  }

  // Güz dönemi: doğrudan çalıştır
  _runTurnAfterQuotas();
}

/**
 * Kontenjan onayı (veya bahar dönemi) sonrasında turu çalıştırır.
 * @private
 */
function _runTurnAfterQuotas() {
  const summary = nextTurn();
  const state   = getState();

  console.log('[main] nextTurn() tamamlandı. Özet:', summary);

  // Defensive: backend "Oyun zaten bitti." dönerse boş özet modal'ı açma
  // (Emir raporu — _onNextTurn'de zaten erken çıkış var, bu son güvenlik ağı).
  if (/zaten bitti/i.test(summary?.message || '')) {
    showNotification(
      state?.gameWon ? '🏆 Oyun kazanıldı. Yeni oyun başlatabilirsin.' : 'Oyun bitti. Yeni oyun başlatabilirsin.',
      'info',
      5000,
    );
    return;
  }

  // Simülasyon hatası: state geri alındı, kullanıcıya net bildirim göster
  // ve akışı durdur (otomatik kayıt + özet modal'ı çalıştırma).
  if (summary?.error) {
    showNotification(
      summary.message || 'Dönem ilerletilemedi. Lütfen tekrar deneyin.',
      'warning',
      8000,
    );
    return;
  }

  // Bekleyen karar varsa: kullanıcı önce kararı onaylamalı
  if (summary?.blocked && !summary?.error) {
    showNotification(summary.message || 'Önce bekleyen kararı yanıtlayın.', 'info', 5000);
    return;
  }

  // Ses: dönem geçiş sesi
  playSound('semester_change');

  // Otomatik kayıt
  const safeStateForAuto = sanitizeForSave ? sanitizeForSave(state) : state;
  autoSave(safeStateForAuto);

  // v0.2: Yeni başarımları bildir
  if (summary?.newAchievements?.length > 0) {
    for (const ach of summary.newAchievements) {
      showAchievementNotification(ach);
      playSound('achievement');
    }
  }

  // Tamamlanan inşaatları kontrol et
  if (summary?.events?.some(e => e.type === 'construction_complete')) {
    playSound('build_complete');
  }

  // v0.2: Bekleyen rastgele olaylar varsa işle
  if (summary?.pendingRandomEvents?.length > 0) {
    console.log('[main] Bekleyen rastgele olaylar:', summary.pendingRandomEvents.length);
    _processNextRandomEvent(summary.pendingRandomEvents, 0, () => {
      _continueAfterEvents(summary, state);
    });
    return;
  }

  _continueAfterEvents(summary, state);
}

function _continueAfterEvents(summary, state) {
  // Eğer tur sonu olayı varsa → olay ekranı göster
  if (summary?.event) {
    console.log('[main] Tur olayı tespit edildi:', summary.event?.id);
    _showTurnEvent(summary.event);
  }

  // Tur özetini göster
  if (summary) {
    renderTurnSummary(summary, () => {
      console.log('[main] Özet kapatıldı, UI yenileniyor.');
      hideModal();
      refreshGameUI();
    });
    const panel = el('tab-dashboard');
    if (panel) {
      showModal('Dönem Özeti', panel.innerHTML);
    }
  }

  refreshGameUI();
  console.log(`[main] Tur tamamlandı → Tur ${state?.meta?.turn}`);

  // Oyun kazanıldıysa kutlama ekranını göster
  if (summary?.gameWon) {
    setTimeout(() => {
      const winReason = summary?.reason || null;
      showGameWonModal(
        state,
        winReason,
        calculateScore,
        scoreBreakdown,
        () => _showLeaderboardSubmitModal(true),
      );
    }, 800);
    return;
  }

  // Oyun bittiyse (gameOver) skor gönderme modal'ını tetikle
  if (summary?.gameOver) {
    setTimeout(() => _showLeaderboardSubmitModal(true), 1200);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LEADERBOARD — SKOR GÖNDERME MODAL'I
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Skor gönderme modal'ını açar.
 * @param {boolean} isGameOver Oyun sonu tetiklemesiyse true (başlık farklılaşır)
 */
function _showLeaderboardSubmitModal(isGameOver = false) {
  const state = getState();
  if (!state) {
    showNotification('Önce bir oyun başlatmalısın.', 'warning');
    return;
  }

  // Bu oyundan skor zaten gönderildi mi? (Mükerrer kayıt önleme — R-Fatih raporu)
  const alreadySubmitted = !!state.meta?.scoreSubmitted;
  const submittedAt      = state.meta?.scoreSubmittedAt;
  const submittedName    = state.meta?.scoreSubmittedName;
  const submittedScore   = state.meta?.scoreSubmittedScore;

  const score     = calculateScore(state);
  const breakdown = scoreBreakdown(state);
  const heading   = isGameOver ? '🎓 Oyun Bitti!' : '🏆 Skorunu Gönder';

  const breakdownHtml = breakdown
    .map(line => `<li style="font-size:12px;color:var(--text-muted,#aaa);margin:2px 0;">${line}</li>`)
    .join('');

  const submittedDateStr = submittedAt
    ? new Date(submittedAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
    : '';
  const alreadyBanner = alreadySubmitted
    ? `<div style="background:rgba(245,166,35,0.1);border:1px solid rgba(245,166,35,0.3);
                  padding:12px;border-radius:8px;font-size:13px;line-height:1.5;">
         ✅ Bu oyun için skor zaten gönderildi.<br>
         <span style="color:var(--text-muted,#aaa);font-size:12px;">
           ${submittedName ? `<strong>${submittedName}</strong> — ` : ''}${submittedScore != null ? `${submittedScore.toLocaleString('tr-TR')} puan` : ''}${submittedDateStr ? ` · ${submittedDateStr}` : ''}
         </span><br>
         <span style="color:var(--text-muted,#aaa);font-size:12px;">
           Yeni bir kayıt için yeni bir oyun başlatman gerekiyor.
         </span>
       </div>`
    : '';

  const bodyHtml = `
    <div style="display:flex;flex-direction:column;gap:16px;padding:4px 0;">
      ${alreadyBanner}
      <p style="margin:0;font-size:14px;line-height:1.5;">
        ${alreadySubmitted
          ? 'Aşağıda bu oyunun puanı görünüyor. Yeni gönderim yapılamaz.'
          : 'Skorunu küresel skor tablosuna ekle. İsim girip <strong>Gönder</strong>\'e bas.'}
      </p>
      <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:14px;">
        <div style="font-size:28px;font-weight:700;text-align:center;color:var(--accent,#5dd6c0);">
          ${score.toLocaleString('tr-TR')} puan
        </div>
        <ul style="margin:10px 0 0;padding-left:18px;">
          ${breakdownHtml}
        </ul>
      </div>
      <div>
        <label style="font-size:12px;color:var(--text-muted,#aaa);display:block;margin-bottom:6px;">
          Adın (1-30 karakter)
        </label>
        <input
          id="lb-name-input"
          type="text"
          maxlength="30"
          placeholder="Anonim Rektör"
          value="${state.meta?.playerName ? state.meta.playerName.slice(0, 30) : ''}"
          ${alreadySubmitted ? 'disabled' : ''}
          style="width:100%;box-sizing:border-box;padding:9px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:inherit;font-size:14px;${alreadySubmitted ? 'opacity:0.5;cursor:not-allowed;' : ''}"
        />
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button id="lb-cancel-btn" class="btn btn-ghost btn-sm">${alreadySubmitted ? '✖️ Kapat' : '❌ Vazgeç'}</button>
        <button id="lb-submit-btn" class="btn btn-primary btn-sm" ${alreadySubmitted ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
          ${alreadySubmitted ? '✅ Gönderildi' : '🏆 Gönder'}
        </button>
      </div>
      <div id="lb-submit-status" style="font-size:12px;color:var(--text-muted,#aaa);min-height:16px;"></div>
    </div>`;

  showModal(heading, bodyHtml);

  // Buton handler'ları
  document.getElementById('lb-cancel-btn')?.addEventListener('click', () => {
    hideModal();
  });

  document.getElementById('lb-submit-btn')?.addEventListener('click', async () => {
    const nameInput = document.getElementById('lb-name-input');
    const statusEl  = document.getElementById('lb-submit-status');
    const submitBtn = document.getElementById('lb-submit-btn');
    const name = (nameInput?.value?.trim() || 'Anonim Rektör').slice(0, 30) || 'Anonim Rektör';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ Gönderiliyor…';
    }
    if (statusEl) statusEl.textContent = 'Firebase bağlantısı kuruluyor…';

    try {
      await initFirebase();
      if (statusEl) statusEl.textContent = 'Skor yükleniyor…';
      const result = await submitScore(name, state);

      // Mükerrer kayıt önleme: bu oyun için skor gönderildiğini state'e işaretle.
      // autoSave ile localStorage'a yazılır; sayfa yenilense de korunur.
      const liveState = getState();
      if (liveState?.meta) {
        liveState.meta.scoreSubmitted      = true;
        liveState.meta.scoreSubmittedAt    = Date.now();
        liveState.meta.scoreSubmittedName  = name;
        liveState.meta.scoreSubmittedScore = score;
        const safe = sanitizeForSave ? sanitizeForSave(liveState) : liveState;
        autoSave(safe);
      }

      hideModal();

      // Skor sonucunu kullanıcıya net göster (R-Fatih önerisi v0.4.27):
      // leaderboard'da kullanıcı başına yalnızca en iyi skor tutulur.
      const fmt = (n) => Number(n).toLocaleString('tr-TR');
      if (result?.status === 'updated') {
        showNotification(
          `🏆 ${name} — ${fmt(result.score)} puan! En iyi skorun güncellendi (eski: ${fmt(result.oldScore)}).`,
          'success', 6000,
        );
      } else if (result?.status === 'not-improved') {
        showNotification(
          `📊 ${fmt(result.score)} puan aldın. Küresel en iyi skorun ${fmt(result.oldScore)} — leaderboard güncellenmedi.`,
          'info', 6000,
        );
      } else {
        // 'created' veya legacy
        showNotification(`🏆 ${name} — ${fmt(result?.score ?? score)} puan kaydedildi!`, 'success', 5000);
      }

      // Leaderboard sekmesine geç ve yenile
      _activeTab = 'leaderboard';
      const lbTab = document.querySelector('[data-tab="leaderboard"]');
      if (lbTab) {
        document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
        lbTab.classList.add('active');
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        const panel = document.getElementById('tab-leaderboard');
        if (panel) panel.classList.add('active');
      }
      renderLeaderboardPanel(getTopScores).catch(() => {});

    } catch (err) {
      console.error('[main] Skor gönderme hatası:', err);

      // Çevrimiçi tablo bakımdaysa skoru lokal yedekle, modal'ı kapat ve kullanıcıyı rezil etme
      if (isLeaderboardUnavailable(err)) {
        saveLocalScore({ name, score, year: state?.meta?.year, prestige: state?.university?.prestige });
        hideModal();
        showNotification(
          `🏆 ${name} — ${score.toLocaleString('tr-TR')} puan kaydedildi. (Çevrimiçi tablo geçici olarak bakımda; skor lokal yedeklendi.)`,
          'info',
          6000,
        );
        return;
      }

      if (statusEl) statusEl.textContent = '⚠️ ' + (err.message || 'Bağlantı hatası oluştu.');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '🏆 Tekrar Dene';
      }
    }
  });
}

/**
 * v0.2: Rastgele olayları sırayla göster.
 */
function _processNextRandomEvent(events, index, onAllDone) {
  if (index >= events.length) {
    onAllDone();
    return;
  }

  const event = events[index];
  console.log(`[main] Rastgele olay gösteriliyor (${index + 1}/${events.length}):`, event.id);
  playSound('event_popup');

  renderRandomEventModal(event, (choiceIndex) => {
    // applyDecision çağrısı game.js içindeki _state'e doğrudan etki eder
    const result = applyDecision({ type: 'apply_random_event', eventId: event.id, choiceIndex });
    if (result?.success && result?.effects) {
      const effects = result.effects;
      const parts = [];
      if (effects.budgetDelta) parts.push(`Kasa ${effects.budgetDelta > 0 ? '+' : ''}${(effects.budgetDelta/1e6).toFixed(1)}M ₺`);
      if (effects.prestigeDelta) parts.push(`Saygınlık ${effects.prestigeDelta > 0 ? '+' : ''}${effects.prestigeDelta}`);
      if (effects.satisfactionDelta) parts.push(`Memnuniyet ${effects.satisfactionDelta > 0 ? '+' : ''}${effects.satisfactionDelta}`);
      if (parts.length > 0) showNotification(parts.join(', '), effects.budgetDelta >= 0 ? 'info' : 'warning');
    }
    hideModal();
    // Sonraki olaya geç
    _processNextRandomEvent(events, index + 1, onAllDone);
  });
}

/**
 * v0.2: Alumni etkinliği düzenle.
 */
function _onAlumniEvent(type) {
  const result = applyDecision({ type: 'organize_alumni_event', eventType: type });
  if (result?.success) {
    showNotification(result.message, 'success');
    _persistState();
  } else {
    showNotification(result?.message || 'İşlem başarısız.', 'danger');
  }
  refreshGameUI();
}

// ─────────────────────────────────────────────────────────────────────────────
// OLAY SİSTEMİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tur sonu olayını göster.
 * @param {object} event — Olay verisi
 */
function _showTurnEvent(event) {
  console.log('[main] Olay gösteriliyor:', event?.id, event?.title);

  renderEvent(
    event,
    (choiceIndex) => {
      console.log(`[main] Olay seçimi yapıldı: olay=${event.id}, seçenek=${choiceIndex}`);
      _onEventChoice(event.id, choiceIndex);
    },
    () => {
      console.log('[main] Olay atlandı.');
      hideModal();
      refreshGameUI();
    },
  );
}

/**
 * Olay seçeneğine tıklandığında çalışır.
 * @param {string} eventId     — Olay ID'si
 * @param {number} choiceIndex — Seçenek indeksi
 */
function _onEventChoice(eventId, choiceIndex) {
  const state = getState();

  resolveDecision(state, eventId, choiceIndex);
  console.log(`[main] resolveDecision() çağrıldı → eventId=${eventId}, choiceIndex=${choiceIndex}`);

  hideModal();
  refreshGameUI();
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSFER PAZARI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transfer pazarı butonuna basıldığında çalışır.
 */
function _onOpenTransferMarket() {
  const state = getState();
  if (!state) return;

  console.log('[main] Transfer pazarı açılıyor...');

  if (!_transferMarket) {
    _transferMarket = generateTransferMarket(state);
    console.log('[main] generateTransferMarket() çağrıldı, aday sayısı:', _transferMarket?.candidates?.length ?? 0);
  }

  renderTransferMarket(
    state,
    _transferMarket,
    (facultyId, offer) => {
      console.log('[main] Transfer teklifi gönderildi, hoca:', facultyId, 'teklif:', offer);
      _onHireOffer(facultyId, offer);
    },
  );
}

/**
 * Transfer teklifini işle.
 * @param {string} facultyId — Transfer pazarındaki hoca ID'si
 * @param {object} offer — { salary, researchFund, labQuality, titlePromise }
 */
function _onHireOffer(facultyId, offerOrObj) {
  // ui.js'den gelen çağrı: onOffer(selectedFacultyId, offer)
  // ancak eski çağrı şekli: onOffer(offer) ile de uyumlu ol
  let fid, offer;
  if (typeof facultyId === 'string') {
    fid   = facultyId;
    offer = offerOrObj || {};
  } else {
    // Eski şekil: tek argüman, offer objesi içinde facultyId var
    offer = facultyId || {};
    fid   = offer.facultyId;
  }

  console.log('[main] Transfer teklifi işleniyor, hoca ID:', fid, 'teklif:', offer);

  // Hocayı transfer pazarında bul
  const market = Array.isArray(_transferMarket) ? _transferMarket : (_transferMarket?.candidates || []);
  const fac = market.find(f => f.id === fid);

  if (!fac) {
    showNotification('Hoca transfer pazarında bulunamadı.', 'danger');
    console.warn('[main] Hoca bulunamadı:', fid, 'market:', market.map(f => f.id));
    return;
  }

  const state = getState();
  const depts = (state?.departments || []);
  // Hocayı uygun bölüme ata (kendi bölümü veya ilk açık bölüm)
  const targetDept = depts.find(d => d.id === fac.department && d.isOpen)
    || depts.find(d => d.isOpen);

  if (!targetDept) {
    showNotification('Hocayı atamak için açık bölüm bulunamadı.', 'danger');
    return;
  }

  // applyDecision'ın beklediği facultyData formatını oluştur
  const facultyData = {
    ...fac,
    departmentId: targetDept.id,
    salary: offer.salary || fac.askingSalary || fac.salary,
  };

  const result = applyDecision({ type: 'hire_faculty', facultyData });
  _transferMarket = null; // Pazarı sıfırla (bir sonraki açılışta yenilensin)

  if (result && result.success) {
    showNotification(`${fac.name} kadromuza katıldı!`, 'success');
    _persistState();
  } else {
    showNotification(result?.message || 'İşe alma başarısız.', 'danger');
  }
  refreshGameUI();
}

// ─────────────────────────────────────────────────────────────────────────────
// KADRO İLANI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kadro ilanı modalını aç.
 */
function _onOpenPositionModal() {
  const state = getState();
  if (!state) return;
  renderOpenPositionModal(state, _onSubmitOpenPosition);
}

/**
 * İlan formunu gönder: state'e ekle, bildirim ver.
 * @param {object} position — İlan objesi
 */
function _onSubmitOpenPosition(position) {
  const result = applyDecision({ type: 'post_open_position', position });
  if (result && result.success) {
    const alanLabel = position.allFields
      ? 'Tüm alanlarda'
      : (Array.isArray(position.fields) && position.fields.length > 0
          ? position.fields.join(', ') + ' alanında'
          : (position.field ? position.field + ' alanında' : 'Belirtilen alanda'));
    showNotification(`${alanLabel} kadro ilanı verildi!`, 'success');
    _persistState();
  } else {
    showNotification(result?.message || 'İlan verilemedi.', 'danger');
  }
  refreshGameUI();
}

/**
 * Başvuru kabul / ret butonlarına event listener bağla.
 */
function _bindApplicantButtons() {
  const panel = document.getElementById('tab-faculty');
  if (!panel) return;
  // Remove previous listener to avoid duplicates (using once-flag approach)
  panel.removeEventListener('accept-applicant', _handleAcceptApplicant);
  panel.removeEventListener('reject-applicant', _handleRejectApplicant);
  panel.removeEventListener('accept-spontaneous', _handleAcceptSpontaneous);
  panel.removeEventListener('reject-spontaneous', _handleRejectSpontaneous);
  panel.addEventListener('accept-applicant', _handleAcceptApplicant);
  panel.addEventListener('reject-applicant', _handleRejectApplicant);
  panel.addEventListener('accept-spontaneous', _handleAcceptSpontaneous);
  panel.addEventListener('reject-spontaneous', _handleRejectSpontaneous);

  // Feature 2: Yeni bölüm/program başvurusu (modal overlay'den gelir)
  document.removeEventListener('apply-new-dept', _handleApplyNewDept);
  document.addEventListener('apply-new-dept', _handleApplyNewDept);
}

function _handleApplyNewDept(e) {
  const { type: appType, deptId, requestedQuota } = e.detail || {};
  if (!appType || !deptId) return;
  const result = applyDecision({ type: 'apply_new_program', appType, deptId, requestedQuota });
  if (result && result.success) {
    showNotification(result.message, 'success');
    hideModal();
    _persistState();
    refreshGameUI();
  } else {
    showNotification(result?.message || 'Başvuru gönderilemedi.', 'danger');
  }
}

function _handleAcceptApplicant(e) {
  const appId = e.detail?.appId;
  if (!appId) return;
  const result = applyDecision({ type: 'accept_applicant', applicantId: appId });
  if (result && result.success) {
    showNotification(result.message || 'Başvurucu işe alındı!', 'success');
    _persistState();
  } else {
    showNotification(result?.message || 'İşe alma başarısız.', 'danger');
  }
  refreshGameUI();
}

function _handleRejectApplicant(e) {
  const appId = e.detail?.appId;
  if (!appId) return;
  applyDecision({ type: 'reject_applicant', applicantId: appId });
  showNotification('Başvuru reddedildi.', 'info');
  _persistState();
  refreshGameUI();
}

function _handleAcceptSpontaneous(e) {
  const { appId, targetDeptId } = e.detail || {};
  if (!appId) return;
  const result = applyDecision({ type: 'accept_spontaneous', applicantId: appId, targetDeptId });
  if (result && result.success) {
    showNotification(result.message || 'Spontane başvurucu işe alındı!', 'success');
    _persistState();
  } else {
    showNotification(result?.message || 'İşe alma başarısız.', 'danger');
  }
  refreshGameUI();
}

function _handleRejectSpontaneous(e) {
  const appId = e.detail?.appId;
  if (!appId) return;
  applyDecision({ type: 'reject_spontaneous', applicantId: appId });
  showNotification('Spontane başvuru reddedildi.', 'info');
  _persistState();
  refreshGameUI();
}

/**
 * Hoca detay görünümü.
 * @param {string} facultyId — Hoca ID'si
 */
function _onFacultyDetail(facultyId) {
  const state = getState();
  const f = (state?.faculty || []).find(m => m.id === facultyId);
  if (!f) {
    console.warn(`[main] Hoca bulunamadı: ${facultyId}`);
    return;
  }

  const titleMap = { argö: 'Araştırma Görevlisi', dr_ogr_uyesi: 'Dr. Öğr. Üyesi', docent: 'Doçent', profesor: 'Profesör' };
  const depts = state.departments || [];
  const dept = depts.find(d => d.id === f.department);
  const deptName = dept ? dept.name : (f.department || '—');
  const titleLabel = titleMap[f.title] || f.title || '—';

  const stats = f.stats || {};
  const statList = [
    { label: 'Araştırma',   value: stats.research   ?? 0 },
    { label: 'Öğretim',     value: stats.teaching   ?? 0 },
    { label: 'Yönetim',     value: stats.management ?? 0 },
    { label: 'Rehberlik',   value: stats.mentoring  ?? 0 },
    { label: 'Popülarite',  value: stats.popularity ?? 0 },
  ];

  const statBars = statList.map(s => {
    const pct = Math.min(100, Math.max(0, s.value));
    const color = pct >= 70 ? '#4caf50' : pct >= 40 ? '#ff9800' : '#e94560';
    return `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
          <span style="font-size:13px;color:var(--text-muted)">${s.label}</span>
          <span style="font-size:13px;font-weight:600">${pct}</span>
        </div>
        <div style="background:var(--bg-tertiary);border-radius:4px;height:8px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${color};border-radius:4px;transition:width .3s;"></div>
        </div>
      </div>`;
  }).join('');

  const happiness = f.happiness ?? 60;
  const happinessColor = happiness >= 70 ? '#4caf50' : happiness >= 40 ? '#ff9800' : '#e94560';
  const courseLoad = f.currentLoad?.courses ?? 0;

  const fmt = v => v?.toLocaleString('tr-TR') ?? '—';

  const assignedCourses = f.currentLoad?.assignedCourses || [];
  const specializations = f.specializations || [];

  const matchIcon  = q => q === 2 ? '✓' : q === 1 ? '~' : '✗';
  const matchColor = q => q === 2 ? '#4caf50' : q === 1 ? '#ff9800' : '#e94560';
  const matchLabel = q => q === 2 ? 'Tam eşleşme' : q === 1 ? 'Kısmi eşleşme' : 'Eşleşme yok';

  // Maaş baremi bilgisi
  const salaryRange = f.salaryRange || {};
  const salaryMin  = salaryRange.min || 20000;
  const salaryMax  = salaryRange.max || 80000;
  const salaryMid  = Math.round((salaryMin + salaryMax) / 2);
  const currentSalary = f.salary || salaryMid;
  const salaryPct  = Math.round(Math.min(100, Math.max(0, (currentSalary - salaryMin) / (salaryMax - salaryMin) * 100)));

  // Yayın / terfi bilgisi
  const pubs = f.publications || 0;
  const cits = f.citations || 0;
  const expYrs = f.yearsExperience || 0;

  let promotionTarget = null;
  let promotionReqs   = null;
  if (f.title === 'dr_ogr_uyesi') {
    promotionTarget = 'Doçent';
    promotionReqs   = { pubs: 40, cits: 200, exp: 10, curPubs: pubs, curCits: cits, curExp: expYrs };
  } else if (f.title === 'docent') {
    promotionTarget = 'Profesör';
    promotionReqs   = { pubs: 80, cits: 500, exp: 15, curPubs: pubs, curCits: cits, curExp: expYrs };
  }

  // Bölüm başkanı mı?
  const isDeptHead = state.departments?.some(d => d.headId === f.id);

  // Ödül geçmişi
  const awardHistory = f.awardHistory || [];

  // Genel puan ve trend
  const overallRating  = calculateOverallRating(f);
  const ratingColor    = overallRating >= 85 ? '#d4af37' : overallRating >= 70 ? '#38a169' : overallRating >= 55 ? '#f5a623' : '#e53e3e';
  const ratingBg       = overallRating >= 85 ? 'rgba(212,175,55,0.12)' : overallRating >= 70 ? 'rgba(56,161,105,0.12)' : overallRating >= 55 ? 'rgba(245,166,35,0.12)' : 'rgba(229,62,62,0.12)';
  const trendInfo      = getFacultyRatingTrend(f);
  const trendHtml      = trendInfo.trend !== 'stable'
    ? `<span style="font-size:13px;color:${trendInfo.color};margin-left:4px;">${trendInfo.arrow}</span>`
    : '';

  // Cinsiyet
  const genderLabel = (f.avatar?.gender === 'male') ? 'Erkek' : (f.avatar?.gender === 'female') ? 'Kadın' : null;
  const ageLine = [
    genderLabel,
    f.age ? `${f.age} yaş` : null,
    expYrs ? `${expYrs} yıl deneyim` : null,
  ].filter(Boolean).join(' · ');

  const body = `
    <div style="display:flex;gap:16px;align-items:center;margin-bottom:18px;">
      <div style="flex-shrink:0;">${renderFacultyAvatar(f.avatar, 64)}</div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-size:17px;font-weight:700">${f.name || '—'}</span>
          <div style="display:flex;align-items:center;padding:3px 10px;border-radius:20px;background:${ratingBg};border:1px solid ${ratingColor};flex-shrink:0;">
            <span style="font-size:16px;font-weight:800;color:${ratingColor};line-height:1;">${overallRating}</span>
            ${trendHtml}
          </div>
        </div>
        <div style="font-size:13px;color:var(--text-muted);margin-top:2px;">${titleLabel} · ${deptName}</div>
        ${ageLine ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${ageLine}</div>` : ''}
        ${isDeptHead ? `<div style="font-size:11px;margin-top:3px;padding:2px 8px;background:rgba(245,166,35,0.15);color:#f5a623;border-radius:4px;display:inline-block;">Bölüm Başkanı</div>` : ''}
      </div>
    </div>

    <!-- Akademik istatistikler: yayın/atıf -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;">
      <div style="background:var(--bg-tertiary);border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:18px;font-weight:700;color:#3182ce;">${pubs}</div>
        <div style="font-size:10px;color:var(--text-muted);">Yayın</div>
      </div>
      <div style="background:var(--bg-tertiary);border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:18px;font-weight:700;color:#805ad5;">${cits}</div>
        <div style="font-size:10px;color:var(--text-muted);">Atıf</div>
      </div>
      <div style="background:var(--bg-tertiary);border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:18px;font-weight:700;color:#38a169;">${f.hIndex || 0}</div>
        <div style="font-size:10px;color:var(--text-muted);">h-indeks</div>
      </div>
    </div>

    <!-- Uzmanlık alanları -->
    ${specializations.length > 0 ? `
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin-bottom:8px;">Uzmanlık Alanları</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">
        ${specializations.map(s => `
          <span style="font-size:11px;padding:3px 8px;border-radius:12px;background:rgba(56,161,105,0.12);color:#38a169;border:1px solid rgba(56,161,105,0.3);font-weight:600;">
            ${s}
          </span>
        `).join('')}
      </div>
    ` : ''}

    <hr style="border:none;border-top:1px solid var(--border-color);margin:0 0 16px;">
    <div style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin-bottom:10px;">İstatistikler</div>
    ${statBars}
    <hr style="border:none;border-top:1px solid var(--border-color);margin:16px 0;">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
      <div style="background:var(--bg-tertiary);border-radius:8px;padding:12px;">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Mutluluk</div>
        <div style="font-size:20px;font-weight:700;color:${happinessColor}">${happiness}<span style="font-size:13px;font-weight:400">/100</span></div>
      </div>
      <div style="background:var(--bg-tertiary);border-radius:8px;padding:12px;">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Ders Yükü</div>
        <div style="font-size:20px;font-weight:700">${courseLoad}<span style="font-size:13px;font-weight:400"> ders</span></div>
      </div>
      <div style="background:var(--bg-tertiary);border-radius:8px;padding:12px;grid-column:1/-1;">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Maaş</div>
        <div style="font-size:18px;font-weight:700;">₺${fmt(f.salary)}<span style="font-size:13px;font-weight:400">/ay</span></div>
        ${f.salaryRange ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Barem: ${salaryMin.toLocaleString('tr-TR')} – ${salaryMax.toLocaleString('tr-TR')} ₺</div>` : ''}
        ${f.seniority ? `<div style="font-size:11px;color:var(--text-muted);">Kıdem: ${f.seniority} yıl</div>` : ''}
        ${f._salaryUnhappy ? `<div style="font-size:11px;color:#e53e3e;margin-top:3px;">⚠ Maaş memnuniyetsizliği</div>` : ''}
      </div>
    </div>

    <!-- Atanmış dersler -->
    <div style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin-bottom:8px;">
      Atanmış Dersler (${assignedCourses.length})
    </div>
    ${assignedCourses.length === 0 ? `
      <div style="font-size:13px;color:var(--text-faint);padding:8px;background:var(--bg-tertiary);border-radius:8px;">
        Bu dönem atanmış ders yok.
      </div>
    ` : `
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${assignedCourses.map(c => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg-tertiary);border-radius:8px;border-left:3px solid ${matchColor(c.matchQuality)};">
            <span style="font-size:16px;font-weight:700;color:${matchColor(c.matchQuality)};">${matchIcon(c.matchQuality)}</span>
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:600;">${c.courseName}</div>
              <div style="font-size:11px;color:var(--text-muted);">${matchLabel(c.matchQuality)} · ${c.type === 'zorunlu' ? 'Zorunlu' : 'Seçmeli'}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `}

    <hr style="border:none;border-top:1px solid var(--border-color);margin:20px 0 14px;">

    <!-- HOCA YÖNETİMİ -->
    <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin-bottom:14px;padding:8px 12px;background:var(--bg-tertiary);border-radius:6px;text-align:center;">
      HOCA YÖNETİMİ
    </div>

    <!-- Maaş Ayarlama -->
    <div style="background:var(--bg-tertiary);border-radius:8px;padding:14px;margin-bottom:12px;">
      <div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:10px;">💰 Maaş Ayarlama</div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">
        Mevcut: <strong>₺${fmt(currentSalary)}/ay</strong>
        &nbsp;·&nbsp; Barem: ₺${salaryMin.toLocaleString('tr-TR')} – ₺${salaryMax.toLocaleString('tr-TR')}
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <input type="range" id="salary-slider-${f.id}"
               min="${salaryMin}" max="${salaryMax}" step="1000"
               value="${currentSalary}"
               style="flex:1;cursor:pointer;"
               oninput="document.getElementById('salary-display-${f.id}').textContent='₺'+(+this.value).toLocaleString('tr-TR')+'/ay'; document.getElementById('salary-cost-${f.id}').textContent='Yıllık ek maliyet: ₺'+(((+this.value)-${currentSalary})*12).toLocaleString('tr-TR');">
        <span id="salary-display-${f.id}" style="font-size:13px;font-weight:700;color:#f5a623;white-space:nowrap;min-width:110px;">₺${fmt(currentSalary)}/ay</span>
      </div>
      <div id="salary-cost-${f.id}" style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">Yıllık ek maliyet: ₺0</div>
      <button class="btn btn-primary" id="btn-update-salary-${f.id}" style="font-size:12px;width:100%;justify-content:center;"
              data-faculty-id="${f.id}">
        Maaşı Güncelle
      </button>
    </div>

    <!-- Ödüller -->
    <div style="background:var(--bg-tertiary);border-radius:8px;padding:14px;margin-bottom:12px;">
      <div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:10px;">🏆 Ödüller</div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        <button class="btn btn-secondary" id="btn-award-arastirma-${f.id}" data-faculty-id="${f.id}" data-award="arastirma"
                style="font-size:11px;justify-content:space-between;">
          <span>Araştırma Ödülü</span>
          <span style="color:var(--text-muted);">+5 moral &nbsp;·&nbsp; 50.000 ₺ prim</span>
        </button>
        <button class="btn btn-secondary" id="btn-award-egitim-${f.id}" data-faculty-id="${f.id}" data-award="egitim"
                style="font-size:11px;justify-content:space-between;">
          <span>Eğitim Ödülü</span>
          <span style="color:var(--text-muted);">+5 moral &nbsp;·&nbsp; 30.000 ₺ prim</span>
        </button>
        <button class="btn btn-secondary" id="btn-award-yilin-${f.id}" data-faculty-id="${f.id}" data-award="yilin"
                style="font-size:11px;justify-content:space-between;">
          <span>Yılın Hocası</span>
          <span style="color:var(--text-muted);">+10 moral &nbsp;·&nbsp; +3 saygınlık &nbsp;·&nbsp; 100.000 ₺ prim</span>
        </button>
      </div>
      ${awardHistory.length > 0 ? `
        <div style="margin-top:8px;font-size:10px;color:var(--text-muted);">
          Geçmiş ödüller: ${awardHistory.map(a => a.label).join(', ')}
        </div>
      ` : ''}
    </div>

    <!-- Unvan Yükseltme -->
    ${promotionTarget ? `
    <div style="background:var(--bg-tertiary);border-radius:8px;padding:14px;margin-bottom:12px;">
      <div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:10px;">📋 Unvan Yükseltme</div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">
        ${titleLabel} → ${promotionTarget}
      </div>
      ${['pubs', 'cits', 'exp'].map(key => {
        const labels = { pubs: 'Yayın', cits: 'Atıf', exp: 'Deneyim (yıl)' };
        const cur   = promotionReqs['cur' + key.charAt(0).toUpperCase() + key.slice(1)];
        const req   = promotionReqs[key];
        const pct   = Math.min(100, Math.round(cur / req * 100));
        const color = pct >= 100 ? '#38a169' : pct >= 70 ? '#f5a623' : 'var(--text-muted)';
        return `
          <div style="margin-bottom:6px;">
            <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-bottom:2px;">
              <span>${labels[key]}</span>
              <span style="color:${color};">${cur}/${req} ${pct>=100?'✓':''}</span>
            </div>
            <div style="height:4px;background:var(--bg-secondary);border-radius:2px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:${color};border-radius:2px;"></div>
            </div>
          </div>`;
      }).join('')}
      ${f.promotionEligible ? `
        <button class="btn btn-success" id="btn-promote-${f.id}" data-faculty-id="${f.id}"
                style="font-size:12px;width:100%;justify-content:center;margin-top:6px;">
          Yükselt: ${promotionTarget}
        </button>
      ` : `
        <div style="font-size:11px;color:var(--text-muted);margin-top:6px;padding:6px;background:var(--bg-secondary);border-radius:4px;">
          Kriterler henüz karşılanmadı
        </div>
      `}
    </div>
    ` : (f.title === 'profesor' ? `
    <div style="background:var(--bg-tertiary);border-radius:8px;padding:10px;margin-bottom:12px;font-size:11px;color:var(--text-muted);">
      Profesör — En yüksek akademik unvan
    </div>
    ` : '')}

    <!-- Sözleşme Feshi -->
    <div style="background:rgba(229,62,62,0.05);border:1px solid rgba(229,62,62,0.2);border-radius:8px;padding:14px;margin-bottom:4px;">
      <div style="font-size:12px;font-weight:700;color:#e53e3e;margin-bottom:8px;">⚠ Sözleşme Feshi</div>
      ${isDeptHead ? `
        <div style="font-size:11px;color:var(--text-muted);padding:6px;background:var(--bg-tertiary);border-radius:4px;">
          Bu hoca bölüm başkanıdır. Sözleşmeyi feshetmek için önce başkanlık görevini sonlandırın.
        </div>
      ` : `
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">
          Kıdem tazminatı: <strong style="color:#e53e3e;">₺${(currentSalary * 3).toLocaleString('tr-TR')}</strong> (3 aylık maaş)
          &nbsp;·&nbsp; Etkilenen dersler: ${assignedCourses.length} ders
          &nbsp;·&nbsp; Moral etkisi: Bölüm -${happiness > 80 ? 8 : 5}, Üniversite -${happiness > 80 ? 3 : 1}
        </div>
        <button class="btn btn-danger" id="btn-fire-${f.id}" data-faculty-id="${f.id}"
                style="font-size:12px;width:100%;justify-content:center;">
          Sözleşmeyi Feshet
        </button>
      `}
    </div>
  `;

  showModal(f.name || 'Hoca Detayı', body);

  // Yönetim aksiyonları için event listener'lar (showModal sonrası DOM'da hazır olur)
  // Maaş güncelle
  const salaryBtn = document.getElementById(`btn-update-salary-${f.id}`);
  if (salaryBtn) {
    salaryBtn.addEventListener('click', () => {
      const slider = document.getElementById(`salary-slider-${f.id}`);
      if (!slider) return;
      const newSalary = parseInt(slider.value, 10);
      const result = applyDecision({ type: 'adjust_salary', facultyId: f.id, newSalary });
      if (result && result.success) {
        showNotification(result.message, 'success');
        hideModal();
        refreshGameUI();
      } else {
        showNotification(result?.message || 'Maaş güncellenemedi.', 'danger');
      }
    });
  }

  // Ödül ver butonları
  ['arastirma', 'egitim', 'yilin'].forEach(awardType => {
    const awardBtn = document.getElementById(`btn-award-${awardType}-${f.id}`);
    if (awardBtn) {
      awardBtn.addEventListener('click', () => {
        const result = applyDecision({ type: 'give_award', facultyId: f.id, awardType });
        if (result && result.success) {
          showNotification(result.message, 'success');
          hideModal();
          refreshGameUI();
        } else {
          showNotification(result?.message || 'Ödül verilemedi.', 'danger');
        }
      });
    }
  });

  // Yükselt butonu
  const promoteBtn = document.getElementById(`btn-promote-${f.id}`);
  if (promoteBtn) {
    promoteBtn.addEventListener('click', () => {
      const result = applyDecision({ type: 'promote_faculty', facultyId: f.id });
      if (result && result.success) {
        showNotification(result.message, 'success');
        hideModal();
        refreshGameUI();
      } else {
        showNotification(result?.message || 'Yükseltme yapılamadı.', 'danger');
      }
    });
  }

  // Sözleşme feshet butonu (Feature 4: rating değerlendirmeli)
  const fireBtn = document.getElementById(`btn-fire-${f.id}`);
  if (fireBtn) {
    fireBtn.addEventListener('click', () => {
      // Feature 4: Önceden rating değerlendirmesi göster
      const state = getState();
      const deptFaculty = (state.faculty || []).filter(fac =>
        fac.id !== f.id && (fac.department || fac.departmentId) === (f.department || f.departmentId)
      );
      const deptAvgRating = deptFaculty.length > 0
        ? Math.round(deptFaculty.reduce((s, fac) => s + calculateOverallRating(fac), 0) / deptFaculty.length)
        : 50;
      const firedRating = calculateOverallRating(f);

      let ratingAssessment = '';
      if (firedRating < deptAvgRating - 5) {
        ratingAssessment = '\n\nDEĞERLENDİRME: Düşük performanslı hoca → Bölüm morali artacak (+3)';
      } else if (firedRating > deptAvgRating + 15) {
        ratingAssessment = '\n\nDEĞERLENDİRME: Yüksek performanslı hoca → Bölüm morali düşecek (-8)';
      } else {
        ratingAssessment = '\n\nDEĞERLENDİRME: Ortalama hoca → Hafif moral etkisi (-3)';
      }

      if (!confirm(`${f.name} sözleşmesini feshetmek istediğinizden emin misiniz?\n\nKıdem tazminatı: ₺${(currentSalary * 3).toLocaleString('tr-TR')}\nHoca puanı: ${firedRating} | Bölüm ort.: ${deptAvgRating}${ratingAssessment}\n\nBu işlem geri alınamaz.`)) return;
      const result = applyDecision({ type: 'fire_faculty_confirmed', facultyId: f.id });
      if (result && result.success) {
        showNotification(result.message, 'success');
        hideModal();
        refreshGameUI();
      } else {
        showNotification(result?.message || 'Sözleşme fesih başarısız.', 'danger');
      }
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL CALLBACK'LERİ
// ─────────────────────────────────────────────────────────────────────────────

/** Kontenjan belirleme ekranını aç */
function _onOpenQuotaScreen() {
  const state = getState();
  if (!state) return;
  console.log('[main] Kontenjan belirleme ekranı açılıyor...');
  renderQuotaModal(state, (quotas) => {
    console.log('[main] Kontenjan onaylandı:', quotas);
    applyQuotas(quotas);
    _persistState();
    refreshGameUI();
  });
}

/** Yapı inşaatı başlat */
function _onBuildStart(buildingType) {
  console.log('[main] İnşaat başlatıldı:', buildingType);
  const result = applyDecision({ type: 'start_construction', buildingType });
  if (result?.success !== false) _persistState();
  refreshGameUI();
}

/** Kampüs karar callback (yükseltme, bölüm atama vb.) */
function _onCampusDecision(decision) {
  console.log('[main] Kampüs kararı:', decision);
  const result = applyDecision(decision);
  if (result && !result.success) {
    showNotification(result.message || 'İşlem başarısız.', 'danger');
    playSound('error');
  } else if (result && result.message) {
    showNotification(result.message, 'success');
    playSound('success');
    _persistState();
  }
  refreshGameUI();
}

/** Bütçe dağılımı değişikliği */
function _onAllocChange(allocation) {
  console.log('[main] Bütçe dağılımı değişikliği:', allocation);
  // Doğru aksiyon adı: 'set_budget_allocation', payload: { allocation: {...} }
  // (Eski sürümde 'budget_allocation' + spread ediliyordu, sessizce başarısız oluyordu — Yusuf raporu)
  const result = applyDecision({ type: 'set_budget_allocation', allocation });
  if (result && result.success === false) {
    showNotification(result.message || 'Bütçe dağılımı uygulanamadı.', 'warning');
    return;
  }
  _persistState();
  refreshGameUI();
}

/**
 * Kredi işlemi (kredi çekme / erken ödeme)
 * @param {object} decision — { type: 'take_loan' | 'repay_loan_early', ...params }
 * @returns {object} result — { success, message, ... }
 */
function _onLoanAction(decision) {
  console.log('[main] Kredi işlemi:', decision.type, decision);
  const result = applyDecision(decision);
  if (result && result.success) {
    _persistState();
    refreshGameUI();
  }
  return result;
}

// Budget sekmesini yenile (ui.js'ten çağrılabilir)
window._onBudgetTabRefresh = () => {
  const state = getState();
  if (state) renderBudgetPanel(state, _onAllocChange, _onLoanAction, _onTuitionChange, _onAidChange);
};

/** Harç (tuition) değişikliği — slider 'change' event'inden çağrılır */
function _onTuitionChange(amount) {
  console.log('[main] Harç değişikliği:', amount);
  const result = applyDecision({ type: 'set_tuition', amount });
  if (result && result.success !== false) {
    _persistState();
    refreshGameUI();
  }
  return result;
}

/** Financial aid (us_private) oranı değişikliği */
function _onAidChange(rate) {
  console.log('[main] Burs oranı değişikliği:', rate);
  const state = getState();
  if (state?.university) {
    state.university.financialAidRate = rate;
    refreshGameUI();
  }
  return { success: true };
}

/** Araştırma bütçesi değişikliği */
function _onResearchBudget(amount) {
  console.log('[main] Araştırma bütçesi değişikliği:', amount);
  applyDecision({ type: 'research_budget', amount });
  _persistState();
  refreshGameUI();
}

/**
 * Araştırma projesi kararı (onay / ret / BAP açma)
 * @param {string} decisionType — 'approve_project_application' | 'reject_project_application' | 'open_bap_call' | ...
 * @param {string|null} applicationId — İlgili başvuru id'si (open_bap_call için null)
 * @param {object} [extra] — Ek parametreler (open_bap_call için {totalBudget, maxPerProject, field})
 */
function _onProjectDecision(decisionType, applicationId, extra) {
  console.log('[main] Proje kararı:', decisionType, applicationId, extra);
  const payload = { type: decisionType, applicationId, ...extra };
  const result  = applyDecision(payload);
  if (result.success) {
    const msgType = (result.accepted === false) ? 'warning' : 'success';
    showNotification(result.message, msgType);
    _persistState();
    refreshGameUI();
  } else {
    showNotification(result.message || 'İşlem başarısız.', 'error');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BÖLÜM BAŞKANI ATAMA / HOCA TAŞIMA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bölüm başkanı atama callback.
 * @param {string} deptId    — Bölüm id
 * @param {string} facultyId — Hoca id
 */
function _onAssignDeptHead(deptId, facultyId) {
  console.log('[main] Bölüm başkanı atama:', deptId, facultyId);
  const result = assignDeptHead(deptId, facultyId);
  if (result.success) {
    showNotification(result.message, 'success');
    _persistState();
    refreshGameUI();
  } else {
    showNotification(result.message, 'warning');
  }
}

/**
 * Hoca bölüm değiştirme callback.
 * @param {string} facultyId  — Hoca id
 * @param {string} newDeptId  — Hedef bölüm id
 */
function _onReassignFaculty(facultyId, newDeptId) {
  console.log('[main] Hoca yeniden atama:', facultyId, '->', newDeptId);
  const result = reassignFacultyToDept(facultyId, newDeptId);
  if (result.success) {
    showNotification(result.message, 'success');
    if (result.warning) showNotification(result.warning, 'warning');
    _persistState();
    refreshGameUI();
  } else {
    showNotification(result.message, 'warning');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// KAYIT/YÜKLEME MODALLERİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kaydetme modalını göster.
 * Kullanıcı slot seçer, "Kaydet" butonuna basar.
 */
function _showSaveModal() {
  const state = getState();
  if (!state) {
    showNotification('Kaydedilecek oyun bulunamadı.', 'warning');
    return;
  }

  const slots    = getSaveSlots().filter(s => s.slotName !== 'autosave');
  const bodyHtml = `
    <div class="save-slots-list">
      ${slots.map(slot => `
        <div class="save-slot-row" data-slot="${slot.slotName}">
          <div class="save-slot-info">
            <div class="save-slot-label">${slot.label}</div>
            ${slot.isEmpty
              ? '<div class="save-slot-meta text-muted">Boş slot</div>'
              : `<div class="save-slot-meta">
                   ${slot.uniName} — ${slot.year}. Yıl, Tur ${slot.turn}
                   <span class="text-muted"> · ${_formatTimestamp(slot.timestamp)}</span>
                 </div>`
            }
          </div>
          <button class="btn btn-sm btn-primary save-slot-btn" data-slot="${slot.slotName}">
            Kaydet
          </button>
          ${!slot.isEmpty ? `
            <button class="btn btn-sm btn-danger delete-slot-btn" data-slot="${slot.slotName}"
                    title="Bu kaydı sil" style="margin-left:6px;">
              Sil
            </button>
          ` : ''}
        </div>
      `).join('')}
    </div>
    <hr style="margin:16px 0;">
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button class="btn btn-secondary" id="btn-export-save">JSON Olarak İndir</button>
    </div>
  `;

  showModal('Oyunu Kaydet', bodyHtml);

  // Slot kaydet butonları
  const modalBody = el('general-modal-body');
  if (!modalBody) return;

  modalBody.querySelectorAll('.save-slot-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const slotName = btn.dataset.slot;
      console.log(`[main] Kaydet butonuna basıldı → ${slotName}`);
      const rawState  = getState();
      const safeState = sanitizeForSave ? sanitizeForSave(rawState) : rawState;
      const ok = saveGame(safeState, slotName);
      if (ok) {
        showNotification('✅ Oyun kaydedildi.', 'success');
        hideModal();
      } else {
        showNotification('Kayıt başarısız.', 'error');
      }
    });
  });

  // Slot silme butonları
  modalBody.querySelectorAll('.delete-slot-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const slotName = btn.dataset.slot;
      console.log(`[main] Slot siliniyor → ${slotName}`);
      deleteSave(slotName);
      showNotification('Kayıt silindi.', 'info');
      _showSaveModal(); // Modalı yenile
    });
  });

  // Dışa aktar
  on(el('btn-export-save'), 'click', () => {
    console.log('[main] JSON dışa aktarma başlatılıyor...');
    const rawState  = getState();
    const safeState = sanitizeForSave ? sanitizeForSave(rawState) : rawState;
    exportSave(safeState);
  });
}

/**
 * Yükleme modalını göster.
 * Kayıt slotlarını listeler, seçilen slotu yükler.
 */
function _showLoadModal() {
  const slots    = getSaveSlots();
  const bodyHtml = `
    <div class="save-slots-list">
      ${slots.map(slot => `
        <div class="save-slot-row">
          <div class="save-slot-info">
            <div class="save-slot-label">${slot.label}</div>
            ${slot.isEmpty
              ? '<div class="save-slot-meta text-muted">Boş slot</div>'
              : `<div class="save-slot-meta">
                   ${slot.uniName} — ${slot.year}. Yıl, Tur ${slot.turn}
                   <span class="text-muted"> · ${_formatTimestamp(slot.timestamp)}</span>
                 </div>`
            }
          </div>
          ${!slot.isEmpty ? `
            <button class="btn btn-sm btn-primary load-slot-btn" data-slot="${slot.slotName}">
              Yükle
            </button>
          ` : '<span class="btn btn-sm btn-disabled" disabled>Boş</span>'}
        </div>
      `).join('')}
    </div>
    <hr style="margin:16px 0;">
    <div style="display:flex;gap:8px;align-items:center;justify-content:flex-end;">
      <label class="btn btn-secondary" style="cursor:pointer;">
        JSON'dan Yükle
        <input type="file" id="import-file-input" accept=".json"
               style="display:none;" />
      </label>
    </div>
  `;

  showModal('Oyun Yükle', bodyHtml);

  const modalBody = el('general-modal-body');
  if (!modalBody) return;

  // Slot yükleme butonları
  modalBody.querySelectorAll('.load-slot-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const slotName = btn.dataset.slot;
      console.log(`[main] Yükleme başlatılıyor → ${slotName}`);
      const state = loadGame(slotName);
      if (state) {
        hideModal();
        _applyLoadedState(state);
        showNotification('Oyun başarıyla yüklendi.', 'success');
      } else {
        showNotification('Yükleme başarısız.', 'error');
      }
    });
  });

  // JSON içe aktarma
  const fileInput = el('import-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      console.log(`[main] JSON dosyası seçildi: ${file.name}`);
      const reader = new FileReader();
      reader.onload = (ev) => {
        const state = importSave(ev.target.result);
        if (state) {
          hideModal();
          _applyLoadedState(state);
          showNotification('Kayıt başarıyla içe aktarıldı.', 'success');
        } else {
          showNotification('Geçersiz kayıt dosyası.', 'error');
        }
      };
      reader.readAsText(file);
    });
  }
}

/**
 * Yüklenen state'i oyuna uygula.
 * game.js'in setState() fonksiyonu ile state doğrudan uygulanır.
 * @param {object} state — Yüklenen oyun durumu
 */
function _applyLoadedState(state) {
  console.log('[main] Yüklenen state uygulanıyor:', state?.university?.name);

  const ok = setState(state);
  if (!ok) {
    showNotification('Oyun durumu uygulanamadı.', 'error');
    return;
  }

  _startGameWithState(state);
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI: save modülü fonksiyonları (direkt import)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * save.js fonksiyonlarını döndür (direkt import edilmiş referanslar).
 */
function _getSaveModule() {
  return { deleteSave, exportSave, importSave };
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI: Zaman damgası formatla
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Unix timestamp'ini Türkçe tarih/saat stringine çevir.
 * @param {number|null} timestamp
 * @returns {string}
 */
function _formatTimestamp(timestamp) {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString('tr-TR', {
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// İDARİ BİRİMLER HANDLER'LARI
// ─────────────────────────────────────────────────────────────────────────────

/** İdari birim personel alımı modalını aç */
function _onHireAdminStaff(unitId) {
  const defaultLevel = 'mid';
  const candidates = generateAdminCandidates(unitId, defaultLevel, 3);
  renderAdminHireModal(unitId, candidates, _onHireAdminCandidate, defaultLevel);
}

/** Adayı işe al (obje direkt alır, chosenTitle opsiyonel) */
function _onHireAdminCandidate(candidate, chosenTitle) {
  if (!candidate) return;
  hireAdminStaff(candidate, chosenTitle);
  hideModal();
  const title = chosenTitle || candidate.suggestedTitle || candidate.title || 'Uzman';
  showNotification(`${candidate.name}, ${title} olarak işe alındı.`, 'success');
  _persistState();
  refreshGameUI();
}

/** Birim yükselt */
function _onUpgradeAdminUnit(unitId) {
  const result = upgradeAdminUnit(unitId);
  if (result.success) {
    showNotification('Birim başarıyla yükseltildi!', 'success');
    _persistState();
    refreshGameUI();
  } else {
    showNotification(result.message || 'Yükseltme başarısız.', 'warning');
  }
}

/** Adayları yenile (modal içi) — seçili deneyim seviyesini korur */
function _onRefreshAdminCandidates(unitId) {
  const levelEl = document.getElementById('admin-hire-title');
  const level   = levelEl ? levelEl.value : 'mid';
  const candidates = generateAdminCandidates(unitId, level, 3);
  renderAdminHireModal(unitId, candidates, _onHireAdminCandidate, level);
}

// Global erişim (ui.js'teki onclick handler'ları için)
window._onHireAdminStaff          = _onHireAdminStaff;
window._onHireAdminCandidate      = _onHireAdminCandidate;
window._onHireAdminCandidateByIdx = (idx) => {
  const cache = window._adminCandidateCache || [];
  const candidate = cache[idx];
  if (!candidate) return;
  // Her adayın seçili rütbesini dropdown'dan oku
  const titleEl = document.getElementById(`admin-hire-chosentitle-${idx}`);
  const chosenTitle = titleEl ? titleEl.value : (candidate.suggestedTitle || 'Uzman');
  _onHireAdminCandidate(candidate, chosenTitle);
};
window._onUpgradeAdminUnit        = _onUpgradeAdminUnit;
window._onRefreshAdminCandidates  = _onRefreshAdminCandidates;

/** Rütbe dropdown değişince uyarı mesajı güncelle */
window._onAdminTitleSelectionChange = (idx, chosenTitle) => {
  const cache = window._adminCandidateCache || [];
  const c = cache[idx];
  if (!c) return;
  const TITLE_ORDER_H = ['Memur', 'Uzman', 'Şef', 'Müdür Yrd.', 'Müdür'];
  const sugT   = c.suggestedTitle || 'Uzman';
  const sugIdx = TITLE_ORDER_H.indexOf(sugT);
  const choIdx = TITLE_ORDER_H.indexOf(chosenTitle);

  const warnEl   = document.getElementById(`admin-hire-warning-${idx}`);
  const salaryEl = document.getElementById(`admin-hire-salary-${idx}`);
  const bar      = ADMIN_TITLES[chosenTitle] || { min: 14000, max: 50000 };
  const bareMid  = Math.round((bar.min + bar.max) / 2);

  if (!warnEl) return;
  if (choIdx > sugIdx) {
    warnEl.innerHTML = `<span style="color:#f5a623;">⚠ Önerinin üzerinde - maaş yükselebilir, ilk mutluluk düşük</span>`;
    if (salaryEl) salaryEl.textContent = `${bareMid.toLocaleString('tr-TR')} ₺/ay (tahmini)`;
  } else if (choIdx < sugIdx) {
    warnEl.innerHTML = `<span style="color:#e53e3e;">⚠ Önerinin altında - kişi memnun olmayabilir</span>`;
    if (salaryEl) salaryEl.textContent = `${(c.salaryExpectation || bar.min).toLocaleString('tr-TR')} ₺/ay (tahmini)`;
  } else {
    warnEl.innerHTML = `<span style="color:#38a169;">✓ Önerilen rütbe - uygun yerleşme</span>`;
    if (salaryEl) salaryEl.textContent = `${(c.salaryExpectation || bareMid).toLocaleString('tr-TR')} ₺/ay (tahmini)`;
  }
};

/** Terfi et */
window._onPromoteAdminStaff = function(staffId) {
  const result = promoteAdminStaff(staffId);
  if (result.success) {
    showNotification(result.message, 'success');
    _persistState();
    refreshGameUI();
  } else {
    showNotification(result.message || 'Terfi başarısız.', 'warning');
  }
};

/** İş akdi feshi modalı */
window._onFireAdminStaff = function(staffId) {
  const state = getState();
  const staff = (state.adminStaff || []).find(s => s.id === staffId);
  if (!staff) return;
  const severance = staff.salary * 2;
  if (!confirm(`${staff.name} adlı personelin iş akdi feshedilecek.\nKıdem tazminatı: ${severance.toLocaleString('tr-TR')} ₺\nOnaylıyor musunuz?`)) return;
  const result = fireAdminStaff(staffId);
  if (result.success) {
    showNotification(`${result.staffName} iş akdi feshedildi. Tazminat: ${result.severance.toLocaleString('tr-TR')} ₺`, 'warning');
    _persistState();
    refreshGameUI();
  } else {
    showNotification(result.message || 'İşlem başarısız.', 'warning');
  }
};

/** Maaş ayarla modalı */
window._onAdjustAdminSalary = function(staffId) {
  const state = getState();
  const staff = (state.adminStaff || []).find(s => s.id === staffId);
  if (!staff) return;
  // Basit prompt ile maaş al
  const newSalaryStr = prompt(
    `${staff.name} — ${staff.title}\nMevcut maaş: ${staff.salary.toLocaleString('tr-TR')} ₺/ay\nYeni maaş girin (₺):`,
    String(staff.salary)
  );
  if (!newSalaryStr) return;
  const newSalary = parseInt(newSalaryStr.replace(/\D/g, ''), 10);
  if (isNaN(newSalary) || newSalary <= 0) {
    showNotification('Geçersiz maaş değeri.', 'warning');
    return;
  }
  const result = updateAdminStaffSalary(staffId, newSalary);
  if (result.success) {
    showNotification(`${staff.name} maaşı güncellendi: ${newSalary.toLocaleString('tr-TR')} ₺/ay`, 'success');
    _persistState();
    refreshGameUI();
  } else {
    showNotification(result.message || 'Güncelleme başarısız.', 'warning');
  }
};

/** Birim yöneticisi değiştir */
window._onAssignUnitManager = function(unitId) {
  const state = getState();
  const eligible = (state.adminStaff || []).filter(
    s => s.unit === unitId && (s.title === 'Müdür' || s.title === 'Müdür Yrd.')
  );
  if (eligible.length === 0) {
    showNotification('Bu birimde Müdür veya Müdür Yrd. bulunmuyor.', 'warning');
    return;
  }
  const options = eligible.map((s, i) => `${i + 1}. ${s.name} (${s.title}, Liderlik: ${s.leadership})`).join('\n');
  const choice = prompt(`Yönetici seçin:\n${options}\n\nNumara girin (0 = yönetici kaldır):`);
  if (choice === null) return;
  const idx = parseInt(choice, 10);
  if (idx === 0) {
    assignUnitManager(unitId, null);
    showNotification('Yönetici kaldırıldı.', 'info');
    _persistState();
  } else if (idx >= 1 && idx <= eligible.length) {
    const result = assignUnitManager(unitId, eligible[idx - 1].id);
    if (result.success) {
      showNotification(`${eligible[idx - 1].name} birim yöneticisi atandı.`, 'success');
      _persistState();
    } else showNotification(result.message, 'warning');
  }
  refreshGameUI();
};

// ─────────────────────────────────────────────────────────────────────────────
// v0.3: TEKNOLOJİ TRANSFER OFİSİ — Global callback'ler
// ─────────────────────────────────────────────────────────────────────────────

window._onEstablishTTO = function() {
  const result = establishTTO(getState());
  showNotification(result.message, result.success ? 'success' : 'error');
  if (result.success) _persistState();
  refreshGameUI();
};

window._onUpgradeTTO = function() {
  const result = upgradeTTO(getState());
  showNotification(result.message, result.success ? 'success' : 'error');
  if (result.success) _persistState();
  refreshGameUI();
};

window._onAcceptDeal = function(dealId) {
  const result = acceptDeal(getState(), Number(dealId));
  showNotification(result.message, result.success ? 'success' : 'error');
  if (result.success) _persistState();
  refreshGameUI();
};

window._onRejectDeal = function(dealId) {
  const result = rejectDeal(getState(), Number(dealId));
  showNotification(result.message, result.success ? 'success' : 'error');
  if (result.success) _persistState();
  refreshGameUI();
};
