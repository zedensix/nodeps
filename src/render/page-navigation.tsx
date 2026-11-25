/** @jsx h */
/** @jsxFrag Fragment */
import { pageHref } from "../output/ai.ts";
import type { NavItem } from "../site/navigation.ts";
import type { Page, Site } from "../site/site.ts";
import { Fragment, h, Icon } from "./jsx.ts";

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
 * Renders one sidebar link with the page icon, if any, and, when the site
 * enables bylines and the page has one, the byline under the label. Marks it
 * as current for the active page.
 */
function sidebarLink(site: Site, page: Page, current?: Page, label = page.title) {
  return (
    <a href={pageHref(site, page)} aria-current={page === current && "page"}>
      {page.icon && <Icon name={page.icon} />}
      <span class="sidebar-text">
        <span>{label}</span>
        {site.config.sidebar.bylines && page.byline && <small>{page.byline}</small>}
      </span>
    </a>
  );
}

/**
 * Renders navigation items as list entries, recursing into folders. A folder
 * holding only its index is a plain link to it; otherwise a plain folder becomes
 * a titled group with an "Overview" link to its index, and a dropdown folder a
 * collapsible `<details>` whose label links to the index.
 */
function sidebarItems(site: Site, items: NavItem[], current?: Page): JSX.Element[] {
  return items.map((item) => {
    if (item.kind === "page") {
      return <li>{sidebarLink(site, item.page, current, item.label ?? item.page.title)}</li>;
    }
    if (item.kind === "link") {
      return (
        <li>
          <a href={item.url}>
            <Icon name="external-link" />
            <span class="sidebar-text">
              <span>{item.title}</span>
            </span>
          </a>
        </li>
      );
    }
    if (item.children.length === 0 && item.index) {
      return <li>{sidebarLink(site, item.index, current, item.title)}</li>;
    }
    const children = sidebarItems(site, item.children, current);
    if (!item.dropdown) {
      return (
        <li class="tree-group">
          <p class="sidebar-title">
            {item.icon && <Icon name={item.icon} />}
            {item.title}
          </p>
          <ul>
            {item.index && <li>{sidebarLink(site, item.index, current, "Overview")}</li>}
            {children}
          </ul>
        </li>
      );
    }
    return (
      <li class="tree-folder">
        <details open={containsPage(item, current)}>
          <summary>
            {item.index ? (
              sidebarLink(site, item.index, current, item.title)
            ) : (
              <span class="tree-label">
                <Icon name={item.icon ?? "folder"} />
                <span>{item.title}</span>
              </span>
            )}
            <span class="tree-toggle" aria-hidden="true">
              <Icon name="chevron-right" />
            </span>
          </summary>
          <ul>{children}</ul>
        </details>
      </li>
    );
  });
}

/**
 * Renders the sidebar tree of the current page's category only, tagged with
 * the category's Diataxis kind for styling. Empty when the site has no category.
 */
export function sidebar(site: Site, current?: Page) {
  const category = currentCategory(site, current);
  return category ? (
    <ul class="tree" data-diataxis={category.diataxis}>
      {sidebarItems(site, category.items, current)}
    </ul>
  ) : (
    <></>
  );
}

/**
 * Renders the header tabs that switch between categories, each linking to the
 * category's first page. Empty with fewer than two categories.
 */
export function categoryTabs(site: Site, current?: Page) {
  const active = currentCategory(site, current);
  return (
    <>
      {site.categories.length >= 2 &&
        site.categories.map((category) => (
          <a href={pageHref(site, category.pages[0]!)} aria-current={category === active && "true"}>
            {category.icon && <Icon name={category.icon} />}
            <span>{category.title}</span>
            {category === active && <span class="tab-indicator"></span>}
          </a>
        ))}
    </>
  );
}

/**
 * Renders the "on this page" entries from the page headings, with a class per
 * heading level so the theme can indent them.
 */
export function tableOfContents(page: Page) {
  return (
    <>
      {page.headings.map((heading) => (
        <li class={`toc-level-${heading.level}`}>
          <a href={`#${heading.id}`}>{heading.text}</a>
        </li>
      ))}
    </>
  );
}

/**
 * Renders the previous and next links following the sidebar order. A missing
 * side becomes an empty span to keep the grid aligned; pages outside the
 * navigation, or with neither side, get no pager at all.
 */
export function pager(site: Site, page: Page) {
  const index = site.navPages.indexOf(page);
  const previous = index === -1 ? undefined : site.navPages[index - 1];
  const next = index === -1 ? undefined : site.navPages[index + 1];
  if (!previous && !next) {
    return <></>;
  }
  return (
    <>
      {previous ? (
        <a class="pager-previous" href={pageHref(site, previous)} rel="prev">
          <small>
            <Icon name="arrow-left" />
            Previous
          </small>
          <span>{previous.title}</span>
        </a>
      ) : (
        <span></span>
      )}
      {next ? (
        <a class="pager-next" href={pageHref(site, next)} rel="next">
          <small>
            Next
            <Icon name="arrow-right" />
          </small>
          <span>{next.title}</span>
        </a>
      ) : (
        <span></span>
      )}
    </>
  );
}
