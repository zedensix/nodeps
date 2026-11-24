import { markdownHref, pageHref } from "../output/ai.ts";
import type { Theme } from "../config/config.ts";
import { editorSourcePath } from "../editor/editor.ts";
import { editUrl, gitProviders } from "../config/repository.ts";
import { themeDeclarations } from "../theme/theme-declarations.ts";
import { icon, normalizeIcon } from "../icons/icons.ts";
import { categoryTabs, pager, sidebar, tableOfContents } from "./page-navigation.ts";
import type { Page, Site } from "../site/site.ts";

export interface RenderOptions {
  dev: boolean;
  server: boolean;
}

const escape = Bun.escapeHTML;

/**
 * Inlines the site theme as custom properties on `:root`, so pages paint with
 * the right colors before any stylesheet or script loads.
 */
function themeStyle(theme: Theme) {
  return `<style>:root{${themeDeclarations(theme)}}</style>`;
}

/**
 * Renders the header theme menu entries, one per theme with a swatch. The
 * site default carries an empty `data-style` so choosing it clears the override.
 */
function themePicker(site: Site) {
  const items = site.config.theme.choices
    .map((preset) => {
      const isSiteDefault = preset.name === site.config.theme.name;
      const label = isSiteDefault ? `${escape(preset.title)} <small>site default</small>` : escape(preset.title);
      const style = isSiteDefault ? "" : themeDeclarations(preset);
      return `<button type="button" class="menu-item theme-option" data-preset="${preset.name}" data-style="${escape(style)}" role="menuitemradio"><span class="swatch" style="${escape(themeDeclarations(preset))}" data-theme-scope></span><span><strong>${label}</strong><small>${escape(preset.description)}</small></span>${icon("check")}</button>`;
    })
    .join("");
  return items;
}

/**
 * Inline dev script that reloads on a message from the reload socket. When the
 * socket closes (server restart), it polls the page and reloads once the server
 * answers again, or reconnects.
 */
const liveReload = (base: string) =>
  `<script>(()=>{const connect=()=>{const socket=new WebSocket(location.origin.replace(/^http/,"ws")+${JSON.stringify(base + "__reload")});socket.onmessage=()=>location.reload();socket.onclose=()=>setTimeout(()=>fetch(location.href).then(()=>location.reload(),connect),400)};connect()})()</script>`;

/**
 * Resolves the configured logo against the site base, stripping a leading
 * `./` or `/`. Undefined when no logo is set.
 */
