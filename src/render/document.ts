import { markdownHref } from "../output/ai.ts";
import { icon } from "../icons/icons.ts";
import type { Page, Site } from "../site/site.ts";
import { brand } from "./brand.tsx";
import { footer, headerLinks, headTags, tagList, themePicker } from "./document-parts.tsx";
import { categoryTabs, pager, sidebar, tableOfContents } from "./page-navigation.tsx";

export interface RenderOptions {
  dev: boolean;
  server: boolean;
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
  const head = String(headTags(site, options, { fullTitle, description: parts.description, page, home: parts.home }));

  const pagerHtml = page ? String(pager(site, page)) : "";
  const footerHtml = String(footer(site, parts.home ? undefined : page));
  const tocHtml = page ? String(tableOfContents(page)) : "";
  const tagsHtml = String(tagList(page?.tags ?? []));
  const tabsHtml = String(categoryTabs(site, page));
  const slots: Record<string, string> = {
    title: Bun.escapeHTML(fullTitle),
    brand: String(brand(site)),
    links: String(headerLinks(config)),
    sidebar: String(sidebar(site, page)),
    "theme-picker": config.theme.picker ? String(themePicker(site)) : "",
    tabs: tabsHtml,
    breadcrumb: Bun.escapeHTML([page?.category?.title, ...(page?.trail ?? [])].filter(Boolean).join(" › ")),
    section: Bun.escapeHTML(page?.category?.title ?? ""),
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
    picker: config.theme.picker,
    tabs: tabsHtml !== "",
  };

  const html = new HTMLRewriter()
    .on("html", {
      /**
       * Marks the page when the site turns the theme picker off, so the head
       * script ignores a preset the reader picked earlier.
       */
      element(element) {
        if (!config.theme.picker) {
          element.setAttribute("data-no-presets", "");
        }
      },
    })
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
       * keeps the template's own content; an element `data-if` removed stays out.
       */
      element(element) {
        const content = slots[element.getAttribute("data-slot")!];
        element.removeAttribute("data-slot");
        if (content !== undefined && !element.removed) {
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

  return new HTMLRewriter()
    .on('a[href^="http://"], a[href^="https://"], a[href^="//"]', {
      /**
       * Opens external links in a new tab. Runs as a second pass because the
       * first one does not see the HTML it inserts into slots.
       */
      element(element) {
        if (!element.hasAttribute("target")) {
          element.setAttribute("target", "_blank");
        }
        if (!element.hasAttribute("rel")) {
          element.setAttribute("rel", "noopener");
        }
      },
    })
    .transform(html);
}
