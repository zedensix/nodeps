import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { loadConfig } from "../config/config.ts";
import { loadSite } from "../site/site.ts";
import { planMigration, writeMigration } from "./migrate.ts";

/**
 * Writes a throwaway MkDocs project into a temp folder and returns the path
 * of its mkdocs.yml.
 */
async function project(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "nodeps-migrate-"));
  for (const [path, content] of Object.entries(files)) {
    await Bun.write(join(root, path), content);
  }
  return join(root, "mkdocs.yml");
}

const home = "# Home\n\nText.\n";

test("several extra_css files are imported in order through one generated stylesheet", async () => {
  const mkdocsPath = await project({
    "mkdocs.yml": "site_name: Styles\ndocs_dir: content-root\nextra_css:\n  - css/c.css\n  - css/a.css\n  - b.css\n",
    "content-root/index.md": home,
    "content-root/css/c.css": ".first { color: red; }\n",
    "content-root/css/a.css": ".second { color: green; }\n",
    "content-root/b.css": ".third { color: blue; }\n",
  });
  const report = await planMigration(mkdocsPath);
  expect(report.config.theme).toEqual({ stylesheet: "extra.css" });
  expect(report.files).toEqual([
    {
      path: "extra.css",
      content:
        '@import "./content-root/css/c.css";\n@import "./content-root/css/a.css";\n@import "./content-root/b.css";\n',
    },
  ]);
  const site = await loadSite(await loadConfig(await writeMigration(mkdocsPath, report)));
  const bundle = [...site.files.values()].map((file) => String(file.body)).find((body) => body.includes(".second{"))!;
  expect(bundle.indexOf(".first")).toBeLessThan(bundle.indexOf(".second"));
  expect(bundle.indexOf(".second")).toBeLessThan(bundle.indexOf(".third"));
});

test("one extra_css file is used as is, resolved from the docs.yaml folder", async () => {
  const mkdocsPath = await project({
    "mkdocs.yml": "site_name: Tokens\ndocs_dir: content-root\nextra_css:\n  - stylesheets/tokens.css\n",
    "content-root/index.md": home,
    "content-root/stylesheets/tokens.css": ":root { --x: 1; }\n",
  });
  const report = await planMigration(mkdocsPath);
  expect(report.config.theme).toEqual({ stylesheet: "content-root/stylesheets/tokens.css" });
  const config = await loadConfig(await writeMigration(mkdocsPath, report));
  expect(config.theme.stylesheet).toBe(join(dirname(mkdocsPath), "content-root/stylesheets/tokens.css"));
  expect(await Bun.file(config.theme.stylesheet!).exists()).toBe(true);
});

test("extra_javascript is refused with the reason and the head.html way out", async () => {
  const report = await planMigration(
    await project({
      "mkdocs.yml": "site_name: Scripts\nextra_javascript:\n  - js/a.js\n  - path: js/b.mjs\n    type: module\n",
      "docs/index.md": home,
    }),
  );
  const message = report.unsupported.find((line) => line.startsWith("extra_javascript"))!;
  expect(message).toContain("js/a.js, js/b.mjs");
  expect(message).toContain("themes/default/head.html");
});

test("theme.font becomes font stacks with fallbacks and a warning to self-host", async () => {
  const report = await planMigration(
    await project({
      "mkdocs.yml": "site_name: Fonts\ntheme:\n  name: material\n  font:\n    text: Roboto\n    code: Roboto Mono\n",
      "docs/index.md": home,
    }),
  );
  expect(report.config.theme).toEqual({
    font: '"Roboto", ui-sans-serif, system-ui, sans-serif',
    mono: '"Roboto Mono", ui-monospace, monospace',
  });
  expect(report.warnings.some((line) => line.includes("Roboto and Roboto Mono") && line.includes("@font-face"))).toBe(
    true,
  );
});

test("palette toggles map named colors per scheme and explain custom ones", async () => {
  const report = await planMigration(
    await project({
      "mkdocs.yml": `site_name: Palette
theme:
  name: material
  palette:
    - media: "(prefers-color-scheme)"
      toggle: { icon: material/brightness-auto, name: Follow system }
    - media: "(prefers-color-scheme: light)"
      scheme: default
      primary: indigo
      accent: custom
    - media: "(prefers-color-scheme: dark)"
      scheme: slate
      primary: teal
`,
      "docs/index.md": home,
    }),
  );
  expect(report.config.theme).toEqual({ accent: "#4051b5", dark: { accent: "#009485" } });
  expect(report.native.some((line) => line.startsWith("theme.palette: scheme toggles"))).toBe(true);
  expect(report.warnings.some((line) => line.startsWith("theme.palette.accent: custom"))).toBe(true);
});

test("a custom primary falls back to a named accent", async () => {
  const report = await planMigration(
    await project({
      "mkdocs.yml": "site_name: Custom\ntheme:\n  palette:\n    primary: custom\n    accent: deep orange\n",
      "docs/index.md": home,
    }),
  );
  expect(report.config.theme).toEqual({ accent: "#ff6e42" });
  expect(report.warnings.some((line) => line.startsWith("theme.palette.primary: custom"))).toBe(true);
});

test("a dark-only palette keeps its color and says dark cannot be forced", async () => {
  const report = await planMigration(
    await project({
      "mkdocs.yml": "site_name: Dark\ntheme:\n  palette:\n    scheme: slate\n    primary: amber\n",
      "docs/index.md": home,
    }),
  );
  expect(report.config.theme).toEqual({ accent: "#ffc105" });
  expect(report.warnings.some((line) => line.startsWith("theme.palette.scheme: slate cannot be forced"))).toBe(true);
});
