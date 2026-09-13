import { el, on, formatMoney, showModal, hideModal, createStatBar, _statColor } from './ui_base.js';
import { ADMIN_UNITS, ADMIN_TITLES, ADMIN_UNIT_BUILDINGS } from '../data.js?v=0.4.76';
import { getUnitTitles, getUnitTitleSalary, isUnitManagerTitle, getNextUnitTitle } from '../game.js?v=0.4.76';

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

  // Genel kalite için renk hesapla
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

  function _initials(name) {
    return (name || '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  const TITLE_ORDER = ['Memur', 'Uzman', 'Şef', 'Müdür Yrd.', 'Müdür'];

  function _nextTitle(title, unitId) {
    if (typeof getNextUnitTitle === 'function' && unitId) {
      return getNextUnitTitle(unitId, title);
    }
    const titles = unitId ? getUnitTitles(unitId) : TITLE_ORDER;
    let idx = titles.indexOf(title);
    if (idx < 0) {
      let legIdx = TITLE_ORDER.indexOf(title);
      if (legIdx < 0) {
        if (title === 'Müdür' || (title && title.endsWith('Müdürü'))) legIdx = titles.length - 1;
        else if (title === 'Müdür Yrd.' || title === 'Müdür Yardımcısı') legIdx = Math.max(0, titles.length - 2);
      }
      if (legIdx >= 0 && legIdx < titles.length) idx = legIdx;
    }
    return (idx >= 0 && idx < titles.length - 1) ? titles[idx + 1] : null;
  }

  function _adminStaffCard(m) {
    const quality        = m.quality || 0;
    const ratingColor    = _adminRatingColor(quality);
    const ratingBg       = _adminRatingBg(quality);
    const nextTitleName  = _nextTitle(m.title, m.unit);
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

    const promotionBorder = (m.promotionEligible && nextTitleName)
      ? 'border-left:4px solid #f5a623;'
      : '';
    return `
      <div class="faculty-card admin-staff-card" data-admin-staff-id="${m.id}" style="cursor:pointer;${promotionBorder}">
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
            ? `<button class="btn btn-sm btn-primary" style="font-size:10px;animation:adminPromotePulse 1.6s infinite;box-shadow:0 0 0 0 rgba(56,161,105,0.5);"
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

  function _adminStaffListRow(m, idx) {
    const quality       = m.quality || 0;
    const ratingColor   = _adminRatingColor(quality);
    const nextTitleName = _nextTitle(m.title, m.unit);
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

  const unitCards = Object.values(ADMIN_UNITS).map(template => {
    const unit       = adminUnits[template.id] || { level: 1, staffCount: 0, staffNeeded: template.baseStaffNeeded, staffQuality: 0, satisfaction: 30 };
    const unitStaff  = adminStaff.filter(m => m.unit === template.id);
    const staffStatus2 = unit.staffCount >= unit.staffNeeded ? '✅' : unit.staffCount >= unit.staffNeeded * 0.7 ? '⚠️' : '🔴';
    const eksik      = Math.max(0, unit.staffNeeded - unit.staffCount);
    const perf       = unit.satisfaction || 30;
    const unitId     = template.id;

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

    const eligibleInUnit = unitStaff.filter(m => m.promotionEligible && _nextTitle(m.title, m.unit)).length;

    const mgrRow = unit.managerId
      ? `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
           <div style="font-size:11px;color:var(--text-muted);">
             Birim Müdürü: <strong>${unit.managerName}</strong> (Liderlik: ${unit.managerLeadership})
             <button class="btn btn-sm btn-secondary" style="font-size:10px;padding:1px 6px;margin-left:6px;"
               onclick="window._onAssignUnitManager('${unitId}')">Değiştir</button>
           </div>
           <button class="btn btn-sm ${eligibleInUnit > 0 ? 'btn-warning' : 'btn-secondary'}"
             style="font-size:11px;padding:3px 9px;display:flex;align-items:center;gap:5px;${eligibleInUnit > 0 ? 'background:rgba(245,166,35,0.18);border:1px solid #f5a623;color:#f5a623;font-weight:600;' : 'opacity:0.75;'}"
             onclick="window._onAutoPromoteUnitStaff('${unitId}')"
             title="${eligibleInUnit > 0 ? `Birim yöneticisi onayıyla ${eligibleInUnit} personeli otomatik terfi ettir` : 'Bu birimde terfi bekleyen personel yok'}">
             ⚡ Otomatik Terfi ${eligibleInUnit > 0 ? `<span class="badge" style="background:#f5a623;color:#1a202c;padding:1px 6px;border-radius:10px;font-size:10px;font-weight:700;">${eligibleInUnit}</span>` : ''}
           </button>
         </div>`
      : `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
           <div style="font-size:11px;color:var(--color-danger);">
             ⚠️ Birim yöneticisi atanmamış (performans cezası)
             <button class="btn btn-sm btn-secondary" style="font-size:10px;padding:1px 6px;margin-left:6px;"
               onclick="window._onAssignUnitManager('${unitId}')">Ata</button>
           </div>
           <button class="btn btn-sm btn-secondary" disabled
             style="font-size:10px;padding:2px 8px;opacity:0.45;cursor:not-allowed;"
             title="Otomatik terfi için önce birim yöneticisi atanmalıdır">
             ⚡ Otomatik Terfi (Yönetici Yok)
           </button>
         </div>`;

    const cardViewHtml = `
      <div class="faculty-grid admin-staff-grid" id="admin-staff-grid-${unitId}">
        ${unitStaff.map(m => _adminStaffCard(m)).join('')}
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
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
        <h2 style="margin:0;font-size:18px;">🏢 İdari Birimler</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-sm btn-secondary" id="btn-fill-missing-staff" style="font-size:11px;background:rgba(78,204,163,0.15);border-color:rgba(78,204,163,0.4);color:#4ecca3;">
            👥 Eksik Personelleri Doldur
          </button>
          <button class="btn btn-sm btn-secondary" id="btn-auto-assign-managers" style="font-size:11px;background:rgba(66,153,225,0.15);border-color:rgba(66,153,225,0.4);color:#4299e1;">
            ⚡ Otomatik Müdür Ata
          </button>
          <button class="btn btn-sm btn-secondary" id="btn-auto-promote-all" style="font-size:11px;background:rgba(245,166,35,0.15);border-color:rgba(245,166,35,0.4);color:#f5a623;"
            title="Yöneticisi olan tüm birimlerdeki terfi bekleyen personelleri otomatik terfi ettir">
            🎓 Otomatik Terfi
          </button>
        </div>
      </div>

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

      ${(() => {
        const promotionCount = adminStaff.filter(m => m.promotionEligible && _nextTitle(m.title, m.unit)).length;
        if (promotionCount === 0) return '';
        const withManagerCount = adminStaff.filter(m => {
          if (!m.promotionEligible || !_nextTitle(m.title, m.unit)) return false;
          const u = adminUnits[m.unit];
          return u && u.managerId;
        }).length;

        return `<div style="
          background:rgba(245,166,35,0.12);
          border:1px solid rgba(245,166,35,0.4);
          border-radius:8px;
          padding:10px 14px;
          margin-bottom:12px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          flex-wrap:wrap;
          gap:10px;
        ">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:16px;">🎓</span>
            <div>
              <div style="font-size:13px;font-weight:600;color:#f5a623;">${promotionCount} personel terfiye hazır</div>
              <div style="font-size:11px;color:var(--text-muted);">${withManagerCount} personel yöneticili birimlerde (otomatik terfiye hazır)</div>
            </div>
          </div>
          ${withManagerCount > 0 ? `
            <button class="btn btn-sm" style="font-size:11px;font-weight:700;padding:5px 12px;background:#f5a623;color:#1a202c;border:none;border-radius:6px;cursor:pointer;"
              onclick="window._onAutoPromoteAllEligibleAdminStaff()">
              ⚡ Yöneticili Birimleri Otomatik Terfi Et (${withManagerCount})
            </button>
          ` : `
            <span style="font-size:11px;color:var(--color-danger);">⚠️ Otomatik terfi için önce birimlere yönetici atanmalıdır</span>
          `}
        </div>`;
      })()}

      ${unitCards}
    </div>
  `;

  const _adminViewState = {};

  function _renderAdminUnitView(unitId, view) {
    const container = panel.querySelector(`.admin-staff-view-container[data-unit="${unitId}"]`);
    if (!container) return;
    const unitStaffLocal = adminStaff.filter(m => m.unit === unitId);

    if (view === 'list') {
      const sortKey = _adminViewState[unitId]?.sortKey || null;
      const sortAsc = _adminViewState[unitId]?.sortAsc ?? true;
      let sorted = [...unitStaffLocal];
      if (sortKey) {
        sorted.sort((a, b) => {
          let va = a[sortKey] ?? 0;
          let vb = b[sortKey] ?? 0;
          if (sortKey === 'name') { va = a.name || ''; vb = b.name || ''; }
          if (sortKey === 'title') {
            const uTitles = getUnitTitles(unitId);
            let idxA = uTitles.indexOf(a.title);
            if (idxA < 0) idxA = TITLE_ORDER.indexOf(a.title);
            let idxB = uTitles.indexOf(b.title);
            if (idxB < 0) idxB = TITLE_ORDER.indexOf(b.title);
            va = idxA; vb = idxB;
          }
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

    container.querySelectorAll('.admin-staff-list-row').forEach(row => {
      row.addEventListener('click', () => {
        const mid = row.dataset.adminStaffId;
        if (mid) _showAdminStaffDetail(mid, adminStaff);
      });
    });

    container.querySelectorAll('.admin-staff-card').forEach(card => {
      card.addEventListener('click', () => {
        const mid = card.dataset.adminStaffId;
        if (mid) _showAdminStaffDetail(mid, adminStaff);
      });
    });
  }

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

  panel.querySelectorAll('.admin-staff-card').forEach(card => {
    card.addEventListener('click', () => {
      const mid = card.dataset.adminStaffId;
      if (mid) _showAdminStaffDetail(mid, adminStaff);
    });
  });

  on(el('btn-auto-assign-managers'), 'click', () => {
    if (window._onAutoAssignManagers) window._onAutoAssignManagers();
  });

  on(el('btn-fill-missing-staff'), 'click', () => {
    if (window._onFillMissingAdminStaff) window._onFillMissingAdminStaff();
  });

  on(el('btn-auto-promote-all'), 'click', () => {
    if (window._onAutoPromoteAllEligibleAdminStaff) window._onAutoPromoteAllEligibleAdminStaff();
  });
}

function _showAdminStaffDetail(staffId, adminStaff) {
  const m = adminStaff.find(s => s.id === staffId);
  if (!m) return;

  const titleRange  = getUnitTitleSalary(m.unit, m.title) || (ADMIN_TITLES[m.title] || { min: 14_000, max: 25_000 });
  const nextTitleName = _nextTitle(m.title, m.unit);
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

      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;">
        ${statDefs.map(s => createStatBar(s.label, m[s.key] || 0, 100, _statColor(m[s.key] || 0))).join('')}
      </div>

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

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid var(--border);">
        ${m.promotionEligible && nextTitleName
          ? `<button class="btn btn-primary" onclick="window._onPromoteAdminStaff('${m.id}');document.getElementById('modal-overlay')?.classList.add('hidden');">⬆️ Terfi Et</button>`
          : ''}
        <button class="btn btn-secondary" onclick="window._onAdjustAdminSalary('${m.id}');document.getElementById('modal-overlay')?.classList.add('hidden');">💰 Maaş Ayarla</button>
      </div>
    </div>
  `;

  showModal(`${m.name} — Detay`, bodyHtml);
}

export function renderAdminHireModal(unitId, candidates, onHire, currentLevel) {
  const template = ADMIN_UNITS[unitId];
  if (!template) return;

  const unitTitles = getUnitTitles(unitId);
  const titleList = unitTitles.length > 0 ? unitTitles : ['Memur', 'Uzman', 'Şef', 'Müdür Yrd.', 'Müdür'];

  const levelOptions = [
    { value: 'junior', label: 'Giriş seviye aday' },
    { value: 'mid',    label: 'Orta düzey aday' },
    { value: 'senior', label: 'Kıdemli aday' },
  ].map(opt =>
    `<option value="${opt.value}" ${opt.value === (currentLevel || 'mid') ? 'selected' : ''}>${opt.label}</option>`
  ).join('');

  window._adminCandidateCache = candidates;

  const candidateRows = candidates.map((c, idx) => {
    const sugT = c.suggestedTitle || (titleList[1] || 'Uzman');
    const titleOpts = titleList.map(t => {
      const sal = getUnitTitleSalary(unitId, t);
      const minSal = sal?.min ?? (ADMIN_TITLES[t]?.min || 15000);
      const maxSal = sal?.max ?? (ADMIN_TITLES[t]?.max || 25000);
      return `<option value="${t}" ${t === sugT ? 'selected' : ''}>${t} (${formatMoney(minSal)}–${formatMoney(maxSal)}/ay)</option>`;
    }).join('');

    return `
    <div style="
      background:var(--bg-secondary);
      border-radius:6px;
      padding:10px;
      margin-bottom:10px;
      border:1px solid var(--border-color);
    ">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px;">
        <div>
          <div style="font-weight:600;font-size:13px;">${c.name}</div>
          <div style="font-size:11px;color:var(--text-muted);">Deneyim: ${c.experience || c.totalExperience || 0} yıl · Kalite: <strong>${c.quality}</strong>/100</div>
          <div style="font-size:11px;color:var(--text-muted);">Vrl: ${c.efficiency || 0} · İlt: ${c.communication || 0} · Ldr: ${c.leadership || 0}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:12px;color:var(--text-muted);">Önerilen:</div>
          <div style="font-size:13px;font-weight:700;color:var(--accent);">${sugT}</div>
        </div>
      </div>
      <div style="margin-bottom:6px;">
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:3px;">Bu adayı hangi rütbeyle alacaksınız?</label>
        <select id="admin-hire-chosentitle-${idx}" class="form-input" style="font-size:12px;width:100%;"
          onchange="window._onAdminTitleSelectionChange(${idx}, this.value)">
          ${titleOpts}
        </select>
      </div>
      <div id="admin-hire-warning-${idx}" style="font-size:11px;margin-bottom:6px;min-height:16px;"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:12px;font-weight:600;color:var(--color-warning);" id="admin-hire-salary-${idx}">${formatMoney(c.salaryExpectation || c.salary)}/ay tahmini</div>
        <button class="btn btn-sm btn-primary" style="font-size:11px;"
          onclick="window._onHireAdminCandidateByIdx(${idx})">
          ✅ Bu rütbeyle al
        </button>
      </div>
    </div>
  `}).join('');

  showModal(
    `${template.icon} ${template.name} — Personel Alımı`,
    `
      <p style="margin:0 0 12px;font-size:12px;color:var(--text-muted);">${template.description}</p>

      <div style="margin-bottom:12px;">
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Deneyim seviyesi seç:</label>
        <select id="admin-hire-title" class="form-input" style="font-size:12px;">
          ${levelOptions}
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
