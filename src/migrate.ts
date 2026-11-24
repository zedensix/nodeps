import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

type Mapping = Record<string, unknown>;

const materialColors: Record<string, string> = {
  red: "#ef5350",
  pink: "#e92063",
  purple: "#ab47bc",
  "deep-purple": "#7e56c2",
  indigo: "#4051b5",
  blue: "#2094f3",
  "light-blue": "#02a6f2",
  cyan: "#00bdd6",
  teal: "#009485",
  green: "#4cae4f",
  "light-green": "#8bc34b",
  lime: "#cbdc38",
  yellow: "#ffec3d",
  amber: "#ffc105",
  orange: "#ffa724",
  "deep-orange": "#ff6e42",
  brown: "#795649",
  grey: "#757575",
  "blue-grey": "#546d78",
  black: "#000000",
  white: "#ffffff",
};

const supportedExtensions = new Set([
  "admonition",
  "abbr",
  "attr_list",
  "def_list",
  "footnotes",
  "md_in_html",
  "meta",
  "tables",
  "toc",
  "pymdownx.arithmatex",
  "pymdownx.betterem",
  "pymdownx.caret",
  "pymdownx.details",
  "pymdownx.emoji",
  "pymdownx.highlight",
  "pymdownx.keys",
  "pymdownx.mark",
  "pymdownx.snippets",
  "pymdownx.superfences",
  "pymdownx.tabbed",
  "pymdownx.tasklist",
  "pymdownx.tilde",
]);

const supportedPlugins: Record<string, string> = {
  search: "built-in search",
  tags: "page `tags` frontmatter",
  "git-revision-date-localized": "last-updated dates from git",
  llmstxt: "built-in llms.txt and llms-full.txt",
  "section-index": "folder index pages",
  offline: "`nodeps build` static export",
  minify: "assets are always minified",
};

const supportedFeatures = new Set([
  "navigation.instant",
  "navigation.instant.prefetch",
  "navigation.tabs",
  "navigation.tabs.sticky",
  "navigation.sections",
  "navigation.indexes",
  "navigation.footer",
  "navigation.path",
  "navigation.tracking",
  "toc.follow",
  "search.suggest",
  "content.code.copy",
  "content.tabs.link",
  "content.tooltips",
  "content.action.edit",
  "content.action.view",
  "content.action.copy",
]);

function stripPythonTags(text: string) {
  return text
    .replace(/!!python\/name:([^\s]+)/g, '"$1"')
    .replace(/!!python\/object\/apply:[^\s]+/g, "")
    .replace(/!ENV[ \t]*\[[ \t]*[^,\]]+,[ \t]*([^\]]+)\]/g, "$1")
    .replace(/!ENV[ \t]*\[?[ \t]*\w+[ \t]*\]?/g, '""')
    .replace(/!relative\s+(\S+)/g, "$1");
}

function names(list: unknown): string[] {
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map((entry) => (typeof entry === "string" ? entry : Object.keys(entry as Mapping)[0]!));
}

function stripHtml(text: string) {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&copy;/g, "©")
    .replace(/\s+/g, " ")
    .trim();
}

function yamlValue(value: unknown, indent = ""): string {
  if (typeof value === "string") {
    return /^[\w./:@#-][\w ./:@#()-]*$/.test(value) && !/^(true|false|null|yes|no|\d+)$/i.test(value)
      ? value
      : JSON.stringify(value);
  }
  if (typeof value !== "object" || value === null) {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => `\n${indent}- ${yamlValue(item, `${indent}  `).replace(/^\n\s*/, "")}`).join("");
  }
  return Object.entries(value)
    .map(([key, item]) => {
      const rendered = yamlValue(item, `${indent}  `);
      const needsBlock = typeof item === "object" && item !== null;
      return `\n${indent}${/^[\w-]+$/.test(key) ? key : JSON.stringify(key)}:${needsBlock ? rendered : ` ${rendered}`}`;
    })
    .join("");
}

export interface MigrationReport {
  config: Mapping;
  mapped: string[];
  native: string[];
  unsupported: string[];
  pages: { path: string; added: string[] }[];
}

