---
title: Customize the theme
description: Change colors, fonts and sizes, separately for light and dark mode.
order: 1
icon: palette
byline: The nodeps maintainers
tags: [theme, colors, fonts, dark-mode]
---

## Start from a theme

```yaml title="docs.yaml"
theme:
  name: forest
```

Browse every theme in light and dark in the [theme gallery](../themes/index.md). Readers can also switch themes for themselves with the palette button in the header; their choice stays on their device.

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

## Create your own theme

1. Create `themes/acme/theme.yaml` next to `docs.yaml`, with only what changes:

   ```yaml title="themes/acme/theme.yaml"
   title: Acme
   accent: "#e8590c"
   variables:
     radius: 0px
   ```

2. Select it:

   ```yaml title="docs.yaml"
   theme:
     name: acme
   ```

3. To change markup, copy only the partial you need from the built-in `default` theme into `themes/acme/` and edit it, for example `header.html`. Files you leave out keep following nodeps updates.

4. To restyle a component, add `themes/acme/styles/sidebar.css`: it replaces the built-in file of the same name.

`nodeps dev` rebuilds the theme on every save. See [Theme folders](../configuration/theme.md#theme-folders) for every file, slot and variable.

See [Design tokens](../configuration/design-tokens.md) for every token.
