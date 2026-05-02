# Space Colonies

A 2D orbital colony simulation in the browser. Watch civilizations rise across a randomly-generated star system, or take command of one and steer it through centuries of expansion, scarcity, and schism. Each seed produces a unique system; same seed always gives the same one.

See [DESIGN.md](DESIGN.md) for the full design document.

## Status

Phase 2 — Static Colonies complete (tagged `v0.2-static-colonies`). Live at https://lewis-1664.github.io/Space-Colonies/.

## Build plan

1. ✓ **The Orrery** — procedural star system (one star, rolled planets, moons, optional asteroid belt), Keplerian orbits, time controls, click-to-inspect, seed input, pan/zoom camera
2. ✓ **Static Colonies** — 8-resource economic loop, hab/industry/spaceport tiers, finite body reserves, per-capita extraction, lit nightsides + city clusters + satellite swarms, live inspector with reserves and per-resource flows
3. **Ships and Transfers** — Hohmann freight
4. **Autonomous Expansion** — colony ships, founding
5. **The Soul Layer** — tech graph, cultural drift, diplomacy, catastrophes, timeline
6. **Governor Mode** — player UI

## Tests

`node tests/determinism.test.js` — verifies the simulation is byte-identical across two runs of the same seed. Required before merging changes that touch the sim.

Each phase lives on its own branch (`phase-1-orrery`, etc.), branched from `main`. The deployed site is served from the `live` branch via GitHub Pages.

## Stack

Vanilla HTML/CSS/JS, Canvas 2D, no framework, no backend.
