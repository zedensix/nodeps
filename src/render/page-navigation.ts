import { pageHref } from "../output/ai.ts";
import { icon } from "../icons/icons.ts";
import type { NavItem } from "../site/navigation.ts";
import type { Page, Site } from "../site/site.ts";

const escape = Bun.escapeHTML;

/**
 * Returns the category the page belongs to, falling back to the first category
 * when there is no page or it has no category (the 404 page).
 */
function currentCategory(site: Site, page?: Page) {
  return page?.category ?? site.categories[0];
}

/**
 * Tells whether the page sits anywhere under this navigation item, including
 * as a folder's index page, so a dropdown folder can render open around it.
 */
function containsPage(item: NavItem, page?: Page): boolean {
  if (!page) {
    return false;
  }
  if (item.kind === "page") {
    return item.page === page;
  }
  if (item.kind === "link") {
    return false;
  }
  return item.index === page || item.children.some((child) => containsPage(child, page));
}

/**
 * Renders one sidebar link with the page icon and, when the site enables
 * bylines, the byline under the label. Marks it as current for the active page.
 */
function sidebarLink(site: Site, page: Page, current?: Page, label = page.title) {
  const active = page === current ? ` aria-current="page"` : "";
  const byline = site.config.sidebar.bylines ? `<small>${escape(page.byline)}</small>` : "";
  return `<a href="${escape(pageHref(site, page))}"${active}>${icon(page.icon)}<span class="sidebar-text"><span>${escape(label)}</span>${byline}</span></a>`;
}

/**
 * Renders navigation items as list entries, recursing into folders. A plain
 * folder becomes a titled group with an "Overview" link to its index; a
 * dropdown folder becomes a collapsible `<details>` whose label links to the index.
 */
function sidebarItems(site: Site, items: NavItem[], current?: Page): string {
  return items
    .map((item) => {
      if (item.kind === "page") {
        return `<li>${sidebarLink(site, item.page, current, item.label ?? item.page.title)}</li>`;
      }
      if (item.kind === "link") {
        return `<li><a href="${escape(item.url)}" target="_blank" rel="noopener">${icon("external-link")}<span class="sidebar-text"><span>${escape(item.title)}</span></span></a></li>`;
      }
      const children = sidebarItems(site, item.children, current);
      const folderIcon = item.icon ? icon(item.icon) : "";
      if (!item.dropdown) {
        const overview = item.index ? `<li>${sidebarLink(site, item.index, current, "Overview")}</li>` : "";
        return `<li class="tree-group"><p class="sidebar-title">${folderIcon}${escape(item.title)}</p><ul>${overview}${children}</ul></li>`;
      }
      const label = item.index
        ? sidebarLink(site, item.index, current, item.title)
        : `<span class="tree-label">${item.icon ? folderIcon : icon("folder")}<span>${escape(item.title)}</span></span>`;
      const open = containsPage(item, current) ? " open" : "";
      return `<li class="tree-folder"><details${open}><summary>${label}<span class="tree-toggle" aria-hidden="true">${icon("chevron-right")}</span></summary><ul>${children}</ul></details></li>`;
    })
    .join("");
}

/**
 * Renders the sidebar tree of the current page's category only, tagged with
 * the category's Diataxis kind for styling. Empty when the site has no category.
 */
export function sidebar(site: Site, current?: Page) {
  const category = currentCategory(site, current);
  const kind = category?.diataxis ? ` data-diataxis="${category.diataxis}"` : "";
  return category ? `<ul class="tree"${kind}>${sidebarItems(site, category.items, current)}</ul>` : "";
}

/**
 * Renders the header tabs that switch between categories, each linking to the
 * category's first page. Empty with fewer than two categories.
 */
export function categoryTabs(site: Site, current?: Page) {
  if (site.categories.length < 2) {
    return "";
  }
  const active = currentCategory(site, current);
  return site.categories
    .map((category) => {
      const first = category.pages[0]!;
      const attributes = category === active ? ` aria-current="true"` : "";
      return `<a href="${escape(pageHref(site, first))}"${attributes}>${category.icon ? icon(category.icon) : ""}<span>${escape(category.title)}</span>${category === active ? `<span class="tab-indicator"></span>` : ""}</a>`;
    })
    .join("");
}

/**
 * Renders the "on this page" entries from the page headings, with a class per
 * heading level so the theme can indent them.
 */
export function tableOfContents(page: Page) {
  return page.headings
    .map(
      (heading) =>
        `<li class="toc-level-${heading.level}"><a href="#${escape(heading.id)}">${escape(heading.text)}</a></li>`,
    )
    .join("");
}

/**
 * Renders the previous and next links following the sidebar order. A missing
 * side becomes an empty span to keep the grid aligned; pages outside the
 * navigation get no pager at all.
 */
export function pager(site: Site, page: Page) {
  const index = site.navPages.indexOf(page);
  if (index === -1) {
    return "";
  }
  const previous = site.navPages[index - 1];
  const next = site.navPages[index + 1];
  const previousLink = previous
    ? `<a class="pager-previous" href="${escape(pageHref(site, previous))}" rel="prev"><small>${icon("arrow-left")}Previous</small><span>${escape(previous.title)}</span></a>`
    : "<span></span>";
  const nextLink = next
    ? `<a class="pager-next" href="${escape(pageHref(site, next))}" rel="next"><small>Next${icon("arrow-right")}</small><span>${escape(next.title)}</span></a>`
    : "<span></span>";
  return previous || next ? previousLink + nextLink : "";
}
