---
title: Design tokens
description: Every CSS custom property the theme exposes.
order: 4
icon: swatch-book
byline: The nodeps maintainers
---

Tokens are CSS custom properties. Set one for both modes under `theme`, or per mode under `theme.light` and `theme.dark`. In CSS, a mode value is `--light-<token>` or `--dark-<token>`.

## Colors

Each color has a light and a dark value, combined with `light-dark()`.

| Token             | Used for                             |
| ----------------- | ------------------------------------ |
| `background`      | Page                                 |
| `surface`         | Panels, inline code, table headers   |
| `surface-strong`  | Hovered items                        |
| `border`          | Lines and outlines                   |
| `text`            | Body text                            |
| `text-muted`      | Secondary text                       |
| `text-subtle`     | Hints, labels, dates                 |
| `accent`          | Links, active items, buttons         |
| `accent-contrast` | Text and icons on accent backgrounds |
| `code-background` | Code blocks                          |
| `shadow`          | Menus, dialogs, cards                |

## Syntax highlighting

`syntax-keyword`, `syntax-string`, `syntax-number`, `syntax-comment`, `syntax-function`, `syntax-type`, `syntax-property`, `syntax-attribute`, `syntax-variable`, `syntax-operator`, `syntax-inserted`, `syntax-deleted`.

## Alerts and sections

`note`, `tip`, `important`, `warning`, `caution`. Homepage cards reuse them: tutorials use `tip`, how-to guides `note`, reference `important`, explanation `warning`.

## Typography and layout

| Token           | Default                                        |
| --------------- | ---------------------------------------------- |
| `font`          | Inter, then the system font                    |
| `mono`          | The system monospace font                      |
| `radius`        | `10px`                                         |
| `topbar-height` | `3.75rem`                                      |
| `sidebar-width` | `17rem`                                        |
| `toc-width`     | `15rem`                                        |
| `prose-width`   | `46rem`, the maximum line length of paragraphs |

`brand` holds `theme.accent` and is the source of `accent`.
