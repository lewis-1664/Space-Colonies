// Center is in compressed-AU world units. Zoom is pixels per compressed-AU.
export function createCamera({ centerX = 0, centerY = 0, zoom = 35 } = {}) {
  return { centerX, centerY, zoom };
}

export function worldToScreen(camera, canvas, x, y) {
  return {
    sx: canvas.clientWidth / 2 + (x - camera.centerX) * camera.zoom,
    sy: canvas.clientHeight / 2 + (y - camera.centerY) * camera.zoom,
  };
}
