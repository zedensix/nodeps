---
title: Diagrams and math
description: Mermaid diagrams and LaTeX formulas.
order: 6
icon: chart-network
byline: The nodeps maintainers
tags: [markdown, mermaid, math]
---

## Diagrams

````md
```mermaid
graph LR
  A[Write] --> B[Build] --> C[Ship]
```
````

```mermaid
graph LR
  A[Write] --> B[Build] --> C[Ship]
```

## Math

```md
Inline $e^{i\pi} + 1 = 0$, or a block:

$$
\int_0^1 x\,dx = \frac{1}{2}
$$
```

Inline $e^{i\pi} + 1 = 0$, or a block:

$$
\int_0^1 x\,dx = \frac{1}{2}
$$

`\(…\)` and `\[…\]` work too.

> [!NOTE]
> Mermaid and KaTeX are loaded from the jsDelivr CDN, pinned to a version, and only on pages that use them.
