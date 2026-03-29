/**
 * Icon element that consists of inlined SVG.
 * The HTML attribute "icon" should contain the name of the SVG file.
 */
export class JejIcon extends HTMLElement {
  iconName: string;

  constructor(icon: string) {
    super();
    this.iconName = icon;
  }

  connectedCallback() {
    this.draw();
  }

  attributeChangedCallback() {
    this.draw();
  }

  draw() {
    // TODO: Clean this up.
    if (this.hasAttribute("src")) {
      const srcAttr = this.getAttribute("src");
      if (!srcAttr) return;
      fetch(srcAttr).then(async res => {
        if (!res.ok) return;
        this.innerHTML = await res.text();
        this.classList.remove("placeholder");
      });
      return;
    }

    const name = this.iconName ?? this.getAttribute("icon");
    if (!name) return;
    const safeIconName = encodeURI(name);

    if (JejIcon.cache[safeIconName] !== undefined) {
      JejIcon.cache[safeIconName].then(svg => {
        this.innerHTML = svg!;
      });
      return;
    }

    this.classList.add("placeholder");

    const iconPath = `resources/graphics/icons/${safeIconName}.svg`;
    JejIcon.cache[safeIconName] = fetch(iconPath).then(async res => {
      if (!res.ok) return;
      const svg = await res.text();
      this.innerHTML = svg;
      this.classList.remove("placeholder");
      return svg;
    });
  }

  // Holds SVG icons. Access with [iconName].
  static cache: { [iconName: string]: Promise<string | undefined> } = {};

  static get observedAttributes() {
    return [ "icon", "src" ];
  }
}

customElements.define("jej-icon", JejIcon);
