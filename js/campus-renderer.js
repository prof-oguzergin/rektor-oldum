/**
 * Rektör Oldum — Kampüs Harita Çizici (campus-renderer.js)
 * İzometrik 2D kampüs görselleştirmesi — Canvas 2D API
 *
 * v0.4 — Mimari detay güncellemesi:
 *   - Her bina tipi için özel çatı, pencere, kapı, sembol
 *   - Gölge efekti
 *   - Gradyan duvar renkleri
 *   - Bina tipine özgü dekoratif unsurlar
 */

import { GRID_SIZE, BUILDING_FOOTPRINTS, PLAZA } from './campus-layout.js?v=0.5.0';
import { BUILDING_SPRITES, PROP_SPRITES } from './building-sprites.js?v=0.5.0';

// ─────────────────────────────────────────────────────────────────────────────
// SABİTLER
// ─────────────────────────────────────────────────────────────────────────────

const CANVAS_W = 960;   // dünya koordinatları (karo geometrisi bunlardan türer)
const CANVAS_H = 600;

// Fiziksel tuval (v0.5.0): dünya bir kamera dönüşümüyle bu boyuta ölçeklenir.
// Bütün çizim kodu dünya koordinatlarında kalır; kamera dolu bölgeye odaklanır.
const VIEW_W = 1600;
const VIEW_H = 1000;
const _cameras = new WeakMap();          // canvas -> { s, tx, ty }

// ── Sprite yükleyici (v0.5.0) ────────────────────────────────────────────────
const SPRITE_BASE = 'assets/buildings/';
const SPRITE_VER  = '0.5.0';
const _spriteCache   = {};               // anahtar -> { img, ok, failed }
const _liveCanvases  = new Map();        // canvas -> son çizilen state
let   _rerenderPending = false;

function _spriteEntry(key) {
  if (!key || !(BUILDING_SPRITES[key] || PROP_SPRITES[key])) return null;
  let e = _spriteCache[key];
  if (!e) {
    const img = new Image();
    e = _spriteCache[key] = { img, ok: false, failed: false };
    img.onload  = () => { e.ok = true; _rerenderLive(); };
    img.onerror = () => { e.failed = true; _rerenderLive(); };
    img.src = `${SPRITE_BASE}${key}.webp?v=${SPRITE_VER}`;
  }
  return e;
}

function _getSprite(key) {
  const e = _spriteEntry(key);
  return e && e.ok ? e.img : null;
}

/** 'hazir' | 'yukleniyor' | 'yok' (görsel tanımlı değil ya da yüklenemedi) */
function _spriteDurum(key) {
  const e = _spriteEntry(key);
  if (!e || e.failed) return 'yok';
  return e.ok ? 'hazir' : 'yukleniyor';
}

/** Görseller geç yüklenince açık haritaları yeniden çiz (ilk karede kutu görünür). */
function _rerenderLive() {
  if (_rerenderPending) return;
  _rerenderPending = true;
  requestAnimationFrame(() => {
    _rerenderPending = false;
    for (const [cv, st] of _liveCanvases) {
      if (!cv.isConnected) { _liveCanvases.delete(cv); continue; }
      renderCampusMap(cv, st);
    }
  });
}

/** Binanın o anki görsel anahtarı: inşaat aşaması, düzey görseli ya da düzeysiz görsel. */
function _spriteKeyFor(b) {
  if (!b.isCompleted) {
    const p = b.constructionProgress || 0;
    const asama = p < 34 ? 1 : p < 67 ? 2 : 3;
    if (BUILDING_SPRITES[`insaat_${asama}`]) return `insaat_${asama}`;
    return BUILDING_SPRITES.insaat ? 'insaat' : null;
  }
  // Düzey görseli yoksa (üst sınırı aşan eski kayıt) en yakın alt düzey kullanılır
  for (let l = Math.max(1, Math.floor(b.level || 1)); l >= 1; l--) {
    if (BUILDING_SPRITES[`${b.type}_${l}`]) return `${b.type}_${l}`;
  }
  return BUILDING_SPRITES[b.type] ? b.type : null;
}

/** Karo başına sabit sözde rastgele sayı [0, 1): her çizimde aynı sonuç */
function _hash(a, b) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

let _camS = 1;   // o anki kamera ölçeği (gölge ofsetleri dönüşümden etkilenmez)

// Tile boyutları ve başlangıç noktası — renderCampusMap tarafından güncellenir
// (Grid'in tüm canvas'a sığması için dinamik hesap)
let TILE_H = Math.floor((CANVAS_H - 120) / (GRID_SIZE - 1)); // 120px bina yüksekliği için boşluk
let TILE_W = TILE_H * 2;
let ORIGIN_X = CANVAS_W / 2;
let ORIGIN_Y = 60; // üstte bina yükseklikleri için boşluk

// Bina görsel stilleri — her tipin renk paleti ve meta verisi
const BUILDING_STYLES = {
  fakulte_binasi: {
    top: '#5a7aaa', left: '#3a5480', right: '#2a3e66',
    topLight: '#7a9acc', shadow: 'rgba(30,40,80,0.5)',
    height: 56, label: 'F',
    roofType: 'flat_antenna',    // Düz çatı + anten
    windowColor: '#ffe080',
    windowColorDark: '#c8b050',
  },
  arastirma_merkezi: {
    top: '#c0d8f0', left: '#90a8c0', right: '#6888a0',
    topLight: '#daeeff', shadow: 'rgba(60,80,120,0.4)',
    height: 50, label: 'A',
    roofType: 'dome',            // Kubbe
    windowColor: '#b0e8ff',
    windowColorDark: '#70b8e0',
  },
  lab_binasi: {
    top: '#4a9a6a', left: '#2a6a44', right: '#1a5030',
    topLight: '#6abf88', shadow: 'rgba(20,60,30,0.5)',
    height: 34, label: 'L',
    roofType: 'flat_satellite',  // Düz çatı + uydu çanağı
    windowColor: '#a0ffd0',
    windowColorDark: '#60c090',
  },
  kutuphane: {
    top: '#b08040', left: '#7a5830', right: '#5a4020',
    topLight: '#d0a060', shadow: 'rgba(60,30,10,0.5)',
    height: 46, label: 'K',
    roofType: 'arch',            // Kemer çatı
    windowColor: '#ffe8a0',
    windowColorDark: '#c0a040',
  },
  yurt: {
    top: '#e8a830', left: '#b07820', right: '#886010',
    topLight: '#ffc840', shadow: 'rgba(80,50,0,0.5)',
    height: 42, label: 'Y',
    roofType: 'flat_balcony',    // Düz çatı + balkon çizgileri
    windowColor: '#ffee88',
    windowColorDark: '#c8b040',
  },
  yemekhane: {
    top: '#d04848', left: '#a03030', right: '#802020',
    topLight: '#f06060', shadow: 'rgba(80,10,10,0.5)',
    height: 30, label: 'Ye',
    roofType: 'gabled_chimney',  // Beşik çatı + baca + duman
    windowColor: '#ffcc88',
    windowColorDark: '#d09050',
  },
  spor_tesisi: {
    top: '#50b050', left: '#308030', right: '#206020',
    topLight: '#70d070', shadow: 'rgba(10,50,10,0.5)',
    height: 22, label: 'S',
    roofType: 'barrel',          // Yarım silindir çatı
    windowColor: '#ccffcc',
    windowColorDark: '#80cc80',
  },
  konferans: {
    top: '#3a5888', left: '#203860', right: '#102848',
    topLight: '#5a78b8', shadow: 'rgba(10,20,60,0.5)',
    height: 46, label: 'Ko',
    roofType: 'angular',         // Modern açılı çatı
    windowColor: '#aac8ff',
    windowColorDark: '#6888cc',
  },
  amfi: {
    top: '#b0b0b0', left: '#808080', right: '#606060',
    topLight: '#d0d0d0', shadow: 'rgba(40,40,40,0.5)',
    height: 38, label: 'Am',
    roofType: 'tiered',          // Basamaklı yapı
    windowColor: '#ffffff',
    windowColorDark: '#c0c0c0',
  },
  teknokent: {
    top: '#3080c0', left: '#205898', right: '#184080',
    topLight: '#50a0e0', shadow: 'rgba(10,30,80,0.5)',
    height: 68, label: 'T',
    roofType: 'glass_modern',    // Cam kaplı modern cephe
    windowColor: '#88d8ff',
    windowColorDark: '#40a8e0',
  },
  // Eski key'leri koruyalım (lab → lab_binasi takma adı)
  lab: {
    top: '#4a9a6a', left: '#2a6a44', right: '#1a5030',
    topLight: '#6abf88', shadow: 'rgba(20,60,30,0.5)',
    height: 34, label: 'L',
    roofType: 'flat_satellite',
    windowColor: '#a0ffd0',
    windowColorDark: '#60c090',
  },
  spor_merkezi: {
    top: '#50b050', left: '#308030', right: '#206020',
    topLight: '#70d070', shadow: 'rgba(10,50,10,0.5)',
    height: 22, label: 'S',
    roofType: 'barrel',
    windowColor: '#ccffcc',
    windowColorDark: '#80cc80',
  },
  hastane: {
    top: '#e8e8e8', left: '#c0c0c0', right: '#a0a0a0',
    topLight: '#ffffff', shadow: 'rgba(40,40,60,0.4)',
    height: 52, label: 'H',
    roofType: 'flat_cross',      // Düz çatı + kırmızı hilal / helipad
    windowColor: '#ffffff',
    windowColorDark: '#cccccc',
  },
  idari_bina: {
    top: '#d4b060', left: '#a88040', right: '#805820',
    topLight: '#f0d080', shadow: 'rgba(60,40,0,0.5)',
    height: 54, label: 'İ',
    roofType: 'classical',       // Klasik sütunlu giriş
    windowColor: '#fffaaa',
    windowColorDark: '#c8c070',
  },
  saglik_merkezi: {
    top: '#e8e8e8', left: '#c0c0c0', right: '#a0a0a0',
    topLight: '#ffffff', shadow: 'rgba(40,40,60,0.4)',
    height: 44, label: 'Sa',
    roofType: 'flat_cross',      // Düz çatı + kırmızı hilal
    windowColor: '#ffffff',
    windowColorDark: '#cccccc',
  },
  ulasim_merkezi: {
    top: '#607D8B', left: '#455A64', right: '#37474F',
    topLight: '#90A4AE', shadow: 'rgba(38,50,56,0.5)',
    height: 25, label: 'U',
    roofType: 'flat',            // Düz çatı (otobüs durağı)
    windowColor: '#B0BEC5',
    windowColorDark: '#78909C',
    color: '#607D8B',
    topColor: '#78909C',
    shadow: '#455A64',
  },
};

