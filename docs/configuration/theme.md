---
title: Theme
description: Presets, colors, fonts and custom CSS.
order: 3
icon: palette
byline: The nodeps maintainers
tags: [config, theme]
---

```yaml title="docs.yaml"
theme:
  preset: ocean
  accent: "#0e8fb3"
  radius: 8px
  stylesheet: theme.css
  light:
    background: "#ffffff"
  dark:
    background: "#0b0b0f"
```

| Key          | Description                                                                              |
| ------------ | ---------------------------------------------------------------------------------------- |
| `preset`     | Built-in starting point, see the [theme gallery](../themes/index.md). Default: `default` |
| `accent`     | Brand color, any CSS color                                                               |
| `stylesheet` | Extra CSS file, bundled and loaded after the theme                                       |
| `light`      | Token values for light mode                                                              |
| `dark`       | Token values for dark mode                                                               |
| any token    | Sets that [design token](./design-tokens.md) for both modes                              |

Readers can pick another preset for themselves from the palette button in the header.
