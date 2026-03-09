import type { BlockInstance, Coords2d, Coords3d } from "mca-json";
import { Chunk } from "mca-json";
import { mod } from "./util.ts";

/**
 * Returns the instance of the block at the highest y-value, for a given
 * (x, z) locaction using world coordinates.
 * @param chunk
 * @param coords
 * @returns a BlockInstance
 */
export function getHighestBlock(chunk: Chunk, coords: Coords2d): BlockInstance {
  const [xWorld, zWorld] = chunk.worldCoordinates() ?? [0, 0];
  const xChunk = coords[0] - xWorld;
  const zChunk = coords[1] - zWorld;
  if (xChunk < 0 || xChunk > 15) throw new Error("X coordinate out of bounds");
  if (zChunk < 0 || zChunk > 15) throw new Error("Z coordinate out of bounds");

  const heightmap = worldSurfaceHeightmapTag(chunk);
  const index = (zChunk << 4) | xChunk;
  const packedLong = heightmap[Math.floor(index / 7)] ?? 0n;
  const y = (Number((packedLong >> BigInt(index%7*9)) & 511n)) - 65;

  return chunk.getBlock([coords[0], y, coords[1]]);
}

const heightmapTagsCache = {};
function worldSurfaceHeightmapTag(chunk: Chunk) {
  const chunkKey = chunk.chunkKey();
  if (!chunkKey) throw new Error("Invalid chunk");
  if (heightmapTagsCache[chunkKey]) return heightmapTagsCache[chunkKey];

  const heightmapTag = chunk.toObject().compound.Heightmaps.compound.WORLD_SURFACE;
  if (!heightmapTag) throw new Error("Not fully generated");
  const heightmap = heightmapTag.longArray.map(s => BigInt(s));

  heightmapTagsCache[chunkKey] = heightmap;
  return heightmap;
}

const sectionTagsCache = {};
function sectionTag(chunk: Chunk, sectionY: number) {
  const chunkKey = chunk.chunkKey();
  if (!chunkKey) throw new Error("Invalid chunk");
  const sectionKey = chunkKey + "," + sectionY;
  if (sectionTagsCache[sectionKey]) return sectionTagsCache[sectionKey];

  const sectionsTag = chunk.toObject().compound.sections.list;
  if (!sectionsTag) throw new Error("Invalid chunk - no sections found");
  const sectionTag = sectionsTag.find(s => getSectionY(s.compound.Y.byte) === sectionY);
  if (!sectionTag) throw new Error("Coords not found in any sections");

  sectionTagsCache[sectionKey] = sectionTag;
  return sectionTag;
}

export function getStatus(chunk: Chunk) {
  return chunk.toObject().compound.Status.string;
}

/**
 * Returns the biome name at a given (x, y, z) world coordinate.
 * @param chunk
 * @param coords
 */
export function getBiome(chunk: Chunk, coords: Coords3d): string {
  const [xWorld, zWorld] = chunk.worldCoordinates() ?? [0, 0];
  const xChunk = coords[0] - xWorld;
  const zChunk = coords[2] - zWorld;
  if (xChunk < 0 || xChunk > 15) throw new Error("X coordinate out of bounds");
  if (zChunk < 0 || zChunk > 15) throw new Error("Z coordinate out of bounds");

  const sectionY = Math.floor(coords[1] / 16);
  const section = sectionTag(chunk, sectionY);

  const biomePalette = section.compound.biomes.compound.palette.list.map(o => o.string);
  const paletteLength = biomePalette.length;
  if (paletteLength === 1) return biomePalette[0];

  const biomeData = section.compound.biomes.compound.data.longArray.map(s => BigInt(s));

  const bitsPerPaletteId = Math.ceil(Math.log2(paletteLength));
  const idsPerLong = Math.floor(64 / bitsPerPaletteId);

  const index = (mod(Math.floor(coords[1]/4), 4) << 4) | ((mod(Math.floor(coords[2]/4), 4)) << 2) | mod(Math.floor(coords[0]/4), 4);
  const packedLong = biomeData[Math.floor(index / idsPerLong)] ?? 0n;
  const biomeId = Number((packedLong >> BigInt(index%idsPerLong*bitsPerPaletteId)) & BigInt(2**bitsPerPaletteId-1));
  return biomePalette[biomeId];
}

function getSectionY(yByte: number) {
  if (yByte >= 128) yByte -= 256;
  return yByte;
}

export function getDepth(chunk: Chunk, block: BlockInstance): number {
  let depth = 0;
  let current = block;
  do {
    depth++;
    current = chunk.getBlock([current.coords[0], current.coords[1]-1, current.coords[2]]);
  } while (current.name === block.name);
  return depth;
}
