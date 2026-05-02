// Heliocentric orbital elements at J2000.0 epoch. Source: JPL approximate
// elements for the major planets. Inclination and ascending node are dropped
// for the 2D ecliptic-projected view per DESIGN.md §3.

const DEG = Math.PI / 180;
const TWO_PI = Math.PI * 2;

const PLANETS = [
  { id: 'mercury', name: 'Mercury', a:  0.38709893, e: 0.20563069, peri_deg:  77.45645, L0_deg: 252.25084, T_days:    87.969, r_km:  2440, color: '#a89888' },
  { id: 'venus',   name: 'Venus',   a:  0.72333199, e: 0.00677323, peri_deg: 131.53298, L0_deg: 181.97973, T_days:   224.701, r_km:  6052, color: '#e8c896' },
  { id: 'earth',   name: 'Earth',   a:  1.00000011, e: 0.01671022, peri_deg: 102.94719, L0_deg: 100.46435, T_days:   365.256, r_km:  6371, color: '#6ba6e8' },
  { id: 'mars',    name: 'Mars',    a:  1.52366231, e: 0.09341233, peri_deg: 336.04084, L0_deg: 355.45332, T_days:   686.980, r_km:  3389, color: '#d27858' },
  { id: 'jupiter', name: 'Jupiter', a:  5.20336301, e: 0.04839266, peri_deg:  14.75385, L0_deg:  34.40438, T_days:  4332.589, r_km: 69911, color: '#d6b88b' },
  { id: 'saturn',  name: 'Saturn',  a:  9.53707032, e: 0.05415060, peri_deg:  92.43194, L0_deg:  49.94432, T_days: 10759.220, r_km: 58232, color: '#e8d8a8' },
  { id: 'uranus',  name: 'Uranus',  a: 19.19126393, e: 0.04716771, peri_deg: 170.96424, L0_deg: 313.23218, T_days: 30685.400, r_km: 25362, color: '#9bd8e0' },
  { id: 'neptune', name: 'Neptune', a: 30.06896348, e: 0.00858587, peri_deg:  44.97135, L0_deg: 304.88003, T_days: 60189.000, r_km: 24622, color: '#5a7be0' },
];

export const SUN = {
  id: 'sun',
  name: 'Sun',
  kind: 'star',
  parent: null,
  r_km: 696000,
  color: '#ffd86b',
};

export function buildSolarSystem() {
  const bodies = [SUN];
  for (const p of PLANETS) {
    bodies.push({
      id: p.id,
      name: p.name,
      kind: 'planet',
      parent: 'sun',
      a: p.a,
      e: p.e,
      omega: p.peri_deg * DEG,
      L0: p.L0_deg * DEG,
      n: TWO_PI / p.T_days,
      T_days: p.T_days,
      r_km: p.r_km,
      color: p.color,
    });
  }
  return bodies;
}
