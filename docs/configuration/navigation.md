---
title: Navigation
description: Tabs, the sidebar tree, explicit nav and folder settings.
order: 2
icon: list-tree
byline: The nodeps maintainers
tags: [config, nav, sidebar]
---

## From folders

Without `nav`, folders decide the navigation:

| Location                | Becomes                                          |
| ----------------------- | ------------------------------------------------ |
| Root of the source      | The first section                                |
| Top-level folder        | A section, with a header tab and its own sidebar |
| Folder inside a section | A branch of the sidebar tree, at any depth       |

Header tabs appear when there are at least two sections. Within a folder, `index.md` comes first, then pages and folders by `order`, then by title.

## nav

An explicit navigation, in the mkdocs.yml format:

```yaml title="docs.yaml"
nav:
  - Home: index.md
  - Guides:
      - guides/index.md
      - Install: guides/install.md
      - Advanced:
          - guides/advanced/tuning.md
  - Changelog: https://github.com/acme/acme/releases
```

| Entry              | Becomes                                                                               |
| ------------------ | ------------------------------------------------------------------------------------- |
| `page.md`          | The page, with its own title                                                          |
| `Title: page.md`   | The page, labelled `Title` in the sidebar                                             |
| `Title: https://…` | An external link                                                                      |
| `Title: [ … ]`     | A section. At the top level, a header tab. A first `index.md` child becomes its index |

Top-level pages are grouped into a first tab named "Home". Pages left out of `nav` still build.

## sidebar

| Key         | Default | Description                                                           |
| ----------- | ------- | --------------------------------------------------------------------- |
| `dropdowns` | `true`  | Folders render as collapsible branches, or as categories when `false` |
| `bylines`   | `true`  | Shows each page's byline under its title                              |

## _folder.yaml

Optional, at the root of any folder.

```yaml title="docs/tutorials/_folder.yaml"
title: Tutorials
icon: graduation-cap
order: 1
diataxis: tutorials
description: Lessons that take you by the hand.
dropdown: true
```

| Key           | Description                                                                |
| ------------- | -------------------------------------------------------------------------- |
| `title`       | Tab or branch label. Default: the folder's `index.md` title, then its name |
| `icon`        | Icon name                                                                  |
| `order`       | Position among sections or branches                                        |
| `description` | Shown on the homepage card                                                 |
| `diataxis`    | `tutorials`, `how-to`, `reference` or `explanation`                        |
| `dropdown`    | Overrides `sidebar.dropdowns` for this folder                              |
