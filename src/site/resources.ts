import { extname, posix } from "node:path";
import { isSupported } from "../markdown/highlight.ts";
import { parseFrontmatter } from "../markdown/markdown.ts";

export type ResourceKind = "skill" | "code" | "document" | "file";

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
function readEntries(value: unknown, source: string, problems: string[]): ResourceEntry[] {
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
 * Resolves a page's resources relative to the page and describes each one. A
 * skill folder gets its SKILL.md metadata, total size and a tarball path;
 * a file gets a kind from its extension and, for small code files, its text
 * for the preview. Missing or out-of-source paths are reported in `problems`.
 */
export async function resolveResources(
  value: unknown,
  pageSource: string,
  sourceDirectory: string,
  files: Set<string>,
  skills: Set<string>,
  problems: string[],
): Promise<Resource[]> {
  const resources: Resource[] = [];
  for (const entry of readEntries(value, pageSource, problems)) {
    const path = posix.normalize(posix.join(posix.dirname(pageSource), entry.path)).replace(/\/$/, "");
    if (path.startsWith("..")) {
      problems.push(`${pageSource}: resource "${entry.path}" is outside the source directory`);
      continue;
    }
    if (skills.has(path)) {
      const skillFile = `${path}/SKILL.md`;
      const { data } = parseFrontmatter(await Bun.file(`${sourceDirectory}/${skillFile}`).text(), skillFile);
      const skillFiles = [...files].filter((file) => file.startsWith(path + "/"));
      const size = (await Promise.all(skillFiles.map((file) => Bun.file(`${sourceDirectory}/${file}`).size))).reduce(
        (sum, bytes) => sum + bytes,
        0,
      );
      resources.push({
        title: entry.title ?? (typeof data.name === "string" ? data.name : posix.basename(path)),
        path,
        kind: "skill",
        extension: "",
        size,
        description: entry.description ?? (typeof data.description === "string" ? data.description : ""),
        archivePath: `${path}.tar.gz`,
        skillFile,
      });
      continue;
    }
    if (!files.has(path)) {
      problems.push(`${pageSource}: resource "${entry.path}" not found`);
      continue;
    }
    const file = Bun.file(`${sourceDirectory}/${path}`);
    const extension = extname(path).slice(1).toLowerCase();
    const kind: ResourceKind = documentExtensions.has(extension)
      ? "document"
      : isSupported(extension) || codeExtensions.has(extension)
        ? "code"
        : "file";
    resources.push({
      title: entry.title ?? posix.basename(path),
      path,
      kind,
      extension,
      size: file.size,
      description: entry.description ?? "",
      code: kind === "code" && file.size <= previewLimit ? await file.text() : undefined,
    });
  }
  return resources;
}

/**
 * Packs every file of a skill folder into a gzipped tarball, rooted at the
 * folder name so it unpacks into a directory of its own.
 */
export async function skillArchive(sourceDirectory: string, skill: string, files: Set<string>) {
  const name = posix.basename(skill);
  const entries: Record<string, Blob> = {};
  for (const file of files) {
    if (file.startsWith(skill + "/")) {
      entries[`${name}/${file.slice(skill.length + 1)}`] = Bun.file(`${sourceDirectory}/${file}`);
    }
  }
  return new Bun.Archive(entries, { compress: "gzip" }).blob();
}
