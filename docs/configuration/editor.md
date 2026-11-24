---
title: Editor
description: The visual editor and GitHub pull request publishing.
order: 5
icon: square-pen
byline: The nodeps maintainers
tags: [config, editor, oauth]
---

```yaml title="docs.yaml"
editor:
  enabled: true
  oauth:
    client_id: Ov23liExampleClientId
    scope: public_repo
```

| Key               | Default       | Description                                                         |
| ----------------- | ------------- | ------------------------------------------------------------------- |
| `enabled`         | `true`        | "Edit this page" opens the visual editor                            |
| `oauth.client_id` |               | GitHub OAuth app client id; also read from `NODEPS_OAUTH_CLIENT_ID` |
| `oauth.scope`     | `public_repo` | Scope requested at sign-in; `repo` for private repositories         |

The client secret is only read from the `NODEPS_OAUTH_CLIENT_SECRET` environment variable; writing it in `docs.yaml` fails the build. OAuth needs a GitHub `repository`, `url`, and the Bun server. See [Let anyone edit pages](../how-to/let-anyone-edit.md).
