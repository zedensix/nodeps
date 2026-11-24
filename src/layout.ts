import { markdownHref, pageHref } from "./ai.ts";
import { editUrl, gitProviders, type Theme } from "./config.ts";
import { icon } from "./icons.ts";
import { renderCode } from "./markdown.ts";
import { formatSize, resourceIcon } from "./resources.ts";
import { resourceUrl, type Category, type DiataxisKind, type NavItem, type Page, type Site } from "./site.ts";

export interface RenderOptions {
  dev: boolean;
  server: boolean;
}

const escape = Bun.escapeHTML;

function themeStyle(theme: Theme) {
  const declarations = [`--brand:${theme.accent}`];
  for (const [name, value] of Object.entries(theme.tokens)) {
    declarations.push(`--${name}:${value}`);
  }
  for (const [name, value] of Object.entries(theme.light)) {
    declarations.push(`--light-${name}:${value}`);
  }
  for (const [name, value] of Object.entries(theme.dark)) {
    declarations.push(`--dark-${name}:${value}`);
  }
  return `<style>:root{${declarations.join(";")}}</style>`;
}

const liveReload = (base: string) =>
  `<script>(()=>{const connect=()=>{const socket=new WebSocket(location.origin.replace(/^http/,"ws")+${JSON.stringify(base + "__reload")});socket.onmessage=()=>location.reload();socket.onclose=()=>setTimeout(()=>fetch(location.href).then(()=>location.reload(),connect),400)};connect()})()</script>`;

