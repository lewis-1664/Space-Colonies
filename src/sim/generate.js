import { hashSeed, makeRng } from './rng.js';

const TWO_PI = Math.PI * 2;
const SOLAR_MASS_KG = 1.989e30;
const AU_KM = 149597870.7;

const STAR_NAMES = [
  'Helios', 'Selene', 'Eos', 'Aurora', 'Boreas', 'Iris', 'Hesper',
  'Lyra', 'Phoenix', 'Cygnus', 'Vega', 'Atlas', 'Orion', 'Sirius',
  'Polaris', 'Altair', 'Rigel', 'Procyon', 'Castor', 'Pollux',
  'Achernar', 'Canopus', 'Capella', 'Arcturus', 'Spica', 'Antares',
  'Aldebaran', 'Bellatrix', 'Mintaka', 'Alnilam',
];

const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV'];

const PLANET_TYPES = [
  { weight: 3, type: 'rocky_small',  rRange: [800, 3000],   density: 4.0, colors: ['#a89888','#a07a5a','#888880','#a08070','#988866'] },
  { weight: 4, type: 'rocky',        rRange: [3000, 7000],  density: 5.0, colors: ['#d27858','#6ba6e8','#8a8270','#c89870','#a58060','#9a8060'] },
  { weight: 2, type: 'rocky_large',  rRange: [7000, 9500],  density: 5.0, colors: ['#7a8a9a','#a07060','#8b6f4f','#a08070'] },
  { weight: 2, type: 'ice',          rRange: [1500, 5000],  density: 1.8, colors: ['#cce4f0','#9bc0d8','#bdd9e8','#a8c8d8'] },
  { weight: 3, type: 'ice_giant',    rRange: [18000, 30000], density: 1.5, colors: ['#9bd8e0','#5a7be0','#7da8d8','#a8c8e0'] },
  { weight: 3, type: 'gas_giant',    rRange: [40000, 80000], density: 1.0, colors: ['#d6b88b','#e8d8a8','#c8a070','#daba88','#e8b890'] },
];

function pickWeighted(rng, items) {
  const total = items.reduce((s, it) => s + it.weight, 0);
  let x = rng() * total;
  for (const it of items) {
    x -= it.weight;
    if (x <= 0) return it;
  }
  return items[items.length - 1];
}

