import { generateSystem } from './generate.js';
import { orbitalPosition } from './kepler.js';
import { makeRng, hashSeed } from './rng.js';
import { colonyTick, buildShowcaseColonies } from './colony.js';

export const TICK_DAYS = 1;

// Magic seed: replaces the normal 2 starter colonies with 6 hand-tuned ones
// spanning every visual stage (pioneer, town, industrial, spaceport, megapolis,
// hungry). Lets visual changes be verified in one regen instead of by waiting.
// Pinned to integer seed 45 (Selene system, 8 planets / 7 rocky) so the
// showcase has enough rocky bodies for every colony stage.
const SHOWCASE_SEED = 'showcase';
const SHOWCASE_INT_SEED = 45;

export function createWorld({ seed = 'space-colonies' } = {}) {
  const isShowcase = seed === SHOWCASE_SEED;
  const seedInt = isShowcase
    ? SHOWCASE_INT_SEED
    : (typeof seed === 'string' ? hashSeed(seed) : (seed >>> 0));
  const system = generateSystem(seedInt);
  const colonies = isShowcase
    ? buildShowcaseColonies(system.bodies, makeRng(seedInt ^ 0xc0ffee))
    : system.colonies;
  return {
    seed,
    seedInt,
    rng: makeRng(seedInt),
    t: 0,
    tickAccumulator: 0,
    bodies: system.bodies,
    colonies,
    starName: system.starName,
    planetCount: system.planetCount,
    beltCount: system.beltCount,
  };
}

// world.t advances continuously so Kepler renders smoothly at every rate.
// Colony economics fire on whole-day boundaries (DESIGN §6, fixed-timestep
// simulation), batched via tickAccumulator so they're frame-rate-independent.
export function advanceWorld(world, dtDays) {
  if (dtDays <= 0) return;
  world.t += dtDays;
  if (world.colonies.length === 0) return;
  world.tickAccumulator += dtDays;
  const bodyById = world.bodyById ??= new Map(world.bodies.map(b => [b.id, b]));
  while (world.tickAccumulator >= TICK_DAYS) {
    for (const c of world.colonies) colonyTick(world, c, bodyById, TICK_DAYS);
    world.tickAccumulator -= TICK_DAYS;
  }
}

export function bodyPositions(world) {
  const out = new Map();
  for (const b of world.bodies) {
    if (b.parent === null) {
      out.set(b.id, { x: 0, y: 0 });
      continue;
    }
    const parent = out.get(b.parent);
    const local = orbitalPosition(b.a, b.e, b.omega, b.L0, b.n, world.t);
    out.set(b.id, { x: parent.x + local.x, y: parent.y + local.y });
  }
  return out;
}

export function colonyByBodyId(world) {
  const map = new Map();
  for (const c of world.colonies) map.set(c.bodyId, c);
  return map;
}
