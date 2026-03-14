export var isMobile = matchMedia("(hover: none)").matches;

/**
 * Calls a function once the DOM has loaded.
 * Also calls the function if the DOM has *already* loaded.
 */
export async function domReady(options: AddEventListenerOptions = { once: true, passive: true }) {
  return new Promise<void>(resolve => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => { resolve() }, options);
    } else {
      resolve();
    }
  });
}
