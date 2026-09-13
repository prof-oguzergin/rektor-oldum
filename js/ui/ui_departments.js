import { el, qsa, on, delegate, formatMoney, formatNumber, formatGPA, showModal, hideModal, showNotification, _statColor, _statValueColor, createStatBar } from './ui_base.js';
import { calculateOverallRating, getFacultyRatingTrend } from '../faculty.js?v=0.4.52';
import { getCourseEffectiveDifficulty, getDepartmentStudentCapacity } from '../game.js?v=0.4.50';
import { DEPARTMENT_CURRICULA, FACULTIES, ACCREDITATION_BODIES } from '../data.js?v=0.4.48';

/**
 * Bölümler sekmesi: her bölümün istatistikleri, müfredatı, atanmış dersler.
 */
export function renderDepartmentsPanel(state) {
  const panel = el('tab-departments');
  if (!panel) return;

  const depts   = state.departments || [];
  const faculty = state.faculty     || [];

  // Hoca listesini bölümlere göre O(N) tek geçişle indeksle
  const facultyByDept = new Map();
  for (const f of faculty) {
    const dId = f.department || f.departmentId;
    if (!dId) continue;
    let list = facultyByDept.get(dId);
    if (!list) { list = []; facultyByDept.set(dId, list); }
    list.push(f);
  }

  const matchIcon  = q => q === 2 ? '✓' : q === 1 ? '~' : '✗';
  const matchColor = q => q === 2 ? 'var(--accent-green)' : q === 1 ? 'var(--accent-yellow,#f5a623)' : 'var(--accent-red,#e53e3e)';
  const diffStars  = d => '★'.repeat(Math.round(d)) + '☆'.repeat(5 - Math.round(d));

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
        const deptFaculty = facultyByDept.get(dept.id) || [];
        const stats       = dept.stats || {};

        // Hoca uzmanlıklarını bir kez küçük harfe çevir (600 derste 12.000 string aramasını önler)
        const cachedFacultySpecs = deptFaculty.map(f => ({
          f,
          specs: (f.specializations || []).map(s => s.toLowerCase()),
          teaching: f.stats?.teaching || 50
        }));

        const coveredCount   = assignments.length;
        const totalCount     = curriculum.length;
        const coveragePct    = totalCount > 0 ? Math.round((coveredCount / totalCount) * 100) : 100;
        const fullMatchCount = assignments.filter(c => c.matchQuality === 2).length;
        const partialCount   = assignments.filter(c => c.matchQuality === 1).length;

        const edQuality  = dept.educationQuality ?? 50;
        const edColor    = edQuality >= 70 ? 'var(--accent-green)' : edQuality >= 45 ? 'var(--accent-yellow,#f5a623)' : 'var(--accent-red,#e53e3e)';

        const enrolled   = stats.totalEnrolled ?? dept.enrolledStudents ?? 0;
        const capacity   = stats.capacity ?? getDepartmentStudentCapacity(dept, state);
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

        const fillRatio  = capacity > 0 ? enrolled / capacity : 0;
        const statusText = fillRatio > 1.0 ? '⚠️ Kapasite aşıldı' : fillRatio > 0.85 ? '⚡ Dolmak üzere' : '✓ Normal';

        const courseStats = stats.courseStats || [];

        const courseRows = curriculum.map(course => {
          const assign     = assignments.find(a => a.course?.id === course.id);
          const isUncovered = uncovered.some(u => u.id === course.id);
          const cStat      = courseStats.find(cs => cs.id === course.id);

          const effectiveDiff = getCourseEffectiveDifficulty(dept, course);

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

          const req = (course.requiredExpertise || '').toLowerCase();
          const reqSub = req.length >= 5 ? req.substring(0, 5) : req;
          let bestQ = 0;
          let bestF = null;

          if (req) {
            for (let i = 0; i < cachedFacultySpecs.length; i++) {
              const item = cachedFacultySpecs[i];
              let q = 1;
              const sp = item.specs;
              for (let j = 0; j < sp.length; j++) {
                const s = sp[j];
                if (s === req) { q = 2; break; }
                if (reqSub && (s.includes(reqSub) || (s.length >= 5 && req.includes(s.substring(0, 5))))) {
                  q = 2; break;
                }
              }
              if (q > bestQ || (q === bestQ && item.teaching > (bestF?.stats?.teaching || 50))) {
                bestQ = q;
                bestF = item.f;
              }
            }
          }
          const potential = { q: bestQ, f: bestF };

          let potentialStr = '';
          if (potential.f) {
            const pIcon = matchIcon(potential.q);
            const isDifferentHoca = assign ? (assign.assignedTo !== potential.f.id) : true;
            const isDifferentQual = assign ? (assign.matchQuality !== potential.q) : true;

            if (isDifferentHoca || isDifferentQual) {
              potentialStr = `<span style="font-size:11px;opacity:0.7;margin-left:4px;">(${pIcon})</span>`;
              if (isDifferentHoca) {
                assignedTo += ` <span style="font-size:11px;opacity:0.7;">(${potential.f.name})</span>`;
              }
            }
          }

          const enrolledStr = cStat ? `${cStat.enrolled} öğr.` : '—';
          const passRateStr = cStat ? `%${Math.round(cStat.passRate * 100)}` : '—';
          const avgGradeStr = cStat ? `${cStat.avgGrade}/100` : '—';
          const passColor   = cStat ? (cStat.passRate >= 0.80 ? 'var(--accent-green)' : cStat.passRate >= 0.60 ? 'var(--accent-yellow,#f5a623)' : 'var(--accent-red,#e53e3e)') : 'var(--text-muted)';

          const sliderColor = effectiveDiff >= 4 ? '#e53e3e' : effectiveDiff >= 3 ? '#f5a623' : '#38a169';

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
              <td style="padding:6px 8px;font-size:11px;color:var(--text-muted);">${diffStars(effectiveDiff)}</td>
              <td style="padding:6px 8px;font-size:11px;color:var(--text-muted);white-space:nowrap;">${enrolledStr}</td>
              <td style="padding:6px 8px;font-size:12px;font-weight:700;color:${passColor};">${passRateStr}</td>
              <td style="padding:6px 8px;font-size:11px;color:var(--text-muted);">${avgGradeStr}</td>
              <td style="padding:6px 8px;font-size:12px;font-weight:700;color:${statusColor};">${statusIcon}${potentialStr}</td>
              <td style="padding:6px 8px;font-size:12px;color:var(--text-muted);">${assignedTo}</td>
              <td style="padding:6px 8px;min-width:120px;">
                <div style="display:flex;align-items:center;gap:6px;">
                  <input type="range" min="1" max="5" step="1" value="${effectiveDiff}"
                    style="width:70px;accent-color:${sliderColor};cursor:pointer;"
                    oninput="window._onSetCourseDifficulty('${dept.id}', '${course.id}', this.value)"
                    title="Zorluk ayarı: 1 (kolay) - 5 (çok zor)">
                  <span style="font-size:11px;font-weight:700;color:${sliderColor};min-width:8px;">${effectiveDiff}</span>
                </div>
              </td>
            </tr>
          `;
        }).join('');

        return `
          <div class="card" style="padding:0;overflow:hidden;">
            <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;
                 border-bottom:2px solid var(--border);background:var(--bg-secondary);">
              <span style="font-size:28px;">${dept.icon || '🏫'}</span>
              <div style="flex:1;">
                <div style="font-size:15px;font-weight:700;">${dept.name}</div>
                <div style="font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                  <span>${deptFaculty.length} hoca</span>
                  <span>·</span>
                  <span>${deptFaculty.reduce((s, f) => s + ((f.currentLoad?.assignedCourses || []).length), 0)} ders yükü</span>
                  <span>·</span>
                  <span style="color:${capColor};font-weight:600;" title="Bölüm Mevcudu: ${enrolled} / Derslik Kapasitesi: ${capacity}">
                    👥 ${enrolled}/${capacity} öğrenci (${statusText})
                  </span>
                </div>
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
            ${(() => {
              const acc = dept.accreditation;
              if (!acc) return '';
              const currentTurn = state.meta?.turn || 0;
              const _isAcc = (a) => a && (a.status === 'granted' || a.isRenewing || (a.status === 'applied' && a.grantedAt != null && (a.expiresAt == null || a.expiresAt >= currentTurn)));
              const _isRenew = (a) => a && (a.isRenewing || (a.status === 'applied' && a.grantedAt != null && a.expiresAt >= currentTurn));
              const badges = [];

              if (_isAcc(acc.mudek)) badges.push(`<span style="font-size:10px;padding:2px 6px;border-radius:10px;background:rgba(56,161,105,0.15);color:var(--accent-green);border:1px solid var(--accent-green);" title="MÜDEK Akredite${_isRenew(acc.mudek) ? ' (Yenileniyor)' : ''}">MÜDEK ✓${_isRenew(acc.mudek) ? ' ⏳' : ''}</span>`);
              else if (acc.mudek?.status === 'applied') badges.push('<span style="font-size:10px;padding:2px 6px;border-radius:10px;background:rgba(245,166,35,0.15);color:var(--accent-yellow,#f5a623);border:1px solid var(--accent-yellow,#f5a623);" title="MÜDEK Başvuruda">MÜDEK ⏳</span>');
              else if (acc.mudek?.status === 'expired') badges.push('<span style="font-size:10px;padding:2px 6px;border-radius:10px;background:rgba(229,62,62,0.15);color:var(--accent-red,#e53e3e);border:1px solid var(--accent-red,#e53e3e);" title="MÜDEK Süresi Doldu">MÜDEK !</span>');

              if (_isAcc(acc.abet)) badges.push(`<span style="font-size:10px;padding:2px 6px;border-radius:10px;background:rgba(66,153,225,0.15);color:#4299e1;border:1px solid #4299e1;" title="ABET Akredite${_isRenew(acc.abet) ? ' (Yenileniyor)' : ''}">ABET ✓${_isRenew(acc.abet) ? ' ⏳' : ''}</span>`);
              else if (acc.abet?.status === 'applied') badges.push('<span style="font-size:10px;padding:2px 6px;border-radius:10px;background:rgba(245,166,35,0.15);color:var(--accent-yellow,#f5a623);border:1px solid var(--accent-yellow,#f5a623);" title="ABET Başvuruda">ABET ⏳</span>');
              else if (acc.abet?.status === 'expired') badges.push('<span style="font-size:10px;padding:2px 6px;border-radius:10px;background:rgba(229,62,62,0.15);color:var(--accent-red,#e53e3e);border:1px solid var(--accent-red,#e53e3e);" title="ABET Süresi Doldu">ABET !</span>');

              if (_isAcc(acc.theqa)) badges.push(`<span style="font-size:10px;padding:2px 6px;border-radius:10px;background:rgba(214,158,46,0.15);color:#d69e2e;border:1px solid #d69e2e;" title="THEQA Akredite${_isRenew(acc.theqa) ? ' (Yenileniyor)' : ''}">THEQA ✓${_isRenew(acc.theqa) ? ' ⏳' : ''}</span>`);
              else if (acc.theqa?.status === 'applied') badges.push('<span style="font-size:10px;padding:2px 6px;border-radius:10px;background:rgba(245,166,35,0.15);color:var(--accent-yellow,#f5a623);border:1px solid var(--accent-yellow,#f5a623);" title="THEQA Başvuruda">THEQA ⏳</span>');
              else if (acc.theqa?.status === 'expired') badges.push('<span style="font-size:10px;padding:2px 6px;border-radius:10px;background:rgba(229,62,62,0.15);color:var(--accent-red,#e53e3e);border:1px solid var(--accent-red,#e53e3e);" title="THEQA Süresi Doldu">THEQA !</span>');

              if (badges.length === 0) return '';
              return `<div style="display:flex;gap:4px;flex-wrap:wrap;padding:4px 16px 8px;background:var(--bg-secondary);">${badges.join('')}</div>`;
            })()}

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:0;border-bottom:1px solid var(--border);">
              <div style="padding:12px 16px;border-right:1px solid var(--border);text-align:center;">
                <div style="font-size:15px;font-weight:700;color:${capColor};">Öğrenci: ${enrolled} / ${capacity}</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
                  Doluluk: %${Math.round(fillRatio * 100)} · Kontenjan: ${(() => {
                    const q = state.students?.quotas?.[dept.id];
                    const annualQuota = q ? ((q.tamBurslu||0) + (q.yariBurslu||0) + (q.ucretli||0)) : (dept.programs?.lisans?.quota ?? Math.round(capacity / 4));
                    return annualQuota;
                  })()}
                  ${fillRatio > 1.0 ? `<div style="color:var(--accent-red,#e53e3e);font-size:10px;margin-top:2px;" title="Kampüs sekmesinden Fakülte Binası atayarak veya büyüterek kapasiteyi artırabilirsiniz.">⚠️ Öğrenci kapasitesi aşıldı</div>` : ''}
                </div>
                <div style="margin-top:6px;height:4px;border-radius:2px;background:var(--border);" title="Doluluk oranı: %${Math.round(fillRatio * 100)}">
                  <div style="height:100%;border-radius:2px;width:${Math.min(100,Math.round(fillRatio*100))}%;background:${capColor};transition:width 0.4s;"></div>
                </div>
              </div>
              <div style="padding:12px 16px;border-right:1px solid var(--border);text-align:center;">
                <div style="font-size:16px;font-weight:700;color:var(--text-primary);">${diffStars(diffRating)}</div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">Zorluk (${diffRating.toFixed(1)}/5)</div>
              </div>
              <div style="padding:12px 16px;border-right:1px solid var(--border);text-align:center;">
                <div style="font-size:18px;font-weight:700;color:${failColor};">${pct(failRate)}</div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">Başarısızlık Oranı</div>
              </div>
              <div style="padding:12px 16px;border-right:1px solid var(--border);text-align:center;">
                <div style="font-size:18px;font-weight:700;color:${gpaColor};">${formatGPA(avgGPA)}</div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">Ortalama GPA</div>
              </div>
              <div style="padding:12px 16px;border-right:1px solid var(--border);text-align:center;">
                <div style="font-size:18px;font-weight:700;color:${gradColor};">${pct(gradRate)}</div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">Mezuniyet Oranı</div>
              </div>
              <div style="padding:12px 16px;text-align:center;">
                <div style="font-size:18px;font-weight:700;color:${dropRate > 0.05 ? 'var(--accent-red,#e53e3e)' : 'var(--text-muted)'};">${pct(dropRate)}</div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">Bırakma Oranı</div>
              </div>
            </div>

            <div style="padding:10px 16px;border-bottom:1px solid var(--border);font-size:12px;display:flex;gap:20px;flex-wrap:wrap;align-items:center;">
              <span style="font-weight:600;color:var(--text-muted);">Sınıf Dağılımı:</span>
              <span>1. Sınıf: <strong>${byYear[1] || 0}</strong></span>
              <span>2. Sınıf: <strong>${byYear[2] || 0}</strong></span>
              <span>3. Sınıf: <strong>${byYear[3] || 0}</strong></span>
              <span>4. Sınıf: <strong>${byYear[4] || 0}</strong></span>
            </div>

            <div style="display:flex;gap:16px;padding:8px 16px;border-bottom:1px solid var(--border);font-size:12px;flex-wrap:wrap;">
              <span style="color:var(--accent-green);">✓ ${fullMatchCount} tam eşleşme</span>
              <span style="color:var(--accent-yellow,#f5a623);">~ ${partialCount} kısmi eşleşme</span>
              ${uncovered.length > 0 ? `<span style="color:var(--accent-red,#e53e3e);">⚠️ ${uncovered.length} karşılanmayan ders</span>` : ''}
              ${dept.partTimeHires > 0 ? `<span style="color:var(--text-muted);">👤 ${dept.partTimeHires} dışarıdan hoca</span>` : ''}
            </div>

            ${curriculum.length === 0 ? `
              <div class="empty-state" style="padding:16px;">
                <div style="font-size:12px;color:var(--text-faint);">Bu bölüm için müfredat tanımlanmamış.</div>
              </div>
            ` : `
              <div style="padding:12px 16px 0;">
                <div style="background:rgba(56,161,105,0.08);border-left:3px solid #38a169;padding:10px;margin-bottom:12px;font-size:12px;line-height:1.5;">
                  <strong>Müfredat sertliği oyununuzun karakterini belirler:</strong><br>
                  <span style="color:#38a169;">&#8593; Yüksek zorluk:</span> Nitelikli mezunlar, prestij ve sıralama yükselir, ünlü mezun ihtimali artar. Ama öğrenci memnuniyeti düşer ve geçme oranı azalır.<br>
                  <span style="color:#dc8a2e;">&#8595; Düşük zorluk:</span> Öğrenciler memnun, geçme oranı yüksek. Ama mezun kalitesi ve uzun vadede prestij düşer.
                </div>
              </div>
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
                      <th style="padding:6px 8px;font-size:10px;text-transform:uppercase;color:var(--text-muted);text-align:left;min-width:120px;">Zorluk Ayarı</th>
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

/**
 * Fakülteler sekmesi: fakülte hiyerarşisi, bölüm başkanı atama, hoca listesi.
 */
const _openedDeptDetails = new Set();

/**
 * Bölüm hoca tablosu HTML'ini lazy olarak üretir.
 */
function _buildDeptFacultyTableHtml(deptFaculty, dept, titleLabels) {
  if (!deptFaculty || deptFaculty.length === 0) {
    return `
      <table class="data-table" style="font-size:12px;">
        <tbody><tr><td colspan="9" class="text-muted text-center" style="padding:12px;">Bu bölümde hoca yok</td></tr></tbody>
      </table>`;
  }

  const rows = deptFaculty.map(f => {
    const isHead = dept && f.id === dept.headId;
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
                data-faculty-id="${f.id}" data-current-dept="${dept?.id || ''}"
                title="Bölüm değiştir">Taşı</button>
      </td>
    </tr>`;
  }).join('');

  return `
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
      <tbody>${rows}</tbody>
    </table>`;
}

/**
 * Fakülteler sekmesi: fakülte hiyerarşisi, bölüm başkanı atama, hoca listesi.
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

  // 1. Hoca listesini bölümlere göre O(N) tek geçişle indeksle (O(D*N) aramaları O(1)'e iner)
  const facultyByDept = new Map();
  for (const f of faculty) {
    const dId = f.department || f.departmentId;
    if (!dId) continue;
    let list = facultyByDept.get(dId);
    if (!list) { list = []; facultyByDept.set(dId, list); }
    list.push(f);
  }

  // 2. Bilinen tüm fakülte tanımları (FACULTIES ve state.fakulteler birleşimi)
  const allFaculties = {};
  for (const [fId, fDef] of Object.entries(FACULTIES)) {
    allFaculties[fId] = { id: fId, name: fDef.name, icon: fDef.icon, departments: [...fDef.departments] };
  }
  if (state.fakulteler) {
    for (const [fId, fObj] of Object.entries(state.fakulteler)) {
      if (!allFaculties[fId]) {
        const rawName = fObj.name || fId;
        allFaculties[fId] = {
          id: fId,
          name: rawName.endsWith('Fakültesi') ? rawName : `${rawName} Fakültesi`,
          icon: fObj.icon || '🏫',
          departments: Array.isArray(fObj.departments) ? [...fObj.departments] : [],
        };
      } else if (Array.isArray(fObj.departments)) {
        const combined = new Set([...allFaculties[fId].departments, ...fObj.departments]);
        allFaculties[fId].departments = Array.from(combined);
      }
    }
  }

  // 3. Aktif bölümleri fakültelerine göre grupla (Mükerrer render kesin olarak önlendi)
  const fakGroups = [];
  const assignedDeptIds = new Set();

  for (const [fId, fData] of Object.entries(allFaculties)) {
    const activeDepts = depts.filter(d => !assignedDeptIds.has(d.id) && ((fData.departments || []).includes(d.id) || d.faculty === fId));
    if (activeDepts.length === 0) continue;
    activeDepts.forEach(d => assignedDeptIds.add(d.id));
    fakGroups.push({ id: fId, name: fData.name, icon: fData.icon, depts: activeDepts });
  }

  // 4. Hiçbir fakülteye girmemiş kalan bölümler
  const unassignedDepts = depts.filter(d => !assignedDeptIds.has(d.id));
  if (unassignedDepts.length > 0) {
    fakGroups.push({ id: 'diger', name: 'Diğer Bölümler', icon: '🏫', depts: unassignedDepts });
  }

  function deptCard(dept) {
    const deptFaculty = facultyByDept.get(dept.id) || [];
    const head        = dept.headId ? faculty.find(f => f.id === dept.headId) : null;
    const headName    = head ? `${head.name} (Yönetim: ${head.stats?.management ?? '—'}/100)` : 'Atanmamış ⚠️';
    const headClass   = head ? '' : 'text-warn';

    let profCount = 0, docCount = 0, drCount = 0, argoCount = 0, sumRating = 0;
    const headCandidates = [];
    for (const f of deptFaculty) {
      if (f.title === 'profesor') { profCount++; headCandidates.push(f); }
      else if (f.title === 'docent') { docCount++; headCandidates.push(f); }
      else if (f.title === 'dr_ogr_uyesi') { drCount++; }
      else if (f.title === 'argö') { argoCount++; }
      sumRating += (f.overallRating || calculateOverallRating(f));
    }

    const byDept     = state.students?.byDepartment?.[dept.id];
    const y1 = byDept?.year1?.count || 0;
    const y2 = byDept?.year2?.count || 0;
    const y3 = byDept?.year3?.count || 0;
    const y4 = byDept?.year4?.count || 0;
    const totalStudents = y1 + y2 + y3 + y4;

    const ratio = deptFaculty.length > 0 ? (totalStudents / deptFaculty.length).toFixed(0) : '—';
    const ratioWarn = deptFaculty.length > 0 && (totalStudents / deptFaculty.length) > 30;

    const _gpaYears = ['year1', 'year2', 'year3', 'year4'];
    let _gpaSum = 0, _gpaCnt = 0;
    for (const yk of _gpaYears) {
      const yd = byDept?.[yk];
      if (yd && yd.count > 0 && yd.avgGPA > 0) { _gpaSum += yd.avgGPA * yd.count; _gpaCnt += yd.count; }
    }
    const avgGPA = _gpaCnt > 0 ? (_gpaSum / _gpaCnt).toFixed(2) : '—';

    const yks = byDept?.year1?.avgYKS || byDept?.avgYKS || 0;
    const avgYKS = yks > 0 ? formatNumber(yks) : '—';

    const rawSatisfaction = state.students?.overallSatisfaction ?? dept.studentSatisfaction ?? 50;
    const satisfaction = Math.round(rawSatisfaction);
    const satColor = satisfaction >= 70 ? 'var(--accent-green)' : satisfaction >= 45 ? 'var(--accent-yellow,#f5a623)' : 'var(--accent-red,#e53e3e)';

    const headSelectOptions = headCandidates.map(f =>
      `<option value="${f.id}" ${f.id === dept.headId ? 'selected' : ''}>
        ${titleLabels[f.title] || f.title} ${f.name} (Yönetim: ${f.stats?.management ?? '—'})
      </option>`
    ).join('');

    const deptAvgRating = deptFaculty.length > 0 ? Math.round(sumRating / deptFaculty.length) : 0;
    const avgRatingColor = deptAvgRating >= 70 ? '#38a169' : deptAvgRating >= 55 ? '#f5a623' : '#e53e3e';

    const isOpen = _openedDeptDetails.has(dept.id);
    const facultyTableHtml = isOpen ? _buildDeptFacultyTableHtml(deptFaculty, dept, titleLabels) : '';

    return `
      <div class="card dept-detail-card" data-dept-id="${dept.id}" style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
          <div>
            <span style="font-size:18px;">${dept.icon || '🏛️'}</span>
            <strong style="font-size:15px;">${dept.name}</strong>
            <span class="badge badge-default" style="margin-left:6px;">${dept.accreditationStatus || 'pending'}</span>
          </div>
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

        <details class="dept-faculty-details" data-dept-id="${dept.id}" ${isOpen ? 'open' : ''} style="margin-bottom:10px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:6px;padding:8px 12px;">
          <summary style="cursor:pointer;font-size:13px;color:var(--text-muted);font-weight:600;display:flex;align-items:center;gap:6px;user-select:none;">
            <span>👥 Hocalar (${deptFaculty.length})</span>
            <span class="dept-faculty-toggle-hint" style="font-size:11px;opacity:0.75;margin-left:auto;font-weight:normal;">${isOpen ? '▲ Gizle' : '▼ Listele'}</span>
          </summary>
          <div class="dept-faculty-table-container" style="overflow-x:auto;padding-top:8px;">
            ${facultyTableHtml}
          </div>
        </details>

        ${renderGradProgramCard(dept, state, deptFaculty)}
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
    <div class="panel-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
      <div>
        <div class="panel-title">Fakülteler &amp; Bölümler</div>
        <div class="panel-subtitle">${depts.length} aktif bölüm — ${fakGroups.length} fakülte — Toplam ${faculty.length} hoca</div>
      </div>
      <div>
        <button class="btn btn-xs btn-ghost" id="btn-toggle-all-dept-faculty" style="font-size:11px;padding:4px 10px;border:1px solid var(--border);">
          📂 Tüm Hoca Listelerini Aç / Kapat
        </button>
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

  // Tekil capturing toggle listener (Lazy rendering: sadece açılan bölümün tablosunu 0.1ms'de üretir)
  if (!panel._hasToggleListener) {
    panel._hasToggleListener = true;
    panel.addEventListener('toggle', (e) => {
      const details = e.target.closest('.dept-faculty-details');
      if (!details) return;
      const deptId = details.dataset.deptId;
      const hint = details.querySelector('.dept-faculty-toggle-hint');
      if (details.open) {
        _openedDeptDetails.add(deptId);
        if (hint) hint.textContent = '▲ Gizle';
        const container = details.querySelector('.dept-faculty-table-container');
        if (container && !container.firstElementChild) {
          const dObj = (panel._latestState?.departments || []).find(d => d.id === deptId);
          const dFac = panel._latestFacultyByDept?.get(deptId) || [];
          container.innerHTML = _buildDeptFacultyTableHtml(dFac, dObj, titleLabels);
        }
      } else {
        _openedDeptDetails.delete(deptId);
        if (hint) hint.textContent = '▼ Listele';
      }
    }, true);
  }

  // Son state ve harita referanslarını panel üzerinde sakla (lazy toggle anında erişim için)
  panel._latestState = state;
  panel._latestFacultyByDept = facultyByDept;
  panel._onAssignHead = onAssignHead;
  panel._onReassignFaculty = onReassignFaculty;

  // Tekil delegated click listener (Yüzlerce DOM dinleyicisi yerine 1 tek hafif handler)
  if (!panel._hasClickListener) {
    panel._hasClickListener = true;
    panel.addEventListener('click', (e) => {
      // 0. Tüm Hoca Listelerini Aç / Kapat
      const toggleAllBtn = e.target.closest('#btn-toggle-all-dept-faculty');
      if (toggleAllBtn) {
        const allDetails = panel.querySelectorAll('.dept-faculty-details');
        const shouldOpen = Array.from(allDetails).some(d => !d.open);
        allDetails.forEach(d => {
          d.open = shouldOpen;
        });
        return;
      }

      // 1. Bölüm Başkanı Ata
      const assignBtn = e.target.closest('.btn-assign-head');
      if (assignBtn) {
        const deptId = assignBtn.dataset.deptId;
        const sel    = panel.querySelector(`.select-head-candidate[data-dept-id="${deptId}"]`);
        const facId  = sel ? sel.value : '';
        if (!facId) { showNotification('Lütfen bir hoca seçin.', 'warning'); return; }
        if (panel._onAssignHead) panel._onAssignHead(deptId, facId);
        return;
      }

      // 2. Akreditasyon Başvuru / Yenileme
      const accBtn = e.target.closest('.acc-apply-btn, .acc-renew-btn');
      if (accBtn) {
        e.stopPropagation();
        const deptId = accBtn.dataset.deptId;
        const bodyId = accBtn.dataset.bodyId;
        if (window._onShowAccreditationModal) {
          window._onShowAccreditationModal(deptId, bodyId);
        }
        return;
      }

      // 3. Hoca Bölüm Taşı
      const reassignBtn = e.target.closest('.btn-reassign-faculty');
      if (reassignBtn) {
        e.stopPropagation();
        const facId       = reassignBtn.dataset.facultyId;
        const currentDept = reassignBtn.dataset.currentDept;
        const activeDepts = panel._latestState?.departments || [];
        const otherDepts  = activeDepts.filter(d => d.id !== currentDept);
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
              if (targetDept && panel._onReassignFaculty) {
                panel._onReassignFaculty(facId, targetDept);
                hideModal();
              }
            });
          }
        }, 50);
        return;
      }
    });
  }
}

/**
 * Bir bölümün akreditasyon durumunu gösteren HTML döndürür.
 */
function renderDeptAccreditation(dept, state) {
  const accData = dept.accreditation;
  if (!accData) return '';

  const turn = state?.meta?.turn || 1;

  function turnToLabel(t) {
    const y = Math.ceil(t / 2);
    const s = (t % 2 === 1) ? 'Güz' : 'Bahar';
    return `${y}. Yıl ${s}`;
  }

  const grantedBadges = [];
  const pendingBadges = [];
  const availableButtons = [];

  Object.entries(ACCREDITATION_BODIES).forEach(([bodyId, body]) => {
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

/**
 * Bölümün lisansüstü program kartı HTML'ini üretir.
 */
export function renderGradProgramCard(dept, state, preloadedFaculty = null) {
  const programs  = dept.programs;
  if (!programs) return '';

  const yl  = programs.yuksek_lisans;
  const phd = programs.doktora;

  if (!yl?.active && !phd?.active) return '';

  const faculty   = state.faculty || [];
  const deptFaculty = preloadedFaculty || faculty.filter(f => (f.department || f.departmentId) === dept.id);
  const drPlus    = deptFaculty.filter(f => ['dr_ogr_uyesi','docent','profesor'].includes(f.title)).length;

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

/**
 * Bir bölümdeki hocaların ortalama genel puanını hesaplar.
 */
export function getDeptAvgRating(deptId, faculty) {
  const deptFaculty = Array.isArray(faculty) && faculty.length > 0 && ((faculty[0].department || faculty[0].departmentId) === deptId)
    ? faculty
    : (faculty || []).filter(f => (f.department || f.departmentId) === deptId);
  if (deptFaculty.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < deptFaculty.length; i++) {
    const f = deptFaculty[i];
    sum += (f.overallRating || calculateOverallRating(f));
  }
  return Math.round(sum / deptFaculty.length);
}
