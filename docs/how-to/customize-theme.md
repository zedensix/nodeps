---
title: Customize the theme
description: Change colors, fonts and sizes, separately for light and dark mode.
order: 1
icon: palette
byline: The nodeps maintainers
---

## Change the brand color

```yaml title="docs.yaml"
theme:
  accent: "#e5484d"
```

Links, the active page, highlighted code lines and the primary button follow the accent. In dark mode a lighter shade is derived automatically.

## Change fonts and corners

Any key under `theme` sets the design token of the same name:

```yaml title="docs.yaml"
theme:
  font: '"IBM Plex Sans", system-ui, sans-serif'
  mono: '"IBM Plex Mono", ui-monospace, monospace'
  radius: 6px
```

## Use different colors in dark mode

Put mode-specific values under `light` and `dark`:

```yaml title="docs.yaml"
theme:
  light:
    background: "#fdfcf8"
  dark:
    background: "#0d1117"
    accent: "#ff8a8a"
```

## Add your own CSS

For anything tokens cannot express, add a stylesheet. It is bundled by Bun, loaded after the built-in theme and reloaded by the dev server.

```yaml title="docs.yaml"
theme:
  stylesheet: theme.css
```

```css title="theme.css"
.prose h2 {
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border);
}
```

See [Design tokens](../reference/design-tokens.md) for every token.
