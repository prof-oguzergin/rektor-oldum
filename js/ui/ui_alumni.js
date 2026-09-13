import { el, formatMoney, formatNumber, _statCardHtml, _inlineBar } from './ui_base.js';

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
