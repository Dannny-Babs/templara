# @templara/cli

Command-line entrypoint for future Templara rendering and validation workflows.

The CLI is currently a scaffold. It is packaged separately so command-line rendering, validation, migration, and project inspection can evolve without bloating the browser editor package.

## Install

```sh
pnpm add -D @templara/cli
```

## Usage

```sh
templara
```

Current output:

```txt
templara CLI scaffold
```

Planned commands:

- validate a template bundle
- migrate saved template JSON
- render test fixtures
- inspect package/project metadata
