/**
 * Rektör Oldum — Etkileşimli Rehber Sistemi (tutorial.js)
 * ES6 module. İlk oyun başlangıcında adım adım rehberlik sağlar.
 */

// ─────────────────────────────────────────────────────────────────────────────
// REHBER ADIMLARI
// ─────────────────────────────────────────────────────────────────────────────

const TUTORIAL_STEPS = [
  {
    id: 'hosgeldin',
    title: '🎓 Rektör Oldum\'a Hoş Geldiniz!',
    content: `Bir üniversite yönetiyorsunuz. Amacınız: saygın, başarılı bir üniversite inşa etmek.<br><br>
Üst çubukta <strong>bütçenizi</strong>, <strong>saygınlığınızı</strong>, <strong>sıralamanızı</strong>, öğrenci ve kadro sayınızı görüyorsunuz.`,
    highlightSelector: '.top-bar',
  },
  {
    id: 'dashboard',
    title: '📊 Genel Bakış',
    content: `Genel Bakış ekranında üniversitenizin genel durumunu görürsünüz.<br><br>
Her dönem sonunda <strong>"Sonraki Dönem"</strong> butonuna basarak ilerleyeceksiniz.`,
    highlightSelector: '#tab-dashboard',
    highlightExtra: '.btn-next-turn',
  },
  {
    id: 'kadro',
    title: '👨‍🏫 Kadro — Hoca Yönetimi',
    content: `<strong>Kadro</strong> sekmesinde hocalarınızı görürsünüz. Transfer pazarından yeni hoca alabilir, kadro ilanı verebilir, maaş ayarlayabilirsiniz.<br><br>
İyi hocalar = iyi araştırma + iyi eğitim.`,
    highlightSelector: '.sidebar-tab[data-tab="faculty"]',
  },
  {
    id: 'ogrenciler',
    title: '🎓 Öğrenciler — Kontenjan Belirleme',
    content: `Her güz döneminde yeni öğrenci alırsınız. <strong>Kontenjan Belirleme</strong> butonuyla burslu/ücretli kontenjanları ayarlayın.<br><br>
İyi öğrenci çekmek için saygınlık gerekir.`,
    highlightSelector: '.sidebar-tab[data-tab="students"]',
  },
  {
    id: 'yerleske',
    title: '🏛️ Yerleşke — Bina İnşaatı',
    content: `<strong>Yerleşke</strong> sekmesinde bina yapabilir, düzey yükseltebilir, bölüm atayabilirsiniz.<br><br>
Derslik ve ofis kapasitesi öğrenci/hoca sayınızı sınırlar.`,
    highlightSelector: '.sidebar-tab[data-tab="campus"]',
  },
  {
    id: 'arastirma',
    title: '🔬 Araştırma — Projeler ve Yayınlar',
    content: `Hocalarınız otomatik olarak projelere başvurur. <strong>Araştırma</strong> sekmesinden BAP çağrısı açabilir, aktif projeleri takip edebilirsiniz.`,
    highlightSelector: '.sidebar-tab[data-tab="research"]',
  },
  {
    id: 'butce',
    title: '💰 Bütçe — Mali Yönetim',
    content: `Geliriniz harç, araştırma fonları ve bağışlardan gelir.<br>
Gideriniz maaşlar, bakım ve burslardan oluşur.<br><br>
<strong>Dengeyi koruyun!</strong> Sürekli açık verirseniz YÖK denetimi başlar.`,
    highlightSelector: '.sidebar-tab[data-tab="budget"]',
  },
  {
    id: 'kulupler',
    title: 'Öğrenci Kulüpleri',
    content: 'Kulüpler sekmesinden öğrenci kulüpleri kurabilirsiniz. Kulüpler öğrenci memnuniyetini ve üniversitenin saygınlığını artırır. Her kulüp kurulduktan sonra seviye yükseltilebilir.',
    highlightSelector: '.sidebar-tab[data-tab="clubs"]',
  },
  {
    id: 'akreditasyon',
    title: 'Akreditasyon',
    content: 'Akreditasyon sekmesinden bölümleriniz için MÜDEK, ABET veya THEQA akreditasyonu başvurusu yapabilirsiniz. Akredite bölümler daha iyi öğrenci çeker ve saygınlık kazandırır.',
    highlightSelector: '.sidebar-tab[data-tab="accreditation"]',
  },
  {
    id: 'tto',
    title: 'Teknoloji Transfer Ofisi',
    content: 'Araştırma sekmesindeki "Teknoloji Transfer" alt sekmesinden TTO kurabilirsiniz. TTO, patentlerinizden lisans geliri, spin-off şirketler ve sektör anlaşmaları sağlar.',
    highlightSelector: '.sidebar-tab[data-tab="research"]',
  },
  {
    id: 'hedefler',
    title: '🏆 İlk Hedefiniz',
    content: `İlk 10 dönemde şunları hedefleyin:<br><br>
<ul style="margin:8px 0 0 16px;line-height:1.8">
  <li>1 yeni bina yapın</li>
  <li>5 yeni hoca alın</li>
  <li>Saygınlığı 30\'a çıkarın</li>
  <li>Sıralamada 40. sıraya yükselin</li>
</ul><br>
Haydi başlayalım! 🚀`,
    highlightSelector: null,
    isLast: true,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DURUM
// ─────────────────────────────────────────────────────────────────────────────

const TUTORIAL_DONE_KEY = 'rektor-oldum-tutorial-done';
let _currentStep = 0;
let _overlayEl   = null;
let _modalEl     = null;
let _highlightedEls = [];

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCILAR
// ─────────────────────────────────────────────────────────────────────────────

function _qs(sel) {
  return sel ? document.querySelector(sel) : null;
}

function _removeHighlights() {
  _highlightedEls.forEach(el => el.classList.remove('tutorial-highlight'));
  _highlightedEls = [];
}

function _applyHighlight(selector) {
  if (!selector) return;
  const el = _qs(selector);
  if (el) {
    el.classList.add('tutorial-highlight');
    _highlightedEls.push(el);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERLAY OLUŞTURMA
// ─────────────────────────────────────────────────────────────────────────────

function _createOverlay() {
  if (_overlayEl) return;

  _overlayEl = document.createElement('div');
  _overlayEl.className = 'tutorial-overlay';
  _overlayEl.id = 'tutorial-overlay';

  _modalEl = document.createElement('div');
  _modalEl.className = 'tutorial-modal';
  _modalEl.id = 'tutorial-modal';

  _overlayEl.appendChild(_modalEl);
  document.body.appendChild(_overlayEl);
}

function _destroyOverlay() {
  _removeHighlights();
  if (_overlayEl) {
    _overlayEl.remove();
    _overlayEl = null;
    _modalEl   = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADIM GÖSTER
// ─────────────────────────────────────────────────────────────────────────────

function _showStep(index) {
  if (index < 0 || index >= TUTORIAL_STEPS.length) {
    _finishTutorial();
    return;
  }

  _currentStep = index;
  const step   = TUTORIAL_STEPS[index];
  const total  = TUTORIAL_STEPS.length;

  // Önceki vurguyu kaldır, yenisini ekle
  _removeHighlights();
  _applyHighlight(step.highlightSelector);
  if (step.highlightExtra) _applyHighlight(step.highlightExtra);

  const isLast    = step.isLast || index === total - 1;
  const nextLabel = isLast ? 'Oyuna Başla →' : 'Sonraki →';

  _modalEl.innerHTML = `
    <div class="tutorial-header">
      <span class="tutorial-step-counter">${index + 1} / ${total}</span>
      <button class="tutorial-skip-btn" id="tutorial-skip">Atla</button>
    </div>
    <h3 class="tutorial-title">${step.title}</h3>
    <div class="tutorial-content">${step.content}</div>
    <div class="tutorial-footer">
      <button class="tutorial-next-btn btn btn-primary" id="tutorial-next">${nextLabel}</button>
    </div>
  `;

  // Geçiş animasyonu
  _modalEl.classList.remove('tutorial-modal-in');
  void _modalEl.offsetWidth; // reflow
  _modalEl.classList.add('tutorial-modal-in');

  // Event'ler
  const nextBtn = document.getElementById('tutorial-next');
  const skipBtn = document.getElementById('tutorial-skip');

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (isLast) {
        _finishTutorial();
      } else {
        _showStep(index + 1);
      }
    });
  }

  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      _finishTutorial();
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TUTORIAL TAMAMLA
// ─────────────────────────────────────────────────────────────────────────────

function _finishTutorial() {
  localStorage.setItem(TUTORIAL_DONE_KEY, '1');
  _destroyOverlay();
}

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * İlk oyun başlangıcında çağrılır.
 * Daha önce tamamlanmışsa göstermez.
 */
export function showTutorialIfNeeded() {
  if (localStorage.getItem(TUTORIAL_DONE_KEY)) return;
  _createOverlay();
  // Overlay görünür olmadan önce DOM'un render edilmesini bekle
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      _showStep(0);
    });
  });
}

/**
 * Rehberi sıfırlar ve baştan gösterir.
 * "❓ Rehber" butonu için.
 */
export function replayTutorial() {
  localStorage.removeItem(TUTORIAL_DONE_KEY);
  _destroyOverlay();
  _createOverlay();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      _showStep(0);
    });
  });
}

/**
 * Rehber tamamlanmış mı?
 */
export function isTutorialDone() {
  return !!localStorage.getItem(TUTORIAL_DONE_KEY);
}
