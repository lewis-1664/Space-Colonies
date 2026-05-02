const TWO_PI = Math.PI * 2;

export function solveKepler(M, e, tol = 1e-10) {
  M = ((M + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 32; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < tol) break;
  }
  return E;
}

// Position in the orbital plane with the focus at the origin.
//   a       semi-major axis (units of caller's choice)
//   e       eccentricity
//   omega   longitude of perihelion (rad), 2D ecliptic-collapsed frame
//   L0      mean longitude at epoch (rad)
//   n       mean motion (rad / day)
//   t       time (days since epoch)
export function orbitalPosition(a, e, omega, L0, n, t) {
  const M = L0 + n * t - omega;
  const E = solveKepler(M, e);
  const sqrt1pe = Math.sqrt(1 + e);
  const sqrt1me = Math.sqrt(1 - e);
  const nu = 2 * Math.atan2(sqrt1pe * Math.sin(E / 2), sqrt1me * Math.cos(E / 2));
  const r = a * (1 - e * Math.cos(E));
  return { x: r * Math.cos(nu + omega), y: r * Math.sin(nu + omega) };
}
