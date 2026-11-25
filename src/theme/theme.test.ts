import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../config/config.ts";
import { renderPage } from "../render/layout.tsx";
import { loadSite } from "../site/site.ts";

// Loading a site downloads the icon sets on a fresh checkout, which takes longer than the default 5 s.
const siteTimeout = 60_000;
const fontBytes = "wOF2";

/**
 * Writes a one-page docs project with a stylesheet and font files next to
 * docs.yaml, loads it with the given `theme` lines and renders its page.
 */
async function site(theme: string) {
  const root = mkdtempSync(join(tmpdir(), "nodeps-theme-"));
  const files = {
    "docs/index.md": "# Home\n",
    "theme.css": ".brand { letter-spacing: 0; }\n",
    "fonts/grotesk.woff2": fontBytes,
    "fonts/serif-regular.woff2": fontBytes,
    "fonts/serif-bold.woff2": fontBytes,
    "fonts/mono.woff2": fontBytes,
  };
  for (const [path, content] of Object.entries(files)) {
    await Bun.write(join(root, path), content);
  }
  await Bun.write(join(root, "docs.yaml"), `title: Acme\ntheme:\n${theme}`);
  const loaded = await loadSite(await loadConfig(join(root, "docs.yaml")));
  return { site: loaded, html: renderPage(loaded, loaded.pages[0]!, { dev: false, server: false }) };
}

/**
 * Returns the text of the bundled stylesheet a page links to, by its URL.
 */
const stylesheet = (loaded: Awaited<ReturnType<typeof site>>["site"], href: string) =>
  loaded.files.get(href)!.body as string;

test(
  "a CSS-only theme.stylesheet is linked from every page",
  async () => {
    const { site: loaded, html } = await site("  stylesheet: theme.css\n");
    const href = /<link rel="stylesheet" href="(\/_assets\/theme-[\w-]+\.css)">/.exec(html)?.[1];
    expect(href).toBeDefined();
    expect(stylesheet(loaded, href!)).toContain("letter-spacing");
  },
  siteTimeout,
);

test(
  "a font file in theme.font gets a font face, a hashed URL, a preload and the system fallbacks",
  async () => {
    const { site: loaded, html } = await site(
      "  font:\n    family: Space Grotesk\n    file: fonts/grotesk.woff2\n    weight: 300 700\n  mono:\n    family: Plex Mono\n    file: fonts/mono.woff2\n  stylesheet: theme.css\n",
    );
    const links = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((match) => match[1]!);
    expect(links).toHaveLength(2);
    const faces = stylesheet(loaded, links[0]!);
    expect(faces).toContain('font-family: "Space Grotesk"');
    expect(faces).toContain('format("woff2")');
    expect(faces).toContain("font-weight: 300 700");
    expect(faces).toContain("font-display: swap");
    const font =
      /<link rel="preload" as="font" type="font\/woff2" href="(\/_assets\/grotesk-[\w-]+\.woff2)" crossorigin>/.exec(
        html,
      )?.[1];
    expect(font).toBeDefined();
    expect(loaded.files.has(font!)).toBe(true);
    expect([...loaded.files.keys()].some((path) => /^\/_assets\/mono-[\w-]+\.woff2$/.test(path))).toBe(true);
    expect(html).toContain('--font:"Space Grotesk", ui-sans-serif');
    expect(html).toContain('--mono:"Plex Mono", ui-monospace');
  },
  siteTimeout,
);

test(
  "a static font lists one file per weight and style",
  async () => {
    const { site: loaded, html } = await site(
      "  font:\n    family: Serif\n    file:\n      - path: fonts/serif-regular.woff2\n        weight: 400\n      - path: fonts/serif-bold.woff2\n        weight: 700\n        style: italic\n",
    );
    const faces = stylesheet(loaded, /<link rel="stylesheet" href="([^"]+)">/.exec(html)![1]!);
    expect(faces.match(/@font-face/g)).toHaveLength(2);
    expect(faces).toContain("font-weight: 400;");
    expect(faces).toContain("font-weight: 700; font-style: italic");
  },
  siteTimeout,
);

test("a missing font file or format fails with the setting and the path", async () => {
  await expect(site("  font:\n    family: Gone\n    file: fonts/gone.woff2\n")).rejects.toThrow(
    '"theme.font.file" must be an existing file, not found: fonts/gone.woff2',
  );
  await expect(site("  mono:\n    family: Text\n    file:\n      - path: theme.css\n")).rejects.toThrow(
    '"theme.mono.file[0]" must be a .woff2, .woff, .ttf or .otf file, got theme.css',
  );
});

test(
  "theme.picker: false ships no picker and ignores a stored preset, the color mode toggle stays",
  async () => {
    const { html } = await site("  picker: false\n");
    expect(html).not.toContain("theme-picker");
    expect(html).not.toContain("data-preset");
    expect(html).toContain('<html lang="en" data-no-presets="">');
    expect(html).toContain('class="icon-button theme-toggle"');
    const { html: withPicker } = await site("  accent: '#123456'\n");
    expect(withPicker).toContain('class="theme-picker"');
    expect(withPicker).not.toContain('data-no-presets=""');
  },
  siteTimeout,
);
