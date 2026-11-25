---
title: Pages
description: URLs, frontmatter and attached resources.
order: 7
icon: file-text
byline: The nodeps maintainers
tags: [config, frontmatter]
---

## URLs

| File                     | URL                | Markdown version     |
| ------------------------ | ------------------ | -------------------- |
| `docs/index.md`          | `/`                | `/index.md`          |
| `docs/guides/install.md` | `/guides/install/` | `/guides/install.md` |
| `docs/guides/index.md`   | `/guides/`         | `/guides.md`         |

Other files are served at their path. A folder containing a `SKILL.md` is an AI skill, served only as a resource.

## Frontmatter

```yaml
---
title: Install Acme
description: Shown under the title, in search engines and in llms.txt.
icon: material/download
byline: The Acme team
order: 1
tags: [install, cli]
updated: 2026-11-20
hide: [toc]
resources:
  - files/schema.sql
---
```

| Key           | Description                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `icon`        | [Icon name](../reference/markdown/icons-and-emoji.md), in either form: `rocket` or `material/rocket-launch`. Shown in the sidebar and the byline |
| `byline`      | Author line under the title and in the sidebar                                                                                                   |
| `title`       | Default: the first `# heading`, then the file name                                                                                               |
| `description` | Lead paragraph and meta description                                                                                                              |
| `order`       | Position in the sidebar, lower first                                                                                                             |
| `tags`        | Shown under the table of contents, boosted in search, filterable with `#tag`                                                                     |
| `updated`     | Last update date. Default: the last git commit touching the file, then its modification time                                                     |
| `hide`        | Any of `navigation`, `toc`, `footer`                                                                                                             |
| `resources`   | Attached files, see below                                                                                                                        |

## Resources

```yaml
resources:
  - files/schema.sql
  - path: files/runbook.pdf
    title: Incident runbook
    description: Print it before going live.
  - skills/acme-deploy
```

| Kind     | Detected by                                      | Card actions                           |
| -------- | ------------------------------------------------ | -------------------------------------- |
| AI skill | Folder with a `SKILL.md`                         | Download as `.tar.gz`, view `SKILL.md` |
| Code     | Highlighted languages and common code extensions | Download, inline preview up to 100 KB  |
| Document | `pdf`, `docx`, `xlsx`, `pptx`, `csv` and similar | Download, open                         |
| File     | Anything else                                    | Download                               |

A missing resource fails the build.
