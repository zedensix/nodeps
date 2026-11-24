import { relative } from "node:path";
import { fail, readMapping, readString, type Mapping } from "./config-fields.ts";

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

/**
 * Builds the link to a page's source in the provider's web editor; each
 * provider spells the edit route differently.
 */
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

/**
 * Reads `repository`, given as a URL string or a mapping. The provider is
 * guessed from well-known hosts, and the docs path inside the repository
 * defaults to the source directory relative to the config file.
 */
export function readRepository(data: Mapping, root: string, source: string): Repository | undefined {
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
