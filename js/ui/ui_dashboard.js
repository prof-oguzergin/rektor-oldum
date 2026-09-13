import { el, formatMoney, formatNumber, createProgressRing } from './ui_base.js';
import { SCENARIOS, UNIVERSITY_MODELS, SEMESTER_MONTHS, BUILDINGS } from '../data.js?v=0.4.48';

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
          ${state.meta.isSandbox ? ' | <span style="color:var(--accent,#5dd6c0);">🎮 Serbest Mod</span>' : ''}
        </div>
      </div>
      <div class="flex gap-md items-center">
        ${createProgressRing(Math.round(uni.prestige), 100, 'Saygınlık', 80)}
      </div>
    </div>

    ${(() => {
      const sc = SCENARIOS[state.meta.scenarioId];
      if (!sc || state.meta.isSandbox) return '';
      
      let goalText = '';
      const wc = sc.winCondition;
      if (wc.type === 'prestige') goalText = `Hedef: <strong>${wc.target} Saygınlık</strong>`;
      else if (wc.type === 'ranking') {
        const isWorld = wc.isWorld || wc.target > 6;
        goalText = `Hedef: <strong>${isWorld ? 'Dünya Sıralamasında ' : ''}İlk ${wc.target}</strong>`;
      }
      else if (wc.type === 'budget_positive') goalText = `Hedef: <strong>${wc.consecutiveTurns || 10} Dönem Pozitif Bütçe</strong>`;
      
      const timeText = wc.maxTurns ? ` | Kalan Süre: <strong>${wc.maxTurns - (state.meta.turn - 1)} Dönem</strong>` : '';
      
      return `
        <div class="card" style="background:rgba(93,214,192,0.08); border:1px solid rgba(93,214,192,0.2); padding:12px 16px; margin-bottom:16px; display:flex; align-items:center; gap:12px;">
          <div style="font-size:24px;">🎯</div>
          <div>
            <div style="font-size:12px; color:var(--text-muted,#aaa); text-transform:uppercase; letter-spacing:0.5px;">Senaryo Hedefi</div>
            <div style="font-size:14px;">${goalText}${timeText}</div>
          </div>
        </div>
      `;
    })()}

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
      ${_statCardHtml('Saygınlık', Math.round(uni.prestige), null, uni.intlRanking ? `Dünya #${uni.intlRanking}` : 'Dünya —')}
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
// DASHBOARD YARDIMCILARI
// ─────────────────────────────────────────────────────────────────────────────

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

function _qualityBar(val) {
  const color = _statColor(val);
  return `<span style="color:${color};font-weight:700;font-size:12px;">${val}</span>`;
}

function _statColor(val) {
  if (val >= 85) return '#d4af37';
  if (val >= 70) return 'var(--stat-high)';
  if (val >= 40) return 'var(--stat-mid)';
  return 'var(--stat-low)';
}

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

function _estimateCosts(state) {
  const faculty = state.faculty || [];
  const salaryCost = faculty.reduce((s, f) => s + (f.salary ?? 0), 0) * SEMESTER_MONTHS;
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

  const totalUncovered = (state.departments || []).reduce((s, d) => s + (d.uncoveredCourses?.length || 0), 0);
  if (totalUncovered > 0) {
    warnings.push({ type: 'warning', icon: '📚', message: `${totalUncovered} ders için yeterli hoca yok. Dışarıdan öğretim görevlisi gerekiyor.` });
  }

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
