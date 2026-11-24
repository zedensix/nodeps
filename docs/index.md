---
title: Overview
description: Markdown in, a fast documentation site out. No package.json, no node_modules, only Bun.
icon: sparkles
byline: The nodeps maintainers
---

## Bun does the heavy lifting

| Need                        | Native Bun API                       |
| --------------------------- | ------------------------------------ |
| Markdown to HTML            | `Bun.markdown.html`                  |
| Config and frontmatter      | `Bun.YAML`                           |
| HTML post-processing        | `HTMLRewriter`                       |
| Layout, client code and CSS | `Bun.build` with an HTML entry point |
| File discovery              | `Bun.Glob`                           |
| Server and live reload      | `Bun.serve` with WebSockets          |

## How these docs are organized

This documentation follows [Diátaxis](https://diataxis.fr). Each section answers a different need:

- **Tutorials** when you are learning: follow the steps, get a result.
- **How-to guides** when you have a task: a recipe for one goal.
- **Reference** when you need a fact: every option and format, nothing else.
- **Explanation** when you want to understand: the reasons behind the design.

nodeps can organize your docs the same way, see [Organize content into sections](./how-to/organize-content.md).
