---
title: Connect AI agents
description: Give Claude, ChatGPT or any MCP client access to your docs.
order: 4
icon: bot
byline: The nodeps maintainers
resources:
  - path: skills/nodeps-writer
    title: nodeps-writer skill
tags: [ai, mcp, llms.txt, claude]
---

## Add the docs to Claude Code

```sh
claude mcp add --transport http acme https://docs.acme.dev/mcp
```

On any page, the menu next to **Copy page** has a **Connect with MCP** entry that copies this command with your site's URL.

## Paste one page into a chat

Click **Copy page**. The page is copied as Markdown, with code blocks intact.

## Ask a model about a page

Open the page menu and pick **Open in Claude** or **Open in ChatGPT**. The chat opens with a prompt pointing at the page's Markdown version.

## Feed the whole documentation to a model

Give it `/llms-full.txt`, every page in one Markdown file, or `/llms.txt`, the index of pages for agents that fetch what they need.

## Fetch pages as Markdown from a script

```sh
curl https://docs.acme.dev/guides/install.md
curl -H "Accept: text/markdown" https://docs.acme.dev/guides/install/
```
