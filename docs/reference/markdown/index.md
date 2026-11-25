---
title: Markdown
description: Supported syntax, and how links are resolved.
order: 3
icon: file-text
byline: The nodeps maintainers
tags: [markdown]
---

## Syntax

GitHub-flavored Markdown: tables, task lists, strikethrough, autolinks and raw HTML. Headings get an `id` from their text.

- [x] Task lists
- [x] ~~Strikethrough~~
- [ ] Footnotes are not supported

Beyond that, nodeps understands the Python-Markdown and PyMdown syntax used by MkDocs and Zensical sites:

- [Code blocks](./code-blocks.md) with titles, highlighted lines and line numbers
- [Admonitions](./admonitions.md), collapsible blocks and GitHub alerts
- [Content tabs](./content-tabs.md)
- [Formatting](./formatting.md): keys, highlights, footnotes, definition lists, abbreviations, attributes, buttons and grids
- [Icons and emoji](./icons-and-emoji.md)
- [Diagrams and math](./diagrams-and-math.md)
- [Including files](./includes.md)

## Links

| Written                     | Becomes                   |
| --------------------------- | ------------------------- |
| `./other.md`, `../a/b.md#x` | The page URL, anchor kept |
| `./image.png`               | The file URL              |
| `/path`                     | Prefixed with `base`      |
| `https://…`                 | Unchanged                 |

A link to a missing page or file is reported as a warning.
