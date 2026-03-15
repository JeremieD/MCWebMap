export type PinType = "public" | "private" | "commercial" | "base"
                    | "topo" | "odo" | "hydro";

export class JejPin extends HTMLElement {
  anchored = false;
  name: string;
  x = 0;
  y = 0;
  type: PinType = "public";
  marker: string | undefined;
  owner: string | undefined;
  desc:  string | undefined;
  img:   string | undefined;
  labelAlign: string | undefined;
  minZoom: number;
  maxZoom: number;
  detailedZoom: number;

  constructor(def: POIDefinition) {
    super();
    this.name = def.name;

    this.x = def.coords[0] + .5;
    this.y = def.coords[1] + .5;

    this.type = def.type ?? "public";
    this.marker = def.marker ?? JejPin.getDefaultMarker(this.type);

    if (def.owner) this.owner = def.owner;
    if (def.desc)  this.desc = def.desc;
    if (def.labelAlign) this.labelAlign = def.labelAlign;

    this.minZoom = def.minZoom ?? -Infinity;
    this.maxZoom = def.maxZoom ?? Infinity;
    this.detailedZoom = def.detailedZoom ?? -Infinity;
  }

  connectedCallback() {
    this.classList.add(this.type);

    // Marker
    if (this.marker) {
      const marker = document.createElement("div");
      marker.classList.add("marker");
      marker.classList.add(this.marker);
      this.append(marker);
    }

    // Label
    const label = document.createElement("label");
    if (this.labelAlign) label.classList.add(this.labelAlign);
    label.innerText = this.name;
    this.append(label);

    // Card
    const card = document.createElement("div");
    card.classList.add("card");
    this.append(card);

    // Image
    if (this.img) {
      const img = document.createElement("img");
      img.src = this.img;
      card.append(img);
    }

    // Title
    const title = document.createElement("h2");
    title.innerText = this.name;
    card.append(title);

    // Description
    if (this.desc) {
      const desc = document.createElement("p");
      desc.innerText = this.desc;
      card.append(desc);
    }
  }

  static getDefaultMarker(type: PinType): string | undefined {
    switch (type) {
      case "public":     return "point-small";
      case "private":    return "point-small";
      case "commercial": return "point";
      case "base":       return "banner";
      // case "topo":
      // case "odo":
      // case "hydro":
      default: return;
    }
  }
}
customElements.define("jej-pin", JejPin);

export type POIDefinition = {
  name: string,
  coords: number[],
  type: PinType,
  marker: string | undefined,
  owner: string | undefined,
  desc:  string | undefined,
  img:   string | undefined,
  labelAlign: string | undefined,
  minZoom: number,
  maxZoom: number,
  detailedZoom: number
};
