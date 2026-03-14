import { JejMap } from "./map";
import { domReady } from "./utilities";
import { initController } from "./controller";
import { initView } from "./view";

JejMap;
await domReady();
await initController();
await initView();
