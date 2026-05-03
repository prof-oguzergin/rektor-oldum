/**
 * Rektör Oldum — UI Render Modülü (ui.js)
 * ES6 module. Tüm DOM manipülasyonu ve render fonksiyonları burada.
 * Vanilla JS, framework yok.
 */

import { DEPARTMENTS, DEPARTMENT_CURRICULA, UNIVERSITY_TYPES, UNIVERSITY_MODELS, USD_TO_TL, DIFFICULTY_SETTINGS, BUILDINGS, SEMESTER_MONTHS, FACULTIES, DEPT_TO_FACULTY, SALARY_SCALES, ADMIN_UNITS, ADMIN_TITLES, ADMIN_UNIT_BUILDINGS, ACCREDITATION_BODIES, SCENARIOS, BANKS } from './data.js?v=0.4.6';
import { DEPARTMENT_FIELDS, getSalaryRange, renderFacultyAvatar, calculateOverallRating, getFacultyRatingTrend } from './faculty.js?v=0.4.6';
import { AVAILABLE_NEW_DEPARTMENTS } from './game.js?v=0.4.6';
import { calculateIncome, calculateExpenses, calculateLoanPayment } from './economy.js?v=0.4.6';
import { renderCampusMap, handleCampusClick, handleCampusHover, clearHover } from './campus-renderer.js?v=0.4.6';

// ─────────────────────────────────────────────────────────────────────────────
// DOM YARDIMCILARI
// ─────────────────────────────────────────────────────────────────────────────

/** ID ile element seç */
export const el  = id  => document.getElementById(id);

/** CSS seçici ile ilk eşleşen elementi seç */
export const qs  = sel => document.querySelector(sel);

/** CSS seçici ile tüm eşleşen elementleri seç (Array döner) */
export const qsa = sel => [...document.querySelectorAll(sel)];

/** Bir elemente event listener ekle */
export const on  = (element, event, handler) => {
  if (element) element.addEventListener(event, handler);
};

/** Delegate event (parent üzerinden child event yakalama) */
export function delegate(parent, selector, event, handler) {
  if (!parent) return;
  parent.addEventListener(event, e => {
    const target = e.target.closest(selector);
    if (target && parent.contains(target)) handler(e, target);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT YARDIMCILARI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Para formatla: 1500000 → "1.500.000 ₺"
 * Büyük sayılar: 1200000 → "1,2M ₺"
 */
export function formatMoney(amount) {
  if (amount === null || amount === undefined) return '—';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(1).replace('.', ',')}Mrd ₺`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1).replace('.', ',')}M ₺`;
  }
  return `${sign}${abs.toLocaleString('tr-TR')} ₺`;
}

/**
 * Para tam formatla: 1500000 → "1.500.000 ₺" (kısaltma yok)
 */
export function formatMoneyFull(amount) {
  if (amount === null || amount === undefined) return '—';
  const sign = amount < 0 ? '-' : '';
  return `${sign}${Math.abs(amount).toLocaleString('tr-TR')} ₺`;
}

/**
 * Sayı formatla: 1234 → "1.234"
 */
export function formatNumber(num) {
  if (num === null || num === undefined) return '—';
  return Math.round(num).toLocaleString('tr-TR');
}

/**
 * Yüzde formatla: 0.153 → "%15"
 */
export function formatPercent(ratio, decimals = 0) {
  return `%${(ratio * 100).toFixed(decimals)}`;
}

/**
 * GPA formatla: 3.456 → "3.46"
 */
export function formatGPA(gpa) {
  return typeof gpa === 'number' ? gpa.toFixed(2) : '—';
}

// ─────────────────────────────────────────────────────────────────────────────
// KADRO YARDIMCI FONKSİYONLARI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hocanın verebileceği dersleri hesaplar: uzmanlık alanları × DEPARTMENT_CURRICULA
 * @param {object}   fac         — Hoca objesi (specializations, department)
 * @param {string[]} activeDepts — Oyuncunun açık bölüm id'leri
 * @returns {{ deptId, deptShortName, courseName, type }[]}
 */
function _getTeachableCourses(fac, activeDepts) {
  const specs = fac.specializations || [];
  const result = [];

  for (const deptId of activeDepts) {
    const curriculum = DEPARTMENT_CURRICULA[deptId];
    if (!curriculum) continue;
    const deptData = DEPARTMENTS[deptId];
    const deptShort = deptData?.shortName || deptId;

    for (const course of curriculum) {
      // Uzmanlık ile ders gereksiniminin eşleşmesi (tam veya kısmi)
      const matches = specs.some(spec =>
        spec === course.requiredExpertise ||
        spec.toLowerCase().includes((course.requiredExpertise || '').toLowerCase().substring(0, 5)) ||
        (course.requiredExpertise || '').toLowerCase().includes(spec.toLowerCase().substring(0, 5))
      );
      if (matches) {
        result.push({
          deptId,
          deptShortName: deptShort,
          courseName:    course.name,
          type:          course.type,
        });
      }
    }
  }
  return result;
}

/**
 * Bölüm uyum yüzdesi: hoca kaç ders karşılayabilir / toplam ders sayısı
 * @param {object}   fac     — Hoca
 * @param {string}   deptId  — Bölüm id
 * @param {string[]} activeDepts — Açık bölümler
 * @returns {{ count: number, total: number, pct: number }}
 */
function _getDeptCompatibility(fac, deptId, activeDepts) {
  const curriculum = DEPARTMENT_CURRICULA[deptId];
  if (!curriculum) return { count: 0, total: 0, pct: 0 };
  const teachable = _getTeachableCourses(fac, [deptId]);
  const count = teachable.length;
  const total = curriculum.length;
  const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
  return { count, total, pct };
}

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

/**
 * Modal overlay göster / gizle.
 * @param {string} title    — Modal başlığı
 * @param {string} bodyHtml — İçerik HTML
 * @param {object} [opts]   — Seçenekler: { wide: true } geniş modal için
 */
export function showModal(title, bodyHtml, opts = {}) {
  const overlay  = el('modal-overlay');
  const titleEl  = el('general-modal-title');
  const bodyEl   = el('general-modal-body');
  const modalEl  = el('general-modal');
  if (!overlay || !titleEl || !bodyEl) return;

  titleEl.textContent = title;
  bodyEl.innerHTML    = bodyHtml;

  // Genişlik sınıfı ayarla
  if (modalEl) {
    modalEl.classList.toggle('modal-wide', !!opts.wide);
  }

  overlay.classList.remove('hidden');
  overlay.classList.add('active');
}

export function hideModal() {
  const overlay = el('modal-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.classList.remove('active');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AKREDİTASYON MODALI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Akreditasyon başvuru modalını gösterir.
 * @param {object} state         — Oyun durumu
 * @param {string} deptId        — Bölüm id'si
 * @param {string} bodyId        — Akreditasyon kuruluşu id'si
 * @param {object} reqResult     — checkAccreditationRequirements() sonucu
 * @param {Function} onApply     — Başvur callback: (deptId, bodyId) => void
 */
export function showAccreditationModal(state, deptId, bodyId, reqResult, onApply) {
  const dept = (state.departments || []).find(d => d.id === deptId);
  const body = ACCREDITATION_BODIES[bodyId];
  if (!dept || !body) return;

  const acc = dept.accreditation?.[bodyId];
  const isRenewal = acc?.status === 'expired';
  const cost = isRenewal ? body.renewalCost : body.cost;

  const checksHtml = reqResult.checks.map(c => {
    const icon = c.met ? '✅' : '⚠️';
    const style = c.met ? '' : 'color:var(--accent-red,#e53e3e);font-weight:600;';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--border);font-size:13px;">
      <span>${icon} ${c.label}</span>
      <span style="${style}">${c.current} / ${c.required} ${c.met ? '' : '← KARŞILANMIYOR'}</span>
    </div>`;
  }).join('');

  const failedCount = reqResult.checks.filter(c => !c.met).length;
  const allMet = reqResult.allMet;

  const statusHtml = allMet
    ? `<div style="color:var(--accent-green,#38a169);font-weight:600;margin-top:10px;">✅ Tüm gereksinimler karşılanıyor!</div>`
    : `<div style="color:var(--accent-red,#e53e3e);font-weight:600;margin-top:10px;">⚠️ ${failedCount} gereksinim karşılanmıyor. Başvuru reddedilebilir.</div>`;

  const bodyHtml = `
    <div style="padding:4px 0;">
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">
        <strong>Bölüm:</strong> ${dept.name}
        &nbsp;&nbsp;|&nbsp;&nbsp;
        <strong>Tür:</strong> ${body.fullName}
      </div>

      <div style="font-weight:600;margin-bottom:8px;font-size:13px;">📋 GEREKSİNİMLER</div>
      <div style="background:var(--bg-secondary,#f7fafc);border-radius:6px;padding:8px 12px;margin-bottom:12px;">
        ${checksHtml}
      </div>

      ${statusHtml}

      <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:13px;">
        <div style="text-align:center;padding:8px;background:var(--bg-secondary,#f7fafc);border-radius:6px;">
          <div style="font-weight:700;color:var(--accent-blue,#3182ce);">
            ${cost.toLocaleString('tr-TR')} ₺
          </div>
          <div style="font-size:11px;color:var(--text-muted);">💰 Başvuru Ücreti</div>
        </div>
        <div style="text-align:center;padding:8px;background:var(--bg-secondary,#f7fafc);border-radius:6px;">
          <div style="font-weight:700;">
            ${body.processingTime.min}–${body.processingTime.max} dönem
          </div>
          <div style="font-size:11px;color:var(--text-muted);">⏱️ Değerlendirme Süresi</div>
        </div>
        <div style="text-align:center;padding:8px;background:var(--bg-secondary,#f7fafc);border-radius:6px;">
          <div style="font-weight:700;color:var(--accent-green,#38a169);">
            +${body.prestigeBonus} saygınlık
          </div>
          <div style="font-size:11px;color:var(--text-muted);">🏆 Kazanım</div>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end;">
        <button class="btn btn-secondary" id="acc-modal-cancel">İptal</button>
        <button class="btn ${allMet ? 'btn-primary' : 'btn-warning'}" id="acc-modal-apply">
          ${allMet ? 'Başvur' : 'Başvur (Riskli)'}
        </button>
      </div>
    </div>`;

  showModal(`${body.icon} ${body.name} ${isRenewal ? 'Akreditasyon Yenileme' : 'Akreditasyon Başvurusu'}`, bodyHtml);

  setTimeout(() => {
    const cancelBtn = document.getElementById('acc-modal-cancel');
    const applyBtn  = document.getElementById('acc-modal-apply');
    if (cancelBtn) cancelBtn.addEventListener('click', hideModal);
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        hideModal();
        if (onApply) onApply(deptId, bodyId);
      });
    }
  }, 50);
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
  on(el('btn-settings'),  'click', () => _showSettingsModal());
}

// ─────────────────────────────────────────────────────────────────────────────
// AYARLAR MODALI (Ana Menü)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ses ayarlarını içeren ayarlar modalını göster.
 * window._onMusicVolChange / _onSFXVolChange / _onToggleMute callback'lerine bağlanır.
 * Hem ana menüden hem oyun içinden çağrılabilir.
 */
export function showSettingsModal() { _showSettingsModal(); }

function _showSettingsModal() {
  // Mevcut ses ayarlarını al (window üzerinden, yoksa varsayılan)
  const audioSettings = (typeof window.getAudioSettings === 'function')
    ? window.getAudioSettings()
    : { musicVol: 0.3, sfxVol: 0.6, muted: false };

  const musicPct = Math.round((audioSettings.musicVol ?? 0.3) * 100);
  const sfxPct   = Math.round((audioSettings.sfxVol ?? 0.6) * 100);
  const muteIcon = audioSettings.muted ? '🔇' : '🔊';

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

  // Range slider'larının canlı değer güncellenmesi için oninput kullan
  showModal('Ayarlar', body);

  // Slider değer etiketlerini canlı güncelle
  const modalBody = el('general-modal-body') || el('modal-body');
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
// EKRAN 2: KURULUM
// ─────────────────────────────────────────────────────────────────────────────

/** Kurulum ekranı dahili state */
const _setup = {
  playerName:   '',
  uniName:      '',
  uniType:      'devlet',
  difficulty:   'kolay',   // HTML'de "kolay" kartı varsayılan seçili
  departments:  new Set(),
  scenarioId:   null,       // seçilen senaryo id'si (null = serbest oyun)
};

/**
 * Kurulum ekranı event listener'larını bağla ve bölüm listesini render et.
 * @param {Function} onStart — Oyun başlatma callback (setup objesini alır)
 */
export function initSetupScreen(onStart) {
  // Geri butonu
  on(el('btn-back-menu'), 'click', () => showScreen('screen-menu'));

  // ── ADIM 0: Senaryo seçimi ────────────────────────────────────────────────
  _renderScenarioCards();

  on(el('btn-scenario-next'), 'click', () => {
    if (!_setup.scenarioId) return;
    if (_setup.scenarioId === 'serbest') {
      // Serbest oyun: senaryo uygulanmaz
      _setup.scenarioId = null;
    } else {
      _applyScenarioToSetup(_setup.scenarioId);
    }
    _showSetupStep(1);
  });

  // ── ADIM 1 ← 0 ──────────────────────────────────────────────────────────
  on(el('btn-step1-back'), 'click', () => _showSetupStep(0));

  // ── ADIM 1 → 2 ──────────────────────────────────────────────────────────
  on(el('btn-step1-next'), 'click', () => {
    const name = el('input-player-name').value.trim();
    const uni  = el('input-uni-name').value.trim();
    if (!name) { showNotification('Rektör adı boş bırakılamaz.', 'warning'); return; }
    if (!uni)  { showNotification('Üniversite adı boş bırakılamaz.', 'warning'); return; }
    _setup.playerName = name;
    _setup.uniName    = uni;
    _showSetupStep(2);
  });

  // ── ADIM 2: Tip seçimi ───────────────────────────────────────────────────
  delegate(el('type-cards'), '.type-card', 'click', (e, card) => {
    qsa('#type-cards .type-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    _setup.uniType = card.dataset.type;
  });
  // Devlet varsayılan seçili
  const defaultType = qs('#type-cards .type-card[data-type="devlet"]');
  if (defaultType) defaultType.classList.add('selected');

  // ── ADIM 2: Zorluk seçimi ────────────────────────────────────────────────
  delegate(el('difficulty-cards'), '.difficulty-card', 'click', (e, card) => {
    qsa('#difficulty-cards .difficulty-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    _setup.difficulty = card.dataset.difficulty;
  });

  on(el('btn-step2-back'), 'click', () => _showSetupStep(1));
  on(el('btn-step2-next'), 'click', () => {
    _showSetupStep(3);
    _renderDeptSelection();
    // Senaryo seçildiyse zorunlu bölümleri önceden seç
    if (_setup.scenarioId && SCENARIOS[_setup.scenarioId]) {
      const scenario = SCENARIOS[_setup.scenarioId];
      _setup.departments = new Set(scenario.forcedDepartments || []);
      _renderDeptSelection();
    }
  });

  // ── ADIM 3: Bölüm filtreleri ─────────────────────────────────────────────
  delegate(el('dept-filter-bar'), '.dept-filter-btn', 'click', (e, btn) => {
    qsa('#dept-filter-bar .dept-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _renderDeptSelection(btn.dataset.cat);
  });

  on(el('btn-step3-back'), 'click', () => _showSetupStep(2));

  on(el('btn-start-game'), 'click', () => {
    if (_setup.departments.size < 2) {
      showNotification('En az 2 bölüm seçmelisiniz.', 'warning');
      return;
    }
    onStart({ ..._setup, departments: [..._setup.departments] });
  });
}

/** Senaryo kartlarını render et */
function _renderScenarioCards() {
  const container = el('scenario-cards');
  if (!container) return;

  const diffLabels = { kolay: 'Kolay', normal: 'Normal', zor: 'Zor', serbest: 'Serbest' };
  const diffClass  = { kolay: 'easy', normal: 'normal', zor: 'hard', serbest: 'easy' };

  // "Serbest Oyun" sanal kartı: senaryo olmadan başlangıç
  const serbestCard = `
    <div class="scenario-card" data-scenario-id="serbest">
      <div class="scenario-card-header">
        <span class="scenario-card-icon">🎮</span>
        <div class="scenario-card-title-block">
          <div class="scenario-card-name">Serbest Oyun</div>
          <div class="scenario-card-subtitle">Hazır senaryosuz, sıfırdan</div>
        </div>
        <span class="scenario-diff-badge scenario-diff-easy">Serbest</span>
      </div>
      <div class="scenario-card-desc">Üniversite tipini, zorluğu ve bölümleri sen seç. Hiçbir senaryo kısıtı yok, klasik açılış.</div>
      <div class="scenario-card-footer">
        <span class="scenario-flavor">"Boş tuval, sınırsız olasılık."</span>
      </div>
    </div>
  `;

  const realCards = Object.values(SCENARIOS).map(s => `
    <div class="scenario-card" data-scenario-id="${s.id}">
      <div class="scenario-card-header">
        <span class="scenario-card-icon">${s.icon}</span>
        <div class="scenario-card-title-block">
          <div class="scenario-card-name">${s.name}</div>
          <div class="scenario-card-subtitle">${s.subtitle}</div>
        </div>
        <span class="scenario-diff-badge scenario-diff-${diffClass[s.difficulty] || 'normal'}">${diffLabels[s.difficulty] || s.difficulty}</span>
      </div>
      <div class="scenario-card-desc">${s.description}</div>
      <div class="scenario-card-footer">
        <span class="scenario-flavor">${s.flavorText}</span>
      </div>
    </div>
  `).join('');

  container.innerHTML = serbestCard + realCards;

  // Varsayılan seçim: Serbest Oyun
  if (!_setup.scenarioId) _setup.scenarioId = 'serbest';
  const initial = container.querySelector(`.scenario-card[data-scenario-id="${_setup.scenarioId}"]`);
  if (initial) initial.classList.add('selected');
  _updateScenarioNextButton();

  delegate(container, '.scenario-card', 'click', (e, card) => {
    const id = card.dataset.scenarioId;
    qsa('#scenario-cards .scenario-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    _setup.scenarioId = id;
    _updateScenarioNextButton();
  });
}

function _updateScenarioNextButton() {
  const btn = el('btn-scenario-next');
  if (!btn) return;
  const isSerbest = !_setup.scenarioId || _setup.scenarioId === 'serbest';
  btn.textContent = isSerbest ? '🎮 Serbest Oyna →' : 'Senaryoyla Başla →';
  btn.disabled = !_setup.scenarioId;
}

/** Senaryo seçimini _setup state'ine uygula (uni tipi, zorluk) */
function _applyScenarioToSetup(scenarioId) {
  const scenario = SCENARIOS[scenarioId];
  if (!scenario) return;

  // Uni tipi
  _setup.uniType = scenario.universityType || 'devlet';

  // Zorluk
  _setup.difficulty = scenario.difficulty || 'normal';

  // Adım 2'deki type kartını seç
  qsa('#type-cards .type-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.type === _setup.uniType);
  });

  // Adım 2'deki zorluk kartını seç
  qsa('#difficulty-cards .difficulty-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.difficulty === _setup.difficulty);
  });
}

/** Adım göster */
function _showSetupStep(step) {
  qsa('.setup-step').forEach(s => s.classList.add('hidden'));
  // Adım 0 için özel id kullan
  const targetId = step === 0 ? 'setup-step-scenario' : `setup-step-${step}`;
  const target = el(targetId);
  if (target) target.classList.remove('hidden');

  // Step indikatör güncelle
  qsa('.setup-step-indicator .step').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.step) === step);
  });
}

/** Bölüm seçim grid'ini render et */
function _renderDeptSelection(filter = 'hepsi') {
  const grid = el('dept-selection-grid');
  if (!grid) return;

  const catLabels = {
    muhendislik: 'Mühendislik',
    temel_bilim: 'Temel Bilim',
    sosyal:      'Sosyal',
    saglik:      'Sağlık',
  };

  const items = Object.values(DEPARTMENTS).filter(d => {
    if (filter === 'hepsi') return true;
    return d.category === filter;
  });

  // Senaryo seçildiyse maxStartDepartments uygula
  const activeScenario = _setup.scenarioId ? SCENARIOS[_setup.scenarioId] : null;
  const maxDepts = activeScenario?.maxStartDepartments ?? 6;
  const forcedDepts = new Set(activeScenario?.forcedDepartments || []);

  grid.innerHTML = items.map(d => {
    const sel    = _setup.departments.has(d.id);
    const forced = forcedDepts.has(d.id);
    const dis    = !sel && _setup.departments.size >= maxDepts;
    const title  = dis
      ? `Limit doldu (${maxDepts}/${maxDepts}). Başka bölüm seçmek için önce bir tanesini kaldırman gerek.`
      : forced
      ? 'Bu bölüm senaryo için zorunludur.'
      : (sel ? 'Seçili. Kaldırmak için tekrar tıkla.' : 'Tıkla, seç.');
    return `
      <div class="dept-option${sel ? ' selected' : ''}${dis ? ' disabled' : ''}${forced ? ' forced' : ''}"
           data-dept-id="${d.id}" title="${title}">
        <span class="dept-option-icon">${d.icon || '🏫'}</span>
        <div class="dept-option-info">
          <div class="dept-option-name">${d.name}${forced ? ' <span class="forced-badge">Zorunlu</span>' : ''}</div>
          <div class="dept-option-cat">${catLabels[d.category] || d.category}</div>
        </div>
      </div>`;
  }).join('');

  // Tıklama eventi
  delegate(grid, '.dept-option', 'click', (e, card) => {
    const id = card.dataset.deptId;
    if (card.classList.contains('disabled')) return;
    // Zorunlu bölümler kaldırılamaz
    if (forcedDepts.has(id) && _setup.departments.has(id)) {
      showNotification('Bu bölüm senaryo için zorunludur, kaldırılamaz.', 'warning');
      return;
    }

    if (_setup.departments.has(id)) {
      _setup.departments.delete(id);
      card.classList.remove('selected');
    } else {
      if (_setup.departments.size >= maxDepts) {
        showNotification(`Bu senaryo için en fazla ${maxDepts} bölüm seçilebilir.`, 'warning');
        return;
      }
      _setup.departments.add(id);
      card.classList.add('selected');
    }

    _updateDeptSelectionInfo();
    _renderDeptSelection(filter); // seçim değişti, disabled durumları güncelle
  });

  _updateDeptSelectionInfo();
}

/** Bölüm seçim bilgisini güncelle */
function _updateDeptSelectionInfo() {
  const countEl   = el('dept-selected-count');
  const maxEl     = el('dept-max-count');
  const namesEl   = el('dept-selection-names');
  const startBtn  = el('btn-start-game');
  const hintEl    = el('dept-selection-limit-hint');

  const activeScenario = _setup.scenarioId ? SCENARIOS[_setup.scenarioId] : null;
  const maxDepts = activeScenario?.maxStartDepartments ?? 6;

  const count = _setup.departments.size;
  if (countEl) countEl.textContent = count;
  if (maxEl)   maxEl.textContent   = maxDepts;

  if (namesEl) {
    const names = [..._setup.departments].map(id => DEPARTMENTS[id]?.shortName || id);
    namesEl.textContent = names.length > 0 ? ', ' + names.join(', ') : '';
  }

  if (hintEl) {
    if (activeScenario) {
      hintEl.textContent = `📌 "${activeScenario.name}" senaryosu en fazla ${maxDepts} bölümle başlamana izin veriyor (küçük bütçe, hızlı büyüme).`;
      hintEl.style.display = 'block';
    } else {
      hintEl.textContent = `📌 Serbest oyunda en fazla ${maxDepts} bölümle başlayabilirsin. Sonradan yeni bölüm açılabilir.`;
      hintEl.style.display = 'block';
    }
  }

  if (startBtn) {
    startBtn.disabled = count < 2;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ÜST BAR GÜNCELLEMESİ
// ─────────────────────────────────────────────────────────────────────────────

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
  if (nameEl) nameEl.textContent = uni.name;

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
    budgetEl.classList.remove('budget-value');
  }

  // Saygınlık
  const prestigeEl = qs('#stat-prestige .top-stat-value');
  if (prestigeEl) prestigeEl.textContent = Math.round(uni.prestige);

  // Sıralama
  const rankEl = qs('#stat-ranking .top-stat-value');
  if (rankEl) rankEl.textContent = `#${uni.ranking}`;

  // Öğrenci sayısı
  const studEl = qs('#stat-students .top-stat-value');
  if (studEl) studEl.textContent = formatNumber(state.students?.totalEnrolled ?? 0);

  // Kadro sayısı
  const facEl = qs('#stat-faculty .top-stat-value');
  if (facEl) facEl.textContent = formatNumber(state.faculty?.length ?? 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// SEKME YÖNETİMİ
// ─────────────────────────────────────────────────────────────────────────────

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
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. DASHBOARD PANELİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genel Bakış: özet istatistikler, uyarılar, son olaylar.
 * @param {object} state — Oyun durumu
 */
export function renderDashboard(state) {
  const panel = el('tab-dashboard');
  if (!panel) return;

  const uni  = state.university;
  const meta = state.meta;

  // Dönem gelir/gider tahmini (basit)
  const semesterRevenue = _estimateRevenue(state);
  const semesterCost    = _estimateCosts(state);
  const netBalance      = semesterRevenue - semesterCost;

  // Uyarılar
  const warnings = _getWarnings(state);

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-title">${uni.name}</div>
        <div class="panel-subtitle">
          ${meta.year}. Yıl — ${meta.semester === 'güz' ? 'Güz' : 'Bahar'} Dönemi
        </div>
      </div>
      <div class="flex gap-md items-center">
        ${createProgressRing(Math.round(uni.prestige), 100, 'Saygınlık', 80)}
      </div>
    </div>

    ${warnings.length > 0 ? `
      <div class="mb-md">
        ${warnings.map(w => `
          <div class="notification ${w.type}" style="max-width:100%;margin-bottom:6px;">
            <span class="notification-icon">${w.icon}</span>
            <span class="notification-text">${w.message}</span>
          </div>
        `).join('')}
      </div>
    ` : ''}

    <div class="dashboard-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:24px;">
      ${_statCardHtml('Kasa', formatMoney(uni.budget), netBalance >= 0 ? 'positive' : 'negative',
        netBalance >= 0 ? `+${formatMoney(netBalance)} bu dönem` : `${formatMoney(netBalance)} bu dönem`)}
      ${_statCardHtml('Saygınlık', Math.round(uni.prestige), null, `Sıralama #${uni.ranking}`)}
      ${_statCardHtml('Öğrenci', formatNumber(state.students?.totalEnrolled ?? 0), null,
        `${state.students?.starStudents?.length ?? 0} yıldız öğrenci`)}
      ${_statCardHtml('Kadro', formatNumber(state.faculty?.length ?? 0), null,
        `${state.departments?.length ?? 0} bölüm`)}
      ${_statCardHtml('Yayın', formatNumber(state.research?.publications ?? 0), null,
        `${state.research?.patents ?? 0} patent`)}
      ${_statCardHtml('Mezun', formatNumber(state.alumni?.length ?? 0), null,
        'Toplam mezun')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">

      <div>
        <div class="section-title">Bölüm Durumu</div>
        <div class="card" style="padding:0;">
          <div class="dept-list-header" style="grid-template-columns:32px 1fr 70px 70px;padding:8px 12px;">
            <span></span>
            <span>Bölüm</span>
            <span style="text-align:right">Öğrenci</span>
            <span style="text-align:right">Kalite</span>
          </div>
          ${(state.departments || []).map(d => `
            <div class="department-row" style="grid-template-columns:32px 1fr 70px 70px;cursor:default;">
              <span class="dept-row-icon">${d.icon || '🏫'}</span>
              <div class="dept-row-info">
                <div class="dept-row-name">${d.shortName || d.name}</div>
              </div>
              <div class="dept-row-stat text-right">${formatNumber(d.enrolledStudents ?? 0)}</div>
              <div class="dept-row-stat text-right">${_qualityBar(d.educationQuality ?? 50)}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div>
        <div class="section-title">Dönem Tahmini</div>
        <div class="card">
          <div class="summary-row">
            <span class="summary-row-label">Harç Geliri</span>
            <span class="summary-row-value positive">${formatMoney(semesterRevenue * 0.7)}</span>
          </div>
          <div class="summary-row">
            <span class="summary-row-label">Diğer Gelirler</span>
            <span class="summary-row-value positive">${formatMoney(semesterRevenue * 0.3)}</span>
          </div>
          <div class="summary-row">
            <span class="summary-row-label">Hoca Maaşları</span>
            <span class="summary-row-value negative">-${formatMoney(semesterCost * 0.5)}</span>
          </div>
          <div class="summary-row">
            <span class="summary-row-label">Diğer Giderler</span>
            <span class="summary-row-value negative">-${formatMoney(semesterCost * 0.5)}</span>
          </div>
          <div class="summary-row summary-total-row">
            <span class="summary-row-label">Net Tahmini</span>
            <span class="summary-row-value ${netBalance >= 0 ? 'positive' : 'negative'}">
              ${netBalance >= 0 ? '+' : ''}${formatMoney(netBalance)}
            </span>
          </div>
        </div>

        ${(() => {
          const activeProjs = state.research?.activeResearchProjects || [];
          if (activeProjs.length === 0) return '';
          const uniOhRate = state.universitySettings?.overheadRate ?? 0.15;
          const ohIncome = activeProjs.reduce((s, p) => {
            if (p.status !== 'active') return s;
            const sf = (p.requestedFunding || p.funding || 0) / Math.max(1, p.duration || 4);
            return s + sf * (p.callOverheadRate ?? uniOhRate);
          }, 0);
          const patRoy = Math.round((state.research?.patentRoyalties ?? 0) / 2);
          const total = Math.round(ohIncome) + patRoy;
          return `
            <div class="section-title mt-md">Proje Gelirleri</div>
            <div class="card" style="padding:10px 14px;">
              <div class="summary-row">
                <span class="summary-row-label">Aktif proje sayısı</span>
                <span class="summary-row-value">${activeProjs.length}</span>
              </div>
              <div class="summary-row">
                <span class="summary-row-label">Genel gider geliri</span>
                <span class="summary-row-value positive">${formatMoney(Math.round(ohIncome))}/dönem</span>
              </div>
              ${patRoy > 0 ? `
              <div class="summary-row">
                <span class="summary-row-label">Patent gelirleri</span>
                <span class="summary-row-value positive">${formatMoney(patRoy)}/dönem</span>
              </div>` : ''}
              <div class="summary-row summary-total-row">
                <span class="summary-row-label">Toplam</span>
                <span class="summary-row-value positive">${formatMoney(total)}/dönem</span>
              </div>
            </div>
          `;
        })()}

        <div class="section-title mt-md">Son Olaylar</div>
        <div class="card" style="padding:8px 0;">
          ${(state.events?.history?.slice(-5).reverse() || []).map(ev => `
            <div style="padding:6px 12px;border-bottom:1px solid var(--border);font-size:12px;color:var(--text-muted);">
              ${ev.description || ev.title || 'Geçmiş olay'}
            </div>
          `).join('') || `
            <div class="empty-state" style="padding:16px;">
              <div style="font-size:12px;color:var(--text-faint);">Henüz olay yok.</div>
            </div>
          `}
        </div>
      </div>

    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1b. BÖLÜMLER PANELİ — Müfredat + Ders Atamaları
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bölümler sekmesi: her bölümün istatistikleri, müfredatı, atanmış dersler.
 * @param {object} state — Oyun durumu
 */
export function renderDepartmentsPanel(state) {
  const panel = el('tab-departments');
  if (!panel) return;

  const depts   = state.departments || [];
  const faculty = state.faculty     || [];

  const matchIcon  = q => q === 2 ? '✓' : q === 1 ? '~' : '✗';
  const matchColor = q => q === 2 ? 'var(--accent-green)' : q === 1 ? 'var(--accent-yellow,#f5a623)' : 'var(--accent-red,#e53e3e)';
  const diffStars  = d => '★'.repeat(Math.round(d)) + '☆'.repeat(5 - Math.round(d));

  // Doluluk rengini hesapla: yeşil=sağlıklı, sarı=dolu, kırmızı=kritik
  const capacityColor = (enrolled, capacity) => {
    if (capacity <= 0) return 'var(--text-muted)';
    const ratio = enrolled / capacity;
    if (ratio > 1.0) return 'var(--accent-red,#e53e3e)';
    if (ratio > 0.85) return 'var(--accent-yellow,#f5a623)';
    return 'var(--accent-green)';
  };

  const pct = ratio => `%${Math.round((ratio || 0) * 100)}`;

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-title">Bölümler &amp; İstatistikler</div>
        <div class="panel-subtitle">${depts.length} aktif bölüm</div>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:20px;">
      ${depts.map(dept => {
        const curriculum  = DEPARTMENT_CURRICULA[dept.id] || [];
        const assignments = dept.courseAssignments || [];
        const uncovered   = dept.uncoveredCourses  || [];
        const deptFaculty = faculty.filter(f => (f.department || f.departmentId) === dept.id);
        const stats       = dept.stats || {};

        const coveredCount   = assignments.length;
        const totalCount     = curriculum.length;
        const coveragePct    = totalCount > 0 ? Math.round((coveredCount / totalCount) * 100) : 100;
        const fullMatchCount = assignments.filter(c => c.matchQuality === 2).length;
        const partialCount   = assignments.filter(c => c.matchQuality === 1).length;

        const edQuality  = dept.educationQuality ?? 50;
        const edColor    = edQuality >= 70 ? 'var(--accent-green)' : edQuality >= 45 ? 'var(--accent-yellow,#f5a623)' : 'var(--accent-red,#e53e3e)';

        const enrolled   = stats.totalEnrolled ?? dept.enrolledStudents ?? 0;
        const capacity   = stats.capacity ?? dept.studentCapacity ?? 100;
        const capColor   = capacityColor(enrolled, capacity);

        const byYear     = stats.byYear || { 1: 0, 2: 0, 3: 0, 4: 0 };
        const failRate   = stats.failureRate ?? 0;
        const avgGPA     = stats.avgGPA ?? 0;
        const diffRating = stats.difficultyRating ?? 3;
        const gradRate   = stats.graduationRate ?? 0;
        const dropRate   = stats.dropoutRate ?? 0;

        const failColor  = failRate > 0.20 ? 'var(--accent-red,#e53e3e)' : failRate > 0.10 ? 'var(--accent-yellow,#f5a623)' : 'var(--accent-green)';
        const gpaColor   = avgGPA >= 3.5 ? '#d4af37' : avgGPA >= 3.0 ? 'var(--accent-green)' : avgGPA >= 2.5 ? 'var(--accent-yellow,#f5a623)' : 'var(--accent-red,#e53e3e)';
        const gradColor  = gradRate >= 0.80 ? 'var(--accent-green)' : gradRate >= 0.60 ? 'var(--accent-yellow,#f5a623)' : 'var(--accent-red,#e53e3e)';

        // Kapasite durumu mesajı
        const fillRatio  = capacity > 0 ? enrolled / capacity : 0;
        const statusText = fillRatio > 1.0 ? '⚠️ Kapasite aşıldı' : fillRatio > 0.85 ? '⚡ Dolmak üzere' : '✓ Normal';

        // Ders istatistikleri (stats.courseStats varsa kullan, yoksa eski basit görünüme dön)
        const courseStats = stats.courseStats || [];

        // Her ders satırı
        const courseRows = curriculum.map(course => {
          const assign     = assignments.find(a => a.course?.id === course.id);
          const isUncovered = uncovered.some(u => u.id === course.id);
          const cStat      = courseStats.find(cs => cs.id === course.id);

          let statusIcon  = '⚫';
          let statusColor = 'var(--text-faint)';
          let assignedTo  = '—';

          if (assign) {
            statusIcon  = matchIcon(assign.matchQuality);
            statusColor = matchColor(assign.matchQuality);
            assignedTo  = assign.assignedName || '—';
          } else if (isUncovered) {
            statusIcon  = '⚠️';
            statusColor = 'var(--accent-red,#e53e3e)';
            assignedTo  = 'Dışarıdan hoca gerekli';
          }

          const enrolledStr = cStat ? `${cStat.enrolled} öğr.` : '—';
          const passRateStr = cStat ? `%${Math.round(cStat.passRate * 100)}` : '—';
          const avgGradeStr = cStat ? `${cStat.avgGrade}/100` : '—';
          const passColor   = cStat ? (cStat.passRate >= 0.80 ? 'var(--accent-green)' : cStat.passRate >= 0.60 ? 'var(--accent-yellow,#f5a623)' : 'var(--accent-red,#e53e3e)') : 'var(--text-muted)';

          return `
            <tr style="border-bottom:1px solid var(--border);">
              <td style="padding:6px 8px;">
                <span style="font-size:10px;padding:1px 5px;border-radius:8px;
                  background:${course.type === 'zorunlu' ? 'rgba(229,62,62,0.1)' : 'rgba(56,161,105,0.1)'};
                  color:${course.type === 'zorunlu' ? 'var(--accent-red,#e53e3e)' : 'var(--accent-green)'};
                  font-weight:700;">
                  ${course.type === 'zorunlu' ? 'Z' : 'S'}
                </span>
              </td>
              <td style="padding:6px 8px;font-size:13px;font-weight:500;">${course.name}</td>
              <td style="padding:6px 8px;font-size:11px;color:var(--text-muted);">${diffStars(course.difficulty)}</td>
              <td style="padding:6px 8px;font-size:11px;color:var(--text-muted);white-space:nowrap;">${enrolledStr}</td>
              <td style="padding:6px 8px;font-size:12px;font-weight:700;color:${passColor};">${passRateStr}</td>
              <td style="padding:6px 8px;font-size:11px;color:var(--text-muted);">${avgGradeStr}</td>
              <td style="padding:6px 8px;font-size:12px;font-weight:700;color:${statusColor};">${statusIcon}</td>
              <td style="padding:6px 8px;font-size:12px;color:var(--text-muted);">${assignedTo}</td>
            </tr>
          `;
        }).join('');

        return `
          <div class="card" style="padding:0;overflow:hidden;">
            <!-- Bölüm başlığı -->
            <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;
                 border-bottom:2px solid var(--border);background:var(--bg-secondary);">
              <span style="font-size:28px;">${dept.icon || '🏫'}</span>
              <div style="flex:1;">
                <div style="font-size:15px;font-weight:700;">${dept.name}</div>
                <div style="font-size:12px;color:var(--text-muted);">${deptFaculty.length} hoca · ${deptFaculty.reduce((s, f) => s + ((f.currentLoad?.assignedCourses || []).length), 0)} ders yükü · ${statusText}</div>
              </div>
              <div style="text-align:right;margin-right:8px;">
                <div style="font-size:20px;font-weight:700;color:${edColor};">${edQuality}</div>
                <div style="font-size:10px;color:var(--text-muted);">Eğitim Kalitesi</div>
              </div>
              <div style="text-align:right;min-width:70px;">
                <div style="font-size:16px;font-weight:700;color:${coveragePct >= 80 ? 'var(--accent-green)' : 'var(--accent-yellow,#f5a623)'};">${coveragePct}%</div>
                <div style="font-size:10px;color:var(--text-muted);">Kapsama</div>
              </div>
            </div>
            <!-- Akreditasyon rozetleri -->
            ${(() => {
              const acc = dept.accreditation;
              if (!acc) return '';
              const badges = [];
              if (acc.mudek?.status === 'granted') badges.push('<span style="font-size:10px;padding:2px 6px;border-radius:10px;background:rgba(56,161,105,0.15);color:var(--accent-green);border:1px solid var(--accent-green);" title="MÜDEK Akredite">MÜDEK ✓</span>');
              else if (acc.mudek?.status === 'applied') badges.push('<span style="font-size:10px;padding:2px 6px;border-radius:10px;background:rgba(245,166,35,0.15);color:var(--accent-yellow,#f5a623);border:1px solid var(--accent-yellow,#f5a623);" title="MÜDEK Başvuruda">MÜDEK ⏳</span>');
              else if (acc.mudek?.status === 'expired') badges.push('<span style="font-size:10px;padding:2px 6px;border-radius:10px;background:rgba(229,62,62,0.15);color:var(--accent-red,#e53e3e);border:1px solid var(--accent-red,#e53e3e);" title="MÜDEK Süresi Doldu">MÜDEK !</span>');
              if (acc.abet?.status === 'granted') badges.push('<span style="font-size:10px;padding:2px 6px;border-radius:10px;background:rgba(66,153,225,0.15);color:#4299e1;border:1px solid #4299e1;" title="ABET Akredite">ABET ✓</span>');
              else if (acc.abet?.status === 'applied') badges.push('<span style="font-size:10px;padding:2px 6px;border-radius:10px;background:rgba(245,166,35,0.15);color:var(--accent-yellow,#f5a623);border:1px solid var(--accent-yellow,#f5a623);" title="ABET Başvuruda">ABET ⏳</span>');
              else if (acc.abet?.status === 'expired') badges.push('<span style="font-size:10px;padding:2px 6px;border-radius:10px;background:rgba(229,62,62,0.15);color:var(--accent-red,#e53e3e);border:1px solid var(--accent-red,#e53e3e);" title="ABET Süresi Doldu">ABET !</span>');
              if (acc.theqa?.status === 'granted') badges.push('<span style="font-size:10px;padding:2px 6px;border-radius:10px;background:rgba(214,158,46,0.15);color:#d69e2e;border:1px solid #d69e2e;" title="THEQA Akredite">THEQA ✓</span>');
              else if (acc.theqa?.status === 'applied') badges.push('<span style="font-size:10px;padding:2px 6px;border-radius:10px;background:rgba(245,166,35,0.15);color:var(--accent-yellow,#f5a623);border:1px solid var(--accent-yellow,#f5a623);" title="THEQA Başvuruda">THEQA ⏳</span>');
              else if (acc.theqa?.status === 'expired') badges.push('<span style="font-size:10px;padding:2px 6px;border-radius:10px;background:rgba(229,62,62,0.15);color:var(--accent-red,#e53e3e);border:1px solid var(--accent-red,#e53e3e);" title="THEQA Süresi Doldu">THEQA !</span>');
              if (badges.length === 0) return '';
              return `<div style="display:flex;gap:4px;flex-wrap:wrap;padding:4px 16px 8px;background:var(--bg-secondary);">${badges.join('')}</div>`;
            })()}

            <!-- İstatistik kartları -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:0;border-bottom:1px solid var(--border);">
              <!-- Öğrenci / Yıllık Kontenjan -->
              <div style="padding:12px 16px;border-right:1px solid var(--border);text-align:center;">
                <div style="font-size:15px;font-weight:700;color:${capColor};">Toplam: ${enrolled}</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
                  Yıllık Kontenjan: ${(() => {
                    const q = state.students?.quotas?.[dept.id];
                    const annualQuota = q ? ((q.tamBurslu||0) + (q.yariBurslu||0) + (q.ucretli||0)) : (dept.programs?.lisans?.quota ?? Math.round(capacity / 4));
                    return annualQuota;
                  })()}
                </div>
                <div style="margin-top:6px;height:4px;border-radius:2px;background:var(--border);">
                  <div style="height:100%;border-radius:2px;width:${Math.min(100,Math.round(fillRatio*100))}%;background:${capColor};transition:width 0.4s;"></div>
                </div>
              </div>
              <!-- Zorluk -->
              <div style="padding:12px 16px;border-right:1px solid var(--border);text-align:center;">
                <div style="font-size:16px;font-weight:700;color:var(--text-primary);">${diffStars(diffRating)}</div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">Zorluk (${diffRating.toFixed(1)}/5)</div>
              </div>
              <!-- Başarısızlık -->
              <div style="padding:12px 16px;border-right:1px solid var(--border);text-align:center;">
                <div style="font-size:18px;font-weight:700;color:${failColor};">${pct(failRate)}</div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">Başarısızlık Oranı</div>
              </div>
              <!-- Ortalama GPA -->
              <div style="padding:12px 16px;border-right:1px solid var(--border);text-align:center;">
                <div style="font-size:18px;font-weight:700;color:${gpaColor};">${formatGPA(avgGPA)}</div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">Ortalama GPA</div>
              </div>
              <!-- Mezuniyet -->
              <div style="padding:12px 16px;border-right:1px solid var(--border);text-align:center;">
                <div style="font-size:18px;font-weight:700;color:${gradColor};">${pct(gradRate)}</div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">Mezuniyet Oranı</div>
              </div>
              <!-- Bırakma -->
              <div style="padding:12px 16px;text-align:center;">
                <div style="font-size:18px;font-weight:700;color:${dropRate > 0.05 ? 'var(--accent-red,#e53e3e)' : 'var(--text-muted)'};">${pct(dropRate)}</div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">Bırakma Oranı</div>
              </div>
            </div>

            <!-- Sınıf dağılımı -->
            <div style="padding:10px 16px;border-bottom:1px solid var(--border);font-size:12px;display:flex;gap:20px;flex-wrap:wrap;align-items:center;">
              <span style="font-weight:600;color:var(--text-muted);">Sınıf Dağılımı:</span>
              <span>1. Sınıf: <strong>${byYear[1] || 0}</strong></span>
              <span>2. Sınıf: <strong>${byYear[2] || 0}</strong></span>
              <span>3. Sınıf: <strong>${byYear[3] || 0}</strong></span>
              <span>4. Sınıf: <strong>${byYear[4] || 0}</strong></span>
            </div>

            <!-- Ders eşleşme özet satırı -->
            <div style="display:flex;gap:16px;padding:8px 16px;border-bottom:1px solid var(--border);font-size:12px;flex-wrap:wrap;">
              <span style="color:var(--accent-green);">✓ ${fullMatchCount} tam eşleşme</span>
              <span style="color:var(--accent-yellow,#f5a623);">~ ${partialCount} kısmi eşleşme</span>
              ${uncovered.length > 0 ? `<span style="color:var(--accent-red,#e53e3e);">⚠️ ${uncovered.length} karşılanmayan ders</span>` : ''}
              ${dept.partTimeHires > 0 ? `<span style="color:var(--text-muted);">👤 ${dept.partTimeHires} dışarıdan hoca</span>` : ''}
            </div>

            <!-- Ders tablosu -->
            ${curriculum.length === 0 ? `
              <div class="empty-state" style="padding:16px;">
                <div style="font-size:12px;color:var(--text-faint);">Bu bölüm için müfredat tanımlanmamış.</div>
              </div>
            ` : `
              <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;">
                  <thead>
                    <tr style="border-bottom:1px solid var(--border);">
                      <th style="padding:6px 8px;font-size:10px;text-transform:uppercase;color:var(--text-muted);text-align:left;width:30px;">T</th>
                      <th style="padding:6px 8px;font-size:10px;text-transform:uppercase;color:var(--text-muted);text-align:left;">Ders Adı</th>
                      <th style="padding:6px 8px;font-size:10px;text-transform:uppercase;color:var(--text-muted);text-align:left;width:80px;">Zorluk</th>
                      <th style="padding:6px 8px;font-size:10px;text-transform:uppercase;color:var(--text-muted);text-align:left;width:80px;">Kayıtlı</th>
                      <th style="padding:6px 8px;font-size:10px;text-transform:uppercase;color:var(--text-muted);text-align:left;width:70px;">Geçme</th>
                      <th style="padding:6px 8px;font-size:10px;text-transform:uppercase;color:var(--text-muted);text-align:left;width:80px;">Not Ort.</th>
                      <th style="padding:6px 8px;font-size:10px;text-transform:uppercase;color:var(--text-muted);text-align:center;width:30px;">Durum</th>
                      <th style="padding:6px 8px;font-size:10px;text-transform:uppercase;color:var(--text-muted);text-align:left;">Veren Hoca</th>
                    </tr>
                  </thead>
                  <tbody>${courseRows}</tbody>
                </table>
              </div>
            `}
          </div>
        `;
      }).join('') || `
        <div class="empty-state">
          <div class="empty-state-icon">🏫</div>
          <div class="empty-state-title">Henüz açık bölüm yok</div>
        </div>
      `}
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. KADRO PANELİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kadro sekmesi: hoca listesi, filtreler, transfer pazarı butonu.
 * @param {object} state — Oyun durumu
 * @param {Function} onTransferMarket — Transfer pazarı açma callback
 * @param {Function} onFacultyDetail  — Hoca detay callback (facultyId alır)
 */
export function renderFacultyPanel(state, onTransferMarket, onFacultyDetail, onOpenPosition) {
  const panel = el('tab-faculty');
  if (!panel) return;

  const faculty    = state.faculty || [];
  const depts      = state.departments || [];
  const deptOpts   = depts.map(d =>
    `<option value="${d.id}">${d.shortName || d.name}</option>`
  ).join('');

  // Maaş özeti hesapla
  const totalMonthlySalary = faculty.reduce((s, f) => s + (f.salary || 0), 0);
  const avgSalary          = faculty.length > 0 ? Math.round(totalMonthlySalary / faculty.length) : 0;
  const sortedBySalary     = [...faculty].sort((a, b) => (b.salary || 0) - (a.salary || 0));
  const highestPaid        = sortedBySalary[0];
  const lowestPaid         = sortedBySalary[sortedBySalary.length - 1];

  // Açık pozisyonlar ve başvurular
  const openPositions         = state.openPositions || [];
  const applications          = state.pendingApplicants || [];
  const spontaneousApplicants = state.spontaneousApplicants || [];

  const titleMap = {
    argö: 'ArGö', dr_ogr_uyesi: 'Dr.Öğr.Üyesi',
    docent: 'Doçent', profesor: 'Profesör',
  };

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-title">Akademik Kadro</div>
        <div class="panel-subtitle">${faculty.length} öğretim üyesi</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-secondary" id="btn-open-position">
          Kadro İlanı Ver
        </button>
        <button class="btn btn-secondary" id="btn-new-dept-program" style="background:rgba(128,90,213,0.15);border-color:rgba(128,90,213,0.4);color:#805ad5;">
          Yeni Bölüm / Program
        </button>
        <button class="btn btn-primary" id="btn-open-transfer">
          Transfer Pazarı
        </button>
      </div>
    </div>

    <!-- Maaş özeti -->
    ${faculty.length > 0 ? `
    <div style="background:var(--bg-secondary);border-radius:8px;padding:12px 16px;margin-bottom:12px;
                display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
      <div>
        <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Aylik Maas Gideri</div>
        <div style="font-size:15px;font-weight:700;color:var(--accent-red,#e53e3e);">${formatMoney(totalMonthlySalary)}</div>
      </div>
      <div>
        <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Ortalama Maas</div>
        <div style="font-size:15px;font-weight:700;">${formatMoney(avgSalary)}/ay</div>
      </div>
      <div>
        <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">En Yuksek / Dusuk</div>
        <div style="font-size:11px;">
          <span style="color:#38a169;">${highestPaid?.name?.split(' ')[0] || '—'}: ${formatMoney(highestPaid?.salary)}/ay</span><br>
          <span style="color:var(--text-muted);">${lowestPaid?.name?.split(' ')[0] || '—'}: ${formatMoney(lowestPaid?.salary)}/ay</span>
        </div>
      </div>
    </div>
    ` : ''}

    <!-- Başvurular (varsa) -->
    ${applications.length > 0 ? `
    <div style="background:rgba(245,166,35,0.08);border:1px solid rgba(245,166,35,0.3);border-radius:8px;
                padding:12px 16px;margin-bottom:12px;">
      <div style="font-size:12px;font-weight:700;color:#f5a623;margin-bottom:8px;">
        Bekleyen Başvurular (${applications.length})
      </div>
      <div id="applications-list" style="display:flex;flex-direction:column;gap:12px;">
        ${applications.map(app => {
          const titleDisp = titleMap[app.title] || app.title;
          const dept = depts.find(d => d.id === app.department);
          const deptName = dept?.shortName || app.department || '—';
          const stats = app.stats || {};
          const researchStat  = stats.research   ?? 50;
          const teachingStat  = stats.teaching   ?? 50;
          const manageStat    = stats.management ?? 30;

          // Stat çubuğu yardımcısı
          function statBar(val, color) {
            const pct = Math.min(100, Math.max(0, val));
            return `<div style="flex:1;height:5px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:${color};border-radius:3px;"></div>
            </div>`;
          }

          // Verebileceği dersler (yalnızca bu başvuranın bölümüyle sınırlı)
          const myDeptIds = depts.filter(d => d.isOpen).map(d => d.id);
          const teachable = _getTeachableCourses(app, myDeptIds);

          // Bölüm ortalaması (araştırma)
          const deptFaculty = faculty.filter(f => (f.department || f.departmentId) === app.department);
          const deptAvgResearch = deptFaculty.length > 0
            ? Math.round(deptFaculty.reduce((s, f) => s + (f.stats?.research ?? 50), 0) / deptFaculty.length)
            : 50;

          // Eksik ders sayısı
          const deptCurr = (DEPARTMENT_CURRICULA || {})[app.department] || [];
          const coveredNames = new Set(teachable.map(c => c.courseName));
          const uncoveredTeachable = teachable.filter(c => {
            const deptObj = depts.find(d => d.id === c.deptId);
            const assignments = deptObj?.courseAssignments || [];
            return !assignments.some(a => a.courseName === c.courseName);
          });

          // Değerlendirme puanı
          const researchAboveAvg = researchStat > deptAvgResearch;
          const teachableCount   = teachable.length;
          const evalScore        = (researchAboveAvg ? 1 : 0) + (teachableCount >= 3 ? 1 : 0) + (teachableCount >= 1 ? 1 : 0);
          const evalColor        = evalScore >= 3 ? '#38a169' : evalScore >= 2 ? '#f5a623' : '#e53e3e';
          const evalLabel        = evalScore >= 3 ? 'Mükemmel Uyum' : evalScore >= 2 ? 'Orta Uyum' : 'Zayıf Uyum';
          const evalBg           = evalScore >= 3 ? 'rgba(56,161,105,0.08)' : evalScore >= 2 ? 'rgba(245,166,35,0.08)' : 'rgba(229,62,62,0.08)';
          const evalBorder       = evalScore >= 3 ? 'rgba(56,161,105,0.3)' : evalScore >= 2 ? 'rgba(245,166,35,0.3)' : 'rgba(229,62,62,0.3)';

          const initials = (app.name || '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
          const appOverall = calculateOverallRating(app);
          const appRatingClass = appOverall >= 85 ? 'gold' : appOverall >= 70 ? 'green' : appOverall >= 55 ? 'yellow' : 'red';

          return `
            <div style="background:var(--bg-secondary);border-radius:8px;border:1px solid var(--border);overflow:hidden;">

              <!-- Başlık: avatar + isim + unvan + bölüm + genel puan badge -->
              <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--border);">
                <div class="faculty-avatar" style="width:38px;height:38px;font-size:13px;flex-shrink:0;">${initials}</div>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${app.name || 'İsimsiz'}</div>
                  <div style="font-size:11px;color:var(--text-muted);">
                    <span class="badge badge-${app.title || 'dr_ogr_uyesi'}" style="margin-right:4px;">${titleDisp}</span>
                    ${deptName}
                  </div>
                  ${app.previousUniversity ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">Şu an: ${app.previousUniversity}${app.previousDepartment ? ' · ' + app.previousDepartment : ''}</div>` : ''}
                </div>
                <div class="rating-badge-sm ${appRatingClass}" title="Genel Puan">${appOverall}</div>
              </div>

              <!-- Akademik performans istatistikleri -->
              <div style="padding:8px 12px;border-bottom:1px solid var(--border);">
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-muted);letter-spacing:.05em;margin-bottom:6px;">Akademik Performans</div>
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;text-align:center;margin-bottom:8px;">
                  ${[
                    { label: 'Yayın', val: app.publications ?? '—', color: '#3182ce' },
                    { label: 'Atıf',  val: app.citations   ?? '—', color: '#805ad5' },
                    { label: 'h-ind', val: app.hIndex      ?? '—', color: '#38a169' },
                    { label: 'Proje', val: app.activeProjects ?? '—', color: '#dd6b20' },
                  ].map(s => `
                    <div style="background:rgba(255,255,255,0.04);border-radius:6px;padding:5px 2px;">
                      <div style="font-size:14px;font-weight:700;color:${s.color};">${s.val}</div>
                      <div style="font-size:9px;color:var(--text-muted);">${s.label}</div>
                    </div>
                  `).join('')}
                </div>

                <!-- Stat çubukları -->
                ${[
                  { label: 'Araştırma',  val: researchStat, color: '#3182ce' },
                  { label: 'Eğitim',     val: teachingStat, color: '#38a169' },
                  { label: 'Yönetim',    val: manageStat,   color: '#dd6b20' },
                  { label: 'Öğr. Değ.', val: app.teachingScore ?? teachingStat, color: '#805ad5' },
                ].map(s => `
                  <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
                    <span style="width:72px;font-size:10px;color:var(--text-muted);flex-shrink:0;">${s.label}</span>
                    ${statBar(s.val, s.color)}
                    <span style="width:24px;text-align:right;font-size:10px;font-weight:700;color:${s.color};">${s.val}</span>
                  </div>
                `).join('')}
              </div>

              <!-- Eğitim + deneyim -->
              ${app.education ? `
              <div style="padding:6px 12px;border-bottom:1px solid var(--border);font-size:11px;">
                <span style="color:var(--text-muted);">Doktora:</span>
                <strong style="margin-left:4px;">${app.education.phd}</strong>
                <span style="color:var(--text-muted);margin-left:4px;">(${app.education.year})</span>
                ${app.yearsExperience != null ? `<span style="color:var(--text-muted);margin-left:8px;">· Deneyim: <strong>${app.yearsExperience} yıl</strong></span>` : ''}
              </div>
              ` : ''}

              <!-- Verebileceği dersler -->
              ${teachable.length > 0 ? `
              <div style="padding:6px 12px;border-bottom:1px solid var(--border);">
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#3182ce;margin-bottom:4px;letter-spacing:.05em;">Verebileceği Dersler (${teachable.length})</div>
                <div style="display:flex;flex-wrap:wrap;gap:3px;">
                  ${teachable.slice(0, 5).map(c => `
                    <span style="font-size:10px;padding:2px 6px;border-radius:8px;
                          background:rgba(49,130,206,0.1);color:#3182ce;border:1px solid rgba(49,130,206,0.25);">
                      ${c.courseName} <span style="opacity:.65;">${c.type}</span>
                    </span>
                  `).join('')}
                  ${teachable.length > 5 ? `<span style="font-size:10px;color:var(--text-muted);">+${teachable.length - 5} daha</span>` : ''}
                </div>
              </div>
              ` : ''}

              <!-- Araştırma alanları -->
              ${(app.researchAreas || app.specializations || []).length > 0 ? `
              <div style="padding:6px 12px;border-bottom:1px solid var(--border);">
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#805ad5;margin-bottom:4px;letter-spacing:.05em;">Araştırma Alanları</div>
                <div style="display:flex;flex-wrap:wrap;gap:3px;">
                  ${(app.researchAreas || app.specializations || []).map(a => `
                    <span style="font-size:10px;padding:2px 6px;border-radius:8px;
                          background:rgba(128,90,213,0.1);color:#805ad5;border:1px solid rgba(128,90,213,0.25);">
                      ${a}
                    </span>
                  `).join('')}
                </div>
              </div>
              ` : ''}

              <!-- Maaş beklentisi -->
              <div style="padding:6px 12px;border-bottom:1px solid var(--border);font-size:11px;display:flex;align-items:center;gap:8px;">
                <span style="color:var(--text-muted);">Maaş beklentisi:</span>
                <strong style="color:#f5a623;">${formatMoney(app.salaryExpectation)}/ay</strong>
                ${app.salaryRange ? `<span style="font-size:10px;color:var(--text-muted);">(Barem: ${formatMoney(app.salaryRange.min)} – ${formatMoney(app.salaryRange.max)})</span>` : ''}
                ${app.availableIn === 0 ? `<span style="font-size:10px;padding:1px 6px;border-radius:6px;background:rgba(56,161,105,0.15);color:#38a169;margin-left:auto;">Hemen müsait</span>` : `<span style="font-size:10px;padding:1px 6px;border-radius:6px;background:rgba(245,166,35,0.15);color:#f5a623;margin-left:auto;">Gelecek dönem</span>`}
              </div>

              <!-- Değerlendirme -->
              <div style="padding:6px 12px;background:${evalBg};border-bottom:1px solid ${evalBorder};font-size:11px;">
                <div style="font-weight:700;color:${evalColor};margin-bottom:3px;">Değerlendirme: ${evalLabel}</div>
                <div style="color:var(--text-muted);display:flex;flex-direction:column;gap:1px;">
                  <div>${researchAboveAvg ? '✓' : '✗'} Araştırma puanı bölüm ortalamasının ${researchAboveAvg ? 'üstünde' : 'altında'} (ortalama: ${deptAvgResearch})</div>
                  ${teachableCount > 0 ? `<div>✓ ${teachableCount} ders verebilir</div>` : `<div>✗ Mevcut müfredatla ders örtüşmesi yok</div>`}
                  ${app.activeProjects > 0 ? `<div>✓ ${app.activeProjects} aktif proje</div>` : ''}
                </div>
              </div>

              <!-- Butonlar -->
              <div style="display:flex;gap:8px;padding:8px 12px;">
                <button class="btn btn-success" style="flex:1;font-size:11px;justify-content:center;"
                        data-applicant-id="${app.id}" id="btn-accept-${app.id}">
                  ✅ Kabul Et
                </button>
                <button class="btn btn-danger" style="flex:1;font-size:11px;justify-content:center;"
                        data-applicant-id="${app.id}" id="btn-reject-${app.id}">
                  ❌ Reddet
                </button>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>
    ` : ''}

    <!-- İlan Dışı (Spontane) Başvurular -->
    ${spontaneousApplicants.length > 0 ? `
    <div style="background:rgba(128,90,213,0.07);border:1px solid rgba(128,90,213,0.3);border-radius:8px;
                padding:12px 16px;margin-bottom:12px;">
      <div style="font-size:12px;font-weight:700;color:#805ad5;margin-bottom:4px;">
        📬 GELEN BAŞVURULAR (İlan Dışı) — ${spontaneousApplicants.length} başvuru
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px;">
        Saygınlığınız arttıkça daha fazla spontane başvuru alırsınız. Başvurular 2 dönem içinde yanıtlanmazsa çekilir.
      </div>
      <div id="spontaneous-list" style="display:flex;flex-direction:column;gap:12px;">
        ${spontaneousApplicants.map(app => {
          const titleMap2 = { argö: 'ArGö', dr_ogr_uyesi: 'Dr.Öğr.Üyesi', docent: 'Doçent', profesor: 'Profesör' };
          const titleDisp = titleMap2[app.title] || app.title;
          const dept = depts.find(d => d.id === (app.preferredDept || app.department));
          const deptName = dept?.shortName || app.department || '—';
          const stats = app.stats || {};
          const researchStat = stats.research ?? 50;
          const teachingStat = stats.teaching ?? 50;
          const initials = (app.name || '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
          const spontOverall = calculateOverallRating(app);
          const spontRatingClass = spontOverall >= 85 ? 'gold' : spontOverall >= 70 ? 'green' : spontOverall >= 55 ? 'yellow' : 'red';

          const statBar2 = (val, color) => {
            const pct = Math.min(100, Math.max(0, val));
            return `<div style="flex:1;height:5px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:${color};border-radius:3px;"></div>
            </div>`;
          };

          const deptSelectOpts = depts.filter(d => d.isOpen).map(d =>
            `<option value="${d.id}" ${d.id === (app.preferredDept || app.department) ? 'selected' : ''}>${d.shortName || d.name}</option>`
          ).join('');

          const turnsLeft = 2 - ((state.meta?.turn || 1) - (app.applicationDate || (state.meta?.turn || 1)));
          const urgencyColor = turnsLeft <= 1 ? '#e53e3e' : '#f5a623';

          return `
            <div style="background:var(--bg-secondary);border-radius:8px;border:1px solid rgba(128,90,213,0.2);overflow:hidden;">
              <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--border);">
                <div class="faculty-avatar" style="width:38px;height:38px;font-size:13px;flex-shrink:0;background:rgba(128,90,213,0.3);">${initials}</div>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:13px;font-weight:700;">${app.name || 'İsimsiz'}</div>
                  <div style="font-size:11px;color:var(--text-muted);">
                    <span class="badge badge-${app.title || 'dr_ogr_uyesi'}" style="margin-right:4px;">${titleDisp}</span>
                    Tercih: ${deptName}
                  </div>
                  ${app.previousUniversity ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">Şu an: ${app.previousUniversity}</div>` : ''}
                </div>
                <div class="rating-badge-sm ${spontRatingClass}" title="Genel Puan" style="margin-right:4px;">${spontOverall}</div>
                <div style="font-size:10px;color:${urgencyColor};font-weight:700;white-space:nowrap;">${turnsLeft} dönem kaldı</div>
              </div>

              <div style="padding:8px 12px;border-bottom:1px solid var(--border);">
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;text-align:center;margin-bottom:6px;">
                  ${[
                    { label: 'Yayın', val: app.publications ?? 0, color: '#3182ce' },
                    { label: 'Atıf',  val: app.citations   ?? 0, color: '#805ad5' },
                    { label: 'h-ind', val: app.hIndex      ?? 0, color: '#38a169' },
                    { label: 'Proje', val: app.activeProjects ?? 0, color: '#dd6b20' },
                  ].map(s => `
                    <div style="background:rgba(255,255,255,0.04);border-radius:6px;padding:4px 2px;">
                      <div style="font-size:13px;font-weight:700;color:${s.color};">${s.val}</div>
                      <div style="font-size:9px;color:var(--text-muted);">${s.label}</div>
                    </div>
                  `).join('')}
                </div>
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
                  <span style="width:72px;font-size:10px;color:var(--text-muted);">Araştırma</span>
                  ${statBar2(researchStat, '#3182ce')}
                  <span style="width:24px;text-align:right;font-size:10px;font-weight:700;color:#3182ce;">${researchStat}</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                  <span style="width:72px;font-size:10px;color:var(--text-muted);">Eğitim</span>
                  ${statBar2(teachingStat, '#38a169')}
                  <span style="width:24px;text-align:right;font-size:10px;font-weight:700;color:#38a169;">${teachingStat}</span>
                </div>
              </div>

              <div style="padding:8px 12px;border-bottom:1px solid var(--border);font-size:11px;">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                  <span style="color:var(--text-muted);">Maaş beklentisi:</span>
                  <strong style="color:#f5a623;">${formatMoney(app.salaryExpectation)}/ay</strong>
                  ${app.salaryRange ? `<span style="font-size:10px;color:var(--text-muted);">(Barem: ${formatMoney(app.salaryRange.min)}–${formatMoney(app.salaryRange.max)})</span>` : ''}
                </div>
              </div>

              <!-- Bölüm seçici -->
              <div style="padding:8px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;font-size:11px;">
                <span style="color:var(--text-muted);flex-shrink:0;">Bölüm ata:</span>
                <select class="filter-select" id="spont-dept-${app.id}" style="flex:1;font-size:11px;padding:3px 6px;">
                  ${deptSelectOpts}
                </select>
              </div>

              <div style="display:flex;gap:8px;padding:8px 12px;">
                <button class="btn btn-success" style="flex:1;font-size:11px;justify-content:center;"
                        data-spont-id="${app.id}" id="btn-spont-accept-${app.id}">
                  Kabul Et
                </button>
                <button class="btn btn-danger" style="flex:1;font-size:11px;justify-content:center;"
                        data-spont-id="${app.id}" id="btn-spont-reject-${app.id}">
                  Reddet
                </button>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>
    ` : ''}

    <!-- Açık ilanlar (varsa) -->
    ${openPositions.length > 0 ? `
    <div style="background:rgba(49,130,206,0.07);border:1px solid rgba(49,130,206,0.25);border-radius:8px;
                padding:10px 16px;margin-bottom:12px;">
      <div style="font-size:12px;font-weight:700;color:#3182ce;margin-bottom:6px;">
        Aktif Ilanlar (${openPositions.length})
      </div>
      ${openPositions.map(pos => {
        const dept = depts.find(d => d.id === pos.department);
        const titleDisp = titleMap[pos.title] || pos.title;
        return `
          <div style="display:flex;align-items:center;gap:8px;font-size:11px;margin-bottom:4px;">
            <span style="color:#3182ce;">•</span>
            <span>${titleDisp} — ${dept?.shortName || pos.department} (${pos.allFields ? 'Tüm Alanlar' : (pos.fields && pos.fields.length > 0 ? pos.fields.join(', ') : pos.field || '')})</span>
            <span style="color:var(--text-muted);">${formatMoney(pos.offeredSalary)}/ay</span>
          </div>`;
      }).join('')}
    </div>
    ` : ''}

    <div class="filter-bar" style="flex-wrap:wrap;gap:6px;">
      <select class="filter-select" id="faculty-filter-dept">
        <option value="">Tüm Bölümler</option>
        ${deptOpts}
      </select>
      <select class="filter-select" id="faculty-filter-title">
        <option value="">Tüm Unvanlar</option>
        <option value="profesor">Profesör</option>
        <option value="docent">Doçent</option>
        <option value="dr_ogr_uyesi">Dr. Öğr. Üyesi</option>
        <option value="argö">Araştırma Görevlisi</option>
      </select>
      <input type="text" class="search-input" id="faculty-search"
             placeholder="İsim veya alan ara...">
      <span class="text-muted" id="faculty-count-label"
            style="font-size:12px;margin-left:4px;">
        ${faculty.length} hoca
      </span>
      <div style="margin-left:auto;display:flex;gap:4px;">
        <button id="btn-faculty-view-card" class="btn btn-sm" style="font-size:11px;padding:4px 10px;background:var(--accent);color:var(--bg-primary);border:none;">
          Kart
        </button>
        <button id="btn-faculty-view-list" class="btn btn-sm btn-secondary" style="font-size:11px;padding:4px 10px;">
          Liste
        </button>
      </div>
    </div>

    <div id="faculty-view-container">
      <div class="faculty-grid" id="faculty-grid">
        ${faculty.map(f => renderFacultyCard(f, depts)).join('')}
      </div>
    </div>
  `;

  // Transfer pazarı
  on(el('btn-open-transfer'), 'click', () => {
    if (onTransferMarket) onTransferMarket();
  });

  // Kadro ilanı ver
  on(el('btn-open-position'), 'click', () => {
    if (onOpenPosition) onOpenPosition();
  });

  // Feature 2: Yeni Bölüm / Program Aç
  on(el('btn-new-dept-program'), 'click', () => {
    showNewDeptProgramModal(state);
  });

  // Hoca kartı tıklama
  delegate(el('faculty-view-container'), '.faculty-card', 'click', (e, card) => {
    const fid = card.dataset.facultyId;
    if (fid && onFacultyDetail) onFacultyDetail(fid);
  });

  // Liste görünümü satır tıklama
  delegate(el('faculty-view-container'), '.faculty-list-row', 'click', (e, row) => {
    const fid = row.dataset.facultyId;
    if (fid && onFacultyDetail) onFacultyDetail(fid);
  });

  // Görünüm toggle
  let _currentView = 'card';
  let _sortKey = null;
  let _sortAsc = true;

  function _getFilteredFaculty() {
    const deptF  = el('faculty-filter-dept')?.value || '';
    const titleF = el('faculty-filter-title')?.value || '';
    const search = (el('faculty-search')?.value || '').toLowerCase();
    return faculty.filter(f => {
      if (deptF  && f.department !== deptF) return false;
      if (titleF && f.title !== titleF) return false;
      if (search && !f.name.toLowerCase().includes(search) &&
          !f.field?.toLowerCase().includes(search)) return false;
      return true;
    });
  }

  function _renderCurrentView() {
    const filtered = _getFilteredFaculty();
    const container = el('faculty-view-container');
    const countLabel = el('faculty-count-label');
    if (countLabel) countLabel.textContent = `${filtered.length} hoca`;

    if (_currentView === 'list') {
      // Sırala
      let sorted = [...filtered];
      if (_sortKey) {
        sorted.sort((a, b) => {
          let va, vb;
          if (_sortKey === 'name') { va = a.name || ''; vb = b.name || ''; }
          else if (_sortKey === 'title') { va = a.title || ''; vb = b.title || ''; }
          else if (_sortKey === 'dept') { va = (depts.find(d => d.id === a.department)?.shortName || a.department || ''); vb = (depts.find(d => d.id === b.department)?.shortName || b.department || ''); }
          else if (_sortKey === 'rating') { va = calculateOverallRating(a); vb = calculateOverallRating(b); }
          else if (_sortKey === 'research') { va = a.stats?.research ?? 50; vb = b.stats?.research ?? 50; }
          else if (_sortKey === 'teaching') { va = a.stats?.teaching ?? 50; vb = b.stats?.teaching ?? 50; }
          else if (_sortKey === 'management') { va = a.stats?.management ?? 50; vb = b.stats?.management ?? 50; }
          else if (_sortKey === 'publications') { va = a.publications ?? 0; vb = b.publications ?? 0; }
          else if (_sortKey === 'citations') { va = a.citations ?? 0; vb = b.citations ?? 0; }
          else if (_sortKey === 'salary') { va = a.salary ?? 0; vb = b.salary ?? 0; }
          else if (_sortKey === 'courses') { va = (a.currentLoad?.assignedCourses || []).length; vb = (b.currentLoad?.assignedCourses || []).length; }
          else { va = 0; vb = 0; }
          if (typeof va === 'string') return _sortAsc ? va.localeCompare(vb, 'tr') : vb.localeCompare(va, 'tr');
          return _sortAsc ? va - vb : vb - va;
        });
      }

      function ratingColor(val) {
        if (val >= 85) return '#d4af37';
        if (val >= 70) return 'var(--accent-green)';
        if (val >= 55) return 'var(--accent-yellow,#f5a623)';
        return 'var(--accent-red,#e53e3e)';
      }

      function colHead(key, label) {
        const isCurrent = _sortKey === key;
        const arrow = isCurrent ? (_sortAsc ? ' ▲' : ' ▼') : '';
        return `<th class="faculty-list-th" data-sort-key="${key}" style="cursor:pointer;white-space:nowrap;padding:6px 8px;font-size:10px;text-transform:uppercase;color:${isCurrent ? 'var(--accent-green)' : 'var(--text-muted)'};text-align:left;">${label}${arrow}</th>`;
      }

      const titleMapDisp = { argö: 'ArGö', dr_ogr_uyesi: 'Dr.Öğr.Üy.', docent: 'Doç.', profesor: 'Prof. Dr.' };

      // Özet istatistikler
      const totalPubs = sorted.reduce((s, f) => s + (f.publications || 0), 0);
      const totalSalary = sorted.reduce((s, f) => s + (f.salary || 0), 0);
      const avgRating = sorted.length > 0
        ? Math.round(sorted.reduce((s, f) => s + calculateOverallRating(f), 0) / sorted.length)
        : 0;

      container.innerHTML = `
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr style="border-bottom:2px solid var(--border);">
                <th style="padding:6px 8px;font-size:10px;color:var(--text-muted);text-align:left;">#</th>
                ${colHead('name','İsim')}
                ${colHead('title','Unvan')}
                ${colHead('dept','Bölüm')}
                ${colHead('rating','Genel')}
                ${colHead('research','Araş.')}
                ${colHead('teaching','Eğt.')}
                ${colHead('management','Yön.')}
                ${colHead('publications','Yayın')}
                ${colHead('citations','Atıf')}
                ${colHead('salary','Maaş')}
                ${colHead('courses','Ders')}
                <th style="padding:6px 8px;font-size:10px;color:var(--text-muted);text-align:left;">Durum</th>
              </tr>
            </thead>
            <tbody>
              ${sorted.map((f, idx) => {
                const dept  = depts.find(d => d.id === f.department);
                const r     = calculateOverallRating(f);
                const isHead = f.id === dept?.headId;
                const statusText = isHead ? 'Böl.Bşk.' : (f.promotionEligible ? 'Terfi Hak.' : '—');
                return `<tr class="faculty-list-row" data-faculty-id="${f.id}"
                  style="border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s;"
                  onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background=''">
                  <td style="padding:6px 8px;color:var(--text-muted);">${idx + 1}</td>
                  <td style="padding:6px 8px;font-weight:600;">${renderFacultyAvatar(f)} ${f.name}</td>
                  <td style="padding:6px 8px;color:var(--text-muted);">${titleMapDisp[f.title] || f.title}</td>
                  <td style="padding:6px 8px;">${dept?.shortName || f.department || '—'}</td>
                  <td style="padding:6px 8px;font-weight:700;color:${ratingColor(r)};">${r}</td>
                  <td style="padding:6px 8px;color:${ratingColor(f.stats?.research ?? 50)};">${f.stats?.research ?? '—'}</td>
                  <td style="padding:6px 8px;color:${ratingColor(f.stats?.teaching ?? 50)};">${f.stats?.teaching ?? '—'}</td>
                  <td style="padding:6px 8px;color:${ratingColor(f.stats?.management ?? 50)};">${f.stats?.management ?? '—'}</td>
                  <td style="padding:6px 8px;">${f.publications ?? 0}</td>
                  <td style="padding:6px 8px;">${f.citations ?? 0}</td>
                  <td style="padding:6px 8px;white-space:nowrap;">${formatMoney(f.salary)}/ay</td>
                  <td style="padding:6px 8px;">${(f.currentLoad?.assignedCourses || []).length}</td>
                  <td style="padding:6px 8px;font-size:11px;color:${isHead ? 'var(--accent-green)' : f.promotionEligible ? '#f5a623' : 'var(--text-muted)'};">${statusText}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div style="background:var(--bg-secondary);border-radius:6px;padding:8px 12px;margin-top:8px;font-size:11px;display:flex;gap:16px;flex-wrap:wrap;">
          <span>Toplam ${sorted.length} hoca</span>
          <span>Ortalama Genel Puan: <strong>${avgRating}</strong></span>
          <span>Toplam Yayın: <strong>${totalPubs}</strong></span>
          <span>Aylık Maaş Gideri: <strong style="color:var(--accent-red,#e53e3e);">${formatMoney(totalSalary)}/ay</strong></span>
        </div>
      `;

      // Sıralama başlık tıklama
      qsa('.faculty-list-th').forEach(th => {
        th.addEventListener('click', () => {
          const key = th.dataset.sortKey;
          if (_sortKey === key) {
            _sortAsc = !_sortAsc;
          } else {
            _sortKey = key;
            _sortAsc = false; // ilk tıklamada azalan
          }
          _renderCurrentView();
        });
      });

    } else {
      // Kart görünümü
      const grid = el('faculty-grid');
      if (grid) {
        grid.innerHTML = filtered.map(f => renderFacultyCard(f, depts)).join('');
      } else {
        container.innerHTML = `<div class="faculty-grid" id="faculty-grid">${filtered.map(f => renderFacultyCard(f, depts)).join('')}</div>`;
      }
    }
  }

  // Filtre fonksiyonunu güncelle (view farkındalı)
  on(el('faculty-filter-dept'),  'change', _renderCurrentView);
  on(el('faculty-filter-title'), 'change', _renderCurrentView);
  on(el('faculty-search'), 'input', _renderCurrentView);

  on(el('btn-faculty-view-card'), 'click', () => {
    _currentView = 'card';
    el('btn-faculty-view-card')?.classList.remove('btn-secondary');
    el('btn-faculty-view-card')?.setAttribute('style', 'font-size:11px;padding:4px 10px;background:var(--accent);color:var(--bg-primary);border:none;');
    el('btn-faculty-view-list')?.classList.add('btn-secondary');
    el('btn-faculty-view-list')?.setAttribute('style', 'font-size:11px;padding:4px 10px;');
    _renderCurrentView();
  });

  on(el('btn-faculty-view-list'), 'click', () => {
    _currentView = 'list';
    el('btn-faculty-view-list')?.classList.remove('btn-secondary');
    el('btn-faculty-view-list')?.setAttribute('style', 'font-size:11px;padding:4px 10px;background:var(--accent);color:var(--bg-primary);border:none;');
    el('btn-faculty-view-card')?.classList.add('btn-secondary');
    el('btn-faculty-view-card')?.setAttribute('style', 'font-size:11px;padding:4px 10px;');
    _renderCurrentView();
  });

  // Başvuru kabul / ret butonları — event delegation
  const appsList = el('applications-list');
  if (appsList) {
    appsList.addEventListener('click', (e) => {
      const acceptBtn = e.target.closest('[id^="btn-accept-"]');
      const rejectBtn = e.target.closest('[id^="btn-reject-"]');
      if (acceptBtn) {
        const appId = acceptBtn.dataset.applicantId;
        if (onFacultyDetail && typeof onFacultyDetail._onAcceptApplicant === 'function') {
          onFacultyDetail._onAcceptApplicant(appId);
        } else {
          panel.dispatchEvent(new CustomEvent('accept-applicant', { detail: { appId }, bubbles: true }));
        }
      }
      if (rejectBtn) {
        const appId = rejectBtn.dataset.applicantId;
        panel.dispatchEvent(new CustomEvent('reject-applicant', { detail: { appId }, bubbles: true }));
      }
    });
  }

  // Spontane başvuru kabul / ret butonları
  const spontList = el('spontaneous-list');
  if (spontList) {
    spontList.addEventListener('click', (e) => {
      const acceptBtn = e.target.closest('[id^="btn-spont-accept-"]');
      const rejectBtn = e.target.closest('[id^="btn-spont-reject-"]');
      if (acceptBtn) {
        const appId = acceptBtn.dataset.spontId;
        const deptSelect = el(`spont-dept-${appId}`);
        const targetDeptId = deptSelect ? deptSelect.value : null;
        panel.dispatchEvent(new CustomEvent('accept-spontaneous', { detail: { appId, targetDeptId }, bubbles: true }));
      }
      if (rejectBtn) {
        const appId = rejectBtn.dataset.spontId;
        panel.dispatchEvent(new CustomEvent('reject-spontaneous', { detail: { appId }, bubbles: true }));
      }
    });
  }
}

/**
 * Tek hoca kartı HTML'i üretir.
 * @param {object} f     — Hoca objesi
 * @param {Array}  depts — Bölüm listesi
 * @returns {string} HTML string
 */
export function renderFacultyCard(f, depts = []) {
  const dept = depts.find(d => d.id === f.department) ||
               (f.departmentId ? depts.find(d => d.id === f.departmentId) : null);
  const deptName  = dept?.shortName || f.department || '—';
  const titleMap  = { argö: 'ArGö', dr_ogr_uyesi: 'Dr.Öğr.Üyesi', docent: 'Doçent', profesor: 'Prof.' };
  const titleKey  = f.title || 'dr_ogr_uyesi';
  const titleDisp = titleMap[titleKey] || f.title;
  const initials  = (f.name || '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const happiness = f.happiness ?? 60;
  const happClass = happiness >= 70 ? 'high' : happiness >= 45 ? 'mid' : 'low';

  // Feature 3: Genel puan ve trend
  const overallRating = f.overallRating || calculateOverallRating(f);
  const ratingTrend   = getFacultyRatingTrend(f);
  const ratingColor   = overallRating >= 85 ? '#d4af37' : overallRating >= 70 ? '#38a169' : overallRating >= 55 ? '#f5a623' : '#e53e3e';
  const ratingBg      = overallRating >= 85 ? 'rgba(212,175,55,0.12)' : overallRating >= 70 ? 'rgba(56,161,105,0.12)' : overallRating >= 55 ? 'rgba(245,166,35,0.12)' : 'rgba(229,62,62,0.12)';

  // Feature 5: Avatar
  const avatarHtml = f.avatar
    ? renderFacultyAvatar(f.avatar, 48)
    : `<div class="faculty-avatar">${initials}</div>`;

  const stats = f.stats || {};
  const statDefs = [
    { key: 'research',   label: 'Araştırma' },
    { key: 'teaching',   label: 'Eğitim' },
    { key: 'management', label: 'Yönetim' },
    { key: 'mentoring',  label: 'Mentorluk' },
    { key: 'popularity', label: 'Popülarite' },
    { key: 'loyalty',    label: 'Sadakat' },
    { key: 'motivation', label: 'Motivasyon' },
  ];

  // Belirsizlik kontrolü (henüz kesinleşmemiş statlar)
  const revealed = f.revealed || {};

  return `
    <div class="faculty-card" data-faculty-id="${f.id}" style="cursor:pointer;">
      <div class="faculty-card-header">
        <div style="flex-shrink:0;border-radius:50%;overflow:hidden;width:48px;height:48px;">${avatarHtml}</div>
        <div class="faculty-card-info" style="flex:1;min-width:0;">
          <div class="faculty-name">${f.name || 'İsimsiz'}</div>
          <div class="faculty-meta">
            <span class="badge badge-${titleKey}">${titleDisp}</span>
            <span class="faculty-dept">${deptName}</span>
            <span class="faculty-age">${f.age ? f.age + ' yaş' : ''}</span>
          </div>
          <div class="faculty-meta" style="margin-top:3px;">
            <span class="badge badge-default">${f.archetype || '—'}</span>
            ${f.field ? `<span class="faculty-field">${f.field}</span>` : ''}
          </div>
        </div>
        <!-- Feature 3: Genel Puan -->
        <div style="text-align:center;padding:4px 8px;border-radius:8px;background:${ratingBg};flex-shrink:0;">
          <div style="font-size:18px;font-weight:800;color:${ratingColor};line-height:1;">${overallRating}</div>
          <div style="font-size:11px;font-weight:700;color:${ratingTrend.color};">${ratingTrend.arrow}</div>
          <div style="font-size:9px;color:var(--text-muted);">Puan</div>
        </div>
      </div>

      <div class="faculty-card-stats">
        ${statDefs.map(s => {
          const val = stats[s.key] ?? 50;
          // Research ve teaching için belirsizlik aralığı
          const isUncertain = (s.key === 'research' || s.key === 'teaching') &&
                              revealed[s.key] && !revealed[s.key].exact;
          const displayVal = isUncertain
            ? `${revealed[s.key].min}-${revealed[s.key].max}`
            : val;
          return createStatBar(s.label, val, 100, _statColor(val), isUncertain, displayVal);
        }).join('')}
      </div>

      <!-- Uzmanlık alanları -->
      ${(f.specializations && f.specializations.length > 0) ? `
        <div style="padding:6px 12px;display:flex;flex-wrap:wrap;gap:4px;border-top:1px solid var(--border);">
          ${f.specializations.map(s => `
            <span style="font-size:10px;padding:2px 6px;border-radius:10px;
                  background:var(--bg-secondary);color:var(--text-muted);border:1px solid var(--border);">
              ${s}
            </span>
          `).join('')}
        </div>
      ` : ''}

      <!-- Atanmış dersler -->
      ${(() => {
        const courses = (f.currentLoad?.assignedCourses || []);
        if (courses.length === 0) {
          return `<div style="padding:6px 12px;font-size:11px;color:var(--text-faint);border-top:1px solid var(--border);">
            Atanmış ders yok
          </div>`;
        }
        return `<div style="padding:6px 12px;border-top:1px solid var(--border);">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px;">
            Dersler (${courses.length})
          </div>
          ${courses.map(c => {
            const matchColor = c.matchQuality === 2 ? 'var(--accent-green)' : c.matchQuality === 1 ? 'var(--accent-yellow, #f5a623)' : 'var(--accent-red, #e53e3e)';
            const matchIcon  = c.matchQuality === 2 ? '✓' : c.matchQuality === 1 ? '~' : '✗';
            return `<div style="font-size:11px;display:flex;align-items:center;gap:4px;margin-bottom:2px;">
              <span style="color:${matchColor};font-weight:700;">${matchIcon}</span>
              <span style="color:var(--text-primary);">${c.courseName}</span>
              <span style="margin-left:auto;font-size:10px;color:var(--text-faint);">${c.type === 'zorunlu' ? 'Z' : 'S'}</span>
            </div>`;
          }).join('')}
        </div>`;
      })()}

      <!-- Maaş uyarısı & Yükseltme rozeti -->
      ${(f._salaryUnhappy || f.promotionEligible || (f.activeAwards && f.activeAwards.length > 0)) ? `
      <div style="padding:4px 12px;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;gap:4px;">
        ${f._salaryUnhappy ? `<span style="font-size:10px;padding:2px 6px;border-radius:6px;background:rgba(229,62,62,0.12);color:#e53e3e;border:1px solid rgba(229,62,62,0.3);">⚠ Maaş memnuniyetsizliği</span>` : ''}
        ${f.promotionEligible ? `<span style="font-size:10px;padding:2px 6px;border-radius:6px;background:rgba(56,161,105,0.12);color:#38a169;border:1px solid rgba(56,161,105,0.3);">🎓 Yükseltme Uygun!</span>` : ''}
        ${f._promotionAnxiety ? `<span style="font-size:10px;padding:2px 6px;border-radius:6px;background:rgba(245,166,35,0.12);color:#f5a623;border:1px solid rgba(245,166,35,0.3);">⏳ Yükseltme bekliyor</span>` : ''}
        ${(f.activeAwards || []).map(a => `<span style="font-size:10px;padding:2px 6px;border-radius:6px;background:rgba(128,90,213,0.12);color:#805ad5;border:1px solid rgba(128,90,213,0.3);">🏆 ${a.label}</span>`).join('')}
      </div>
      ` : ''}

      <div class="faculty-card-footer">
        <div class="faculty-salary">
          Maaş: <strong>${formatMoney(f.salary)}/ay</strong>
          ${f.salaryRange ? `<span style="font-size:9px;color:var(--text-muted);margin-left:4px;">(${formatMoney(f.salaryRange.min)}-${formatMoney(f.salaryRange.max)})</span>` : ''}
        </div>
        <div class="faculty-pubs">
          📄 ${f.publications ?? 0}
          ${f.hIndex ? `&nbsp;H:${f.hIndex}` : ''}
        </div>
        <div class="tooltip-host">
          <div class="happiness-dot ${happClass}"></div>
          <div class="tooltip">Mutluluk: ${happiness}/100</div>
        </div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// AKREDİTASYON UI YARDIMCISI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bir bölümün akreditasyon durumunu gösteren HTML döndürür.
 */
function renderDeptAccreditation(dept, state) {
  const accData = dept.accreditation;
  if (!accData) return '';

  const turn = state?.meta?.turn || 1;
  const semester = state?.meta?.semester || 'güz';
  const year = state?.meta?.year || 1;

  function turnToLabel(t) {
    // t = 1 → Yıl 1, Güz; t = 2 → Yıl 1, Bahar; ...
    const y = Math.ceil(t / 2);
    const s = (t % 2 === 1) ? 'Güz' : 'Bahar';
    return `${y}. Yıl ${s}`;
  }

  const grantedBadges = [];
  const pendingBadges = [];
  const availableButtons = [];

  Object.entries(ACCREDITATION_BODIES).forEach(([bodyId, body]) => {
    // Bu bölüm için geçerli mi?
    const applicable = body.applicableTo.includes('all') ||
                       body.applicableTo.includes(dept.category || '');
    if (!applicable) return;

    const acc = accData[bodyId];
    if (!acc) return;

    if (acc.status === 'granted') {
      const remaining = acc.expiresAt != null ? (acc.expiresAt - turn) : '?';
      const expLabel = acc.expiresAt != null ? turnToLabel(acc.expiresAt) : '—';
      const urgentClass = (typeof remaining === 'number' && remaining <= 2) ? ' acc-badge-urgent' : '';
      grantedBadges.push(`
        <div class="accreditation-badge acc-granted${urgentClass}">
          <span>${body.icon} ${body.name} Akredite</span>
          <span class="acc-badge-info">Bitiş: ${expLabel} (${remaining} dönem kaldı)</span>
          ${remaining <= 2 ? `<button class="btn btn-xs btn-warning acc-renew-btn"
            data-dept-id="${dept.id}" data-body-id="${bodyId}">🔄 Yenile (${(body.renewalCost/1000).toFixed(0)}K ₺)</button>` : ''}
        </div>`);
    } else if (acc.status === 'applied' || acc.status === 'under_review') {
      const elapsed = turn - (acc.appliedAt || turn);
      const pt = acc.processTime || body.processingTime.max;
      pendingBadges.push(`
        <div class="accreditation-badge acc-pending">
          ${body.icon} ${body.name} — Değerlendirme sürüyor (${elapsed}/${pt} dönem)
        </div>`);
    } else if (acc.status === 'expired') {
      availableButtons.push(`
        <button class="btn btn-sm btn-warning acc-apply-btn"
          data-dept-id="${dept.id}" data-body-id="${bodyId}">
          ${body.icon} ${body.name} Yenile (${(body.renewalCost/1000).toFixed(0)}K ₺)
        </button>`);
    } else if (acc.status === 'rejected') {
      availableButtons.push(`
        <button class="btn btn-sm btn-secondary acc-apply-btn"
          data-dept-id="${dept.id}" data-body-id="${bodyId}">
          ${body.icon} ${body.name} Tekrar Başvur (${(body.cost/1000).toFixed(0)}K ₺)
        </button>`);
    } else {
      // none
      availableButtons.push(`
        <button class="btn btn-sm btn-secondary acc-apply-btn"
          data-dept-id="${dept.id}" data-body-id="${bodyId}">
          ${body.icon} ${body.name} Başvurusu (${(body.cost/1000).toFixed(0)}K ₺)
        </button>`);
    }
  });

  if (grantedBadges.length === 0 && pendingBadges.length === 0 && availableButtons.length === 0) {
    return '';
  }

  return `
    <div class="dept-accreditation" style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px;">
      <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:6px;">📋 Akreditasyon</div>
      ${grantedBadges.join('')}
      ${pendingBadges.join('')}
      ${availableButtons.length > 0 ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">${availableButtons.join('')}</div>` : ''}
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2b. BÖLÜMLER PANELİ (Fakülte yapısı + Bölüm başkanı + Kadro tablosu)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bölümler sekmesi: fakülte hiyerarşisi, bölüm başkanı atama, hoca listesi.
 * @param {object}   state              — Oyun durumu
 * @param {Function} onAssignHead       — Bölüm başkanı atama callback (deptId, facultyId)
 * @param {Function} onReassignFaculty  — Hoca bölüm değiştirme callback (facultyId, newDeptId)
 */
export function renderBolumlerPanel(state, onAssignHead, onReassignFaculty) {
  const panel = el('tab-bolumler');
  if (!panel) return;

  const depts      = state.departments || [];
  const faculty    = state.faculty || [];
  const fakulteler = state.fakulteler || {};

  const titleLabels = {
    argö:         'Arş. Gör.',
    dr_ogr_uyesi: 'Dr. Öğr. Üyesi',
    docent:       'Doç. Dr.',
    profesor:     'Prof. Dr.',
  };

  // Fakülteye ait olmayan bölümler için sahte fakülte grubu
  const assignedDepts = new Set();
  for (const f of Object.values(fakulteler)) {
    for (const dId of f.departments) assignedDepts.add(dId);
  }
  const unassignedDepts = depts.filter(d => !assignedDepts.has(d.id));

  // Fakülte gruplarını oluştur
  const fakGroups = [];
  for (const [fId, fData] of Object.entries(FACULTIES)) {
    const activeDepts = depts.filter(d => fData.departments.includes(d.id));
    if (activeDepts.length === 0) continue;
    fakGroups.push({ id: fId, name: fData.name, icon: fData.icon, depts: activeDepts });
  }
  if (unassignedDepts.length > 0) {
    fakGroups.push({ id: 'diger', name: 'Diğer Bölümler', icon: '🏫', depts: unassignedDepts });
  }

  /**
   * Tek bölüm kartı HTML üretir
   */
  function deptCard(dept) {
    const deptFaculty = faculty.filter(f => f.department === dept.id);
    const head        = dept.headId ? faculty.find(f => f.id === dept.headId) : null;
    const headName    = head ? `${head.name} (Yönetim: ${head.stats?.management ?? '—'}/100)` : 'Atanmamış ⚠️';
    const headClass   = head ? '' : 'text-warn';

    const profCount   = deptFaculty.filter(f => f.title === 'profesor').length;
    const docCount    = deptFaculty.filter(f => f.title === 'docent').length;
    const drCount     = deptFaculty.filter(f => f.title === 'dr_ogr_uyesi').length;
    const argoCount   = deptFaculty.filter(f => f.title === 'argö').length;

    // Öğrenci sayısı
    const byDept     = state.students?.byDepartment?.[dept.id];
    const y1 = byDept?.year1?.count || 0;
    const y2 = byDept?.year2?.count || 0;
    const y3 = byDept?.year3?.count || 0;
    const y4 = byDept?.year4?.count || 0;
    const totalStudents = y1 + y2 + y3 + y4;

    // Hoca/öğrenci oranı
    const ratio = deptFaculty.length > 0 ? (totalStudents / deptFaculty.length).toFixed(0) : '—';
    const ratioWarn = deptFaculty.length > 0 && (totalStudents / deptFaculty.length) > 30;

    // Ağırlıklı ort. GPA (öğrenci sayısına göre)
    const _gpaYears = ['year1', 'year2', 'year3', 'year4'];
    let _gpaSum = 0, _gpaCnt = 0;
    for (const yk of _gpaYears) {
      const yd = byDept?.[yk];
      if (yd && yd.count > 0 && yd.avgGPA > 0) { _gpaSum += yd.avgGPA * yd.count; _gpaCnt += yd.count; }
    }
    const avgGPA = _gpaCnt > 0 ? (_gpaSum / _gpaCnt).toFixed(2) : '—';

    // Ort. YKS
    const yks = byDept?.year1?.avgYKS || byDept?.avgYKS || 0;
    const avgYKS = yks > 0 ? formatNumber(yks) : '—';

    // Memnuniyet
    const satisfaction = dept.studentSatisfaction ?? 50;
    const satColor = satisfaction >= 70 ? 'var(--accent-green)' : satisfaction >= 45 ? 'var(--accent-yellow,#f5a623)' : 'var(--accent-red,#e53e3e)';

    // Bölüm başkanı adayları için seçim kutusu
    const headCandidates = deptFaculty.filter(f => ['profesor', 'docent'].includes(f.title));
    const headSelectOptions = headCandidates.map(f =>
      `<option value="${f.id}" ${f.id === dept.headId ? 'selected' : ''}>
        ${titleLabels[f.title] || f.title} ${f.name} (Yönetim: ${f.stats?.management ?? '—'})
      </option>`
    ).join('');

    // Feature 3: Bölüm ortalama puan
    const deptAvgRating = getDeptAvgRating(dept.id, faculty);
    const avgRatingColor = deptAvgRating >= 70 ? '#38a169' : deptAvgRating >= 55 ? '#f5a623' : '#e53e3e';

    // Hoca tablosu
    const facultyRows = deptFaculty.map(f => {
      const isHead = f.id === dept.headId;
      const role   = isHead ? '<span class="badge badge-success">Başkan</span>' : '—';
      const load   = f.currentLoad?.courses ?? 0;
      const fRating = f.overallRating || calculateOverallRating(f);
      const fTrend  = getFacultyRatingTrend(f);
      const fRatingColor = fRating >= 85 ? '#d4af37' : fRating >= 70 ? '#38a169' : fRating >= 55 ? '#f5a623' : '#e53e3e';
      return `<tr>
        <td>${f.name}</td>
        <td><span class="badge badge-${f.title}">${titleLabels[f.title] || f.title}</span></td>
        <td class="text-right">${f.stats?.research ?? '—'}</td>
        <td class="text-right">${f.stats?.teaching ?? '—'}</td>
        <td class="text-right">${f.stats?.management ?? '—'}</td>
        <td class="text-right">${load} ders</td>
        <td class="text-center" style="font-weight:700;color:${fRatingColor};">${fRating} <span style="color:${fTrend.color};font-size:11px;">${fTrend.arrow}</span></td>
        <td class="text-center">${role}</td>
        <td class="text-right">
          <button class="btn btn-xs btn-secondary btn-reassign-faculty"
                  data-faculty-id="${f.id}" data-current-dept="${dept.id}"
                  title="Bölüm değiştir">Taşı</button>
        </td>
      </tr>`;
    }).join('') || `<tr><td colspan="9" class="text-muted text-center">Bu bölümde hoca yok</td></tr>`;

    return `
      <div class="card dept-detail-card" data-dept-id="${dept.id}" style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
          <div>
            <span style="font-size:18px;">${dept.icon || '🏛️'}</span>
            <strong style="font-size:15px;">${dept.name}</strong>
            <span class="badge badge-default" style="margin-left:6px;">${dept.accreditationStatus || 'pending'}</span>
          </div>
          <!-- Feature 3: Bölüm ort. puan -->
          <div style="text-align:center;padding:4px 10px;border-radius:8px;background:rgba(56,161,105,0.08);border:1px solid rgba(56,161,105,0.2);">
            <div style="font-size:18px;font-weight:800;color:${avgRatingColor};">${deptAvgRating}</div>
            <div style="font-size:9px;color:var(--text-muted);">Ort. Puan</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-bottom:12px;font-size:13px;">
          <div>
            <span class="text-muted">Bölüm Başkanı:</span><br>
            <span class="${headClass}" style="font-weight:600;">${headName}</span>
          </div>
          <div>
            <span class="text-muted">Kadro:</span><br>
            ${deptFaculty.length} hoca
            <span class="text-muted">(${profCount} Prof, ${docCount} Doç, ${drCount} Dr.Öğr.Üyesi, ${argoCount} ArGö)</span>
          </div>
          <div>
            <span class="text-muted">Öğrenciler:</span><br>
            ${formatNumber(totalStudents)}
            <span class="text-muted">(1.sn:${y1}, 2.sn:${y2}, 3.sn:${y3}, 4.sn:${y4})</span>
          </div>
          <div>
            <span class="text-muted">Hoca/Öğrenci:</span><br>
            <span style="color:${ratioWarn ? 'var(--accent-yellow,#f5a623)' : 'inherit'};">
              1/${ratio} ${ratioWarn ? '⚠️' : ''} <span class="text-muted">(ideal: 1/25)</span>
            </span>
          </div>
          <div>
            <span class="text-muted">Ort. YKS Sıralaması:</span><br>
            ${avgYKS}
          </div>
          <div>
            <span class="text-muted">Ort. GPA:</span><br>
            ${avgGPA}
          </div>
          <div>
            <span class="text-muted">Memnuniyet:</span><br>
            <span style="color:${satColor};font-weight:600;">${satisfaction}/100</span>
          </div>
        </div>

        <details style="margin-bottom:10px;">
          <summary style="cursor:pointer;font-size:13px;color:var(--text-muted);margin-bottom:8px;">
            Hocalar (${deptFaculty.length})
          </summary>
          <div style="overflow-x:auto;">
            <table class="data-table" style="font-size:12px;">
              <thead>
                <tr>
                  <th>İsim</th><th>Unvan</th><th class="text-right">Araştırma</th>
                  <th class="text-right">Eğitim</th><th class="text-right">Yönetim</th>
                  <th class="text-right">Ders Yükü</th><th class="text-center">Puan</th>
                  <th class="text-center">Rol</th>
                  <th class="text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>${facultyRows}</tbody>
            </table>
          </div>
        </details>

        <!-- Feature 1: Lisansüstü Program Özeti -->
        ${renderGradProgramCard(dept, state)}

        <!-- v0.3: Akreditasyon Bölümü -->
        ${renderDeptAccreditation(dept, state)}

        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px;">
          ${headCandidates.length > 0 ? `
            <div style="display:flex;align-items:center;gap:6px;">
              <label style="font-size:12px;color:var(--text-muted);">Bölüm Başkanı Ata:</label>
              <select class="filter-select select-head-candidate" data-dept-id="${dept.id}"
                      style="font-size:12px;padding:4px 8px;">
                <option value="">Seç...</option>
                ${headSelectOptions}
              </select>
              <button class="btn btn-sm btn-primary btn-assign-head" data-dept-id="${dept.id}">
                Ata
              </button>
            </div>
          ` : `<span class="text-muted" style="font-size:12px;">Atanabilecek Prof/Doç yok</span>`}
        </div>
      </div>`;
  }

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-title">Bölümler</div>
        <div class="panel-subtitle">${depts.length} aktif bölüm — ${fakGroups.length} fakülte</div>
      </div>
    </div>
    <div id="bolumler-content">
      ${fakGroups.map(fg => `
        <div class="card" style="margin-bottom:20px;padding:16px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;border-bottom:1px solid var(--border);padding-bottom:10px;">
            <span style="font-size:22px;">${fg.icon}</span>
            <div>
              <div style="font-size:16px;font-weight:700;">${fg.name}</div>
              <div class="text-muted" style="font-size:13px;">${fg.depts.length} bölüm</div>
            </div>
          </div>
          ${fg.depts.map(d => deptCard(d)).join('')}
        </div>
      `).join('')}
    </div>
  `;

  // Bölüm başkanı atama butonları
  panel.querySelectorAll('.btn-assign-head').forEach(btn => {
    btn.addEventListener('click', () => {
      const deptId = btn.dataset.deptId;
      const sel    = panel.querySelector(`.select-head-candidate[data-dept-id="${deptId}"]`);
      const facId  = sel ? sel.value : '';
      if (!facId) { showNotification('Lütfen bir hoca seçin.', 'warning'); return; }
      if (onAssignHead) onAssignHead(deptId, facId);
    });
  });

  // Akreditasyon başvuru butonları
  panel.querySelectorAll('.acc-apply-btn, .acc-renew-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const deptId = btn.dataset.deptId;
      const bodyId = btn.dataset.bodyId;
      if (window._onShowAccreditationModal) {
        window._onShowAccreditationModal(deptId, bodyId);
      }
    });
  });

  // Hoca taşıma butonları
  panel.querySelectorAll('.btn-reassign-faculty').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const facId      = btn.dataset.facultyId;
      const currentDept = btn.dataset.currentDept;
      // Basit modal: hedef bölümü seç
      const otherDepts = depts.filter(d => d.id !== currentDept);
      if (otherDepts.length === 0) {
        showNotification('Taşınacak başka bölüm yok.', 'warning');
        return;
      }
      const opts = otherDepts.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
      const bodyHtml = `
        <div style="padding:16px;">
          <p style="margin-bottom:12px;font-size:14px;">Hedef bölümü seçin:</p>
          <select id="reassign-target-dept" class="filter-select" style="width:100%;margin-bottom:16px;">
            ${opts}
          </select>
          <button class="btn btn-primary" id="btn-confirm-reassign" style="width:100%;">Taşı</button>
        </div>`;
      showModal('Hoca Bölüm Değiştir', bodyHtml);
      setTimeout(() => {
        const confirmBtn = document.getElementById('btn-confirm-reassign');
        if (confirmBtn) {
          confirmBtn.addEventListener('click', () => {
            const targetDept = document.getElementById('reassign-target-dept')?.value;
            if (targetDept && onReassignFaculty) {
              onReassignFaculty(facId, targetDept);
              hideModal();
            }
          });
        }
      }, 50);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ÖĞRENCİ PANELİ (v2 — YKS + Kontenjan sistemi)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Öğrenci sekmesi: sınıf bazlı tablo, YKS istatistikleri, yıldız öğrenciler, kontenjan butonu.
 * @param {object}   state             — Oyun durumu
 * @param {Function} onOpenQuotaScreen — Kontenjan belirleme ekranı callback
 */
export function renderStudentsPanel(state, onOpenQuotaScreen) {
  const panel = el('tab-students');
  if (!panel) return;

  const students     = state.students || {};
  const byDept       = students.byDepartment || {};
  const starStudents = students.starStudents || [];
  const depts        = state.departments || [];
  const overall      = students.overallSatisfaction ?? 0;
  const breakdown    = students.satisfactionBreakdown;

  // Özet hesapla
  let total = 0, yr1 = 0, yr2 = 0, yr3 = 0, yr4 = 0;
  let tamTotal = 0, yariTotal = 0, ucretliTotal = 0;
  let sumYKS = 0, sumGPA = 0, countGPA = 0;

  for (const [dId, d] of Object.entries(byDept)) {
    for (const [k, yr] of [['year1', d.year1], ['year2', d.year2], ['year3', d.year3], ['year4', d.year4]]) {
      if (!yr || !yr.count) continue;
      const c = yr.count;
      total += c;
      if (k === 'year1') yr1 += c; else if (k === 'year2') yr2 += c;
      else if (k === 'year3') yr3 += c; else yr4 += c;
      tamTotal     += yr.tamBurslu  || 0;
      yariTotal    += yr.yariBurslu || 0;
      ucretliTotal += yr.ucretli    || 0;
      if (yr.avgYKS > 0) sumYKS += yr.avgYKS * c;
      if (yr.avgGPA > 0) { sumGPA += yr.avgGPA * c; countGPA += c; }
    }
  }
  const avgYKS = total > 0 ? Math.round(sumYKS / total) : 0;
  const avgGPA = countGPA > 0 ? (sumGPA / countGPA).toFixed(2) : '—';

  const isBahar     = state.meta?.semester === 'bahar';
  const satColor    = s => s >= 70 ? 'var(--accent-green)' : s >= 45 ? 'var(--accent-yellow, #f5a623)' : 'var(--accent-red, #e53e3e)';
  const satIcon     = s => s >= 70 ? '😊' : s >= 45 ? '😐' : '😟';

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-title">Öğrenciler</div>
        <div class="panel-subtitle">${formatNumber(total)} kayıtlı öğrenci · ${starStudents.length} yıldız öğrenci</div>
      </div>
      <button class="btn ${isBahar ? 'btn-primary' : 'btn-secondary'}" id="btn-open-quota-screen"
              ${isBahar ? '' : 'style="opacity:0.5;cursor:not-allowed;"'}
              title="${isBahar ? 'Bir sonraki yıl kontenjanlarını belirle (Bahar sonunda uygulanır)' : 'Yalnızca bahar döneminde aktif'}">
        Kontenjan Belirleme${isBahar ? '' : ' (Bahar\'da aktif)'}
      </button>
    </div>

    <!-- Özet kartlar -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">
      ${_statCardHtml('Toplam Öğrenci', formatNumber(total), null, `1.sn:${yr1} 2.sn:${yr2} 3.sn:${yr3} 4.sn:${yr4}`)}
      ${_statCardHtml('Burs Dağılımı', `${tamTotal} / ${yariTotal} / ${ucretliTotal}`, null, 'Tam / Yarı / Ücretli')}
      ${_statCardHtml('Ort. YKS Sıralaması', avgYKS > 0 ? formatNumber(avgYKS) : '—', null, 'Düşük = daha iyi')}
      ${_statCardHtml('Ort. GPA', avgGPA, null, '4.0 üzerinden')}
    </div>

    <!-- Memnuniyet özeti -->
    <div class="card" style="margin-bottom:20px;display:flex;align-items:center;gap:20px;padding:12px 20px;">
      <div style="font-size:32px;">${satIcon(overall)}</div>
      <div>
        <div style="font-size:22px;font-weight:700;color:${satColor(overall)};">${overall}<span style="font-size:12px;color:var(--text-muted);">/100</span></div>
        <div style="font-size:11px;color:var(--text-muted);">Genel Öğrenci Memnuniyeti</div>
      </div>
      ${breakdown ? `
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-left:auto;">
          ${Object.values(breakdown).slice(0,5).map(f => `
            <div style="text-align:center;min-width:52px;">
              <div style="font-size:12px;font-weight:700;color:${satColor(f.score)};">${f.score}</div>
              <div style="font-size:10px;color:var(--text-muted);">${f.label.split(' ')[0]}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;">
      <div>
        <!-- Bölüm bazlı tablo -->
        <div class="section-title">Bölüm Bazlı Öğrenci Tablosu</div>
        <div class="card" style="padding:0;overflow:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr style="background:var(--bg-secondary);">
                <th style="text-align:left;padding:8px 10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid var(--border);">Bölüm</th>
                <th style="text-align:right;padding:8px 6px;font-weight:700;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid var(--border);">1.sn</th>
                <th style="text-align:right;padding:8px 6px;font-weight:700;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid var(--border);">2.sn</th>
                <th style="text-align:right;padding:8px 6px;font-weight:700;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid var(--border);">3.sn</th>
                <th style="text-align:right;padding:8px 6px;font-weight:700;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid var(--border);">4.sn</th>
                <th style="text-align:right;padding:8px 6px;font-weight:700;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid var(--border);">Top.</th>
                <th style="text-align:right;padding:8px 6px;font-weight:700;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid var(--border);">Ort.YKS</th>
                <th style="text-align:right;padding:8px 6px;font-weight:700;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid var(--border);">Ort.GPA</th>
                <th style="text-align:right;padding:8px 6px;font-weight:700;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid var(--border);">Memn.</th>
              </tr>
            </thead>
            <tbody>
              ${depts.map(dept => {
                const d = byDept[dept.id];
                if (!d) return '';
                const y1 = d.year1?.count ?? 0;
                const y2 = d.year2?.count ?? 0;
                const y3 = d.year3?.count ?? 0;
                const y4 = d.year4?.count ?? 0;
                const tot = y1 + y2 + y3 + y4;
                if (tot === 0) return '';
                // Ağırlıklı ort. YKS
                const yksSum = (d.year1?.avgYKS ?? 0) * y1 + (d.year2?.avgYKS ?? 0) * y2 +
                               (d.year3?.avgYKS ?? 0) * y3 + (d.year4?.avgYKS ?? 0) * y4;
                const dAvgYKS = tot > 0 ? Math.round(yksSum / tot) : 0;
                // Ağırlıklı ort. GPA
                const gpaSum = (d.year1?.avgGPA ?? 0) * y1 + (d.year2?.avgGPA ?? 0) * y2 +
                               (d.year3?.avgGPA ?? 0) * y3 + (d.year4?.avgGPA ?? 0) * y4;
                const dAvgGPA = tot > 0 ? (gpaSum / tot).toFixed(2) : '—';
                // Ağırlıklı ort. memnuniyet
                const satSum = (d.year1?.satisfaction ?? 60) * y1 + (d.year2?.satisfaction ?? 60) * y2 +
                               (d.year3?.satisfaction ?? 60) * y3 + (d.year4?.satisfaction ?? 60) * y4;
                const dAvgSat = tot > 0 ? Math.round(satSum / tot) : 60;
                return `
                  <tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:8px 10px;">
                      <span style="font-weight:600;">${dept.shortName || dept.name}</span>
                    </td>
                    <td style="text-align:right;padding:6px;">${y1 || '—'}</td>
                    <td style="text-align:right;padding:6px;">${y2 || '—'}</td>
                    <td style="text-align:right;padding:6px;">${y3 || '—'}</td>
                    <td style="text-align:right;padding:6px;">${y4 || '—'}</td>
                    <td style="text-align:right;padding:6px;font-weight:700;">${formatNumber(tot)}</td>
                    <td style="text-align:right;padding:6px;color:var(--text-muted);">${dAvgYKS > 0 ? formatNumber(dAvgYKS) : '—'}</td>
                    <td style="text-align:right;padding:6px;font-weight:700;color:${_gpaColor(parseFloat(dAvgGPA))};">${dAvgGPA}</td>
                    <td style="text-align:right;padding:6px;color:${satColor(dAvgSat)};">${dAvgSat}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          ${Object.keys(byDept).length === 0 ? `
            <div class="empty-state" style="padding:24px;">
              <div class="empty-state-icon">🎓</div>
              <div class="empty-state-title">Henüz öğrenci yok</div>
            </div>
          ` : ''}
        </div>

        <!-- Memnuniyet kırılım detayı -->
        ${breakdown ? `
          <div class="section-title" style="margin-top:20px;">Memnuniyet Kırılımı</div>
          <div class="card">
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;">
              ${Object.values(breakdown).map(factor => {
                const s = factor.score;
                const color = satColor(s);
                return `
                  <div style="padding:8px;background:var(--bg-secondary);border-radius:8px;border:1px solid var(--border);">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                      <span style="flex:1;font-size:12px;font-weight:600;">${factor.label}</span>
                      <span style="font-size:10px;color:var(--text-faint);">%${Math.round((factor.weight||0)*100)}</span>
                      <span style="font-size:14px;font-weight:700;color:${color};">${s}</span>
                    </div>
                    <div style="height:5px;background:var(--bg-primary);border-radius:3px;overflow:hidden;">
                      <div style="width:${s}%;height:100%;background:${color};border-radius:3px;"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
      </div>

      <!-- Yıldız öğrenciler -->
      <div>
        <div class="section-title">Yıldız Öğrenciler</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${starStudents.slice(0, 8).map(s => renderStudentCard(s, depts)).join('')
            || `<div class="empty-state" style="padding:16px;">
                  <div style="font-size:11px;color:var(--text-faint);">Keşfedilen yıldız öğrenci yok.</div>
                </div>`}
        </div>

        <!-- Kontenjan özeti -->
        <div class="section-title" style="margin-top:20px;">Mevcut Kontenjanlar</div>
        <div class="card" style="padding:0;">
          ${depts.map(dept => {
            const q = students.quotas?.[dept.id];
            if (!q) return '';
            const tot = (q.tamBurslu || 0) + (q.yariBurslu || 0) + (q.ucretli || 0);
            return `
              <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border);font-size:12px;">
                <span style="flex:1;font-weight:600;">${dept.shortName || dept.name}</span>
                <span style="color:var(--accent-green);" title="Tam burslu">TB:${q.tamBurslu||0}</span>
                <span style="color:var(--accent-yellow,#f5a623);" title="Yarı burslu">YB:${q.yariBurslu||0}</span>
                <span title="Ücretli">Ü:${q.ucretli||0}</span>
                <span style="font-weight:700;color:var(--text-muted);">(${tot})</span>
              </div>
            `;
          }).join('') || '<div style="padding:12px;font-size:12px;color:var(--text-muted);">Kontenjan belirlenmedi.</div>'}
        </div>
      </div>
    </div>
  `;

  // Kontenjan belirleme butonu
  on(el('btn-open-quota-screen'), 'click', () => {
    if (!isBahar) {
      showNotification('Kontenjan belirleme yalnızca Bahar döneminde yapılabilir.', 'warning');
      return;
    }
    if (onOpenQuotaScreen) onOpenQuotaScreen();
  });
}

/**
 * Tek yıldız öğrenci kartı HTML'i.
 */
export function renderStudentCard(s, depts = []) {
  const dept = depts.find(d => d.id === s.department);
  const typeLabels = {
    akademik_dahi: '🎯 Akademik Dahi',
    girisimci:     '💡 Girişimci',
    sporcu:        '🏆 Sporcu',
    sanatci:       '🎨 Sanatçı',
    lider:         '👑 Lider',
    polymath:      '🌐 Polimatik',
    sessiz_deha:   '🔬 Sessiz Deha',
  };

  // Mezuniyet sonrası kariyer potansiyeli tahmini
  const careerOutcomes = {
    akademik_dahi: 'Akademisyen / Araştırmacı olma potansiyeli yüksek',
    girisimci:     'Mezun olunca: Startup kurma potansiyeli yüksek',
    sporcu:        'Mezun olunca: Ulusal düzeyde spor kariyeri',
    sanatci:       'Mezun olunca: Yaratıcı sektörlerde öncü',
    lider:         'Mezun olunca: Yönetici / Sektör lideri',
    polymath:      'Mezun olunca: Disiplinlerarası kariyer, danışmanlık',
    sessiz_deha:   'Mezun olunca: Büyük şirkette Ar-Ge, patent',
  };

  const initials = (s.name || '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const impact = s.potentialAlumniImpact ?? 1;

  // Bu dönemki etkinlikler/katkılar
  const events = s.events || [];
  const recentEvents = events.slice(-3);

  // Öne çıkan stat (en yüksek)
  const stats = s.stats || {};
  const statLabels = { academic: 'Akademik', creativity: 'Yaratıcılık', leadership: 'Liderlik', sport: 'Spor', art: 'Sanat', charisma: 'Karizmatik' };
  const topStatKey = Object.keys(stats).reduce((a, b) => (stats[a] ?? 0) >= (stats[b] ?? 0) ? a : b, 'academic');
  const topStatVal = stats[topStatKey] ?? 0;

  // Yıldız kalitesi: potansiyelAlumniImpact'a göre altın/gümüş/normal
  const borderStyle = impact >= 4
    ? 'border:2px solid #f5a623;box-shadow:0 0 8px rgba(245,166,35,0.3);'
    : impact >= 3
      ? 'border:2px solid #38a169;'
      : '';

  return `
    <div class="student-card" style="${borderStyle}position:relative;">
      ${impact >= 4 ? `<span style="position:absolute;top:-6px;right:8px;font-size:16px;z-index:2;">⭐</span>` : ''}
      <div class="student-card-avatar" style="${impact >= 4 ? 'background:linear-gradient(135deg,#f5a623,#e67e22);' : ''}">${initials}</div>
      <div class="student-card-body">
        <div class="student-name">${s.name || 'İsimsiz'}</div>
        <div class="student-meta">
          <span class="student-dept">${dept?.shortName || s.department || '—'}</span>
          <span class="student-gpa">GPA ${formatGPA(s.gpa)}</span>
          <span class="student-year">${s.year}. Sınıf</span>
        </div>
        <div style="margin-top:3px;font-size:11px;color:var(--text-muted);">
          ${typeLabels[s.type] || s.type}
          ${s.scholarship ? ' · <span style="color:#38a169;font-weight:600;">Burslu</span>' : ''}
        </div>
        <!-- En yüksek stat -->
        <div style="margin-top:3px;font-size:10px;color:var(--text-faint);">
          En güçlü: <strong style="color:${topStatVal >= 80 ? 'var(--accent-green)' : 'var(--text-muted)'};">${statLabels[topStatKey] || topStatKey} ${topStatVal}</strong>
        </div>
        <!-- Bu dönem katkıları -->
        ${recentEvents.length > 0 ? `
          <div style="margin-top:4px;">
            ${recentEvents.map(ev => `
              <div style="font-size:10px;color:${ev.type === 'competition_win' ? '#38a169' : ev.type === 'publication' ? 'var(--accent-blue)' : 'var(--text-muted)'};margin-bottom:1px;">
                ${ev.type === 'competition_win' ? '🏆' : ev.type === 'publication' ? '📄' : ev.type === 'graduation' ? '🎓' : '✨'} ${ev.description || ''}
              </div>
            `).join('')}
          </div>
        ` : ''}
        <!-- Kariyer potansiyeli -->
        ${impact >= 3 ? `
          <div style="margin-top:4px;font-size:10px;color:var(--text-faint);font-style:italic;">
            ${careerOutcomes[s.type] || 'Kariyer potansiyeli yüksek'}
          </div>
        ` : ''}
      </div>
      <div class="student-card-right">
        <div class="star-rating">${createStarRating(impact, 5)}</div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// KONTENJAN BELİRLEME MODALI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bahar dönemi öncesi kontenjan belirleme modalını açar (yeni alım Bahar sonunda yapılır).
 *
 * @param {object}   state        — Oyun durumu
 * @param {Function} onConfirm    — Onaylama callback: onConfirm(quotas)
 */
export function renderQuotaModal(state, onConfirm) {
  const depts    = state.departments.filter(d => d.isOpen);
  const quotas   = state.students?.quotas || {};
  const byDept   = state.students?.byDepartment || {};
  const prestige = state.university?.prestige || 20;
  const year     = state.meta?.year || 1;
  const baseTuition = state.university?.tuitionPerSemester || 65_000;
  const uniType  = state.meta?.universityType || 'vakif';

  // ── Kapasite hesapla ──────────────────────────────────────────────────────
  // Tamamlanan tüm binaların gerçek derslik koltuk kapasitesi
  const completedBuildings = (state.buildings || []).filter(b => b.isCompleted);
  const totalClassroomCap  = completedBuildings.reduce((s, b) => {
    const classrooms  = b.currentCapacity?.classrooms || 0;
    const bldgDef     = BUILDINGS[b.type];
    // Düzeye göre derslik kapasitesi
    const bldgLevel   = b.level || 1;
    const clsSzByLvl  = bldgDef?.classroomSizeByLevel;
    const clsSize     = clsSzByLvl
      ? (clsSzByLvl[bldgLevel] ?? clsSzByLvl[1] ?? bldgDef?.classroomSize ?? 40)
      : (bldgDef?.classroomSize ?? 40);
    // Koltuk sayısı = derslik adedi × derslik büyüklüğü
    const seats       = classrooms * clsSize;
    // Geriye dönük uyumluluk: eski binaların students/classroom alanı
    const legacyCap   = b.currentCapacity?.students || b.currentCapacity?.classroom || 0;
    return s + (seats > 0 ? seats : legacyCap);
  }, 0);

  // Bölüm bazlı gerçek derslik kapasitesi (atanmış binalardan)
  const deptClassroomCapacity = {};
  for (const dept of (state.departments || [])) {
    let seats = 0;
    for (const b of completedBuildings) {
      if ((b.assignedDepartments || []).includes(dept.id)) {
        const classrooms  = b.currentCapacity?.classrooms || 0;
        const bldgDef     = BUILDINGS[b.type];
        const bLevel      = b.level || 1;
        const szByLvl     = bldgDef?.classroomSizeByLevel;
        const clsSize     = szByLvl
          ? (szByLvl[bLevel] ?? szByLvl[1] ?? bldgDef?.classroomSize ?? 40)
          : (bldgDef?.classroomSize ?? 40);
        seats += classrooms * clsSize;
      }
    }
    deptClassroomCapacity[dept.id] = seats;
  }

  // Hoca başına maksimum öğrenci tahmini (1 hoca ≈ 30 öğrenci)
  const totalFaculty       = (state.faculty || []).length;
  const maxStudentsByFaculty = totalFaculty * 30;

  // Toplam efektif kapasite (minimum olarak sınıf ve hoca kapasitesini al)
  const effectiveCapacity  = Math.max(
    50, // minimum bir şey göster
    totalClassroomCap > 0 && maxStudentsByFaculty > 0
      ? Math.min(totalClassroomCap, maxStudentsByFaculty)
      : totalClassroomCap > 0
        ? totalClassroomCap
        : maxStudentsByFaculty
  );

  // Mevcut toplam kayıtlı öğrenci (yıl 2-4; yıl 1 yeni alımla doldurulacak)
  let currentEnrolledUpperYears = 0;
  for (const d of Object.values(byDept)) {
    currentEnrolledUpperYears += (d.year2?.count || 0) + (d.year3?.count || 0) + (d.year4?.count || 0);
  }
  const remainingCapacity = Math.max(0, effectiveCapacity - currentEnrolledUpperYears);

  // Devlet modelinde YKS sıralaması var ama burs kategorisi yok; ABD modeli farklı
  const isDevlet    = uniType === 'devlet';
  const isUSPrivate = uniType === 'us_private';
  const isVakif     = !isDevlet && !isUSPrivate;

  // YKS tahmini menzil (prestijteki özet)
  function yksRange(type) {
    const pf = 1 - (prestige / 100) * 0.6;
    const ranges = {
      tam_burslu:  [Math.round(500 * pf), Math.round(20000 * pf)],
      yari_burslu: [Math.round(10000 * pf), Math.round(60000 * pf)],
      ucretli:     [Math.round(25000 * pf), Math.round(200000 * pf)],
    };
    const [min, max] = ranges[type] || [0, 0];
    return `~${formatNumber(Math.max(500, min))}-${formatNumber(Math.max(min+1000, max))}`;
  }

  function netRevenue(tam, yari, ucret, mult = 1.0) {
    if (isDevlet) {
      // Devlet: hiç harç yok, sadece katkı payı
      const katkiPayi = UNIVERSITY_MODELS.devlet.revenueStreams.ogrenciKatkiPayi?.perStudent ?? 2_000;
      return (tam + yari + ucret) * katkiPayi;
    }
    if (isUSPrivate) {
      const aidRate    = state.university?.financialAidRate ?? 0.45;
      const merritRate = tam / Math.max(1, tam + yari + ucret); // tam = merit scholarship
      const avgNet     = baseTuition * (1 - aidRate * (1 - merritRate));
      return (tam + yari + ucret) * avgNet;
    }
    // Vakıf: tam burslu = 0, yarı = %50, ücretli = tam
    const income = (yari * baseTuition * mult * 0.50) + (ucret * baseTuition * mult * 1.0);
    const burs   = (tam * baseTuition * mult * 1.0) + (yari * baseTuition * mult * 0.50);
    return income - burs;
  }

  // Devlet için başlangıç quota değerleri (burs kategorisi yok)
  function defaultQuota(id) {
    if (isDevlet) return { tamBurslu: 0, yariBurslu: 0, ucretli: 50 };
    if (isUSPrivate) return { tamBurslu: 10, yariBurslu: 20, ucretli: 30 };
    return { tamBurslu: 5, yariBurslu: 10, ucretli: 30 };
  }

  // Kolon başlıkları
  const col1Label = isDevlet ? 'Devlet Bursu (0 harç)' : isUSPrivate ? 'Merit Scholarship' : 'Tam Burslu (0 harç)';
  const col2Label = isDevlet ? 'Kısmi Destek' : isUSPrivate ? 'Need-Based Aid' : '%50 Burslu';
  const col3Label = isDevlet ? 'Kontenjan (Tam)' : isUSPrivate ? 'Full Pay (Sınırlı)' : 'Ücretli';

  const infoBlock = isDevlet
    ? `<strong>Bütçe tahsisi:</strong> YÖK &nbsp;|&nbsp; <strong>Harç:</strong> Ücretsiz (katkı payı: ${formatMoney(UNIVERSITY_MODELS.devlet.revenueStreams.ogrenciKatkiPayi?.perStudent ?? 2_000)}/dönem) &nbsp;|&nbsp; <strong>Saygınlık:</strong> ${prestige}`
    : isUSPrivate
      ? `<strong>Harç:</strong> ${formatMoney(baseTuition)}/dönem &nbsp;|&nbsp; <strong>Ortalama Aid:</strong> %${Math.round((state.university?.financialAidRate ?? 0.45) * 100)} &nbsp;|&nbsp; <strong>Saygınlık:</strong> ${prestige}`
      : `<strong>Baz harç:</strong> ${formatMoney(baseTuition)}/dönem &nbsp;|&nbsp; <strong>Saygınlık:</strong> ${prestige} &nbsp;|&nbsp; <strong>Tip:</strong> Vakıf`;

  // Kapasite uyarı rengi
  const capColor = remainingCapacity < 20 ? 'var(--accent-red,#e53e3e)' : remainingCapacity < 60 ? '#f5a623' : 'var(--accent-green)';

  const bodyHtml = `
    <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">
      ${year+1}-${year+2} eğitim yılı için bölüm bazlı kontenjanları belirleyin.
      Bahar dönemi sonunda sınıf ilerlemesinin ardından bu kontenjanlar kadar yeni 1. sınıf öğrencisi alınacaktır.
      ${isDevlet ? '<br><span style="color:#4ade80;font-size:12px;">Devlet modelinde tüm öğrenciler ücretsiz okur — gelir YÖK tahsisinden gelir.</span>' : ''}
    </div>

    <div style="background:var(--bg-secondary);border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px;">
      ${infoBlock}
    </div>

    <!-- Kapasite gösterge kutusu -->
    <div style="background:var(--bg-secondary);border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
      <div>
        <div style="color:var(--text-muted);margin-bottom:2px;">Sınıf Kapasitesi</div>
        <div style="font-weight:700;font-size:14px;">${totalClassroomCap > 0 ? formatNumber(totalClassroomCap) : '—'}</div>
        <div style="font-size:10px;color:var(--text-faint);">tamamlanan binalar</div>
      </div>
      <div>
        <div style="color:var(--text-muted);margin-bottom:2px;">Hoca Kapasitesi</div>
        <div style="font-weight:700;font-size:14px;">${formatNumber(maxStudentsByFaculty)}</div>
        <div style="font-size:10px;color:var(--text-faint);">${totalFaculty} hoca × 30 öğrenci</div>
      </div>
      <div>
        <div style="color:var(--text-muted);margin-bottom:2px;">Yeni Alım İçin Yer</div>
        <div style="font-weight:700;font-size:14px;color:${capColor};">${formatNumber(remainingCapacity)}</div>
        <div style="font-size:10px;color:var(--text-faint);">mevcut - üst sınıflar</div>
      </div>
    </div>

    <div id="quota-form" data-remaining-cap="${remainingCapacity}">
      ${depts.map(dept => {
        const q      = quotas[dept.id] || defaultQuota(dept.id);
        const d      = byDept[dept.id] || {};
        const cur    = (d.year1?.count||0) + (d.year2?.count||0) + (d.year3?.count||0) + (d.year4?.count||0);
        const mult   = (isVakif ? (dept.tuitionMultiplier || 1.0) : 1.0);
        const net    = netRevenue(q.tamBurslu||0, q.yariBurslu||0, q.ucretli||0, mult);

        // Devlet modelinde 3 kolon sadece tek "Toplam Kontenjan" olur
        const inputCols = isDevlet ? `
          <div style="max-width:200px;">
            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">
              Toplam Kontenjan
            </label>
            <div style="font-size:10px;color:var(--text-faint);margin-bottom:4px;">YKS: ${yksRange('ucretli')}</div>
            <input type="number" min="0" max="500" value="${(q.tamBurslu||0)+(q.yariBurslu||0)+(q.ucretli||0)}"
              class="quota-input" data-field="ucretli"
              style="width:100%;padding:6px;border-radius:6px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-primary);font-size:14px;">
          </div>
        ` : `
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:10px;">
            <div>
              <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">
                ${col1Label} <span style="color:var(--accent-green);">(0 harç)</span>
              </label>
              <div style="font-size:10px;color:var(--text-faint);margin-bottom:4px;">YKS: ${yksRange('tam_burslu')}</div>
              <input type="number" min="0" max="200" value="${q.tamBurslu||0}"
                class="quota-input" data-field="tamBurslu"
                style="width:100%;padding:6px;border-radius:6px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-primary);font-size:14px;">
            </div>
            <div>
              <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">
                ${col2Label} <span style="color:var(--accent-yellow,#f5a623);">(yarı ücret)</span>
              </label>
              <div style="font-size:10px;color:var(--text-faint);margin-bottom:4px;">YKS: ${yksRange('yari_burslu')}</div>
              <input type="number" min="0" max="200" value="${q.yariBurslu||0}"
                class="quota-input" data-field="yariBurslu"
                style="width:100%;padding:6px;border-radius:6px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-primary);font-size:14px;">
            </div>
            <div>
              <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">
                ${col3Label} <span style="color:var(--text-faint);">(tam harç)</span>
              </label>
              <div style="font-size:10px;color:var(--text-faint);margin-bottom:4px;">YKS: ${yksRange('ucretli')}</div>
              <input type="number" min="0" max="500" value="${q.ucretli||0}"
                class="quota-input" data-field="ucretli"
                style="width:100%;padding:6px;border-radius:6px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-primary);font-size:14px;">
            </div>
          </div>
        `;

        const netLabel = isDevlet
          ? `Katkı payı: <strong class="qs-net" style="color:var(--accent-green);">${formatMoney(net)}/dönem</strong>`
          : `Net etki: <strong class="qs-net" style="color:${net >= 0 ? 'var(--accent-green)' : 'var(--accent-red,#e53e3e)'};">${formatMoney(net)}/dönem</strong>`;

        // Bölüm hocası sayısı ve bölüm kapasitesi
        const deptFacultyCount = (state.faculty || []).filter(f => (f.departmentId || f.department) === dept.id).length;
        const deptMaxByFaculty = deptFacultyCount * 30;
        const thisQuotaTotal   = (q.tamBurslu||0) + (q.yariBurslu||0) + (q.ucretli||0);
        const exceedsCapacity  = deptMaxByFaculty > 0 && thisQuotaTotal > deptMaxByFaculty;

        // Gerçek derslik kapasitesi (atanmış binalardan)
        const deptSeats = deptClassroomCapacity[dept.id] || 0;
        const exceedsDersklik = deptSeats > 0 && thisQuotaTotal > deptSeats;

        // Atanmış binaları bul
        const assignedBuildingDetails = completedBuildings
          .filter(b => (b.assignedDepartments || []).includes(dept.id))
          .map(b => {
            const bldgDef  = BUILDINGS[b.type];
            const clsCount = b.currentCapacity?.classrooms || 0;
            const bLvl     = b.level || 1;
            const szByLvl  = bldgDef?.classroomSizeByLevel;
            const clsSize  = szByLvl
              ? (szByLvl[bLvl] ?? szByLvl[1] ?? bldgDef?.classroomSize ?? 40)
              : (bldgDef?.classroomSize ?? 40);
            return `${b.name || b.type}: ${clsCount} derslik × ${clsSize} kişi`;
          }).join(', ');

        return `
          <div class="card" style="margin-bottom:12px;" data-dept="${dept.id}">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
              <span style="font-size:16px;">${dept.icon||'🏛️'}</span>
              <div style="flex:1;">
                <div style="font-weight:700;">${dept.name}</div>
                <div style="font-size:11px;color:var(--text-muted);">
                  Mevcut öğrenci: ${formatNumber(cur)} &nbsp;|&nbsp;
                  Bölüm hocası: ${deptFacultyCount} &nbsp;|&nbsp;
                  Hoca kapasitesi: <strong style="color:${exceedsCapacity ? 'var(--accent-red,#e53e3e)' : 'var(--accent-green)'};">${deptMaxByFaculty > 0 ? formatNumber(deptMaxByFaculty) : '—'}</strong>
                </div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
                  Derslik kapasitesi: <strong style="color:${exceedsDersklik ? 'var(--accent-red,#e53e3e)' : deptSeats > 0 ? 'var(--accent-green)' : 'var(--text-faint)'};">${deptSeats > 0 ? formatNumber(deptSeats) + ' koltuk' : 'Bina atanmamış'}</strong>
                  ${assignedBuildingDetails ? `<span style="color:var(--text-faint);"> (${assignedBuildingDetails})</span>` : ''}
                </div>
              </div>
            </div>

            <div class="dept-cap-warning" style="display:${exceedsCapacity || exceedsDersklik ? 'block' : 'none'};background:rgba(233,69,96,0.12);border:1px solid var(--accent-red,#e53e3e);border-radius:6px;padding:6px 10px;margin-bottom:8px;font-size:11px;color:var(--accent-red,#e53e3e);">
              ${exceedsDersklik ? `⚠ Kontenjan (${thisQuotaTotal}) derslik kapasitesini (${deptSeats} koltuk) aşıyor. Daha fazla bina veya amfi gerekebilir.` : exceedsCapacity ? `⚠ Kontenjan (${thisQuotaTotal}) hoca kapasitesini (${deptMaxByFaculty}) aşıyor. Eğitim kalitesi düşebilir.` : ''}
            </div>

            ${inputCols}

            <div class="quota-summary" data-dept="${dept.id}"
                 style="display:flex;gap:12px;font-size:11px;background:var(--bg-secondary);border-radius:6px;padding:8px 10px;flex-wrap:wrap;">
              <span>Toplam: <strong class="qs-total">${thisQuotaTotal}</strong></span>
              <span>${netLabel}</span>
              ${isVakif ? `<span style="color:var(--text-faint);">Harç çarpanı: ×${mult.toFixed(2)}</span>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <!-- Toplam kontenjan uyarısı -->
    <div id="quota-total-warning" style="margin-top:8px;margin-bottom:8px;display:none;background:rgba(233,69,96,0.12);border:1px solid var(--accent-red,#e53e3e);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--accent-red,#e53e3e);">
      ⚠ Toplam yeni alım öğrenci kapasitesini aşıyor. Kontenjanları düşürmeniz önerilir.
    </div>

    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
      <button class="btn btn-secondary" id="btn-quota-cancel">İptal</button>
      <button class="btn btn-primary" id="btn-quota-confirm">Onayla ve Dönemi Başlat</button>
    </div>
  `;

  showModal('Kontenjan Belirleme', bodyHtml, { wide: true });

  // Live update: toplam, net gelir ve kapasite uyarısı hesapla
  function updateSummary(deptId) {
    const deptEl = document.querySelector(`[data-dept="${deptId}"].card`);
    if (!deptEl) return;
    const tam  = parseInt(deptEl.querySelector('[data-field="tamBurslu"]')?.value || 0);
    const yari = parseInt(deptEl.querySelector('[data-field="yariBurslu"]')?.value || 0);
    const uret = parseInt(deptEl.querySelector('[data-field="ucretli"]')?.value || 0);
    const dept = depts.find(d => d.id === deptId);
    const mult = isVakif ? (dept?.tuitionMultiplier || 1.0) : 1.0;
    const net  = netRevenue(tam, yari, uret, mult);
    const total = tam + yari + uret;

    const sumEl = document.querySelector(`.quota-summary[data-dept="${deptId}"]`);
    if (!sumEl) return;
    sumEl.querySelector('.qs-total').textContent = total;
    const netEl = sumEl.querySelector('.qs-net');
    if (netEl) {
      netEl.textContent = formatMoney(net) + '/dönem';
      netEl.style.color = (isDevlet || net >= 0)
        ? 'var(--accent-green)'
        : 'var(--accent-red,#e53e3e)';
    }

    // Bölüm kapasitesi uyarısı güncelle
    const deptFacCount = (state.faculty || []).filter(f => (f.departmentId || f.department) === deptId).length;
    const deptMaxFac   = deptFacCount * 30;
    const capWarnEl    = deptEl.querySelector('.dept-cap-warning');
    if (capWarnEl) {
      if (deptMaxFac > 0 && total > deptMaxFac) {
        capWarnEl.style.display = 'block';
        capWarnEl.textContent   = `⚠ Kontenjan (${total}) hoca kapasitesini (${deptMaxFac}) aşıyor.`;
      } else {
        capWarnEl.style.display = 'none';
      }
    }

    // Toplam kapasite uyarısı
    let grandTotal = 0;
    document.querySelectorAll('[data-dept].card').forEach(card => {
      const t = parseInt(card.querySelector('[data-field="tamBurslu"]')?.value || 0);
      const y = parseInt(card.querySelector('[data-field="yariBurslu"]')?.value || 0);
      const u = parseInt(card.querySelector('[data-field="ucretli"]')?.value || 0);
      grandTotal += t + y + u;
    });
    const warnEl = document.getElementById('quota-total-warning');
    if (warnEl) {
      warnEl.style.display = grandTotal > remainingCapacity ? 'block' : 'none';
    }
  }

  document.querySelectorAll('.quota-input').forEach(input => {
    input.addEventListener('input', () => {
      const card = input.closest('[data-dept]');
      if (card) updateSummary(card.dataset.dept);
    });
  });

  on(el('btn-quota-cancel'), 'click', () => hideModal());

  on(el('btn-quota-confirm'), 'click', () => {
    const newQuotas = {};
    depts.forEach(dept => {
      const card = document.querySelector(`[data-dept="${dept.id}"].card`);
      if (!card) return;
      const tam  = Math.max(0, parseInt(card.querySelector('[data-field="tamBurslu"]')?.value || 0));
      const yari = Math.max(0, parseInt(card.querySelector('[data-field="yariBurslu"]')?.value || 0));
      const uret = Math.max(0, parseInt(card.querySelector('[data-field="ucretli"]')?.value || 0));
      newQuotas[dept.id] = { tamBurslu: tam, yariBurslu: yari, ucretli: uret };
    });

    hideModal();
    if (onConfirm) onConfirm(newQuotas);
    showNotification('Kontenjanlar belirlendi. Bahar dönemi sonunda uygulanacak.', 'success');
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. KAMPÜS PANELİ
// ─────────────────────────────────────────────────────────────────────────────

// Bina katalogunu data.js'deki BUILDINGS'den türet
const BUILDING_CATALOG = Object.values(BUILDINGS).map(b => ({
  type:             b.id,
  name:             b.name,
  icon:             b.icon,
  desc:             b.description,
  cost:             b.baseCost ?? b.constructionCost,
  constructionTime: b.constructionTurns ?? b.constructionTime,
  baseArea:         b.baseArea,
  maxLevel:         b.maxLevel ?? 1,
  canHaveMultiple:  b.canHaveMultiple ?? false,
  maintenanceCostPerM2: b.maintenanceCostPerM2,
  classroomSize:         b.classroomSize ?? 40,
  classroomSizeByLevel:  b.classroomSizeByLevel ?? null,
  capacity:              b.capacity || {},
  capacityPerLevel: b.capacityPerLevel || {},
  effects:          b.effects || {},
  qualityEffects:   b.qualityEffects || {},
  prerequisite:     b.prerequisite || null,
  assignable:       b.assignable ?? false,
  benefitText:      b.benefitText ?? null,
}));

/** Bina etki nesnesini Türkçe kısa etiketlere çevirir */
function _formatBuildingEffects(effects) {
  const labelMap = {
    educationQuality:       (v) => `+${v} eğitim kalitesi`,
    studentSatisfaction:    (v) => `+${v} öğrenci memnuniyeti`,
    researchOutput:         (v) => `+${v} araştırma çıktısı`,
    researchBoost:          (v) => `+%${Math.round(v * 100)} araştırma bonusu`,
    labScore:               (v) => `+${v} lab puanı`,
    publicationRate:        (v) => `+${v} yayın/hoca/yıl`,
    studentGPA:             (v) => `+${v} öğrenci GPA`,
    facultyHappiness:       (v) => `+${v} hoca memnuniyeti`,
    studentDemandBonus:     (v) => `+%${Math.round(v * 100)} öğrenci talebi`,
    revenuePerBed:          (v) => `+₺${v.toLocaleString('tr-TR')}/dönem yurt geliri`,
    prestige:               (v) => `+${v} saygınlık`,
    internationalization:   (v) => `+${v} uluslararasılaşma`,
    internationalVisibility:(v) => `+${v} uluslararası görünürlük`,
    eventRevenuePerTurn:    (v) => `+₺${v.toLocaleString('tr-TR')}/dönem etkinlik geliri`,
    tubitakSuccessRate:     (v) => `+%${Math.round(v * 100)} TÜBİTAK başarı şansı`,
    industryTieBonus:       (v) => `+${v} sektör bağı`,
    coopPartnerQuality:     (v) => `+${v} co-op kalitesi`,
    annualRentalRevenue:    (v) => `+₺${v.toLocaleString('tr-TR')}/yıl kira geliri`,
    alumniBonus:            (v) => `+${v} mezun bonusu`,
    coopStressReduction:    (v) => `−${v} co-op stresi`,
    classroomCapacity:      (v) => `+${v} derslik kapasitesi`,
    officeCapacity:         (v) => `+${v} ofis kapasitesi`,
    dormCapacity:           (v) => `+${v} yatak`,
    interdisciplinaryBonus: ()  => 'Disiplinlerarası bonus',
    spinoffRevenue:         ()  => 'Spin-off geliri',
  };
  return Object.entries(effects)
    .map(([k, v]) => labelMap[k] ? labelMap[k](v) : null)
    .filter(Boolean);
}

/** Yıldız dizesi üret (★★★☆☆) */
function _levelStars(level, max) {
  return '★'.repeat(level) + '☆'.repeat(Math.max(0, max - level));
}

/** Kapasite çubuk HTML'i */
function _capacityBar(label, used, total) {
  if (total == null || total === 0) return '';
  const pct  = Math.min(100, Math.round((used / total) * 100));
  const color = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#4ade80';
  return `
    <div style="margin-top:4px;font-size:11px;color:#94a3b8;">
      ${label}: <span style="color:#e2e8f0;">${used}/${total}</span>
      <div style="background:#1e293b;border-radius:3px;height:4px;margin-top:2px;">
        <div style="background:${color};width:${pct}%;height:4px;border-radius:3px;"></div>
      </div>
    </div>`;
}

/** Alan çubuğu — aktif alan / toplam alan */
function _areaSummary(usedArea, totalArea) {
  if (!totalArea) return '';
  const pct  = Math.min(100, Math.round((usedArea / totalArea) * 100));
  const color = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#4ade80';
  return `
    <div style="margin-top:4px;font-size:11px;color:#94a3b8;">
      Alan: <span style="color:#e2e8f0;">${(usedArea).toLocaleString('tr-TR')} / ${totalArea.toLocaleString('tr-TR')} m²</span>
      <div style="background:#1e293b;border-radius:3px;height:4px;margin-top:2px;">
        <div style="background:${color};width:${pct}%;height:4px;border-radius:3px;"></div>
      </div>
    </div>`;
}

/** Yerleşke özet kartı HTML'i */
function _campusSummaryCard(icon, label, value) {
  return `
    <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px 12px;">
      <div style="font-size:18px;">${icon}</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:2px;">${label}</div>
      <div style="font-size:13px;font-weight:600;color:#e2e8f0;margin-top:2px;">${value}</div>
    </div>`;
}

/**
 * Yerleşke sekmesi: yerleşke özeti, mevcut binalar ve inşaat seçenekleri.
 * @param {object}   state          — Oyun durumu
 * @param {Function} onBuildStart   — İnşaat başlat callback (buildingType alır)
 * @param {Function} onDecision     — Karar callback (upgrade_building, assign_department_to_building vb.)
 */
export function renderCampusPanel(state, onBuildStart, onDecision) {
  const panel = el('tab-campus');
  if (!panel) return;

  const buildings = state.buildings || [];
  const budget    = state.university?.budget ?? 0;
  const depts     = state.departments || [];

  // İstatistikler
  const completedBuildings = buildings.filter(b => b.isCompleted);
  const inProgressBuildings = buildings.filter(b => !b.isCompleted);

  let totalArea = 0, totalOffices = 0, usedOffices = 0;
  let totalClassrooms = 0, usedClassrooms = 0;
  let totalLabs = 0, usedLabs = 0;
  let totalBeds = 0, totalMaintenance = 0;

  completedBuildings.forEach(b => {
    const cap = b.currentCapacity || {};
    totalArea       += b.area || 0;
    totalOffices    += cap.offices    || 0;
    usedOffices     += (b.usedCapacity?.offices    || 0);
    totalClassrooms += cap.classrooms || 0;
    usedClassrooms  += (b.usedCapacity?.classrooms || 0);
    totalLabs       += cap.labs       || 0;
    usedLabs        += (b.usedCapacity?.labs       || 0);
    totalBeds       += cap.beds       || 0;
    totalMaintenance += b.maintenanceCost || 0;
  });

  // Katalog sözlüğü
  const catalogMap = {};
  BUILDING_CATALOG.forEach(c => { catalogMap[c.type] = c; });

  // Mevcut tiplerin sayısı (canHaveMultiple=false olanlar için)
  const existingTypeCounts = {};
  buildings.forEach(b => {
    existingTypeCounts[b.type] = (existingTypeCounts[b.type] || 0) + 1;
  });

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-title">Yerleşke</div>
        <div class="panel-subtitle">${completedBuildings.length} aktif bina · ${inProgressBuildings.length} yapım aşamasında</div>
      </div>
    </div>

    <div class="campus-layout">
      <!-- SOL: Özet + Binalar -->
      <div class="campus-main">

    <!-- Yerleşke Özeti -->
    <div class="section-title">Yerleşke Özeti</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:20px;">
      ${_campusSummaryCard('📐', 'Toplam Alan', totalArea.toLocaleString('tr-TR') + ' m²')}
      ${_campusSummaryCard('🏫', 'Derslikler', `${usedClassrooms}/${totalClassrooms} kullanımda`)}
      ${_campusSummaryCard('🖥️', 'Ofisler', `${usedOffices}/${totalOffices} kullanımda`)}
      ${_campusSummaryCard('🧪', 'Laboratuvarlar', `${usedLabs}/${totalLabs} kullanımda`)}
      ${_campusSummaryCard('🛏️', 'Yurt Yatakları', totalBeds.toLocaleString('tr-TR'))}
      ${_campusSummaryCard('🔧', 'Dönem Bakım', formatMoney(totalMaintenance))}
    </div>

    ${buildings.length > 0 ? `
      <div class="section-title">Mevcut Binalar</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px;margin-bottom:24px;">
        ${buildings.map(b => {
          const cat    = catalogMap[b.type] || {};
          const pct    = b.isCompleted ? 100 : (b.constructionProgress ?? 0);
          const isUpg  = b.status === 'upgrading';
          const maxLvl = cat.maxLevel || 3;
          const upgCost = b.isCompleted && b.level < maxLvl
            ? Math.round((cat.cost || 0) * Math.pow((BUILDINGS[b.type]?.upgradeCostMultiplier ?? 1.5), b.level))
            : 0;

          // Kapasite referansları
          const cap  = b.currentCapacity || {};
          const used = b.usedCapacity || {};

          if (!b.isCompleted) {
            // Yapım / Yükseltme aşamasındaki kart
            return `
              <div class="building-card under-construction">
                <div class="building-icon">${cat.icon || '🏗️'}</div>
                <div class="building-info">
                  <div class="building-name">${b.name || cat.name || b.type}
                    ${isUpg ? ` <span style="font-size:10px;color:#f59e0b;">Düzey ${(b._pendingLevel ?? b.level + 1)} yükseltiliyor</span>` : ''}
                  </div>
                  <div class="construction-progress" style="margin-top:8px;">
                    <div class="construction-bar">
                      <div class="construction-fill" style="width:${pct}%"></div>
                    </div>
                    <div class="construction-label">${isUpg ? 'Yükseltme' : 'Yapım'}: %${pct} · ${b.turnsRemaining ?? '?'} dönem kaldı</div>
                  </div>
                </div>
              </div>`;
          }

          // Tamamlanmış bina kartı
          // Düzeye göre derslik kapasitesi
          const currentLevel  = b.level || 1;
          const clsSizeByLvl  = cat.classroomSizeByLevel;
          const clsSize       = clsSizeByLvl
            ? (clsSizeByLvl[currentLevel] ?? clsSizeByLvl[1] ?? cat.classroomSize ?? 40)
            : (cat.classroomSize ?? (b.type === 'amfi' ? 150 : 40));
          const totalStudents = state.students ? (state.students.totalEnrolled || 0) : 0;
          const totalFaculty  = (state.faculty || []).length;
          const nextLevel     = currentLevel + 1;
          const nextLvlClsSize = clsSizeByLvl
            ? (clsSizeByLvl[nextLevel] ?? clsSize)
            : clsSize;
          const nextLvlCap    = BUILDINGS[b.type]
            ? (() => {
                const bDef = BUILDINGS[b.type];
                const base = bDef.capacity || {};
                const pLvl = bDef.capacityPerLevel || {};
                const result = {};
                for (const k of Object.keys(base)) {
                  result[k] = (base[k] || 0) + (pLvl[k] || 0) * (nextLevel - 1);
                }
                return result;
              })()
            : {};

          // Tip bazlı detay bölümü
          let detailsHtml = '';

          if (b.type === 'fakulte_binasi' || b.type === 'amfi') {
            const studentCapacity = cap.classrooms ? cap.classrooms * clsSize : 0;
            const nextStudentCap  = nextLvlCap.classrooms ? nextLvlCap.classrooms * nextLvlClsSize : 0;
            const assignedDepts   = (b.assignedDepartments || []).map(dId => {
              const d = depts.find(dep => dep.id === dId);
              if (!d) return null;
              const dDeptData   = state.students?.byDepartment?.[dId];
              const dStudents   = dDeptData
                ? ((dDeptData.year1?.count || 0) + (dDeptData.year2?.count || 0) +
                   (dDeptData.year3?.count || 0) + (dDeptData.year4?.count || 0))
                : 0;
              const dFaculty    = (state.faculty || []).filter(f => (f.department || f.departmentId) === dId).length;
              return `<div style="margin-top:3px;font-size:11px;color:#cbd5e1;">• ${d.shortName || d.name} (${dStudents} öğrenci, ${dFaculty} hoca)</div>`;
            }).filter(Boolean).join('');

            detailsHtml = `
              ${cap.classrooms ? `
                <div style="margin-bottom:6px;">
                  <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:3px;">🏫 DERSLİKLER</div>
                  <div style="font-size:11px;color:#cbd5e1;">• ${cap.classrooms} adet × ${clsSize} kişilik = ${studentCapacity.toLocaleString('tr-TR')} öğrenci kapasitesi</div>
                  <div style="font-size:11px;color:#cbd5e1;">• Kullanılan: ${used.classrooms ?? 0} derslik · Boş: ${Math.max(0, cap.classrooms - (used.classrooms ?? 0))}</div>
                  ${nextLevel <= maxLvl && nextLvlCap.classrooms
                    ? `<div style="font-size:10px;color:#64748b;margin-top:1px;">Düzey ${nextLevel}'e Yükselt: ${nextLvlCap.classrooms} derslik × ${nextLvlClsSize} kişilik = ${nextStudentCap.toLocaleString('tr-TR')} öğrenci kapasitesi${nextLvlClsSize > clsSize ? ` (derslik büyütüldü: ${clsSize}→${nextLvlClsSize} kişi)` : ''}</div>`
                    : ''}
                </div>` : ''}
              ${cap.offices ? `
                <div style="margin-bottom:6px;">
                  <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:3px;">🏢 OFİSLER</div>
                  <div style="font-size:11px;color:#cbd5e1;">• ${cap.offices} adet ofis · Kullanılan: ${used.offices ?? 0} · Boş: ${Math.max(0, cap.offices - (used.offices ?? 0))}</div>
                  <div style="font-size:10px;color:#64748b;margin-top:1px;">Boş ofis varken herkes tek ofis alır. Yetersizse: Dr.Öğr.Üyesi 2/ofis, ArGö 3/ofis</div>
                  ${nextLevel <= maxLvl && nextLvlCap.offices ? `<div style="font-size:10px;color:#64748b;margin-top:1px;">Düzey ${nextLevel}'de: ${nextLvlCap.offices} ofis</div>` : ''}
                </div>` : ''}
              ${cap.labs != null ? `
                <div style="margin-bottom:6px;">
                  <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:3px;">🔬 LABORATUVARLAR</div>
                  <div style="font-size:11px;color:#cbd5e1;">• ${cap.labs || 0} adet${cap.labs === 0 ? ' (Lab binası gerekli)' : ` · Kullanılan: ${used.labs ?? 0} · Boş: ${Math.max(0, cap.labs - (used.labs ?? 0))}`}</div>
                </div>` : ''}
              ${assignedDepts ? `
                <div style="margin-bottom:6px;">
                  <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:3px;">📌 ATANMIŞ BÖLÜMLER</div>
                  ${assignedDepts}
                </div>` : `
                <div style="font-size:11px;color:#64748b;font-style:italic;margin-bottom:6px;">Henüz bölüm atanmadı — "Bölüm Ata" ile ekle</div>
              `}`;
          } else if (b.type === 'kutuphane') {
            const simCap   = cap.simultaneous || 200;
            const dailyCap = cap.daily || 800;
            const nextSim  = nextLvlCap.simultaneous || 0;
            const nextDly  = nextLvlCap.daily || 0;
            const pct      = totalStudents > 0 ? Math.round((totalStudents / dailyCap) * 100) : 0;
            const sfxIcon  = pct <= 100 ? '✅' : pct <= 130 ? '⚠️' : '❌';
            const sfxColor = pct <= 100 ? '#4ade80' : pct <= 130 ? '#f59e0b' : '#ef4444';
            const sfxText  = pct <= 100 ? 'Yeterli' : pct <= 130 ? 'Sınırda' : 'Yetersiz';
            detailsHtml = `
              <div style="margin-bottom:6px;">
                <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:3px;">📚 HİZMET KAPASİTESİ</div>
                <div style="font-size:11px;color:#cbd5e1;">• Aynı anda ${simCap.toLocaleString('tr-TR')} öğrenci çalışabilir</div>
                <div style="font-size:11px;color:#cbd5e1;">• Günlük kapasite: ~${dailyCap.toLocaleString('tr-TR')} öğrenci</div>
                <div style="font-size:11px;color:#cbd5e1;">• Mevcut öğrenci: ${totalStudents.toLocaleString('tr-TR')}</div>
                <div style="font-size:11px;margin-top:3px;">Yeterlilik: <span style="color:${sfxColor};">${sfxIcon} %${pct} — ${sfxText}</span></div>
                ${nextLevel <= maxLvl ? `<div style="font-size:10px;color:#64748b;margin-top:3px;">Düzey ${nextLevel}'de: ${nextSim} eş zamanlı · ${nextDly} günlük</div>` : ''}
              </div>
              <div style="margin-bottom:6px;">
                <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:3px;">📖 ETKİLERİ</div>
                <div style="font-size:11px;color:#cbd5e1;">• Öğrenci memnuniyeti: +5</div>
                <div style="font-size:11px;color:#cbd5e1;">• Araştırma bonusu: +%5</div>
                <div style="font-size:11px;color:#cbd5e1;">• GPA etkisi: +0.1 ortalama</div>
                ${pct > 100 ? `<div style="font-size:11px;color:#f59e0b;margin-top:3px;">⚠️ Öğrenci sayısı ${dailyCap} günlük kapasiteyi aşıyor!</div>` : ''}
              </div>`;
          } else if (b.type === 'yemekhane') {
            const mealsBuildings = (state.buildings || []).filter(bld => bld.type === 'yemekhane' && bld.isCompleted);
            const totalMealCap   = mealsBuildings.reduce((s, bld) => s + ((bld.currentCapacity?.dailyMeals) || 0), 0);
            const need           = totalStudents + totalFaculty;
            const pct            = need > 0 && totalMealCap > 0 ? Math.round((need / totalMealCap) * 100) : 0;
            const sfxIcon        = pct <= 100 ? '✅' : pct <= 130 ? '⚠️' : '❌';
            const sfxColor       = pct <= 100 ? '#4ade80' : pct <= 130 ? '#f59e0b' : '#ef4444';
            const sfxText        = pct <= 100 ? 'Yeterli' : pct <= 130 ? 'Sınırda' : 'Yetersiz';
            const myCap          = cap.dailyMeals || 0;
            const nextCap2       = nextLvlCap.dailyMeals || 0;
            detailsHtml = `
              <div style="margin-bottom:6px;">
                <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:3px;">🍽️ HİZMET KAPASİTESİ</div>
                <div style="font-size:11px;color:#cbd5e1;">• Bu yemekhane: günlük ${myCap.toLocaleString('tr-TR')} öğün</div>
                <div style="font-size:11px;color:#cbd5e1;">• Yerleşke toplam: ${totalMealCap.toLocaleString('tr-TR')} öğün/gün</div>
                <div style="font-size:11px;color:#cbd5e1;">• Mevcut ihtiyaç: ${totalStudents} öğrenci + ${totalFaculty} hoca = ${need.toLocaleString('tr-TR')}</div>
                <div style="font-size:11px;margin-top:3px;">Yeterlilik: <span style="color:${sfxColor};">${sfxIcon} %${pct} — ${sfxText}</span></div>
                ${pct > 100 ? `<div style="font-size:10px;color:#f59e0b;margin-top:2px;">Kuyruk/bekleme süresi artıyor → memnuniyet düşüyor</div>` : ''}
                ${nextLevel <= maxLvl ? `<div style="font-size:10px;color:#64748b;margin-top:3px;">Düzey ${nextLevel}'de: ${nextCap2.toLocaleString('tr-TR')} öğün/gün</div>` : ''}
              </div>
              <div style="margin-bottom:6px;">
                <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:3px;">🍽️ ETKİLERİ</div>
                <div style="font-size:11px;color:#cbd5e1;">• Öğrenci memnuniyeti: ${pct <= 100 ? '+6 (yeterli)' : '-3 (yetersiz)'}</div>
                <div style="font-size:11px;color:#cbd5e1;">• Hoca memnuniyeti: ${pct <= 100 ? '+4 (yeterli)' : '-2 (yetersiz)'}</div>
              </div>`;
          } else if (b.type === 'yurt') {
            const totalBedCap = ((state.buildings || []).filter(bld => bld.type === 'yurt' && bld.isCompleted)
              .reduce((s, bld) => s + ((bld.currentCapacity?.beds) || 0), 0));
            const dormPct     = totalBedCap > 0 && totalStudents > 0
              ? Math.round((Math.min(totalBedCap, totalStudents) / totalStudents) * 100)
              : 0;
            const usedBeds    = used.beds ?? Math.min(totalStudents, cap.beds || 0);
            const freeBeds    = Math.max(0, (cap.beds || 0) - usedBeds);
            const ocpPct      = cap.beds ? Math.round((usedBeds / cap.beds) * 100) : 0;
            const dormRev     = usedBeds * 5_000;
            const nextBeds    = nextLvlCap.beds || 0;
            detailsHtml = `
              <div style="margin-bottom:6px;">
                <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:3px;">🛏️ YATAK KAPASİTESİ</div>
                <div style="font-size:11px;color:#cbd5e1;">• ${(cap.beds || 0).toLocaleString('tr-TR')} yatak · Dolu: ${usedBeds} · Boş: ${freeBeds}</div>
                <div style="font-size:11px;color:#cbd5e1;">• Doluluk: %${ocpPct}</div>
                <div style="font-size:11px;color:#cbd5e1;">• Toplam yatak / toplam öğrenci: %${dormPct} yurt imkânı</div>
                ${nextLevel <= maxLvl ? `<div style="font-size:10px;color:#64748b;margin-top:3px;">Düzey ${nextLevel}'de: ${nextBeds.toLocaleString('tr-TR')} yatak</div>` : ''}
              </div>
              <div style="margin-bottom:6px;">
                <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:3px;">🏠 ETKİLERİ</div>
                <div style="font-size:11px;color:#cbd5e1;">• Yurtlu öğrenci memnuniyeti: +8</div>
                ${dormPct < 40 ? `<div style="font-size:11px;color:#f59e0b;">• Yurtsuz öğrenci oranı yüksek → memnuniyet düşer</div>` : ''}
              </div>
              <div style="margin-bottom:6px;">
                <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:3px;">💰 GELİR</div>
                <div style="font-size:11px;color:#cbd5e1;">• Yurt geliri: ${usedBeds} × 5.000 ₺ = ${formatMoney(dormRev)}/dönem</div>
              </div>`;
          } else if (b.type === 'spor_tesisi') {
            const sporCap  = cap.dailyUsers || 500;
            const nextSCap = nextLvlCap.dailyUsers || 0;
            const pct      = totalStudents > 0 ? Math.round((totalStudents / sporCap) * 100) : 0;
            const sfxIcon  = pct <= 100 ? '✅' : pct <= 130 ? '⚠️' : '❌';
            const sfxColor = pct <= 100 ? '#4ade80' : pct <= 130 ? '#f59e0b' : '#ef4444';
            const sfxText  = pct <= 100 ? 'Yeterli' : pct <= 130 ? 'Sınırda' : 'Yetersiz';
            detailsHtml = `
              <div style="margin-bottom:6px;">
                <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:3px;">⚽ HİZMET KAPASİTESİ</div>
                <div style="font-size:11px;color:#cbd5e1;">• Günlük ${sporCap.toLocaleString('tr-TR')} öğrenci/kullanıcı kapasitesi</div>
                <div style="font-size:11px;color:#cbd5e1;">• Mevcut öğrenci: ${totalStudents.toLocaleString('tr-TR')}</div>
                <div style="font-size:11px;margin-top:3px;">Yeterlilik: <span style="color:${sfxColor};">${sfxIcon} %${pct} — ${sfxText}</span></div>
                ${nextLevel <= maxLvl ? `<div style="font-size:10px;color:#64748b;margin-top:3px;">Düzey ${nextLevel}'de: ${nextSCap.toLocaleString('tr-TR')} kişi/gün</div>` : ''}
              </div>
              <div style="margin-bottom:6px;">
                <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:3px;">⚽ ETKİLERİ</div>
                <div style="font-size:11px;color:#cbd5e1;">• Öğrenci memnuniyeti: +6</div>
                <div style="font-size:11px;color:#cbd5e1;">• Saygınlık: +2</div>
                ${pct > 130 ? `<div style="font-size:11px;color:#ef4444;">• Kapasite aşıldı — öğrenci şikâyeti artıyor</div>` : ''}
              </div>`;
          } else if (b.type === 'lab') {
            // Lab binası: bağlı bölümler ve labScore katkısı
            const labBonus    = 25 * (b.level || 1);
            const labTotalCap = cap.labs || 0;
            const linkedLabDepts = (b.linkedDepartments || []).map(dId => {
              const d = (state.departments || []).find(dep => dep.id === dId);
              if (!d) return null;
              return `<div style="font-size:11px;color:#cbd5e1;">• ${d.shortName || d.name} — labScore +${labBonus} puan</div>`;
            }).filter(Boolean).join('');
            detailsHtml = `
              <div style="margin-bottom:6px;">
                <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:3px;">🔬 LAB KAPASİTESİ</div>
                <div style="font-size:11px;color:#cbd5e1;">• ${labTotalCap} laboratuvar · Düzey ${b.level || 1}</div>
                <div style="font-size:11px;color:#4ade80;margin-top:2px;">• Bağlandığı bölüme +${labBonus} labScore katkısı (düzey × 25)</div>
              </div>
              <div style="margin-bottom:6px;">
                <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:3px;">🔗 BAĞLI BÖLÜMLER</div>
                ${linkedLabDepts || '<div style="font-size:11px;color:#64748b;font-style:italic;">Henüz bölüm bağlanmadı — "Lab Bağla" ile ekle</div>'}
              </div>`;
          } else {
            // Diğer binalar (araştırma merkezi, konferans vb.)
            const capBarsHtml = [
              cap.offices    ? _capacityBar('Ofis',    used.offices    ?? 0, cap.offices)    : '',
              cap.classrooms ? _capacityBar('Derslik', used.classrooms ?? 0, cap.classrooms) : '',
              cap.labs       ? _capacityBar('Lab',     used.labs       ?? 0, cap.labs)       : '',
              cap.beds       ? _capacityBar('Yatak',   used.beds       ?? 0, cap.beds)       : '',
            ].join('');
            detailsHtml = `
              ${capBarsHtml}
              ${cat.benefitText ? `<div style="margin-top:6px;font-size:11px;color:#64748b;font-style:italic;">${cat.benefitText}</div>` : ''}`;
          }

          return `
            <div class="building-card" style="padding:14px;flex-direction:column;align-items:stretch;">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                <span style="font-size:24px;">${cat.icon || '🏛️'}</span>
                <div style="flex:1;min-width:0;">
                  <div class="building-name" style="margin:0;">
                    <span class="building-name-text" data-building-id="${b.id}">${b.name || cat.name} <span class="btn-rename" data-building-id="${b.id}" title="Yeniden adlandır" style="cursor:pointer;font-size:13px;opacity:0.6;">✏️</span></span>
                  </div>
                  <div style="font-size:12px;color:#f59e0b;">${_levelStars(b.level || 1, maxLvl)} Düzey ${b.level || 1}/${maxLvl}</div>
                </div>
                <span class="badge badge-success" style="flex-shrink:0;">Aktif</span>
              </div>

              <div style="font-size:11px;color:#94a3b8;margin-bottom:8px;">
                📐 ${(b.area || 0).toLocaleString('tr-TR')} m²
                &nbsp;·&nbsp;
                🔧 Bakım: <span style="color:#e2e8f0;">${formatMoney(b.maintenanceCost || 0)}/dönem</span>
              </div>

              <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:8px;margin-bottom:6px;">
                ${detailsHtml}
              </div>

              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);">
                ${upgCost > 0 ? `
                  <button class="btn-campus-upgrade btn-small"
                          data-building-id="${b.id}"
                          ${budget < upgCost ? 'disabled title="Yetersiz bütçe"' : ''}
                          style="font-size:11px;">
                    ▲ Düzey ${nextLevel}'e Yükselt (${formatMoney(upgCost)})
                  </button>` : `<span style="font-size:11px;color:#64748b;align-self:center;">Maks. düzey</span>`}
                ${cat.assignable ? `
                <button class="btn-campus-assign btn-small"
                        data-building-id="${b.id}"
                        style="font-size:11px;">
                  ${b.type === 'lab' ? '🔗 Lab Bağla' : '📌 Bölüm Ata'}
                </button>` : ''}
              </div>
            </div>`;
        }).join('')}
      </div>
    ` : ''}

    <!-- İnşaat Seçenekleri -->
    <div class="section-title">İnşaat Seçenekleri</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;">
      ${BUILDING_CATALOG.map(b => {
        const count        = existingTypeCounts[b.type] || 0;
        const inProgress   = buildings.some(bld => bld.type === b.type && !bld.isCompleted);
        const blockedSingle = !b.canHaveMultiple && count > 0;
        const canAfford    = budget >= b.cost;
        const effects      = _formatBuildingEffects({ ...b.qualityEffects, ...b.effects });
        const disabled     = blockedSingle || inProgress;
        const maintEst     = b.baseArea && b.maintenanceCostPerM2
          ? `${(b.baseArea * b.maintenanceCostPerM2).toLocaleString('tr-TR')} ₺/dönem`
          : null;

        return `
          <div class="building-card available"
               style="${disabled ? 'opacity:0.5;cursor:default;' : 'cursor:pointer;'}"
               data-build-type="${b.type}">
            <div class="building-icon">${b.icon}</div>
            <div class="building-info">
              <div class="building-name">${b.name}${b.canHaveMultiple ? ' <span style="font-size:10px;color:#64748b;">(çok sayıda yapılabilir)</span>' : ''}</div>
              <div class="building-desc">${b.desc || ''}</div>
              ${effects.length > 0 ? `
                <div style="margin-top:6px;font-size:11px;color:#4ade80;line-height:1.6;">
                  ${effects.map(e => `<div>▸ ${e}</div>`).join('')}
                </div>
              ` : ''}
              <div style="margin-top:8px;font-size:11px;color:#94a3b8;">
                ⏱ ${b.constructionTime} dönem · 📐 ${(b.baseArea || 0).toLocaleString('tr-TR')} m²
                ${maintEst ? ` · 🔧 ~${maintEst}` : ''}
              </div>
              <div style="margin-top:6px;font-size:12px;">
                ${blockedSingle
                  ? `<span class="badge badge-success">✓ Mevcut</span>`
                  : inProgress
                    ? `<span class="badge badge-warning">🔨 Yapım aşamasında</span>`
                    : `<span class="badge ${canAfford ? 'badge-warning' : 'badge-danger'}">
                         💰 ${formatMoney(b.cost)} · ${b.constructionTime} dönem${!canAfford ? ' · Yetersiz bütçe' : ''}
                       </span>`
                }
              </div>
            </div>
          </div>`;
      }).join('')}
    </div>

      </div><!-- /campus-main -->

      <!-- SAĞ: Küçük harita önizlemesi -->
      <div class="campus-map-sidebar">
        <div class="campus-map-preview" id="campus-map-preview" title="Haritayı büyütmek için tıklayın">
          <canvas id="campus-canvas" width="960" height="600"></canvas>
          <div id="campus-tooltip" class="campus-tooltip" style="display:none;"></div>
          <div class="campus-map-expand-hint">🔍 Büyütmek için tıklayın</div>
        </div>
      </div>

    </div><!-- /campus-layout -->

    <!-- Tam ekran harita katmanı (varsayılan: gizli) -->
    <div class="campus-map-fullscreen" id="campus-map-fullscreen" style="display:none;">
      <div class="campus-map-fullscreen-header">
        <span>Kampüs Haritası</span>
        <button class="campus-map-close" id="campus-map-close">✕</button>
      </div>
      <div style="position:relative;width:90%;max-width:1200px;">
        <canvas id="campus-canvas-full" width="1200" height="750"></canvas>
        <div id="campus-tooltip-full" class="campus-tooltip" style="display:none;"></div>
      </div>
    </div>
  `;

  // Kampüs haritası canvas — innerHTML her yenilendiğinde yeniden bağlanmalı
  const campusCanvas = document.getElementById('campus-canvas');
  if (campusCanvas) {
    renderCampusMap(campusCanvas, state);

    campusCanvas.addEventListener('click', (e) => {
      const building = handleCampusClick(e, campusCanvas, state);
      const tooltip = document.getElementById('campus-tooltip');
      if (building && tooltip) {
        tooltip.style.display = 'block';
        tooltip.style.left = (e.offsetX + 12) + 'px';
        tooltip.style.top = (e.offsetY - 12) + 'px';
        const statusText = building.isCompleted ? '✅ Aktif' : `🔨 Yapım: %${Math.round(building.constructionProgress || 0)}`;
        tooltip.innerHTML = `
          <strong>${building.name || building.type}</strong><br>
          Düzey ${building.level || 1} · ${(building.area || 0).toLocaleString('tr-TR')} m²<br>
          ${statusText}
        `;
      } else if (tooltip) {
        tooltip.style.display = 'none';
      }
      renderCampusMap(campusCanvas, state);
    });

    campusCanvas.addEventListener('mousemove', (e) => {
      handleCampusHover(e, campusCanvas, state);
      renderCampusMap(campusCanvas, state);
    });

    campusCanvas.addEventListener('mouseleave', () => {
      clearHover();
      renderCampusMap(campusCanvas, state);
      const tooltip = document.getElementById('campus-tooltip');
      if (tooltip) tooltip.style.display = 'none';
    });
  }

  // Tam ekran harita — önizlemeye tıklanınca aç
  const mapPreview  = document.getElementById('campus-map-preview');
  const fullscreen  = document.getElementById('campus-map-fullscreen');
  const closeBtn    = document.getElementById('campus-map-close');
  const fullCanvas  = document.getElementById('campus-canvas-full');

  function openFullscreen() {
    if (!fullscreen || !fullCanvas) return;
    fullscreen.style.display = 'flex';
    renderCampusMap(fullCanvas, state);

    // Tam ekran kanvasında da tooltip + hover
    fullCanvas.addEventListener('click', _fullCanvasClick);
    fullCanvas.addEventListener('mousemove', _fullCanvasMove);
    fullCanvas.addEventListener('mouseleave', _fullCanvasLeave);
  }

  function closeFullscreen() {
    if (!fullscreen) return;
    fullscreen.style.display = 'none';
    clearHover();
    fullCanvas.removeEventListener('click', _fullCanvasClick);
    fullCanvas.removeEventListener('mousemove', _fullCanvasMove);
    fullCanvas.removeEventListener('mouseleave', _fullCanvasLeave);
    const tt = document.getElementById('campus-tooltip-full');
    if (tt) tt.style.display = 'none';
  }

  function _fullCanvasClick(e) {
    const building = handleCampusClick(e, fullCanvas, state);
    const tooltip  = document.getElementById('campus-tooltip-full');
    if (building && tooltip) {
      tooltip.style.display = 'block';
      tooltip.style.left = (e.offsetX + 12) + 'px';
      tooltip.style.top  = (e.offsetY - 12) + 'px';
      const statusText = building.isCompleted ? '✅ Aktif' : `🔨 Yapım: %${Math.round(building.constructionProgress || 0)}`;
      tooltip.innerHTML = `
        <strong>${building.name || building.type}</strong><br>
        Düzey ${building.level || 1} · ${(building.area || 0).toLocaleString('tr-TR')} m²<br>
        ${statusText}
      `;
    } else if (tooltip) {
      tooltip.style.display = 'none';
    }
    renderCampusMap(fullCanvas, state);
  }

  function _fullCanvasMove(e) {
    handleCampusHover(e, fullCanvas, state);
    renderCampusMap(fullCanvas, state);
  }

  function _fullCanvasLeave() {
    clearHover();
    renderCampusMap(fullCanvas, state);
    const tt = document.getElementById('campus-tooltip-full');
    if (tt) tt.style.display = 'none';
  }

  if (mapPreview) {
    mapPreview.addEventListener('click', (e) => {
      // Tıklama önizleme div'ine ait olmalı (canvas veya hint dahil)
      openFullscreen();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeFullscreen();
    });
  }

  if (fullscreen) {
    // Arka plana tıklayınca kapat (header veya canvas dışı)
    fullscreen.addEventListener('click', (e) => {
      if (e.target === fullscreen) closeFullscreen();
    });
  }

  // Escape tuşuyla kapat — her render'da eski dinleyiciyi temizle
  if (panel._escListener) {
    document.removeEventListener('keydown', panel._escListener);
  }
  panel._escListener = (e) => {
    if (e.key === 'Escape' && fullscreen && fullscreen.style.display !== 'none') {
      closeFullscreen();
    }
  };
  document.addEventListener('keydown', panel._escListener);

  // Olay dinleyicilerini yalnızca bir kez bağla (her render'da tekrar ekleme)
  if (!panel._campusListenersAttached) {
    panel._campusListenersAttached = true;

    // İnşaat başlat tıklama
    delegate(panel, '.building-card.available', 'click', (e, card) => {
      if (card.style.cursor === 'default') return;
      const btype = card.dataset.buildType;
      const catalog = BUILDING_CATALOG.find(c => c.type === btype);
      if (!catalog) return;

      const currentBudget = panel._currentBudget ?? 0;
      if (currentBudget < catalog.cost) {
        showNotification(`Yetersiz bütçe. Gerekli: ${formatMoney(catalog.cost)}`, 'danger');
        return;
      }

      if (panel._onBuildStart) panel._onBuildStart(btype, catalog);
    });

    // Düzey yükselt butonu tıklama
    delegate(panel, '.btn-campus-upgrade', 'click', (e, btn) => {
      e.stopPropagation();
      const buildingId = btn.dataset.buildingId;
      if (!buildingId) return;
      if (panel._onDecision) panel._onDecision({ type: 'upgrade_building', buildingId });
    });

    // Bölüm ata butonu tıklama
    delegate(panel, '.btn-campus-assign', 'click', (e, btn) => {
      e.stopPropagation();
      const buildingId = btn.dataset.buildingId;
      if (!buildingId) return;
      const building = (panel._currentState?.buildings || []).find(b => b.id === buildingId);
      if (!building) return;
      _showDepartmentAssignModal(panel._currentState, building, panel._onDecision);
    });

    // Bina yeniden adlandır
    delegate(panel, '.btn-rename', 'click', (e, btn) => {
      e.stopPropagation();
      const buildingId = btn.dataset.buildingId;
      if (!buildingId) return;
      const building = (panel._currentState?.buildings || []).find(b => b.id === buildingId);
      if (!building) return;

      const nameSpan = panel.querySelector(`.building-name-text[data-building-id="${buildingId}"]`);
      if (!nameSpan) return;
      if (nameSpan.querySelector('input')) return; // zaten düzenleme modunda

      const currentName = building.name || building.type;
      const input = document.createElement('input');
      input.type = 'text';
      input.value = currentName;
      input.style.cssText = 'font-size:13px;font-weight:600;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.3);border-radius:4px;padding:2px 6px;color:var(--text-primary);width:180px;';

      const originalContent = nameSpan.innerHTML;
      nameSpan.innerHTML = '';
      nameSpan.appendChild(input);
      input.focus();
      input.select();

      let _savedOnce = false;
      function saveName() {
        if (_savedOnce) return;
        _savedOnce = true;
        const newName = input.value.trim();
        if (newName && newName !== currentName) {
          building.name = newName;
          if (panel._onDecision) {
            panel._onDecision({ type: 'rename_building', buildingId, newName });
          }
        }
        nameSpan.innerHTML = originalContent.replace(
          /^[^<]*/,
          (building.name || currentName) + ' '
        );
      }

      input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') { saveName(); }
        if (ke.key === 'Escape') { _savedOnce = true; nameSpan.innerHTML = originalContent; }
      });
      input.addEventListener('blur', saveName);
    });
  }

  // Her render'da güncel callback/state/budget referanslarını sakla
  panel._currentState  = state;
  panel._currentBudget = budget;
  panel._onBuildStart  = onBuildStart;
  panel._onDecision    = onDecision;
}

/**
 * Bölüm atama modalını göster (prompt() yerine tam arayüz).
 * @param {object}   state      — Oyun durumu
 * @param {object}   building   — Hedef bina nesnesi
 * @param {Function} onDecision — Karar callback
 */
function _showDepartmentAssignModal(state, building, onDecision) {
  const allDepts     = state.departments || [];
  const allBuildings = state.buildings || [];
  const isLab        = building.type === 'lab';

  /** Modal içeriğini üretir */
  function _buildModalBody() {
    if (allDepts.length === 0) {
      return `<div style="color:var(--text-muted);font-size:13px;padding:12px 0;">Henüz hiç bölüm kurulmamış.</div>`;
    }

    const rows = allDepts.map(dept => {
      let statusBadge = '';
      let rowStyle    = 'display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:8px;cursor:pointer;border:1px solid transparent;transition:background .15s;';
      let actionHint  = '';
      let dataAttr    = '';

      if (isLab) {
        // Lab binası: linkedDepartments üzerinden kontrol
        const linkedHere = (building.linkedDepartments || []).includes(dept.id);

        if (linkedHere) {
          statusBadge = `<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(76,175,80,0.15);color:#4caf50;border:1px solid rgba(76,175,80,0.3);flex-shrink:0;">✓ Bağlı</span>`;
          rowStyle   += 'background:rgba(76,175,80,0.06);border-color:rgba(76,175,80,0.2);';
          actionHint  = `<span style="font-size:11px;color:var(--text-muted);margin-left:auto;flex-shrink:0;">Kaldır</span>`;
          dataAttr    = `data-action="unassign" data-dept-id="${dept.id}"`;
        } else {
          // Hangi fakülte binasında olduğunu göster (bilgi amaçlı)
          const facultyBuilding = allBuildings.find(b => b.type !== 'lab' && (b.assignedDepartments || []).includes(dept.id));
          if (facultyBuilding) {
            const fname = facultyBuilding.name || facultyBuilding.id;
            statusBadge = `<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(100,148,237,0.12);color:#64a0e8;border:1px solid rgba(100,148,237,0.3);flex-shrink:0;">🏛️ ${fname}</span>`;
          }
          actionHint  = `<span style="font-size:11px;color:#4ade80;margin-left:auto;flex-shrink:0;">Bağla</span>`;
          dataAttr    = `data-action="assign" data-dept-id="${dept.id}"`;
        }
      } else {
        // Normal bina: assignedDepartments üzerinden kontrol
        const assignedHere  = (building.assignedDepartments || []).includes(dept.id);
        const otherBuilding = assignedHere ? null :
          allBuildings.find(b => b.id !== building.id && b.type !== 'lab' && (b.assignedDepartments || []).includes(dept.id));

        if (assignedHere) {
          statusBadge = `<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(76,175,80,0.15);color:#4caf50;border:1px solid rgba(76,175,80,0.3);flex-shrink:0;">✓ Bu binada</span>`;
          rowStyle   += 'background:rgba(76,175,80,0.06);border-color:rgba(76,175,80,0.2);';
          actionHint  = `<span style="font-size:11px;color:var(--text-muted);margin-left:auto;flex-shrink:0;">Kaldır</span>`;
          dataAttr    = `data-action="unassign" data-dept-id="${dept.id}"`;
        } else if (otherBuilding) {
          const otherName = otherBuilding.name || otherBuilding.id;
          statusBadge = `<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(255,152,0,0.12);color:#ff9800;border:1px solid rgba(255,152,0,0.3);flex-shrink:0;">📍 ${otherName}</span>`;
          rowStyle   += 'background:rgba(255,152,0,0.04);border-color:rgba(255,152,0,0.15);';
          actionHint  = `<span style="font-size:11px;color:#ff9800;margin-left:auto;flex-shrink:0;">Taşı</span>`;
          dataAttr    = `data-action="move" data-dept-id="${dept.id}" data-from-building-id="${otherBuilding.id}"`;
        } else {
          rowStyle   += '';
          actionHint  = `<span style="font-size:11px;color:var(--text-muted);margin-left:auto;flex-shrink:0;">Ata</span>`;
          dataAttr    = `data-action="assign" data-dept-id="${dept.id}"`;
        }
      }

      return `
        <div class="dept-assign-row" ${dataAttr} style="${rowStyle}"
             onmouseover="this.style.background=this.dataset.action==='unassign'?'rgba(76,175,80,0.12)':this.dataset.action==='move'?'rgba(255,152,0,0.1)':'rgba(255,255,255,0.05)'"
             onmouseout="this.style.background=this.dataset.action==='unassign'?'rgba(76,175,80,0.06)':this.dataset.action==='move'?'rgba(255,152,0,0.04)':''"
        >
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${dept.name}</div>
            ${dept.shortName ? `<div style="font-size:11px;color:var(--text-muted);">${dept.shortName}</div>` : ''}
          </div>
          ${statusBadge}
          ${actionHint}
        </div>`;
    }).join('');

    const hint = isLab
      ? 'Bir bölüme tıklayarak bu lab binasına bağlayabilirsiniz. Bölüm, fakülte binasında kalmaya devam eder.'
      : 'Bir bölüme tıklayarak atama yapabilir, kaldırabilir veya başka binadan taşıyabilirsiniz.';

    return `
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">
        ${hint}
      </div>
      <div id="dept-assign-list" style="display:flex;flex-direction:column;gap:6px;max-height:420px;overflow-y:auto;padding-right:4px;">
        ${rows}
      </div>`;
  }

  // İlk açılış
  const modalTitle = isLab ? `Lab Bağla — ${building.name}` : `Bölüm Ata — ${building.name}`;
  showModal(modalTitle, _buildModalBody());

  // Event listener: modal body üzerinde delegasyon
  // Her modal açılışında yeni listener eklenmesini önlemek için önce eskisini temizle
  const modalBody = el('general-modal-body');
  if (!modalBody) return;

  if (modalBody._deptAssignHandler) {
    modalBody.removeEventListener('click', modalBody._deptAssignHandler);
  }

  modalBody._deptAssignHandler = function _modalClickHandler(ev) {
    const row = ev.target.closest('.dept-assign-row');
    if (!row) return;

    const action      = row.dataset.action;
    const deptId      = row.dataset.deptId;
    const fromBuildId = row.dataset.fromBuildingId;

    if (!action || !deptId) return;

    if (action === 'assign') {
      onDecision && onDecision({ type: 'assign_department_to_building', buildingId: building.id, departmentId: deptId });
      if (isLab) {
        // Yerel state'i anında güncelle — linkedDepartments
        if (!building.linkedDepartments) building.linkedDepartments = [];
        if (!building.linkedDepartments.includes(deptId)) building.linkedDepartments.push(deptId);
      } else {
        // Yerel state'i anında güncelle — assignedDepartments
        if (!building.assignedDepartments) building.assignedDepartments = [];
        if (!building.assignedDepartments.includes(deptId)) building.assignedDepartments.push(deptId);
      }
      // Modalı yenile
      modalBody.innerHTML = _buildModalBody();

    } else if (action === 'unassign') {
      onDecision && onDecision({ type: 'unassign_department_from_building', buildingId: building.id, departmentId: deptId });
      // Yerel state'i anında güncelle
      if (isLab) {
        building.linkedDepartments = (building.linkedDepartments || []).filter(id => id !== deptId);
      } else {
        building.assignedDepartments = (building.assignedDepartments || []).filter(id => id !== deptId);
      }
      modalBody.innerHTML = _buildModalBody();

    } else if (action === 'move') {
      // Taşıma (sadece normal binalar için): önce inline onay göster
      const dept = (state.departments || []).find(d => d.id === deptId);
      const srcBuilding = (state.buildings || []).find(b => b.id === fromBuildId);
      const deptName = dept ? dept.name : deptId;
      const srcName  = srcBuilding ? (srcBuilding.name || srcBuilding.id) : fromBuildId;

      // Mevcut bir onay paneli varsa kaldır
      const existingConfirm = modalBody.querySelector('.move-confirm-panel');
      if (existingConfirm) existingConfirm.remove();

      const confirmPanel = document.createElement('div');
      confirmPanel.className = 'move-confirm-panel';
      confirmPanel.style.cssText = 'margin:10px 0;padding:12px 14px;border-radius:8px;background:rgba(255,152,0,0.1);border:1px solid rgba(255,152,0,0.35);font-size:12px;';
      confirmPanel.innerHTML = `
        <div style="color:#f59e0b;font-weight:600;margin-bottom:8px;">Bölümü Taşı</div>
        <div style="color:var(--text-primary);margin-bottom:10px;">
          <strong>${deptName}</strong> şu an <strong>${srcName}</strong> içinde.
          Bu binaya taşımak istiyor musunuz?
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn-move-confirm btn-small" data-dept-id="${deptId}" data-from-building-id="${fromBuildId}" style="font-size:11px;background:#f59e0b;color:#1e293b;border:none;">Evet, Taşı</button>
          <button class="btn-move-cancel btn-small" style="font-size:11px;">İptal</button>
        </div>`;

      // Listenin üstüne ekle
      const list = modalBody.querySelector('#dept-assign-list');
      if (list) {
        list.insertAdjacentElement('beforebegin', confirmPanel);
      } else {
        modalBody.insertAdjacentElement('afterbegin', confirmPanel);
      }

      confirmPanel.querySelector('.btn-move-cancel').addEventListener('click', () => {
        confirmPanel.remove();
      });

      confirmPanel.querySelector('.btn-move-confirm').addEventListener('click', () => {
        confirmPanel.remove();
        if (fromBuildId) {
          onDecision && onDecision({ type: 'unassign_department_from_building', buildingId: fromBuildId, departmentId: deptId });
          if (srcBuilding) {
            srcBuilding.assignedDepartments = (srcBuilding.assignedDepartments || []).filter(id => id !== deptId);
          }
        }
        onDecision && onDecision({ type: 'assign_department_to_building', buildingId: building.id, departmentId: deptId });
        if (!building.assignedDepartments) building.assignedDepartments = [];
        if (!building.assignedDepartments.includes(deptId)) building.assignedDepartments.push(deptId);
        modalBody.innerHTML = _buildModalBody();
      });
    }

    // Delegasyon zaten modalBody üzerinde, innerHTML sonrası otomatik çalışır
  };

  modalBody.addEventListener('click', modalBody._deptAssignHandler);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. BÜTÇE PANELİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bütçe sekmesi: gelir/gider tablosu, pasta grafik, bütçe dağılım slider'ları.
 * @param {object}   state          — Oyun durumu
 * @param {Function} onAllocChange  — Bütçe dağılımı değişim callback (allocation alır)
 */
export function renderBudgetPanel(state, onAllocChange, onLoanAction) {
  const panel = el('tab-budget');
  if (!panel) return;

  const uni    = state.university || {};
  const alloc  = uni.budgetAllocation || {};
  const budget = uni.budget ?? 0;

  // Bütçe sayfası, dönem özetindeki gerçek ekonomi hesabıyla aynı kaynağı kullanır
  const incomeDetail  = calculateIncome(state);
  const expenseDetail = calculateExpenses(state);
  const revenue = incomeDetail.total || 0;
  const costs   = expenseDetail.total || 0;
  const net     = revenue - costs;

  const allocDefs = [
    { key: 'faculty',   label: 'Kadro & Maaşlar', color: '#e94560' },
    { key: 'research',  label: 'Araştırma Fonu',  color: '#9b59b6' },
    { key: 'students',  label: 'Öğrenci Hizm.',  color: '#4ecca3' },
    { key: 'marketing', label: 'Pazarlama',        color: '#f0a500' },
    { key: 'it',        label: 'BT Altyapı',       color: '#4fa3e0' },
    { key: 'reserve',   label: 'Acil Rezerv',      color: '#888' },
  ];

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-title">Bütçe Yönetimi</div>
        <div class="panel-subtitle">
          Mevcut: <strong class="${budget >= 0 ? 'text-good' : 'text-bad'}">${formatMoneyFull(budget)}</strong>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
      ${_statCardHtml('Dönem Geliri (Tahmini)', formatMoney(revenue), 'positive', '')}
      ${_statCardHtml('Dönem Gideri (Tahmini)', formatMoney(costs), 'negative', '')}
      ${_statCardHtml('Net Bakiye', formatMoney(net), net >= 0 ? 'positive' : 'negative', net >= 0 ? 'Artı bakiye' : 'Açık!')}
      ${_statCardHtml('Toplam Borç', formatMoney(uni.debt ?? 0), (uni.debt ?? 0) > 0 ? 'negative' : null, '')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">

      <div>
        <div class="section-title">Gelir / Gider Detayı</div>
        <div class="card" style="padding:0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Kalem</th>
                <th class="text-right">Dönemlik Tutar</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colspan="2" style="color:var(--accent-green);font-weight:700;padding:8px 12px 4px;font-size:11px;text-transform:uppercase;">GELİRLER</td></tr>
              ${_revenueLineItems(state, revenue, incomeDetail)}
              <tr style="border-top:2px solid var(--border-light);">
                <td style="font-weight:700;">Toplam Gelir</td>
                <td class="text-right font-bold text-good">${formatMoney(revenue)}</td>
              </tr>

              <tr><td colspan="2" style="color:var(--accent);font-weight:700;padding:12px 12px 4px;font-size:11px;text-transform:uppercase;">GİDERLER</td></tr>
              <tr>
                <td>Hoca Maaşları</td>
                <td class="text-right text-bad">-${formatMoney(expenseDetail.salariesAcademic || 0)}</td>
              </tr>
              <tr>
                <td>Yerleşke Bakım</td>
                <td class="text-right text-bad">-${formatMoney(expenseDetail.maintenance || 0)}</td>
              </tr>
              <tr>
                <td>İdari Harcamalar</td>
                <td class="text-right text-bad">-${formatMoney((expenseDetail.salariesAdmin || 0) + (expenseDetail.partTime || 0))}</td>
              </tr>
              <tr>
                <td>Araştırma Yatırımı</td>
                <td class="text-right text-bad" id="budget-research-cost">-${formatMoney(expenseDetail.researchInvestment || 0)}</td>
              </tr>
              <tr>
                <td>Burs Ödemeleri</td>
                <td class="text-right text-bad" id="budget-scholarship-cost">-${formatMoney(expenseDetail.scholarships || 0)}</td>
              </tr>
              <tr>
                <td>Genel Giderler</td>
                <td class="text-right text-bad">-${formatMoney((expenseDetail.overhead || 0) + (expenseDetail.construction || 0))}</td>
              </tr>
              <tr style="border-top:2px solid var(--border-light);">
                <td style="font-weight:700;">Toplam Gider</td>
                <td class="text-right font-bold text-bad">-${formatMoney(costs)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div class="section-title">Bütçe Dağılımı</div>
        <div class="card">
          <div class="pie-chart-wrapper" style="margin-bottom:16px;">
            ${createPieChart(allocDefs.map(a => ({
              label: a.label, value: alloc[a.key] ?? 0, color: a.color
            })), 100)}
          </div>

          <div style="display:flex;flex-direction:column;gap:10px;">
            ${allocDefs.map(a => `
              <div class="slider-row">
                <div class="slider-label" style="font-size:12px;">${a.label}</div>
                <input type="range" class="budget-slider alloc-slider"
                       data-alloc-key="${a.key}"
                       min="0" max="60" step="5"
                       value="${Math.round((alloc[a.key] ?? 0) * 100)}">
                <div class="slider-value alloc-value" id="alloc-val-${a.key}">
                  %${Math.round((alloc[a.key] ?? 0) * 100)}
                </div>
              </div>
            `).join('')}

            <div style="font-size:11px;color:var(--text-muted);text-align:right;" id="alloc-total-label">
              Toplam: %${Math.round(Object.values(alloc).reduce((s, v) => s + v, 0) * 100)}
            </div>

            <button class="btn btn-success" id="btn-apply-alloc" style="width:100%;justify-content:center;">
              Dağılımı Uygula
            </button>
          </div>
        </div>

        ${(uni.type === 'vakif' || uni.type === 'us_private') ? `
          <div class="section-title mt-md">${uni.type === 'us_private' ? 'Harç & Financial Aid' : 'Harç Ayarı'}</div>
          <div class="card">
            <div class="offer-row">
              <div class="offer-label">Dönemlik Harç</div>
              <div class="slider-row" style="grid-template-columns:1fr 90px;margin-top:8px;">
                <input type="range" class="budget-slider" id="tuition-slider"
                       min="${uni.type === 'us_private' ? 500000 : 10000}"
                       max="${uni.type === 'us_private' ? 2000000 : 150000}"
                       step="${uni.type === 'us_private' ? 50000 : 5000}"
                       value="${uni.tuitionPerSemester ?? (uni.type === 'us_private' ? 935000 : 40000)}">
                <div class="slider-value" id="tuition-value">
                  ${formatMoney(uni.tuitionPerSemester ?? (uni.type === 'us_private' ? 935000 : 40000))}
                </div>
              </div>
            </div>
            ${uni.type === 'us_private' ? `
            <div class="offer-row" style="margin-top:12px;">
              <div class="offer-label">Financial Aid Oranı (ortalama indirim)</div>
              <div class="slider-row" style="grid-template-columns:1fr 90px;margin-top:8px;">
                <input type="range" class="budget-slider" id="aid-slider"
                       min="0" max="80" step="5"
                       value="${Math.round((uni.financialAidRate ?? 0.45) * 100)}">
                <div class="slider-value" id="aid-value">
                  %${Math.round((uni.financialAidRate ?? 0.45) * 100)}
                </div>
              </div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">
                Yüksek aid → daha geniş öğrenci havuzu, daha düşük net harç geliri.
              </div>
            </div>
            ` : ''}
          </div>
        ` : ''}
        ${uni.type === 'devlet' ? `
          <div class="section-title mt-md">Devlet Üniversitesi Bilgisi</div>
          <div class="card" style="font-size:12px;color:var(--text-muted);line-height:1.7;">
            <div>• Harç: <strong style="color:var(--text-primary);">Ücretsiz</strong> (sembolik katkı payı YÖK belirler)</div>
            <div>• Ana gelir: <strong style="color:var(--accent-green);">YÖK bütçe tahsisi</strong></div>
            <div>• Kadro: Yeni pozisyon için hükümet onayı gerekir (2 dönem)</div>
            <div>• Yıl sonu bütçe fazlası Hazine'ye döner</div>
          </div>
        ` : ''}
      </div>

    </div>

    <!-- ─────────────────────────── BANKA KREDİLERİ ─────────────────────────── -->
    <div style="margin-top:24px;">
      <div class="section-title">🏦 BANKA KREDİLERİ</div>

      ${(() => {
        const loans    = uni.loans || [];
        const totalDebt = uni.totalDebt || 0;

        const loansHtml = loans.length === 0
          ? `<div class="card" style="font-size:12px;color:var(--text-muted);text-align:center;padding:16px;">
               Aktif kredi bulunmuyor.
             </div>`
          : `<div class="card" style="padding:0;">
               <table class="data-table">
                 <thead>
                   <tr>
                     <th>Banka</th>
                     <th class="text-right">Kalan Borç</th>
                     <th class="text-right">Dönem Taksiti</th>
                     <th class="text-right">Kalan Dönem</th>
                     <th class="text-right">Durum</th>
                     <th class="text-right">İşlem</th>
                   </tr>
                 </thead>
                 <tbody>
                   ${loans.map((loan, idx) => {
                     const statusBadge = loan.overdue
                       ? `<span style="color:#e94560;font-weight:700;">⚠️ Gecikti (${loan.overdueCount}/3)</span>`
                       : `<span style="color:var(--accent-green);">Aktif</span>`;
                     const canRepay = budget >= loan.remainingAmount;
                     return `<tr>
                       <td>${loan.bankIcon || '🏦'} ${loan.bankName}</td>
                       <td class="text-right">${formatMoneyFull(loan.remainingAmount)}</td>
                       <td class="text-right text-bad">-${formatMoneyFull(loan.semesterPayment)}</td>
                       <td class="text-right">${loan.remainingTerms} dönem</td>
                       <td class="text-right">${statusBadge}</td>
                       <td class="text-right">
                         <button class="btn btn-sm ${canRepay ? 'btn-warning' : ''}"
                                 data-loan-idx="${idx}"
                                 id="btn-repay-loan-${idx}"
                                 ${canRepay ? '' : 'disabled title="Yeterli bütçe yok"'}>
                           Erken Öde
                         </button>
                       </td>
                     </tr>`;
                   }).join('')}
                 </tbody>
               </table>
             </div>
             <div style="text-align:right;margin-top:8px;font-size:12px;color:var(--text-muted);">
               Toplam borç: <strong style="color:#e94560;">${formatMoneyFull(totalDebt)}</strong>
             </div>`;

        return loansHtml;
      })()}

      <!-- Yeni kredi çek bölümü -->
      <div style="margin-top:16px;">
        <button class="btn btn-primary" id="btn-show-loan-form" style="margin-bottom:12px;">
          + Yeni Kredi Çek
        </button>
        <div id="loan-form-section" style="display:none;">
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">
            ${BANKS.map(bank => {
              const researchScore = 0; // placeholder; real check at dispatch time
              const isDisabled = false; // visual only; validation is server-side
              return `<div class="card bank-card" data-bank-id="${bank.id}"
                           style="cursor:pointer;border:2px solid transparent;transition:border-color 0.2s;${isDisabled ? 'opacity:0.5;' : ''}">
                <div style="font-size:24px;text-align:center;margin-bottom:8px;">${bank.icon}</div>
                <div style="font-weight:700;font-size:14px;text-align:center;margin-bottom:4px;">${bank.name}</div>
                <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">${bank.description}</div>
                <div style="font-size:12px;">
                  <div>Faiz: <strong>%${(bank.interestRate * 100).toFixed(0)}/yıl</strong></div>
                  <div>Limit: <strong>${formatMoney(bank.maxLoan)}</strong></div>
                  <div>Vadeler: <strong>${bank.terms.join(', ')} dönem</strong></div>
                  ${bank.minResearchScore ? `<div style="color:var(--accent);">⚠️ Araştırma puanı ≥ ${bank.minResearchScore} gerekli</div>` : ''}
                </div>
              </div>`;
            }).join('')}
          </div>

          <div id="loan-config-section" style="display:none;" class="card">
            <div style="font-weight:700;margin-bottom:12px;" id="loan-selected-bank-name">Seçilen banka:</div>
            <div class="slider-row" style="grid-template-columns:auto 1fr 120px;align-items:center;gap:12px;margin-bottom:12px;">
              <label style="font-size:13px;white-space:nowrap;">Kredi Miktarı:</label>
              <input type="range" id="loan-amount-slider" min="1000000" max="60000000" step="1000000" value="5000000">
              <div class="slider-value" id="loan-amount-display">₺5.000.000</div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
              <label style="font-size:13px;white-space:nowrap;">Vade (dönem):</label>
              <select id="loan-term-select" class="btn" style="padding:6px 12px;">
                <option value="">Seçin…</option>
              </select>
            </div>
            <div style="font-size:13px;margin-bottom:16px;" id="loan-payment-preview">
              Dönem taksiti hesaplanıyor…
            </div>
            <button class="btn btn-success" id="btn-confirm-loan">Krediyi Onayla</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Dağılım slider'ları
  qsa('.alloc-slider').forEach(s => {
    on(s, 'input', () => {
      const valEl = el(`alloc-val-${s.dataset.allocKey}`);
      if (valEl) valEl.textContent = `%${s.value}`;

      // Toplam güncelle
      const total = qsa('.alloc-slider').reduce((sum, sl) => sum + parseInt(sl.value), 0);
      const totalLabel = el('alloc-total-label');
      if (totalLabel) {
        totalLabel.textContent = `Toplam: %${total}`;
        totalLabel.style.color = total === 100 ? 'var(--accent-green)' : 'var(--accent)';
      }
    });
  });

  on(el('btn-apply-alloc'), 'click', () => {
    const newAlloc = {};
    qsa('.alloc-slider').forEach(s => {
      newAlloc[s.dataset.allocKey] = parseInt(s.value) / 100;
    });
    const total = Object.values(newAlloc).reduce((s, v) => s + v, 0);
    if (Math.abs(total - 1.0) > 0.05) {
      showNotification(`Toplam %${Math.round(total * 100)} — %100 olmalı!`, 'warning');
      return;
    }
    if (onAllocChange) onAllocChange(newAlloc);
    showNotification('Bütçe dağılımı güncellendi.', 'success');
  });

  // Harç slider
  const tuitionSlider = el('tuition-slider');
  const tuitionVal    = el('tuition-value');
  if (tuitionSlider && tuitionVal) {
    on(tuitionSlider, 'input', () => {
      tuitionVal.textContent = formatMoney(parseInt(tuitionSlider.value));
    });
  }

  // Financial aid slider (us_private)
  const aidSlider = el('aid-slider');
  const aidVal    = el('aid-value');
  if (aidSlider && aidVal) {
    on(aidSlider, 'input', () => {
      aidVal.textContent = `%${aidSlider.value}`;
    });
  }

  // ── Erken Ödeme butonları ─────────────────────────────────────────────────
  const loans = (state.university || {}).loans || [];
  loans.forEach((loan, idx) => {
    const btn = el(`btn-repay-loan-${idx}`);
    on(btn, 'click', () => {
      if (!onLoanAction) return;
      const result = onLoanAction({ type: 'repay_loan_early', loanIndex: idx });
      if (result && result.success) {
        showNotification(result.message, 'success');
        // Paneli yenile (main.js'teki renderBudget çağrısı aracılığıyla)
        if (window._onBudgetTabRefresh) window._onBudgetTabRefresh();
      } else {
        showNotification(result ? result.message : 'İşlem başarısız.', 'error');
      }
    });
  });

  // ── Yeni Kredi Formu ──────────────────────────────────────────────────────
  let _selectedBankId   = null;
  let _selectedBankData = null;

  const btnShowLoanForm = el('btn-show-loan-form');
  const loanFormSection = el('loan-form-section');
  on(btnShowLoanForm, 'click', () => {
    if (!loanFormSection) return;
    const isVisible = loanFormSection.style.display !== 'none';
    loanFormSection.style.display = isVisible ? 'none' : 'block';
    btnShowLoanForm.textContent = isVisible ? '+ Yeni Kredi Çek' : '− Formu Kapat';
  });

  // Banka kartı seçimi
  qsa('.bank-card').forEach(card => {
    on(card, 'click', () => {
      const bankId = card.dataset.bankId;
      const bank   = BANKS.find(b => b.id === bankId);
      if (!bank) return;

      _selectedBankId   = bankId;
      _selectedBankData = bank;

      // Aktif görünüm
      qsa('.bank-card').forEach(c => c.style.borderColor = 'transparent');
      card.style.borderColor = 'var(--accent-green)';

      // Konfigürasyon bölümünü göster
      const configSection = el('loan-config-section');
      if (configSection) configSection.style.display = 'block';

      // Banka adını güncelle
      const bankNameEl = el('loan-selected-bank-name');
      if (bankNameEl) bankNameEl.textContent = `Seçilen banka: ${bank.icon} ${bank.name}`;

      // Slider max değerini güncelle
      const amtSlider = el('loan-amount-slider');
      if (amtSlider) {
        amtSlider.max   = bank.maxLoan;
        amtSlider.value = Math.min(parseInt(amtSlider.value), bank.maxLoan);
        const amtDisplay = el('loan-amount-display');
        if (amtDisplay) amtDisplay.textContent = `₺${parseInt(amtSlider.value).toLocaleString('tr-TR')}`;
      }

      // Vade seçeneklerini güncelle
      const termSelect = el('loan-term-select');
      if (termSelect) {
        termSelect.innerHTML = '<option value="">Seçin…</option>';
        bank.terms.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t;
          opt.textContent = `${t} dönem`;
          termSelect.appendChild(opt);
        });
      }

      _updateLoanPreview();
    });
  });

  // Taksit önizleme güncelle
  function _updateLoanPreview() {
    if (!_selectedBankData) return;
    const amtSlider   = el('loan-amount-slider');
    const termSelect  = el('loan-term-select');
    const previewEl   = el('loan-payment-preview');
    if (!amtSlider || !termSelect || !previewEl) return;

    const amount = parseInt(amtSlider.value) || 0;
    const term   = parseInt(termSelect.value) || 0;

    if (!term) {
      previewEl.textContent = 'Vade seçin…';
      return;
    }

    const payment = calculateLoanPayment(amount, _selectedBankData.interestRate, term);
    previewEl.innerHTML =
      `Dönem taksiti: <strong style="color:var(--accent);">₺${payment.toLocaleString('tr-TR')}</strong> × ${term} dönem &nbsp;|&nbsp; ` +
      `Toplam geri ödeme: <strong>₺${(payment * term).toLocaleString('tr-TR')}</strong>`;
  }

  const amtSlider = el('loan-amount-slider');
  const amtDisplay = el('loan-amount-display');
  on(amtSlider, 'input', () => {
    if (amtDisplay) amtDisplay.textContent = `₺${parseInt(amtSlider.value).toLocaleString('tr-TR')}`;
    _updateLoanPreview();
  });

  on(el('loan-term-select'), 'change', _updateLoanPreview);

  // Krediyi Onayla
  on(el('btn-confirm-loan'), 'click', () => {
    if (!_selectedBankId || !_selectedBankData) {
      showNotification('Lütfen önce bir banka seçin.', 'warning');
      return;
    }
    const amtSldr  = el('loan-amount-slider');
    const termSel  = el('loan-term-select');
    const amount        = parseInt(amtSldr?.value) || 0;
    const termSemesters = parseInt(termSel?.value)  || 0;

    if (!amount || !termSemesters) {
      showNotification('Kredi miktarı ve vadeyi seçin.', 'warning');
      return;
    }

    if (!onLoanAction) {
      showNotification('Oyun motoru hazır değil.', 'error');
      return;
    }

    const result = onLoanAction({
      type: 'take_loan',
      bankId: _selectedBankId,
      amount,
      termSemesters,
    });

    if (result && result.success) {
      showNotification(result.message, 'success');
      if (window._onBudgetTabRefresh) window._onBudgetTabRefresh();
    } else {
      showNotification(result ? result.message : 'Kredi alınamadı.', 'error');
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. SIRALAMA PANELİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sıralama sekmesi: rakip detayları dahil kapsamlı karşılaştırma tablosu.
 * @param {object} state — Oyun durumu
 */
export function renderRankingPanel(state) {
  const panel = el('tab-ranking');
  if (!panel) return;

  const uni    = state.university || {};
  const rivals = state.rivals || [];
  const scores = uni.scores || {};

  // Oyuncunun üniversitesi için avgYKS hesapla
  const byDeptAll  = state.students?.byDepartment || {};
  let totalYKSSum  = 0;
  let totalYKSCnt  = 0;
  for (const d of Object.values(byDeptAll)) {
    const yks = d?.year1?.avgYKS || 0;
    const cnt = d?.year1?.count  || 0;
    if (yks > 0 && cnt > 0) { totalYKSSum += yks * cnt; totalYKSCnt += cnt; }
  }
  const playerAvgYKS = totalYKSCnt > 0 ? Math.round(totalYKSSum / totalYKSCnt) : 0;

  // Oyuncunun dönemlik yayın sayısı
  const playerPubs = state.research?.publications || 0;

  // Tüm üniversiteleri tek listede topla (prestige sıralaması)
  const allUnis = [
    {
      name:         uni.name,
      ranking:      uni.ranking || 50,
      prestige:     Math.round(uni.prestige || 0),
      scores,
      studentCount: state.students?.totalEnrolled || 0,
      facultyCount: state.faculty?.length || 0,
      avgYKS:       playerAvgYKS,
      publications: playerPubs,
      isPlayer:     true,
    },
    ...rivals.map(r => ({
      name:         r.name,
      ranking:      r.ranking || 50,
      prestige:     Math.round(r.prestige || 0),
      scores:       r.scores || {},
      studentCount: r.studentCount || 1000,
      facultyCount: r.facultyCount || 30,
      avgYKS:       r.avgYKS || 0,
      publications: r.publicationsPerSemester || 0,
      isPlayer:     false,
    })),
  ].sort((a, b) => a.ranking - b.ranking);

  const scoreDefs = [
    { key: 'education',            label: 'Eğitim' },
    { key: 'research',             label: 'Araştırma' },
    { key: 'alumni',               label: 'Mezun' },
    { key: 'satisfaction',         label: 'Memnuniyet' },
    { key: 'internationalization', label: 'Uluslararası' },
  ];

  // Güçlü / zayıf yön analizi
  const scoreEntries = scoreDefs.map(s => ({
    label: s.label,
    val:   Math.round(scores[s.key] ?? 0),
  }));
  const sorted     = [...scoreEntries].sort((a, b) => b.val - a.val);
  const strongest  = sorted[0];
  const weakest    = sorted[sorted.length - 1];

  // Öğrenci/hoca oranı
  const ratio = (state.faculty?.length || 0) > 0
    ? ((state.students?.totalEnrolled || 0) / state.faculty.length).toFixed(1)
    : '—';

  const playerPos  = allUnis.findIndex(u => u.isPlayer);
  const posOrdinal = (n) => `${n}.`;

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-title">Sıralamalar</div>
        <div class="panel-subtitle">
          Konumunuz: <strong class="text-good">${posOrdinal(playerPos + 1)}</strong>
          &nbsp;/&nbsp;${allUnis.length} üniversite
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px;">
      ${scoreDefs.map(s => _statCardHtml(s.label, Math.round(scores[s.key] ?? 0), null, 'puan')).join('')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
      <div class="card" style="padding:14px;border-left:3px solid var(--accent-green);">
        <div style="font-size:11px;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px;">Güçlü Yan</div>
        <div style="font-size:14px;font-weight:700;color:var(--accent-green);">
          ${strongest?.label || '—'}: ${strongest?.val || 0} puan
        </div>
      </div>
      <div class="card" style="padding:14px;border-left:3px solid var(--accent-red,#e53e3e);">
        <div style="font-size:11px;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px;">Zayıf Yan</div>
        <div style="font-size:14px;font-weight:700;color:var(--accent-red,#e53e3e);">
          ${weakest?.label || '—'}: ${weakest?.val || 0} puan
        </div>
      </div>
    </div>

    <div class="section-title">Sıralama Tablosu</div>
    <div class="card" style="padding:0;overflow:hidden;overflow-x:auto;">
      <table class="data-table" style="min-width:900px;">
        <thead>
          <tr>
            <th style="width:40px;">#</th>
            <th>Üniversite</th>
            <th class="text-right">Puan</th>
            <th class="text-right">Saygınlık</th>
            <th class="text-right">Ort.YKS ↓</th>
            <th class="text-right">Öğrenci</th>
            <th class="text-right">Hoca</th>
            <th class="text-right">Yayın/Dönem</th>
          </tr>
        </thead>
        <tbody>
          ${allUnis.map((u, i) => {
            const rankColor = i === 0
              ? 'var(--accent-yellow)'
              : i <= 2
                ? 'var(--accent-green)'
                : 'var(--text-muted)';
            const avgScore = Object.keys(u.scores).length > 0
              ? Math.round(Object.values(u.scores).reduce((a, b) => a + (b || 0), 0) / Object.keys(u.scores).length)
              : u.prestige;
            const yksDisplay = u.avgYKS > 0 ? formatNumber(u.avgYKS) : '—';
            return `
              <tr class="${u.isPlayer ? 'highlight-row' : ''}">
                <td style="font-weight:800;color:${rankColor};">${i + 1}</td>
                <td>
                  ${u.isPlayer
                    ? `<strong>★ ${u.name}</strong> <span class="badge badge-success">Sen</span>`
                    : u.name}
                </td>
                <td class="text-right font-bold">${u.isPlayer ? Math.round(Object.values(scores).reduce((a,b)=>a+(b||0),0)/Object.keys(scores).length||0) : avgScore}</td>
                <td class="text-right">${u.prestige}</td>
                <td class="text-right" style="color:var(--text-muted);font-size:12px;">${yksDisplay}</td>
                <td class="text-right">${formatNumber(u.studentCount)}</td>
                <td class="text-right">${u.facultyCount}</td>
                <td class="text-right">${u.publications}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>

    <div class="card" style="margin-top:16px;padding:14px;font-size:13px;">
      <div style="font-weight:700;margin-bottom:8px;">Sizin konumunuz (${posOrdinal(playerPos + 1)} / ${allUnis.length})</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;color:var(--text-muted);">
        <div>Öğrenci/Hoca Oranı: <strong>${ratio}</strong></div>
        <div>Ort. YKS: <strong>${playerAvgYKS > 0 ? formatNumber(playerAvgYKS) : '—'}</strong></div>
        <div>Toplam Yayın: <strong>${playerPubs}</strong></div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. ARAŞTIRMA PANELİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Araştırma sekmesi: hoca başvuruları, BAP, aktif projeler, istatistikler, bütçe ayarı.
 * @param {object}   state            — Oyun durumu
 * @param {Function} onResearchBudget — Araştırma bütçesi değişim callback
 * @param {Function} onProjectDecision — Proje kararı callback (decisionType, applicationId)
 */
export function renderResearchPanel(state, onResearchBudget, onProjectDecision) {
  const panel = el('tab-research');
  if (!panel) return;

  const research       = state.research || {};
  const activeProjects = research.activeResearchProjects || [];
  const pendingApps    = [];   // Dış projeler artık otomatik işlenir; bu liste her zaman boş
  const lastApps       = research.lastApplicationResults || null;
  const bapApps        = research.bapApplications || [];
  const activeBap      = research.activeBapCall || null;
  const completedProjs = research.completedProjects || [];
  const totalProjectBudget = activeProjects.reduce((s, p) => s + (p.requestedFunding || p.funding || 0), 0);
  const uniOverheadRate  = state.universitySettings?.overheadRate ?? 0.15;
  // Dönem overhead geliri tahmini
  const estimatedOverheadIncome = activeProjects.reduce((s, p) => {
    if (p.status !== 'active') return s;
    const semFund = (p.requestedFunding || p.funding || 0) / Math.max(1, p.duration || 4);
    const rate = p.callOverheadRate ?? uniOverheadRate;
    return s + semFund * rate;
  }, 0);
  const uniShareTotal = activeProjects.reduce((s, p) => {
    const semFund = (p.requestedFunding || p.funding || 0) / Math.max(1, p.duration || 4);
    const rate = p.callOverheadRate ?? uniOverheadRate;
    return s + semFund * rate;
  }, 0);

  // TTO verileri
  const tto = state.tto || {};

  const _probColor = (p) => p >= 0.5 ? 'var(--accent-green)' : p >= 0.25 ? 'var(--accent-yellow,#f5a623)' : 'var(--accent-red,#e53e3e)';

  // TTO alt panel HTML üretici
  function _renderTTOPanel() {
    if (!tto.established) {
      return `
        <div class="card" style="padding:20px;margin-bottom:16px;border-left:3px solid var(--accent-blue,#3182ce);">
          <div style="font-size:15px;font-weight:700;margin-bottom:8px;">🏢 Teknoloji Transfer Ofisi</div>
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">
            Patent lisanslama, spin-off şirketler ve sektör anlaşmalarıyla üniversitenizin araştırma çıktısını gelire dönüştürün.
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;font-size:12px;">
            <div class="card" style="padding:10px;text-align:center;">
              <div style="font-size:18px;margin-bottom:4px;">📜</div>
              <div style="font-weight:700;">Patent Lisans</div>
              <div style="color:var(--text-muted);font-size:11px;">Patent başına 400K ₺/dönem</div>
            </div>
            <div class="card" style="padding:10px;text-align:center;">
              <div style="font-size:18px;margin-bottom:4px;">🚀</div>
              <div style="font-weight:700;">Spin-off Şirket</div>
              <div style="color:var(--text-muted);font-size:11px;">500K–1M ₺ yıllık gelir</div>
            </div>
            <div class="card" style="padding:10px;text-align:center;">
              <div style="font-size:18px;margin-bottom:4px;">🤝</div>
              <div style="font-weight:700;">Sektör Anlaşması</div>
              <div style="color:var(--text-muted);font-size:11px;">1M–20M ₺ toplam değer</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:16px;">
            <button class="btn btn-primary" onclick="window._onEstablishTTO && window._onEstablishTTO()" style="padding:10px 20px;font-size:13px;">
              🏢 TTO Kur (5M ₺)
            </button>
            <div style="font-size:12px;color:var(--text-muted);">
              Mevcut kasa: <strong style="color:${(state.university?.budget || 0) >= 5_000_000 ? 'var(--accent-green)' : 'var(--accent-red,#e53e3e)'};">${formatMoney(state.university?.budget || 0)}</strong>
            </div>
          </div>
        </div>
      `;
    }

    // TTO kurulu ise detay paneli
    const ttoLevel = tto.level || 1;
    const upgradeCosts = [0, 3_000_000, 6_000_000, 10_000_000];
    const levelNames = { 1: 'Temel', 2: 'Gelişmiş', 3: 'Uluslararası' };
    const levelMaxDeals = { 1: 2, 2: 4, 3: 6 };
    const lastRev = tto.lastTurnRevenue || { patents: 0, spinoffs: 0, deals: 0, total: 0 };
    const spinoffs = tto.spinoffs || [];
    const activeDeals = tto.industryDeals || [];
    const pendingDeals = tto.pendingDeals || [];

    const upgradeBtn = ttoLevel < 3
      ? `<button class="btn btn-success btn-sm" onclick="window._onUpgradeTTO && window._onUpgradeTTO()" style="margin-left:10px;">
           ⬆️ Seviye ${ttoLevel + 1}'e Yükselt (${formatMoney(upgradeCosts[ttoLevel])})
         </button>`
      : `<span class="badge badge-green" style="margin-left:10px;">Maksimum Seviye</span>`;

    return `
      <!-- TTO Başlık / Durum -->
      <div class="card" style="padding:14px;margin-bottom:12px;border-left:3px solid var(--accent-blue,#3182ce);">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div>
            <span style="font-size:14px;font-weight:700;">🏢 Teknoloji Transfer Ofisi</span>
            <span class="badge badge-blue" style="margin-left:8px;">Seviye ${ttoLevel} — ${levelNames[ttoLevel] || ''}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:12px;color:var(--text-muted);">Maks. anlaşma: ${levelMaxDeals[ttoLevel]}</span>
            ${upgradeBtn}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px;">
          ${_statCardHtml('Dönem Geliri', formatMoney(lastRev.total), null, 'TTO toplamı')}
          ${_statCardHtml('Patent Lisans', formatMoney(lastRev.patents), null, 'bu dönem')}
          ${_statCardHtml('Spin-off', formatMoney(lastRev.spinoffs), null, 'bu dönem')}
          ${_statCardHtml('Toplam Gelir', formatMoney(tto.totalRevenueGenerated || 0), null, 'tüm zamanlar')}
        </div>
      </div>

      <!-- Bekleyen Teklifler -->
      ${pendingDeals.length > 0 ? `
        <div class="section-title" style="margin-bottom:8px;">📨 Bekleyen Sektör Teklifleri (${pendingDeals.length})</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
          ${pendingDeals.map(deal => `
            <div class="card" style="padding:12px 14px;border-left:3px solid var(--accent-yellow,#f5a623);">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">
                <div>
                  <div style="font-size:13px;font-weight:700;">${deal.icon || '🤝'} ${deal.company}</div>
                  <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${deal.typeName} · ${deal.duration} dönem · Toplam: ${formatMoney(deal.totalValue)} · Dönem başına: ${formatMoney(deal.perTurnRevenue)}</div>
                </div>
                <div style="display:flex;gap:6px;flex-shrink:0;">
                  <button class="btn btn-success btn-sm" onclick="window._onAcceptDeal && window._onAcceptDeal(${deal.id})" style="font-size:11px;">✅ Kabul</button>
                  <button class="btn btn-danger btn-sm" onclick="window._onRejectDeal && window._onRejectDeal(${deal.id})" style="font-size:11px;background:var(--accent-red,#e53e3e);border-color:var(--accent-red,#e53e3e);">❌ Reddet</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- Aktif Anlaşmalar -->
      <div class="section-title" style="margin-bottom:8px;">📋 Aktif Anlaşmalar (${activeDeals.length}/${levelMaxDeals[ttoLevel]})</div>
      ${activeDeals.length > 0 ? `
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px;">
          ${activeDeals.map(deal => `
            <div class="card" style="padding:10px 14px;border-left:3px solid var(--accent-green,#48bb78);">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
                <div>
                  <span style="font-size:13px;font-weight:700;">${deal.icon || '🤝'} ${deal.company}</span>
                  <span style="font-size:11px;color:var(--text-muted);margin-left:8px;">${deal.typeName}</span>
                </div>
                <div style="font-size:12px;color:var(--text-muted);">
                  ${formatMoney(deal.perTurnRevenue)}/dönem · <strong style="color:var(--accent-green,#48bb78);">${deal.turnsRemaining} dönem kaldı</strong>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div style="font-size:12px;color:var(--text-faint);padding:8px 0;margin-bottom:16px;">Aktif anlaşma yok. Dönem sonunda sektör teklifleri gelebilir.</div>
      `}

      <!-- Spin-off Şirketler -->
      <div class="section-title" style="margin-bottom:8px;">🚀 Spin-off Şirketler (${spinoffs.length})</div>
      ${spinoffs.length > 0 ? `
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px;">
          ${spinoffs.map(sof => `
            <div class="card" style="padding:10px 14px;border-left:3px solid var(--accent-purple,#9b59b6);">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <span style="font-size:13px;font-weight:700;">🏭 ${sof.name}</span>
                  <span style="font-size:11px;color:var(--text-muted);margin-left:8px;">Tur ${sof.foundedAt || '?'}'de kuruldu</span>
                </div>
                <div style="font-size:12px;">Yıllık: <strong style="color:var(--accent-green,#48bb78);">${formatMoney(sof.annualRevenue)}</strong></div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div style="font-size:12px;color:var(--text-faint);padding:8px 0;margin-bottom:16px;">Henüz spin-off şirket yok. Patentleriniz arttıkça spin-off kurulabilir.</div>
      `}

      <!-- Özet İstatistikler -->
      <div class="card" style="padding:12px 14px;font-size:12px;color:var(--text-muted);">
        <div style="font-size:12px;font-weight:700;margin-bottom:8px;">📊 TTO Özet</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
          <div>Toplam patent: <strong>${research.patents || 0}</strong></div>
          <div>Spin-off şirket: <strong>${spinoffs.length}</strong></div>
          <div>Aktif anlaşma: <strong>${activeDeals.length}</strong></div>
          <div>Bekleyen teklif: <strong>${pendingDeals.length}</strong></div>
          <div>TTO seviyesi: <strong>${ttoLevel}/3</strong></div>
          <div>Op. gider/dönem: <strong style="color:var(--accent-red,#e53e3e);">-${formatMoney(800_000)}</strong></div>
        </div>
      </div>
    `;
  }

  // Başvuru kartı HTML üret
  const _appCard = (app, type) => {
    const isBap = type === 'bap';
    const approveType = isBap ? 'approve_bap_application' : 'approve_project_application';
    const rejectType  = isBap ? 'reject_bap_application'  : 'reject_project_application';
    const researchScore = (state.faculty || []).find(f => f.id === app.facultyId)?.stats?.research ?? '?';
    return `
      <div class="card" style="padding:14px;border-left:3px solid var(--accent-purple,#9b59b6);margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:2px;">
              👤 ${app.facultyName}
              <span style="font-size:11px;font-weight:400;color:var(--text-faint);"> · ${app.facultyDept || ''}</span>
              <span style="font-size:11px;font-weight:600;color:var(--accent-blue,#3182ce);margin-left:4px;">[${researchScore}]</span>
            </div>
            <div style="font-size:13px;font-weight:700;margin-bottom:4px;">${app.projectName}</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;font-size:11px;color:var(--text-muted);">
              <span>${app.callIcon || '📋'} ${app.callType || 'BAP'}</span>
              <span>💰 ${formatMoney(app.requestedFunding)} talep</span>
              <span>⏱ ${app.duration} dönem</span>
              <span>📄 ~${app.estimatedPublications} yayın</span>
              ${!isBap && app.successProbability !== undefined ? `<span style="color:${_probColor(app.successProbability)};">🎯 %${Math.round(app.successProbability * 100)} başarı</span>` : ''}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn btn-success btn-sm proj-decision-btn"
            data-app-id="${app.id}" data-decision="${approveType}"
            style="font-size:12px;">✅ Onayla</button>
          <button class="btn btn-danger btn-sm proj-decision-btn"
            data-app-id="${app.id}" data-decision="${rejectType}"
            style="font-size:12px;background:var(--accent-red,#e53e3e);border-color:var(--accent-red,#e53e3e);">❌ Reddet</button>
        </div>
      </div>
    `;
  };

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-title">Araştırma Yönetimi</div>
        <div class="panel-subtitle">${activeProjects.length} aktif proje · Üniversite payı: ${formatMoney(estimatedOverheadIncome)}/dönem · ${lastApps ? `${(lastApps.accepted || []).length} kabul, ${(lastApps.rejected || []).length} red (son dönem)` : 'henüz başvuru yok'}</div>
      </div>
    </div>

    <!-- Araştırma Alt Sekmeleri -->
    <div class="research-subtabs" style="display:flex;gap:8px;margin-bottom:16px;border-bottom:2px solid var(--border-light);padding-bottom:0;">
      <button class="research-subtab active" data-subtab="projects"
        style="padding:8px 16px;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2px solid var(--accent-blue,#3182ce);margin-bottom:-2px;color:var(--accent-blue,#3182ce);">
        📋 Projeler
      </button>
      <button class="research-subtab" data-subtab="tto"
        style="padding:8px 16px;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;color:var(--text-muted);">
        🏢 Teknoloji Transfer${tto.established && (tto.pendingDeals || []).length > 0 ? ` <span style="background:var(--accent-red,#e53e3e);color:#fff;border-radius:9px;padding:1px 6px;font-size:11px;margin-left:4px;">${(tto.pendingDeals || []).length}</span>` : ''}
      </button>
    </div>

    <!-- Alt Sekme: Projeler -->
    <div id="research-subtab-projects">

    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px;">
      ${_statCardHtml('Toplam Yayın',       formatNumber(research.publications ?? 0), null, 'makale')}
      ${_statCardHtml('H-Index',            research.hIndex ?? 0, null, 'etki faktörü')}
      ${_statCardHtml('Aktif Proje',         activeProjects.length, null, 'devam ediyor')}
      ${_statCardHtml('Tamamlanan',          completedProjs.filter(p => p.status === 'completed').length, null, 'başarılı')}
      ${_statCardHtml('Üniversite Payı/Dönem', formatMoney(uniShareTotal), null, 'genel gider')}
    </div>

    <!-- PROJE GELİR YÖNETİMİ -->
    <div class="card" style="padding:14px;margin-bottom:16px;border-left:3px solid var(--accent-green,#48bb78);">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px;">💼 Proje Gelir Yönetimi</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start;">
        <div>
          <div class="offer-row">
            <div class="offer-label">Genel Gider Kesinti Oranı</div>
            <div class="slider-row" style="grid-template-columns:1fr 70px;margin-top:4px;">
              <input type="range" id="overhead-rate-slider" min="5" max="40" step="1"
                     value="${Math.round(uniOverheadRate * 100)}">
              <div class="slider-value" id="overhead-rate-value">%${Math.round(uniOverheadRate * 100)}</div>
            </div>
          </div>
          <div id="overhead-rate-note" style="font-size:11px;color:var(--text-muted);margin-top:4px;">
            ${uniOverheadRate > 0.30 ? '⚠️ Hocalar proje başvurusundan büyük ölçüde kaçınıyor!' : uniOverheadRate > 0.25 ? '⚠️ Hocalar başvuruyu azaltabilir.' : uniOverheadRate > 0.20 ? 'ℹ️ Hocalar biraz isteksiz olabilir.' : '✅ Hocalar normal düzeyde başvuruyor.'}
          </div>
          <button class="btn btn-success btn-sm" id="btn-apply-overhead-rate" style="margin-top:8px;">Güncelle</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;font-size:12px;">
          <div><strong>Bu dönem proje genel gider geliri:</strong> <span style="color:var(--accent-green,#48bb78);">${formatMoney(estimatedOverheadIncome)}</span></div>
          <div><strong>Aktif proje toplam bütçesi:</strong> ${formatMoney(totalProjectBudget)}</div>
          <div><strong>Patent sayısı:</strong> ${research.patents ?? 0}</div>
          ${(research.patentRoyalties ?? 0) > 0 ? `<div><strong>Patent telif (dönem):</strong> <span style="color:var(--accent-green,#48bb78);">${formatMoney(Math.round((research.patentRoyalties ?? 0) / 2))}</span></div>` : ''}
          <div style="margin-top:4px;font-size:11px;color:var(--text-muted);">Oran &gt;%20 → hocalar %20 az başvurur · &gt;%25 → %40 az · &gt;%30 → çok az</div>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;">

      <div>

        <!-- HOCA BAŞVURU SONUÇLARI -->
        <div class="section-title">📋 Bu Dönem Proje Başvuruları</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">
          Hocalar dış çağrılara otomatik başvurur. Sonuçlar dönem sonunda açıklanır.
        </div>
        <div id="proj-applications-list">
          ${!lastApps || lastApps.total === 0 ? `
            <div class="empty-state" style="padding:16px;">
              <div class="empty-state-icon">📭</div>
              <div class="empty-state-title">Bu dönem proje başvurusu yapılmadı</div>
              <div class="empty-state-desc">Açık dış çağrı varsa hocalar sonraki dönemde başvuracak.</div>
            </div>
          ` : `
            <div class="card" style="padding:10px 14px;margin-bottom:10px;display:flex;gap:16px;flex-wrap:wrap;">
              <span style="font-size:12px;">Toplam Başvuru: <strong>${lastApps.total}</strong></span>
              <span style="font-size:12px;color:var(--accent-green,#48bb78);">Kabul: <strong>${(lastApps.accepted || []).length}</strong></span>
              <span style="font-size:12px;color:var(--accent-red,#e53e3e);">Red: <strong>${(lastApps.rejected || []).length}</strong></span>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              ${(lastApps.accepted || []).map(a => `
                <div class="card" style="padding:12px 14px;border-left:3px solid var(--accent-green,#48bb78);">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                    <div>
                      <div style="font-size:12px;font-weight:700;color:var(--text-muted);">✅ ${a.facultyName} <span style="font-size:11px;font-weight:400;">· ${a.facultyDept || ''}</span></div>
                      <div style="font-size:13px;font-weight:700;margin:2px 0;">"${a.projectName}"</div>
                      <div style="font-size:11px;color:var(--text-muted);">${a.callIcon || '📋'} ${a.callType} · ${formatMoney(a.requestedFunding)} · ${a.duration} dönem · ~${a.estimatedPublications} yayın</div>
                    </div>
                    <span style="font-size:11px;font-weight:700;color:var(--accent-green,#48bb78);white-space:nowrap;margin-left:8px;">KABUL EDİLDİ</span>
                  </div>
                </div>
              `).join('')}
              ${(lastApps.rejected || []).map(r => `
                <div class="card" style="padding:12px 14px;border-left:3px solid var(--accent-red,#e53e3e);opacity:0.8;">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                    <div>
                      <div style="font-size:12px;font-weight:700;color:var(--text-muted);">❌ ${r.facultyName} <span style="font-size:11px;font-weight:400;">· ${r.facultyDept || ''}</span></div>
                      <div style="font-size:13px;font-weight:700;margin:2px 0;">"${r.projectName}"</div>
                      <div style="font-size:11px;color:var(--text-muted);">${r.callIcon || '📋'} ${r.callType} · ${formatMoney(r.requestedFunding)}</div>
                    </div>
                    <span style="font-size:11px;font-weight:700;color:var(--accent-red,#e53e3e);white-space:nowrap;margin-left:8px;">REDDEDİLDİ</span>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- BAP -->
        <div class="section-title" style="margin-top:20px;">🏛️ BAP (Üniversite İçi Projeler)</div>
        ${activeBap ? `
          <div class="card" style="padding:14px;margin-bottom:12px;border-left:3px solid var(--accent-green);">
            <div style="font-size:13px;font-weight:700;margin-bottom:6px;">Aktif BAP Çağrısı</div>
            <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--text-muted);">
              <span>💰 Toplam: ${formatMoney(activeBap.totalBudget)}</span>
              <span>✅ Kalan: ${formatMoney(activeBap.remainingBudget)}</span>
              <span>🏷️ Proje başına maks: ${formatMoney(activeBap.maxPerProject)}</span>
            </div>
          </div>
          <div id="bap-applications-list">
            ${bapApps.length === 0 ? `
              <div style="font-size:12px;color:var(--text-faint);padding:8px 0;">Bekleyen BAP başvurusu yok.</div>
            ` : bapApps.map(app => _appCard(app, 'bap')).join('')}
          </div>
        ` : `
          <div class="card" style="padding:14px;margin-bottom:12px;">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Aktif BAP çağrısı yok. Çağrı açarak hocaların üniversite fonundan proje yürütmesini sağlayın.</div>
            <div style="display:grid;gap:10px;">
              <div class="offer-row">
                <div class="offer-label">Toplam BAP Bütçesi</div>
                <div class="slider-row" style="grid-template-columns:1fr 90px;margin-top:4px;">
                  <input type="range" id="bap-total-slider" min="100000" max="5000000" step="100000" value="500000">
                  <div class="slider-value" id="bap-total-value">${formatMoney(500000)}</div>
                </div>
              </div>
              <div class="offer-row">
                <div class="offer-label">Proje Başına Maksimum</div>
                <div class="slider-row" style="grid-template-columns:1fr 90px;margin-top:4px;">
                  <input type="range" id="bap-max-slider" min="30000" max="500000" step="10000" value="100000">
                  <div class="slider-value" id="bap-max-value">${formatMoney(100000)}</div>
                </div>
              </div>
              <button class="btn btn-primary btn-sm" id="btn-open-bap" style="justify-content:center;">
                📢 BAP Çağrısı Yayınla
              </button>
            </div>
          </div>
        `}

        <!-- AKTİF PROJELER -->
        <div class="section-title" style="margin-top:20px;">📊 Aktif Projeler (${activeProjects.length}) — Toplam Bütçe: ${formatMoney(totalProjectBudget)} — Üniversite Payı: ${formatMoney(uniShareTotal)}/dönem</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${activeProjects.map(p => {
            const turnsLeft = Math.max(0, (p.duration || 2) - (p.currentTurn || 0));
            const prog = p.progress ?? Math.round(((p.currentTurn || 0) / Math.max(1, p.duration || 2)) * 100);
            const progWidth = Math.min(100, prog);
            const projFunding = p.requestedFunding || p.funding || 0;
            const projSemFund = projFunding / Math.max(1, p.duration || 4);
            const projRate = p.callOverheadRate ?? uniOverheadRate;
            const projUniShare = Math.round(projSemFund * projRate);
            const borderColor = p.isPrivateSector ? 'var(--accent-yellow,#f5a623)' : 'var(--accent-purple,#9b59b6)';
            return `
            <div class="research-card" style="border-left:3px solid ${borderColor};">
              <div class="research-card-header">
                <div class="research-card-title">${p.callIcon || '📋'} ${p.projectName || p.name || 'İsimsiz Proje'}${p.isPrivateSector ? ' <span style="font-size:10px;background:var(--accent-yellow,#f5a623);color:#000;border-radius:3px;padding:1px 4px;">ÖZ.SEK</span>' : ''}</div>
                <span class="badge badge-purple">${p.callType || p.description || ''}</span>
              </div>
              <div class="research-card-meta">
                <span>⏱ ${turnsLeft} dönem kaldı</span>
                <span>💰 ${formatMoney(projFunding)}</span>
                <span style="color:var(--accent-green,#48bb78);">Üni payı: ${formatMoney(projUniShare)}/dönem</span>
                ${p.piName ? `<span>👤 PI: ${p.piName}</span>` : ''}
                ${(p.publicationBonus || p.estimatedPublications) ? `<span>📄 +${p.publicationBonus || p.estimatedPublications} yayın</span>` : ''}
              </div>
              <div class="research-progress-row">
                <div class="research-progress-track">
                  <div class="research-progress-fill" style="width:${progWidth}%"></div>
                </div>
                <div class="research-progress-pct">%${progWidth}</div>
              </div>
            </div>
          `}).join('') || `
            <div class="empty-state">
              <div class="empty-state-icon">🔬</div>
              <div class="empty-state-title">Aktif proje yok</div>
              <div class="empty-state-desc">Hocalar dış çağrılara otomatik başvurur; kabul edilenler buraya eklenir.</div>
            </div>
          `}
        </div>

        <!-- TAMAMLANAN PROJELER (son 5) -->
        ${completedProjs.length > 0 ? `
          <div class="section-title" style="margin-top:20px;">📜 Tamamlanan Projeler (Son ${Math.min(5, completedProjs.length)})</div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${[...completedProjs].reverse().slice(0, 5).map(p => `
              <div class="card" style="padding:10px 14px;opacity:0.85;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <div>
                    <span style="font-size:11px;color:${p.status === 'completed' ? 'var(--accent-green)' : 'var(--accent-red,#e53e3e)'};">${p.status === 'completed' ? '✅' : '❌'}</span>
                    <span style="font-size:12px;font-weight:600;margin-left:4px;">${p.projectName || p.name || 'İsimsiz'}</span>
                    <span style="font-size:11px;color:var(--text-muted);margin-left:6px;">${p.callType || ''}</span>
                  </div>
                  <div style="font-size:11px;color:var(--text-muted);text-align:right;">
                    ${p.piName ? `PI: ${p.piName}` : ''}
                    ${p.status === 'completed' ? ` · +${p.publicationBonus || p.estimatedPublications || 0} yayın` : ''}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

      </div>

      <div>
        <div class="section-title">Araştırma Bütçesi</div>
        <div class="card">
          <div class="offer-row">
            <div class="offer-label">Hoca başına dönemlik fon</div>
            <div class="slider-row" style="grid-template-columns:1fr 90px;margin-top:8px;">
              <input type="range" class="budget-slider" id="research-budget-slider"
                     min="0" max="500000" step="10000"
                     value="${state.researchBudgetPerFaculty ?? 50000}">
              <div class="slider-value" id="research-budget-value">
                ${formatMoney(state.researchBudgetPerFaculty ?? 50000)}
              </div>
            </div>
          </div>
          <div id="research-budget-preview" class="cost-preview"></div>
          <button class="btn btn-success btn-sm" id="btn-apply-research-budget"
                  style="width:100%;justify-content:center;margin-top:12px;">
            Güncelle
          </button>
        </div>

        <div class="section-title mt-md">Bölüm Araştırma Puanları</div>
        <div class="card">
          ${(state.departments || []).filter(d => d.isOpen).map(d => `
            <div style="margin-bottom:8px;">
              <div style="font-size:12px;font-weight:600;margin-bottom:4px;">${d.shortName || d.name}</div>
              ${createStatBar('Potansiyel', d.researchPotential ?? 50, 100, _statColor(d.researchPotential ?? 50))}
            </div>
          `).join('') || '<div style="font-size:12px;color:var(--text-faint);">Bölüm yok.</div>'}
        </div>
      </div>

    </div>
    </div><!-- /research-subtab-projects -->

    <!-- Alt Sekme: TTO -->
    <div id="research-subtab-tto" style="display:none;">
      ${_renderTTOPanel()}
    </div>

  `;

  // ── Alt sekme geçişi ────────────────────────────────────────────────────────
  panel.querySelectorAll('.research-subtab').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.subtab;
      panel.querySelectorAll('.research-subtab').forEach(b => {
        b.style.borderBottomColor = 'transparent';
        b.style.color = 'var(--text-muted)';
      });
      btn.style.borderBottomColor = 'var(--accent-blue,#3182ce)';
      btn.style.color = 'var(--accent-blue,#3182ce)';
      const projectsDiv = panel.querySelector('#research-subtab-projects');
      const ttoDiv = panel.querySelector('#research-subtab-tto');
      if (projectsDiv) projectsDiv.style.display = target === 'projects' ? '' : 'none';
      if (ttoDiv) ttoDiv.style.display = target === 'tto' ? '' : 'none';
    });
  });

  // ── Olay bağlantıları ──────────────────────────────────────────────────────

  const slider = el('research-budget-slider');
  const valEl  = el('research-budget-value');
  const previewEl = el('research-budget-preview');

  function _updateResearchPreview(newVal) {
    if (!previewEl) return;
    const facultyCount  = (state.faculty || []).length;
    const currentBudget = state.university?.budget ?? 0;
    const currentPerFac = state.researchBudgetPerFaculty ?? 50000;
    const currentTotal  = currentPerFac * facultyCount;
    const newTotal      = newVal * facultyCount;
    const diff          = newTotal - currentTotal;
    const projectedBudget = currentBudget - diff;
    const diffSign      = diff >= 0 ? '+' : '';
    const diffColor     = diff > 0 ? 'var(--accent)' : (diff < 0 ? 'var(--accent-green)' : 'var(--text-muted)');
    const diffArrow     = diff > 0 ? '▲' : (diff < 0 ? '▼' : '');
    let effectNote = '';
    if (newVal > currentPerFac) {
      const artis = Math.round(((newVal - currentPerFac) / Math.max(currentPerFac, 1)) * 100);
      effectNote = `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border-light);font-size:11px;color:var(--accent-green);">⚡ Araştırma çıktısı +${artis}% · Hoca memnuniyeti artar</div>`;
    } else if (newVal < currentPerFac) {
      effectNote = `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border-light);font-size:11px;color:var(--accent);">⚡ Araştırma çıktısı azalır · Hoca memnuniyeti düşebilir</div>`;
    }
    previewEl.innerHTML = `
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:6px;">MALİYET ETKİSİ</div>
      <div class="cost-preview-row"><span class="cost-preview-label">Mevcut:</span><span class="cost-preview-val">${facultyCount} × ${formatMoney(currentPerFac)} = ${formatMoney(currentTotal)}/dönem</span></div>
      <div class="cost-preview-row"><span class="cost-preview-label">Yeni:</span><span class="cost-preview-val">${facultyCount} × ${formatMoney(newVal)} = ${formatMoney(newTotal)}/dönem</span></div>
      <div class="cost-preview-row" style="margin-top:4px;padding-top:4px;border-top:1px solid var(--border-light);">
        <span class="cost-preview-label">Fark:</span>
        <span class="cost-preview-val" style="color:${diffColor};font-weight:700;">${diffSign}${formatMoney(diff)}/dönem ${diffArrow}</span>
      </div>
      <div class="cost-preview-row"><span class="cost-preview-label">Mevcut kasa:</span><span class="cost-preview-val">${formatMoney(currentBudget)}</span></div>
      <div class="cost-preview-row">
        <span class="cost-preview-label">Dönem sonu tahmini:</span>
        <span class="cost-preview-val" style="color:${projectedBudget >= 0 ? 'var(--accent-green)' : 'var(--accent)'};">${formatMoney(projectedBudget)}</span>
      </div>
      ${effectNote}
    `;
  }

  if (slider && valEl) {
    _updateResearchPreview(parseInt(slider.value));
    on(slider, 'input', () => {
      const v = parseInt(slider.value);
      valEl.textContent = formatMoney(v);
      _updateResearchPreview(v);
    });
  }

  on(el('btn-apply-research-budget'), 'click', () => {
    if (onResearchBudget) onResearchBudget(parseInt(el('research-budget-slider')?.value ?? 50000));
    showNotification('Araştırma bütçesi güncellendi.', 'success');
  });

  // Overhead rate slider güncellemeleri
  const overheadSlider  = el('overhead-rate-slider');
  const overheadValEl   = el('overhead-rate-value');
  const overheadNoteEl  = el('overhead-rate-note');
  if (overheadSlider && overheadValEl) {
    on(overheadSlider, 'input', () => {
      const pct = parseInt(overheadSlider.value);
      overheadValEl.textContent = `%${pct}`;
      if (overheadNoteEl) {
        const r = pct / 100;
        overheadNoteEl.textContent = r > 0.30 ? '⚠️ Hocalar proje başvurusundan büyük ölçüde kaçınıyor!'
          : r > 0.25 ? '⚠️ Hocalar başvuruyu azaltabilir.'
          : r > 0.20 ? 'ℹ️ Hocalar biraz isteksiz olabilir.'
          : '✅ Hocalar normal düzeyde başvuruyor.';
      }
    });
  }
  on(el('btn-apply-overhead-rate'), 'click', () => {
    const pct  = parseInt(el('overhead-rate-slider')?.value ?? 15);
    const rate = pct / 100;
    if (onProjectDecision) onProjectDecision('set_overhead_rate', null, { rate });
  });

  // BAP slider güncellemeleri
  const bapTotalSlider = el('bap-total-slider');
  const bapMaxSlider   = el('bap-max-slider');
  if (bapTotalSlider) {
    on(bapTotalSlider, 'input', () => {
      const bapValEl = el('bap-total-value');
      if (bapValEl) bapValEl.textContent = formatMoney(parseInt(bapTotalSlider.value));
    });
  }
  if (bapMaxSlider) {
    on(bapMaxSlider, 'input', () => {
      const bapMaxValEl = el('bap-max-value');
      if (bapMaxValEl) bapMaxValEl.textContent = formatMoney(parseInt(bapMaxSlider.value));
    });
  }

  // BAP çağrısı aç
  on(el('btn-open-bap'), 'click', () => {
    const totalBudget    = parseInt(el('bap-total-slider')?.value || 500000);
    const maxPerProject  = parseInt(el('bap-max-slider')?.value  || 100000);
    if (onProjectDecision) {
      onProjectDecision('open_bap_call', null, { totalBudget, maxPerProject, field: 'any' });
    }
  });

  // Proje onay/ret butonları (hem dış hem BAP başvuruları)
  delegate(panel, '.proj-decision-btn', 'click', (e, btn) => {
    const appId    = btn.dataset.appId;
    const decision = btn.dataset.decision;
    if (!appId || !decision) return;
    if (onProjectDecision) {
      onProjectDecision(decision, appId, {});
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. TRANSFER PAZARI MODAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transfer pazarındaki bir hoca için kompakt liste kartı HTML'i üretir.
 * Sol panelde gösterilir; tıklanınca sağ panel detayı açar.
 */
function _renderTransferFacultyCard(f, depts, state) {
  const dept     = depts.find(d => d.id === f.department) || null;
  const deptName = dept?.shortName || f.department || '—';
  const titleMap = { argö: 'ArGö', dr_ogr_uyesi: 'Dr.Öğr.Üyesi', docent: 'Doçent', profesor: 'Prof. Dr.' };
  const titleKey  = f.title || 'dr_ogr_uyesi';
  const titleDisp = titleMap[titleKey] || f.title;
  const stats     = f.stats || {};

  const research   = stats.research   ?? 50;
  const teaching   = stats.teaching   ?? 50;
  const management = stats.management ?? 50;

  // Genel puan (calculateOverallRating kullan)
  const overall = calculateOverallRating(f);
  const ratingClass = overall >= 85 ? 'gold' : overall >= 70 ? 'green' : overall >= 55 ? 'yellow' : 'red';

  // SVG avatar (36px) ya da baş harfler
  const avatarHtml = f.avatar
    ? renderFacultyAvatar(f.avatar, 36)
    : `<div class="faculty-avatar" style="width:36px;height:36px;font-size:12px;flex-shrink:0;">${(f.name||'').split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}</div>`;

  const pubCount = f.publications ?? null;

  return `
    <div class="transfer-market-card" data-faculty-id="${f.id}">
      <!-- Ana satır: avatar + isim/unvan/bölüm + puan badge -->
      <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;">
        <div style="flex-shrink:0;">${avatarHtml}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.name || 'İsimsiz'}</div>
          <div style="font-size:10px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${titleDisp} · ${deptName}
          </div>
        </div>
        <div class="rating-badge ${ratingClass}">${overall}</div>
      </div>

      <!-- Alt satır: stat özeti + yayın + maaş -->
      <div style="padding:4px 10px 8px;border-top:1px solid var(--border);font-size:10px;color:var(--text-muted);
                  display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span>📊 Ar:<strong style="color:#3182ce;">${research}</strong> Eğ:<strong style="color:#38a169;">${teaching}</strong></span>
        ${pubCount !== null ? `<span>📄 <strong>${pubCount}</strong> yayın</span>` : ''}
        <span style="margin-left:auto;color:var(--accent-yellow,#f5a623);font-weight:700;">
          ${formatMoney(f.askingSalary ?? f.salary)}/ay
        </span>
      </div>
    </div>
  `;
}

/**
 * Sağ panel: seçili hoca için detay + teklif formu HTML'i üretir.
 */
function _renderTransferRightPanel(fac, depts, state) {
  if (!fac) {
    return `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;
                  min-height:200px;color:var(--text-muted);font-size:13px;gap:8px;text-align:center;">
        <div style="font-size:32px;">👈</div>
        <div>Sol taraftan bir hoca seçin</div>
        <div style="font-size:11px;">Karta tıklayarak detayları ve teklif formunu görün</div>
      </div>`;
  }

  const titleMap = { argö: 'ArGö', dr_ogr_uyesi: 'Dr.Öğr.Üyesi', docent: 'Doçent', profesor: 'Prof. Dr.' };
  const titleKey  = fac.title || 'dr_ogr_uyesi';
  const titleDisp = titleMap[titleKey] || fac.title || '';
  const stats     = fac.stats || {};
  const research  = stats.research   ?? 50;
  const teaching  = stats.teaching   ?? 50;
  const mgmt      = stats.management ?? 50;
  const avgStat   = Math.round((research + teaching + mgmt) / 3);

  // Genel puan — calculateOverallRating kullan
  const overallRating   = calculateOverallRating(fac);
  const ratingClass     = overallRating >= 85 ? 'gold' : overallRating >= 70 ? 'green' : overallRating >= 55 ? 'yellow' : 'red';
  const ratingColor     = overallRating >= 85 ? '#d4af37' : overallRating >= 70 ? '#38a169' : overallRating >= 55 ? '#f5a623' : '#e53e3e';
  const ratingBg        = overallRating >= 85 ? 'rgba(212,175,55,0.12)' : overallRating >= 70 ? 'rgba(56,161,105,0.12)' : overallRating >= 55 ? 'rgba(245,166,35,0.12)' : 'rgba(229,62,62,0.12)';

  const myDepts       = (state.departments || []).filter(d => d.isOpen);
  const myDeptIds     = myDepts.map(d => d.id);
  const teachable     = _getTeachableCourses(fac, myDeptIds);
  const deptCompat    = myDepts.map(d => ({
    dept: d,
    compat: _getDeptCompatibility(fac, d.id, myDeptIds),
  })).filter(x => x.compat.count > 0).sort((a, b) => b.compat.pct - a.compat.pct);

  const dept       = (state.departments || []).find(d => d.id === fac.department) || null;
  const deptName   = dept?.shortName || fac.department || '—';
  const matchPct   = deptCompat.length > 0 ? deptCompat[0].compat.pct : 0;
  const matchNames = deptCompat.length > 0 ? deptCompat.map(x => x.dept.shortName || x.dept.name).join(', ') : deptName;

  const isHighRated   = avgStat > 70;
  const pubEstimate   = isHighRated ? Math.max(1, Math.round((research - 50) / 15)) : 0;
  const satEstimate   = isHighRated ? Math.max(1, Math.round((teaching  - 50) / 12)) : 0;
  const prestEstimate = isHighRated ? Math.max(1, Math.round((avgStat   - 60) / 10)) : 0;
  const gradStudents  = (titleKey === 'profesor' || titleKey === 'docent') ? Math.max(1, Math.round((research - 50) / 20)) : 0;
  const totalCost     = (fac.askingSalary ?? fac.salary ?? 0) + (fac.transferFee ?? 0);
  const initials      = (fac.name || '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  // SVG avatar (48px) ya da baş harfler
  const avatarHtmlRight = fac.avatar
    ? renderFacultyAvatar(fac.avatar, 48)
    : `<div class="faculty-avatar" style="width:48px;height:48px;font-size:18px;flex-shrink:0;">${initials}</div>`;

  const statBars = [
    { label: '🔬 Araştırma', val: research,  color: '#3182ce' },
    { label: '📚 Eğitim',    val: teaching,  color: '#38a169' },
    { label: '🏛️ Yönetim',  val: mgmt,      color: '#dd6b20' },
  ].map(s => {
    const pct = Math.min(100, Math.max(0, s.val));
    return `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
        <span style="width:90px;font-size:11px;color:var(--text-muted);">${s.label}</span>
        <div style="flex:1;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${s.color};border-radius:3px;"></div>
        </div>
        <span style="width:28px;text-align:right;font-size:11px;font-weight:700;color:${s.color};">${s.val}</span>
      </div>`;
  }).join('');

  return `
    <!-- Hoca profili -->
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
      <div style="flex-shrink:0;">${avatarHtmlRight}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:16px;font-weight:700;">${fac.name || 'İsimsiz'}</div>
        <div style="font-size:12px;color:var(--text-muted);">${titleDisp} · ${deptName}</div>
      </div>
      <!-- Genel puan badge — büyük ve belirgin -->
      <div style="text-align:center;padding:6px 12px;border-radius:10px;background:${ratingBg};flex-shrink:0;">
        <div style="font-size:22px;font-weight:800;color:${ratingColor};line-height:1;">${overallRating}</div>
        <div style="font-size:9px;color:var(--text-muted);margin-top:2px;">Genel Puan</div>
      </div>
    </div>

    <!-- Stat çubukları -->
    <div style="background:var(--bg-secondary);border-radius:8px;padding:10px 12px;margin-bottom:10px;">
      ${statBars}
    </div>

    <!-- Akademik metrikler (yayın/atıf/h-index/proje) -->
    ${(fac.publications != null || fac.citations != null) ? `
      <div style="background:var(--bg-secondary);border-radius:8px;padding:8px 12px;margin-bottom:10px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-muted);letter-spacing:.05em;margin-bottom:6px;">Akademik Çıktılar</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;text-align:center;">
          ${[
            { label: 'Yayın', val: fac.publications ?? '—', color: '#3182ce' },
            { label: 'Atıf',  val: fac.citations   ?? '—', color: '#805ad5' },
            { label: 'h-ind', val: fac.hIndex      ?? '—', color: '#38a169' },
            { label: 'Proje', val: fac.activeProjects != null ? fac.activeProjects : '—', color: '#dd6b20' },
          ].map(s => `
            <div style="background:rgba(255,255,255,0.04);border-radius:6px;padding:6px 2px;">
              <div style="font-size:15px;font-weight:700;color:${s.color};">${s.val}</div>
              <div style="font-size:9px;color:var(--text-muted);">${s.label}</div>
            </div>
          `).join('')}
        </div>
        ${fac.education ? `
          <div style="font-size:11px;margin-top:8px;color:var(--text-muted);">
            Doktora: <strong style="color:var(--text-primary);">${fac.education.phd}</strong>
            <span style="margin-left:4px;">(${fac.education.year})</span>
            ${fac.yearsExperience != null ? `· <strong>${fac.yearsExperience} yıl</strong> deneyim` : ''}
          </div>
        ` : ''}
        ${fac.previousUniversity ? `
          <div style="font-size:11px;margin-top:4px;color:var(--text-muted);">
            Şu an: <strong style="color:var(--text-primary);">${fac.previousUniversity}</strong>
          </div>
        ` : ''}
      </div>
    ` : ''}

    <!-- Uzmanlık alanları -->
    ${(fac.specializations && fac.specializations.length > 0) ? `
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;">
        ${fac.specializations.map(s => `
          <span style="font-size:10px;padding:3px 7px;border-radius:10px;
                background:rgba(56,161,105,0.12);color:#38a169;border:1px solid rgba(56,161,105,0.3);">${s}</span>
        `).join('')}
      </div>
    ` : ''}

    <!-- Verebileceği dersler -->
    ${teachable.length > 0 ? `
      <div style="background:rgba(49,130,206,0.07);border:1px solid rgba(49,130,206,0.25);border-radius:8px;
                  padding:8px 12px;margin-bottom:10px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#3182ce;margin-bottom:6px;letter-spacing:.06em;">
          Verebilecegi Dersler (${teachable.length})
        </div>
        ${teachable.slice(0, 6).map(c => `
          <div style="font-size:11px;margin-bottom:2px;display:flex;align-items:center;gap:6px;">
            <span style="color:#3182ce;">•</span>
            <span>${c.courseName}</span>
            <span style="color:var(--text-muted);font-size:10px;">${c.deptShortName} — ${c.type}</span>
          </div>
        `).join('')}
        ${teachable.length > 6 ? `<div style="font-size:10px;color:var(--text-muted);margin-top:4px;">+${teachable.length - 6} ders daha...</div>` : ''}
      </div>
    ` : `
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px;">
        Bu hocanın uzmanlığı mevcut bölüm derslerinizle örtüşmüyor.
      </div>
    `}

    <!-- Bölüm uyumu -->
    ${deptCompat.length > 0 ? `
      <div style="background:rgba(56,161,105,0.07);border:1px solid rgba(56,161,105,0.25);border-radius:8px;
                  padding:8px 12px;margin-bottom:10px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#38a169;margin-bottom:6px;letter-spacing:.06em;">
          Bolum Uyumu
        </div>
        ${deptCompat.map(x => {
          const pct = x.compat.pct;
          const color = pct >= 60 ? '#38a169' : pct >= 30 ? '#f5a623' : '#e53e3e';
          return `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <span style="width:90px;font-size:11px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">
                ${x.dept.shortName || x.dept.name}
              </span>
              <div style="flex:1;height:5px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;">
                <div style="width:${pct}%;height:100%;background:${color};border-radius:3px;"></div>
              </div>
              <span style="font-size:10px;color:${color};font-weight:700;width:56px;text-align:right;">
                %${pct} (${x.compat.count} ders)
              </span>
            </div>`;
        }).join('')}
      </div>
    ` : ''}

    <!-- Maaş + kaynak -->
    <div style="background:var(--bg-secondary);border-radius:8px;padding:8px 12px;font-size:12px;margin-bottom:10px;">
      <div style="margin-bottom:4px;">
        Transfer maaş talebi: <strong style="color:var(--accent-yellow,#f5a623);">${formatMoney(fac.askingSalary ?? fac.salary)}/ay</strong>
        ${fac.salaryRange ? ` <span style="color:var(--text-muted);font-size:10px;">(Barem: ${formatMoney(fac.salaryRange.min)} - ${formatMoney(fac.salaryRange.max)})</span>` : ''}
      </div>
      ${fac.transferFee ? `<div>Tazminat: <strong style="color:var(--accent-red,#e53e3e);">${formatMoney(fac.transferFee)}</strong></div>` : ''}
      ${fac.currentUniversity ? `<div style="color:var(--text-muted);">Nereden: ${fac.currentUniversity}</div>` : ''}
    </div>

    <!-- Bu hocayı alırsan -->
    ${isHighRated ? `
      <div style="background:rgba(56,161,105,0.07);border:1px solid rgba(56,161,105,0.25);border-radius:8px;
                  padding:8px 12px;margin-bottom:12px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#38a169;margin-bottom:6px;letter-spacing:.06em;">
          Bu Hocayı Alırsan:
        </div>
        ${pubEstimate   > 0 ? `<div style="font-size:11px;margin-bottom:3px;">📄 Araştırma: <strong style="color:#38a169;">+${pubEstimate} yayın/dönem tahmini</strong></div>` : ''}
        ${satEstimate   > 0 ? `<div style="font-size:11px;margin-bottom:3px;">🎓 Eğitim: <strong style="color:#38a169;">Öğrenci memnuniyeti +${satEstimate}</strong></div>` : ''}
        ${prestEstimate > 0 ? `<div style="font-size:11px;margin-bottom:3px;">⭐ Saygınlık: <strong style="color:#38a169;">+${prestEstimate}</strong></div>` : ''}
        ${gradStudents  > 0 ? `<div style="font-size:11px;margin-bottom:3px;">🎓 Y.lisans/doktora: <strong style="color:#38a169;">+${gradStudents} öğrenci/dönem</strong></div>` : ''}
      </div>
    ` : ''}

    <!-- Teklif formu -->
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);
                letter-spacing:.5px;margin-bottom:8px;">Teklif Bilgileri</div>

    <div class="offer-row" style="margin-bottom:8px;">
      <div class="offer-label">Teklif Maaşı (₺/ay)</div>
      <input type="number" class="offer-input" id="offer-salary"
             value="${fac.askingSalary ?? fac.salary ?? ''}"
             placeholder="Ör: 180000" min="0" step="5000">
    </div>

    <div class="offer-row" style="margin-bottom:8px;">
      <div class="offer-label">Araştırma Fonu (₺)</div>
      <input type="number" class="offer-input" id="offer-research-fund"
             placeholder="Ör: 500000" min="0" step="50000">
    </div>

    <div class="offer-row" style="margin-bottom:8px;">
      <div class="offer-label">Lab Kalitesi (0-100)</div>
      <input type="number" class="offer-input" id="offer-lab-quality"
             placeholder="0-100" min="0" max="100" step="5">
    </div>

    <label class="offer-checkbox-row" style="margin-bottom:12px;">
      <input type="checkbox" id="offer-title-promise">
      Unvan yükseltme vaadi
    </label>

    <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px;">
      Toplam 1. ay maliyeti: <strong style="color:var(--accent-red,#e53e3e);">${formatMoney(totalCost)}</strong>
    </div>

    <button class="btn btn-success" id="btn-send-offer"
            data-faculty-id="${fac.id}"
            style="width:100%;justify-content:center;">
      Transfer Et / Teklif Gönder
    </button>
  `;
}

/**
 * Transfer pazarı modal içeriği.
 * @param {object}   state   — Oyun durumu
 * @param {Array}    market  — Transfer pazarındaki hoca listesi
 * @param {Function} onOffer — Teklif gönderme callback (facultyId, offer) => void
 */
export function renderTransferMarket(state, market, onOffer) {
  const depts = state.departments || [];
  let selectedFacultyId = null;

  // Sol panel: sadece kompakt kart listesi
  const leftCards = (market || []).map(f => _renderTransferFacultyCard(f, depts, state)).join('');

  const html = `
    <div class="transfer-grid">
      <!-- Sol: Hoca listesi -->
      <div>
        <div class="section-title" style="margin-bottom:8px;">Pazardaki Hocalar (${(market || []).length})</div>
        <div id="transfer-faculty-list" style="display:flex;flex-direction:column;gap:8px;max-height:560px;overflow-y:auto;padding-right:4px;">
          ${leftCards || `
            <div class="empty-state" style="padding:24px;">
              <div class="empty-state-icon">👔</div>
              <div class="empty-state-title">Pazar boş</div>
              <div class="empty-state-desc">Bu dönem transfer pazarında uygun aday yok.</div>
            </div>
          `}
        </div>
      </div>

      <!-- Sağ: Detay + Teklif Formu -->
      <div>
        <div class="section-title" style="margin-bottom:8px;">Hoca Detayı &amp; Teklif</div>
        <div class="transfer-offer-form" id="transfer-right-panel"
             style="max-height:560px;overflow-y:auto;">
          ${_renderTransferRightPanel(null, depts, state)}
        </div>
      </div>
    </div>
  `;

  showModal('Transfer Pazarı', html, { wide: true });

  // Hoca kartı tıklama — sağ paneli güncelle
  delegate(el('transfer-faculty-list'), '.transfer-market-card', 'click', (e, card) => {
    selectedFacultyId = card.dataset.facultyId;
    const fac = (market || []).find(f => f.id === selectedFacultyId);
    if (!fac) return;

    // Seçili kartı vurgula
    qsa('#transfer-faculty-list .transfer-market-card').forEach(c => {
      c.style.outline = c.dataset.facultyId === selectedFacultyId
        ? '2px solid var(--accent-green)' : 'none';
      c.style.outlineOffset = '1px';
    });

    // Sağ paneli yenile
    const panel = el('transfer-right-panel');
    if (panel) {
      panel.innerHTML = _renderTransferRightPanel(fac, depts, state);

      // Teklif gönder butonu
      on(el('btn-send-offer'), 'click', () => {
        const offer = {
          facultyId:    fac.id,
          salary:       parseInt(el('offer-salary')?.value   || fac.askingSalary || fac.salary || 0),
          researchFund: parseInt(el('offer-research-fund')?.value || 0),
          labQuality:   parseInt(el('offer-lab-quality')?.value   || 0),
          titlePromise: el('offer-title-promise')?.checked || false,
        };
        if (onOffer) onOffer(fac.id, offer);
      });
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 8b. KADRO İLANI VER MODAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kadro ilanı verme modalını gösterir.
 * @param {object}   state    — Oyun durumu
 * @param {Function} onSubmit — İlan gönderme callback: (position) => void
 */
export function renderOpenPositionModal(state, onSubmit) {
  const depts      = (state.departments || []).filter(d => d.isOpen);
  const uniType    = state.meta?.universityType ?? 'vakif';
  const scaleMap   = { devlet: SALARY_SCALES.tr_devlet, vakif: SALARY_SCALES.tr_vakif, us_private: SALARY_SCALES.us_private };
  const scale      = scaleMap[uniType] || SALARY_SCALES.tr_vakif;

  const deptOptions = depts.map(d =>
    `<option value="${d.id}">${d.shortName || d.name}</option>`
  ).join('');

  // Başlangıç değerleri
  const firstDept  = depts[0];
  const firstTitle = 'dr_ogr_uyesi';
  const firstRange = scale[firstTitle] || { min: 28000, max: 55000 };
  const initSalary = Math.round((firstRange.min + firstRange.max) / 2);

  // Alan checkbox'ları (ilk bölüme göre)
  function _buildFieldCheckboxes(fields) {
    return fields.map(f =>
      `<label class="field-checkbox">
        <input type="checkbox" class="field-cb" value="${f}">
        <span>${f}</span>
      </label>`
    ).join('');
  }
  const firstFields = firstDept ? (DEPARTMENT_FIELDS[firstDept.id] || []) : [];
  const firstFieldCbs = _buildFieldCheckboxes(firstFields);

  const titleOptions = [
    `<option value="argö">Araştırma Görevlisi</option>`,
    `<option value="dr_ogr_uyesi" selected>Dr. Öğr. Üyesi</option>`,
    `<option value="docent">Doçent</option>`,
    `<option value="profesor">Profesör</option>`,
  ].join('');

  const html = `
    <div style="display:flex;flex-direction:column;gap:14px;">

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">Bölüm</label>
          <select class="filter-select" id="pos-dept" style="width:100%;">${deptOptions}</select>
        </div>
        <div>
          <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">Unvan</label>
          <select class="filter-select" id="pos-title" style="width:100%;">${titleOptions}</select>
        </div>
      </div>

      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:6px;">Aranan Alan(lar)</label>
        <div id="pos-field-container" class="field-selection">
          <label class="field-checkbox field-checkbox--all">
            <input type="checkbox" id="field-all" checked>
            <span>Tüm Alanlar</span>
          </label>
          <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:4px 0;">
          <div id="pos-field-list" style="opacity:0.4;pointer-events:none;">
            ${firstFieldCbs}
          </div>
        </div>
      </div>

      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">
          Maaş Teklifi: <strong id="pos-salary-display">${initSalary.toLocaleString('tr-TR')} ₺/ay</strong>
          <span style="font-size:10px;color:var(--text-muted);margin-left:8px;" id="pos-salary-range-label">
            Barem: ${firstRange.min.toLocaleString('tr-TR')} - ${firstRange.max.toLocaleString('tr-TR')} ₺
          </span>
        </label>
        <input type="range" id="pos-salary-slider"
               min="${firstRange.min}" max="${Math.round(firstRange.max * 1.5)}"
               step="1000" value="${initSalary}"
               style="width:100%;accent-color:var(--accent-blue,#3182ce);">
      </div>

      <div>
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">
          Araştırma Fonu (₺/dönem): <strong id="pos-fund-display">0 ₺</strong>
        </label>
        <input type="range" id="pos-fund-slider" min="0" max="2000000" step="50000" value="0"
               style="width:100%;accent-color:var(--accent-blue,#3182ce);">
      </div>

      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
        <input type="checkbox" id="pos-lab" style="width:16px;height:16px;">
        Özel lab alanı sağlanacak
      </label>

      <!-- Tahmini başvuru -->
      <div id="pos-estimate" style="background:rgba(56,161,105,0.07);border:1px solid rgba(56,161,105,0.25);
                border-radius:8px;padding:10px 14px;font-size:12px;">
        Maaş ve koşulları belirleyin, tahmini başvuru sayısı burada görünecek.
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px;">
        <button class="btn btn-secondary" id="btn-pos-cancel">İptal</button>
        <button class="btn btn-primary" id="btn-pos-submit">İlan Ver</button>
      </div>
    </div>
  `;

  showModal('Kadro İlanı Ver', html);

  // Dinamik hesaplama
  function _updateEstimate() {
    const deptId    = el('pos-dept')?.value || '';
    const titleVal  = el('pos-title')?.value || 'dr_ogr_uyesi';
    const salary    = parseInt(el('pos-salary-slider')?.value || 0);
    const fund      = parseInt(el('pos-fund-slider')?.value  || 0);
    const range     = scale[titleVal] || { min: 28000, max: 55000 };
    const mid       = (range.min + range.max) / 2;
    const salaryRatio = salary / mid;

    // Alan checkbox listesini güncelle (bölüm değiştiğinde)
    const fieldList = el('pos-field-list');
    if (fieldList && deptId) {
      const fields = DEPARTMENT_FIELDS[deptId] || [];
      fieldList.innerHTML = _buildFieldCheckboxes(fields);
      // Tüm Alanlar seçiliyse yeni checkboxlar da disabled kalmalı
      const allCb = el('field-all');
      if (allCb && allCb.checked) {
        fieldList.style.opacity = '0.4';
        fieldList.style.pointerEvents = 'none';
      } else {
        fieldList.style.opacity = '1';
        fieldList.style.pointerEvents = '';
      }
    }

    // Barem etiketini güncelle
    const rangeLabel = el('pos-salary-range-label');
    if (rangeLabel) {
      rangeLabel.textContent = `Barem: ${range.min.toLocaleString('tr-TR')} - ${range.max.toLocaleString('tr-TR')} ₺`;
    }
    const slider = el('pos-salary-slider');
    if (slider) { slider.min = range.min; slider.max = Math.round(range.max * 1.5); }

    const prestige = state.university?.prestige ?? state.prestige ?? 30;
    const baseCnt  = salaryRatio >= 1.2 ? '4-6' : salaryRatio >= 1.0 ? '2-4' : salaryRatio >= 0.8 ? '0-2' : '0';
    const quality  = salaryRatio >= 1.2 ? 'iyi kalite' : salaryRatio >= 1.0 ? 'orta kalite' : 'düşük kalite';
    const fundNote = fund > 0 ? ' + araştırma odaklı adaylar' : '';
    const presNote = prestige >= 60 ? ' · Yüksek saygınlık bonusu' : '';

    const estimateEl = el('pos-estimate');
    if (estimateEl) {
      estimateEl.innerHTML = `
        <div style="font-size:11px;font-weight:700;color:#38a169;margin-bottom:6px;">Tahmini Başvuru</div>
        <div>Bu koşullarla <strong>~${baseCnt} aday</strong> bekleniyor (1-2 dönem içinde)</div>
        <div style="color:var(--text-muted);margin-top:4px;">${quality}${fundNote}${presNote}</div>
        <div style="margin-top:4px;color:${salaryRatio >= 1.0 ? '#38a169' : '#e53e3e'};">
          ${salaryRatio >= 1.2 ? 'Maaş baremin üstünde → daha çok ve iyi aday' :
            salaryRatio >= 1.0 ? 'Maaş barem içinde → normal talep' :
            'Maaş baremin altında → az veya zayıf aday'}
        </div>
      `;
    }
  }

  // Slider güncellemeleri
  on(el('pos-salary-slider'), 'input', () => {
    const v = el('pos-salary-slider')?.value;
    const disp = el('pos-salary-display');
    if (disp) disp.textContent = `${parseInt(v).toLocaleString('tr-TR')} ₺/ay`;
    _updateEstimate();
  });
  on(el('pos-fund-slider'), 'input', () => {
    const v = el('pos-fund-slider')?.value;
    const disp = el('pos-fund-display');
    if (disp) disp.textContent = `${parseInt(v).toLocaleString('tr-TR')} ₺`;
    _updateEstimate();
  });
  on(el('pos-dept'),  'change', _updateEstimate);
  on(el('pos-title'), 'change', () => {
    const titleVal = el('pos-title')?.value || 'dr_ogr_uyesi';
    const range = scale[titleVal] || { min: 28000, max: 55000 };
    const mid   = Math.round((range.min + range.max) / 2);
    const slider = el('pos-salary-slider');
    if (slider) { slider.min = range.min; slider.max = Math.round(range.max * 1.5); slider.value = mid; }
    const disp = el('pos-salary-display');
    if (disp) disp.textContent = `${mid.toLocaleString('tr-TR')} ₺/ay`;
    _updateEstimate();
  });

  // "Tüm Alanlar" checkbox — bireysel checkbox'ları aç/kapat
  on(el('field-all'), 'change', () => {
    const allCb   = el('field-all');
    const fieldList = el('pos-field-list');
    if (!fieldList) return;
    if (allCb && allCb.checked) {
      fieldList.style.opacity = '0.4';
      fieldList.style.pointerEvents = 'none';
    } else {
      fieldList.style.opacity = '1';
      fieldList.style.pointerEvents = '';
    }
  });

  on(el('btn-pos-cancel'), 'click', hideModal);
  on(el('btn-pos-submit'), 'click', () => {
    const allCb    = el('field-all');
    const allFields = allCb ? allCb.checked : true;
    const selectedFields = allFields
      ? []
      : qsa('#pos-field-list .field-cb:checked').map(cb => cb.value);

    if (!allFields && selectedFields.length === 0) {
      showNotification('Lütfen en az bir alan seçin.', 'warning');
      return;
    }

    const position = {
      id:            `pos_${Date.now()}`,
      department:    el('pos-dept')?.value || '',
      title:         el('pos-title')?.value || 'dr_ogr_uyesi',
      fields:        selectedFields,
      allFields:     allFields,
      // Geriye dönük uyumluluk için field alanını da doldur
      field:         allFields ? 'Tüm Alanlar' : selectedFields.join(', '),
      offeredSalary: parseInt(el('pos-salary-slider')?.value || 0),
      researchFund:  parseInt(el('pos-fund-slider')?.value  || 0),
      hasLab:        el('pos-lab')?.checked || false,
      postedTurn:    state.meta?.turn ?? 1,
    };
    if (!position.department) {
      showNotification('Lütfen bir bölüm seçin.', 'warning');
      return;
    }
    hideModal();
    if (onSubmit) onSubmit(position);
  });

  // İlk hesapla
  _updateEstimate();
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. DÖNEM SONU ÖZET
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dönem sonu özet kartlarını göster.
 * @param {object}   summary     — Dönem özeti objesi
 * @param {Function} onNextTurn  — "Sonraki Dönem" callback
 */
export function renderTurnSummary(summary, onNextTurn) {
  const bodyEl  = el('summary-modal-body');
  const titleEl = el('summary-modal-title');
  const overlay = el('turn-summary-overlay');
  if (!bodyEl || !overlay) return;

  const meta = summary.meta || {};
  if (titleEl) {
    const sem = meta.semester === 'güz'   ? 'Güz'
              : meta.semester === 'bahar' ? 'Bahar'
              : '';
    const yil = (typeof meta.year === 'number' && meta.year > 0) ? `${meta.year}. Yıl ` : '';
    const baslik = (yil || sem)
      ? `${yil}${sem}${sem ? ' Dönemi ' : ''}Özeti`.replace(/\s+/g, ' ').trim()
      : 'Dönem Özeti';
    titleEl.textContent = baslik;
  }

  const fin   = summary.financial || {};
  const acad  = summary.academic  || {};
  const stud  = summary.students  || {};
  const events = summary.events   || [];
  const projApps = summary.projectApplications || null;

  bodyEl.innerHTML = `
    <div class="summary-cards-grid">

      <!-- Mali Özet -->
      <div class="summary-card">
        <div class="summary-card-title">
          <span class="summary-icon">💰</span> Mali Durum
        </div>
        <div class="summary-row">
          <span class="summary-row-label">Toplam Gelir</span>
          <span class="summary-row-value positive">${formatMoney(fin.revenue ?? 0)}</span>
        </div>
        <div class="summary-row">
          <span class="summary-row-label">Toplam Gider</span>
          <span class="summary-row-value negative">-${formatMoney(fin.costs ?? 0)}</span>
        </div>
        <div class="summary-row summary-total-row">
          <span class="summary-row-label">Net Değişim</span>
          <span class="summary-row-value ${(fin.net ?? 0) >= 0 ? 'positive' : 'negative'}">
            ${(fin.net ?? 0) >= 0 ? '+' : ''}${formatMoney(fin.net ?? 0)}
          </span>
        </div>
        <div class="summary-row" style="margin-top:8px;">
          <span class="summary-row-label">Mevcut Kasa</span>
          <span class="summary-row-value">${formatMoney(fin.newBudget ?? 0)}</span>
        </div>
      </div>

      <!-- Proje Gelirleri (sadece aktif proje varsa) -->
      ${((fin.projectOverhead ?? 0) > 0 || (fin.patentRoyalties ?? 0) > 0) ? `
        <div class="summary-card">
          <div class="summary-card-title">
            <span class="summary-icon">💼</span> Proje Gelirleri
          </div>
          ${(fin.projectOverhead ?? 0) > 0 ? `
            <div class="summary-row">
              <span class="summary-row-label">Genel gider geliri</span>
              <span class="summary-row-value positive">${formatMoney(fin.projectOverhead)}</span>
            </div>
          ` : ''}
          ${(fin.patentRoyalties ?? 0) > 0 ? `
            <div class="summary-row">
              <span class="summary-row-label">Patent telif gelirleri</span>
              <span class="summary-row-value positive">${formatMoney(fin.patentRoyalties)}</span>
            </div>
          ` : ''}
          <div class="summary-row summary-total-row">
            <span class="summary-row-label">Toplam</span>
            <span class="summary-row-value positive">${formatMoney((fin.projectOverhead ?? 0) + (fin.patentRoyalties ?? 0))}</span>
          </div>
        </div>
      ` : ''}

      <!-- Akademik Özet -->
      <div class="summary-card">
        <div class="summary-card-title">
          <span class="summary-icon">🎓</span> Akademik Gelişme
        </div>
        <div class="summary-row">
          <span class="summary-row-label">Saygınlık Değişimi</span>
          <span class="summary-row-value ${(acad.prestigeDelta ?? 0) >= 0 ? 'positive' : 'negative'}">
            ${(acad.prestigeDelta ?? 0) >= 0 ? '+' : ''}${acad.prestigeDelta ?? 0}
          </span>
        </div>
        <div class="summary-row">
          <span class="summary-row-label">Sıralama</span>
          <span class="summary-row-value">
            #${acad.newRanking ?? '—'}
            ${acad.rankingDelta ? ` (${acad.rankingDelta > 0 ? '+' : ''}${acad.rankingDelta})` : ''}
          </span>
        </div>
        <div class="summary-row">
          <span class="summary-row-label">Yeni Yayın</span>
          <span class="summary-row-value positive">${acad.newPublications ?? 0}</span>
        </div>
        <div class="summary-row">
          <span class="summary-row-label">Hoca Memnuniyeti</span>
          <span class="summary-row-value">${acad.avgFacultyHappiness ?? '—'}/100</span>
        </div>
      </div>

      <!-- Öğrenci Özeti -->
      <div class="summary-card">
        <div class="summary-card-title">
          <span class="summary-icon">👩‍🎓</span> Öğrenci Hareketleri
        </div>
        <div class="summary-row">
          <span class="summary-row-label">Yeni Kayıt</span>
          <span class="summary-row-value positive">${stud.newAdmissions ?? 0}</span>
        </div>
        <div class="summary-row">
          <span class="summary-row-label">Mezun</span>
          <span class="summary-row-value positive">${stud.graduates ?? 0}</span>
        </div>
        <div class="summary-row">
          <span class="summary-row-label">Ayrılan</span>
          <span class="summary-row-value negative" title="${stud.failDropouts ?? 0} başarısızlık, ${stud.dissatisfiedDropouts ?? 0} bırakma, ${stud.transferOut ?? 0} yatay geçiş çıkış">${(stud.dropouts ?? 0) + (stud.transferOut ?? 0)} (${stud.failDropouts ?? 0} bşr, ${stud.dissatisfiedDropouts ?? 0} bır, ${stud.transferOut ?? 0} yatay)</span>
        </div>
        <div class="summary-row">
          <span class="summary-row-label">Yatay Geçiş Gelen</span>
          <span class="summary-row-value positive">+${stud.transferIn ?? 0}</span>
        </div>
        <div class="summary-row">
          <span class="summary-row-label">Ortalama Memnuniyet</span>
          <span class="summary-row-value">${stud.avgSatisfaction ?? '—'}/100</span>
        </div>
      </div>

      <!-- Olay Özeti -->
      <div class="summary-card">
        <div class="summary-card-title">
          <span class="summary-icon">📣</span> Bu Dönem Olaylar
        </div>
        ${(() => {
          const allEvents = [...events];
          // Yıldız öğrenci olaylarını ayrı vurgula
          const starEvents   = allEvents.filter(ev => ev.type === 'star_student_competition' || ev.type === 'star_student_publication' || ev.type === 'star_student_graduated' || ev.type === 'star_faculty_hired');
          const otherEvents  = allEvents.filter(ev => !starEvents.includes(ev));
          const shownEvents  = [...starEvents, ...otherEvents].slice(0, 8);
          if (shownEvents.length === 0) {
            return `<div style="font-size:12px;color:var(--text-faint);padding:8px 0;">Önemli olay yaşanmadı.</div>`;
          }
          return shownEvents.map(ev => {
            const isStarStudent = ev.type === 'star_student_competition' || ev.type === 'star_student_publication' || ev.type === 'star_student_graduated';
            const isStarFaculty = ev.type === 'star_faculty_hired';
            const icon = isStarStudent ? '⭐' : isStarFaculty ? '🌟' : ev.type === 'construction_complete' ? '🏗' : ev.type === 'research_complete' ? '📄' : '📣';
            return `
              <div class="summary-row" style="${isStarStudent || isStarFaculty ? 'background:rgba(245,166,35,0.08);border-radius:4px;padding:3px 4px;margin-bottom:2px;' : ''}">
                <span class="summary-row-label">${icon} ${ev.description || ev.message || ev.title || 'Olay'}</span>
                ${(ev.prestigeBonus ?? 0) > 0 ? `<span class="summary-row-value positive">+${ev.prestigeBonus} saygınlık</span>` : ''}
              </div>`;
          }).join('');
        })()}
      </div>

      <!-- Yıldız Öğrenci Başarıları -->
      ${(() => {
        const starAchievements = events.filter(ev =>
          ev.type === 'star_student_competition' || ev.type === 'star_student_publication' || ev.type === 'star_student_graduated'
        );
        if (starAchievements.length === 0) return '';
        return `
          <div class="summary-card" style="border-color:rgba(245,166,35,0.4);background:rgba(245,166,35,0.05);">
            <div class="summary-card-title" style="color:#f5a623;">
              <span class="summary-icon">⭐</span> Yıldız Öğrenci Başarıları
            </div>
            ${starAchievements.map(ev => `
              <div class="summary-row" style="margin-bottom:4px;">
                <span class="summary-row-label" style="font-weight:600;">${ev.description || ''}</span>
                ${(ev.prestigeBonus ?? 0) > 0 ? `<span class="summary-row-value positive">+${ev.prestigeBonus} saygınlık</span>` : ''}
              </div>
            `).join('')}
          </div>
        `;
      })()}

      <!-- Proje Başvuru Sonuçları -->
      ${(() => {
        if (!projApps || projApps.total === 0) return '';
        const accepted = projApps.accepted || [];
        const rejected = projApps.rejected || [];
        return `
          <div class="summary-card" style="grid-column:1/-1;">
            <div class="summary-card-title">
              <span class="summary-icon">📋</span> Bu Dönem Proje Başvuruları
            </div>
            <div class="summary-row" style="margin-bottom:8px;">
              <span class="summary-row-label">Toplam Başvuru</span>
              <span class="summary-row-value">${projApps.total}</span>
            </div>
            <div class="summary-row" style="margin-bottom:8px;">
              <span class="summary-row-label">Kabul</span>
              <span class="summary-row-value positive">${accepted.length}</span>
            </div>
            <div class="summary-row" style="margin-bottom:12px;">
              <span class="summary-row-label">Red</span>
              <span class="summary-row-value negative">${rejected.length}</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;">
              ${accepted.map(a => `
                <div style="display:flex;align-items:flex-start;gap:8px;padding:6px 8px;background:rgba(72,187,120,0.08);border-radius:4px;border-left:3px solid var(--accent-green,#48bb78);">
                  <span style="font-size:13px;">✅</span>
                  <div style="flex:1;min-width:0;">
                    <div style="font-size:12px;font-weight:700;">${a.facultyName}</div>
                    <div style="font-size:12px;color:var(--text-primary);">"${a.projectName}"</div>
                    <div style="font-size:11px;color:var(--text-muted);">${a.callIcon || '📋'} ${a.callType} · ${formatMoney(a.requestedFunding)} · ${a.duration} dönem — <span style="color:var(--accent-green,#48bb78);font-weight:700;">KABUL EDİLDİ</span></div>
                  </div>
                </div>
              `).join('')}
              ${rejected.map(r => `
                <div style="display:flex;align-items:flex-start;gap:8px;padding:6px 8px;background:rgba(229,62,62,0.06);border-radius:4px;border-left:3px solid var(--accent-red,#e53e3e);">
                  <span style="font-size:13px;">❌</span>
                  <div style="flex:1;min-width:0;">
                    <div style="font-size:12px;font-weight:700;">${r.facultyName}</div>
                    <div style="font-size:12px;color:var(--text-primary);">"${r.projectName}"</div>
                    <div style="font-size:11px;color:var(--text-muted);">${r.callIcon || '📋'} ${r.callType} · ${formatMoney(r.requestedFunding)} — <span style="color:var(--accent-red,#e53e3e);font-weight:700;">REDDEDİLDİ</span></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      })()}

    </div>

    <div style="display:flex;justify-content:center;margin-top:8px;">
      <button class="btn btn-primary" id="btn-confirm-next-turn"
              style="padding:10px 40px;font-size:15px;">
        Sonraki Dönem →
      </button>
    </div>
  `;

  overlay.classList.remove('hidden');
  overlay.classList.add('active');

  on(el('btn-confirm-next-turn'), 'click', () => {
    overlay.classList.add('hidden');
    overlay.classList.remove('active');
    if (onNextTurn) onNextTurn();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. OLAY EKRANI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Olay/karar ekranını render et.
 * @param {object}   event        — Olay objesi
 * @param {Function} onChoice     — Seçenek seçme callback (choiceIndex alır)
 * @param {Function} onSkip       — Atlama callback
 */
export function renderEvent(event, onChoice, onSkip) {
  if (!event) return;

  const categoryEl   = el('event-category');
  const titleEl      = el('event-title');
  const descEl       = el('event-description');
  const detailEl     = el('event-details');
  const choicesEl    = el('event-choices');
  const footerInfoEl = el('event-footer-info');

  if (categoryEl) categoryEl.textContent = event.category || 'Olay';
  if (titleEl)    titleEl.textContent    = event.title || 'Başlık';
  if (descEl)     descEl.textContent     = event.description || '';

  if (detailEl) {
    detailEl.innerHTML = event.details
      ? `<div>${event.details}</div>`
      : '';
    detailEl.style.display = event.details ? 'block' : 'none';
  }

  if (choicesEl) {
    const choices = event.choices || [];
    if (choices.length > 0) {
      choicesEl.innerHTML = choices.map((c, i) => `
        <button class="event-choice-btn" data-choice-index="${i}">
          <span class="event-choice-key">${String.fromCharCode(65 + i)}</span>
          <div class="event-choice-content">
            <div class="event-choice-label">${c.label || c.text || 'Seçenek'}</div>
            ${c.description ? `<div class="event-choice-desc">${c.description}</div>` : ''}
            ${c.effects && c.effects.length > 0 ? `
              <div class="event-choice-effects">
                ${c.effects.map(ef => `
                  <span class="effect-tag ${ef.type || 'neu'}">${ef.label}</span>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </button>
      `).join('');
    } else {
      choicesEl.innerHTML = `
        <button class="btn btn-primary" id="btn-event-ok" style="width:100%;justify-content:center;">
          Tamam
        </button>
      `;
      on(el('btn-event-ok'), 'click', () => {
        if (onChoice) onChoice(0);
        showScreen('screen-game');
      });
    }
  }

  if (footerInfoEl && event.turnDeadline) {
    footerInfoEl.textContent = `Karar son tarihi: Tur ${event.turnDeadline}`;
  }

  // Seçenek buton eventleri
  delegate(el('event-choices'), '.event-choice-btn', 'click', (e, btn) => {
    const idx = parseInt(btn.dataset.choiceIndex);
    if (onChoice) onChoice(idx);
    showScreen('screen-game');
  });

  // Atlama
  const skipBtn = el('btn-event-skip');
  if (skipBtn) {
    skipBtn.style.display = event.skippable === false ? 'none' : '';
    on(skipBtn, 'click', () => {
      if (onSkip) onSkip();
      showScreen('screen-game');
    });
  }

  showScreen('screen-event');
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. TOAST BİLDİRİM
// ─────────────────────────────────────────────────────────────────────────────

const NOTIFICATION_ICONS = {
  success: '✓',
  warning: '⚠',
  danger:  '✕',
  info:    'ℹ',
};

/**
 * Toast bildirim göster.
 * @param {string} message  — Bildirim metni
 * @param {string} type     — 'success' | 'warning' | 'danger' | 'info'
 * @param {number} duration — Görünme süresi ms (varsayılan 3500)
 */
export function showNotification(message, type = 'info', duration = 3500) {
  const container = el('toast-container');
  if (!container) return;

  const icon = NOTIFICATION_ICONS[type] || 'ℹ';
  const div  = document.createElement('div');
  div.className = `notification ${type}`;
  div.innerHTML = `
    <span class="notification-icon">${icon}</span>
    <span class="notification-text">${message}</span>
    <button class="notification-close">✕</button>
  `;

  container.appendChild(div);

  // Kapatma butonu
  div.querySelector('.notification-close')?.addEventListener('click', () => _removeToast(div));

  // Otomatik kaldır
  setTimeout(() => _removeToast(div), duration);
}

function _removeToast(div) {
  div.classList.add('fadeout');
  setTimeout(() => div.remove(), 300);
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI UI BİLEŞENLERİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stat çubuğu HTML'i döndür.
 * @param {string}  label     — Etiket metni
 * @param {number}  value     — Değer (0-max)
 * @param {number}  max       — Maksimum değer
 * @param {string}  color     — CSS rengi veya 'auto' (değere göre otomatik)
 * @param {boolean} uncertain — Belirsizlik modu
 * @param {string}  displayVal — Gösterilecek değer (ör. "40-60")
 * @returns {string} HTML string
 */
export function createStatBar(label, value, max = 100, color = 'auto', uncertain = false, displayVal = null) {
  const pct       = Math.min(100, Math.max(0, (value / max) * 100));
  const colorClass = uncertain ? 'uncertain' : (color === 'auto' ? _statColorClass(value) : '');
  const colorStyle = (!uncertain && color !== 'auto') ? `background:${color};` : '';
  const shown      = displayVal !== null ? displayVal : Math.round(value);

  return `
    <div class="stat-bar">
      <div class="stat-bar-label">${label}</div>
      <div class="stat-bar-track">
        <div class="stat-bar-fill ${colorClass}" style="width:${pct}%;${colorStyle}"></div>
      </div>
      <div class="stat-bar-value" style="color:${uncertain ? 'var(--text-muted)' : _statValueColor(value)};">
        ${shown}
      </div>
    </div>
  `;
}

/**
 * Yıldız derecelendirme HTML'i döndür.
 * @param {number} filled — Dolu yıldız sayısı
 * @param {number} total  — Toplam yıldız sayısı
 * @returns {string} HTML string
 */
export function createStarRating(filled, total = 5) {
  let html = '<span class="star-rating">';
  for (let i = 1; i <= total; i++) {
    html += `<span class="star ${i <= filled ? 'filled' : ''}">★</span>`;
  }
  html += '</span>';
  return html;
}

/**
 * Dairesel ilerleme (SVG) HTML'i döndür.
 * @param {number} value   — Değer
 * @param {number} max     — Maksimum değer
 * @param {string} label   — Alt etiket
 * @param {number} size    — SVG boyutu (px)
 * @returns {string} HTML string
 */
export function createProgressRing(value, max = 100, label = '', size = 80) {
  const radius      = (size / 2) - 8;
  const circumf     = 2 * Math.PI * radius;
  const pct         = Math.min(1, Math.max(0, value / max));
  const dashOffset  = circumf * (1 - pct);

  return `
    <div class="progress-ring-wrapper" style="width:${size}px;height:${size}px;">
      <svg class="progress-ring" width="${size}" height="${size}">
        <circle class="progress-ring-track" cx="${size/2}" cy="${size/2}" r="${radius}" stroke-width="6"/>
        <circle class="progress-ring-fill" cx="${size/2}" cy="${size/2}" r="${radius}" stroke-width="6"
                stroke-dasharray="${circumf}" stroke-dashoffset="${dashOffset}"/>
      </svg>
      <div class="progress-ring-label">
        <span class="progress-ring-value">${Math.round(value)}</span>
        ${label ? `<span class="progress-ring-sublabel">${label}</span>` : ''}
      </div>
    </div>
  `;
}

/**
 * Mini sparkline (SVG) HTML'i döndür.
 * @param {number[]} data   — Değer dizisi
 * @param {number}   width  — SVG genişliği
 * @param {number}   height — SVG yüksekliği
 * @param {string}   color  — Çizgi rengi
 * @returns {string} HTML string
 */
export function createSparkline(data, width = 80, height = 28, color = '#4ecca3') {
  if (!data || data.length < 2) return '';

  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const range  = Math.max(1, maxVal - minVal);

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - minVal) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const lastPt = pts.split(' ').pop().split(',');

  return `
    <svg class="sparkline" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <polyline class="sparkline-polyline" points="${pts}" stroke="${color}" style="stroke:${color}"/>
      <circle cx="${parseFloat(lastPt[0])}" cy="${parseFloat(lastPt[1])}" r="2" fill="${color}"/>
    </svg>
  `;
}

/**
 * Basit pasta grafik (SVG) HTML'i döndür.
 * @param {Array<{label,value,color}>} slices — Dilimler
 * @param {number} size — SVG boyutu
 * @returns {string} HTML string
 */
export function createPieChart(slices, size = 120) {
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) return '';

  const cx = size / 2;
  const cy = size / 2;
  const r  = size / 2 - 4;

  let startAngle = -Math.PI / 2;
  const paths = slices.map(sl => {
    const angle = (sl.value / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;

    const path = `M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${largeArc},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z`;
    startAngle = endAngle;

    return `<path d="${path}" fill="${sl.color}" opacity="0.9"/>`;
  }).join('');

  const legend = slices.map(sl => `
    <div class="pie-legend-item">
      <div class="pie-legend-color" style="background:${sl.color}"></div>
      <div class="pie-legend-label">${sl.label}</div>
      <div class="pie-legend-value">${formatPercent(sl.value)}</div>
    </div>
  `).join('');

  return `
    <div class="pie-chart-wrapper">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        ${paths}
        <circle cx="${cx}" cy="${cy}" r="${r * 0.45}" fill="var(--bg-card)"/>
      </svg>
      <div class="pie-legend">${legend}</div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// İÇ YARDIMCILAR (export edilmez)
// ─────────────────────────────────────────────────────────────────────────────

/** Stat değerine göre CSS sınıfı */
function _statColorClass(val) {
  if (val >= 70) return 'high';
  if (val >= 40) return 'mid';
  return 'low';
}

/** Stat değerine göre CSS rengi (doğrudan) */
function _statColor(val) {
  if (val >= 85) return '#d4af37';
  if (val >= 70) return 'var(--stat-high)';
  if (val >= 40) return 'var(--stat-mid)';
  return 'var(--stat-low)';
}

/** Stat değer sayısı için renk */
function _statValueColor(val) {
  if (val >= 85) return '#d4af37';
  if (val >= 70) return 'var(--accent-green)';
  if (val >= 40) return 'var(--accent-yellow)';
  return 'var(--accent)';
}

/** GPA için renk */
function _gpaColor(gpa) {
  if (gpa >= 3.5) return '#d4af37';
  if (gpa >= 3.0) return 'var(--accent-green)';
  if (gpa >= 2.5) return 'var(--accent-yellow)';
  return 'var(--accent-red,#e53e3e)';
}

/** Memnuniyet için renk */
function _satColor(sat) {
  if (sat >= 70) return 'var(--accent-green)';
  if (sat >= 45) return 'var(--accent-yellow)';
  return 'var(--accent)';
}

/** Küçük stat kart HTML'i */
function _statCardHtml(label, value, deltaClass, sub) {
  return `
    <div class="stat-card">
      <div class="stat-card-label">${label}</div>
      <div class="stat-card-value ${deltaClass === 'positive' ? 'text-good' : deltaClass === 'negative' ? 'text-bad' : ''}">
        ${value}
      </div>
      ${sub !== null && sub !== undefined ? `<div class="stat-card-delta neutral">${sub}</div>` : ''}
    </div>
  `;
}

/** Kalite yüzdesini renkli çubuk simgesiyle göster */
function _qualityBar(val) {
  const color = _statColor(val);
  return `<span style="color:${color};font-weight:700;font-size:12px;">${val}</span>`;
}

/** Dönem geliri tahmini (basit) */
function _estimateRevenue(state) {
  const uniType  = state.meta?.universityType || state.university?.type || 'vakif';
  const students = state.students?.totalEnrolled ?? 0;
  const tuition  = state.university?.tuitionPerSemester ?? 40_000;
  const researchRevenue = ((state.research?.activeResearchProjects?.length ?? 0) + (state.research?.activeProjects?.length ?? 0)) * 500_000;
  const donationRevenue = (state.alumni?.length ?? 0) * 5_000;

  if (uniType === 'devlet') {
    const yokModel  = UNIVERSITY_MODELS.devlet.revenueStreams.yokTahsisi;
    const yokIncome = yokModel.base
      + students * yokModel.perStudent
      + (state.faculty?.length ?? 0) * yokModel.perFaculty;
    const katkiPayi = students * (UNIVERSITY_MODELS.devlet.revenueStreams.ogrenciKatkiPayi?.perStudent ?? 2_000);
    const donerEst  = UNIVERSITY_MODELS.devlet.revenueStreams.donerSermaye.base;
    return Math.round(yokIncome + katkiPayi + researchRevenue * 0.8 + donerEst + donationRevenue);
  }

  if (uniType === 'us_private') {
    const aidRate    = state.university?.financialAidRate ?? 0.45;
    const tuitionNet = students * tuition * (1 - aidRate);
    const endowReturn = (state.university?.endowment ?? UNIVERSITY_MODELS.us_private.revenueStreams.endowment.base)
      * UNIVERSITY_MODELS.us_private.revenueStreams.endowment.returnRate / 2;
    const alumniEst  = UNIVERSITY_MODELS.us_private.revenueStreams.alumniDonations.base;
    return Math.round(tuitionNet + endowReturn + researchRevenue * 1.2 + alumniEst);
  }

  // Vakıf: bölüm bazlı harç tahmini
  const byDeptEst   = state.students?.byDepartment || {};
  let payingApprox  = 0;
  for (const d of Object.values(byDeptEst)) {
    for (const yr of [d?.year1, d?.year2, d?.year3, d?.year4]) {
      if (yr) {
        payingApprox += (yr.yariBurslu || 0) * 0.5 + (yr.ucretli || 0);
      }
    }
  }
  const tuitionRevenue = payingApprox > 0 ? payingApprox * tuition : students * tuition * 0.7;
  const vakifKatkisi   = UNIVERSITY_MODELS.vakif.revenueStreams.vakifKatkisi.base;
  return Math.round(tuitionRevenue + vakifKatkisi + researchRevenue + donationRevenue);
}

/** Bütçe sekmesi — Hoca maaş gideri (akademik, dönemlik) */
function _budgetFacultyPayroll(state) {
  return Math.round((state.faculty || []).reduce((s, f) => s + (f.salary ?? 0), 0) * SEMESTER_MONTHS);
}

/** Bütçe sekmesi — Araştırma yatırım gideri (hoca başı fon × hoca sayısı) */
function _budgetResearchCost(state) {
  const perFac = state.researchBudgetPerFaculty ?? 50000;
  const facCount = (state.faculty || []).length;
  return Math.round(perFac * facCount);
}

/** Bütçe sekmesi — Burs gideri tahmini (yeni kontenjan sistemine göre) */
function _budgetScholarshipCost(state) {
  const baseTuition  = state.university?.tuitionPerSemester ?? 65_000;
  const byDeptBurs   = state.students?.byDepartment || {};
  const depts        = state.departments || [];
  const uniType      = state.meta?.universityType || 'vakif';

  // Devlet modelinde harç olmadığından üniversiteye burs maliyeti yoktur
  if (uniType === 'devlet') return 0;

  // ABD modelinde financial aid = tuition × aid_rate × enrolled (net revenue hesabında zaten düşülür)
  if (uniType === 'us_private') {
    const aidRate  = state.university?.financialAidRate ?? 0.45;
    const enrolled = state.students?.totalEnrolled ?? 0;
    return Math.round(enrolled * baseTuition * aidRate);
  }

  let cost = 0;
  for (const dept of depts) {
    if (!dept.isOpen) continue;
    const d    = byDeptBurs[dept.id];
    if (!d) continue;
    const mult = dept.tuitionMultiplier || 1.0;
    for (const yr of [d.year1, d.year2, d.year3, d.year4]) {
      if (!yr || !yr.count) continue;
      cost += (yr.tamBurslu  || 0) * baseTuition * mult;
      cost += (yr.yariBurslu || 0) * baseTuition * mult * 0.50;
    }
  }
  return Math.round(cost);
}

/** Bütçe sekmesi — Bina bakım gideri */
function _budgetMaintenance(state) {
  const buildingCost = (state.buildings || []).filter(b => b.isCompleted).reduce((s, b) => {
    const template = BUILDINGS[b.type];
    if (!template) return s;
    if (template.maintenanceCostPerM2 != null && b.area) {
      return s + b.area * template.maintenanceCostPerM2;
    } else if (b.maintenanceCost) {
      return s + b.maintenanceCost;
    }
    const cost  = template.constructionCost || template.baseCost || 0;
    const ratio = template.maintenanceCostRatio || 0.05;
    return s + (cost * ratio) / 2;
  }, 0);
  const deptCost = (state.departments || []).filter(d => d.isOpen).reduce((s, d) => s + (d.annualOperatingCost || 0) / 2, 0);
  return Math.round(buildingCost + deptCost);
}

/** Bütçe sekmesi — İdari giderler */
function _budgetAdmin(state) {
  return Math.round(Object.values(state.admin?.units ?? {}).reduce((s, u) => s + (u.budget || 0), 0));
}

/** Bütçe sekmesi — Genel giderler (enerji, su, vb.) */
function _budgetOverhead(state) {
  const OVERHEAD_PER_STUDENT = 3500;
  const OVERHEAD_FIXED       = 1500000;
  return Math.round(OVERHEAD_FIXED + (state.students?.totalEnrolled ?? 0) * OVERHEAD_PER_STUDENT);
}

/** Dönem maliyeti tahmini (basit) */
function _estimateCosts(state) {
  const faculty = state.faculty || [];
  const salaryCost = faculty.reduce((s, f) => s + (f.salary ?? 0), 0) * SEMESTER_MONTHS;
  // Alan bazlı bina bakım maliyeti
  const buildingCost = (state.buildings || []).filter(b => b.isCompleted).reduce((s, b) => {
    const template = BUILDINGS[b.type];
    if (!template) return s;
    if (template.maintenanceCostPerM2 != null && b.area) {
      return s + b.area * template.maintenanceCostPerM2;
    } else if (b.maintenanceCost) {
      return s + b.maintenanceCost;
    }
    const cost  = template.constructionCost || template.baseCost || 0;
    const ratio = template.maintenanceCostRatio || 0.05;
    return s + (cost * ratio) / 2;
  }, 0);
  const adminCost = Object.values(state.admin?.units ?? {}).reduce((s, u) => s + u.budget, 0);
  return Math.round(salaryCost + buildingCost + adminCost);
}

/**
 * Bütçe paneli — üniversite modeline göre gelir satırlarını oluştur.
 * @param {object} state   — Oyun state'i
 * @param {number} revenue — Toplam tahmini gelir (dağılım için)
 * @returns {string} HTML satırları
 */
function _revenueLineItems(state, revenue, incomeDetail) {
  // Dönem özeti ile tutarlılık için calculateIncome detayını kullan
  if (incomeDetail) {
    const uniType2 = state.meta?.universityType || state.university?.type || 'vakif';
    const projOverheadRow = (incomeDetail.projectOverhead || 0) > 0
      ? `<tr><td>Proje Genel Gider Kesintisi</td><td class="text-right text-good">${formatMoney(incomeDetail.projectOverhead || 0)}</td></tr>`
      : '';
    const patentRoyRow = (incomeDetail.patentRoyalties || 0) > 0
      ? `<tr><td>Patent Telif Gelirleri</td><td class="text-right text-good">${formatMoney(incomeDetail.patentRoyalties || 0)}</td></tr>`
      : '';
    if (uniType2 === 'devlet') {
      return `
        <tr><td>YÖK Bütçe Tahsisi + Katkı Payı</td><td class="text-right text-good">${formatMoney((incomeDetail.stateGrant || 0) + (incomeDetail.tuition || 0))}</td></tr>
        <tr><td>Araştırma Fonları</td><td class="text-right text-good">${formatMoney(incomeDetail.researchFunds || 0)}</td></tr>
        ${projOverheadRow}
        ${patentRoyRow}
        <tr><td>Döner Sermaye</td><td class="text-right text-good">${formatMoney(incomeDetail.revolving || 0)}</td></tr>
        <tr><td>Bağışlar</td><td class="text-right text-good">${formatMoney(incomeDetail.donations || 0)}</td></tr>
        <tr><td>Sponsorluk & Diğer</td><td class="text-right text-good">${formatMoney((incomeDetail.sponsorship || 0) + (incomeDetail.patents || 0))}</td></tr>
      `;
    }
    if (uniType2 === 'us_private') {
      return `
        <tr><td>Tuition & Fees</td><td class="text-right text-good">${formatMoney(incomeDetail.tuition || 0)}</td></tr>
        <tr><td>Endowment Getirileri</td><td class="text-right text-good">${formatMoney(incomeDetail.stateGrant || 0)}</td></tr>
        <tr><td>Araştırma Hibeleri</td><td class="text-right text-good">${formatMoney(incomeDetail.researchFunds || 0)}</td></tr>
        <tr><td>Mezun Bağışları</td><td class="text-right text-good">${formatMoney(incomeDetail.donations || 0)}</td></tr>
        <tr><td>Spor & Lisanslama</td><td class="text-right text-good">${formatMoney(incomeDetail.revolving || 0)}</td></tr>
      `;
    }
    // Vakıf
    return `
      <tr><td>Öğrenci Ücretleri</td><td class="text-right text-good">${formatMoney(incomeDetail.tuition || 0)}</td></tr>
      <tr><td>Vakıf Katkısı</td><td class="text-right text-good">${formatMoney(incomeDetail.stateGrant || 0)}</td></tr>
      <tr><td>Araştırma Fonları</td><td class="text-right text-good">${formatMoney(incomeDetail.researchFunds || 0)}</td></tr>
      ${projOverheadRow}
      ${patentRoyRow}
      <tr><td>Döner Sermaye</td><td class="text-right text-good">${formatMoney(incomeDetail.revolving || 0)}</td></tr>
      <tr><td>Bağış & Sponsorluk</td><td class="text-right text-good">${formatMoney((incomeDetail.donations || 0) + (incomeDetail.sponsorship || 0) + (incomeDetail.patents || 0))}</td></tr>
    `;
  }

  // Fallback (incomeDetail yoksa eski tahmin mantığı)
  const uniType = state.meta?.universityType || state.university?.type || 'vakif';
  const students = state.students?.totalEnrolled ?? 0;
  const researchRevenue = ((state.research?.activeResearchProjects?.length ?? 0) + (state.research?.activeProjects?.length ?? 0)) * 500_000;
  const donationRevenue = (state.alumni?.length ?? 0) * 5_000;
  if (uniType === 'devlet') {
    const yokModel = UNIVERSITY_MODELS.devlet.revenueStreams.yokTahsisi;
    const yokBase  = yokModel.base + students * yokModel.perStudent + (state.faculty?.length ?? 0) * yokModel.perFaculty;
    const katkiPayi = students * (UNIVERSITY_MODELS.devlet.revenueStreams.ogrenciKatkiPayi?.perStudent ?? 2_000);
    return `
      <tr><td>YÖK Bütçe Tahsisi</td><td class="text-right text-good">${formatMoney(yokBase)}</td></tr>
      <tr><td>TÜBİTAK / BAP Fonları</td><td class="text-right text-good">${formatMoney(researchRevenue * 0.8)}</td></tr>
      <tr><td>Döner Sermaye</td><td class="text-right text-good">${formatMoney(UNIVERSITY_MODELS.devlet.revenueStreams.donerSermaye.base)}</td></tr>
      <tr><td>Öğrenci Katkı Payı</td><td class="text-right text-good">${formatMoney(katkiPayi)}</td></tr>
    `;
  }
  return `
    <tr><td>Öğrenci Ücretleri</td><td class="text-right text-good">${formatMoney(revenue * 0.6)}</td></tr>
    <tr><td>Araştırma & Diğer</td><td class="text-right text-good">${formatMoney(revenue * 0.4)}</td></tr>
  `;
}

/** Oyun durumuna göre uyarılar listesi */
function _getWarnings(state) {
  const warnings = [];
  const uni = state.university || {};
  const faculty = state.faculty || [];

  if (uni.budget < 0) {
    warnings.push({ type: 'danger', icon: '🚨', message: 'Bütçe negatife düştü! Acil önlem alın.' });
  }

  const unhappyCount = faculty.filter(f => (f.happiness ?? 60) < 40).length;
  if (unhappyCount > 0) {
    warnings.push({ type: 'warning', icon: '⚠', message: `${unhappyCount} hoca mutsuz. Transfer riski var.` });
  }

  if (uni.prestige < 20) {
    warnings.push({ type: 'warning', icon: '📉', message: 'Saygınlık çok düşük. Öğrenci talebi azalıyor.' });
  }

  const pendingEvents = state.events?.history?.filter(e => e.autoDecideTurn === state.meta?.turn) || [];
  if (pendingEvents.length > 0) {
    warnings.push({ type: 'info', icon: '📬', message: `${pendingEvents.length} bekleyen karar var.` });
  }

  // Karşılanmayan dersler uyarısı
  const totalUncovered = (state.departments || []).reduce((s, d) => s + (d.uncoveredCourses?.length || 0), 0);
  if (totalUncovered > 0) {
    warnings.push({ type: 'warning', icon: '📚', message: `${totalUncovered} ders için yeterli hoca yok. Dışarıdan öğretim görevlisi gerekiyor.` });
  }

  // Uzmanlık eşleşmesi düşük uyarısı
  const lowMatchDepts = (state.departments || []).filter(d => {
    const assignments = d.courseAssignments || [];
    if (assignments.length === 0) return false;
    const fullMatchCount = assignments.filter(a => a.matchQuality === 2).length;
    return (fullMatchCount / assignments.length) < 0.5;
  });
  if (lowMatchDepts.length > 0) {
    warnings.push({ type: 'warning', icon: '🎯', message: `${lowMatchDepts.length} bölümde hoca-ders uzmanlık eşleşmesi düşük. Öğrenci memnuniyeti etkileniyor.` });
  }

  return warnings;
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature 2: Yeni Bölüm / Program Başvurusu Modalı
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Yeni bölüm veya lisansüstü program başvurusu için modal gösterir.
 * @param {object} state — Oyun durumu
 */
export function showNewDeptProgramModal(state) {
  const depts   = state.departments || [];
  const faculty = state.faculty     || [];
  const budget  = state.university?.budget || 0;

  // Mevcut bölüm ID'leri
  const openDeptIds = new Set(depts.map(d => d.id));

  // Açılabilecek yeni bölümler
  const availableNewDepts = AVAILABLE_NEW_DEPARTMENTS.filter(d => !openDeptIds.has(d.id));

  // YL/Doktora için uygun bölümler
  const ylEligible  = depts.filter(d => {
    const df = faculty.filter(f => (f.department || f.departmentId) === d.id);
    const drPlus = df.filter(f => ['dr_ogr_uyesi','docent','profesor'].includes(f.title)).length;
    return drPlus >= 3 && !d.programs?.yuksek_lisans?.active;
  });
  const phdEligible = depts.filter(d => {
    const df = faculty.filter(f => (f.department || f.departmentId) === d.id);
    const profCount = df.filter(f => f.title === 'profesor').length;
    return profCount >= 2 && !d.programs?.doktora?.active;
  });

  // Bekleyen başvurular
  const pending = state.pendingApplications || [];

  const bodyHtml = `
    <div style="font-size:13px;">
      <!-- Bütçe bilgisi -->
      <div style="background:var(--bg-secondary);border-radius:8px;padding:10px 14px;margin-bottom:16px;display:flex;align-items:center;gap:12px;">
        <span style="font-size:22px;">💰</span>
        <div>
          <div style="font-size:11px;color:var(--text-muted);">Mevcut Kasa</div>
          <div style="font-size:16px;font-weight:700;color:${budget > 5_000_000 ? '#38a169' : '#f5a623'};">${formatMoney(budget)}</div>
        </div>
      </div>

      ${pending.length > 0 ? `
        <div style="margin-bottom:16px;">
          <div style="font-size:12px;font-weight:700;color:#f5a623;margin-bottom:8px;">⏳ Bekleyen Başvurular (${pending.length})</div>
          ${pending.map(a => `
            <div style="background:rgba(245,166,35,0.08);border:1px solid rgba(245,166,35,0.3);border-radius:6px;padding:8px 12px;margin-bottom:6px;font-size:11px;display:flex;justify-content:space-between;align-items:center;">
              <span><strong>${a.name || a.deptId}</strong> — ${a.type === 'yeni_bolum' ? 'Yeni Bölüm' : a.type === 'yuksek_lisans' ? 'YL Programı' : 'Doktora Programı'}</span>
              <span style="color:#f5a623;font-weight:700;">${a.turnsRemaining} dönem kaldı</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- Seçenek sekmeleri -->
      <div style="display:flex;gap:8px;margin-bottom:16px;border-bottom:2px solid var(--border);padding-bottom:8px;">
        <button class="ndp-tab-btn btn btn-secondary" data-tab="lisans" style="font-size:11px;padding:5px 12px;"
                id="ndp-tab-lisans">Yeni Lisans Bölümü</button>
        <button class="ndp-tab-btn btn btn-secondary" data-tab="yl" style="font-size:11px;padding:5px 12px;"
                id="ndp-tab-yl">Yüksek Lisans</button>
        <button class="ndp-tab-btn btn btn-secondary" data-tab="phd" style="font-size:11px;padding:5px 12px;"
                id="ndp-tab-phd">Doktora</button>
      </div>

      <!-- Lisans bölümü seçimi -->
      <div id="ndp-panel-lisans">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">Açılabilecek yeni bölümler:</div>
        <div style="max-height:240px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;">
          ${availableNewDepts.length === 0
            ? '<div style="color:var(--text-faint);font-size:12px;padding:8px;">Tüm mevcut bölümler zaten açık.</div>'
            : availableNewDepts.map(d => {
                const canAfford = budget >= d.cost;
                return `
                <div style="background:var(--bg-secondary);border-radius:8px;border:1px solid var(--border);padding:10px 12px;
                            ${canAfford ? 'cursor:pointer;' : 'opacity:0.5;'}
                            display:flex;align-items:center;gap:10px;"
                     class="ndp-dept-row${canAfford ? '' : ' ndp-cant-afford'}"
                     data-dept-id="${d.id}" data-cost="${d.cost}">
                  <span style="font-size:20px;">${d.icon || '🏫'}</span>
                  <div style="flex:1;">
                    <div style="font-size:13px;font-weight:700;">${d.name}</div>
                    <div style="font-size:10px;color:var(--text-muted);">
                      Min. ${d.minFaculty} öğretim üyesi · Maliyet: ${formatMoney(d.cost)}
                    </div>
                  </div>
                  ${canAfford
                    ? `<button class="btn btn-primary" style="font-size:10px;padding:4px 10px;" data-apply-dept="${d.id}">Başvur</button>`
                    : `<span style="font-size:10px;color:#e53e3e;">Yetersiz bütçe</span>`
                  }
                </div>`;
            }).join('')
          }
        </div>
      </div>

      <!-- YL programı -->
      <div id="ndp-panel-yl" style="display:none;">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">
          Gereksinim: 3+ Dr.Öğr.Üyesi, YÖK onay süresi: 1-2 dönem, Maliyet: ${formatMoney(200_000)}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;max-height:240px;overflow-y:auto;">
          ${ylEligible.length === 0
            ? '<div style="color:var(--text-faint);font-size:12px;padding:8px;">YL programı açabilecek uygun bölüm yok (3+ Dr.Öğr.Üyesi gerekli).</div>'
            : ylEligible.map(d => `
              <div style="background:var(--bg-secondary);border-radius:8px;border:1px solid var(--border);
                          padding:10px 12px;display:flex;align-items:center;gap:10px;">
                <span style="font-size:20px;">${d.icon || '🏫'}</span>
                <div style="flex:1;">
                  <div style="font-size:13px;font-weight:700;">${d.name}</div>
                  <div style="font-size:10px;color:var(--text-muted);">
                    Kontenjan: <input type="number" id="yl-quota-${d.id}" min="5" max="30" value="10"
                      style="width:50px;padding:2px 4px;border:1px solid var(--border);border-radius:4px;background:var(--bg-tertiary);color:inherit;font-size:10px;"> öğrenci/yıl
                  </div>
                </div>
                <button class="btn btn-primary" style="font-size:10px;padding:4px 10px;"
                        data-apply-yl="${d.id}">Başvur</button>
              </div>
            `).join('')
          }
        </div>
      </div>

      <!-- Doktora programı -->
      <div id="ndp-panel-phd" style="display:none;">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">
          Gereksinim: 2+ Profesör, YÖK onay süresi: 1-2 dönem, Maliyet: ${formatMoney(500_000)}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;max-height:240px;overflow-y:auto;">
          ${phdEligible.length === 0
            ? '<div style="color:var(--text-faint);font-size:12px;padding:8px;">Doktora programı açabilecek uygun bölüm yok (2+ Profesör gerekli).</div>'
            : phdEligible.map(d => `
              <div style="background:var(--bg-secondary);border-radius:8px;border:1px solid var(--border);
                          padding:10px 12px;display:flex;align-items:center;gap:10px;">
                <span style="font-size:20px;">${d.icon || '🏫'}</span>
                <div style="flex:1;">
                  <div style="font-size:13px;font-weight:700;">${d.name}</div>
                  <div style="font-size:10px;color:var(--text-muted);">
                    Kontenjan: <input type="number" id="phd-quota-${d.id}" min="2" max="15" value="5"
                      style="width:50px;padding:2px 4px;border:1px solid var(--border);border-radius:4px;background:var(--bg-tertiary);color:inherit;font-size:10px;"> öğrenci/yıl
                  </div>
                </div>
                <button class="btn btn-primary" style="font-size:10px;padding:4px 10px;"
                        data-apply-phd="${d.id}">Başvur</button>
              </div>
            `).join('')
          }
        </div>
      </div>
    </div>
  `;

  showModal('Yeni Bölüm / Program Başvurusu', bodyHtml, { wide: true });

  // Sekme değiştirme
  const panels = { lisans: 'ndp-panel-lisans', yl: 'ndp-panel-yl', phd: 'ndp-panel-phd' };
  qsa('.ndp-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      qsa('.ndp-tab-btn').forEach(b => b.classList.remove('btn-primary'));
      btn.classList.add('btn-primary');
      Object.values(panels).forEach(pid => {
        const p = el(pid);
        if (p) p.style.display = 'none';
      });
      const activePanel = el(panels[btn.dataset.tab]);
      if (activePanel) activePanel.style.display = 'block';
    });
  });

  // Varsayılan: lisans sekmesi aktif
  const firstTab = el('ndp-tab-lisans');
  if (firstTab) firstTab.classList.add('btn-primary');

  // Yeni bölüm başvur butonları
  qsa('[data-apply-dept]').forEach(btn => {
    btn.addEventListener('click', () => {
      const deptId = btn.dataset.applyDept;
      document.dispatchEvent(new CustomEvent('apply-new-dept', { detail: { type: 'yeni_bolum', deptId } }));
    });
  });

  // YL başvur butonları
  qsa('[data-apply-yl]').forEach(btn => {
    btn.addEventListener('click', () => {
      const deptId = btn.dataset.applyYl;
      const quota  = parseInt(el(`yl-quota-${deptId}`)?.value || '10');
      document.dispatchEvent(new CustomEvent('apply-new-dept', {
        detail: { type: 'yuksek_lisans', deptId, requestedQuota: quota }
      }));
    });
  });

  // Doktora başvur butonları
  qsa('[data-apply-phd]').forEach(btn => {
    btn.addEventListener('click', () => {
      const deptId = btn.dataset.applyPhd;
      const quota  = parseInt(el(`phd-quota-${deptId}`)?.value || '5');
      document.dispatchEvent(new CustomEvent('apply-new-dept', {
        detail: { type: 'doktora', deptId, requestedQuota: quota }
      }));
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature 1: Lisansüstü Program Paneli (Bölümler sekmesine ek)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bölümün lisansüstü program kartı HTML'ini üretir.
 * @param {object} dept    — Bölüm objesi
 * @param {object} state   — Oyun durumu
 * @returns {string} HTML
 */
export function renderGradProgramCard(dept, state) {
  const programs  = dept.programs;
  if (!programs) return '';

  const faculty   = state.faculty || [];
  const deptFaculty = faculty.filter(f => (f.department || f.departmentId) === dept.id);
  const drPlus    = deptFaculty.filter(f => ['dr_ogr_uyesi','docent','profesor'].includes(f.title)).length;
  const profCount = deptFaculty.filter(f => f.title === 'profesor').length;
  const advisorCapYL  = drPlus * 5;
  const advisorCapPhD = deptFaculty.filter(f => ['docent','profesor'].includes(f.title)).length * 3;

  const yl  = programs.yuksek_lisans;
  const phd = programs.doktora;

  if (!yl?.active && !phd?.active) return '';

  const ylStudents  = yl?.active  ? (yl.students.year1.count  || 0) + (yl.students.year2.count  || 0) : 0;
  const phdStudents = phd?.active ? (
    (phd.students.year1?.count || 0) + (phd.students.year2?.count || 0) +
    (phd.students.year3?.count || 0) + (phd.students.year4?.count || 0)
  ) : 0;

  return `
    <div style="margin-top:12px;padding:10px 14px;background:rgba(128,90,213,0.06);
                border:1px solid rgba(128,90,213,0.2);border-radius:8px;">
      <div style="font-size:11px;font-weight:700;color:#805ad5;text-transform:uppercase;
                  letter-spacing:.05em;margin-bottom:8px;">Lisansüstü Programlar</div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;">

        ${yl?.active ? `
          <div style="flex:1;min-width:140px;">
            <div style="font-size:12px;font-weight:700;margin-bottom:4px;">Yüksek Lisans</div>
            <div style="font-size:11px;color:var(--text-muted);">
              Öğrenci: <strong>${ylStudents}</strong> / ${yl.quota}<br>
              1. yıl: ${yl.students.year1.count || 0} · 2. yıl: ${yl.students.year2.count || 0}<br>
              Tez aşaması: ${yl.thesisStudents || 0}<br>
              Toplam mezun: ${yl.graduatedTotal || 0}<br>
              Burs/dönem: ${formatMoney((ylStudents * (yl.stipendPerStudent || 8000)))}
            </div>
          </div>
        ` : ''}

        ${phd?.active ? `
          <div style="flex:1;min-width:140px;">
            <div style="font-size:12px;font-weight:700;margin-bottom:4px;">Doktora</div>
            <div style="font-size:11px;color:var(--text-muted);">
              Öğrenci: <strong>${phdStudents}</strong> / ${phd.quota}<br>
              Tez aşaması: ${phd.dissertationStudents || 0}<br>
              Toplam mezun: ${phd.graduatedTotal || 0}<br>
              Burs/dönem: ${formatMoney((phdStudents * (phd.stipendPerStudent || 12000)))}
            </div>
          </div>
        ` : ''}

      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature 3: Fakülte Bölümü Ortalama Rating
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bir bölümdeki hocaların ortalama genel puanını hesaplar.
 * @param {string}   deptId  — Bölüm ID
 * @param {object[]} faculty — Tüm hocalar
 * @returns {number} 0-100 arası ortalama puan
 */
export function getDeptAvgRating(deptId, faculty) {
  const deptFaculty = faculty.filter(f => (f.department || f.departmentId) === deptId);
  if (deptFaculty.length === 0) return 0;
  const sum = deptFaculty.reduce((s, f) => s + (f.overallRating || calculateOverallRating(f)), 0);
  return Math.round(sum / deptFaculty.length);
}

// ─────────────────────────────────────────────────────────────────────────────
// İDARİ BİRİMLER PANELİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * İdari birimler sekmesini render eder.
 * @param {object}   state          — Oyun state'i
 * @param {Function} onHireAdmin    — Personel al callback (unitId, title)
 * @param {Function} onUpgradeUnit  — Birim yükselt callback (unitId)
 */
export function renderAdminPanel(state, onHireAdmin, onUpgradeUnit) {
  const panel = el('tab-admin');
  if (!panel) return;

  const adminUnits = state.adminUnits || {};
  const adminStaff = state.adminStaff || [];

  // Özet istatistikler
  const totalStaff  = adminStaff.length;
  const totalNeeded = Object.values(adminUnits).reduce((s, u) => s + (u.staffNeeded || 0), 0);
  const totalSalary = adminStaff.reduce((s, m) => s + (m.salary || 0), 0);
  const avgQuality  = totalStaff > 0
    ? Math.round(adminStaff.reduce((s, m) => s + (m.quality || 0), 0) / totalStaff)
    : 0;

  const staffPct    = totalNeeded > 0 ? Math.round(totalStaff / totalNeeded * 100) : 100;
  const staffStatus = staffPct >= 90 ? '✅' : staffPct >= 70 ? '⚠️' : '🔴';

  // Genel kalite için renk hesapla (faculty kart stiliyle aynı)
  function _adminRatingColor(q) {
    if (q >= 85) return '#d4af37';
    if (q >= 70) return '#38a169';
    if (q >= 55) return '#f5a623';
    return '#e53e3e';
  }
  function _adminRatingBg(q) {
    if (q >= 85) return 'rgba(212,175,55,0.12)';
    if (q >= 70) return 'rgba(56,161,105,0.12)';
    if (q >= 55) return 'rgba(245,166,35,0.12)';
    return 'rgba(229,62,62,0.12)';
  }

  // Harf kısaltması (avatar için)
  function _initials(name) {
    return (name || '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  // Unvan listesi (terfi için)
  const TITLE_ORDER = ['Memur', 'Uzman', 'Şef', 'Müdür Yrd.', 'Müdür'];

  function _nextTitle(title) {
    const idx = TITLE_ORDER.indexOf(title);
    return (idx >= 0 && idx < TITLE_ORDER.length - 1) ? TITLE_ORDER[idx + 1] : null;
  }

  // Admin personel kartı (faculty-card stiliyle)
  function _adminStaffCard(m) {
    const quality        = m.quality || 0;
    const ratingColor    = _adminRatingColor(quality);
    const ratingBg       = _adminRatingBg(quality);
    const titleRange     = ADMIN_TITLES[m.title] || { min: 14_000, max: 25_000 };
    const nextTitleName  = _nextTitle(m.title);
    const expYears       = Math.round((m.totalExperience || m.experience || 0) * 2) / 2;
    const happiness      = m.happiness ?? 60;
    const happClass      = happiness >= 70 ? 'high' : happiness >= 45 ? 'mid' : 'low';
    const initials       = _initials(m.name);

    const statDefs = [
      { key: 'efficiency',    label: 'Verimlilik' },
      { key: 'communication', label: 'İletişim'   },
      { key: 'leadership',    label: 'Liderlik'   },
      { key: 'techSkills',    label: 'Teknik'     },
    ];

    return `
      <div class="faculty-card admin-staff-card" data-admin-staff-id="${m.id}" style="cursor:pointer;">
        <div class="faculty-card-header">
          <div style="flex-shrink:0;">
            <div class="faculty-avatar admin-avatar">${initials}</div>
          </div>
          <div class="faculty-card-info" style="flex:1;min-width:0;">
            <div class="faculty-name">${m.name || 'İsimsiz'}</div>
            <div class="faculty-meta">
              <span class="badge badge-default">${m.title || '—'}</span>
              <span class="faculty-dept">${m.unit || '—'}</span>
            </div>
            <div class="faculty-meta" style="margin-top:3px;">
              <span class="faculty-age">${expYears} yıl deneyim</span>
            </div>
          </div>
          <div style="text-align:center;padding:4px 8px;border-radius:8px;background:${ratingBg};flex-shrink:0;">
            <div style="font-size:18px;font-weight:800;color:${ratingColor};line-height:1;">${quality}</div>
            <div style="font-size:9px;color:var(--text-muted);">Puan</div>
          </div>
        </div>

        <div class="faculty-card-stats">
          ${statDefs.map(s => createStatBar(s.label, m[s.key] || 0, 100, _statColor(m[s.key] || 0))).join('')}
        </div>

        ${(m.promotionEligible && nextTitleName) ? `
        <div style="padding:4px 12px;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;gap:4px;">
          <span style="font-size:10px;padding:2px 6px;border-radius:6px;background:rgba(56,161,105,0.12);color:#38a169;border:1px solid rgba(56,161,105,0.3);">⭐ Terfi Uygun! → ${nextTitleName}</span>
        </div>
        ` : ''}

        <div class="faculty-card-footer">
          <div style="font-size:11px;color:var(--text-muted);flex:1;">
            <span>Mutluluk: </span>
            <span class="happiness-dot ${happClass}" style="display:inline-block;vertical-align:middle;"></span>
            <strong>${happiness}/100</strong>
          </div>
          <div style="font-size:11px;color:var(--text-muted);">
            Maaş: <strong>${formatMoney(m.salary)}/ay</strong>
          </div>
        </div>

        <div style="padding:6px 12px 10px;display:flex;gap:5px;flex-wrap:wrap;border-top:1px solid var(--border);">
          ${m.promotionEligible && nextTitleName
            ? `<button class="btn btn-sm btn-primary" style="font-size:10px;"
                 onclick="event.stopPropagation();window._onPromoteAdminStaff('${m.id}')">⬆️ Terfi</button>`
            : ''}
          <button class="btn btn-sm btn-secondary" style="font-size:10px;"
            onclick="event.stopPropagation();window._onAdjustAdminSalary('${m.id}')">💰 Maaş</button>
          <button class="btn btn-sm btn-danger" style="font-size:10px;"
            onclick="event.stopPropagation();window._onFireAdminStaff('${m.id}')">🔥 Feshet</button>
        </div>
      </div>
    `;
  }

  // Admin personel liste satırı
  function _adminStaffListRow(m, idx) {
    const quality       = m.quality || 0;
    const ratingColor   = _adminRatingColor(quality);
    const nextTitleName = _nextTitle(m.title);
    const expYears      = Math.round((m.totalExperience || m.experience || 0) * 2) / 2;
    const statusText    = m.promotionEligible && nextTitleName ? 'Terfi Hak.' : '—';
    const statusColor   = m.promotionEligible ? '#f5a623' : 'var(--text-muted)';
    return `
      <tr class="admin-staff-list-row" data-admin-staff-id="${m.id}"
        style="border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s;"
        onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background=''">
        <td style="padding:5px 8px;color:var(--text-muted);">${idx + 1}</td>
        <td style="padding:5px 8px;font-weight:600;">${m.name || '—'}</td>
        <td style="padding:5px 8px;color:var(--text-muted);">${m.title || '—'}</td>
        <td style="padding:5px 8px;color:var(--text-muted);font-size:11px;">${m.unit || '—'}</td>
        <td style="padding:5px 8px;font-weight:700;color:${ratingColor};">${quality}</td>
        <td style="padding:5px 8px;color:${_adminRatingColor(m.efficiency || 0)};">${m.efficiency || 0}</td>
        <td style="padding:5px 8px;color:${_adminRatingColor(m.communication || 0)};">${m.communication || 0}</td>
        <td style="padding:5px 8px;color:${_adminRatingColor(m.leadership || 0)};">${m.leadership || 0}</td>
        <td style="padding:5px 8px;color:${_adminRatingColor(m.techSkills || 0)};">${m.techSkills || 0}</td>
        <td style="padding:5px 8px;white-space:nowrap;">${formatMoney(m.salary)}/ay</td>
        <td style="padding:5px 8px;">${expYears} yıl</td>
        <td style="padding:5px 8px;font-size:11px;color:${statusColor};">${statusText}</td>
      </tr>
    `;
  }

  // Birim kartlarını oluştur (kart/liste toggle ile)
  const unitCards = Object.values(ADMIN_UNITS).map(template => {
    const unit       = adminUnits[template.id] || { level: 1, staffCount: 0, staffNeeded: template.baseStaffNeeded, staffQuality: 0, satisfaction: 30 };
    const unitStaff  = adminStaff.filter(m => m.unit === template.id);
    const staffStatus2 = unit.staffCount >= unit.staffNeeded ? '✅' : unit.staffCount >= unit.staffNeeded * 0.7 ? '⚠️' : '🔴';
    const eksik      = Math.max(0, unit.staffNeeded - unit.staffCount);
    const perf       = unit.satisfaction || 30;
    const unitId     = template.id;

    // Yükseltme butonu
    const nextLevel     = unit.level + 1;
    const canUpgrade    = nextLevel <= template.maxLevel;
    const upgradeCost   = canUpgrade ? template.upgradeCost[unit.level] : 0;
    const nextLevelDesc = canUpgrade ? (template.levelBonuses[nextLevel]?.description || '') : '';
    const levelStars    = '★'.repeat(unit.level) + '☆'.repeat(template.maxLevel - unit.level);

    const upgradeBtn = canUpgrade
      ? `<button class="btn btn-sm btn-primary" style="font-size:11px;"
           onclick="window._onUpgradeAdminUnit('${unitId}')"
           title="${nextLevelDesc}">
           ⬆️ Düzey ${nextLevel} (${formatMoney(upgradeCost)})
         </button>`
      : `<span style="color:var(--color-success);font-size:11px;">✅ Maks. düzey</span>`;

    const levelDesc = template.levelBonuses[unit.level]?.description || '';
    const satBonus  = template.levelBonuses[unit.level]?.satisfactionBonus || 0;

    // Birim yöneticisi satırı
    const mgrRow = unit.managerId
      ? `<div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">
           Birim Müdürü: <strong>${unit.managerName}</strong> (Liderlik: ${unit.managerLeadership})
           <button class="btn btn-sm btn-secondary" style="font-size:10px;padding:1px 6px;margin-left:6px;"
             onclick="window._onAssignUnitManager('${unitId}')">Değiştir</button>
         </div>`
      : `<div style="font-size:11px;color:var(--color-danger);margin-bottom:6px;">
           ⚠️ Birim yöneticisi atanmamış (performans cezası)
           <button class="btn btn-sm btn-secondary" style="font-size:10px;padding:1px 6px;margin-left:6px;"
             onclick="window._onAssignUnitManager('${unitId}')">Ata</button>
         </div>`;

    // Kart görünümü HTML
    const cardViewHtml = `
      <div class="faculty-grid admin-staff-grid" id="admin-staff-grid-${unitId}">
        ${unitStaff.map(m => _adminStaffCard(m)).join('')}
      </div>
    `;

    // Liste görünümü HTML
    const listViewHtml = `
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;" id="admin-staff-table-${unitId}">
          <thead>
            <tr style="border-bottom:2px solid var(--border);">
              <th style="padding:5px 8px;font-size:10px;color:var(--text-muted);text-align:left;">#</th>
              <th class="admin-list-th" data-sort-key="name" data-unit="${unitId}" style="cursor:pointer;padding:5px 8px;font-size:10px;color:var(--text-muted);text-align:left;">İsim</th>
              <th class="admin-list-th" data-sort-key="title" data-unit="${unitId}" style="cursor:pointer;padding:5px 8px;font-size:10px;color:var(--text-muted);text-align:left;">Unvan</th>
              <th style="padding:5px 8px;font-size:10px;color:var(--text-muted);text-align:left;">Birim</th>
              <th class="admin-list-th" data-sort-key="quality" data-unit="${unitId}" style="cursor:pointer;padding:5px 8px;font-size:10px;color:var(--text-muted);text-align:left;">Genel</th>
              <th class="admin-list-th" data-sort-key="efficiency" data-unit="${unitId}" style="cursor:pointer;padding:5px 8px;font-size:10px;color:var(--text-muted);text-align:left;">Verimlilik</th>
              <th class="admin-list-th" data-sort-key="communication" data-unit="${unitId}" style="cursor:pointer;padding:5px 8px;font-size:10px;color:var(--text-muted);text-align:left;">İletişim</th>
              <th class="admin-list-th" data-sort-key="leadership" data-unit="${unitId}" style="cursor:pointer;padding:5px 8px;font-size:10px;color:var(--text-muted);text-align:left;">Liderlik</th>
              <th class="admin-list-th" data-sort-key="techSkills" data-unit="${unitId}" style="cursor:pointer;padding:5px 8px;font-size:10px;color:var(--text-muted);text-align:left;">Teknik</th>
              <th class="admin-list-th" data-sort-key="salary" data-unit="${unitId}" style="cursor:pointer;padding:5px 8px;font-size:10px;color:var(--text-muted);text-align:left;">Maaş</th>
              <th class="admin-list-th" data-sort-key="experience" data-unit="${unitId}" style="cursor:pointer;padding:5px 8px;font-size:10px;color:var(--text-muted);text-align:left;">Deneyim</th>
              <th style="padding:5px 8px;font-size:10px;color:var(--text-muted);text-align:left;">Durum</th>
            </tr>
          </thead>
          <tbody>
            ${unitStaff.map((m, i) => _adminStaffListRow(m, i)).join('')}
          </tbody>
        </table>
      </div>
      <div style="background:var(--bg-secondary);border-radius:6px;padding:6px 10px;margin-top:6px;font-size:11px;display:flex;gap:14px;flex-wrap:wrap;">
        <span>Toplam ${unitStaff.length} personel</span>
        <span>Ort. Kalite: <strong>${unitStaff.length > 0 ? Math.round(unitStaff.reduce((s,m)=>s+(m.quality||0),0)/unitStaff.length) : 0}</strong></span>
        <span>Aylık Maaş: <strong style="color:var(--accent-red,#e53e3e);">${formatMoney(unitStaff.reduce((s,m)=>s+(m.salary||0),0))}/ay</strong></span>
      </div>
    `;

    return `
      <div class="admin-unit-card" style="
        background:var(--bg-card);
        border:1px solid var(--border-color);
        border-radius:8px;
        padding:14px;
        margin-bottom:12px;
        position:relative;
      ">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:20px;">${template.icon}</span>
            <div>
              <div style="font-weight:700;font-size:14px;">${template.name}</div>
              <div style="font-size:11px;color:var(--text-muted);">${template.description}</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:13px;color:var(--color-warning);">${levelStars}</div>
            <div style="font-size:11px;color:var(--text-muted);">Düzey ${unit.level}</div>
          </div>
        </div>

        ${(() => {
          if (unit.assignedBuilding && unit.buildingName) {
            return `<div style="font-size:11px;color:#4ade80;margin-bottom:8px;">📍 Konum: <strong>${unit.buildingName}</strong></div>`;
          }
          const naturalBuilding = ADMIN_UNIT_BUILDINGS[unitId];
          if (naturalBuilding) {
            return `<div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">📍 Konum: <em>Atanmamış</em> <span style="opacity:0.7;">(İlgili binayı inşa edin)</span></div>`;
          }
          return '';
        })()}

        ${mgrRow}

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
          <div style="background:var(--bg-secondary);border-radius:4px;padding:6px;font-size:12px;">
            <div style="color:var(--text-muted);font-size:10px;">Personel</div>
            <div>${staffStatus2} ${unit.staffCount} / ${unit.staffNeeded}${eksik > 0 ? ` <span style="color:var(--color-danger)">(${eksik} eksik)</span>` : ''}</div>
          </div>
          <div style="background:var(--bg-secondary);border-radius:4px;padding:6px;font-size:12px;">
            <div style="color:var(--text-muted);font-size:10px;">Kalite</div>
            <div>${unit.staffQuality || 0}/100</div>
          </div>
        </div>

        <div style="margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-bottom:2px;">
            <span>Performans</span><span>%${perf}</span>
          </div>
          <div style="background:var(--bg-secondary);border-radius:4px;height:6px;overflow:hidden;">
            <div style="background:${perf >= 70 ? 'var(--color-success)' : perf >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'};height:100%;width:${perf}%;transition:width .3s;"></div>
          </div>
        </div>

        ${levelDesc || satBonus > 0 ? `
        <div style="font-size:11px;color:var(--color-info);margin-bottom:8px;">
          📈 ${levelDesc}${satBonus > 0 ? ` · Memnuniyet +${satBonus}` : ''}
        </div>` : ''}

        ${eksik > 0 ? `<div style="font-size:11px;color:var(--color-warning);margin-bottom:8px;">⚠️ Yetersiz personel! Performans düşük.</div>` : ''}

        ${(() => {
          const bonuses = [];
          if (unit.buildingBonus) {
            bonuses.push(`<span style="font-size:10px;padding:2px 7px;border-radius:5px;background:rgba(56,161,105,0.12);color:#4ade80;border:1px solid rgba(74,222,128,0.25);">${unit.buildingBonus.icon} Bina bonusu: +${unit.buildingBonus.efficiency}% verimlilik</span>`);
          }
          if (unit.idariBonus > 0) {
            bonuses.push(`<span style="font-size:10px;padding:2px 7px;border-radius:5px;background:rgba(99,102,241,0.12);color:#a5b4fc;border:1px solid rgba(165,180,252,0.25);">🏛️ İdari bina: +${unit.idariBonus}% verimlilik</span>`);
          }
          return bonuses.length > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">${bonuses.join('')}</div>` : '';
        })()}

        <div style="display:flex;gap:6px;margin-bottom:${unitStaff.length > 0 ? '10px' : '0'};">
          <button class="btn btn-sm btn-secondary" style="font-size:11px;"
            onclick="window._onHireAdminStaff('${unitId}')">
            👤 Personel Al
          </button>
          ${upgradeBtn}
        </div>

        ${unitStaff.length > 0 ? `
        <div style="border-top:1px solid var(--border-color);padding-top:10px;">
          <div style="display:flex;align-items:center;margin-bottom:8px;gap:8px;">
            <div style="font-size:12px;color:var(--text-muted);font-weight:600;flex:1;">Personel (${unitStaff.length} kişi)</div>
            <div style="display:flex;gap:4px;">
              <button class="btn btn-sm admin-view-card-btn" data-unit="${unitId}"
                style="font-size:11px;padding:3px 9px;background:var(--accent);color:var(--bg-primary);border:none;">
                Kart
              </button>
              <button class="btn btn-sm btn-secondary admin-view-list-btn" data-unit="${unitId}"
                style="font-size:11px;padding:3px 9px;">
                Liste
              </button>
            </div>
          </div>
          <div class="admin-staff-view-container" data-unit="${unitId}">
            ${cardViewHtml}
          </div>
        </div>` : ''}
      </div>
    `;
  }).join('');

  panel.innerHTML = `
    <div style="padding:16px;">
      <h2 style="margin:0 0 16px;font-size:18px;">🏢 İdari Birimler</h2>

      <!-- Özet Kartı -->
      <div style="
        background:var(--bg-card);
        border:1px solid var(--border-color);
        border-radius:8px;
        padding:14px;
        margin-bottom:16px;
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:10px;
      ">
        <div style="text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);">Toplam Personel</div>
          <div style="font-size:18px;font-weight:700;">${staffStatus} ${totalStaff} / ${totalNeeded}</div>
          <div style="font-size:11px;color:var(--text-muted);">%${staffPct} dolu</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);">Aylık İdari Maaş</div>
          <div style="font-size:16px;font-weight:700;">${formatMoney(totalSalary)}</div>
          <div style="font-size:11px;color:var(--text-muted);">${formatMoney(totalSalary * 5)}/dönem</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);">Ort. Personel Kalitesi</div>
          <div style="font-size:18px;font-weight:700;">${avgQuality}/100</div>
          <div style="font-size:11px;color:var(--text-muted);">${totalStaff} personel</div>
        </div>
      </div>

      <!-- Birim Kartları -->
      ${unitCards}
    </div>
  `;

  // Kart/Liste toggle event'leri
  const _adminViewState = {};

  function _renderAdminUnitView(unitId, view) {
    const container = panel.querySelector(`.admin-staff-view-container[data-unit="${unitId}"]`);
    if (!container) return;
    const unitStaffLocal = adminStaff.filter(m => m.unit === unitId);

    if (view === 'list') {
      // Sıralama desteği
      const sortKey = _adminViewState[unitId]?.sortKey || null;
      const sortAsc = _adminViewState[unitId]?.sortAsc ?? true;
      let sorted = [...unitStaffLocal];
      if (sortKey) {
        sorted.sort((a, b) => {
          let va = a[sortKey] ?? 0;
          let vb = b[sortKey] ?? 0;
          if (sortKey === 'name') { va = a.name || ''; vb = b.name || ''; }
          if (sortKey === 'title') { va = TITLE_ORDER.indexOf(a.title); vb = TITLE_ORDER.indexOf(b.title); }
          if (sortKey === 'experience') { va = a.totalExperience || a.experience || 0; vb = b.totalExperience || b.experience || 0; }
          if (typeof va === 'string') return sortAsc ? va.localeCompare(vb, 'tr') : vb.localeCompare(va, 'tr');
          return sortAsc ? va - vb : vb - va;
        });
      }

      function colHead(key, label) {
        const isCurrent = sortKey === key;
        const arrow = isCurrent ? (sortAsc ? ' ▲' : ' ▼') : '';
        return `<th class="admin-list-th" data-sort-key="${key}" data-unit="${unitId}"
          style="cursor:pointer;white-space:nowrap;padding:5px 8px;font-size:10px;text-transform:uppercase;
          color:${isCurrent ? 'var(--accent-green)' : 'var(--text-muted)'};text-align:left;">${label}${arrow}</th>`;
      }

      container.innerHTML = `
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr style="border-bottom:2px solid var(--border);">
                <th style="padding:5px 8px;font-size:10px;color:var(--text-muted);text-align:left;">#</th>
                ${colHead('name','İsim')}
                ${colHead('title','Unvan')}
                <th style="padding:5px 8px;font-size:10px;color:var(--text-muted);text-align:left;">Birim</th>
                ${colHead('quality','Genel')}
                ${colHead('efficiency','Verimlilik')}
                ${colHead('communication','İletişim')}
                ${colHead('leadership','Liderlik')}
                ${colHead('techSkills','Teknik')}
                ${colHead('salary','Maaş')}
                ${colHead('experience','Deneyim')}
                <th style="padding:5px 8px;font-size:10px;color:var(--text-muted);text-align:left;">Durum</th>
              </tr>
            </thead>
            <tbody>
              ${sorted.map((m, i) => _adminStaffListRow(m, i)).join('')}
            </tbody>
          </table>
        </div>
        <div style="background:var(--bg-secondary);border-radius:6px;padding:6px 10px;margin-top:6px;font-size:11px;display:flex;gap:14px;flex-wrap:wrap;">
          <span>Toplam ${sorted.length} personel</span>
          <span>Ort. Kalite: <strong>${sorted.length > 0 ? Math.round(sorted.reduce((s,m)=>s+(m.quality||0),0)/sorted.length) : 0}</strong></span>
          <span>Aylık Maaş: <strong style="color:var(--accent-red,#e53e3e);">${formatMoney(sorted.reduce((s,m)=>s+(m.salary||0),0))}/ay</strong></span>
        </div>
      `;

      // Sıralama başlık tıklama
      container.querySelectorAll('.admin-list-th').forEach(th => {
        th.addEventListener('click', () => {
          const key = th.dataset.sortKey;
          if (!_adminViewState[unitId]) _adminViewState[unitId] = {};
          if (_adminViewState[unitId].sortKey === key) {
            _adminViewState[unitId].sortAsc = !_adminViewState[unitId].sortAsc;
          } else {
            _adminViewState[unitId].sortKey = key;
            _adminViewState[unitId].sortAsc = false;
          }
          _renderAdminUnitView(unitId, 'list');
        });
      });

    } else {
      container.innerHTML = `
        <div class="faculty-grid admin-staff-grid">
          ${unitStaffLocal.map(m => _adminStaffCard(m)).join('')}
        </div>
      `;
    }

    // Liste satırı tıklama → detay modal
    container.querySelectorAll('.admin-staff-list-row').forEach(row => {
      row.addEventListener('click', () => {
        const mid = row.dataset.adminStaffId;
        if (mid) _showAdminStaffDetail(mid, adminStaff);
      });
    });

    // Kart tıklama → detay modal
    container.querySelectorAll('.admin-staff-card').forEach(card => {
      card.addEventListener('click', () => {
        const mid = card.dataset.adminStaffId;
        if (mid) _showAdminStaffDetail(mid, adminStaff);
      });
    });
  }

  // Toggle butonları
  panel.querySelectorAll('.admin-view-card-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const uid = btn.dataset.unit;
      if (!_adminViewState[uid]) _adminViewState[uid] = {};
      _adminViewState[uid].view = 'card';
      btn.style.cssText = 'font-size:11px;padding:3px 9px;background:var(--accent);color:var(--bg-primary);border:none;';
      btn.classList.remove('btn-secondary');
      const listBtn = panel.querySelector(`.admin-view-list-btn[data-unit="${uid}"]`);
      if (listBtn) { listBtn.style.cssText = 'font-size:11px;padding:3px 9px;'; listBtn.classList.add('btn-secondary'); }
      _renderAdminUnitView(uid, 'card');
    });
  });

  panel.querySelectorAll('.admin-view-list-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const uid = btn.dataset.unit;
      if (!_adminViewState[uid]) _adminViewState[uid] = {};
      _adminViewState[uid].view = 'list';
      btn.style.cssText = 'font-size:11px;padding:3px 9px;background:var(--accent);color:var(--bg-primary);border:none;';
      btn.classList.remove('btn-secondary');
      const cardBtn = panel.querySelector(`.admin-view-card-btn[data-unit="${uid}"]`);
      if (cardBtn) { cardBtn.style.cssText = 'font-size:11px;padding:3px 9px;'; cardBtn.classList.add('btn-secondary'); }
      _renderAdminUnitView(uid, 'list');
    });
  });

  // İlk yükleme: kart görünümünde event bağla
  panel.querySelectorAll('.admin-staff-card').forEach(card => {
    card.addEventListener('click', () => {
      const mid = card.dataset.adminStaffId;
      if (mid) _showAdminStaffDetail(mid, adminStaff);
    });
  });
}

/**
 * İdari personel detay modalı.
 */
function _showAdminStaffDetail(staffId, adminStaff) {
  const m = adminStaff.find(s => s.id === staffId);
  if (!m) return;

  const TITLE_ORDER = ['Memur', 'Uzman', 'Şef', 'Müdür Yrd.', 'Müdür'];
  const titleRange  = ADMIN_TITLES[m.title] || { min: 14_000, max: 25_000 };
  const nextTitleName = (() => {
    const idx = TITLE_ORDER.indexOf(m.title);
    return (idx >= 0 && idx < TITLE_ORDER.length - 1) ? TITLE_ORDER[idx + 1] : null;
  })();
  const expYears    = Math.round((m.totalExperience || m.experience || 0) * 2) / 2;
  const happiness   = m.happiness ?? 60;
  const quality     = m.quality || 0;
  const initials    = (m.name || '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  function ratingColor(q) {
    if (q >= 85) return '#d4af37';
    if (q >= 70) return '#38a169';
    if (q >= 55) return '#f5a623';
    return '#e53e3e';
  }

  const statDefs = [
    { key: 'efficiency',    label: 'Verimlilik' },
    { key: 'communication', label: 'İletişim'   },
    { key: 'leadership',    label: 'Liderlik'   },
    { key: 'techSkills',    label: 'Teknik'     },
  ];

  // Geçmiş performans (son 4 dönem, varsa)
  const perfHistory = m.performanceHistory || [];
  const perfHistoryHtml = perfHistory.length > 0
    ? `<div style="margin-top:12px;">
         <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px;">Performans Geçmişi</div>
         <div style="display:flex;gap:8px;flex-wrap:wrap;">
           ${perfHistory.slice(-4).map((p, i) => `
             <div style="text-align:center;background:var(--bg-secondary);border-radius:6px;padding:6px 10px;min-width:50px;">
               <div style="font-size:9px;color:var(--text-muted);">D-${perfHistory.slice(-4).length - i}</div>
               <div style="font-size:16px;font-weight:700;color:${ratingColor(p)};">${p}</div>
             </div>
           `).join('')}
         </div>
       </div>`
    : '';

  const bodyHtml = `
    <div style="padding:4px 0;">
      <!-- Üst: avatar + isim + unvan + birim -->
      <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:16px;">
        <div style="
          width:72px;height:72px;border-radius:50%;flex-shrink:0;
          background:linear-gradient(135deg,var(--accent-blue),var(--accent-purple));
          display:flex;align-items:center;justify-content:center;
          font-size:26px;font-weight:800;color:#fff;">
          ${initials}
        </div>
        <div style="flex:1;">
          <div style="font-size:18px;font-weight:700;">${m.name || 'İsimsiz'}</div>
          <div style="font-size:13px;color:var(--text-muted);margin-top:2px;">
            <span class="badge badge-default">${m.title || '—'}</span>
            &nbsp;·&nbsp;${m.unit || '—'}
          </div>
          <div style="font-size:12px;color:var(--text-faint);margin-top:4px;">${expYears} yıl deneyim</div>
        </div>
        <div style="text-align:center;padding:8px 12px;border-radius:10px;background:${ratingColor(quality)}18;flex-shrink:0;">
          <div style="font-size:28px;font-weight:800;color:${ratingColor(quality)};line-height:1;">${quality}</div>
          <div style="font-size:10px;color:var(--text-muted);">Genel Puan</div>
        </div>
      </div>

      <!-- Stat barları -->
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;">
        ${statDefs.map(s => createStatBar(s.label, m[s.key] || 0, 100, _statColor(m[s.key] || 0))).join('')}
      </div>

      <!-- Mutluluk + Maaş + Barem -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
        <div style="background:var(--bg-secondary);border-radius:8px;padding:10px;">
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;">Mutluluk</div>
          <div style="font-size:20px;font-weight:700;color:${happiness >= 70 ? '#38a169' : happiness >= 40 ? '#f5a623' : '#e53e3e'};">${happiness}/100</div>
        </div>
        <div style="background:var(--bg-secondary);border-radius:8px;padding:10px;">
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;">Maaş</div>
          <div style="font-size:16px;font-weight:700;">${formatMoney(m.salary)}/ay</div>
          <div style="font-size:10px;color:var(--text-muted);">Barem: ${formatMoney(titleRange.min)} – ${formatMoney(titleRange.max)}</div>
        </div>
      </div>

      <!-- Terfi uygunluğu -->
      ${m.promotionEligible && nextTitleName ? `
        <div style="background:rgba(56,161,105,0.10);border:1px solid rgba(56,161,105,0.3);border-radius:8px;padding:10px;margin-bottom:14px;">
          <div style="font-weight:700;color:#38a169;margin-bottom:4px;">⭐ Terfi Uygun!</div>
          <div style="font-size:12px;color:var(--text-muted);">
            ${m.title} → ${nextTitleName} pozisyonuna yükseltilebilir.
          </div>
        </div>
      ` : `
        <div style="background:var(--bg-secondary);border-radius:8px;padding:8px;margin-bottom:14px;font-size:12px;color:var(--text-muted);">
          Terfi koşulları: ${m.semestersInTitle || 0}/4 dönem mevcut unvanda · Kalite ≥70 gerekli (mevcut: ${quality})
        </div>
      `}

      ${perfHistoryHtml}

      <!-- Aksiyon butonları -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid var(--border);">
        ${m.promotionEligible && nextTitleName
          ? `<button class="btn btn-primary" onclick="window._onPromoteAdminStaff('${m.id}');document.getElementById('modal-overlay')?.classList.add('hidden');">⬆️ Terfi Et</button>`
          : ''}
        <button class="btn btn-secondary" onclick="window._onAdjustAdminSalary('${m.id}');document.getElementById('modal-overlay')?.classList.add('hidden');">💰 Maaş Ayarla</button>
        <button class="btn btn-danger" onclick="window._onFireAdminStaff('${m.id}');document.getElementById('modal-overlay')?.classList.add('hidden');">🔥 Feshet</button>
      </div>
    </div>
  `;

  showModal(`${m.name || 'Personel'} — Detay`, bodyHtml);
}

/**
 * İdari personel işe alma modalını render eder.
 * @param {string}   unitId     — Birim ID'si
 * @param {object}   candidates — Aday listesi
 * @param {Function} onHire     — İşe al callback (candidate)
 */
export function renderAdminHireModal(unitId, candidates, onHire) {
  const template = ADMIN_UNITS[unitId];
  if (!template) return;

  const titleOptions = Object.keys(ADMIN_TITLES).map(t =>
    `<option value="${t}">${t} (${formatMoney(ADMIN_TITLES[t].min)}–${formatMoney(ADMIN_TITLES[t].max)}/ay)</option>`
  ).join('');

  // Adayları global cache'e yaz (güvenli onclick için)
  window._adminCandidateCache = candidates;

  const candidateRows = candidates.map((c, idx) => `
    <div style="
      background:var(--bg-secondary);
      border-radius:6px;
      padding:10px;
      display:flex;
      justify-content:space-between;
      align-items:center;
      margin-bottom:8px;
    ">
      <div>
        <div style="font-weight:600;font-size:13px;">${c.name}</div>
        <div style="font-size:11px;color:var(--text-muted);">${c.title} · Deneyim: ${c.experience} yıl</div>
        <div style="font-size:11px;color:var(--text-muted);">Kalite: <strong>${c.quality}</strong>/100</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:13px;font-weight:600;color:var(--color-warning);">${formatMoney(c.salary)}/ay</div>
        <button class="btn btn-sm btn-primary" style="margin-top:4px;font-size:11px;"
          onclick="window._onHireAdminCandidateByIdx(${idx})">
          ✅ İşe Al
        </button>
      </div>
    </div>
  `).join('');

  showModal(
    `${template.icon} ${template.name} — Personel Alımı`,
    `
      <p style="margin:0 0 12px;font-size:12px;color:var(--text-muted);">${template.description}</p>

      <div style="margin-bottom:12px;">
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Pozisyon seç:</label>
        <select id="admin-hire-title" class="form-input" style="font-size:12px;">
          ${titleOptions}
        </select>
        <button class="btn btn-sm btn-secondary" style="margin-top:6px;font-size:11px;width:100%;"
          onclick="window._onRefreshAdminCandidates('${unitId}')">
          🔄 Adayları Yenile
        </button>
      </div>

      <div style="font-size:12px;color:var(--text-muted);font-weight:600;margin-bottom:8px;">Adaylar:</div>
      ${candidateRows}
    `
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// v0.2 — MEZUN PANELİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mezun sistemini render et.
 * @param {object} state
 * @param {function} onAlumniEvent — (type) callback
 */
export function renderAlumniPanel(state, onAlumniEvent) {
  const panel = el('tab-alumni');
  if (!panel) return;

  const ad = state.alumniData || {};
  const notableList = ad.notableAlumni || [];
  const totalGrad = ad.totalGraduates || 0;
  const network = ad.alumniNetwork || 0;
  const annualDon = ad.annualDonations || 0;
  const totalDon = ad.totalDonations || 0;

  const notableHtml = notableList.length === 0
    ? '<div style="color:var(--text-muted);font-size:13px;padding:12px;">Henüz ünlü mezun yok. Mezunlar zaman içinde kariyer yapacak.</div>'
    : notableList.slice().reverse().map(alum => {
        const cp = alum.careerPath;
        const levelTitle = _getAlumniLevelTitle(cp?.type, alum.careerLevel);
        const fameStars = '⭐'.repeat(Math.min(5, Math.floor(alum.fame / 20)));
        const totalDonated = alum.totalDonated || 0;
        return `
          <div class="card" style="padding:12px;margin-bottom:8px;border-left:3px solid var(--accent);">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              <span style="font-size:18px;">⭐</span>
              <div>
                <div style="font-weight:600;">${alum.name}</div>
                <div style="font-size:12px;color:var(--text-muted);">
                  ${alum.departmentName || alum.department} · Mezun Yılı ${alum.graduationYear}
                </div>
              </div>
            </div>
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;">
              ${cp ? cp.name : 'Kariyer belirleniyor...'} · ${levelTitle}
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">
              Kariyer: <span style="font-weight:600;">Düzey ${alum.careerLevel}/5</span>
              ${_inlineBar(alum.careerLevel, 5, 80)}
            </div>
            ${alum.fame > 0 ? `<div style="font-size:11px;margin-bottom:2px;">Ün: ${fameStars} (${alum.fame}/100)</div>` : ''}
            ${totalDonated > 0 ? `<div style="font-size:11px;color:var(--success);">Toplam Bağış: ${formatMoney(totalDonated)}</div>` : ''}
            ${alum.achievement ? `<div style="font-size:11px;color:var(--text-muted);font-style:italic;margin-top:4px;">"${alum.achievement}"</div>` : ''}
          </div>`;
      }).join('');

  panel.innerHTML = `
    <div class="panel-header">
      <div class="panel-title">🎓 Mezunlar</div>
      <div class="panel-subtitle">Mezun ağı ve kariyer takibi</div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:20px;">
      ${_statCardHtml('Toplam Mezun', formatNumber(totalGrad), null, 'Bu güne kadar')}
      ${_statCardHtml('Ünlü Mezun', notableList.length, null, 'Takip edilen')}
      ${_statCardHtml('Bu Yıl Bağış', formatMoney(annualDon), annualDon > 0 ? 'positive' : null, 'Mezun bağışı')}
      ${_statCardHtml('Toplam Bağış', formatMoney(totalDon), null, 'Tüm zamanlar')}
    </div>

    <div style="margin-bottom:20px;">
      <div class="section-title">Mezun Ağı Gücü</div>
      <div class="card" style="padding:12px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="flex:1;">${_inlineBar(network, 100, 160)}</div>
          <div style="font-size:13px;font-weight:600;">${network}/100</div>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:6px;">
          Güçlü mezun ağı öğrenci çekimini ve bağışları artırır.
        </div>
      </div>
    </div>

    <div style="margin-bottom:20px;">
      <div class="section-title">Mezun Etkinlikleri</div>
      <div class="card" style="padding:12px;display:flex;flex-wrap:wrap;gap:8px;">
        <button class="btn btn-secondary btn-sm" onclick="window._alumniEvent('reunion')">
          🤝 Mezun Buluşması <span style="font-size:11px;color:var(--text-muted);">(500K ₺)</span>
        </button>
        <button class="btn btn-secondary btn-sm" onclick="window._alumniEvent('career_day')">
          💼 Kariyer Günü <span style="font-size:11px;color:var(--text-muted);">(200K ₺)</span>
        </button>
        <button class="btn btn-secondary btn-sm" onclick="window._alumniEvent('donation_campaign')">
          💝 Bağış Kampanyası <span style="font-size:11px;color:var(--text-muted);">(300K ₺)</span>
        </button>
      </div>
    </div>

    <div>
      <div class="section-title">Ünlü Mezunlar (${notableList.length})</div>
      ${notableHtml}
    </div>
  `;

  // Global event bağlama
  window._alumniEvent = (type) => {
    if (onAlumniEvent) onAlumniEvent(type);
  };
}

function _inlineBar(val, max, widthPx = 100) {
  const pct = max > 0 ? Math.min(100, Math.round((val / max) * 100)) : 0;
  const color = pct >= 70 ? 'var(--success, #68d391)' : pct >= 40 ? 'var(--warning, #f6ad55)' : 'var(--danger, #fc8181)';
  return `<div style="display:inline-block;width:${widthPx}px;height:8px;background:var(--border);border-radius:4px;overflow:hidden;vertical-align:middle;">
    <div style="width:${pct}%;height:100%;background:${color};border-radius:4px;transition:width 0.3s;"></div>
  </div>`;
}

function _getAlumniLevelTitle(careerType, level) {
  const titles = {
    tech_ceo:   ['Junior Dev', 'Kıdemli Mühendis', 'Teknik Direktör', 'CTO', 'CEO', 'Efsane CEO'],
    corporate:  ['Uzman', 'Yönetici', 'Direktör', 'VP', 'CEO', 'İş Dünyası Lideri'],
    academic:   ['Araş. Gör.', 'Dr.', 'Doç. Dr.', 'Prof. Dr.', 'Rektör Yrd.', 'Dünya Bilgini'],
    politician: ['Danışman', 'Yetkili', 'Genel Müdür', 'Milletvekili', 'Bakan', 'Cumhurbaşkanı'],
    artist:     ['Acemi', 'Sanatçı', 'Tanınan Sanatçı', 'Ünlü', 'Efsane', 'Kültür İkonu'],
    engineer:   ['Mühendis', 'Kıdemli Müh.', 'Baş Müh.', 'Teknik Lider', 'Teknik Direktör', 'Endüstri Ustası'],
  };
  const list = titles[careerType] || titles.engineer;
  return list[Math.min(level, list.length - 1)] || '—';
}

// ─────────────────────────────────────────────────────────────────────────────
// v0.2 — BAŞARIM PANELİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Başarımlar panelini render et.
 */
export function renderAchievementsPanel(state, achievements, stats) {
  const panel = el('tab-achievements');
  if (!panel) return;

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
 * Aynı anda en fazla _ACH_MAX bildirim gösterilir; fazlası sıraya alınır.
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
 * Birden fazla çağrı gelirse kuyruğa alır, aynı anda en fazla 4 gösterir.
 */
export function showAchievementNotification(ach) {
  _achQueue.push(ach);
  _achShowNext();
}

// ─────────────────────────────────────────────────────────────────────────────
// v0.2 — RASTGELE OLAY MODAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rastgele olay modalını göster (oyuncu seçim yapar).
 * @param {object} event — RANDOM_EVENTS elemanı
 * @param {function} onChoice — (choiceIndex) callback
 */
export function renderRandomEventModal(event, onChoice) {
  const isCrisis = event.isCrisis;
  const headerColor = isCrisis ? 'var(--danger)' : 'var(--success)';

  const choicesHtml = event.choices.map((c, i) => {
    const budgetText = c.budgetDelta
      ? `<span style="color:${c.budgetDelta > 0 ? 'var(--success)' : 'var(--danger)'};">
           ${c.budgetDelta > 0 ? '+' : ''}${(c.budgetDelta / 1_000_000).toFixed(1)}M ₺
         </span>`
      : '';
    const prestigeText = c.prestigeDelta
      ? `<span style="color:${c.prestigeDelta > 0 ? 'var(--success)' : 'var(--danger)'};">
           Saygınlık ${c.prestigeDelta > 0 ? '+' : ''}${c.prestigeDelta}
         </span>`
      : '';
    const satText = c.satisfactionDelta
      ? `<span style="color:${c.satisfactionDelta > 0 ? 'var(--success)' : 'var(--danger)'};">
           Memnuniyet ${c.satisfactionDelta > 0 ? '+' : ''}${c.satisfactionDelta}
         </span>`
      : '';

    const effectTags = [budgetText, prestigeText, satText].filter(Boolean).join(' · ');

    return `
      <div class="random-event-choice" data-choice="${i}"
           style="border:1px solid var(--border);border-radius:8px;padding:12px;cursor:pointer;
                  transition:border-color 0.2s,background 0.2s;margin-bottom:8px;">
        <div style="font-weight:600;margin-bottom:4px;">${c.text}</div>
        ${effectTags ? `<div style="font-size:12px;margin-bottom:4px;">${effectTags}</div>` : ''}
        <div style="font-size:12px;color:var(--text-muted);">${c.description}</div>
      </div>`;
  }).join('');

  const body = `
    <div style="border-left:4px solid ${headerColor};padding-left:12px;margin-bottom:16px;">
      <div style="font-size:16px;font-weight:700;margin-bottom:6px;">${event.name}</div>
      <div style="color:var(--text-secondary);font-size:14px;">${event.description}</div>
    </div>
    <div style="font-size:13px;font-weight:600;color:var(--text-muted);margin-bottom:8px;">
      Ne yapacaksınız?
    </div>
    <div id="random-event-choices">${choicesHtml}</div>
  `;

  showModal(isCrisis ? '⚠️ Kriz!' : '📢 Olay', body, { wide: false });

  // Seçeneklere tıklama bağla
  setTimeout(() => {
    const choiceEls = document.querySelectorAll('.random-event-choice');
    choiceEls.forEach(el => {
      el.addEventListener('mouseenter', () => {
        el.style.borderColor = 'var(--accent)';
        el.style.background = 'var(--surface-hover, rgba(255,255,255,0.05))';
      });
      el.addEventListener('mouseleave', () => {
        el.style.borderColor = 'var(--border)';
        el.style.background = '';
      });
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.choice, 10);
        if (onChoice) onChoice(idx);
      });
    });
  }, 50);
}

// ─────────────────────────────────────────────────────────────────────────────
// AKREDİTASYON PANELİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Akreditasyon sekmesi: tüm bölümlerin akreditasyon durumu, başvuru ve yenileme.
 * @param {object}   state    — Oyun durumu
 * @param {Function} onApply  — Başvur callback (deptId, bodyId)
 * @param {Function} onRenew  — Yenile callback (deptId, bodyId)
 */
export function renderAccreditationPanel(state, onApply, onRenew) {
  const panel = el('tab-accreditation');
  if (!panel) return;

  const depts = state.departments || [];
  const turn  = state?.meta?.turn || 1;

  function turnToLabel(t) {
    const y = Math.ceil(t / 2);
    const s = (t % 2 === 1) ? 'Güz' : 'Bahar';
    return `${y}. Yıl ${s}`;
  }

  // Özet istatistikler
  let totalAccredited = 0;
  let totalPending    = 0;
  let totalExpired    = 0;
  for (const dept of depts) {
    if (!dept.accreditation) continue;
    for (const acc of Object.values(dept.accreditation)) {
      if (acc.status === 'granted')  totalAccredited++;
      if (acc.status === 'applied' || acc.status === 'under_review') totalPending++;
      if (acc.status === 'expired')  totalExpired++;
    }
  }

  // Bölüm satırları
  const deptRows = depts.filter(d => d.isOpen && d.accreditation).map(dept => {
    const bodies = Object.entries(ACCREDITATION_BODIES);

    const bodyColumns = bodies.map(([bodyId, body]) => {
      // Bu bölüme uygulanabilir mi?
      const applicable = body.applicableTo.includes('all') ||
                         body.applicableTo.includes(dept.category || '');

      if (!applicable) {
        return `<td style="padding:10px 12px;text-align:center;color:var(--text-faint);font-size:11px;">—</td>`;
      }

      const acc = dept.accreditation?.[bodyId];
      if (!acc) {
        return `<td style="padding:10px 12px;text-align:center;color:var(--text-faint);font-size:11px;">—</td>`;
      }

      let cellContent = '';

      if (acc.status === 'granted') {
        const remaining = acc.expiresAt != null ? (acc.expiresAt - turn) : '?';
        const expLabel  = acc.expiresAt != null ? turnToLabel(acc.expiresAt) : '—';
        const urgent    = typeof remaining === 'number' && remaining <= 2;
        const color     = urgent ? 'var(--accent-red,#e53e3e)' : 'var(--accent-green)';
        cellContent = `
          <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
            <span style="font-size:11px;font-weight:700;color:${color};">✓ Akredite</span>
            <span style="font-size:10px;color:var(--text-muted);">Bitiş: ${expLabel}</span>
            <span style="font-size:10px;color:${color};">${remaining} dönem kaldı</span>
            ${urgent ? `<button class="btn btn-xs btn-warning" onclick="window._onShowAccreditationModal('${dept.id}','${bodyId}')">🔄 Yenile</button>` : ''}
          </div>`;
      } else if (acc.status === 'applied' || acc.status === 'under_review') {
        const elapsed = turn - (acc.appliedAt || turn);
        const pt      = acc.processTime || body.processingTime.max;
        cellContent = `
          <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
            <span style="font-size:11px;font-weight:700;color:var(--accent-yellow,#f5a623);">⏳ İnceleniyor</span>
            <span style="font-size:10px;color:var(--text-muted);">${elapsed}/${pt} dönem</span>
          </div>`;
      } else if (acc.status === 'expired') {
        cellContent = `
          <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
            <span style="font-size:11px;font-weight:700;color:var(--accent-red,#e53e3e);">✗ Süresi Doldu</span>
            <button class="btn btn-xs btn-warning" onclick="window._onShowAccreditationModal('${dept.id}','${bodyId}')">🔄 Yenile (${(body.renewalCost/1000).toFixed(0)}K ₺)</button>
          </div>`;
      } else if (acc.status === 'rejected') {
        cellContent = `
          <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
            <span style="font-size:11px;color:var(--accent-red,#e53e3e);">✗ Reddedildi</span>
            <button class="btn btn-xs btn-secondary" onclick="window._onShowAccreditationModal('${dept.id}','${bodyId}')">Tekrar Başvur</button>
          </div>`;
      } else {
        // none — gereksinimler kontrol et
        const reqResult = (() => {
          try {
            if (window._checkAccreditationRequirements) {
              return window._checkAccreditationRequirements(state, dept, body);
            }
          } catch(e) {}
          return null;
        })();
        const canApply = !reqResult || reqResult.allMet;
        cellContent = `
          <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
            <span style="font-size:10px;color:var(--text-faint);">Yok</span>
            <button class="btn btn-xs btn-secondary" onclick="window._onShowAccreditationModal('${dept.id}','${bodyId}')">+ Başvur (${(body.cost/1000).toFixed(0)}K ₺)</button>
          </div>`;
      }

      return `<td style="padding:10px 12px;text-align:center;">${cellContent}</td>`;
    }).join('');

    // Akredite sayısı
    const accCount = Object.values(dept.accreditation).filter(a => a.status === 'granted').length;
    const accBadge = accCount > 0
      ? `<span style="font-size:10px;padding:1px 5px;border-radius:8px;background:rgba(56,161,105,0.15);color:var(--accent-green);">✓ ${accCount} aktif</span>`
      : '';

    return `
      <tr style="border-bottom:1px solid var(--border);">
        <td style="padding:10px 12px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:20px;">${dept.icon || '🏫'}</span>
            <div>
              <div style="font-size:13px;font-weight:600;">${dept.name}</div>
              <div style="font-size:11px;color:var(--text-muted);">${dept.shortName || ''} ${accBadge}</div>
            </div>
          </div>
        </td>
        ${bodyColumns}
      </tr>`;
  }).join('');

  // Tablo başlıkları
  const headerCols = Object.values(ACCREDITATION_BODIES).map(body =>
    `<th style="padding:8px 12px;font-size:11px;font-weight:700;text-align:center;text-transform:uppercase;color:var(--text-muted);">${body.icon} ${body.name}</th>`
  ).join('');

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-title">🏅 Akreditasyon Yönetimi</div>
        <div class="panel-subtitle">MÜDEK, ABET ve THEQA akreditasyonlarını yönetin</div>
      </div>
    </div>

    <!-- Özet kartlar -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px;">
      <div class="card" style="padding:16px;text-align:center;">
        <div style="font-size:28px;font-weight:700;color:var(--accent-green);">${totalAccredited}</div>
        <div style="font-size:12px;color:var(--text-muted);">Aktif Akreditasyon</div>
      </div>
      <div class="card" style="padding:16px;text-align:center;">
        <div style="font-size:28px;font-weight:700;color:var(--accent-yellow,#f5a623);">${totalPending}</div>
        <div style="font-size:12px;color:var(--text-muted);">Değerlendirmedeki Başvuru</div>
      </div>
      <div class="card" style="padding:16px;text-align:center;">
        <div style="font-size:28px;font-weight:700;color:${totalExpired > 0 ? 'var(--accent-red,#e53e3e)' : 'var(--text-muted)'};">${totalExpired}</div>
        <div style="font-size:12px;color:var(--text-muted);">Süresi Dolan</div>
      </div>
      <div class="card" style="padding:16px;text-align:center;">
        <div style="font-size:28px;font-weight:700;color:var(--accent);">${depts.filter(d => d.isOpen && d.accreditation).length}</div>
        <div style="font-size:12px;color:var(--text-muted);">Başvurabilir Bölüm</div>
      </div>
    </div>

    <!-- Akreditasyon açıklama kutusu -->
    <div class="card" style="padding:12px 16px;margin-bottom:20px;border-left:3px solid var(--accent);background:rgba(var(--accent-rgb,66,153,225),0.05);">
      <div style="font-size:12px;font-weight:700;margin-bottom:6px;">ℹ️ Akreditasyon Hakkında</div>
      <div style="font-size:11px;color:var(--text-muted);line-height:1.6;">
        <strong>MÜDEK:</strong> Türk mühendislik bölümleri için ulusal kalite güvencesi. Mühendislik kategorisi bölümlerine uygulanır.<br>
        <strong>ABET:</strong> Uluslararası mühendislik akreditasyonu. YKS sıralamasını iyileştirir ve uluslararası tanınırlık sağlar.<br>
        <strong>THEQA:</strong> Körfez bölgesi yükseköğretim akreditasyonu. Uluslararası öğrenci çekmeye yardımcı olur.<br>
        Akreditasyon başvurusu için her kurumun belirli gereksinimleri vardır. "Başvur" butonuna tıklayarak gereksinimleri görebilirsiniz.
      </div>
    </div>

    <!-- Bölüm akreditasyon tablosu -->
    ${depts.filter(d => d.isOpen && d.accreditation).length === 0 ? `
      <div class="empty-state">
        <div class="empty-state-icon">🏅</div>
        <div class="empty-state-title">Akreditasyon Yapısı Kurulmamış</div>
        <div class="empty-state-desc">Mühendislik bölümleri açıldığında akreditasyon seçenekleri burada görünecek.</div>
      </div>
    ` : `
      <div class="card" style="padding:0;overflow:hidden;">
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="border-bottom:2px solid var(--border);background:var(--bg-secondary);">
                <th style="padding:8px 12px;font-size:11px;font-weight:700;text-align:left;text-transform:uppercase;color:var(--text-muted);">Bölüm</th>
                ${headerCols}
              </tr>
            </thead>
            <tbody>${deptRows}</tbody>
          </table>
        </div>
      </div>
    `}
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// KULÜPLER PANELİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Öğrenci Kulüpleri panelini render et.
 * Callbacks: window._onFoundClub(typeId), window._onUpgradeClub(clubId), window._onDissolveClub(clubId)
 */
export function renderClubsPanel(state) {
  const panel = el('tab-clubs');
  if (!panel) return;

  // Import CLUB_TYPES / CLUB_CATEGORIES from clubs module via game.js re-exports
  // They are passed in via window globals set in main.js
  const CLUB_TYPES      = window._CLUB_TYPES || {};
  const CLUB_CATEGORIES = window._CLUB_CATEGORIES || {};

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

// ─────────────────────────────────────────────────────────────────────────────
// SPOR PANELİ
// ─────────────────────────────────────────────────────────────────────────────

export function renderSportsPanel(state) {
  const panel = el('tab-sports');
  if (!panel) return;

  const sports      = state.sports || { teams: [], leagueResults: [], totalBudget: 0 };
  const teams       = sports.teams || [];
  const SPORTS_DATA = window._SPORTS || {};
  const hasFacility = (state.buildings || []).some(
    b => (b.type === 'spor_tesisi' || b.type === 'spor_merkezi') && b.isCompleted
  );

  const totalWins   = teams.reduce((s, t) => s + (t.wins   || 0), 0);
  const totalLosses = teams.reduce((s, t) => s + (t.losses || 0), 0);
  const champions   = teams.filter(t => t.leaguePosition === 1).length;

  const availableSports = Object.values(SPORTS_DATA).filter(
    s => !teams.some(t => t.sportId === s.id)
  );

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-title">⚽ Üniversite Sporları</div>
        <div class="panel-subtitle">${teams.length} aktif takım${hasFacility ? '' : ' · ⚠️ Spor Tesisi yok'}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:20px;">
      ${_campusSummaryCard('⚽', 'Aktif Takım', teams.length)}
      ${_campusSummaryCard('🏆', 'Şampiyonluk', champions)}
      ${_campusSummaryCard('📊', 'Sezon', totalWins + 'G-' + totalLosses + 'M')}
      ${_campusSummaryCard('💰', 'Dönem Bütçesi', formatMoney(sports.totalBudget))}
    </div>

    ${teams.length > 0 ? `
      <div class="section-title">AKTİF TAKIMLAR</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin-bottom:20px;">
        ${teams.map(t => {
          const sport      = SPORTS_DATA[t.sportId] || {};
          const semCost    = (sport.semesterBudget || 0) + (sport.coachSalary || 0);
          const upgCost    = sport.upgradeCosts?.[t.level] || 0;
          const canUpgrade = t.level < (sport.maxLevel || 5) && state.university.budget >= upgCost;
          const posLabel   = t.leaguePosition === 1 ? '🏆 Şampiyon' : t.leaguePosition ? '#' + t.leaguePosition : '—';
          return `
            <div class="building-card" style="position:relative;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div>
                  <span style="font-size:20px;">${t.icon}</span>
                  <strong style="margin-left:6px;">${t.name}</strong>
                  <span style="color:#f59e0b;margin-left:4px;">${'★'.repeat(t.level)}${'☆'.repeat((sport.maxLevel||5)-t.level)}</span>
                </div>
                <span style="font-size:12px;color:#10b981;font-weight:600;">${posLabel}</span>
              </div>
              <div style="font-size:12px;color:#94a3b8;margin-bottom:6px;">
                Sezon: ${t.wins || 0}G - ${t.draws || 0}B - ${t.losses || 0}M · ${t.seasonPoints || 0} puan
              </div>
              <div style="font-size:11px;color:#64748b;margin-bottom:8px;">
                Dönem maliyeti: ${formatMoney(semCost)}
              </div>
              <div style="display:flex;gap:6px;">
                ${t.level < (sport.maxLevel || 5)
                  ? `<button class="btn-primary btn-sm" onclick="window._onUpgradeTeam(${t.id})" ${canUpgrade ? '' : 'disabled'} style="font-size:11px;">▲ Yükselt (${formatMoney(upgCost)})</button>`
                  : '<span style="font-size:10px;color:#10b981;">Maks Seviye</span>'}
                <button class="btn-danger btn-sm" onclick="window._onDissolveTeam(${t.id})" style="font-size:11px;padding:2px 8px;" title="Takımı kapat">✕</button>
              </div>
            </div>`;
        }).join('')}
      </div>
    ` : ''}

    ${(sports.leagueResults || []).length > 0 ? `
      <div class="section-title">SON SEZON SONUÇLARI</div>
      <div style="margin-bottom:20px;">
        ${sports.leagueResults.map(r => `
          <div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:10px;margin-bottom:8px;">
            <div style="font-weight:600;margin-bottom:4px;">${r.icon} ${r.name} — ${r.position === 1 ? '🏆 Şampiyon!' : '#' + r.position} (${r.record}, ${r.points} puan)</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              ${(r.matches || []).map(m => `
                <span style="font-size:11px;padding:2px 8px;border-radius:4px;background:${m.result==='win'?'rgba(16,185,129,0.15)':m.result==='draw'?'rgba(234,179,8,0.15)':'rgba(239,68,68,0.15)'};color:${m.result==='win'?'#10b981':m.result==='draw'?'#eab308':'#ef4444'};">
                  ${m.result==='win'?'✓':m.result==='draw'?'—':'✗'} ${m.opponent}
                </span>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${availableSports.length > 0 ? `
      <div class="section-title">YENİ TAKIM KUR</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;">
        ${availableSports.map(s => {
          const needsFac = s.requiresFacility && !hasFacility;
          const canAfford = state.university.budget >= s.foundingCost;
          const disabled  = needsFac || !canAfford;
          return `
            <div style="background:rgba(255,255,255,0.03);border-radius:10px;padding:12px;border:1px solid rgba(255,255,255,0.06);${disabled ? 'opacity:0.5;' : ''}">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <div><span style="font-size:18px;">${s.icon}</span> <strong>${s.name}</strong></div>
                <button class="btn-primary btn-sm" onclick="window._onFoundTeam('${s.id}')" ${disabled ? 'disabled' : ''} style="font-size:11px;">
                  Kur (${formatMoney(s.foundingCost)})
                </button>
              </div>
              <div style="font-size:11px;color:#94a3b8;">${s.description}</div>
              <div style="font-size:10px;color:#64748b;margin-top:4px;">
                Dönem: ${formatMoney(s.semesterBudget + s.coachSalary)}
                ${s.requiresFacility ? (hasFacility ? ' · ✅ Tesis var' : ' · ❌ Spor Tesisi gerekli') : ' · Tesis gerekmez'}
              </div>
            </div>`;
        }).join('')}
      </div>
    ` : ''}
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// LEADERBOARD PANELİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Leaderboard panelini render eder.
 * Firestore verilerini alıp #leaderboard-list div'ine yazar.
 * @param {Function} getTopScoresFn  leaderboard.js'ten gelen getTopScores fonksiyonu
 */
export async function renderLeaderboardPanel(getTopScoresFn) {
  const container = document.getElementById('leaderboard-list');
  if (!container) return;

  // Yenile butonu
  const refreshHtml = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:14px;">
      <button id="lb-refresh-btn" class="btn btn-ghost btn-sm" style="font-size:12px;">
        🔄 Yenile
      </button>
    </div>`;

  container.innerHTML = refreshHtml + '<div id="lb-content"><p style="color:var(--text-muted,#aaa);font-size:14px;">Yükleniyor…</p></div>';

  document.getElementById('lb-refresh-btn')?.addEventListener('click', () => {
    renderLeaderboardPanel(getTopScoresFn);
  });

  const contentEl = document.getElementById('lb-content');

  try {
    const rows = await getTopScoresFn(50);

    if (!rows || rows.length === 0) {
      contentEl.innerHTML = '<p style="color:var(--text-muted,#aaa);font-size:14px;">Henüz skor yok, ilk olabilirsin!</p>';
      return;
    }

    const medals = ['🥇', '🥈', '🥉'];

    const tableRows = rows.map((r, idx) => {
      const pos    = idx + 1;
      const medal  = pos <= 3 ? medals[pos - 1] : `${pos}.`;
      const rowCls = pos === 1 ? 'lb-gold' : pos === 2 ? 'lb-silver' : pos === 3 ? 'lb-bronze' : '';
      const date   = r.createdAt?.toDate
        ? r.createdAt.toDate().toLocaleDateString('tr-TR')
        : (r.createdAt?.seconds
            ? new Date(r.createdAt.seconds * 1000).toLocaleDateString('tr-TR')
            : '—');
      return `
        <tr class="${rowCls}">
          <td style="text-align:center;font-size:15px;">${medal}</td>
          <td style="font-weight:${pos <= 3 ? '700' : '400'};">${_escHtml(r.name ?? 'Anonim')}</td>
          <td style="text-align:right;font-weight:700;color:var(--accent,#5dd6c0);">${(r.score ?? 0).toLocaleString('tr-TR')}</td>
          <td style="text-align:center;">${r.year ?? '—'}. Yıl</td>
          <td style="text-align:center;">#${r.rank ?? '—'}</td>
          <td style="text-align:center;">${r.prestige ?? '—'}</td>
          <td style="text-align:center;font-size:11px;color:var(--text-muted,#aaa);">${date}</td>
        </tr>`;
    }).join('');

    contentEl.innerHTML = `
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.1);color:var(--text-muted,#aaa);font-size:11px;text-transform:uppercase;">
              <th style="padding:8px 6px;text-align:center;">#</th>
              <th style="padding:8px 6px;text-align:left;">Rektör</th>
              <th style="padding:8px 6px;text-align:right;">Skor</th>
              <th style="padding:8px 6px;text-align:center;">Yıl</th>
              <th style="padding:8px 6px;text-align:center;">Sıralama</th>
              <th style="padding:8px 6px;text-align:center;">Saygınlık</th>
              <th style="padding:8px 6px;text-align:center;">Tarih</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
      <style>
        .lb-gold   { background: rgba(255,215,0,0.07); }
        .lb-silver { background: rgba(192,192,192,0.06); }
        .lb-bronze { background: rgba(205,127,50,0.06); }
        .lb-gold td, .lb-silver td, .lb-bronze td { padding: 9px 6px; }
        tbody tr td { padding: 8px 6px; border-bottom: 1px solid rgba(255,255,255,0.04); }
      </style>`;
  } catch (err) {
    // Çevrimiçi liderlik tablosu hatasında lokal yedek skorları göster
    let localScores = [];
    try {
      localScores = JSON.parse(localStorage.getItem('rektor_oldum_local_scores') || '[]');
    } catch (e) { /* localStorage okunamadı */ }

    const banner = `
      <div style="background:rgba(245,166,35,0.1);border:1px solid rgba(245,166,35,0.3);
                  padding:12px;border-radius:8px;margin-bottom:14px;font-size:13px;">
        🛠️ Çevrimiçi liderlik tablosu geçici olarak kullanılamıyor.
        ${localScores.length ? `Aşağıda bu cihazda kayıtlı skorların gösteriliyor.` : ''}
      </div>`;

    if (!localScores.length) {
      contentEl.innerHTML = banner +
        '<p style="color:var(--text-muted,#aaa);font-size:13px;">Henüz lokal skor da yok.</p>';
      return;
    }

    const localRows = localScores.slice(0, 50).map((r, idx) => {
      const pos = idx + 1;
      const medal = pos <= 3 ? ['🥇','🥈','🥉'][pos-1] : `${pos}.`;
      const date = r.savedAt ? new Date(r.savedAt).toLocaleDateString('tr-TR') : '—';
      return `
        <tr>
          <td style="text-align:center;">${medal}</td>
          <td>${_escHtml(r.name ?? 'Anonim')}</td>
          <td style="text-align:right;font-weight:700;color:var(--accent,#5dd6c0);">${(r.score ?? 0).toLocaleString('tr-TR')}</td>
          <td style="text-align:center;">${r.year ?? '—'}. Yıl</td>
          <td style="text-align:center;">${r.prestige ?? '—'}</td>
          <td style="text-align:center;font-size:11px;color:var(--text-muted,#aaa);">${date}</td>
        </tr>`;
    }).join('');

    contentEl.innerHTML = banner + `
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.1);color:var(--text-muted,#aaa);font-size:11px;text-transform:uppercase;">
              <th style="padding:8px 6px;text-align:center;">#</th>
              <th style="padding:8px 6px;text-align:left;">Rektör</th>
              <th style="padding:8px 6px;text-align:right;">Skor</th>
              <th style="padding:8px 6px;text-align:center;">Yıl</th>
              <th style="padding:8px 6px;text-align:center;">Saygınlık</th>
              <th style="padding:8px 6px;text-align:center;">Tarih</th>
            </tr>
          </thead>
          <tbody>${localRows}</tbody>
        </table>
      </div>`;
  }
}

/** HTML özel karakterlerini kaçış için küçük yardımcı. */
function _escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
