import type { Config, NavEntry } from "../config/config.ts";
import type { DiataxisKind, FolderSettings } from "./folder-settings.ts";
import { isIndex, titleCase } from "./pages.ts";
import type { Page } from "./site.ts";

export interface NavFolder {
  kind: "folder";
  folder: string;
  title: string;
  icon?: string;
  index?: Page;
  dropdown: boolean;
  children: NavItem[];
}

export type NavItem =
  { kind: "page"; page: Page; label?: string } | { kind: "link"; title: string; url: string } | NavFolder;

export interface Category {
  folder: string;
  title: string;
  icon?: string;
  description?: string;
  diataxis?: DiataxisKind;
  items: NavItem[];
  pages: Page[];
}

/**
 * Builds the sidebar from the `nav` list in docs.yaml. Top-level sections
 * become categories, loose entries are gathered into a leading "Home"
 * category, and entries that match no page are dropped with a warning.
 */
export function buildCategoriesFromNav(
  nav: NavEntry[],
  bySource: Map<string, Page>,
  config: Config,
  warnings: string[],
): Category[] {
  const flatten = (items: NavItem[]): Page[] =>
    items.flatMap((item) =>
      item.kind === "page"
        ? [item.page]
        : item.kind === "link"
          ? []
          : [...(item.index ? [item.index] : []), ...flatten(item.children)],
    );
  const entryItems = (entries: NavEntry[], trail: string[]): NavItem[] =>
    entries.flatMap((entry): NavItem[] => {
      const [title, target] =
        typeof entry === "string" ? [undefined, entry] : (Object.entries(entry)[0] as [string, string | NavEntry[]]);
      if (typeof target === "string") {
        if (/^[a-z][a-z\d+.-]*:/i.test(target)) {
          return [{ kind: "link", title: title ?? target, url: target }];
        }
        const page = bySource.get(target.replace(/^\.?\//, ""));
        if (!page) {
          warnings.push(`docs.yaml: nav entry "${target}" does not match a page`);
          return [];
        }
        page.trail = trail;
        return [{ kind: "page", page, label: title }];
      }
      const children = entryItems(target, [...trail, title!]);
      const first = children[0];
      const index = first?.kind === "page" && /(^|\/)index\.md$/.test(first.page.source) ? first.page : undefined;
      return [
        {
          kind: "folder",
          folder: title!,
          title: title!,
          index,
          dropdown: config.sidebar.dropdowns,
          children: index ? children.slice(1) : children,
        },
      ];
    });

  const loose: NavEntry[] = [];
  const categories: Category[] = [];
  for (const entry of nav) {
    const target = typeof entry === "string" ? entry : Object.values(entry)[0];
    if (Array.isArray(target)) {
      const title = Object.keys(entry as object)[0]!;
      const items = entryItems(target, []);
      categories.push({ folder: title, title, items, pages: flatten(items) });
    } else {
      loose.push(entry);
    }
  }
  if (loose.length > 0) {
    const items = entryItems(loose, []);
    categories.unshift({ folder: "", title: "Home", items, pages: flatten(items) });
  }
  for (const category of categories) {
    for (const page of category.pages) {
      page.category = category;
    }
  }
  return categories;
}

/**
 * Builds the sidebar from the folder tree when docs.yaml has no `nav`. Each
 * top-level folder is a category; within it the index page comes first, then
 * items sort by `order`, pages before folders, then title.
 */
export function buildCategories(
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
