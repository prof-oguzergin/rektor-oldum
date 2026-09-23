/**
 * Rektör Oldum — Kampüs Yerleşim Modülü (campus-layout.js)
 * Saf yerleşim algoritması — DOM/Canvas bağımlılığı yok.
 * game.js ve campus-renderer.js tarafından import edilir.
 */

// ─────────────────────────────────────────────────────────────────────────────
// SABİTLER
// ─────────────────────────────────────────────────────────────────────────────

export const GRID_SIZE = 24;

/** Bina tipi → tile footprint boyutu */
export const BUILDING_FOOTPRINTS = {
  lab:               { w: 1, h: 1 },
  yemekhane:         { w: 1, h: 1 },
  kutuphane:         { w: 2, h: 1 },
  konferans:         { w: 2, h: 1 },
  spor_tesisi:       { w: 2, h: 1 },
  fakulte_binasi:    { w: 2, h: 2 },
  arastirma_merkezi: { w: 2, h: 2 },
  amfi:              { w: 2, h: 2 },
  yurt:              { w: 2, h: 2 },
  teknokent:         { w: 3, h: 2 },
  saglik_merkezi:    { w: 2, h: 1 },
  idari_bina:        { w: 2, h: 2, zone: 'core' },
  ulasim_merkezi:    { w: 2, h: 1 },
};

/** Bina tipi → tercih edilen bölge */
export const BUILDING_ZONES = {
  fakulte_binasi:    'center',
  arastirma_merkezi: 'center',
  lab:               'center',
  amfi:              'center',
  kutuphane:         'center',
  yemekhane:         'inner',
  konferans:         'inner',
  spor_tesisi:       'inner',
  yurt:              'outer',
  teknokent:         'outer',
  saglik_merkezi:    'inner',
  idari_bina:        'center',
  ulasim_merkezi:    'edge',
};


const CENTER = Math.floor(GRID_SIZE / 2);

// ─────────────────────────────────────────────────────────────────────────────
// YERLEŞİM DÜZENİ 2 (v0.5.0)
// Artı biçimli iki ana yol, kesiştikleri yerde 3x3 meydan. Binalar arasında
// en az bir karo boşluk kalır; her bölge meydana belli bir uzaklık bandında
// yerleşir (akademik çekirdek ortada, yurt ve teknokent dışta).
// ─────────────────────────────────────────────────────────────────────────────

export const LAYOUT_VERSION = 2;

/** Meydan: ana yolların kesiştiği 3x3 alan */
export const PLAZA = { col: CENTER - 1, row: CENTER - 1, w: 3, h: 3 };

/** Bölge → meydan merkezine uzaklık bandı (karo, Chebyshev) */
const ZONE_BAND = {
  core:   [0, 5],
  center: [0, 6],
  inner:  [3, 9],
  outer:  [5, 12],
  edge:   [6, 12],
};
const ZONE_ORDER = { core: 0, center: 1, inner: 2, outer: 3, edge: 4 };

/** Süsleme hücre türleri: yeni bina gelince hepsi silinip yeniden üretilir */
const DECOR_CELLS = ['tree', 'path', 'fountain', 'plaza', 'prop'];

// ─────────────────────────────────────────────────────────────────────────────
// GRID OLUŞTURMA
// ─────────────────────────────────────────────────────────────────────────────

/** Boş grid oluştur */
export function createEmptyGrid(size = GRID_SIZE) {
  return Array.from({ length: size }, () => Array(size).fill('empty'));
}

/** Ana yollar ve meydan: bina konmaz */
function _isReserved(col, row) {
  if (col === CENTER || row === CENTER) return true;
  return col >= PLAZA.col && col < PLAZA.col + PLAZA.w &&
         row >= PLAZA.row && row < PLAZA.row + PLAZA.h;
}

function _zoneOf(buildingType) {
  const fp = BUILDING_FOOTPRINTS[buildingType];
  if (fp && fp.zone) return fp.zone;
  return BUILDING_ZONES[buildingType] || 'inner';
}

// ─────────────────────────────────────────────────────────────────────────────
// YERLEŞTİRME ALGORİTMASI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verilen bina tipi için grid üzerinde uygun yer bul.
 * Önce bölge bandında, bir karo boşlukla; bulunamazsa band dışında;
 * o da olmazsa boşluksuz (kalabalık kampüs) aranır.
 * @returns {{ col: number, row: number, gridW: number, gridH: number } | null}
 */
