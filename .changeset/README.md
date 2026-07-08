# Changesets

This monorepo uses [Changesets](https://github.com/changesets/changesets) to version and publish `@templara/*` packages.

When you change a publishable package, add a changeset:

```sh
pnpm changeset
```

Before release, apply version bumps and changelogs:

```sh
pnpm version-packages
```

Publish to npm (runs build first):

```sh
pnpm release
```
