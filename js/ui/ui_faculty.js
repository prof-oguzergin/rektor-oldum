import { el, qsa, on, delegate, formatMoney, createStatBar, _statColor, _statValueColor, showModal, hideModal, showNotification } from './ui_base.js';
import { calculateOverallRating, renderFacultyAvatar, getFacultyRatingTrend, DEPARTMENT_FIELDS } from '../faculty.js?v=0.4.52';
import { AVAILABLE_NEW_DEPARTMENTS, getCourseEffectiveDifficulty } from '../game.js?v=0.4.50';
import { DEPARTMENT_CURRICULA, DEPARTMENTS, SALARY_SCALES } from '../data.js?v=0.4.48';

// Akademik kadro panelinin görünüm durumunu sakla (kalıcı olması için modül seviyesinde)
let _currentFacultyView = 'card';
let _facultySortKey     = null;
let _facultySortAsc     = true;

/**
 * Hoca için verebileceği dersleri bul.
 * @param {object} fac 
 * @param {string[]} activeDepts 
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
    <div id="pending-applications-container" style="background:rgba(245,166,35,0.08);border:1px solid rgba(245,166,35,0.3);border-radius:8px;
                padding:12px 16px;margin-bottom:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
        <div id="pending-applications-count" style="font-size:13px;font-weight:700;color:#f5a623;">
          Bekleyen Başvurular (${applications.length})
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <!-- Toplu Kabul Eşiği -->
          <div style="display:flex;align-items:center;gap:4px;background:rgba(56,161,105,0.12);padding:3px 8px;border-radius:6px;border:1px solid rgba(56,161,105,0.3);">
            <span style="font-size:11px;color:#38a169;font-weight:600;">Puan ≥</span>
            <input type="number" id="input-bulk-accept-threshold" value="75" min="0" max="100" style="width:44px;font-size:11px;padding:2px 4px;text-align:center;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;">
            <button id="btn-bulk-accept-threshold" class="btn btn-sm btn-success" style="font-size:11px;padding:3px 8px;cursor:pointer;">
              ✅ Kabul Et (<span id="bulk-accept-count">0</span>)
            </button>
          </div>

          <!-- Toplu Ret Eşiği -->
          <div style="display:flex;align-items:center;gap:4px;background:rgba(229,62,62,0.12);padding:3px 8px;border-radius:6px;border:1px solid rgba(229,62,62,0.3);">
            <span style="font-size:11px;color:#e53e3e;font-weight:600;">Puan &lt;</span>
            <input type="number" id="input-bulk-reject-threshold" value="65" min="0" max="100" style="width:44px;font-size:11px;padding:2px 4px;text-align:center;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;">
            <button id="btn-bulk-reject-threshold" class="btn btn-sm btn-danger" style="font-size:11px;padding:3px 8px;cursor:pointer;">
              ❌ Reddet (<span id="bulk-reject-count">0</span>)
            </button>
          </div>

          <!-- Tümünü Reddet Butonu -->
          <button id="btn-reject-all-applicants" class="btn btn-sm" style="font-size:11px;padding:4px 8px;background:rgba(255,255,255,0.06);color:var(--text-muted);border:1px solid var(--border);cursor:pointer;" title="Bekleyen tüm başvuruları reddeder">
            🗑 Tümünü Reddet
          </button>
        </div>
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

          // Verebileceği dersler (yalnızca bu başvuranın bölümüyle sınırlı — hızlı tarama)
          const myDeptIds = app.department ? [app.department] : [];
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
            <div id="applicant-card-${app.id}" class="applicant-card" data-applicant-id="${app.id}" data-rating="${appOverall}" style="background:var(--bg-secondary);border-radius:8px;border:1px solid var(--border);overflow:hidden;transition:all 0.18s ease;">

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
    <div id="spontaneous-applications-container" style="background:rgba(128,90,213,0.07);border:1px solid rgba(128,90,213,0.3);border-radius:8px;
                padding:12px 16px;margin-bottom:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:4px;">
        <div id="spontaneous-applications-count" style="font-size:12px;font-weight:700;color:#805ad5;">
          📬 GELEN BAŞVURULAR (İlan Dışı) — ${spontaneousApplicants.length} başvuru
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          ${spontaneousApplicants.length > 1 ? `
            <div style="display:flex;align-items:center;gap:4px;background:rgba(229,62,62,0.12);padding:3px 8px;border-radius:6px;border:1px solid rgba(229,62,62,0.3);">
              <span style="font-size:11px;color:#e53e3e;font-weight:600;">Puan &lt;</span>
              <input type="number" id="input-spont-reject-threshold" value="65" min="0" max="100" style="width:44px;font-size:11px;padding:2px 4px;text-align:center;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;">
              <button id="btn-spont-reject-threshold" class="btn btn-sm btn-danger" style="font-size:11px;padding:3px 8px;cursor:pointer;">
                ❌ Reddet (<span id="spont-reject-count">0</span>)
              </button>
            </div>
            <button id="btn-reject-all-spontaneous" class="btn btn-sm" style="font-size:11px;padding:4px 8px;background:rgba(255,255,255,0.06);color:var(--text-muted);border:1px solid var(--border);cursor:pointer;" title="Tüm spontane başvuruları reddeder">
              🗑 Tümünü Reddet
            </button>
          ` : ''}
        </div>
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
            <div id="spontaneous-card-${app.id}" class="spontaneous-card" data-applicant-id="${app.id}" data-rating="${spontOverall}" style="background:var(--bg-secondary);border-radius:8px;border:1px solid rgba(128,90,213,0.2);overflow:hidden;transition:all 0.18s ease;">
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
      <div class="faculty-grid" id="faculty-grid"></div>
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

    if (_currentFacultyView === 'list') {
      // Sırala
      let sorted = [...filtered];
      if (_facultySortKey) {
        sorted.sort((a, b) => {
          let va, vb;
          if (_facultySortKey === 'name') { va = a.name || ''; vb = b.name || ''; }
          else if (_facultySortKey === 'title') { va = a.title || ''; vb = b.title || ''; }
          else if (_facultySortKey === 'dept') { va = (depts.find(d => d.id === a.department)?.shortName || a.department || ''); vb = (depts.find(d => d.id === b.department)?.shortName || b.department || ''); }
          else if (_facultySortKey === 'rating') { va = calculateOverallRating(a); vb = calculateOverallRating(b); }
          else if (_facultySortKey === 'research') { va = a.stats?.research ?? 50; vb = b.stats?.research ?? 50; }
          else if (_facultySortKey === 'teaching') { va = a.stats?.teaching ?? 50; vb = b.stats?.teaching ?? 50; }
          else if (_facultySortKey === 'management') { va = a.stats?.management ?? 50; vb = b.stats?.management ?? 50; }
          else if (_facultySortKey === 'publications') { va = a.publications ?? 0; vb = b.publications ?? 0; }
          else if (_facultySortKey === 'citations') { va = a.citations ?? 0; vb = b.citations ?? 0; }
          else if (_facultySortKey === 'salary') { va = a.salary ?? 0; vb = b.salary ?? 0; }
          else if (_facultySortKey === 'courses') { va = (a.currentLoad?.assignedCourses || []).length; vb = (b.currentLoad?.assignedCourses || []).length; }
          else if (_facultySortKey === 'happiness') { va = a.happiness ?? 60; vb = b.happiness ?? 60; }
          else { va = 0; vb = 0; }
          if (typeof va === 'string') return _facultySortAsc ? va.localeCompare(vb, 'tr') : vb.localeCompare(va, 'tr');
          return _facultySortAsc ? va - vb : vb - va;
        });
      }

      function ratingColor(val) {
        if (val >= 85) return '#d4af37';
        if (val >= 70) return 'var(--accent-green)';
        if (val >= 55) return 'var(--accent-yellow,#f5a623)';
        return 'var(--accent-red,#e53e3e)';
      }

      function colHead(key, label) {
        const isCurrent = _facultySortKey === key;
        const arrow = isCurrent ? (_facultySortAsc ? ' ▲' : ' ▼') : '';
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
                ${colHead('happiness','Memn.')}
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
                  <td style="padding:6px 8px;">
                    <div style="display:flex;align-items:center;gap:4px;">
                      <div class="happiness-dot ${f.happiness >= 70 ? 'high' : f.happiness >= 45 ? 'mid' : 'low'}"></div>
                      <span style="font-weight:700;">%${Math.round(f.happiness ?? 60)}</span>
                    </div>
                  </td>
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
          if (_facultySortKey === key) {
            _facultySortAsc = !_facultySortAsc;
          } else {
            _facultySortKey = key;
            _facultySortAsc = false; // ilk tıklamada azalan
          }
          _renderCurrentView();
        });
      });
    } else {
      // Kart görünümü (Çok sayıda hoca olduğunda chunked render ile sayfa açılış donmasını önler)
      const CHUNK_SIZE = 48;
      let renderedCount = Math.min(CHUNK_SIZE, filtered.length);

      const renderCards = (count) => {
        const cardsHtml = filtered.slice(0, count).map(f => renderFacultyCard(f, depts)).join('');
        const moreBtnHtml = count < filtered.length ? `
          <div id="faculty-load-more-container" style="grid-column:1/-1;text-align:center;padding:16px 0;">
            <button id="btn-load-more-faculty" class="btn btn-secondary" style="padding:8px 24px;font-size:13px;">
              Daha Fazla Hoca Göster (${count} / ${filtered.length})
            </button>
          </div>` : '';
        return cardsHtml + moreBtnHtml;
      };

      const grid = el('faculty-grid');
      if (grid) {
        grid.innerHTML = renderCards(renderedCount);
      } else {
        container.innerHTML = `<div class="faculty-grid" id="faculty-grid">${renderCards(renderedCount)}</div>`;
      }

      if (!container._hasLoadMoreListener) {
        container._hasLoadMoreListener = true;
        container.addEventListener('click', (e) => {
          const loadBtn = e.target.closest('#btn-load-more-faculty');
          if (loadBtn) {
            renderedCount = Math.min(renderedCount + CHUNK_SIZE, filtered.length);
            const gridEl = el('faculty-grid');
            if (gridEl) gridEl.innerHTML = renderCards(renderedCount);
          }
        });
      }
    }
  }

  // İlk render (saklanan view'a göre)
  _renderCurrentView();

  // Aktif buton stilini ayarla
  if (_currentFacultyView === 'list') {
    el('btn-faculty-view-list')?.classList.remove('btn-secondary');
    el('btn-faculty-view-list')?.setAttribute('style', 'font-size:11px;padding:4px 10px;background:var(--accent);color:var(--bg-primary);border:none;');
    el('btn-faculty-view-card')?.classList.add('btn-secondary');
    el('btn-faculty-view-card')?.setAttribute('style', 'font-size:11px;padding:4px 10px;');
  }

  // Filtre fonksiyonunu güncelle (view farkındalı)
  on(el('faculty-filter-dept'),  'change', _renderCurrentView);
  on(el('faculty-filter-title'), 'change', _renderCurrentView);

  // Arama kutusuna 150ms debounce (262+ hoca listesinde her tuşta donmayı önler)
  let _searchDebounceTimer = null;
  const searchInput = el('faculty-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      if (_searchDebounceTimer) clearTimeout(_searchDebounceTimer);
      _searchDebounceTimer = setTimeout(_renderCurrentView, 150);
    });
  }

  on(el('btn-faculty-view-card'), 'click', () => {
    _currentFacultyView = 'card';
    el('btn-faculty-view-card')?.classList.remove('btn-secondary');
    el('btn-faculty-view-card')?.setAttribute('style', 'font-size:11px;padding:4px 10px;background:var(--accent);color:var(--bg-primary);border:none;');
    el('btn-faculty-view-list')?.classList.add('btn-secondary');
    el('btn-faculty-view-list')?.setAttribute('style', 'font-size:11px;padding:4px 10px;');
    _renderCurrentView();
  });

  on(el('btn-faculty-view-list'), 'click', () => {
    _currentFacultyView = 'list';
    el('btn-faculty-view-list')?.classList.remove('btn-secondary');
    el('btn-faculty-view-list')?.setAttribute('style', 'font-size:11px;padding:4px 10px;background:var(--accent);color:var(--bg-primary);border:none;');
    el('btn-faculty-view-card')?.classList.add('btn-secondary');
    el('btn-faculty-view-card')?.setAttribute('style', 'font-size:11px;padding:4px 10px;');
    _renderCurrentView();
  });

  // ── Toplu Karar Sayaçlarını Güncelleme Yardımcıları ─────────────────────────
  function updateBulkApplicantCounts() {
    const acceptInput = el('input-bulk-accept-threshold');
    const rejectInput = el('input-bulk-reject-threshold');
    const acceptThresh = acceptInput ? (parseInt(acceptInput.value, 10) || 75) : 75;
    const rejectThresh = rejectInput ? (parseInt(rejectInput.value, 10) || 65) : 65;

    const cards = qsa('#applications-list .applicant-card');
    let acceptCount = 0;
    let rejectCount = 0;

    cards.forEach(c => {
      const r = parseInt(c.dataset.rating, 10) || 0;
      if (r >= acceptThresh) acceptCount++;
      if (r < rejectThresh) rejectCount++;
    });

    const acceptBadge = el('bulk-accept-count');
    const rejectBadge = el('bulk-reject-count');
    const btnAccept   = el('btn-bulk-accept-threshold');
    const btnReject   = el('btn-bulk-reject-threshold');

    if (acceptBadge) acceptBadge.textContent = acceptCount;
    if (rejectBadge) rejectBadge.textContent = rejectCount;
    if (btnAccept)   btnAccept.disabled = (acceptCount === 0);
    if (btnReject)   btnReject.disabled = (rejectCount === 0);
  }

  function updateBulkSpontCounts() {
    const rejectInput = el('input-spont-reject-threshold');
    if (!rejectInput) return;
    const rejectThresh = parseInt(rejectInput.value, 10) || 65;
    const cards = qsa('#spontaneous-list .spontaneous-card');
    let rejectCount = 0;
    cards.forEach(c => {
      const r = parseInt(c.dataset.rating, 10) || 0;
      if (r < rejectThresh) rejectCount++;
    });
    const rejectBadge = el('spont-reject-count');
    const btnReject   = el('btn-spont-reject-threshold');
    if (rejectBadge) rejectBadge.textContent = rejectCount;
    if (btnReject)   btnReject.disabled = (rejectCount === 0);
  }

  // Global erişim (main.js içinden tekil/toplu ret sonrası sayaç tazelemek için)
  if (typeof window !== 'undefined') {
    window._updateApplicantBulkCounts = () => {
      updateBulkApplicantCounts();
      updateBulkSpontCounts();
    };
  }

  // İlk açılışta sayaçları hesapla
  updateBulkApplicantCounts();
  updateBulkSpontCounts();

  // Eşik input değişimlerini dinle
  const inAccept = el('input-bulk-accept-threshold');
  const inReject = el('input-bulk-reject-threshold');
  if (inAccept) inAccept.addEventListener('input', updateBulkApplicantCounts);
  if (inReject) inReject.addEventListener('input', updateBulkApplicantCounts);

  const inSpontReject = el('input-spont-reject-threshold');
  if (inSpontReject) inSpontReject.addEventListener('input', updateBulkSpontCounts);

  // Toplu Kabul Butonu
  const btnBulkAccept = el('btn-bulk-accept-threshold');
  if (btnBulkAccept) {
    btnBulkAccept.addEventListener('click', () => {
      const acceptThresh = parseInt(el('input-bulk-accept-threshold')?.value, 10) || 75;
      const ids = [];
      qsa('#applications-list .applicant-card').forEach(c => {
        const r = parseInt(c.dataset.rating, 10) || 0;
        if (r >= acceptThresh && c.dataset.applicantId) {
          ids.push(c.dataset.applicantId);
        }
      });
      if (ids.length > 0) {
        panel.dispatchEvent(new CustomEvent('bulk-accept-applicants', { detail: { applicantIds: ids }, bubbles: true }));
      }
    });
  }

  // Toplu Ret Butonu
  const btnBulkReject = el('btn-bulk-reject-threshold');
  if (btnBulkReject) {
    btnBulkReject.addEventListener('click', () => {
      const rejectThresh = parseInt(el('input-bulk-reject-threshold')?.value, 10) || 65;
      const ids = [];
      qsa('#applications-list .applicant-card').forEach(c => {
        const r = parseInt(c.dataset.rating, 10) || 0;
        if (r < rejectThresh && c.dataset.applicantId) {
          ids.push(c.dataset.applicantId);
        }
      });
      if (ids.length > 0) {
        panel.dispatchEvent(new CustomEvent('bulk-reject-applicants', { detail: { applicantIds: ids }, bubbles: true }));
      }
    });
  }

  // Tümünü Reddet Butonu
  const btnRejectAll = el('btn-reject-all-applicants');
  if (btnRejectAll) {
    btnRejectAll.addEventListener('click', () => {
      panel.dispatchEvent(new CustomEvent('reject-all-applicants', { bubbles: true }));
    });
  }

  // Spontane Toplu Ret Butonu
  const btnSpontBulkReject = el('btn-spont-reject-threshold');
  if (btnSpontBulkReject) {
    btnSpontBulkReject.addEventListener('click', () => {
      const rejectThresh = parseInt(el('input-spont-reject-threshold')?.value, 10) || 65;
      const ids = [];
      qsa('#spontaneous-list .spontaneous-card').forEach(c => {
        const r = parseInt(c.dataset.rating, 10) || 0;
        if (r < rejectThresh && c.dataset.applicantId) {
          ids.push(c.dataset.applicantId);
        }
      });
      if (ids.length > 0) {
        panel.dispatchEvent(new CustomEvent('bulk-reject-spontaneous', { detail: { applicantIds: ids }, bubbles: true }));
      }
    });
  }

  // Spontane Tümünü Reddet Butonu
  const btnSpontRejectAll = el('btn-reject-all-spontaneous');
  if (btnSpontRejectAll) {
    btnSpontRejectAll.addEventListener('click', () => {
      panel.dispatchEvent(new CustomEvent('reject-all-spontaneous', { bubbles: true }));
    });
  }

  // Başvuru kabul / ret butonları — event delegation
  const appsList = el('applications-list');
  if (appsList) {
    appsList.addEventListener('click', (e) => {
      const acceptBtn = e.target.closest('[id^="btn-accept-"]');
      const rejectBtn = e.target.closest('[id^="btn-reject-"]');
      if (acceptBtn) {
        const appId = acceptBtn.dataset.applicantId;
        panel.dispatchEvent(new CustomEvent('accept-applicant', { detail: { appId }, bubbles: true }));
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

  const overallRating = f.overallRating || calculateOverallRating(f);
  const ratingTrend   = getFacultyRatingTrend(f);
  const ratingColor   = overallRating >= 85 ? '#d4af37' : overallRating >= 70 ? '#38a169' : overallRating >= 55 ? '#f5a623' : '#e53e3e';
  const ratingBg      = overallRating >= 85 ? 'rgba(212,175,55,0.12)' : overallRating >= 70 ? 'rgba(56,161,105,0.12)' : overallRating >= 55 ? 'rgba(245,166,35,0.12)' : 'rgba(229,62,62,0.12)';

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
        <div style="text-align:center;padding:4px 8px;border-radius:8px;background:${ratingBg};flex-shrink:0;">
          <div style="font-size:18px;font-weight:800;color:${ratingColor};line-height:1;">${overallRating}</div>
          <div style="font-size:11px;font-weight:700;color:${ratingTrend.color};">${ratingTrend.arrow}</div>
          <div style="font-size:9px;color:var(--text-muted);">Puan</div>
        </div>
      </div>

      <div class="faculty-card-stats">
        ${statDefs.map(s => {
          const val = stats[s.key] ?? 50;
          const isUncertain = (s.key === 'research' || s.key === 'teaching') &&
                              revealed[s.key] && !revealed[s.key].exact;
          const displayVal = isUncertain ? `${revealed[s.key].min}-${revealed[s.key].max}` : val;
          return createStatBar(s.label, val, 100, _statColor(val), isUncertain, displayVal);
        }).join('')}
      </div>

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
        </div>
        <div class="faculty-pubs">
          📄 ${f.publications ?? 0}
          ${f.hIndex ? `&nbsp;H:${f.hIndex}` : ''}
        </div>
        <div class="tooltip-host" style="display:flex;align-items:center;gap:4px;">
          <div class="happiness-dot ${happClass}"></div>
          <span style="font-size:10px;font-weight:700;color:var(--text-muted);">M:%${Math.round(happiness)}</span>
          <div class="tooltip">Memnuniyet: ${Math.round(happiness)}/100</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Yeni bölüm veya lisansüstü program başvurusu için modal gösterir.
 */
