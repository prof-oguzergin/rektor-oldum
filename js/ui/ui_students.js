import { el, qsa, on, formatNumber, formatMoney, formatGPA, showModal, hideModal, showNotification, createStarRating, _gpaColor, _satColor, _statCardHtml } from './ui_base.js';
import { UNIVERSITY_MODELS, BUILDINGS } from '../data.js?v=0.4.48';

/**
 * Öğrenci sekmesi: sınıf bazlı tablo, YKS istatistikleri, yıldız öğrenciler, kontenjan butonu.
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
        <div style="font-size:22px;font-weight:700;color:${satColor(overall)};">${Math.round(overall)}<span style="font-size:12px;color:var(--text-muted);">/100</span></div>
        <div style="font-size:11px;color:var(--text-muted);">Genel Öğrenci Memnuniyeti</div>
      </div>
      ${breakdown ? `
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-left:auto;">
          ${Object.values(breakdown).slice(0,5).map(f => `
            <div style="text-align:center;min-width:52px;">
              <div style="font-size:12px;font-weight:700;color:${satColor(f.score)};">${Math.round(f.score)}</div>
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

  // Yıldız kalitesi
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
        <div style="margin-top:3px;font-size:10px;color:var(--text-faint);">
          En güçlü: <strong style="color:${topStatVal >= 80 ? 'var(--accent-green)' : 'var(--text-muted)'};">${statLabels[topStatKey] || topStatKey} ${topStatVal}</strong>
        </div>
        ${recentEvents.length > 0 ? `
          <div style="margin-top:4px;">
            ${recentEvents.map(ev => `
              <div style="font-size:10px;color:${ev.type === 'competition_win' ? '#38a169' : ev.type === 'publication' ? 'var(--accent-blue)' : 'var(--text-muted)'};margin-bottom:1px;">
                ${ev.type === 'competition_win' ? '🏆' : ev.type === 'publication' ? '📄' : ev.type === 'graduation' ? '🎓' : '✨'} ${ev.description || ''}
              </div>
            `).join('')}
          </div>
        ` : ''}
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

/**
 * Bahar dönemi öncesi kontenjan belirleme modalını açar.
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
  const completedBuildings = (state.buildings || []).filter(b => b.isCompleted);
  const totalClassroomCap  = completedBuildings.reduce((s, b) => {
    const classrooms  = b.currentCapacity?.classrooms || 0;
    const bldgDef     = BUILDINGS[b.type];
    const bldgLevel   = b.level || 1;
    const clsSzByLvl  = bldgDef?.classroomSizeByLevel;
    const clsSize     = clsSzByLvl
      ? (clsSzByLvl[bldgLevel] ?? clsSzByLvl[1] ?? bldgDef?.classroomSize ?? 40)
      : (bldgDef?.classroomSize ?? 40);
    const seats       = classrooms * clsSize;
    const legacyCap   = b.currentCapacity?.students || b.currentCapacity?.classroom || 0;
    return s + (seats > 0 ? seats : legacyCap);
  }, 0);

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

  const totalFaculty       = (state.faculty || []).length;
  const maxStudentsByFaculty = totalFaculty * 30;
  const effectiveCapacity  = Math.max(50, totalClassroomCap > 0 && maxStudentsByFaculty > 0 ? Math.min(totalClassroomCap, maxStudentsByFaculty) : totalClassroomCap > 0 ? totalClassroomCap : maxStudentsByFaculty);

  let currentEnrolledUpperYears = 0;
  for (const d of Object.values(byDept)) {
    currentEnrolledUpperYears += (d.year2?.count || 0) + (d.year3?.count || 0) + (d.year4?.count || 0);
  }
  const remainingCapacity = Math.max(0, effectiveCapacity - currentEnrolledUpperYears);

  const isDevlet    = uniType === 'devlet';
  const isUSPrivate = uniType === 'us_private';
  const isVakif     = !isDevlet && !isUSPrivate;

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
      const katkiPayi = UNIVERSITY_MODELS.devlet.revenueStreams.ogrenciKatkiPayi?.perStudent ?? 2_000;
      return (tam + yari + ucret) * katkiPayi;
    }
    if (isUSPrivate) {
      const aidRate    = state.university?.financialAidRate ?? 0.45;
      const merritRate = tam / Math.max(1, tam + yari + ucret);
      const avgNet     = baseTuition * (1 - aidRate * (1 - merritRate));
      return (tam + yari + ucret) * avgNet;
    }
    const income = (yari * baseTuition * mult * 0.50) + (ucret * baseTuition * mult * 1.0);
    const burs   = (tam * baseTuition * mult * 1.0) + (yari * baseTuition * mult * 0.50);
    return income - burs;
  }

  function defaultQuota(id) {
    if (isDevlet) return { tamBurslu: 0, yariBurslu: 0, ucretli: 50 };
    if (isUSPrivate) return { tamBurslu: 10, yariBurslu: 20, ucretli: 30 };
    return { tamBurslu: 5, yariBurslu: 10, ucretli: 30 };
  }

  const col1Label = isDevlet ? 'Devlet Bursu (0 harç)' : isUSPrivate ? 'Merit Scholarship' : 'Tam Burslu (0 harç)';
  const col2Label = isDevlet ? 'Kısmi Destek' : isUSPrivate ? 'Need-Based Aid' : '%50 Burslu';
  const col3Label = isDevlet ? 'Kontenjan (Tam)' : isUSPrivate ? 'Full Pay (Sınırlı)' : 'Ücretli';

  const infoBlock = isDevlet
    ? `<strong>Bütçe tahsisi:</strong> YÖK &nbsp;|&nbsp; <strong>Harç:</strong> Ücretsiz (katkı payı: ${formatMoney(2000)}/dönem) &nbsp;|&nbsp; <strong>Saygınlık:</strong> ${prestige}`
    : isUSPrivate
      ? `<strong>Harç:</strong> ${formatMoney(baseTuition)}/dönem &nbsp;|&nbsp; <strong>Ortalama Aid:</strong> %${Math.round((state.university?.financialAidRate ?? 0.45) * 100)} &nbsp;|&nbsp; <strong>Saygınlık:</strong> ${prestige}`
      : `<strong>Baz harç:</strong> ${formatMoney(baseTuition)}/dönem &nbsp;|&nbsp; <strong>Saygınlık:</strong> ${prestige} &nbsp;|&nbsp; <strong>Tip:</strong> Vakıf`;

  const capColor = remainingCapacity < 20 ? 'var(--accent-red,#e53e3e)' : remainingCapacity < 60 ? '#f5a623' : 'var(--accent-green)';

  const pending = state.pendingApplications || [];

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

        const inputCols = isDevlet ? `
          <div style="max-width:200px;">
            <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">Toplam Kontenjan</label>
            <div style="font-size:10px;color:var(--text-faint);margin-bottom:4px;">YKS: ${yksRange('ucretli')}</div>
            <input type="number" min="0" max="500" value="${(q.tamBurslu||0)+(q.yariBurslu||0)+(q.ucretli||0)}"
              class="quota-input" data-field="ucretli"
              style="width:100%;padding:6px;border-radius:6px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-primary);font-size:14px;">
          </div>
        ` : `
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:10px;">
            <div>
              <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">${col1Label} <span style="color:var(--accent-green);">(0 harç)</span></label>
              <div style="font-size:10px;color:var(--text-faint);margin-bottom:4px;">YKS: ${yksRange('tam_burslu')}</div>
              <input type="number" min="0" max="200" value="${q.tamBurslu||0}" class="quota-input" data-field="tamBurslu"
                style="width:100%;padding:6px;border-radius:6px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-primary);font-size:14px;">
            </div>
            <div>
              <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">${col2Label} <span style="color:var(--accent-yellow,#f5a623);">(yarı ücret)</span></label>
              <div style="font-size:10px;color:var(--text-faint);margin-bottom:4px;">YKS: ${yksRange('yari_burslu')}</div>
              <input type="number" min="0" max="200" value="${q.yariBurslu||0}" class="quota-input" data-field="yariBurslu"
                style="width:100%;padding:6px;border-radius:6px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-primary);font-size:14px;">
            </div>
            <div>
              <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">${col3Label} <span style="color:var(--text-faint);">(tam harç)</span></label>
              <div style="font-size:10px;color:var(--text-faint);margin-bottom:4px;">YKS: ${yksRange('ucretli')}</div>
              <input type="number" min="0" max="500" value="${q.ucretli||0}" class="quota-input" data-field="ucretli"
                style="width:100%;padding:6px;border-radius:6px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-primary);font-size:14px;">
            </div>
          </div>
        `;

        const netLabel = isDevlet
          ? `Katkı payı: <strong class="qs-net" style="color:var(--accent-green);">${formatMoney(net)}/dönem</strong>`
          : `Net etki: <strong class="qs-net" style="color:${net >= 0 ? 'var(--accent-green)' : 'var(--accent-red,#e53e3e)'};">${formatMoney(net)}/dönem</strong>`;

        const deptFacultyCount = (state.faculty || []).filter(f => (f.departmentId || f.department) === dept.id).length;
        const deptMaxByFaculty = deptFacultyCount * 30;
        const thisQuotaTotal   = (q.tamBurslu||0) + (q.yariBurslu||0) + (q.ucretli||0);
        const exceedsCapacity  = deptMaxByFaculty > 0 && thisQuotaTotal > deptMaxByFaculty;
        const deptSeats = deptClassroomCapacity[dept.id] || 0;
        const exceedsDersklik = deptSeats > 0 && thisQuotaTotal > deptSeats;

        const assignedBuildingDetails = completedBuildings
          .filter(b => (b.assignedDepartments || []).includes(dept.id))
          .map(b => `${b.name || b.type}`).join(', ');

        return `
          <div class="card" style="margin-bottom:12px;" data-dept="${dept.id}">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
              <span style="font-size:16px;">${dept.icon||'🏛️'}</span>
              <div style="flex:1;">
                <div style="font-weight:700;">${dept.name}</div>
                <div style="font-size:11px;color:var(--text-muted);">
                  Mevcut: ${formatNumber(cur)} | Hoca kapasitesi: <strong style="color:${exceedsCapacity ? 'var(--accent-red,#e53e3e)' : 'var(--accent-green)'};">${deptMaxByFaculty > 0 ? formatNumber(deptMaxByFaculty) : '—'}</strong> | Derslik: <strong style="color:${exceedsDersklik ? 'var(--accent-red,#e53e3e)' : deptSeats > 0 ? 'var(--accent-green)' : 'var(--text-faint)'};">${deptSeats > 0 ? formatNumber(deptSeats) : 'Bina atanmamış'}</strong>
                </div>
              </div>
            </div>

            <div class="dept-cap-warning" style="display:${exceedsCapacity || exceedsDersklik ? 'block' : 'none'};background:rgba(233,69,96,0.12);border:1px solid var(--accent-red,#e53e3e);border-radius:6px;padding:6px 10px;margin-bottom:8px;font-size:11px;color:var(--accent-red,#e53e3e);">
              ${exceedsDersklik ? `⚠ Kontenjan (${thisQuotaTotal}) derslik kapasitesini (${deptSeats}) aşıyor.` : exceedsCapacity ? `⚠ Kontenjan (${thisQuotaTotal}) hoca kapasitesini (${deptMaxByFaculty}) aşıyor.` : ''}
            </div>

            ${inputCols}

            <div class="quota-summary" data-dept="${dept.id}"
                 style="display:flex;gap:12px;font-size:11px;background:var(--bg-secondary);border-radius:6px;padding:8px 10px;flex-wrap:wrap;">
              <span>Toplam: <strong class="qs-total">${thisQuotaTotal}</strong></span>
              <span>${netLabel}</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <div id="quota-total-warning" style="margin-top:8px;margin-bottom:8px;display:none;background:rgba(233,69,96,0.12);border:1px solid var(--accent-red,#e53e3e);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--accent-red,#e53e3e);">
      ⚠ Toplam yeni alım öğrenci kapasitesini aşıyor.
    </div>

    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
      <button class="btn btn-secondary" id="btn-quota-cancel">İptal</button>
      <button class="btn btn-primary" id="btn-quota-confirm">Onayla ve Dönemi Başlat</button>
    </div>
  `;

  showModal('Kontenjan Belirleme', bodyHtml, { wide: true });

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
      netEl.style.color = (isDevlet || net >= 0) ? 'var(--accent-green)' : 'var(--accent-red,#e53e3e)';
    }

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

    let grandTotal = 0;
    document.querySelectorAll('[data-dept].card').forEach(card => {
      const t = parseInt(card.querySelector('[data-field="tamBurslu"]')?.value || 0);
      const y = parseInt(card.querySelector('[data-field="yariBurslu"]')?.value || 0);
      const u = parseInt(card.querySelector('[data-field="ucretli"]')?.value || 0);
      grandTotal += t + y + u;
    });
    const warnEl = el('quota-total-warning');
    if (warnEl) warnEl.style.display = grandTotal > remainingCapacity ? 'block' : 'none';
  }

  qsa('.quota-input').forEach(input => {
    input.addEventListener('input', () => {
      const card = input.closest('[data-dept]');
      if (card) updateSummary(card.dataset.dept);
    });
  });

  on(el('btn-quota-cancel'), 'click', hideModal);
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
    showNotification('Kontenjanlar belirlendi.', 'success');
  });
}