function pickFrom(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function rangeUniform(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

function gaussian(rng) {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(TWO_PI * u2);
}

function radiusToMassSolar(r_km, density_g_cm3) {
  const r_cm = r_km * 1e5;
  const volume_cm3 = (4 / 3) * Math.PI * r_cm * r_cm * r_cm;
  const mass_kg = volume_cm3 * density_g_cm3 * 1e-3;
  return mass_kg / SOLAR_MASS_KG;
}

function meanMotion(a_au, parentMassSolar) {
  const T_days = 365.25 * Math.sqrt(a_au * a_au * a_au / parentMassSolar);
  return TWO_PI / T_days;
}

function moonRollCount(rng, type) {
  switch (type) {
    case 'gas_giant':   return Math.floor(rng() * 7);
    case 'ice_giant':   return Math.floor(rng() * 5);
    case 'rocky_large': return Math.floor(rng() * 3);
    case 'ice':         return Math.floor(rng() * 2);
    case 'rocky':       return Math.floor(rng() * 2);
    case 'rocky_small': return rng() < 0.2 ? 1 : 0;
    default:            return 0;
  }
}

export function generateSystem(seed) {
  const seedInt = typeof seed === 'string' ? hashSeed(seed) : (seed >>> 0);
  const rng = makeRng(seedInt);

  const starName = pickFrom(rng, STAR_NAMES);
  const starMass = 1.0;
  const star = {
    id: 'star_0',
    name: starName,
    kind: 'star',
    parent: null,
    mass_sol: starMass,
    r_km: 696000,
    color: '#ffd86b',
  };
  const bodies = [star];

  const planetCount = 4 + Math.floor(rng() * 5);
  const ellipticalCount = Math.min(planetCount, 1 + Math.floor(rng() * 2));
  const ellipticalIndices = new Set();
  while (ellipticalIndices.size < ellipticalCount) {
    ellipticalIndices.add(Math.floor(rng() * planetCount));
  }

  // Pre-roll eccentricities so spacing can account for them.
  const eccs = [];
  for (let i = 0; i < planetCount; i++) {
    eccs.push(
      ellipticalIndices.has(i)
        ? rangeUniform(rng, 0.15, 0.32)
        : Math.min(0.10, Math.abs(gaussian(rng) * 0.04))
    );
  }

  // Margin between aphelion of inner orbit and perihelion of outer orbit.
  // > 1 means a guaranteed visible gap; scales naturally with eccentricity.
  const ORBIT_MARGIN = 1.35;

  let a = rangeUniform(rng, 0.8, 1.4);
  let prevA = 0;
  let prevE = 0;

  for (let i = 0; i < planetCount; i++) {
    if (i > 0) {
      const baseMult = rangeUniform(rng, 1.4, 2.1);
      const safeMult = ((1 + prevE) / (1 - eccs[i])) * ORBIT_MARGIN;
      a = prevA * Math.max(baseMult, safeMult);
    }
    const t = pickWeighted(rng, PLANET_TYPES);
    const r_km = rangeUniform(rng, t.rRange[0], t.rRange[1]);
    const mass_sol = radiusToMassSolar(r_km, t.density);
    const e = eccs[i];
    const planetId = `${star.id}_p${i + 1}`;
    const planet = {
      id: planetId,
      name: `${starName} ${ROMAN[i] || (i + 1)}`,
      kind: 'planet',
      type: t.type,
      parent: star.id,
      a,
      e,
      omega: rng() * TWO_PI,
      L0: rng() * TWO_PI,
      n: meanMotion(a, starMass),
      r_km,
      mass_sol,
      color: pickFrom(rng, t.colors),
    };
    planet.T_days = TWO_PI / planet.n;
    bodies.push(planet);

    const hill_au = a * Math.cbrt(mass_sol / (3 * starMass));
    const moonCount = moonRollCount(rng, t.type);
    // Innermost moon at 5-8 parent radii — outside the Roche limit.
    // Outer cap at 18 R_parent keeps the period ratio (Kepler T ∝ a^1.5)
    // bounded to ~5× across all moons of a planet, so inner and outer
    // moons don't orbit at wildly different speeds in playback. Real
    // moon systems span much wider (Earth's Moon at 60 R_E), but the
    // visual feel of a moon system at fast time rates demands a tighter
    // physical range.
    const planetR_au = r_km / AU_KM;
    let moonA = planetR_au * rangeUniform(rng, 5, 8);
    const moonCap = Math.min(0.05, hill_au * 0.4, planetR_au * 18);
    for (let m = 0; m < moonCount; m++) {
      if (moonA > moonCap) break;
      const moonR = rangeUniform(rng, 200, 2500);
      const moonDensity = 2 + rng() * 2;
      const moonMass = radiusToMassSolar(moonR, moonDensity);
      const moon = {
        id: `${planetId}_m${m + 1}`,
        name: `${planet.name}-${String.fromCharCode(97 + m)}`,
        kind: 'moon',
        parent: planetId,
        a: moonA,
        e: Math.min(0.2, Math.abs(gaussian(rng) * 0.03)),
        omega: rng() * TWO_PI,
        L0: rng() * TWO_PI,
        n: meanMotion(moonA, mass_sol),
        r_km: moonR,
        mass_sol: moonMass,
        color: pickFrom(rng, ['#cdd6f4','#a8b4c8','#888892','#b8a890','#9c9a8a','#d8d0c0']),
      };
      moon.T_days = TWO_PI / moon.n;
      bodies.push(moon);
      moonA *= rangeUniform(rng, 1.5, 2.4);
    }

    prevA = a;
    prevE = e;
  }

  // Asteroid belts. Walk consecutive planet pairs; when the gap between
  // them is wide enough, roll for a belt. Belts get a few hundred
  // tracked bodies with low eccentricity and random orbital phase.
  const planets = bodies.filter(b => b.kind === 'planet');
  let beltCount = 0;
  for (let i = 1; i < planets.length; i++) {
    const inner = planets[i - 1];
    const outer = planets[i];
    const ratio = outer.a / inner.a;
    if (ratio < 2.0) continue;
    if (rng() > 0.5) continue;
    beltCount++;
    const beltCenter = Math.sqrt(inner.a * outer.a); // geometric mean
    const beltHalfWidth = (outer.a - inner.a) * 0.18;
    const aMin = beltCenter - beltHalfWidth;
    const aMax = beltCenter + beltHalfWidth;
    const count = 120 + Math.floor(rng() * 180);
    for (let j = 0; j < count; j++) {
      const aAst = rangeUniform(rng, aMin, aMax);
      bodies.push({
        id: `${star.id}_b${beltCount}_${j}`,
        name: null,
        kind: 'asteroid',
        parent: star.id,
        a: aAst,
        e: rng() * 0.18,
        omega: rng() * TWO_PI,
        L0: rng() * TWO_PI,
        n: meanMotion(aAst, starMass),
        r_km: 5 + rng() * 80,
        mass_sol: 0,
        color: pickFrom(rng, ['#7a6f60', '#8b7d6b', '#69584a', '#7a6451', '#6d5a4d']),
      });
    }
  }

  return { bodies, seed: seedInt, starName, planetCount, beltCount };
}
