/**
 * Rektör Oldum — Kampüs Harita Çizici (campus-renderer.js)
 * İzometrik 2D kampüs görselleştirmesi — Canvas 2D API
 */

import { GRID_SIZE, BUILDING_FOOTPRINTS } from './campus-layout.js';

// ─────────────────────────────────────────────────────────────────────────────
// SABİTLER
// ─────────────────────────────────────────────────────────────────────────────

const TILE_W = 64;
const TILE_H = 32;
const CANVAS_W = 960;
const CANVAS_H = 600;
const ORIGIN_X = CANVAS_W / 2;
const ORIGIN_Y = 60;

// Bina görsel stilleri
const BUILDING_STYLES = {
  fakulte_binasi:    { top: '#4a6a9a', left: '#3a5480', right: '#2a3e66', height: 56, label: 'F', windows: true },
  arastirma_merkezi: { top: '#b0c8e0', left: '#90a8c0', right: '#6888a0', height: 50, label: 'A', dome: true },
  lab:               { top: '#3a8a5a', left: '#2a6a44', right: '#1a5030', height: 34, label: 'L' },
  kutuphane:         { top: '#9a7040', left: '#7a5830', right: '#5a4020', height: 46, label: 'K', arch: true },
  yurt:              { top: '#d89830', left: '#b07820', right: '#886010', height: 42, label: 'Y', residential: true },
  yemekhane:         { top: '#c04040', left: '#a03030', right: '#802020', height: 30, label: 'Ye' },
  spor_tesisi:       { top: '#40a040', left: '#308030', right: '#206020', height: 22, label: 'S', field: true },
  konferans:         { top: '#304878', left: '#203860', right: '#102848', height: 46, label: 'Ko' },
  amfi:              { top: '#a0a0a0', left: '#808080', right: '#606060', height: 38, label: 'Am', tiered: true },
  teknokent:         { top: '#2870b0', left: '#205898', right: '#184080', height: 68, label: 'T', glass: true },
};

