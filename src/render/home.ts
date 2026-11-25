import { pageHref } from "../output/ai.ts";
import { renderDocument, time, type RenderOptions } from "./document.ts";
import { icon } from "../icons/icons.ts";
import type { DiataxisKind } from "../site/folder-settings.ts";
import type { Page, Site } from "../site/site.ts";

const escape = Bun.escapeHTML;

const diataxisLabels: Record<DiataxisKind, string> = {
  tutorials: "Learning-oriented",
  "how-to": "Task-oriented",
  reference: "Information-oriented",
  explanation: "Understanding-oriented",
};

const compassOrder: DiataxisKind[] = ["tutorials", "how-to", "explanation", "reference"];

const compassKinds: Record<DiataxisKind, { title: string; icon: string }> = {
  tutorials: { title: "Tutorials", icon: "graduation-cap" },
  "how-to": { title: "How-to guides", icon: "wrench" },
  reference: { title: "Reference", icon: "library" },
  explanation: { title: "Explanation", icon: "lightbulb" },
};

interface Card {
  title: string;
  icon?: string;
  description?: string;
  diataxis?: DiataxisKind;
  pages: Page[];
}

/**
 * Renders a homepage card: its heading links to the first page, then the
 * description and the most recently updated pages, each listed once. The home
 * page itself is left out of both; a card left with no page renders nothing.
 */
function homeCard(site: Site, card: Card, home: Page) {
  const pages = [...new Set(card.pages)].filter((page) => page !== home);
  if (pages.length === 0) {
    return "";
  }
  const latest = pages
    .toSorted((left, right) => right.updated.getTime() - left.updated.getTime())
    .slice(0, site.config.home!.latest)
    .map(
      (page) =>
        `<li><a href="${escape(pageHref(site, page))}">${page.icon ? icon(page.icon) : ""}<span>${escape(page.title)}</span>${time(page.updated)}</a></li>`,
    )
    .join("");
  const kind = card.diataxis ? `<span class="card-kind">${diataxisLabels[card.diataxis]}</span>` : "";
  return `<section class="category-card"${card.diataxis ? ` data-diataxis="${card.diataxis}"` : ""}>
<a class="card-heading" href="${escape(pageHref(site, pages[0]!))}"><span class="card-icon">${icon(card.icon ?? "book-open")}</span><span><strong>${escape(card.title)}</strong>${kind}</span>${icon("arrow-right")}</a>
${card.description ? `<p class="card-description">${escape(card.description)}</p>` : ""}
${latest ? `<p class="card-latest">Latest</p><ul>${latest}</ul>` : ""}
</section>`;
}

/**
 * Builds one compass card per Diataxis kind that has pages, listing every
 * navigation page of that kind whatever its section. A kind declared by a
 * single section takes that section's title, icon and description.
 */
function compassCards(site: Site): Card[] {
  return compassOrder.flatMap((kind) => {
    const pages = site.navPages.filter((page) => page.diataxis === kind);
    const sections = site.categories.filter((category) => category.diataxis === kind);
    const section = sections.length === 1 ? sections[0] : undefined;
    return pages.length === 0
      ? []
      : [
          {
            title: section?.title ?? compassKinds[kind].title,
            icon: section?.icon ?? compassKinds[kind].icon,
            description: section?.description,
            diataxis: kind,
            pages,
          },
        ];
  });
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
 * Renders the homepage: the hero with its actions, the Diataxis compass with
 * each page under its own kind, a card for every other section except the
 * root one, then the home page's Markdown without its title heading, which
 * the hero replaces.
 */
export function renderHome(site: Site, page: Page, options: RenderOptions) {
  const home = site.config.home!;
  const actions = home.actions
    .map(
      (action, index) =>
        `<a class="button${index === 0 ? " primary" : ""}" href="${escape(resolveLink(site, action.url))}">${escape(action.label)}${index === 0 ? icon("arrow-right") : ""}</a>`,
    )
    .join("");
  const compass = compassCards(site)
    .map((card) => homeCard(site, card, page))
    .join("");
  const others = site.categories
    .filter((category) => category.folder !== "" && !category.diataxis)
    .map((category) => homeCard(site, category, page))
    .join("");
  const compassHtml = compass
    ? `<section class="compass" aria-label="Documentation by purpose"><div class="compass-axes" aria-hidden="true"><span>Practical</span><span>Theoretical</span><span>Study</span><span>Work</span></div><div class="compass-grid">${compass}</div></section>`
    : "";
  const othersHtml = others ? `<section class="category-grid">${others}</section>` : "";
  const body = page.hasTitleHeading ? page.html.replace(/<h1[\s>][\s\S]*?<\/h1>/, "") : page.html;
  const article = `<section class="home-hero">
<h1>${escape(home.headline)}</h1>
${home.tagline ? `<p class="home-tagline">${escape(home.tagline)}</p>` : ""}
${actions ? `<div class="home-actions">${actions}</div>` : ""}
</section>
${compassHtml}${othersHtml}
${body.trim() ? `<div class="home-content">${body}</div>` : ""}`;
  return renderDocument(site, options, {
    title: page.title,
    description: page.description || site.config.description,
    page,
    home: true,
    article,
  });
}
