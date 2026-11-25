import { renderDocument, time, type RenderOptions } from "./document.ts";
import { renderHome } from "./home.ts";
import { themeDeclarations } from "../theme/theme-declarations.ts";
import { icon } from "../icons/icons.ts";
import { renderCode } from "../markdown/code-blocks.ts";
import { formatSize, resourceIcon } from "../site/resources.ts";
import type { DiataxisKind } from "../site/folder-settings.ts";
import { resourceUrl, type Page, type Site } from "../site/site.ts";

const escape = Bun.escapeHTML;

const galleryPlaceholder = /<div data-nodeps="theme-gallery"><\/div>/g;

/**
 * Renders the theme gallery that replaces the theme-gallery placeholder: one
 * card per theme, scoped to its own colors, with a light and a dark mock page,
 * an Apply button and the config snippet to copy.
 */
function themeGallery(site: Site) {
  const sample = (mode: "light" | "dark") =>
    `<div class="sample sample-${mode}" aria-hidden="true"><div class="sample-bar"><span class="sample-dot"></span><span class="sample-line"></span></div><div class="sample-body"><div class="sample-side"><span></span><span class="active"></span><span></span></div><div class="sample-main"><span class="sample-title"></span><span class="sample-line"></span><span class="sample-line short"></span><span class="sample-code"></span><span class="sample-button"></span></div></div></div>`;
  const cards = site.config.theme.choices.map((preset) => {
    const declarations = themeDeclarations(preset);
    const isSiteDefault = preset.name === site.config.theme.name;
    const config = `theme:\n  name: ${preset.name}`;
    return `<article class="theme-card" data-theme-scope style="${escape(declarations)}">
<div class="theme-samples">${sample("light")}${sample("dark")}</div>
<div class="theme-card-body"><strong>${escape(preset.title)}</strong>${isSiteDefault ? `<span class="theme-card-badge">Site default</span>` : ""}<p>${escape(preset.description)}</p>
<div class="theme-card-actions"><button type="button" class="pill-button primary" data-preset="${preset.name}" data-style="${isSiteDefault ? "" : escape(declarations)}">${icon("paintbrush")}Apply</button><button type="button" class="pill-button" data-copy-text="${escape(config)}">${icon("copy")}${icon("check")}Copy config</button></div></div>
</article>`;
  });
  return `<div class="theme-gallery">${cards.join("")}</div>`;
}

const diataxisPages: Record<DiataxisKind, { label: string; url: string; icon: string }> = {
  tutorials: { label: "Tutorial", url: "https://diataxis.fr/tutorials/", icon: "graduation-cap" },
  "how-to": { label: "How-to guide", url: "https://diataxis.fr/how-to-guides/", icon: "wrench" },
  reference: { label: "Reference", url: "https://diataxis.fr/reference/", icon: "library" },
  explanation: { label: "Explanation", url: "https://diataxis.fr/explanation/", icon: "lightbulb" },
};

/**
 * Renders the badge naming the page's Diataxis kind, linking to its definition
 * on diataxis.fr. Empty when the page has no kind or the site turns badges off.
 */
function diataxisBadge(site: Site, page: Page) {
  const kind = page.diataxis;
  if (!kind || !site.config.diataxis.badge) {
    return "";
  }
  const { label, url, icon: kindIcon } = diataxisPages[kind];
  return `<a class="diataxis-badge" data-diataxis="${kind}" href="${url}" data-tooltip="What makes a ${label.toLowerCase()}, on diataxis.fr">${icon(kindIcon)}${label}</a>`;
}

/**
 * Renders the Resources section appended to a page: one card per attached
 * file with download and open actions and, for code, a collapsible preview.
 * A skill offers its archive and its SKILL.md instead of the raw file.
 */
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

/**
 * Wraps the first `<h1>` in a title block with the badge above it. Returns the
 * HTML untouched when there is no badge.
 */
function withTitleBadge(html: string, badge: string) {
  if (!badge) {
    return html;
  }
  return html.replace(
    /<h1(?:\s[^>]*)?>[\s\S]*?<\/h1>/,
    (heading) => `<div class="page-title">${badge}${heading}</div>`,
  );
}

/**
 * Renders a page to a full HTML document, or the homepage when the site has a
 * home config and this is the root page. Adds a title when the Markdown has
 * none, the lead, byline, Diataxis badge, theme gallery and resources.
 */
export function renderPage(site: Site, page: Page, options: RenderOptions) {
  if (site.config.home && page.url === "/") {
    return renderHome(site, page, options);
  }
  const title = page.hasTitleHeading ? "" : `<h1>${escape(page.title)}</h1>`;
  const description = page.description ? `<p class="lead">${escape(page.description)}</p>` : "";
  const author = page.byline ? `<span>${escape(page.byline)}</span><span aria-hidden="true">·</span>` : "";
  const byline = `<p class="byline">${page.icon ? icon(page.icon) : ""}${author}${time(page.updated)}</p>`;
  return renderDocument(site, options, {
    title: page.title,
    description: page.description || site.config.description,
    page,
    article:
      withTitleBadge(
        page.hasTitleHeading
          ? page.html.replace(/<\/h1>/, () => `</h1>${description}${byline}`)
          : title + description + byline + page.html,
        diataxisBadge(site, page),
      ).replace(galleryPlaceholder, () => themeGallery(site)) + resourcesSection(site, page),
  });
}

/**
 * Renders the 404 document, outside any page so it gets no sidebar selection,
 * pager or edit link.
 */
export function renderNotFound(site: Site, options: RenderOptions) {
  const article = `<div class="not-found"><p class="not-found-code">404</p><h1>Page not found</h1><p>This page does not exist or has moved. Try the search, or go back to the <a href="${escape(site.config.base)}">home page</a>.</p></div>`;
  return renderDocument(site, options, { title: "Page not found", description: site.config.description, article });
}
