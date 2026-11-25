---
title: Install nodeps
description: Get the nodeps command from npm, PyPI, mise or a release binary.
order: 0
icon: download
byline: The nodeps maintainers
tags: [install, cli, getting-started]
---

Every channel ships the same standalone binary; none of them needs Bun.

nodeps is in beta: every release is a prerelease like `1.0.0-beta.3`. npm installs it by default; pip and mise need to be asked for one.

## With npm

```sh
npm install --global @zedensix/nodeps
```

Or without installing: `npx @zedensix/nodeps dev`.

## With pip

```sh
pip install --pre zedensix-nodeps
```

## With mise

```sh
mise use github:zedensix/nodeps@1.0.0-beta.1
```

Pick the newest version from the [releases page](https://github.com/zedensix/nodeps/releases).

## As a binary

Download the file for your system from the [releases page](https://github.com/zedensix/nodeps/releases), check it against `SHA256SUMS`, and make it executable:

```sh
chmod +x nodeps-linux-x64
./nodeps-linux-x64 dev
```

## From source

With a clone of the repository and [mise](https://mise.jdx.dev):

```sh
mise install
mise run cli:install
```

It compiles the checkout into the same standalone binary and installs it as `~/.local/bin/nodeps`; pass another directory to install there instead, like `mise run cli:install /usr/local/bin`. `nodeps --version` then prints the commit it was built from. It warns when the directory is not on your `PATH`, or when another `nodeps` comes first. Run it again to update.

## Check it works

```sh
nodeps --help
```
