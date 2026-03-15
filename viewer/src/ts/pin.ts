export type PinType = "public" | "private" | "commercial" | "base"
                    | "topo" | "odo" | "hydro";

export class JejPin extends HTMLElement {
  anchored = false;
  name: string;
  x = 0;
  y = 0;
  type: PinType = "public";
  owner: string | undefined;
  desc:  string | undefined;

  constructor(def: POIDefinition) {
    super();
    this.name = def.name;
    this.x = def.coords[0];
    this.y = def.coords[1];
    this.type = def.type ?? "public";
    if (def.owner) this.owner = def.owner;
    if (def.desc)  this.desc = def.desc;
  }

  connectedCallback() {
    this.anchored = this.hasAttribute("anchored");
    this.x ??= parseInt(this.getAttribute("x") ?? "0");
    this.y ??= parseInt(this.getAttribute("y") ?? "0");
  }
}
customElements.define("jej-pin", JejPin);

export type POIDefinition = {
  name: string,
  coords: number[],
  type: PinType,
  owner: string | undefined
  desc: string | undefined
};