export function findPlacement(grid, buildingType) {
  const fp = BUILDING_FOOTPRINTS[buildingType] || { w: 1, h: 1 };
  const [dMin, dMax] = ZONE_BAND[_zoneOf(buildingType)] || ZONE_BAND.inner;
  const denemeler = [
    { gap: 1, band: true },
    { gap: 1, band: false },
    { gap: 0, band: false },
  ];
  for (const d of denemeler) {
    const yer = _bestSpot(grid, fp.w, fp.h, d.gap, d.band ? dMin : 0, d.band ? dMax : Infinity);
    if (yer) return { col: yer.col, row: yer.row, gridW: fp.w, gridH: fp.h };
  }
  return null;
}

/** Meydana en yakın uygun yer (eşitlikte satır, sonra sütun sırası: belirlenimci) */
function _bestSpot(grid, w, h, gap, dMin, dMax) {
  const size = grid.length;
  const merkez = CENTER + 0.5;
  let enIyi = null;
  let enIyiSkor = Infinity;
  for (let row = 1; row < size - 1; row++) {
    for (let col = 1; col < size - 1; col++) {
      const fx = col + w / 2;
      const fy = row + h / 2;
      const d = Math.max(Math.abs(fx - merkez), Math.abs(fy - merkez));
      if (d < dMin || d > dMax) continue;
      if (!_canPlace(grid, col, row, w, h, gap)) continue;
      const skor = Math.hypot(fx - merkez, fy - merkez);
      if (skor < enIyiSkor - 1e-9) {
        enIyiSkor = skor;
        enIyi = { col, row };
      }
    }
  }
  return enIyi;
}

