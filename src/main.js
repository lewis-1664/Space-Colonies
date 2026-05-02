import { createWorld, advanceWorld } from './sim/world.js';
import { createRenderer, resizeRenderer, drawWorld, hitTest } from './render/renderer.js';
import { createCamera } from './render/camera.js';
import { createControls } from './ui/controls.js';
import { createInspector } from './ui/inspector.js';
import { installCameraControls } from './ui/input.js';

const canvas = document.getElementById('view');
const sidebar = document.getElementById('sidebar');

let world = createWorld({ seed: 'space-colonies' });
const renderer = createRenderer(canvas);
const camera = createCamera({ zoom: 35 });

// Base time rate: 1× = BASE_RATE sim days per real second.
// 0.1 keeps moons watchable at 1× (visual moon period ~0.5 days
// → ~5 sec/orbit). Multipliers go up to 10000× = 1000 days/sec
// (~2.7 in-game years per real second).
const BASE_RATE = 0.1;
let rate = 1;

let selectedBodyId = null;

function regen(seed) {
  world = createWorld({ seed });
  camera.zoom = 35;
  camera.centerX = 0;
  camera.centerY = 0;
  selectedBodyId = null;
}

const controls = createControls({
  onRateChange: r => { rate = r; },
  getRate: () => rate,
  onRegen: regen,
});
sidebar.appendChild(controls.root);

const inspector = createInspector({ onClose: () => { selectedBodyId = null; } });
document.body.appendChild(inspector.root);

installCameraControls(canvas, camera, {
  onClick: (x, y) => { selectedBodyId = hitTest(x, y, renderer.hits); },
});

window.__sim = {
  get world() { return world; },
  camera,
  setRate: r => { rate = r; },
  regen,
};

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (rate > 0) advanceWorld(world, dt * rate * BASE_RATE);
  resizeRenderer(renderer);
  drawWorld(renderer, world, camera);
  controls.refresh(world);
  inspector.refresh(world, selectedBodyId);
  requestAnimationFrame(frame);
}

resizeRenderer(renderer);
requestAnimationFrame(frame);
window.addEventListener('resize', () => resizeRenderer(renderer));
