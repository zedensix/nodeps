import { extname, posix } from "node:path";
import { isSupported } from "../markdown/highlight.ts";
import { parseFrontmatter } from "../markdown/markdown.ts";

export type ResourceKind = "skill" | "folder" | "code" | "document" | "file";

export interface Resource {
  title: string;
  path: string;
  kind: ResourceKind;
  extension: string;
  size: number;
  description: string;
  archivePath?: string;
  skillFile?: string;
  code?: string;
  files?: Resource[];
}

const documentExtensions = new Set([
  "pdf",
  "doc",
  "docx",
  "odt",
  "rtf",
  "xls",
  "xlsx",
  "ods",
  "csv",
  "ppt",
  "pptx",
  "odp",
  "epub",
]);
const codeExtensions = new Set([
  "txt",
  "md",
  "c",
  "h",
  "cpp",
  "hpp",
  "java",
  "kt",
  "rb",
  "php",
  "swift",
  "cs",
  "lua",
  "zig",
  "sh",
  "conf",
]);
const previewLimit = 100_000;

/**
 * Picks the icon shown next to a resource from its kind, then its extension
 * for common office and archive formats.
 */
export function resourceIcon(resource: Resource) {
  if (resource.kind === "skill") {
    return "brain-circuit";
  }
  if (resource.kind === "folder") {
    return "folder-code";
  }
  if (resource.kind === "code") {
    return "file-code";
  }
  if (["xls", "xlsx", "ods", "csv"].includes(resource.extension)) {
    return "file-spreadsheet";
  }
  if (["ppt", "pptx", "odp"].includes(resource.extension)) {
    return "presentation";
  }
  if (["doc", "docx", "odt", "rtf"].includes(resource.extension)) {
    return "file-type";
  }
  if (["zip", "tar", "gz", "tgz", "7z"].includes(resource.extension)) {
    return "file-archive";
  }
  if (resource.kind === "document") {
    return "file-text";
  }
  return "file";
}

/**
 * Formats a byte count for display, in B, KB or MB with one decimal.
 */
export function formatSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Finds the skill folders among the source paths: every directory holding a
 * SKILL.md. The source root itself shows up as `.`.
 */
export function skillDirectories(paths: string[]) {
  return new Set(paths.filter((path) => posix.basename(path) === "SKILL.md").map((path) => posix.dirname(path)));
}

/**
 * Tells whether a path belongs to a skill folder, so its Markdown files are
 * served as files instead of being rendered as pages.
 */
export function insideSkill(path: string, skills: Set<string>) {
  return [...skills].some((skill) => skill === "." || path.startsWith(skill + "/"));
}

interface ResourceEntry {
  path: string;
  title?: string;
  description?: string;
}

/**
 * Normalizes the frontmatter `resources` list, where each entry is a path or a
 * `{ path, title, description }` mapping. Bad entries are reported in
 * `problems` and skipped.
 */
export function readEntries(value: unknown, source: string, problems: string[]): ResourceEntry[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    problems.push(`${source}: frontmatter "resources" must be a list`);
    return [];
  }
  return value.flatMap((entry, index) => {
    if (typeof entry === "string") {
      return [{ path: entry }];
    }
    if (typeof entry === "object" && entry !== null && typeof entry.path === "string") {
      return [
        {
          path: entry.path,
          title: typeof entry.title === "string" ? entry.title : undefined,
          description: typeof entry.description === "string" ? entry.description : undefined,
        },
      ];
    }
    problems.push(`${source}: resources[${index}] must be a path or a mapping with a "path"`);
    return [];
  });
}

/**
 * Describes one file: a kind from its extension and, for small code files,
 * its text for the preview.
 */
async function describeFile(sourceDirectory: string, path: string, title: string, description: string) {
  const file = Bun.file(`${sourceDirectory}/${path}`);
  const extension = extname(path).slice(1).toLowerCase();
  const kind: ResourceKind = documentExtensions.has(extension)
    ? "document"
    : isSupported(extension) || codeExtensions.has(extension)
      ? "code"
      : "file";
  return {
    title,
    path,
    kind,
    extension,
    size: file.size,
    description,
    code: kind === "code" && file.size <= previewLimit ? await file.text() : undefined,
  } satisfies Resource;
}

/**
 * Resolves a page's resources relative to the page and describes each one. A
 * folder gets its files, total size and a tarball path; a skill folder also
 * gets its SKILL.md metadata; a file gets a kind from its extension and, for
 * small code files, its text for the preview. Missing or out-of-source paths
 * are reported in `problems`.
 */
export async function resolveResources(
  frontmatter: Record<string, unknown>,
  pageSource: string,
  sourceDirectory: string,
  files: Set<string>,
  skills: Set<string>,
  problems: string[],
): Promise<Resource[]> {
  const resources: Resource[] = [];
  for (const entry of readEntries(frontmatter.resources, pageSource, problems)) {
    const path = posix.normalize(posix.join(posix.dirname(pageSource), entry.path)).replace(/\/$/, "");
    if (path.startsWith("..")) {
      problems.push(`${pageSource}: resource "${entry.path}" is outside the source directory`);
      continue;
    }
    const inside = [...files].filter((file) => file.startsWith(path + "/")).sort();
    if (inside.length > 0) {
      const folderFiles = await Promise.all(
        inside.map((file) => describeFile(sourceDirectory, file, file.slice(path.length + 1), "")),
      );
      const skillFile = skills.has(path) ? `${path}/SKILL.md` : undefined;
      const { data } = skillFile
        ? parseFrontmatter(await Bun.file(`${sourceDirectory}/${skillFile}`).text(), skillFile)
        : { data: {} as Record<string, unknown> };
      resources.push({
        title: entry.title ?? (typeof data.name === "string" ? data.name : posix.basename(path)),
        path,
        kind: skillFile ? "skill" : "folder",
        extension: "",
        size: folderFiles.reduce((sum, file) => sum + file.size, 0),
        description: entry.description ?? (typeof data.description === "string" ? data.description : ""),
        archivePath: `${path}.tar.gz`,
        skillFile,
        files: folderFiles,
      });
      continue;
    }
    if (!files.has(path)) {
      problems.push(`${pageSource}: resource "${entry.path}" not found`);
      continue;
    }
    resources.push(
      await describeFile(sourceDirectory, path, entry.title ?? posix.basename(path), entry.description ?? ""),
    );
  }
  return resources;
}

/**
 * Lists a page's resources as Markdown for its `.md` twin and llms.txt: a link
 * to each file, a skill's SKILL.md or a folder's archive, with its kind.
 */
export function resourcesMarkdown(resources: Resource[], url: (path: string) => string) {
  const list = resources.map((resource) => {
    const target = resource.skillFile ?? (resource.kind === "folder" ? resource.archivePath! : resource.path);
    const archive = resource.archivePath ? `, download: ${url(resource.archivePath)}` : "";
    return `- [${resource.title}](${url(target)}) (${resource.kind}${archive})${resource.description ? `: ${resource.description}` : ""}`;
  });
  return `\n\n## Resources\n\n${list.join("\n")}\n`;
}
