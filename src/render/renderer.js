import { bodyPositions } from '../sim/world.js';
import { solveKepler } from '../sim/kepler.js';
import { compressAU, bodyRadiusPx } from './scale.js';
import { worldToScreen } from './camera.js';

const TWO_PI = Math.PI * 2;
const AU_KM = 149597870.7;

export function createRenderer(canvas) {
  return { canvas, ctx: canvas.getContext('2d'), hits: new Map() };
}

export function resizeRenderer(renderer) {
  const { canvas, ctx } = renderer;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.floor(canvas.clientWidth * dpr);
  const h = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

export function drawWorld(renderer, world, camera) {
  const { ctx, canvas } = renderer;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  ctx.fillStyle = '#05060a';
  ctx.fillRect(0, 0, w, h);

  drawStarfield(ctx, w, h);

  ctx.strokeStyle = 'rgba(180, 200, 230, 0.18)';
  ctx.lineWidth = 1;
  for (const b of world.bodies) {
    if (b.kind === 'planet') drawOrbitTrace(ctx, b, camera, canvas);
  }

  const positions = bodyPositions(world);
  const screenById = new Map();
  const bodyById = new Map(world.bodies.map(x => [x.id, x]));
  renderer.hits.clear();
  for (const b of world.bodies) {
    let s;
    let displayR;
    if (b.kind === 'moon' && screenById.has(b.parent)) {
      // The moon is rendered in a compressed display frame around its
      // parent: position lifted out of true scale (would render inside
      // the parent's exaggerated disc) and into a frame where moons sit
      // visibly outside the planet. The compression breaks the natural
      // distance/period relationship — two moons at very different real
      // distances end up at nearly identical visual distances, but
      // their real Kepler periods differ by orders of magnitude. To
      // preserve the eye's expectation that visual distance maps to
      // orbital speed, we run Kepler's equation in the *display* frame:
      // each moon's mean motion is rescaled so its visual period
      // follows T ∝ visual_a^1.5 instead of T ∝ real_a^1.5. Inner and
      // outer moons of the same planet end up orbiting at speeds
      // proportional to where they appear, not where they really are.
      // The simulation itself is untouched — bodyPositions() still
      // returns the real positions; this fake-Kepler is render-only.
      const parent = bodyById.get(b.parent);
      const parentScreen = screenById.get(b.parent);
      const planetR_au = parent.r_km / AU_KM;
      const dispParentR_px = bodyRadiusPx(parent.r_km, camera.zoom);
      const realRatio = b.a / planetR_au;
      const visualRatio = 1.5 + 0.5 * Math.cbrt(realRatio);
      const visualN = b.n * Math.pow(realRatio / visualRatio, 1.5);
      const M = b.L0 + visualN * world.t - b.omega;
      const E = solveKepler(M, b.e);
      const sqrt1pe = Math.sqrt(1 + b.e);
      const sqrt1me = Math.sqrt(1 - b.e);
      const nu = 2 * Math.atan2(sqrt1pe * Math.sin(E / 2), sqrt1me * Math.cos(E / 2));
      const visualA_px = visualRatio * dispParentR_px;
      const r_px = visualA_px * (1 - b.e * Math.cos(E));
      const dirAngle = nu + b.omega;
      s = {
        sx: parentScreen.sx + r_px * Math.cos(dirAngle),
        sy: parentScreen.sy + r_px * Math.sin(dirAngle),
      };
      displayR = Math.max(2, dispParentR_px * Math.sqrt(b.r_km / parent.r_km));
    } else {
      const compressed = compressOrbital(positions.get(b.id));
      s = worldToScreen(camera, canvas, compressed.x, compressed.y);
    }
    screenById.set(b.id, s);
    drawBody(ctx, b, s, camera.zoom, displayR);
    if (b.kind !== 'asteroid') {
      const r = displayR ?? bodyRadiusPx(b.r_km, camera.zoom);
      renderer.hits.set(b.id, { sx: s.sx, sy: s.sy, r });
    }
  }
}

export function hitTest(x, y, hits) {
  let best = null;
  for (const [id, h] of hits) {
    const dist = Math.hypot(x - h.sx, y - h.sy);
    const tol = Math.max(8, h.r + 4);
    if (dist < tol && (best === null || dist < best.dist)) {
      best = { id, dist };
    }
  }
  return best ? best.id : null;
}

function compressOrbital(p) {
  const r = Math.hypot(p.x, p.y);
  if (r === 0) return { x: 0, y: 0 };
  const cr = compressAU(r);
  return { x: p.x * cr / r, y: p.y * cr / r };
}

function drawOrbitTrace(ctx, body, camera, canvas) {
  ctx.beginPath();
  const N = 240;
  const cosO = Math.cos(body.omega);
  const sinO = Math.sin(body.omega);
  const b = body.a * Math.sqrt(1 - body.e * body.e);
  for (let i = 0; i <= N; i++) {
    const E = (i / N) * TWO_PI;
    const xp = body.a * (Math.cos(E) - body.e);
    const yp = b * Math.sin(E);
    const x = xp * cosO - yp * sinO;
    const y = xp * sinO + yp * cosO;
    const c = compressOrbital({ x, y });
    const s = worldToScreen(camera, canvas, c.x, c.y);
    if (i === 0) ctx.moveTo(s.sx, s.sy); else ctx.lineTo(s.sx, s.sy);
  }
  ctx.closePath();
  ctx.stroke();
}

function drawBody(ctx, body, screen, zoom, overrideR) {
  const r = overrideR ?? bodyRadiusPx(body.r_km, zoom);
  if (body.kind === 'star') {
    const haloR = r * 2.2;
    const g = ctx.createRadialGradient(screen.sx, screen.sy, 0, screen.sx, screen.sy, haloR);
    g.addColorStop(0, 'rgba(255, 220, 130, 0.45)');
    g.addColorStop(0.5, 'rgba(255, 200, 90, 0.08)');
    g.addColorStop(1, 'rgba(255, 200, 90, 0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(screen.sx, screen.sy, haloR, 0, TWO_PI); ctx.fill();
    ctx.fillStyle = body.color;
    ctx.beginPath(); ctx.arc(screen.sx, screen.sy, r, 0, TWO_PI); ctx.fill();
    return;
  }
  ctx.fillStyle = body.color;
  ctx.beginPath(); ctx.arc(screen.sx, screen.sy, r, 0, TWO_PI); ctx.fill();
}

// Cheap deterministic-looking starfield. Doesn't use the sim RNG since this
// is purely cosmetic; redrawn each frame from a fixed pattern so it doesn't
// shimmer.
const STARS = (() => {
  const out = [];
  let s = 0x9e3779b1;
  for (let i = 0; i < 220; i++) {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r1 = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    s = (s + 0x6d2b79f5) >>> 0; t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r2 = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    s = (s + 0x6d2b79f5) >>> 0; t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r3 = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    out.push({ u: r1, v: r2, b: 0.15 + r3 * 0.45 });
  }
  return out;
})();

function drawStarfield(ctx, w, h) {
  for (const s of STARS) {
    ctx.fillStyle = `rgba(220, 230, 255, ${s.b.toFixed(3)})`;
    ctx.fillRect(s.u * w, s.v * h, 1, 1);
  }
}
