import { searchEntries, snippet, type SearchEntry } from "./search.ts";

interface PageNavigateEvent extends Event {
  canIntercept: boolean;
  hashChange: boolean;
  downloadRequest: string | null;
  formData: FormData | null;
  destination: { url: string };
  intercept(options: { handler: () => Promise<void>; scroll?: "after-transition" | "manual" }): void;
}

const root = document.documentElement;
const base = new URL(document.querySelector<HTMLAnchorElement>(".brand")!.href).pathname;
const markdownUrl = () => document.querySelector<HTMLLinkElement>('link[rel="alternate"][type="text/markdown"]')?.href;

if (!/Mac|iPhone|iPad/.test(navigator.userAgent)) {
  for (const shortcut of document.querySelectorAll(".search-trigger kbd")) {
    shortcut.textContent = "Ctrl K";
  }
}

function flash(button: HTMLElement) {
  button.classList.add("copied");
  setTimeout(() => button.classList.remove("copied"), 1600);
}

async function copyText(button: HTMLElement, text: string | Promise<string>) {
  try {
    await navigator.clipboard.writeText(await text);
    flash(button);
  } catch (error) {
    console.error("Copy failed", error);
  }
}

const themes = ["device", "light", "dark"] as const;
const themeToggle = document.querySelector<HTMLButtonElement>(".theme-toggle")!;
function applyTheme(theme: (typeof themes)[number]) {
  if (theme === "device") {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = theme;
  }
  themeToggle.setAttribute("aria-label", `Color theme: ${theme}`);
  themeToggle.title = `Color theme: ${theme}`;
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
applyTheme((root.dataset.theme as (typeof themes)[number] | undefined) ?? "device");
themeToggle.addEventListener("click", () => {
  const current = themes.indexOf((root.dataset.theme as (typeof themes)[number] | undefined) ?? "device");
  applyTheme(themes[(current + 1) % themes.length]!);
});

const menuToggle = document.querySelector<HTMLButtonElement>(".menu-toggle")!;
const scrim = document.querySelector<HTMLElement>(".scrim")!;
function setNavigation(open: boolean) {
  document.body.classList.toggle("navigation-open", open);
  menuToggle.setAttribute("aria-expanded", String(open));
  scrim.hidden = !open;
}
menuToggle.addEventListener("click", () => setNavigation(!document.body.classList.contains("navigation-open")));
scrim.addEventListener("click", () => setNavigation(false));

document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const toggledFolder = target.closest(".tree-folder summary");
  if (toggledFolder && !target.closest("a")) {
    toggledFolder.parentElement!.dataset.toggled = "";
  }
  const copyCode = target.closest<HTMLButtonElement>(".copy-code");
  if (copyCode) {
    copyText(copyCode, copyCode.closest("figure")!.querySelector("code")!.innerText);
  }

  const copyPage = target.closest<HTMLButtonElement>(".copy-page");
  const pageMarkdown = markdownUrl();
  if (copyPage && pageMarkdown) {
    copyText(
      copyPage,
      fetch(pageMarkdown).then((response) => response.text()),
    );
  }

  const copyMcp = target.closest<HTMLButtonElement>('[data-action="mcp"]');
  if (copyMcp) {
    const name =
      document.title
        .split(" · ")
        .at(-1)!
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "docs";
    copyText(copyMcp, `claude mcp add --transport http ${name} ${location.origin}${base}mcp`);
  }

  for (const menu of document.querySelectorAll<HTMLDetailsElement>("details.actions-menu[open]")) {
    if (!menu.contains(target) || target.closest(".menu-item")) {
      menu.open = false;
    }
  }
});

function setupPromptLinks() {
  const pageMarkdown = markdownUrl();
  if (!pageMarkdown) {
    return;
  }
  for (const link of document.querySelectorAll<HTMLAnchorElement>("a[data-prompt]")) {
    link.href = link.dataset.prompt + encodeURIComponent(`Read ${pageMarkdown} so I can ask questions about it.`);
  }
}

let tocObserver: IntersectionObserver | null = null;
function setupTableOfContents() {
  tocObserver?.disconnect();
  const tocLinks = new Map<string, HTMLAnchorElement>();
  for (const link of document.querySelectorAll<HTMLAnchorElement>(".toc a")) {
    tocLinks.set(decodeURIComponent(link.hash.slice(1)), link);
  }
  if (tocLinks.size === 0) {
    return;
  }
  const visible = new Set<string>();
  const headings = [...tocLinks.keys()].map((id) => document.getElementById(id)).filter((heading) => heading !== null);
  tocObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          visible.add(entry.target.id);
        } else {
          visible.delete(entry.target.id);
        }
      }
      const active =
        headings.find((heading) => visible.has(heading.id)) ??
        headings.findLast((heading) => heading.getBoundingClientRect().top < 0);
      for (const [id, link] of tocLinks) {
        link.classList.toggle("active", id === active?.id);
      }
    },
    { rootMargin: "-120px 0px -60% 0px" },
  );
  for (const heading of headings) {
    tocObserver.observe(heading);
  }
}

