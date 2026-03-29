import { JejMap } from "./map";
import { JejPin } from "./pin";
import { JejIcon } from "./icon";
import { domReady } from "./utilities";
import { initController } from "./controller";
import { initView } from "./view";

JejMap;
JejPin;
JejIcon;

await domReady();
await initController();
await initView();
