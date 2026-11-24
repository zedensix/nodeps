export interface EditorSettings {
  source: string;
  title: string;
  payload: string;
  editUrl: string | null;
  provider: string | null;
  oauth: boolean;
  base: string;
  render: string | null;
}

interface Payload {
  frontmatter: string;
  body: string;
  html: string;
}

interface Pending {
  number: number;
  url: string;
}

const storage = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage can be blocked by the browser: drafts then only live while the editor is open.
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Same as above: nothing to clean when storage is blocked.
    }
  },
};

const draftKey = (settings: EditorSettings) => `nodeps-draft:${settings.source}`;
const pendingKey = (settings: EditorSettings) => `nodeps-pending:${settings.source}`;

function escapeMarkdown(text: string) {
  let escaped = text;
  for (const marker of ["*", "_", "`"]) {
    if (escaped.split(marker).length > 2) {
      escaped = escaped.replaceAll(marker, `\\${marker}`);
    }
  }
  return escaped;
}

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

function hasBlockChildren(element: Element) {
  return [...element.children].some((child) => blockTags.has(child.tagName));
}

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

function decodeBase64(encoded: string) {
  return new TextDecoder().decode(Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0)));
}

function encodeBase64Url(text: string) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

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

export function htmlToMarkdown(root: Element) {
  return blocks(root).join("\n\n").trim();
}

function element<Type extends HTMLElement>(root: ParentNode, selector: string) {
  return root.querySelector<Type>(selector)!;
}

