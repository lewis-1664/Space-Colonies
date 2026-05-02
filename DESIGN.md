# Space Colonies — Design Document

A 2D orbital colony simulation in the browser. Watch civilizations rise across a star system, or take command of one and steer it through centuries of expansion, scarcity, and schism.

**Repository:** https://github.com/lewis-1664/Space-Colonies

---

## 1. Vision

A single-page HTML/JS application where the player observes (or governs) the spread of human civilization across a randomly-generated star system. Colonies harvest planets and moons for resources, build ships, found new colonies, trade, fracture, collapse, and rebuild. Real Keplerian physics governs movement. Travel takes time. Communication is bound by the speed of light. Every run is a story the simulation tells, in a star system the simulation generated.

The project supports two modes that share the same underlying simulation:

- **Sandbox (Watchmaker).** Set up a system, seed it with starter colonies, press play, and observe. The player can pause, scrub time, inspect any body, and intervene lightly — fund a project, trigger an event, edit a parameter. Designed to be left running and dipped into.
- **Campaign (Governor).** The player adopts one colony as their own at the start. All other colonies run on the same autonomous AI as Sandbox mode, so rivals are real and unpredictable. The player issues directives, allocates resources, and dispatches ships while the universe keeps moving around them.

The two modes share roughly 95% of the codebase. Governor mode is Sandbox mode with one colony's autonomy handed to the player. The autonomous colony AI is built first; the player slots in cleanly as "the colony whose decisions come from outside."

## 2. Tone & Feel

- **Timescale:** Centuries. A run spans 200–500 in-game years.
- **Mood:** Hopeful but precarious. Closer to *Foundation* than *Dwarf Fortress*; not utopian, not grimdark.
- **Failure is real.** Colonies can go extinct. Total human collapse back to one world is possible, and that possibility is what makes survival mean something.
- **Legibility:** The player sees what an observer would reasonably see. Numbers exist but are surfaced through interaction, not dumped on screen.
- **View:** Top-down ecliptic, 2D. Distances log-scaled or otherwise compressed — true-to-scale star systems are unreadable. Pretty-not-accurate is the correct trade-off.

## 3. Locked-In Choices

These are decided. Don't relitigate them mid-build.

- **2D only.** No 3D, ever.
- **Procedurally generated star system.** Each seed produces a unique system — star, planets, moons. Planet count varies per seed. Anything goes for layout: rocky inside, gas outside, mixed, weird — the generator is not constrained to imitate our solar system. Player attachment is per-run, anchored to in-system names rather than to *Mars*.
- **One star for now, designed for two later.** The generator emits a single star at the barycentre. The body model and renderer treat "the central thing" as generic so a binary system can be slotted in without restructuring.
- **Determinism with seeds.** Every simulation has a seed. Same seed = same generated system + same outcome. Critical for debugging, sharing scenarios, and player retries.
- **Fixed-timestep simulation, decoupled from rendering.** All randomness draws from the seeded RNG.
- **Time scale:** Base rate 1x = 1 in-game day per real second. Multipliers up to ~10000x (about 30 in-game years per real second).
- **Population is abstract.** Tracked as a number plus derived stats (growth rate, education, morale). Named figures are narrative overlays, not simulated agents.
- **Colony cap:** Design for up to ~50 simultaneous colonies. Beyond that, the timeline becomes unreadable and AI bookkeeping bogs down.
- **Resource list:** Eight types — water/ice, metals, rare earths, fissile material, hydrocarbons, silicates, food (derived), manufactured goods (derived).
- **Pause-and-play in both modes.** Critical events auto-pause and surface a notification.

## 4. Core Systems

### 4.1 Star System & Physics

- One star at the centre. Planet count varies per seed (typically 4–12). Each planet rolls a type (rocky, ice, ice giant, gas giant, etc.), which drives its radius, density, colour palette, and likely moon count. Moons are rolled per planet within the planet's Hill sphere. Asteroid belts may slot into wide gaps between planets.
- Each body has: mass, semi-major axis, eccentricity, inclination (likely ignored for 2D), axial tilt, atmosphere descriptor, surface composition vector. Generation populates these from the seed; the simulation is agnostic to whether a system was hand-authored or generated.
- Orbits computed via Kepler's equations. Fast, stable, deterministic. **Do not** use full N-body — it's a performance and gameplay trap.
- Architecture supports a second star (binary system) — the generator simply does not produce one yet.
- Time controls: pause, 1x, 10x, 100x, 1000x, 10000x. Smooth transitions between rates.

#### 4.1.1 Coordinate frames (and SOI transitions)

