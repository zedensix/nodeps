const menuToggle = document.querySelector<HTMLButtonElement>(".menu-toggle")!;
const scrim = document.querySelector<HTMLElement>(".scrim")!;

/**
 * Opens or closes the mobile navigation drawer, keeping the menu button's
 * aria-expanded and the click-to-close scrim in sync.
 */
export function setNavigation(open: boolean) {
  document.body.classList.toggle("navigation-open", open);
  menuToggle.setAttribute("aria-expanded", String(open));
  scrim.hidden = !open;
}

/**
 * Makes the menu button toggle the drawer and a click on the scrim close it.
 */
export function setupSidebarToggle() {
  menuToggle.addEventListener("click", () => setNavigation(!document.body.classList.contains("navigation-open")));
  scrim.addEventListener("click", () => setNavigation(false));
}
