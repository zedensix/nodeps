import { stat } from "node:fs/promises";
import { basename } from "node:path";
import type { Config } from "./config.ts";
import { icon, isIcon } from "./icons.ts";
import { insideSkill, resolveResources, skillArchive, skillDirectories, type Resource } from "./resources.ts";
import { bundle, bundleLayout } from "./theme.ts";
import { parseFrontmatter, renderMarkdown, type Heading, type Section } from "./markdown.ts";

export interface Page {
  source: string;
  slug: string;
  url: string;
  markdownUrl: string;
  title: string;
  description: string;
  icon: string;
  byline: string;
  tags: string[];
  order: number;
  updated: Date;
  category?: Category;
  trail: string[];
  resources: Resource[];
  markdown: string;
  html: string;
  hasTitleHeading: boolean;
  headings: Heading[];
  sections: Section[];
}

export const diataxisKinds = ["tutorials", "how-to", "reference", "explanation"] as const;
export type DiataxisKind = (typeof diataxisKinds)[number];

export interface FolderSettings {
  title?: string;
  icon?: string;
  order?: number;
  description?: string;
  diataxis?: DiataxisKind;
  dropdown?: boolean;
}

export interface NavFolder {
  kind: "folder";
  folder: string;
  title: string;
  icon?: string;
  index?: Page;
  dropdown: boolean;
  children: NavItem[];
}

export type NavItem = { kind: "page"; page: Page } | NavFolder;

export interface Category {
  folder: string;
  title: string;
  icon?: string;
  description?: string;
  diataxis?: DiataxisKind;
  items: NavItem[];
  pages: Page[];
}

export interface Asset {
  body: string | Blob;
  type: string;
  immutable: boolean;
}

export interface Site {
  config: Config;
  pages: Page[];
  pageByUrl: Map<string, Page>;
  categories: Category[];
  navPages: Page[];
  files: Map<string, Asset>;
  template: string;
  customStylesheet?: string;
  warnings: string[];
}

const externalUrl = /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i;

function titleCase(name: string) {
  return name.replace(/[-_]+/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function isIndex(slug: string) {
  return slug === "index" || slug.endsWith("/index");
}

function pageUrl(slug: string) {
  const path = slug === "index" ? "" : slug.replace(/\/index$/, "");
  return path ? `/${path}/` : "/";
}

function markdownUrlOf(url: string) {
  return url === "/" ? "/index.md" : url.replace(/\/$/, ".md");
}

function ensureTitleHeading(markdown: string, title: string, hasTitleHeading: boolean) {
  return hasTitleHeading ? markdown : `# ${title}\n\n${markdown.trimStart()}`;
}

const folderFile = "_folder.yaml";

export function resourceUrl(config: Config, path: string) {
  return config.base + path.split("/").map(encodeURIComponent).join("/");
}

function readTags(value: unknown, source: string, problems: string[]) {
  if (value === undefined || value === null) {
    return [];
  }
  const tags = typeof value === "string" ? value.split(",") : value;
  if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string" && typeof tag !== "number")) {
    problems.push(`${source}: frontmatter "tags" must be a list of words`);
    return [];
  }
  return [...new Set(tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))];
}

