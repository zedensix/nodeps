---
title: In a container
description: Build the opt-in image and mount your docs into it.
order: 2
icon: container
byline: The nodeps maintainers
tags: [deploy, docker]
---

The repository ships an opt-in `Dockerfile`: it compiles the binary, then copies it into a distroless image together with the nodeps documentation, served from `/site`.

```sh
docker run -p 3000:3000 ghcr.io/zedensix/nodeps
```

Every release is published there for `linux/amd64` and `linux/arm64`: `:latest` for stable versions, `:canary` for the newest build of `main`. To build it yourself:

```sh
docker build -t nodeps .
```

The server listens on `$PORT`, 3000 by default, which suits platforms that assign the port.

## Serve your own docs

Mount the folder holding your `docs.yaml` over `/site`:

```sh
docker run -p 3000:3000 -v "$PWD:/site:ro" nodeps
```

Or bake them into an image of your own:

```dockerfile title="Dockerfile"
FROM nodeps
COPY docs.yaml /site/docs.yaml
COPY docs /site/docs
```

Last-updated dates fall back to file modification times in the container, since it has no git. Set `updated` in the frontmatter of pages where the date matters.
