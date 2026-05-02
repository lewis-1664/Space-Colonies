import { bodyPositions, colonyByBodyId } from '../sim/world.js';
import { solveKepler } from '../sim/kepler.js';
import { compressAU, bodyRadiusPx } from './scale.js';
import { worldToScreen } from './camera.js';

const TWO_PI = Math.PI * 2;
const AU_KM = 149597870.7;

export function createRenderer(canvas) {
  return { canvas, ctx: canvas.getContext('2d'), hits: new Map(), flashState: new Map() };
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
  const coloniesByBody = colonyByBodyId(world);
  const sunScreen = worldToScreen(camera, canvas, 0, 0);
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
      // Pow-0.7 ratio sits between sqrt (which inflates moons to ~half the
      // parent at every zoom) and linear (which makes small moons disappear).
      // A 12%-real-ratio moon shows ~23%; a 1%-ratio moon shows ~3% — readable
      // at every scale while still smaller than its parent. Floor keeps tiny
      // moons visible at system view.
      displayR = Math.max(1.2, dispParentR_px * Math.pow(b.r_km / parent.r_km, 0.7));
    } else {
      const compressed = compressOrbital(positions.get(b.id));
      s = worldToScreen(camera, canvas, compressed.x, compressed.y);
    }
    screenById.set(b.id, s);
    drawBody(ctx, b, s, camera.zoom, displayR);
    if (b.kind !== 'asteroid') {
      const r = displayR ?? bodyRadiusPx(b.r_km, camera.zoom);
      renderer.hits.set(b.id, { sx: s.sx, sy: s.sy, r });
      if ((b.kind === 'planet' || b.kind === 'moon') && r >= 2.5) {
        const sun = sunDirFor(s, sunScreen);
        drawDayNightShading(ctx, s, r, sun);
        const colony = coloniesByBody.get(b.id);
        if (colony) drawColonyOnPlanet(ctx, s, r, sun, colony, renderer.flashState);
      }
    }
  }
}

function sunDirFor(bodyScreen, sunScreen) {
  const dx = sunScreen.sx - bodyScreen.sx;
  const dy = sunScreen.sy - bodyScreen.sy;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

// Linear gradient along the sun→antisolar axis, clipped to the body disc.
// Tight terminator: alpha climbs steeply between 0.42 and 0.58, then holds at
// near-black through the antisolar half. Mimics a lit/unlit hemisphere with a
// crisp day/night line rather than a soft fade across the whole body.
function drawDayNightShading(ctx, screen, bodyR, sun, depth = 0.88) {
  const x0 = screen.sx + sun.x * bodyR;
  const y0 = screen.sy + sun.y * bodyR;
  const x1 = screen.sx - sun.x * bodyR;
  const y1 = screen.sy - sun.y * bodyR;
  ctx.save();
  ctx.beginPath();
  ctx.arc(screen.sx, screen.sy, bodyR, 0, TWO_PI);
  ctx.clip();
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, 'rgba(0, 0, 0, 0)');
  g.addColorStop(0.42, 'rgba(0, 0, 0, 0)');
  g.addColorStop(0.58, `rgba(0, 0, 0, ${depth * 0.85})`);
  g.addColorStop(0.7, `rgba(0, 0, 0, ${depth})`);
  g.addColorStop(1, `rgba(0, 0, 0, ${depth})`);
  ctx.fillStyle = g;
  ctx.fillRect(screen.sx - bodyR, screen.sy - bodyR, bodyR * 2, bodyR * 2);
  ctx.restore();
}

const FLASH_DURATION_MS = 1200;
// Light count per habitation tier. Tier 1 is a sparse pioneer settlement (3
// lights); tier 5 fills the available skyline (50). Curve is concave so each
// upgrade past tier 2 adds many more lights — a metropolis bloom.
const LIGHTS_PER_HAB_TIER = [0, 3, 10, 22, 36, 50];

// Civilization on a planet: warm nightside glow whose intensity scales with
// population × morale, plus city lights on the antisolar half of the disc.
// Sun direction is precomputed in screen space by the caller. At close zoom
// each city light becomes a small geometric "block" cluster so a metropolis
// reads as a place, not a pixel. Tier-up flash is a brief expanding ring keyed
// off real time so it's visible at every time-rate.
function drawColonyOnPlanet(ctx, screen, bodyR, sun, colony, flashState) {
  const popFactor = Math.min(1, Math.log10(colony.population / 1000 + 1) / 4);
  const moraleFactor = Math.max(0.3, colony.morale);
  const intensity = popFactor * moraleFactor;

  drawNightsideGlow(ctx, screen, bodyR, sun, intensity);

  if (bodyR >= 3 && colony.cities && colony.cities.length > 0) {
    const visibility = Math.min(1, (bodyR - 3) / 6);
    const tier = Math.max(0, Math.min(LIGHTS_PER_HAB_TIER.length - 1, colony.habitationTier));
    const reveal = Math.min(colony.cities.length, LIGHTS_PER_HAB_TIER[tier]);
    drawCityLights(ctx, screen, bodyR, sun, colony, reveal, visibility, intensity);
  }

  drawSpaceportRing(ctx, screen, bodyR, colony);
  drawTierUpFlash(ctx, screen, bodyR, colony, flashState);
}

