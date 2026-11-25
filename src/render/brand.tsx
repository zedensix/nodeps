/** @jsx h */
/** @jsxFrag Fragment */
import { icon } from "../icons/icons.ts";
import type { Site } from "../site/site.ts";
import { Fragment, h } from "./jsx.ts";

/**
 * Resolves a path inside the source directory against the site base,
 * stripping a leading `./` or `/`.
 */
function sourceUrl(site: Site, path: string) {
  return site.config.base + path.replace(/^\.?\//, "");
}

/**
 * Resolves the favicon: `favicon`, then `logo`, against the site base, or the
 * book icon in the accent color as an inline SVG when neither is set.
 */
export function faviconUrl(site: Site) {
  const favicon = site.config.favicon ?? site.config.logo;
  if (favicon) {
    return sourceUrl(site, favicon);
  }
  return `data:image/svg+xml,${encodeURIComponent(icon("book-open").replaceAll("currentColor", site.config.theme.accent))}`;
}

/**
 * Renders the header brand: the logo when there is one, as a light and a dark
 * image when `logo_dark` is set, then the site title. With `logo_only` the
 * title is left out and becomes the images' alt text, so the link keeps a name.
 */
export function brand(site: Site) {
  const { logo, logoDark, logoOnly, title } = site.config;
  const alt = logoOnly ? title : "";
  return (
    <>
      {logo && !logoDark && <img class="brand-logo" src={sourceUrl(site, logo)} alt={alt} />}
      {logo && logoDark && (
        <>
          <img class="brand-logo brand-logo-light" src={sourceUrl(site, logo)} alt={alt} />
          <img class="brand-logo brand-logo-dark" src={sourceUrl(site, logoDark)} alt={alt} />
        </>
      )}
      {!logoOnly && <span>{title}</span>}
    </>
  );
}
