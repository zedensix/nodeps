import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../config/config.ts";
import { loadSite } from "../site/site.ts";
import { renderPage } from "./layout.tsx";

// Loading a site downloads the icon sets on a fresh checkout, which takes longer than the default 5 s.
const siteTimeout = 60_000;

/**
 * Writes a one-page docs project with brand images and the given docs.yaml
 * lines, loads it and returns the site with its rendered page.
 */
async function site(config: string) {
  const root = mkdtempSync(join(tmpdir(), "nodeps-brand-"));
  const files = {
    "docs/index.md": "# Home\n",
    "docs/brand/square.png": "png",
    "docs/brand/wordmark.png": "png",
    "docs/brand/wordmark-dark.png": "png",
    "docs/brand/notes.txt": "not an image",
  };
  for (const [path, content] of Object.entries(files)) {
    await Bun.write(join(root, path), content);
  }
  await Bun.write(join(root, "docs.yaml"), `title: Acme\n${config}`);
  const loaded = await loadSite(await loadConfig(join(root, "docs.yaml")));
  return { site: loaded, html: renderPage(loaded, loaded.pages[0]!, { dev: false, server: false }) };
}

/**
 * Returns the HTML of the header brand link.
 */
const headerBrand = (html: string) => /<a class="brand"[^>]*>([\s\S]*?)<\/a>/.exec(html)![1];

test("logos keep their shape: sized by height in CSS, never given a width or height in HTML", async () => {
  const css = await Bun.file(join(import.meta.dir, "../../themes/default/styles/header.css")).text();
  const rule = /\.brand-logo \{([^}]*)\}/.exec(css)![1];
  expect(rule).toContain("width: auto;");
  expect(rule).toContain("height: 1.75rem;");
  expect(rule).toContain("object-fit: contain;");
});

test(
  "a logo shows next to the title, with an empty alt since the title names the link",
  async () => {
    const { html } = await site("logo: brand/wordmark.png\n");
    expect(headerBrand(html)).toBe('<img class="brand-logo" src="/brand/wordmark.png" alt=""><span>Acme</span>');
  },
  siteTimeout,
);

test(
  "logo_only drops the title text and moves it to the alt",
  async () => {
    const { html } = await site("logo: brand/wordmark.png\nlogo_only: true\n");
    expect(headerBrand(html)).toBe('<img class="brand-logo" src="/brand/wordmark.png" alt="Acme">');
  },
  siteTimeout,
);

test(
  "logo_dark renders a light and a dark image, and the favicon keeps the light logo",
  async () => {
    const { site: loaded, html } = await site("logo: brand/wordmark.png\nlogo_dark: brand/wordmark-dark.png\n");
    expect(headerBrand(html)).toBe(
      '<img class="brand-logo brand-logo-light" src="/brand/wordmark.png" alt=""><img class="brand-logo brand-logo-dark" src="/brand/wordmark-dark.png" alt=""><span>Acme</span>',
    );
    expect(html).toContain('<link rel="icon" href="/brand/wordmark.png">');
    expect(loaded.files.get("/favicon.ico")).toBe(loaded.files.get("/brand/wordmark.png"));
  },
  siteTimeout,
);

test(
  "favicon points at its own square file and is also served as /favicon.ico",
  async () => {
    const { site: loaded, html } = await site("logo: brand/wordmark.png\nfavicon: brand/square.png\n");
    expect(html).toContain('<link rel="icon" href="/brand/square.png">');
    expect(loaded.files.get("/favicon.ico")).toBe(loaded.files.get("/brand/square.png"));
  },
  siteTimeout,
);

test(
  "a missing or non-image logo, logo_dark or favicon fails the build with the setting and the path",
  async () => {
    await expect(site("logo: brand/missing.png\n")).rejects.toThrow("docs.yaml: logo not found: brand/missing.png");
    await expect(site("logo: brand/wordmark.png\nlogo_dark: brand/notes.txt\n")).rejects.toThrow(
      "docs.yaml: logo_dark is not an image (png, jpg, gif, webp, svg or ico): brand/notes.txt",
    );
    await expect(site("favicon: brand/gone.ico\n")).rejects.toThrow("docs.yaml: favicon not found: brand/gone.ico");
  },
  siteTimeout,
);

test("logo_only and logo_dark need a logo", async () => {
  await expect(site("logo_only: true\n")).rejects.toThrow('"logo_only" must be false when no logo is set');
  await expect(site("logo_dark: brand/wordmark-dark.png\n")).rejects.toThrow(
    '"logo_dark" must be set together with logo',
  );
});