/** Grid'de belirli bir alana yerleştirilebilir mi? (gap: çevrede bina olmayacak karo sayısı) */
function _canPlace(grid, col, row, w, h, gap = 1) {
  const size = grid.length;
  if (col < 1 || row < 1 || col + w >= size - 1 || row + h >= size - 1) return false;
  for (let dc = 0; dc < w; dc++) {
    for (let dr = 0; dr < h; dr++) {
      if (grid[row + dr][col + dc] === 'building') return false;
      if (_isReserved(col + dc, row + dr)) return false;
    }
  }
  if (gap > 0) {
    for (let r = row - gap; r < row + h + gap; r++) {
      for (let c = col - gap; c < col + w + gap; c++) {
        if (r < 0 || c < 0 || r >= size || c >= size) continue;
        if (grid[r][c] === 'building') return false;
      }
    }
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// BİNA YERLEŞTİRME
// ─────────────────────────────────────────────────────────────────────────────

/** Binayı grid üzerine yerleştir (hücreleri 'building' olarak işaretle) */
export function placeBuildingOnGrid(grid, building) {
  const gx = building.gridX;
  const gy = building.gridY;
  const gw = building.gridW || 1;
  const gh = building.gridH || 1;
  for (let dc = 0; dc < gw; dc++) {
    for (let dr = 0; dr < gh; dr++) {
      if (gy + dr < grid.length && gx + dc < grid[0].length) {
        grid[gy + dr][gx + dc] = 'building';
      }
    }
  }
}

/** Süsleme hücrelerini boşalt (binalar yerinde kalır) */
function _clearDecorations(grid) {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (DECOR_CELLS.includes(grid[r][c])) grid[r][c] = 'empty';
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEKORASYON ÜRETİMİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kampüs dekorasyonlarını oluştur: meydan, ana yollar, bina bağlantı yolları,
 * ağaçlar ve süs nesneleri. Grid'i doğrudan değiştirir ve dekorasyon listesi döner.
 */
export function generateDecorations(grid, buildings) {
  const decorations = [];
  const size = grid.length;

  // 1. Meydan (3x3, ana yolların kesişiminde)
  let meydanBos = true;
  for (let dr = 0; dr < PLAZA.h; dr++) {
    for (let dc = 0; dc < PLAZA.w; dc++) {
      if (grid[PLAZA.row + dr][PLAZA.col + dc] !== 'empty') meydanBos = false;
    }
  }
  if (meydanBos) {
    for (let dr = 0; dr < PLAZA.h; dr++) {
      for (let dc = 0; dc < PLAZA.w; dc++) grid[PLAZA.row + dr][PLAZA.col + dc] = 'plaza';
    }
    decorations.push({ type: 'plaza', col: PLAZA.col, row: PLAZA.row, w: PLAZA.w, h: PLAZA.h });
  }

  // 2. Ana yollar (artı biçimi)
  for (let i = 1; i < size - 1; i++) {
    if (grid[CENTER][i] === 'empty') {
      grid[CENTER][i] = 'path';
      decorations.push({ type: 'path', col: i, row: CENTER });
    }
    if (grid[i][CENTER] === 'empty') {
      grid[i][CENTER] = 'path';
      decorations.push({ type: 'path', col: CENTER, row: i });
    }
  }

  // 3. Her binayı en yakın yola bağla (içten dışa; dıştakiler içtekilerin yoluna bağlanır)
  const merkez = CENTER + 0.5;
  const sirali = buildings
    .filter(b => b.gridX != null && b.gridY != null)
    .map(b => ({ b, d: Math.hypot(b.gridX + (b.gridW || 1) / 2 - merkez, b.gridY + (b.gridH || 1) / 2 - merkez) }))
    .sort((a, b) => a.d - b.d);
  for (const { b } of sirali) _connectToPath(grid, b, decorations);

  // 4. Ağaçlar ve süs nesneleri (sabit tohum: her çağrıda aynı sonuç)
  let seed = 42;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed & 0x7fffffff) / 2147483647;
  };

  for (let row = 1; row < size - 1; row++) {
    for (let col = 1; col < size - 1; col++) {
      if (grid[row][col] !== 'empty') continue;
      // Binaların çevresi açık kalsın (görseller taban izinden biraz taşabiliyor)
      if (_hasNeighbor8(grid, col, row, ['building'])) continue;
      const yolKenari = _hasAdjacentType(grid, col, row, ['path', 'plaza']);
      const r = rnd();
      let dec = null;
      if (yolKenari) {
        if (r < 0.20)       dec = { type: 'tree' };
        else if (r < 0.26)  dec = { type: 'prop', key: 'lamba' };
        else if (r < 0.29)  dec = { type: 'prop', key: 'bank' };
        else if (r < 0.31)  dec = { type: 'prop', key: 'cicek' };
        else if (r < 0.325) dec = { type: 'prop', key: 'ogrenciler' };
        else if (r < 0.335) dec = { type: 'prop', key: 'bisiklet' };
        else if (r < 0.342) dec = { type: 'prop', key: 'bufe' };
        else if (r < 0.348) dec = { type: 'prop', key: 'heykel' };
      } else {
        if (r < 0.11)       dec = { type: 'tree' };
        else if (r < 0.145) dec = { type: 'prop', key: 'calilik' };
        else if (r < 0.16)  dec = { type: 'prop', key: 'cicek' };
        else if (r < 0.165) dec = { type: 'prop', key: 'cardak' };
      }
      if (dec) {
        grid[row][col] = dec.type;
        decorations.push({ ...dec, col, row });
      }
    }
  }

  // 5. Dış kenar ağaçları (kampüs çevresi)
  for (let i = 0; i < size; i++) {
    for (const [r, c] of [[0, i], [size - 1, i], [i, 0], [i, size - 1]]) {
      if (grid[r][c] === 'empty' && rnd() < 0.6) {
        grid[r][c] = 'tree';
        decorations.push({ type: 'tree', col: c, row: r });
      }
    }
  }

  return decorations;
}

/**
 * Binanın çevresinden en yakın yol ya da meydan hücresine en kısa yolu aç (BFS).
 * Bina zaten bir yola bitişikse bir şey yapmaz. Ön cephe (sol alt yüz) önce denenir.
 */
function _connectToPath(grid, b, decorations) {
  const size = grid.length;
  const gx = b.gridX, gy = b.gridY, gw = b.gridW || 1, gh = b.gridH || 1;
  const icerde = (c, r) => c >= 0 && r >= 0 && c < size && r < size;
  const hedef = t => t === 'path' || t === 'plaza';

  const baslangic = [];
  for (let c = gx; c < gx + gw; c++) baslangic.push([c, gy + gh]);
  for (let r = gy; r < gy + gh; r++) baslangic.push([gx + gw, r]);
  for (let c = gx; c < gx + gw; c++) baslangic.push([c, gy - 1]);
  for (let r = gy; r < gy + gh; r++) baslangic.push([gx - 1, r]);

  for (const [c, r] of baslangic) {
    if (icerde(c, r) && hedef(grid[r][c])) return;
  }

  const onceki = new Map();
  const kuyruk = [];
  for (const [c, r] of baslangic) {
    if (!icerde(c, r) || grid[r][c] !== 'empty') continue;
    const k = r * size + c;
    if (onceki.has(k)) continue;
    onceki.set(k, -1);
    kuyruk.push(k);
  }
  for (let i = 0; i < kuyruk.length; i++) {
    const k = kuyruk[i];
    const c = k % size, r = (k - c) / size;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr;
      if (!icerde(nc, nr)) continue;
      const nk = nr * size + nc;
      if (onceki.has(nk)) continue;
      const t = grid[nr][nc];
      if (hedef(t)) {
        // Geriye doğru yolu işaretle
        let cur = k;
        while (cur !== -1) {
          const cc = cur % size, rr = (cur - cc) / size;
          if (grid[rr][cc] === 'empty') {
            grid[rr][cc] = 'path';
            decorations.push({ type: 'path', col: cc, row: rr });
          }
          cur = onceki.get(cur);
        }
        return;
      }
      if (t !== 'empty') continue;
      onceki.set(nk, k);
      kuyruk.push(nk);
    }
  }
}