function logoUrl(site: Site) {
  return site.config.logo ? site.config.base + site.config.logo.replace(/^\.?\//, "") : undefined;
}

function brand(site: Site) {
  const logo = logoUrl(site);
  return `${logo ? `<img class="brand-logo" src="${escape(logo)}" alt="">` : ""}<span>${escape(site.config.title)}</span>`;
}

function currentCategory(site: Site, page?: Page) {
  return page?.category ?? site.categories[0];
}

function containsPage(item: NavItem, page?: Page): boolean {
  if (!page) {
    return false;
  }
  if (item.kind === "page") {
    return item.page === page;
  }
  return item.index === page || item.children.some((child) => containsPage(child, page));
}

function sidebarLink(site: Site, page: Page, current?: Page, label = page.title) {
  const active = page === current ? ` aria-current="page"` : "";
  const byline = site.config.sidebar.bylines ? `<small>${escape(page.byline)}</small>` : "";
  return `<a href="${escape(pageHref(site, page))}"${active}>${icon(page.icon)}<span class="sidebar-text"><span>${escape(label)}</span>${byline}</span></a>`;
}

function sidebarItems(site: Site, items: NavItem[], current?: Page): string {
  return items
    .map((item) => {
      if (item.kind === "page") {
        return `<li>${sidebarLink(site, item.page, current)}</li>`;
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

function sidebar(site: Site, current?: Page) {
  const category = currentCategory(site, current);
  return category ? `<ul class="tree">${sidebarItems(site, category.items, current)}</ul>` : "";
}

function categoryTabs(site: Site, current?: Page) {
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

function tableOfContents(page: Page) {
  return page.headings
    .map(
      (heading) =>
        `<li class="toc-level-${heading.level}"><a href="#${escape(heading.id)}">${escape(heading.text)}</a></li>`,
    )
    .join("");
}

function pager(site: Site, page: Page) {
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

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

function time(date: Date) {
  return `<time datetime="${date.toISOString()}">${dateFormat.format(date)}</time>`;
}

function footer(site: Site, page?: Page) {
  const repository = site.config.repository;
  const edit =
    repository?.edit && page
      ? `<a class="edit-link" href="${escape(editUrl(repository, page.source))}">${icon("square-pen")}Edit this page on ${gitProviders[repository.provider]}</a>`
      : "";
  const text = site.config.footer ? `<p>${escape(site.config.footer)}</p>` : "";
  return edit ? `<div class="page-meta">${edit}</div>${text}` : text;
}

interface DocumentParts {
  title: string;
  description: string;
  page?: Page;
  home?: boolean;
  article: string;
}

function renderDocument(site: Site, options: RenderOptions, parts: DocumentParts) {
  const { config } = site;
  const page = parts.page;
  const fullTitle = page?.url === "/" ? config.title : `${parts.title} · ${config.title}`;
  const logo = logoUrl(site);
  const head = [
    `<meta name="description" content="${escape(parts.description)}">`,
    `<meta property="og:title" content="${escape(fullTitle)}">`,
    `<meta property="og:description" content="${escape(parts.description)}">`,
    config.url && page ? `<link rel="canonical" href="${escape(config.url + pageHref(site, page))}">` : "",
    page
      ? `<link rel="alternate" type="text/markdown" href="${escape(markdownHref(site, page))}" title="Markdown">`
      : "",
    logo ? `<link rel="icon" href="${escape(logo)}">` : "",
    themeStyle(config.theme),
    site.customStylesheet ? `<link rel="stylesheet" href="${escape(site.customStylesheet)}">` : "",
    options.dev ? liveReload(config.base) : "",
  ].join("");

  const pagerHtml = page ? pager(site, page) : "";
  const footerHtml = footer(site, page);
  const tocHtml = page ? tableOfContents(page) : "";
  const tabsHtml = categoryTabs(site, page);
  const slots: Record<string, string> = {
    title: escape(fullTitle),
    brand: brand(site),
    links:
      config.links.map((link) => `<a href="${escape(link.url)}">${escape(link.label)}</a>`).join("") +
      (config.repository
        ? `<a class="repository-link" href="${escape(config.repository.url)}" title="Source on ${gitProviders[config.repository.provider]}">${icon(config.repository.provider)}<span>${escape(config.repository.label)}</span></a>`
        : ""),
    sidebar: sidebar(site, page),
    tabs: tabsHtml,
    breadcrumb: escape([page?.category?.title, ...(page?.trail ?? [])].filter(Boolean).join(" › ")),
    article: parts.article,
    pager: pagerHtml,
    footer: footerHtml,
    toc: tocHtml,
  };
  const flags: Record<string, boolean> = {
    page: page !== undefined && !parts.home,
    sidebar: !parts.home,
    mcp: options.server,
    pager: pagerHtml !== "" && !parts.home,
    footer: footerHtml !== "",
    toc: tocHtml !== "" && !parts.home,
    tabs: tabsHtml !== "",
  };

  return new HTMLRewriter()
    .on("head", {
      element(element) {
        element.append(head, { html: true });
      },
    })
    .on("[data-if]", {
      element(element) {
        if (flags[element.getAttribute("data-if")!]) {
          element.removeAttribute("data-if");
        } else {
          element.remove();
        }
      },
    })
    .on("[data-slot]", {
      element(element) {
        const content = slots[element.getAttribute("data-slot")!];
        element.removeAttribute("data-slot");
        if (content !== undefined) {
          element.setInnerContent(content, { html: true });
        }
      },
    })
    .on("i[data-icon]", {
      element(element) {
        element.replace(icon(element.getAttribute("data-icon")!), { html: true });
      },
    })
    .on("a.brand", {
      element(element) {
        element.setAttribute("href", config.base);
      },
    })
    .on('a[data-action="markdown"]', {
      element(element) {
        if (page) {
          element.setAttribute("href", markdownHref(site, page));
        }
      },
    })
    .on('a[data-action="llms"]', {
      element(element) {
        element.setAttribute("href", config.base + "llms.txt");
      },
    })
    .transform(site.template);
}

const diataxisLabels: Record<DiataxisKind, string> = {
  tutorials: "Learning-oriented",
  "how-to": "Task-oriented",
  reference: "Information-oriented",
  explanation: "Understanding-oriented",
};

const compassOrder: DiataxisKind[] = ["tutorials", "how-to", "explanation", "reference"];

function categoryCard(site: Site, category: Category, home: Page) {
  const latest = category.pages
    .filter((page) => page !== home)
    .sort((left, right) => right.updated.getTime() - left.updated.getTime())
    .slice(0, site.config.home!.latest)
    .map(
      (page) =>
        `<li><a href="${escape(pageHref(site, page))}">${icon(page.icon)}<span>${escape(page.title)}</span>${time(page.updated)}</a></li>`,
    )
    .join("");
  const first = category.pages.find((page) => page !== home)!;
  const kind = category.diataxis ? `<span class="card-kind">${diataxisLabels[category.diataxis]}</span>` : "";
  return `<section class="category-card"${category.diataxis ? ` data-diataxis="${category.diataxis}"` : ""}>
<a class="card-heading" href="${escape(pageHref(site, first))}"><span class="card-icon">${icon(category.icon ?? "book-open")}</span><span><strong>${escape(category.title)}</strong>${kind}</span>${icon("arrow-right")}</a>
${category.description ? `<p class="card-description">${escape(category.description)}</p>` : ""}
${latest ? `<p class="card-latest">Latest</p><ul>${latest}</ul>` : ""}
</section>`;
}

function resolveLink(site: Site, url: string) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(url)) {
    return url;
  }
  const path = url.replace(/^\.?\//, "");
  const page = site.pages.find((candidate) => candidate.source === path);
  return page ? pageHref(site, page) : site.config.base + path;
}

function renderHome(site: Site, page: Page, options: RenderOptions) {
  const home = site.config.home!;
  const actions = home.actions
    .map(
      (action, index) =>
        `<a class="button${index === 0 ? " primary" : ""}" href="${escape(resolveLink(site, action.url))}">${escape(action.label)}${index === 0 ? icon("arrow-right") : ""}</a>`,
    )
    .join("");
  const categories = site.categories.filter((category) => category.pages.some((categoryPage) => categoryPage !== page));
  const compass = compassOrder
    .map((kind) => categories.find((category) => category.diataxis === kind))
    .filter((category) => category !== undefined);
  const others = categories.filter((category) => !compass.includes(category));
  const compassHtml =
    compass.length > 0
      ? `<section class="compass" aria-label="Documentation by purpose"><div class="compass-axes" aria-hidden="true"><span>Practical</span><span>Theoretical</span><span>Study</span><span>Work</span></div><div class="compass-grid">${compass.map((category) => categoryCard(site, category, page)).join("")}</div></section>`
      : "";
  const othersHtml =
    others.length > 0
      ? `<section class="category-grid">${others.map((category) => categoryCard(site, category, page)).join("")}</section>`
      : "";
  const article = `<section class="home-hero">
<h1>${escape(home.headline)}</h1>
${home.tagline ? `<p class="home-tagline">${escape(home.tagline)}</p>` : ""}
${actions ? `<div class="home-actions">${actions}</div>` : ""}
</section>
${compassHtml}${othersHtml}
${page.html.trim() ? `<div class="home-content">${page.html}</div>` : ""}`;
  return renderDocument(site, options, {
    title: page.title,
    description: page.description || site.config.description,
    page,
    home: true,
    article,
  });
}

function resourcesSection(site: Site, page: Page) {
  if (page.resources.length === 0) {
    return "";
  }
  const action = (url: string, iconName: string, label: string, download: boolean) =>
    `<a class="resource-action" href="${escape(url)}"${download ? " download" : ""}>${icon(iconName)}${label}</a>`;
  const cards = page.resources.map((resource) => {
    const kindLabel =
      resource.kind === "skill"
        ? "AI skill"
        : resource.kind === "code"
          ? "Code"
          : resource.kind === "document"
            ? "Document"
            : "File";
    const meta = [kindLabel, resource.extension.toUpperCase(), formatSize(resource.size)].filter(Boolean).join(" · ");
    const actions =
      resource.kind === "skill"
        ? action(resourceUrl(site.config, resource.archivePath!), "download", "Download skill", true) +
          action(resourceUrl(site.config, resource.skillFile!), "eye", "View SKILL.md", false)
        : action(resourceUrl(site.config, resource.path), "download", "Download", true) +
          (resource.kind === "document" ? action(resourceUrl(site.config, resource.path), "eye", "Open", false) : "");
    const preview =
      resource.code !== undefined
        ? `<details class="resource-preview"><summary>${icon("chevron-right")}Preview</summary>${renderCode(resource.code, resource.extension, resource.title)}</details>`
        : "";
    return `<article class="resource" data-kind="${resource.kind}">
<div class="resource-head"><span class="resource-icon">${icon(resourceIcon(resource))}</span><div><strong>${escape(resource.title)}</strong><small>${escape(meta)}</small></div></div>
${resource.description ? `<p class="resource-description">${escape(resource.description)}</p>` : ""}
<div class="resource-actions">${actions}</div>${preview}
</article>`;
  });
  return `<section class="resources"><h2 id="resources"><a class="anchor" href="#resources" aria-hidden="true" tabindex="-1">#</a>Resources</h2><div class="resource-grid">${cards.join("")}</div></section>`;
}

export function renderPage(site: Site, page: Page, options: RenderOptions) {
  if (site.config.home && page.url === "/") {
    return renderHome(site, page, options);
  }
  const title = page.hasTitleHeading ? "" : `<h1>${escape(page.title)}</h1>`;
  const description = page.description ? `<p class="lead">${escape(page.description)}</p>` : "";
  const byline = `<p class="byline">${icon(page.icon)}<span>${escape(page.byline)}</span><span aria-hidden="true">·</span>${time(page.updated)}</p>`;
  return renderDocument(site, options, {
    title: page.title,
    description: page.description || site.config.description,
    page,
    article: title + description + byline + page.html + resourcesSection(site, page),
  });
}

export function renderNotFound(site: Site, options: RenderOptions) {
  const article = `<div class="not-found"><p class="not-found-code">404</p><h1>Page not found</h1><p>This page does not exist or has moved. Try the search, or go back to the <a href="${escape(site.config.base)}">home page</a>.</p></div>`;
  return renderDocument(site, options, { title: "Page not found", description: site.config.description, article });
}
