/**
 * Rektör Oldum — Giriş Noktası (main.js)
 * ES6 module. Tüm modülleri bağlar, event listener'ları kurar, oyun akışını yönetir.
 */
console.log('[main] main.js modülü yükleniyor...');

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT
// ─────────────────────────────────────────────────────────────────────────────

import { initGame, nextTurn, getState, applyDecision, assignCourses, applyQuotas, assignDeptHead, reassignFacultyToDept, generateAdminCandidates, hireAdminStaff, upgradeAdminUnit } from './game.js';

import {
  showScreen,
  showModal,
  hideModal,
  showNotification,
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
  renderRankingPanel,
  renderResearchPanel,
  renderTransferMarket,
  renderOpenPositionModal,
  renderTurnSummary,
  renderEvent,
  renderQuotaModal,
  renderAdminPanel,
  renderAdminHireModal,
  el,
  on,
} from './ui.js';

import { saveGame, loadGame, autoSave, getSaveSlots } from './save.js';

import { generateTransferMarket, renderFacultyAvatar, calculateOverallRating, getFacultyRatingTrend } from './faculty.js';
import { resolveDecision } from './events.js';

// ─────────────────────────────────────────────────────────────────────────────
// UYGULAMA DURUMU
// ─────────────────────────────────────────────────────────────────────────────

/** Aktif sekme ID'si */
let _activeTab = 'dashboard';

/** Transfer pazarı verisi (fakulte.js gelince gerçek değer alacak) */
let _transferMarket = null;

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

  // Klavye kısayolları
  _bindKeyboardShortcuts();

  console.log('[main] Başlangıç tamamlandı.');
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
    _startGameWithState(state);
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
  );

  console.log('[main] initGame() tamamlandı, oyun ekranına geçiliyor.');
  _startGameWithState(state);
  showNotification(`${setup.uniName} kuruldu! İyi yönetimler, Rektör ${setup.playerName}.`, 'success');
}

/**
 * Verilen state ile oyun ekranını aç ve UI'ı hazırla.
 * @param {object} state — Oyun durumu
 */
