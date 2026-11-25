---
title: Link your git repository
description: Show the repository in the header and add edit links to every page.
order: 1.5
icon: git-branch
byline: The nodeps maintainers
tags: [git, github, editor]
---

## Link a repository

```yaml title="docs.yaml"
repository: https://github.com/acme/acme
```

The header shows the provider's logo and `acme/acme`, linking to the repository. GitHub, GitLab, Bitbucket, Codeberg and gitea.com are recognized from the URL.

## Add edit links

```yaml title="docs.yaml"
repository:
  url: https://github.com/acme/acme
  edit: true
```

Every page gets an "Edit this page" link at the bottom, opening the file in the provider's editor on the `main` branch.

## Use a self-hosted instance

Name the provider, since it cannot be guessed from your domain:

```yaml title="docs.yaml"
repository:
  url: https://git.acme.dev/acme/acme
  provider: gitea
  edit: true
```

GitLab and Bitbucket instances work the same with `provider: gitlab` or `provider: bitbucket`.

## Docs not at the repository root

When `docs.yaml` is not at the root of the repository, set where the docs folder lives and which branch to edit:

```yaml title="docs.yaml"
repository:
  url: https://gitlab.com/acme/platform
  branch: develop
  path: packages/docs/content
  edit: true
```