// Zemin renkleri
const COLORS = {
  grass: '#5b7a31',
  grassLight: '#628236',
  grassStroke: '#51702b',
  path: '#d7bf97',
  pathStroke: '#a88d62',
  plaza: '#e2cca6',
  soilLeft: '#6b5234',
  soilRight: '#53402a',
  water: '#2060a0',
  waterLight: '#3080c0',
  treeCanopy: '#2a7a3a',
  treeCanopyLight: '#3a9a4a',
  treeTrunk: '#5a3a1a',
  constructionOverlay: 'rgba(255, 200, 50, 0.35)',
  scaffold: '#aa8830',
  selectionGlow: 'rgba(100, 200, 255, 0.5)',
  hoverGlow: 'rgba(255, 255, 255, 0.15)',
};

// ─────────────────────────────────────────────────────────────────────────────
// MODÜL STATE
// ─────────────────────────────────────────────────────────────────────────────

let _hoveredTile = null;   // { col, row }
let _selectedBuilding = null;

// ─────────────────────────────────────────────────────────────────────────────
// İZOMETRİK PROJEKSİYON
// ─────────────────────────────────────────────────────────────────────────────

function isoProject(col, row) {
  return {
    x: ORIGIN_X + (col - row) * (TILE_W / 2),
    y: ORIGIN_Y + (col + row) * (TILE_H / 2),
  };
}

function isoUnproject(px, py, canvas) {
  // CSS ölçekleme düzeltmesi
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const cam = _cameras.get(canvas) || { s: 1, tx: 0, ty: 0 };
  const cx = (px * scaleX - cam.tx) / cam.s;
  const cy = (py * scaleY - cam.ty) / cam.s;

  const relX = cx - ORIGIN_X;
  const relY = cy - ORIGIN_Y;
  const col = Math.floor((relX / (TILE_W / 2) + relY / (TILE_H / 2)) / 2);
  const row = Math.floor((relY / (TILE_H / 2) - relX / (TILE_W / 2)) / 2);
  return { col, row };
}

// ─────────────────────────────────────────────────────────────────────────────
// ÇİZİM: TEMEL ŞEKİLLER
// ─────────────────────────────────────────────────────────────────────────────

/** İzometrik elmas (zemin tile) */
function drawIsoDiamond(ctx, x, y, w, h, fillColor, strokeColor) {
  const hw = w / 2;
  const hh = h / 2;
  ctx.beginPath();
  ctx.moveTo(x, y - hh);
  ctx.lineTo(x + hw, y);
  ctx.lineTo(x, y + hh);
  ctx.lineTo(x - hw, y);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
}

/** İzometrik kutu (3D bina gövdesi) — tek tile */
function drawIsoBox(ctx, x, y, tileW, tileH, height, topColor, leftColor, rightColor) {
  const hw = tileW / 2;
  const hh = tileH / 2;

  // Üst yüz
  ctx.beginPath();
  ctx.moveTo(x, y - hh - height);
  ctx.lineTo(x + hw, y - height);
  ctx.lineTo(x, y + hh - height);
  ctx.lineTo(x - hw, y - height);
  ctx.closePath();
  ctx.fillStyle = topColor;
  ctx.fill();

  // Sol duvar
  ctx.beginPath();
  ctx.moveTo(x - hw, y - height);
  ctx.lineTo(x, y + hh - height);
  ctx.lineTo(x, y + hh);
  ctx.lineTo(x - hw, y);
  ctx.closePath();
  ctx.fillStyle = leftColor;
  ctx.fill();

  // Sağ duvar
  ctx.beginPath();
  ctx.moveTo(x + hw, y - height);
  ctx.lineTo(x, y + hh - height);
  ctx.lineTo(x, y + hh);
  ctx.lineTo(x + hw, y);
  ctx.closePath();
  ctx.fillStyle = rightColor;
  ctx.fill();
}

// ─────────────────────────────────────────────────────────────────────────────
// ÇİZİM: DEKORASYONLAR
// ─────────────────────────────────────────────────────────────────────────────

// Çim tonları: karo karo hafif değişir, ızgara çizgisi yok (v0.5.0)
const GRASS_TONES = ['#5a7930', '#5f7f34', '#57752e', '#648538', '#5c7b33', '#61803a'];

function drawGrassTile(ctx, col, row) {
  const { x, y } = isoProject(col, row);
  const ton = GRASS_TONES[Math.floor(_hash(col, row) * GRASS_TONES.length)];
  // Karo sınırında ince açıklık kalmasın diye elmas biraz büyütülür
  drawIsoDiamond(ctx, x, y + TILE_H / 2, TILE_W + 1, TILE_H + 0.5, ton, null);
}

/** Taş döşeli yol ya da meydan karosu; yalnız yol olmayan komşuya bakan kenara bordür çizilir. */
function drawPathTile(ctx, col, row, grid, renk = COLORS.path) {
  const { x, y } = isoProject(col, row);
  const cy = y + TILE_H / 2;
  const hw = TILE_W / 2, hh = TILE_H / 2;
  drawIsoDiamond(ctx, x, cy, TILE_W + 1, TILE_H + 0.5, renk, null);
  if (!grid) return;
  const yolMu = (c, r) => { const t = grid[r] && grid[r][c]; return t === 'path' || t === 'plaza'; };
  ctx.strokeStyle = COLORS.pathStroke;
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (!yolMu(col, row - 1)) { ctx.moveTo(x, cy - hh); ctx.lineTo(x + hw, cy); }
  if (!yolMu(col + 1, row)) { ctx.moveTo(x + hw, cy); ctx.lineTo(x, cy + hh); }
  if (!yolMu(col, row + 1)) { ctx.moveTo(x, cy + hh); ctx.lineTo(x - hw, cy); }
  if (!yolMu(col - 1, row)) { ctx.moveTo(x - hw, cy); ctx.lineTo(x, cy - hh); }
  ctx.stroke();
}

// ── Ağaç ve süsleme görselleri (v0.5.0) ─────────────────────────────────────
// Yükseklikler dünya pikseli: 2x2 bir binanın zemin plakası 80 piksel genişliktedir.
const PROP_YUKSEKLIK = {
  agac_yesil: 24, agac_sonbahar: 24, agac_bahar: 23, agac_selvi: 30, agac_cam: 28,
  lamba: 16, bank: 7, cicek: 6, calilik: 10, bisiklet: 8, heykel: 14,
  cardak: 19, ogrenciler: 8, bufe: 14, araba: 8,
};
const AGAC_OLAGAN = ['agac_yesil', 'agac_yesil', 'agac_yesil', 'agac_selvi', 'agac_cam'];
// Karo içinde ağaç kümesi yerleşimi (karo ortasına göre, dünya pikseli)
const AGAC_KUME = [
  [[0, 0]],
  [[-6, -1], [6, 2]],
  [[0, -4], [-8, 2], [8, 3]],
];

function _agacAnahtari(col, row, i, mevsim) {
  const h = _hash(col * 7 + i, row * 13 + i * 3);
  if (mevsim === 'güz' && h < 0.45) return 'agac_sonbahar';
  if (mevsim === 'bahar' && h < 0.28) return 'agac_bahar';
  return AGAC_OLAGAN[Math.floor(_hash(col + 11 * i, row + 5) * AGAC_OLAGAN.length)];
}

