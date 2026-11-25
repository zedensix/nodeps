import { applyPreset, markCurrentPreset, setupColorMode, setupReaderMode } from "./appearance.ts";
import { checkPendingEdit, openEditorFromUrl, openPageEditor } from "./editor/launcher.ts";
import {
  renderRichContent,
  revealActiveTab,
  setupPromptLinks,
  setupTableOfContents,
  setupTabSync,
} from "./page-enhancements.ts";
import { setupPageTransitions } from "./page-transitions.ts";
import { openSearch, setupSearch } from "./search/dialog.ts";
import { setDrawer, setupDrawers } from "./sidebar.ts";
import { setupSidebarResize } from "./sidebar-resize.ts";
import { base, markdownUrl } from "./site-paths.ts";

if (!/Mac|iPhone|iPad/.test(navigator.userAgent)) {
  for (const shortcut of document.querySelectorAll(".search-trigger kbd")) {
    shortcut.textContent = "Ctrl K";
  }
}

/**
 * Shows the "copied" state on a button for a moment.
 */
function flash(button: HTMLElement) {
  button.classList.add("copied");
  setTimeout(() => button.classList.remove("copied"), 1600);
}

/**
 * Copies text to the clipboard and flashes the button on success. The text can
 * be a promise, such as a fetch of the page's Markdown, and failures are only
 * logged.
 */
async function copyText(button: HTMLElement, text: string | Promise<string>) {
  try {
    await navigator.clipboard.writeText(await text);
    flash(button);
  } catch (error) {
    console.error("Copy failed", error);
  }
}

setupColorMode();
setupReaderMode();
setupDrawers();
setupSidebarResize();

document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const toggledFolder = target.closest(".tree-folder summary");
  if (toggledFolder && !target.closest("a")) {
    toggledFolder.parentElement!.dataset.toggled = "";
  }
  const copyCode = target.closest<HTMLButtonElement>(".copy-code");
  if (copyCode) {
    copyText(copyCode, copyCode.closest("figure")!.querySelector("code")!.innerText);
  }

  const copyPage = target.closest<HTMLButtonElement>(".copy-page");
  const pageMarkdown = markdownUrl();
  if (copyPage && pageMarkdown) {
    copyText(
      copyPage,
      fetch(pageMarkdown).then((response) => response.text()),
    );
  }

  const copyMcp = target.closest<HTMLButtonElement>('[data-action="mcp"]');
  if (copyMcp) {
    const name =
      document.title
        .split(" · ")
        .at(-1)!
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "docs";
    copyText(copyMcp, `claude mcp add --transport http ${name} ${location.origin}${base}mcp`);
  }

  const copyTextButton = target.closest<HTMLButtonElement>("[data-copy-text]");
  if (copyTextButton) {
    copyText(copyTextButton, copyTextButton.dataset.copyText!);
  }

  const installButton = target.closest<HTMLButtonElement>("[data-copy-skill]");
  if (installButton) {
    const archive = new URL(installButton.dataset.copySkill!, location.href).href;
    copyText(installButton, `mkdir -p ~/.claude/skills && curl -fsSL ${archive} | tar -xz -C ~/.claude/skills`);
  }

  const editButton = target.closest<HTMLElement>("[data-edit-page]");
  if (editButton) {
    event.preventDefault();
    openPageEditor();
  }

  const tagButton = target.closest<HTMLButtonElement>("[data-search]");
  if (tagButton) {
    openSearch(tagButton.dataset.search);
  }

  const presetButton = target.closest<HTMLElement>("[data-preset]");
  if (presetButton) {
    applyPreset(presetButton.dataset.preset!, presetButton.dataset.style ?? "");
  }

  for (const menu of document.querySelectorAll<HTMLDetailsElement>(
    "details.actions-menu[open], details.theme-picker[open]",
  )) {
    if (!menu.contains(target) || target.closest(".menu-item")) {
      menu.open = false;
    }
  }
});

setupTabSync();

openEditorFromUrl();
checkPendingEdit();
renderRichContent().catch((error) => console.error("Diagram or math rendering failed", error));
markCurrentPreset();
setupPromptLinks();
setupTableOfContents();
revealActiveTab();

setupPageTransitions();
setupSearch();

document.addEventListener("keydown", (event) => {
  const typing = (event.target as HTMLElement).closest("input, textarea, [contenteditable]");
  if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || (event.key === "/" && !typing)) {
    event.preventDefault();
    openSearch();
  }
  if (event.key === "Escape") {
    setDrawer(null);
  }
});
