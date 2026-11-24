---
title: Install nodeps
description: Get the nodeps command from npm, PyPI, mise or a release binary.
order: 0
icon: download
byline: The nodeps maintainers
tags: [install, npm, pip, mise]
---

Every channel ships the same standalone binary; none of them needs Bun.

nodeps is in beta: every release is a prerelease like `1.0.0-beta.3`, so ask each channel for one explicitly.

## With npm

```sh
npm install --global @zedensix/nodeps@beta
```

Or without installing: `npx @zedensix/nodeps@beta dev`.

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

## Check it works

```sh
nodeps --help
```
