# nodeps

A documentation site generator and server built only on Bun's native APIs: no runtime dependencies, nothing to install besides Bun.

Markdown pages become a themeable site with search, instant navigation, a Diátaxis homepage, a WYSIWYG editor that turns edits into pull requests, downloadable resources and AI skills, `llms.txt`, Markdown twins of every page and an MCP server. It runs as a Bun server behind nginx, or exports static files.

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
mise run cli:install  # compile and install as ~/.local/bin/nodeps
```

The documentation lives in `docs/` and is served by the tool itself: start with `mise run dev`.

## Coming from MkDocs or Zensical

```sh
nodeps migrate mkdocs.yml           # report only
nodeps migrate mkdocs.yml --write   # write docs.yaml
```

Admonitions, content tabs, snippets, icons, Mermaid, math and the rest of the PyMdown syntax render as they are.

## Develop

```sh
mise install              # installs Bun, prek and the git hooks
bun install               # type definitions for editors, never shipped
prek run --all-files --stage pre-push   # everything CI runs, including the compiled binary
```

The hooks format with `bun fmt`, lint with `bun lint`, build the docs to catch broken pages, check YAML, JSON and TOML, audit workflows with zizmor and pinact, lint the Dockerfile with hadolint, and refuse commits with a Claude or Anthropic `Co-Authored-By` trailer. Pushing also type-checks with `bun check` (installing the type definitions first), compiles the binary and builds the docs with it. CI runs exactly the same prek command. `bun lint` needs the Bun canary build, which mise installs.

Server-rendered HTML is written as JSX (`.tsx` files starting with `/** @jsx h */`), turned into strings by the small factory in `src/render/jsx.ts`, with no React and no dependency. Text and attribute values are escaped by default; wrap HTML that is already safe, such as rendered Markdown or highlighted code, in `raw()`.

## Releases

[releaser](https://github.com/zedensix/releaser) runs on every push to `main`, from Conventional Commits:

- each push with a `feat` or `fix` ships a beta: a GitHub prerelease `vX.Y.Z-beta.N` with the binaries, the `beta` npm tag, a `X.Y.ZbN` PyPI version and the `zedensix/nodeps:beta` image on Docker Hub;
- releaser also keeps a release PR open, `chore(release): X.Y.Z`, rebuilt on every push. Merging it tags the stable version, writes `CHANGELOG.md` and publishes everywhere as `latest`. The release PR branch runs the same checks as any pull request.

Pull requests run code quality (every prek hook) and a Docker build; pushes to `main` run the same checks before releasing. After publishing, a final job checks that npm (all 8 packages), PyPI, Docker Hub and the GitHub release assets all have the new version, and fails the run if one is missing. Publishing needs npm trusted publishing on `@zedensix/nodeps` and each `@zedensix/nodeps-*` platform package, and PyPI trusted publishing for the `pypi` environment, both bound to the `main.yml` workflow, a `DOCKERHUB_USERNAME` variable with a `DOCKERHUB_TOKEN` secret, and a `RELEASE_DEPLOY_KEY` deploy key to push tags past branch protection (and later let the release PR run CI).

## Credits

Icons are [Lucide](https://lucide.dev), ISC license, downloaded by `mise run icons`. The license ships next to them in `icons/LICENSE`.
