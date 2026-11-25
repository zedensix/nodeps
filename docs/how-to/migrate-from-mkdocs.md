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

Nothing is written. The report lists what maps to `docs.yaml`, what nodeps supports natively, what it does not support and why, what to check by hand, and the files `--write` would generate, followed by the `docs.yaml` it would write.

## Apply it

```sh
nodeps migrate mkdocs.yml --write
nodeps dev
```

`--write` creates `docs.yaml` and leaves your Markdown files alone. Pages keep their content: admonitions, tabs, icons, snippets, footnotes and the rest of the PyMdown syntax render as they are. Existing `icon: material/…` frontmatter keeps working.

## What is converted

| mkdocs.yml                                  | docs.yaml                                                                                |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `site_name`, `site_description`, `site_url` | `title`, `description`, `url`                                                            |
| `docs_dir`, `site_dir`                      | `source`, `output`                                                                       |
| `copyright`                                 | `footer`, without HTML                                                                   |
| `repo_url`, `edit_uri`                      | `repository` with `branch`, `path` and `edit`                                            |
| `nav`                                       | `nav`, unchanged                                                                         |
| awesome-nav `.nav.yml` files                | `nav`, in the same order                                                                 |
| `theme.logo`, `theme.favicon`               | `logo`, `favicon`                                                                        |
| `theme.palette` named `primary` or `accent` | `theme.accent`, and `theme.dark.accent` when the dark scheme differs                     |
| `theme.palette.primary: custom`             | `theme.accent`, read from `--md-primary-fg-color` in the first local `extra_css` file    |
| `theme.font.text`, `theme.font.code`        | `theme.font`, `theme.mono`, with system fallbacks                                        |
| `extra.social`                              | `social`                                                                                 |
| `extra_css`                                 | `theme.stylesheet`; several files get a generated `extra.css` that imports them in order |

## What needs a hand

- **awesome-nav**: `nav` lists, `title`, `hide`, `ignore`, `append_unmatched` and `sort.direction` are converted. A glob such as `"*"` is expanded once, in name order, to the pages and folders its `.nav.yml` does not list elsewhere. The result is a snapshot, noted at the top of `docs.yaml`: pages added later need adding to `nav`. Other keys are listed under "Check by hand" with their file.
- **Top-level pages**: with `nav`, they share a first "Home" tab; a top-level `Contribute: contributing.md` entry does not get a tab of its own. Put it in a section to give it one.
- **AI skills**: a folder holding a `SKILL.md` is served as a download, not as pages, so its files are left out of `nav` with a warning. [Attach it](./attach-resources.md) to a page instead; links to its `SKILL.md` keep working.
- **Diátaxis**: `diataxis` frontmatter and `.howto.md`-style file names carry over as page kinds, see [Diátaxis kinds](../configuration/homepage.md#page-kinds).
- **Homepage**: with `home` set, the hero replaces the `# title` of `index.md`; the rest of the page renders under the compass. Trim what repeats the hero.
- **Admonitions**: all Material types render with their own color and icon. Types nodeps does not know render as a note and are listed with their first page.
- **Fonts**: nodeps never downloads fonts. The migrated `theme.font` and `theme.mono` work for readers who have the font installed; self-host it with `@font-face` in `theme.stylesheet` for everyone else.
- **`palette`**: a `custom` primary is read from `--md-primary-fg-color` in the first local `extra_css` file; other custom colors live in your CSS, so set them as [design tokens](../configuration/design-tokens.md) (`link`, `header-background`, `header-text`) yourself. Scheme toggles are replaced by nodeps' own light, dark and device toggle.
- **Running it again**: `--write` never overwrites. It stops and names the existing `docs.yaml` (or generated file) to move away first.
- **`extra_javascript`**: not loaded. Put the scripts in `themes/default/` and add them to `themes/default/head.html`.
- **Code blocks** in languages nodeps has no grammar for render as plain text; custom Pygments lexers do not carry over. `svelte` and `vue` get HTML highlighting for their markup.

## Then

Fix what the report lists as unsupported, check the warnings of `nodeps build`, and delete `mkdocs.yml` once the site looks right. See [Zensical and nodeps](../explanation/zensical-parity.md) for the full comparison.