// Zemin renkleri
const COLORS = {
  grass: '#1a4a28',
  grassLight: '#1e5830',
  grassStroke: '#164020',
  path: '#5a5040',
  pathStroke: '#4a4030',
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
  const cx = px * scaleX;
  const cy = py * scaleY;

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

function drawGrassTile(ctx, col, row) {
  const { x, y } = isoProject(col, row);
  const shade = ((col + row) % 2 === 0) ? COLORS.grass : COLORS.grassLight;
  drawIsoDiamond(ctx, x, y + TILE_H / 2, TILE_W, TILE_H, shade, COLORS.grassStroke);
}

function drawPathTile(ctx, col, row) {
  const { x, y } = isoProject(col, row);
  drawIsoDiamond(ctx, x, y + TILE_H / 2, TILE_W, TILE_H, COLORS.path, COLORS.pathStroke);
}

function drawTree(ctx, col, row) {
  const { x, y } = isoProject(col, row);
  const baseY = y + TILE_H / 2;

  // Zemin
  drawIsoDiamond(ctx, x, baseY, TILE_W, TILE_H, COLORS.grassLight, COLORS.grassStroke);

  // Gövde
  ctx.fillStyle = COLORS.treeTrunk;
  ctx.fillRect(x - 2, baseY - 22, 4, 14);

  // Kanopi (üçgen/yuvarlak)
  ctx.beginPath();
  ctx.arc(x, baseY - 28, 10, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.treeCanopy;
  ctx.fill();

  // Kanopi highlight
  ctx.beginPath();
  ctx.arc(x - 2, baseY - 30, 6, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.treeCanopyLight;
  ctx.fill();
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
// ÇİZİM: BİNALAR
// ─────────────────────────────────────────────────────────────────────────────

function drawBuilding(ctx, building, state) {
  const style = BUILDING_STYLES[building.type];
  if (!style) return;

  const gx = building.gridX;
  const gy = building.gridY;
  const gw = building.gridW || 1;
  const gh = building.gridH || 1;

  // Multi-tile bina: merkez noktasını hesapla
  const centerCol = gx + gw / 2;
  const centerRow = gy + gh / 2;
  const { x, y } = isoProject(centerCol, centerRow);
  const baseY = y + TILE_H / 2;

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

function _drawBuildingBody(ctx, x, baseY, buildW, buildH, height, style, building) {
  const hw = buildW / 2;
  const hh = buildH / 2;

  // Üst yüz
  ctx.beginPath();
  ctx.moveTo(x, baseY - hh - height);
  ctx.lineTo(x + hw, baseY - height);
  ctx.lineTo(x, baseY + hh - height);
  ctx.lineTo(x - hw, baseY - height);
  ctx.closePath();
  ctx.fillStyle = style.top;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Sol duvar
  ctx.beginPath();
  ctx.moveTo(x - hw, baseY - height);
  ctx.lineTo(x, baseY + hh - height);
  ctx.lineTo(x, baseY + hh);
  ctx.lineTo(x - hw, baseY);
  ctx.closePath();
  ctx.fillStyle = style.left;
  ctx.fill();

  // Sağ duvar
  ctx.beginPath();
  ctx.moveTo(x + hw, baseY - height);
  ctx.lineTo(x, baseY + hh - height);
  ctx.lineTo(x, baseY + hh);
  ctx.lineTo(x + hw, baseY);
  ctx.closePath();
  ctx.fillStyle = style.right;
  ctx.fill();

  // Pencereler (windows: true olan binalar)
  if (style.windows && building.isCompleted) {
    _drawWindows(ctx, x, baseY, hw, hh, height);
  }

  // Kubbe (dome: true — araştırma merkezi)
  if (style.dome && building.isCompleted) {
    ctx.beginPath();
    ctx.ellipse(x, baseY - height - 6, hw * 0.3, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#d0d8e0';
    ctx.fill();
  }

  // Cam yüzey (glass: true — teknokent)
  if (style.glass && building.isCompleted) {
    ctx.fillStyle = 'rgba(100, 180, 255, 0.15)';
    ctx.beginPath();
    ctx.moveTo(x + hw, baseY - height);
    ctx.lineTo(x, baseY + hh - height);
    ctx.lineTo(x, baseY + hh);
    ctx.lineTo(x + hw, baseY);
    ctx.closePath();
    ctx.fill();
  }

  // Basamaklı yapı (tiered: true — amfi)
  if (style.tiered && building.isCompleted) {
    for (let step = 0; step < 3; step++) {
      const stepH = height * (step + 1) / 4;
      const stepW = hw * (4 - step) / 4;
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - stepW, baseY - stepH);
      ctx.lineTo(x + stepW, baseY - stepH);
      ctx.stroke();
    }
  }
}

function _drawWindows(ctx, x, baseY, hw, hh, height) {
  ctx.fillStyle = 'rgba(200, 220, 255, 0.4)';
  const rows = Math.max(1, Math.floor(height / 18));
  const cols = Math.max(1, Math.floor(hw / 12));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wy = baseY - height + 10 + r * 16;
      // Sol duvar pencereleri
      const wx = x - hw + 8 + c * 12;
      ctx.fillRect(wx, wy, 5, 7);
    }
  }
}

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

function _drawLevelBadge(ctx, x, y, level) {
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#f0c040';
  ctx.fill();
  ctx.strokeStyle = '#a08020';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#1a1a2e';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(level, x, y);
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

export function renderCampusMap(canvas, state) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  // Arkaplan
  ctx.fillStyle = '#0a1f12';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const campus = state.campus;
  if (!campus || !campus.grid) return;

  const grid = campus.grid;
  const size = grid.length;
  const buildings = state.buildings || [];
  const decorations = campus.decorations || [];

  // Painter's algorithm: col + row sırasıyla çiz
  // 1. Önce tüm zemin tile'ları
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const tile = grid[row][col];
      if (tile === 'path') {
        drawPathTile(ctx, col, row);
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
  // Tüm çizilebilir nesneleri toplayıp sırala
  const renderables = [];

  // Dekorasyonlar (tree, fountain)
  for (const dec of decorations) {
    if (dec.type === 'tree' || dec.type === 'fountain') {
      renderables.push({ type: dec.type, col: dec.col, row: dec.row, depth: dec.col + dec.row, data: dec });
    }
  }

  // Binalar
  for (const b of buildings) {
    if (b.gridX == null || b.gridY == null) continue;
    renderables.push({ type: 'building', col: b.gridX, row: b.gridY, depth: b.gridX + b.gridY + (b.gridW || 1) + (b.gridH || 1), data: b });
  }

  // Derinlik sırasıyla çiz
  renderables.sort((a, b) => a.depth - b.depth);

  for (const r of renderables) {
    if (r.type === 'tree') {
      drawTree(ctx, r.col, r.row);
    } else if (r.type === 'fountain') {
      drawFountain(ctx, r.col, r.row);
    } else if (r.type === 'building') {
      drawBuilding(ctx, r.data, state);
    }
  }

  // 5. Kampüs etiketi
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${state.university?.name || 'Üniversite'} Yerleşkesi`, 12, CANVAS_H - 12);

  const totalArea = buildings.reduce((s, b) => s + (b.isCompleted ? (b.area || 0) : 0), 0);
  ctx.textAlign = 'right';
  ctx.fillText(`${buildings.filter(b => b.isCompleted).length} bina · ${totalArea.toLocaleString('tr-TR')} m²`, CANVAS_W - 12, CANVAS_H - 12);
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
