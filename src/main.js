import { createWorld, advanceWorld } from './sim/world.js';
import { createRenderer, resizeRenderer, drawWorld } from './render/renderer.js';
import { createCamera } from './render/camera.js';
import { createControls } from './ui/controls.js';

const canvas = document.getElementById('view');
const sidebar = document.getElementById('sidebar');

const world = createWorld({ seed: 'space-colonies' });
const renderer = createRenderer(canvas);
const camera = createCamera({ zoom: 35 });

let rate = 1;

const controls = createControls({
  onRateChange: r => { rate = r; },
  getRate: () => rate,
});
sidebar.appendChild(controls.root);

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (rate > 0) advanceWorld(world, dt * rate);
  resizeRenderer(renderer);
  drawWorld(renderer, world, camera);
  controls.refresh(world);
  requestAnimationFrame(frame);
}

resizeRenderer(renderer);
requestAnimationFrame(frame);
window.addEventListener('resize', () => resizeRenderer(renderer));
