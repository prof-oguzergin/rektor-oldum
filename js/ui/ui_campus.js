import { el, on, delegate, formatMoney, formatNumber, showModal, hideModal, showNotification, _capacityBar, _levelStars, _formatBuildingEffects, _campusSummaryCard } from './ui_base.js';
import { UNIVERSITY_MODELS, BUILDINGS } from '../data.js?v=0.4.48';
import { renderCampusMap, handleCampusClick, handleCampusHover, clearHover } from '../campus-renderer.js?v=0.4.24';

// Bina katalogunu data.js'deki BUILDINGS'den türet
export const BUILDING_CATALOG = Object.values(BUILDINGS).map(b => ({
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

// Grup başlıkları (çoğul / kategori adları)
const GROUP_TITLES = {
  fakulte_binasi:     'Fakülte Binaları',
  amfi:               'Amfi Binaları',
  lab:                'Laboratuvarlar',
  arastirma_merkezi:  'Araştırma Merkezleri',
  kutuphane:          'Kütüphaneler',
  yemekhane:          'Yemekhaneler',
  yurt:               'Öğrenci Yurtları',
  spor_tesisi:        'Spor Tesisleri',
  saglik_merkezi:     'Sağlık Merkezi',
  konferans:          'Konferans Merkezi',
  teknokent:          'Teknokent',
  idari_bina:         'İdari Binalar',
  ulasim_merkezi:     'Ulaşım Merkezi',
};

// Açık akordeon gruplarını hatırlamak için Set
const _openCampusGroups = new Set();
let _campusAccordionInitialized = false;

/**
 * Yerleşke sekmesi: yerleşke özeti, akordeon tipi bina grupları ve inşaat seçenekleri.
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

  // Katalog sözlüğü
  const catalogMap = {};
  BUILDING_CATALOG.forEach(c => { catalogMap[c.type] = c; });

  completedBuildings.forEach(b => {
    const cat = catalogMap[b.type] || {};
    const cap = b.currentCapacity || (() => {
       const base = cat.capacity || {};
       const pLvl = cat.capacityPerLevel || {};
       const lvl  = b.level || 1;
       const res  = {};
       for (const k of Object.keys(base)) res[k] = base[k] + (pLvl[k] || 0)*(lvl - 1);
       return res;
    })();
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

  // İlk açılışta açık kalacak gruplar: mevcut binası olanlar
  if (!_campusAccordionInitialized) {
    _campusAccordionInitialized = true;
    buildings.forEach(b => _openCampusGroups.add(b.type));
    if (_openCampusGroups.size === 0 && BUILDING_CATALOG.length > 0) {
      _openCampusGroups.add(BUILDING_CATALOG[0].type);
    }
  }

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-title">Yerleşke</div>
        <div class="panel-subtitle">${completedBuildings.length} aktif bina · ${inProgressBuildings.length} yapım aşamasında</div>
      </div>
    </div>

    <div class="campus-layout">
      <!-- SOL: Özet + Akordeon Bina Grupları -->
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

        <!-- Araç Çubuğu: Arama ve Genişletme Kontrolleri -->
        <div class="campus-toolbar">
          <div style="display:flex;align-items:center;gap:8px;flex:1;max-width:340px;">
            <input type="text" id="campus-search-input" placeholder="🔍 Bina veya kategori ara..." class="input" style="font-size:12px;padding:6px 12px;width:100%;border-radius:8px;">
          </div>
          <div class="campus-toolbar-actions">
            <button class="btn btn-secondary btn-small" id="btn-expand-all-campus" style="font-size:11px;padding:5px 10px;">
              ▼ Tümünü Genişlet
            </button>
            <button class="btn btn-secondary btn-small" id="btn-collapse-all-campus" style="font-size:11px;padding:5px 10px;">
              ▲ Tümünü Daralt
            </button>
          </div>
        </div>

        <!-- Akordeon Bina Grupları Listesi -->
        <div class="campus-groups-container" id="campus-groups-list">
          ${BUILDING_CATALOG.map(cat => {
            const catBuildings = buildings.filter(b => b.type === cat.type);
            const isOpen = _openCampusGroups.has(cat.type);
            const completed = catBuildings.filter(b => b.isCompleted);
            const inProgress = catBuildings.filter(b => !b.isCompleted);
            const title = GROUP_TITLES[cat.type] || cat.name;
            const summary = _getGroupSummarySnippet(cat, catBuildings, state);

            let badgesHtml = '';
            if (completed.length > 0) {
              badgesHtml += `<span class="badge badge-success" style="font-size:10px;">${completed.length} Aktif</span>`;
            }
            if (inProgress.length > 0) {
              badgesHtml += `<span class="badge badge-warning" style="font-size:10px;">🔨 ${inProgress.length} Yapımda</span>`;
            }
            if (catBuildings.length === 0) {
              badgesHtml += `<span class="badge badge-secondary" style="font-size:10px;opacity:0.65;">İnşa Edilmedi</span>`;
            }

            let quickCostBadge = '';
            if (catBuildings.length === 0) {
              quickCostBadge = `<span class="badge ${budget >= cat.cost ? 'badge-warning' : 'badge-danger'}" style="font-size:11px;">💰 ${formatMoney(cat.cost)}</span>`;
            }

            return `
              <div class="campus-group-item ${isOpen ? 'is-open' : ''}" data-group-type="${cat.type}">
                <div class="campus-group-header">
                  <div class="campus-group-icon">${cat.icon || '🏛️'}</div>
                  <div class="campus-group-info">
                    <div class="campus-group-title-row">
                      <span class="campus-group-title">${title}</span>
                      ${badgesHtml}
                    </div>
                    <div class="campus-group-summary">${summary}</div>
                  </div>
                  <div class="campus-group-actions">
                    ${quickCostBadge}
                    <span class="campus-group-chevron">▼</span>
                  </div>
                </div>

                <div class="campus-group-content">
                  <div class="campus-group-inner">
                    ${catBuildings.length > 0 ? `
                      <div class="campus-group-buildings-grid">
                        ${catBuildings.map(b => _renderBuildingCard(b, state, catalogMap, depts, budget)).join('')}
                      </div>
                    ` : `
                      <div class="campus-group-empty">
                        <span>ℹ️</span> Henüz yerleşkede ${cat.name} bulunmuyor. Aşağıdaki inşaat seçeneği ile ilk binayı inşa edebilirsiniz.
                      </div>
                    `}

                    <!-- Grup altındaki inşaat / bir tane daha inşa et seçeneği -->
                    ${_renderBuildFooter(cat, catBuildings, budget, state)}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

      </div>

      <!-- SAĞ: İnteraktif Kampüs Haritası -->
      <div class="campus-map-sidebar">
        <div class="campus-map-preview" id="campus-map-preview" title="Haritayı büyütmek için tıklayın">
          <canvas id="campus-canvas" width="960" height="600"></canvas>
          <div id="campus-tooltip" class="campus-tooltip" style="display:none;"></div>
          <div class="campus-map-expand-hint">🔍 Büyütmek için tıklayın</div>
        </div>
      </div>
    </div>

    <!-- Tam Ekran Harita Modalı -->
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

  // Canvas & Harita İşlevleri
  const canvas = el('campus-canvas');
  if (canvas) {
    renderCampusMap(canvas, state);
    on(canvas, 'click', (e) => {
      const b = handleCampusClick(e, canvas, state);
      const tt = el('campus-tooltip');
      if (b && tt) {
        tt.style.display = 'block';
        tt.style.left = (e.offsetX + 12) + 'px';
        tt.style.top = (e.offsetY - 12) + 'px';
        tt.innerHTML = `<strong>${b.name || b.type}</strong><br>Düzey ${b.level || 1}<br>${b.isCompleted ? '✅ Aktif' : '🔨 Yapım'}`;
      } else if (tt) tt.style.display = 'none';
      renderCampusMap(canvas, state);
    });
    on(canvas, 'mousemove', (e) => { handleCampusHover(e, canvas, state); renderCampusMap(canvas, state); });
    on(canvas, 'mouseleave', () => { clearHover(); renderCampusMap(canvas, state); if (el('campus-tooltip')) el('campus-tooltip').style.display = 'none'; });
  }

  const mapPreview = el('campus-map-preview');
  const fullscreen = el('campus-map-fullscreen');
  const fullCanvas = el('campus-canvas-full');
  if (mapPreview) on(mapPreview, 'click', () => { if (fullscreen && fullCanvas) { fullscreen.style.display = 'flex'; renderCampusMap(fullCanvas, state); } });
  if (el('campus-map-close')) on(el('campus-map-close'), 'click', () => { if (fullscreen) fullscreen.style.display = 'none'; clearHover(); });

  // Event Dinleyicileri (Delegation)
  if (!panel._listenersAttached) {
    panel._listenersAttached = true;
    panel._currentState = state;
    panel._onDecision = onDecision;
    panel._onBuildStart = onBuildStart;

    // Akordeon başlığı tıklanınca aç / kapat
    delegate(panel, '.campus-group-header', 'click', (e, header) => {
      const item = header.closest('.campus-group-item');
      if (!item) return;
      const gType = item.dataset.groupType;
      const isOpen = item.classList.toggle('is-open');
      if (isOpen) {
        _openCampusGroups.add(gType);
      } else {
        _openCampusGroups.delete(gType);
      }
    });

    // Tümünü Genişlet
    delegate(panel, '#btn-expand-all-campus', 'click', () => {
      BUILDING_CATALOG.forEach(c => _openCampusGroups.add(c.type));
      panel.querySelectorAll('.campus-group-item').forEach(el => el.classList.add('is-open'));
    });

    // Tümünü Daralt
    delegate(panel, '#btn-collapse-all-campus', 'click', () => {
      _openCampusGroups.clear();
      panel.querySelectorAll('.campus-group-item').forEach(el => el.classList.remove('is-open'));
    });

    // İnşaat Başlatma
    delegate(panel, '.campus-build-footer.can-build', 'click', (e, card) => {
      const bType = card.dataset.buildType;
      if (!bType) return;
      const cat = BUILDING_CATALOG.find(c => c.type === bType);
      const curBudget = panel._currentState?.university?.budget ?? 0;
      if (cat && curBudget < cat.cost) {
        showNotification(`Yetersiz bütçe. Gerekli: ${formatMoney(cat.cost)} (${formatMoney(cat.cost - curBudget)} eksik)`, 'danger');
        return;
      }
      if (panel._onBuildStart) panel._onBuildStart(bType);
    });

    // Düzey Yükseltme
    delegate(panel, '.btn-campus-upgrade', 'click', (e, btn) => {
      panel._onDecision && panel._onDecision({ type: 'upgrade_building', buildingId: btn.dataset.buildingId });
    });

    // Bölüm / Lab Atama
    delegate(panel, '.btn-campus-assign', 'click', (e, btn) => {
      const b = panel._currentState?.buildings?.find(x => x.id === btn.dataset.buildingId);
      if (b) _showDepartmentAssignModal(panel._currentState, b, panel._onDecision);
    });

    // Bina Yeniden Adlandırma
    delegate(panel, '.btn-rename', 'click', (e, btn) => {
      const b = panel._currentState?.buildings?.find(x => x.id === btn.dataset.buildingId);
      if (!b) return;
      const newName = prompt('Yeni bina ismi:', b.name || b.type);
      if (newName) panel._onDecision({ type: 'rename_building', buildingId: b.id, name: newName });
    });

    // Canlı Arama / Filtreleme
    delegate(panel, '#campus-search-input', 'input', (e, input) => {
      const q = (input.value || '').toLowerCase().trim();
      panel.querySelectorAll('.campus-group-item').forEach(item => {
        if (!q) {
          item.style.display = '';
          return;
        }
        const text = item.textContent.toLowerCase();
        if (text.includes(q)) {
          item.style.display = '';
          item.classList.add('is-open');
        } else {
          item.style.display = 'none';
        }
      });
    });
  } else {
    panel._currentState = state;
    panel._onDecision = onDecision;
    panel._onBuildStart = onBuildStart;
  }
}

/**
 * Tek bir bina kartını render eder.
 */
function _renderBuildingCard(b, state, catalogMap, depts, budget) {
  const cat = catalogMap[b.type] || {};
  const isCompleted = b.isCompleted;
  const pct = isCompleted ? 100 : (b.constructionProgress ?? 0);
  const isUpg = b.status === 'upgrading';
  const maxLvl = cat.maxLevel || 3;
  const currentLevel = b.level || 1;
  const upgCost = isCompleted && currentLevel < maxLvl
    ? Math.round((cat.cost || 0) * Math.pow((BUILDINGS[b.type]?.upgradeCostMultiplier ?? 1.5), currentLevel))
    : 0;

  const cap = b.currentCapacity || (() => {
     const base = cat.capacity || {};
     const pLvl = cat.capacityPerLevel || {};
     const lvl  = b.level || 1;
     const res  = {};
     for (const k of Object.keys(base)) res[k] = (base[k] || 0) + (pLvl[k] || 0) * (lvl - 1);
     return res;
  })();
  const used = b.usedCapacity || {};

  // Yapım aşamasında kartı
  if (!isCompleted) {
    return `
      <div class="building-card under-construction" style="padding:14px;flex-direction:column;align-items:stretch;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="building-icon">${cat.icon || '🏗️'}</div>
          <div style="flex:1;min-width:0;">
            <div class="building-name" style="margin:0;">
              ${b.name || cat.name || b.type}
              ${isUpg ? ` <span style="font-size:10px;color:#f59e0b;">Düzey ${(b._pendingLevel ?? currentLevel + 1)} yükseltiliyor</span>` : ''}
            </div>
            <div style="font-size:11px;color:#94a3b8;margin-top:2px;">
              ${isUpg ? 'Yükseltme inşaatı devam ediyor' : 'Yeni bina inşası devam ediyor'}
            </div>
          </div>
          <span class="badge badge-warning" style="flex-shrink:0;">🔨 Yapımda</span>
        </div>
        <div class="construction-progress" style="margin-top:10px;">
          <div class="construction-bar" style="height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;">
            <div class="construction-fill" style="width:${pct}%;height:100%;background:#f59e0b;border-radius:3px;transition:width 0.3s;"></div>
          </div>
          <div class="construction-label" style="display:flex;justify-content:space-between;margin-top:4px;font-size:11px;color:#cbd5e1;">
            <span>${isUpg ? 'Yükseltme' : 'Yapım'}: %${pct}</span>
            <span><strong>${b.turnsRemaining ?? '?'} dönem</strong> kaldı</span>
          </div>
        </div>
      </div>
    `;
  }

  // Aktif bina kartı
  const clsSizeByLvl  = cat.classroomSizeByLevel;
  const clsSize       = clsSizeByLvl
    ? (clsSizeByLvl[currentLevel] ?? clsSizeByLvl[1] ?? cat.classroomSize ?? 40)
    : (cat.classroomSize ?? (b.type === 'amfi' ? 150 : 40));
  const totalStudents = state.students ? (state.students.totalEnrolled || 0) : 0;
  const totalFaculty  = (state.faculty || []).length;

  let detailsHtml = '';

  if (b.type === 'fakulte_binasi' || b.type === 'amfi') {
    const studentCapacity = cap.classrooms ? cap.classrooms * clsSize : 0;
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
        </div>` : ''}
      ${cap.offices ? `
        <div style="margin-bottom:6px;">
          <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:3px;">🏢 OFİSLER</div>
          <div style="font-size:11px;color:#cbd5e1;">• ${cap.offices} adet ofis · Kullanılan: ${used.offices ?? 0} · Boş: ${Math.max(0, cap.offices - (used.offices ?? 0))}</div>
        </div>` : ''}
      ${assignedDepts ? `
        <div style="margin-bottom:6px;">
          <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:3px;">📌 ATANMIŞ BÖLÜMLER</div>
          ${assignedDepts}
        </div>` : `
        <div style="font-size:11px;color:#64748b;font-style:italic;margin-bottom:6px;">Henüz bölüm atanmadı</div>
      `}`;
  } else if (b.type === 'kutuphane') {
    const thisDaily   = cap.daily || 800;
    const thisSim     = cap.simultaneous || 200;
    const allLibs     = (state.buildings || []).filter(bld => bld.type === 'kutuphane' && bld.isCompleted);
    const totalDaily  = allLibs.reduce((s, bld) => s + ((bld.currentCapacity?.daily) || 0), 0) || thisDaily;
    const totalSim    = allLibs.reduce((s, bld) => s + ((bld.currentCapacity?.simultaneous) || 0), 0) || thisSim;
    const libDemand   = Math.max(1, Math.round(totalStudents * 0.45));
    const adequacy    = Math.round((totalDaily / libDemand) * 100);
    const sfxIcon     = adequacy >= 100 ? '✅' : adequacy >= 75 ? '⚠️' : '❌';
    const sfxColor    = adequacy >= 100 ? '#4ade80' : adequacy >= 75 ? '#f59e0b' : '#ef4444';
    const sfxText     = adequacy >= 100 ? 'Yeterli' : adequacy >= 75 ? 'Sınırda' : 'Yetersiz';
    detailsHtml = `
      <div style="margin-bottom:6px;">
        <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:3px;">📚 KÜTÜPHANE KAPASİTESİ</div>
        <div style="font-size:11px;color:#cbd5e1;">• Bu bina: ~${thisDaily.toLocaleString('tr-TR')} kişi/gün · ${thisSim} koltuk</div>
        ${allLibs.length > 1 ? `<div style="font-size:11px;color:#cbd5e1;">• Yerleşke toplamı: ${totalDaily.toLocaleString('tr-TR')} kişi/gün · ${totalSim} koltuk (${allLibs.length} kütüphane)</div>` : ''}
        <div style="font-size:11px;color:#cbd5e1;">• Günlük talep: ~${libDemand.toLocaleString('tr-TR')} kişi (%45 katılım · Toplam ${totalStudents.toLocaleString('tr-TR')} öğrenci)</div>
        <div style="font-size:11px;margin-top:3px;">Yeterlilik: <span style="color:${sfxColor};font-weight:600;">${sfxIcon} %${adequacy}</span> <span style="color:${sfxColor};font-size:10px;">(${sfxText})</span></div>
      </div>`;
  } else if (b.type === 'yemekhane') {
    const thisMeals   = cap.dailyMeals || 500;
    const allMeals    = (state.buildings || []).filter(bld => bld.type === 'yemekhane' && bld.isCompleted);
    const totalMeals  = allMeals.reduce((s, bld) => s + ((bld.currentCapacity?.dailyMeals) || 0), 0) || thisMeals;
    const campusPop   = totalStudents + totalFaculty;
    const mealDemand  = Math.max(1, Math.round(campusPop * 0.65));
    const adequacy    = Math.round((totalMeals / mealDemand) * 100);
    const sfxIcon     = adequacy >= 100 ? '✅' : adequacy >= 75 ? '⚠️' : '❌';
    const sfxColor    = adequacy >= 100 ? '#4ade80' : adequacy >= 75 ? '#f59e0b' : '#ef4444';
    const sfxText     = adequacy >= 100 ? 'Yeterli' : adequacy >= 75 ? 'Sınırda' : 'Yetersiz';
    detailsHtml = `
      <div style="margin-bottom:6px;">
        <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:3px;">🍽️ YEMEKHANE KAPASİTESİ</div>
        <div style="font-size:11px;color:#cbd5e1;">• Bu tesis: ${thisMeals.toLocaleString('tr-TR')} öğün/gün</div>
        ${allMeals.length > 1 ? `<div style="font-size:11px;color:#cbd5e1;">• Yerleşke toplamı: ${totalMeals.toLocaleString('tr-TR')} öğün/gün (${allMeals.length} yemekhane)</div>` : ''}
        <div style="font-size:11px;color:#cbd5e1;">• Günlük talep: ~${mealDemand.toLocaleString('tr-TR')} öğün (%65 katılım · Nüfus: ${campusPop.toLocaleString('tr-TR')})</div>
        <div style="font-size:11px;margin-top:3px;">Yeterlilik: <span style="color:${sfxColor};font-weight:600;">${sfxIcon} %${adequacy}</span> <span style="color:${sfxColor};font-size:10px;">(${sfxText})</span></div>
      </div>`;
  } else if (b.type === 'yurt') {
    const thisBeds    = cap.beds || 0;
    const thisUsed    = used.beds ?? Math.min(thisBeds, Math.round(totalStudents * 0.40));
    const ocpPct      = thisBeds > 0 ? Math.round((thisUsed / thisBeds) * 100) : 0;
    const dormRev     = thisUsed * 5_000;
    const allDorms    = (state.buildings || []).filter(bld => bld.type === 'yurt' && bld.isCompleted);
    const totalBeds   = allDorms.reduce((s, bld) => s + ((bld.currentCapacity?.beds) || 0), 0) || thisBeds;
    const dormDemand  = Math.max(1, Math.round(totalStudents * 0.40));
    const adequacy    = Math.round((totalBeds / dormDemand) * 100);
    const sfxIcon     = adequacy >= 100 ? '✅' : adequacy >= 65 ? '⚠️' : '❌';
    const sfxColor    = adequacy >= 100 ? '#4ade80' : adequacy >= 65 ? '#f59e0b' : '#ef4444';
    const sfxText     = adequacy >= 100 ? 'Yeterli' : adequacy >= 65 ? 'Sınırda' : 'Yetersiz';
    detailsHtml = `
      <div style="margin-bottom:6px;">
        <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:3px;">🛏️ YURT YATAK KAPASİTESİ</div>
        <div style="font-size:11px;color:#cbd5e1;">• Bu yurt: ${thisBeds.toLocaleString('tr-TR')} yatak · Dolu: ${thisUsed.toLocaleString('tr-TR')} (%${ocpPct})</div>
        ${allDorms.length > 1 ? `<div style="font-size:11px;color:#cbd5e1;">• Yerleşke toplamı: ${totalBeds.toLocaleString('tr-TR')} yatak (${allDorms.length} yurt)</div>` : ''}
        <div style="font-size:11px;color:#cbd5e1;">• Yurt talebi: ~${dormDemand.toLocaleString('tr-TR')} öğrenci (%40 talep · Toplam ${totalStudents.toLocaleString('tr-TR')} öğrenci)</div>
        <div style="font-size:11px;margin-top:3px;">Yurt Kapsaması: <span style="color:${sfxColor};font-weight:600;">${sfxIcon} %${adequacy}</span> <span style="color:${sfxColor};font-size:10px;">(${sfxText})</span> · 💰 Gelir: ${formatMoney(dormRev)}/dönem</div>
      </div>`;
  } else if (b.type === 'idari_bina') {
    const thisOffices = cap.offices || 0;
    const allAdmin    = (state.buildings || []).filter(bld => bld.type === 'idari_bina' && bld.isCompleted);
    const totalOffices= allAdmin.reduce((s, bld) => s + ((bld.currentCapacity?.offices) || 0), 0) || thisOffices;
    const adminStaff  = (state.adminStaff || []).length;
    const ocpPct      = totalOffices > 0 ? Math.round((adminStaff / totalOffices) * 100) : 0;
    const isSuff      = adminStaff <= totalOffices;
    const sfxIcon     = isSuff ? '✅' : '❌';
    const sfxColor    = isSuff ? '#4ade80' : '#ef4444';
    detailsHtml = `
      <div style="margin-bottom:6px;">
        <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:3px;">🏢 İDARİ OFİS KAPASİTESİ</div>
        <div style="font-size:11px;color:#cbd5e1;">• Bu bina: ${thisOffices} ofis</div>
        ${allAdmin.length > 1 ? `<div style="font-size:11px;color:#cbd5e1;">• Yerleşke toplamı: ${totalOffices} ofis (${allAdmin.length} idari bina)</div>` : ''}
        <div style="font-size:11px;color:#cbd5e1;">• İdari personel: ${adminStaff} kişi · Ofis Doluluğu: %${ocpPct}</div>
        <div style="font-size:11px;margin-top:3px;">Yeterlilik: <span style="color:${sfxColor};font-weight:600;">${sfxIcon} ${isSuff ? `Yeterli (${totalOffices - adminStaff} boş ofis)` : `Yetersiz (${adminStaff - totalOffices} ofis açığı)`}</span></div>
      </div>`;
  } else if (b.type === 'spor_tesisi') {
    const thisCap     = cap.dailyUsers || 500;
    const allSpor     = (state.buildings || []).filter(bld => bld.type === 'spor_tesisi' && bld.isCompleted);
    const totalCap    = allSpor.reduce((s, bld) => s + ((bld.currentCapacity?.dailyUsers) || 0), 0) || thisCap;
    const sporDemand  = Math.max(1, Math.round(totalStudents * 0.35));
    const adequacy    = Math.round((totalCap / sporDemand) * 100);
    const sfxIcon     = adequacy >= 100 ? '✅' : adequacy >= 75 ? '⚠️' : '❌';
    const sfxColor    = adequacy >= 100 ? '#4ade80' : adequacy >= 75 ? '#f59e0b' : '#ef4444';
    const sfxText     = adequacy >= 100 ? 'Yeterli' : adequacy >= 75 ? 'Sınırda' : 'Yetersiz';
    detailsHtml = `
      <div style="margin-bottom:6px;">
        <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:3px;">🏃‍♂️ GÜNLÜK SPOR KAPASİTESİ</div>
        <div style="font-size:11px;color:#cbd5e1;">• Bu tesis: ~${thisCap.toLocaleString('tr-TR')} kişi/gün</div>
        ${allSpor.length > 1 ? `<div style="font-size:11px;color:#cbd5e1;">• Yerleşke toplamı: ${totalCap.toLocaleString('tr-TR')} kişi/gün (${allSpor.length} tesis)</div>` : ''}
        <div style="font-size:11px;color:#cbd5e1;">• Günlük talep: ~${sporDemand.toLocaleString('tr-TR')} kişi (%35 katılım · Toplam ${totalStudents.toLocaleString('tr-TR')} öğrenci)</div>
        <div style="font-size:11px;margin-top:3px;">Yeterlilik: <span style="color:${sfxColor};font-weight:600;">${sfxIcon} %${adequacy}</span> <span style="color:${sfxColor};font-size:10px;">(${sfxText})</span></div>
      </div>`;
  } else if (b.type === 'lab') {
    const linkedNames = (b.linkedDepartments || []).map(dId => {
      const d = depts.find(dep => dep.id === dId);
      return d ? (d.shortName || d.name) : null;
    }).filter(Boolean);
    const labBonus = (b.level || 1) * 25;
    detailsHtml = `
      <div style="margin-bottom:6px;">
        <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:3px;">🧪 LABORATUVAR KAPASİTESİ</div>
        <div style="font-size:11px;color:#cbd5e1;">• ${cap.labs || 0} adet araştırma ve eğitim laboratuvarı</div>
        <div style="font-size:11px;color:#4ade80;margin-top:2px;">• Bölüm Lab Bonusu: +${labBonus} puan</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:4px;">Bağlı Bölümler: <span style="color:#e2e8f0;">${linkedNames.length > 0 ? linkedNames.join(', ') : 'Henüz bağlı bölüm yok'}</span></div>
      </div>`;
  } else if (b.type === 'arastirma_merkezi') {
    const assignedNames = (b.assignedDepartments || []).map(dId => {
      const d = depts.find(dep => dep.id === dId);
      return d ? (d.shortName || d.name) : null;
    }).filter(Boolean);
    detailsHtml = `
      <div style="margin-bottom:6px;">
        <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:3px;">🔬 MERKEZİ ARAŞTIRMA</div>
        <div style="font-size:11px;color:#cbd5e1;">• ${cap.labs || 0} lab · ${cap.offices || 0} araştırma ofisi</div>
        <div style="font-size:11px;color:#4ade80;margin-top:2px;">• Atanan bölümlere +%15 araştırma çıktısı bonusu</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:4px;">Atanan Bölümler: <span style="color:#e2e8f0;">${assignedNames.length > 0 ? assignedNames.join(', ') : 'Henüz bölüm atanmadı'}</span></div>
      </div>`;
  } else if (b.type === 'saglik_merkezi') {
    const dailyCap    = cap.dailyPatients || 100;
    const allHealth   = (state.buildings || []).filter(bld => bld.type === 'saglik_merkezi' && bld.isCompleted);
    const totalCap    = allHealth.reduce((s, bld) => s + ((bld.currentCapacity?.dailyPatients) || 0), 0) || dailyCap;
    const campusPop   = totalStudents + totalFaculty;
    const expPatients = Math.max(1, Math.round(campusPop * 0.04));
    const adequacy    = Math.round((totalCap / expPatients) * 100);
    const sfxIcon     = adequacy >= 100 ? '✅' : adequacy >= 70 ? '⚠️' : '❌';
    const sfxColor    = adequacy >= 100 ? '#4ade80' : adequacy >= 70 ? '#f59e0b' : '#ef4444';
    const sfxText     = adequacy >= 100 ? 'Yeterli' : adequacy >= 70 ? 'Yoğun' : 'Yetersiz';
    detailsHtml = `
      <div style="margin-bottom:6px;">
        <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:3px;">🏥 SAĞLIK MERKEZİ KAPASİTESİ</div>
        <div style="font-size:11px;color:#cbd5e1;">• Bu merkez: ~${dailyCap.toLocaleString('tr-TR')} hasta/gün</div>
        ${allHealth.length > 1 ? `<div style="font-size:11px;color:#cbd5e1;">• Yerleşke toplamı: ~${totalCap.toLocaleString('tr-TR')} hasta/gün (${allHealth.length} merkez)</div>` : ''}
        <div style="font-size:11px;color:#cbd5e1;">• Beklenen başvuru: ~${expPatients.toLocaleString('tr-TR')} hasta/gün (Nüfus: ${campusPop.toLocaleString('tr-TR')})</div>
        <div style="font-size:11px;margin-top:3px;">Yeterlilik: <span style="color:${sfxColor};font-weight:600;">${sfxIcon} %${adequacy}</span> <span style="color:${sfxColor};font-size:10px;">(${sfxText})</span></div>
      </div>`;
  } else if (b.type === 'konferans') {
    detailsHtml = `
      <div style="margin-bottom:6px;">
        <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:3px;">🎤 ETKİNLİK MERKEZİ</div>
        <div style="font-size:11px;color:#cbd5e1;">• Uluslararası sempozyum, kongre ve konferans ev sahipliği</div>
        <div style="font-size:11px;color:#4ade80;margin-top:2px;">• Saygınlık ve dönemsel etkinlik geliri bonusu</div>
      </div>`;
  } else if (b.type === 'teknokent') {
    detailsHtml = `
      <div style="margin-bottom:6px;">
        <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:3px;">🏢 GİRİŞİMCİLİK & TEKNOLOJİ</div>
        <div style="font-size:11px;color:#cbd5e1;">• Spin-off şirketler ve sanayi iş birliği ekosistemi</div>
        <div style="font-size:11px;color:#4ade80;margin-top:2px;">• Yıllık kira geliri ve yüksek co-op eşleştirme kalitesi</div>
      </div>`;
  } else if (b.type === 'ulasim_merkezi') {
    detailsHtml = `
      <div style="margin-bottom:6px;">
        <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:3px;">🚌 YERLEŞKE ULAŞIMI</div>
        <div style="font-size:11px;color:#cbd5e1;">• Ring/servis araçları durağı ve otopark merkezi</div>
        <div style="font-size:11px;color:#4ade80;margin-top:2px;">• Öğrenci ulaşım memnuniyeti ve erişim kolaylığı</div>
      </div>`;
  } else {
    detailsHtml = `
      ${cap.offices    ? _capacityBar('Ofis',    used.offices    ?? 0, cap.offices)    : ''}
      ${cap.classrooms ? _capacityBar('Derslik', used.classrooms ?? 0, cap.classrooms) : ''}
      ${cap.labs       ? _capacityBar('Lab',     used.labs       ?? 0, cap.labs)       : ''}
      ${cap.beds       ? _capacityBar('Yatak',   used.beds       ?? 0, cap.beds)       : ''}
      ${cat.benefitText ? `<div style="margin-top:6px;font-size:11px;color:#64748b;font-style:italic;">${cat.benefitText}</div>` : ''}`;
  }

  const upgradePreviewHtml = _renderUpgradePreviewHtml(b, cat, currentLevel, maxLvl);

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
        📐 ${(b.area || 0).toLocaleString('tr-TR')} m² · 🔧 Bakım: <span style="color:#e2e8f0;">${formatMoney(b.maintenanceCost || 0)}/dönem</span>
      </div>
      <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:8px;margin-bottom:6px;">
        ${detailsHtml}
      </div>
      ${upgradePreviewHtml}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);">
        ${isUpg ? `
          <span class="badge badge-warning" style="font-size:11px;padding:5px 10px;display:inline-flex;align-items:center;gap:4px;">
            🔨 Düzey ${b._pendingLevel ?? currentLevel + 1} yükseltiliyor (%${b.constructionProgress ?? 0} · ${b.turnsRemaining ?? 1} dönem kaldı)
          </span>
        ` : upgCost > 0 ? `
          <button class="btn-campus-upgrade btn-small" data-building-id="${b.id}" ${budget < upgCost ? 'disabled' : ''} style="font-size:11px;">
            ▲ Yükselt (${formatMoney(upgCost)})
          </button>` : `<span style="font-size:11px;color:#64748b;align-self:center;">Maks. düzey</span>`}
        ${cat.assignable ? `
        <button class="btn-campus-assign btn-small" data-building-id="${b.id}" style="font-size:11px;">
          ${b.type === 'lab' ? '🔗 Lab Bağla' : '📌 Bölüm Ata'}
        </button>` : ''}
      </div>
    </div>`;
}

/**
 * Grup altındaki "Bir Tane Daha İnşa Et" / "Yeni İnşa Et" footer kartını üretir.
 */
function _renderBuildFooter(cat, catBuildings, budget, state) {
  const completed = catBuildings.filter(b => b.isCompleted);
  const inProgress = catBuildings.filter(b => !b.isCompleted);
  const completedCount = completed.length;
  const inProgressCount = inProgress.length;

  // Tekil yapı ve zaten inşa edilmiş
  if (!cat.canHaveMultiple && completedCount > 0) {
    return `
      <div class="campus-build-footer single-owned" style="opacity:0.85;background:rgba(255,255,255,0.02);border-style:solid;">
        <div class="campus-build-footer-icon" style="color:var(--accent-green,#4ade80);font-size:22px;">✓</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;font-weight:700;color:var(--text);">Tekil Yapı — Yerleşkede Mevcut (Maks. 1 adet)</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Bu bina tipi üniversite bünyesinde tekildir. Mevcut binanın düzeyini yukarıdaki "Yükselt" butonu ile artırabilirsiniz.</div>
        </div>
      </div>
    `;
  }

  // Şu anda yapım aşamasında
  if (inProgressCount > 0) {
    const inProg = inProgress[0];
    const pct = inProg.constructionProgress ?? 0;
    const turns = inProg.turnsRemaining ?? 1;
    return `
      <div class="campus-build-footer in-progress" style="background:rgba(245,158,11,0.06);border-color:rgba(245,158,11,0.3);border-style:dashed;">
        <div class="campus-build-footer-icon" style="color:var(--accent-yellow,#f59e0b);font-size:22px;">🔨</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;font-weight:700;color:var(--accent-yellow,#f59e0b);">İnşaat Devam Ediyor</div>
          <div style="font-size:11px;color:#cbd5e1;margin-top:2px;">
            Şu anda bir ${cat.name} yapım aşamasındadır (%${pct} tamamlandı · <strong>${turns} dönem</strong> sonra aktif olacak).
          </div>
        </div>
      </div>
    `;
  }

  // Yeni inşa başlatılabilir
  const canAfford = budget >= cat.cost;
  const effects = _formatBuildingEffects({ ...cat.qualityEffects, ...cat.effects });

  return `
    <div class="campus-build-footer can-build ${canAfford ? '' : 'disabled'}" data-build-type="${cat.type}" style="${canAfford ? 'cursor:pointer;' : 'opacity:0.6;cursor:not-allowed;'}">
      <div class="campus-build-footer-icon" style="color:var(--accent-green,#4ade80);">🏗️</div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
          <span style="font-size:13px;font-weight:700;color:var(--text);">
            ${completedCount > 0 ? `➕ Bir Tane Daha ${cat.name} İnşa Et` : `➕ Yeni ${cat.name} İnşa Et`}
          </span>
          <span class="badge ${canAfford ? 'badge-warning' : 'badge-danger'}" style="font-size:12px;font-weight:700;">
            💰 ${formatMoney(cat.cost)}
          </span>
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${cat.desc || ''}</div>
        ${effects.length > 0 ? `<div style="margin-top:4px;font-size:11px;color:var(--accent-green,#4ade80);line-height:1.5;">${effects.map(e => `<span>▸ ${e} </span>`).join('')}</div>` : ''}
        <div style="display:flex;gap:14px;margin-top:6px;font-size:11px;color:#94a3b8;flex-wrap:wrap;">
          <span>⏱ <strong>${cat.constructionTime} dönem</strong></span>
          <span>📐 <strong>${(cat.baseArea || 0).toLocaleString('tr-TR')} m²</strong></span>
          ${canAfford
            ? '<span style="color:var(--accent-green,#4ade80);font-weight:600;">▸ İnşaatı Başlatmak İçin Tıklayın</span>'
            : `<span style="color:var(--accent,#ef4444);font-weight:600;">▸ Yetersiz Bütçe (${formatMoney(cat.cost - budget)} eksik)</span>`}
        </div>
      </div>
    </div>
  `;
}

/**
 * Akordeon başlığı için özet metni üretir.
 */
function _getGroupSummarySnippet(cat, bList, state) {
  const completed = bList.filter(b => b.isCompleted);
  const inProg = bList.filter(b => !b.isCompleted);
  const count = completed.length;

  if (count === 0 && inProg.length === 0) {
    return cat.desc || 'Henüz inşa edilmedi';
  }

  let parts = [];
  if (count > 0) parts.push(`${count} aktif bina`);
  if (inProg.length > 0) parts.push(`${inProg.length} yapım aşamasında`);

  if (cat.type === 'fakulte_binasi' || cat.type === 'amfi') {
    let totOffices = 0, totClassrooms = 0;
    completed.forEach(b => {
      const cap = b.currentCapacity || {};
      totOffices += cap.offices || 0;
      totClassrooms += cap.classrooms || 0;
    });
    if (totClassrooms > 0 || totOffices > 0) {
      parts.push(`${totClassrooms} derslik · ${totOffices} ofis`);
    }
  } else if (cat.type === 'yurt') {
    let totBeds = 0;
    completed.forEach(b => { totBeds += (b.currentCapacity?.beds || 0); });
    if (totBeds > 0) parts.push(`${totBeds.toLocaleString('tr-TR')} yatak kapasitesi`);
  } else if (cat.type === 'kutuphane') {
    let totDaily = 0;
    completed.forEach(b => { totDaily += (b.currentCapacity?.daily || 0); });
    if (totDaily > 0) parts.push(`~${totDaily.toLocaleString('tr-TR')} kişi/gün`);
  } else if (cat.type === 'yemekhane') {
    let totMeals = 0;
    completed.forEach(b => { totMeals += (b.currentCapacity?.dailyMeals || 0); });
    if (totMeals > 0) parts.push(`${totMeals.toLocaleString('tr-TR')} öğün/gün`);
  } else if (cat.type === 'spor_tesisi') {
    let totUsers = 0;
    completed.forEach(b => { totUsers += (b.currentCapacity?.dailyUsers || 0); });
    if (totUsers > 0) parts.push(`~${totUsers.toLocaleString('tr-TR')} kişi/gün`);
  } else if (cat.type === 'lab') {
    let totLabs = 0;
    completed.forEach(b => { totLabs += (b.currentCapacity?.labs || 0); });
    if (totLabs > 0) parts.push(`${totLabs} laboratuvar birimi`);
  } else if (cat.type === 'arastirma_merkezi') {
    let totLabs = 0, totOffices = 0;
    completed.forEach(b => {
      totLabs += (b.currentCapacity?.labs || 0);
      totOffices += (b.currentCapacity?.offices || 0);
    });
    if (totLabs > 0) parts.push(`${totLabs} lab · ${totOffices} araştırma ofisi`);
  } else if (cat.type === 'saglik_merkezi') {
    let totPatients = 0;
    completed.forEach(b => { totPatients += (b.currentCapacity?.dailyPatients || 0); });
    if (totPatients > 0) parts.push(`~${totPatients} hasta/gün`);
  } else if (cat.type === 'idari_bina') {
    let totOffices = 0;
    completed.forEach(b => { totOffices += (b.currentCapacity?.offices || 0); });
    if (totOffices > 0) parts.push(`${totOffices} idari ofis`);
  }

  return parts.join(' · ');
}

/**
 * Bölüm / Lab atama modalı
 */
function _showDepartmentAssignModal(state, building, onDecision) {
  const allDepts = state.departments || [];
  const allBuildings = state.buildings || [];
  const isLab = building.type === 'lab';

  function _buildRowsHtml() {
    if (allDepts.length === 0) {
      return '<div style="color:var(--text-muted);padding:12px;text-align:center;">Henüz hiç bölüm kurulmamış.</div>';
    }
    return allDepts.map(dept => {
      const assignedHere = (isLab ? building.linkedDepartments : building.assignedDepartments)?.includes(dept.id);
      const otherBld = assignedHere ? null : allBuildings.find(b => b.id !== building.id && !isLab && b.type !== 'lab' && (b.assignedDepartments || []).includes(dept.id));
      
      let statusHtml = '';
      let action = '';
      let fromId = otherBld?.id || '';

      if (assignedHere) {
        statusHtml = `<span style="font-size:11px;font-weight:600;padding:4px 10px;border-radius:6px;background:rgba(74,222,128,0.15);color:#4ade80;border:1px solid rgba(74,222,128,0.3);">✅ Bağlı <span style="font-size:10px;opacity:0.8;margin-left:4px;">(Kaldır)</span></span>`;
        action = 'unassign';
      } else if (otherBld) {
        const otherName = otherBld.name || otherBld.id;
        statusHtml = `<span style="font-size:11px;font-weight:600;padding:4px 10px;border-radius:6px;background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);">📍 ${otherName} <span style="font-size:10px;margin-left:4px;">(Taşı)</span></span>`;
        action = 'move';
      } else {
        statusHtml = `<span style="font-size:11px;font-weight:600;padding:4px 10px;border-radius:6px;background:rgba(99,102,241,0.15);color:#818cf8;border:1px solid rgba(99,102,241,0.3);">➕ Ata</span>`;
        action = 'assign';
      }

      return `
        <div class="dept-row" data-dept-id="${dept.id}" data-action="${action}" data-from="${fromId}"
             style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg-secondary);border-radius:8px;cursor:pointer;transition:background 0.15s, border-color 0.15s;border:1px solid transparent;"
             onmouseover="this.style.background='var(--bg-card-hover, rgba(255,255,255,0.06))'"
             onmouseout="this.style.background='var(--bg-secondary)'">
          <div>
            <span style="font-weight:600;font-size:13px;color:var(--text-primary);">${dept.name}</span>
            <span style="font-size:11px;color:var(--text-muted);margin-left:6px;">(${dept.facultyId || ''})</span>
          </div>
          <div>${statusHtml}</div>
        </div>`;
    }).join('');
  }

  function _buildFullModalHtml() {
    const hint = isLab
      ? 'Laboratuvarlar birden fazla bölüme bağlanabilir ve bağlı tüm bölümlere araştırma/eğitim puanı bonusu kazandırır.'
      : 'Bölümleri bu binaya atayabilir, kaldırabilir veya başka binadan taşıyabilirsiniz. Değiştirmek istediğiniz bölüme tıklayın.';

    return `
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">
        ${hint}
      </div>
      <div id="dept-assign-list-container" style="display:flex;flex-direction:column;gap:6px;max-height:420px;overflow-y:auto;padding-right:4px;">
        ${_buildRowsHtml()}
      </div>
      <div style="margin-top:16px;display:flex;justify-content:flex-end;">
        <button class="btn btn-primary" id="btn-close-dept-assign" style="padding:6px 22px;font-size:13px;font-weight:600;">Tamam</button>
      </div>`;
  }

  const modalTitle = isLab ? `Lab Bağla — ${building.name}` : `Bölüm Ata — ${building.name}`;
  showModal(modalTitle, _buildFullModalHtml());

  const modalBody = el('general-modal-body');
  if (!modalBody) return;

  if (modalBody._deptAssignHandler) {
    modalBody.removeEventListener('click', modalBody._deptAssignHandler);
  }

  modalBody._deptAssignHandler = (ev) => {
    if (ev.target.closest('#btn-close-dept-assign')) {
      hideModal();
      return;
    }

    const row = ev.target.closest('.dept-row');
    if (!row) return;
    const { deptId, action, from } = row.dataset;
    if (!deptId || !action) return;

    if (action === 'assign') {
      onDecision({ type: 'assign_department_to_building', buildingId: building.id, departmentId: deptId });
      if (isLab) {
        if (!building.linkedDepartments) building.linkedDepartments = [];
        if (!building.linkedDepartments.includes(deptId)) building.linkedDepartments.push(deptId);
      } else {
        if (!building.assignedDepartments) building.assignedDepartments = [];
        if (!building.assignedDepartments.includes(deptId)) building.assignedDepartments.push(deptId);
      }
    } else if (action === 'unassign') {
      onDecision({ type: 'unassign_department_from_building', buildingId: building.id, departmentId: deptId });
      if (isLab) {
        building.linkedDepartments = (building.linkedDepartments || []).filter(id => id !== deptId);
      } else {
        building.assignedDepartments = (building.assignedDepartments || []).filter(id => id !== deptId);
      }
    } else if (action === 'move') {
      const srcBuilding = allBuildings.find(b => b.id === from);
      const srcName = srcBuilding?.name || from || 'diğer bina';
      const dept = allDepts.find(d => d.id === deptId);
      const deptName = dept?.name || deptId;
      if (confirm(`${deptName} bölümü ${srcName} binasından bu binaya taşınsın mı?`)) {
        onDecision({ type: 'unassign_department_from_building', buildingId: from, departmentId: deptId });
        onDecision({ type: 'assign_department_to_building', buildingId: building.id, departmentId: deptId });
        if (srcBuilding?.assignedDepartments) {
          srcBuilding.assignedDepartments = srcBuilding.assignedDepartments.filter(id => id !== deptId);
        }
        if (!building.assignedDepartments) building.assignedDepartments = [];
        if (!building.assignedDepartments.includes(deptId)) building.assignedDepartments.push(deptId);
      } else {
        return;
      }
    }

    const listContainer = el('dept-assign-list-container');
    if (listContainer) {
      listContainer.innerHTML = _buildRowsHtml();
    }
  };

  modalBody.addEventListener('click', modalBody._deptAssignHandler);
}

/**
 * Bina düzey yükseltme önizleme HTML'i.
 */
function _renderUpgradePreviewHtml(b, cat, currentLevel, maxLvl) {
  const isUpgrading = b.status === 'upgrading';
  if (currentLevel >= maxLvl && !isUpgrading) return '';

  const targetLevel = isUpgrading ? (b._pendingLevel ?? currentLevel + 1) : currentLevel + 1;
  const bDef = BUILDINGS[b.type] || {};
  const baseCap = bDef.capacity || {};
  const pLvl = bDef.capacityPerLevel || {};

  const curCap = b.currentCapacity || (() => {
    const res = {};
    for (const k of Object.keys(baseCap)) res[k] = (baseCap[k] || 0) + (pLvl[k] || 0) * (currentLevel - 1);
    return res;
  })();

  const nextCap = {};
  for (const k of Object.keys(baseCap)) {
    nextCap[k] = (baseCap[k] || 0) + (pLvl[k] || 0) * (targetLevel - 1);
  }

  const baseArea = bDef.baseArea ?? 1000;
  const areaPerLvl = bDef.areaPerLevel ?? 0;
  const curArea = b.area ?? (baseArea + areaPerLvl * (currentLevel - 1));
  const nextArea = baseArea + areaPerLvl * (targetLevel - 1);
  const diffArea = nextArea - curArea;

  const mCostPerM2 = bDef.maintenanceCostPerM2 ?? 50;
  const curMaint = b.maintenanceCost ?? Math.round(curArea * mCostPerM2);
  const nextMaint = Math.round(nextArea * mCostPerM2);
  const diffMaint = nextMaint - curMaint;

  const clsSizeByLvl = cat.classroomSizeByLevel;
  const curClsSize = clsSizeByLvl ? (clsSizeByLvl[currentLevel] ?? cat.classroomSize ?? 40) : (cat.classroomSize ?? (b.type === 'amfi' ? 150 : 40));
  const nextClsSize = clsSizeByLvl ? (clsSizeByLvl[targetLevel] ?? curClsSize) : curClsSize;

  const turns = bDef.constructionTurns ?? bDef.constructionTime ?? 1;
  const items = [];

  if (baseCap.classrooms != null || pLvl.classrooms != null) {
    const curTotal = (curCap.classrooms || 0) * curClsSize;
    const nextTotal = (nextCap.classrooms || 0) * nextClsSize;
    const diffCls = (nextCap.classrooms || 0) - (curCap.classrooms || 0);
    const diffTotal = nextTotal - curTotal;

    if (b.type === 'amfi') {
      items.push(`Amfi Sayısı: <strong>${curCap.classrooms || 0} ➔ ${nextCap.classrooms} adet</strong> (+${diffCls} amfi × ${nextClsSize} kişilik)`);
      items.push(`Toplam Kapasite: <strong>${curTotal.toLocaleString('tr-TR')} ➔ ${nextTotal.toLocaleString('tr-TR')} öğrenci</strong> (+${diffTotal.toLocaleString('tr-TR')})`);
    } else {
      items.push(`Derslik Sayısı: <strong>${curCap.classrooms || 0} ➔ ${nextCap.classrooms} adet</strong> (+${diffCls} derslik × ${nextClsSize} kişilik)`);
      if (diffTotal > 0) {
        items.push(`Öğrenci Kapasitesi: <strong>${curTotal.toLocaleString('tr-TR')} ➔ ${nextTotal.toLocaleString('tr-TR')}</strong> (+${diffTotal.toLocaleString('tr-TR')})`);
      }
    }
  }

  if (baseCap.offices != null || pLvl.offices != null) {
    const diffOff = (nextCap.offices || 0) - (curCap.offices || 0);
    if (diffOff > 0 || nextCap.offices > 0) {
      items.push(`Ofis Sayısı: <strong>${curCap.offices || 0} ➔ ${nextCap.offices} adet</strong> (+${diffOff} ofis)`);
    }
  }

  if (baseCap.labs != null || pLvl.labs != null) {
    const diffLab = (nextCap.labs || 0) - (curCap.labs || 0);
    if (diffLab > 0 || nextCap.labs > 0) {
      items.push(`Laboratuvar Sayısı: <strong>${curCap.labs || 0} ➔ ${nextCap.labs} adet</strong> (+${diffLab} lab)`);
    }
  }

  if (baseCap.beds != null || pLvl.beds != null) {
    const diffBeds = (nextCap.beds || 0) - (curCap.beds || 0);
    const revPerBed = bDef.revenuePerBedPerSemester || 5_000;
    items.push(`Yatak Kapasitesi: <strong>${(curCap.beds || 0).toLocaleString('tr-TR')} ➔ ${(nextCap.beds || 0).toLocaleString('tr-TR')}</strong> (+${diffBeds.toLocaleString('tr-TR')} yatak)`);
    items.push(`Yurt Gelir Potansiyeli: <strong>+${formatMoney(diffBeds * revPerBed)}/dönem</strong>`);
  }

  if (baseCap.dailyMeals != null || pLvl.dailyMeals != null) {
    const diffMeals = (nextCap.dailyMeals || 0) - (curCap.dailyMeals || 0);
    items.push(`Yemekhane Kapasitesi: <strong>${(curCap.dailyMeals || 0).toLocaleString('tr-TR')} ➔ ${(nextCap.dailyMeals || 0).toLocaleString('tr-TR')} öğün/gün</strong> (+${diffMeals.toLocaleString('tr-TR')})`);
  }

  if (baseCap.dailyUsers != null || pLvl.dailyUsers != null) {
    const diffUsers = (nextCap.dailyUsers || 0) - (curCap.dailyUsers || 0);
    items.push(`Sporcu Kapasitesi: <strong>${(curCap.dailyUsers || 0).toLocaleString('tr-TR')} ➔ ${(nextCap.dailyUsers || 0).toLocaleString('tr-TR')} kişi/gün</strong> (+${diffUsers.toLocaleString('tr-TR')})`);
  }

  if (baseCap.daily != null || pLvl.daily != null) {
    const diffDaily = (nextCap.daily || 0) - (curCap.daily || 0);
    items.push(`Günlük Hizmet: <strong>${(curCap.daily || 0).toLocaleString('tr-TR')} ➔ ${(nextCap.daily || 0).toLocaleString('tr-TR')} öğrenci/gün</strong> (+${diffDaily.toLocaleString('tr-TR')})`);
    if (nextCap.simultaneous) {
      const diffSim = (nextCap.simultaneous || 0) - (curCap.simultaneous || 0);
      items.push(`Eşzamanlı Çalışma: <strong>${curCap.simultaneous || 0} ➔ ${nextCap.simultaneous} koltuk</strong> (+${diffSim})`);
    }
  }

  if (baseCap.dailyPatients != null || pLvl.dailyPatients != null) {
    const diffPatients = (nextCap.dailyPatients || 0) - (curCap.dailyPatients || 0);
    items.push(`Poliklinik Kapasitesi: <strong>${curCap.dailyPatients || 0} ➔ ${nextCap.dailyPatients} hasta/gün</strong> (+${diffPatients})`);
  }

  if (diffArea > 0) {
    items.push(`Yerleşke Alanı: <strong>+${diffArea.toLocaleString('tr-TR')} m²</strong> (toplam ${nextArea.toLocaleString('tr-TR')} m²)`);
  }
  if (diffMaint > 0) {
    items.push(`Dönemlik Bakım: <strong>+${formatMoney(diffMaint)}</strong> (yeni bakım: ${formatMoney(nextMaint)}/dönem)`);
  }

  const specialEffects = {
    lab: '🧪 Atandığı bölümlere +25 puan ek lab skoru sağlar (toplam ' + (targetLevel * 25) + ' puan)',
    arastirma_merkezi: '🔬 Araştırma çıktısı, TÜBİTAK proje kabul oranı ve yayın hızı artışı',
    spor_tesisi: '⚽ Öğrenci memnuniyeti (+7), talep (+%3) ve stres azaltma bonusu',
    yemekhane: '🍽️ Öğrenci (+6) ve hoca (+4) yemek memnuniyeti artışı',
    kutuphane: '📚 Öğrenci GPA (+0.1), araştırma çıktısı (+5) ve memnuniyet katkısı',
    yurt: '🏠 Öğrenci memnuniyeti (+8) ve şehir dışı öğrenci talebi (+%5)',
    konferans: '🎤 Uluslararasılaşma (+8), saygınlık (+4) ve etkinlik geliri artışı',
    saglik_merkezi: '🏥 Öğrenci (+5) ve personel (+3) sağlık & refah memnuniyeti',
    idari_bina: '🏛️ İdari birim verimliliği (+15) ve yönetim skoru (+10)',
    teknokent: '🏢 Sektör bağı (+20), co-op/staj kalitesi (+25) ve spin-off kira geliri',
    ulasim_merkezi: '🚌 Ring ve servis hizmetleri verimliliği (+10 ulaşım skoru)',
    amfi: '🏫 Büyük sınıf kapasitesi ve eğitim kalitesi (+3) artışı',
    fakulte_binasi: '🏛️ Bölüm eğitim kalitesi (+5) ve öğrenci memnuniyeti (+3)',
  };

  if (specialEffects[b.type]) {
    items.push(`<span style="color:#4ade80;">▸ ${specialEffects[b.type]}</span>`);
  }

  const headerTitle = isUpgrading
    ? `🔨 Düzey ${targetLevel} Yükseltmesi Devam Ediyor`
    : `▲ Düzey ${targetLevel} Yükseltme Avantajları`;
  const headerBadge = isUpgrading
    ? `⏱ ${b.turnsRemaining ?? 1} dönem kaldı`
    : `⏱ ${turns} dönem sürer`;

  return `
    <div style="margin-top:8px;padding:9px 12px;background:rgba(59,130,246,0.06);border:1px dashed rgba(59,130,246,0.3);border-radius:8px;font-size:11px;">
      <div style="font-weight:700;color:#60a5fa;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;">
        <span>${headerTitle}</span>
        <span style="font-size:10px;color:#94a3b8;font-weight:normal;">${headerBadge}</span>
      </div>
      <div style="color:#cbd5e1;line-height:1.6;">
        ${items.map(it => `<div>• ${it}</div>`).join('')}
      </div>
    </div>
  `;
}
