/**
 * Rektör Oldum — Ses Modülü (audio.js)
 * v0.3: Programatik ses efektleri ve ambient müzik (Web Audio API)
 * Harici dosya bağımlılığı yok — tüm sesler programatik olarak üretilir.
 */

let _audioCtx = null;
let _settings = { musicVol: 0.3, sfxVol: 0.6, muted: false };
let _musicGain = null;
let _musicInterval = null;
let _contextStarted = false;

// ─────────────────────────────────────────────────────────────────────────────
// BAŞLATMA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ses modülünü başlat.
 * AudioContext tarayıcı politikası gereği kullanıcı etkileşimi sonrası açılır.
 */
export function initAudio() {
  _loadSettings();
  // AudioContext'i kullanıcı etkileşimi sonrası başlat (browser autoplay policy)
  document.addEventListener('click', _ensureContext, { once: true });
  document.addEventListener('keydown', _ensureContext, { once: true });
}

function _ensureContext() {
  if (_contextStarted) return;
  _contextStarted = true;
  try {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Suspended context'i resume et (bazı tarayıcılarda gerekli)
    if (_audioCtx.state === 'suspended') {
      _audioCtx.resume().catch(() => {});
    }
  } catch (e) {
    console.warn('[audio] Web Audio API desteklenmiyor:', e);
    _audioCtx = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SES EFEKTLERİ (Programatik)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ses tanımları.
 * Her bir ID, bir üretici fonksiyonuna karşılık gelir.
 */
const SOUNDS = {
  // UI tıklama
  click:           () => _playTone({ freq: 800,  duration: 0.05,  type: 'sine',     fadeOut: 0.03 }),
  // Bina/yapı tamamlandı
  build_complete:  () => _playChord([523, 659, 784], 0.35, 'triangle'),
  // Rastgele olay popup
  event_popup:     () => _playSequence([440, 554, 659], 0.1, 'sine'),
  // Başarım açıldı
  achievement:     () => _playSequence([523, 659, 784, 1047], 0.14, 'triangle'),
  // Dönem/sömestr değişimi
  semester_change: () => _playSequence([392, 523, 659, 784], 0.12, 'sine'),
  // Hata
  error:           () => _playTone({ freq: 220,  duration: 0.35,  type: 'sawtooth', fadeOut: 0.25 }),
  // Genel başarı
  success:         () => _playSequence([523, 784], 0.13, 'sine'),
  // Bildirim
  notification:    () => _playTone({ freq: 600,  duration: 0.12,  type: 'sine',     fadeOut: 0.09 }),
  // Buton hover (çok sessiz)
  button_hover:    () => _playTone({ freq: 1000, duration: 0.025, type: 'sine',     fadeOut: 0.02,  volume: 0.08 }),
};

/**
 * Belirtilen sesi oynat.
 * @param {string} soundId — SOUNDS anahtarı
 */
export function playSound(soundId) {
  if (_settings.muted) return;
  if (!_audioCtx) return;
  if (_audioCtx.state === 'suspended') {
    _audioCtx.resume().catch(() => {});
  }
  const generator = SOUNDS[soundId];
  if (!generator) return;
  try {
    generator();
  } catch (e) {
    // Ses hatası sessizce geç
  }
}

/**
 * Tek frekanslı ses tonu üret.
 */
function _playTone({ freq, duration, type = 'sine', fadeOut = 0.1, volume = 1 }) {
  if (!_audioCtx) return;
  const osc  = _audioCtx.createOscillator();
  const gain = _audioCtx.createGain();

  osc.type           = type;
  osc.frequency.value = freq;
  gain.gain.value    = _settings.sfxVol * volume * 0.25;

  osc.connect(gain);
  gain.connect(_audioCtx.destination);

  const now = _audioCtx.currentTime;
  osc.start(now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.stop(now + duration + 0.02);
}

/**
 * Aynı anda birden fazla frekans çal (akor).
 */
function _playChord(freqs, duration, type = 'sine') {
  freqs.forEach(freq => _playTone({ freq, duration, type, volume: 0.6 }));
}

/**
 * Frekanları sırayla çal (melodik sıra).
 * @param {number[]} freqs    — Frekans listesi (Hz)
 * @param {number}   interval — Notalar arası süre (saniye)
 * @param {string}   type     — Osilator türü
 */
function _playSequence(freqs, interval, type = 'sine') {
  freqs.forEach((freq, i) => {
    setTimeout(
      () => _playTone({ freq, duration: interval * 1.6, type }),
      i * interval * 1000,
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// AMBİENT MÜZİK (Generative)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ambient müziği başlat.
 * 8 saniyede bir yeni bir akor pad çalar.
 */
export function startMusic() {
  if (_settings.muted) return;
  if (!_audioCtx) return;
  if (_musicInterval) return; // Zaten çalışıyor

  _musicGain = _audioCtx.createGain();
  _musicGain.gain.value = _settings.musicVol * 0.12;
  _musicGain.connect(_audioCtx.destination);

  _playAmbientPad();
  _musicInterval = setInterval(_playAmbientPad, 8000);
}

/**
 * Ambient müziği durdur.
 */
export function stopMusic() {
  if (_musicInterval) {
    clearInterval(_musicInterval);
    _musicInterval = null;
  }
  _musicGain = null;
}

/**
 * Tek bir ambient akor pad üret.
 * Rahatlatıcı majör/minör akorlar arasında rastgele seçim yapar.
 */
function _playAmbientPad() {
  if (!_audioCtx || !_musicGain) return;

  // C major, F major, G major, Am — üniversite teması için sakin, pozitif
  const chords = [
    [261, 329, 392],  // C maj
    [349, 440, 523],  // F maj
    [392, 493, 587],  // G maj
    [220, 261, 329],  // A min
    [293, 369, 440],  // D min
  ];

  const chord = chords[Math.floor(Math.random() * chords.length)];

  chord.forEach(freq => {
    if (!_audioCtx || !_musicGain) return;
    const osc  = _audioCtx.createOscillator();
    const gain = _audioCtx.createGain();

    osc.type            = 'sine';
    osc.frequency.value = freq;
    gain.gain.value     = 0;

    osc.connect(gain);
    gain.connect(_musicGain);

    const now = _audioCtx.currentTime;
    osc.start(now);
    // Fade in: 2 saniye
    gain.gain.linearRampToValueAtTime(_settings.musicVol * 0.08, now + 2);
    // Sustain
    gain.gain.linearRampToValueAtTime(_settings.musicVol * 0.06, now + 5);
    // Fade out: son 3 saniye
    gain.gain.linearRampToValueAtTime(0, now + 8);
    osc.stop(now + 8.1);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// AYARLAR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sessiz/sesli modunu değiştir.
 * @returns {boolean} — Yeni mute durumu (true = sessiz)
 */
export function toggleMute() {
  _settings.muted = !_settings.muted;
  if (_settings.muted) {
    stopMusic();
  }
  _saveSettings();
  return _settings.muted;
}

/**
 * Mevcut mute durumunu döndür.
 * @returns {boolean}
 */
export function isMuted() {
  return _settings.muted;
}

/**
 * Müzik sesini ayarla (0.0 – 1.0).
 * @param {number} vol
 */
export function setMusicVolume(vol) {
  _settings.musicVol = Math.max(0, Math.min(1, vol));
  if (_musicGain) {
    _musicGain.gain.value = _settings.musicVol * 0.12;
  }
  _saveSettings();
}

/**
 * Efekt sesini ayarla (0.0 – 1.0).
 * @param {number} vol
 */
export function setSFXVolume(vol) {
  _settings.sfxVol = Math.max(0, Math.min(1, vol));
  _saveSettings();
}

/**
 * Mevcut ses ayarlarını döndür.
 * @returns {{ musicVol: number, sfxVol: number, muted: boolean }}
 */
export function getAudioSettings() {
  return { ..._settings };
}

// ─────────────────────────────────────────────────────────────────────────────
// localStorage YARDIMCILARI
// ─────────────────────────────────────────────────────────────────────────────

function _saveSettings() {
  try {
    localStorage.setItem('rektor_audio_settings', JSON.stringify(_settings));
  } catch (e) { /* ignore */ }
}

function _loadSettings() {
  try {
    const raw = localStorage.getItem('rektor_audio_settings');
    if (raw) _settings = { ..._settings, ...JSON.parse(raw) };
  } catch (e) { /* ignore */ }
}
