import { highlight } from "./highlight.ts";
import { icon } from "../icons/icons.ts";

const fencePattern = /^([ \t>]*)(`{3,}|~{3,})(.*)$/;

/**
 * md4c only keeps the first word of a fence info string, so the rest rides
 * along base64url-encoded: each opening fence with meta (title, line ranges,
 * linenums) becomes `language::meta`. Other lines are left as written.
 */
export function encodeFenceMeta(markdown: string) {
  let openFence: string | null = null;
  return markdown
    .split("\n")
    .map((line) => {
      const match = fencePattern.exec(line);
      if (!match) {
        return line;
      }
      const [, prefix, fence, info] = match as unknown as [string, string, string, string];
      if (openFence) {
        if (fence[0] === openFence[0] && fence.length >= openFence.length && !info.trim()) {
          openFence = null;
        }
        return line;
      }
      openFence = fence;
      const [language = "", ...rest] = info.trim().split(/\s+/);
      if (rest.length === 0) {
        return line;
      }
      return `${prefix}${fence}${language || "text"}::${Buffer.from(rest.join(" ")).toString("base64url")}`;
    })
    .join("\n");
}

const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/**
 * Decodes numeric entities and the few named ones md4c emits. Unknown named
 * entities are kept as written.
 */
export function decodeEntities(text: string) {
  return text.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (entity, name: string) => {
    if (name[0] === "#") {
      return String.fromCodePoint(
        name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : Number(name.slice(1)),
      );
    }
    return entities[name] ?? entity;
  });
}

/**
 * Reads the lines to highlight from a fence meta, either `{1,3-5}` or
 * `hl_lines="1 3-5"`, as a set of 1-based line numbers.
 */
function parseLineRanges(meta: string) {
  const lines = new Set<number>();
  const braces = /\{([\d,\s-]+)\}/.exec(meta)?.[1];
  const highlightLines = /hl_lines=["']([\d\s-]+)["']/.exec(meta)?.[1]?.trim().split(/\s+/).join(",");
  const ranges = braces ?? highlightLines ?? "";
  for (const range of ranges.split(",")) {
    const [start, end = start] = range.trim().split("-").map(Number);
    if (!start || !end) {
      continue;
    }
    for (let line = start; line <= end; line++) {
      lines.add(line);
    }
  }
  return lines;
}

/**
 * Replaces one md4c code block: decodes the meta `encodeFenceMeta` packed into
 * the language class and renders the figure. Mermaid blocks stay a plain
 * `<pre class="mermaid">` for the client-side renderer.
 */
export function renderCodeBlock(language: string, escapedCode: string) {
  const [name = "", encodedMeta] = language.split("::");
  const meta = encodedMeta ? Buffer.from(encodedMeta, "base64url").toString() : "";
  const title = /title=(?:"([^"]*)"|'([^']*)'|(\S+))/.exec(meta);
  if (name === "mermaid") {
    return `<pre class="mermaid">${escapedCode}</pre>`;
  }
  const lineNumbers = /linenums=["']?(\d+)/.exec(meta)?.[1];
  return renderCode(
    decodeEntities(escapedCode),
    name,
    title ? (title[1] ?? title[2] ?? title[3]) : undefined,
    parseLineRanges(meta),
    lineNumbers ? Number(lineNumbers) : undefined,
  );
}

/**
 * Renders highlighted source as a code figure: one span per line (marked
 * highlighted, or inserted and deleted for diffs), an optional title caption,
 * the language label and a copy button. Line numbers start at
 * `firstLineNumber` when it is given.
 */
export function renderCode(
  source: string,
  name: string,
  titleText?: string,
  highlighted = new Set<number>(),
  firstLineNumber?: number,
) {
  const code = source.replace(/\n$/, "");
  const rawLines = code.split("\n");
  const lines = highlight(code, name).map((line, index) => {
    const classes = ["line"];
    if (highlighted.has(index + 1)) {
      classes.push("highlighted");
    }
    if (name === "diff" && rawLines[index]?.startsWith("+")) {
      classes.push("inserted");
    }
    if (name === "diff" && rawLines[index]?.startsWith("-")) {
      classes.push("deleted");
    }
    return `<span class="${classes.join(" ")}">${line}</span>`;
  });
  const label = name && name !== "text" ? `<span class="code-language">${Bun.escapeHTML(name)}</span>` : "";
  const caption = titleText
    ? `<figcaption><span class="code-title">${Bun.escapeHTML(titleText)}</span>${label}</figcaption>`
    : "";
  const copy = `<button class="copy-code" type="button" aria-label="Copy code" data-tooltip="Copy code" data-tooltip-side="left">${icon("copy")}${icon("check")}</button>`;
  const numbering = firstLineNumber === undefined ? "" : ` style="--first-line:${firstLineNumber - 1}"`;
  return `<figure class="code${titleText ? " has-title" : ""}${firstLineNumber === undefined ? "" : " numbered"}" data-language="${Bun.escapeHTML(name)}"${numbering}>${caption}${copy}${titleText ? "" : label}<pre><code>${lines.join("\n")}</code></pre></figure>`;
}
