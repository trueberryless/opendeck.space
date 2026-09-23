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
pnpm check:all
pnpm build
```

`check:all` runs formatting, lint, typecheck, knip and `pnpm i18n:check`.

## Contributing a starter pack

Starter packs are the hand-crafted vocabulary packs on the [Discover](https://opendeck.space/discover) page. Each pack is a folder in [`app/data/starter-packs/`](app/data/starter-packs/) with a language-neutral `pack.json` manifest and one BCP-47 tagged file per language (`en.json`, `de.json`, `ja.json`, ...). A learner can then build a deck from any supported language to any other. Adding a language is a single translation file that reuses the manifest's keys. See [`app/data/starter-packs/README.md`](app/data/starter-packs/README.md) for the format and a step-by-step guide. Please have a fluent speaker review new translations before opening a PR.

## Translating the interface

UI strings live in [`i18n/en.json`](i18n/en.json) (the source) with one file per language beside it, such as [`i18n/de.json`](i18n/de.json). To add a language, copy `en.json`, translate the values, and register the locale in [`app/utils/i18n.ts`](app/utils/i18n.ts) with its text direction.

Messages with a count use the language's [CLDR plural categories](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html), separated by `|` in the order zero, one, two, few, many, other, keeping only the categories the language has. English has two forms (`{count} card | {count} cards`), Russian four, Arabic six and Japanese one. A message that reads the same for every count can have a single form. `pnpm i18n:check` verifies the number of forms and that every language has the same keys as `en.json`.

## Publishing lexicons

The `space.opendeck.*` record schemas are defined in [`shared/atproto/lexicons.ts`](shared/atproto/lexicons.ts) and published to the account that `_lexicon.opendeck.space` points to. After changing them:

```bash
export AUTHORITY_IDENTITY=opendeck.space
export AIRSPACE_APP_PASSWORD=<app password of that account>
pnpm lexicons:plan
pnpm lexicons:publish
```

`lexicons:plan` builds the JSON into `lexicons/` and shows what would be created or updated without writing anything; it does not need the app password. `lexicons:publish` writes the changes.

Thank you for contributing! ❤️
