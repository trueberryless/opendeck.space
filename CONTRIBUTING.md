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

## Contributing a starter deck

Starter decks are the hand-crafted, ready-to-use language decks on the
[Starter decks](https://opendeck.space/starter) page. Each one is a single JSON
file in [`app/data/starter-decks/`](app/data/starter-decks/) — adding a language
is a drop-in file with no code changes. See
[`app/data/starter-decks/README.md`](app/data/starter-decks/README.md) for the
format and a step-by-step guide. Please have a fluent speaker review new
translations before opening a PR.

Thank you for contributing! ❤️
