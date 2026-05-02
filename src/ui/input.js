// Mouse-driven camera controls. The camera object is mutated in place;
// the render loop redraws every frame so no explicit invalidation is needed.

const ZOOM_MIN = 2;
const ZOOM_MAX = 20000;

export function installCameraControls(canvas, camera) {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.style.cursor = 'grabbing';
  });

  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    canvas.style.cursor = '';
  });

  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    camera.centerX -= dx / camera.zoom;
    camera.centerY -= dy / camera.zoom;
  });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const wxBefore = camera.centerX + (mx - rect.width / 2) / camera.zoom;
    const wyBefore = camera.centerY + (my - rect.height / 2) / camera.zoom;
    const factor = Math.exp(-e.deltaY * 0.001);
    camera.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, camera.zoom * factor));
    camera.centerX = wxBefore - (mx - rect.width / 2) / camera.zoom;
    camera.centerY = wyBefore - (my - rect.height / 2) / camera.zoom;
  }, { passive: false });
}