function logoUrl(site: Site) {
  return site.config.logo ? site.config.base + site.config.logo.replace(/^\.?\//, "") : undefined;
}

/**
 * Renders the header brand: the logo when there is one, then the site title.
 */
function brand(site: Site) {
  const logo = logoUrl(site);
  return `${logo ? `<img class="brand-logo" src="${escape(logo)}" alt="">` : ""}<span>${escape(site.config.title)}</span>`;
}

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

/**
 * Renders a `<time>` element with a medium English date, formatted in UTC so
 * the output does not depend on the build machine's time zone.
 */
export function time(date: Date) {
  return `<time datetime="${date.toISOString()}">${dateFormat.format(date)}</time>`;
}

/**
 * Embeds the settings the in-browser editor reads for this page as JSON.
 * Server-only features (OAuth, server rendering) are null in a static export,
 * and `<` is escaped so the JSON cannot close the script tag.
 */
function editorSettings(site: Site, page: Page, options: RenderOptions) {
  const { config } = site;
  const settings = {
    source: page.source,
    title: page.title,
    payload: config.base + editorSourcePath(page).slice(1),
    editUrl: config.repository ? editUrl(config.repository, page.source) : null,
    provider: config.repository ? gitProviders[config.repository.provider] : null,
    oauth: options.server && config.editor.oauth !== undefined,
    render: options.server ? `${config.base}_editor/render` : null,
    base: config.base,
  };
  return `<script type="application/json" id="nodeps-editor">${JSON.stringify(settings).replaceAll("<", "\\u003c")}</script>`;
}

/**
 * Renders the footer: an edit link (the built-in editor wins over the
 * repository's edit page), the footer text and the social links. Without a
 * page there is no edit link.
 */
function footer(site: Site, page?: Page) {
  const repository = site.config.repository;
  let edit = "";
  if (page && site.config.editor.enabled) {
    edit = `<a class="edit-link" href="#edit" data-edit-page>${icon("square-pen")}Edit this page</a>`;
  } else if (page && repository?.edit) {
    edit = `<a class="edit-link" href="${escape(editUrl(repository, page.source))}">${icon("square-pen")}Edit this page on ${gitProviders[repository.provider]}</a>`;
  }
  const social = site.config.social
    .map(
      (entry) =>
        `<a href="${escape(entry.url)}" target="_blank" rel="noopener" aria-label="${escape(entry.label)}" data-tooltip="${escape(entry.label)}">${icon(normalizeIcon(entry.icon))}</a>`,
    )
    .join("");
  const text =
    (site.config.footer ? `<p>${escape(site.config.footer)}</p>` : "") +
    (social ? `<nav class="social-links" aria-label="Social links">${social}</nav>` : "");
  return edit ? `<div class="page-meta">${edit}</div>${text}` : text;
}

interface DocumentParts {
  title: string;
  description: string;
  page?: Page;
  home?: boolean;
  article: string;
}

/**
 * Fills the theme template around an article with HTMLRewriter: appends the
 * head tags, fills every `data-slot`, drops `data-if` elements whose flag is
 * off, and swaps `<i data-icon>` placeholders for inline SVG. The homepage and
 * pages hiding navigation, footer or toc turn the matching flags off.
 */
export function renderDocument(site: Site, options: RenderOptions, parts: DocumentParts) {
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
    page && !parts.home && config.editor.enabled ? editorSettings(site, page, options) : "",
  ].join("");

  const pagerHtml = page ? pager(site, page) : "";
  const footerHtml = footer(site, parts.home ? undefined : page);
  const tocHtml = page ? tableOfContents(page) : "";
  const tagsHtml = (page?.tags ?? [])
    .map((tag) => `<li><button type="button" class="tag" data-search="#${escape(tag)}">#${escape(tag)}</button></li>`)
    .join("");
  const tabsHtml = categoryTabs(site, page);
  const slots: Record<string, string> = {
    title: escape(fullTitle),
    brand: brand(site),
    links:
      config.links.map((link) => `<a href="${escape(link.url)}">${escape(link.label)}</a>`).join("") +
      (config.repository
        ? `<a class="repository-link" href="${escape(config.repository.url)}" title="Source on ${gitProviders[config.repository.provider]}">${icon(`simple-${config.repository.provider}`)}<span>${escape(config.repository.label)}</span></a>`
        : ""),
    sidebar: sidebar(site, page),
    "theme-picker": themePicker(site),
    tabs: tabsHtml,
    breadcrumb: escape([page?.category?.title, ...(page?.trail ?? [])].filter(Boolean).join(" › ")),
    article: parts.article,
    pager: pagerHtml,
    footer: footerHtml,
    toc: tocHtml,
    tags: tagsHtml,
  };
  const flags: Record<string, boolean> = {
    page: page !== undefined && !parts.home,
    sidebar: !parts.home && !page?.hide.includes("navigation"),
    mcp: options.server,
    pager: pagerHtml !== "" && !parts.home && !page?.hide.includes("footer"),
    footer: footerHtml !== "",
    toc: (tocHtml !== "" || tagsHtml !== "") && !parts.home && !page?.hide.includes("toc"),
    headings: tocHtml !== "",
    tags: tagsHtml !== "",
    editor: config.editor.enabled,
    reader: config.readerMode,
    tabs: tabsHtml !== "",
  };

  return new HTMLRewriter()
    .on("head", {
      /**
       * Appends the meta tags, theme style and scripts built above to `<head>`.
       */
      element(element) {
        element.append(head, { html: true });
      },
    })
    .on("[data-if]", {
      /**
       * Keeps the element (without its marker) when its flag is on, removes it
       * otherwise. Unknown flags count as off.
       */
      element(element) {
        if (flags[element.getAttribute("data-if")!]) {
          element.removeAttribute("data-if");
        } else {
          element.remove();
        }
      },
    })
    .on("[data-slot]", {
      /**
       * Replaces the element's content with its slot's HTML. An unknown slot
       * keeps the template's own content.
       */
      element(element) {
        const content = slots[element.getAttribute("data-slot")!];
        element.removeAttribute("data-slot");
        if (content !== undefined) {
          element.setInnerContent(content, { html: true });
        }
      },
    })
    .on("i[data-icon]", {
      /**
       * Replaces the template's icon placeholder with the inline SVG.
       */
      element(element) {
        element.replace(icon(element.getAttribute("data-icon")!), { html: true });
      },
    })
    .on("a.brand", {
      /**
       * Points the brand link at the site base, which the template cannot know.
       */
      element(element) {
        element.setAttribute("href", config.base);
      },
    })
    .on('a[data-action="markdown"]', {
      /**
       * Points the "view as Markdown" action at this page's `.md` version.
       */
      element(element) {
        if (page) {
          element.setAttribute("href", markdownHref(site, page));
        }
      },
    })
    .on('a[data-action="llms"]', {
      /**
       * Points the llms.txt action at the file under the site base.
       */
      element(element) {
        element.setAttribute("href", config.base + "llms.txt");
      },
    })
    .transform(site.template);
}
