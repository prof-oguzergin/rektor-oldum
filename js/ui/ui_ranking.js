import { el, showModal, qsa } from './ui_base.js';
import { getPillarBreakdown } from '../intl_ranking.js?v=0.4.72';

/**
 * Liderlik tablosu (Online ve Yerel Skorlar).
 * @param {Function} getTopScoresFn  leaderboard.js'ten gelen getTopScores fonksiyonu
 */
export async function renderLeaderboardPanel(getTopScoresFn) {
  const container = document.getElementById('leaderboard-list');
  if (!container) return;

  // Yenile butonu
  const refreshHtml = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:14px;">
      <button id="lb-refresh-btn" class="btn btn-ghost btn-sm" style="font-size:12px;">
        🔄 Yenile
      </button>
    </div>`;

  container.innerHTML = refreshHtml + '<div id="lb-content"><p style="color:var(--text-muted,#aaa);font-size:14px;">Yükleniyor…</p></div>';

  document.getElementById('lb-refresh-btn')?.addEventListener('click', () => {
    renderLeaderboardPanel(getTopScoresFn);
  });

  const contentEl = document.getElementById('lb-content');

  try {
    const rows = await getTopScoresFn(50);

    if (!rows || rows.length === 0) {
      contentEl.innerHTML = '<p style="color:var(--text-muted,#aaa);font-size:14px;">Henüz skor yok, ilk olabilirsin!</p>';
      return;
    }

    const medals = ['🥇', '🥈', '🥉'];

    // v0.4.42: rank artık Dünya Sırası (THE 2024). Bu tarihten önceki kayıtlar
    // eski TR sırasını (1-50) tutuyor; UI'da "Eski TR" rozetiyle ayırt ediliyor.
    const _LB_INTL_CUTOFF_MS = new Date('2026-05-07T17:00:00Z').getTime();
    const tableRows = rows.map((r, idx) => {
      const pos    = idx + 1;
      const medal  = pos <= 3 ? medals[pos - 1] : `${pos}.`;
      const rowCls = pos === 1 ? 'lb-gold' : pos === 2 ? 'lb-silver' : pos === 3 ? 'lb-bronze' : '';
      const tsMs   = r.createdAt?.toDate ? r.createdAt.toDate().getTime()
                  : (r.createdAt?.seconds ? r.createdAt.seconds * 1000 : 0);
      const date   = tsMs ? new Date(tsMs).toLocaleDateString('tr-TR') : '—';
      // Eski TR rozeti: rank 1-50 aralığındaysa (eski sistem max 50) VE tarih kesim öncesindeyse.
      const isOld  = r.rank != null && r.rank <= 50 && tsMs > 0 && tsMs < _LB_INTL_CUTOFF_MS;
      const rankCell = r.rank == null
        ? '—'
        : isOld
          ? `<span style="font-size:10px;color:#888;background:rgba(255,255,255,0.05);border-radius:3px;padding:1px 5px;margin-right:4px;">Eski TR</span><span style="color:#aaa;">#${r.rank}</span>`
          : `#${r.rank}`;
      return `
        <tr class="${rowCls}">
          <td style="text-align:center;font-size:15px;padding:8px 6px;">${medal}</td>
          <td style="font-weight:${pos <= 3 ? '700' : '400'};padding:8px 6px;">${_escHtml(r.name ?? 'Anonim')}</td>
          <td style="text-align:right;font-weight:700;color:var(--accent,#5dd6c0);padding:8px 6px;">${(r.score ?? 0).toLocaleString('tr-TR')}</td>
          <td style="text-align:center;padding:8px 6px;">${r.year ?? '—'}. Yıl</td>
          <td style="text-align:center;padding:8px 6px;">${rankCell}</td>
          <td style="text-align:center;padding:8px 6px;">${r.prestige ?? '—'}</td>
          <td style="text-align:center;font-size:11px;color:var(--text-muted,#aaa);padding:8px 6px;">${date}</td>
        </tr>`;
    }).join('');

    contentEl.innerHTML = `
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.1);color:var(--text-muted,#aaa);font-size:11px;text-transform:uppercase;">
              <th style="padding:8px 6px;text-align:center;">#</th>
              <th style="padding:8px 6px;text-align:left;">Rektör</th>
              <th style="padding:8px 6px;text-align:right;">Skor</th>
              <th style="padding:8px 6px;text-align:center;">Yıl</th>
              <th style="padding:8px 6px;text-align:center;">Dünya Sırası</th>
              <th style="padding:8px 6px;text-align:center;">Saygınlık</th>
              <th style="padding:8px 6px;text-align:center;">Tarih</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
      <style>
        .lb-gold   { background: rgba(255,215,0,0.07); }
        .lb-silver { background: rgba(192,192,192,0.06); }
        .lb-bronze { background: rgba(205,127,50,0.06); }
        tbody tr td { border-bottom: 1px solid rgba(255,255,255,0.04); }
      </style>`;
  } catch (err) {
    // Çevrimiçi liderlik tablosu hatasında lokal yedek skorları göster
    let localScores = [];
    try {
      localScores = JSON.parse(localStorage.getItem('rektor_oldum_local_scores') || '[]');
    } catch (e) { /* localStorage okunamadı */ }

    const banner = `
      <div style="background:rgba(245,166,35,0.1);border:1px solid rgba(245,166,35,0.3);
                  padding:12px;border-radius:8px;margin-bottom:14px;font-size:13px;">
        🛠️ Çevrimiçi liderlik tablosu geçici olarak kullanılamıyor.
        ${localScores.length ? `Aşağıda bu cihazda kayıtlı skorların gösteriliyor.` : ''}
      </div>`;

    if (!localScores.length) {
      contentEl.innerHTML = banner +
        '<p style="color:var(--text-muted,#aaa);font-size:13px;">Henüz lokal skor da yok.</p>';
      return;
    }

    const localRows = localScores.slice(0, 50).map((r, idx) => {
      const pos = idx + 1;
      const medal = pos <= 3 ? ['🥇','🥈','🥉'][pos-1] : `${pos}.`;
      const date = r.savedAt ? new Date(r.savedAt).toLocaleDateString('tr-TR') : '—';
      return `
        <tr>
          <td style="text-align:center;padding:8px 6px;">${medal}</td>
          <td style="padding:8px 6px;">${_escHtml(r.name ?? 'Anonim')}</td>
          <td style="text-align:right;font-weight:700;color:var(--accent,#5dd6c0);padding:8px 6px;">${(r.score ?? 0).toLocaleString('tr-TR')}</td>
          <td style="text-align:center;padding:8px 6px;">${r.year ?? '—'}. Yıl</td>
          <td style="text-align:center;padding:8px 6px;">${r.prestige ?? '—'}</td>
          <td style="text-align:center;font-size:11px;color:var(--text-muted,#aaa);padding:8px 6px;">${date}</td>
        </tr>`;
    }).join('');

    contentEl.innerHTML = banner + `
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.1);color:var(--text-muted,#aaa);font-size:11px;text-transform:uppercase;">
              <th style="padding:8px 6px;text-align:center;">#</th>
              <th style="padding:8px 6px;text-align:left;">Rektör</th>
              <th style="padding:8px 6px;text-align:right;">Skor</th>
              <th style="padding:8px 6px;text-align:center;">Yıl</th>
              <th style="padding:8px 6px;text-align:center;">Saygınlık</th>
              <th style="padding:8px 6px;text-align:center;">Tarih</th>
            </tr>
          </thead>
          <tbody>${localRows}</tbody>
        </table>
      </div>`;
  }
}

