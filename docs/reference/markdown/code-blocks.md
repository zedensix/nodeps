---
title: Code blocks
description: Languages, titles, highlighted lines and diffs.
order: 1
icon: file-code
byline: The nodeps maintainers
---

Highlighted on the server. A `mermaid` block renders as a [diagram](./diagrams-and-math.md). Languages: `ts`, `js`, `tsx`, `jsx`, `json`, `sh`, `bash`, `css`, `html`, `xml`, `toml`, `yaml`, `python`, `rust`, `go`, `sql`, `diff`, `dockerfile`, `nginx`. `svelte` and `vue` use the HTML grammar: tags and attributes are highlighted, the script and `{…}` expressions are not. Any other language renders as escaped plain text, with no warning and no error, and the copy button still works. Grammars are built in: a site cannot add one.

## Options

Options follow the language:

| Option         | Example            | Effect                                     |
| -------------- | ------------------ | ------------------------------------------ |
| `title="..."`  | `title="app.ts"`   | File name bar above the code               |
| `{lines}`      | `{1,3-5}`          | Highlights those lines                     |
| `hl_lines="…"` | `hl_lines="2 4-5"` | Highlights those lines, MkDocs style       |
| `linenums="…"` | `linenums="1"`     | Numbers the lines, starting at that number |

````md
```ts title="server.ts" {2}
const server = Bun.serve({
  port: 3000,
  fetch: () => new Response("Hello"),
});
```
````

```ts title="server.ts" {2}
const server = Bun.serve({
  port: 3000,
  fetch: () => new Response("Hello"),
});
```

## Diffs

In `diff` blocks, lines starting with `+` and `-` are colored.

```diff
- const port = 3000;
+ const port = Number(process.env.PORT ?? 3000);
```
