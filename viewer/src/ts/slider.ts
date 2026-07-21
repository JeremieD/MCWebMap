import { JejIcon } from "./icon";

export class JejSlider extends HTMLElement {
  scale: HTMLDivElement | undefined;
  knob: HTMLDivElement | undefined;
  leftButton:  HTMLButtonElement | undefined;
  rightButton: HTMLButtonElement | undefined;

  #values: string[] = [];
  #numberValues: number[] = [];
  #value: string | undefined;
  #position: number = 0;
  #clickOrigin: number | undefined; // This is a number iff the knob is currently being held
  #output: Element | undefined | null;

  constructor() {
    super();
  }

  connectedCallback() {
    this.#output = this.previousElementSibling ?? this.nextElementSibling;
    this.init();
    this.draw();
  }

  init() {
    this.textContent = "";
    this.scale = document.createElement("div");
    this.scale.classList.add("scale");

    this.knob = document.createElement("div");
    this.knob.classList.add("knob");
    this.knob.tabIndex = 0;
    this.knob.addEventListener("keydown", e => {
      switch (e.key) {
        case "ArrowLeft":
          this.previousValue();
          break;
        case "ArrowRight":
          this.nextValue();
          break;
      }
    });
    this.scale.append(this.knob);

    this.leftButton = document.createElement("button");
    this.leftButton.append(new JejIcon("chevron-left"));
    this.leftButton.addEventListener("click", () => this.previousValue(), { passive: true });

    this.rightButton = document.createElement("button");
    this.rightButton.append(new JejIcon("chevron-right"));
    this.rightButton.addEventListener("click", () => this.nextValue(), { passive: true });

    this.append(this.leftButton, this.scale, this.rightButton);

    this.scale.addEventListener("mousedown",  this.pointerDownHandler, { passive: true });
    this.scale.addEventListener("touchstart", this.pointerDownHandler, { passive: true });
    addEventListener("mousemove", this.pointerMoveHandler, { passive: false });
    addEventListener("touchmove", this.pointerMoveHandler, { passive: false });
    addEventListener("mouseup",  this.pointerUpHandler, { passive: true });
    addEventListener("touchend", this.pointerUpHandler, { passive: true });
  }

  pointerDownHandler = (e: TouchEvent | MouseEvent) => {
    if (("button" in e && e.button === 0) || (e.type === "touchstart" && ("touches" in e) && e.touches.length === 1)) {
      this.#clickOrigin = unify(e).clientX;
      this.classList.add("held");
    }
  }

  pointerMoveHandler = (e: TouchEvent | MouseEvent) => {
    if (!this.#clickOrigin || (e.type === "touchend" && (e as any).touches.length > 1)) return;
    e.preventDefault();
    const deltaX = Math.round(Math.abs(unify(e).clientX - this.#clickOrigin));
    if (deltaX < 2) return;
    this.#position = this.#getPointerPosition(e)!;
    this.draw();
    this.dispatchEvent(new Event("input"));
  }

  pointerUpHandler = (e: TouchEvent | MouseEvent) => {
    if (!this.#clickOrigin || (e.type === "mouseup" && ("button" in e) && e.button !== 0)) return;
    this.classList.remove("held");
    this.#clickOrigin = undefined;
    this.#position = this.#getPointerPosition(e)!;
    const newValue = this.#nearestValue(this.#position);
    this.#position = this.#numberValues[this.values.indexOf(newValue)];
    this.value = newValue;
  }

  #getPointerPosition = (e: TouchEvent | MouseEvent) => {
    const scale = this.scale!.getBoundingClientRect();
    const knob = this.knob!.getBoundingClientRect();
    const min = this.#numberValues[0];
    const max = this.#numberValues.at(-1)!;
    let position = (unify(e).clientX - scale.left - knob.width/2) / (scale.width - knob.width) * (max - min) + min;
    if (position < min) position = min;
    if (position > max) position = max;
    return position;
  }

  set values(dates: string[]) {
    this.#values = dates;
    for (let i = 0; i < this.#values.length; i++) {
      this.#numberValues[i] = Date.parse(this.#values[i]);
    }
    this.value = this.#values.at(-1)!;

    const min = this.#numberValues[0];
    const max = this.#numberValues.at(-1)!;
    for (const el of this.scale!.children) if (el !== this.knob) el.remove();
    for (let pos of this.#numberValues) {
      pos -= min;
      pos /= (max - min);
      const marker = document.createElement("div");
      marker.style.setProperty("--offset", pos.toString());
      this.scale!.append(marker);
    }
  }

  get values() { return this.#values; }

  set value(d: string) {
    if (this.#value === d) return;
    if (!this.#values.includes(d)) return;
    this.#value = d;
    this.#position = this.#numberValues[this.#values.indexOf(d)];
    this.#output!.textContent = d;
    this.dispatchEvent(new Event("change"));
    this.draw();
  }

  get value() { return this.#value ?? ""; }

  draw() {
    let   pos = this.#position;
    const min = this.#numberValues[0];
    const max = this.#numberValues.at(-1)!;
    if (pos < min) pos = min;
    if (pos > max) pos = max;
    pos -= min;
    pos /= (max - min);
    this.knob!.style.setProperty("--offset", pos.toString());

    const value = this.#nearestValue(this.#position);
    this.#output!.textContent = value;
  }

  #nearestValue(value: number): string {
    let i = 0;
    let closestIndex = 0;
    let smallestDiff = Infinity;
    for (; i < this.#numberValues.length; i++) {
      const comp = this.#numberValues[i];
      const diff = Math.abs(value - comp);
      if (diff < smallestDiff) {
        smallestDiff = diff;
        closestIndex = i;
      } else if (diff > smallestDiff) break;
    }
    return this.#values[closestIndex];
  }

  previousValue() {
    const i = this.#values.indexOf(this.#value!);
    if (i > 0) this.value = this.#values[i-1];
  }

  nextValue() {
    const i = this.#values.indexOf(this.#value!);
    if (i < this.#values.length-1) this.value = this.#values[i+1];
  }
}


const unify = (e: TouchEvent | MouseEvent) => ("changedTouches" in e) ? e.changedTouches[0] : e;

customElements.define("jd-slider", JejSlider);
