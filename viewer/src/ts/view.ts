import { JejMap } from "./map";
import { JejSlider } from "./slider";

/**
 * View
 */

const V: {
  map: JejMap,
  subtitle: HTMLParagraphElement,
  regionOutput: HTMLOutputElement,
  mainHUD: HTMLElement,
  hudToggle: HTMLElement,
  dimensionToggle: HTMLElement,
  timelineSlider: JejSlider,
  poisToggle: HTMLElement,
  gridToggle: HTMLElement,
  zoomIn: HTMLButtonElement,
  zoomOut: HTMLButtonElement
} = {} as any;

export async function initView() {
  console.log("Initializing view...");

  V.map = document.getElementById("map") as JejMap;
  V.subtitle = document.getElementById("subtitle") as HTMLParagraphElement;
  V.regionOutput = document.getElementById("region") as HTMLOutputElement;

  // Main HUD
  V.mainHUD = document.getElementById("main-hud")!;
  V.hudToggle = document.getElementById("main-hud-toggle")!;
  V.hudToggle.addEventListener("click", () => {
    V.mainHUD.classList.toggle("collapsed");
  });

  // Dimension switcher
  V.dimensionToggle = document.getElementById("main-hud-dimension")!;
  for (const button of V.dimensionToggle.children) {
    const dimension = button.getAttribute("value");
    button.addEventListener("click", () => {
      for (const b of V.dimensionToggle.children) {
        b.classList.toggle("selected", b.getAttribute("value") === dimension);
      }
      V.map.dimension = dimension ?? "overworld";
    }, { passive: true });
  }

  // Timeline slider
  V.timelineSlider = document.getElementById("main-hud-timeline-slider")! as JejSlider;
  V.timelineSlider.addEventListener("change", () => {
    const value = V.timelineSlider.value;
    V.map.snapshot = value;
    const [year, month, date] = value.split("-");
    const displayMonth = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"][parseInt(month)-1];
    const displayDate = parseInt(date);
    V.subtitle.textContent = `au ${displayDate} ${displayMonth} ${year}`;
  });
  fetch("data/index.json").then(res => res.json()).then(json => {
    const snapshots = json.snapshots;
    V.map.availableSnapshots = snapshots;
    V.map.snapshot = snapshots.at(-1) ?? "overworld";
    V.timelineSlider.values = snapshots;
  });

  // POIs toggler
  V.poisToggle = document.getElementById("main-hud-show-pois")!;
  V.poisToggle.addEventListener("click", () => {
    V.poisToggle.classList.toggle("selected");
    V.map.getElementsByClassName("pins")[0].classList.toggle("invisible", !V.poisToggle.classList.contains("selected"));
  }, { passive: true });

  // Grid toggler
  V.gridToggle = document.getElementById("main-hud-show-grid")!;
  V.gridToggle.addEventListener("click", () => {
    V.gridToggle.classList.toggle("selected");
    V.regionOutput.classList.toggle("visible");
    V.map.showGrid = !V.map.showGrid;
  }, { passive: true });

  // Zoom contols
  V.zoomIn  = document.getElementById("zoom-in") as HTMLButtonElement;
  V.zoomOut = document.getElementById("zoom-out") as HTMLButtonElement;
  V.zoomIn.addEventListener("click", () => { V.map.zoom *= 1.5; }, { passive: true });
  V.zoomOut.addEventListener("click", () => { V.map.zoom /= 1.5; }, { passive: true });
}