export function showNewDeptProgramModal(state) {
  const depts   = state.departments || [];
  const faculty = state.faculty     || [];
  const budget  = state.university?.budget || 0;

  const openDeptIds = new Set(depts.map(d => d.id));
  const availableNewDepts = AVAILABLE_NEW_DEPARTMENTS.filter(d => !openDeptIds.has(d.id));

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

  const pending = state.pendingApplications || [];

  const bodyHtml = `
    <div style="font-size:13px;">
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

      <div style="display:flex;gap:8px;margin-bottom:16px;border-bottom:2px solid var(--border);padding-bottom:8px;">
        <button class="ndp-tab-btn btn btn-secondary" data-tab="lisans" style="font-size:11px;padding:5px 12px;" id="ndp-tab-lisans">Yeni Lisans Bölümü</button>
        <button class="ndp-tab-btn btn btn-secondary" data-tab="yl" style="font-size:11px;padding:5px 12px;" id="ndp-tab-yl">Yüksek Lisans</button>
        <button class="ndp-tab-btn btn btn-secondary" data-tab="phd" style="font-size:11px;padding:5px 12px;" id="ndp-tab-phd">Doktora</button>
      </div>

      <div id="ndp-panel-lisans">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">Açılabilecek yeni bölümler:</div>
        <div style="max-height:240px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;">
          ${availableNewDepts.length === 0 ? '<div style="color:var(--text-faint);font-size:12px;padding:8px;">Tüm mevcut bölümler zaten açık.</div>' : availableNewDepts.map(d => {
            const canAfford = budget >= d.cost;
            const pendingApp = pending.find(p => p.deptId === d.id && p.type === 'yeni_bolum');
            const isPending = !!pendingApp;
            return `
            <div style="background:var(--bg-secondary);border-radius:8px;border:1px solid var(--border);padding:10px 12px;${isPending ? 'opacity:0.6;' : (canAfford ? '' : 'opacity:0.5;')}display:flex;align-items:center;gap:10px;" class="ndp-dept-row${canAfford && !isPending ? '' : ' ndp-cant-afford'}" data-dept-id="${d.id}" data-cost="${d.cost}">
              <span style="font-size:20px;">${d.icon || '🏫'}</span>
              <div style="flex:1;">
                <div style="font-size:13px;font-weight:700;">${d.name}</div>
                <div style="font-size:10px;color:var(--text-muted);">Min. ${d.minFaculty} öğretim üyesi · Maliyet: ${formatMoney(d.cost)}</div>
              </div>
              ${isPending ? `<button class="btn btn-secondary" disabled style="font-size:10px;padding:4px 10px;opacity:0.7;cursor:not-allowed;">✅ Başvuruldu</button>` : (canAfford ? `<button class="btn btn-primary" style="font-size:10px;padding:4px 10px;" data-apply-dept="${d.id}">Başvur</button>` : `<span style="font-size:10px;color:#e53e3e;">Yetersiz bütçe</span>`)}
            </div>`;
          }).join('')}
        </div>
      </div>

      <div id="ndp-panel-yl" style="display:none;">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">Gereksinim: 3+ Dr.Öğr.Üyesi, YÖK onay süresi: 1-2 dönem, Maliyet: ${formatMoney(200_000)}</div>
        <div style="display:flex;flex-direction:column;gap:6px;max-height:240px;overflow-y:auto;">
          ${ylEligible.length === 0 ? '<div style="color:var(--text-faint);font-size:12px;padding:8px;">YL programı açabilecek uygun bölüm yok.</div>' : ylEligible.map(d => `
            <div style="background:var(--bg-secondary);border-radius:8px;border:1px solid var(--border);padding:10px 12px;display:flex;align-items:center;gap:10px;">
              <span style="font-size:20px;">${d.icon || '🏫'}</span>
              <div style="flex:1;">
                <div style="font-size:13px;font-weight:700;">${d.name}</div>
                <div style="font-size:10px;color:var(--text-muted);">Kontenjan: <input type="number" id="yl-quota-${d.id}" min="5" max="30" value="10" style="width:50px;padding:2px 4px;border:1px solid var(--border);border-radius:4px;background:var(--bg-tertiary);color:inherit;font-size:10px;"> öğrenci/yıl</div>
              </div>
              <button class="btn btn-primary" style="font-size:10px;padding:4px 10px;" data-apply-yl="${d.id}">Başvur</button>
            </div>
          `).join('')}
        </div>
      </div>

      <div id="ndp-panel-phd" style="display:none;">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">Gereksinim: 2+ Profesör, YÖK onay süresi: 1-2 dönem, Maliyet: ${formatMoney(500_000)}</div>
        <div style="display:flex;flex-direction:column;gap:6px;max-height:240px;overflow-y:auto;">
          ${phdEligible.length === 0 ? '<div style="color:var(--text-faint);font-size:12px;padding:8px;">Doktora programı açabilecek uygun bölüm yok.</div>' : phdEligible.map(d => `
            <div style="background:var(--bg-secondary);border-radius:8px;border:1px solid var(--border);padding:10px 12px;display:flex;align-items:center;gap:10px;">
              <span style="font-size:20px;">${d.icon || '🏫'}</span>
              <div style="flex:1;">
                <div style="font-size:13px;font-weight:700;">${d.name}</div>
                <div style="font-size:10px;color:var(--text-muted);">Kontenjan: <input type="number" id="phd-quota-${d.id}" min="2" max="15" value="5" style="width:50px;padding:2px 4px;border:1px solid var(--border);border-radius:4px;background:var(--bg-tertiary);color:inherit;font-size:10px;"> öğrenci/yıl</div>
              </div>
              <button class="btn btn-primary" style="font-size:10px;padding:4px 10px;" data-apply-phd="${d.id}">Başvur</button>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  showModal('Yeni Bölüm / Program Başvurusu', bodyHtml, { wide: true });

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

  const firstTab = el('ndp-tab-lisans');
  if (firstTab) firstTab.classList.add('btn-primary');

  qsa('[data-apply-dept]').forEach(btn => {
    btn.addEventListener('click', () => {
      const deptId = btn.dataset.applyDept;
      document.dispatchEvent(new CustomEvent('apply-new-dept', { detail: { type: 'yeni_bolum', deptId } }));
    });
  });

  qsa('[data-apply-yl]').forEach(btn => {
    btn.addEventListener('click', () => {
      const deptId = btn.dataset.applyYl;
      const quota  = parseInt(el(`yl-quota-${deptId}`)?.value || '10');
      document.dispatchEvent(new CustomEvent('apply-new-dept', { detail: { type: 'yuksek_lisans', deptId, requestedQuota: quota } }));
    });
  });

  qsa('[data-apply-phd]').forEach(btn => {
    btn.addEventListener('click', () => {
      const deptId = btn.dataset.applyPhd;
      const quota  = parseInt(el(`phd-quota-${deptId}`)?.value || '5');
      document.dispatchEvent(new CustomEvent('apply-new-dept', { detail: { type: 'doktora', deptId, requestedQuota: quota } }));
    });
  });
}

