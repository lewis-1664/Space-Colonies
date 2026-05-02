import { RAW_RESOURCES, RESOURCE_LABELS, ALL_RESOURCES } from '../sim/composition.js';
import { housingCap, nextHabCost, nextIndCost, reserveFraction } from '../sim/colony.js';

const AU_KM = 149597870.7;
const SOLAR_TO_EARTH = 332946;

export function createInspector({ onClose }) {
  const root = document.createElement('aside');
  root.id = 'inspector';
  root.classList.add('hidden');

  const header = document.createElement('header');
  const title = document.createElement('h3');
  const closeBtn = document.createElement('button');
  closeBtn.className = 'close';
  closeBtn.textContent = '×';
  closeBtn.title = 'Close';
  closeBtn.addEventListener('click', () => onClose());
  header.append(title, closeBtn);

  const bodyDl = document.createElement('dl');

  const colonyBlock = document.createElement('div');
  colonyBlock.className = 'colony-block hidden';
  const colonyHeading = document.createElement('h4');
  colonyHeading.textContent = 'Colony';
  const colonyDl = document.createElement('dl');
  colonyBlock.append(colonyHeading, colonyDl);

  root.append(header, bodyDl, colonyBlock);

  let lastBodyId = null;

  function refresh(world, selectedBodyId) {
    if (selectedBodyId === null) {
      root.classList.add('hidden');
      lastBodyId = null;
      return;
    }
    const body = world.bodies.find(b => b.id === selectedBodyId);
    if (!body) {
      root.classList.add('hidden');
      lastBodyId = null;
      return;
    }
    root.classList.remove('hidden');
    if (body.id !== lastBodyId) {
      lastBodyId = body.id;
      title.textContent = body.name || titleCase(body.kind);
    }
    // Re-render every frame: most body fields are static, but reserves tick
    // down as colonies extract, and we want that visible without re-clicking.
    renderDl(bodyDl, bodyDetails(body, world));
    const colony = world.colonies.find(c => c.bodyId === body.id);
    if (colony) {
      colonyBlock.classList.remove('hidden');
      colonyHeading.textContent = colony.name;
      renderDl(colonyDl, colonyDetails(colony, world));
    } else {
      colonyBlock.classList.add('hidden');
    }
  }

  return { root, refresh };
}

function renderDl(dl, fields) {
  dl.replaceChildren();
  for (const [label, value] of fields) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    if (value && typeof value === 'object' && Array.isArray(value.parts)) {
      // Rich field — array of { text, className? } so individual segments
      // can be styled (e.g. positive flow rates green, negative red).
      for (const part of value.parts) {
        if (part.className) {
          const span = document.createElement('span');
          span.className = part.className;
          span.textContent = part.text;
          dd.appendChild(span);
        } else {
          dd.appendChild(document.createTextNode(part.text));
        }
      }
    } else {
      dd.textContent = value;
    }
    dl.append(dt, dd);
  }
}

function bodyDetails(body, world) {
  const fields = [];
  const parent = body.parent ? world.bodies.find(b => b.id === body.parent) : null;

  if (body.kind === 'star') {
    fields.push(['Type', 'star']);
    fields.push(['Radius', `${formatNum(body.r_km)} km`]);
    fields.push(['Mass', `${body.mass_sol.toFixed(2)} M☉`]);
    const planets = world.bodies.filter(b => b.parent === body.id && b.kind === 'planet').length;
    const asts = world.bodies.filter(b => b.parent === body.id && b.kind === 'asteroid').length;
    fields.push(['Planets', String(planets)]);
    if (asts > 0) fields.push(['Asteroids', String(asts)]);
    return fields;
  }

  if (body.kind === 'planet') {
    fields.push(['Type', titleCase(body.type.replace('_', ' '))]);
    fields.push(['Orbits', parent.name]);
    fields.push(['Semi-major axis', `${body.a.toFixed(2)} AU`]);
    fields.push(['Eccentricity', body.e.toFixed(3)]);
    fields.push(['Period', formatPeriod(body.T_days)]);
    fields.push(['Radius', `${formatNum(body.r_km)} km`]);
    fields.push(['Mass', formatMass(body.mass_sol)]);
    const moons = world.bodies.filter(b => b.parent === body.id && b.kind === 'moon').length;
    fields.push(['Moons', String(moons)]);
    appendComposition(fields, body);
    return fields;
  }

  if (body.kind === 'moon') {
    fields.push(['Type', 'moon']);
    fields.push(['Orbits', parent.name]);
    fields.push(['Semi-major axis', `${formatNum(body.a * AU_KM)} km`]);
    fields.push(['Eccentricity', body.e.toFixed(3)]);
    fields.push(['Period', formatPeriod(body.T_days)]);
    fields.push(['Radius', `${formatNum(body.r_km)} km`]);
    fields.push(['Mass', formatMass(body.mass_sol)]);
    appendComposition(fields, body);
    return fields;
  }

  return fields;
}

