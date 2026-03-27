/**
 * Rektör Oldum — Kayıt/Yükleme Sistemi (save.js)
 * ES6 module. LocalStorage tabanlı kayıt sistemi.
 * 3 manuel slot + 1 otomatik kayıt.
 */

// ─────────────────────────────────────────────────────────────────────────────
// SABİTLER
// ─────────────────────────────────────────────────────────────────────────────

const SAVE_VERSION     = '0.1';
const SAVE_PREFIX      = 'university_tycoon_save_';
const AUTOSAVE_KEY     = 'university_tycoon_autosave';
const MANUAL_SLOTS     = ['slot1', 'slot2', 'slot3'];

// ─────────────────────────────────────────────────────────────────────────────
// STATE TEMİZLEME (JSON serialize güvenliği)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * State'i JSON serileştirme için temizler.
 * Fonksiyonları, NaN ve undefined değerleri kaldırır/dönüştürür.
 * Dairesel referanslara karşı güvenli.
 *
 * @param {object} obj — Temizlenecek nesne
 * @returns {object} JSON-güvenli nesne
 */
export function sanitizeForSave(obj) {
  if (obj === null || obj === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(obj, (key, value) => {
      if (typeof value === 'function') return undefined;
      if (typeof value === 'number' && (isNaN(value) || !isFinite(value))) return 0;
      if (value === undefined) return null;
      return value;
    }));
  } catch (err) {
    console.error('[save] sanitizeForSave: temizleme hatası, ham nesne döndürülüyor.', err);
    return obj;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// KAYDET
// ─────────────────────────────────────────────────────────────────────────────

/**
 * State'i belirtilen slota kaydet.
 * @param {object} state    — Oyun durumu (game.js'ten getState())
 * @param {string} slotName — Slot adı ('slot1', 'slot2', 'slot3')
 * @returns {boolean} Başarılı mı?
 */
export function saveGame(state, slotName) {
  if (!state || !slotName) {
    console.warn('[save] saveGame: geçersiz state veya slotName');
    return false;
  }
  try {
    const safeState = sanitizeForSave(state);
    const payload = {
      version:   SAVE_VERSION,
      timestamp: Date.now(),
      slotName,
      state:     JSON.stringify(safeState),
    };
    localStorage.setItem(SAVE_PREFIX + slotName, JSON.stringify(payload));
    console.log(`[save] Oyun kaydedildi → ${slotName} (${new Date(payload.timestamp).toLocaleString('tr-TR')})`);
    return true;
  } catch (err) {
    console.error('[save] saveGame hatası:', err);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// YÜKLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Belirtilen slotan kayıt yükle.
 * @param {string} slotName — Slot adı
 * @returns {object|null} Oyun durumu veya null (kayıt yok / hata)
 */
export function loadGame(slotName) {
  const key = slotName === 'autosave' ? AUTOSAVE_KEY : SAVE_PREFIX + slotName;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      console.log(`[save] loadGame: ${slotName} slotunda kayıt bulunamadı`);
      return null;
    }

    const payload = JSON.parse(raw);

    // Versiyon kontrolü
    if (payload.version !== SAVE_VERSION) {
      console.warn(
        `[save] Versiyon uyumsuzluğu: kayıt=${payload.version}, beklenen=${SAVE_VERSION}. ` +
        'Yükleme deneniyor...'
      );
    }

    const state = JSON.parse(payload.state);
    console.log(
      `[save] Oyun yüklendi → ${slotName} ` +
      `(${new Date(payload.timestamp).toLocaleString('tr-TR')})`
    );
    return state;
  } catch (err) {
    console.error('[save] loadGame hatası:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OTOMATİK KAYIT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Otomatik kayıt (her tur sonunda çağrılır).
 * @param {object} state — Oyun durumu
 * @returns {boolean} Başarılı mı?
 */
export function autoSave(state) {
  if (!state) {
    console.warn('[save] autoSave: geçersiz state');
    return false;
  }
  try {
    const safeState = sanitizeForSave(state);
    const payload = {
      version:   SAVE_VERSION,
      timestamp: Date.now(),
      slotName:  'autosave',
      state:     JSON.stringify(safeState),
    };
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
    console.log(`[save] Otomatik kayıt → ${new Date(payload.timestamp).toLocaleString('tr-TR')}`);
    return true;
  } catch (err) {
    console.error('[save] autoSave hatası:', err);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// KAYIT SLOTLARINI LİSTELE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mevcut kayıt slotlarını listele.
 * @returns {Array<object>} Her slot için: { slotName, label, timestamp, uniName, year, turn, isEmpty }
 */
export function getSaveSlots() {
  const slots = [];

  // Manuel slotlar
  for (const slotName of MANUAL_SLOTS) {
    const slotInfo = _readSlotMeta(SAVE_PREFIX + slotName, slotName);
    slots.push(slotInfo);
  }

  // Otomatik kayıt
  const autoInfo = _readSlotMeta(AUTOSAVE_KEY, 'autosave');
  autoInfo.label = 'Otomatik Kayıt';
  slots.push(autoInfo);

  return slots;
}

/**
 * Slot meta bilgisini oku (state parse etmeden).
 * @param {string} key      — LocalStorage anahtarı
 * @param {string} slotName — Slot adı
 * @returns {object} Slot bilgisi
 */
function _readSlotMeta(key, slotName) {
  const labels = { slot1: '1. Slot', slot2: '2. Slot', slot3: '3. Slot', autosave: 'Otomatik Kayıt' };

  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return {
        slotName,
        label:     labels[slotName] || slotName,
        timestamp: null,
        uniName:   null,
        year:      null,
        turn:      null,
        isEmpty:   true,
      };
    }

    const payload = JSON.parse(raw);
    const state   = JSON.parse(payload.state);

    return {
      slotName,
      label:     labels[slotName] || slotName,
      timestamp: payload.timestamp,
      uniName:   state?.university?.name ?? '—',
      year:      state?.meta?.year ?? '—',
      turn:      state?.meta?.turn ?? '—',
      isEmpty:   false,
    };
  } catch (err) {
    console.warn(`[save] _readSlotMeta hatası (${slotName}):`, err);
    return {
      slotName,
      label:     labels[slotName] || slotName,
      timestamp: null,
      uniName:   null,
      year:      null,
      turn:      null,
      isEmpty:   true,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// KAYIT SİL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Belirtilen slottaki kaydı sil.
 * @param {string} slotName — Slot adı
 * @returns {boolean} Başarılı mı?
 */
export function deleteSave(slotName) {
  const key = slotName === 'autosave' ? AUTOSAVE_KEY : SAVE_PREFIX + slotName;
  try {
    if (!localStorage.getItem(key)) {
      console.log(`[save] deleteSave: ${slotName} zaten boş`);
      return false;
    }
    localStorage.removeItem(key);
    console.log(`[save] Kayıt silindi → ${slotName}`);
    return true;
  } catch (err) {
    console.error('[save] deleteSave hatası:', err);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DIŞA AKTAR (JSON İNDİR)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * State'i JSON dosyası olarak indir.
 * @param {object} state — Oyun durumu
 */
export function exportSave(state) {
  if (!state) {
    console.warn('[save] exportSave: geçersiz state');
    return;
  }
  try {
    const safeState = sanitizeForSave(state);
    const payload = {
      version:   SAVE_VERSION,
      timestamp: Date.now(),
      slotName:  'export',
      state:     JSON.stringify(safeState),
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);

    const uniName  = state?.university?.name?.replace(/\s+/g, '_') ?? 'universite';
    const datePart = new Date().toISOString().slice(0, 10);
    const filename = `university_tycoon_${uniName}_${datePart}.json`;

    const a = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
    console.log(`[save] Kayıt dışa aktarıldı → ${filename}`);
  } catch (err) {
    console.error('[save] exportSave hatası:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// İÇERİ AKTAR (JSON'DAN YÜKLE)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * JSON string'den state yükle (dosyadan içe aktarma).
 * @param {string} jsonString — Dışa aktarılan JSON içeriği
 * @returns {object|null} Oyun durumu veya null (hata)
 */
export function importSave(jsonString) {
  if (!jsonString) {
    console.warn('[save] importSave: boş JSON');
    return null;
  }
  try {
    const payload = JSON.parse(jsonString);

    // Temel doğrulama
    if (!payload.version || !payload.state) {
      console.error('[save] importSave: geçersiz kayıt formatı (version veya state eksik)');
      return null;
    }

    if (payload.version !== SAVE_VERSION) {
      console.warn(
        `[save] importSave: versiyon uyumsuzluğu (kayıt=${payload.version}, beklenen=${SAVE_VERSION}). ` +
        'Yükleme deneniyor...'
      );
    }

    const state = JSON.parse(payload.state);

    // State bütünlük kontrolü
    if (!state?.university || !state?.meta) {
      console.error('[save] importSave: state bütünlük kontrolü başarısız (university veya meta eksik)');
      return null;
    }

    console.log(
      `[save] Kayıt içe aktarıldı → ${state.university.name} ` +
      `(kayıt tarihi: ${new Date(payload.timestamp).toLocaleString('tr-TR')})`
    );
    return state;
  } catch (err) {
    console.error('[save] importSave hatası:', err);
    return null;
  }
}
