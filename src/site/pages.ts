/**
 * Turns a file or folder name into a readable title: dashes and underscores
 * become spaces and only the first letter is capitalized.
 */
export function titleCase(name: string) {
  return name.replace(/[-_]+/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

/**
 * Tells whether a slug is a folder's landing page (`index` or `folder/index`).
 */
export function isIndex(slug: string) {
  return slug === "index" || slug.endsWith("/index");
}

/**
 * Maps a slug to its public URL, always with a trailing slash; index pages
 * take their folder's URL.
 */
export function pageUrl(slug: string) {
  const path = slug === "index" ? "" : slug.replace(/\/index$/, "");
  return path ? `/${path}/` : "/";
}

/**
 * Gives the URL of a page's raw Markdown copy: `/guide/` becomes `/guide.md`
 * and the root becomes `/index.md`.
 */
export function markdownUrlOf(url: string) {
  return url === "/" ? "/index.md" : url.replace(/\/$/, ".md");
}

/**
 * Prepends a `# title` heading when the Markdown lacks one, so the raw `.md`
 * copy served to readers and LLMs always starts with the page title.
 */
export function ensureTitleHeading(markdown: string, title: string, hasTitleHeading: boolean) {
  return hasTitleHeading ? markdown : `# ${title}\n\n${markdown.trimStart()}`;
}

/**
 * Normalizes frontmatter tags, given as a list or a comma-separated string,
 * to unique lowercase words, spaces becoming dashes so a `#tag` search can
 * match them. Invalid values are reported in `problems` and yield no tags.
 */
export function readTags(value: unknown, source: string, problems: string[]) {
  if (value === undefined || value === null) {
    return [];
  }
  const tags = typeof value === "string" ? value.split(",") : value;
  if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string" && typeof tag !== "number")) {
    problems.push(`${source}: frontmatter "tags" must be a list of words`);
    return [];
  }
  return [...new Set(tags.map((tag) => String(tag).trim().toLowerCase().replace(/\s+/g, "-")).filter(Boolean))];
}

/**
 * Reads a frontmatter date, which YAML may already have parsed into a Date.
 * Returns undefined for anything unparseable so the caller can fall back.
 */
export function frontmatterDate(value: unknown) {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * Maps each file under `source` to the date of the last commit touching it,
 * from a single `git log` run. Returns an empty map outside a git repository.
 */
export async function lastCommitDates(source: string) {
  const dates = new Map<string, Date>();
  const result = await Bun.$`git -C ${source} log --format=%x00%cI --name-only --relative .`.quiet().nothrow();
  if (result.exitCode !== 0) {
    return dates;
  }
  for (const commit of result.stdout.toString().split("\0").slice(1)) {
    const [date, ...files] = commit.split("\n").filter(Boolean);
    for (const file of files) {
      if (!dates.has(file)) {
        dates.set(file, new Date(date!));
      }
    }
  }
  return dates;
}