function appendComposition(fields, body) {
  if (!body.composition) return;
  const top = RAW_RESOURCES
    .map(r => [r, body.composition[r] ?? 0])
    .filter(([, v]) => v >= 0.2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (top.length > 0) {
    fields.push(['Rich in', top.map(([r]) => RESOURCE_LABELS[r]).join(', ')]);
  }

  // Reserves: one row per raw resource, % remaining of original. Always show
  // all six so the user can see exactly what's left of every type, including
  // what's already at zero.
  if (body.reserves) {
    for (const r of RAW_RESOURCES) {
      const frac = reserveFraction(body, r);
      if (frac === null) continue;
      fields.push([`Reserve · ${RESOURCE_LABELS[r]}`, `${Math.round(frac * 100)}%`]);
    }
  }
}

function colonyDetails(colony, world) {
  const fields = [];
  const ageDays = world.t - colony.foundedAt;
  const cap = housingCap(colony.habitationTier);
  const fillPct = Math.round((colony.population / cap) * 100);
  fields.push(['Founded', formatAgeYears(ageDays)]);
  fields.push(['Population', `${formatPop(colony.population)} / ${formatPop(cap)} (${fillPct}%)`]);
  fields.push(['Morale', `${Math.round(colony.morale * 100)}%${stressTag(colony)}`]);

  const habCost = nextHabCost(colony.habitationTier);
  fields.push(['Habitation', `Tier ${colony.habitationTier}${habCost ? ` → ${formatTierCost(habCost)}` : ' (maxed)'}`]);
  const indCost = nextIndCost(colony.industryTier);
  fields.push(['Industry', `Tier ${colony.industryTier}${indCost ? ` → ${formatTierCost(indCost)}` : ' (maxed)'}`]);
  if (colony.spaceportTier > 0) fields.push(['Spaceport', `Tier ${colony.spaceportTier}`]);

  // One row per resource: stockpile · flow rate. Shown for every resource so
  // the full economic picture is visible — zero-stockpile zero-flow rows are
  // included intentionally (a flat "Fissile 0 · ±0" tells you fissile isn't
  // being mined here, which can be the answer to "why no industry tier-up?").
  // Flow segment is colour-coded (positive=green, negative=red) so the user
  // can scan for net deficits at a glance.
  for (const r of ALL_RESOURCES) {
    const stock = colony.stockpile[r] ?? 0;
    const flow = colony.flows ? (colony.flows[r] ?? 0) : 0;
    fields.push([RESOURCE_LABELS[r], {
      parts: [
        { text: `${formatStockpile(stock)} · ` },
        { text: `${formatFlow(flow)}/d`, className: flowClass(flow) },
      ],
    }]);
  }
  return fields;
}

function flowClass(flow) {
  if (flow > 0.1) return 'flow-pos';
  if (flow < -0.1) return 'flow-neg';
  return 'flow-zero';
}

function formatTierCost(cost) {
  const parts = [];
  if (cost.goods)   parts.push(`${formatStockpile(cost.goods)} goods`);
  if (cost.metals)  parts.push(`${formatStockpile(cost.metals)} metals`);
  if (cost.fissile) parts.push(`${formatStockpile(cost.fissile)} fissile`);
  return parts.join(' + ');
}

function formatFlow(v) {
  const sign = v >= 0 ? '+' : '−';
  const abs = Math.abs(v);
  if (abs < 0.1) return '±0';
  if (abs >= 1e3) return `${sign}${(abs/1e3).toFixed(1)}k`;
  if (abs >= 100) return `${sign}${Math.round(abs)}`;
  return `${sign}${abs.toFixed(1)}`;
}

function stressTag(colony) {
  if (colony.foodShortfall > 0.2) return ' (starving)';
  if (colony.foodShortfall > 0.05) return ' (hungry)';
  if (colony.goodsShortfall > 0.5) return ' (lacking goods)';
  return '';
}

function formatNum(n) {
  return Math.round(n).toLocaleString('en-US');
}

function formatStockpile(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return Math.round(n).toString();
}

function formatPop(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return Math.round(n).toString();
}

function formatAgeYears(days) {
  const years = days / 365.25;
  if (years < 1) return `${days.toFixed(0)} days ago`;
  if (years < 100) return `${years.toFixed(1)} yr ago`;
  return `${formatNum(years)} yr ago`;
}

function formatPeriod(days) {
  if (days < 1) return `${days.toFixed(2)} days`;
  if (days < 365.25) return `${days.toFixed(1)} days`;
  const years = days / 365.25;
  if (years < 100) return `${years.toFixed(2)} years`;
  return `${formatNum(years)} years`;
}

function formatMass(mass_sol) {
  if (mass_sol >= 0.1) return `${mass_sol.toFixed(2)} M☉`;
  const earth = mass_sol * SOLAR_TO_EARTH;
  if (earth >= 0.01) return `${earth.toFixed(2)} M⊕`;
  return `${earth.toExponential(2)} M⊕`;
}

function titleCase(s) {
  return s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
