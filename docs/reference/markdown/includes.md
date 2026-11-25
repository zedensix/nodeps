---
title: Including files
description: Pull the content of another file into a page.
order: 7
icon: file-input
byline: The nodeps maintainers
tags: [markdown, mkdocs, code]
---

````md
```py
;--8<-- "examples/hello.py"
```
````

A line holding only `--8<-- "path"` is replaced by the file's content, inside code blocks too. Paths are looked up next to the page, then from the source directory, then from the project root. `"file.md:3:10"` includes lines 3 to 10.

Several files at once:

```md
;--8<--
glossary.md
links.md
;--8<--
```

A missing file is reported as a warning. To show a snippet line without including anything, start it with `;`: `;--8<-- "file.md"` renders as `--8<-- "file.md"`.
