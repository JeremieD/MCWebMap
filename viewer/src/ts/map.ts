import { JejPin } from "./pin";

const REGION_SIZE = 512;

export class JejMap extends HTMLElement {
  #evCache: PointerEvent[] = [];
  #prevDiff = -1;
  #pointerOriginX = 0;
  #pointerOriginY = 0;
  #zoom = 1;
  #panX = 256;
  #panY = 256;
  #offsetX = .5;
  #offsetY = .5;
  #src = "";

  // Layers
  #hud:   HTMLDivElement;
  #pins:  HTMLDivElement;
  #tiles: HTMLDivElement;

  // HUD Elements
  #coords: HTMLOutputElement;

  // Coordinate space
  origin  = [0, 0];
  width   = 512; // blocks
  height  = 512; // blocks
  minZoom = .125;
  maxZoom = 8;

  constructor() {
    super();

    this.addEventListener("pointerdown",   this.#downHandler,  { passive: true });
    this.addEventListener("pointermove",   this.#moveHandler,  { passive: true });
    this.addEventListener("pointerup",     this.#upHandler,    { passive: true });
    this.addEventListener("pointercancel", this.#upHandler,    { passive: true });
    this.addEventListener("pointerout",    this.#upHandler,    { passive: true });
    this.addEventListener("pointerleave",  this.#upHandler,    { passive: true });
    this.addEventListener("wheel",         this.#wheelHandler, { passive: true });

    this.#hud   = this.querySelector(".hud")!;
    this.#pins  = this.querySelector(".pins")!;
    this.#tiles = this.querySelector(".tiles")!;

    this.#coords = document.getElementById("coords")! as HTMLOutputElement;
  }

  connectedCallback() {
    this.#src = this.getAttribute("src") ?? "";
    this.#offsetX = parseFloat(this.getAttribute("offsetx") ?? ".5");
    this.#offsetY = parseFloat(this.getAttribute("offsety") ?? ".5");

    fetch(`${this.#src}/world.json`).then(async response => {
      const data = await response.json();

      // Coordinate space
      const bounds = data.overworld.bounds;
      this.origin = [-bounds.west*REGION_SIZE, -bounds.north*REGION_SIZE];
      const colCount = Math.abs(bounds.east  - bounds.west)  + 1;
      const rowCount = Math.abs(bounds.south - bounds.north) + 1;
      this.width  = colCount * REGION_SIZE;
      this.height = rowCount * REGION_SIZE;

      this.#tiles.style.gridTemplateColumns = `repeat(${colCount}, ${REGION_SIZE}px)`;
      this.#tiles.style.gridTemplateRows = `repeat(${rowCount}, ${REGION_SIZE}px)`;

      // Tile data
      for (let x = bounds.west;  x <= bounds.east;  x++)
      for (let z = bounds.north; z <= bounds.south; z++) {
        const url = `data/overworld/${x}.${z}.webp`;
        fetch(url, { method: "HEAD" }).then(async response => {
          if (!response.ok) return; // Ignore if not HTTP 200
          const img = document.createElement("img");
          // img.loading = "lazy";
          img.src = url;
          img.style.gridColumn = (x - bounds.west  + 1).toString();
          img.style.gridRow    = (z - bounds.north + 1).toString();
          this.#tiles.append(img);
        });
      }

      // POI data
      for (const poi of data.overworld.pois) {
        const pin = new JejPin(poi);
        this.#pins.append(pin);
      }

      this.panX(-bounds.west*REGION_SIZE, false);
      this.panY(-bounds.north*REGION_SIZE, false);
      this.zoom(.75);
    });

  }

  #downHandler(e: PointerEvent) {
    this.#evCache.push(e);
    const clientPos = this.fromViewSpace(e.clientX, e.clientY);
    this.#pointerOriginX = clientPos.x;
    this.#pointerOriginY = clientPos.y;
    this.classList.add("dragging");
  }

  #moveHandler(e: PointerEvent) {
    const clientPos = this.fromViewSpace(e.clientX, e.clientY);
    this.#coords.textContent = `${Math.floor(clientPos.x - this.origin[0])}, ${Math.floor(clientPos.y - this.origin[1])}`;

    const i = this.#evCache.findIndex(e2 => e2.pointerId === e.pointerId);
    this.#evCache[i] = e;
    if (this.#evCache.length === 2) { // Pinch zoom
      const diff = Math.abs(this.#evCache[0].clientX - this.#evCache[1].clientX);
      if (this.#prevDiff > 0) {
        this.zoom(this.#zoom * (diff/this.#prevDiff));
      }
      this.#prevDiff = diff;

    } else if (this.#evCache.length === 1) { // Pan
      const dx = clientPos.x - this.#pointerOriginX;
      const dy = clientPos.y - this.#pointerOriginY;
      this.panX(this.#panX - dx, false);
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
    let { x, y } = this.fromViewSpace(e.clientX, e.clientY);
    this.panX(x, false);
    this.panY(y, false);
    this.zoom(this.#zoom + e.deltaY*this.#zoom/100, false);
    const rect = this.getBoundingClientRect();
    ({ x, y } = this.fromViewSpace(rect.width - e.clientX, rect.height - e.clientY));
    this.panX(x, false);
    this.panY(y);
  }

  draw() {
    const rect = this.getBoundingClientRect();
    this.style.setProperty("--z", this.#zoom.toString());
    // this.#tiles.style.setProperty("--w", this.#zoom * this.width + "px");
    // this.#tiles.style.setProperty("--h", this.#zoom * this.height + "px");
    const offsetX = rect.width*this.#offsetX - this.#zoom*this.width/2;
    const offsetY = rect.height*this.#offsetY - this.#zoom*this.height/2;
    // this.#tiles.style.setProperty("--offset-x", offsetX + "px");
    // this.#tiles.style.setProperty("--offset-y", offsetY + "px");
    this.#tiles.style.setProperty("--x", this.#zoom * (-this.#panX + this.width/2) + offsetX + "px");
    this.#tiles.style.setProperty("--y", this.#zoom * (-this.#panY + this.height/2) + offsetY + "px");
    for (const pin of Array.from(this.#pins.querySelectorAll("jej-pin")) as JejPin[]) {
      if (pin.anchored) {
        pin.style.setProperty("--x", this.#zoom*(this.width/2) + offsetX + "px");
        pin.style.setProperty("--y", this.#zoom*(this.height/2) + offsetY + "px");
      } else {
        pin.style.setProperty("--x", this.#zoom*(this.origin[0] + pin.x - this.#panX + this.width/2) + offsetX + "px");
        pin.style.setProperty("--y", this.#zoom*(this.origin[1] + pin.y - this.#panY + this.height/2) + offsetY + "px");
      }
    }
  }

  fromViewSpace(clientX: number, clientY: number) {
    const rect = this.getBoundingClientRect();
    return {
      x: this.#panX + (clientX - rect.x - rect.width*this.#offsetX) / this.#zoom,
      y: this.#panY + (clientY - rect.y - rect.height*this.#offsetY) / this.#zoom
    };
  }

  panX(x: number, draw = true): number | void {
    if (x === undefined) return this.#panX;
    this.#panX = x;
    if (this.#panX < 0) this.#panX = 0;
    if (this.#panX > this.width) this.#panX = this.width;
    if (draw) {
      this.draw();
      this.dispatchEvent(new Event("input"));
    }
  }

  panY(y: number, draw = true): number | void {
    if (y === undefined) return this.#panY;
    this.#panY = y;
    if (this.#panY < 0) this.#panY = 0;
    if (this.#panY > this.height) this.#panY = this.height;
    if (draw) {
      this.draw();
      this.dispatchEvent(new Event("input"));
    }
  }

  zoom(z: number, draw = true): number | void {
    if (z === undefined) return this.#zoom;
    this.#zoom = z;
    if (this.#zoom < this.minZoom) this.#zoom = this.minZoom;
    if (this.#zoom > this.maxZoom) this.#zoom = this.maxZoom;
    if (draw) {
      this.draw();
      this.dispatchEvent(new Event("input"));
    }
  }

  get offsetX() { return this.#offsetX; }
  get offsetY() { return this.#offsetY; }

  resetView() {
    this.#panX = this.width/2;
    this.#panY = this.height/2;
    this.#zoom = 1;
    this.draw();
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
    this.zoom(Math.min(zoomX, zoomY));
  }
}

customElements.define("jej-map", JejMap);
