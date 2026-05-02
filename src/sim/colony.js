import { RAW_RESOURCES, emptyStockpile } from './composition.js';

// Phase 2 economic constants. Capacities scale geometrically with tier so
// they track housing cap (which is also geometric) — at every tier, food and
// goods production can feed/equip a fully-housed colony with comfortable
// surplus. Tier upgrades cost geometrically so each upgrade takes roughly the
// same real-world time (production rate scales identically). Pop growth is
// tuned so a tier-1 outpost reaches tier-5 megapolis in 200–500 in-game years
// on a typical body, matching DESIGN.md's centuries timescale.
const FOOD_PER_POP_PER_DAY = 0.0008;
const GOODS_PER_POP_PER_DAY = 0.0001;
// Per-capita extraction: pop × tier² × richness gives daily output. Linear in
// pop reflects "more people = more workers"; quadratic in tier reflects the
// jump in capital efficiency per worker as industry advances. Reaches a useful
// scale once pop × tier² is meaningful — a 5k tier-1 outpost barely scrapes by,
// a 10M tier-5 metropolis pulls millions of units/day on a rich body.
const PER_CAPITA_EXTRACTION = 0.02;
const HAB_FOOD_RATE = 30;
const IND_GOODS_RATE = 20;
const TIER_RATIO = 5;
const STOCKPILE_BUFFER = 1.5;     // extract / produce 50% above consumption to grow stockpiles
const RARE_FISSILE_PER_POP_PER_DAY = 1e-5; // small steady draw for tier-up reserves
const WATER_PER_FOOD = 0.5;
const HYDROCARBON_PER_FOOD = 0.3;
const METAL_PER_GOOD = 0.5;
const SILICATE_PER_GOOD = 0.3;
const BASE_GROWTH_PER_DAY = 8e-5;
const HOUSING_BASE = 20000;
const HOUSING_RATIO = 5;
const MAX_TIER = 5;

// Per-body finite reserves. Composition × kind base gives the total mineable
// stock per resource. Sized so a typical Megapolis-scale colony depletes a
// poor body's key resource over centuries — visible-but-not-immediate.
const RESERVE_BASE_BY_KIND = {
  planet: 2e10,
  moon:   2e9,
  asteroid: 1e7,
};

export function initialReserves(body) {
  const base = RESERVE_BASE_BY_KIND[body.kind] || 0;
  if (!base || !body.composition) return {};
  const out = {};
  for (const r of Object.keys(body.composition)) {
    out[r] = body.composition[r] * base;
  }
  return out;
}

export function reserveFraction(body, resource) {
  if (!body.reserves || !body.composition) return null;
  const base = RESERVE_BASE_BY_KIND[body.kind] || 0;
  const original = (body.composition[resource] || 0) * base;
  if (original <= 0) return null;
  const current = body.reserves[resource] || 0;
  return Math.max(0, Math.min(1, current / original));
}

export function housingCap(habTier) {
  return HOUSING_BASE * Math.pow(HOUSING_RATIO, habTier - 1);
}

function tierScale(tier) {
  return Math.pow(TIER_RATIO, tier - 1);
}

export function nextHabCost(habTier) {
  if (habTier >= MAX_TIER) return null;
  return {
    goods: 5000 * tierScale(habTier),
    metals: 8000 * tierScale(habTier),
  };
}

export function nextIndCost(indTier) {
  if (indTier >= MAX_TIER) return null;
  return {
    goods: 8000 * tierScale(indTier),
    metals: 12000 * tierScale(indTier),
    fissile: 200 * tierScale(indTier),
  };
}

// Renderer reveals the first habTier × CITY_LIGHTS_PER_TIER points; we generate
// the full set up front so a colony's "skyline" is fixed for its lifetime even
// as it grows.
const MAX_CITY_LIGHTS = 50;

export function createColony({ id, name, bodyId, foundedAt, rng }) {
  const stockpile = emptyStockpile();
  stockpile.food = 5000;
  stockpile.water_ice = 5000;
  stockpile.hydrocarbons = 2000;
  stockpile.metals = 1000;
  stockpile.silicates = 800;
  stockpile.goods = 500;
  return {
    id,
    name,
    bodyId,
    foundedAt,
    population: 5000,
    morale: 0.85,
    habitationTier: 1,
    industryTier: 1,
    researchTier: 0,
    spaceportTier: 0,
    stockpile,
    foodShortfall: 0,
    goodsShortfall: 0,
    cities: rollCityPositions(rng, MAX_CITY_LIGHTS),
  };
}

function rollCityPositions(rng, count) {
  if (!rng) return [];
  const pts = [];
  while (pts.length < count) {
    const x = rng() * 2 - 1;
    const y = rng() * 2 - 1;
    if (x * x + y * y <= 0.85) pts.push({ x, y });
  }
  return pts;
}

