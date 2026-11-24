/**
 * Escapes *, _ and ` only when a text holds two or more of the same marker,
 * since a lone one cannot open emphasis or code and stays readable.
 */
function escapeMarkdown(text: string) {
  let escaped = text;
  for (const marker of ["*", "_", "`"]) {
    if (escaped.split(marker).length > 2) {
      escaped = escaped.replaceAll(marker, `\\${marker}`);
    }
  }
  return escaped;
}

/**
 * Converts an inline node to Markdown. Zero-width spaces left by the typing
 * shortcuts are dropped, whitespace collapses, and inline tags Markdown has no
 * syntax for (kbd, sub, sup, mark...) are kept as raw HTML.
 */
function inline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeMarkdown((node.textContent ?? "").replace(/\u200b/g, "").replace(/\s+/g, " "));
  }
  if (!(node instanceof HTMLElement)) {
    return "";
  }
  const children = () => [...node.childNodes].map(inline).join("");
  switch (node.tagName) {
    case "STRONG":
    case "B":
      return wrap(children(), "**");
    case "EM":
    case "I":
      return wrap(children(), "*");
    case "DEL":
    case "S":
    case "STRIKE":
      return wrap(children(), "~~");
    case "CODE": {
      const code = node.textContent ?? "";
      const fence = code.includes("`") ? "``" : "`";
      const padding = code.startsWith("`") || code.endsWith("`") ? " " : "";
      return code ? `${fence}${padding}${code}${padding}${fence}` : "";
    }
    case "A":
      return `[${children()}](${node.getAttribute("href") ?? ""})`;
    case "IMG":
      return `![${node.getAttribute("alt") ?? ""}](${node.getAttribute("src") ?? ""})`;
    case "BR":
      return "\\\n";
    case "INPUT":
      return "";
    case "KBD":
    case "SUB":
    case "SUP":
    case "MARK":
    case "ABBR":
    case "U":
    case "SMALL":
      return node.outerHTML;
    default:
      return children();
  }
}

/**
 * Wraps text in an emphasis marker, moving surrounding whitespace outside the
 * markers since Markdown ignores `** bold **`.
 */
function wrap(text: string, marker: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return text;
  }
  const leading = text.slice(0, text.indexOf(trimmed[0]!));
  const trailing = text.slice(text.lastIndexOf(trimmed.at(-1)!) + 1);
  return `${leading}${marker}${trimmed}${marker}${trailing}`;
}

const blockTags = new Set([
  "P",
  "DIV",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "UL",
  "OL",
  "BLOCKQUOTE",
  "PRE",
  "TABLE",
  "HR",
  "FIGURE",
]);

/**
 * Tells whether an element contains block elements, such as a div that the
 * browser filled with paragraphs.
 */
function hasBlockChildren(element: Element) {
  return [...element.children].some((child) => blockTags.has(child.tagName));
}

/**
 * Converts a ul or ol to Markdown, keeping the start number, task checkboxes,
 * and nested lists or blocks indented under their item. Only an item's first
 * paragraph joins its text; later blocks become indented paragraphs.
 */
function list(element: Element, ordered: boolean): string {
  const start = Number(element.getAttribute("start") ?? 1);
  return [...element.children]
    .filter((child) => child.tagName === "LI")
    .map((item, index) => {
      const marker = ordered ? `${start + index}. ` : "- ";
      const checkbox = item.querySelector<HTMLInputElement>(":scope > input[type=checkbox]");
      const task = checkbox ? (checkbox.checked ? "[x] " : "[ ] ") : "";
      const parts: string[] = [];
      let text = "";
      let paragraphs = 0;
      for (const child of item.childNodes) {
        if (child instanceof Element && (child.tagName === "UL" || child.tagName === "OL")) {
          parts.push(list(child, child.tagName === "OL"));
        } else if (child instanceof Element && child.tagName === "P" && paragraphs === 0 && parts.length === 0) {
          text += (text ? " " : "") + inline(child).trim();
          paragraphs++;
        } else if (child instanceof Element && blockTags.has(child.tagName)) {
          parts.push(`\n${blocks({ childNodes: [child] } as unknown as Node).join("\n\n")}`);
        } else {
          text += inline(child);
        }
      }
      const indent = " ".repeat(marker.length);
      const nested = parts.map((part) => part.replace(/^(?=.)/gm, indent)).join("\n");
      return `${marker}${task}${text.trim()}${nested ? `\n${nested}` : ""}`;
    })
    .join("\n");
}