function showPanel(panel: HTMLElement, html: string) {
  panel.innerHTML = `<div class="editor-panel-card">${html}</div>`;
  panel.hidden = false;
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

async function pullRequestStatus(number: number) {
  const response = await fetch(`${location.origin}${baseOf()}_editor/status?number=${number}`, {
    credentials: "same-origin",
  });
  return response.ok ? ((await response.json()) as { state: string; url: string }) : undefined;
}

let currentBase = "/";
const baseOf = () => currentBase;

function pendingHtml(pending: Pending, state: string) {
  if (state === "merged") {
    return `<p class="editor-panel-title">Approved</p><p>Your change was merged. It appears on the site after the next deploy.</p><a class="pill-button" href="${escapeHtml(pending.url)}" target="_blank" rel="noopener">View the change</a>`;
  }
  if (state === "closed") {
    return `<p class="editor-panel-title">Not accepted</p><p>Your change was closed without being merged.</p><a class="pill-button" href="${escapeHtml(pending.url)}" target="_blank" rel="noopener">See the discussion</a>`;
  }
  return `<p class="editor-panel-title"><span class="editor-spinner"></span>Waiting for approval</p><p>Your change was sent for review as pull request #${pending.number}. You can close this page; we keep track of it on this device.</p><a class="pill-button" href="${escapeHtml(pending.url)}" target="_blank" rel="noopener">View pull request #${pending.number}</a>`;
}

export async function showPendingBanner(settings: EditorSettings) {
  currentBase = settings.base;
  const stored = storage.get(pendingKey(settings));
  if (!stored || !settings.oauth) {
    return;
  }
  const pending = JSON.parse(stored) as Pending;
  const status = await pullRequestStatus(pending.number);
  const state = status?.state ?? "open";
  const banner = document.createElement("div");
  banner.className = `edit-banner edit-banner-${state}`;
  banner.innerHTML = pendingHtml(pending, state);
  document.querySelector(".page-header")?.after(banner);
  if (state !== "open") {
    storage.remove(pendingKey(settings));
  }
}

export async function openEditor(settings: EditorSettings) {
  currentBase = settings.base;
  const template = document.querySelector<HTMLTemplateElement>("#nodeps-editor-template");
  if (!template) {
    return;
  }
  const dialog = template.content.firstElementChild!.cloneNode(true) as HTMLDialogElement;
  document.body.append(dialog);
  const content = element<HTMLElement>(dialog, ".editor-content");
  const status = element<HTMLElement>(dialog, ".editor-status");
  const panel = element<HTMLElement>(dialog, ".editor-panel");
  const discard = element<HTMLButtonElement>(dialog, '[data-editor="discard"]');
  const linkInput = element<HTMLInputElement>(dialog, ".editor-link-input");
  element<HTMLElement>(dialog, ".editor-page-title").textContent = settings.title;

  const response = await fetch(settings.payload);
  if (!response.ok) {
    dialog.remove();
    throw new Error(`Could not load ${settings.payload}`);
  }
  const payload = (await response.json()) as Payload;
  const source = element<HTMLTextAreaElement>(dialog, ".editor-source");
  const toolbar = element<HTMLElement>(dialog, ".editor-toolbar");
  let mode: "visual" | "markdown" = "visual";

  const showMode = (next: "visual" | "markdown") => {
    mode = next;
    content.hidden = next !== "visual";
    source.hidden = next !== "markdown";
    toolbar.classList.toggle("disabled", next !== "visual");
    for (const button of dialog.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
      button.setAttribute("aria-pressed", String(button.dataset.mode === next));
    }
  };

  const storedDraft = storage.get(draftKey(settings));
  let draft: { mode: "visual" | "markdown"; value: string } | null = null;
  if (storedDraft !== null) {
    try {
      draft = JSON.parse(storedDraft);
    } catch {
      draft = { mode: "visual", value: storedDraft };
    }
  }
  content.innerHTML = draft?.mode === "visual" ? draft.value : payload.html;
  source.value = draft?.mode === "markdown" ? draft.value : payload.body.trim();
  showMode(draft?.mode ?? "visual");
  discard.hidden = draft === null;
  status.textContent = draft === null ? "" : "Restored your unpublished draft";

  const setMode = async (next: "visual" | "markdown") => {
    if (next === mode) {
      return;
    }
    if (next === "markdown") {
      source.value = htmlToMarkdown(content);
      showMode("markdown");
      source.focus();
      return;
    }
    if (!settings.render) {
      status.textContent = "The visual mode needs the server; keep editing the Markdown, publishing uses it as is";
      return;
    }
    const response = await fetch(settings.render, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ markdown: source.value }),
    });
    if (!response.ok) {
      status.textContent = "Could not switch back to the visual mode";
      return;
    }
    content.innerHTML = ((await response.json()) as { html: string }).html;
    showMode("visual");
    content.focus();
  };

  dialog.addEventListener("close", () => dialog.remove());
  dialog.showModal();
  document.execCommand("defaultParagraphSeparator", false, "p");
  content.focus();

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

  let saveTimer: Timer | undefined;
  const scheduleSave = () => {
    clearTimeout(saveTimer);
    status.textContent = "Editing…";
    saveTimer = setTimeout(() => {
      storage.set(
        draftKey(settings),
        JSON.stringify({ mode, value: mode === "visual" ? content.innerHTML : source.value }),
      );
      discard.hidden = false;
      status.textContent = "Draft saved on this device";
    }, 400);
  };
  content.addEventListener("input", scheduleSave);
  source.addEventListener("input", scheduleSave);

  let savedRange: Range | null = null;
  const applyLink = () => {
    const selection = getSelection();
    if (savedRange && selection) {
      selection.removeAllRanges();
      selection.addRange(savedRange);
    }
    const url = linkInput.value.trim();
    document.execCommand(url ? "createLink" : "unlink", false, url);
    linkInput.hidden = true;
    linkInput.value = "";
    content.focus();
    content.dispatchEvent(new Event("input"));
  };
  linkInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyLink();
    } else if (event.key === "Escape") {
      event.preventDefault();
      linkInput.hidden = true;
      content.focus();
    }
  });

  const runCommand = (command: string, value?: string) => {
    if (command === "link") {
      const selection = getSelection();
      savedRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
      const anchor = savedRange?.startContainer.parentElement?.closest("a");
      linkInput.value = anchor?.getAttribute("href") ?? "";
      linkInput.hidden = false;
      linkInput.focus();
      return;
    }
    if (command === "code") {
      const selection = getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        return;
      }
      const range = selection.getRangeAt(0);
      const code = document.createElement("code");
      code.textContent = range.toString();
      range.deleteContents();
      range.insertNode(code);
    } else {
      document.execCommand(command, false, value);
    }
    content.focus();
    content.dispatchEvent(new Event("input"));
  };

  dialog.addEventListener("mousedown", (event) => {
    if ((event.target as HTMLElement).closest("[data-command]")) {
      event.preventDefault();
    }
  });

  const markdown = () => {
    const body = mode === "markdown" ? source.value.trim() : htmlToMarkdown(content);
    return payload.frontmatter ? `${payload.frontmatter.trimEnd()}\n\n${body}\n` : `${body}\n`;
  };

  const publishWithoutAccount = async () => {
    const text = markdown();
    if (!settings.editUrl) {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
      link.download = settings.source.split("/").at(-1)!;
      link.click();
      showPanel(
        panel,
        `<p class="editor-panel-title">File downloaded</p><p>Send <code>${escapeHtml(link.download)}</code> to the documentation team, or replace the file in the repository.</p><button type="button" class="pill-button" data-editor="dismiss">Back to editing</button>`,
      );
      return;
    }
    let copied = true;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      copied = false;
    }
    showPanel(
      panel,
      `<p class="editor-panel-title">${copied ? "Your changes are copied" : "Copy your changes"}</p>
<ol>
<li>Open the page in ${escapeHtml(settings.provider ?? "the repository")}.</li>
<li>Select all the text in its editor and paste yours over it.</li>
<li>Click <strong>Commit changes</strong> or <strong>Propose changes</strong>. A maintainer reviews it before it goes live.</li>
</ol>
${copied ? "" : `<textarea class="editor-copy-area" readonly>${escapeHtml(text)}</textarea>`}
<div class="editor-panel-actions"><a class="pill-button primary" href="${escapeHtml(settings.editUrl)}" target="_blank" rel="noopener">Open ${escapeHtml(settings.provider ?? "editor")}</a><button type="button" class="pill-button" data-editor="dismiss">Back to editing</button></div>`,
    );
  };

  const publishWithAccount = async () => {
    const me = await fetch(`${settings.base}_auth/me`, { credentials: "same-origin" });
    if (me.status === 401) {
      storage.set(
        draftKey(settings),
        JSON.stringify({ mode, value: mode === "visual" ? content.innerHTML : source.value }),
      );
      showPanel(
        panel,
        `<p class="editor-panel-title">Sign in to send your changes</p><p>Your draft is saved. After signing in with GitHub you come back here and your changes are sent for review.</p><div class="editor-panel-actions"><a class="pill-button primary" href="${escapeHtml(`${settings.base}_auth/login?return=${encodeURIComponent(location.pathname)}`)}">Sign in with GitHub</a><button type="button" class="pill-button" data-editor="dismiss">Back to editing</button></div>`,
      );
      return;
    }
    showPanel(
      panel,
      `<p class="editor-panel-title"><span class="editor-spinner"></span>Sending your changes…</p><p>Creating a branch and a pull request. This can take a few seconds.</p>`,
    );
    const response = await fetch(`${settings.base}_editor/publish`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: settings.source, content: markdown() }),
    });
    const result = (await response.json()) as Partial<Pending> & { error?: string };
    if (!response.ok || !result.number || !result.url) {
      showPanel(
        panel,
        `<p class="editor-panel-title">Publishing failed</p><p>${escapeHtml(result.error ?? "Unknown error")}</p><button type="button" class="pill-button" data-editor="dismiss">Back to editing</button>`,
      );
      return;
    }
    const pending = { number: result.number, url: result.url };
    storage.set(pendingKey(settings), JSON.stringify(pending));
    storage.remove(draftKey(settings));
    showPanel(
      panel,
      `${pendingHtml(pending, "open")}<button type="button" class="pill-button" data-editor="close">Close the editor</button>`,
    );
    const poll = setInterval(async () => {
      if (!dialog.isConnected) {
        clearInterval(poll);
        return;
      }
      const state = (await pullRequestStatus(pending.number))?.state;
      if (state && state !== "open") {
        clearInterval(poll);
        storage.remove(pendingKey(settings));
        showPanel(
          panel,
          `${pendingHtml(pending, state)}<button type="button" class="pill-button" data-editor="close">Close the editor</button>`,
        );
      }
    }, 20_000);
  };

  dialog.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const modeButton = target.closest<HTMLElement>("[data-mode]");
    if (modeButton) {
      setMode(modeButton.dataset.mode as "visual" | "markdown").catch(() => {
        status.textContent = "Could not switch modes";
      });
      return;
    }
    const command = target.closest<HTMLElement>("[data-command]");
    if (command && mode !== "visual") {
      return;
    }
    if (command) {
      runCommand(command.dataset.command!, command.dataset.value);
      return;
    }
    const action = target.closest<HTMLElement>("[data-editor]")?.dataset.editor;
    if (action === "close") {
      dialog.close();
    } else if (action === "dismiss") {
      panel.hidden = true;
      content.focus();
    } else if (action === "discard") {
      storage.remove(draftKey(settings));
      content.innerHTML = payload.html;
      source.value = payload.body.trim();
      showMode("visual");
      discard.hidden = true;
      status.textContent = "Draft discarded";
    } else if (action === "publish") {
      (settings.oauth ? publishWithAccount() : publishWithoutAccount()).catch((error: Error) => {
        showPanel(
          panel,
          `<p class="editor-panel-title">Publishing failed</p><p>${escapeHtml(error.message)}</p><button type="button" class="pill-button" data-editor="dismiss">Back to editing</button>`,
        );
      });
    }
  });
}