// Showcase scenario: one colony per planet (up to 6) at a hand-picked stage of
// development, so every visual feature can be inspected without waiting for a
// natural progression. Use the special seed string 'showcase' to load it.
const SHOWCASE_STAGES = [
  { name: 'Pioneer Outpost',   pop: 5_000,    morale: 0.85, hab: 1, ind: 1, sp: 0, stress: false },
  { name: 'Frontier Town',     pop: 80_000,   morale: 0.95, hab: 2, ind: 2, sp: 0, stress: false },
  { name: 'Industrial Hub',    pop: 1_500_000,morale: 1.00, hab: 3, ind: 5, sp: 1, stress: false },
  { name: 'Spaceport City',    pop: 4_000_000,morale: 1.00, hab: 4, ind: 3, sp: 3, stress: false },
  { name: 'Megapolis',         pop: 9_000_000,morale: 1.00, hab: 5, ind: 5, sp: 5, stress: false },
  { name: 'Hungry Outpost',    pop: 3_500,    morale: 0.40, hab: 1, ind: 1, sp: 0, stress: true  },
];

export function buildShowcaseColonies(bodies, rng) {
  // Showcase colonies need bodies with enough water_ice to feed their populations
  // under per-capita extraction; otherwise they all die immediately and the
  // visual showcase reads as a graveyard. Sort rocky planets by water_ice
  // richness, take the wettest. Fall back to any planet if not enough qualify.
  const isRocky = t => t === 'rocky' || t === 'rocky_large' || t === 'rocky_small';
  const rocky = bodies
    .filter(b => b.kind === 'planet' && isRocky(b.type))
    .sort((a, b) => (b.composition?.water_ice ?? 0) - (a.composition?.water_ice ?? 0));
  const planets = (rocky.length >= SHOWCASE_STAGES.length
    ? rocky
    : bodies.filter(b => b.kind === 'planet'))
    .slice(0, SHOWCASE_STAGES.length);
  const colonies = [];
  for (let i = 0; i < planets.length; i++) {
    const s = SHOWCASE_STAGES[i];
    const planet = planets[i];
    const colony = createColony({
      id: `col_${i + 1}`,
      name: `${s.name} (${planet.name})`,
      bodyId: planet.id,
      foundedAt: 0,
      rng,
    });
    colony.population = s.pop;
    colony.morale = s.morale;
    colony.habitationTier = s.hab;
    colony.industryTier = s.ind;
    colony.spaceportTier = s.sp;
    if (s.stress) {
      colony.foodShortfall = 0.3;
      colony.stockpile.food = 100;
      colony.stockpile.water_ice = 200;
    } else {
      // Healthy stockpiles scaled to colony size, so post-tick state stays sane.
      colony.stockpile.food = Math.max(5000, s.pop * 0.05);
      colony.stockpile.water_ice = Math.max(5000, s.pop * 0.04);
      colony.stockpile.hydrocarbons = Math.max(2000, s.pop * 0.02);
      colony.stockpile.metals = Math.max(1000, s.pop * 0.01);
      colony.stockpile.silicates = Math.max(800, s.pop * 0.008);
      colony.stockpile.goods = Math.max(500, s.pop * 0.01);
    }
    colonies.push(colony);
  }
  return colonies;
}

