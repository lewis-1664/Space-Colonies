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
// stays. Above ZOOM_REF, body sizes grow as sqrt(zoom / ZOOM_REF) so
// small planets become inspectable when you zoom in. Capped so the
// star can't swallow the screen at extreme zoom.
const ZOOM_REF = 35;
export function bodyRadiusPx(r_km, zoom = ZOOM_REF) {
  const base = 0.16 * Math.cbrt(r_km);
  const scale = Math.sqrt(Math.max(zoom, ZOOM_REF) / ZOOM_REF);
  return Math.max(2, Math.min(140, base * scale));
}
