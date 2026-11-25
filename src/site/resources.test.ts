import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../config/config.ts";
import { renderPage } from "../render/layout.tsx";
import { loadSite } from "./site.ts";

// Loading a site downloads the icon sets on a fresh checkout, which takes longer than the default 5 s.
const siteTimeout = 60_000;

/**
 * Builds the SKILL.md of a skill named `name`.
 */
const skill = (name: string) => `---\nname: ${name}\ndescription: Does ${name}.\n---\n\nSteps.\n`;

/**
 * Writes a throwaway docs project with the given source files and loads it.
 */
async function site(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "nodeps-resources-"));
  for (const [path, content] of Object.entries(files)) {
    await Bun.write(join(root, "docs", path), content);
  }
  await Bun.write(join(root, "docs.yaml"), "title: Acme\n");
  return loadSite(await loadConfig(join(root, "docs.yaml")));
}

test(
  "an attached folder is served as files with an archive and a file browser, its Markdown not turned into pages",
  async () => {
    const loaded = await site({
      "tutorials/first.md": "---\nresources:\n  - code/starter\n---\n# First\n",
      "tutorials/code/starter/README.md": "# Starter\n",
      "tutorials/code/starter/src/main.ts": "console.log(1);\n",
      "tutorials/code/starter/logo.png": "png",
    });
    expect(loaded.pages.map((page) => page.source)).toEqual(["tutorials/first.md"]);
    const page = loaded.pages[0]!;
    const folder = page.resources[0]!;
    expect(folder.kind).toBe("folder");
    expect(folder.files!.map((file) => [file.title, file.kind])).toEqual([
      ["README.md", "code"],
      ["logo.png", "file"],
      ["src/main.ts", "code"],
    ]);
    expect(loaded.files.get("/tutorials/code/starter.tar.gz")?.type).toBe("application/gzip");
    expect(loaded.files.has("/tutorials/code/starter/README.md")).toBe(true);
    const html = renderPage(loaded, page, { dev: false, server: false });
    expect(html).toContain("Browse 3 files");
    expect(html).toContain('href="/tutorials/code/starter.tar.gz" download');
    expect(html).toContain('href="/tutorials/code/starter/logo.png" download');
    expect(html).toContain('class="copy-code"');
    expect(page.markdown).toContain(
      "- [starter](/tutorials/code/starter.tar.gz) (folder, download: /tutorials/code/starter.tar.gz)",
    );
  },
  siteTimeout,
);

test(
  "a skills folder without index.md gets a Skills page listing every skill in it",
  async () => {
    const loaded = await site({
      "guides/index.md": "# Guides\n",
      "guides/skills/review/SKILL.md": skill("review"),
      "guides/skills/deploy/SKILL.md": skill("deploy"),
      "guides/skills/deploy/references/api.md": "# API\n",
    });
    const skills = loaded.pages.find((page) => page.source === "guides/skills/index.md")!;
    expect(skills.title).toBe("Skills");
    expect(skills.url).toBe("/guides/skills/");
    expect(skills.resources.map((resource) => [resource.title, resource.kind])).toEqual([
      ["deploy", "skill"],
      ["review", "skill"],
    ]);
    expect(skills.resources[0]!.files!.map((file) => file.title)).toEqual(["SKILL.md", "references/api.md"]);
    const html = renderPage(loaded, skills, { dev: false, server: false });
    expect(html).toContain('data-copy-skill="/guides/skills/deploy.tar.gz"');
    expect(loaded.navPages).toContain(skills);
  },
  siteTimeout,
);

test(
  "a skills folder's own index.md lists its skills, unless it names its resources itself",
  async () => {
    const own = await site({
      "skills/index.md": "# Our skills\n\nInstall them all.\n",
      "skills/deploy/SKILL.md": skill("deploy"),
    });
    expect(own.pages[0]!.title).toBe("Our skills");
    expect(own.pages[0]!.resources.map((resource) => resource.title)).toEqual(["deploy"]);
    const picked = await site({
      "skills/index.md": "---\nresources: [review]\n---\n# Picked\n",
      "skills/deploy/SKILL.md": skill("deploy"),
      "skills/review/SKILL.md": skill("review"),
    });
    expect(picked.pages[0]!.resources.map((resource) => resource.title)).toEqual(["review"]);
  },
  siteTimeout,
);
