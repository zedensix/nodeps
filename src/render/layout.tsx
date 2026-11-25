/** @jsx h */
/** @jsxFrag Fragment */
import { renderDocument, type RenderOptions } from "./document.ts";
import { time } from "./document-parts.tsx";
import { renderHome } from "./home.tsx";
import { themeDeclarations } from "../theme/theme-declarations.ts";
import type { DiataxisKind } from "../site/folder-settings.ts";
import type { Page, Site } from "../site/site.ts";
import { Fragment, h, Icon } from "./jsx.ts";
import { resourcesSection } from "./resources.tsx";

const galleryPlaceholder = /<div data-nodeps="theme-gallery"><\/div>/g;

/**
 * Renders a mock page in a theme's light or dark colors, for the gallery.
 */
function ThemeSample(props: { mode: "light" | "dark" }) {
  return (
    <div class={`sample sample-${props.mode}`} aria-hidden="true">
      <div class="sample-bar">
        <span class="sample-dot"></span>
        <span class="sample-line"></span>
      </div>
      <div class="sample-body">
        <div class="sample-side">
          <span></span>
          <span class="active"></span>
          <span></span>
        </div>
        <div class="sample-main">
          <span class="sample-title"></span>
          <span class="sample-line"></span>
          <span class="sample-line short"></span>
          <span class="sample-code"></span>
          <span class="sample-button"></span>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders the theme gallery that replaces the theme-gallery placeholder: one
 * card per theme, scoped to its own colors, with a light and a dark mock page,
 * an Apply button and the config snippet to copy.
 */
function themeGallery(site: Site) {
  return (
    <div class="theme-gallery">
      {site.config.theme.choices.map((preset) => {
        const declarations = themeDeclarations(preset);
        const isSiteDefault = preset.name === site.config.theme.name;
        return (
          <article class="theme-card" data-theme-scope style={declarations}>
            <div class="theme-samples">
              <ThemeSample mode="light" />
              <ThemeSample mode="dark" />
            </div>
            <div class="theme-card-body">
              <strong>{preset.title}</strong>
              {isSiteDefault && <span class="theme-card-badge">Site default</span>}
              <p>{preset.description}</p>
              <div class="theme-card-actions">
                <button
                  type="button"
                  class="pill-button primary"
                  data-preset={preset.name}
                  data-style={isSiteDefault ? "" : declarations}
                >
                  <Icon name="paintbrush" />
                  Apply
                </button>
                <button type="button" class="pill-button" data-copy-text={`theme:\n  name: ${preset.name}`}>
                  <Icon name="copy" />
                  <Icon name="check" />
                  Copy config
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
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
  const { label, url, icon } = diataxisPages[kind];
  return String(
    <a
      class="diataxis-badge"
      data-diataxis={kind}
      href={url}
      data-tooltip={`What makes a ${label.toLowerCase()}, on diataxis.fr`}
    >
      <Icon name={icon} />
      {label}
    </a>,
  );
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
  const intro = String(
    <>
      {page.description && <p class="lead">{page.description}</p>}
      <p class="byline">
        {page.icon && <Icon name={page.icon} />}
        {page.byline && (
          <>
            <span>{page.byline}</span>
            <span aria-hidden="true">·</span>
          </>
        )}
        {time(page.updated)}
      </p>
    </>,
  );
  const body = page.hasTitleHeading
    ? page.html.replace(/<\/h1>/, () => `</h1>${intro}`)
    : String(<h1>{page.title}</h1>) + intro + page.html;
  return renderDocument(site, options, {
    title: page.title,
    description: page.description || site.config.description,
    page,
    article:
      withTitleBadge(body, diataxisBadge(site, page)).replace(galleryPlaceholder, () => String(themeGallery(site))) +
      resourcesSection(site, page),
  });
}

/**
 * Renders the 404 document, outside any page so it gets no sidebar selection,
 * pager or edit link.
 */
export function renderNotFound(site: Site, options: RenderOptions) {
  const article = (
    <div class="not-found">
      <p class="not-found-code">404</p>
      <h1>Page not found</h1>
      <p>
        This page does not exist or has moved. Try the search, or go back to the{" "}
        <a href={site.config.base}>home page</a>.
      </p>
    </div>
  );
  return renderDocument(site, options, {
    title: "Page not found",
    description: site.config.description,
    article: String(article),
  });
}
