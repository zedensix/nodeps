---
title: Docs for people and agents
description: Why every page exists twice, and what the MCP server is for.
order: 3
icon: brain
byline: The nodeps maintainers
tags: [ai, mcp, llms.txt, server]
---

Documentation now has two audiences: people reading in a browser, and models reading on their behalf. HTML serves the first well and the second badly: navigation, scripts and markup cost tokens and hide structure.

## Markdown is the source of truth

Pages are written in Markdown, so nodeps serves that Markdown back instead of reconstructing it from HTML. Every page has a `.md` twin, the server answers `Accept: text/markdown`, and `llms-full.txt` concatenates everything. A model gets the exact text the author wrote.

## Discovery

`llms.txt` is a map: sections, page titles, one-line descriptions and links. An agent with a small context reads the map and fetches only what it needs.

## MCP

Copying pages into a chat works once. An MCP server lets an agent search and read the documentation itself, as often as the task requires, with the same index the search box uses. Its tools are read-only and return Markdown.

## Diátaxis helps models too

A page that mixes a tutorial, a reference table and a design rationale is hard to use for anyone. Splitting docs by purpose, as [Diátaxis](https://diataxis.fr) suggests, gives an agent pages that answer one kind of question each, and lets `llms.txt` say which kind.
