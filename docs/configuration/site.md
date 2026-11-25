---
title: Site
description: Name, address, folders and the links around every page.
order: 1
icon: globe
byline: The nodeps maintainers
tags: [config]
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

| Key           | Default         | Description                                                                                   |
| ------------- | --------------- | --------------------------------------------------------------------------------------------- |
| `title`       | `Documentation` | Site name, in the header and page titles                                                      |
| `description` |                 | Default meta description and summary of `llms.txt`                                            |
| `url`         |                 | Public origin, used for canonical links, absolute URLs, OAuth, `sitemap.xml` and the RSS feed |
| `base`        | `/`             | Path the site is served under                                                                 |
| `source`      | `docs`          | Directory of Markdown files and assets                                                        |
| `output`      | `dist`          | Static export directory, deleted on every build                                               |
| `logo`        |                 | Image inside the source directory, also the favicon                                           |
| `favicon`     | `logo`          | Favicon inside the source directory. Without it or `logo`, a book icon in the accent color    |
| `footer`      |                 | Text at the bottom of every page                                                              |
| `links`       |                 | Text links in the header, each with a `label` and a `url`                                     |
| `social`      |                 | Icon links in the footer: `icon`, `url` and an optional `label`                               |
| `reader_mode` | `true`          | Shows the reader mode button in the header                                                    |

Paths in `docs.yaml` (`source`, `output`, `theme.stylesheet`) are relative to the folder holding `docs.yaml`, not to the folder you run `nodeps` from. `logo` and `favicon` are the exception: they are paths inside `source`, as it is served with the pages.

`social` icons accept any [icon name](../reference/markdown/icons-and-emoji.md), like `fontawesome/brands/github` or `simple/bluesky`.
