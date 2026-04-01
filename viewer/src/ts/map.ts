import { JejPin } from "./pin";
import { isMac, normalizeWheel } from "./utilities";

const REGION_SIZE = 512;

export class JejMap extends HTMLElement {
  #evCache: PointerEvent[] = [];
  #prevDiff = -1;
  #pointerOriginX = 0;
  #pointerOriginY = 0;
  #scrollFactor = isMac ? -.01 : .25;
  #zoom = 1;
  #panX = 256;
  #panY = 256;
  #offsetX = .5;
  #offsetY = .5;
  #src = "";
  #tileRequests: { [regionKey: string]: Promise<ImageBitmap | void> } = {};
  #tiles: { [regionKey: string]: ImageBitmap } = {};

  // Layers
  #hud:  HTMLElement;
  #pins: HTMLElement;
  #canvasElement: HTMLCanvasElement;
  #canvas: CanvasRenderingContext2D;

  // HUD Elements
  #coords: HTMLOutputElement;

  // Coordinate space
  origin  = [0, 0];
  width   = 512; // blocks
  height  = 512; // blocks
  minZoom = .0625;
  maxZoom = 8;

  constructor() {
    super();
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
  }

  connectedCallback() {
    this.#init();

    // Start drawing
    requestAnimationFrame(_ => { this.#draw() } );
  }

  attributeChangedCallback() {
    this.#init();
  }

  #init() {
    this.#tileRequests = {};
    this.#tiles = {};
    this.#pins.innerHTML = "";

    this.#src = this.getAttribute("src") ?? "";
    this.#offsetX = parseFloat(this.getAttribute("offsetx") ?? ".5");
    this.#offsetY = parseFloat(this.getAttribute("offsety") ?? ".5");

    fetch(`${this.#src}/meta.json`).then(async response => {
      const data = await response.json();

      // Coordinate space
      const bounds = data.bounds;
      this.origin = [-bounds.west*REGION_SIZE, -bounds.north*REGION_SIZE];
      const colCount = Math.abs(bounds.east  - bounds.west)  + 1;
      const rowCount = Math.abs(bounds.south - bounds.north) + 1;
      this.width  = colCount * REGION_SIZE;
      this.height = rowCount * REGION_SIZE;

      // POI data
      for (const poi of data.pois ?? []) {
        const pin = new JejPin(poi);
        this.#pins.append(pin);
      }

      this.panX(-bounds.west*REGION_SIZE);
      this.panY(-bounds.north*REGION_SIZE);
      this.zoom = .75;
    });
  }

  #downHandler(e: PointerEvent) {
    if (e.target !== this.#canvasElement) return;
    this.#evCache.push(e);
    const clientPos = this.fromViewSpace(e.clientX, e.clientY);
    this.#pointerOriginX = clientPos.x;
    this.#pointerOriginY = clientPos.y;
    this.classList.add("dragging");
  }

  #moveHandler(e: PointerEvent) {
    const { x, y } = this.fromViewSpace(e.clientX, e.clientY);
    this.#coords.textContent = `${Math.floor(x - this.origin[0])} ${Math.floor(y - this.origin[1])}`;

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
    const i = this.#evCache.findIndex(e2 => e2.pointerId === e.pointerId);
    this.#evCache.splice(i, 1);
    if (this.#evCache.length < 2) this.#prevDiff = -1;
    this.classList.remove("dragging");
  }

  #wheelHandler(e: WheelEvent) {
    if (e.target !== this.#canvasElement) return;
    const deltaY = normalizeWheel(e);
    let { x, y } = this.fromViewSpace(e.clientX, e.clientY);
    this.panX(x);
    this.panY(y);
    this.zoom = this.#zoom + deltaY*this.#zoom*this.#scrollFactor;
    const rect = this.getBoundingClientRect();
    ({ x, y } = this.fromViewSpace(rect.width - e.clientX, rect.height - e.clientY));
    this.panX(x);
    this.panY(y);
  }

  #draw() {
    const rect = this.getBoundingClientRect();
    const offsetX = rect.width*this.#offsetX - this.#zoom*this.width/2;
    const offsetY = rect.height*this.#offsetY - this.#zoom*this.height/2;

    // Pins
    for (const pin of Array.from(this.#pins.querySelectorAll("jej-pin")) as JejPin[]) {
      pin.classList.toggle("hidden", this.#zoom >= pin.maxZoom || this.#zoom < pin.minZoom);
      pin.classList.toggle("detailed", this.#zoom >= pin.detailedZoom);
      pin.style.setProperty("--x", this.#zoom*(this.origin[0] + pin.x - this.#panX + this.width/2) + offsetX + "px");
      pin.style.setProperty("--y", this.#zoom*(this.origin[1] + pin.y - this.#panY + this.height/2) + offsetY + "px");
    }

    // Canvas
    this.#canvas.clearRect(0, 0, rect.width, rect.height); // Clear
    const topLeft  = this.fromViewSpace(0, 0);
    const botRight = this.fromViewSpace(rect.right, rect.bottom);
    const effectiveBounds = {
      north: Math.floor((topLeft.y  - this.origin[1]) / REGION_SIZE),
      west:  Math.floor((topLeft.x  - this.origin[0]) / REGION_SIZE),
      east:  Math.floor((botRight.x - this.origin[0]) / REGION_SIZE),
      south: Math.floor((botRight.y - this.origin[1]) / REGION_SIZE)
    };

    for (let x = effectiveBounds.west;  x <= effectiveBounds.east;  x++)
    for (let z = effectiveBounds.north; z <= effectiveBounds.south; z++) {
      const regionKey = `${x}.${z}`;
      if (!this.#tileRequests[regionKey]) {
        this.#tileRequests[regionKey] = fetch(`${this.#src}/${regionKey}.webp`)
        .then(async (res: Response) => {
          if (!res.ok) return;
          this.#tiles[regionKey] = await createImageBitmap(await res.blob());
        });
      }
      if (!this.#tiles[regionKey]) continue;

      const regionX = this.#zoom * (this.origin[0] + x*REGION_SIZE - this.#panX + this.width/2) + offsetX;
      const regionY = this.#zoom * (this.origin[1] + z*REGION_SIZE - this.#panY + this.height/2) + offsetY;
      const regionWidth = this.#zoom * REGION_SIZE;
      const regionHeight = regionWidth;

      this.#canvas.drawImage(this.#tiles[regionKey]!, regionX, regionY, regionWidth, regionHeight);
    }

    requestAnimationFrame(_ => { this.#draw() });
  }

  fromViewSpace(clientX: number, clientY: number) {
    const rect = this.getBoundingClientRect();
    return {
      x: this.#panX + (clientX - rect.x - rect.width*this.#offsetX) / this.#zoom,
      y: this.#panY + (clientY - rect.y - rect.height*this.#offsetY) / this.#zoom
    };
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

  static get observedAttributes() { return [ "src" ]; }
}

customElements.define("jej-map", JejMap);