/**
 * Uluslararası sıralama panelini render eder.
 */
export function renderInternationalRankingPanel(
  state, theList,
  calcPillars, calcTotal, findRank, getNeighborsF, filterCountry,
) {
  const panel = el('tab-intl-ranking');
  if (!panel) return;

  const pillars    = calcPillars(state);
  const totalRaw   = calcTotal(pillars, theList.pillarsWeights);
  const totalNum   = typeof totalRaw === 'number' ? totalRaw : parseFloat(totalRaw) || 0;
  const totalScore = Math.round(totalNum * 10) / 10;
  const worldRank  = findRank(totalScore, theList);

  // Anlık state ve üst bar senkronizasyonu
  if (state.university && worldRank) {
    state.university.intlRanking = worldRank;
    state.university.intlTotalScore = totalScore;
  }
  const topRankEl = document.querySelector('#stat-ranking .top-stat-value');
  if (topRankEl && worldRank) {
    topRankEl.textContent = `🌍 #${worldRank}`;
  }

  // Player university object
  const playerUni = {
    isPlayer: true,
    name: state.university?.name || 'Üniversiteniz',
    nameTr: state.university?.name || 'Üniversiteniz',
    country: 'TR',
    countryTr: 'Türkiye',
    total: totalScore,
    rank: worldRank,
    displayRank: worldRank,
    rankLabel: `#${worldRank}`,
    teaching: pillars.teaching,
    researchEnvironment: pillars.researchEnvironment,
    citations: pillars.citations,
    international: pillars.international,
    industry: pillars.industry,
  };

  // Build merged, strictly-sorted university list with dynamic rank shifting for rivals below player
  const baseUnis = [...theList.universities].sort((a, b) => b.total - a.total);
  let insertIdx = baseUnis.findIndex(u => u.total <= totalScore);
  if (insertIdx < 0) insertIdx = baseUnis.length;

  const merged = [];
  for (let i = 0; i < baseUnis.length; i++) {
    if (i === insertIdx) {
      merged.push(playerUni);
    }
    const u = { ...baseUnis[i] };
    if (u.rank != null) {
      if (u.total < totalScore || (u.total === totalScore && i >= insertIdx)) {
        u.displayRank = u.rank + 1;
      } else {
        u.displayRank = u.rank;
      }
      u.rankLabel = `#${u.displayRank}`;
    } else {
      u.displayRank = u.rankBand;
      u.rankLabel = u.rankBand || '—';
    }
    merged.push(u);
  }
  if (insertIdx === baseUnis.length) {
    merged.push(playerUni);
  }

  // Turkish universities list from merged
  const trRanked = merged.filter(u => u.country === 'TR');
  const playerTrIdx = trRanked.findIndex(u => u.isPlayer);
  const playerTrRank = playerTrIdx >= 0 ? playerTrIdx + 1 : 1;
  const trTotal = trRanked.length;

  // Neighbors from merged
  const playerMergedIdx = merged.findIndex(u => u.isPlayer);
  const neighbors = merged.slice(Math.max(0, playerMergedIdx - 5), Math.min(merged.length, playerMergedIdx + 6));

  // Determine global tier badge
  let tierName = '🌐 Dünya Sıralaması';
  let tierSub = '108 ülke içinde aktif değerlendirme';
  let tierBadgeBg = 'rgba(79,163,224,0.15)';
  let tierBadgeColor = 'var(--accent-blue,#4fa3e0)';
  if (worldRank === 1) {
    tierName = '👑 Dünya 1.si (Zirve)';
    tierSub = 'Dünyanın en iyi üniversitesi konumundasınız!';
    tierBadgeBg = 'rgba(245,200,66,0.2)';
    tierBadgeColor = '#f5c842';
  } else if (worldRank <= 10) {
    tierName = '🏆 Küresel Zirve (Top 10)';
    tierSub = 'Dünyanın en prestijli 10 üniversitesinden biri';
    tierBadgeBg = 'rgba(245,200,66,0.18)';
    tierBadgeColor = '#f5c842';
  } else if (worldRank <= 50) {
    tierName = '🥇 Dünya Eliti (Top 50)';
    tierSub = 'Küresel ilk 50 üniversite ligindesiniz';
    tierBadgeBg = 'rgba(78,204,163,0.18)';
    tierBadgeColor = 'var(--accent-green,#4ecca3)';
  } else if (worldRank <= 100) {
    tierName = '🥈 Küresel İlk 100';
    tierSub = 'Dünya çapında saygın araştırma kurumu';
    tierBadgeBg = 'rgba(79,163,224,0.18)';
    tierBadgeColor = 'var(--accent-blue,#4fa3e0)';
  } else if (worldRank <= 200) {
    tierName = '🥉 İlk 200';
    tierSub = 'Uluslararası alanda güçlü akademik saygınlık';
    tierBadgeBg = 'rgba(155,89,182,0.18)';
    tierBadgeColor = 'var(--accent-purple,#9b59b6)';
  } else if (worldRank <= 500) {
    tierName = '⭐ İlk 500';
    tierSub = 'Küresel ölçekte rekabetçi kurum';
    tierBadgeBg = 'rgba(240,165,0,0.18)';
    tierBadgeColor = 'var(--accent-yellow,#f0a500)';
  }

  // Pillar definitions
  const pillarDefs = [
    { key: 'teaching',            label: 'Eğitim',         pct: 29.5, color: '#4f9cf7', icon: '🎓', hint: 'Öğretim kalitesi, hoca/öğrenci oranı & mezuniyet' },
    { key: 'researchEnvironment', label: 'Araştırma Ort.', pct: 29.0, color: '#9b6ff5', icon: '🔬', hint: 'H-indeks, yayın sayısı, aktif projeler & araştırma bütçesi' },
    { key: 'citations',           label: 'Atıflar',        pct: 30.0, color: '#5dd6c0', icon: '📑', hint: 'Yayın başına düşen atıf etki değeri & saygınlık' },
    { key: 'international',       label: 'Uluslararası',   pct:  7.5, color: '#f5a623', icon: '🌐', hint: 'Uluslararası öğrenci/hoca oranı & AB projeleri' },
    { key: 'industry',            label: 'Endüstri',       pct:  4.0, color: '#e0644e', icon: '🏭', hint: 'TTO gelirleri, patentler & özel sektör projeleri' },
  ];

  const progressBar = (val, color) => `
    <div style="background:rgba(255,255,255,0.08);border-radius:6px;height:9px;overflow:hidden;margin-top:5px;">
      <div style="width:${Math.min(100, Math.max(0, val))}%;height:100%;background:${color};border-radius:6px;transition:width .4s ease;"></div>
    </div>`;

  const countryOptions = [
    { code: 'ALL', label: 'Tüm Ülkeler (Dünya Geneli)' },
    { code: 'TR',  label: 'Türkiye 🇹🇷' },
    { code: 'US',  label: 'ABD 🇺🇸' },
    { code: 'GB',  label: 'Birleşik Krallık 🇬🇧' },
    { code: 'DE',  label: 'Almanya 🇩🇪' },
    { code: 'CH',  label: 'İsviçre 🇨🇭' },
    { code: 'CN',  label: 'Çin 🇨🇳' },
    { code: 'JP',  label: 'Japonya 🇯🇵' },
    { code: 'SG',  label: 'Singapur 🇸🇬' },
    { code: 'AU',  label: 'Avustralya 🇦🇺' },
    { code: 'CA',  label: 'Kanada 🇨🇦' },
    { code: 'SE',  label: 'İsveç 🇸🇪' },
  ].map(o => `<option value="${o.code}">${o.label}</option>`).join('');

  panel.innerHTML = `
    <!-- 1. HEADER -->
    <div class="panel-header" style="margin-bottom:16px;">
      <div>
        <div class="panel-title" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <span>🌍 Uluslararası Sıralama (THE 2024)</span>
          <span style="font-size:11px;padding:3px 10px;border-radius:12px;background:${tierBadgeBg};color:${tierBadgeColor};font-weight:700;border:1px solid currentColor;">
            ${tierName}
          </span>
        </div>
        <div class="panel-subtitle" style="margin-top:4px;">
          Times Higher Education Dünya Üniversite Sıralaması (WUR) Metodolojisi ve Küresel Konumunuz
        </div>
      </div>
      <div style="font-size:12px;color:var(--text-muted,#aaa);text-align:right;">
        ${theList.edition} · ${theList.totalRanked.toLocaleString('tr-TR')} Üniversite
      </div>
    </div>

    <!-- 2. KPI SUMMARY CARDS -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px;margin-bottom:20px;">
      <!-- Total Score -->
      <div class="card" style="padding:14px 16px;background:linear-gradient(135deg, rgba(78,204,163,0.14) 0%, rgba(22,33,62,0.7) 100%);border:1px solid rgba(78,204,163,0.3);border-radius:10px;">
        <div style="font-size:11px;font-weight:700;color:var(--accent-green,#4ecca3);text-transform:uppercase;letter-spacing:0.5px;">THE Toplam Skor</div>
        <div style="font-size:34px;font-weight:900;color:#fff;line-height:1.1;margin:6px 0;">${totalScore.toFixed(1)} <span style="font-size:14px;color:var(--text-muted,#aaa);font-weight:400;">/ 100</span></div>
        <div style="font-size:11px;color:var(--text-muted,#aaa);">Ağırlıklı 5 Pillar Toplamı</div>
      </div>

      <!-- World Rank -->
      <div class="card" style="padding:14px 16px;background:linear-gradient(135deg, rgba(79,163,224,0.14) 0%, rgba(22,33,62,0.7) 100%);border:1px solid rgba(79,163,224,0.3);border-radius:10px;">
        <div style="font-size:11px;font-weight:700;color:var(--accent-blue,#4fa3e0);text-transform:uppercase;letter-spacing:0.5px;">Dünya Sıralaması</div>
        <div style="font-size:34px;font-weight:900;color:var(--accent-blue,#4fa3e0);line-height:1.1;margin:6px 0;">#${worldRank}</div>
        <div style="font-size:11px;color:var(--text-muted,#aaa);">${theList.totalRanked.toLocaleString('tr-TR')} üniversite arasında</div>
      </div>

      <!-- Turkey Rank -->
      <div class="card" style="padding:14px 16px;background:linear-gradient(135deg, rgba(233,69,96,0.14) 0%, rgba(22,33,62,0.7) 100%);border:1px solid rgba(233,69,96,0.3);border-radius:10px;">
        <div style="font-size:11px;font-weight:700;color:#ff6b81;text-transform:uppercase;letter-spacing:0.5px;">Türkiye Sıralaması</div>
        <div style="font-size:34px;font-weight:900;color:#ff6b81;line-height:1.1;margin:6px 0;">#${playerTrRank} <span style="font-size:15px;color:var(--text-muted,#aaa);font-weight:600;">/ ${trTotal}</span></div>
        <div style="font-size:11px;color:var(--text-muted,#aaa);">${playerTrRank === 1 ? '🥇 Türkiye Lideri' : 'Ulusal Üniversiteler Arasında'}</div>
      </div>

      <!-- Global Status -->
      <div class="card" style="padding:14px 16px;background:linear-gradient(135deg, rgba(155,89,182,0.14) 0%, rgba(22,33,62,0.7) 100%);border:1px solid rgba(155,89,182,0.3);border-radius:10px;">
        <div style="font-size:11px;font-weight:700;color:var(--accent-purple,#9b59b6);text-transform:uppercase;letter-spacing:0.5px;">Küresel Kategori</div>
        <div style="font-size:18px;font-weight:800;color:#fff;line-height:1.2;margin:10px 0 6px;">${tierName}</div>
        <div style="font-size:11px;color:var(--text-muted,#aaa);">${tierSub}</div>
      </div>
    </div>

    <!-- 3. PILLAR PUANLARI (5 PILLARS) -->
    <div class="card" style="padding:16px 20px;border-radius:10px;margin-bottom:22px;background:var(--bg-secondary,#16213e);border:1px solid var(--border,#1e3a5f);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
        <div>
          <span style="font-size:14px;font-weight:700;color:var(--text,#eee);">📊 THE WUR 5 Pillar Performansınız</span>
          <div style="font-size:11px;color:var(--text-muted,#aaa);margin-top:2px;">Eğitim %29.5 · Araştırma Ort. %29 · Atıflar %30 · Uluslararası %7.5 · Endüstri %4</div>
        </div>
        <div style="font-size:11px;color:var(--accent-blue,#4fa3e0);background:rgba(79,163,224,0.12);border:1px solid rgba(79,163,224,0.28);border-radius:6px;padding:3px 10px;font-weight:600;display:flex;align-items:center;gap:4px;">
          <span>💡</span> Detaylar ve kayıp puan analizi için sütunlara tıklayın
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:14px;">
        ${pillarDefs.map(p => {
          const pScore = Number(pillars[p.key]) || 0;
          const lost = Math.max(0, 100 - pScore);
          return `
            <div class="pillar-card" data-pillar="${p.key}" role="button" tabindex="0"
                 title="${p.label} detaylarını ve kayıp puan analizini görmek için tıklayın"
                 style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:12px 14px;cursor:pointer;transition:all .18s ease;position:relative;"
                 onmouseover="this.style.transform='translateY(-2px)';this.style.borderColor='${p.color}';this.style.boxShadow='0 4px 14px rgba(0,0,0,0.35)';"
                 onmouseout="this.style.transform='none';this.style.borderColor='rgba(255,255,255,0.08)';this.style.boxShadow='none';">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
                <span style="font-size:13px;font-weight:700;color:${p.color};">${p.icon} ${p.label}</span>
                <span style="font-size:13px;font-weight:800;color:#fff;">${pScore} <span style="font-size:10px;color:var(--text-muted,#aaa);font-weight:400;">/ 100</span></span>
              </div>
              ${progressBar(pScore, p.color)}
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;font-size:10px;color:var(--text-muted,#aaa);">
                <span>${p.hint}</span>
                <span style="font-weight:600;color:${p.color};">Ağırlık %${p.pct}</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.05);font-size:10px;">
                <span style="color:${lost > 0 ? '#f59e0b' : '#10b981'};font-weight:700;">
                  ${lost > 0 ? `⚠️ -${lost} Puan Kayıp` : '✓ 100 Tam Puan'}
                </span>
                <span style="color:var(--accent-blue,#4fa3e0);font-weight:600;display:flex;align-items:center;gap:3px;">
                  🔍 Detaylar &raquo;
                </span>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>

    <!-- 4. TAB NAVIGATION & FILTERS -->
    <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.08);">
      <div id="intl-view-tabs" style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn btn-sm intl-tab-btn active" data-view="world" style="font-size:12px;padding:6px 14px;border-radius:6px;font-weight:600;cursor:pointer;background:var(--accent-blue,#4fa3e0);color:#fff;border:none;">
          🌍 Dünya Sıralaması (Top 50)
        </button>
        <button class="btn btn-sm intl-tab-btn" data-view="neighbors" style="font-size:12px;padding:6px 14px;border-radius:6px;font-weight:600;cursor:pointer;background:transparent;color:var(--text-muted,#aaa);border:1px solid rgba(255,255,255,0.1);">
          🎯 Komşularınız (±5)
        </button>
        <button class="btn btn-sm intl-tab-btn" data-view="turkey" style="font-size:12px;padding:6px 14px;border-radius:6px;font-weight:600;cursor:pointer;background:transparent;color:var(--text-muted,#aaa);border:1px solid rgba(255,255,255,0.1);">
          🇹🇷 Türkiye Sıralaması (${trTotal})
        </button>
      </div>

      <div style="display:flex;align-items:center;gap:8px;">
        <label style="font-size:12px;color:var(--text-muted,#aaa);white-space:nowrap;">Ülke Filtresi:</label>
        <select id="intl-country-filter" style="background:var(--bg-input,#0d2240);border:1px solid var(--border-light,#2a4a70);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--text,#eee);cursor:pointer;">
          ${countryOptions}
        </select>
      </div>
    </div>

    <!-- 5. UNIFIED TABLE CONTAINER -->
    <div id="intl-table-mount"></div>

    <div style="font-size:10px;color:var(--text-muted,#aaa);text-align:right;margin-top:14px;">
      Kaynak: Times Higher Education (THE) World University Rankings 2024. Sıralamada oyuncunun konumu dinamik olarak hesaplanmakta ve puan sırasına göre entegre edilmektedir.
    </div>
  `;

  // Active view state
  let currentView = 'world';

  function renderTable(view, countryCode = 'ALL') {
    const container = document.getElementById('intl-table-mount');
    if (!container) return;

    let items = [];
    let title = '';
    let subtitle = '';
    let isTrView = false;
    let isNeighborView = false;

    if (view === 'world') {
      title = 'Dünya Geneli Sıralaması (İlk 50 Üniversite)';
      subtitle = 'THE WUR 2024 küresel liderlik tablosu';
      items = merged.slice(0, 50);
    } else if (view === 'neighbors') {
      title = 'Sıralamada Doğrudan Komşularınız (±5 Üniversite)';
      subtitle = 'Toplam THE skorunuza göre en yakın üst ve alt rakipleriniz';
      items = neighbors;
      isNeighborView = true;
    } else if (view === 'turkey' || countryCode === 'TR') {
      title = 'Türkiye Üniversiteleri Sıralaması (THE 2024)';
      subtitle = `Türkiye'den listeye giren ${trTotal} üniversite ve kurumsal yeriniz`;
      items = trRanked;
      isTrView = true;
    } else if (view === 'country') {
      const filtered = merged.filter(u => u.country === countryCode);
      const cName = filtered[0]?.countryTr || countryCode;
      title = `${cName} Üniversiteleri (${filtered.length})`;
      subtitle = `THE 2024 listesinde ${cName} kurumları`;
      items = filtered;
    }

    if (items.length === 0) {
      container.innerHTML = `
        <div class="card" style="padding:24px;text-align:center;color:var(--text-muted,#aaa);font-size:13px;">
          Bu filtreye uygun üniversite bulunamadı.
        </div>`;
      return;
    }

    // Is player in the rendered items?
    const containsPlayer = items.some(u => u.isPlayer);
    let playerNoticeHtml = '';
    if (view === 'world' && !containsPlayer) {
      playerNoticeHtml = `
        <div style="background:rgba(79,163,224,0.1);border:1px solid rgba(79,163,224,0.3);border-radius:8px;padding:10px 14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div style="font-size:12px;color:#fff;">
            📌 Üniversiteniz şu an dünya <strong>#${worldRank}</strong> sırasında (İlk 50 dışında).
          </div>
          <button id="btn-jump-neighbors" class="btn btn-sm" style="font-size:11px;padding:4px 10px;background:var(--accent-blue,#4fa3e0);color:#fff;border:none;border-radius:4px;cursor:pointer;">
            🎯 Sıralama Komşularıma Git
          </button>
        </div>`;
    }

    const rowsHtml = items.map((u, idx) => {
      if (u.isPlayer) {
        return `
          <tr style="background:linear-gradient(90deg, rgba(78,204,163,0.22) 0%, rgba(22,33,62,0.85) 100%);
                     border-top:1px solid rgba(78,204,163,0.5);border-bottom:1px solid rgba(78,204,163,0.5);
                     box-shadow:inset 0 0 12px rgba(78,204,163,0.15);">
            <td style="padding:10px 12px;text-align:center;font-weight:900;color:var(--accent-green,#4ecca3);font-size:14px;white-space:nowrap;">
              ${isTrView ? `#${idx + 1}` : u.rankLabel}
            </td>
            <td style="padding:10px 12px;">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span style="font-weight:800;color:#fff;font-size:13px;">⭐ ${_escHtml(u.nameTr || u.name)}</span>
                <span style="background:var(--accent-green,#4ecca3);color:#0b1320;font-weight:800;font-size:10px;padding:2px 7px;border-radius:10px;letter-spacing:0.5px;box-shadow:0 0 8px rgba(78,204,163,0.4);">SEN</span>
              </div>
            </td>
            <td style="padding:10px 12px;font-size:12px;color:var(--text-muted,#aaa);white-space:nowrap;">
              ${isTrView ? `<span style="color:var(--accent-blue,#4fa3e0);font-weight:600;">Dünya: #${worldRank}</span>` : 'Türkiye 🇹🇷'}
            </td>
            <td style="padding:10px 12px;text-align:right;font-weight:900;color:var(--accent-green,#4ecca3);font-size:15px;white-space:nowrap;">
              ${u.total.toFixed(1)}
            </td>
            ${isNeighborView ? `
            <td style="padding:10px 12px;text-align:center;font-size:11px;color:var(--accent-green,#4ecca3);font-weight:700;">
              Siz
            </td>` : ''}
          </tr>`;
      }

      // Competitor row
      let rankDisplay = isTrView ? `#${idx + 1}` : u.rankLabel;
      let rankColor = 'var(--text-muted,#aaa)';
      let medal = '';

      if (!isTrView && typeof u.displayRank === 'number') {
        if (u.displayRank === 1) { rankColor = '#f5c842'; medal = '🥇 '; }
        else if (u.displayRank === 2) { rankColor = '#e0e0e0'; medal = '🥈 '; }
        else if (u.displayRank === 3) { rankColor = '#cd7f32'; medal = '🥉 '; }
      } else if (isTrView) {
        if (idx === 0) { rankColor = '#f5c842'; medal = '🥇 '; }
        else if (idx === 1) { rankColor = '#e0e0e0'; medal = '🥈 '; }
        else if (idx === 2) { rankColor = '#cd7f32'; medal = '🥉 '; }
      }

      // Neighbor diff indicator
      let diffHtml = '';
      if (isNeighborView) {
        const diff = u.total - totalScore;
        if (diff > 0) {
          diffHtml = `<span style="color:#f0a500;font-weight:600;">+${diff.toFixed(1)}</span>`;
        } else if (diff < 0) {
          diffHtml = `<span style="color:var(--text-muted,#aaa);">${diff.toFixed(1)}</span>`;
        } else {
          diffHtml = `<span style="color:#fff;">0.0</span>`;
        }
      }

      return `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.04);transition:background 0.15s;">
          <td style="padding:8px 12px;text-align:center;font-weight:700;color:${rankColor};font-size:12px;white-space:nowrap;">
            ${medal}${rankDisplay}
          </td>
          <td style="padding:8px 12px;font-size:13px;color:var(--text,#eee);">
            ${_escHtml(u.nameTr || u.name)}
          </td>
          <td style="padding:8px 12px;font-size:12px;color:var(--text-muted,#aaa);white-space:nowrap;">
            ${isTrView ? `Dünya: ${u.rankLabel}` : (u.countryTr || u.country)}
          </td>
          <td style="padding:8px 12px;text-align:right;font-weight:700;color:var(--accent-blue,#4fa3e0);font-size:13px;white-space:nowrap;">
            ${u.total.toFixed(1)}
          </td>
          ${isNeighborView ? `
          <td style="padding:8px 12px;text-align:center;font-size:11px;">
            ${diffHtml}
          </td>` : ''}
        </tr>`;
    }).join('');

    container.innerHTML = `
      ${playerNoticeHtml}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="font-size:13px;font-weight:700;color:var(--text,#eee);">${title}</div>
        <div style="font-size:11px;color:var(--text-muted,#aaa);">${subtitle}</div>
      </div>
      <div class="card" style="padding:0;overflow:hidden;overflow-x:auto;border-radius:8px;border:1px solid var(--border,#1e3a5f);">
        <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:480px;">
          <thead>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.02);color:var(--text-muted,#aaa);font-size:11px;text-transform:uppercase;">
              <th style="padding:9px 12px;text-align:center;width:70px;">Sıra</th>
              <th style="padding:9px 12px;text-align:left;">Üniversite</th>
              <th style="padding:9px 12px;text-align:left;width:150px;">${isTrView ? 'Küresel Sıra' : 'Ülke'}</th>
              <th style="padding:9px 12px;text-align:right;width:80px;">Skor</th>
              ${isNeighborView ? '<th style="padding:9px 12px;text-align:center;width:90px;">Puan Farkı</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>`;

    document.getElementById('btn-jump-neighbors')?.addEventListener('click', () => {
      switchView('neighbors');
    });
  }

  function switchView(viewKey, countryCode = null) {
    currentView = viewKey;
    const buttons = panel.querySelectorAll('.intl-tab-btn');
    buttons.forEach(btn => {
      if (btn.getAttribute('data-view') === viewKey) {
        btn.classList.add('active');
        btn.style.background = 'var(--accent-blue,#4fa3e0)';
        btn.style.color = '#fff';
        btn.style.border = 'none';
      } else {
        btn.classList.remove('active');
        btn.style.background = 'transparent';
        btn.style.color = 'var(--text-muted,#aaa)';
        btn.style.border = '1px solid rgba(255,255,255,0.1)';
      }
    });

    const filterSel = document.getElementById('intl-country-filter');
    if (filterSel) {
      if (viewKey === 'turkey') {
        filterSel.value = 'TR';
      } else if (viewKey === 'world' || viewKey === 'neighbors') {
        filterSel.value = 'ALL';
      } else if (countryCode) {
        filterSel.value = countryCode;
      }
    }

    renderTable(viewKey, countryCode || (filterSel ? filterSel.value : 'ALL'));
  }

  // Bind tab buttons
  const tabBtns = panel.querySelectorAll('.intl-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.getAttribute('data-view');
      switchView(v);
    });
  });

  // Bind pillar cards to open detailed modal
  const pillarCards = panel.querySelectorAll('.pillar-card');
  pillarCards.forEach(card => {
    card.addEventListener('click', () => {
      const pKey = card.dataset.pillar;
      showPillarDetailModal(pKey, state);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showPillarDetailModal(card.dataset.pillar, state);
      }
    });
  });

  // Bind country filter
  const filterSel = document.getElementById('intl-country-filter');
  if (filterSel) {
    filterSel.addEventListener('change', () => {
      const val = filterSel.value;
      if (val === 'ALL') {
        switchView('world');
      } else if (val === 'TR') {
        switchView('turkey');
      } else {
        switchView('country', val);
      }
    });
  }

  // Initial render with 'world' view
  switchView('world');
}