function drawNightsideGlow(ctx, screen, bodyR, sun, intensity) {
  if (intensity <= 0) return;
  const cx = screen.sx - sun.x * bodyR * 0.35;
  const cy = screen.sy - sun.y * bodyR * 0.35;
  ctx.save();
  ctx.beginPath();
  ctx.arc(screen.sx, screen.sy, bodyR, 0, TWO_PI);
  ctx.clip();
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, bodyR * 1.2);
  g.addColorStop(0, `rgba(255, 200, 130, ${0.55 * intensity})`);
  g.addColorStop(0.5, `rgba(255, 170, 100, ${0.25 * intensity})`);
  g.addColorStop(1, 'rgba(255, 150, 80, 0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(screen.sx - bodyR, screen.sy - bodyR, bodyR * 2, bodyR * 2);
  ctx.restore();
}

// Three-layer rendering per visible city:
//  1. The pinprick light itself — always drawn (the colony's nightside skyline).
//  2. At close zoom: a couple of small rectangular building blocks just off the
//     light, fading in by hab tier (more rooftops as the metropolis grows).
//  3. At close zoom + industry tier ≥ 2: 1–3 tall thin smokestack marks per city
//     with faint smoke wisps, suggesting heavy industry visible from orbit.
// Building/smokestack positions are deterministic per city (seeded by index).
function drawCityLights(ctx, screen, bodyR, sun, colony, count, visibility, intensity) {
  // Cap light radius — they're "pinpricks" at every zoom, not blobs that
  // swallow the surrounding building detail at extreme close-up.
  const lightR = Math.max(0.5, Math.min(2.2, bodyR * 0.045));
  const detailFade = bodyR >= 22 ? Math.min(1, (bodyR - 22) / 18) : 0;
  // Building/smokestack offsets scale with planet display radius so the
  // metropolis spreads as the camera zooms in instead of clumping at the dot.
  const detailScale = Math.max(1, bodyR * 0.04);
  const cities = colony.cities;

  // Pass 1 (additive): lit windows + warm rooftops on the antisolar half.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const c = cities[i];
    const dot = c.x * sun.x + c.y * sun.y;
    if (dot >= 0) continue;
    const edge = Math.min(1, -dot / 0.3);
    const alpha = Math.min(1, visibility * intensity * edge * 1.4);
    if (alpha <= 0) continue;
    const px = screen.sx + c.x * bodyR;
    const py = screen.sy + c.y * bodyR;
    ctx.fillStyle = `rgba(255, 220, 140, ${alpha})`;
    ctx.beginPath();
    ctx.arc(px, py, lightR, 0, TWO_PI);
    ctx.fill();
    if (detailFade > 0) {
      drawCityDetails(ctx, px, py, alpha * detailFade, i, colony, detailScale, true);
    }
  }
  ctx.restore();

  // Pass 2 (normal alpha, close-zoom only): daylit cities — no glow, just
  // small darker rooftops/structures visible against the lit hemisphere. Cities
  // exist on the day side too; they're just not lit up. Skipped at low zoom
  // to keep the system view clean.
  if (detailFade > 0) {
    ctx.save();
    for (let i = 0; i < count; i++) {
      const c = cities[i];
      const dot = c.x * sun.x + c.y * sun.y;
      if (dot < 0) continue;
      const edge = Math.min(1, dot / 0.3);
      const alpha = Math.min(1, visibility * 0.6 * edge * detailFade);
      if (alpha <= 0) continue;
      const px = screen.sx + c.x * bodyR;
      const py = screen.sy + c.y * bodyR;
      drawCityDetails(ctx, px, py, alpha, i, colony, detailScale, false);
    }
    ctx.restore();
  }
}

