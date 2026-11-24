---
title: Server first, static second
description: Why pages are rendered by a server, and how the static export stays identical.
order: 2
icon: layers
byline: The nodeps maintainers
---

Documentation sites end up behind a web server anyway, usually nginx. Given that, nodeps treats a Bun server as the primary target and static files as an export of it.

## One handler, two outputs

Every response, from page HTML to `llms.txt`, comes from a single request handler. `serve` puts it behind `Bun.serve`. `build` calls the same handler in-process for every known route and writes each response to disk. The two cannot drift apart, because there is only one implementation.

The server adds what files cannot do: content negotiation on `Accept: text/markdown`, redirects for missing trailing slashes, and the MCP endpoint.

## Rendering

At startup the whole site is loaded: Markdown rendered, links resolved, search sections extracted. A page's full HTML is assembled on its first request by filling the layout template, a plain HTML file bundled by `Bun.build`, with `HTMLRewriter`, then kept in memory until the content changes.

## Navigation

Pages are full HTML documents, so they work without JavaScript. When the browser supports the Navigation API, the client takes over same-site links: it fetches the next page, often already prefetched on hover, and swaps only the content, sidebar and table of contents inside a View Transition. The header never reloads, scroll positions are restored on back and forward, and the URL stays the real one.

Browsers without the API fall back to regular page loads, animated by cross-document View Transitions where supported.
