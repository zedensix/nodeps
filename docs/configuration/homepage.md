---
title: Homepage
description: The hero, the Diátaxis compass and the badge next to page titles.
order: 6
icon: house
byline: The nodeps maintainers
tags: [config, home, diataxis]
---

```yaml title="docs.yaml"
home:
  headline: Acme documentation
  tagline: Learn to turn coffee into software.
  actions:
    - label: Get started
      url: tutorials/first-steps.md
  latest: 3
diataxis:
  badge: true
```

With `home`, the root page renders as a homepage.

| Key              | Default       | Description                                                                                     |
| ---------------- | ------------- | ----------------------------------------------------------------------------------------------- |
| `home.headline`  | `title`       | Hero heading                                                                                    |
| `home.tagline`   | `description` | Text under the heading                                                                          |
| `home.actions`   |               | Buttons, each with a `label` and a `url`; the first is primary. A `.md` url points to that page |
| `home.latest`    | `3`           | Most recently updated pages shown per section, `0` to hide                                      |
| `diataxis.badge` | `true`        | Shows the kind of each page next to its title                                                   |

Sections whose `_folder.yaml` sets `diataxis` are laid out as the four-quadrant compass; others appear as cards below it.
