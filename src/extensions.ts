import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { emoji, icon, isIcon } from "./icons.ts";

export interface ExtensionContext {
  root: string;
  sourceDirectory: string;
  pageSource: string;
  warnings: string[];
}

export interface Attributes {
  id?: string;
  classes: string[];
  values: Record<string, string>;
}

interface State {
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

const fencePattern = /^(\s*)(`{3,}|~{3,})/;

const admonitionTypes: Record<string, { color: string; icon: string; title: string }> = {
  note: { color: "note", icon: "pencil", title: "Note" },
  abstract: { color: "abstract", icon: "clipboard-list", title: "Abstract" },
  info: { color: "info", icon: "info", title: "Info" },
  tip: { color: "tip", icon: "flame", title: "Tip" },
  success: { color: "success", icon: "check", title: "Success" },
  question: { color: "question", icon: "circle-question-mark", title: "Question" },
  warning: { color: "warning", icon: "triangle-exclamation-point", title: "Warning" },
  failure: { color: "failure", icon: "x", title: "Failure" },
  danger: { color: "danger", icon: "zap", title: "Danger" },
  bug: { color: "bug", icon: "bug", title: "Bug" },
  example: { color: "example", icon: "flask-conical", title: "Example" },
  quote: { color: "quote", icon: "quote", title: "Quote" },
};

const admonitionAliases: Record<string, string> = {
  summary: "abstract",
  tldr: "abstract",
  todo: "info",
  hint: "tip",
  important: "tip",
  check: "success",
  done: "success",
  help: "question",
  faq: "question",
  caution: "warning",
  attention: "warning",
  fail: "failure",
  missing: "failure",
  error: "danger",
  cite: "quote",
};

export function parseAttributes(text: string): Attributes {
  const attributes: Attributes = { classes: [], values: {} };
  for (const match of text.matchAll(/([.#])([\w-]+)|([\w-]+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g)) {
    if (match[1] === ".") {
      attributes.classes.push(match[2]!);
    } else if (match[1] === "#") {
      attributes.id = match[2];
    } else if (match[3]) {
      attributes.values[match[3]] = match[4] ?? match[5] ?? match[6] ?? "";
    }
  }
  return attributes;
}

function indentOf(line: string) {
  return /^[ \t]*/.exec(line)![0].replace(/\t/g, "    ").length;
}

function dedent(line: string, amount: number) {
  let removed = 0;
  let index = 0;
  while (index < line.length && removed < amount && (line[index] === " " || line[index] === "\t")) {
    removed += line[index] === "\t" ? 4 : 1;
    index++;
  }
  return line.slice(index);
}

function collectIndented(lines: string[], start: number, indent: number) {
  const body: string[] = [];
  let index = start;
  while (index < lines.length) {
    const line = lines[index]!;
    if (line.trim() !== "" && indentOf(line) < indent) {
      break;
    }
    body.push(line.trim() === "" ? "" : dedent(line, indent));
    index++;
  }
  while (body.length > 0 && body.at(-1) === "") {
    body.pop();
    index--;
  }
  return { body, next: index };
}

const escapeHtml = (text: string) => Bun.escapeHTML(text);

function snippetPath(reference: string, context: ExtensionContext) {
  const [file] = reference.split(":");
  const candidates = [
    join(context.sourceDirectory, dirname(context.pageSource), file!),
    join(context.sourceDirectory, file!),
    join(context.root, file!),
  ];
  return candidates.find((candidate) => resolve(candidate).startsWith(resolve(context.root)) && existsSync(candidate));
}

function readSnippet(reference: string, context: ExtensionContext, depth: number): string[] {
  const path = snippetPath(reference, context);
  if (!path) {
    context.warnings.push(`${context.pageSource}: snippet not found: ${reference}`);
    return [];
  }
  const [, start, end] = reference.split(":");
  let lines = readFileSync(path, "utf8").replace(/\n$/, "").split("\n");
  if (start || end) {
    lines = lines.slice(start ? Number(start) - 1 : 0, end ? Number(end) : undefined);
  }
  return depth < 4 ? expandSnippets(lines, context, depth + 1) : lines;
}

function expandSnippets(lines: string[], context: ExtensionContext, depth = 0): string[] {
  const output: string[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const escaped = /^(\s*);(--8<--.*)$/.exec(line);
    if (escaped) {
      output.push(escaped[1]! + escaped[2]!);
      continue;
    }
    const single = /^(\s*)--8<--\s+["']([^"']+)["']\s*$/.exec(line);
    if (single) {
      output.push(...readSnippet(single[2]!, context, depth).map((included) => single[1] + included));
      continue;
    }
    if (/^\s*--8<--\s*$/.test(line)) {
      const indent = /^\s*/.exec(line)![0];
      index++;
      while (index < lines.length && !/^\s*--8<--\s*$/.test(lines[index]!)) {
        const reference = lines[index]!.trim();
        if (reference && !reference.startsWith(";")) {
          output.push(...readSnippet(reference, context, depth).map((included) => indent + included));
        }
        index++;
      }
      continue;
    }
    output.push(line);
  }
  return output;
}

function protectMath(text: string) {
  const encode = (math: string) =>
    math
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/\\/g, "&#92;")
      .replace(/\*/g, "&#42;")
      .replace(/_/g, "&#95;")
      .replace(/\^/g, "&#94;")
      .replace(/~/g, "&#126;")
      .replace(/=/g, "&#61;");
  return text
    .replace(
      /\$\$([\s\S]+?)\$\$/g,
      (_match, math: string) => `<span class="arithmatex">&#92;[${encode(math)}&#92;]</span>`,
    )
    .replace(
      /(^|[^\\$])\$(?=\S)([^$\n]+?)(?<=\S)\$(?!\d)/g,
      (_match, before: string, math: string) => `${before}<span class="arithmatex">&#92;(${encode(math)}&#92;)</span>`,
    );
}

