import type { EditorSettings } from "./editor.ts";
import { encodeBase64Url } from "./markdown.ts";

/**
 * Adds Markdown-style typing to the visual editor: "# ", "- ", "1. " and "> "
 * at the start of a paragraph turn it into a heading, list or quote, closing
 * **, ~~, `, * or a [link](url) formats the text, and Enter on a ``` or ---
 * line makes a code block or a rule. Inside a code block Enter inserts a line
 * break, and a closing fence on its own line leaves the block.
 */
export function setupMarkdownShortcuts(content: HTMLElement) {
  const selectionRange = () => {
    const selection = getSelection();
    return selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  };

  const currentBlock = () => {
    const anchor = getSelection()?.anchorNode;
    const block = (anchor instanceof Element ? anchor : anchor?.parentElement)?.closest(
      "p, h1, h2, h3, h4, h5, h6, li, pre, blockquote",
    );
    return block && content.contains(block) ? block : null;
  };

  const textBeforeCaret = (block: Element) => {
    const range = selectionRange();
    if (!range) {
      return "";
    }
    const before = range.cloneRange();
    before.selectNodeContents(block);
    before.setEnd(range.startContainer, range.startOffset);
    return before.toString().replace(/\u00a0/g, " ");
  };

  const placeCaret = (node: Node, offset = 0) => {
    const range = document.createRange();
    range.setStart(node, offset);
    range.collapse(true);
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(range);
  };

  const turnIntoList = (tag: "ul" | "ol") => {
    const paragraph = currentBlock();
    if (!paragraph || paragraph.tagName !== "P") {
      return;
    }
    const listElement = document.createElement(tag);
    const item = document.createElement("li");
    item.append(...paragraph.childNodes);
    if (!item.textContent) {
      item.innerHTML = "<br>";
    }
    listElement.append(item);
    paragraph.replaceWith(listElement);
    placeCaret(item.firstChild ?? item, 0);
  };

  const blockShortcuts: [RegExp, (match: RegExpExecArray) => void][] = [
    [/^(#{1,6}) $/, (match) => document.execCommand("formatBlock", false, `h${match[1]!.length}`)],
    [/^[-*+] $/, () => turnIntoList("ul")],
    [/^1[.)] $/, () => turnIntoList("ol")],
    [/^> $/, () => document.execCommand("formatBlock", false, "blockquote")],
  ];

  const inlineShortcuts: [RegExp, (match: RegExpExecArray) => HTMLElement][] = [
    [/\*\*([^*]+)\*\*$/, (match) => Object.assign(document.createElement("strong"), { textContent: match[1] })],
    [/~~([^~]+)~~$/, (match) => Object.assign(document.createElement("s"), { textContent: match[1] })],
    [/`([^`]+)`$/, (match) => Object.assign(document.createElement("code"), { textContent: match[1] })],
    [/(?<![*\w])\*([^*\s][^*]*)\*$/, (match) => Object.assign(document.createElement("em"), { textContent: match[1] })],
    [
      /\[([^\]]+)\]\(([^)\s]+)\)$/,
      (match) => Object.assign(document.createElement("a"), { textContent: match[1], href: match[2] }),
    ],
  ];

  content.addEventListener("input", (event) => {
    const inputEvent = event as InputEvent;
    if (inputEvent.inputType !== "insertText" || !inputEvent.data) {
      return;
    }
    const block = currentBlock();
    if (inputEvent.data === " " && block?.tagName === "P") {
      const before = textBeforeCaret(block);
      for (const [pattern, apply] of blockShortcuts) {
        const match = pattern.exec(before);
        if (match) {
          const rest = (block.textContent ?? "").replace(/\u00a0/g, " ").slice(before.length);
          block.textContent = rest;
          if (!rest) {
            block.innerHTML = "<br>";
          }
          placeCaret(block.firstChild ?? block, 0);
          apply(match);
          return;
        }
      }
    }
    const range = selectionRange();
    const node = range?.startContainer;
    if (!range || !node || node.nodeType !== Node.TEXT_NODE || block?.closest("pre, code")) {
      return;
    }
    const text = (node.textContent ?? "").slice(0, range.startOffset);
    for (const [pattern, create] of inlineShortcuts) {
      const match = pattern.exec(text);
      if (match) {
        const start = range.startOffset - match[0].length;
        const target = document.createRange();
        target.setStart(node, start);
        target.setEnd(node, range.startOffset);
        target.deleteContents();
        const created = create(match);
        target.insertNode(created);
        const separator = document.createTextNode("\u200b");
        created.after(separator);
        placeCaret(separator, 1);
        return;
      }
    }
  });

  content.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) {
      return;
    }
    const block = currentBlock();
    const pre = block?.closest("pre");
    if (pre) {
      event.preventDefault();
      const before = textBeforeCaret(pre);
      const lastLine = before.slice(before.lastIndexOf("\n") + 1).trim();
      if (/^(```|~~~)$/.test(lastLine)) {
        const codeElement = pre.querySelector("code") ?? pre;
        codeElement.textContent = (codeElement.textContent ?? "").replace(/\n?(```|~~~)\s*$/, "");
        const paragraph = document.createElement("p");
        paragraph.innerHTML = "<br>";
        pre.after(paragraph);
        placeCaret(paragraph, 0);
      } else {
        const range = selectionRange();
        if (range) {
          range.deleteContents();
          let node = range.startContainer;
          let offset = range.startOffset;
          if (node.nodeType !== Node.TEXT_NODE) {
            const text = document.createTextNode("");
            range.insertNode(text);
            node = text;
            offset = 0;
          }
          const atEnd = textBeforeCaret(pre).length >= (pre.textContent ?? "").replace(/\n$/, "").length;
          (node as Text).insertData(
            offset,
            atEnd && !(node.textContent ?? "").slice(offset).startsWith("\n") ? "\n\n" : "\n",
          );
          placeCaret(node, offset + 1);
        }
      }
      content.dispatchEvent(new Event("input"));
      return;
    }
    if (block?.tagName !== "P") {
      return;
    }
    const text = (block.textContent ?? "").replace(/\u00a0/g, " ").trim();
    const fence = /^(```|~~~)\s*([\w+-]*)\s*(.*)$/.exec(text);
    if (fence) {
      event.preventDefault();
      const code = document.createElement("code");
      if (fence[2]) {
        code.className = `language-${fence[2]}${fence[3] ? `::${encodeBase64Url(fence[3])}` : ""}`;
      }
      code.textContent = "\n";
      const codeBlock = document.createElement("pre");
      codeBlock.append(code);
      block.replaceWith(codeBlock);
      placeCaret(code.firstChild!, 0);
      content.dispatchEvent(new Event("input"));
    } else if (/^(-{3,}|\*{3,}|_{3,})$/.test(text)) {
      event.preventDefault();
      const paragraph = document.createElement("p");
      paragraph.innerHTML = "<br>";
      block.replaceWith(document.createElement("hr"), paragraph);
      placeCaret(paragraph, 0);
      content.dispatchEvent(new Event("input"));
    }
  });
}

/**
 * Renders plain text that looks like Markdown into HTML through the server when
 * pasted into the visual editor. HTML pastes and plain prose keep the browser's
 * default, and a failed render falls back to inserting the text as is.
 */
export function setupMarkdownPaste(content: HTMLElement, settings: EditorSettings) {
  content.addEventListener("paste", (event) => {
    const html = event.clipboardData?.getData("text/html");
    const text = event.clipboardData?.getData("text/plain") ?? "";
    if (!settings.render || html || !/(^|\n)\s*(#{1,6}\s|[-*+]\s|\d+\.\s|>|```)|\*\*|`|\[[^\]]+\]\(/.test(text)) {
      return;
    }
    event.preventDefault();
    fetch(settings.render, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ markdown: text }),
    })
      .then((response) => response.json() as Promise<{ html: string }>)
      .then((rendered) => {
        document.execCommand("insertHTML", false, rendered.html);
      })
      .catch(() => document.execCommand("insertText", false, text));
  });
}
