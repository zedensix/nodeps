import type { EditorSettings } from "./editor.ts";
import { draftKey, pendingKey, storage } from "./storage.ts";

export interface Pending {
  number: number;
  url: string;
}

export interface PublishContext {
  settings: EditorSettings;
  dialog: HTMLDialogElement;
  panel: HTMLElement;
  markdown: () => string;
  serializeDraft: () => string;
}

/**
 * Shows a message card over the editor, replacing whatever card was there.
 */
export function showPanel(panel: HTMLElement, html: string) {
  panel.innerHTML = `<div class="editor-panel-card">${html}</div>`;
  panel.hidden = false;
}

/**
 * Escapes text for HTML content and attribute values by turning every special
 * character into a numeric entity.
 */
export function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

/**
 * Asks the server for the state of a pull request opened from the editor.
 * Returns undefined when the server cannot tell, which callers treat as still
 * open.
 */
export async function pullRequestStatus(base: string, number: number) {
  const response = await fetch(`${location.origin}${base}_editor/status?number=${number}`, {
    credentials: "same-origin",
  });
  return response.ok ? ((await response.json()) as { state: string; url: string }) : undefined;
}

/**
 * Builds the card content describing a sent change: merged, closed without
 * merge, or still waiting for review.
 */
export function pendingHtml(pending: Pending, state: string) {
  if (state === "merged") {
    return `<p class="editor-panel-title">Approved</p><p>Your change was merged. It appears on the site after the next deploy.</p><a class="pill-button" href="${escapeHtml(pending.url)}" target="_blank" rel="noopener">View the change</a>`;
  }
  if (state === "closed") {
    return `<p class="editor-panel-title">Not accepted</p><p>Your change was closed without being merged.</p><a class="pill-button" href="${escapeHtml(pending.url)}" target="_blank" rel="noopener">See the discussion</a>`;
  }
  return `<p class="editor-panel-title"><span class="editor-spinner"></span>Waiting for approval</p><p>Your change was sent for review as pull request #${pending.number}. You can close this page; we keep track of it on this device.</p><a class="pill-button" href="${escapeHtml(pending.url)}" target="_blank" rel="noopener">View pull request #${pending.number}</a>`;
}

/**
 * Publishes when the site has no GitHub sign-in: downloads the Markdown file when the
 * site has no repository link, otherwise copies it and explains how to paste
 * it into the provider's web editor. When the clipboard refuses, the text is
 * shown in a box to copy by hand.
 */
export async function publishWithoutAccount({ settings, panel, markdown }: PublishContext) {
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
}

/**
 * Publishes through the server, which opens a branch and a pull request as the
 * signed-in GitHub user. A visitor who is not signed in gets the draft saved
 * and a sign-in link that brings them back. Once the pull
 * request is open it is tracked on this device and polled every 20 seconds
 * while the editor stays open, until it is merged or closed.
 */
export async function publishWithAccount({ settings, dialog, panel, markdown, serializeDraft }: PublishContext) {
  const me = await fetch(`${settings.base}_auth/me`, { credentials: "same-origin" });
  if (me.status === 401) {
    storage.set(draftKey(settings), serializeDraft());
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
    const state = (await pullRequestStatus(settings.base, pending.number))?.state;
    if (state && state !== "open") {
      clearInterval(poll);
      storage.remove(pendingKey(settings));
      showPanel(
        panel,
        `${pendingHtml(pending, state)}<button type="button" class="pill-button" data-editor="close">Close the editor</button>`,
      );
    }
  }, 20_000);
}
