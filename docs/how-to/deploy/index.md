---
title: Deploy
description: Pick how to put the docs online.
order: 5
icon: cloud-upload
byline: The nodeps maintainers
tags: [deploy, hosting]
---

| You want                               | Use                                   |
| -------------------------------------- | ------------------------------------- |
| MCP, Markdown negotiation, one process | [Behind nginx](./nginx.md)            |
| The same, packaged                     | [In a container](./docker.md)         |
| Plain files on any host or CDN         | [As static files](./static-export.md) |

## Serve under a sub-path

```yaml title="docs.yaml"
base: /docs/
```

Every link, asset and endpoint gets the prefix.
