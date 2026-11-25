---
title: Design tokens
description: Every CSS custom property the theme exposes.
order: 8
icon: swatch-book
byline: The nodeps maintainers
tags: [config, theme, colors, fonts, dark-mode]
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
| `accent`          | Active items, buttons                |
| `link`            | Links in pages. Default: `accent`    |
| `accent-contrast` | Text and icons on accent backgrounds |
| `code-background` | Code blocks                          |
| `shadow`          | Menus, dialogs, cards                |

## Syntax highlighting

`syntax-keyword`, `syntax-string`, `syntax-number`, `syntax-comment`, `syntax-function`, `syntax-type`, `syntax-property`, `syntax-attribute`, `syntax-variable`, `syntax-operator`, `syntax-inserted`, `syntax-deleted`.

## Header and tabs

Set for both modes only, as values can be gradients, which `light-dark()` does not accept. For a color per mode, write `"light-dark(#fff, #eee)"` as the value. Quote any value holding ` #`: YAML reads the rest of the line as a comment.

| Token               | Used for                                          | Default                   |
| ------------------- | ------------------------------------------------- | ------------------------- |
| `header-background` | Header bar, any CSS background or gradient        | `background`, translucent |
| `header-text`       | Title, links and buttons in the header            | `text` and `text-muted`   |
| `tabs-background`   | Section tabs row, under the top bar               | None: the header shows    |
| `tabs-text`         | Section tab labels, icons and the active tab line | `header-text`             |

```yaml title="docs.yaml"
theme:
  header-background: "linear-gradient(90deg, #1e3a8a, #7c3aed)"
  header-text: "#ffffff"
```

## Alerts and admonitions

`note`, `tip`, `important`, `warning`, `caution` color GitHub alerts and the admonitions of the same name. `abstract`, `info`, `success`, `question`, `failure`, `danger`, `bug`, `example` and `quote` color the other [admonition types](../reference/markdown/admonitions.md#types).

## Diátaxis kinds

`diataxis-tutorials`, `diataxis-how-to`, `diataxis-reference` and `diataxis-explanation` color the homepage cards, badges and sidebar of each kind. They default to `tip`, `note`, `important` and `warning`, so set them to color sections apart from admonitions.

## Typography and layout

| Token              | Default                                                |
| ------------------ | ------------------------------------------------------ |
| `font`             | Inter, then the system font                            |
| `mono`             | The system monospace font                              |
| `radius`           | `10px`                                                 |
| `topbar-height`    | `3.75rem`                                              |
| `sidebar-width`    | `17rem`                                                |
| `toc-width`        | `15rem`                                                |
| `prose-width`      | `46rem`, the maximum line length of paragraphs         |
| `font-size`        | `1rem`, body text                                      |
| `h1-size`          | `clamp(2rem, 1.6rem + 1.2vw, 2.6rem)`                  |
| `h2-size`          | `1.55rem`                                              |
| `h3-size`          | `1.2rem`                                               |
| `h4-size`          | `1rem`                                                 |
| `heading-weight`   | `760` for `h1`, `700` for `h2`, `650` below, until set |
| `heading-tracking` | `-0.03em` for `h1` to `normal` for `h4`, until set     |

The page itself has no maximum width: the content column fills the space between the sidebar and the table of contents, and tables, code and cards use all of it. Only lines of text stop at `prose-width`; set it to `none` to let them fill the column too.

`brand` holds `theme.accent` and is the source of `accent`.
