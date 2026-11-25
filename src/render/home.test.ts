import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../config/config.ts";
import { loadSite, type Site } from "../site/site.ts";
import { renderPage } from "./layout.tsx";

// Loading a site downloads the icon sets on a fresh checkout, which takes longer than the default 5 s.
const siteTimeout = 60_000;
const options = { dev: false, server: false };

const pages = {
  "docs/index.md": "# Welcome\n\nBody text.\n",
  "docs/contributing.md": "# Contribute\n",
  "docs/standards/_folder.yaml": "diataxis: explanation\n",
  "docs/standards/learn.md": "---\ndiataxis: tutorial\n---\n# Learn\n",
  "docs/standards/deploy.howto.md": "# Deploy\n",
  "docs/standards/api.md": "---\ndiataxis: reference\n---\n# API\n",
  "docs/standards/why.md": "# Why\n",
  "docs/standards/odd.md": "---\ndiataxis: guide\n---\n# Odd\n",
  "docs/brand/icon.png": "png",
};

/**
 * Writes a throwaway docs project with the given docs.yaml lines after a
 * homepage config, and loads it.
 */
async function site(extraConfig = "") {
  const root = mkdtempSync(join(tmpdir(), "nodeps-home-"));
  for (const [path, content] of Object.entries(pages)) {
    await Bun.write(join(root, path), content);
  }
  await Bun.write(join(root, "docs.yaml"), `title: Acme\nhome:\n  headline: Hello\n${extraConfig}`);
  return loadSite(await loadConfig(join(root, "docs.yaml")));
}

/**
 * Renders the page built from `source`.
 */
const render = (loaded: Site, source: string) =>
  renderPage(
    loaded,
    loaded.pages.find((page) => page.source === source)!,
    options,
  );

/**
 * Lists the homepage cards as their Diataxis kind (or "none"), title and the
 * page links under "Latest".
 */
function cards(html: string) {
  return html
    .split('<section class="category-card"')
    .slice(1)
    .map((card) => card.split("</section>")[0]!)
    .map((card) => ({
      kind: /^ data-diataxis="([^"]+)"/.exec(card)?.[1] ?? "none",
      title: /<strong>([^<]+)<\/strong>/.exec(card)![1],
      latest: [...card.split('class="card-latest"')[1]!.matchAll(/href="([^"]+)"/g)].map((match) => match[1]).sort(),
    }));
}

test(
  "a page kind comes from its frontmatter, then its file name, then the nearest folder",
  async () => {
    const loaded = await site();
    const badge = (source: string) =>
      /class="diataxis-badge" data-diataxis="([^"]+)"/.exec(render(loaded, source))?.[1];
    expect(badge("standards/learn.md")).toBe("tutorials");
    expect(badge("standards/deploy.howto.md")).toBe("how-to");
    expect(badge("standards/api.md")).toBe("reference");
    expect(badge("standards/why.md")).toBe("explanation");
    expect(badge("standards/odd.md")).toBe("explanation");
    expect(loaded.warnings).toContain(
      'standards/odd.md: frontmatter "diataxis" is not tutorials, how-to, reference or explanation: "guide", so it was ignored',
    );
  },
  siteTimeout,
);

test(
  "the compass lists each page under its own kind and the root section gets no card",
  async () => {
    const home = render(await site(), "index.md");
    expect(cards(home)).toEqual([
      { kind: "tutorials", title: "Tutorials", latest: ["/standards/learn/"] },
      { kind: "how-to", title: "How-to guides", latest: ["/standards/deploy.howto/"] },
      { kind: "explanation", title: "Standards", latest: ["/standards/odd/", "/standards/why/"] },
      { kind: "reference", title: "Reference", latest: ["/standards/api/"] },
    ]);
  },
  siteTimeout,
);

test(
  "with nav, folder kinds still reach the badge and the compass",
  async () => {
    const loaded = await site("nav:\n  - index.md\n  - contributing.md\n  - Standards:\n      - standards/why.md\n");
    expect(render(loaded, "standards/why.md")).toContain('data-diataxis="explanation"');
    expect(cards(render(loaded, "index.md"))).toEqual([
      { kind: "explanation", title: "Standards", latest: ["/standards/why/"] },
    ]);
  },
  siteTimeout,
);

test(
  "the hero replaces the home page title and the rest of its body follows",
  async () => {
    const home = render(await site(), "index.md");
    expect(home.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(home).toContain("<h1>Hello</h1>");
    expect(home).toContain("<p>Body text.</p>");
  },
  siteTimeout,
);

test(
  "without favicon or logo, pages link a default icon so browsers do not ask for /favicon.ico",
  async () => {
    expect(render(await site(), "index.md")).toContain('<link rel="icon" href="data:image/svg+xml,');
    expect(render(await site("favicon: brand/icon.png\n"), "index.md")).toContain(
      '<link rel="icon" href="/brand/icon.png">',
    );
  },
  siteTimeout,
);

test(
  "the home page keeps out the pager its template hides",
  async () => {
    expect(render(await site(), "index.md")).not.toContain('class="pager-next"');
  },
  siteTimeout,
);

test(
  "a folder holding only its index.md is a plain sidebar link, with no chevron to open",
  async () => {
    const root = mkdtempSync(join(tmpdir(), "nodeps-sidebar-"));
    for (const [path, content] of Object.entries({
      "docs/guides/index.md": "# Guides\n",
      "docs/guides/install.md": "# Install\n",
      "docs/guides/faq/index.md": "# FAQ\n",
      "docs/guides/deploy/index.md": "# Deploy\n",
      "docs/guides/deploy/docker.md": "# Docker\n",
    })) {
      await Bun.write(join(root, path), content);
    }
    await Bun.write(join(root, "docs.yaml"), "title: Acme\n");
    const loaded = await loadSite(await loadConfig(join(root, "docs.yaml")));
    const html = render(loaded, "guides/install.md");
    const tree = /<ul class="tree"[\s\S]*?<\/nav>/.exec(html)![0];
    expect(tree.match(/<details/g)).toHaveLength(1);
    expect(tree).toContain('href="/guides/faq/"');
    expect(tree).not.toMatch(/<details[^>]*><summary><a href="\/guides\/faq\/"/);
  },
  siteTimeout,
);
