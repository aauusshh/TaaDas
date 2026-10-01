export type Direction = 'ccw' | 'cw';

/** Seats are numbered clockwise on screen. Nepali taas default is counter-clockwise. */
export function nextSeat(seat: number, n: number, dir: Direction = 'ccw'): number {
  return dir === 'ccw' ? (seat + n - 1) % n : (seat + 1) % n;
}

/** Seats in play order starting after `from`. */
export function orderFrom(from: number, n: number, dir: Direction = 'ccw'): number[] {
  const out: number[] = [];
  let s = from;
  for (let i = 0; i < n; i++) {
    s = nextSeat(s, n, dir);
    out.push(s);
  }
  return out;
}
