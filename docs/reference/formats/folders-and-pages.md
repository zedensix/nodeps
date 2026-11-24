---
title: Folders and pages
description: How files become URLs, the _folder.yaml format and page frontmatter.
order: 2
icon: folder-open
byline: The nodeps maintainers
---

## URLs

| File                     | URL                | Markdown version     |
| ------------------------ | ------------------ | -------------------- |
| `docs/index.md`          | `/`                | `/index.md`          |
| `docs/guides/install.md` | `/guides/install/` | `/guides/install.md` |
| `docs/guides/index.md`   | `/guides/`         | `/guides.md`         |

Other files are served at their path. Files and folders starting with a dot are ignored.

## Sections and groups

| Location                | Becomes                                           |
| ----------------------- | ------------------------------------------------- |
| Root of the source      | The first section                                 |
| Top-level folder        | A section, with a header tab and its own sidebar  |
| Folder inside a section | A nested branch of the sidebar tree, at any depth |

Header tabs appear when there are at least two sections.

A folder in the tree renders one of two ways:

| `dropdown`       | Rendering                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `true` (default) | Collapsible branch. Its `index.md` is the branch label. Opens on the path of the current page |
| `false`          | Labelled category, always open. Its `index.md` is listed first as "Overview"                  |

Within a folder, `index.md` comes first, then pages and folders by `order`, then by title.

A folder containing a `SKILL.md` is an AI skill, not a set of pages: its files are only served as [resources](#resources).

## _folder.yaml

Optional, at the root of any folder.

```yaml title="docs/tutorials/_folder.yaml"
title: Tutorials
icon: graduation-cap
order: 1
diataxis: tutorials
description: Lessons that take you by the hand.
```

| Key           | Description                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------- |
| `title`       | Tab or group label. Default: the folder's `index.md` title, then its name                       |
| `icon`        | [Lucide](https://lucide.dev/icons) icon name                                                    |
| `order`       | Position among sections or groups                                                               |
| `description` | Shown on the homepage card                                                                      |
| `diataxis`    | `tutorials`, `how-to`, `reference` or `explanation`; places the section on the homepage compass |
| `dropdown`    | `true` or `false`, overrides `sidebar.dropdowns` for this folder                                |

## Frontmatter

```yaml
---
title: Install Acme
icon: download
byline: The Acme team
tags: [install, cli]
description: Shown under the title, in search engines and in llms.txt.
order: 1
updated: 2026-11-20
---
```

| Key           | Description                                                                                  |
| ------------- | -------------------------------------------------------------------------------------------- |
| `icon`        | Required. [Lucide](https://lucide.dev/icons) icon name, shown in the sidebar and the byline  |
| `byline`      | Required. Author line shown under the title                                                  |
| `title`       | Default: the first `# heading`, then the file name                                           |
| `description` | Lead paragraph and meta description                                                          |
| `order`       | Position in the sidebar, lower first                                                         |
| `tags`        | List of words. Shown under the table of contents, boosted in search, filterable with `#tag`  |
| `updated`     | Last update date. Default: the last git commit touching the file, then its modification time |

## Resources

Files attached to a page, listed in its frontmatter with paths relative to the page:

```yaml
resources:
  - files/schema.sql
  - path: files/checklist.pdf
    title: Deployment checklist
    description: Print it before going live.
  - skills/acme-deploy
```

| Key           | Description                                                   |
| ------------- | ------------------------------------------------------------- |
| `path`        | Required. A file, or a folder containing a `SKILL.md`         |
| `title`       | Default: the skill `name` from `SKILL.md`, then the file name |
| `description` | Default: the skill `description` from `SKILL.md`              |

| Kind     | Detected by                                      | Card actions                           |
| -------- | ------------------------------------------------ | -------------------------------------- |
| AI skill | Folder with a `SKILL.md`                         | Download as `.tar.gz`, view `SKILL.md` |
| Code     | Highlighted languages and common code extensions | Download, inline preview up to 100 KB  |
| Document | `pdf`, `docx`, `xlsx`, `pptx`, `csv` and similar | Download, open                         |
| File     | Anything else                                    | Download                               |

Resources appear in a section at the end of the page, in the table of contents, in search, and as a list in the page's Markdown version. A missing resource fails the build.
