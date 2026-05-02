// Determinism smoke test (DESIGN.md §3 / §6). The simulation must produce
// byte-identical state for the same seed across two independent runs. If this
// breaks, anything that depends on seed reproducibility (replays, scenario
// sharing, debugging) breaks. Runs headless via Node (no DOM required) — the
// sim modules already have zero rendering dependencies.
//
// Usage: node tests/determinism.test.js

import { createWorld, advanceWorld } from '../src/sim/world.js';

function snapshot(w) {
  return JSON.stringify({
    t: w.t,
    bodies: w.bodies.map(b => ({
      id: b.id,
      composition: b.composition ?? null,
      reserves: b.reserves ?? null,
    })),
    colonies: w.colonies.map(c => ({
      id: c.id,
      population: c.population,
      morale: c.morale,
      habitationTier: c.habitationTier,
      industryTier: c.industryTier,
      researchTier: c.researchTier,
      spaceportTier: c.spaceportTier,
      stockpile: c.stockpile,
      foodShortfall: c.foodShortfall,
      goodsShortfall: c.goodsShortfall,
    })),
  });
}

function runOnce(seed, days) {
  const w = createWorld({ seed });
  advanceWorld(w, days);
  return snapshot(w);
}

const cases = [
  { seed: 'space-colonies', days: 10 * 365.25, label: 'default seed, 10 years' },
  { seed: 'space-colonies', days: 500 * 365.25, label: 'default seed, 500 years' },
  { seed: 'showcase', days: 200 * 365.25, label: 'showcase seed, 200 years' },
  { seed: 'test-seed-7', days: 50 * 365.25, label: 'arbitrary seed, 50 years' },
];

let failed = 0;
for (const { seed, days, label } of cases) {
  const a = runOnce(seed, days);
  const b = runOnce(seed, days);
  if (a === b) {
    console.log(`OK    ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL  ${label}`);
    // Find first divergence to make debugging easier.
    const oa = JSON.parse(a);
    const ob = JSON.parse(b);
    if (oa.t !== ob.t) console.error(`  world.t diverged: ${oa.t} vs ${ob.t}`);
    for (let i = 0; i < oa.colonies.length; i++) {
      const ca = JSON.stringify(oa.colonies[i]);
      const cb = JSON.stringify(ob.colonies[i]);
      if (ca !== cb) {
        console.error(`  colony[${i}] diverged:\n    A: ${ca}\n    B: ${cb}`);
        break;
      }
    }
  }
}

if (failed > 0) {
  console.error(`\n${failed}/${cases.length} cases failed determinism check.`);
  process.exit(1);
} else {
  console.log(`\nAll ${cases.length} cases deterministic.`);
}
