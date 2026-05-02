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

  const dl = document.createElement('dl');

  root.append(header, dl);

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
      dl.replaceChildren();
      for (const [label, value] of bodyDetails(body, world)) {
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.textContent = value;
        dl.append(dt, dd);
      }
    }
  }

  return { root, refresh };
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
    return fields;
  }

  return fields;
}

function formatNum(n) {
  return Math.round(n).toLocaleString('en-US');
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