The simulation uses **two coordinate frames**, switched at parent boundaries. This is the standard real-orbital-mechanics pattern: a spacecraft far from a planet lives in heliocentric coords, and inside the planet's sphere of influence (SOI) it lives in planet-relative coords.

- **Heliocentric frame.** Bodies whose `parent` is the star (planets, asteroid belt members) and ships in long-distance transit. Positions are real AU. For display, `compressAU` (asinh) is applied so inner and outer planets fit on one screen, but the simulation itself uses uncompressed real values.
- **Parent-relative frame.** Bodies whose `parent` is a planet (moons, and in Phase 3, ships in approach or low orbit). Positions are stored relative to the parent. Real moon distances are roughly 10⁻³ to 10⁻² AU — invisibly small at heliocentric scale — so the renderer projects parent-relative positions through a *parent-frame transform* tied to the parent's exaggerated display radius. Moons end up visible alongside their parent at any zoom; the visual radius is decoupled from real AU but is internally consistent and zoom-stable.

The parent-frame display transform also applies *Kepler in the display frame* (`n_visual = n_real × (real_ratio / visual_ratio)^1.5`) so moons orbit at speeds proportional to where they appear, not where they really are. Without this, two moons that visually look at similar distances would orbit at very different rates — eyes hate that. The simulation itself uses real Kepler; only the renderer applies the visual override.

Body's frame is determined by its `parent` chain:

- `parent === null` → at heliocentric origin (the star)
- `parent` is the star → heliocentric
- `parent` is a planet → parent-relative

Why this matters for later phases: ships interacting with moons need to be rendered in the moon's parent-relative frame, otherwise the ship visually arrives next to the planet while the moon is drawn elsewhere on screen. The frame transition is the SOI handover described in §4.4.

### 4.2 Resources

Each body has a finite composition across the eight resource types. Extraction rate depends on colony tech and infrastructure. Some resources are abundant on gas giant moons but expensive to lift out of the gravity well; some are common on rocky worlds but dangerous to mine.

### 4.3 Colonies

A colony has:
- Population (number) and derived stats (growth rate, education, morale)
- Infrastructure tiers: habitation, industry, research, spaceport
- Resource stockpiles
- Tech level and tech graph state (see 4.7)
- Cultural drift state (see 4.7)
- Diplomatic state with every other colony

Colonies consume resources to grow and produce goods. They can be self-sufficient or import-dependent. Dependency creates dynamics.

### 4.4 Ships & Trade

Ships travel via Hohmann transfers by default, with higher-energy trajectories available at fuel cost. Launch windows matter. A Mars colony cannot instantly aid Ceres — it waits for alignment or pays a delta-v premium. This rhythm is the heartbeat of the game.

Ship types: freight, colony ship, courier, military (later phase).

**Frame transitions at SOI** (see §4.1.1). Trajectory math is heliocentric during transit. When a ship enters its destination's sphere of influence — or, for a moon target, the destination *moon's parent's* SOI — it transitions to the parent-relative frame. The same parent-frame transform that moons render through is applied to ships once they're in the planet's neighbourhood, so a ship arriving at a moon visually lands on the moon. Without this transition, ships would visually arrive at the parent's screen position while the moon is drawn elsewhere on screen. The transition itself is one block of code, triggered at the SOI boundary; the rest of every transfer is heliocentric and needs no special handling.

### 4.5 Expansion

When a colony hits thresholds (population, resources, tech, morale), it may fund a colony ship. The ship picks a target by distance, resource value, and existing claims. Founding takes years of travel plus setup time. Failed colonies are possible and narratively valuable.

### 4.6 Communication Lag

Light-speed delay is rendered honestly. Trade orders, alliance proposals, and emergencies propagate at c. A crisis on Titan is already over by the time Earth hears about it. This is a feature, not a bug.

### 4.7 Tech, Drift, and Diplomacy

- **Tech as a graph, not a tree.** Different colonies discover different things based on environment. Europa's ice-miners develop cryogenics; Mercury's miners develop radiation shielding. Trade includes knowledge.
- **Cultural drift.** Isolated colonies diverge — different priorities, tech preferences, eventually different goals. After 200 years the Ganymede colonists may no longer feel kinship with Earth. This turns a sim into a story.
- **Diplomatic states:** trade partner, dependency, vassal, rival, schismatic, silent. Relationships decay with distance and time.
- **Schism and merger.** Struggling colonies can be absorbed by thriving neighbors. Thriving colonies can fracture into two. Both produce some of the best emergent stories.

### 4.8 Catastrophes

Solar flares, plagues, reactor failures, ideological schisms, asteroid impacts. Infrequent but enough that no colony is ever truly safe.

### 4.9 Named Figures

A handful per generation — a notable governor, a famous explorer, an infamous heretic. Don't simulate every person; a few names per era make history feel populated.

