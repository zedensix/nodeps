---
title: Command line
description: The dev, serve and build commands, and the mise tasks.
order: 5
icon: square-terminal
byline: The nodeps maintainers
---

```sh
bun docs.ts <command> [options]
```

## Commands

| Command | Description                                             |
| ------- | ------------------------------------------------------- |
| `dev`   | Serve with live reload                                  |
| `serve` | Serve in production, with server-side rendering and MCP |
| `build` | Export static files into the output directory           |

## Options

| Option           | Default            | Description       |
| ---------------- | ------------------ | ----------------- |
| `-c`, `--config` | `docs.yaml`        | Config file       |
| `-p`, `--port`   | `$PORT`, then 3000 | Port to listen on |
| `--host`         | `0.0.0.0`          | Hostname to bind  |
| `-h`, `--help`   |                    | Show the help     |

## mise tasks

| Task                         | Runs                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `mise run dev`               | `bun --watch docs.ts dev`, restarting when the code changes                      |
| `mise run build`             | `bun docs.ts build`                                                              |
| `mise run icons`             | Downloads the Lucide icons into `theme/icons`, one folder per category           |
| `mise run compile`           | Compiles the standalone `nodeps` binary into `build/`                            |
| `mise run release <version>` | Builds every binary, the npm packages and the Python wheels into `build/release` |

`mise run compile` takes Bun compile targets to cross-compile, for example `mise run compile bun-linux-x64 bun-darwin-arm64`. Each binary embeds the theme and every Lucide icon, so it runs without the repository.

Arguments after the task name are passed through: `mise run dev --port 4000`.
