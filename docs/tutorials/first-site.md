---
title: Build your first docs site
description: From an empty folder to a running documentation site with a homepage, sections and search.
order: 1
icon: rocket
byline: The nodeps maintainers
tags: [getting-started, config]
---

In this tutorial you will create a small documentation site for an imaginary project called Acme, run it locally and see your changes appear live. It takes about ten minutes.

## Before you start

You need [mise](https://mise.jdx.dev) and a copy of the nodeps repository. Install the toolchain from the repository root:

```sh
mise install
```

## 1. Create the config file

Create `acme.yaml` next to `docs.ts`:

```yaml title="acme.yaml"
title: Acme
description: Everything about Acme.
source: acme
output: acme-dist
```

## 2. Write the first page

Create `acme/index.md`:

```md title="acme/index.md"
---
icon: coffee
byline: The Acme team
---

# Welcome to Acme

Acme turns coffee into software.
```

## 3. Start the dev server

```sh
bun --watch docs.ts dev --config acme.yaml
```

Open `http://localhost:3000`. You should see your welcome page with the Acme title in the header, and a coffee cup next to it in the sidebar.

`icon` takes any [Lucide icon](https://lucide.dev/icons) name and `byline` names who wrote the page. Both are optional: remove them and the page renders without. Misspell the icon and the terminal tells you which page has it wrong.

## 4. Add a section

Create a `guides` folder with a page in it:

```md title="acme/guides/install.md"
---
title: Install Acme
icon: download
byline: The Acme team
order: 1
---

Run the installer:

    curl -fsSL https://acme.dev/install | sh
```

Save the file. The browser reloads on its own, and the header now shows two tabs: **Overview** and **Guides**. Each top-level folder is a section with its own sidebar.

## 5. Give the section an icon

Create `acme/guides/_folder.yaml`:

```yaml title="acme/guides/_folder.yaml"
title: Guides
icon: book-open
```

The tab now shows a book icon.

## 6. Turn on the homepage

Add a `home` section to `acme.yaml`:

```yaml title="acme.yaml" {6-11}
title: Acme
description: Everything about Acme.
source: acme
output: acme-dist

home:
  headline: Acme documentation
  tagline: Learn to turn coffee into software.
  actions:
    - label: Install Acme
      url: guides/install.md
```

The root page now opens with a hero, a call to action and a card for the Guides section listing its latest pages.

## 7. Search it

Press <kbd>/</kbd> and type `installer`. The search finds the sentence in your install page.

## What you built

You have a documentation site with a homepage, a section with an icon, live reload and search. From here:

- Make it yours with [Customize the theme](../how-to/customize-theme.md).
- Put it online with [Deploy behind nginx](../how-to/deploy/index.md).
