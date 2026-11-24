# nodeps

A documentation site generator and server built only on Bun's native APIs: no `package.json`, no `node_modules`.

Markdown pages become a themeable site with search, instant navigation, a Diátaxis homepage, downloadable resources and AI skills, `llms.txt`, Markdown twins of every page and an MCP server. It runs as a Bun server behind nginx, or exports static files.

## Install

```sh
npm install --global @zedensix/nodeps   # or: bunx @zedensix/nodeps
pip install zedensix-nodeps
mise use github:zedensix/nodeps
```

Standalone binaries for Linux (glibc and musl), macOS and Windows are attached to every [GitHub release](https://github.com/zedensix/nodeps/releases).

## Use it

```sh
mise install
mise run dev        # live reload on http://localhost:3000
mise run build      # static export
mise run compile    # standalone binary in build/
```

The documentation lives in `docs/` and is served by the tool itself: start with `mise run dev`.

## Develop

```sh
mise install              # installs Bun, prek and the git hooks
prek run --all-files      # what every commit and CI run
```

The hooks format with `bun fmt`, lint with `bun lint`, build the docs to catch broken pages, check YAML, JSON and TOML, and refuse commits with a Claude or Anthropic `Co-Authored-By` trailer. `bun lint` needs the Bun canary build, which mise installs.

## Credits

Icons are [Lucide](https://lucide.dev), ISC license, downloaded by `mise run icons`. The license ships next to them in `theme/icons/LICENSE`.