/** Bitişik (4 yön) hücrelerde belirtilen tiplerden biri var mı? */
function _hasAdjacentType(grid, col, row, types) {
  const size = grid.length;
  for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const nc = col + dc;
    const nr = row + dr;
    if (nc >= 0 && nc < size && nr >= 0 && nr < size && types.includes(grid[nr][nc])) return true;
  }
  return false;
}

/** Çevredeki 8 hücrede belirtilen tiplerden biri var mı? */
function _hasNeighbor8(grid, col, row, types) {
  const size = grid.length;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nc = col + dc, nr = row + dr;
      if (nc >= 0 && nc < size && nr >= 0 && nr < size && types.includes(grid[nr][nc])) return true;
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// KAMPÜS STATE BAŞLATMA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kampüs state'ini başlat veya mevcut binalara göre yeniden oluştur.
 * @param {object} state — Oyun state'i
 * @param {{ relayout?: boolean }} [opts] relayout: bütün binalar yeni düzene göre yeniden yerleşir
 */
export function initCampusState(state, { relayout = false } = {}) {
  state.campus = {
    grid: createEmptyGrid(GRID_SIZE),
    decorations: [],
    size: GRID_SIZE,
    layoutVersion: LAYOUT_VERSION,
  };
  const grid = state.campus.grid;
  const buildings = state.buildings || [];

  if (relayout) {
    for (const b of buildings) { b.gridX = null; b.gridY = null; }
  }

  // Konumu olan binalar yerinde kalır
  for (const b of buildings) {
    if (b.gridX != null && b.gridY != null) placeBuildingOnGrid(grid, b);
  }

  // Konumu olmayanlar: idari bina önce, sonra bölge sırasıyla (içten dışa)
  const yersiz = buildings
    .filter(b => b.gridX == null || b.gridY == null)
    .sort((a, b) => (ZONE_ORDER[_zoneOf(a.type)] ?? 2) - (ZONE_ORDER[_zoneOf(b.type)] ?? 2));
  for (const b of yersiz) _assign(grid, b);

  state.campus.decorations = generateDecorations(grid, buildings);
}

/** Eski düzendeki kayıtları bir kez yeni düzene taşır; güncel kayıtta bir şey yapmaz. */
export function ensureCampusLayout(state) {
  if (!state.campus || !state.campus.grid) {
    initCampusState(state);
  } else if (state.campus.layoutVersion !== LAYOUT_VERSION) {
    initCampusState(state, { relayout: true });
  }
}

function _assign(grid, building) {
  const fp = BUILDING_FOOTPRINTS[building.type] || { w: 1, h: 1 };
  const placement = findPlacement(grid, building.type);
  if (placement) {
    building.gridX = placement.col;
    building.gridY = placement.row;
    building.gridW = placement.gridW;
    building.gridH = placement.gridH;
  } else {
    building.gridX = 0;
    building.gridY = 0;
    building.gridW = fp.w;
    building.gridH = fp.h;
  }
  placeBuildingOnGrid(grid, building);
}

/**
 * Yeni bina için pozisyon bul ve grid'e yerleştir.
 * Dekorasyonları yenile.
 */
export function assignBuildingPosition(state, building) {
  if (!state.campus) initCampusState(state);
  ensureCampusLayout(state);
  // initCampusState bu binayı zaten yerleştirmiş olabilir
  if (building.gridX != null && building.gridY != null &&
      state.campus.grid[building.gridY]?.[building.gridX] === 'building') {
    return;
  }

  const grid = state.campus.grid;
  _clearDecorations(grid);
  _assign(grid, building);
  state.campus.decorations = generateDecorations(grid, state.buildings || []);
}
