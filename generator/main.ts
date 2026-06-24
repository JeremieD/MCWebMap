import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { argv } from "node:process";
import { generateTile, TILE_SIZE } from "./lib/map.ts";
import type { Dimension } from "./lib/util.ts";
import { getDimensionSubPath, round } from "./lib/util.ts";

// TODO:
// - Fix top border of region tiles being brighter
// - Prettier & faster biome smoothing
//   - Use dithering? → Use only 4 samples per block, but alternate which ones based on coords parity
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

const worldPath = argv[2];
if (!worldPath) console.error("Please specify the world for which to generate map tiles.");

const metaFilePath = "meta.json";

const dimension = "end";

generateAllTiles(worldPath, `output/${dimension}`, dimension);
// generateTile(worldPath, `output/${dimension}`, dimension, 0, 0);

function generateAllTiles(worldPath: string, outputPath: string, dimension: Dimension) {
  const inputPath = `${worldPath}/${getDimensionSubPath(dimension)}`;
  const folder = readdirSync(inputPath);
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

  const tilesToGenerate = new Map<string, [tileX: number, tileZ: number]>();

  // FIRST PASS: Find out what needs to be generated
  for (const [i, regionFile] of Object.entries(folder)) {
    const parts = regionFile.split(".");
    if (parts[0] !== "r" || parts[3] !== "mca") console.error("Ignoring file " + regionFile);
    const regionX = parseInt(parts[1]);
    const regionZ = parseInt(parts[2]);

    const tileX = Math.floor(regionX / TILE_SIZE);
    const tileZ = Math.floor(regionZ / TILE_SIZE);
    const tileKey = `${tileX}.${tileZ}`;

    const stats = statSync(`${inputPath}/${regionFile}`);
    const modTime = stats.mtimeMs;

    // Update bounds
    if (regionZ < bounds.north) bounds.north = regionZ;
    if (regionX > bounds.east)  bounds.east  = regionX;
    if (regionZ > bounds.south) bounds.south = regionZ;
    if (regionX < bounds.west)  bounds.west  = regionX;

    // Skip if empty
    if (stats.size === 0) continue;

    // Skip if unchanged
    if (existsSync(`${outputPath}/0/${tileKey}.webp`) &&
        modTime <= modTimes[tileKey]) continue;

    // Write tile modTime
    if (modTimes[tileKey] === undefined || modTime > modTimes[tileKey]) modTimes[tileKey] = modTime;

    tilesToGenerate.set(tileKey, [tileX, tileZ]);
  }

  console.log("Tiles to update: ", tilesToGenerate);

  // SECOND PASS: Generate tiles
  const tileCount = tilesToGenerate.size;
  let i = 0;
  for (const [_, [tileX, tileZ]] of tilesToGenerate) {
    console.log(`${round(i++ / tileCount * 100)}% Generating tile ${tileX}, ${tileZ}.`);
    generateTile(worldPath, outputPath, dimension, tileX, tileZ);
  }

  const metaData = {
    bounds: bounds,
    modTimes: modTimes
  };
  writeFileSync(`${outputPath}/${metaFilePath}`, JSON.stringify(metaData));
}
