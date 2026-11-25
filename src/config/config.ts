import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import {
  ConfigError,
  fail,
  readBoolean,
  readLinks,
  readMapping,
  readNav,
  readSocial,
  readString,
  readTokens,
  type Mapping,
} from "./config-fields.ts";
import { listThemes, resolveTheme, type ThemeDefinition } from "../theme/themes.ts";
import { readRepository, type Repository } from "./repository.ts";

export interface Link {
  label: string;
  url: string;
}

export interface Home {
  headline: string;
  tagline: string;
  actions: Link[];
  latest: number;
}

export interface Theme extends ThemeDefinition {
  stylesheet?: string;
  choices: ThemeDefinition[];
}

export interface Editor {
  enabled: boolean;
  oauth?: { clientId: string; clientSecret: string; scope: string };
}

export type NavEntry = string | { [title: string]: string | NavEntry[] };

export interface Config {
  file: string;
  root: string;
  title: string;
  description: string;
  url?: string;
  base: string;
  source: string;
  output: string;
  logo?: string;
  favicon?: string;
  repository?: Repository;
  footer?: string;
  links: Link[];
  social: { icon: string; url: string; label: string }[];
  home?: Home;
  nav?: NavEntry[];
  sidebar: { dropdowns: boolean; bylines: boolean };
  diataxis: { badge: boolean };
  readerMode: boolean;
  editor: Editor;
  theme: Theme;
}

/**
 * Reads the `editor` section. OAuth is only set up when a client id is given
 * (in the file or NODEPS_OAUTH_CLIENT_ID); the secret must come from the
 * environment, and OAuth needs a GitHub repository and a site `url`.
 */
function readEditor(data: Mapping): Editor {
  const mapping = readMapping(data, "editor") ?? {};
  const enabled = readBoolean(mapping, "enabled", "editor.enabled", true);
  const oauthMapping = readMapping(mapping, "oauth", "editor.oauth");
  const clientId =
    (oauthMapping && readString(oauthMapping, "client_id", "editor.oauth.client_id")) ?? Bun.env.NODEPS_OAUTH_CLIENT_ID;
  if (!enabled || !clientId) {
    return { enabled };
  }
  if (oauthMapping?.client_secret !== undefined) {
    fail(
      "editor.oauth.client_secret",
      "set in the NODEPS_OAUTH_CLIENT_SECRET environment variable, never in a committed file",
    );
  }
  const clientSecret = Bun.env.NODEPS_OAUTH_CLIENT_SECRET;
  if (!clientSecret) {
    fail("editor.oauth.client_id", "paired with the NODEPS_OAUTH_CLIENT_SECRET environment variable");
  }
  const repository = readRepository(data, "", "");
  if (repository?.provider !== "github") {
    fail("editor.oauth", "used with a GitHub repository (other providers publish through their web editor)");
  }
  if (!readString(data, "url")) {
    fail("url", "set when editor.oauth is enabled, to build the OAuth callback URL");
  }
  const scope = (oauthMapping && readString(oauthMapping, "scope", "editor.oauth.scope")) ?? "public_repo";
  return { enabled, oauth: { clientId, clientSecret, scope } };
}

/**
 * Tells whether `child` is `parent` itself or somewhere inside it.
 */
function contains(parent: string, child: string) {
  const path = relative(parent, child);
  return !path.startsWith("..") && !isAbsolute(path);
}

/**
 * Gives the base path a leading and trailing slash and collapses doubled
 * slashes, so URLs can be built by plain concatenation.
 */
function normalizeBase(base: string) {
  return ("/" + base + "/").replace(/\/+/g, "/");
}

/**
 * Turns the parsed YAML into a Config with defaults filled in and paths made
 * absolute. Refuses an output directory that holds the source or the config
 * file, since the build wipes it.
 */
