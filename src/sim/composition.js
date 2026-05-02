// Resource composition rolls per body. Locked-in resource list (DESIGN §3):
// six raw types extracted from a body and two derived types produced by colonies.
// Composition values are richness in [0, 1] — multipliers on extraction rate, not
// reserve quantities. True finite-reserve depletion is deferred to Phase 3 when
// mining ships exist; until then a colony's draw is bounded by its industry tier
// and the body's richness, both of which are static this phase.

export const RAW_RESOURCES = ['water_ice', 'metals', 'rare_earths', 'fissile', 'hydrocarbons', 'silicates'];
export const DERIVED_RESOURCES = ['food', 'goods'];
export const ALL_RESOURCES = [...RAW_RESOURCES, ...DERIVED_RESOURCES];

export const RESOURCE_LABELS = {
  water_ice: 'Water/ice',
  metals: 'Metals',
  rare_earths: 'Rare earths',
  fissile: 'Fissile',
  hydrocarbons: 'Hydrocarbons',
  silicates: 'Silicates',
  food: 'Food',
  goods: 'Goods',
};

export function emptyStockpile() {
  const s = {};
  for (const r of ALL_RESOURCES) s[r] = 0;
  return s;
}

export function rollComposition(rng, body, parent) {
  const c = baseFloor(rng);
  if (body.kind === 'planet') {
    addByPlanetType(c, rng, body.type);
    if (rng() < 0.18) c.fissile += 0.3 + rng() * 0.3;
    if (rng() < 0.10) c.rare_earths += 0.3 + rng() * 0.3;
  } else if (body.kind === 'moon') {
    addByMoonContext(c, rng, parent?.type);
  } else if (body.kind === 'asteroid') {
    c.metals += 0.2 + rng() * 0.5;
    c.silicates += 0.1 + rng() * 0.3;
    if (rng() < 0.15) c.water_ice += 0.3 + rng() * 0.4;
    if (rng() < 0.05) c.rare_earths += 0.4 + rng() * 0.3;
  }
  for (const k of RAW_RESOURCES) c[k] = Math.min(1, Math.max(0, c[k]));
  return c;
}

function baseFloor(rng) {
  return {
    water_ice: rng() * 0.05,
    metals: rng() * 0.05,
    rare_earths: rng() * 0.03,
    fissile: rng() * 0.02,
    hydrocarbons: rng() * 0.05,
    silicates: rng() * 0.05,
  };
}

function addByPlanetType(c, rng, type) {
  switch (type) {
    case 'rocky_small':
      c.metals += 0.1 + rng() * 0.3;
      c.silicates += 0.2 + rng() * 0.4;
      break;
    case 'rocky':
      c.metals += 0.2 + rng() * 0.4;
      c.silicates += 0.2 + rng() * 0.4;
      c.hydrocarbons += rng() * 0.3;
      c.water_ice += rng() * 0.3;
      break;
    case 'rocky_large':
      c.metals += 0.3 + rng() * 0.4;
      c.silicates += 0.3 + rng() * 0.4;
      c.rare_earths += rng() * 0.3;
      c.hydrocarbons += rng() * 0.2;
      break;
    case 'ice':
      c.water_ice += 0.4 + rng() * 0.5;
      c.silicates += rng() * 0.2;
      break;
    case 'ice_giant':
      c.water_ice += 0.4 + rng() * 0.4;
      c.hydrocarbons += 0.3 + rng() * 0.3;
      break;
    case 'gas_giant':
      c.hydrocarbons += 0.5 + rng() * 0.4;
      c.water_ice += rng() * 0.2;
      break;
  }
}

function addByMoonContext(c, rng, parentType) {
  c.silicates += 0.1 + rng() * 0.3;
  c.metals += 0.1 + rng() * 0.3;
  switch (parentType) {
    case 'gas_giant':
    case 'ice_giant':
      c.water_ice += 0.3 + rng() * 0.4;
      c.hydrocarbons += rng() * 0.2;
      break;
    case 'ice':
      c.water_ice += 0.2 + rng() * 0.3;
      break;
    case 'rocky_small':
    case 'rocky':
    case 'rocky_large':
      c.metals += rng() * 0.3;
      break;
  }
}
