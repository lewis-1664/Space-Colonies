const RATES = [0, 1, 10, 100, 1000, 10000];
const J2000_MS = Date.UTC(2000, 0, 1, 12);
const DAY_MS = 86400 * 1000;

export function createControls({ onRateChange, getRate, onRegen }) {
  const root = document.createElement('div');
  root.className = 'controls';

  const timeRow = document.createElement('div');
  timeRow.className = 'controls-row';
  const buttons = new Map();
  for (const r of RATES) {
    const btn = document.createElement('button');
    btn.textContent = r === 0 ? 'Pause' : `${r}×`;
    btn.addEventListener('click', () => onRateChange(r));
    buttons.set(r, btn);
    timeRow.appendChild(btn);
  }
  const time = document.createElement('span');
  time.className = 'time';
  timeRow.appendChild(time);

  const seedRow = document.createElement('div');
  seedRow.className = 'controls-row controls-seed';
  const seedLabel = document.createElement('label');
  seedLabel.textContent = 'seed';
  const seedInput = document.createElement('input');
  seedInput.type = 'text';
  seedInput.spellcheck = false;
  const regenBtn = document.createElement('button');
  regenBtn.textContent = 'Regen';
  const summary = document.createElement('span');
  summary.className = 'system-summary';
  seedRow.append(seedLabel, seedInput, regenBtn, summary);

  const submit = () => {
    const value = seedInput.value.trim();
    if (value) onRegen(value);
  };
  regenBtn.addEventListener('click', submit);
  seedInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') submit();
  });

  root.append(timeRow, seedRow);

  function refresh(world) {
    const rate = getRate();
    for (const [r, btn] of buttons) btn.classList.toggle('active', r === rate);
    time.textContent = formatDate(world.t);
    if (document.activeElement !== seedInput) seedInput.value = String(world.seed);
    const parts = [world.starName, `${world.planetCount} planet${world.planetCount === 1 ? '' : 's'}`];
    if (world.beltCount > 0) parts.push(`${world.beltCount} belt${world.beltCount === 1 ? '' : 's'}`);
    summary.textContent = parts.join(' · ');
  }

  return { root, refresh };
}

function formatDate(t_days) {
  return new Date(J2000_MS + t_days * DAY_MS).toISOString().slice(0, 10);
}
