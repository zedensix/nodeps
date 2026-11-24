---
title: Markdown
description: Supported syntax and how links are resolved.
order: 3
icon: file-text
byline: The nodeps maintainers
---

## Syntax

GitHub-flavored Markdown: tables, task lists, strikethrough, autolinks and raw HTML. Headings get an `id` from their text.

- [x] Task lists
- [x] ~~Strikethrough~~
- [ ] Footnotes are not supported

Code blocks and alerts have their own pages: [Code blocks](./code-blocks.md), [Alerts](./alerts.md).

## Links

| Written                     | Becomes                   |
| --------------------------- | ------------------------- |
| `./other.md`, `../a/b.md#x` | The page URL, anchor kept |
| `./image.png`               | The file URL              |
| `/path`                     | Prefixed with `base`      |
| `https://…`                 | Unchanged                 |

A link to a missing page or file is reported as a warning.
