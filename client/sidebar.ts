const scrim = document.querySelector<HTMLElement>(".scrim")!;

type Drawer = "navigation" | "main-menu";

const toggles: Record<Drawer, string> = { navigation: ".sidebar-toggle", "main-menu": ".menu-toggle" };

/**
 * Opens one drawer, closing the other, or closes both with null: the section
 * sidebar ("navigation", from the button in the page) or the main menu (from
 * the header button). Keeps the buttons' aria-expanded and the scrim in sync.
 */
export function setDrawer(open: Drawer | null) {
  for (const [drawer, selector] of Object.entries(toggles)) {
    document.body.classList.toggle(`${drawer}-open`, drawer === open);
    document.querySelector(selector)?.setAttribute("aria-expanded", String(drawer === open));
  }
  scrim.hidden = open === null;
}

/**
 * Makes each drawer button toggle its drawer, and a click on the scrim or a
 * drawer's close button close it. Clicks are delegated because page swaps replace the in-page button.
 */
export function setupDrawers() {
  document.addEventListener("click", (event) => {
    if ((event.target as Element).closest?.(".drawer-close")) {
      setDrawer(null);
      return;
    }
    const toggle = (event.target as Element).closest?.(".menu-toggle, .sidebar-toggle");
    if (toggle) {
      const drawer: Drawer = toggle.matches(".menu-toggle") ? "main-menu" : "navigation";
      setDrawer(document.body.classList.contains(`${drawer}-open`) ? null : drawer);
    }
  });
  scrim.addEventListener("click", () => setDrawer(null));
}
