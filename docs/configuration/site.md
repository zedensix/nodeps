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

| Key           | Default         | Description                                                      |
| ------------- | --------------- | ---------------------------------------------------------------- |
| `title`       | `Documentation` | Site name, in the header and page titles                         |
| `description` |                 | Default meta description and summary of `llms.txt`               |
| `url`         |                 | Public origin, used for canonical links, absolute URLs and OAuth |
| `base`        | `/`             | Path the site is served under                                    |
| `source`      | `docs`          | Directory of Markdown files and assets                           |
| `output`      | `dist`          | Static export directory, deleted on every build                  |
| `logo`        |                 | Image inside the source directory, also the favicon              |
| `footer`      |                 | Text at the bottom of every page                                 |
| `links`       |                 | Text links in the header, each with a `label` and a `url`        |
| `social`      |                 | Icon links in the footer: `icon`, `url` and an optional `label`  |
| `reader_mode` | `true`          | Shows the reader mode button in the header                       |

`social` icons accept any [icon name](../reference/markdown/icons-and-emoji.md), like `fontawesome/brands/github` or `simple/bluesky`.
