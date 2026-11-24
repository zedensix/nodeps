import {
  pagesWithTags,
  parseQuery,
  relatedPages,
  searchEntries,
  snippet,
  tagCounts,
  type PageSummary,
  type SearchIndex,
} from "./search.ts";
import { base } from "../site-paths.ts";

const dialog = document.querySelector<HTMLDialogElement>(".search-dialog")!;
const input = dialog.querySelector("input")!;
const results = dialog.querySelector<HTMLUListElement>(".search-results")!;
const status = dialog.querySelector<HTMLParagraphElement>(".search-status")!;
const tagList = dialog.querySelector<HTMLUListElement>(".search-tag-list")!;
let index: Promise<SearchIndex> | null = null;
let selected = 0;

/**
 * Escapes text for HTML content and attribute values by turning every special
 * character into a numeric entity.
 */
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

/**
 * Escapes the text and wraps each occurrence of a query word in <mark>,
 * ignoring case. The words are matched on their escaped form so entities in
 * the text still line up.
 */
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

/**
 * Moves the keyboard selection to a result, wrapping around both ends, and
 * scrolls it into view.
 */
function select(position: number) {
  const items = results.querySelectorAll('li[role="option"]');
  if (items.length === 0) {
    return;
  }
  selected = (position + items.length) % items.length;
  items.forEach((item, itemIndex) => item.setAttribute("aria-selected", String(itemIndex === selected)));
  items[selected]!.scrollIntoView({ block: "nearest" });
}

/**
 * Lists the tags of the page being read, taken from the tag buttons in its
 * table of contents.
 */
function currentPageTags() {
  return [...document.querySelectorAll<HTMLElement>(".toc-tags [data-search]")].map((tag) =>
    tag.dataset.search!.slice(1),
  );
}

/**
 * Renders the tag filter bar with page counts. Tags of the current page come
 * first, and tags in the query are shown as active.
 */
function renderTags(data: SearchIndex, activeTags: string[]) {
  const pageTags = currentPageTags();
  const counts = tagCounts(data.pages).sort(
    ([left], [right]) => Number(pageTags.includes(right)) - Number(pageTags.includes(left)),
  );
  tagList.innerHTML = counts
    .map(([tag, count]) => {
      const classes = ["search-tag", pageTags.includes(tag) ? "on-page" : "", activeTags.includes(tag) ? "active" : ""]
        .join(" ")
        .trim();
      return `<li><button type="button" class="${classes}" data-tag-filter="${escapeHtml(tag)}"><span>#${escapeHtml(tag)}</span><small>${count}</small></button></li>`;
    })
    .join("");
}

/**
 * Builds the result items for a list of whole pages under a group heading.
 * Returns an empty string for no pages so the caller can show a status instead.
 */
function renderPages(pages: PageSummary[], heading: string) {
  if (pages.length === 0) {
    return "";
  }
  const items = pages
    .map(
      (page) => `<li role="option"><a href="${escapeHtml(page.url)}">
<span class="search-result-title">${page.section ? `<span>${escapeHtml(page.section)}</span> › ` : ""}${escapeHtml(page.title)}</span>
${page.description ? `<span class="search-result-text">${escapeHtml(page.description)}</span>` : ""}
${page.tags.length > 0 ? `<span class="search-result-tags">${page.tags.map((tag) => `<span>#${escapeHtml(tag)}</span>`).join("")}</span>` : ""}</a></li>`,
    )
    .join("");
  return `<li class="search-group" role="presentation">${escapeHtml(heading)}</li>${items}`;
}

/**
 * Runs the query typed in the dialog. The index is fetched once on first use,
 * and a result is dropped when the input changed while it loaded. Without free
 * text it lists pages with the chosen tags, or pages related to this one.
 */
async function runSearch() {
  const query = input.value.trim();
  index ??= fetch(`${base}search.json`).then((response) => response.json());
  const data = await index;
  if (input.value.trim() !== query) {
    return;
  }
  const { tags, text } = parseQuery(query);
  renderTags(data, tags);

  if (!text) {
    const pages = tags.length > 0 ? pagesWithTags(data.pages, tags) : relatedPages(data.pages, location.pathname);
    const heading = tags.length > 0 ? `Tagged ${tags.map((tag) => `#${tag}`).join(" ")}` : "Related to this page";
    results.innerHTML = renderPages(pages, heading);
    status.textContent =
      pages.length > 0
        ? ""
        : tags.length > 0
          ? "No page has these tags."
          : "Type to search the documentation, or pick a tag.";
    select(0);
    return;
  }

  const allowed = tags.length > 0 ? new Set(pagesWithTags(data.pages, tags).map((page) => page.url)) : null;
  const sections = allowed ? data.sections.filter((entry) => allowed.has(entry.url.split("#")[0]!)) : data.sections;
  const matches = searchEntries(sections, text, 20);
  status.textContent = matches.length === 0 ? `No results for “${query}”.` : "";
  results.innerHTML = matches
    .map(
      (entry) => `<li role="option"><a href="${escapeHtml(entry.url)}">
<span class="search-result-title">${entry.heading ? `<span>${escapeHtml(entry.title)}</span> › ` : ""}${markTerms(entry.heading || entry.title, text)}</span>
<span class="search-result-text">${markTerms(snippet(entry.text, text), text)}</span></a></li>`,
    )
    .join("");
  select(0);
}

/**
 * Opens the search dialog, optionally prefilled with a query such as a tag,
 * and runs it right away. Does nothing when the dialog is already open.
 */
export function openSearch(query?: string) {
  if (dialog.open) {
    return;
  }
  if (query !== undefined) {
    input.value = query;
  }
  dialog.showModal();
  input.select();
  runSearch();
}

/**
 * Closes the search dialog if it is open, for when the page underneath is
 * replaced.
 */
export function closeSearch() {
  if (dialog.open) {
    dialog.close();
  }
}

/**
 * Wires the dialog: tag buttons toggle a #tag in the query, typing searches,
 * arrow keys move the selection and Enter follows it, and Escape, clicking
 * the backdrop or a result closes the dialog.
 */
export function setupSearch() {
  tagList.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-tag-filter]");
    if (!button) {
      return;
    }
    const tag = button.dataset.tagFilter!;
    const { tags, text } = parseQuery(input.value);
    input.value = tags.includes(tag) ? text : [`#${tag}`, text].filter(Boolean).join(" ");
    input.focus();
    runSearch();
  });

  document.querySelector(".search-trigger")?.addEventListener("click", () => openSearch());
  input.addEventListener("input", runSearch);
  // After a client-side navigation the first native Escape is swallowed, so close it here.
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      dialog.close();
    }
  });
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
      const link = results.querySelectorAll('li[role="option"] a')[selected];
      if (link) {
        event.preventDefault();
        dialog.close();
        location.href = link.href;
      }
    }
  });
}
