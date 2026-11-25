---
title: Site
description: Name, address, folders and the links around every page.
order: 1
icon: globe
byline: The nodeps maintainers
tags: [config, deploy]
---

```yaml title="docs.yaml"
title: Acme
description: Everything about Acme.
url: https://docs.acme.dev
base: /
source: docs
output: dist
logo: logo.svg
footer: © Acme
reader_mode: true
links:
  - label: Status
    url: https://status.acme.dev
social:
  - icon: fontawesome/brands/github
    url: https://github.com/acme
    label: GitHub
```

| Key           | Default         | Description                                                                                                               |
| ------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `title`       | `Documentation` | Site name, in the header and page titles                                                                                  |
| `description` |                 | Default meta description and summary of `llms.txt`                                                                        |
| `url`         |                 | Public origin, used for canonical links, absolute URLs, OAuth, `sitemap.xml` and the RSS feed                             |
| `base`        | `/`             | Path the site is served under                                                                                             |
| `source`      | `docs`          | Directory of Markdown files and assets                                                                                    |
| `output`      | `dist`          | Static export directory, deleted on every build                                                                           |
| `logo`        |                 | Image inside the source directory, shown before the title in the header, at the header's height with its own proportions  |
| `logo_dark`   |                 | Image used instead of `logo` in dark mode, following the reader's theme toggle                                            |
| `logo_only`   | `false`         | Hides the title next to the logo, for a logo that already spells the name. The title stays the logo's alt text            |
| `favicon`     | `logo`          | Browser tab icon inside the source directory. Without it or `logo`, a book icon in the accent color                       |
| `footer`      |                 | Text at the bottom of every page                                                                                          |
| `links`       |                 | Text links in the header, each with a `label` and a `url`                                                                 |
| `social`      |                 | Icon links in the footer: `icon`, `url` and an optional `label`                                                           |
| `reader_mode` | `true`          | Shows the reader mode button in the header. Reader mode keeps only the page text, the previous and next links, and search |

The header's palette button, which lets readers pick another theme, is `theme.picker` in [Theme](./theme.md).

Paths in `docs.yaml` (`source`, `output`, `theme.stylesheet`) are relative to the folder holding `docs.yaml`, not to the folder you run `nodeps` from. `logo`, `logo_dark` and `favicon` are the exception: they are paths inside `source`, as it is served with the pages.

## Logo and favicon

```yaml title="docs.yaml"
logo: brand/wordmark.png
logo_dark: brand/wordmark-white.png
logo_only: true
favicon: brand/icon.png
```

A wide wordmark works as `logo`: it keeps its proportions, up to 12rem wide (9rem on phones). Give it `logo_dark` when the artwork is dark on a transparent background, or it disappears on a dark page.

A wordmark makes a poor favicon, as it shrinks to an unreadable sliver in a tab: point `favicon` at a separate square image. nodeps also serves that file, or else the logo, as `/favicon.ico`, which browsers request on their own. With neither set, browsers still request `/favicon.ico` and log a 404 in the console. It is harmless: the page's own icon link is used.

A missing file, or one that is not an image, fails the build with the setting and the path.

`social` icons accept any [icon name](../reference/markdown/icons-and-emoji.md), like `fontawesome/brands/github` or `simple/bluesky`.
