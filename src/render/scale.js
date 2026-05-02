// Distance compression for orbital radii — pretty, not accurate.
// asinh(r/K) * K is essentially linear for r << K and log-like for r >> K,
// with a smooth derivative everywhere. K=4 keeps the inner system at near
// true scale and gently pulls Neptune in.
const COMPRESS_K = 4;
export function compressAU(r_au) {
  return COMPRESS_K * Math.asinh(r_au / COMPRESS_K);
}

// Visual radius in pixels. Sun ~14 px, Jupiter ~7 px, Earth ~3 px, Mercury ~2 px.
// True scale is unreadable — the Sun is ~290× Mercury by radius.
export function bodyRadiusPx(r_km) {
  return Math.max(2, Math.min(14, 0.16 * Math.cbrt(r_km)));
}