function frontmatterDate(value: unknown) {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

async function lastCommitDates(source: string) {
  const dates = new Map<string, Date>();
  const result = await Bun.$`git -C ${source} log --format=%x00%cI --name-only --relative .`.quiet().nothrow();
  if (result.exitCode !== 0) {
    return dates;
  }
  for (const commit of result.stdout.toString().split("\0").slice(1)) {
    const [date, ...files] = commit.split("\n").filter(Boolean);
    for (const file of files) {
      if (!dates.has(file)) {
        dates.set(file, new Date(date!));
      }
    }
  }
  return dates;
}

async function readFolderSettings(path: string): Promise<FolderSettings> {
  let data: Record<string, unknown>;
  try {
    data = (Bun.YAML.parse(await Bun.file(path).text()) ?? {}) as Record<string, unknown>;
  } catch (error) {
    throw new Error(`${path}: invalid YAML: ${(error as Error).message}`, { cause: error });
  }
  const settings: FolderSettings = {};
  if (data.title !== undefined) {
    if (typeof data.title !== "string") {
      throw new Error(`${path}: "title" must be a string`);
    }
    settings.title = data.title;
  }
  if (data.icon !== undefined) {
    if (typeof data.icon !== "string") {
      throw new Error(`${path}: "icon" must be a Lucide icon name`);
    }
    try {
      icon(data.icon);
    } catch {
      throw new Error(`${path}: unknown Lucide icon "${data.icon}", see https://lucide.dev/icons`);
    }
    settings.icon = data.icon;
  }
  if (data.order !== undefined) {
    if (typeof data.order !== "number") {
      throw new Error(`${path}: "order" must be a number`);
    }
    settings.order = data.order;
  }
  if (data.dropdown !== undefined) {
    if (typeof data.dropdown !== "boolean") {
      throw new Error(`${path}: "dropdown" must be true or false`);
    }
    settings.dropdown = data.dropdown;
  }
  if (data.description !== undefined) {
    if (typeof data.description !== "string") {
      throw new Error(`${path}: "description" must be a string`);
    }
    settings.description = data.description;
  }
  if (data.diataxis !== undefined) {
    if (!diataxisKinds.includes(data.diataxis as DiataxisKind)) {
      throw new Error(`${path}: "diataxis" must be one of ${diataxisKinds.join(", ")}`);
    }
    settings.diataxis = data.diataxis as DiataxisKind;
  }
  return settings;
}

function buildCategories(
  pages: Page[],
  folders: Map<string, FolderSettings>,
  bySlug: Map<string, Page>,
  dropdowns: boolean,
): Category[] {
  const describe = (folder: string) => {
    const settings = folders.get(folder) ?? {};
    const index = bySlug.get(folder ? `${folder}/index` : "index");
    return {
      title: settings.title ?? (folder ? (index?.title ?? titleCase(folder.split("/").at(-1)!)) : "Overview"),
      icon: settings.icon,
      description: settings.description,
      diataxis: settings.diataxis,
      dropdown: settings.dropdown ?? dropdowns,
      order: settings.order ?? (folder ? (index?.order ?? Infinity) : -Infinity),
    };
  };

  const buildItems = (folder: string, folderPages: Page[], trail: string[]): NavItem[] => {
    const prefix = folder ? folder + "/" : "";
    const sortable: { item: NavItem; order: number; rank: number; title: string }[] = [];
    const subfolders = new Map<string, Page[]>();
    for (const page of folderPages) {
      const rest = page.slug.slice(prefix.length);
      if (!rest.includes("/")) {
        page.trail = trail;
        sortable.push({
          item: { kind: "page", page },
          order: page.order,
          rank: isIndex(page.slug) ? -1 : 0,
          title: page.title,
        });
        continue;
      }
      const subfolder = prefix + rest.split("/")[0];
      subfolders.set(subfolder, [...(subfolders.get(subfolder) ?? []), page]);
    }
    for (const [subfolder, subfolderPages] of subfolders) {
      const { title, icon, dropdown, order } = describe(subfolder);
      const index = subfolderPages.find((page) => page.slug === `${subfolder}/index`);
      if (index) {
        index.trail = [...trail, title];
      }
      const children = buildItems(
        subfolder,
        subfolderPages.filter((page) => page !== index),
        [...trail, title],
      );
      sortable.push({
        item: { kind: "folder", folder: subfolder, title, icon, index, dropdown, children },
        order,
        rank: 1,
        title,
      });
    }
    return sortable
      .sort(
        (left, right) =>
          Number(right.rank === -1) - Number(left.rank === -1) ||
          left.order - right.order ||
          left.rank - right.rank ||
          left.title.localeCompare(right.title),
      )
      .map(({ item }) => item);
  };

  const flatten = (items: NavItem[]): Page[] =>
    items.flatMap((item) =>
      item.kind === "page" ? [item.page] : [...(item.index ? [item.index] : []), ...flatten(item.children)],
    );

  const byCategory = new Map<string, Page[]>();
  for (const page of pages) {
    const folder = page.slug.includes("/") ? page.slug.split("/")[0]! : "";
    byCategory.set(folder, [...(byCategory.get(folder) ?? []), page]);
  }

  return [...byCategory.entries()]
    .map(([folder, categoryPages]) => {
      const items = buildItems(folder, categoryPages, []);
      const { dropdown: _dropdown, ...description } = describe(folder);
      const category: Category & { order: number } = { folder, ...description, items, pages: flatten(items) };
      for (const page of category.pages) {
        page.category = category;
      }
      return category;
    })
    .sort((left, right) => left.order - right.order || left.title.localeCompare(right.title));
}

export async function loadSite(config: Config): Promise<Site> {
  if (!(await stat(config.source).catch(() => null))?.isDirectory()) {
    throw new Error(`Source directory not found: ${config.source}`);
  }

  const files = new Map<string, Asset>();
  const folders = new Map<string, FolderSettings>();
  const drafts: { source: string; modified: Date; data: Record<string, unknown>; body: string }[] = [];

  const sourcePaths = Array.from(new Bun.Glob("**/*").scanSync({ cwd: config.source }), (path) =>
    path.split("\\").join("/"),
  );
  const skills = skillDirectories(sourcePaths);
  const assetPaths = new Set<string>();
  for (const path of sourcePaths) {
    const file = Bun.file(`${config.source}/${path}`);
    if (basename(path) === folderFile) {
      folders.set(
        path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "",
        await readFolderSettings(`${config.source}/${path}`),
      );
      continue;
    }
    if (!path.endsWith(".md") || insideSkill(path, skills)) {
      files.set("/" + path, { body: file, type: file.type, immutable: false });
      assetPaths.add(path);
      continue;
    }
    drafts.push({ source: path, modified: (await file.stat()).mtime, ...parseFrontmatter(await file.text(), path) });
  }

  const warnings: string[] = [];
  const bySource = new Map<string, Page>();
  const committed = await lastCommitDates(config.source);
  const problems: string[] = [];
  const pages = drafts.map(({ source, modified, data, body }) => {
    if (typeof data.icon !== "string" || !data.icon) {
      problems.push(`${source}: frontmatter "icon" is required (a Lucide icon name, see https://lucide.dev/icons)`);
    } else if (!isIcon(data.icon)) {
      problems.push(`${source}: frontmatter "icon" is not a Lucide icon: "${data.icon}"`);
    }
    if (typeof data.byline !== "string" || !data.byline.trim()) {
      problems.push(`${source}: frontmatter "byline" is required`);
    }
    const slug = source.replace(/\.md$/, "");
    const url = pageUrl(slug);
    const page: Page = {
      source,
      slug,
      url,
      markdownUrl: markdownUrlOf(url),
      title: typeof data.title === "string" ? data.title : "",
      description: typeof data.description === "string" ? data.description : "",
      icon: String(data.icon ?? ""),
      byline: String(data.byline ?? "").trim(),
      tags: readTags(data.tags, source, problems),
      order: typeof data.order === "number" ? data.order : Infinity,
      updated: frontmatterDate(data.updated) ?? committed.get(source) ?? modified,
      markdown: body,
      html: "",
      hasTitleHeading: false,
      trail: [],
      resources: [],
      headings: [],
      sections: [],
    };
    bySource.set(source, page);
    return page;
  });

  for (const [index, page] of pages.entries()) {
    page.resources = await resolveResources(
      drafts[index]!.data.resources,
      page.source,
      config.source,
      assetPaths,
      skills,
      problems,
    );
    for (const resource of page.resources) {
      if (resource.archivePath && !files.has("/" + resource.archivePath)) {
        const body = await skillArchive(config.source, resource.path, assetPaths);
        files.set("/" + resource.archivePath, { body, type: "application/gzip", immutable: false });
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(`Invalid pages:\n  ${problems.join("\n  ")}`);
  }

  const pageByUrl = new Map<string, Page>();
  for (const page of pages) {
    const existing = pageByUrl.get(page.url);
    if (existing) {
      throw new Error(`${page.source} and ${existing.source} both map to ${page.url}`);
    }
    pageByUrl.set(page.url, page);
  }

  const base = config.base;
  for (const page of pages) {
    const resolveLink = (href: string) => {
      if (externalUrl.test(href)) {
        return href;
      }
      if (href.startsWith("/")) {
        return base + href.slice(1);
      }
      const target = new URL(href, `file:///${page.source}`);
      const path = decodeURIComponent(target.pathname).slice(1);
      if (path.endsWith(".md")) {
        const linked = bySource.get(path);
        if (!linked) {
          warnings.push(`${page.source}: broken link to ${href}`);
          return href;
        }
        return base + linked.url.slice(1) + target.hash;
      }
      if (!files.has("/" + path) && !pageByUrl.has("/" + path)) {
        warnings.push(`${page.source}: missing file ${href}`);
      }
      return base + path + target.search + target.hash;
    };
    const rendered = renderMarkdown(page.markdown, resolveLink);
    const segments = page.slug.split("/");
    const fallbackTitle = page.slug === "index" ? config.title : titleCase(segments.at(isIndex(page.slug) ? -2 : -1)!);
    page.title ||= rendered.title ?? fallbackTitle;
    page.hasTitleHeading = rendered.title !== undefined;
    page.html = rendered.html;
    page.headings = rendered.headings;
    page.sections = rendered.sections;
    page.markdown = ensureTitleHeading(page.markdown, page.title, page.hasTitleHeading);
    if (page.resources.length > 0) {
      page.headings.push({ level: 2, id: "resources", text: "Resources" });
      page.sections.push({
        id: "resources",
        heading: "Resources",
        text: page.resources.map((resource) => `${resource.title} ${resource.description}`).join(" "),
      });
      const list = page.resources.map((resource) => {
        const link = `[${resource.title}](${resourceUrl(config, resource.skillFile ?? resource.path)})`;
        const archive = resource.archivePath ? `, download: ${resourceUrl(config, resource.archivePath)}` : "";
        return `- ${link} (${resource.kind}${archive})${resource.description ? `: ${resource.description}` : ""}`;
      });
      page.markdown = `${page.markdown.trimEnd()}\n\n## Resources\n\n${list.join("\n")}\n`;
    }
    if (page.tags.length > 0) {
      page.markdown = `${page.markdown.trimEnd()}\n\nTags: ${page.tags.join(", ")}\n`;
    }
  }

  const bySlug = new Map(pages.map((page) => [page.slug, page]));
  for (const action of config.home?.actions ?? []) {
    if (action.url.endsWith(".md") && !bySource.has(action.url.replace(/^\.?\//, ""))) {
      warnings.push(`docs.yaml: home action "${action.label}" links to a missing page: ${action.url}`);
    }
  }

  const categories = buildCategories(pages, folders, bySlug, config.sidebar.dropdowns);
  const navPages = categories.flatMap((category) => category.pages);

  if (config.theme.stylesheet && !(await Bun.file(config.theme.stylesheet).exists())) {
    throw new Error(`docs.yaml: theme.stylesheet not found: ${config.theme.stylesheet}`);
  }
  const publicPath = config.base + "_assets/";
  const [layout, stylesheet] = await Promise.all([
    bundleLayout(publicPath),
    config.theme.stylesheet ? bundle(config.theme.stylesheet, publicPath) : undefined,
  ]);
  for (const [name, asset] of [...layout.assets, ...(stylesheet?.assets ?? [])]) {
    files.set("/_assets/" + name, { ...asset, immutable: true });
  }
  const template = layout.entry;
  const customStylesheet = stylesheet?.entry;

  return { config, pages, pageByUrl, categories, navPages, files, template, customStylesheet, warnings };
}
