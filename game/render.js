/**
 * Draws the map on a canvas: terrain, rivers, roads, settlements, Deep
 * country, the party, and where it's headed. Blank tiles stay dark.
 */
import { TILE, getTile, squareAt } from "./world.js";

export const COLORS = {
  blank: "#1d1a16",
  plains: "#c9cf8f",
  forest: "#5c8a4a",
  hills: "#b39d63",
  mountains: "#8b8178",
  swamp: "#6b8466",
  desert: "#e2cd8c",
  lake: "#4f86bf",
  river: "#3b74b0",
  road: "#7a5230",
  grid: "rgba(0,0,0,0.12)",
  deep: "rgba(20,10,30,0.28)",
  party: "#c0392b",
  target: "#f4e2b8"
};

export function draw(canvas, state, view) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = COLORS.blank;
  ctx.fillRect(0, 0, W, H);

  const s = view.scale;
  const toScreen = (x, y) => [(x - view.cx) * s + W / 2, (y - view.cy) * s + H / 2];
  const x0 = Math.floor(view.cx - W / 2 / s) - 1, x1 = Math.ceil(view.cx + W / 2 / s) + 1;
  const y0 = Math.floor(view.cy - H / 2 / s) - 1, y1 = Math.ceil(view.cy + H / 2 / s) + 1;
  const world = state.world;

  // terrain
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const sq = squareAt(world, x, y);
    if (!sq) continue;
    const [px, py] = toScreen(x, y);
    ctx.fillStyle = sq.lake ? COLORS.lake : COLORS[sq.terrain];
    ctx.fillRect(px, py, s + 0.5, s + 0.5);
    if (!sq.lake) texture(ctx, sq.terrain, px, py, s, x, y);
  }

  // Deep country and tile grid
  const tx0 = Math.floor(x0 / TILE), tx1 = Math.floor(x1 / TILE), ty0 = Math.floor(y0 / TILE), ty1 = Math.floor(y1 / TILE);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const t = getTile(world, tx, ty);
    if (!t) continue;
    const [px, py] = toScreen(tx * TILE, ty * TILE);
    const size = TILE * s;
    if (t.deep) {
      ctx.fillStyle = COLORS.deep;
      ctx.fillRect(px, py, size, size);
      ctx.save();
      ctx.beginPath(); ctx.rect(px, py, size, size); ctx.clip();
      ctx.strokeStyle = "rgba(30,10,40,0.25)"; ctx.lineWidth = 1;
      for (let i = -size; i < size; i += Math.max(6, s / 2)) { ctx.beginPath(); ctx.moveTo(px + i, py + size); ctx.lineTo(px + i + size, py); ctx.stroke(); }
      ctx.restore();
    }
    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, size, size);
  }

  // rivers, then roads, joined square to square
  for (const [flag, color, width] of [["river", COLORS.river, 0.28], ["road", COLORS.road, 0.18]]) {
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, s * width); ctx.lineCap = "round";
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const sq = squareAt(world, x, y);
      if (!sq || !sq[flag]) continue;
      const [cx, cy] = toScreen(x + 0.5, y + 0.5);
      let joined = false;
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const o = squareAt(world, x + dx, y + dy);
        const edgeOfMap = !o && sq.tile && sq.tile[flag === "road" ? "roads" : "rivers"].length;
        if ((o && o[flag]) || (edgeOfMap && atTileEdge(x, y, dx, dy))) {
          const [ox, oy] = toScreen(x + 0.5 + dx * 0.5, y + 0.5 + dy * 0.5);
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ox, oy); ctx.stroke();
          joined = true;
        }
      }
      if (!joined) { ctx.beginPath(); ctx.arc(cx, cy, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
    }
  }

  // settlements
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const sq = squareAt(world, x, y);
    if (sq?.settlement) settlementIcon(ctx, sq.settlement, ...toScreen(x + 0.5, y + 0.5), s);
  }

  // places found
  const ICON = { lair: ["L", "#a33"], cave: ["C", "#444"], ruin: ["R", "#6b5a45"], barrow: ["B", "#5a4a6b"], source: ["✦", "#3b6fb0"], landmark: ["▲", "#555"], camp: ["×", "#7a5230"], ground: ["❦", "#3f6b33"] };
  for (const pl of Object.values(world.places || {})) {
    if (pl.x < x0 || pl.x > x1 || pl.y < y0 || pl.y > y1) continue;
    const [cx, cy] = toScreen(pl.x + 0.5, pl.y + 0.5);
    const [ch, col] = ICON[pl.type] || ["?", "#333"];
    const r = Math.max(5, s * 0.36);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "#f3e6c8"; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = col; ctx.stroke();
    ctx.fillStyle = col; ctx.font = `bold ${Math.round(r * 1.2)}px Georgia`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(ch, cx, cy + 1);
  }

  // route and target
  if (view.path?.length) {
    ctx.strokeStyle = COLORS.target; ctx.lineWidth = Math.max(1, s * 0.08); ctx.setLineDash([s * 0.2, s * 0.25]);
    ctx.beginPath();
    ctx.moveTo(...toScreen(state.party.x + 0.5, state.party.y + 0.5));
    for (const p of view.path) ctx.lineTo(...toScreen(p.x + 0.5, p.y + 0.5));
    ctx.stroke(); ctx.setLineDash([]);
  }
  if (state.target) {
    const [px, py] = toScreen(state.target.x + 0.5, state.target.y + 0.5);
    const r = s * 0.3;
    ctx.strokeStyle = COLORS.target; ctx.lineWidth = Math.max(2, s * 0.12);
    ctx.beginPath(); ctx.moveTo(px - r, py - r); ctx.lineTo(px + r, py + r); ctx.moveTo(px + r, py - r); ctx.lineTo(px - r, py + r); ctx.stroke();
  }

  // the party
  const [px, py] = toScreen(state.party.x + 0.5, state.party.y + 0.5);
  ctx.beginPath(); ctx.arc(px, py, Math.max(4, s * 0.36), 0, Math.PI * 2);
  ctx.fillStyle = COLORS.party; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = "#fff4dc"; ctx.stroke();

  // hover
  if (view.hover) {
    const [hx, hy] = toScreen(view.hover.x, view.hover.y);
    ctx.strokeStyle = "rgba(255,244,220,0.7)"; ctx.lineWidth = 1.5;
    ctx.strokeRect(hx + 0.5, hy + 0.5, s - 1, s - 1);
  }
}

