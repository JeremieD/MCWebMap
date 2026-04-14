export const REGION_SIZE = 512; // blocks
export const SECTION_SIZE = 16; // blocks
export const WORLD_MAX_HEIGHT = 320;
export const WORLD_MIN_HEIGHT = -64;

/**
 * Modulo that treats negative numbers more sanely.
 * `mod(x, n)` is roughly equal to `x % n`.
 */
export const mod = (x: number, n: number) => ((x % n) + n) % n;

export function round(x: number, p: number = 2) {
  const f = 10**p;
  return Math.round(x*f) / f;
}

export type Dimension = "overworld" | "nether" | "end";

export function getDimensionSubPath(dimension: Dimension | string | undefined) {
  switch (dimension) {
    case "nether":
    case "the_nether":
    case "-1":
      return "dimensions/minecraft/the_nether/region";
      return "DIM-1/region"; // Pre 26.1

    case "end":
    case "the_end":
    case "1":
      return "dimensions/minecraft/the_end/region";
      return "DIM1/region"; // Pre 26.1

    default:
      return "dimensions/minecraft/overworld/region";
      return "region"; // Pre 26.1
  }
};