/** Süsleme görselini dayanak noktası (en alt orta) verilen yere oturtur; hafif gölge ekler. */
function _drawPropAt(ctx, key, px, py, olcek = 1, ayna = false) {
  const img = _getSprite(key);
  const m = PROP_SPRITES[key];
  if (!img || !m) return false;
  const hedefH = (PROP_YUKSEKLIK[key] || 12) * olcek;
  const k = hedefH / Math.max(1, m.ay - m.top + 1);
  const gen = (m.R - m.L + 1) * k;
  ctx.fillStyle = 'rgba(25, 35, 10, 0.28)';
  ctx.beginPath();
  ctx.ellipse(px + gen * 0.08, py, gen * 0.42, gen * 0.17, 0, 0, Math.PI * 2);
  ctx.fill();
  if (ayna) {
    ctx.save();
    ctx.translate(px, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, -m.ax * k, py - m.ay * k, m.w * k, m.h * k);
    ctx.restore();
  } else {
    ctx.drawImage(img, px - m.ax * k, py - m.ay * k, m.w * k, m.h * k);
  }
  return true;
}

function drawTree(ctx, col, row, mevsim) {
  const { x, y } = isoProject(col, row);
  const cy = y + TILE_H / 2;
  const kume = AGAC_KUME[Math.floor(_hash(col + 3, row + 9) * AGAC_KUME.length)];
  let cizildi = false;
  kume.forEach(([ox, oy], i) => {
    const olcek = 0.85 + 0.3 * _hash(col * 5 + i, row * 3 + i);
    const ayna = _hash(col + i, row * 2 + i) < 0.5;
    if (_drawPropAt(ctx, _agacAnahtari(col, row, i, mevsim), x + ox, cy + oy, olcek, ayna)) cizildi = true;
  });
  if (cizildi) return;

  // Görsel henüz yüklenmediyse basit ağaç
  ctx.fillStyle = COLORS.treeTrunk;
  ctx.fillRect(x - 1.5, cy - 12, 3, 10);
  ctx.beginPath();
  ctx.arc(x, cy - 16, 7, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.treeCanopy;
  ctx.fill();
}

function drawProp(ctx, dec) {
  const { x, y } = isoProject(dec.col, dec.row);
  const ayna = _hash(dec.col * 3, dec.row * 5) < 0.5;
  _drawPropAt(ctx, dec.key, x, y + TILE_H / 2 + 2, 1, ayna);
}

/** Meydan görseli 3x3 alana oturur (görsel yoksa taş döşeme yeterli). */
function drawPlaza(ctx, dec) {
  const img = _getSprite('meydan');
  const m = BUILDING_SPRITES.meydan;
  if (!img || !m) return;
  const w = dec.w || 3, h = dec.h || 3;
  const { x } = isoProject(dec.col + w / 2, dec.row + h / 2);
  const baseY = isoProject(dec.col + w, dec.row + h).y;
  const fpW = (w + h) * TILE_W / 2 * 0.98;
  const k = fpW / Math.max(1, m.padR - m.padL + 1);
  ctx.drawImage(img, x - ((m.padL + m.padR) / 2) * k, baseY - m.padB * k, m.w * k, m.h * k);
}

function drawFountain(ctx, col, row) {
  // 2x2 alan — merkez noktası
  const { x, y } = isoProject(col + 1, row + 1);
  const baseY = y;

  // Zemin havuz
  drawIsoDiamond(ctx, x, baseY, TILE_W * 1.5, TILE_H * 1.5, COLORS.water, '#1a5090');

  // İç su
  drawIsoDiamond(ctx, x, baseY, TILE_W, TILE_H, COLORS.waterLight, null);

  // Merkez sütun
  ctx.fillStyle = '#c0c0c0';
  ctx.fillRect(x - 3, baseY - 24, 6, 20);

  // Su efekti (basit damlacıklar)
  ctx.fillStyle = COLORS.waterLight;
  ctx.beginPath();
  ctx.arc(x, baseY - 26, 5, 0, Math.PI * 2);
  ctx.fill();

  // Etiket
  ctx.fillStyle = '#ffffff';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⛲', x, baseY - 30);
}

// ─────────────────────────────────────────────────────────────────────────────
// ÇİZİM: BİNA DETAY YARDIMCI FONKSİYONLARI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sol duvar üzerinde izometrik pencere ızgarası çizer.
 * @param {number} rows - Pencere satır sayısı
 * @param {number} cols - Pencere sütun sayısı
 * @param {string} litColor - Aydınlık pencere rengi
 * @param {string} darkColor - Kapalı pencere rengi
 */
function _drawWindowsLeft(ctx, x, baseY, hw, hh, height, rows, cols, litColor, darkColor) {
  // Sol yüz paralel kenargeninin x/y koordinatlarını hesapla
  // Sol duvar köşeleri: sol-üst=(-hw, -height), sol-alt=(-hw, 0),
  //                    merkez-üst=(0, hh-height), merkez-alt=(0, hh)
  // Pencere başlangıç marjı
  const marginX = hw * 0.15;
  const marginY = height * 0.12;
  const cellW = (hw - marginX * 2) / cols;
  const cellH = (height - marginY * 2) / rows;
  const winW = cellW * 0.55;
  const winH = cellH * 0.55;

  // Sol duvarın izometrik eğimi: x gidikçe y düşer
  // Skew faktörü: sol duvar sol(-hw,0) → merkez(0,hh) arasında
  const skewPerX = hh / hw; // y değişimi / x değişimi

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Duvar düzleminde sol üstten itibaren konum
      const wallX = marginX + c * cellW + cellW * 0.2;
      const wallY = marginY + r * cellH + cellH * 0.2;

      // İzometrik dönüşüm (sol duvar: x ekseni sola yatık)
      // Duvar başlangıcı: (x - hw, baseY - height)
      // Sola doğru ilerledikçe y artar (skew)
      const screenX = x - hw + wallX;
      const screenY = baseY - height + wallY + wallX * skewPerX;

      // Pencerenin 4 köşesi (paralel kenargen)
      const x0 = screenX;
      const y0 = screenY;
      const x1 = screenX + winW;
      const y1 = screenY + winW * skewPerX;
      const x2 = x1;
      const y2 = y1 + winH;
      const x3 = x0;
      const y3 = y0 + winH;

      // Bazı pencereleri rastgelecesine karanlık yap (desen: r+c çift → açık)
      const isLit = (r + c) % 3 !== 2;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.closePath();
      ctx.fillStyle = isLit ? litColor : darkColor;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }
}

/**
 * Sağ duvar üzerinde izometrik pencere ızgarası çizer.
 */
function _drawWindowsRight(ctx, x, baseY, hw, hh, height, rows, cols, litColor, darkColor) {
  const marginX = hw * 0.15;
  const marginY = height * 0.12;
  const cellW = (hw - marginX * 2) / cols;
  const cellH = (height - marginY * 2) / rows;
  const winW = cellW * 0.55;
  const winH = cellH * 0.55;

  // Sağ duvarın skew'si: sağdan merkeze giderken y artar
  const skewPerX = hh / hw;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wallX = marginX + c * cellW + cellW * 0.2;
      const wallY = marginY + r * cellH + cellH * 0.2;

      // Sağ duvar: başlangıç (x, hh-height) → (x+hw, -height)
      // Sağa doğru ilerledikçe y azalır
      const screenX = x + wallX;
      const screenY = baseY - height + hh + wallY - wallX * skewPerX;

      const x0 = screenX;
      const y0 = screenY;
      const x1 = screenX + winW;
      const y1 = screenY - winW * skewPerX;
      const x2 = x1;
      const y2 = y1 + winH;
      const x3 = x0;
      const y3 = y0 + winH;

      const isLit = (r + c + 1) % 3 !== 2;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.closePath();
      ctx.fillStyle = isLit ? litColor : darkColor;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }
}

/**
 * Ön-merkez kapı girişi çizer (sol duvar alt ortasında).
 * @param {string} archColor - Kemer/kapı rengi
 */
function _drawEntrance(ctx, x, baseY, hw, hh, height, archColor) {
  // Kapı konumu: sol duvarın alt orta kısmı
  const skewPerX = hh / hw;
  const doorW = hw * 0.22;
  const doorH = height * 0.28;

  // Kapı merkezi sol duvar orta-alt bölgesi
  const doorCenterWallX = hw * 0.45;
  const doorTopWallY = height - doorH - height * 0.05;

  const dx = x - hw + doorCenterWallX;
  const dy = baseY - height + doorTopWallY + doorCenterWallX * skewPerX;

  // Kapı çerçevesi (paralel kenargen)
  const x0 = dx - doorW / 2;
  const y0 = dy;
  const x1 = dx + doorW / 2;
  const y1 = dy + (doorW) * skewPerX;
  const x2 = x1;
  const y2 = y1 + doorH;
  const x3 = x0;
  const y3 = y0 + doorH;

  // Kapı arkaplanı (koyu)
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.closePath();
  ctx.fillStyle = 'rgba(10,10,20,0.85)';
  ctx.fill();

  // Kapı çerçevesi
  ctx.strokeStyle = archColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Kapı kemer üstü (yarım elips)
  const kemMidX = (x0 + x1) / 2;
  const kemMidY = (y0 + y1) / 2;
  ctx.beginPath();
  ctx.ellipse(kemMidX, kemMidY, doorW / 2, doorH * 0.15, 0, Math.PI, 0);
  ctx.fillStyle = archColor;
  ctx.fill();
}

