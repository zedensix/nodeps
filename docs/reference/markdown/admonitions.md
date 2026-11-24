---
title: Admonitions
description: Call-outs, collapsible blocks and GitHub alerts.
order: 2
icon: triangle-exclamation-point
byline: The nodeps maintainers
tags: [markdown, admonitions, mkdocs]
---

## Blocks

```md
!!! note "Phasellus posuere"
Lorem ipsum dolor sit amet, with **Markdown** and nested blocks.
```

!!! note "Phasellus posuere"
Lorem ipsum dolor sit amet, with **Markdown** and nested blocks.

`""` as the title removes it. The body is indented by four spaces and can hold anything, including other admonitions.

## Collapsible

```md
??? question "Closed by default"
Hidden until opened.

???+ tip "Open by default"
Visible, can be closed.
```

??? question "Closed by default"
Hidden until opened.

???+ tip "Open by default"
Visible, can be closed.

## Placement

`inline` floats the block left of the following content, `inline end` floats it right.

## Types

| Type       | Aliases                |
| ---------- | ---------------------- |
| `note`     |                        |
| `abstract` | `summary`, `tldr`      |
| `info`     | `todo`                 |
| `tip`      | `hint`, `important`    |
| `success`  | `check`, `done`        |
| `question` | `help`, `faq`          |
| `warning`  | `caution`, `attention` |
| `failure`  | `fail`, `missing`      |
| `danger`   | `error`                |
| `bug`      |                        |
| `example`  |                        |
| `quote`    | `cite`                 |

## GitHub alerts

```md
> [!WARNING]
> The output directory is deleted on every build.
```

> [!WARNING]
> The output directory is deleted on every build.

`NOTE`, `TIP`, `IMPORTANT`, `WARNING` and `CAUTION` are supported.
