import { el, formatMoney, _campusSummaryCard } from './ui_base.js';
import { SPORTS } from '../game.js?v=0.4.50';

/**
 * Spor sekmesi: aktif takımlar, lig sonuçları ve yeni takım kurma seçenekleri.
 */
export function renderSportsPanel(state) {
  const panel = el('tab-sports');
  if (!panel) return;

  const sports      = state.sports || { teams: [], leagueResults: [], totalBudget: 0 };
  const teams       = sports.teams || [];
  const SPORTS_DATA = SPORTS || {};
  const hasFacility = (state.buildings || []).some(
    b => (b.type === 'spor_tesisi' || b.type === 'spor_merkezi') && b.isCompleted
  );

  const totalWins   = teams.reduce((s, t) => s + (t.wins   || 0), 0);
  const totalLosses = teams.reduce((s, t) => s + (t.losses || 0), 0);
  const champions   = teams.filter(t => t.leaguePosition === 1).length;

  const availableSports = Object.values(SPORTS_DATA).filter(
    s => !teams.some(t => t.sportId === s.id)
  );

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-title">⚽ Üniversite Sporları</div>
        <div class="panel-subtitle">${teams.length} aktif takım${hasFacility ? '' : ' · ⚠️ Spor Tesisi yok'}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:20px;">
      ${_campusSummaryCard('⚽', 'Aktif Takım', teams.length)}
      ${_campusSummaryCard('🏆', 'Şampiyonluk', champions)}
      ${_campusSummaryCard('📊', 'Sezon', totalWins + 'G-' + totalLosses + 'M')}
      ${_campusSummaryCard('💰', 'Dönem Bütçesi', formatMoney(sports.totalBudget))}
    </div>

    ${teams.length > 0 ? `
      <div class="section-title">AKTİF TAKIMLAR</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin-bottom:20px;">
        ${teams.map(t => {
          const sport      = SPORTS_DATA[t.sportId] || {};
          const semCost    = (sport.semesterBudget || 0) + (sport.coachSalary || 0);
          const upgCost    = sport.upgradeCosts?.[t.level] || 0;
          const canUpgrade = t.level < (sport.maxLevel || 5) && (state.university?.budget ?? 0) >= upgCost;
          const posLabel   = t.leaguePosition === 1 ? '🏆 Şampiyon' : t.leaguePosition ? '#' + t.leaguePosition : '—';
          return `
            <div class="building-card" style="position:relative;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div>
                  <span style="font-size:20px;">${t.icon}</span>
                  <strong style="margin-left:6px;">${t.name}</strong>
                  <span style="color:#f59e0b;margin-left:4px;">${'★'.repeat(t.level)}${'☆'.repeat((sport.maxLevel||5)-t.level)}</span>
                </div>
                <span style="font-size:12px;color:#10b981;font-weight:600;">${posLabel}</span>
              </div>
              <div style="font-size:12px;color:#94a3b8;margin-bottom:6px;">
                Sezon: ${(sport.allowsDraw !== false)
                  ? `${t.wins || 0}G - ${t.draws || 0}B - ${t.losses || 0}M`
                  : `${t.wins || 0}G - ${t.losses || 0}M`} · ${t.seasonPoints || 0} puan
              </div>
              <div style="font-size:11px;color:#64748b;margin-bottom:8px;">
                Dönem maliyeti: ${formatMoney(semCost)}
              </div>
              <div style="display:flex;gap:6px;">
                ${t.level < (sport.maxLevel || 5)
                  ? `<button class="btn-primary btn-sm" onclick="window._onUpgradeTeam(${t.id})" ${canUpgrade ? '' : 'disabled'} style="font-size:11px;">▲ Yükselt (${formatMoney(upgCost)})</button>`
                  : '<span style="font-size:10px;color:#10b981;">Maks Seviye</span>'}
                <button class="btn-danger btn-sm" onclick="window._onDissolveTeam(${t.id})" style="font-size:11px;padding:2px 8px;" title="Takımı kapat">✕</button>
              </div>
            </div>`;
        }).join('')}
      </div>
    ` : ''}

    ${(sports.leagueResults || []).length > 0 ? `
      <div class="section-title">SON SEZON SONUÇLARI</div>
      <div style="margin-bottom:20px;">
        ${sports.leagueResults.map(r => `
          <div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:10px;margin-bottom:8px;">
            <div style="font-weight:600;margin-bottom:4px;">${r.icon} ${r.name} — ${r.position === 1 ? '🏆 Şampiyon!' : '#' + r.position} (${r.record}, ${r.points} puan)</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              ${(r.matches || []).map(m => `
                <span style="font-size:11px;padding:2px 8px;border-radius:4px;background:${m.result==='win'?'rgba(16,185,129,0.15)':m.result==='draw'?'rgba(234,179,8,0.15)':'rgba(239,68,68,0.15)'};color:${m.result==='win'?'#10b981':m.result==='draw'?'#eab308':'#ef4444'};">
                  ${m.result==='win'?'✓':m.result==='draw'?'—':'✗'} ${m.opponent}
                </span>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${availableSports.length > 0 ? `
      <div class="section-title">YENİ TAKIM KUR</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;">
        ${availableSports.map(s => {
          const needsFac = s.requiresFacility && !hasFacility;
          const canAfford = (state.university?.budget ?? 0) >= s.foundingCost;
          const disabled  = needsFac || !canAfford;
          return `
            <div style="background:rgba(255,255,255,0.03);border-radius:10px;padding:12px;border:1px solid rgba(255,255,255,0.06);${disabled ? 'opacity:0.5;' : ''}">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <div><span style="font-size:18px;">${s.icon}</span> <strong>${s.name}</strong></div>
                <button class="btn-primary btn-sm" onclick="window._onFoundTeam('${s.id}')" ${disabled ? 'disabled' : ''} style="font-size:11px;">
                  Kur (${formatMoney(s.foundingCost)})
                </button>
              </div>
              <div style="font-size:11px;color:#94a3b8;">${s.description}</div>
              <div style="font-size:10px;color:#64748b;margin-top:4px;">
                Dönem: ${formatMoney(s.semesterBudget + s.coachSalary)}
                ${s.requiresFacility ? (hasFacility ? ' · ✅ Tesis var' : ' · ❌ Spor Tesisi gerekli') : ' · Tesis gerekmez'}
              </div>
            </div>`;
        }).join('')}
      </div>
    ` : ''}
  `;
}
