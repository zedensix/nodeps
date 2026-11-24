---
title: Migrate from MkDocs or Zensical
description: Convert a Material for MkDocs or Zensical project in one command.
order: 1.2
icon: arrow-right-left
byline: The nodeps maintainers
tags: [migration, mkdocs, zensical]
---

## Preview the migration

Run it next to your `mkdocs.yml`:

```sh
nodeps migrate mkdocs.yml
```

Nothing is written. The report lists what maps to `docs.yaml`, what nodeps supports natively, and what it does not support, followed by the `docs.yaml` it would write.

## Apply it

```sh
nodeps migrate mkdocs.yml --write
nodeps dev
```

`--write` creates `docs.yaml` and adds `icon: file-text` and a byline (from `site_author`) to every page missing them, since nodeps requires both. Pages keep their content: admonitions, tabs, icons, snippets, footnotes and the rest of the PyMdown syntax render as they are. Existing `icon: material/…` frontmatter keeps working.

> [!WARNING]
> `--write` edits your Markdown files. Run it on a clean git working tree so you can review the diff.

## What is converted

| mkdocs.yml                                  | docs.yaml                                     |
| ------------------------------------------- | --------------------------------------------- |
| `site_name`, `site_description`, `site_url` | `title`, `description`, `url`                 |
| `docs_dir`, `site_dir`                      | `source`, `output`                            |
| `copyright`                                 | `footer`, without HTML                        |
| `repo_url`, `edit_uri`                      | `repository` with `branch`, `path` and `edit` |
| `nav`                                       | `nav`, unchanged                              |
| `theme.logo`                                | `logo`                                        |
| `theme.palette.primary`                     | `theme.accent`                                |
| `extra.social`                              | `social`                                      |
| `extra_css`                                 | `theme.stylesheet` (the first one)            |

## Then

Fix what the report lists as unsupported, check the warnings of `nodeps build`, and delete `mkdocs.yml` once the site looks right. See [Zensical and nodeps](../explanation/zensical-parity.md) for the full comparison.
