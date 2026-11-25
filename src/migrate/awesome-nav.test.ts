import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { loadConfig } from "../config/config.ts";
import { loadSite } from "../site/site.ts";
import { planMigration, writeMigration } from "./migrate.ts";

// Loading a site downloads the icon sets on a fresh checkout, which takes longer than the default 5 s.
const siteTimeout = 60_000;
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

/**
 * Markdown for a page whose only heading is `title`.
 */
const page = (title: string) => `# ${title}\n\nText.\n`;

const nestedProject = {
  "mkdocs.yml": "site_name: Nested\nplugins:\n  - search\n  - awesome-nav\n",
  "docs/index.md": page("Home"),
  "docs/.nav.yml":
    "nav:\n  - index.md\n  - Guide: guide\n  - reference\n  - Changelog: https://example.com/changelog\n",
  "docs/guide/a.md": page("Alpha"),
  "docs/guide/b.md": page("Bravo"),
  "docs/guide/.nav.yml": "nav:\n  - b.md\n  - a.md\nappend_unmatched: true\nflatten_single_child_sections: true\n",
  "docs/guide/advanced/z.md": page("Zulu"),
  "docs/reference/x.md": page("X-ray"),
  "docs/reference/y.md": page("Yankee"),
  "docs/reference/.nav.yml": "title: API\nsort:\n  direction: desc\n  by: title\n",
};

test("nested .nav.yml files become one nav in the same order", async () => {
  const report = await planMigration(await project(nestedProject));
  expect(report.config.nav).toEqual([
    "index.md",
    { Guide: ["guide/b.md", "guide/a.md", { Advanced: ["guide/advanced/z.md"] }] },
    { API: ["reference/y.md", "reference/x.md"] },
    { Changelog: "https://example.com/changelog" },
  ]);
  expect(report.mapped).toContain("plugins: awesome-nav (.nav.yml files) → nav");
  expect(report.unsupported.join("\n")).not.toContain("awesome-nav");
});

test("keys awesome-nav options nodeps cannot express are named with their file", async () => {
  const report = await planMigration(await project(nestedProject));
  expect(report.warnings).toContain(
    'docs/guide/.nav.yml: "flatten_single_child_sections" is not translated. Check that section of the nav by hand.',
  );
  expect(report.warnings.some((warning) => warning.startsWith('docs/reference/.nav.yml: "sort.by"'))).toBe(true);
});

test(
  "the migrated nav renders the pages in the .nav.yml order",
  async () => {
    const mkdocsPath = await project(nestedProject);
    const configPath = await writeMigration(mkdocsPath, await planMigration(mkdocsPath));
    const site = await loadSite(await loadConfig(configPath));
    expect(site.navPages.map((navPage) => navPage.source)).toEqual([
      "index.md",
      "guide/b.md",
      "guide/a.md",
      "guide/advanced/z.md",
      "reference/y.md",
      "reference/x.md",
    ]);
    expect(site.warnings.filter((warning) => warning.includes("nav entry"))).toEqual([]);
  },
  siteTimeout,
);

test("globs expand in name order with a warning, hidden folders are skipped", async () => {
  const report = await planMigration(
    await project({
      "mkdocs.yml": "site_name: Globs\nplugins:\n  - awesome-nav\n",
      "docs/.nav.yml": 'nav:\n  - "notes/*.md"\n  - drafts\n  - missing.md\n',
      "docs/notes/2.md": page("Two"),
      "docs/notes/1.md": page("One"),
      "docs/drafts/wip.md": page("Draft"),
      "docs/drafts/.nav.yml": "hide: true\n",
    }),
  );
  expect(report.config.nav).toEqual(["notes/1.md", "notes/2.md"]);
  expect(report.warnings.some((warning) => warning.includes('glob "notes/*.md" was expanded to 2 entries'))).toBe(true);
  expect(report.warnings).toContain('docs/.nav.yml: "missing.md" does not exist and was dropped.');
});

test("awesome-nav without .nav.yml files keeps the folder-based sidebar", async () => {
  const report = await planMigration(
    await project({ "mkdocs.yml": "site_name: Plain\nplugins:\n  - awesome-nav\n", "docs/index.md": page("Home") }),
  );
  expect(report.config.nav).toBeUndefined();
  expect(report.native.some((line) => line.startsWith("plugins: awesome-nav without .nav.yml files"))).toBe(true);
});

