import { existsSync, readdirSync } from "node:fs";
import { argv } from "node:process";
import { clearCache } from "./lib/chunk.ts";
import { generateTile } from "./lib/map.ts";
import { round } from "./lib/util.ts";

// TODO:
// - Fix top border of region tiles being brighter
// - Add missing blocks.
// - Prettier & faster biome smoothing
//   - Use dithering? → Use only 4 samples per block, but alternate which ones based on coords parity
// - More intelligent check to see which tiles need to be refreshed → store LastUpdate or something.
// - Check waterloggable blocks / blocks like kelp
//   - it seems waterlogged blocks are treated as water for map purposes?
//   - but mca-json is garbage and does not return block state
//   - so i guess i gotta find another library or code it myself again :/
// - Swamp color noise?
// - CLI options to output different region boundaries
// - fix mca-json parseSection throwing when there is no data. it's cuz the whole section is filled with the same block dumbass -_-
// - Output log with unknown blocks and missing tints and stuff

const worldPath = argv[2];
if (!worldPath) console.error("Please specify the world for which to generate map tiles.");

const regionFiles = readdirSync(`${worldPath}/region`);
const regionCount = regionFiles.length;

const bounds = {
  north: 0,
  east: 0,
  south: 0,
  west: 0
};

for (const [i, regionFile] of Object.entries(regionFiles)) {
  const parts = regionFile.split(".");
  if (parts[0] !== "r" || parts[3] !== "mca") console.error("Ignoring file " + regionFile);

  const regionX = parseInt(parts[1]);
  const regionZ = parseInt(parts[2]);

  if (regionZ < bounds.north) bounds.north = regionZ;
  if (regionX > bounds.east)  bounds.east  = regionX;
  if (regionZ > bounds.south) bounds.south = regionZ;
  if (regionX < bounds.west)  bounds.west  = regionX;

  // Check if tile already exists
  if (existsSync(`output/${regionX}.${regionZ}.webp`)) continue;

  console.log(`${round(Number(i)/regionCount * 100)}% Generating tile for region ${regionX}, ${regionZ}`);
  generateTile(worldPath, regionX, regionZ);
  clearCache();
}
console.log(bounds);

// generateTile(worldPath, 0, -1);
