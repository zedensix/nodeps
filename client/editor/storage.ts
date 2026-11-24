import type { EditorSettings } from "./editor.ts";

export const storage = {
  /**
   * Reads a key, or null when it is missing or storage is blocked.
   */
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  /**
   * Writes a key, silently doing nothing when storage is blocked.
   */
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage can be blocked by the browser: drafts then only live while the editor is open.
    }
  },
  /**
   * Deletes a key, silently doing nothing when storage is blocked.
   */
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Same as above: nothing to clean when storage is blocked.
    }
  },
};

/**
 * Storage key of the unpublished draft of a page, per source file.
 */
export const draftKey = (settings: EditorSettings) => `nodeps-draft:${settings.source}`;

/**
 * Storage key of the pull request sent for a page, per source file. The client
 * reads the same key to decide whether to load the editor for the banner.
 */
export const pendingKey = (settings: EditorSettings) => `nodeps-pending:${settings.source}`;
