# Space Colonies

A 2D orbital colony simulation in the browser. Watch civilizations rise across a star system, or take command of one and steer it through centuries of expansion, scarcity, and schism.

See [DESIGN.md](DESIGN.md) for the full design document.

## Status

Pre-Phase 1. Repository scaffolding only.

## Build plan

1. **The Orrery** — solar system, Keplerian orbits, time controls
2. **Static Colonies** — population, resources, infrastructure
3. **Ships and Transfers** — Hohmann freight
4. **Autonomous Expansion** — colony ships, founding
5. **The Soul Layer** — tech graph, cultural drift, diplomacy, catastrophes, timeline
6. **Governor Mode** — player UI

Each phase lives on its own branch (`phase-1-orrery`, etc.), branched from `main`. The deployed site is served from the `live` branch via GitHub Pages.

## Stack

Vanilla HTML/CSS/JS, Canvas 2D, no framework, no backend.
