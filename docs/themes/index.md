---
title: Theme gallery
description: Every built-in theme, in light and dark. Apply one to this site to try it.
icon: swatch-book
byline: The nodeps maintainers
tags: [theme, colors, dark-mode]
---

Pick a theme in `docs.yaml`:

```yaml title="docs.yaml"
theme:
  name: ocean
```

**Apply** switches this site to the theme in your browser, like the palette button in the header. It is remembered on this device; pick the site default to go back.

<div data-nodeps="theme-gallery"></div>

## Adjust a theme

Anything you set next to the theme name wins over it:

```yaml title="docs.yaml"
theme:
  name: paper
  accent: "#b42318"
  radius: 2px
```

Themes from your own `themes/` folder show up here too. See [Customize the theme](../how-to/customize-theme.md) and [Design tokens](../configuration/design-tokens.md).
