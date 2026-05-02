// Distance compression for orbital radii — pretty, not accurate.
// asinh(r/K) * K is essentially linear for r << K and log-like for r >> K,
// with a smooth derivative everywhere. K=4 keeps the inner system at near
// true scale and gently pulls Neptune in.
const COMPRESS_K = 4;
export function compressAU(r_au) {
  return COMPRESS_K * Math.asinh(r_au / COMPRESS_K);
}

// Visual radius in pixels. At ZOOM_REF (default zoom): Sun ~14 px,
// Jupiter ~7 px, Earth ~3 px, Mercury ~2 px. True scale is unreadable
// (the Sun is ~290× Mercury by radius), so the cube-root compression
// stays. Sizes scale 1:1 with zoom — zoom in 2×, bodies double; zoom
// out, they shrink with the orbits, so the sun's glow can't swallow
// the inner planets at low zoom. Min clamp keeps any body visible.
const ZOOM_REF = 35;
export function bodyRadiusPx(r_km, zoom = ZOOM_REF) {
  const base = 0.16 * Math.cbrt(r_km);
  return Math.max(2, Math.min(500, base * zoom / ZOOM_REF));
}
