import { existsSync } from "node:fs";
import { extname, resolve } from "node:path";
import type { Link, NavEntry } from "./config.ts";

export class ConfigError extends Error {}

export type Mapping = Record<string, unknown>;

/**
 * Throws a ConfigError naming the offending key and what it should have
 * been. Typed `never` so callers can use it after `??`.
 */
export function fail(key: string, expected: string): never {
  throw new ConfigError(`"${key}" must be ${expected}`);
}

/**
 * Reads an optional string. `path` is the dotted key shown in errors when the
 * mapping is nested; null counts as absent.
 */
export function readString(mapping: Mapping, key: string, path = key): string | undefined {
  const value = mapping[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    fail(path, "a string");
  }
  return value;
}

/**
 * Reads a boolean, using `fallback` when the key is absent.
 */
export function readBoolean(mapping: Mapping, key: string, path: string, fallback: boolean): boolean {
  const value = mapping[key] ?? fallback;
  if (typeof value !== "boolean") {
    fail(path, "true or false");
  }
  return value;
}

/**
 * Reads an optional nested mapping, rejecting lists and scalars.
 */
export function readMapping(mapping: Mapping, key: string, path = key): Mapping | undefined {
  const value = mapping[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    fail(path, "a mapping");
  }
  return value as Mapping;
}

/**
 * Reads a list of `{ label, url }` entries, both required. An absent key
 * gives an empty list.
 */
export function readLinks(mapping: Mapping, key: string, path = key): Link[] {
  const value = mapping[key];
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    fail(path, "a list of { label, url } entries");
  }
  return value.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      fail(`${path}[${index}]`, "a mapping with label and url");
    }
    return {
      label: readString(entry, "label", `${path}[${index}].label`) ?? fail(`${path}[${index}].label`, "a string"),
      url: readString(entry, "url", `${path}[${index}].url`) ?? fail(`${path}[${index}].url`, "a string"),
    };
  });
}

/**
 * Reads the `social` list. The label defaults to the URL's hostname without
 * `www.`, so an entry only needs an icon and a URL.
 */
export function readSocial(data: Mapping) {
  const value = data.social;
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    fail("social", "a list of { icon, url, label } entries");
  }
  return value.map((entry, index) => {
    const path = `social[${index}]`;
    if (typeof entry !== "object" || entry === null) {
      fail(path, "a mapping with icon and url");
    }
    const url = readString(entry, "url", `${path}.url`) ?? fail(`${path}.url`, "a URL");
    return {
      icon:
        readString(entry, "icon", `${path}.icon`) ??
        fail(`${path}.icon`, "an icon name, like fontawesome/brands/github"),
      url,
      label: readString(entry, "label", `${path}.label`) ?? new URL(url).hostname.replace(/^www\./, ""),
    };
  });
}

const unsafeCss = /[<>{};]/;

/**
 * Reads CSS custom property overrides. Names and values are checked because
 * they are written straight into a `<style>` tag: a value with `<`, `{` or
 * `;` could break out of the declaration.
 */
export function readTokens(mapping: Mapping, path: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const [name, value] of Object.entries(mapping)) {
    if (typeof value !== "string" && typeof value !== "number") {
      fail(`${path}.${name}`, "a CSS value");
    }
    if (!/^[a-z][a-z0-9-]*$/i.test(name)) {
      fail(`${path}.${name}`, "a token name made of letters, digits and dashes");
    }
    if (unsafeCss.test(String(value))) {
      fail(`${path}.${name}`, "a CSS value without < > { } ;");
    }
    if (String(value).split("(").length !== String(value).split(")").length) {
      fail(
        `${path}.${name}`,
        'a CSS value with balanced parentheses (quote a value holding " #": YAML reads the rest as a comment)',
      );
    }
    tokens[name] = String(value);
  }
  return tokens;
}

/**
 * Reads the `nav` list recursively: each entry is a page path, a
 * `Title: target` link or a `Section: [...]` group of more entries.
 */
export function readNav(value: unknown, path: string): NavEntry[] {
  if (!Array.isArray(value)) {
    fail(path, "a list of pages, `Title: page.md` entries or `Section: [...]` entries");
  }
  return value.map((entry, index) => {
    if (typeof entry === "string") {
      return entry;
    }
    if (typeof entry !== "object" || entry === null || Object.keys(entry).length !== 1) {
      fail(`${path}[${index}]`, "a page path or a single `Title: target` mapping");
    }
    const [title, target] = Object.entries(entry)[0]!;
    if (typeof target === "string") {
      return { [title]: target };
    }
    return { [title]: readNav(target, `${path}[${index}].${title}`) };
  });
}

export interface FontFile {
  path: string;
  format: string;
  weight?: string;
  style?: string;
}

export interface FontSetting {
  role: "font" | "mono";
  family: string;
  files: FontFile[];
}

const fontFormats: Record<string, string> = { woff2: "woff2", woff: "woff", ttf: "truetype", otf: "opentype" };

/**
 * Reads the mapping form of `theme.font` or `theme.mono`: a `family` and a
 * `file`, either one path with an optional `weight` and `style` or a list of
 * `{ path, weight, style }` for static fonts. Paths resolve against `root`;
 * a missing file or an unknown format fails with the setting and the path.
 */
export function readFont(value: Mapping, role: "font" | "mono", root: string): FontSetting {
  const path = `theme.${role}`;
  const family = readString(value, "family", `${path}.family`) ?? fail(`${path}.family`, "a font family name");
  const single = typeof value.file === "string";
  const entries: unknown[] = single
    ? [{ path: value.file, weight: value.weight, style: value.style }]
    : Array.isArray(value.file)
      ? value.file
      : fail(`${path}.file`, "a font file path, or a list of { path, weight, style }");
  const files = entries.map((entry, index) => {
    const at = single ? `${path}.file` : `${path}.file[${index}]`;
    const mapping = (typeof entry === "string" ? { path: entry } : entry) as Mapping;
    const file = readString(mapping, "path", `${at}.path`) ?? fail(at, "a font file path");
    const format =
      fontFormats[extname(file).slice(1).toLowerCase()] ?? fail(at, `a .woff2, .woff, .ttf or .otf file, got ${file}`);
    if (!existsSync(resolve(root, file))) {
      fail(at, `an existing file, not found: ${file}`);
    }
    const [weight, style] = [mapping.weight, mapping.style].map((part) =>
      part === undefined ? undefined : String(part),
    );
    if ([weight, style].some((part) => part !== undefined && !/^[\w .-]+$/.test(part))) {
      fail(at, "a weight like 400 or 300 700, and a style like normal or italic");
    }
    return { path: resolve(root, file), format, weight, style };
  });
  return { role, family, files };
}
