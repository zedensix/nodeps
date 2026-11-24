import { markdownUrl } from "./site-paths.ts";

const root = document.documentElement;

/**
 * Points the "ask an AI" links at the current page's Markdown so the assistant
 * reads the source. Skipped when the page has no Markdown alternate.
 */
export function setupPromptLinks() {
  const pageMarkdown = markdownUrl();
  if (!pageMarkdown) {
    return;
  }
  for (const link of document.querySelectorAll<HTMLAnchorElement>("a[data-prompt]")) {
    link.href = link.dataset.prompt + encodeURIComponent(`Read ${pageMarkdown} so I can ask questions about it.`);
  }
}

let tocObserver: IntersectionObserver | null = null;

/**
 * Highlights the table of contents entry for the heading being read. The first
 * visible heading wins; when none is visible, the last one scrolled past does.
 * Safe to call again after a page swap: it drops the previous observer.
 */
export function setupTableOfContents() {
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

const mermaidModule = "https://cdn.jsdelivr.net/npm/mermaid@12.3.0/dist/mermaid.esm.min.mjs";
const katexModule = "https://cdn.jsdelivr.net/npm/katex@0.19.1/dist/katex.mjs";
const katexStylesheet = "https://cdn.jsdelivr.net/npm/katex@0.19.1/dist/katex.min.css";

/**
 * Tells whether the page renders dark, from the explicit mode or, in device
 * mode, the system preference.
 */
function prefersDark() {
  return root.dataset.theme === "dark" || (!root.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
}

/**
 * Renders Mermaid diagrams and KaTeX formulas, loading each library from the
 * CDN only when the page has something for it. Already rendered nodes are
 * marked and skipped, so it can run again after a page swap.
 */
export async function renderRichContent() {
  const diagrams = [...document.querySelectorAll<HTMLElement>(".prose pre.mermaid:not([data-processed])")];
  if (diagrams.length > 0) {
    const { default: mermaid } = await import(mermaidModule);
    mermaid.initialize({ startOnLoad: false, theme: prefersDark() ? "dark" : "default" });
    await mermaid.run({ nodes: diagrams });
  }
  const formulas = [...document.querySelectorAll<HTMLElement>(".prose .arithmatex:not([data-rendered])")];
  if (formulas.length > 0) {
    if (!document.querySelector(`link[href="${katexStylesheet}"]`)) {
      document.head.append(Object.assign(document.createElement("link"), { rel: "stylesheet", href: katexStylesheet }));
    }
    const { default: katex } = await import(katexModule);
    for (const formula of formulas) {
      const source = formula.textContent ?? "";
      const display = source.startsWith("\\[");
      katex.render(source.slice(2, -2), formula, { displayMode: display, throwOnError: false });
      formula.dataset.rendered = "";
    }
  }
}

/**
 * Keeps content tabs in step: picking a tab selects the tab with the same
 * label in every other tab set on the page.
 */
export function setupTabSync() {
  document.addEventListener("change", (event) => {
    const input = event.target as HTMLInputElement;
    if (!input.matches(".tabbed-set > input")) {
      return;
    }
    const label = input.nextElementSibling?.textContent;
    for (const other of document.querySelectorAll<HTMLInputElement>(".tabbed-set > input")) {
      if (other !== input && other.nextElementSibling?.textContent === label) {
        other.checked = true;
      }
    }
  });
}

/**
 * Scrolls the header's category tab bar so the current category is in view on
 * narrow screens.
 */
export function revealActiveTab() {
  document.querySelector(".category-tabs a[aria-current]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
}
