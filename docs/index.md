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

## Anyone can fix a page

Every page has **Edit this page**. It opens a WYSIWYG editor right on the site: the page as readers see it, a formatting toolbar, Markdown shortcuts as you type, and a switch to the raw Markdown. **Publish** opens a GitHub pull request, or hands the change to your git provider's web editor. Contributors never clone the repository or learn Markdown. See [Let anyone edit pages](./how-to/let-anyone-edit.md).

## How these docs are organized

This documentation follows [Diátaxis](https://diataxis.fr). Each section answers a different need:

- **Tutorials** when you are learning: follow the steps, get a result.
- **How-to guides** when you have a task: a recipe for one goal.
- **Reference** when you need a fact: every option and format, nothing else.
- **Explanation** when you want to understand: the reasons behind the design.

nodeps can organize your docs the same way, see [Organize content into sections](./how-to/organize-content.md).
