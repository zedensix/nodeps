---
title: Content tabs
description: Alternative content side by side, linked across the page.
order: 3
icon: app-window
byline: The nodeps maintainers
tags: [markdown, tabs, mkdocs]
---

````md
=== "npm"

    ```sh
    npm install --global @zedensix/nodeps
    ```

=== "pip"

    ```sh
    pip install zedensix-nodeps
    ```
````

=== "npm"

    ```sh
    npm install --global @zedensix/nodeps
    ```

=== "pip"

    ```sh
    pip install zedensix-nodeps
    ```

Consecutive `===` blocks form one set; `===!` starts a new set right after another. Picking a tab selects the tab with the same label in every set of the page. Tabs work without JavaScript.
