---
name: nodeps-writer
description: Write and organize documentation pages for a nodeps site, following Diátaxis. Use when adding or restructuring Markdown pages in a nodeps docs folder.
---

# Writing nodeps documentation

## Pick the kind of page first

Decide which Diátaxis quadrant the page belongs to and put it in that section's folder:

- `tutorials/`: a lesson. Numbered steps, one guaranteed result, no alternatives.
- `how-to/`: a recipe for one task. Assume competence, skip explanations.
- `reference/`: facts only. Tables, options, defaults, formats.
- `explanation/`: the why. Context, trade-offs, history.

Never mix two kinds in one page. Split it and link between them.

## Frontmatter

`icon` (a Lucide icon name from https://lucide.dev/icons) and `byline` are optional. Set them to show an icon and an author line in the sidebar and under the title:

```yaml
---
title: Install Acme
description: One sentence, shown under the title and in llms.txt.
icon: download
byline: The Acme team
order: 1
---
```

## Markdown features

- Code blocks: add `title="file.ts"` and `{2-4}` after the language.
- Alerts: `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]`.
- Link to pages by file: `[Theme](../how-to/customize-theme.md)`.
- Attach files with `resources:` in the frontmatter.

## Check your work

Run `mise run build`. It fails on an unknown icon or a missing resource, and warns on broken links.
