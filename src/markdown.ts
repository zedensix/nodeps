import { highlight } from "./highlight.ts";
import { icon } from "./icons.ts";

export interface Heading {
  level: number;
  id: string;
  text: string;
}

export interface Section {
  id: string;
  heading: string;
  text: string;
}

export interface RenderedMarkdown {
  html: string;
  title?: string;
  headings: Heading[];
  sections: Section[];
}

export function parseFrontmatter(source: string, file: string) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(source);
  if (!match) {
    return { data: {} as Record<string, unknown>, body: source };
  }
  let data: unknown;
  try {
    data = Bun.YAML.parse(match[1]!) ?? {};
  } catch (error) {
    throw new Error(`${file}: invalid frontmatter: ${(error as Error).message}`, { cause: error });
  }
  if (typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`${file}: frontmatter must be a YAML mapping`);
  }
  return {
    data: data as Record<string, unknown>,
    body: source.slice(match[0].length),
  };
}

const fencePattern = /^([ \t>]*)(`{3,}|~{3,})(.*)$/;

// md4c only keeps the first word of a fence info string, so the rest rides along base64url-encoded.
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
  nbsp: " ",
};

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

function parseLineRanges(meta: string) {
  const lines = new Set<number>();
  const ranges = /\{([\d,\s-]+)\}/.exec(meta)?.[1] ?? "";
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

function renderCodeBlock(language: string, escapedCode: string) {
  const [name = "", encodedMeta] = language.split("::");
  const meta = encodedMeta ? Buffer.from(encodedMeta, "base64url").toString() : "";
  const title = /title=(?:"([^"]*)"|'([^']*)'|(\S+))/.exec(meta);
  return renderCode(
    decodeEntities(escapedCode),
    name,
    title ? (title[1] ?? title[2] ?? title[3]) : undefined,
    parseLineRanges(meta),
  );
}

export function renderCode(source: string, name: string, titleText?: string, highlighted = new Set<number>()) {
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
  return `<figure class="code${titleText ? " has-title" : ""}" data-language="${Bun.escapeHTML(name)}">${caption}${copy}${titleText ? "" : label}<pre><code>${lines.join("\n")}</code></pre></figure>`;
}

const alerts: Record<string, { title: string; icon: string }> = {
  NOTE: { title: "Note", icon: "info" },
  TIP: { title: "Tip", icon: "lightbulb" },
  IMPORTANT: { title: "Important", icon: "message-circle-exclamation-point" },
  WARNING: { title: "Warning", icon: "triangle-exclamation-point" },
  CAUTION: { title: "Caution", icon: "octagon-exclamation-point" },
};

function renderAlerts(html: string) {
  return html.replace(
    /<blockquote>\n<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(<\/p>\n?|\n)?/g,
    (_match, kind: string, rest = "") => {
      const type = kind.toLowerCase();
      const title = `<p class="alert-title">${icon(alerts[kind]!.icon)}${alerts[kind]!.title}</p>\n`;
      return `<blockquote class="alert alert-${type}">\n${title}${rest.startsWith("</p>") ? "" : "<p>"}`;
    },
  );
}

export function renderMarkdown(markdown: string, resolveLink: (href: string) => string): RenderedMarkdown {
  let html = Bun.markdown.html(encodeFenceMeta(markdown), {
    headings: { ids: true },
    autolinks: true,
  });
  html = html.replace(
    /<pre><code(?: class="language-([^"]*)")?>([\s\S]*?)<\/code><\/pre>/g,
    (_match, language = "", code: string) => renderCodeBlock(language, code),
  );
  html = renderAlerts(html);

  const headings: Heading[] = [];
  const sections: Section[] = [{ id: "", heading: "", text: "" }];
  let title: string | undefined;
  let titleText = "";
  let currentHeading: Heading | null = null;
  let insideHeading = false;
  let insideTitle = false;
  let insideLabel = false;

  html = new HTMLRewriter()
    .on("h1", {
      element(element) {
        insideTitle = title === undefined;
        element.onEndTag(() => {
          if (insideTitle) {
            title = decodeEntities(titleText).trim();
          }
          insideTitle = false;
        });
      },
      text(chunk) {
        if (insideTitle) {
          titleText += chunk.text;
        }
      },
    })
    .on("h2[id], h3[id], h4[id], h5[id], h6[id]", {
      element(element) {
        const id = element.getAttribute("id")!;
        const level = Number(element.tagName.slice(1));
        currentHeading = { level, id, text: "" };
        if (level <= 3) {
          headings.push(currentHeading);
        }
        sections.push({ id, heading: "", text: "" });
        insideHeading = true;
        element.prepend(`<a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>`, { html: true });
        element.onEndTag(() => {
          insideHeading = false;
          currentHeading!.text = decodeEntities(currentHeading!.text).trim();
          sections.at(-1)!.heading = currentHeading!.text;
        });
      },
      text(chunk) {
        if (currentHeading) {
          currentHeading.text += chunk.text;
        }
      },
    })
    .on("a[href]", {
      element(element) {
        element.setAttribute("href", resolveLink(element.getAttribute("href")!));
      },
    })
    .on("img[src]", {
      element(element) {
        element.setAttribute("src", resolveLink(element.getAttribute("src")!));
        element.setAttribute("loading", "lazy");
      },
    })
    .on("table", {
      element(element) {
        element.before(`<div class="table">`, { html: true });
        element.after(`</div>`, { html: true });
      },
    })
    .on("p, li, th, td, pre, .line, blockquote, figcaption, dt, dd", {
      element() {
        sections.at(-1)!.text += " ";
      },
    })
    .on(".code-language, .alert-title", {
      element(element) {
        insideLabel = true;
        element.onEndTag(() => {
          insideLabel = false;
        });
      },
    })
    .onDocument({
      text(chunk) {
        if (!insideHeading && !insideTitle && !insideLabel) {
          sections.at(-1)!.text += chunk.text;
        }
      },
    })
    .transform(html);

  for (const section of sections) {
    section.text = decodeEntities(section.text).replace(/\s+/g, " ").trim();
  }
  return {
    html,
    title,
    headings,
    sections: sections.filter((section) => section.text || section.heading),
  };
}
