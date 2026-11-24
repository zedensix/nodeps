import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ConfigError, fail, readMapping, readString, readTokens, type Mapping } from "../config/config-fields.ts";
import { titleCase } from "../site/pages.ts";
import { sourceRoot } from "./theme.ts";

export interface ThemeVariables {
  accent: string;
  tokens: Record<string, string>;
  light: Record<string, string>;
  dark: Record<string, string>;
}

export interface ThemeDefinition extends ThemeVariables {
  name: string;
  title: string;
  description: string;
  directories: string[];
}

/**
 * Folder holding the themes nodeps ships: next to the sources when running
 * from a checkout, unpacked from the binary otherwise.
 */
function builtinDirectory() {
  return join(sourceRoot(), "themes");
}

/**
 * Lists the theme folders inside a directory, or nothing when it is missing.
 */
function themeNames(directory: string) {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

/**
 * Parses a theme folder's `theme.yaml`, or gives an empty mapping when the
 * folder only overrides files.
 */
function readThemeFile(directory: string, path: string): Mapping {
  const file = join(directory, "theme.yaml");
  if (!existsSync(file)) {
    return {};
  }
  const data = Bun.YAML.parse(readFileSync(file, "utf8")) ?? {};
  if (typeof data !== "object" || Array.isArray(data)) {
    fail(path, "a mapping");
  }
  return data as Mapping;
}

/**
 * Resolves a theme by name: the site's `themes/<name>` folder is layered over
 * the built-in one of the same name, then over the theme it `extends`
 * (`default` unless it says otherwise). Variables merge key by key; files are
 * looked up in `directories`, most specific first.
 */
export function resolveTheme(name: string, userDirectory: string, chain: string[] = []): ThemeDefinition {
  if (chain.includes(name)) {
    throw new ConfigError(`themes: ${[...chain, name].join(" extends ")} is a loop`);
  }
  const directories = [join(userDirectory, name), join(builtinDirectory(), name)].filter(existsSync);
  if (!/^[\w-]+$/.test(name) || directories.length === 0) {
    const known = [...new Set([...themeNames(builtinDirectory()), ...themeNames(userDirectory)])].sort();
    fail(chain.length > 0 ? `themes/${chain.at(-1)}/theme.yaml: extends` : "theme.name", `one of ${known.join(", ")}`);
  }
  const path = `themes/${name}/theme.yaml`;
  const layers = directories.map((directory) => readThemeFile(directory, path)).reverse();
  const pick = (key: string) => layers.map((layer) => readString(layer, key, `${path}: ${key}`)).findLast(Boolean);
  const parentName = pick("extends") ?? (name === "default" ? undefined : "default");
  const parent = parentName ? resolveTheme(parentName, userDirectory, [...chain, name]) : undefined;
  const section = (key: string, field: "tokens" | "light" | "dark") =>
    Object.assign(
      {},
      parent?.[field],
      ...layers.map((layer) => readTokens(readMapping(layer, key, `${path}: ${key}`) ?? {}, `${path}: ${key}`)),
    ) as Record<string, string>;
  const accent = pick("accent") ?? parent?.accent;
  if (!accent || !Bun.color(accent, "css")) {
    fail(`${path}: accent`, "a CSS color");
  }
  return {
    name,
    title: pick("title") ?? titleCase(name),
    description: pick("description") ?? "",
    accent,
    tokens: section("variables", "tokens"),
    light: section("light", "light"),
    dark: section("dark", "dark"),
    directories: [...directories, ...(parent?.directories ?? [])],
  };
}

/**
 * Every theme a reader can pick in the header: the built-in ones plus the
 * site's own, `default` first and the rest by name.
 */
export function listThemes(userDirectory: string) {
  const names = [...new Set([...themeNames(builtinDirectory()), ...themeNames(userDirectory)])].sort((left, right) =>
    left === "default" ? -1 : right === "default" ? 1 : left.localeCompare(right),
  );
  return names.map((name) => resolveTheme(name, userDirectory));
}
