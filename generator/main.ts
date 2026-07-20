import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { argv } from "node:process";
import sharp from "sharp";
import { generateTile, IMG_CHANNELS, stitchTiles, TILE_SIZE } from "./lib/map.ts";
import type { Dimension } from "./lib/util.ts";
import { getDimensionSubPath, REGION_SIZE, round } from "./lib/util.ts";

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
//   - regenerate option
// - write my own nbt parser
// - Water uses biome colors only for ocean biomes? That way the coasts arent so ugly...
// - If anything, water close to shore should be paler than oceans. and temperature is not that important (except lukewarm)
// - Or maybe... only deep oceans have their own color. that way you can tell the temperature, but it doesnt interfere with the shore
// - Deep oceans are useless to mark and confusing because there is already depth shading.
//   - What if it was based directly on temperature noise instead?

const worldPath = argv[2];
if (!worldPath) {
  console.error("Please specify the world for which to generate map tiles.");
  process.exit();
}

const metaFilePath = "meta.json";

const dimension = "end";

// generateTile(worldPath, `output/${dimension}`, dimension, 0, 0);
generateAllTiles(worldPath, `output/${dimension}`, dimension);
generateZoom2(`output/${dimension}`);

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
    if (parts[0] !== "r" || parts[3] !== "mca") {
      console.error("Ignoring file " + regionFile);
      continue;
    }
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
    if (existsSync(`${outputPath}/1/${tileKey}.webp`) &&
        modTime <= modTimes[tileKey]) continue;

    // Write tile modTime
    if (modTimes[tileKey] === undefined || modTime > modTimes[tileKey]) modTimes[tileKey] = modTime;

    tilesToGenerate.set(tileKey, [tileX, tileZ]);
  }

  console.log("Zoom1 tiles to update: ", tilesToGenerate);

  // SECOND PASS: Generate tiles
  const tileCount = tilesToGenerate.size;
  let i = 0;
  for (const [_, [tileX, tileZ]] of tilesToGenerate) {
    const percent = round(i++ / tileCount * 100, 0).toString().padStart(2, " ");
    console.log(`${percent}% Generating zoom1 tile ${tileX}, ${tileZ}.`);
    generateTile(worldPath, outputPath, dimension, tileX, tileZ);
  }

  const metaData = {
    bounds: bounds,
    modTimes: modTimes
  };
  writeFileSync(`${outputPath}/${metaFilePath}`, JSON.stringify(metaData));
}

async function generateZoom2(outputPath: string) {
  const zoom1Path = `${outputPath}/1`;
  mkdirSync(zoom1Path, { recursive: true });
  const folder = readdirSync(zoom1Path);

  const tilesToGenerate = new Map<string, [tileX: number, tileZ: number]>();

  // FIRST PASS: Find out what needs to be generated
  for (const [i, tile1File] of Object.entries(folder)) {
    const parts = tile1File.split(".");
    if (parts[2] !== "webp") {
      console.error("Ignoring file " + tile1File);
      continue;
    }
    const tile1X = parseInt(parts[0]);
    const tile1Z = parseInt(parts[1]);

    const tile2X = Math.floor(tile1X / 2);
    const tile2Z = Math.floor(tile1Z / 2);
    const tile2Key = `${tile2X}.${tile2Z}`;

    tilesToGenerate.set(tile2Key, [tile2X, tile2Z]);
  }

  console.log("Zoom2 tiles to update: ", tilesToGenerate);

  // SECOND PASS: Generate tiles
  const tileCount = tilesToGenerate.size;
  let i = 0;
  mkdirSync(`${outputPath}/2`, { recursive: true });
  for (const [_, [tile2X, tile2Z]] of tilesToGenerate) {
    const subTiles: Uint8ClampedArray<ArrayBuffer>[] = [];
    const percent = round(i++ / tileCount * 100, 0).toString().padStart(2, " ");
    console.log(`${percent}% Generating zoom2 tile ${tile2X}, ${tile2Z}.`);
    const tile1X = tile2X*2;
    const tile1Z = tile2Z*2;
    for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++) {
      const fileName = `${outputPath}/1/${tile1X+i}.${tile1Z+j}.webp`;
      let tex: Uint8ClampedArray<ArrayBuffer>;
      if (existsSync(fileName)) {
        tex = scaleDown(new Uint8ClampedArray(await sharp(fileName).raw().toBuffer()), 2048);
      } else {
        tex = new Uint8ClampedArray(await sharp({
          create: {
            width: 1024,
            height: 1024,
            channels: 4,
            background: "rgba(0,0,0,0)"
          }
        }).raw().toBuffer());
      }
      subTiles.push(tex);
    }
    sharp(stitchTiles(subTiles), {
      raw: {
        width: 2048,
        height: 2048,
        channels: IMG_CHANNELS
      }
    }).webp({ lossless: true, effort: 6 })
      .toFile(`${outputPath}/2/${tile2X}.${tile2Z}.webp`);
  }
}

function scaleDown(input: Uint8ClampedArray<ArrayBuffer>, size: number, scale = 2): Uint8ClampedArray<ArrayBuffer> {
  const outputSize = Math.floor(size / scale);
  const tex = new Uint8ClampedArray(outputSize*outputSize * IMG_CHANNELS);
  for (let x = 0; x < outputSize; x++)
  for (let z = 0; z < outputSize; z++) {
    const outPixelOffset = (z*outputSize + x) * IMG_CHANNELS;
    const inPixelOffset  = (z*scale*outputSize*scale + x*scale) * IMG_CHANNELS;
    tex[outPixelOffset]   = input[inPixelOffset];
    tex[outPixelOffset+1] = input[inPixelOffset+1];
    tex[outPixelOffset+2] = input[inPixelOffset+2];
    tex[outPixelOffset+3] = input[inPixelOffset+3];
  }
  return tex;
}
