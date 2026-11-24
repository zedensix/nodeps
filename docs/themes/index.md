---
title: Theme gallery
description: Every built-in preset, in light and dark. Apply one to this site to try it.
icon: swatch-book
byline: The nodeps maintainers
tags: [theme, presets, colors]
---

Pick a preset in `docs.yaml`:

```yaml title="docs.yaml"
theme:
  preset: ocean
```

**Apply** switches this site to the preset in your browser, like the palette button in the header. It is remembered on this device; pick the site default to go back.

<div data-nodeps="theme-gallery"></div>

## Adjust a preset

Anything you set next to the preset wins over it:

```yaml title="docs.yaml"
theme:
  preset: paper
  accent: "#b42318"
  radius: 2px
```

See [Customize the theme](../how-to/customize-theme.md) and [Design tokens](../configuration/design-tokens.md).
