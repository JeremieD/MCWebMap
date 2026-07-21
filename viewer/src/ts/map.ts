import { JejPin } from "./pin";
import { isMac, normalizeWheel } from "./utilities";

const REGION_SIZE = 512;
const CHUNK_SIZE  = 16;

export class JejMap extends HTMLElement {
  #evCache: PointerEvent[] = [];
  #prevDiff = -1;
  #pointerOriginXSS = 0; // screen space
  #pointerOriginYSS = 0;
  #pointerOriginX = 0;   // world space
  #pointerOriginY = 0;
  #scrollFactor = isMac ? -.01 : .25;
  #zoom = .75;
  #panX = 0;
  #panY = 0;
  #offsetX = .5;
  #offsetY = .5;
  #src = "";
  #dimension: string = "overworld";
  #snapshot: string = "";
  #availableSnapshots: string[] = [];
  #tileRequests: { [tileKey: string]: Promise<ImageBitmap | void> } = {};
  #tiles: { [tileKey: string]: ImageBitmap } = {};
  #measuring = false;
  #measurePoints: [number, number][] = [];

  // Layers
  #hud:  HTMLElement;
  #pins: HTMLElement;
  #canvasElement: HTMLCanvasElement;
  #canvas: CanvasRenderingContext2D;

  // HUD Elements
  #coords: HTMLOutputElement;
  #region: HTMLOutputElement;

  // Coordinate space
  origin  = [0, 0];
  width   = 512; // blocks
  height  = 512; // blocks
  minZoom = .0625;
  maxZoom = 16;

  showGrid = false;

