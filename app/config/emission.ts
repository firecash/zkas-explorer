// Deterministic FireCash emission schedule, mirrored from the chain's coinbase
// constants (consensus/src/processes/coinbase.rs):
//   * initial reward 6 $firecash/block at 10 BPS,
//   * smooth decay with a 3-month half-life,
//   * two-step perpetual tail: 0.6 $firecash/block until calendar month 24,
//     then 0.3 $firecash/block forever.
// These let the analytics page draw the real emission/supply curves client-side,
// with no historical time-series needed.

export const INITIAL_REWARD = 6; // $firecash / block @ 10 BPS
export const HALF_LIFE_MONTHS = 3;
export const TAIL_INITIAL = 0.6;
export const TAIL_FINAL = 0.3;
export const TAIL_STEP_DOWN_MONTH = 24;
export const BPS = 10;
export const SECONDS_PER_MONTH = 2_629_800; // 30.4375 days
export const BLOCKS_PER_MONTH = BPS * SECONDS_PER_MONTH; // 26,298,000

/** Per-block reward (whole $firecash) at a given calendar month, continuous. */
export function rewardAtMonth(month: number): number {
  const curve = INITIAL_REWARD * Math.pow(2, -month / HALF_LIFE_MONTHS);
  const tail = month < TAIL_STEP_DOWN_MONTH ? TAIL_INITIAL : TAIL_FINAL;
  return Math.max(curve, tail);
}

/** Emission-per-block series, monthly samples over [0, months]. */
export function emissionSeries(months = 48): { x: number; y: number }[] {
  return Array.from({ length: months + 1 }, (_, m) => ({ x: m, y: rewardAtMonth(m) }));
}

/** Cumulative emitted supply (billions of $firecash), monthly, trapezoid-integrated. */
export function supplySeries(months = 48): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [{ x: 0, y: 0 }];
  let cum = 0; // whole $firecash
  for (let m = 1; m <= months; m++) {
    const avg = (rewardAtMonth(m - 1) + rewardAtMonth(m)) / 2;
    cum += avg * BLOCKS_PER_MONTH;
    out.push({ x: m, y: cum / 1e9 });
  }
  return out;
}
