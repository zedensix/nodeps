import type { EditorSettings } from "./editor.ts";

/**
 * Reads the editor settings the server embeds in the page. Returns undefined
 * when editing is off for this page.
 */
function editorSettings() {
  const script = document.querySelector("script#nodeps-editor");
  return script ? (JSON.parse(script.textContent ?? "{}") as EditorSettings) : undefined;
}

/**
 * Loads the editor chunk on demand and opens it on the current page. Does
 * nothing when the page is not editable.
 */
export function openPageEditor() {
  const settings = editorSettings();
  if (settings) {
    import("./editor.ts")
      .then((editor) => editor.openEditor(settings))
      .catch((error) => console.error("Editor failed to open", error));
  }
}

/**
 * Tells whether a pull request sent from this device for this page is still
 * tracked, without loading the editor chunk.
 */
function hasPendingEdit(settings: EditorSettings) {
  try {
    return localStorage.getItem(`nodeps-pending:${settings.source}`) !== null;
  } catch {
    return false;
  }
}

/**
 * Loads the editor chunk only when this page has a tracked pull request, so it
 * can show the review status banner. Failures are silent: the banner is extra.
 */
export function checkPendingEdit() {
  const settings = editorSettings();
  if (settings && hasPendingEdit(settings)) {
    import("./editor.ts").then((editor) => editor.showPendingBanner(settings)).catch(() => {});
  }
}
