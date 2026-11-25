---
title: Configuration
description: The three places nodeps reads settings from, and a complete example.
icon: settings
byline: The nodeps maintainers
tags: [config, getting-started]
resources:
  - path: files/docs.yaml
    title: Complete docs.yaml
    description: Every option set, ready to copy.
---

| File             | Scope                                            | Reference                                |
| ---------------- | ------------------------------------------------ | ---------------------------------------- |
| `docs.yaml`      | The whole site                                   | [Site](./site.md) and the pages below    |
| `_folder.yaml`   | One folder: its title, icon, order and kind      | [Navigation](./navigation.md#folderyaml) |
| Page frontmatter | One page: icon, byline, tags, resources and more | [Pages](./pages.md)                      |

Every key of `docs.yaml` is optional. Paths in it are relative to the file. An unknown value fails the build with the name of the key, and `nodeps dev` keeps the last working version online while you fix it.

| Area                          | Keys                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [Site](./site.md)             | `title`, `description`, `url`, `base`, `source`, `output`, `logo`, `footer`, `links`, `social`, `reader_mode` |
| [Navigation](./navigation.md) | `nav`, `sidebar`                                                                                              |
| [Theme](./theme.md)           | `theme`                                                                                                       |
| [Repository](./repository.md) | `repository`                                                                                                  |
| [Editor](./editor.md)         | `editor`                                                                                                      |
| [Homepage](./homepage.md)     | `home`, `diataxis`                                                                                            |
