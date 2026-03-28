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
};

const ZONE_RADIUS = { center: 4, inner: 7, outer: 11 };
const CENTER = Math.floor(GRID_SIZE / 2);

// ─────────────────────────────────────────────────────────────────────────────
// GRID OLUŞTURMA
// ─────────────────────────────────────────────────────────────────────────────

/** Boş grid oluştur */
export function createEmptyGrid(size = GRID_SIZE) {
  return Array.from({ length: size }, () => Array(size).fill('empty'));
}

// ─────────────────────────────────────────────────────────────────────────────
// YERLEŞTİRME ALGORİTMASI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verilen bina tipi için grid üzerinde uygun yer bul.
 * Zone bazlı spiral arama: merkezden dışa doğru.
 * @returns {{ col: number, row: number, gridW: number, gridH: number } | null}
 */
export function findPlacement(grid, buildingType) {
  const fp = BUILDING_FOOTPRINTS[buildingType] || { w: 1, h: 1 };
  const zone = BUILDING_ZONES[buildingType] || 'inner';
  const radius = ZONE_RADIUS[zone] || 7;

  // Spiral arama: ring 0'dan dışa doğru
  for (let r = 0; r <= radius + 6; r++) {
    for (let dc = -r; dc <= r; dc++) {
      for (let dr = -r; dr <= r; dr++) {
        // Sadece ring kenarını tara (verim için)
        if (r > 0 && Math.abs(dc) !== r && Math.abs(dr) !== r) continue;
        const col = CENTER + dc;
        const row = CENTER + dr;
        if (_canPlace(grid, col, row, fp.w, fp.h)) {
          return { col, row, gridW: fp.w, gridH: fp.h };
        }
      }
    }
  }
  return null;
}

/** Grid'de belirli bir alana yerleştirilebilir mi? */
function _canPlace(grid, col, row, w, h) {
  const size = grid.length;
  if (col < 1 || row < 1 || col + w >= size - 1 || row + h >= size - 1) return false;
  for (let dc = 0; dc < w; dc++) {
    for (let dr = 0; dr < h; dr++) {
      if (grid[row + dr][col + dc] !== 'empty') return false;
    }
  }
  // Binaların birbirine yapışmaması için 1 tile boşluk bırak (en az bir kenarı boş)
  // Basit kontrol: footprint etrafında en az 1 empty tile var mı
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

// ─────────────────────────────────────────────────────────────────────────────
// DEKORASYON ÜRETİMİ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kampüs dekorasyonlarını oluştur: çeşme, yollar, ağaçlar.
 * Grid'i doğrudan mutate eder ve dekorasyon listesi döner.
 */
export function generateDecorations(grid, buildings) {
  const decorations = [];
  const size = grid.length;

  // 1. Merkez çeşme (2x2 alan, grid merkezinde)
  const fc = CENTER - 1;
  const fr = CENTER - 1;
  let fountainPlaced = false;
  if (fc >= 0 && fr >= 0 && fc + 1 < size && fr + 1 < size) {
    let canFountain = true;
    for (let dc = 0; dc < 2; dc++) {
      for (let dr = 0; dr < 2; dr++) {
        if (grid[fr + dr][fc + dc] !== 'empty') canFountain = false;
      }
    }
    if (canFountain) {
      for (let dc = 0; dc < 2; dc++) {
        for (let dr = 0; dr < 2; dr++) {
          grid[fr + dr][fc + dc] = 'fountain';
        }
      }
      decorations.push({ type: 'fountain', col: fc, row: fr, w: 2, h: 2 });
      fountainPlaced = true;
    }
  }

  // 2. Yollar: Her binadan merkeze doğru yol çiz
  const pathTarget = { col: CENTER, row: CENTER };
  for (const b of buildings) {
    if (b.gridX == null || b.gridY == null) continue;
    _tracePath(grid, b, pathTarget, decorations);
  }

  // 3. Ana yol aksları (merkez artı şekli)
  for (let i = 2; i < size - 2; i++) {
    if (grid[CENTER][i] === 'empty') {
      grid[CENTER][i] = 'path';
      decorations.push({ type: 'path', col: i, row: CENTER });
    }
    if (grid[i][CENTER] === 'empty') {
      grid[i][CENTER] = 'path';
      decorations.push({ type: 'path', col: CENTER, row: i });
    }
  }

  // 4. Ağaçlar: bina/yol bitişiğindeki boş hücrelere %30 ihtimalle
  // Sabit seed (her çağrıda aynı sonuç) için basit PRNG
  let seed = 42;
  const pseudoRandom = () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed & 0x7fffffff) / 2147483647;
  };

  for (let row = 1; row < size - 1; row++) {
    for (let col = 1; col < size - 1; col++) {
      if (grid[row][col] !== 'empty') continue;
      if (!_hasAdjacentType(grid, col, row, ['building', 'path', 'fountain'])) continue;
      if (pseudoRandom() < 0.30) {
        grid[row][col] = 'tree';
        decorations.push({ type: 'tree', col, row });
      }
    }
  }

  // 5. Dış kenar ağaçları (kampüs çevresi)
  for (let i = 0; i < size; i++) {
    for (const [r, c] of [[0, i], [size - 1, i], [i, 0], [i, size - 1]]) {
      if (r < size && c < size && grid[r][c] === 'empty' && pseudoRandom() < 0.6) {
        grid[r][c] = 'tree';
        decorations.push({ type: 'tree', col: c, row: r });
      }
    }
  }

  return decorations;
}

