import { el, showModal, hideModal } from './ui_base.js';
import { ACCREDITATION_BODIES } from '../data.js?v=0.4.48';

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
      const isAcc = acc.status === 'granted' || (acc.status === 'applied' && acc.grantedAt != null && (acc.expiresAt == null || acc.expiresAt >= turn));
      if (isAcc) {
        totalAccredited++;
        if (acc.isRenewing || acc.status === 'applied') totalPending++;
      } else if (acc.status === 'applied' || acc.status === 'under_review') {
        totalPending++;
      } else if (acc.status === 'expired') {
        totalExpired++;
      }
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

      const isAcc = acc.status === 'granted' || (acc.status === 'applied' && acc.grantedAt != null && (acc.expiresAt == null || acc.expiresAt >= turn));

      if (isAcc) {
        const remaining = acc.expiresAt != null ? (acc.expiresAt - turn) : '?';
        const expLabel  = acc.expiresAt != null ? turnToLabel(acc.expiresAt) : '—';
        const urgent    = typeof remaining === 'number' && remaining <= 2;
        const color     = urgent ? 'var(--accent-red,#e53e3e)' : 'var(--accent-green)';
        const isRenewing = acc.isRenewing || acc.status === 'applied';
        const elapsed   = turn - (acc.renewalAppliedAt || acc.appliedAt || turn);
        const pt        = acc.renewalProcessTime || acc.processTime || body.processingTime.min;

        cellContent = `
          <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
            <span style="font-size:11px;font-weight:700;color:${color};">✓ Akredite${isRenewing ? ' <span style="color:var(--accent-yellow,#f5a623);font-size:10px;">⏳ Yenileniyor</span>' : ''}</span>
            <span style="font-size:10px;color:var(--text-muted);">Bitiş: ${expLabel}</span>
            <span style="font-size:10px;color:${color};">${remaining} dönem kaldı</span>
            ${isRenewing
              ? `<span style="font-size:10px;color:var(--accent-yellow,#f5a623);background:rgba(245,166,35,0.1);padding:1px 6px;border-radius:4px;">İncelemede (${elapsed}/${pt} dön.)</span>`
              : urgent
                ? `<button class="btn btn-xs btn-warning" onclick="window._onShowAccreditationModal('${dept.id}','${bodyId}')">🔄 Yenile</button>`
                : ''}
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
        cellContent = `
          <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
            <span style="font-size:10px;color:var(--text-faint);">Yok</span>
            <button class="btn btn-xs btn-secondary" onclick="window._onShowAccreditationModal('${dept.id}','${bodyId}')">+ Başvur (${(body.cost/1000).toFixed(0)}K ₺)</button>
          </div>`;
      }

      return `<td style="padding:10px 12px;text-align:center;">${cellContent}</td>`;
    }).join('');

    // Akredite sayısı
    const accCount = Object.values(dept.accreditation).filter(a =>
      a.status === 'granted' || a.isRenewing || (a.status === 'applied' && a.grantedAt != null && (a.expiresAt == null || a.expiresAt >= turn))
    ).length;
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

/**
 * Akreditasyon başvuru modalını gösterir.
 */
export function showAccreditationModal(state, deptId, bodyId, reqResult, onApply) {
  const dept = (state.departments || []).find(d => d.id === deptId);
  const body = ACCREDITATION_BODIES[bodyId];
  if (!dept || !body) return;

  const acc = dept.accreditation?.[bodyId];
  const isRenewal = acc?.status === 'expired' || acc?.status === 'granted';
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