/**
 * Converts a table to a pipe table, treating the first row as the header and
 * padding short rows to the widest one.
 */
function table(element: HTMLTableElement) {
  const rows = [...element.rows].map((row) => [...row.cells].map((cell) => inline(cell).trim().replace(/\|/g, "\\|")));
  if (rows.length === 0) {
    return "";
  }
  const columns = Math.max(...rows.map((row) => row.length));
  const line = (cells: string[]) =>
    `| ${Array.from({ length: columns }, (_, index) => cells[index] ?? "").join(" | ")} |`;
  return [line(rows[0]!), line(Array.from({ length: columns }, () => "---")), ...rows.slice(1).map(line)].join("\n");
}

/**
 * Converts a pre to a fenced block. The fence info after the language travels
 * base64url-encoded in the code's class (`language-ts::meta`) and is decoded
 * back here. The fence grows to four backticks when the code holds three.
 */
function codeBlock(element: Element) {
  const code = element.querySelector("code");
  const text = ((element as HTMLElement).innerText ?? element.textContent ?? "").replace(/\n$/, "");
  const [language = "", encodedMeta] = (code?.className.match(/language-(\S+)/)?.[1] ?? "").split("::");
  let meta = "";
  if (encodedMeta) {
    const base64 = encodedMeta.replace(/-/g, "+").replace(/_/g, "/");
    meta = ` ${new TextDecoder().decode(Uint8Array.from(atob(base64), (character) => character.charCodeAt(0)))}`;
  }
  const fence = text.includes("```") ? "````" : "```";
  return `${fence}${language}${meta}\n${text}\n${fence}`;
}

/**
 * Decodes standard base64 to a UTF-8 string.
 */
function decodeBase64(encoded: string) {
  return new TextDecoder().decode(Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0)));
}

/**
 * Encodes a UTF-8 string as unpadded base64url, the form fence info takes in a
 * code element's class.
 */
export function encodeBase64Url(text: string) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Converts the children of a node to a list of Markdown blocks. Runs of inline
 * nodes are gathered into one paragraph, elements carrying raw Markdown are
 * emitted verbatim, and data-* placeholder divs (such as the theme gallery)
 * are kept as HTML.
 */
function blocks(parent: Node): string[] {
  const output: string[] = [];
  let pendingInline = "";
  const flush = () => {
    if (pendingInline.trim()) {
      output.push(pendingInline.trim());
    }
    pendingInline = "";
  };
  for (const node of parent.childNodes) {
    if (node instanceof HTMLElement && node.dataset.rawMarkdown !== undefined) {
      flush();
      output.push(decodeBase64(node.dataset.rawMarkdown));
      continue;
    }
    if (!(node instanceof Element) || (!blockTags.has(node.tagName) && !hasBlockChildren(node))) {
      pendingInline += inline(node);
      continue;
    }
    flush();
    const tag = node.tagName;
    if (/^H[1-6]$/.test(tag)) {
      output.push(`${"#".repeat(Number(tag[1]))} ${inline(node).trim()}`);
    } else if (tag === "UL" || tag === "OL") {
      output.push(list(node, tag === "OL"));
    } else if (tag === "BLOCKQUOTE") {
      const inner = blocks(node)
        .join("\n\n")
        .replace(/^\\?\[!(\w+)\\?\]\s*/, "[!$1]\n");
      output.push(inner.replace(/^/gm, "> ").replace(/^> $/gm, ">"));
    } else if (tag === "PRE") {
      output.push(codeBlock(node));
    } else if (tag === "TABLE") {
      output.push(table(node as HTMLTableElement));
    } else if (tag === "HR") {
      output.push("---");
    } else if (tag === "DIV" && [...node.attributes].some((attribute) => attribute.name.startsWith("data-"))) {
      output.push(node.outerHTML);
    } else if (tag === "P" || !hasBlockChildren(node)) {
      const text = inline(node).trim();
      if (text) {
        output.push(text);
      }
    } else {
      output.push(...blocks(node));
    }
  }
  flush();
  return output;
}

/**
 * Converts the visual editor's HTML back to the Markdown body that gets
 * published.
 */
export function htmlToMarkdown(root: Element) {
  return blocks(root).join("\n\n").trim();
}
