// Distance compression for orbital radii — pretty, not accurate.
// Linear up to ~1 AU, square-root above. Keeps the inner planets readable
// without letting Neptune fly off the screen.
export function compressAU(r_au) {
  if (r_au < 1) return r_au;
  return 1 + Math.sqrt(r_au - 1) * 1.7;
}

// Visual radius in pixels. Sun ~14 px, Jupiter ~7 px, Earth ~3 px, Mercury ~2 px.
// True scale is unreadable — the Sun is ~290× Mercury by radius.
export function bodyRadiusPx(r_km) {
  return Math.max(2, Math.min(14, 0.16 * Math.cbrt(r_km)));
}
