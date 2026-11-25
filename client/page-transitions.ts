import { markCurrentPreset } from "./appearance.ts";
import { checkPendingEdit } from "./editor/launcher.ts";
import { renderRichContent, revealActiveTab, setupPromptLinks, setupTableOfContents } from "./page-enhancements.ts";
import { closeSearch } from "./search/dialog.ts";
import { setDrawer } from "./sidebar.ts";
import { base } from "./site-paths.ts";

interface PageNavigateEvent extends Event {
  canIntercept: boolean;
  hashChange: boolean;
  downloadRequest: string | null;
  formData: FormData | null;
  destination: { url: string };
  intercept(options: { handler: () => Promise<void>; scroll?: "after-transition" | "manual" }): void;
}

const pageCache = new Map<string, Promise<string>>();
const bypass = new Set<string>();

/**
 * Tells whether a URL is a documentation page of this site: same origin, under
 * the base path, and a directory URL (assets and files end with a name).
 */
function isPage(url: URL) {
  return url.origin === location.origin && url.pathname.startsWith(base) && url.pathname.endsWith("/");
}

/**
 * Fetches a page's HTML once and shares the promise between prefetch and
 * navigation. Query and hash are ignored for the cache key, and a failed or
 * non-HTML response is evicted so the next attempt retries.
 */
function fetchPage(url: URL) {
  const key = url.origin + url.pathname;
  let pending = pageCache.get(key);
  if (!pending) {
    pending = fetch(key, { headers: { accept: "text/html" } }).then((response) => {
      if (!response.headers.get("content-type")?.includes("text/html")) {
        throw new Error(`${key} is not a page`);
      }
      return response.text();
    });
    pageCache.set(key, pending);
    pending.catch(() => pageCache.delete(key));
  }
  return pending;
}

/**
 * Fetches a page and parses it into a detached document.
 */
async function loadPage(url: URL) {
  return new DOMParser().parseFromString(await fetchPage(url), "text/html");
}

/**
 * Starts loading the page behind a link the user hovers, touches or focuses,
 * so the click finds it cached. Links opening elsewhere and the current page
 * are skipped.
 */
function prefetch(event: Event) {
  const link = (event.target as HTMLElement).closest?.<HTMLAnchorElement>("a[href]");
  if (!link || link.target) {
    return;
  }
  const url = new URL(link.href);
  if (isPage(url) && url.pathname !== location.pathname) {
    fetchPage(url).catch(() => {});
  }
}

/**
 * Makes the direct child matching the selector match the next page: replaced
 * when both have it, inserted when only the next page has it, removed when
 * only the current one does.
 */
function syncElement(parent: Element, nextParent: Element, selector: string, position: "prepend" | "append") {
  const current = parent.querySelector(`:scope > ${selector}`);
  const next = nextParent.querySelector(`:scope > ${selector}`);
  if (current && next) {
    current.replaceWith(next);
  } else if (next) {
    parent[position](next);
  } else {
    current?.remove();
  }
}

/**
 * Replaces the parts of the page that change between pages (title, metadata,
 * category tabs and the main menu, sidebar navigation, content, table of contents) and reruns
 * the per-page setup. The sidebar element itself is kept when both pages have
 * one so its scroll position survives.
 */
function swapPage(next: Document) {
  document.title = next.title;
  for (const selector of [
    'meta[name="description"]',
    'meta[property="og:title"]',
    'meta[property="og:description"]',
    'link[rel="canonical"]',
    'link[rel="alternate"][type="text/markdown"]',
    "script#nodeps-editor",
  ]) {
    const current = document.head.querySelector(selector);
    const replacement = next.head.querySelector(selector);
    if (current && replacement) {
      current.replaceWith(replacement);
    } else if (replacement) {
      document.head.append(replacement);
    } else {
      current?.remove();
    }
  }

  const header = document.querySelector(".site-header")!;
  const nextHeader = next.querySelector(".site-header")!;
  syncElement(header, nextHeader, ".category-tabs", "append");
  syncElement(document.body, next.body, ".main-menu", "append");

  const layout = document.querySelector(".layout")!;
  const nextLayout = next.querySelector(".layout")!;
  const sidebar = layout.querySelector(":scope > .sidebar");
  const nextSidebar = nextLayout.querySelector(":scope > .sidebar");
  if (sidebar && nextSidebar) {
    sidebar.querySelector("nav")!.replaceWith(nextSidebar.querySelector("nav")!);
  } else {
    syncElement(layout, nextLayout, ".sidebar", "prepend");
  }
  layout.querySelector(":scope > .content")!.replaceWith(nextLayout.querySelector(":scope > .content")!);
  syncElement(layout, nextLayout, ".toc", "append");

  setDrawer(null);
  closeSearch();
  setupPromptLinks();
  setupTableOfContents();
  revealActiveTab();
  markCurrentPreset();
  checkPendingEdit();
  renderRichContent().catch((error) => console.error("Diagram or math rendering failed", error));
}

/**
 * Prefetches pages on hover, touch and focus, then turns same-site page
 * navigations into in-place swaps through the Navigation API where the browser
 * has it. A page that fails to load falls back to a full load, and is marked
 * so that load is not intercepted again.
 */
export function setupPageTransitions() {
  document.addEventListener("mouseover", prefetch, { passive: true });
  document.addEventListener("touchstart", prefetch, { passive: true });
  document.addEventListener("focusin", prefetch);

  const navigation = (window as unknown as { navigation?: EventTarget }).navigation;
  navigation?.addEventListener("navigate", (event) => {
    const navigateEvent = event as PageNavigateEvent;
    if (
      !navigateEvent.canIntercept ||
      navigateEvent.hashChange ||
      navigateEvent.downloadRequest !== null ||
      navigateEvent.formData
    ) {
      return;
    }
    const url = new URL(navigateEvent.destination.url);
    if (!isPage(url) || bypass.delete(url.href)) {
      return;
    }
    navigateEvent.intercept({
      scroll: "after-transition",
      /**
       * Loads the destination, then swaps it in inside a view transition
       * unless the user asked for reduced motion.
       */
      async handler() {
        let next: Document;
        try {
          next = await loadPage(url);
        } catch {
          bypass.add(url.href);
          location.assign(url.href);
          return;
        }
        if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
          await document.startViewTransition(() => swapPage(next)).updateCallbackDone;
        } else {
          swapPage(next);
        }
      },
    });
  });
}