function revealActiveTab() {
  document.querySelector(".category-tabs a[aria-current]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

setupPromptLinks();
setupTableOfContents();
revealActiveTab();

const pageCache = new Map<string, Promise<string>>();
const bypass = new Set<string>();

function isPage(url: URL) {
  return url.origin === location.origin && url.pathname.startsWith(base) && url.pathname.endsWith("/");
}

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

async function loadPage(url: URL) {
  return new DOMParser().parseFromString(await fetchPage(url), "text/html");
}

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
document.addEventListener("mouseover", prefetch, { passive: true });
document.addEventListener("touchstart", prefetch, { passive: true });
document.addEventListener("focusin", prefetch);

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

function swapPage(next: Document) {
  document.title = next.title;
  for (const selector of [
    'meta[name="description"]',
    'meta[property="og:title"]',
    'meta[property="og:description"]',
    'link[rel="canonical"]',
    'link[rel="alternate"][type="text/markdown"]',
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

  syncElement(document.querySelector(".site-header")!, next.querySelector(".site-header")!, ".category-tabs", "append");

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

  setNavigation(false);
  if (dialog.open) {
    dialog.close();
  }
  setupPromptLinks();
  setupTableOfContents();
  revealActiveTab();
}

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

const dialog = document.querySelector<HTMLDialogElement>(".search-dialog")!;
const input = dialog.querySelector("input")!;
const results = dialog.querySelector<HTMLUListElement>(".search-results")!;
const status = dialog.querySelector<HTMLParagraphElement>(".search-status")!;
let index: Promise<SearchEntry[]> | null = null;
let selected = 0;

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

function markTerms(text: string, query: string) {
  const escaped = escapeHtml(text);
  const terms = query
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => escapeHtml(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (terms.length === 0) {
    return escaped;
  }
  return escaped.replace(new RegExp(`(${terms.join("|")})`, "gi"), "<mark>$1</mark>");
}

function select(position: number) {
  const items = results.querySelectorAll("li");
  if (items.length === 0) {
    return;
  }
  selected = (position + items.length) % items.length;
  items.forEach((item, itemIndex) => item.setAttribute("aria-selected", String(itemIndex === selected)));
  items[selected]!.scrollIntoView({ block: "nearest" });
}

async function runSearch() {
  const query = input.value.trim();
  if (!query) {
    results.innerHTML = "";
    status.textContent = "Type to search the documentation.";
    return;
  }
  index ??= fetch(`${base}search.json`).then((response) => response.json());
  const matches = searchEntries(await index, query, 20);
  if (input.value.trim() !== query) {
    return;
  }
  status.textContent = matches.length === 0 ? `No results for “${query}”.` : "";
  results.innerHTML = matches
    .map(
      (entry) => `<li role="option"><a href="${escapeHtml(entry.url)}">
<span class="search-result-title">${entry.heading ? `<span>${escapeHtml(entry.title)}</span> › ` : ""}${markTerms(entry.heading || entry.title, query)}</span>
<span class="search-result-text">${markTerms(snippet(entry.text, query), query)}</span></a></li>`,
    )
    .join("");
  select(0);
}

function openSearch() {
  if (dialog.open) {
    return;
  }
  dialog.showModal();
  input.select();
  runSearch();
}

document.querySelector(".search-trigger")?.addEventListener("click", openSearch);
input.addEventListener("input", runSearch);
dialog.addEventListener("click", (event) => {
  if (event.target === dialog || (event.target as HTMLElement).closest("a")) {
    dialog.close();
  }
});
input.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    select(selected + (event.key === "ArrowDown" ? 1 : -1));
  } else if (event.key === "Enter") {
    const link = results.querySelectorAll("a")[selected];
    if (link) {
      event.preventDefault();
      dialog.close();
      location.href = link.href;
    }
  }
});
document.addEventListener("keydown", (event) => {
  const typing = (event.target as HTMLElement).closest("input, textarea, [contenteditable]");
  if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || (event.key === "/" && !typing)) {
    event.preventDefault();
    openSearch();
  }
  if (event.key === "Escape") {
    setNavigation(false);
  }
});
