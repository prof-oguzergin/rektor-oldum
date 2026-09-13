// ─────────────────────────────────────────────────────────────────────────────
// DOM YARDIMCILARI
// ─────────────────────────────────────────────────────────────────────────────

/** ID ile element seç */
export const el  = id  => document.getElementById(id);

/** CSS seçici ile ilk eşleşen elementi seç */
export const qs  = sel => document.querySelector(sel);

/** CSS seçici ile tüm eşleşen elementleri seç (Array döner) */
export const qsa = sel => [...document.querySelectorAll(sel)];

/** Bir elemente event listener ekle */
export const on  = (element, event, handler) => {
  if (element) element.addEventListener(event, handler);
};

/** Delegate event (parent üzerinden child event yakalama) */
export function delegate(parent, selector, event, handler) {
  if (!parent) return;
  parent.addEventListener(event, e => {
    const target = e.target.closest(selector);
    if (target && parent.contains(target)) handler(e, target);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT YARDIMCILARI
// ─────────────────────────────────────────────────────────────────────────────

export function formatMoney(amount) {
  if (amount === null || amount === undefined) return '—';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(1).replace('.', ',')}Mrd ₺`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1).replace('.', ',')}M ₺`;
  }
  return `${sign}${abs.toLocaleString('tr-TR')} ₺`;
}

export function formatMoneyFull(amount) {
  if (amount === null || amount === undefined) return '—';
  return amount.toLocaleString('tr-TR') + ' ₺';
}

export function formatNumber(num) {
  if (num === null || num === undefined) return '—';
  return Math.round(num).toLocaleString('tr-TR');
}

export function formatPercent(ratio, decimals = 0) {
  return `%${(ratio * 100).toFixed(decimals)}`;
}

export function formatGPA(gpa) {
  return typeof gpa === 'number' ? gpa.toFixed(2) : '—';
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL & BİLDİRİM SİSTEMİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Modal overlay göster / gizle.
 * @param {string} title    — Modal başlığı
 * @param {string} bodyHtml — İçerik HTML
 * @param {object} [opts]   — Seçenekler: { wide: true } geniş modal için
 */
let _safeBackdropInitialized = false;

/**
 * Modalların dışına (backdrop) tıklayınca kapanmasını, ancak modal İÇİNDEN
 * başlayıp dışarıda bırakılan (slider sürükleme, metin seçme, input tıklaması vb.)
 * fare hareketlerinde YANLIŞLIKLA kapanmamasını sağlayan evrensel koruma dinleyicisi.
 *
 * Kural:
 * - Dışarıda basılıp (mousedown) dışarıda bırakılırsa (mouseup/click) → Modal kapanır.
 * - İçeride basılıp (mousedown) dışarıda bırakılırsa → Modal KAPANMAZ!
 */
export function initSafeModalBackdropDismiss() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (_safeBackdropInitialized || window._safeBackdropDismissInitialized) return;
  _safeBackdropInitialized = true;
  window._safeBackdropDismissInitialized = true;

  let pointerDownOnBackdrop = false;
  let pointerUpOnBackdrop = false;
  let touchStartOnBackdrop = false;
  let touchEndOnBackdrop = false;

  const isBackdropTarget = (target) => {
    if (!target) return false;
    // 1. Eğer tıklanan hedef bir .modal içinde ise ASLA backdrop değildir
    if (typeof target.closest === 'function' && target.closest('.modal, .modal-dialog, .general-modal, .event-modal, .summary-modal')) {
      return false;
    }
    // 2. Hedef modal-overlay, modal-backdrop veya modal dışındaki kaplama alanı mı?
    const overlay = document.getElementById('modal-overlay');
    const backdrop = document.getElementById('modal-backdrop');
    return target === overlay ||
           target === backdrop ||
           target.id === 'modal-backdrop' ||
           target.id === 'modal-overlay' ||
           (target.classList && (target.classList.contains('modal-backdrop') || target.classList.contains('modal-screen'))) ||
           (overlay && overlay.contains(target));
  };

  // Mousedown (capture fazında)
  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const overlay = document.getElementById('modal-overlay');
    if (!overlay || overlay.classList.contains('hidden')) {
      pointerDownOnBackdrop = false;
      return;
    }
    pointerDownOnBackdrop = isBackdropTarget(e.target);
  }, true);

  // Mouseup (capture fazında)
  document.addEventListener('mouseup', (e) => {
    if (e.button !== 0) return;
    const overlay = document.getElementById('modal-overlay');
    if (!overlay || overlay.classList.contains('hidden')) {
      pointerUpOnBackdrop = false;
      return;
    }
    pointerUpOnBackdrop = isBackdropTarget(e.target);
  }, true);

  // Touchstart (dokunmatik ekranlar)
  document.addEventListener('touchstart', (e) => {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay || overlay.classList.contains('hidden')) {
      touchStartOnBackdrop = false;
      return;
    }
    if (e.touches && e.touches.length > 1) {
      touchStartOnBackdrop = false;
      return;
    }
    touchStartOnBackdrop = isBackdropTarget(e.target);
  }, { capture: true, passive: true });

  // Touchend (dokunmatik ekranlar)
  document.addEventListener('touchend', (e) => {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay || overlay.classList.contains('hidden')) {
      touchEndOnBackdrop = false;
      return;
    }
    const touch = e.changedTouches?.[0];
    const target = (touch && typeof document.elementFromPoint === 'function')
      ? document.elementFromPoint(touch.clientX, touch.clientY)
      : e.target;
    touchEndOnBackdrop = isBackdropTarget(target);
  }, { capture: true, passive: true });

  // Click (capture fazında)
  document.addEventListener('click', (e) => {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay || overlay.classList.contains('hidden')) {
      pointerDownOnBackdrop = false;
      pointerUpOnBackdrop = false;
      touchStartOnBackdrop = false;
      touchEndOnBackdrop = false;
      return;
    }

    const isMouseDismiss = pointerDownOnBackdrop && pointerUpOnBackdrop;
    const isTouchDismiss = touchStartOnBackdrop && touchEndOnBackdrop;

    // Sadece hem mousedown hem mouseup backdrop üzerindeyse kapat
    if (isMouseDismiss || isTouchDismiss) {
      hideModal();
    }

    // Bayrakları sıfırla
    pointerDownOnBackdrop = false;
    pointerUpOnBackdrop = false;
    touchStartOnBackdrop = false;
    touchEndOnBackdrop = false;
  }, true);

  // Ekran odağı kaybolduğunda bayrakları temizle
  window.addEventListener('blur', () => {
    pointerDownOnBackdrop = false;
    pointerUpOnBackdrop = false;
    touchStartOnBackdrop = false;
    touchEndOnBackdrop = false;
  });
}

