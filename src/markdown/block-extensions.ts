import { parseAttributes } from "./attribute-lists.ts";
import type { State } from "./extensions.ts";
import { icon } from "../icons/icons.ts";
import { collectIndented, indentOf } from "./indented-blocks.ts";
import { transformLines } from "./inline-extensions.ts";

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

/**
 * Whether nodeps styles an admonition type, by its name or an alias, in any
 * letter case.
 */
export function isAdmonitionType(type: string) {
  const name = type.toLowerCase();
  return name in admonitionTypes || name in admonitionAliases;
}

/**
 * Renders a `!!!` admonition as a div, or a `???`/`???+` one as a collapsible
 * details element (open with `+`). Unknown types keep their name as title but
 * take the note styling; `""` as title drops the title bar of a `!!!` block.
 */
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
  const heading = title ? `${icon(known.icon)}${Bun.escapeHTML(title)}` : "";
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
    `${indent}<details class="${classes}"${marker === "???+" ? " open" : ""}><summary class="alert-title">${heading || Bun.escapeHTML(known.title)}</summary>`,
    "",
    ...inner.map((line) => (line ? indent + line : line)),
    "",
    `${indent}</details>`,
  ];
}

/**
 * Rewrites the block-level extensions (math blocks, admonitions, tabs,
 * definition lists, heading attributes) into HTML that md4c passes through,
 * recursing into their bodies. Footnote and abbreviation definitions are
 * removed and recorded on the state; fenced code is copied untouched.
 */
export function processBlocks(lines: string[], state: State): string[] {
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
          `${indent}<input type="radio" name="tab-${set}" id="${id}"${tabIndex === 0 ? " checked" : ""}><label for="${id}">${Bun.escapeHTML(tab.label)}</label>`,
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

export { admonitionTypes };
