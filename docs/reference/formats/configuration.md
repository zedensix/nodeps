---
title: docs.yaml
description: Every option of the site configuration file.
order: 1
icon: settings
byline: The nodeps maintainers
resources:
  - path: files/docs.yaml
    title: Complete docs.yaml
    description: Every option set, ready to copy.
tags: [config, yaml]
---

The site is configured in one YAML file, `docs.yaml` by default. Every key is optional. Paths are relative to the file.

```yaml title="docs.yaml"
title: Acme
description: Everything about Acme.
url: https://docs.acme.dev
base: /
source: docs
output: dist
logo: logo.svg
repository:
  url: https://github.com/acme/acme
  edit: true
footer: © Acme

links:
  - label: GitHub
    url: https://github.com/acme/acme

home:
  headline: Acme documentation
  tagline: Learn to turn coffee into software.
  actions:
    - label: Get started
      url: tutorials/first-steps.md
  latest: 3

theme:
  accent: "#6d5efc"
```

## Site

| Key           | Default         | Description                                               |
| ------------- | --------------- | --------------------------------------------------------- |
| `title`       | `Documentation` | Site name, in the header and page titles                  |
| `description` |                 | Default meta description and summary of `llms.txt`        |
| `url`         |                 | Public origin, used for canonical links and absolute URLs |
| `base`        | `/`             | Path the site is served under                             |
| `source`      | `docs`          | Directory of Markdown files and assets                    |
| `output`      | `dist`          | Static export directory, deleted on every build           |
| `logo`        |                 | Image inside the source directory, also the favicon       |
| `footer`      |                 | Text at the bottom of every page                          |
| `links`       |                 | Header links, each with a `label` and a `url`             |

## repository

The git repository holding the docs. Either a URL, or a mapping:

```yaml
repository:
  url: https://git.acme.dev/acme/acme
  provider: gitea
  branch: main
  path: docs
  edit: true
```

| Key        | Default                           | Description                                                                    |
| ---------- | --------------------------------- | ------------------------------------------------------------------------------ |
| `url`      |                                   | Required. Web URL of the repository, shown in the header                       |
| `provider` | From the host                     | `github`, `gitlab`, `gitea` or `bitbucket`. Required for self-hosted instances |
| `branch`   | `main`                            | Branch the edit links open                                                     |
| `path`     | `source`, relative to `docs.yaml` | Folder of the docs inside the repository                                       |
| `edit`     | `false`                           | Adds an "Edit this page" link to every page                                    |

Detected hosts: `github.com`, `gitlab.com`, `bitbucket.org`, `codeberg.org` and `gitea.com`. Codeberg and Forgejo use `gitea`.

| Provider    | Edit link                                    |
| ----------- | -------------------------------------------- |
| `github`    | `<url>/edit/<branch>/<path>/<file>`          |
| `gitlab`    | `<url>/-/edit/<branch>/<path>/<file>`        |
| `gitea`     | `<url>/_edit/<branch>/<path>/<file>`         |
| `bitbucket` | `<url>/src/<branch>/<path>/<file>?mode=edit` |

## home

Present means the root page renders as a homepage.

| Key        | Default       | Description                                                    |
| ---------- | ------------- | -------------------------------------------------------------- |
| `headline` | `title`       | Hero heading                                                   |
| `tagline`  | `description` | Text under the heading                                         |
| `actions`  |               | Buttons, each with a `label` and a `url`; the first is primary |
| `latest`   | `3`           | Most recently updated pages shown per section, `0` to hide     |

An action `url` ending in `.md` is resolved to that page.

## sidebar

| Key         | Default | Description                                                           |
| ----------- | ------- | --------------------------------------------------------------------- |
| `dropdowns` | `true`  | Folders render as collapsible branches, or as categories when `false` |
| `bylines`   | `true`  | Show each page's byline under its title in the sidebar                |

## diataxis

| Key     | Default | Description                                                                          |
| ------- | ------- | ------------------------------------------------------------------------------------ |
| `badge` | `true`  | Show a pill next to each page title naming its Diátaxis kind, linking to diataxis.fr |

The pill only appears in sections whose `_folder.yaml` sets `diataxis`.

## theme

| Key          | Description                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------- |
| `preset`     | Built-in preset to start from, see the [theme gallery](../../themes/index.md). Default: `default` |
| `accent`     | Brand color, any CSS color                                                                        |
| `stylesheet` | Extra CSS file, loaded after the theme                                                            |
| `light`      | Token values for light mode                                                                       |
| `dark`       | Token values for dark mode                                                                        |
| any token    | Sets that [design token](../design-tokens.md) for both modes                                      |
