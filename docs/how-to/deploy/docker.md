---
title: In a container
description: Build the opt-in image and mount your docs into it.
order: 2
icon: container
byline: The nodeps maintainers
tags: [deploy, docker]
---

The repository ships an opt-in `Dockerfile`: it compiles the binary for musl and copies it into an empty `scratch` image, with only the three libraries it needs, CA certificates and the nodeps documentation in `/app`. It runs as a non-root user and weighs about 60 MB to download.

```sh
docker run -p 3000:3000 zedensix/nodeps
```

Every release is published on Docker Hub for `linux/amd64` and `linux/arm64`: `:latest` for stable versions, `:beta` for the newest build of `main`. To build it yourself:

```sh
docker build -t nodeps .
```

The server listens on `$PORT`, 3000 by default, which suits platforms that assign the port.

## Serve your own docs

Mount the folder holding your `docs.yaml` over `/app`:

```sh
docker run -p 3000:3000 -v "$PWD:/app:ro" zedensix/nodeps
```

Or bake them into an image of your own:

```dockerfile title="Dockerfile"
FROM zedensix/nodeps
COPY docs.yaml /app/docs.yaml
COPY docs /app/docs
```

Last-updated dates fall back to file modification times in the container, since it has no git. Set `updated` in the frontmatter of pages where the date matters.
