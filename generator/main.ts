import { argv } from "node:process";
import { generateTile } from "./lib/map.ts";

const worldPath = argv[2];
if (!worldPath) console.error("Please specify the world for which to generate map tiles.");

generateTile(worldPath, 0, -1);
