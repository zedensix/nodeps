import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { findPreset, presets } from "./presets.ts";

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

export interface Theme {
  preset: string;
  accent: string;
  tokens: Record<string, string>;
  light: Record<string, string>;
  dark: Record<string, string>;
  stylesheet?: string;
}

export const gitProviders = { github: "GitHub", gitlab: "GitLab", gitea: "Gitea", bitbucket: "Bitbucket" } as const;
export type GitProvider = keyof typeof gitProviders;

export interface Repository {
  url: string;
  provider: GitProvider;
  branch: string;
  path: string;
  edit: boolean;
  label: string;
}

const knownHosts: Record<string, GitProvider> = {
  "github.com": "github",
  "gitlab.com": "gitlab",
  "bitbucket.org": "bitbucket",
  "codeberg.org": "gitea",
  "gitea.com": "gitea",
};

export function editUrl(repository: Repository, source: string) {
  const file = [repository.path, source].filter(Boolean).join("/");
  const { url, branch } = repository;
  switch (repository.provider) {
    case "github":
      return `${url}/edit/${branch}/${file}`;
    case "gitlab":
      return `${url}/-/edit/${branch}/${file}`;
    case "gitea":
      return `${url}/_edit/${branch}/${file}`;
    case "bitbucket":
      return `${url}/src/${branch}/${file}?mode=edit`;
  }
}

export interface Editor {
  enabled: boolean;
  oauth?: { clientId: string; clientSecret: string; scope: string };
}

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
  repository?: Repository;
  footer?: string;
  links: Link[];
  home?: Home;
  sidebar: { dropdowns: boolean; bylines: boolean };
  diataxis: { badge: boolean };
  editor: Editor;
  theme: Theme;
}

export class ConfigError extends Error {}

type Mapping = Record<string, unknown>;

function fail(key: string, expected: string): never {
  throw new ConfigError(`"${key}" must be ${expected}`);
}

function readString(mapping: Mapping, key: string, path = key): string | undefined {
  const value = mapping[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    fail(path, "a string");
  }
  return value;
}

function readBoolean(mapping: Mapping, key: string, path: string, fallback: boolean): boolean {
  const value = mapping[key] ?? fallback;
  if (typeof value !== "boolean") {
    fail(path, "true or false");
  }
  return value;
}

function readMapping(mapping: Mapping, key: string, path = key): Mapping | undefined {
  const value = mapping[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    fail(path, "a mapping");
  }
  return value as Mapping;
}

function readLinks(mapping: Mapping, key: string, path = key): Link[] {
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

const unsafeCss = /[<>{};]/;

function readTokens(mapping: Mapping, path: string): Record<string, string> {
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
    tokens[name] = String(value);
  }
  return tokens;
}

function readRepository(data: Mapping, root: string, source: string): Repository | undefined {
  const value = data.repository;
  if (value === undefined || value === null) {
    return undefined;
  }
  const mapping: Mapping = typeof value === "string" ? { url: value } : (readMapping(data, "repository") ?? {});
  const rawUrl = readString(mapping, "url", "repository.url");
  if (!rawUrl || !URL.canParse(rawUrl)) {
    fail("repository.url", "the web URL of the repository, like https://github.com/acme/acme");
  }
  const url = rawUrl.replace(/\/+$/, "").replace(/\.git$/, "");
  const host = new URL(url).host;
  const provider = readString(mapping, "provider", "repository.provider") ?? knownHosts[host];
  if (!provider || !(provider in gitProviders)) {
    fail(
      "repository.provider",
      `one of ${Object.keys(gitProviders).join(", ")}${knownHosts[host] ? "" : ` (it cannot be guessed from ${host})`}`,
    );
  }
  const edit = mapping.edit ?? false;
  if (typeof edit !== "boolean") {
    fail("repository.edit", "true or false");
  }
  return {
    url,
    provider: provider as GitProvider,
    branch: readString(mapping, "branch", "repository.branch") ?? "main",
    path: (readString(mapping, "path", "repository.path") ?? relative(root, source).split("\\").join("/")).replace(
      /^\/+|\/+$/g,
      "",
    ),
    edit,
    label: new URL(url).pathname.replace(/^\/+/, ""),
  };
}

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

function contains(parent: string, child: string) {
  const path = relative(parent, child);
  return !path.startsWith("..") && !isAbsolute(path);
}

function normalizeBase(base: string) {
  return ("/" + base + "/").replace(/\/+/g, "/");
}

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
  const presetName = readString(themeMapping, "preset", "theme.preset") ?? "default";
  const preset = findPreset(presetName);
  if (!preset) {
    fail("theme.preset", `one of ${presets.map((candidate) => candidate.name).join(", ")}`);
  }
  const userAccent = readString(themeMapping, "accent", "theme.accent");
  if (userAccent && !Bun.color(userAccent, "css")) {
    fail("theme.accent", "a CSS color");
  }
  const stylesheet = readString(themeMapping, "stylesheet", "theme.stylesheet");
  const { light, dark, accent: _accent, stylesheet: _stylesheet, preset: _preset, ...tokens } = themeMapping;
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
    repository: readRepository(data, root, source),
    editor: readEditor(data),
    footer: readString(data, "footer"),
    links: readLinks(data, "links"),
    home,
    sidebar: { dropdowns, bylines },
    diataxis: { badge: readBoolean(readMapping(data, "diataxis") ?? {}, "badge", "diataxis.badge", true) },
    theme: {
      preset: preset.name,
      accent: userAccent ?? preset.accent,
      tokens: { ...preset.tokens, ...readTokens(tokens, "theme") },
      light: { ...preset.light, ...readTokens(readMapping(themeMapping, "light", "theme.light") ?? {}, "theme.light") },
      dark: { ...preset.dark, ...derivedDarkAccent, ...userDark },
      stylesheet: stylesheet ? resolve(root, stylesheet) : undefined,
    },
  };
}

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
