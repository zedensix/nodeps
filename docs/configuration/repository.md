---
title: Repository
description: The git link in the header and edit links, for any provider.
order: 4
icon: git-branch
byline: The nodeps maintainers
tags: [config, git]
---

```yaml title="docs.yaml"
repository:
  url: https://git.acme.dev/acme/acme
  provider: gitea
  branch: main
  path: docs
  edit: true
```

A URL alone also works: `repository: https://github.com/acme/acme`.

| Key        | Default                           | Description                                                                    |
| ---------- | --------------------------------- | ------------------------------------------------------------------------------ |
| `url`      |                                   | Required. Web URL of the repository, shown in the header                       |
| `provider` | From the host                     | `github`, `gitlab`, `gitea` or `bitbucket`. Required for self-hosted instances |
| `branch`   | `main`                            | Branch the edit links open                                                     |
| `path`     | `source`, relative to `docs.yaml` | Folder of the docs inside the repository                                       |
| `edit`     | `false`                           | Adds an edit link to every page when the editor is off                         |

Detected hosts: `github.com`, `gitlab.com`, `bitbucket.org`, `codeberg.org` and `gitea.com`.

| Provider    | Edit link                                    |
| ----------- | -------------------------------------------- |
| `github`    | `<url>/edit/<branch>/<path>/<file>`          |
| `gitlab`    | `<url>/-/edit/<branch>/<path>/<file>`        |
| `gitea`     | `<url>/_edit/<branch>/<path>/<file>`         |
| `bitbucket` | `<url>/src/<branch>/<path>/<file>?mode=edit` |
