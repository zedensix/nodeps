import { applyAttributes, parseAttributes, type Attributes } from "./attribute-lists.ts";
import { processBlocks } from "./block-extensions.ts";
import { expandSnippets } from "./snippets.ts";

export interface ExtensionContext {
  root: string;
  sourceDirectory: string;
  pageSource: string;
  warnings: string[];
}

export interface State {
  context: ExtensionContext;
  abbreviations: Map<string, string>;
  footnotes: Map<string, string[]>;
  footnoteOrder: string[];
  headingAttributes: (Attributes | undefined)[];
  tabSets: number;
}

export interface Preprocessed {
  markdown: string;
  abbreviations: Map<string, string>;
  headingAttributes: (Attributes | undefined)[];
}

/**
 * Turns the MkDocs-style extensions md4c does not know into plain Markdown and
 * HTML before rendering: snippets are inlined, blocks and inline syntax are
 * rewritten, and the referenced footnotes are appended as a list in order of
 * first use. Abbreviations and heading attributes are returned for
 * `postprocessHtml`, since they can only be applied to the rendered HTML.
 */
export function preprocessMarkdown(markdown: string, context: ExtensionContext): Preprocessed {
  const state: State = {
    context,
    abbreviations: new Map(),
    footnotes: new Map(),
    footnoteOrder: [],
    headingAttributes: [],
    tabSets: 0,
  };
  const lines = processBlocks(expandSnippets(markdown.split("\n"), context), state);
  if (state.footnoteOrder.length > 0) {
    lines.push("", '<section class="footnotes">', "<ol>");
    for (const id of state.footnoteOrder) {
      const body = state.footnotes.get(id);
      if (!body) {
        context.warnings.push(`${context.pageSource}: footnote [^${id}] has no definition`);
        continue;
      }
      const rendered = processBlocks(body, state);
      const back = ` <a class="footnote-back" href="#fnref-${Bun.escapeHTML(id)}" aria-label="Back to the text">↩</a>`;
      const lastText = rendered.findLastIndex((line) => line.trim() !== "");
      if (lastText !== -1) {
        rendered[lastText] += back;
      }
      lines.push(`<li id="fn-${Bun.escapeHTML(id)}">`, "", ...rendered, "", "</li>");
    }
    lines.push("</ol>", "</section>");
  }
  return { markdown: lines.join("\n"), abbreviations: state.abbreviations, headingAttributes: state.headingAttributes };
}

/**
 * Applies `transform` to the text between tags only, skipping everything inside
 * code, links, scripts, styles, SVG and existing abbr or kbd elements.
 */
function replaceInText(html: string, transform: (text: string) => string) {
  const skipped = new Set(["code", "pre", "script", "style", "abbr", "kbd", "a", "svg"]);
  const stack: string[] = [];
  return html.replace(/(<[^>]+>)|([^<]+)/g, (_match, tag: string | undefined, text: string | undefined) => {
    if (tag) {
      const name = /^<\/?([a-z0-9]+)/i.exec(tag)?.[1]?.toLowerCase();
      if (name && skipped.has(name) && !tag.endsWith("/>")) {
        if (tag.startsWith("</")) {
          stack.pop();
        } else {
          stack.push(name);
        }
      }
      return tag;
    }
    return stack.length > 0 ? text! : transform(text!);
  });
}

/**
 * Finishes the extensions on rendered HTML: attr_list `{...}` after images and
 * inline elements, attributes recorded for headings (matched by position), and
 * `<abbr>` around every defined abbreviation, longest term first.
 */
export function postprocessHtml(html: string, preprocessed: Preprocessed) {
  let output = html
    .replace(/<img\b([^>]*?)\s*\/?>\{:?\s*([^}]*)\}/g, (_match, attributes: string, list: string) =>
      applyAttributes(`<img${attributes}>`, parseAttributes(list)),
    )
    .replace(
      /(<(a|span|strong|em|code)\b[^>]*>)((?:(?!<\/\2>)[\s\S])*<\/\2>)\{:?\s*([^}]*)\}/g,
      (_match, open: string, _tag, rest: string, list: string) => applyAttributes(open, parseAttributes(list)) + rest,
    );
  let headingIndex = 0;
  output = output.replace(/<h([1-6])\b[^>]*>/g, (tag) => {
    const attributes = preprocessed.headingAttributes[headingIndex++];
    return attributes ? applyAttributes(tag, attributes) : tag;
  });
  if (preprocessed.abbreviations.size > 0) {
    const terms = [...preprocessed.abbreviations.keys()].sort((left, right) => right.length - left.length);
    const pattern = new RegExp(
      `\\b(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
      "g",
    );
    output = replaceInText(output, (text) =>
      text.replace(
        pattern,
        (term) => `<abbr title="${Bun.escapeHTML(preprocessed.abbreviations.get(term)!)}">${term}</abbr>`,
      ),
    );
  }
  return output;
}
