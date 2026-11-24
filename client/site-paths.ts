export const base = new URL(document.querySelector<HTMLAnchorElement>(".brand")!.href).pathname;

/**
 * Returns the URL of the current page's Markdown source. It is read on every
 * call because instant navigation replaces the link element in the head.
 */
export const markdownUrl = () =>
  document.querySelector<HTMLLinkElement>('link[rel="alternate"][type="text/markdown"]')?.href;
