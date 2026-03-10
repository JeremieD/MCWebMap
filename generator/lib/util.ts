export const REGION_SIZE = 512; // blocks
export const SECTION_SIZE = 16; // blocks
export const WORLD_MAX_HEIGHT = 320;
export const WORLD_MIN_HEIGHT = -64;

/**
 * Modulo that treats negative numbers more sanely.
 * `mod(x, n)` is roughly equal to `x % n`.
 */
export const mod = (x: number, n: number) => ((x % n) + n) % n;
