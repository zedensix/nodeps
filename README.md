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

## Coming from MkDocs or Zensical

```sh
nodeps migrate mkdocs.yml           # report only
nodeps migrate mkdocs.yml --write   # write docs.yaml and add missing frontmatter
```

Admonitions, content tabs, snippets, icons, Mermaid, math and the rest of the PyMdown syntax render as they are.

## Develop

```sh
mise install              # installs Bun, prek and the git hooks
prek run --all-files --stage pre-push   # everything CI runs, including the compiled binary
```

The hooks format with `bun fmt`, lint with `bun lint`, build the docs to catch broken pages, check YAML, JSON and TOML, audit workflows with zizmor and pinact, lint the Dockerfile with hadolint, and refuse commits with a Claude or Anthropic `Co-Authored-By` trailer. Pushing also compiles the binary and builds the docs with it. CI runs exactly the same prek command. `bun lint` needs the Bun canary build, which mise installs.

## Releases

[releaser](https://github.com/zedensix/releaser) runs on every push to `main`, from Conventional Commits:

- each push with a `feat` or `fix` ships a canary: a GitHub prerelease with the binaries, the `canary` npm tag, a `.devN` PyPI version and the `zedensix/nodeps:canary` image on Docker Hub;
- it keeps a release PR open; merging it tags the stable version, writes `CHANGELOG.md`, and publishes everywhere as `latest`.

The workflow needs an `NPM_TOKEN` secret, PyPI trusted publishing for the `pypi` environment, a `DOCKERHUB_USERNAME` variable with a `DOCKERHUB_TOKEN` secret, and a `RELEASE_DEPLOY_KEY` deploy key so the release PR runs CI and can pass branch protection.

## Credits

Icons are [Lucide](https://lucide.dev), ISC license, downloaded by `mise run icons`. The license ships next to them in `theme/icons/LICENSE`.
