import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { translateAwesomeNav } from "./awesome-nav.ts";
import { supportedExtensions, supportedFeatures, supportedPlugins } from "./mkdocs-support.ts";
import { mapTheme } from "./theme-mapping.ts";

type Mapping = Record<string, unknown>;

/**
 * Neutralizes the MkDocs YAML tags Bun.YAML cannot parse: `!!python/name` becomes
 * a string, `!!python/object/apply` is dropped, `!ENV` keeps its default value
 * (or an empty string) and `!relative` keeps the path.
 */
function stripPythonTags(text: string) {
  return text
    .replace(/!!python\/name:([^\s]+)/g, '"$1"')
    .replace(/!!python\/object\/apply:[^\s]+/g, "")
    .replace(/!ENV[ \t]*\[[ \t]*[^,\]]+,[ \t]*([^\]]+)\]/g, "$1")
    .replace(/!ENV[ \t]*\[?[ \t]*\w+[ \t]*\]?/g, '""')
    .replace(/!relative\s+(\S+)/g, "$1");
}

/**
 * Reads a MkDocs list whose entries are either a bare name or a one-key mapping
 * of name to options, as `markdown_extensions` and `plugins` are, and returns the names.
 */
function names(list: unknown): string[] {
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map((entry) => (typeof entry === "string" ? entry : Object.keys(entry as Mapping)[0]!));
}

/**
 * Flattens an HTML copyright notice to plain text, keeping `&copy;` as ©.
 */
function stripHtml(text: string) {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&copy;/g, "©")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Serializes a value as block YAML for docs.yaml. Strings are left bare when safe
 * and JSON-quoted when they would read as another type or need escaping; nested
 * values start with a newline so the caller can put them after `key:`.
 */
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
  warnings: string[];
  files: { path: string; content: string }[];
  pages: { path: string; added: string[] }[];
}

const unsupportedKeys: Record<string, string> = {
  hooks:
    "Python hooks cannot run in nodeps. Port what they do to Markdown, a theme or a build step before nodeps build.",
  "extra.analytics": "nodeps adds no analytics. Add your tracking snippet to themes/default/head.html if you need it.",
  "extra.consent":
    "nodeps shows no cookie banner. Add your own in themes/default/head.html if your analytics needs one.",
  "extra.version": "nodeps does not switch between versions. Deploy each version to its own base path instead.",
  "extra.alternate": "nodeps has no language switcher. Build each language as its own site and link them with links.",
};

/**
 * Reads an mkdocs.yml and works out the docs.yaml equivalent without writing
 * anything: settings that map, those nodeps covers natively, those it cannot, and
 * the frontmatter each page needs added (an icon and a byline). Throws when the
 * file does not exist.
 */
export async function planMigration(mkdocsPath: string): Promise<MigrationReport> {
  const file = Bun.file(resolve(mkdocsPath));
  if (!(await file.exists())) {
    throw new Error(`No MkDocs config at ${resolve(mkdocsPath)}`);
  }
  const mkdocs = (Bun.YAML.parse(stripPythonTags(await file.text())) ?? {}) as Mapping;
  const theme = (mkdocs.theme ?? {}) as Mapping;
  const extra = (mkdocs.extra ?? {}) as Mapping;
  const report: MigrationReport = {
    config: {},
    mapped: [],
    native: [],
    unsupported: [],
    warnings: [],
    files: [],
    pages: [],
  };
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

  const source = resolve(dirname(resolve(mkdocsPath)), String(config.source ?? "docs"));
  const plugins = names(mkdocs.plugins);
  const awesomeNav = plugins.includes("awesome-nav") ? translateAwesomeNav(source, report.warnings) : undefined;
  if (awesomeNav) {
    config.nav = awesomeNav;
    report.mapped.push(
      `plugins: awesome-nav (.nav.yml files) → nav${mkdocs.nav ? ", replacing the nav in mkdocs.yml as awesome-nav does" : ""}`,
    );
  } else if (mkdocs.nav) {
    map("nav", "nav", mkdocs.nav);
  }

  mapTheme(mkdocs, config, report);

  for (const feature of features) {
    if (supportedFeatures.has(feature)) {
      report.native.push(`theme.features: ${feature}`);
    } else {
      report.unsupported.push(
        `theme.features: ${feature}: no nodeps equivalent, so it is ignored. Nothing to do unless readers relied on it.`,
      );
    }
  }
  for (const extension of names(mkdocs.markdown_extensions)) {
    if (supportedExtensions.has(extension)) {
      report.native.push(`markdown_extensions: ${extension}`);
    } else {
      report.unsupported.push(
        `markdown_extensions: ${extension}: not supported, so its syntax shows as plain Markdown. Check the pages that use it with nodeps dev.`,
      );
    }
  }
  for (const plugin of plugins) {
    if (plugin === "awesome-nav") {
      if (!awesomeNav) {
        report.native.push("plugins: awesome-nav without .nav.yml files (nodeps builds the sidebar from folders)");
      }
    } else if (supportedPlugins[plugin]) {
      report.native.push(`plugins: ${plugin} (${supportedPlugins[plugin]})`);
    } else {
      report.unsupported.push(
        `plugins: ${plugin}: no nodeps equivalent, so the site builds without it. Check what it generated (pages, redirects, metadata) and recreate what you still need.`,
      );
    }
  }
  for (const [key, reason] of Object.entries(unsupportedKeys)) {
    const [first, second] = key.split(".") as [string, string | undefined];
    const value = second ? ((mkdocs[first] ?? {}) as Mapping)[second] : mkdocs[first];
    if (value !== undefined) {
      report.unsupported.push(`${key}: ${reason}`);
    }
  }
  if (typeof theme.language === "string" && theme.language !== "en") {
    report.unsupported.push(
      `theme.language: ${theme.language}: the interface is English only, page content is untouched.`,
    );
  }

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

/**
 * Renders a docs.yaml mapping as YAML text ending in a newline.
 */
export function renderConfig(config: Mapping) {
  return `${yamlValue(config).trimStart()}\n`;
}

/**
 * Writes docs.yaml and the generated files next to the mkdocs.yml and adds the
 * planned frontmatter to each page, creating the block when a page has none.
 * Refuses to run when any of those files exists so nothing is overwritten.
 */
export async function writeMigration(mkdocsPath: string, report: MigrationReport) {
  const target = join(dirname(resolve(mkdocsPath)), "docs.yaml");
  const files = report.files.map((file) => ({ ...file, path: join(dirname(target), file.path) }));
  for (const path of [target, ...files.map((file) => file.path)]) {
    if (existsSync(path)) {
      throw new Error(`${path} already exists; move it away to migrate again`);
    }
  }
  await Bun.write(target, renderConfig(report.config));
  for (const file of files) {
    await Bun.write(file.path, file.content);
  }
  for (const page of report.pages) {
    const text = await Bun.file(page.path).text();
    const updated = /^---\r?\n/.test(text)
      ? text.replace(/^---\r?\n/, `---\n${page.added.join("\n")}\n`)
      : `---\n${page.added.join("\n")}\n---\n\n${text}`;
    await Bun.write(page.path, updated);
  }
  return target;
}
