import type { BlockInstance, Coords2d, Generic } from "mca-json";
import { Chunk } from "mca-json";

/**
 * Returns the instance of the block at the highest y-value, for a given
 * (x, z) locaction using world coordinates.
 */
export function getHighestBlock(chunk: Chunk, coords: Coords2d): BlockInstance {
  const [xWorld, zWorld] = chunk.worldCoordinates() ?? [0, 0];
  const xChunk = coords[0] - xWorld;
  const zChunk = coords[1] - zWorld;

  if (xChunk < 0 || xChunk > 15) throw new Error('X coordinate out of bounds');
  if (zChunk < 0 || zChunk > 15) throw new Error('Z coordinate out of bounds');

  const heightmap = worldSurfaceHeightmapTag(chunk);
  const index = (zChunk << 4) | xChunk;
  const packedLong = heightmap[Math.floor(index / 7)] ?? 0n;
  const y = (Number((packedLong >> BigInt(index%7*9)) & 511n)) - 65;

  return chunk.getBlock([coords[0], y, coords[1]]);
}

const heightmapTagsCache = {};
function worldSurfaceHeightmapTag(chunk: Chunk) {
  const chunkKey = chunk.chunkKey();
  if (!chunkKey) throw new Error("Invalid Chunk");
  if (heightmapTagsCache[chunkKey]) return heightmapTagsCache[chunkKey];
  const heightmapTag = chunk.toObject().compound.Heightmaps.compound.WORLD_SURFACE.longArray.map(s => BigInt(s));
  heightmapTagsCache[chunkKey] = heightmapTag;
  return heightmapTag;
}

export function getDepth(chunk: Chunk, block: Generic): number {
  let depth = 0;
  let current = block;
  do {
    depth++;
    current = chunk.getBlock([current.coords[0], current.coords[1]-1, current.coords[2]]);
  } while (current.name === block.name);
  return depth;
}
