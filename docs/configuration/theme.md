---
title: Theme
description: Themes, theme folders, colors, fonts and custom CSS.
order: 3
icon: palette
byline: The nodeps maintainers
tags: [config, theme]
---

```yaml title="docs.yaml"
theme:
  name: ocean
  accent: "#0e8fb3"
  radius: 8px
  font: '"IBM Plex Sans", system-ui, sans-serif'
  mono: '"IBM Plex Mono", ui-monospace, monospace'
  stylesheet: theme.css
  light:
    background: "#ffffff"
  dark:
    background: "#0b0b0f"
```

| Key          | Description                                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `name`       | Theme to use: a built-in one from the [theme gallery](../themes/index.md) or a folder in `themes/`. Default: `default` |
| `accent`     | Brand color, any CSS color                                                                                             |
| `font`       | Body text font: a CSS `font-family` value, such as `'"Inter", system-ui, sans-serif'`. Not a URL or a file             |
| `mono`       | Code font, same format as `font`                                                                                       |
| `stylesheet` | Extra CSS file, bundled and loaded after the theme. The path is relative to the folder holding `docs.yaml`             |
| `light`      | Token values for light mode                                                                                            |
| `dark`       | Token values for dark mode                                                                                             |
| any token    | Sets that [design token](./design-tokens.md) for both modes                                                            |

nodeps never downloads fonts. A family in `font` or `mono` is used when the reader has it installed; otherwise the next one in the list applies. To ship a font, add it with `@font-face` in `stylesheet` (Bun bundles the font file) and name it first in `font`.

Values set here win over the theme's. Readers can pick another theme for themselves from the palette button in the header: it swaps the theme's variables, not its HTML.

## Theme folders

A theme is a folder in `themes/`, next to `docs.yaml`. Its name is the folder name. A folder named like a built-in theme (`themes/default`, `themes/ocean`) overrides that theme instead of adding one.

A theme only holds what it changes. Every other file comes from the theme it extends, then from the built-in theme of the same name, down to `default`.

| File                | Role                                                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `theme.yaml`        | Title, description, parent theme and CSS variables                                                                                           |
| `layout.html`       | The page shell. nodeps adds its script; everything else comes from the theme                                                                 |
| `head.html`         | Partial, empty by default: extra `<script>`, `<link>` or `<meta>` tags for every page. Files it references are bundled from the theme folder |
| `header.html`       | Partial: the top bar and section tabs                                                                                                        |
| `main.html`         | Partial: sidebar, page and table of contents                                                                                                 |
| `search.html`       | Partial: the search dialog                                                                                                                   |
| `editor.html`       | Partial: the page editor dialog                                                                                                              |
| `style.css`         | Stylesheet entry, bundled by Bun with its `@import`s, fonts and images                                                                       |
| `styles/<name>.css` | One file per component, imported by `style.css`                                                                                              |

### theme.yaml

```yaml title="themes/acme/theme.yaml"
title: Acme
description: Orange and square.
extends: default
accent: "#e8590c"
variables:
  radius: 0px
light:
  background: "#fffaf5"
dark:
  background: "#1a1410"
```

| Key           | Description                                                        |
| ------------- | ------------------------------------------------------------------ |
| `title`       | Name shown in the theme menu and gallery. Default: the folder name |
| `description` | One line shown under the title                                     |
| `extends`     | Theme to inherit files and variables from. Default: `default`      |
| `accent`      | Brand color, any CSS color                                         |
| `variables`   | [Design tokens](./design-tokens.md) for both modes                 |
| `light`       | Token values for light mode                                        |
| `dark`        | Token values for dark mode                                         |

Variables merge key by key: a theme sets only the tokens it changes.

### Templates

Templates are plain HTML. Three attributes and one tag connect them to nodeps:

| Markup                                       | Effect                                                      |
| -------------------------------------------- | ----------------------------------------------------------- |
| `<nodeps-partial name="x"></nodeps-partial>` | Replaced by the theme's `x.html`, on a line of its own      |
| `data-slot="x"`                              | The element's content is filled by nodeps                   |
| `data-if="x"`                                | The element is removed when the feature is off for the page |
| `<i data-icon="name">`                       | Replaced by that icon as inline SVG                         |

Slots: `title`, `brand`, `links`, `theme-picker`, `tabs`, `sidebar`, `breadcrumb`, `article`, `pager`, `footer`, `toc`, `tags`.

Conditions: `page`, `sidebar`, `tabs`, `toc`, `headings`, `tags`, `pager`, `footer`, `reader`, `editor`, `mcp`.

Keep the `class` names the default theme uses on interactive parts (`search-trigger`, `theme-toggle`, `menu-toggle`, `search-dialog`): the nodeps script finds them by class.
