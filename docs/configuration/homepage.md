---
title: Homepage
description: The hero, the Diátaxis compass and the badge next to page titles.
order: 6
icon: house
byline: The nodeps maintainers
tags: [config, home, diataxis]
---

```yaml title="docs.yaml"
home:
  headline: Acme documentation
  tagline: Learn to turn coffee into software.
  actions:
    - label: Get started
      url: tutorials/first-steps.md
  latest: 3
diataxis:
  badge: true
```

With `home`, the root page renders as a homepage.

| Key              | Default       | Description                                                                                     |
| ---------------- | ------------- | ----------------------------------------------------------------------------------------------- |
| `home.headline`  | `title`       | Hero heading                                                                                    |
| `home.tagline`   | `description` | Text under the heading                                                                          |
| `home.actions`   |               | Buttons, each with a `label` and a `url`; the first is primary. A `.md` url points to that page |
| `home.latest`    | `3`           | Most recently updated pages shown per section, `0` to hide                                      |
| `diataxis.badge` | `true`        | Shows the kind of each page next to its title                                                   |

## Page kinds

Each page has at most one kind: `tutorials`, `how-to`, `reference` or `explanation` (`tutorial` and `howto` also work). The first of these that sets one wins:

1. The page's `diataxis` frontmatter.
2. Its file name: `deploy.howto.md`, `why.explanation.md`, `api.reference.md`, `intro.tutorial.md`.
3. The nearest folder above it whose [`_folder.yaml`](./navigation.md#folderyaml) sets `diataxis`, with or without `nav`.

An unknown value is a build warning naming the page, and the page falls back to the next source. The kind drives the badge next to the title and where the page appears on the homepage.

## Layout

1. The hero: `headline`, `tagline` and `actions`.
2. The compass: one card per kind that has at least one page, in the order tutorials, how-to, explanation, reference. A card lists every page of its kind, whatever section holds it. When exactly one section has that kind, the card takes that section's title, icon and description; otherwise it is named after the kind. One kind is enough for a compass; the missing ones leave no gap.
3. One card for each other section that has no kind of its own. A section's kind is its `_folder.yaml` one, or with `nav` the kind all its pages share. The root section (top-level pages, the "Home" tab with `nav`) gets no card.
4. The root page's Markdown, without its `# title`: the hero replaces it. A root page holding only a title adds nothing.

Each card's "Latest" list shows a page once, even when `nav` lists it twice.
