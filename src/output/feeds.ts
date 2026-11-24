import type { Site } from "../site/site.ts";
import { pageHref } from "./ai.ts";

const escape = Bun.escapeHTML;
const feedSize = 20;

/**
 * Tells crawlers they may index everything, and where the sitemap is when the
 * site knows its public origin.
 */
export function robots(site: Site, origin: string) {
  const sitemap = origin ? `\nSitemap: ${origin}${site.config.base}sitemap.xml` : "";
  return `User-agent: *\nAllow: /\n${sitemap}\n`;
}

/**
 * Lists every page with its absolute URL and last update, in the sitemaps.org
 * format search engines read.
 */
export function sitemap(site: Site, origin: string) {
  const urls = site.pages.map(
    (page) =>
      `<url><loc>${escape(origin + pageHref(site, page))}</loc><lastmod>${page.updated.toISOString().slice(0, 10)}</lastmod></url>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

/**
 * RSS 2.0 feed of the most recently updated pages, newest first, so readers
 * can follow changes to the docs. Tags become item categories.
 */
export function feed(site: Site, origin: string) {
  const config = site.config;
  const pages = site.pages.toSorted((left, right) => right.updated.getTime() - left.updated.getTime());
  const items = pages.slice(0, feedSize).map((page) => {
    const link = escape(origin + pageHref(site, page));
    const categories = page.tags.map((tag) => `<category>${escape(tag)}</category>`).join("");
    return `<item><title>${escape(page.title)}</title><link>${link}</link><guid>${link}</guid><pubDate>${page.updated.toUTCString()}</pubDate><description>${escape(page.description)}</description>${categories}</item>`;
  });
  const updated = (pages[0]?.updated ?? new Date(0)).toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>${escape(config.title)}</title>
<link>${escape(origin + config.base)}</link>
<description>${escape(config.description || config.title)}</description>
<atom:link href="${escape(`${origin}${config.base}feed.xml`)}" rel="self" type="application/rss+xml"/>
<lastBuildDate>${updated}</lastBuildDate>
${items.join("\n")}
</channel></rss>
`;
}
