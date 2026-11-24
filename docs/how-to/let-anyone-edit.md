---
title: Let anyone edit pages
description: A visual editor for people who do not write Markdown, publishing through GitHub.
order: 3.5
icon: square-pen
byline: The nodeps maintainers
tags: [editor, github, oauth, contributors]
---

The visual editor is on by default. Every page gets **Edit this page**, at the bottom and in the page menu. It opens the page as it looks on the site, with a toolbar for headings, bold, links, lists, quotes and code. Drafts are kept on the editor's device until they are published.

## Publish through the provider's editor

Without any setup, **Publish** copies the page as Markdown and opens it in your git provider's web editor. The contributor pastes over the file and proposes the change. This works with GitHub, GitLab, Gitea and Bitbucket, and from a static export.

Without a `repository`, **Publish** downloads the updated `.md` file instead.

## Publish as a pull request, without leaving the site

1. Create a GitHub OAuth app. Set its callback URL to your site's `url` followed by `/_auth/callback`, for example `https://docs.acme.dev/_auth/callback`.
2. Add its client id to `docs.yaml`:

   ```yaml title="docs.yaml"
   url: https://docs.acme.dev
   repository: https://github.com/acme/acme
   editor:
     oauth:
       client_id: Ov23liExampleClientId
   ```

3. Give the server the client secret through its environment:

   ```sh
   NODEPS_OAUTH_CLIENT_SECRET=… nodeps serve
   ```

Contributors now sign in with GitHub when they first publish. nodeps creates a branch, in a fork if they cannot push to the repository, commits the page and opens a pull request. The editor then shows **Waiting for approval**, and the page shows the same banner on their next visit until the pull request is merged or closed.

> [!IMPORTANT]
> Never put the client secret in `docs.yaml`. The build refuses it, since the file is committed.

## Turn the editor off

```yaml title="docs.yaml"
editor:
  enabled: false
```

With the editor off and `repository.edit: true`, **Edit this page** links straight to the provider's editor.
