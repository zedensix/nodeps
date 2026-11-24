---
title: Formatting
description: Keys, highlights, footnotes, definitions, abbreviations, buttons and grids.
order: 4
icon: type
byline: The nodeps maintainers
tags: [markdown, mkdocs]
---

## Inline

| Syntax             | Result           |
| ------------------ | ---------------- |
| `==marked==`       | ==marked==       |
| `^^inserted^^`     | ^^inserted^^     |
| `~~deleted~~`      | ~~deleted~~      |
| `H~2~O`            | H~2~O            |
| `A^T^A`            | A^T^A            |
| `++ctrl+alt+del++` | ++ctrl+alt+del++ |

## Footnotes

```md
Lorem ipsum[^1].

[^1]: The footnote, listed at the end of the page.
```

## Definition lists

```md
`docs.yaml`

: The site configuration file.
```

`docs.yaml`

: The site configuration file.

## Abbreviations

```md
The HTML spec.

*[HTML]: Hyper Text Markup Language
```

Every occurrence of the term gets the expansion as a tooltip.

## Attributes

`{ … }` after a link, image or icon adds classes (`.name`), an id (`#name`) or attributes (`key=value`). After a heading it sets its anchor: `## Install { #setup }`.

```md
[Get started](#){ .md-button .md-button--primary } [Docs](#){ .md-button }
```

[Get started](#){ .md-button .md-button--primary } [Docs](#){ .md-button }

## Grids

```md
<div class="grid cards" markdown>

- :material-clock-fast:{ .lg .middle } **Set up in minutes**

  ***

  One binary, one config file.

- :material-scale-balance:{ .lg .middle } **Open source**

  ***

  Read the code.

</div>
```

<div class="grid cards" markdown>

- :material-clock-fast:{ .lg .middle } **Set up in minutes**

  ***

  One binary, one config file.

- :material-scale-balance:{ .lg .middle } **Open source**

  ***

  Read the code.

</div>