export function colonyTick(world, colony, bodyById, dtDays) {
  const body = bodyById.get(colony.bodyId);
  if (!body) return;
  if (!body.reserves) body.reserves = initialReserves(body);
  const comp = body.composition;
  const sp = colony.stockpile;
  const before = { ...sp };

  // Production targets — what the colony *wants* to make this tick. Capped by
  // hab/ind capacity (the infrastructure ceiling) and by population demand
  // plus a stockpile buffer (so colonies don't over-make food/goods that just
  // pile up forever).
  const popFoodNeed = colony.population * FOOD_PER_POP_PER_DAY * dtDays;
  const popGoodsNeed = colony.population * GOODS_PER_POP_PER_DAY * dtDays;
  const foodCap = HAB_FOOD_RATE * tierScale(colony.habitationTier) * dtDays;
  const goodsCap = IND_GOODS_RATE * tierScale(colony.industryTier) * dtDays;
  const foodTarget = Math.min(foodCap, popFoodNeed * STOCKPILE_BUFFER);
  const goodsTarget = Math.min(goodsCap, popGoodsNeed * STOCKPILE_BUFFER);

  // 1. Extract raw resources. Per-capita × tier² × richness sets the workforce
  //    ceiling; demand sets the target; reserves bound everything. So a tiny
  //    colony at tier 1 pulls almost nothing, while a megapolis at tier 5 pulls
  //    millions per day — but only as much as it actually needs.
  const workforce = colony.population * PER_CAPITA_EXTRACTION
    * colony.industryTier * colony.industryTier * dtDays;
  const want = {
    water_ice:    foodTarget * WATER_PER_FOOD * STOCKPILE_BUFFER,
    hydrocarbons: foodTarget * HYDROCARBON_PER_FOOD * STOCKPILE_BUFFER,
    metals:       goodsTarget * METAL_PER_GOOD * STOCKPILE_BUFFER,
    silicates:    goodsTarget * SILICATE_PER_GOOD * STOCKPILE_BUFFER,
    rare_earths:  colony.population * RARE_FISSILE_PER_POP_PER_DAY * dtDays,
    fissile:      colony.population * RARE_FISSILE_PER_POP_PER_DAY * dtDays,
  };
  for (const r of RAW_RESOURCES) {
    const richness = comp[r] ?? 0;
    const reserve = body.reserves[r] ?? 0;
    if (richness <= 0 || reserve <= 0) continue;
    const workforceMax = workforce * richness;
    const desired = want[r] ?? 0;
    const actual = Math.min(workforceMax, desired, reserve);
    if (actual > 0) {
      body.reserves[r] = reserve - actual;
      sp[r] += actual;
    }
  }

  // 2. Produce food. Capped by hab capacity, available raw inputs, and
  //    consumption-driven target (no over-production).
  const foodFromWater = sp.water_ice / WATER_PER_FOOD;
  const foodFromCarbon = sp.hydrocarbons / HYDROCARBON_PER_FOOD;
  const foodProduced = Math.min(foodTarget, foodFromWater, foodFromCarbon);
  if (foodProduced > 0) {
    sp.water_ice = Math.max(0, sp.water_ice - foodProduced * WATER_PER_FOOD);
    sp.hydrocarbons = Math.max(0, sp.hydrocarbons - foodProduced * HYDROCARBON_PER_FOOD);
    sp.food += foodProduced;
  }

  // 3. Produce goods. Same shape — capped by ind capacity, inputs, and target.
  const goodsFromMetal = sp.metals / METAL_PER_GOOD;
  const goodsFromSilicate = sp.silicates / SILICATE_PER_GOOD;
  const goodsProduced = Math.min(goodsTarget, goodsFromMetal, goodsFromSilicate);
  if (goodsProduced > 0) {
    sp.metals = Math.max(0, sp.metals - goodsProduced * METAL_PER_GOOD);
    sp.silicates = Math.max(0, sp.silicates - goodsProduced * SILICATE_PER_GOOD);
    sp.goods += goodsProduced;
  }

  // 4. Population consumes.
  const foodNeed = colony.population * FOOD_PER_POP_PER_DAY * dtDays;
  const goodsNeed = colony.population * GOODS_PER_POP_PER_DAY * dtDays;
  const foodConsumed = Math.min(sp.food, foodNeed);
  const goodsConsumed = Math.min(sp.goods, goodsNeed);
  sp.food -= foodConsumed;
  sp.goods -= goodsConsumed;
  const foodShortfall = foodNeed > 0 ? 1 - foodConsumed / foodNeed : 0;
  const goodsShortfall = goodsNeed > 0 ? 1 - goodsConsumed / goodsNeed : 0;

  // 5. Morale drifts toward a target driven by shortfalls.
  const moraleTarget = Math.max(0, Math.min(1, 0.6 + 0.4 * (1 - foodShortfall) - 0.3 * goodsShortfall));
  const moraleAlpha = 1 - Math.exp(-dtDays / 30);
  colony.morale += (moraleTarget - colony.morale) * moraleAlpha;

  // 6. Population update.
  const cap = housingCap(colony.habitationTier);
  const housingFactor = Math.max(0, 1 - colony.population / cap);
  const moraleFactor = colony.morale * 2 - 1;
  let dailyGrowth = BASE_GROWTH_PER_DAY * housingFactor * (0.5 + 0.5 * moraleFactor);
  if (foodShortfall > 0.2) dailyGrowth = -0.001 * foodShortfall;
  colony.population = Math.max(0, colony.population * (1 + dailyGrowth * dtDays));

  colony.foodShortfall = foodShortfall;
  colony.goodsShortfall = goodsShortfall;

  // 7. Cache per-day net flows for the inspector. Computed from stockpile
  //    delta so it captures everything: extraction, food/goods production,
  //    consumption, and tier-up spend (which subtracts goods+metals below).
  const flows = {};
  for (const k in sp) flows[k] = (sp[k] - before[k]) / dtDays;
  colony.flows = flows;

  checkUpgrades(colony);
}

function checkUpgrades(colony) {
  const sp = colony.stockpile;
  if (colony.habitationTier < MAX_TIER) {
    const cap = housingCap(colony.habitationTier);
    if (colony.population > 0.8 * cap) {
      const cost = nextHabCost(colony.habitationTier);
      if (sp.goods >= cost.goods && sp.metals >= cost.metals) {
        sp.goods -= cost.goods;
        sp.metals -= cost.metals;
        colony.habitationTier += 1;
      }
    }
  }
  // Industry can't outpace habitation by more than 1 tier — a sleepy outpost
  // shouldn't slowly accumulate goods over centuries and end up with tier-5
  // industry while still housing 5,000 people. Industry needs population to
  // justify itself.
  if (colony.industryTier < MAX_TIER && colony.industryTier <= colony.habitationTier) {
    const cost = nextIndCost(colony.industryTier);
    if (sp.goods >= cost.goods && sp.metals >= cost.metals && sp.fissile >= cost.fissile) {
      sp.goods -= cost.goods;
      sp.metals -= cost.metals;
      sp.fissile -= cost.fissile;
      colony.industryTier += 1;
    }
  }
}