const atTileEdge = (x, y, dx, dy) => {
  const lx = ((x % TILE) + TILE) % TILE, ly = ((y % TILE) + TILE) % TILE;
  return (dx === 1 && lx === TILE - 1) || (dx === -1 && lx === 0) || (dy === 1 && ly === TILE - 1) || (dy === -1 && ly === 0);
};

/** A little texture so terrain reads at a glance. Deterministic per square. */
function texture(ctx, terrain, px, py, s, x, y) {
  if (s < 10) return;
  const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
  const jx = (h % 7) / 14, jy = ((h >> 3) % 7) / 14;
  const cx = px + s * (0.3 + jx), cy = py + s * (0.3 + jy);
  ctx.lineWidth = 1;
  switch (terrain) {
    case "forest":
      ctx.fillStyle = "#3f6b33";
      ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.22); ctx.lineTo(cx + s * 0.16, cy + s * 0.14); ctx.lineTo(cx - s * 0.16, cy + s * 0.14); ctx.fill();
      break;
    case "hills":
      ctx.strokeStyle = "#8a7746";
      ctx.beginPath(); ctx.arc(cx, cy + s * 0.1, s * 0.18, Math.PI, 0); ctx.stroke();
      break;
    case "mountains":
      ctx.fillStyle = "#6a6159";
      ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.25); ctx.lineTo(cx + s * 0.22, cy + s * 0.15); ctx.lineTo(cx - s * 0.22, cy + s * 0.15); ctx.fill();
      ctx.fillStyle = "#e9e4dc";
      ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.25); ctx.lineTo(cx + s * 0.07, cy - s * 0.12); ctx.lineTo(cx - s * 0.07, cy - s * 0.12); ctx.fill();
      break;
    case "swamp":
      ctx.strokeStyle = "#4b6447";
      ctx.beginPath(); ctx.moveTo(cx - s * 0.18, cy); ctx.lineTo(cx + s * 0.18, cy); ctx.moveTo(cx - s * 0.1, cy + s * 0.1); ctx.lineTo(cx + s * 0.1, cy + s * 0.1); ctx.stroke();
      break;
    case "desert":
      ctx.fillStyle = "#c7b06f";
      ctx.fillRect(cx, cy, 1.5, 1.5); ctx.fillRect(cx + s * 0.2, cy + s * 0.15, 1.5, 1.5);
      break;
    default:
      if (h % 3 === 0) { ctx.fillStyle = "#a9b06f"; ctx.fillRect(cx, cy, 1.5, 1.5); }
  }
}

function settlementIcon(ctx, st, cx, cy, s) {
  const r = { hamlet: 0.22, roadhouse: 0.24, village: 0.3, town: 0.38, city: 0.46 }[st.size] * s;
  ctx.fillStyle = "#f3e6c8"; ctx.strokeStyle = "#3a2a1a"; ctx.lineWidth = Math.max(1, s * 0.07);
  if (st.size === "roadhouse") {
    ctx.beginPath(); ctx.rect(cx - r, cy - r * 0.7, r * 2, r * 1.4); ctx.fill(); ctx.stroke();
  } else if (st.size === "hamlet") {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(cx - r, cy + r); ctx.lineTo(cx - r, cy - r * 0.2); ctx.lineTo(cx, cy - r); ctx.lineTo(cx + r, cy - r * 0.2); ctx.lineTo(cx + r, cy + r); ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
  if (st.home) { ctx.fillStyle = "#c0392b"; ctx.beginPath(); ctx.arc(cx, cy + r * 0.2, Math.max(1.5, r * 0.3), 0, Math.PI * 2); ctx.fill(); }
}
