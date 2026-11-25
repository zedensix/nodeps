import { stat } from "node:fs/promises";
import { basename, posix } from "node:path";
import type { Config } from "../config/config.ts";
import {
  diataxisKind,
  folderFile,
  readFolderSettings,
  type DiataxisKind,
  type FolderSettings,
} from "./folder-settings.ts";
import { ensureIcons } from "../icons/icon-download.ts";
import { iconDirectory, isIcon, normalizeIcon } from "../icons/icons.ts";
import { buildCategories, buildCategoriesFromNav, type Category } from "./navigation.ts";
import {
  ensureTitleHeading,
  frontmatterDate,
  isIndex,
  lastCommitDates,
  markdownUrlOf,
  pageUrl,
  readTags,
  titleCase,
} from "./pages.ts";
import { addBrandImages } from "./brand-images.ts";
import { addArchives, addSkillIndexes, servedFolders, type Draft } from "./resource-folders.ts";
import { insideSkill, resolveResources, resourcesMarkdown, skillDirectories, type Resource } from "./resources.ts";
import { bundleSiteTheme, embeddedTheme } from "../theme/theme.ts";
import { parseFrontmatter, renderMarkdown, type Heading, type Section } from "../markdown/markdown.ts";

export interface Page {
  source: string;
  slug: string;
  url: string;
  markdownUrl: string;
  title: string;
  description: string;
  icon?: string;
  byline?: string;
  diataxis?: DiataxisKind;
  tags: string[];
  hide: string[];
  order: number;
  updated: Date;
  category?: Category;
  trail: string[];
  resources: Resource[];
  markdown: string;
  raw: string;
  html: string;
  hasTitleHeading: boolean;
  headings: Heading[];
  sections: Section[];
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
  stylesheets: string[];
  fontPreload?: { href: string; type: string };
  warnings: string[];
}

const externalUrl = /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i;

/**
 * Builds the public URL of a source file under the site base, encoding each
 * path segment but keeping the slashes.
 */
export function resourceUrl(config: Config, path: string) {
  return config.base + path.split("/").map(encodeURIComponent).join("/");
}

/**
 * Reads the source directory into a Site: parses every page, resolves links
 * and resources, builds the navigation and bundles the theme. Invalid pages
 * throw together in one error; broken links and missing files only warn.
 */
export async function loadSite(config: Config): Promise<Site> {
  if (!embeddedTheme) {
    await ensureIcons(iconDirectory);
  }
  if (!(await stat(config.source).catch(() => null))?.isDirectory()) {
    throw new Error(`Source directory not found: ${config.source}`);
  }

  const files = new Map<string, Asset>();
  const folders = new Map<string, FolderSettings>();
  const drafts: Draft[] = [];

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
    const raw = await file.text();
    drafts.push({ source: path, modified: (await file.stat()).mtime, raw, ...parseFrontmatter(raw, path) });
  }
  addSkillIndexes(drafts, skills, config.source);
  const served = servedFolders(drafts, sourcePaths, skills);
  const pageDrafts = drafts.filter((draft) => !insideSkill(draft.source, served));
  for (const { source } of drafts.filter((draft) => insideSkill(draft.source, served))) {
    const file = Bun.file(`${config.source}/${source}`);
    files.set("/" + source, { body: file, type: file.type, immutable: false });
    assetPaths.add(source);
  }

  const warnings: string[] = [];
  const bySource = new Map<string, Page>();
  const committed = await lastCommitDates(config.source);
  const problems: string[] = [];
  /**
   * Finds the Diataxis kind of the nearest folder above a page whose
   * `_folder.yaml` sets one.
   */
  const folderKind = (source: string) => {
    for (let folder = posix.dirname(source); ; folder = posix.dirname(folder)) {
      const kind = folders.get(folder === "." ? "" : folder)?.diataxis;
      if (kind || folder === ".") {
        return kind;
      }
    }
  };
  const pages = pageDrafts.map(({ source, modified, raw, data, body }) => {
    if (data.icon != null && (typeof data.icon !== "string" || !isIcon(normalizeIcon(data.icon)))) {
      problems.push(
        `${source}: frontmatter "icon" is not a known icon: "${data.icon}" (a Lucide icon name, see https://lucide.dev/icons)`,
      );
    }
    if (data.byline != null && typeof data.byline !== "string") {
      problems.push(`${source}: frontmatter "byline" must be text`);
    }
    if (data.diataxis != null && !diataxisKind(data.diataxis)) {
      warnings.push(
        `${source}: frontmatter "diataxis" is not tutorials, how-to, reference or explanation: "${String(data.diataxis)}", so it was ignored`,
      );
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
      icon: typeof data.icon === "string" ? normalizeIcon(data.icon) : undefined,
      byline: typeof data.byline === "string" ? data.byline.trim() || undefined : undefined,
      diataxis:
        diataxisKind(data.diataxis) ?? diataxisKind(/\.([a-z-]+)\.md$/i.exec(source)?.[1]) ?? folderKind(source),
      tags: readTags(data.tags, source, problems),
      hide: Array.isArray(data.hide) ? data.hide.map(String) : [],
      order: typeof data.order === "number" ? data.order : Infinity,
      updated: frontmatterDate(data.updated) ?? committed.get(source) ?? modified,
      markdown: body,
      raw,
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
      pageDrafts[index]!.data,
      page.source,
      config.source,
      assetPaths,
      skills,
      problems,
    );
    await addArchives(page.resources, config.source, assetPaths, files);
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
      const path = decodeURIComponent(target.pathname)
        .slice(1)
        .replace(/\.md\/$/, ".md");
      if (path.endsWith(".md") && !files.has("/" + path)) {
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
    const rendered = renderMarkdown(page.markdown, resolveLink, {
      root: config.root,
      sourceDirectory: config.source,
      pageSource: page.source,
      warnings,
    });
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
      page.markdown = page.markdown.trimEnd() + resourcesMarkdown(page.resources, (path) => resourceUrl(config, path));
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

  const categories = config.nav
    ? buildCategoriesFromNav(config.nav, bySource, config, warnings)
    : buildCategories(pages, folders, bySlug, config.sidebar.dropdowns);
  const navPages = categories.flatMap((category) => category.pages);

  addBrandImages(config, files);

  const { assets, ...theme } = await bundleSiteTheme(config.theme, config.base + "_assets/");
  for (const [name, asset] of assets) {
    files.set("/_assets/" + name, { ...asset, immutable: true });
  }
  return { config, pages, pageByUrl, categories, navPages, files, ...theme, warnings };
}
