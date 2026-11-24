---
title: Zensical and nodeps
description: Where nodeps matches Zensical and Material for MkDocs, and where it does not.
order: 4
icon: scale
byline: The nodeps maintainers
tags: [zensical, mkdocs, migration]
---

Zensical, by the team behind Material for MkDocs, reads `mkdocs.yml` and renders the Material feature set. nodeps aims at the same authoring experience so existing sites can move over with `nodeps migrate`, while keeping its own design: one Bun binary, server rendering, and docs written for agents as much as people.

## Authoring

| Feature                                                              | nodeps                           |
| -------------------------------------------------------------------- | -------------------------------- |
| Admonitions, collapsible blocks, GitHub callouts                     | Yes                              |
| Content tabs, linked                                                 | Yes                              |
| Code blocks: title, `hl_lines`, `linenums`, copy                     | Yes                              |
| Code annotations `# (1)!`                                            | No                               |
| Inline highlighting `` `#!py …` ``                                   | No                               |
| Snippets `--8<--`                                                    | Yes                              |
| Icons: Lucide, Material, Font Awesome, Octicons, Simple Icons; emoji | Yes                              |
| Mermaid diagrams, math                                               | Yes, loaded from a CDN when used |
| Footnotes, definition lists, abbreviations                           | Yes                              |
| Keys, mark, insert, sub, sup                                         | Yes                              |
| Attribute lists, buttons, grids and cards                            | Yes                              |
| Image captions, `#only-light` / `#only-dark`                         | No                               |
| Smart symbols, magic links                                           | No                               |
| Front matter `hide`, `tags`, `icon`                                  | Yes                              |

## Site

| Feature                                                             | nodeps                             |
| ------------------------------------------------------------------- | ---------------------------------- |
| `nav`, tabs, sections, index pages, breadcrumbs                     | Yes                                |
| Instant navigation with prefetch                                    | Yes                                |
| Search, with tag filtering                                          | Yes, English only                  |
| Color schemes and a theme toggle                                    | Yes, plus presets readers can pick |
| Edit and view source links, any git provider                        | Yes                                |
| `llms.txt`, page Markdown, copy as Markdown                         | Yes                                |
| Tags                                                                | Yes                                |
| Back-to-top button, progress bar, header autohide, announcement bar | No                                 |
| Blog, social cards, offline, privacy, redirects plugins             | No                                 |
| Versioning (mike), languages other than English                     | No                                 |
| Analytics, cookie consent, feedback widget                          | No                                 |
| Template overrides (`custom_dir`), hooks                            | No                                 |

## Only in nodeps

A visual editor that opens pull requests, an MCP server, Diátaxis sections with a homepage compass, page resources and AI skills, reader mode, and a single binary that serves and exports.
