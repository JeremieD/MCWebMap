import { JejMap } from "./map";

/**
 * View
 */

const V: {
  map: JejMap
} = {} as any;
const bounds = { north: -3, east: 3, south: 3, west: -3 };
// const bounds = { north: -20, east: 23, south: 18, west: -23 };

export async function initView() {
  console.log("Initializing view...");

  V.map = document.getElementById("map") as JejMap;

  const width  = Math.abs(bounds.east  - bounds.west) * 512;
  const height = Math.abs(bounds.south - bounds.north) * 512;

  V.map.origin = [-bounds.west*512, -bounds.north*512];
  V.map.width = width;
  V.map.height = height;

  for (let x = bounds.west;  x < bounds.east;  x++)
  for (let z = bounds.north; z < bounds.south; z++) {
    const img = document.createElement("img");
    // img.loading = "lazy";
    img.src = `resources/graphics/overworld/${x}.${z}.webp`;
    img.style.gridColumn = (x - bounds.west + 1).toString();
    img.style.gridRow    = (z - bounds.north + 1).toString();
    V.map.querySelector(".tiles")?.append(img);
  }

  V.map.panX(-bounds.west*512, false);
  V.map.panY(-bounds.north*512, false);
  V.map.zoom(.5);
}