export function showModal(title, bodyHtml, opts = {}) {
  initSafeModalBackdropDismiss();
  const overlay  = el('modal-overlay');
  const titleEl  = el('general-modal-title');
  const bodyEl   = el('general-modal-body');
  const modalEl  = el('general-modal');
  if (!overlay || !titleEl || !bodyEl) return;

  titleEl.textContent = title;
  bodyEl.innerHTML    = bodyHtml;

  if (modalEl) {
    modalEl.classList.toggle('modal-wide', !!opts.wide);
  }

  overlay.classList.remove('hidden');
  overlay.classList.add('active');

  document.body.style.overflow = 'hidden';
  if (bodyEl.scrollTo) {
    bodyEl.scrollTo({ top: 0, behavior: 'instant' });
  } else {
    bodyEl.scrollTop = 0;
  }
}

export function hideModal() {
  const overlay = el('modal-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.classList.remove('active');
  }
  document.body.style.overflow = '';
}

/**
 * Alt barda (veya toast container) bildirim göster.
 * @param {string} message  — Mesaj
 * @param {string} type     — 'info' | 'success' | 'warning' | 'error'
 * @param {number} duration — ms
 */
let _lastNotification = { message: '', time: 0 };

export function showNotification(message, type = 'info', duration = 3500) {
  if (!message) return;
  const container = el('toast-container');
  if (!container) return;

  const now = Date.now();
  const trimmed = String(message).trim();

  // 1. Aynı mesaj 1.2 saniye içinde tekrar gelirse engelle
  if (_lastNotification.message === trimmed && (now - _lastNotification.time) < 1200) {
    return;
  }

  // 2. Container içinde birebir aynı içerikli aktif toast varsa tekrar ekleme
  const existing = [...container.querySelectorAll('.toast-content')].find(c => c.textContent.trim() === trimmed);
  if (existing) {
    return;
  }

  _lastNotification = { message: trimmed, time: now };

  // 3. Ekranda aynı anda en fazla 4 toast bulunsun (aşırı birikmeyi önle)
  while (container.children.length >= 4) {
    container.firstElementChild?.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">${message}</div>
    <div class="toast-progress"></div>
  `;

  container.appendChild(toast);

  // Otomatik kaldır
  setTimeout(() => {
    toast.classList.add('fadeout');
    setTimeout(() => toast.remove(), 400);
  }, duration);

  toast.addEventListener('click', () => toast.remove());
}

// ─────────────────────────────────────────────────────────────────────────────
// GÖRSEL YARDIMCILAR (Ring, Sparkline vb.)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Saygınlık vb. için yuvarlak ilerleme çubuğu (SVG)
 */
export function createProgressRing(value, max = 100, label = '', size = 80) {
  const radius      = (size / 2) - 8;
  const circumf     = 2 * Math.PI * radius;
  const pct         = Math.min(1, Math.max(0, value / max));
  const dashOffset  = circumf * (1 - pct);

  return `
    <div class="progress-ring-wrapper" style="width:${size}px;height:${size}px;">
      <svg class="progress-ring" width="${size}" height="${size}">
        <circle class="progress-ring-track" cx="${size/2}" cy="${size/2}" r="${radius}" stroke-width="6"/>
        <circle class="progress-ring-fill" cx="${size/2}" cy="${size/2}" r="${radius}" stroke-width="6"
                stroke-dasharray="${circumf}" stroke-dashoffset="${dashOffset}"/>
      </svg>
      <div class="progress-ring-label">
        <span class="progress-ring-value">${Math.round(value)}</span>
        ${label ? `<span class="progress-ring-sublabel">${label}</span>` : ''}
      </div>
    </div>
  `;
}

/**
 * Trendler için mini çizgi grafik (SVG)
 */
export function createSparkline(data, width = 80, height = 28, color = '#4ecca3') {
  if (!data || data.length < 2) return '';

  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const range  = Math.max(1, maxVal - minVal);

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - minVal) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const lastPt = pts.split(' ').pop().split(',');

  return `
    <svg class="sparkline" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <polyline class="sparkline-polyline" points="${pts}" stroke="${color}" style="stroke:${color}"/>
      <circle cx="${parseFloat(lastPt[0])}" cy="${parseFloat(lastPt[1])}" r="2" fill="${color}"/>
    </svg>
  `;
}

/**
 * Yıldız dizesi üret (★★★☆☆)
 */
export function createStarRating(filled, total = 5) {
  let html = '<span class="star-rating">';
  for (let i = 1; i <= total; i++) {
    html += `<span class="star ${i <= filled ? 'filled' : ''}">★</span>`;
  }
  html += '</span>';
  return html;
}

/**
 * Basit pasta grafik (SVG) HTML'i döndür.
 */
export function createPieChart(slices, size = 120) {
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) return '';

  const cx = size / 2;
  const cy = size / 2;
  const r  = size / 2 - 4;

  let startAngle = -Math.PI / 2;
  const paths = slices.map(sl => {
    const angle = (sl.value / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;

    const path = `M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${largeArc},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z`;
    startAngle = endAngle;

    return `<path d="${path}" fill="${sl.color}" opacity="0.9"/>`;
  }).join('');

  return `
    <div class="pie-chart-wrapper">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        ${paths}
        <circle cx="${cx}" cy="${cy}" r="${r * 0.45}" fill="var(--bg-card)"/>
      </svg>
    </div>
  `;
}

/**
 * Stat çubuğu (Hız, Teknik vb.)
 */
export function createStatBar(label, value, max = 100, color = 'auto', uncertain = false, displayVal = null) {
  const pct       = Math.min(100, Math.max(0, (value / max) * 100));
  const colorClass = uncertain ? 'uncertain' : (color === 'auto' ? _statColorClass(value) : '');
  const colorStyle = (!uncertain && color !== 'auto') ? `background:${color};` : '';
  const shown      = displayVal !== null ? displayVal : Math.round(value);

  return `
    <div class="stat-bar">
      <div class="stat-bar-label">${label}</div>
      <div class="stat-bar-track">
        <div class="stat-bar-fill ${colorClass}" style="width:${pct}%;${colorStyle}"></div>
      </div>
      <div class="stat-bar-value" style="color:${uncertain ? 'var(--text-muted)' : _statValueColor(value)};">
        ${shown}
      </div>
    </div>
  `;
}

export function _statColorClass(val) {
  if (val >= 70) return 'high';
  if (val >= 40) return 'mid';
  return 'low';
}

export function _statColor(val) {
  if (val >= 85) return '#d4af37';
  if (val >= 70) return 'var(--stat-high)';
  if (val >= 40) return 'var(--stat-mid)';
  return 'var(--stat-low)';
}

export function _statValueColor(val) {
  if (val >= 85) return '#d4af37';
  if (val >= 70) return 'var(--accent-green)';
  if (val >= 40) return 'var(--accent-yellow)';
  return 'var(--accent)';
}

/** Yıldız dizesi üret (★★★☆☆) */
export function _levelStars(level, max) {
  return '★'.repeat(level) + '☆'.repeat(Math.max(0, max - level));
}

/** Kapasite çubuk HTML'i */
export function _capacityBar(label, used, total) {
  if (total == null || total === 0) return '';
  const pct  = Math.min(100, Math.round((used / total) * 100));
  const color = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#4ade80';
  return `
    <div style="margin-top:4px;font-size:11px;color:#94a3b8;">
      ${label}: <span style="color:#e2e8f0;">${used}/${total}</span>
      <div style="background:#1e293b;border-radius:3px;height:4px;margin-top:2px;">
        <div style="background:${color};width:${pct}%;height:4px;border-radius:3px;"></div>
      </div>
    </div>`;
}

/** Bina etki nesnesini Türkçe kısa etiketlere çevirir */
export function _formatBuildingEffects(effects) {
  const labelMap = {
    educationQuality:       (v) => `+${v} eğitim kalitesi`,
    studentSatisfaction:    (v) => `+${v} öğrenci memnuniyeti`,
    researchOutput:         (v) => `+${v} araştırma çıktısı`,
    researchBoost:          (v) => `+%${Math.round(v * 100)} araştırma bonusu`,
    labScore:               (v) => `+${v} lab puanı`,
    publicationRate:        (v) => `+${v} yayın/hoca/yıl`,
    studentGPA:             (v) => `+${v} öğrenci GPA`,
    facultyHappiness:       (v) => `+${v} hoca memnuniyeti`,
    studentDemandBonus:     (v) => `+%${Math.round(v * 100)} öğrenci talebi`,
    revenuePerBed:          (v) => `+₺${v.toLocaleString('tr-TR')}/dönem yurt geliri`,
    prestige:               (v) => `+${v} saygınlık`,
    internationalization:   (v) => `+${v} uluslararasılaşma`,
    internationalVisibility:(v) => `+${v} uluslararası görünürlük`,
    eventRevenuePerTurn:    (v) => `+₺${v.toLocaleString('tr-TR')}/dönem etkinlik geliri`,
    tubitakSuccessRate:     (v) => `+%${Math.round(v * 100)} TÜBİTAK başarı şansı`,
    industryTieBonus:       (v) => `+${v} sektör bağı`,
    coopPartnerQuality:     (v) => `+${v} co-op kalitesi`,
    annualRentalRevenue:    (v) => `+₺${v.toLocaleString('tr-TR')}/yıl kira geliri`,
    alumniBonus:            (v) => `+${v} mezun bonusu`,
    coopStressReduction:    (v) => `−${v} co-op stresi`,
    classroomCapacity:      (v) => `+${v} derslik kapasitesi`,
    officeCapacity:         (v) => `+${v} ofis kapasitesi`,
    dormCapacity:           (v) => `+${v} yatak`,
    interdisciplinaryBonus: ()  => 'Disiplinlerarası bonus',
    spinoffRevenue:         ()  => 'Spin-off geliri',
  };
  return Object.entries(effects)
    .map(([k, v]) => labelMap[k] ? labelMap[k](v) : null)
    .filter(Boolean);
}

/** Küçük özet kartı (ikon + etiket + değer) */
export function _campusSummaryCard(icon, label, value) {
  return `
    <div style="background:var(--bg-secondary);padding:10px 14px;border-radius:10px;border:1px solid var(--border);">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <span style="font-size:18px;">${icon}</span>
        <span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:600;letter-spacing:0.02em;">${label}</span>
      </div>
      <div style="font-size:13px;font-weight:600;color:#e2e8f0;margin-top:2px;">${value}</div>
    </div>`;
}

/** GPA için renk */
export function _gpaColor(gpa) {
  if (gpa >= 3.5) return '#d4af37';
  if (gpa >= 3.0) return 'var(--accent-green)';
  if (gpa >= 2.5) return 'var(--accent-yellow)';
  return 'var(--accent-red,#e53e3e)';
}

/** Memnuniyet için renk */
export function _satColor(sat) {
  if (sat >= 70) return 'var(--accent-green)';
  if (sat >= 45) return 'var(--accent-yellow)';
  return 'var(--accent)';
}

/** Küçük stat kart HTML'i */
export function _statCardHtml(label, value, deltaClass, sub) {
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

/** Küçük bir ilerleme çubuğu HTML'i */
export function _inlineBar(val, max, widthPx = 100) {
  const pct = max > 0 ? Math.min(100, Math.round((val / max) * 100)) : 0;
  const color = pct >= 70 ? 'var(--success, #68d391)' : pct >= 40 ? 'var(--warning, #f6ad55)' : 'var(--danger, #fc8181)';
  return `<div style="display:inline-block;width:${widthPx}px;height:8px;background:var(--border);border-radius:4px;overflow:hidden;vertical-align:middle;">
    <div style="width:${pct}%;height:100%;background:${color};border-radius:4px;transition:width 0.3s;"></div>
  </div>`;
}