const keyNames: Record<string, string> = {
  ctrl: "Ctrl",
  control: "Ctrl",
  alt: "Alt",
  option: "⌥",
  shift: "Shift",
  cmd: "⌘",
  command: "⌘",
  meta: "Meta",
  win: "Win",
  enter: "Enter",
  return: "Return",
  tab: "Tab",
  space: "Space",
  esc: "Esc",
  escape: "Esc",
  backspace: "Backspace",
  delete: "Del",
  del: "Del",
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
};

function iconShortcode(name: string) {
  const lucide = name.startsWith("lucide-") ? name.slice("lucide-".length) : undefined;
  if (lucide && isIcon(lucide)) {
    return `<span class="twemoji">${icon(lucide)}</span>`;
  }
  if (isIcon(name)) {
    return `<span class="twemoji">${icon(name)}</span>`;
  }
  const character = emoji(name);
  return character ? `<span class="emoji" role="img" aria-label="${name}">${character}</span>` : undefined;
}

function transformInline(text: string, state: State) {
  const protectedParts: string[] = [];
  const protect = (value: string) => {
    protectedParts.push(value);
    return `\uE000${protectedParts.length - 1}\uE000`;
  };
  let output = text.replace(/(`+)[\s\S]*?\1/g, protect);
  output = protectMath(output).replace(/<span class="arithmatex">[\s\S]*?<\/span>/g, protect);
  output = output.replace(/<[^>]+>/g, protect);

  output = output.replace(/\[\^([^\]\s]+)\](?!:)/g, (_match, id: string) => {
    if (!state.footnoteOrder.includes(id)) {
      state.footnoteOrder.push(id);
    }
    const number = state.footnoteOrder.indexOf(id) + 1;
    return protect(
      `<sup class="footnote-ref" id="fnref-${escapeHtml(id)}"><a href="#fn-${escapeHtml(id)}">${number}</a></sup>`,
    );
  });
  output = output.replace(/\+\+([^\s+][^+]*?(?:\+[^+\s][^+]*?)*)\+\+/g, (_match, keys: string) =>
    protect(
      `<span class="keys">${keys
        .split("+")
        .map(
          (key) =>
            `<kbd>${escapeHtml(keyNames[key.toLowerCase()] ?? key.charAt(0).toUpperCase() + key.slice(1))}</kbd>`,
        )
        .join("<span>+</span>")}</span>`,
    ),
  );
  output = output.replace(/:([a-z0-9][a-z0-9_+-]*):(\{[^}]*\})?/g, (match, name: string, attributeList?: string) => {
    const rendered = iconShortcode(name);
    if (!rendered) {
      return match;
    }
    if (!attributeList) {
      return protect(rendered);
    }
    const attributes = parseAttributes(attributeList.slice(1, -1));
    return protect(
      rendered.replace(
        /^<span class="(\w+)"/,
        (_start, base: string) => `<span class="${[base, ...attributes.classes].join(" ")}"`,
      ),
    );
  });
  output = output
    .replace(/==(?=\S)([^=]+?)(?<=\S)==/g, "<mark>$1</mark>")
    .replace(/\^\^(?=\S)([^^]+?)(?<=\S)\^\^/g, "<ins>$1</ins>")
    .replace(/(^|[^~])~(?=[^\s~])([^~\n]+?)(?<=[^\s~])~(?!~)/g, "$1<sub>$2</sub>")
    .replace(/(^|[^^])\^(?=[^\s^])([^^\n]+?)(?<=[^\s^])\^(?!\^)/g, "$1<sup>$2</sup>");
  return output
    .replace(/\uE000(\d+)\uE000/g, (_match, index: string) => protectedParts[Number(index)]!)
    .replace(/\uE000(\d+)\uE000/g, (_match, index: string) => protectedParts[Number(index)]!);
}

function admonition(match: RegExpExecArray, body: string[], state: State, indent: string) {
  const [, , marker, rawType, extraClasses = "", quotedTitle] = match as unknown as string[];
  const type = admonitionAliases[rawType!.toLowerCase()] ?? rawType!.toLowerCase();
  const known = admonitionTypes[type] ?? admonitionTypes.note!;
  const title =
    quotedTitle ?? (admonitionTypes[type] ? known.title : rawType!.charAt(0).toUpperCase() + rawType!.slice(1));
  const classes = [
    "admonition",
    "alert",
    `alert-${known.color}`,
    ...extraClasses.trim().split(/\s+/).filter(Boolean),
  ].join(" ");
  const heading = title ? `${icon(known.icon)}${escapeHtml(title)}` : "";
  const inner = processBlocks(body, state);
  if (marker === "!!!") {
    return [
      `${indent}<div class="${classes}">${heading ? `<p class="alert-title">${heading}</p>` : ""}`,
      "",
      ...inner.map((line) => (line ? indent + line : line)),
      "",
      `${indent}</div>`,
    ];
  }
  return [
    `${indent}<details class="${classes}"${marker === "???+" ? " open" : ""}><summary class="alert-title">${heading || escapeHtml(known.title)}</summary>`,
    "",
    ...inner.map((line) => (line ? indent + line : line)),
    "",
    `${indent}</details>`,
  ];
}

function processBlocks(lines: string[], state: State): string[] {
  const output: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index]!;

    const fence = fencePattern.exec(line);
    if (fence) {
      const [, , marker] = fence as unknown as [string, string, string];
      output.push(line);
      index++;
      while (index < lines.length) {
        const current = lines[index]!;
        output.push(current);
        index++;
        const closing = fencePattern.exec(current);
        if (
          closing &&
          closing[2]![0] === marker[0] &&
          closing[2]!.length >= marker.length &&
          current.trim() === closing[2]
        ) {
          break;
        }
      }
      continue;
    }

    const mathBlock = /^(\s*)(\$\$|\\\[)\s*(.*)$/.exec(line);
    if (mathBlock) {
      const closing = mathBlock[2] === "$$" ? "$$" : "\\]";
      const collected: string[] = [];
      let rest = mathBlock[3]!;
      let cursor = index;
      while (true) {
        const end = rest.indexOf(closing);
        if (end !== -1) {
          collected.push(rest.slice(0, end));
          break;
        }
        collected.push(rest);
        cursor++;
        if (cursor >= lines.length) {
          break;
        }
        rest = lines[cursor]!.trim();
      }
      const encoded = collected.join("\n").trim().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\\/g, "&#92;");
      output.push(`${mathBlock[1]}<div class="arithmatex">&#92;[${encoded}&#92;]</div>`, "");
      index = cursor + 1;
      continue;
    }

    const admonitionMatch = /^(\s*)(!!!|\?\?\?\+?)\s+([\w-]+)((?:\s+[\w-]+)*)(?:\s+"([^"]*)")?\s*$/.exec(line);
    if (admonitionMatch) {
      const indent = admonitionMatch[1]!;
      const { body, next } = collectIndented(lines, index + 1, indentOf(line) + 4);
      output.push(...admonition(admonitionMatch, body, state, indent));
      index = next;
      continue;
    }

    const tabMatch = /^(\s*)===(!|\+)?\s+"([^"]*)"\s*$/.exec(line);
    if (tabMatch) {
      const indent = tabMatch[1]!;
      const tabs: { label: string; body: string[] }[] = [];
      let cursor = index;
      while (cursor < lines.length) {
        const current = /^(\s*)===(!|\+)?\s+"([^"]*)"\s*$/.exec(lines[cursor]!);
        if (!current || current[1] !== indent || (tabs.length > 0 && current[2] === "!")) {
          break;
        }
        const { body, next } = collectIndented(lines, cursor + 1, indentOf(lines[cursor]!) + 4);
        tabs.push({ label: current[3]!, body: processBlocks(body, state) });
        cursor = next;
        while (cursor < lines.length && lines[cursor]!.trim() === "" && /^\s*===/.test(lines[cursor + 1] ?? "")) {
          cursor++;
        }
      }
      state.tabSets++;
      const set = state.tabSets;
      output.push(`${indent}<div class="tabbed-set" data-tabs="${tabs.length}">`);
      tabs.forEach((tab, tabIndex) => {
        const id = `tab-${set}-${tabIndex + 1}`;
        output.push(
          `${indent}<input type="radio" name="tab-${set}" id="${id}"${tabIndex === 0 ? " checked" : ""}><label for="${id}">${escapeHtml(tab.label)}</label>`,
        );
      });
      output.push(`${indent}<div class="tabbed-panels">`);
      for (const tab of tabs) {
        output.push(
          `${indent}<div class="tabbed-panel">`,
          "",
          ...tab.body.map((bodyLine) => (bodyLine ? indent + bodyLine : bodyLine)),
          "",
          `${indent}</div>`,
        );
      }
      output.push(`${indent}</div>`, `${indent}</div>`);
      index = cursor;
      continue;
    }

    const footnote = /^ {0,3}\[\^([^\]]+)\]:\s?(.*)$/.exec(line);
    if (footnote) {
      const { body, next } = collectIndented(lines, index + 1, 4);
      state.footnotes.set(footnote[1]!, [footnote[2]!, ...body]);
      index = next;
      continue;
    }

    const abbreviation = /^ {0,3}\*\[([^\]]+)\]:\s*(.*)$/.exec(line);
    if (abbreviation) {
      state.abbreviations.set(abbreviation[1]!, abbreviation[2]!);
      index++;
      continue;
    }

    const definitionStart = line.trim() !== "" && !/^\s*[:#>|-]/.test(line);
    const nextLine = lines[index + 1] ?? "";
    const afterBlank = lines[index + 2] ?? "";
    const definitionLine = /^:\s{1,4}\S/.test(nextLine)
      ? index + 1
      : nextLine.trim() === "" && /^:\s{1,4}\S/.test(afterBlank)
        ? index + 2
        : -1;
    if (definitionStart && definitionLine !== -1) {
      output.push("<dl>");
      let cursor = index;
      while (cursor < lines.length) {
        const term = lines[cursor]!;
        let definitionAt = /^:\s{1,4}\S/.test(lines[cursor + 1] ?? "")
          ? cursor + 1
          : (lines[cursor + 1] ?? "").trim() === "" && /^:\s{1,4}\S/.test(lines[cursor + 2] ?? "")
            ? cursor + 2
            : -1;
        if (term.trim() === "" || definitionAt === -1) {
          break;
        }
        output.push("<dt>", "", ...transformLines([term], state), "", "</dt>");
        while (definitionAt !== -1) {
          const first = lines[definitionAt]!.replace(/^:\s{1,4}/, "");
          const { body, next } = collectIndented(lines, definitionAt + 1, 4);
          output.push("<dd>", "", ...processBlocks([first, ...body], state), "", "</dd>");
          cursor = next;
          while (cursor < lines.length && lines[cursor]!.trim() === "") {
            cursor++;
          }
          definitionAt = /^:\s{1,4}\S/.test(lines[cursor] ?? "") ? cursor : -1;
        }
      }
      output.push("</dl>", "");
      index = cursor;
      continue;
    }

    const heading = /^( {0,3}#{1,6}\s+.*?)\s*\{:?\s*([.#][^}]*)\}\s*$/.exec(line);
    if (/^ {0,3}#{1,6}\s/.test(line)) {
      state.headingAttributes.push(heading ? parseAttributes(heading[2]!) : undefined);
      output.push(...transformLines([heading ? heading[1]! : line], state));
      index++;
      continue;
    }

    output.push(...transformLines([line], state));
    index++;
  }
  return output;
}

