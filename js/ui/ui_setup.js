import { el, qs, qsa, on, delegate, showNotification } from './ui_base.js';
import { showScreen } from './ui_screens.js';
import { DEPARTMENTS, SCENARIOS } from '../data.js?v=0.4.48';

/** Kurulum ekranı dahili state */
const _setup = {
  playerName:   '',
  uniName:      '',
  uniType:      'devlet',
  difficulty:   'kolay',
  departments:  new Set(),
  scenarioId:   null,
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

function _applyScenarioToSetup(scenarioId) {
  const scenario = SCENARIOS[scenarioId];
  if (!scenario) return;

  _setup.uniType = scenario.universityType || 'devlet';
  _setup.difficulty = scenario.difficulty || 'normal';

  qsa('#type-cards .type-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.type === _setup.uniType);
  });

  qsa('#difficulty-cards .difficulty-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.difficulty === _setup.difficulty);
  });
}

function _showSetupStep(step) {
  qsa('.setup-step').forEach(s => s.classList.add('hidden'));
  const targetId = step === 0 ? 'setup-step-scenario' : `setup-step-${step}`;
  const target = el(targetId);
  if (target) target.classList.remove('hidden');

  qsa('.setup-step-indicator .step').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.step) === step);
  });
}

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

  delegate(grid, '.dept-option', 'click', (e, card) => {
    const id = card.dataset.deptId;
    if (card.classList.contains('disabled')) return;
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
    _renderDeptSelection(filter);
  });

  _updateDeptSelectionInfo();
}

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
