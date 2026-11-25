---
title: Why only Bun
description: What a documentation tool gains from having no dependencies.
order: 1
icon: package
byline: The nodeps maintainers
tags: [bun, install]
---

Most documentation generators install hundreds of packages before rendering a single page: a Markdown parser and its plugins, a highlighter and its grammars, a bundler, a dev server, a YAML parser. Each one is a version to pin, an advisory to triage and a cold start to wait for.

Bun ships most of that in the runtime. nodeps is an experiment in leaning on it entirely: Markdown goes through `Bun.markdown`, configuration through `Bun.YAML`, HTML through `HTMLRewriter`, the client through `Bun.build`, files through `Bun.Glob`, and the server is `Bun.serve`. There are no runtime dependencies and nothing to install besides Bun; the repository's `package.json` only brings type definitions for editors.

## What it costs

Two pieces had to be written by hand.

**Syntax highlighting.** Bun's Markdown renderer highlights code only in its terminal output, and only for JavaScript and TypeScript. nodeps carries a small tokenizer with grammars for the languages documentation needs most. It is less precise than a full grammar engine and much smaller.

**Search.** A few lines of scoring over an index built at render time. It finds words, not typos.

Everything else is glue: a few hundred lines that decide how files become pages and pages become a site.

## What it buys

A cold build of these docs takes well under a second. The repository has nothing to audit but its own code, and upgrading means upgrading Bun.