function transformLines(lines: string[], state: State) {
  return lines.map((line) =>
    /^\s*<\/?(div|details|summary|dl|dt|dd|input|label)\b/.test(line) ? line : transformInline(line, state),
  );
}

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
      const back = ` <a class="footnote-back" href="#fnref-${escapeHtml(id)}" aria-label="Back to the text">↩</a>`;
      const lastText = rendered.findLastIndex((line) => line.trim() !== "");
      if (lastText !== -1) {
        rendered[lastText] += back;
      }
      lines.push(`<li id="fn-${escapeHtml(id)}">`, "", ...rendered, "", "</li>");
    }
    lines.push("</ol>", "</section>");
  }
  return { markdown: lines.join("\n"), abbreviations: state.abbreviations, headingAttributes: state.headingAttributes };
}

function applyAttributes(tag: string, attributes: Attributes) {
  let result = tag;
  if (attributes.classes.length > 0) {
    const classes = attributes.classes.join(" ");
    result = /\sclass="/.test(result)
      ? result.replace(/\sclass="([^"]*)"/, ` class="$1 ${classes}"`)
      : result.replace(/^<(\w+)/, `<$1 class="${classes}"`);
  }
  if (attributes.id) {
    result = /\sid="/.test(result)
      ? result.replace(/\sid="[^"]*"/, ` id="${escapeHtml(attributes.id)}"`)
      : result.replace(/^<(\w+)/, `<$1 id="${escapeHtml(attributes.id)}"`);
  }
  for (const [name, value] of Object.entries(attributes.values)) {
    result = result.replace(/^<(\w+)/, `<$1 ${name}="${escapeHtml(value)}"`);
  }
  return result;
}

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
        (term) => `<abbr title="${escapeHtml(preprocessed.abbreviations.get(term)!)}">${term}</abbr>`,
      ),
    );
  }
  return output;
}

export { admonitionTypes };