function _startGameWithState(state) {
  showScreen('screen-game');
  _bindGameScreenEvents();
  refreshGameUI();
  console.log('[main] Oyun ekranı hazır. Dönem:', state?.meta?.turn, '| Bütçe:', state?.university?.budget);
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
      renderBudgetPanel(state, _onAllocChange);
      break;
    case 'ranking':
      renderRankingPanel(state);
      break;
    case 'research':
      renderResearchPanel(state, _onResearchBudget, _onProjectDecision);
      break;
    case 'admin':
      renderAdminPanel(state, _onHireAdminStaff, _onUpgradeAdminUnit);
      break;
    default:
      console.warn(`[main] Bilinmeyen sekme: ${_activeTab}`);
      renderDashboard(state);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OYUN EKRANI — EVENT LISTENER'LAR
// ─────────────────────────────────────────────────────────────────────────────

/** Oyun ekranına ait tüm event listener'ları bağla (bir kez çağrılır). */
function _bindGameScreenEvents() {
  console.log('[main] Oyun ekranı event listener\'ları bağlanıyor...');

  // ── Sekme navigasyonu ───────────────────────────────────────────────────
  initTabNavigation((tabId) => {
    console.log(`[main] Sekme değişti → ${tabId}`);
    _activeTab = tabId;
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
  on(el('modal-close-btn'), 'click', hideModal);
  on(el('modal-overlay'), 'click', (e) => {
    if (e.target === el('modal-overlay')) hideModal();
  });

  console.log('[main] Oyun ekranı event listener\'ları bağlandı.');
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

  // Otomatik kayıt
  autoSave(state);

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
    // Özeti modal içinde göster
    const panel = el('tab-dashboard');
    if (panel) {
      showModal('Dönem Özeti', panel.innerHTML);
    }
  }

  refreshGameUI();
  console.log(`[main] Tur tamamlandı → Tur ${state?.meta?.turn}`);
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
  refreshGameUI();

  if (result && result.success) {
    showNotification(`${fac.name} kadromuza katıldı!`, 'success');
  } else {
    showNotification(result?.message || 'İşe alma başarısız.', 'danger');
  }
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
    showNotification(`${position.field} alanında kadro ilanı verildi!`, 'success');
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
  refreshGameUI();
}

function _handleAcceptSpontaneous(e) {
  const { appId, targetDeptId } = e.detail || {};
  if (!appId) return;
  const result = applyDecision({ type: 'accept_spontaneous', applicantId: appId, targetDeptId });
  if (result && result.success) {
    showNotification(result.message || 'Spontane başvurucu işe alındı!', 'success');
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
          <span style="color:var(--text-muted);">+10 moral &nbsp;·&nbsp; +3 prestij &nbsp;·&nbsp; 100.000 ₺ prim</span>
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
    refreshGameUI();
  });
}

/** Yapı inşaatı başlat */
function _onBuildStart(buildingType) {
  console.log('[main] İnşaat başlatıldı:', buildingType);
  applyDecision({ type: 'start_construction', buildingType });
  refreshGameUI();
}

/** Kampüs karar callback (yükseltme, bölüm atama vb.) */
function _onCampusDecision(decision) {
  console.log('[main] Kampüs kararı:', decision);
  const result = applyDecision(decision);
  if (result && !result.success) {
    showNotification(result.message || 'İşlem başarısız.', 'danger');
  } else if (result && result.message) {
    showNotification(result.message, 'success');
  }
  refreshGameUI();
}

/** Bütçe dağılımı değişikliği */
function _onAllocChange(allocation) {
  console.log('[main] Bütçe dağılımı değişikliği:', allocation);
  applyDecision({ type: 'budget_allocation', ...allocation });
  refreshGameUI();
}

/** Araştırma bütçesi değişikliği */
function _onResearchBudget(amount) {
  console.log('[main] Araştırma bütçesi değişikliği:', amount);
  applyDecision({ type: 'research_budget', amount });
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
      const ok = saveGame(getState(), slotName);
      if (ok) {
        showNotification(`Oyun ${slotName}'e kaydedildi.`, 'success');
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
      // TODO: onay dialogu eklenebilir
      const { deleteSave } = _getSaveModule();
      if (deleteSave) {
        deleteSave(slotName);
        showNotification(`${slotName} silindi.`, 'info');
        _showSaveModal(); // Modalı yenile
      }
    });
  });

  // Dışa aktar
  on(el('btn-export-save'), 'click', () => {
    console.log('[main] JSON dışa aktarma başlatılıyor...');
    const { exportSave } = _getSaveModule();
    if (exportSave) exportSave(getState());
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
        const { importSave } = _getSaveModule();
        if (!importSave) return;
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
 * game.js'in setState fonksiyonu olmadığından initGame'i state parametresiyle çağırıyoruz.
 * TODO: game.js'e setState(state) eklendiğinde bu fonksiyon güncellenmeli.
 * @param {object} state — Yüklenen oyun durumu
 */
function _applyLoadedState(state) {
  console.log('[main] Yüklenen state uygulanıyor:', state?.university?.name);

  // game.js'in mevcut API'sinde doğrudan state set etme yoksa,
  // mevcut state yeniden init ederek güncelliyoruz.
  // NOT: game.js'e setState() eklenince bu satır değiştirilmeli.
  const currentState = getState();
  if (!currentState) {
    // Henüz oyun başlatılmamışsa
    initGame(
      state.university.playerName || 'Rektör',
      state.university.name,
      state.university.type,
      state.meta.difficulty || 'normal',
      state.departments.map(d => d.id),
    );
  }

  // TODO: game.js'e setState(state) eklenince burayı değiştir:
  // setState(state);

  _startGameWithState(state);
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI: save modülüne dinamik erişim (döngüsel import önleme)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * save.js fonksiyonlarını döndür.
 * Tüm fonksiyonlar zaten modül düzeyinde import edildiğinden
 * bu yardımcı doğrudan onlara referans verir.
 */
function _getSaveModule() {
  return { deleteSave: _deleteSaveProxy, exportSave: _exportSaveProxy, importSave: _importSaveProxy };
}

// save.js'ten direkt import edilenler proxy olarak sarılır
// (modül yüklenme sırası sorunlarına karşı güvenli)
async function _deleteSaveProxy(slotName) {
  const mod = await import('./save.js');
  return mod.deleteSave(slotName);
}
async function _exportSaveProxy(state) {
  const mod = await import('./save.js');
  return mod.exportSave(state);
}
async function _importSaveProxy(jsonString) {
  const mod = await import('./save.js');
  return mod.importSave(jsonString);
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
  const titleEl = document.getElementById('admin-hire-title');
  const title   = titleEl ? titleEl.value : 'Uzman';
  const candidates = generateAdminCandidates(unitId, title, 3);
  renderAdminHireModal(unitId, candidates, _onHireAdminCandidate);
}

/** Adayı işe al (obje direkt alır) */
function _onHireAdminCandidate(candidate) {
  if (!candidate) return;
  hireAdminStaff(candidate);
  hideModal();
  showNotification(`${candidate.name} işe alındı.`, 'success');
  refreshGameUI();
}

/** Birim yükselt */
function _onUpgradeAdminUnit(unitId) {
  const result = upgradeAdminUnit(unitId);
  if (result.success) {
    showNotification('Birim başarıyla yükseltildi!', 'success');
    refreshGameUI();
  } else {
    showNotification(result.message || 'Yükseltme başarısız.', 'warning');
  }
}

/** Adayları yenile (modal içi) */
function _onRefreshAdminCandidates(unitId) {
  const titleEl = document.getElementById('admin-hire-title');
  const title   = titleEl ? titleEl.value : 'Uzman';
  const candidates = generateAdminCandidates(unitId, title, 3);
  renderAdminHireModal(unitId, candidates, _onHireAdminCandidate);
}

// Global erişim (ui.js'teki onclick handler'ları için)
window._onHireAdminStaff          = _onHireAdminStaff;
window._onHireAdminCandidate      = _onHireAdminCandidate;
window._onHireAdminCandidateByIdx = (idx) => {
  const cache = window._adminCandidateCache || [];
  const candidate = cache[idx];
  if (candidate) _onHireAdminCandidate(candidate);
};
window._onUpgradeAdminUnit        = _onUpgradeAdminUnit;
window._onRefreshAdminCandidates  = _onRefreshAdminCandidates;