test("sort options are not flagged on a folder whose nav lists every page", async () => {
  const report = await planMigration(
    await project({
      "mkdocs.yml": "site_name: Sorted\nplugins:\n  - awesome-nav\n",
      "docs/.nav.yml": "nav:\n  - b.md\n  - a.md\nsort:\n  type: natural\n",
      "docs/a.md": page("Alpha"),
      "docs/b.md": page("Bravo"),
    }),
  );
  expect(report.config.nav).toEqual(["b.md", "a.md"]);
  expect(report.warnings).toEqual([]);
});

test('"*" after explicit entries adds only what is not listed, folders included, and marks docs.yaml as a snapshot', async () => {
  const mkdocsPath = await project({
    "mkdocs.yml": "site_name: Star\nplugins:\n  - awesome-nav\n",
    "docs/.nav.yml": 'nav:\n  - Home: index.md\n  - Contribute: contributing.reference.md\n  - "*"\n',
    "docs/index.md": page("Home"),
    "docs/contributing.reference.md": page("Contribute"),
    "docs/ignite-talk.md": page("Ignite talk"),
    "docs/guides/install.md": page("Install"),
  });
  const report = await planMigration(mkdocsPath);
  expect(report.config.nav).toEqual([
    { Home: "index.md" },
    { Contribute: "contributing.reference.md" },
    { Guides: ["guides/install.md"] },
    "ignite-talk.md",
  ]);
  const written = await Bun.file(await writeMigration(mkdocsPath, report)).text();
  expect(written.startsWith("# nav: the globs of the .nav.yml files were expanded when migrating.")).toBe(true);
});

test(
  "skill folders are left out of nav with a warning, and links to their SKILL.md still resolve",
  async () => {
    const mkdocsPath = await project({
      "mkdocs.yml": "site_name: Skills\nplugins:\n  - awesome-nav\n",
      "docs/.nav.yml": "nav:\n  - index.md\n  - skills\n",
      "docs/index.md": "# Home\n\nSee [the deploy skill](skills/deploy/SKILL.md).\n",
      "docs/skills/deploy/SKILL.md": "---\nname: deploy\ndescription: Deploys.\n---\n\nSteps.\n",
      "docs/skills/deploy/references/api.md": "# API\n",
    });
    const report = await planMigration(mkdocsPath);
    expect(report.config.nav).toEqual(["index.md"]);
    expect(report.warnings.filter((warning) => warning.startsWith("nav: skills/deploy is an AI skill"))).toHaveLength(
      1,
    );
    const site = await loadSite(await loadConfig(await writeMigration(mkdocsPath, report)));
    expect(site.warnings).toEqual([]);
    expect(site.pages[0]!.html).toContain('href="/skills/deploy/SKILL.md"');
  },
  siteTimeout,
);

test("admonition types nodeps cannot style are named with the first page using them", async () => {
  const report = await planMigration(
    await project({
      "mkdocs.yml": "site_name: Notes\n",
      "docs/index.md": '!!! note\n    Fine.\n\n???+ todo "Alias"\n    Fine too.\n',
      "docs/a.md": "!!! custom-box\n    Not styled.\n",
      "docs/b.md": "!!! custom-box\n    Again.\n",
    }),
  );
  expect(report.warnings.filter((warning) => warning.startsWith("admonition type"))).toEqual([
    'admonition type "custom-box" (first used in a.md) has no nodeps style, so it renders as a note. Use one of the types listed in reference/markdown/admonitions.',
  ]);
});

test("--write refuses to overwrite docs.yaml and names the file to move", async () => {
  const mkdocsPath = await project({
    "mkdocs.yml": "site_name: Twice\n",
    "docs/index.md": page("Home"),
    "docs.yaml": "",
  });
  const target = join(dirname(mkdocsPath), "docs.yaml");
  await expect(writeMigration(mkdocsPath, await planMigration(mkdocsPath))).rejects.toThrow(
    `${target} already exists; move it away to migrate again`,
  );
});
