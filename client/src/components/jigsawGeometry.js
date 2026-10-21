/**
 * Seeded irregular jigsaw generator for a 4 × 3 board (800 × 600).
 * Shared vertices and edge specifications keep neighbouring pieces perfectly
 * interlocked while avoiding the appearance of twelve identical rectangles.
 */

const COLS = 4;
const ROWS = 3;
const W = 800;
const H = 600;
const cw = W / COLS;
const rh = H / ROWS;

function seededRandom(seed = 0x51a7f00d) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function createEdge(random) {
  return {
    dir: random() > 0.5 ? 1 : -1,
    depth: 22 + random() * 21,
    span: 0.14 + random() * 0.08,
    crown: 0.07 + random() * 0.035,
  };
}

function edgeSegment(start, end, edge) {
  if (!edge) return `L ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy * edge.dir;
  const ny = ux * edge.dir;
  const point = (along, normal = 0) => ({
    x: start.x + ux * along * len + nx * normal,
    y: start.y + uy * along * len + ny * normal,
  });
  const format = (pointValue) => `${pointValue.x.toFixed(1)} ${pointValue.y.toFixed(1)}`;

  const outer = edge.span;
  const inner = edge.crown;
  const depth = edge.depth;
  const a = point(0.5 - outer);
  const b = point(0.5 - inner, depth * 0.9);
  const c = point(0.5, depth);
  const d = point(0.5 + inner, depth * 0.9);
  const e = point(0.5 + outer);

  return [
    `L ${format(a)}`,
    `C ${format(point(0.5 - outer * 0.92, depth * 0.12))}, ${format(point(0.5 - outer * 0.8, depth * 0.7))}, ${format(b)}`,
    `C ${format(point(0.5 - inner * 0.7, depth))}, ${format(point(0.5 - inner * 0.32, depth))}, ${format(c)}`,
    `C ${format(point(0.5 + inner * 0.32, depth))}, ${format(point(0.5 + inner * 0.7, depth))}, ${format(d)}`,
    `C ${format(point(0.5 + outer * 0.8, depth * 0.7))}, ${format(point(0.5 + outer * 0.92, depth * 0.12))}, ${format(e)}`,
    `L ${format(end)}`,
  ].join(" ");
}

function reverseEdge(edge) {
  return edge ? { ...edge, dir: -edge.dir } : null;
}

export function getJigsawPieces() {
  const random = seededRandom();
  const vertices = Array.from({ length: ROWS + 1 }, (_, row) =>
    Array.from({ length: COLS + 1 }, (_, col) => ({
      x: col * cw + (col > 0 && col < COLS ? (random() - 0.5) * 42 : 0),
      y: row * rh + (row > 0 && row < ROWS ? (random() - 0.5) * 38 : 0),
    })),
  );

  const verticalEdges = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS - 1 }, () => createEdge(random)),
  );
  const horizontalEdges = Array.from({ length: ROWS - 1 }, () =>
    Array.from({ length: COLS }, () => createEdge(random)),
  );

  const pieces = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const index = row * COLS + col;
      const topLeft = vertices[row][col];
      const topRight = vertices[row][col + 1];
      const bottomRight = vertices[row + 1][col + 1];
      const bottomLeft = vertices[row + 1][col];
      const top = row === 0 ? null : horizontalEdges[row - 1][col];
      const right = col === COLS - 1 ? null : verticalEdges[row][col];
      const bottom = row === ROWS - 1 ? null : reverseEdge(horizontalEdges[row][col]);
      const left = col === 0 ? null : reverseEdge(verticalEdges[row][col - 1]);

      const path = [
        `M ${topLeft.x.toFixed(1)} ${topLeft.y.toFixed(1)}`,
        edgeSegment(topLeft, topRight, top),
        edgeSegment(topRight, bottomRight, right),
        edgeSegment(bottomRight, bottomLeft, bottom),
        edgeSegment(bottomLeft, topLeft, left),
        "Z",
      ].join(" ");

      const centerX = (topLeft.x + topRight.x + bottomRight.x + bottomLeft.x) / 4;
      const centerY = (topLeft.y + topRight.y + bottomRight.y + bottomLeft.y) / 4;
      const minX = Math.min(topLeft.x, topRight.x, bottomRight.x, bottomLeft.x);
      const minY = Math.min(topLeft.y, topRight.y, bottomRight.y, bottomLeft.y);

      pieces.push({
        index,
        displayNumber: String(index + 1).padStart(2, "0"),
        centerX,
        centerY,
        labelX: minX + 16,
        labelY: minY + 31,
        path,
      });
    }
  }

  return pieces;
}
