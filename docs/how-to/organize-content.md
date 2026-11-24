---
title: Organize content into sections
description: Turn on header tabs, group pages and follow Diátaxis.
order: 2
icon: folder-tree
byline: The nodeps maintainers
---

## Turn on header tabs

Move pages into top-level folders. As soon as the source has more than one section, the header shows one tab per folder and the sidebar lists only the current section.

```diff
  docs/
-   install.md
-   config.md
+   guides/install.md
+   reference/config.md
```

Pages at the root of the source directory form the first section.

## Name a section and give it an icon

Add `_folder.yaml` at the root of the folder:

```yaml title="docs/guides/_folder.yaml"
title: Guides
icon: book-open
order: 1
```

## Nest pages inside a section

Sub-folders of a section become branches of the sidebar tree, at any depth. Each branch takes a `_folder.yaml` too:

```yaml title="docs/reference/api/_folder.yaml"
title: HTTP API
icon: globe
```

## Choose between dropdowns and categories

By default a branch is a dropdown labelled by its `index.md`. To show it as an always-open category instead, with the `index.md` listed as "Overview":

```yaml title="docs/reference/api/_folder.yaml"
title: HTTP API
dropdown: false
```

Set it for the whole site in `docs.yaml`:

```yaml title="docs.yaml"
sidebar:
  dropdowns: false
```

## Hide bylines in the sidebar

Each sidebar entry shows its page's byline under the title. To turn that off:

```yaml title="docs.yaml"
sidebar:
  bylines: false
```

## Order pages

Set `order` in a page's frontmatter. Lower comes first, an `index.md` always leads its folder, and pages without an order sort by title.

## Follow Diátaxis

Create one section per kind of documentation and declare it:

```yaml title="docs/tutorials/_folder.yaml"
title: Tutorials
icon: graduation-cap
diataxis: tutorials
description: Lessons that take you by the hand.
```

With `home` set in `docs.yaml`, the homepage lays out the four kinds as a compass and lists the latest pages of each.