function parseConfig(file: string, data: Mapping): Config {
  const root = dirname(file);
  const source = resolve(root, readString(data, "source") ?? "docs");
  const output = resolve(root, readString(data, "output") ?? "dist");
  if (contains(output, source) || contains(output, root)) {
    fail("output", "a directory that does not contain the source or the config file, since it is wiped on build");
  }
  if (contains(source, output)) {
    fail("output", "a directory outside the source directory");
  }

  const url = readString(data, "url")?.replace(/\/+$/, "");
  if (url && !URL.canParse(url)) {
    fail("url", "an absolute URL like https://docs.example.com");
  }

  const homeMapping = readMapping(data, "home");
  let home: Home | undefined;
  if (homeMapping) {
    const latest = homeMapping.latest ?? 3;
    if (typeof latest !== "number" || !Number.isInteger(latest) || latest < 0) {
      fail("home.latest", "a whole number");
    }
    home = {
      headline: readString(homeMapping, "headline", "home.headline") ?? readString(data, "title") ?? "Documentation",
      tagline: readString(homeMapping, "tagline", "home.tagline") ?? readString(data, "description") ?? "",
      actions: readLinks(homeMapping, "actions", "home.actions"),
      latest,
    };
  }

  const sidebarMapping = readMapping(data, "sidebar") ?? {};
  const dropdowns = sidebarMapping.dropdowns ?? true;
  if (typeof dropdowns !== "boolean") {
    fail("sidebar.dropdowns", "true or false");
  }
  const bylines = sidebarMapping.bylines ?? true;
  if (typeof bylines !== "boolean") {
    fail("sidebar.bylines", "true or false");
  }

  const themeMapping = readMapping(data, "theme") ?? {};
  const themesDirectory = resolve(root, "themes");
  const theme = resolveTheme(readString(themeMapping, "name", "theme.name") ?? "default", themesDirectory);
  const userAccent = readString(themeMapping, "accent", "theme.accent");
  if (userAccent && !Bun.color(userAccent, "css")) {
    fail("theme.accent", "a CSS color");
  }
  const stylesheet = readString(themeMapping, "stylesheet", "theme.stylesheet");
  const { light, dark, accent: _accent, stylesheet: _stylesheet, name: _name, ...tokens } = themeMapping;
  const userDark = readTokens(readMapping(themeMapping, "dark", "theme.dark") ?? {}, "theme.dark");
  const derivedDarkAccent =
    userAccent && !userDark.accent ? { accent: "color-mix(in oklab, var(--brand) 72%, white)" } : {};

  return {
    file,
    root,
    title: readString(data, "title") ?? "Documentation",
    description: readString(data, "description") ?? "",
    url,
    base: normalizeBase(readString(data, "base") ?? "/"),
    source,
    output,
    logo: readString(data, "logo"),
    favicon: readString(data, "favicon"),
    repository: readRepository(data, root, source),
    editor: readEditor(data),
    footer: readString(data, "footer"),
    links: readLinks(data, "links"),
    social: readSocial(data),
    home,
    sidebar: { dropdowns, bylines },
    nav: data.nav === undefined || data.nav === null ? undefined : readNav(data.nav, "nav"),
    readerMode: readBoolean(data, "reader_mode", "reader_mode", true),
    diataxis: { badge: readBoolean(readMapping(data, "diataxis") ?? {}, "badge", "diataxis.badge", true) },
    theme: {
      ...theme,
      accent: userAccent ?? theme.accent,
      tokens: { ...theme.tokens, ...readTokens(tokens, "theme") },
      light: { ...theme.light, ...readTokens(readMapping(themeMapping, "light", "theme.light") ?? {}, "theme.light") },
      dark: { ...theme.dark, ...derivedDarkAccent, ...userDark },
      stylesheet: stylesheet ? resolve(root, stylesheet) : undefined,
      choices: listThemes(themesDirectory),
    },
  };
}

/**
 * Loads and validates the config file. Validation errors are rethrown
 * prefixed with the file name; any other error passes through untouched.
 */
export async function loadConfig(path: string): Promise<Config> {
  const file = resolve(path);
  const configFile = Bun.file(file);
  if (!(await configFile.exists())) {
    throw new ConfigError(`No config file at ${file}. Create a docs.yaml or pass --config.`);
  }
  let data: unknown;
  try {
    data = Bun.YAML.parse(await configFile.text()) ?? {};
  } catch (error) {
    throw new ConfigError(`${basename(file)} is not valid YAML: ${(error as Error).message}`);
  }
  try {
    if (typeof data !== "object" || Array.isArray(data)) {
      fail("the document", "a mapping");
    }
    return parseConfig(file, data as Mapping);
  } catch (error) {
    if (error instanceof ConfigError) {
      throw new ConfigError(`${basename(file)}: ${error.message}`);
    }
    throw error;
  }
}
