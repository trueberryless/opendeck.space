# Contributing

First off, thank you for considering contributing to `opendeck.space`. It's people like you that make the open source community such a great place to learn, inspire, and create.

## Development

Requires Node 22+ and pnpm.

```bash
pnpm install
pnpm dev
```

### Preview the production build locally

```bash
pnpm build && pnpm preview
```

### Checks

```bash
pnpm lint
pnpm format
pnpm knip
pnpm typecheck
pnpm build
```

## Contributing a starter pack

Starter packs are the hand-crafted vocabulary packs on the
[Starter packs](https://opendeck.space/starter) page. Each pack is a folder in
[`app/data/starter-packs/`](app/data/starter-packs/) with a language-neutral
`pack.json` manifest and one BCP-47 tagged file per language (`en.json`,
`de.json`, `ja.json`, ...). A learner can then build a deck from any supported
language to any other. Adding a language is a single translation file that
reuses the manifest's keys. See
[`app/data/starter-packs/README.md`](app/data/starter-packs/README.md) for the
format and a step-by-step guide. Please have a fluent speaker review new
translations before opening a PR.

## Translating the interface

UI strings live in [`i18n/en.json`](i18n/en.json) (the source) with one file per
language beside it, such as [`i18n/de.json`](i18n/de.json). To add a language,
copy `en.json`, translate the values, and register the locale in
[`app/utils/i18n.ts`](app/utils/i18n.ts) with its text direction.

Thank you for contributing! ❤️
