/**
 * Modulo that treats negative numbers more sanely.
 * `mod(x, n)` is roughly equal to `x % n`.
 */
export const mod = (x: number, n: number) => ((x % n) + n) % n;
