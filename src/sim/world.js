import { generateSystem } from './generate.js';
import { orbitalPosition } from './kepler.js';
import { makeRng, hashSeed } from './rng.js';

export const TICK_DAYS = 1;

export function createWorld({ seed = 'space-colonies' } = {}) {
  const seedInt = typeof seed === 'string' ? hashSeed(seed) : (seed >>> 0);
  const system = generateSystem(seedInt);
  return {
    seed,
    seedInt,
    rng: makeRng(seedInt),
    t: 0,
    bodies: system.bodies,
    starName: system.starName,
    planetCount: system.planetCount,
    beltCount: system.beltCount,
  };
}

export function advanceWorld(world, dtDays) {
  let remaining = dtDays;
  while (remaining > TICK_DAYS) {
    world.t += TICK_DAYS;
    remaining -= TICK_DAYS;
  }
  world.t += remaining;
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
