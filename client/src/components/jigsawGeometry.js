/**
 * Mathematical Jigsaw Puzzle Generator for 4x3 Grid (800x600)
 * Recreates the exact interlocking jigsaw tab layout from the reference design.
 */

const COLS = 4;
const ROWS = 3;
const W = 800;
const H = 600;
const cw = W / COLS; // 200
const rh = H / ROWS; // 200

// Vertical boundaries between columns (3 boundaries x 3 rows)
// +1: tab points to the right (+x)
// -1: tab points to the left (-x)
const vEdges = [
  // between col 0 and col 1 (x = 200)
  [-1, 1, -1],
  // between col 1 and col 2 (x = 400)
  [1, 1, 1],
  // between col 2 and col 3 (x = 600)
  [1, -1, 1],
];

// Horizontal boundaries between rows (4 columns x 2 boundaries)
// +1: tab points DOWN (+y)
// -1: tab points UP (-y)
const hEdges = [
  // col 0
  [-1, 1],
  // col 1
  [1, 1],
  // col 2
  [1, -1],
  // col 3
  [-1, 1],
];

function edgeSegment(x1, y1, x2, y2, dir) {
  if (dir === 0) return `L ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy * dir;
  const ny = ux * dir;

  const pt = (u, n) => {
    const px = x1 + ux * (u * len) + nx * n;
    const py = y1 + uy * (u * len) + ny * n;
    return `${px.toFixed(1)} ${py.toFixed(1)}`;
  };

  const tabH = 30; // height of jigsaw tab
  const pA = pt(0.38, 0);
  const c1 = pt(0.37, 2);
  const c2 = pt(0.35, 12);
  const pB = pt(0.32, 22);

  const c3 = pt(0.30, tabH);
  const c4 = pt(0.40, tabH + 2);
  const pC = pt(0.50, tabH + 2);

  const c5 = pt(0.60, tabH + 2);
  const c6 = pt(0.70, tabH);
  const pD = pt(0.68, 22);

  const c7 = pt(0.65, 12);
  const c8 = pt(0.63, 2);
  const pE = pt(0.62, 0);

  const pEnd = `${x2.toFixed(1)} ${y2.toFixed(1)}`;

  return `L ${pA} C ${c1}, ${c2}, ${pB} C ${c3}, ${c4}, ${pC} C ${c5}, ${c6}, ${pD} C ${c7}, ${c8}, ${pE} L ${pEnd}`;
}

export function getJigsawPieces() {
  const pieces = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const index = r * COLS + c;
      const x0 = c * cw;
      const x1 = (c + 1) * cw;
      const y0 = r * rh;
      const y1 = (r + 1) * rh;

      // 1. Top edge: (x0, y0) -> (x1, y0)
      const topDir = r === 0 ? 0 : hEdges[c][r - 1];

      // 2. Right edge: (x1, y0) -> (x1, y1)
      const rightDir = c === COLS - 1 ? 0 : -vEdges[c][r];

      // 3. Bottom edge: (x1, y1) -> (x0, y1)
      const bottomDir = r === ROWS - 1 ? 0 : -hEdges[c][r];

      // 4. Left edge: (x0, y1) -> (x0, y0)
      const leftDir = c === 0 ? 0 : vEdges[c - 1][r];

      let path = `M ${x0.toFixed(1)} ${y0.toFixed(1)} `;
      path += edgeSegment(x0, y0, x1, y0, topDir) + " ";
      path += edgeSegment(x1, y0, x1, y1, rightDir) + " ";
      path += edgeSegment(x1, y1, x0, y1, bottomDir) + " ";
      path += edgeSegment(x0, y1, x0, y0, leftDir) + " Z";

      pieces.push({
        index,
        displayNumber: String(index + 1).padStart(2, "0"),
        col: c,
        row: r,
        centerX: x0 + cw / 2,
        centerY: y0 + rh / 2,
        labelX: x0 + 16,
        labelY: y0 + 32,
        path,
      });
    }
  }

  return pieces;
}