/** Binadan hedef noktaya L-şeklinde yol çiz */
function _tracePath(grid, building, target, decorations) {
  // Binanın kenar noktası
  const bCol = building.gridX + Math.floor((building.gridW || 1) / 2);
  const bRow = building.gridY + (building.gridH || 1); // alt kenar

  let col = bCol;
  let row = bRow;

  // Önce dikey, sonra yatay (veya tam tersi — daha kısa olan)
  const dCol = Math.sign(target.col - col);
  const dRow = Math.sign(target.row - row);

  // Dikey yürü
  while (row !== target.row) {
    if (row >= 0 && row < grid.length && col >= 0 && col < grid[0].length) {
      if (grid[row][col] === 'empty') {
        grid[row][col] = 'path';
        decorations.push({ type: 'path', col, row });
      }
    }
    row += dRow || 1;
    if (row < 0 || row >= grid.length) break;
  }

  // Yatay yürü
  while (col !== target.col) {
    if (row >= 0 && row < grid.length && col >= 0 && col < grid[0].length) {
      if (grid[row][col] === 'empty') {
        grid[row][col] = 'path';
        decorations.push({ type: 'path', col, row });
      }
    }
    col += dCol || 1;
    if (col < 0 || col >= grid[0].length) break;
  }
}

/** Bitişik hücrelerde belirtilen tiplerden biri var mı? */
function _hasAdjacentType(grid, col, row, types) {
  const size = grid.length;
  const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dc, dr] of offsets) {
    const nc = col + dc;
    const nr = row + dr;
    if (nc >= 0 && nc < size && nr >= 0 && nr < size) {
      if (types.includes(grid[nr][nc])) return true;
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
 */
export function initCampusState(state) {
  state.campus = {
    grid: createEmptyGrid(GRID_SIZE),
    decorations: [],
    size: GRID_SIZE,
  };

  // Mevcut binaları yerleştir (eski kayıt migration veya yeni başlatma)
  const buildings = state.buildings || [];
  for (const b of buildings) {
    if (b.gridX == null || b.gridY == null) {
      // Pozisyonu olmayan bina — otomatik yerleştir
      const fp = BUILDING_FOOTPRINTS[b.type] || { w: 1, h: 1 };
      const placement = findPlacement(state.campus.grid, b.type);
      if (placement) {
        b.gridX = placement.col;
        b.gridY = placement.row;
        b.gridW = placement.gridW;
        b.gridH = placement.gridH;
      } else {
        b.gridX = 0;
        b.gridY = 0;
        b.gridW = fp.w;
        b.gridH = fp.h;
      }
    }
    placeBuildingOnGrid(state.campus.grid, b);
  }

  // Dekorasyonları oluştur
  state.campus.decorations = generateDecorations(state.campus.grid, buildings);
}

/**
 * Yeni bina için pozisyon bul ve grid'e yerleştir.
 * Dekorasyonları yenile.
 */
export function assignBuildingPosition(state, building) {
  if (!state.campus) initCampusState(state);

  const fp = BUILDING_FOOTPRINTS[building.type] || { w: 1, h: 1 };
  const placement = findPlacement(state.campus.grid, building.type);

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

  placeBuildingOnGrid(state.campus.grid, building);

  // Dekorasyonları yeniden oluştur (yollar/ağaçlar güncellenir)
  // Önce grid'den eski dekorasyonları temizle
  const grid = state.campus.grid;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] === 'tree' || grid[r][c] === 'path' || grid[r][c] === 'fountain') {
        grid[r][c] = 'empty';
      }
    }
  }
  state.campus.decorations = generateDecorations(grid, state.buildings || []);
}
