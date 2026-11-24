---
title: Attach files and AI skills
description: Ship code samples, documents and Claude skills with a page.
order: 3
icon: paperclip
byline: The nodeps maintainers
tags: [resources, skills, downloads]
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

The page ends with a Resources section: a card per file with its size and a download button. Code files also get an inline, highlighted preview.

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

Readers get a **Download skill** button for a `.tar.gz` of the folder, built by the server, and a link to the `SKILL.md`. The folder is not turned into pages.

## Install a downloaded skill in Claude Code

```sh
tar -xzf acme-deploy.tar.gz -C ~/.claude/skills
```
