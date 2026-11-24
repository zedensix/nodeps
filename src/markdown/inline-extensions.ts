import { parseAttributes } from "./attribute-lists.ts";
import type { State } from "./extensions.ts";
import { emoji, icon, isIcon } from "../icons/icons.ts";

/**
 * Wraps `$$...$$` and `$...$` math in arithmatex spans and entity-encodes the
 * characters Markdown would otherwise read as emphasis, marks or escapes.
 * A `$` followed by a digit is left alone so prices are not taken for math.
 */
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

/**
 * Renders a `:name:` shortcode as an inline icon, accepting an optional
 * `lucide-` prefix, and falls back to an emoji. Returns undefined for unknown
 * names so the text stays as written.
 */
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

/**
 * Applies the inline extensions to one line: footnote references (numbered in
 * order of first use), `++keys++`, icon shortcodes, `==mark==`, `^^ins^^`,
 * `~sub~` and `^sup^`. Code spans, math and raw HTML are swapped for
 * placeholders first so nothing inside them is rewritten.
 */
function transformInline(text: string, state: State) {
  const protectedParts: string[] = [];
  const protect = (value: string) => {
    protectedParts.push(value);
    return `${protectedParts.length - 1}`;
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
      `<sup class="footnote-ref" id="fnref-${Bun.escapeHTML(id)}"><a href="#fn-${Bun.escapeHTML(id)}">${number}</a></sup>`,
    );
  });
  output = output.replace(/\+\+([^\s+][^+]*?(?:\+[^+\s][^+]*?)*)\+\+/g, (_match, keys: string) =>
    protect(
      `<span class="keys">${keys
        .split("+")
        .map(
          (key) =>
            `<kbd>${Bun.escapeHTML(keyNames[key.toLowerCase()] ?? key.charAt(0).toUpperCase() + key.slice(1))}</kbd>`,
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
    .replace(/(\d+)/g, (_match, index: string) => protectedParts[Number(index)]!)
    .replace(/(\d+)/g, (_match, index: string) => protectedParts[Number(index)]!);
}

/**
 * Runs the inline extensions on each line, except lines that open or close
 * the HTML wrappers the block pass emitted, which must reach md4c untouched.
 */
export function transformLines(lines: string[], state: State) {
  return lines.map((line) =>
    /^\s*<\/?(div|details|summary|dl|dt|dd|input|label)\b/.test(line) ? line : transformInline(line, state),
  );
}