/**
 * Transfer pazarından bir hoca transfer edildiğinde çağrılır.
 * Modalı kapatmaya gerek kalmadan hocayı sol listeden siler,
 * sayacı günceller ve sağ paneli temizler.
 */
export function removeTransferMarketCandidate(facultyId, remainingMarket, state) {
  const listEl = el('transfer-faculty-list');
  if (!listEl) return;

  const card = listEl.querySelector(`.transfer-market-card[data-faculty-id="${facultyId}"]`);
  if (card) {
    card.remove();
  }

  // Sayacı güncelle
  const titleEl = el('transfer-market-title');
  const marketList = Array.isArray(remainingMarket) ? remainingMarket : (remainingMarket?.candidates || []);
  const count = marketList.length;
  if (titleEl) {
    titleEl.textContent = `Pazardaki Hocalar (${count})`;
  }

  // Eğer pazar boşaldıysa boş durum mesajı göster
  if (count === 0) {
    listEl.innerHTML = `
      <div class="empty-state" style="padding:24px;">
        <div class="empty-state-icon">👔</div>
        <div class="empty-state-title">Pazar boş</div>
        <div class="empty-state-desc">Bu dönem transfer pazarındaki adayların tamamı transfer edildi.</div>
      </div>
    `;
  }

  // Sağ paneli sıfırla
  const rightPanel = el('transfer-right-panel');
  if (rightPanel) {
    const depts = state?.departments || [];
    rightPanel.innerHTML = _renderTransferRightPanel(null, depts, state);
  }
}

