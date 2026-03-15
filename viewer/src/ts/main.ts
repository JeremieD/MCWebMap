import { JejMap } from "./map";
import { JejPin } from "./pin";
import { domReady } from "./utilities";
import { initController } from "./controller";
import { initView } from "./view";

JejMap;
JejPin;

await domReady();
await initController();
await initView();