export async function planMigration(mkdocsPath: string): Promise<MigrationReport> {
  const file = Bun.file(resolve(mkdocsPath));
  if (!(await file.exists())) {
    throw new Error(`No MkDocs config at ${resolve(mkdocsPath)}`);
  }
  const mkdocs = (Bun.YAML.parse(stripPythonTags(await file.text())) ?? {}) as Mapping;
  const theme = (mkdocs.theme ?? {}) as Mapping;
  const extra = (mkdocs.extra ?? {}) as Mapping;
  const report: MigrationReport = { config: {}, mapped: [], native: [], unsupported: [], pages: [] };
  const config = report.config;
  const map = (from: string, to: string, value: unknown) => {
    if (value !== undefined && value !== null && value !== "") {
      config[to] = value;
      report.mapped.push(`${from} → ${to}`);
    }
  };

  map("site_name", "title", mkdocs.site_name);
  map("site_description", "description", mkdocs.site_description);
  map("site_url", "url", typeof mkdocs.site_url === "string" ? mkdocs.site_url.replace(/\/$/, "") : undefined);
  map("docs_dir", "source", mkdocs.docs_dir ?? "docs");
  map("site_dir", "output", mkdocs.site_dir ?? "site");
  map("copyright", "footer", typeof mkdocs.copyright === "string" ? stripHtml(mkdocs.copyright) : undefined);
  map("theme.logo", "logo", theme.logo);

  const features = names(theme.features);
  if (typeof mkdocs.repo_url === "string") {
    const repository: Mapping = { url: mkdocs.repo_url.replace(/\/$/, "") };
    const editUri = typeof mkdocs.edit_uri === "string" ? mkdocs.edit_uri : "";
    const editMatch = /(?:-\/)?(?:edit|blob|src|_edit)\/([^/]+)\/(.*)$/.exec(editUri.replace(/^\/|\/$/g, ""));
    if (editMatch) {
      repository.branch = editMatch[1];
      repository.path = editMatch[2]!.replace(/\/$/, "");
    }
    if (features.includes("content.action.edit") || editUri) {
      repository.edit = true;
    }
    map("repo_url / edit_uri", "repository", repository);
  }

  const social = Array.isArray(extra.social) ? (extra.social as Mapping[]) : [];
  if (social.length > 0) {
    map(
      "extra.social",
      "social",
      social.map((entry) => ({
        icon: entry.icon,
        url: entry.link,
        ...(entry.name ? { label: entry.name } : {}),
      })),
    );
  }

  if (mkdocs.nav) {
    map("nav", "nav", mkdocs.nav);
  }

  const themeConfig: Mapping = {};
  const palette = Array.isArray(theme.palette)
    ? (theme.palette[0] as Mapping | undefined)
    : (theme.palette as Mapping | undefined);
  const primary = typeof palette?.primary === "string" ? palette.primary.toLowerCase().replace(/\s+/g, "-") : undefined;
  if (primary && materialColors[primary]) {
    themeConfig.accent = materialColors[primary];
    report.mapped.push(`theme.palette.primary (${primary}) → theme.accent`);
  }
  if (theme.font) {
    report.unsupported.push(
      "theme.font: Google Fonts are not downloaded; set theme.font and theme.mono to installed or self-hosted fonts",
    );
  }
  const extraCss = Array.isArray(mkdocs.extra_css) ? (mkdocs.extra_css as string[]) : [];
  if (extraCss.length > 0) {
    themeConfig.stylesheet = join(String(config.source ?? "docs"), extraCss[0]!);
    report.mapped.push(`extra_css (${extraCss[0]}) → theme.stylesheet`);
    for (const stylesheet of extraCss.slice(1)) {
      report.unsupported.push(`extra_css: only one stylesheet is supported, merge ${stylesheet} into the first`);
    }
  }
  if (Object.keys(themeConfig).length > 0) {
    config.theme = themeConfig;
  }

  for (const feature of features) {
    (supportedFeatures.has(feature) ? report.native : report.unsupported).push(`theme.features: ${feature}`);
  }
  for (const extension of names(mkdocs.markdown_extensions)) {
    (supportedExtensions.has(extension) ? report.native : report.unsupported).push(`markdown_extensions: ${extension}`);
  }
  for (const plugin of names(mkdocs.plugins)) {
    if (supportedPlugins[plugin]) {
      report.native.push(`plugins: ${plugin} (${supportedPlugins[plugin]})`);
    } else {
      report.unsupported.push(`plugins: ${plugin}`);
    }
  }
  for (const key of [
    "extra_javascript",
    "hooks",
    "theme.custom_dir",
    "extra.analytics",
    "extra.consent",
    "extra.version",
    "extra.alternate",
  ]) {
    const [first, second] = key.split(".") as [string, string | undefined];
    const value = second ? ((mkdocs[first] ?? {}) as Mapping)[second] : mkdocs[first];
    if (value !== undefined) {
      report.unsupported.push(key);
    }
  }
  if (typeof theme.language === "string" && theme.language !== "en") {
    report.unsupported.push(`theme.language: ${theme.language} (the interface is English only)`);
  }

  const source = resolve(dirname(resolve(mkdocsPath)), String(config.source ?? "docs"));
  const byline = (mkdocs.site_author as string | undefined) ?? `${mkdocs.site_name ?? "The"} contributors`;
  for (const path of new Bun.Glob("**/*.md").scanSync({ cwd: source })) {
    const text = await Bun.file(join(source, path)).text();
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? "";
    const added: string[] = [];
    if (!/^icon:/m.test(frontmatter)) {
      added.push("icon: file-text");
    }
    if (!/^byline:/m.test(frontmatter)) {
      added.push(`byline: ${yamlValue(byline)}`);
    }
    if (added.length > 0) {
      report.pages.push({ path: join(source, path), added });
    }
  }
  return report;
}

export function renderConfig(config: Mapping) {
  return `${yamlValue(config).trimStart()}\n`;
}

export async function writeMigration(mkdocsPath: string, report: MigrationReport) {
  const target = join(dirname(resolve(mkdocsPath)), "docs.yaml");
  if (existsSync(target)) {
    throw new Error(`${target} already exists; move it away to migrate again`);
  }
  await Bun.write(target, renderConfig(report.config));
  for (const page of report.pages) {
    const text = await Bun.file(page.path).text();
    const updated = /^---\r?\n/.test(text)
      ? text.replace(/^---\r?\n/, `---\n${page.added.join("\n")}\n`)
      : `---\n${page.added.join("\n")}\n---\n\n${text}`;
    await Bun.write(page.path, updated);
  }
  return target;
}
