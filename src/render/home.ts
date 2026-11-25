import { pageHref } from "../output/ai.ts";
import { renderDocument, time, type RenderOptions } from "./document.ts";
import { icon } from "../icons/icons.ts";
import type { DiataxisKind } from "../site/folder-settings.ts";
import type { Category } from "../site/navigation.ts";
import type { Page, Site } from "../site/site.ts";

const escape = Bun.escapeHTML;

const diataxisLabels: Record<DiataxisKind, string> = {
  tutorials: "Learning-oriented",
  "how-to": "Task-oriented",
  reference: "Information-oriented",
  explanation: "Understanding-oriented",
};

const compassOrder: DiataxisKind[] = ["tutorials", "how-to", "explanation", "reference"];

/**
 * Renders a homepage card for a category: its heading links to the first page,
 * then the description and the most recently updated pages. The home page
 * itself is left out of both.
 */
function categoryCard(site: Site, category: Category, home: Page) {
  const latest = category.pages
    .filter((page) => page !== home)
    .sort((left, right) => right.updated.getTime() - left.updated.getTime())
    .slice(0, site.config.home!.latest)
    .map(
      (page) =>
        `<li><a href="${escape(pageHref(site, page))}">${page.icon ? icon(page.icon) : ""}<span>${escape(page.title)}</span>${time(page.updated)}</a></li>`,
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

/**
 * Turns a homepage action URL into an href. Absolute URLs and anchors pass
 * through; a path matching a page source links to that page, anything else
 * resolves against the site base.
 */
function resolveLink(site: Site, url: string) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(url)) {
    return url;
  }
  const path = url.replace(/^\.?\//, "");
  const page = site.pages.find((candidate) => candidate.source === path);
  return page ? pageHref(site, page) : site.config.base + path;
}

/**
 * Renders the homepage: the hero with its actions, the Diataxis categories laid
 * out as a compass in a fixed order, the remaining categories as a grid, then
 * the home page's own Markdown content when it has any.
 */
export function renderHome(site: Site, page: Page, options: RenderOptions) {
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
