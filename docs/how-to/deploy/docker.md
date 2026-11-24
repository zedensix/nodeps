---
title: In a container
description: Build the opt-in image and mount your docs into it.
order: 2
icon: container
byline: The nodeps maintainers
tags: [deploy, docker]
---

The repository ships an opt-in `Dockerfile`: it compiles the binary, then copies it alone into a distroless image that serves whatever is mounted at `/site`.

```sh
docker build -t nodeps .
docker run -p 3000:3000 -v "$PWD:/site:ro" nodeps
```

Last-updated dates fall back to file modification times in the container, since it has no git.
