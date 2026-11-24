const root = document.documentElement;
const themes = ["device", "light", "dark"] as const;
const themeToggle = document.querySelector<HTMLButtonElement>(".theme-toggle")!;

/**
 * Sets the color mode on the root element and remembers it. "device" removes
 * the override so the system preference wins again.
 */
function applyTheme(theme: (typeof themes)[number]) {
  if (theme === "device") {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = theme;
  }
  themeToggle.setAttribute("aria-label", `Color mode: ${theme}`);
  themeToggle.dataset.tooltip = `Color mode: ${theme}`;
  try {
    if (theme === "device") {
      localStorage.removeItem("theme");
    } else {
      localStorage.setItem("theme", theme);
    }
  } catch {
    // Storage can be blocked by the browser: the theme still applies to this page.
  }
}

/**
 * Syncs the toggle label with the mode the inline head script already applied,
 * then makes the toggle cycle through device, light and dark.
 */
export function setupColorMode() {
  applyTheme((root.dataset.theme as (typeof themes)[number] | undefined) ?? "device");
  themeToggle.addEventListener("click", () => {
    const current = themes.indexOf((root.dataset.theme as (typeof themes)[number] | undefined) ?? "device");
    applyTheme(themes[(current + 1) % themes.length]!);
  });
}

/**
 * Turns reader mode on or off with a view transition unless the user asked for
 * reduced motion, and remembers the choice across pages.
 */
function setReaderMode(enabled: boolean) {
  const update = () => {
    if (enabled) {
      root.dataset.reader = "";
    } else {
      delete root.dataset.reader;
    }
  };
  if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.startViewTransition(update);
  } else {
    update();
  }
  try {
    if (enabled) {
      localStorage.setItem("reader", "on");
    } else {
      localStorage.removeItem("reader");
    }
  } catch {
    // Storage can be blocked by the browser: reader mode then lasts until the page is reloaded.
  }
}

/**
 * Wires the buttons that enter and leave reader mode. Either can be missing
 * when the layout does not render it.
 */
export function setupReaderMode() {
  document.querySelector(".reader-toggle")?.addEventListener("click", () => setReaderMode(true));
  document.querySelector(".reader-exit")?.addEventListener("click", () => setReaderMode(false));
}

/**
 * Returns the name of the theme preset saved by the picker, or null when none
 * is saved or storage is blocked.
 */
function storedPreset() {
  try {
    return localStorage.getItem("theme-preset");
  } catch {
    return null;
  }
}

/**
 * Checks the saved preset in the theme picker, or the default entry (the one
 * with an empty style) when nothing is saved.
 */
export function markCurrentPreset() {
  const current = storedPreset();
  for (const option of document.querySelectorAll<HTMLElement>("[data-preset]")) {
    const selected = current ? option.dataset.preset === current : option.dataset.style === "";
    option.setAttribute("aria-checked", String(selected));
  }
}

/**
 * Applies a preset's inline CSS variables to the root element and saves both
 * its name and style so the head script can restore it before first paint. An
 * empty style resets to the site's own theme.
 */
export function applyPreset(name: string, style: string) {
  const update = () => {
    root.style.cssText = style;
  };
  if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.startViewTransition(update);
  } else {
    update();
  }
  try {
    if (style) {
      localStorage.setItem("theme-preset", name);
      localStorage.setItem("theme-preset-style", style);
    } else {
      localStorage.removeItem("theme-preset");
      localStorage.removeItem("theme-preset-style");
    }
  } catch {
    // Storage can be blocked by the browser: the theme still applies to this page.
  }
  markCurrentPreset();
}