/**
 * THE WUR 5 Pillar detay modalı.
 * Tıklanan sütunun alt metriklerini, kayıp puan analizini ve rektör eylem planını görüntüler.
 */
export function showPillarDetailModal(pillarKey, state) {
  const data = getPillarBreakdown(pillarKey, state);
  if (!data) return;

  const pillarButtons = [
    { key: 'teaching', icon: '🎓', label: 'Eğitim', color: '#4f9cf7' },
    { key: 'researchEnvironment', icon: '🔬', label: 'Araştırma Ort.', color: '#9b6ff5' },
    { key: 'citations', icon: '📑', label: 'Atıflar', color: '#5dd6c0' },
    { key: 'international', icon: '🌐', label: 'Uluslararası', color: '#f5a623' },
    { key: 'industry', icon: '🏭', label: 'Endüstri', color: '#e0644e' },
  ];

  const switcherHtml = `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08);">
      ${pillarButtons.map(b => {
        const isActive = b.key === pillarKey;
        return `
          <button class="btn btn-sm pillar-switcher-btn" data-target="${b.key}"
            style="font-size:12px;padding:6px 12px;border-radius:6px;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:5px;
                   background:${isActive ? b.color : 'rgba(255,255,255,0.05)'};
                   color:${isActive ? '#fff' : 'var(--text-muted,#aaa)'};
                   border:${isActive ? `1px solid ${b.color}` : '1px solid rgba(255,255,255,0.1)'};">
            <span>${b.icon}</span>
            <span>${b.label}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;

  const lossBadge = data.lostScore > 0
    ? `<span style="background:rgba(239,68,68,0.18);color:#ef4444;border:1px solid #ef4444;padding:4px 10px;border-radius:12px;font-weight:700;font-size:12px;">⚠️ -${data.lostScore} Puan Kayıp</span>`
    : `<span style="background:rgba(16,185,129,0.18);color:#10b981;border:1px solid #10b981;padding:4px 10px;border-radius:12px;font-weight:700;font-size:12px;">🏆 Tam Puan (100/100)</span>`;

  const heroHtml = `
    <div style="background:linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(22,33,62,0.6) 100%);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:16px 18px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-size:36px;">${data.icon}</span>
          <div>
            <div style="font-size:18px;font-weight:800;color:#fff;">${data.label}</div>
            <div style="font-size:12px;color:var(--text-muted,#aaa);margin-top:2px;">THE WUR Metodolojisi Ağırlığı: <strong style="color:${data.color};">%${data.weightPct}</strong></div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:32px;font-weight:900;color:#fff;line-height:1;">
            ${data.score} <span style="font-size:15px;color:var(--text-muted,#aaa);font-weight:400;">/ 100</span>
          </div>
          <div style="margin-top:6px;">${lossBadge}</div>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text-muted,#cbd5e1);margin-top:12px;line-height:1.5;border-top:1px solid rgba(255,255,255,0.06);padding-top:10px;">
        ${data.description}
      </div>
    </div>
  `;

  // Alt metrikler
  const metricsHtml = `
    <div style="margin-bottom:18px;">
      <div style="font-size:13px;font-weight:700;color:var(--text,#eee);margin-bottom:10px;display:flex;align-items:center;gap:6px;">
        <span>📊</span> Alt Metrikler ve Dağılım Çizelgesi
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${data.metrics.map(m => {
          const statusBg = m.status === 'good' ? 'rgba(16,185,129,0.15)' : m.status === 'warning' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)';
          const statusColor = m.status === 'good' ? '#10b981' : m.status === 'warning' ? '#f59e0b' : '#ef4444';
          return `
            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:10px 14px;">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                <div>
                  <div style="font-size:13px;font-weight:700;color:#fff;">${m.name}</div>
                  <div style="font-size:11px;color:var(--text-muted,#94a3b8);margin-top:2px;">${m.tip}</div>
                </div>
                <div style="text-align:right;">
                  <div style="font-size:14px;font-weight:800;color:#fff;">${m.score}</div>
                  <div style="font-size:11px;padding:2px 8px;border-radius:10px;display:inline-block;margin-top:2px;background:${statusBg};color:${statusColor};font-weight:600;">
                    ${m.statusText}
                  </div>
                </div>
              </div>
              <div style="font-size:11px;color:#cbd5e1;background:rgba(0,0,0,0.2);border-radius:6px;padding:6px 10px;margin-top:8px;">
                <strong>Üniversitenizin Durumu:</strong> ${m.current}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // Kayıp Analizi
  const lossSectionHtml = `
    <div style="margin-bottom:18px;background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.25);border-radius:10px;padding:14px 16px;">
      <div style="font-size:13px;font-weight:700;color:#f87171;margin-bottom:10px;display:flex;align-items:center;gap:6px;">
        <span>🔍</span> Nelerden Puan Kaybediyorsunuz? (Kayıp Analizi)
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${data.lostPointsSummary.map(item => `
          <div style="background:rgba(0,0,0,0.25);border-left:3px solid ${item.loss.includes('0 Puan') ? '#10b981' : '#ef4444'};border-radius:4px;padding:8px 12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:12px;font-weight:700;color:#fff;">${item.title}</span>
              <span style="font-size:11px;font-weight:700;color:${item.loss.includes('0 Puan') ? '#10b981' : '#f87171'};">${item.loss}</span>
            </div>
            <div style="font-size:11px;color:var(--text-muted,#cbd5e1);margin-top:3px;line-height:1.4;">
              ${item.desc}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Rektör Eylem Planı
  const recoSectionHtml = `
    <div style="background:rgba(79,163,224,0.06);border:1px solid rgba(79,163,224,0.25);border-radius:10px;padding:14px 16px;">
      <div style="font-size:13px;font-weight:700;color:var(--accent-blue,#4fa3e0);margin-bottom:10px;display:flex;align-items:center;gap:6px;">
        <span>🎯</span> Nasıl 100 Puana Ulaşılır? (Rektörün Eylem Planı)
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${data.recommendations.map(r => `
          <div style="display:flex;align-items:flex-start;gap:10px;font-size:12px;line-height:1.45;color:#e2e8f0;">
            <span style="font-size:16px;line-height:1;">${r.icon}</span>
            <div>
              <strong style="color:#fff;">${r.action}</strong>
              <span style="color:#cbd5e1;"> ${r.text}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  const modalBody = `
    <div style="display:flex;flex-direction:column;">
      ${switcherHtml}
      ${heroHtml}
      ${metricsHtml}
      ${lossSectionHtml}
      ${recoSectionHtml}
    </div>
  `;

  showModal(`${data.icon} ${data.label} — Detaylı Analiz`, modalBody, { wide: true });

  // Switcher butonları dinleyicisi
  document.querySelectorAll('.pillar-switcher-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const nextKey = btn.dataset.target;
      showPillarDetailModal(nextKey, state);
    });
  });
}

function _escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