### 4.10 Deep-Time Timeline

A scrubbable horizontal timeline across the bottom of the screen. Major events marked: foundings, collapses, wars, discoveries, first contacts, schisms. Click an event → camera flies there, time jumps to that moment. This is what makes the genre special: the *story* the sim generated, readable as a chronicle.

## 5. Phased Build Plan

Each phase is a runnable, enjoyable thing on its own. **Do not skip ahead.** Each phase shakes out bugs that would compound later.

### Phase 1 — The Orrery
Just the star system. One star, procedurally rolled planets and moons, optional asteroid belt. Keplerian orbits, time controls (pause / 1x / 10x / 100x / 1000x / 10000x), click-to-inspect any body, seed input so the same seed always yields the same system. No colonies. Goal: something beautiful enough that you want to keep going. Lock in camera, time scrubbing, generator, and the visual feel here.

### Phase 2 — Static Colonies
Place colonies on bodies. Population, resources, infrastructure exist and evolve over time, but colonies do not yet act — no ships, no expansion. Click a colony to see its state. Tune the economic core here.

### Phase 3 — Ships and Transfers
Hohmann transfers between bodies. Initially freight only: surplus colony sends to deficit colony. Watching ships trace transfer ellipses across the system is the moment the project starts to feel alive.

### Phase 4 — Autonomous Expansion
Colonies decide to send colony ships. New colonies are founded. The map changes over time. This is when it becomes a sim.

### Phase 5 — The Soul Layer
Tech graph, cultural drift, diplomacy, catastrophes, named figures, deep-time timeline. Where the project earns its identity.

### Phase 6 — Governor Mode
Wrap a UI around "be one specific colony." Add directives, a HUD, decision points, auto-pause on critical events, and a tutorial scenario.

## 6. Technical Approach

- **Stack:** Vanilla HTML/CSS/JS to start. Canvas (2D) for rendering. No framework unless one becomes genuinely necessary.
- **Architecture:** Fixed-timestep simulation tick fully separated from the render loop. The simulation should be runnable headless (e.g. for fast-forwarding or testing) without any rendering.
- **Determinism:** A single seeded PRNG (e.g. mulberry32 or sfc32). Every random call goes through it. No `Math.random()` anywhere in simulation code.
- **Save/load:** JSON serialization of full simulation state. Save files should remain compatible across development phases where reasonably possible.
- **Performance target:** Smooth at 10000x time rate with 50 colonies and a few hundred in-flight ships.
- **No backend.** Static site. Hostable on GitHub Pages.

## 7. Open Questions (deliberately deferred)

These are interesting but should not be answered now. Build the core first.

- Multiple stars (binary, ternary) — architecture supports it; generator does not yet emit them
- Multiplayer or shared scenarios
- Modding / scripting layer
- Mobile/touch UI
- Audio and music
- Localisation

## 8. Repository & Branching Strategy

**Repository:** https://github.com/lewis-1664/Space-Colonies

### Branch model

- `main` — stable development trunk. Always buildable. All phase work merges here when complete and tested.
- `live` — deployed branch. What the public-facing GitHub Pages site serves. Only updated from `main` at deliberate release points; never committed to directly.
- `phase-1-orrery` — Phase 1 work
- `phase-2-static-colonies` — Phase 2 work
- `phase-3-ships-and-transfers` — Phase 3 work
- `phase-4-autonomous-expansion` — Phase 4 work
- `phase-5-soul-layer` — Phase 5 work
- `phase-6-governor-mode` — Phase 6 work

### Workflow

1. All work for a phase happens on its phase branch, branched from `main`.
2. When the phase is complete and tested, merge the phase branch into `main` via a clean merge or squash.
3. At chosen release points, fast-forward (or merge) `main` into `live` to update the deployed site.
4. The next phase branches from the now-updated `main`.
5. Phase branches are kept after merge for historical reference; not deleted.

### Rules

- Never commit directly to `live`.
- Never commit directly to `main` once Phase 1 is underway — go through a phase branch.
- Each phase branch should end in a state where `main` would still be buildable after the merge.
- Tag `main` at the completion of each phase: `v0.1-orrery`, `v0.2-static-colonies`, etc.

## 9. First Concrete Steps for Claude Code

1. Initialise the repo at https://github.com/lewis-1664/Space-Colonies if not already present.
2. Commit this design document to `main` as `DESIGN.md`.
3. Add a minimal `index.html`, `README.md`, and `.gitignore` to `main`.
4. Create the `live` branch from `main`.
5. Configure GitHub Pages to serve from the `live` branch.
6. Create the `phase-1-orrery` branch from `main` and begin Phase 1 work there.
