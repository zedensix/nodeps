import { encodeFenceMeta } from "../markdown/code-blocks.ts";
import type { Page } from "../site/site.ts";

/**
 * URL path of the JSON payload the editor loads for a page, relative to the site base.
 */
export function editorSourcePath(page: Page) {
  return `/_editor/source/${page.source}.json`;
}

const rawBlockStart =
  /^(?:\s*(?:!!!|\?\?\?\+?|===)[!+]?\s|\s*;?--8<--| {0,3}\[\^[^\]]+\]:| {0,3}\*\[[^\]]+\]:|\s*(?:\$\$|\\\[))/;
const htmlBlockStart = /^<(div|section|figure|details|table|aside)\b[^>]*>\s*$/;
const fence = /^\s*(`{3,}|~{3,})/;

/**
 * Replaces the blocks the WYSIWYG editor cannot round-trip (admonitions, tabs,
 * snippets, footnote and abbreviation definitions, math, definition lists, HTML
 * blocks) with placeholder divs carrying the original Markdown in base64.
 * Fenced code is copied as is so its content is never mistaken for a block.
 */
function protectRawBlocks(markdown: string) {
  const lines = markdown.split("\n");
  const output: string[] = [];
  const raw = (block: string[]) => {
    output.push("", `<div data-raw-markdown="${Buffer.from(block.join("\n")).toString("base64")}"></div>`, "");
  };
  let index = 0;
  while (index < lines.length) {
    const line = lines[index]!;
    const opening = fence.exec(line);
    if (opening) {
      const marker = opening[1]!;
      output.push(line);
      index++;
      while (index < lines.length) {
        output.push(lines[index]!);
        const closing = fence.exec(lines[index]!);
        index++;
        if (closing && closing[1]![0] === marker[0] && closing[1]!.length >= marker.length) {
          break;
        }
      }
      continue;
    }
    const html = htmlBlockStart.exec(line);
    if (html) {
      const block = [line];
      index++;
      while (index < lines.length && !new RegExp(`^</${html[1]}>\\s*$`).test(lines[index - 1]!)) {
        block.push(lines[index]!);
        index++;
      }
      raw(block);
      continue;
    }
    const definition = line.trim() !== "" && /^:\s{1,4}\S/.test(lines[index + 1] ?? lines[index + 2] ?? "");
    if (rawBlockStart.test(line) || definition) {
      const block = [line];
      index++;
      const math = /^\s*(\$\$|\\\[)/.exec(line);
      if (
        math &&
        !line
          .trim()
          .slice(2)
          .includes(math[1] === "$$" ? "$$" : "\\]")
      ) {
        while (index < lines.length) {
          block.push(lines[index]!);
          index++;
          if (lines[index - 1]!.includes(math[1] === "$$" ? "$$" : "\\]")) {
            break;
          }
        }
      }
      while (
        index < lines.length &&
        (lines[index]!.trim() === "" ||
          /^(\s{4}|\t)/.test(lines[index]!) ||
          /^:\s{1,4}\S/.test(lines[index]!) ||
          /^\s*===/.test(lines[index]!))
      ) {
        block.push(lines[index]!);
        index++;
      }
      while (block.length > 1 && block.at(-1)!.trim() === "") {
        block.pop();
        index--;
      }
      raw(block);
      continue;
    }
    output.push(line);
    index++;
  }
  return output.join("\n");
}

/**
 * Renders Markdown for the WYSIWYG editor: raw blocks become non-editable
 * previews that keep their source, so saving writes them back untouched.
 */
export function editorHtml(markdown: string) {
  const html = Bun.markdown.html(encodeFenceMeta(protectRawBlocks(markdown)), {
    headings: { ids: false },
    strikethrough: false,
  });
  return html.replace(/<div data-raw-markdown="([^"]*)"><\/div>/g, (_match, encoded: string) => {
    const source = Buffer.from(encoded, "base64").toString();
    return `<div class="raw-markdown" contenteditable="false" data-raw-markdown="${encoded}"><span class="raw-markdown-label">Markdown block · edit in Markdown mode</span><pre>${Bun.escapeHTML(source)}</pre></div>`;
  });
}

/**
 * Builds the JSON the editor loads: the frontmatter kept verbatim apart from the
 * body, so the editor only ever changes the body.
 */
export function editorPayload(page: Page) {
  const frontmatter = page.raw.slice(0, page.raw.length - pageBody(page).length);
  const body = pageBody(page);
  return { source: page.source, title: page.title, frontmatter, body, html: editorHtml(body) };
}

/**
 * Returns the page source without its frontmatter block.
 */
function pageBody(page: Page) {
  const match = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(page.raw);
  return match ? page.raw.slice(match[0].length) : page.raw;
}
