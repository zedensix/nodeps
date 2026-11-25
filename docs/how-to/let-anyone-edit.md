---
title: Let anyone edit pages
description: A WYSIWYG editor on every page for people who do not write Markdown, publishing through GitHub.
order: 3.5
icon: square-pen
byline: The nodeps maintainers
tags: [editor, wysiwyg, github, oauth, git]
---

The visual editor, a WYSIWYG editor built into every page, is on by default. Every page gets **Edit this page**, at the bottom and in the page menu. It opens the page as it looks on the site, with a toolbar for headings, bold, links, lists, quotes and code. Drafts are kept on the editor's device until they are published. While it is open the address ends in `?edit=true`, so a reload keeps it open and the link opens the editor for whoever follows it. Reloading or closing the tab with unpublished changes asks for confirmation first, in the browser's own dialog.

## Write with Markdown shortcuts

The visual editor understands Markdown as you type:

| Type                                                              | Becomes                                          |
| ----------------------------------------------------------------- | ------------------------------------------------ |
| `# `, `## `, `### `                                               | A heading                                        |
| `- ` or `1. `                                                     | A list                                           |
| `> `                                                              | A quote                                          |
| ` ```bash ` then Enter                                            | A code block; ` ``` ` on its last line closes it |
| `---` then Enter                                                  | A horizontal rule                                |
| `**bold**`, `*italic*`, `` `code` ``, `~~strike~~`, `[text](url)` | The formatting                                   |

Pasting Markdown converts it too when the site runs on the Bun server.

## Edit the Markdown source

The **Visual | Markdown** switch in the editor bar shows the page as raw Markdown. Blocks the visual mode cannot show, like admonitions, tabs or math, appear there as locked "Markdown block" cards and are edited in Markdown mode. On a static export, switching back to the visual mode is not available; publishing uses the Markdown as it is.

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
