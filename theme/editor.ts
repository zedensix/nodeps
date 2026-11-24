export interface EditorSettings {
  source: string;
  title: string;
  payload: string;
  editUrl: string | null;
  provider: string | null;
  oauth: boolean;
  base: string;
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
    return escapeMarkdown((node.textContent ?? "").replace(/\s+/g, " "));
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
      return code ? `${fence}${code}${fence}` : "";
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
      for (const child of item.childNodes) {
        if (child instanceof Element && (child.tagName === "UL" || child.tagName === "OL")) {
          parts.push(list(child, child.tagName === "OL"));
        } else if (child instanceof Element && child.tagName === "P") {
          text += (text ? " " : "") + inline(child).trim();
        } else {
          text += inline(child);
        }
      }
      const indent = " ".repeat(marker.length);
      const nested = parts.map((part) => part.replace(/^/gm, indent)).join("\n");
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
  const draft = storage.get(draftKey(settings));
  content.innerHTML = draft ?? payload.html;
  discard.hidden = draft === null;
  status.textContent = draft === null ? "" : "Restored your unpublished draft";

  dialog.addEventListener("close", () => dialog.remove());
  dialog.showModal();
  document.execCommand("defaultParagraphSeparator", false, "p");
  content.focus();

  let saveTimer: Timer | undefined;
  content.addEventListener("input", () => {
    clearTimeout(saveTimer);
    status.textContent = "Editing…";
    saveTimer = setTimeout(() => {
      storage.set(draftKey(settings), content.innerHTML);
      discard.hidden = false;
      status.textContent = "Draft saved on this device";
    }, 400);
  });

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
    const body = htmlToMarkdown(content);
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
      storage.set(draftKey(settings), content.innerHTML);
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
    const command = target.closest<HTMLElement>("[data-command]");
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
