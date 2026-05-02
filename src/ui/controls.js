const RATES = [0, 1, 10, 100, 1000, 10000];
const J2000_MS = Date.UTC(2000, 0, 1, 12);
const DAY_MS = 86400 * 1000;

export function createControls({ onRateChange, getRate }) {
  const root = document.createElement('div');
  root.className = 'controls';

  const buttons = new Map();
  for (const r of RATES) {
    const btn = document.createElement('button');
    btn.textContent = r === 0 ? 'Pause' : `${r}×`;
    btn.addEventListener('click', () => onRateChange(r));
    buttons.set(r, btn);
    root.appendChild(btn);
  }

  const time = document.createElement('span');
  time.className = 'time';
  root.appendChild(time);

  function refresh(world) {
    const rate = getRate();
    for (const [r, btn] of buttons) btn.classList.toggle('active', r === rate);
    time.textContent = formatDate(world.t);
  }

  return { root, refresh };
}

function formatDate(t_days) {
  return new Date(J2000_MS + t_days * DAY_MS).toISOString().slice(0, 10);
}
