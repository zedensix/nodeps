import { decodeEntities, encodeFenceMeta, renderCodeBlock } from "./code-blocks.ts";
import { postprocessHtml, preprocessMarkdown, type ExtensionContext } from "./extensions.ts";
import { icon } from "../icons/icons.ts";

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

/**
 * Splits a leading `---` YAML block off a page. Throws with the file name when the
 * YAML is invalid or is not a mapping, so a typo never silently drops metadata.
 */
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

const alerts: Record<string, { title: string; icon: string }> = {
  NOTE: { title: "Note", icon: "info" },
  TIP: { title: "Tip", icon: "lightbulb" },
  IMPORTANT: { title: "Important", icon: "message-circle-exclamation-point" },
  WARNING: { title: "Warning", icon: "triangle-exclamation-point" },
  CAUTION: { title: "Caution", icon: "octagon-exclamation-point" },
};

/**
 * Turns GitHub `> [!NOTE]` style blockquotes into alert blockquotes with an icon
 * title. The marker may sit alone in its paragraph or start the first line of text.
 */
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

/**
 * Renders a page to HTML and extracts what navigation and search need: the first
 * h1 as title, h2 and h3 as the table of contents, and the plain text of each
 * section between headings. Links and images go through `resolveLink`.
 */
export function renderMarkdown(
  markdown: string,
  resolveLink: (href: string) => string,
  context: ExtensionContext,
): RenderedMarkdown {
  const preprocessed = preprocessMarkdown(markdown, context);
  let html = Bun.markdown.html(encodeFenceMeta(preprocessed.markdown), {
    headings: { ids: true },
    autolinks: true,
  });
  html = html.replace(
    /<pre><code(?: class="language-([^"]*)")?>([\s\S]*?)<\/code><\/pre>/g,
    (_match, language = "", code: string) => renderCodeBlock(language, code),
  );
  html = renderAlerts(postprocessHtml(html, preprocessed));

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
      /**
       * Captures the first h1 only; later h1s render normally but do not replace the title.
       */
      element(element) {
        insideTitle = title === undefined;
        element.onEndTag(() => {
          if (insideTitle) {
            title = decodeEntities(titleText).trim();
          }
          insideTitle = false;
        });
      },
      /**
       * Accumulates the title text, which can arrive in several chunks.
       */
      text(chunk) {
        if (insideTitle) {
          titleText += chunk.text;
        }
      },
    })
    .on("h2[id], h3[id], h4[id], h5[id], h6[id]", {
      /**
       * Starts a new search section, records h2 and h3 in the table of contents and
       * prepends the anchor link.
       */
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
      /**
       * Accumulates the heading text, which can arrive in several chunks.
       */
      text(chunk) {
        if (currentHeading) {
          currentHeading.text += chunk.text;
        }
      },
    })
    .on("a[href]", {
      /**
       * Rewrites the link to its output URL.
       */
      element(element) {
        element.setAttribute("href", resolveLink(element.getAttribute("href")!));
      },
    })
    .on("img[src]", {
      /**
       * Rewrites the image source to its output URL and lazy-loads it.
       */
      element(element) {
        element.setAttribute("src", resolveLink(element.getAttribute("src")!));
        element.setAttribute("loading", "lazy");
      },
    })
    .on("table", {
      /**
       * Wraps the table in a div so wide tables scroll on their own.
       */
      element(element) {
        element.before(`<div class="table">`, { html: true });
        element.after(`</div>`, { html: true });
      },
    })
    .on("p, li, th, td, pre, .line, blockquote, figcaption, dt, dd", {
      /**
       * Separates block text with a space so words of adjacent blocks do not merge in search.
       */
      element() {
        sections.at(-1)!.text += " ";
      },
    })
    .on(".code-language, .alert-title", {
      /**
       * Keeps code language labels and alert titles out of the search text.
       */
      element(element) {
        insideLabel = true;
        element.onEndTag(() => {
          insideLabel = false;
        });
      },
    })
    .onDocument({
      /**
       * Adds body text to the current search section, skipping headings, the title and labels.
       */
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