/**
 * Düz çatı + anten (fakulte_binasi).
 */
function _drawRoofFlatAntenna(ctx, x, topY, hw, hh) {
  // Çatı kenar profili (ince kenarlık)
  ctx.beginPath();
  ctx.moveTo(x, topY - hh - 3);
  ctx.lineTo(x + hw, topY - 3);
  ctx.lineTo(x, topY + hh - 3);
  ctx.lineTo(x - hw, topY - 3);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Anten dirseği
  const antX = x + hw * 0.2;
  const antBaseY = topY - hh * 0.3;
  ctx.strokeStyle = '#d0d8e8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(antX, antBaseY);
  ctx.lineTo(antX, antBaseY - 14);
  ctx.stroke();

  // Anten yatay çubuğu
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(antX - 5, antBaseY - 10);
  ctx.lineTo(antX + 5, antBaseY - 10);
  ctx.moveTo(antX - 3, antBaseY - 13);
  ctx.lineTo(antX + 3, antBaseY - 13);
  ctx.stroke();

  // Anten ucu (kırmızı yanıp-sönen nokta simülasyonu)
  ctx.beginPath();
  ctx.arc(antX, antBaseY - 14, 1.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ff4040';
  ctx.fill();

  // Çatı üzeri havalandırma kutusu
  ctx.fillStyle = '#707888';
  ctx.fillRect(x - hw * 0.3 - 5, topY - hh * 0.2 - 4, 10, 5);
}

/**
 * Kubbe çatı (arastirma_merkezi).
 */
function _drawRoofDome(ctx, x, topY, hw, hh) {
  // Kubbe tabanı elips
  ctx.beginPath();
  ctx.ellipse(x, topY - 2, hw * 0.45, hh * 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#d8e8f8';
  ctx.fill();
  ctx.strokeStyle = '#90a8c0';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Kubbe üst yarım daire (3D görünüm)
  ctx.beginPath();
  ctx.ellipse(x, topY - 2, hw * 0.45, hh * 0.5, 0, Math.PI, 0);
  ctx.fillStyle = '#eef8ff';
  ctx.fill();

  // Kubbe ışık çizgisi (sağ taraf)
  ctx.beginPath();
  ctx.ellipse(x + hw * 0.1, topY - 2, hw * 0.18, hh * 0.22, 0.3, Math.PI, 0);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Tepe ucu sivri nokta
  ctx.beginPath();
  ctx.moveTo(x, topY - hh * 0.5 - 2);
  ctx.lineTo(x - 2, topY - hh * 0.5 + 4);
  ctx.lineTo(x + 2, topY - hh * 0.5 + 4);
  ctx.closePath();
  ctx.fillStyle = '#c0d0e0';
  ctx.fill();
}

/**
 * Düz çatı + uydu çanağı (lab_binasi).
 */
function _drawRoofFlatSatellite(ctx, x, topY, hw, hh) {
  // Düz çatı kenarlığı
  ctx.beginPath();
  ctx.moveTo(x, topY - hh - 2);
  ctx.lineTo(x + hw, topY - 2);
  ctx.lineTo(x, topY + hh - 2);
  ctx.lineTo(x - hw, topY - 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Uydu çanağı tabanı
  const satX = x - hw * 0.25;
  const satY = topY - hh * 0.1;
  ctx.fillStyle = '#909898';
  ctx.fillRect(satX - 1, satY - 8, 2, 8);

  // Uydu çanağı (elips kesik)
  ctx.beginPath();
  ctx.ellipse(satX, satY - 8, 7, 4, -0.4, Math.PI, 0);
  ctx.fillStyle = '#c8d8d8';
  ctx.fill();
  ctx.strokeStyle = '#708080';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Hava kondisyoner üniteleri
  for (let i = 0; i < 2; i++) {
    const acX = x + hw * 0.1 + i * 12;
    const acY = topY - hh * 0.15;
    ctx.fillStyle = '#888898';
    ctx.fillRect(acX, acY - 3, 9, 4);
    ctx.fillStyle = '#aababb';
    ctx.fillRect(acX + 1, acY - 2, 7, 1);
  }
}

/**
 * Kemer / kırma çatı (kutuphane).
 */
function _drawRoofArch(ctx, x, topY, hw, hh) {
  // Kemer üçgen gövde (sol yüz)
  ctx.beginPath();
  ctx.moveTo(x - hw, topY - 2);
  ctx.lineTo(x, topY - hh - 14);
  ctx.lineTo(x, topY + hh - 2);
  ctx.closePath();
  ctx.fillStyle = '#8a6030';
  ctx.fill();
  ctx.strokeStyle = '#5a3010';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Kemer üçgen gövde (sağ yüz)
  ctx.beginPath();
  ctx.moveTo(x + hw, topY - 2);
  ctx.lineTo(x, topY - hh - 14);
  ctx.lineTo(x, topY + hh - 2);
  ctx.closePath();
  ctx.fillStyle = '#6a4820';
  ctx.fill();
  ctx.strokeStyle = '#3a2808';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Tepe çizgisi (silüet)
  ctx.strokeStyle = '#c09060';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - hw, topY - 2);
  ctx.lineTo(x, topY - hh - 14);
  ctx.lineTo(x + hw, topY - 2);
  ctx.stroke();

  // Kitap sembolü — ön yüz ortasına
  ctx.fillStyle = '#f0d890';
  ctx.font = 'bold 12px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('📚', x - hw * 0.35, topY + hh * 0.2);
}

/**
 * Düz çatı + balkon çizgileri (yurt).
 */
function _drawRoofFlatBalcony(ctx, x, topY, hw, hh) {
  // Çatı kenarlığı (hafif yükseltilmiş parapet)
  ctx.beginPath();
  ctx.moveTo(x, topY - hh - 4);
  ctx.lineTo(x + hw, topY - 4);
  ctx.lineTo(x, topY + hh - 4);
  ctx.lineTo(x - hw, topY - 4);
  ctx.closePath();
  ctx.fillStyle = '#c89020';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Çatı üzeri balkon korkulukları (sol yüz)
  const skewPerX = hh / hw;
  const numRails = 4;
  for (let i = 0; i <= numRails; i++) {
    const railX = x - hw + (hw * i / numRails);
    const railY = topY - 4 + (hw * i / numRails) * skewPerX;
    ctx.strokeStyle = '#f0c040';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(railX, railY);
    ctx.lineTo(railX, railY - 5);
    ctx.stroke();
  }
  // Yatay korkuluk çubuğu
  ctx.strokeStyle = '#f0c040';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x - hw, topY - 4 - 5);
  ctx.lineTo(x, topY - 4 + hh * skewPerX - 5);
  ctx.stroke();

  // Su deposu (küçük silindir)
  ctx.fillStyle = '#d0a820';
  ctx.fillRect(x + hw * 0.3 - 4, topY - hh * 0.4 - 8, 8, 6);
  ctx.beginPath();
  ctx.ellipse(x + hw * 0.3, topY - hh * 0.4 - 8, 4, 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#f0c840';
  ctx.fill();
}

/**
 * Beşik çatı + baca + duman animasyonu (yemekhane).
 */
function _drawRoofGabledChimney(ctx, x, topY, hw, hh) {
  // Beşik çatı sol yüz
  ctx.beginPath();
  ctx.moveTo(x - hw, topY);
  ctx.lineTo(x, topY - hh - 10);
  ctx.lineTo(x, topY + hh);
  ctx.closePath();
  ctx.fillStyle = '#883030';
  ctx.fill();
  ctx.strokeStyle = '#601818';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Beşik çatı sağ yüz
  ctx.beginPath();
  ctx.moveTo(x + hw, topY);
  ctx.lineTo(x, topY - hh - 10);
  ctx.lineTo(x, topY + hh);
  ctx.closePath();
  ctx.fillStyle = '#661818';
  ctx.fill();
  ctx.strokeStyle = '#440808';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Tepe sırtı
  ctx.strokeStyle = '#c05050';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - hw, topY);
  ctx.lineTo(x, topY - hh - 10);
  ctx.lineTo(x + hw, topY);
  ctx.stroke();

  // Baca (tuğla)
  const chX = x + hw * 0.25;
  const chTopY = topY - hh * 0.5 - 16;
  ctx.fillStyle = '#804040';
  ctx.fillRect(chX - 4, chTopY, 8, 14);
  // Baca üst kapağı
  ctx.fillStyle = '#906050';
  ctx.fillRect(chX - 5, chTopY - 2, 10, 3);

  // Duman (3 daire, beyazdan saydama)
  const smokeOffsets = [0, 3, 6];
  smokeOffsets.forEach((off, i) => {
    const alpha = 0.4 - i * 0.12;
    const sr = 3 + i * 2;
    ctx.beginPath();
    ctx.arc(chX + off * 0.5, chTopY - 5 - i * 6, sr, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(220,210,200,${alpha})`;
    ctx.fill();
  });
}

/**
 * Yarım silindir / beşik çatı (spor_tesisi / spor_merkezi).
 */
function _drawRoofBarrel(ctx, x, topY, hw, hh) {
  // Silindir çatı gövdesi (elips üst)
  ctx.beginPath();
  ctx.ellipse(x, topY - 4, hw * 0.85, hh * 0.6, 0, Math.PI, 0);
  ctx.fillStyle = '#50a050';
  ctx.fill();
  ctx.strokeStyle = '#308040';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Silindir ön kenarı (oval dilim)
  ctx.beginPath();
  ctx.ellipse(x, topY - 4, hw * 0.85, hh * 0.6, 0, 0, Math.PI);
  ctx.fillStyle = '#408030';
  ctx.fill();

  // Kaburga çizgileri (spor salonu estetiği)
  for (let i = -2; i <= 2; i++) {
    const ribX = x + i * hw * 0.22;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ribX, topY - 4);
    ctx.lineTo(ribX, topY - 4 - hh * 0.5);
    ctx.stroke();
  }

  // Spor ikonu
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🏃', x, topY + hh * 0.3);
}

/**
 * Modern açılı çatı (konferans salonu).
 */
function _drawRoofAngular(ctx, x, topY, hw, hh) {
  // Asimetrik üçgen çatı — sola yatık
  ctx.beginPath();
  ctx.moveTo(x - hw, topY);
  ctx.lineTo(x + hw * 0.4, topY - hh - 8);
  ctx.lineTo(x + hw, topY);
  ctx.lineTo(x, topY + hh);
  ctx.closePath();
  ctx.fillStyle = '#4060a0';
  ctx.fill();
  ctx.strokeStyle = '#284080';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Çatı yüzeyi ikinci katman (vurgu)
  ctx.beginPath();
  ctx.moveTo(x - hw, topY);
  ctx.lineTo(x + hw * 0.4, topY - hh - 8);
  ctx.lineTo(x, topY - hh * 0.6);
  ctx.closePath();
  ctx.fillStyle = 'rgba(120,160,255,0.2)';
  ctx.fill();

  // Bayrak direği
  const flagX = x + hw * 0.4;
  const flagBaseY = topY - hh - 8;
  ctx.strokeStyle = '#c0c8d8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(flagX, flagBaseY);
  ctx.lineTo(flagX, flagBaseY - 12);
  ctx.stroke();

  // Bayrak bezi (kırmızı-beyaz)
  ctx.fillStyle = '#e02020';
  ctx.fillRect(flagX, flagBaseY - 12, 8, 4);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(flagX, flagBaseY - 8, 8, 2);
}

/**
 * Basamaklı yapı (amfi tiyatro).
 */
function _drawRoofTiered(ctx, x, topY, hw, hh) {
  // 3 kademe basamaklı çatı
  const tiers = 3;
  for (let t = tiers; t >= 1; t--) {
    const ratio = t / tiers;
    const tierHW = hw * ratio;
    const tierHH = hh * ratio;
    const tierY = topY - (tiers - t) * 5;

    ctx.beginPath();
    ctx.moveTo(x, tierY - tierHH - 2);
    ctx.lineTo(x + tierHW, tierY - 2);
    ctx.lineTo(x, tierY + tierHH - 2);
    ctx.lineTo(x - tierHW, tierY - 2);
    ctx.closePath();
    const shade = Math.round(100 + t * 30);
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
}

/**
 * Cam kaplı modern cephe (teknokent).
 */
function _drawRoofGlassModern(ctx, x, topY, hw, hh) {
  // Düz çatı + cam balustrade
  ctx.beginPath();
  ctx.moveTo(x, topY - hh - 4);
  ctx.lineTo(x + hw, topY - 4);
  ctx.lineTo(x, topY + hh - 4);
  ctx.lineTo(x - hw, topY - 4);
  ctx.closePath();
  ctx.fillStyle = '#2060a0';
  ctx.fill();
  ctx.strokeStyle = '#88ccff';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Cam yansıma çizgileri (çatı üstü)
  for (let i = 0; i < 4; i++) {
    const gx = x - hw * 0.8 + i * hw * 0.45;
    ctx.strokeStyle = 'rgba(150,220,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(gx, topY - 2);
    ctx.lineTo(gx + hw * 0.1, topY - hh * 0.3 - 2);
    ctx.stroke();
  }

  // Çatı üzeri LED şerit ışık simülasyonu
  ctx.strokeStyle = 'rgba(80,180,255,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - hw + 2, topY - 5);
  ctx.lineTo(x, topY - hh - 1);
  ctx.lineTo(x + hw - 2, topY - 5);
  ctx.stroke();
}

/**
 * Düz çatı + kırmızı hilal / helipad (sağlık merkezi — Kızılay sembolü).
 */
function _drawRoofFlatCross(ctx, x, topY, hw, hh) {
  // Çatı yüzeyi
  ctx.beginPath();
  ctx.moveTo(x, topY - hh - 3);
  ctx.lineTo(x + hw, topY - 3);
  ctx.lineTo(x, topY + hh - 3);
  ctx.lineTo(x - hw, topY - 3);
  ctx.closePath();
  ctx.fillStyle = '#e8e8e8';
  ctx.fill();
  ctx.strokeStyle = '#c0c0c0';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Kırmızı hilal (Kızılay sembolü — çatı ortasında)
  const r = Math.min(hw, hh) * 0.4;
  const cx = x;
  const cy = topY - 3;

  ctx.fillStyle = '#e02020';
  // Dış daire (hilal gövdesi)
  ctx.beginPath();
  ctx.arc(cx - r * 0.1, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // İç daire (hilal boşluğu — sağa kaydırılmış, daha belirgin hilal)
  ctx.fillStyle = '#e8e8e8'; // çatı rengiyle aynı
  ctx.beginPath();
  ctx.arc(cx + r * 0.45, cy, r * 0.8, 0, Math.PI * 2);
  ctx.fill();
  // Hilalin uçlarına küçük yıldız (Kızılay tarzı)
  ctx.fillStyle = '#e02020';
  ctx.beginPath();
  ctx.arc(cx + r * 0.15, cy - r * 0.15, r * 0.08, 0, Math.PI * 2);
  ctx.fill();

  // Helipad çemberi
  ctx.beginPath();
  ctx.arc(x + hw * 0.5, topY - hh * 0.2, 6, 0, Math.PI * 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#e02020';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 6px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('H', x + hw * 0.5, topY - hh * 0.2);
}

/**
 * Klasik sütunlu giriş (idari_bina).
 */
function _drawRoofClassical(ctx, x, topY, hw, hh) {
  // Üçgen alın duvarı (pediment)
  ctx.beginPath();
  ctx.moveTo(x - hw * 0.6, topY);
  ctx.lineTo(x, topY - hh * 0.5 - 8);
  ctx.lineTo(x + hw * 0.6, topY);
  ctx.closePath();
  ctx.fillStyle = '#e8d880';
  ctx.fill();
  ctx.strokeStyle = '#c0a040';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Sütunlar (sol yüz)
  const skewPerX = hh / hw;
  const numCols = 3;
  for (let c = 0; c < numCols; c++) {
    const colWallX = hw * 0.15 + c * (hw * 0.25);
    const colScreenX = x - hw + colWallX;
    const colScreenY = topY + colWallX * skewPerX;

    // Sütun gövdesi
    ctx.strokeStyle = '#f0e090';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(colScreenX, colScreenY);
    ctx.lineTo(colScreenX, colScreenY - hh * 0.8);
    ctx.stroke();

    // Sütun başlığı (kapitel)
    ctx.fillStyle = '#f0e090';
    ctx.fillRect(colScreenX - 2, colScreenY - hh * 0.8 - 2, 4, 3);
  }

  // Bayrak direği ve bayrak
  ctx.strokeStyle = '#c0b060';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, topY - hh * 0.5 - 8);
  ctx.lineTo(x, topY - hh * 0.5 - 20);
  ctx.stroke();

  ctx.fillStyle = '#c03020';
  ctx.fillRect(x, topY - hh * 0.5 - 20, 9, 5);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, topY - hh * 0.5 - 15, 9, 2);
}

/**
 * Bina gövdesine gradyan renk uygular (sol ve sağ duvar).
 * Canvas 2D linearGradient kullanır.
 */
function _applyWallGradient(ctx, x, baseY, hw, hh, height, leftColor, rightColor, topLight) {
  // Sol duvar gradyanı
  const lgLeft = ctx.createLinearGradient(x - hw, baseY - height, x, baseY);
  lgLeft.addColorStop(0, topLight || leftColor);
  lgLeft.addColorStop(0.5, leftColor);
  lgLeft.addColorStop(1, _darkenColor(leftColor, 0.7));

  ctx.beginPath();
  ctx.moveTo(x - hw, baseY - height);
  ctx.lineTo(x, baseY + hh - height);
  ctx.lineTo(x, baseY + hh);
  ctx.lineTo(x - hw, baseY);
  ctx.closePath();
  ctx.fillStyle = lgLeft;
  ctx.fill();

  // Sağ duvar gradyanı (daha koyu)
  const lgRight = ctx.createLinearGradient(x, baseY - height, x + hw, baseY);
  lgRight.addColorStop(0, _darkenColor(rightColor, 1.15));
  lgRight.addColorStop(0.5, rightColor);
  lgRight.addColorStop(1, _darkenColor(rightColor, 0.65));

  ctx.beginPath();
  ctx.moveTo(x + hw, baseY - height);
  ctx.lineTo(x, baseY + hh - height);
  ctx.lineTo(x, baseY + hh);
  ctx.lineTo(x + hw, baseY);
  ctx.closePath();
  ctx.fillStyle = lgRight;
  ctx.fill();
}

/**
 * Cam cephe efekti — sağ duvara yarı saydam mavi çizgiler.
 */
function _drawGlassFacade(ctx, x, baseY, hw, hh, height) {
  const skewPerX = hh / hw;
  const numStrips = 5;
  for (let i = 0; i < numStrips; i++) {
    const stripX = (i + 0.5) * hw / numStrips;
    const sx0 = x + stripX;
    const sy0 = baseY - height + hh - stripX * skewPerX;
    const sx1 = sx0;
    const sy1 = sy0 + height;

    ctx.strokeStyle = `rgba(150,220,255,${0.2 - i * 0.03})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx0, sy0);
    ctx.lineTo(sx1, sy1);
    ctx.stroke();
  }

  // Genel cam mavi tonu
  ctx.beginPath();
  ctx.moveTo(x + hw, baseY - height);
  ctx.lineTo(x, baseY + hh - height);
  ctx.lineTo(x, baseY + hh);
  ctx.lineTo(x + hw, baseY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(80,170,255,0.12)';
  ctx.fill();
}

/**
 * Bina altına düşen gölge.
 */
function _drawBuildingShadow(ctx, x, baseY, hw, hh, height, shadowColor) {
  // Gölge: binanın sağ-alt kısmına uzayan elips
  const shadowW = hw * 1.4;
  const shadowH = hh * 0.8;
  const shadowX = x + hw * 0.3;
  const shadowY = baseY + hh * 0.1;

  const grad = ctx.createRadialGradient(shadowX, shadowY, 0, shadowX, shadowY, shadowW);
  grad.addColorStop(0, shadowColor || 'rgba(0,0,0,0.35)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.beginPath();
  ctx.ellipse(shadowX, shadowY, shadowW, shadowH, 0, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
}

/**
 * Rengi belirtilen çarpan ile aydınlatır / karartır.
 * @param {string} hex - '#rrggbb' formatında renk
 * @param {number} factor - 1.0 = değişmez, >1 aydınlık, <1 karanlık
 */
function _darkenColor(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.min(255, Math.round(r * factor));
  const ng = Math.min(255, Math.round(g * factor));
  const nb = Math.min(255, Math.round(b * factor));
  return `rgb(${nr},${ng},${nb})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ÇİZİM: BİNALAR
// ─────────────────────────────────────────────────────────────────────────────

function drawBuilding(ctx, building, state) {
  const style = BUILDING_STYLES[building.type];
  if (!style) return;

  const gx = building.gridX;
  const gy = building.gridY;
  const gw = building.gridW || 1;
  const gh = building.gridH || 1;

  // Multi-tile bina: x merkezi + baseY hesapla
  // x merkezi: sütun ve satır ortasından
  const centerCol = gx + gw / 2;
  const centerRow = gy + gh / 2;
  const { x } = isoProject(centerCol, centerRow);
  // baseY: izometrik perspektifte binanın oturduğu zemin noktası.
  // En "derin" tile (maksimum col+row) taban köşesinin altı kullanılır;
  // bu 1x1 binalar için mevcut davranışla aynıdır, non-kare için yüzer görünümü düzeltir.
  const deepTile = isoProject(gx + gw - 1, gy + gh - 1);
  const baseY = deepTile.y + TILE_H;

  // v0.5.0: görsel varsa onu çiz; yoksa aşağıdaki kutu çizimine düş
  const spKey = _spriteKeyFor(building);
  const spDurum = _spriteDurum(spKey);
  if (spDurum === 'hazir') {
    _drawBuildingSprite(ctx, building, _getSprite(spKey), BUILDING_SPRITES[spKey], x, baseY, gw, gh);
    return;
  }
  if (spDurum === 'yukleniyor') {
    // Görsel gelene kadar yalnız taş zemin (eski kutu çizimi bir an görünüp kaybolmasın)
    for (let dc = 0; dc < gw; dc++) {
      for (let dr = 0; dr < gh; dr++) {
        const { x: tx, y: ty } = isoProject(gx + dc, gy + dr);
        drawIsoDiamond(ctx, tx, ty + TILE_H / 2, TILE_W + 1, TILE_H + 0.5, COLORS.plaza, null);
      }
    }
    return;
  }

  // Bina genişlik/derinlik (tile sayısı bazlı)
  const buildW = TILE_W * gw * 0.7;
  const buildH = TILE_H * gh * 0.7;
  const height = style.height * (building.level || 1) * 0.15 + style.height * 0.85;

  // Zemin kaplaması
  for (let dc = 0; dc < gw; dc++) {
    for (let dr = 0; dr < gh; dr++) {
      const { x: tx, y: ty } = isoProject(gx + dc, gy + dr);
      drawIsoDiamond(ctx, tx, ty + TILE_H / 2, TILE_W, TILE_H, '#3a3a4a', '#2a2a3a');
    }
  }

  // Ana bina gövdesi
  _drawBuildingBody(ctx, x, baseY, buildW, buildH, height, style, building);

  // İnşaat overlay
  if (!building.isCompleted) {
    _drawConstructionOverlay(ctx, x, baseY, buildW, height, building.constructionProgress || 0);
  }

  // Seviye rozeti
  if (building.isCompleted && (building.level || 1) > 1) {
    _drawLevelBadge(ctx, x, baseY - height - 8, building.level);
  }

  // Bina etiketi
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(style.label, x, baseY - height / 2);
}

/**
 * Ana bina çizim fonksiyonu — v0.4 mimari detaylar.
 * Gölge → Gövde → Duvar gradyanı → Pencereler → Kapı → Özel detaylar → Çatı
 */
function _drawBuildingBody(ctx, x, baseY, buildW, buildH, height, style, building) {
  const hw = buildW / 2;
  const hh = buildH / 2;

  // ── 1. Zemin gölgesi ──────────────────────────────────────────────────────
  _drawBuildingShadow(ctx, x, baseY, hw, hh, height, style.shadow);

  // ── 2. Üst yüz (tavan) ───────────────────────────────────────────────────
  // Üst yüzün gradyanı: merkeze doğru biraz aydınlık
  const topGrad = ctx.createRadialGradient(x - hw * 0.2, baseY - height - hh * 0.2, 0,
                                            x, baseY - height, hw * 0.8);
  topGrad.addColorStop(0, style.topLight || style.top);
  topGrad.addColorStop(1, _darkenColor(style.top, 0.8));

  ctx.beginPath();
  ctx.moveTo(x, baseY - hh - height);
  ctx.lineTo(x + hw, baseY - height);
  ctx.lineTo(x, baseY + hh - height);
  ctx.lineTo(x - hw, baseY - height);
  ctx.closePath();
  ctx.fillStyle = topGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // ── 3. Sol ve sağ duvarlar (gradyan) ─────────────────────────────────────
  _applyWallGradient(ctx, x, baseY, hw, hh, height, style.left, style.right, style.topLight);

  // Duvar kenar çizgileri (kontur)
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 0.8;
  // Sol duvar kenarları
  ctx.beginPath();
  ctx.moveTo(x - hw, baseY - height);
  ctx.lineTo(x - hw, baseY);
  ctx.moveTo(x, baseY + hh - height);
  ctx.lineTo(x, baseY + hh);
  ctx.stroke();

  // ── 4. Cam cephe (sadece teknokent) ──────────────────────────────────────
  if (style.roofType === 'glass_modern' && building.isCompleted) {
    _drawGlassFacade(ctx, x, baseY, hw, hh, height);
  }

  // ── 5. Pencereler ────────────────────────────────────────────────────────
  if (building.isCompleted) {
    const winRows = Math.max(1, Math.floor(height / 16));
    const winCols = Math.max(1, Math.floor(hw / 14));
    const litColor = style.windowColor || '#ffe080';
    const darkColor = style.windowColorDark || '#806030';

    // Sol duvar pencereleri
    _drawWindowsLeft(ctx, x, baseY, hw, hh, height, winRows, winCols, litColor, darkColor);
    // Sağ duvar pencereleri (bir sütun daha az — koyu yüz)
    _drawWindowsRight(ctx, x, baseY, hw, hh, height, winRows, Math.max(1, winCols - 1),
                      _darkenColor(litColor, 0.7), _darkenColor(darkColor, 0.6));
  }

  // ── 6. Zemin kat giriş kapısı ─────────────────────────────────────────────
  if (building.isCompleted && height > 20) {
    const doorArchColor = _darkenColor(style.top, 1.3);
    _drawEntrance(ctx, x, baseY, hw, hh, height, doorArchColor);
  }

  // ── 7. Bina tipine özel çatı ve detaylar ─────────────────────────────────
  const roofTopY = baseY - height; // Çatının oturduğu seviye

  if (!building.isCompleted) return; // İnşaat aşamasında çatı yok

  switch (style.roofType) {
    case 'flat_antenna':
      _drawRoofFlatAntenna(ctx, x, roofTopY, hw, hh);
      break;
    case 'dome':
      _drawRoofDome(ctx, x, roofTopY, hw, hh);
      break;
    case 'flat_satellite':
      _drawRoofFlatSatellite(ctx, x, roofTopY, hw, hh);
      break;
    case 'arch':
      _drawRoofArch(ctx, x, roofTopY, hw, hh);
      break;
    case 'flat_balcony':
      _drawRoofFlatBalcony(ctx, x, roofTopY, hw, hh);
      break;
    case 'gabled_chimney':
      _drawRoofGabledChimney(ctx, x, roofTopY, hw, hh);
      break;
    case 'barrel':
      _drawRoofBarrel(ctx, x, roofTopY, hw, hh);
      break;
    case 'angular':
      _drawRoofAngular(ctx, x, roofTopY, hw, hh);
      break;
    case 'tiered':
      _drawRoofTiered(ctx, x, roofTopY, hw, hh);
      break;
    case 'glass_modern':
      _drawRoofGlassModern(ctx, x, roofTopY, hw, hh);
      break;
    case 'flat_cross':
      _drawRoofFlatCross(ctx, x, roofTopY, hw, hh);
      break;
    case 'classical':
      _drawRoofClassical(ctx, x, roofTopY, hw, hh);
      break;
    default:
      // Standart düz çatı
      _drawRoofFlatAntenna(ctx, x, roofTopY, hw, hh);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// İNŞAAT ve SEVİYE OVERLAY
// ─────────────────────────────────────────────────────────────────────────────

function _drawConstructionOverlay(ctx, x, baseY, buildW, height, progress) {
  const hw = buildW / 2;

  // Yarı saydam sarı overlay
  ctx.fillStyle = COLORS.constructionOverlay;
  ctx.fillRect(x - hw, baseY - height, buildW, height);

  // İskele çizgileri
  ctx.strokeStyle = COLORS.scaffold;
  ctx.lineWidth = 1.5;
  // Dikey direkler
  ctx.beginPath();
  ctx.moveTo(x - hw + 4, baseY);
  ctx.lineTo(x - hw + 4, baseY - height);
  ctx.moveTo(x + hw - 4, baseY);
  ctx.lineTo(x + hw - 4, baseY - height);
  ctx.stroke();

  // Yatay kirişler
  for (let i = 0; i < 3; i++) {
    const hy = baseY - (height * (i + 1)) / 4;
    ctx.beginPath();
    ctx.moveTo(x - hw + 2, hy);
    ctx.lineTo(x + hw - 2, hy);
    ctx.stroke();
  }

  // İlerleme göstergesi
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`%${Math.round(progress)}`, x, baseY - height / 2);

  // İlerleme çubuğu
  const barW = buildW * 0.6;
  const barY = baseY - 6;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x - barW / 2, barY, barW, 4);
  ctx.fillStyle = '#f0c040';
  ctx.fillRect(x - barW / 2, barY, barW * (progress / 100), 4);
}

/**
 * Bina görselini taban izine oturtur. Ölçek zemin plakasından alınır; plakanın
 * alt ucu taban izinin alt köşesine, plaka ortası taban izinin ortasına gelir.
 */
function _drawBuildingSprite(ctx, b, img, m, x, baseY, gw, gh) {
  // 1x1 binalar çok küçük kalmasın diye hafifçe büyütülür (taşma çeyrek karoyu geçmez)
  const fpW  = (gw + gh) * TILE_W / 2 * (gw * gh === 1 ? 1.2 : 0.98);
  const padW = Math.max(1, m.padR - m.padL + 1);
  const k    = fpW / padW;
  const dx   = x - ((m.padL + m.padR) / 2) * k;
  const dy   = baseY - m.padB * k;
  const topY = dy + (m.top || 0) * k;

  const secili  = !!_selectedBuilding && (_selectedBuilding === b ||
    (_selectedBuilding.id != null && _selectedBuilding.id === b.id));
  const uzerinde = _hoveredTile &&
    _hoveredTile.col >= b.gridX && _hoveredTile.col < b.gridX + gw &&
    _hoveredTile.row >= b.gridY && _hoveredTile.row < b.gridY + gh;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (secili || uzerinde) {
    ctx.shadowColor = secili ? 'rgba(78,204,163,0.95)' : 'rgba(255,255,255,0.55)';
    ctx.shadowBlur  = secili ? 22 : 14;
  } else {
    // Işık sol üstten: gölge sağ alta düşer (ofset ve bulanıklık kamera ölçeğiyle)
    ctx.shadowColor   = 'rgba(20, 28, 8, 0.38)';
    ctx.shadowBlur    = 6 * _camS;
    ctx.shadowOffsetX = 3 * _camS;
    ctx.shadowOffsetY = 1.5 * _camS;
  }
  ctx.drawImage(img, dx, dy, m.w * k, m.h * k);
  ctx.restore();

  // İnşaat ya da yükseltme sürüyorsa ilerleme çubuğu
  const yukseltme = b.isCompleted && b.status === 'upgrading';
  if (!b.isCompleted || yukseltme) {
    _drawProgressBar(ctx, x, topY - 6, Math.min(46, fpW * 0.5), b.constructionProgress || 0,
      yukseltme ? '#4ecca3' : '#f0c040');
  }

  // Düzey rozeti (düzey 2 ve üstü)
  if (b.isCompleted && (b.level || 1) > 1) {
    // Rozet zemin plakasının sağ köşesinde: binanın üstünü kapatmasın
    _drawLevelBadge(ctx, x + fpW * 0.40, baseY - fpW * 0.25 + 3, b.level);
  }
}

function _drawProgressBar(ctx, cx, y, w, pct, color) {
  const h = 3;
  const p = Math.max(0, Math.min(100, pct)) / 100;
  const yuvarla = (x0, y0, ww, hh, r) => {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x0, y0, ww, hh, r); else ctx.rect(x0, y0, ww, hh);
  };
  ctx.fillStyle = 'rgba(12, 16, 28, 0.78)';
  yuvarla(cx - w / 2 - 1, y - 1, w + 2, h + 2, 2.5);
  ctx.fill();
  if (p > 0) {
    ctx.fillStyle = color;
    yuvarla(cx - w / 2, y, Math.max(h, w * p), h, 1.5);
    ctx.fill();
  }
}

function _drawLevelBadge(ctx, x, y, level) {
  const r = 4.6;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#1b2340';
  ctx.fill();
  ctx.strokeStyle = '#f0c040';
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.fillStyle = '#ffd866';
  ctx.font = 'bold 6.2px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(level, x, y + 0.3);
}

// ─────────────────────────────────────────────────────────────────────────────
// ÇİZİM: HOVER / SEÇİM
// ─────────────────────────────────────────────────────────────────────────────

function _drawTileHighlight(ctx, col, row, color) {
  const { x, y } = isoProject(col, row);
  drawIsoDiamond(ctx, x, y + TILE_H / 2, TILE_W, TILE_H, color, null);
}

function _drawBuildingHighlight(ctx, building) {
  for (let dc = 0; dc < (building.gridW || 1); dc++) {
    for (let dr = 0; dr < (building.gridH || 1); dr++) {
      _drawTileHighlight(ctx, building.gridX + dc, building.gridY + dr, COLORS.selectionGlow);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ANA RENDER FONKSİYONU
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kamera: binaların kapladığı bölgeyi (yükseklik payı dahil) tuvale sığdırır.
 * Erken oyunda az bina yakından görünür, kampüs büyüdükçe kamera uzaklaşır.
 */
function _computeCamera(state) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const ekle = (px, py) => {
    if (px < minX) minX = px; if (px > maxX) maxX = px;
    if (py < minY) minY = py; if (py > maxY) maxY = py;
  };
  for (const b of (state.buildings || [])) {
    if (b.gridX == null || b.gridY == null) continue;
    const gw = b.gridW || 1, gh = b.gridH || 1;
    const ust = isoProject(b.gridX, b.gridY);
    const sag = isoProject(b.gridX + gw, b.gridY);
    const alt = isoProject(b.gridX + gw, b.gridY + gh);
    const sol = isoProject(b.gridX, b.gridY + gh);
    ekle(sol.x, sol.y); ekle(sag.x, sag.y); ekle(alt.x, alt.y);
    ekle(ust.x, ust.y - (gw + gh) * TILE_W / 2 * 0.8);   // bina yüksekliği payı
  }
  if (!isFinite(minX)) {
    const c = isoProject(GRID_SIZE / 2, GRID_SIZE / 2);
    minX = c.x - 200; maxX = c.x + 200; minY = c.y - 160; maxY = c.y + 100;
  }
  minX -= TILE_W * 1.5; maxX += TILE_W * 1.5;
  minY -= TILE_H * 1.5; maxY += TILE_H * 2.0;
  // Aşırı yakınlaşmayı önle: en az ~10 karo genişliğinde alan
  const enAzW = TILE_W * 10;
  if (maxX - minX < enAzW) { const o = (minX + maxX) / 2; minX = o - enAzW / 2; maxX = o + enAzW / 2; }
  const enAzH = enAzW * VIEW_H / VIEW_W;
  if (maxY - minY < enAzH) { const o = (minY + maxY) / 2; minY = o - enAzH / 2; maxY = o + enAzH / 2; }
  let s = Math.min(VIEW_W / (maxX - minX), VIEW_H / (maxY - minY));
  const sMin = Math.min(VIEW_W / CANVAS_W, VIEW_H / CANVAS_H);   // bütün dünya
  s = Math.max(sMin, Math.min(s, 4.2));
  return { s, tx: VIEW_W / 2 - s * (minX + maxX) / 2, ty: VIEW_H / 2 - s * (minY + maxY) / 2 };
}

export function renderCampusMap(canvas, state) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  _liveCanvases.set(canvas, state);

  // Arkaplan (fiziksel tuval): kampüsün çevresi koyu çayır
  const bg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H * 0.5, 60, VIEW_W / 2, VIEW_H * 0.5, VIEW_W * 0.8);
  bg.addColorStop(0, '#3f5a24');
  bg.addColorStop(1, '#1b2811');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  const campus = state.campus;
  if (!campus || !campus.grid) return;

  // Kamera: dolu bölgeye odaklan, dünyayı tuvale ölçekle
  const cam = _computeCamera(state);
  _cameras.set(canvas, cam);
  _camS = cam.s;
  ctx.setTransform(cam.s, 0, 0, cam.s, cam.tx, cam.ty);
  const mevsim = state.meta?.semester || 'güz';

  const grid = campus.grid;
  const size = grid.length;
  const buildings = state.buildings || [];
  const decorations = campus.decorations || [];

  // 0. Kampüs adası: ızgaranın ön iki yüzüne toprak kalınlığı (diorama görünümü)
  {
    const sol = isoProject(0, size), alt = isoProject(size, size), sag = isoProject(size, 0);
    const kal = TILE_H * 0.9;
    ctx.fillStyle = COLORS.soilLeft;
    ctx.beginPath();
    ctx.moveTo(sol.x, sol.y); ctx.lineTo(alt.x, alt.y);
    ctx.lineTo(alt.x, alt.y + kal); ctx.lineTo(sol.x, sol.y + kal);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = COLORS.soilRight;
    ctx.beginPath();
    ctx.moveTo(alt.x, alt.y); ctx.lineTo(sag.x, sag.y);
    ctx.lineTo(sag.x, sag.y + kal); ctx.lineTo(alt.x, alt.y + kal);
    ctx.closePath(); ctx.fill();
  }

  // Painter's algorithm: col + row sırasıyla çiz
  // 1. Önce tüm zemin karoları
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const tile = grid[row][col];
      if (tile === 'path') {
        drawPathTile(ctx, col, row, grid);
      } else if (tile === 'plaza') {
        drawPathTile(ctx, col, row, grid, COLORS.plaza);
      } else {
        drawGrassTile(ctx, col, row);
      }
    }
  }

  // 2. Hover highlight
  if (_hoveredTile) {
    _drawTileHighlight(ctx, _hoveredTile.col, _hoveredTile.row, COLORS.hoverGlow);
  }

  // 3. Seçili bina highlight
  if (_selectedBuilding) {
    _drawBuildingHighlight(ctx, _selectedBuilding);
  }

  // 4. Dekorasyonlar ve binalar — derinlik sırasıyla
  const renderables = [];

  // Derinlik: nesnenin alt köşesinin (col + row) toplamı; eşitlikte önce zemine yakın olan
  const SIRA = { plaza: 0, fountain: 0, building: 1, tree: 2, prop: 2 };
  for (const dec of decorations) {
    if (dec.type === 'tree' || dec.type === 'prop') {
      renderables.push({ type: dec.type, col: dec.col, row: dec.row, depth: dec.col + dec.row + 2, data: dec });
    } else if (dec.type === 'fountain' || dec.type === 'plaza') {
      renderables.push({ type: dec.type, col: dec.col, row: dec.row, depth: dec.col + dec.row + (dec.w || 2) + (dec.h || 2), data: dec });
    }
  }

  // Binalar
  for (const b of buildings) {
    if (b.gridX == null || b.gridY == null) continue;
    renderables.push({ type: 'building', col: b.gridX, row: b.gridY, depth: b.gridX + b.gridY + (b.gridW || 1) + (b.gridH || 1), data: b });
  }

  renderables.sort((a, b) => (a.depth - b.depth) || (SIRA[a.type] - SIRA[b.type]) || (a.row - b.row));

  for (const r of renderables) {
    if (r.type === 'tree') {
      drawTree(ctx, r.col, r.row, mevsim);
    } else if (r.type === 'prop') {
      drawProp(ctx, r.data);
    } else if (r.type === 'plaza') {
      drawPlaza(ctx, r.data);
    } else if (r.type === 'fountain') {
      drawFountain(ctx, r.col, r.row);
    } else if (r.type === 'building') {
      drawBuilding(ctx, r.data, state);
    }
  }

  // 5. Kampüs etiketleri (fiziksel tuval koordinatlarında, yarı saydam hap içinde)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const totalArea = buildings.reduce((s, b) => s + (b.isCompleted ? (b.area || 0) : 0), 0);
  // Tuval ekranda küçük gösteriliyorsa (telefon) yazı en az ~11 CSS pikseli kalsın
  const gorunen = canvas.clientWidth || VIEW_W;
  const kz = Math.max(1, Math.min(2.6, 11 / (24 * gorunen / VIEW_W)));
  const pay = 24 * kz;
  _drawPill(ctx, `${state.university?.name || 'Üniversite'} Yerleşkesi`, pay, VIEW_H - pay, 'left', true, kz);
  if (kz < 1.6) {
    _drawPill(ctx, `${buildings.filter(b => b.isCompleted).length} bina · ${totalArea.toLocaleString('tr-TR')} m²`,
      VIEW_W - pay, VIEW_H - pay, 'right', false, kz);
  }
}

function _drawPill(ctx, metin, x, y, hiza, kalin, kz = 1) {
  ctx.font = `${kalin ? '700' : '600'} ${24 * kz}px "Segoe UI", system-ui, sans-serif`;
  const w = ctx.measureText(metin).width + 36 * kz;
  const h = 44 * kz;
  const x0 = hiza === 'left' ? x : x - w;
  const y0 = y - h;
  ctx.fillStyle = 'rgba(12, 18, 8, 0.62)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x0, y0, w, h, h / 2); else ctx.rect(x0, y0, w, h);
  ctx.fill();
  ctx.fillStyle = kalin ? '#fff4dc' : 'rgba(255, 244, 220, 0.85)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(metin, x0 + 18 * kz, y0 + h / 2 + 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// ETKİLEŞİM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canvas tıklama — tıklanan tile'daki binayı döner.
 * @returns {object|null} — building object veya null
 */
export function handleCampusClick(e, canvas, state) {
  const tile = isoUnproject(e.offsetX, e.offsetY, canvas);
  const buildings = state.buildings || [];

  for (const b of buildings) {
    if (b.gridX == null || b.gridY == null) continue;
    const gw = b.gridW || 1;
    const gh = b.gridH || 1;
    if (tile.col >= b.gridX && tile.col < b.gridX + gw &&
        tile.row >= b.gridY && tile.row < b.gridY + gh) {
      _selectedBuilding = b;
      return b;
    }
  }

  _selectedBuilding = null;
  return null;
}

/**
 * Canvas hover — tile vurgulama.
 */
export function handleCampusHover(e, canvas, state) {
  const tile = isoUnproject(e.offsetX, e.offsetY, canvas);
  if (tile.col >= 0 && tile.col < GRID_SIZE && tile.row >= 0 && tile.row < GRID_SIZE) {
    _hoveredTile = tile;
  } else {
    _hoveredTile = null;
  }
}

/**
 * Hover state'i temizle.
 */
export function clearHover() {
  _hoveredTile = null;
  _selectedBuilding = null;
}