function drawCityDetails(ctx, px, py, alpha, salt, colony, scale, lit) {
  // Building blocks: 1 at hab tier 1, up to 4 at hab tier 5. Suggest the dense
  // rooftops of a tier-5 metropolis vs. a tier-1 outpost. On the lit side the
  // blocks are warm (sunlit rooftops); on the dark side they take the warm
  // city-glow tone (lit windows / illuminated facades).
  const buildingCount = Math.min(4, Math.max(1, colony.habitationTier - 1));
  const blockSize = Math.max(1, Math.round(scale * 0.5));
  ctx.fillStyle = lit
    ? `rgba(255, 215, 140, ${alpha * 0.85})`
    : `rgba(60, 50, 45, ${alpha})`;
  for (let j = 0; j < buildingCount; j++) {
    const a = (salt * 0.61803 + j * 1.25664) % TWO_PI;
    const r = (1.0 + ((salt + j) & 1) * 0.7) * scale;
    const w = blockSize + ((salt + j) & 1);
    const h = blockSize + ((salt + j + 1) & 1);
    ctx.fillRect(px + Math.cos(a) * r - w / 2, py + Math.sin(a) * r - h / 2, w, h);
  }

  // Smokestacks: heavy industry hits at tier 2+. Tall thin verticals with a
  // faint smoke pixel above. Cool grey on both sides so industry reads
  // distinct from civic life.
  const stackCount = colony.industryTier >= 2 ? Math.min(3, colony.industryTier - 1) : 0;
  const stackW = Math.max(1, Math.round(scale * 0.4));
  const stackH = Math.max(2, Math.round(scale * 1.2));
  for (let j = 0; j < stackCount; j++) {
    const a = (salt * 0.7 + j * 2.0 + 1.0) % TWO_PI;
    const r = (1.8 + ((salt + j) & 1) * 0.4) * scale;
    const sx = px + Math.cos(a) * r;
    const sy = py + Math.sin(a) * r;
    ctx.fillStyle = lit
      ? `rgba(180, 200, 220, ${alpha * 0.65})`
      : `rgba(70, 80, 90, ${alpha * 0.9})`;
    ctx.fillRect(sx - stackW / 2, sy - stackH / 2, stackW, stackH);
    ctx.fillStyle = lit
      ? `rgba(220, 220, 220, ${alpha * 0.35})`
      : `rgba(120, 120, 130, ${alpha * 0.5})`;
    ctx.fillRect(sx - stackW / 2, sy - stackH / 2 - stackW, stackW, stackW);
  }
}

// Satellite swarm: a thin orbital band of small dots, denser at higher
// spaceport tiers. Reads as "this colony has many satellites in orbit" rather
// than "colossal infrastructure ring." Positions are deterministic per
// satellite index so the swarm is stable as the camera pans, and the band has
// a small radial spread so it looks like a real belt rather than a perfect
// circle. Phase 2 colonies start at spaceportTier 0 so this is invisible by
// default — it lights up when Phase 3 wires spaceport upgrades.
function drawSpaceportRing(ctx, screen, bodyR, colony) {
  const tier = colony.spaceportTier;
  if (tier <= 0) return;
  const ringR = bodyR * 1.5;
  const halfWidth = Math.max(1, bodyR * 0.06);
  const satCount = tier * 18;
  // Satellites scale with body display radius so they stay visible against
  // bigger planets when zoomed in — capped at 3 px so they read as specks,
  // not chunks. At system zoom (bodyR ≈ 6) they're 1 px; at extreme close
  // zoom (bodyR ≈ 200+) they top out at 3 px.
  const satSize = Math.max(1, Math.min(3, bodyR * 0.022));
  ctx.save();
  ctx.fillStyle = 'rgba(220, 240, 255, 0.85)';
  for (let i = 0; i < satCount; i++) {
    const f1 = ((i * 0.61803398875) % 1);
    const f2 = ((i * 0.31415926535) % 1);
    const angle = (i / satCount) * TWO_PI + f1 * 0.4;
    const radius = ringR + (f2 * 2 - 1) * halfWidth;
    const sx = screen.sx + Math.cos(angle) * radius;
    const sy = screen.sy + Math.sin(angle) * radius;
    ctx.fillRect(sx - satSize / 2, sy - satSize / 2, satSize, satSize);
  }
  ctx.restore();
}

function drawTierUpFlash(ctx, screen, bodyR, colony, flashState) {
  const tierTotal = colony.habitationTier + colony.industryTier;
  let s = flashState.get(colony.id);
  if (!s) {
    s = { tierTotal, flashStart: 0 };
    flashState.set(colony.id, s);
  } else if (s.tierTotal !== tierTotal) {
    s.tierTotal = tierTotal;
    s.flashStart = performance.now();
  }
  if (!s.flashStart) return;
  const dt = performance.now() - s.flashStart;
  if (dt > FLASH_DURATION_MS) return;
  const t = dt / FLASH_DURATION_MS;
  const r = bodyR * (1.0 + t * 1.6);
  const alpha = (1 - t) * 0.85;
  ctx.strokeStyle = `rgba(255, 220, 140, ${alpha})`;
  ctx.lineWidth = 2 * (1 - t * 0.5);
  ctx.beginPath();
  ctx.arc(screen.sx, screen.sy, r, 0, TWO_PI);
  ctx.stroke();
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
