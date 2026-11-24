---
title: HTTP endpoints
description: Every route the server answers, and what the static export contains.
order: 6
icon: globe
byline: The nodeps maintainers
---

Paths are relative to `base`.

| Route            | Content                                                       | Static export |
| ---------------- | ------------------------------------------------------------- | ------------- |
| `/<page>/`       | Page HTML, or Markdown when `Accept` includes `text/markdown` | HTML only     |
| `/<page>.md`     | Page Markdown                                                 | Yes           |
| `/llms.txt`      | Index of pages in the [llms.txt](https://llmstxt.org) format  | Yes           |
| `/llms-full.txt` | Every page in one Markdown file                               | Yes           |
| `/search.json`   | Search index: page title, heading, URL and text per section   | Yes           |
| `/mcp`           | MCP server, Streamable HTTP                                   | No            |
| `/_assets/*`     | Bundled CSS and JavaScript, cached for a year                 | Yes           |
| `/404.html`      | Not found page                                                | Yes           |

A page URL without its trailing slash redirects to it.

## MCP tools

| Tool          | Arguments                      | Returns                                  |
| ------------- | ------------------------------ | ---------------------------------------- |
| `search_docs` | `query`, optional `limit`      | Matching sections with URL and excerpt   |
| `read_page`   | `path`: a URL, a path or `.md` | The page as Markdown                     |
| `list_pages`  |                                | Every page with its path and description |

The endpoint accepts JSON-RPC over `POST`, answers notifications with `202`, and refuses requests from another origin.
