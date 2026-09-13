import { el, on, delegate, formatMoney, formatNumber, showNotification, _statCardHtml, _statColor, createStatBar } from './ui_base.js';

/**
 * Araştırma sekmesi: hoca başvuruları, BAP, aktif projeler, istatistikler, bütçe ayarı.
 */
export function renderResearchPanel(state, onResearchBudget, onProjectDecision) {
  const panel = el('tab-research');
  if (!panel) return;

  const research       = state.research || {};
  const activeProjects = research.activeResearchProjects || [];
  const pendingApps    = research.pendingProjectApplications || [];
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

    <div id="research-subtab-projects">
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px;">
        ${_statCardHtml('Toplam Yayın',       formatNumber(research.publications ?? 0), null, 'makale')}
        ${_statCardHtml('H-Index',            research.hIndex ?? 0, null, 'etki faktörü')}
        ${_statCardHtml('Aktif Proje',         activeProjects.length, null, 'devam ediyor')}
        ${_statCardHtml('Tamamlanan',          completedProjs.filter(p => p.status === 'completed').length, null, 'başarılı')}
        ${_statCardHtml('Üniversite Payı/Dönem', formatMoney(uniShareTotal), null, 'genel gider')}
      </div>

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
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;">
        <div>
          <div class="section-title" id="toggle-research-apps" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;background:var(--card-bg-light);padding:8px 12px;border-radius:6px;margin-bottom:8px;border:1px solid var(--border-light);">
            <span>📋 Bu Dönem Proje Başvuruları <span style="font-size:11px;font-weight:400;color:var(--text-muted);">(${!lastApps || lastApps.total === 0 ? '0' : lastApps.total})</span></span>
            <span style="font-size:12px;font-weight:600;color:var(--accent-blue,#3182ce);">${window._researchAppsCollapsed ? '▼ GÖSTER' : '▲ GİZLE'}</span>
          </div>
          
          <div id="proj-applications-container" style="${window._researchAppsCollapsed ? 'display:none;' : 'margin-bottom:24px;'}">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px;padding:0 4px;">Hocalar dış çağrılara otomatik başvurur. Sonuçlar dönem sonunda açıklanır.</div>
            ${!lastApps || lastApps.total === 0 ? `
              <div class="empty-state" style="padding:16px;">
                <div class="empty-state-icon">📭</div>
                <div class="empty-state-title">Bu dönem proje başvurusu yapılmadı</div>
              </div>
            ` : `
              <div class="card" style="padding:10px 14px;margin-bottom:10px;display:flex;gap:16px;flex-wrap:wrap;">
                <span style="font-size:12px;">Toplam: <strong>${lastApps.total}</strong></span>
                <span style="font-size:12px;color:var(--accent-green,#48bb78);">Kabul: <strong>${(lastApps.accepted || []).length}</strong></span>
                <span style="font-size:12px;color:var(--accent-red,#e53e3e);">Red: <strong>${(lastApps.rejected || []).length}</strong></span>
              </div>
              <div style="display:flex;flex-direction:column;gap:8px;">
                ${(lastApps.accepted || []).map(a => `
                  <div class="card" style="padding:12px 14px;border-left:3px solid var(--accent-green,#48bb78);">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                      <div>
                        <div style="font-size:12px;font-weight:700;color:var(--text-muted);">✅ ${a.facultyName}</div>
                        <div style="font-size:13px;font-weight:700;margin:2px 0;">"${a.projectName}"</div>
                        <div style="font-size:11px;color:var(--text-muted);">${a.callIcon || '📋'} ${a.callType} · ${formatMoney(a.requestedFunding)}</div>
                      </div>
                    </div>
                  </div>
                `).join('')}
                ${(lastApps.rejected || []).map(r => `
                  <div class="card" style="padding:12px 14px;border-left:3px solid var(--accent-red,#e53e3e);opacity:0.8;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                      <div>
                        <div style="font-size:12px;font-weight:700;color:var(--text-muted);">❌ ${r.facultyName}</div>
                        <div style="font-size:13px;font-weight:700;margin:2px 0;">"${r.projectName}"</div>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

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

          <div class="section-title" id="toggle-active-projects" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;background:var(--card-bg-light);padding:8px 12px;border-radius:6px;margin-top:20px;margin-bottom:8px;border:1px solid var(--border-light);">
            <span>📊 Aktif Projeler <span style="font-size:11px;font-weight:400;color:var(--text-muted);">(${activeProjects.length})</span></span>
            <span style="font-size:12px;font-weight:600;color:var(--accent-blue,#3182ce);">${window._activeProjectsCollapsed ? '▼ GÖSTER' : '▲ GİZLE'}</span>
          </div>
          <div id="active-projects-container" style="${window._activeProjectsCollapsed ? 'display:none;' : ''}">
            <div style="display:flex;flex-direction:column;gap:8px;">
              ${activeProjects.map(p => {
                const turnsLeft = Math.max(0, (p.duration || 2) - (p.currentTurn || 0));
                const prog = p.progress ?? Math.round(((p.currentTurn || 0) / Math.max(1, p.duration || 2)) * 100);
                const projFunding = p.requestedFunding || p.funding || 0;
                const projSemFund = projFunding / Math.max(1, p.duration || 4);
                const projRate = p.callOverheadRate ?? uniOverheadRate;
                const projUniShare = Math.round(projSemFund * projRate);
                const isIndustry = p.isPrivateSector || p.fundingType === 'industry' || /sanayi|özel sektör|ozel_sektor|sektör|teknoloji firması|savunma sanayi|ilaç firması/i.test(p.callType || p.callId || '');
                const isEu = p.isEuProject || p.type === 'eu' || /horizon|erc/i.test(p.callType || p.callId || '');
                const borderColor = isIndustry ? 'var(--accent-yellow,#f5a623)' : isEu ? 'var(--accent-blue,#3182ce)' : 'var(--accent-purple,#9b59b6)';
                const badgeClass = isIndustry ? 'badge-yellow' : isEu ? 'badge-blue' : 'badge-purple';
                return `
                <div class="research-card" style="border-left:3px solid ${borderColor};">
                  <div class="research-card-header">
                    <div class="research-card-title">${p.callIcon || '📋'} ${p.projectName || p.name || 'İsimsiz Proje'}</div>
                    <span class="badge ${badgeClass}">${p.callType || ''}</span>
                  </div>
                  <div class="research-card-meta">
                    <span>⏱ ${turnsLeft} dönem kaldı</span>
                    <span>💰 ${formatMoney(projFunding)}</span>
                    <span style="color:var(--accent-green,#48bb78);">Üni payı: ${formatMoney(projUniShare)}/dönem</span>
                  </div>
                  <div class="research-progress-row">
                    <div class="research-progress-track">
                      <div class="research-progress-fill" style="width:${Math.min(100, prog)}%"></div>
                    </div>
                    <div class="research-progress-pct">%${prog}</div>
                  </div>
                </div>`;
              }).join('') || `<div class="empty-state">Aktif proje yok</div>`}
            </div>
          </div>
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

          <div class="section-title mt-md">Bölüm Araştırma Performansı</div>
          <div class="card" style="max-height:480px;overflow-y:auto;padding:12px;">
            ${(state.departments || []).filter(d => d.isOpen).map(d => {
              const deptFaculty = (state.faculty || []).filter(f => (f.department || f.departmentId) === d.id);
              const avgRes = deptFaculty.length > 0
                ? (deptFaculty.reduce((s, f) => s + (f.stats?.research || f.researchScore || 40), 0) / deptFaculty.length)
                : 35;
              const deptPubs = deptFaculty.reduce((s, f) => s + (f.publications || 0), 0);
              const deptProjs = ((activeProjects || []).filter(p => p.departmentId === d.id || deptFaculty.some(f => f.id === p.piId))).length;
              
              // Dinamik Araştırma Skoru (0-100)
              const academicQuality = avgRes * 0.40;
              const pubScore = Math.min(30, Math.floor(deptPubs / 2.5));
              const projScore = Math.min(20, deptProjs * 4);
              const potBase = ((d.researchPotential || 3) / 5) * 10;
              const deptScore = Math.min(100, Math.max(10, Math.round(academicQuality + pubScore + projScore + potBase)));
              const potStars = '⭐'.repeat(Math.min(5, Math.max(1, d.researchPotential || 3)));

              return `
                <div style="margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.06);">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <span style="font-size:12px;font-weight:600;color:var(--text-primary,#fff);">${d.shortName || d.name}</span>
                    <span style="font-size:11px;color:var(--accent-yellow,#ecc94b);">${potStars} <span style="color:var(--text-muted);font-size:10px;">(${d.researchPotential || 3}/5)</span></span>
                  </div>
                  ${createStatBar('Araştırma Skoru', deptScore, 100, _statColor(deptScore))}
                  <div style="font-size:10px;color:var(--text-muted);margin-top:3px;display:flex;gap:8px;">
                    <span>👥 ${deptFaculty.length} hoca</span>
                    <span>📚 ${deptPubs} yayın</span>
                    <span>🔬 ${deptProjs} aktif proje</span>
                  </div>
                </div>
              `;
            }).join('') || '<div style="font-size:12px;color:var(--text-faint);">Açık bölüm yok.</div>'}
          </div>
        </div>
      </div>
    </div>

    <div id="research-subtab-tto" style="display:none;">
      ${_renderTTOPanel()}
    </div>
  `;

  // Alt sekme geçişi
  delegate(panel, '.research-subtab', 'click', (e, btn) => {
    const target = btn.dataset.subtab;
    panel.querySelectorAll('.research-subtab').forEach(b => {
      b.classList.toggle('active', b === btn);
      b.style.borderBottomColor = b === btn ? 'var(--accent-blue,#3182ce)' : 'transparent';
      b.style.color = b === btn ? 'var(--accent-blue,#3182ce)' : 'var(--text-muted)';
    });
    const projectsDiv = el('research-subtab-projects');
    const ttoDiv = el('research-subtab-tto');
    if (projectsDiv) projectsDiv.style.display = target === 'projects' ? '' : 'none';
    if (ttoDiv) ttoDiv.style.display = target === 'tto' ? '' : 'none';
  });

  on(el('toggle-research-apps'), 'click', () => {
    window._researchAppsCollapsed = !window._researchAppsCollapsed;
    renderResearchPanel(state, onResearchBudget, onProjectDecision);
  });

  on(el('toggle-active-projects'), 'click', () => {
    window._activeProjectsCollapsed = !window._activeProjectsCollapsed;
    renderResearchPanel(state, onResearchBudget, onProjectDecision);
  });

  // Bütçe önizleme
  function _updateResearchPreview(newVal) {
    const previewEl = el('research-budget-preview');
    if (!previewEl) return;
    const facultyCount  = (state.faculty || []).length;
    const currentBudget = state.university?.budget ?? 0;
    const currentPerFac = state.researchBudgetPerFaculty ?? 50000;
    const currentTotal  = currentPerFac * facultyCount;
    const newTotal      = newVal * facultyCount;
    const diff          = newTotal - currentTotal;
    const projected     = currentBudget - diff;
    
    previewEl.innerHTML = `
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:6px;">MALİYET ETKİSİ</div>
      <div style="display:flex;justify-content:space-between;font-size:11px;">
        <span>Mevcut:</span><span>${formatMoney(currentTotal)}/dönem</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-top:2px;">
        <span>Yeni:</span><span>${formatMoney(newTotal)}/dönem</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-top:4px;padding-top:4px;border-top:1px solid var(--border-light);font-weight:700;">
        <span>Fark:</span><span style="color:${diff > 0 ? 'var(--accent)' : 'var(--accent-green)'};">${diff > 0 ? '+' : ''}${formatMoney(diff)}</span>
      </div>
    `;
  }

  const budgetSlider = el('research-budget-slider');
  if (budgetSlider) {
    _updateResearchPreview(parseInt(budgetSlider.value));
    on(budgetSlider, 'input', () => {
      const v = parseInt(budgetSlider.value);
      const valEl = el('research-budget-value');
      if (valEl) valEl.textContent = formatMoney(v);
      _updateResearchPreview(v);
    });
  }

  on(el('btn-apply-research-budget'), 'click', () => {
    onResearchBudget && onResearchBudget(parseInt(el('research-budget-slider')?.value ?? 50000));
    showNotification('Araştırma bütçesi güncellendi.', 'success');
  });

  const overheadSlider = el('overhead-rate-slider');
  if (overheadSlider) {
    on(overheadSlider, 'input', () => {
      const pct = parseInt(overheadSlider.value);
      const valEl = el('overhead-rate-value');
      if (valEl) valEl.textContent = `%${pct}`;
    });
  }

  on(el('btn-apply-overhead-rate'), 'click', () => {
    const pct = parseInt(el('overhead-rate-slider')?.value ?? 15);
    onProjectDecision && onProjectDecision('set_overhead_rate', null, { rate: pct / 100 });
    showNotification('Kesinti oranı güncellendi.', 'success');
  });

  on(el('bap-total-slider'), 'input', (e) => {
    const valEl = el('bap-total-value');
    if (valEl) valEl.textContent = formatMoney(parseInt(e.target.value));
  });

  on(el('bap-max-slider'), 'input', (e) => {
    const valEl = el('bap-max-value');
    if (valEl) valEl.textContent = formatMoney(parseInt(e.target.value));
  });

  on(el('btn-open-bap'), 'click', () => {
    const totalBudget = parseInt(el('bap-total-slider')?.value || 500000);
    const maxPerProject = parseInt(el('bap-max-slider')?.value || 100000);
    onProjectDecision && onProjectDecision('open_bap_call', null, { totalBudget, maxPerProject, field: 'any' });
  });

  delegate(panel, '.proj-decision-btn', 'click', (e, btn) => {
    onProjectDecision && onProjectDecision(btn.dataset.decision, btn.dataset.appId, {});
  });
}
