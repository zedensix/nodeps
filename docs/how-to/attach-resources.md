---
title: Attach files and AI skills
description: Ship code samples, documents and Claude skills with a page.
order: 3
icon: paperclip
byline: The nodeps maintainers
tags: [resources, ai, claude, frontmatter, code]
---

## Attach a file

Put the file next to the page and list it in the frontmatter:

```yaml title="docs/guides/database.md"
---
title: Set up the database
icon: database
byline: The Acme team
resources:
  - files/schema.sql
  - path: files/runbook.pdf
    title: Incident runbook
---
```

The page ends with a Resources section: a card per file with its size and a download button. Code files also get an inline, highlighted preview with a copy button.

## Attach a folder

A tutorial that comes with a code project attaches the whole folder:

```yaml title="docs/tutorials/first-app.md"
---
resources:
  - path: code/first-app
    title: Starter project
    description: The finished code of this tutorial.
---
```

The card offers **Download folder**, a `.tar.gz` of everything in it, and **Browse files**: every file listed with its size. A code file opens into a highlighted preview with a copy button and its own download link; any other file downloads. An attached folder is served as files: Markdown inside it, such as a `README.md`, is not turned into a page.

## Ship an AI skill

Create a folder with a `SKILL.md` in it, the format Claude skills use:

```md title="docs/guides/skills/acme-deploy/SKILL.md"
---
name: acme-deploy
description: Deploy Acme to production. Use when asked to release or deploy.
---

1. Run the test suite.
2. Tag the release.
```

Attach the folder:

```yaml
resources:
  - skills/acme-deploy
```

Readers get a **Download skill** button for a `.tar.gz` of the folder, built by the server, a link to the `SKILL.md`, **Copy install command** and the same file browser as a folder. The folder is not turned into pages, and it does not belong in `nav`. A link to its `SKILL.md` from any page opens the file.

## Collect skills in a skills folder

Put skill folders in a folder named `skills`, at any depth: `docs/guides/skills/acme-deploy/SKILL.md`, `docs/guides/skills/acme-review/SKILL.md`. That folder becomes a **Skills** page in the sidebar, with a card per skill. Give it an `index.md` to write your own title and introduction; its skills are listed below unless its frontmatter names `resources` itself.

## Install a downloaded skill in Claude Code

**Copy install command** gives a one-line command that downloads the skill and unpacks it into `~/.claude/skills`. From a downloaded archive:

```sh
tar -xzf acme-deploy.tar.gz -C ~/.claude/skills
```
