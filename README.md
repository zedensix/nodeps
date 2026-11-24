# nodeps

A documentation site generator and server built only on Bun's native APIs: no `package.json`, no `node_modules`.

Markdown pages become a themeable site with search, instant navigation, a Diátaxis homepage, downloadable resources and AI skills, `llms.txt`, Markdown twins of every page and an MCP server. It runs as a Bun server behind nginx, or exports static files.

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
bun fmt
bun lint
```

`bun lint` needs the Bun canary build, which mise installs.

## Credits

Icons are [Lucide](https://lucide.dev), ISC license, downloaded by `mise run icons`. The license ships next to them in `theme/icons/LICENSE`.
