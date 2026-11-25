import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type { NavEntry } from "../config/config.ts";

type Mapping = Record<string, unknown>;

const handledKeys = new Set(["nav", "title", "hide", "ignore", "append_unmatched", "sort", "order"]);

/**
 * Turns a folder name into the section title MkDocs shows when no `title` is
 * set: dashes and underscores become spaces, first letter capitalized.
 */
function folderTitle(name: string) {
  const words = name.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Reads a folder's `.nav.yml` (or `.nav.yaml`), or an empty mapping when it
 * has none. `file` is the path shown in warnings, starting at the docs folder.
 */
function readNavFile(directory: string, source: string) {
  for (const name of [".nav.yml", ".nav.yaml"]) {
    const path = join(directory, name);
    if (existsSync(path)) {
      const data = Bun.YAML.parse(readFileSync(path, "utf8")) ?? {};
      return {
        data: (typeof data === "object" && !Array.isArray(data) ? data : {}) as Mapping,
        file: relative(dirname(source), path),
      };
    }
  }
  return { data: {} as Mapping, file: "" };
}

/**
 * Translates the `.nav.yml` files of an awesome-nav docs tree into one
 * docs.yaml `nav` list in the same order. Keys and values it cannot express
 * become warnings naming the file and key. An expanded glob adds a comment for
 * the top of docs.yaml. Undefined when the tree has no `.nav.yml` file, so the
 * folder-based sidebar is kept.
 */
export function translateAwesomeNav(source: string, warnings: string[], comments: string[]): NavEntry[] | undefined {
  const navFiles = [...new Bun.Glob("**/.nav.{yml,yaml}").scanSync({ cwd: source, dot: true })];
  if (navFiles.length === 0) {
    return undefined;
  }
  const isPage = (path: string) => path.endsWith(".md");
  const isDirectory = (path: string) => existsSync(path) && statSync(path).isDirectory();

  /**
   * Lists a folder the way awesome-nav does by default: index.md first, then
   * pages and subfolders by name, minus hidden files and ignored names.
   */
  const listFolder = (directory: string, ignore: Bun.Glob | undefined, descending: boolean) => {
    const names = readdirSync(directory)
      .filter((name) => !name.startsWith(".") && !ignore?.match(name))
      .filter((name) => isPage(name) || isDirectory(join(directory, name)))
      .sort((left, right) => left.localeCompare(right));
    if (descending) {
      names.reverse();
    }
    const index = names.indexOf("index.md");
    return index > 0 ? ["index.md", ...names.filter((name) => name !== "index.md")] : names;
  };

  /**
   * Builds the entries of one folder: its `nav` list when it has one (plus
   * unlisted files with `append_unmatched`), otherwise its sorted listing.
   */
  const folderEntries = (directory: string): { title?: string; hidden: boolean; entries: NavEntry[] } => {
    const { data, file } = readNavFile(directory, source);
    for (const key of Object.keys(data).filter((key) => !handledKeys.has(key))) {
      warnings.push(`${file}: "${key}" is not translated. Check that section of the nav by hand.`);
    }
    const sort = (typeof data.sort === "object" && data.sort !== null ? data.sort : {}) as Mapping;
    const nav = Array.isArray(data.nav) ? data.nav : undefined;
    const sorted = !nav || data.append_unmatched === true;
    for (const key of Object.keys(sort).filter((key) => sorted && key !== "direction")) {
      warnings.push(
        `${file}: "sort.${key}" is not translated; entries are sorted by file name. Reorder them in docs.yaml nav if needed.`,
      );
    }
    const descending = sort.direction === "desc" || data.order === "desc";
    const ignore = typeof data.ignore === "string" ? new Bun.Glob(data.ignore) : undefined;
    const listed = new Set<string>();
    /**
     * Collects the paths a `nav` list names outright, at any depth, which a
     * glob in the same list leaves out as awesome-nav does.
     */
    const named = (entries: unknown[]): string[] =>
      entries.flatMap((entry) => {
        const target =
          typeof entry === "string"
            ? entry
            : typeof entry === "object" && entry !== null
              ? Object.values(entry)[0]
              : undefined;
        if (Array.isArray(target)) {
          return named(target);
        }
        return typeof target === "string" && !/[*?[]/.test(target) ? [join(directory, target.replace(/\/$/, ""))] : [];
      });
    const explicit = new Set(named(nav ?? []));

    /**
     * Translates one entry of a `nav` list, resolving pages and folders
     * against the folder that holds the `.nav.yml`.
     */
    const translate = (entry: unknown, base: string): NavEntry[] => {
      if (typeof entry === "string") {
        if (/^[a-z][a-z\d+.-]*:/i.test(entry)) {
          return [entry];
        }
        if (/[*?[]/.test(entry)) {
          const matches = [...new Bun.Glob(entry).scanSync({ cwd: base, onlyFiles: false })]
            .filter((match) => isPage(match) || isDirectory(join(base, match)))
            .filter((match) => !explicit.has(join(base, match)) && !listed.has(join(base, match)))
            .sort();
          warnings.push(
            matches.length > 0
              ? `${file}: glob "${entry}" was expanded to ${matches.length} entries in name order, leaving out those listed elsewhere in the file; pages added later are not picked up, so add them to docs.yaml nav.`
              : `${file}: glob "${entry}" matches nothing that is not already listed and was dropped.`,
          );
          if (matches.length > 0 && comments.length === 0) {
            comments.push(
              "nav: the globs of the .nav.yml files were expanded when migrating. This list is a snapshot: add new pages to it by hand.",
            );
          }
          return matches.flatMap((match) => translate(match, base));
        }
        return translate({ [""]: entry }, base);
      }
      if (typeof entry !== "object" || entry === null || Object.keys(entry).length !== 1) {
        warnings.push(
          `${file}: entry ${JSON.stringify(entry)} is not a page, folder or "Title: target" entry and was dropped.`,
        );
        return [];
      }
      const [title, target] = Object.entries(entry as Mapping)[0]!;
      if (Array.isArray(target)) {
        const children = target.flatMap((child) => translate(child, base));
        return children.length > 0 ? [{ [title]: children }] : [];
      }
      const path = join(base, String(target).replace(/\/$/, ""));
      listed.add(path);
      if (/^[a-z][a-z\d+.-]*:/i.test(String(target))) {
        return [title ? { [title]: String(target) } : String(target)];
      }
      if (isDirectory(path)) {
        const folder = folderEntries(path);
        const name = title || folder.title || folderTitle(relative(base, path));
        return folder.hidden || folder.entries.length === 0 ? [] : [{ [name]: folder.entries }];
      }
      if (!existsSync(path)) {
        warnings.push(`${file}: "${String(target)}" does not exist and was dropped.`);
        return [];
      }
      const page = relative(source, path);
      return [title ? { [title]: page } : page];
    };

    const entries = (nav ?? []).flatMap((entry) => translate(entry, directory));
    if (sorted) {
      for (const name of listFolder(directory, ignore, descending)) {
        if (!listed.has(join(directory, name))) {
          entries.push(...translate(name, directory));
        }
      }
    }
    return { title: typeof data.title === "string" ? data.title : undefined, hidden: data.hide === true, entries };
  };

  return folderEntries(source).entries;
}