/**
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
        <div class="section-title" id="transfer-market-title" style="margin-bottom:8px;">Pazardaki Hocalar (${(market || []).length})</div>
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
        const sendBtn = el('btn-send-offer');
        if (sendBtn) {
          if (sendBtn.disabled) return;
          sendBtn.disabled = true;
          sendBtn.textContent = 'Transfer Ediliyor...';
        }
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
 * Kadro İlanı Ver modalını render et (Tekli veya Toplu İlan desteği).
 * @param {object}   state    — Oyun durumu
 * @param {Function} onSubmit — İlan gönderme callback: (position | positions[]) => void
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

  let isMultiMode = false;

  const html = `
    <div style="display:flex;flex-direction:column;gap:14px;">

      <!-- Mod Seçimi: Tek Bölüm / Toplu İlan -->
      <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.03);padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);">
        <span style="font-size:12px;font-weight:700;color:var(--text-primary,#fff);">İlan Türü:</span>
        <div style="display:flex;gap:4px;">
          <button type="button" id="pos-mode-single" class="btn btn-small" style="font-size:11px;padding:5px 12px;border-radius:6px;font-weight:600;background:var(--accent-blue,#3182ce);color:#fff;border:none;cursor:pointer;">
            Tek Bölüm
          </button>
          <button type="button" id="pos-mode-multi" class="btn btn-small" style="font-size:11px;padding:5px 12px;border-radius:6px;font-weight:600;background:transparent;color:var(--text-muted,#aaa);border:1px solid rgba(255,255,255,0.1);cursor:pointer;">
            Toplu İlan (${depts.length} Bölüm)
          </button>
        </div>
      </div>

      <!-- Tek Bölüm Seçimi -->
      <div id="pos-single-section" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">Bölüm</label>
          <select class="filter-select" id="pos-dept" style="width:100%;">${deptOptions}</select>
        </div>
        <div>
          <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">Unvan</label>
          <select class="filter-select" id="pos-title" style="width:100%;">${titleOptions}</select>
        </div>
      </div>

      <!-- Toplu Bölüm Seçimi (Multi Mode) -->
      <div id="pos-multi-section" style="display:none;flex-direction:column;gap:10px;">
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;flex-wrap:wrap;gap:6px;">
            <div style="display:flex;align-items:center;gap:6px;">
              <label style="font-size:11px;color:var(--text-muted);font-weight:600;">İlan Verilecek Bölümler</label>
              <span id="pos-multi-count-badge" style="font-size:11px;color:var(--accent-green,#4ade80);font-weight:700;">(${depts.length} / ${depts.length} seçili)</span>
            </div>
            <div style="display:flex;gap:6px;">
              <button type="button" id="btn-dept-select-all" class="btn btn-secondary btn-small" style="font-size:10px;padding:3px 8px;">✓ Tümünü Seç</button>
              <button type="button" id="btn-dept-clear-all" class="btn btn-secondary btn-small" style="font-size:10px;padding:3px 8px;">✕ Temizle</button>
            </div>
          </div>
          <div id="pos-multi-dept-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:6px;max-height:150px;overflow-y:auto;padding:8px;background:rgba(0,0,0,0.25);border-radius:8px;border:1px solid rgba(255,255,255,0.08);">
            ${depts.map(d => `
              <label class="dept-multi-label" style="display:flex;align-items:center;gap:6px;font-size:11px;padding:5px 8px;border-radius:6px;background:rgba(255,255,255,0.03);cursor:pointer;user-select:none;transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='rgba(255,255,255,0.03)'">
                <input type="checkbox" class="dept-multi-cb" value="${d.id}" checked style="accent-color:var(--accent-blue,#3182ce);width:14px;height:14px;">
                <span style="color:var(--text-primary,#fff);font-weight:500;">${d.shortName || d.name}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <div>
          <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">Unvan</label>
          <select class="filter-select" id="pos-title-multi" style="width:100%;">${titleOptions}</select>
        </div>
      </div>

      <!-- Aranan Alanlar Bölümü -->
      <div id="pos-field-section">
        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:6px;">Aranan Alan(lar)</label>
        
        <!-- Tek Bölüm Alan Seçimi -->
        <div id="pos-single-field-container" class="field-selection">
          <label class="field-checkbox field-checkbox--all">
            <input type="checkbox" id="field-all" checked>
            <span>Tüm Alanlar</span>
          </label>
          <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:4px 0;">
          <div id="pos-field-list" style="opacity:0.4;pointer-events:none;">
            ${firstFieldCbs}
          </div>
        </div>

        <!-- Toplu İlan Alan Bilgisi -->
        <div id="pos-multi-field-info" style="display:none;padding:10px 14px;background:rgba(49,130,206,0.08);border:1px solid rgba(49,130,206,0.25);border-radius:8px;font-size:11px;color:#cbd5e1;line-height:1.5;">
          🌐 <strong>Tüm Alanlar:</strong> Toplu ilanda seçilen her bölüm için kendi müfredat ve uzmanlık alanlarına uygun genel kadro ilanı açılır (Her bölüm kendi alanındaki adayları çeker).
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
    const titleVal  = isMultiMode
      ? (el('pos-title-multi')?.value || 'dr_ogr_uyesi')
      : (el('pos-title')?.value || 'dr_ogr_uyesi');
    const salary    = parseInt(el('pos-salary-slider')?.value || 0);
    const fund      = parseInt(el('pos-fund-slider')?.value  || 0);
    const range     = scale[titleVal] || { min: 28000, max: 55000 };
    const mid       = (range.min + range.max) / 2;
    const salaryRatio = salary / mid;

    // Alan checkbox listesini güncelle (tekli bölüm modunda)
    if (!isMultiMode) {
      const deptId = el('pos-dept')?.value || '';
      const fieldList = el('pos-field-list');
      if (fieldList && deptId) {
        const fields = DEPARTMENT_FIELDS[deptId] || [];
        fieldList.innerHTML = _buildFieldCheckboxes(fields);
        const allCb = el('field-all');
        if (allCb && allCb.checked) {
          fieldList.style.opacity = '0.4';
          fieldList.style.pointerEvents = 'none';
        } else {
          fieldList.style.opacity = '1';
          fieldList.style.pointerEvents = '';
        }
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
    const baseCntLow = salaryRatio >= 1.2 ? 4 : salaryRatio >= 1.0 ? 2 : salaryRatio >= 0.8 ? 0 : 0;
    const baseCntHigh = salaryRatio >= 1.2 ? 6 : salaryRatio >= 1.0 ? 4 : salaryRatio >= 0.8 ? 2 : 0;
    const quality  = salaryRatio >= 1.2 ? 'iyi kalite' : salaryRatio >= 1.0 ? 'orta kalite' : 'düşük kalite';
    const fundNote = fund > 0 ? ' + araştırma odaklı adaylar' : '';
    const presNote = prestige >= 60 ? ' · Yüksek saygınlık bonusu' : '';

    const estimateEl = el('pos-estimate');
    if (estimateEl) {
      if (isMultiMode) {
        const checkedCount = qsa('.dept-multi-cb:checked').length;
        if (checkedCount === 0) {
          estimateEl.innerHTML = `
            <div style="font-size:11px;font-weight:700;color:#ef4444;margin-bottom:4px;">Bölüm Seçilmedi</div>
            <div style="color:var(--text-muted);">Lütfen ilan açmak için yukarıdaki listeden en az bir bölüm seçin.</div>
          `;
        } else {
          const totMin = baseCntLow * checkedCount;
          const totMax = baseCntHigh * checkedCount;
          estimateEl.innerHTML = `
            <div style="font-size:11px;font-weight:700;color:#38a169;margin-bottom:6px;">Tahmini Toplu Başvuru (${checkedCount} Bölüm)</div>
            <div>Seçilen <strong>${checkedCount} bölüm</strong> için toplam <strong>~${totMin}-${totMax} aday</strong> bekleniyor (bölüm başına ~${baseCnt} aday).</div>
            <div style="color:var(--text-muted);margin-top:4px;">${quality}${fundNote}${presNote}</div>
            <div style="margin-top:4px;color:${salaryRatio >= 1.0 ? '#38a169' : '#e53e3e'};">
              ${salaryRatio >= 1.2 ? 'Maaş baremin üstünde → tüm bölümlerde yüksek talep ve kaliteli adaylar' :
                salaryRatio >= 1.0 ? 'Maaş barem içinde → standart başvuru akışı' :
                'Maaş baremin altında → az veya zayıf aday'}
            </div>
          `;
        }
      } else {
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

    const submitBtn = el('btn-pos-submit');
    if (submitBtn) {
      if (isMultiMode) {
        const checkedCount = qsa('.dept-multi-cb:checked').length;
        if (checkedCount > 0) {
          submitBtn.textContent = `Toplu İlan Ver (${checkedCount} Bölüm)`;
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
        } else {
          submitBtn.textContent = 'En Az 1 Bölüm Seçin';
          submitBtn.disabled = true;
          submitBtn.style.opacity = '0.5';
        }
      } else {
        submitBtn.textContent = 'İlan Ver';
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
      }
    }
  }

  function _onTitleChange(titleVal) {
    const range = scale[titleVal] || { min: 28000, max: 55000 };
    const mid   = Math.round((range.min + range.max) / 2);
    const slider = el('pos-salary-slider');
    if (slider) { slider.min = range.min; slider.max = Math.round(range.max * 1.5); slider.value = mid; }
    const disp = el('pos-salary-display');
    if (disp) disp.textContent = `${mid.toLocaleString('tr-TR')} ₺/ay`;
    _updateEstimate();
  }

  // Mod Değiştirme Butonları
  on(el('pos-mode-single'), 'click', () => {
    isMultiMode = false;
    el('pos-mode-single').style.background = 'var(--accent-blue,#3182ce)';
    el('pos-mode-single').style.color = '#fff';
    el('pos-mode-single').style.border = 'none';

    el('pos-mode-multi').style.background = 'transparent';
    el('pos-mode-multi').style.color = 'var(--text-muted,#aaa)';
    el('pos-mode-multi').style.border = '1px solid rgba(255,255,255,0.1)';

    el('pos-single-section').style.display = 'grid';
    el('pos-multi-section').style.display = 'none';
    el('pos-single-field-container').style.display = 'block';
    el('pos-multi-field-info').style.display = 'none';

    // Unvan senkronizasyonu
    if (el('pos-title-multi') && el('pos-title')) {
      el('pos-title').value = el('pos-title-multi').value;
    }
    _updateEstimate();
  });

  on(el('pos-mode-multi'), 'click', () => {
    isMultiMode = true;
    el('pos-mode-multi').style.background = 'var(--accent-blue,#3182ce)';
    el('pos-mode-multi').style.color = '#fff';
    el('pos-mode-multi').style.border = 'none';

    el('pos-mode-single').style.background = 'transparent';
    el('pos-mode-single').style.color = 'var(--text-muted,#aaa)';
    el('pos-mode-single').style.border = '1px solid rgba(255,255,255,0.1)';

    el('pos-single-section').style.display = 'none';
    el('pos-multi-section').style.display = 'flex';
    el('pos-single-field-container').style.display = 'none';
    el('pos-multi-field-info').style.display = 'block';

    // Unvan senkronizasyonu
    if (el('pos-title') && el('pos-title-multi')) {
      el('pos-title-multi').value = el('pos-title').value;
    }
    _updateEstimate();
  });

  // Toplu Bölüm Seçim Butonları
  on(el('btn-dept-select-all'), 'click', () => {
    qsa('.dept-multi-cb').forEach(cb => { cb.checked = true; });
    const badge = el('pos-multi-count-badge');
    if (badge) badge.textContent = `(${depts.length} / ${depts.length} seçili)`;
    _updateEstimate();
  });

  on(el('btn-dept-clear-all'), 'click', () => {
    qsa('.dept-multi-cb').forEach(cb => { cb.checked = false; });
    const badge = el('pos-multi-count-badge');
    if (badge) badge.textContent = `(0 / ${depts.length} seçili)`;
    _updateEstimate();
  });

  delegate(el('pos-multi-dept-grid'), '.dept-multi-cb', 'change', () => {
    const checkedCount = qsa('.dept-multi-cb:checked').length;
    const badge = el('pos-multi-count-badge');
    if (badge) badge.textContent = `(${checkedCount} / ${depts.length} seçili)`;
    _updateEstimate();
  });

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
  on(el('pos-dept'), 'change', _updateEstimate);

  on(el('pos-title'), 'change', () => {
    const val = el('pos-title')?.value || 'dr_ogr_uyesi';
    if (el('pos-title-multi')) el('pos-title-multi').value = val;
    _onTitleChange(val);
  });
  on(el('pos-title-multi'), 'change', () => {
    const val = el('pos-title-multi')?.value || 'dr_ogr_uyesi';
    if (el('pos-title')) el('pos-title').value = val;
    _onTitleChange(val);
  });

  // "Tüm Alanlar" checkbox (tekli bölüm modunda)
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
    if (isMultiMode) {
      const checkedBoxes = qsa('.dept-multi-cb:checked');
      if (checkedBoxes.length === 0) {
        showNotification('L\u00fctfen en az bir b\u00f6l\u00fcm se\u00e7in.', 'warning');
        return;
      }
      const title = el('pos-title-multi')?.value || 'dr_ogr_uyesi';
      const offeredSalary = parseInt(el('pos-salary-slider')?.value || 0);
      const researchFund  = parseInt(el('pos-fund-slider')?.value  || 0);
      const hasLab        = el('pos-lab')?.checked || false;
      const postedTurn    = state.meta?.turn ?? 1;
      const now = Date.now();

      const positions = Array.from(checkedBoxes).map((cb, idx) => ({
        id:            `pos_${now}_${idx}_${cb.value}`,
        department:    cb.value,
        title:         title,
        fields:        [],
        allFields:     true,
        field:         'T\u00fcm Alanlar',
        offeredSalary: offeredSalary,
        researchFund:  researchFund,
        hasLab:        hasLab,
        postedTurn:    postedTurn,
      }));

      hideModal();
      if (onSubmit) onSubmit(positions);
    } else {
      const department = el('pos-dept')?.value || '';
      if (!department) {
        showNotification('L\u00fctfen bir b\u00f6l\u00fcm se\u00e7in.', 'warning');
        return;
      }
      const allFields = el('field-all')?.checked ?? true;
      const selectedFields = allFields
        ? []
        : Array.from(qsa('#pos-field-list input[type="checkbox"]:checked')).map(cb => cb.value);

      const position = {
        id:            `pos_${Date.now()}`,
        department:    department,
        title:         el('pos-title')?.value || 'dr_ogr_uyesi',
        fields:        selectedFields,
        allFields:     allFields,
        field:         allFields ? 'T\u00fcm Alanlar' : (selectedFields.length > 0 ? selectedFields.join(', ') : 'T\u00fcm Alanlar'),
        offeredSalary: parseInt(el('pos-salary-slider')?.value || 0),
        researchFund:  parseInt(el('pos-fund-slider')?.value  || 0),
        hasLab:        el('pos-lab')?.checked || false,
        postedTurn:    state.meta?.turn ?? 1,
      };

      hideModal();
      if (onSubmit) onSubmit(position);
    }
  });

  // İlk hesapla
  _updateEstimate();
}
