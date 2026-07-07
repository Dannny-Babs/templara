# @templara/assets

Shared asset helpers for Templara packages.

This package is intentionally small right now. It exists so fonts, images, and future asset resolution helpers have a stable package boundary instead of being coupled to Studio or the editor.

## Install

```sh
pnpm add @templara/assets
```

## Current Scope

- asset-related shared types/helpers
- future font and image asset utilities
- future binary asset persistence adapters

Runtime document rendering does not require this package unless an embedding app opts into these helpers.
