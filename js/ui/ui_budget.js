import { el, on, qsa, formatMoney, formatMoneyFull, showNotification, _statCardHtml, createPieChart } from './ui_base.js';
import { calculateIncome, calculateExpenses, calculateLoanPayment } from '../economy.js?v=0.4.24';
import { BANKS } from '../data.js?v=0.4.48';

/**
 * Bütçe sekmesi: gelir/gider tablosu, pasta grafik, bütçe dağılım slider'ları.
 */
export function renderBudgetPanel(state, onAllocChange, onLoanAction, onTuitionChange, onAidChange) {
  const panel = el('tab-budget');
  if (!panel) return;

  const uni    = state.university || {};
  const alloc  = uni.budgetAllocation || {};
  const budget = uni.budget ?? 0;

  // Gerçek ekonomi hesabı
  const incomeDetail  = calculateIncome(state);
  const expenseDetail = calculateExpenses(state);
  const revenue = incomeDetail.total || 0;
  const costs   = expenseDetail.total || 0;
  const net     = revenue - costs;

  const allocDefs = [
    { key: 'faculty',   label: 'Kadro & Maaşlar', color: '#e94560' },
    { key: 'research',  label: 'Araştırma Fonu',  color: '#9b59b6' },
    { key: 'students',  label: 'Öğrenci Hizm.',  color: '#4ecca3' },
    { key: 'marketing', label: 'Pazarlama',        color: '#f0a500' },
    { key: 'it',        label: 'BT Altyapı',       color: '#4fa3e0' },
    { key: 'reserve',   label: 'Acil Rezerv',      color: '#888' },
  ];

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="panel-title">Bütçe Yönetimi</div>
        <div class="panel-subtitle">
          Mevcut: <strong class="${budget >= 0 ? 'text-good' : 'text-bad'}">${formatMoneyFull(budget)}</strong>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(240px, 1fr));gap:16px;margin-bottom:24px;">
      ${_statCardHtml('Dönem Geliri (Tahmini)', formatMoney(revenue), 'positive', '')}
      ${_statCardHtml('Dönem Gideri (Tahmini)', formatMoney(costs), 'negative', '')}
      ${_statCardHtml('Net Bakiye', formatMoney(net), net >= 0 ? 'positive' : 'negative', net >= 0 ? 'Artı bakiye' : 'Açık!')}
      ${_statCardHtml('Toplam Borç', formatMoney(uni.debt ?? 0), (uni.debt ?? 0) > 0 ? 'negative' : null, '')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">

      <div>
        <div class="section-title">Gelir / Gider Detayı</div>
        <div class="card" style="padding:0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Kalem</th>
                <th class="text-right">Dönemlik Tutar</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colspan="2" style="color:var(--accent-green);font-weight:700;padding:8px 12px 4px;font-size:11px;text-transform:uppercase;">GELİRLER</td></tr>
              ${_revenueLineItems(state, revenue, incomeDetail)}
              <tr style="border-top:2px solid var(--border-light);">
                <td style="font-weight:700;">Toplam Gelir</td>
                <td class="text-right font-bold text-good">${formatMoney(revenue)}</td>
              </tr>

              <tr><td colspan="2" style="color:var(--accent);font-weight:700;padding:12px 12px 4px;font-size:11px;text-transform:uppercase;">GİDERLER</td></tr>
              <tr>
                <td>Hoca Maaşları</td>
                <td class="text-right text-bad">-${formatMoney(expenseDetail.salariesAcademic || 0)}</td>
              </tr>
              <tr>
                <td>Yerleşke Bakım</td>
                <td class="text-right text-bad">-${formatMoney(expenseDetail.maintenance || 0)}</td>
              </tr>
              <tr>
                <td>İdari Harcamalar</td>
                <td class="text-right text-bad">-${formatMoney((expenseDetail.salariesAdmin || 0) + (expenseDetail.partTime || 0))}</td>
              </tr>
              <tr>
                <td>Araştırma Yatırımı</td>
                <td class="text-right text-bad">-${formatMoney(expenseDetail.researchInvestment || 0)}</td>
              </tr>
              <tr>
                <td>Burs Ödemeleri</td>
                <td class="text-right text-bad">-${formatMoney(expenseDetail.scholarships || 0)}</td>
              </tr>
              <tr>
                <td>Genel Giderler</td>
                <td class="text-right text-bad">-${formatMoney((expenseDetail.overhead || 0) + (expenseDetail.construction || 0))}</td>
              </tr>
              <tr style="border-top:2px solid var(--border-light);">
                <td style="font-weight:700;">Toplam Gider</td>
                <td class="text-right font-bold text-bad">-${formatMoney(costs)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div class="section-title">Bütçe Dağılımı</div>
        <div class="card">
          <div style="display:flex;justify-content:center;margin-bottom:20px;">
            ${createPieChart(allocDefs.map(a => ({
              label: a.label, value: alloc[a.key] ?? 0, color: a.color
            })), 120)}
          </div>

          <div style="display:flex;flex-direction:column;gap:12px;">
            ${allocDefs.map(a => `
              <div class="slider-row">
                <div class="slider-label" style="font-size:12px;">${a.label}</div>
                <input type="range" class="budget-slider alloc-slider"
                       data-alloc-key="${a.key}"
                       min="0" max="60" step="5"
                       value="${Math.round((alloc[a.key] ?? 0) * 100)}">
                <div class="slider-value alloc-value" id="alloc-val-${a.key}" style="min-width:40px;text-align:right;">
                  %${Math.round((alloc[a.key] ?? 0) * 100)}
                </div>
              </div>
            `).join('')}

            <div style="font-size:11px;color:var(--text-muted);text-align:right;margin-top:4px;" id="alloc-total-label">
              Toplam: %${Math.round(Object.values(alloc).reduce((s, v) => s + v, 0) * 100)}
            </div>

            <button class="btn btn-success" id="btn-apply-alloc" style="width:100%;justify-content:center;margin-top:8px;">
              Dağılımı Uygula
            </button>
          </div>
        </div>

        ${(uni.type === 'vakif' || uni.type === 'us_private') ? `
          <div class="section-title mt-md">${uni.type === 'us_private' ? 'Harç & Financial Aid' : 'Harç Ayarı'}</div>
          <div class="card">
            <div class="offer-row">
              <div class="offer-label">Dönemlik Harç</div>
              <div class="slider-row" style="grid-template-columns:1fr 100px;margin-top:8px;">
                <input type="range" class="budget-slider" id="tuition-slider"
                       min="${uni.type === 'us_private' ? 500000 : 10000}"
                       max="${uni.type === 'us_private' ? 2000000 : 150000}"
                       step="${uni.type === 'us_private' ? 50000 : 5000}"
                       value="${uni.tuitionPerSemester ?? (uni.type === 'us_private' ? 935000 : 40000)}">
                <div class="slider-value" id="tuition-value" style="text-align:right;">
                  ${formatMoney(uni.tuitionPerSemester ?? (uni.type === 'us_private' ? 935000 : 40000))}
                </div>
              </div>
            </div>
            ${uni.type === 'us_private' ? `
            <div class="offer-row" style="margin-top:16px;">
              <div class="offer-label">Financial Aid Oranı</div>
              <div class="slider-row" style="grid-template-columns:1fr 100px;margin-top:8px;">
                <input type="range" class="budget-slider" id="aid-slider"
                       min="0" max="80" step="5"
                       value="${Math.round((uni.financialAidRate ?? 0.45) * 100)}">
                <div class="slider-value" id="aid-value" style="text-align:right;">
                  %${Math.round((uni.financialAidRate ?? 0.45) * 100)}
                </div>
              </div>
            </div>
            ` : ''}
          </div>
        ` : ''}
        ${uni.type === 'devlet' ? `
          <div class="section-title mt-md">Devlet Üniversitesi Bilgisi</div>
          <div class="card" style="font-size:12px;color:var(--text-muted);line-height:1.7;">
            <div>• Harç: <strong style="color:var(--text-primary);">Ücretsiz</strong></div>
            <div>• Ana gelir: <strong style="color:var(--accent-green);">YÖK bütçe tahsisi</strong></div>
            <div>• Kadro: Yeni pozisyon için hükümet onayı gerekir (2 dönem)</div>
          </div>
        ` : ''}
      </div>

    </div>

    <div style="margin-top:32px;">
      <div class="section-title">🏦 Banka Kredileri</div>
      
      ${(() => {
        const loans = uni.loans || [];
        if (loans.length === 0) {
          return `<div class="card" style="font-size:12px;color:var(--text-muted);text-align:center;padding:24px;border:1px dashed var(--border);">
               Aktif kredi bulunmuyor.
             </div>`;
        }
        return `
          <div class="card" style="padding:0;overflow:hidden;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Banka</th>
                  <th class="text-right">Kalan Borç</th>
                  <th class="text-right">Dönem Taksiti</th>
                  <th class="text-right">Vade</th>
                  <th class="text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                ${loans.map((loan, idx) => `
                  <tr>
                    <td>${loan.bankIcon || '🏦'} ${loan.bankName}</td>
                    <td class="text-right">${formatMoneyFull(loan.remainingAmount)}</td>
                    <td class="text-right text-bad">-${formatMoneyFull(loan.semesterPayment)}</td>
                    <td class="text-right">${loan.remainingTerms} dönem</td>
                    <td class="text-right">
                      <button class="btn btn-sm ${budget >= loan.remainingAmount ? 'btn-warning' : 'btn-ghost'}"
                              id="btn-repay-loan-${idx}"
                              ${budget >= loan.remainingAmount ? '' : 'disabled'}>
                        Erken Öde
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>`;
      })()}

      <div style="margin-top:16px;">
        <button class="btn btn-primary" id="btn-show-loan-form">
          + Yeni Kredi Çek
        </button>
        
        <div id="loan-form-section" style="display:none;margin-top:16px;">
          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:12px;margin-bottom:16px;">
            ${BANKS.map(bank => `
              <div class="card bank-card" data-bank-id="${bank.id}" style="cursor:pointer;border:2px solid transparent;transition:all 0.2s;">
                <div style="font-size:24px;margin-bottom:8px;">${bank.icon}</div>
                <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${bank.name}</div>
                <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px;">${bank.description}</div>
                <div style="font-size:12px;">
                  <div>Faiz: <strong>%${(bank.interestRate * 100).toFixed(0)}/yıl</strong></div>
                  <div>Limit: <strong>${formatMoney(bank.maxLoan)}</strong></div>
                </div>
              </div>
            `).join('')}
          </div>

          <div id="loan-config-section" style="display:none;" class="card">
            <div style="font-weight:700;margin-bottom:16px;" id="loan-selected-bank-name"></div>
            <div style="display:flex;flex-direction:column;gap:16px;">
              <div class="slider-row">
                <div class="slider-label" style="font-size:13px;">Miktar:</div>
                <input type="range" id="loan-amount-slider" min="1000000" max="60000000" step="1000000" value="5000000">
                <div class="slider-value" id="loan-amount-display" style="min-width:100px;text-align:right;">₺5.000.000</div>
              </div>
              <div style="display:flex;align-items:center;gap:12px;">
                <label style="font-size:13px;">Vade:</label>
                <select id="loan-term-select" class="form-input" style="width:auto;padding:6px 12px;"></select>
              </div>
              <div id="loan-payment-preview" style="background:var(--bg-secondary);padding:12px;border-radius:8px;font-size:13px;"></div>
              <button class="btn btn-success" id="btn-confirm-loan" style="justify-content:center;">Krediyi Onayla</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // --- LISTENERS ---
  
  // Dağılım
  qsa('.alloc-slider').forEach(s => {
    on(s, 'input', () => {
      const valEl = el(`alloc-val-${s.dataset.allocKey}`);
      if (valEl) valEl.textContent = `%${s.value}`;
      const total = qsa('.alloc-slider').reduce((sum, sl) => sum + parseInt(sl.value), 0);
      const totalLabel = el('alloc-total-label');
      if (totalLabel) {
        totalLabel.textContent = `Toplam: %${total}`;
        totalLabel.style.color = total === 100 ? 'var(--accent-green)' : 'var(--accent)';
      }
    });
  });

  on(el('btn-apply-alloc'), 'click', () => {
    const newAlloc = {};
    qsa('.alloc-slider').forEach(s => { newAlloc[s.dataset.allocKey] = parseInt(s.value) / 100; });
    const total = Object.values(newAlloc).reduce((s, v) => s + v, 0);
    if (Math.abs(total - 1.0) > 0.05) {
      showNotification(`Toplam %${Math.round(total * 100)} — %100 olmalı!`, 'warning');
      return;
    }
    onAllocChange && onAllocChange(newAlloc);
    showNotification('Bütçe dağılımı güncellendi.', 'success');
  });

  // Harç
  const tuitionSlider = el('tuition-slider');
  if (tuitionSlider) {
    on(tuitionSlider, 'input', () => {
      const valEl = el('tuition-value');
      if (valEl) valEl.textContent = formatMoney(parseInt(tuitionSlider.value));
    });
    on(tuitionSlider, 'change', () => {
      onTuitionChange && onTuitionChange(parseInt(tuitionSlider.value));
      showNotification('Harç ayarı kaydedildi.', 'success');
    });
  }

  // Aid
  const aidSlider = el('aid-slider');
  if (aidSlider) {
    on(aidSlider, 'input', () => {
      const valEl = el('aid-value');
      if (valEl) valEl.textContent = `%${aidSlider.value}`;
    });
    on(aidSlider, 'change', () => {
      onAidChange && onAidChange(parseInt(aidSlider.value) / 100);
      showNotification('Burs oranı güncellendi.', 'success');
    });
  }

  // Krediler
  const loans = uni.loans || [];
  loans.forEach((l, idx) => {
    on(el(`btn-repay-loan-${idx}`), 'click', () => {
      const res = onLoanAction({ type: 'repay_loan_early', loanIndex: idx });
      if (res && res.success) {
        showNotification(res.message, 'success');
        if (window._onBudgetTabRefresh) window._onBudgetTabRefresh();
      } else {
        showNotification(res?.message || 'Hata oluştu.', 'error');
      }
    });
  });

  // Kredi Formu
  let _selectedBankId = null;
  let _selectedBankData = null;

  on(el('btn-show-loan-form'), 'click', () => {
    const form = el('loan-form-section');
    const isVisible = form.style.display !== 'none';
    form.style.display = isVisible ? 'none' : 'block';
    el('btn-show-loan-form').textContent = isVisible ? '+ Yeni Kredi Çek' : '− Formu Kapat';
  });

  qsa('.bank-card').forEach(card => {
    on(card, 'click', () => {
      const bank = BANKS.find(b => b.id === card.dataset.bankId);
      if (!bank) return;
      _selectedBankId = bank.id;
      _selectedBankData = bank;
      qsa('.bank-card').forEach(c => c.style.borderColor = 'transparent');
      card.style.borderColor = 'var(--accent-green)';
      el('loan-config-section').style.display = 'block';
      el('loan-selected-bank-name').textContent = `Seçilen Banka: ${bank.icon} ${bank.name}`;
      
      const amtSlider = el('loan-amount-slider');
      amtSlider.max = bank.maxLoan;
      amtSlider.value = Math.min(parseInt(amtSlider.value), bank.maxLoan);
      el('loan-amount-display').textContent = formatMoney(parseInt(amtSlider.value));
      
      const termSelect = el('loan-term-select');
      termSelect.innerHTML = bank.terms.map(t => `<option value="${t}">${t} dönem</option>`).join('');
      _updateLoanPreview();
    });
  });

  function _updateLoanPreview() {
    if (!_selectedBankData) return;
    const amount = parseInt(el('loan-amount-slider').value);
    const term = parseInt(el('loan-term-select').value);
    if (!term) return;
    const payment = calculateLoanPayment(amount, _selectedBankData.interestRate, term);
    el('loan-payment-preview').innerHTML = `
      Dönem taksiti: <strong style="color:var(--accent);">${formatMoney(payment)}</strong><br>
      Toplam geri ödeme: <strong>${formatMoney(payment * term)}</strong>`;
  }

  on(el('loan-amount-slider'), 'input', (e) => {
    el('loan-amount-display').textContent = formatMoney(parseInt(e.target.value));
    _updateLoanPreview();
  });
  on(el('loan-term-select'), 'change', _updateLoanPreview);

  on(el('btn-confirm-loan'), 'click', () => {
    const res = onLoanAction({
      type: 'take_loan',
      bankId: _selectedBankId,
      amount: parseInt(el('loan-amount-slider').value),
      termSemesters: parseInt(el('loan-term-select').value)
    });
    if (res && res.success) {
      showNotification(res.message, 'success');
      if (window._onBudgetTabRefresh) window._onBudgetTabRefresh();
    } else {
      showNotification(res?.message || 'Kredi alınamadı.', 'error');
    }
  });
}

function _revenueLineItems(state, revenue, incomeDetail) {
  if (!incomeDetail) return '';
  const uniType = state.university?.type || 'vakif';
  const projOverhead = (incomeDetail.projectOverhead || 0) > 0 ? `<tr><td>Proje Kesintileri</td><td class="text-right text-good">${formatMoney(incomeDetail.projectOverhead)}</td></tr>` : '';
  const patentRoy = (incomeDetail.patentRoyalties || 0) > 0 ? `<tr><td>Patent Gelirleri</td><td class="text-right text-good">${formatMoney(incomeDetail.patentRoyalties)}</td></tr>` : '';

  if (uniType === 'devlet') {
    return `
      <tr><td>YÖK Tahsisi + Katkı Payı</td><td class="text-right text-good">${formatMoney((incomeDetail.stateGrant || 0) + (incomeDetail.tuition || 0))}</td></tr>
      <tr><td>Araştırma Fonları</td><td class="text-right text-good">${formatMoney(incomeDetail.researchFunds || 0)}</td></tr>
      ${projOverhead}${patentRoy}
      <tr><td>Döner Sermaye</td><td class="text-right text-good">${formatMoney(incomeDetail.revolving || 0)}</td></tr>
      <tr><td>Bağışlar</td><td class="text-right text-good">${formatMoney(incomeDetail.donations || 0)}</td></tr>`;
  }
  if (uniType === 'us_private') {
    return `
      <tr><td>Tuition & Fees</td><td class="text-right text-good">${formatMoney(incomeDetail.tuition || 0)}</td></tr>
      <tr><td>Endowment Getirileri</td><td class="text-right text-good">${formatMoney(incomeDetail.stateGrant || 0)}</td></tr>
      <tr><td>Araştırma Hibeleri</td><td class="text-right text-good">${formatMoney(incomeDetail.researchFunds || 0)}</td></tr>
      <tr><td>Mezun Bağışları</td><td class="text-right text-good">${formatMoney(incomeDetail.donations || 0)}</td></tr>`;
  }
  return `
    <tr><td>Öğrenci Ücretleri</td><td class="text-right text-good">${formatMoney(incomeDetail.tuition || 0)}</td></tr>
    <tr><td>Vakıf Katkısı</td><td class="text-right text-good">${formatMoney(incomeDetail.stateGrant || 0)}</td></tr>
    <tr><td>Araştırma Fonları</td><td class="text-right text-good">${formatMoney(incomeDetail.researchFunds || 0)}</td></tr>
    ${projOverhead}${patentRoy}
    <tr><td>Döner Sermaye</td><td class="text-right text-good">${formatMoney(incomeDetail.revolving || 0)}</td></tr>
    <tr><td>Bağış & Sponsorluk</td><td class="text-right text-good">${formatMoney((incomeDetail.donations || 0) + (incomeDetail.sponsorship || 0))}</td></tr>`;
}
