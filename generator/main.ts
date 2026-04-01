import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { argv } from "node:process";
import { clearCache } from "./lib/chunk.ts";
import { generateTile } from "./lib/map.ts";
import type { Dimension } from "./lib/util.ts";
import { getDimensionSubPath, round } from "./lib/util.ts";

// TODO:
// - Fix top border of region tiles being brighter
// - Prettier & faster biome smoothing
//   - Use dithering? → Use only 4 samples per block, but alternate which ones based on coords parity
// - More intelligent check to see which tiles need to be refreshed → store LastUpdate or something.
// - Check waterloggable blocks / blocks like kelp
//   - it seems waterlogged blocks are treated as water for map purposes?
//   - but mca-json is garbage and does not return block state
//   - so i guess i gotta find another library or code it myself again :/
// - Swamp color noise? i dont think this would look good? or it would just be confusing
// - CLI options
//   - bound options
//   - dimension option
// - write my own nbt parser
// - Water uses biome colours only for ocean biomes? That way the coasts arent so ugly...
// - If anything, water close to shore should be paler than oceans. and temperature is not that important (except lukewarm)
// - Or maybe... only deep oceans have their own colour. that way you can tell the temperature, but it doesnt interfere with the shore
// - Deep oceans are useless to mark and confusing because there is already depth shading.
//   - What if it was based directly on temperature noise instead?
// - Test if bigger tiles is more efficient

const worldPath = argv[2];
if (!worldPath) console.error("Please specify the world for which to generate map tiles.");

const metaFilePath = "meta.json";

const dimension = "overworld";

generateAllTiles(worldPath, `output/${dimension}`, dimension);
// generateTile(worldPath, `output/${dimension}`, dimension, 0, -1);

function generateAllTiles(worldPath: string, outputPath: string, dimension: Dimension) {
  const inputPath = `${worldPath}/${getDimensionSubPath(dimension)}`;
  const folder = readdirSync(inputPath);
  const regionCount = folder.length;
  const bounds = {
    north: 0,
    east: 0,
    south: 0,
    west: 0
  };
  let metaFile;
  try {
    let rawFile = readFileSync(`${outputPath}/${metaFilePath}`);
    metaFile = JSON.parse(rawFile?.toLocaleString());
  } catch (e) {}
  const modTimes = metaFile?.modTimes ?? {};

  mkdirSync(outputPath, { recursive: true });

  for (const [i, regionFile] of Object.entries(folder)) {
    const parts = regionFile.split(".");
    if (parts[0] !== "r" || parts[3] !== "mca") console.error("Ignoring file " + regionFile);

    const regionX = parseInt(parts[1]);
    const regionZ = parseInt(parts[2]);
    const regionKey = `${regionX}.${regionZ}`;

    if (regionZ < bounds.north) bounds.north = regionZ;
    if (regionX > bounds.east)  bounds.east  = regionX;
    if (regionZ > bounds.south) bounds.south = regionZ;
    if (regionX < bounds.west)  bounds.west  = regionX;

    // Check if tile needs to be generated
    const modTime = statSync(`${inputPath}/r.${regionKey}.mca`).mtimeMs;
    if (existsSync(`${outputPath}/${regionKey}.webp`) &&
        modTimes[regionKey] >= modTime) continue;

    console.log(`${round(Number(i)/regionCount * 100)}% Generating tile for region ${regionX}, ${regionZ}`);

    generateTile(worldPath, outputPath, dimension, regionX, regionZ);
    modTimes[regionKey] = modTime;

    clearCache();
  }

  const metaData = {
    bounds: bounds,
    modTimes: modTimes
  };
  writeFileSync(`${outputPath}/${metaFilePath}`, JSON.stringify(metaData));
}
