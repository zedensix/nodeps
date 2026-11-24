import { draftKey, pendingKey, storage } from "./storage.ts";
import { htmlToMarkdown } from "./markdown.ts";
import {
  escapeHtml,
  pendingHtml,
  publishWithAccount,
  publishWithoutAccount,
  pullRequestStatus,
  showPanel,
  type Pending,
} from "./publish.ts";
import { setupMarkdownPaste, setupMarkdownShortcuts } from "./shortcuts.ts";

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

/**
 * Finds an element the editor template is known to contain.
 */
function element<Type extends HTMLElement>(root: ParentNode, selector: string) {
  return root.querySelector<Type>(selector)!;
}

/**
 * Shows the review status of the pull request sent from this device above the
 * page header. Only sites with GitHub sign-in track pull requests, and the
 * record is dropped once the change is merged or closed.
 */
export async function showPendingBanner(settings: EditorSettings) {
  const stored = storage.get(pendingKey(settings));
  if (!stored || !settings.oauth) {
    return;
  }
  const pending = JSON.parse(stored) as Pending;
  const status = await pullRequestStatus(settings.base, pending.number);
  const state = status?.state ?? "open";
  const banner = document.createElement("div");
  banner.className = `edit-banner edit-banner-${state}`;
  banner.innerHTML = pendingHtml(pending, state);
  document.querySelector(".page-header")?.after(banner);
  if (state !== "open") {
    storage.remove(pendingKey(settings));
  }
}

/**
 * Opens the page editor in a modal dialog built from the layout's template,
 * loaded with the page's Markdown and rendered HTML or with the draft saved on
 * this device. The visual mode edits HTML that is converted back to Markdown
 * on publish; the Markdown mode edits the source and needs the server to switch
 * back. The dialog is removed from the page when it closes.
 */
export async function openEditor(settings: EditorSettings) {
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

  setupMarkdownShortcuts(content);
  setupMarkdownPaste(content, settings);

  const serializeDraft = () => JSON.stringify({ mode, value: mode === "visual" ? content.innerHTML : source.value });
  let saveTimer: Timer | undefined;
  const scheduleSave = () => {
    clearTimeout(saveTimer);
    status.textContent = "Editing…";
    saveTimer = setTimeout(() => {
      storage.set(draftKey(settings), serializeDraft());
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

  const publishing = { settings, dialog, panel, markdown, serializeDraft };

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
      (settings.oauth ? publishWithAccount(publishing) : publishWithoutAccount(publishing)).catch((error: Error) => {
        showPanel(
          panel,
          `<p class="editor-panel-title">Publishing failed</p><p>${escapeHtml(error.message)}</p><button type="button" class="pill-button" data-editor="dismiss">Back to editing</button>`,
        );
      });
    }
  });
}
