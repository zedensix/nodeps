const root = document.documentElement;
const storageKey = "sidebar-width";
const minimum = 224;
const maximum = 560;
const step = 16;

/**
 * Sets the sidebar width in pixels, kept between the limits, on the root
 * element and on the handle for screen readers. Saves it when asked, so the
 * head script restores it before first paint.
 */
function setWidth(handle: HTMLElement, width: number, save: boolean) {
  const clamped = Math.round(Math.min(maximum, Math.max(minimum, width)));
  root.style.setProperty("--sidebar-width", `${clamped}px`);
  handle.setAttribute("aria-valuenow", String(clamped));
  if (save) {
    try {
      localStorage.setItem(storageKey, String(clamped));
    } catch {
      // Storage can be blocked by the browser: the width still applies to this page.
    }
  }
}

/**
 * Makes the handle on the sidebar's edge resize it: drag it, use the arrow
 * keys when it has focus, or double-click it to go back to the theme's width.
 * Events are delegated so the handle keeps working after page swaps.
 */
export function setupSidebarResize() {
  const handle = document.querySelector<HTMLElement>(".sidebar-resize");
  const sidebar = document.querySelector(".sidebar");
  if (handle && sidebar) {
    handle.setAttribute("aria-valuenow", String(Math.round(sidebar.getBoundingClientRect().width)));
  }
  document.addEventListener("pointerdown", (event) => {
    const target = (event.target as Element).closest?.<HTMLElement>(".sidebar-resize");
    if (!target || event.button !== 0) {
      return;
    }
    event.preventDefault();
    target.setPointerCapture(event.pointerId);
    target.classList.add("dragging");
    const move = (moveEvent: PointerEvent) => setWidth(target, moveEvent.clientX, false);
    target.addEventListener("pointermove", move);
    target.addEventListener(
      "lostpointercapture",
      () => {
        target.removeEventListener("pointermove", move);
        target.classList.remove("dragging");
        setWidth(target, document.querySelector(".sidebar")!.getBoundingClientRect().width, true);
      },
      { once: true },
    );
  });
  document.addEventListener("keydown", (event) => {
    const target = (event.target as Element).closest?.<HTMLElement>(".sidebar-resize");
    if (!target || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) {
      return;
    }
    event.preventDefault();
    const width = document.querySelector(".sidebar")!.getBoundingClientRect().width;
    setWidth(target, width + (event.key === "ArrowRight" ? step : -step), true);
  });
  document.addEventListener("dblclick", (event) => {
    if ((event.target as Element).closest?.(".sidebar-resize")) {
      root.style.removeProperty("--sidebar-width");
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // Storage can be blocked by the browser: the reset still applies to this page.
      }
    }
  });
}