  constructor() {
    super();
    this.addEventListener("contextmenu", e => this.#rightClickHandler(e));
    this.addEventListener("pointerdown", e => this.#downHandler(e),  { passive: true });
    addEventListener("pointermove",      e => this.#moveHandler(e),  { passive: true });
    addEventListener("pointerup",        e => this.#upHandler(e),    { passive: true });
    // addEventListener("pointercancel",    e => this.#upHandler(e),    { passive: true });
    // addEventListener("pointerout",       e => this.#upHandler(e),    { passive: true });
    // addEventListener("pointerleave",     e => this.#upHandler(e),    { passive: true });
    this.addEventListener("wheel",       e => this.#wheelHandler(e), { passive: true });

    this.#canvasElement = this.querySelector<HTMLCanvasElement>(".canvas")!;
    this.#canvasElement.width  = innerWidth;
    this.#canvasElement.height = innerHeight;
    this.#canvas = this.#canvasElement.getContext("2d")!;
    this.#canvas.imageSmoothingEnabled = false;

    this.#pins = this.querySelector(".pins")!;
    this.#hud  = this.querySelector(".hud")!;

    this.#coords = document.getElementById("coords")! as HTMLOutputElement;
    this.#region = document.getElementById("region")! as HTMLOutputElement;
  }

  connectedCallback() {
    // this.#init();

    // Start drawing
    requestAnimationFrame(_ => { this.#draw() } );
  }

  #init(targetX?: number, targetY?: number, targetZoom?: number) {
    this.#pins.innerHTML = "";

    if (this.#snapshot === "") return;

    this.#src = `data/${this.#snapshot}/${this.#dimension}`;

    this.#offsetX = parseFloat(this.getAttribute("offsetx") ?? ".5");
    this.#offsetY = parseFloat(this.getAttribute("offsety") ?? ".5");

    // Coordinate space
    fetch(`${this.#src}/meta.json`).then(async response => {
      if (!response.ok) return;
      const data = await response.json();

      const bounds = data.bounds;
      this.origin = [-bounds.west*REGION_SIZE, -bounds.north*REGION_SIZE];
      const colCount = Math.abs(bounds.east  - bounds.west)  + 1;
      const rowCount = Math.abs(bounds.south - bounds.north) + 1;
      this.width  = colCount * REGION_SIZE;
      this.height = rowCount * REGION_SIZE;

      this.zoom = targetZoom ?? .75;
      if (targetX !== undefined && targetY !== undefined) {
        this.panX(targetX + this.origin[0]);
        this.panY(targetY + this.origin[1]);
      } else {
        this.panX(this.origin[0]);
        this.panY(this.origin[1]);
      }

    });

    // POI data
    fetch(`${this.#src}/pois.json`).then(async response => {
      if (!response.ok) return;
      const data = await response.json();
      for (const poi of data.pois ?? []) {
        const pin = new JejPin(poi);
        this.#pins.append(pin);
      }
    });
  }

  #rightClickHandler(e: MouseEvent) {
    this.#measuring = true;
    this.addMeasurePoint(...this.toWorldSpace(e.clientX, e.clientY, true));
    e.preventDefault();
  }

  #downHandler(e: PointerEvent) {
    if (e.target !== this.#canvasElement) return;
    if (e.button !== 0) return;
    this.#evCache.push(e);
    const [x, y] = this.toWorldSpace(e.clientX, e.clientY, true);
    this.#pointerOriginXSS = e.clientX;
    this.#pointerOriginYSS = e.clientY;
    this.#pointerOriginX = x;
    this.#pointerOriginY = y;
    this.classList.add("dragging");
  }

  #moveHandler(e: PointerEvent) {
    const [ x, y ] = this.toWorldSpace(e.clientX, e.clientY, true);
    this.#coords.textContent = `${Math.floor(x)} ${Math.floor(y)}`;
    this.#region.textContent = `r ${Math.floor(x/REGION_SIZE)} ${Math.floor(y/REGION_SIZE)}`;

    const i = this.#evCache.findIndex(e2 => e2.pointerId === e.pointerId);
    this.#evCache[i] = e;
    if (this.#evCache.length === 2) { // Pinch zoom
      const diff = Math.abs(this.#evCache[0].clientX - this.#evCache[1].clientX);
      if (this.#prevDiff > 0) {
        this.zoom = this.#zoom * (diff/this.#prevDiff);
      }
      this.#prevDiff = diff;

    } else if (this.#evCache.length === 1) { // Pan
      const dx = x - this.#pointerOriginX;
      const dy = y - this.#pointerOriginY;
      this.panX(this.#panX - dx);
      this.panY(this.#panY - dy);
    }
  }

  #upHandler(e: PointerEvent) {
    const dx = e.clientX - this.#pointerOriginXSS;
    const dy = e.clientY - this.#pointerOriginYSS;

    if (dx === 0 && dy === 0) { // It was a single click
      this.addMeasurePoint(...this.toWorldSpace(e.clientX, e.clientY, true));
    }

    const i = this.#evCache.findIndex(e2 => e2.pointerId === e.pointerId);
    this.#evCache.splice(i, 1);
    if (this.#evCache.length < 2) this.#prevDiff = -1;
    this.classList.remove("dragging");
  }

  #wheelHandler(e: WheelEvent) {
    if (e.target !== this.#canvasElement) return;
    const deltaY = normalizeWheel(e);
    let [ x, y ] = this.toWorldSpace(e.clientX, e.clientY);
    this.panX(x);
    this.panY(y);
    this.zoom = this.#zoom + deltaY*this.#zoom*this.#scrollFactor;
    const rect = this.getBoundingClientRect();
    ([ x, y ] = this.toWorldSpace(rect.width - e.clientX, rect.height - e.clientY));
    this.panX(x);
    this.panY(y);
  }

  #draw() {
    if (this.#snapshot === "") { requestAnimationFrame(_ => { this.#draw() }); return; }

    const rect = this.getBoundingClientRect();
    const lod = this.#zoom < .5 ? 2 : 1;
    const tileSizeBlocks = REGION_SIZE * 4 * lod;       // Size of a tile in blocks in the world
    const tileSizePixels = tileSizeBlocks * this.#zoom; // Size of a tile in pixels on screen

    // Pins
    for (const pin of Array.from(this.#pins.children) as JejPin[]) {
      pin.classList.toggle("hidden", this.#zoom >= pin.maxZoom || this.#zoom < pin.minZoom);
      pin.classList.toggle("detailed", this.#zoom >= pin.detailedZoom);
      const [x, y] = this.toScreenSpace(pin.x, pin.y, rect);
      pin.style.setProperty("--x", x + "px");
      pin.style.setProperty("--y", y + "px");
    }

    this.#canvas.clearRect(0, 0, rect.width, rect.height); // Clear

    // Tiles
    const topLeft  = this.toWorldSpace(0, 0, true);
    const botRight = this.toWorldSpace(rect.right, rect.bottom, true);
    const effectiveBounds = {
      north: Math.floor(topLeft[1]  / tileSizeBlocks),
      west:  Math.floor(topLeft[0]  / tileSizeBlocks),
      east:  Math.floor(botRight[0] / tileSizeBlocks),
      south: Math.floor(botRight[1] / tileSizeBlocks)
    };

    for (let x = effectiveBounds.west;  x <= effectiveBounds.east;  x++)
    for (let z = effectiveBounds.north; z <= effectiveBounds.south; z++) {
      const tileKey = `${this.#src}/${lod}/${x}.${z}`;
      if (!this.#tileRequests[tileKey]) {
        this.#tileRequests[tileKey] = fetch(`${tileKey}.webp`)
        .then(async (res: Response) => {
          if (!res.ok) return;
          this.#tiles[tileKey] = await createImageBitmap(await res.blob());
        });
      }
      if (!this.#tiles[tileKey]) continue;

      const [tileX, tileY] = this.toScreenSpace(x*tileSizeBlocks, z*tileSizeBlocks, rect);
      this.#canvas.drawImage(this.#tiles[tileKey]!, tileX, tileY, tileSizePixels, tileSizePixels);
    }

    // Grid
    if (this.showGrid) {
      this.#canvas.strokeStyle = "black";
      this.#canvas.lineWidth = this.zoom > 4 ? 2 : 1;

      // Vertical region lines
      for (let x = Math.ceil(topLeft[0] / REGION_SIZE) * REGION_SIZE; x <= botRight[0]; x += REGION_SIZE) {
        const xSS = this.toScreenSpaceX(x, rect);
        this.#canvas.beginPath();
        this.#canvas.moveTo(xSS, 0);
        this.#canvas.lineTo(xSS, rect.bottom);
        this.#canvas.stroke();
      }
      // Horizontal region lines
      for (let y = Math.ceil(topLeft[1] / REGION_SIZE) * REGION_SIZE; y <= botRight[1]; y += REGION_SIZE) {
        const ySS = this.toScreenSpaceY(y, rect);
        this.#canvas.beginPath();
        this.#canvas.moveTo(0, ySS);
        this.#canvas.lineTo(rect.right, ySS);
        this.#canvas.stroke();
      }

      if (this.zoom > 4) {
        this.#canvas.strokeStyle = "rgba(0,0,0, .5)";
        // Vertical chunk lines
        for (let x = Math.ceil(topLeft[0] / CHUNK_SIZE) * CHUNK_SIZE; x <= botRight[0]; x += CHUNK_SIZE) {
          const xSS = this.toScreenSpaceX(x, rect);
          this.#canvas.beginPath();
          this.#canvas.moveTo(xSS, 0);
          this.#canvas.lineTo(xSS, rect.bottom);
          this.#canvas.stroke();
        }
        // Horizontal chunk lines
        for (let y = Math.ceil(topLeft[1] / CHUNK_SIZE) * CHUNK_SIZE; y <= botRight[1]; y += CHUNK_SIZE) {
          const ySS = this.toScreenSpaceY(y, rect);
          this.#canvas.beginPath();
          this.#canvas.moveTo(0, ySS);
          this.#canvas.lineTo(rect.right, ySS);
          this.#canvas.stroke();
        }
      }
    }

    // Measure lines
    if (this.#measuring) {
      this.#canvas.beginPath();
      this.#canvas.moveTo(...this.toScreenSpace(...this.#measurePoints[0], rect));
      for (let i = 1; i < this.#measurePoints.length; i++) {
        const [x, y] = this.toScreenSpace(...this.#measurePoints[i], rect);
        this.#canvas.lineTo(x, y);
      }
      this.#canvas.strokeStyle = "white";
      this.#canvas.lineWidth = 4;
      this.#canvas.stroke();
      this.#canvas.strokeStyle = "black";
      this.#canvas.lineWidth = 2;
      this.#canvas.stroke();
    }

    requestAnimationFrame(_ => { this.#draw() });
  }

  /** Transforms screen space coords to world space, where 1u = 1 block. */
  toWorldSpace(x: number, y: number, actual = false): [ x: number, y: number ] {
    const rect = this.getBoundingClientRect();
    return [
      this.#panX + (x - rect.x - rect.width*this.#offsetX)  / this.#zoom - (actual ? this.origin[0] : 0),
      this.#panY + (y - rect.y - rect.height*this.#offsetY) / this.#zoom - (actual ? this.origin[1] : 0)
    ];
  }

  /** Transforms world space coords to screen space, where 1u = 1 canvas pixel. */
  toScreenSpace(x: number, y: number, rect?: DOMRect): [ x: number, y: number ] {
    rect ??= this.getBoundingClientRect();
    return [
      this.toScreenSpaceX(x, rect),
      this.toScreenSpaceY(y, rect)
    ];
  }

  toScreenSpaceX(x: number, rect?: DOMRect): number {
    rect ??= this.getBoundingClientRect();
    const offsetX = rect.width*this.#offsetX  - this.#zoom*this.width/2;
    return this.#zoom*(this.origin[0] + x - this.#panX + this.width/2) + offsetX;
  }

  toScreenSpaceY(y: number, rect?: DOMRect): number {
    rect ??= this.getBoundingClientRect();
    const offsetY = rect.height*this.#offsetY - this.#zoom*this.height/2;
    return this.#zoom*(this.origin[1] + y - this.#panY + this.height/2) + offsetY;
  }

  panX(x: number): number | void {
    if (x === undefined) return this.#panX;
    this.#panX = x;
    if (this.#panX < 0) this.#panX = 0;
    if (this.#panX > this.width) this.#panX = this.width;
  }

  panY(y: number): number | void {
    if (y === undefined) return this.#panY;
    this.#panY = y;
    if (this.#panY < 0) this.#panY = 0;
    if (this.#panY > this.height) this.#panY = this.height;
  }

  get zoom() { return this.#zoom; }
  set zoom(z: number) {
    this.#zoom = z;
    if (this.#zoom < this.minZoom) this.#zoom = this.minZoom;
    if (this.#zoom > this.maxZoom) this.#zoom = this.maxZoom;
  }

  get offsetX() { return this.#offsetX; }
  get offsetY() { return this.#offsetY; }

  set dimension(targetDimension: string) {
    const originDimension = this.#dimension;

    let targetX, targetY, targetZoom;
    if (originDimension === "overworld" && targetDimension === "nether") {
      // Overworld → Nether
      targetX = (this.#panX - this.origin[0]) / 8;
      targetY = (this.#panY - this.origin[1]) / 8;
      targetZoom = this.#zoom * 8;

    } else if (originDimension === "nether" && targetDimension === "overworld") {
      // Nether → Overworld
      targetX = (this.#panX - this.origin[0]) * 8;
      targetY = (this.#panY - this.origin[1]) * 8;
      targetZoom = this.#zoom / 8;

    } else {
      targetX = this.#panX - this.origin[0];
      targetY = this.#panY - this.origin[1];
      targetZoom = this.#zoom;
    }

    this.#dimension = targetDimension;
    this.#init(targetX, targetY, targetZoom);
  }

  set snapshot(date: string) {
    this.#snapshot = date;
    this.#init(this.#panX - this.origin[0], this.#panY - this.origin[1], this.#zoom);
  }
  get snapshot() { return this.#snapshot; }

  set availableSnapshots(dates: string[]) {
    this.#availableSnapshots = dates;
    this.#init();
  }
  get availableSnapshots() { return this.#availableSnapshots; }

  resetView() {
    this.#panX = this.width/2;
    this.#panY = this.height/2;
    this.#zoom = 1;
  }

  autoFrame(...pins: JejPin[]) {
    if (pins.length === 0) pins = Array.from(this.querySelectorAll<JejPin>("jej-pin"));
    if (pins.length === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const pin of pins) {
      if (pin.x < minX) minX = pin.x;
      if (pin.x > maxX) maxX = pin.x;
      if (pin.y < minY) minY = pin.y;
      if (pin.y > maxY) maxY = pin.y;
    }
    this.#panX = (minX+maxX)/2;
    this.#panY = (minY+maxY)/2;

    const padding = 100;
    const spanX = maxX-minX + padding;
    const spanY = maxY-minY + padding;
    const rect = this.getBoundingClientRect();
    const widthFactor  = -Math.abs(2*this.#offsetX - 1) + 1;
    const heightFactor = -Math.abs(2*this.#offsetY - 1) + 1;
    const zoomX = rect.width  * widthFactor  / spanX;
    const zoomY = rect.height * heightFactor / spanY;
    this.zoom = Math.min(zoomX, zoomY);
  }

  addMeasurePoint(x: number, y: number) {
    this.#measurePoints.push([x, y]);
    console.log(dist(this.#measurePoints), this.#measurePoints);
  }
}

customElements.define("jej-map", JejMap);

function dist(points: [number, number][]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i-1];
    const [x2, y2] = points[i];
    d += Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }
  return d;
}
