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

Starter packs are the hand-crafted vocabulary packs on the [Discover](https://opendeck.space/discover) page. Each pack is a folder in [`app/data/starter-packs/`](app/data/starter-packs/) with a language-neutral `pack.json` manifest and one BCP-47 tagged file per language (`en.json`, `de.json`, `ja.json`, ...). A learner can then build a deck from any supported language to any other. Adding a language is a single translation file that reuses the manifest's keys. See [`app/data/starter-packs/README.md`](app/data/starter-packs/README.md) for the format and a step-by-step guide. Please have a fluent speaker review new translations before opening a PR, or say in the PR that they are an AI draft so they can be marked as unchecked (see [Checking translations](#checking-translations)).

## Translating the interface

UI strings live in [`i18n/en.json`](i18n/en.json) (the source) with one file per language beside it, such as [`i18n/de.json`](i18n/de.json). To add a language, copy `en.json`, translate the values, and register the locale in [`app/utils/i18n.ts`](app/utils/i18n.ts) with its text direction.

Messages with a count use the language's [CLDR plural categories](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html), separated by `|` in the order zero, one, two, few, many, other, keeping only the categories the language has. English has two forms (`{count} card | {count} cards`), Russian four, Arabic six and Japanese one. A message that reads the same for every count can have a single form. `pnpm i18n:check` verifies the number of forms and that every language has the same keys as `en.json`.

## Checking translations

Most translations, of both the interface and the starter packs, were first drafted with AI (Claude). They are usually close, but only a native or fluent speaker can tell whether they sound natural. The app is honest about this: languages that nobody has checked yet show a small notice that links to [opendeck.space/translations](https://opendeck.space/translations).

### For translators

1. Read through a translation: switch OpenDeck to your language in Settings, or compare the files with English:
   - interface: `i18n/<code>.json` against [`i18n/en.json`](i18n/en.json)
   - starter packs: `app/data/starter-packs/<pack>/<code>.json` against the pack's `en.json`
2. Fix what's wrong, either in a pull request or by listing it in the issue in the next step.
3. Open a [🌐 Translation check](https://github.com/trueberryless/opendeck.space/issues/new?template=2_translation_check.yaml) issue: choose the language, what you checked (the interface and/or specific packs) and how well you speak it. You can add a name to be credited with.

Found a single wrong word but don't have time to check everything? Open a [✏️ Translation fix](https://github.com/trueberryless/opendeck.space/issues/new?template=3_translation_fix.yaml) issue instead.

The [translation dashboard](https://i18n.opendeck.space) (built with [Lunaria](https://lunaria.dev)) lists every language with its missing and outdated keys and who checked it. A file can be complete and still be an unchecked AI draft, which is why checks are tracked separately.

### For maintainers

- **Approving a check:** make sure any corrections are applied, then add the `translation-approved` label to the issue. The [Translation check](.github/workflows/translation-check.yaml) workflow validates the issue, appends an entry to [`app/data/translation-verifications.json`](app/data/translation-verifications.json) (GitHub username, optional name, fluency, date, the commit it was checked at, and the issue number) and opens a pull request that credits the translator as co-author and closes the issue. If the issue is invalid, the workflow comments on it instead. Merge the pull request to publish the credit.
- **When a checked file changes later,** the check stays on record, and the dashboard shows how many commits have touched the file since then, so it's easy to see which languages need another look.
- **New languages or packs:** run `pnpm translations:sync` to update the language and pack lists in the issue forms. `pnpm check:all` fails while they are out of date.
- **Lunaria tracking:** a translation counts as outdated when English changed in a later commit than the translation. Commits that change English without needing new translations (typo fixes, formatting) can include `lunaria-ignore` or `fix typo` in the message, or a `@lunaria-ignore:<path>` line in the body. Preview the dashboard locally with `pnpm lunaria:build && pnpm lunaria:preview`.
- **Deployment:** the [i18n dashboard](.github/workflows/i18n-dashboard.yaml) workflow builds the dashboard on every push to `main` that touches translations and deploys it to GitHub Pages at `i18n.opendeck.space`.

## Publishing lexicons

The `space.opendeck.*` record schemas are defined in [`shared/atproto/lexicons.ts`](shared/atproto/lexicons.ts) and published to the account that `_lexicon.opendeck.space` points to. After changing them:

```bash
export AUTHORITY_IDENTITY=opendeck.space
export AIRSPACE_APP_PASSWORD=<app password of that account>
pnpm lexicons:plan
pnpm lexicons:publish
```

`lexicons:plan` builds the JSON into `lexicons/` and shows what would be created or updated without writing anything; it does not need the app password. `lexicons:publish` writes the changes.

## Push reminders

Study reminders are Web Push notifications sent by two Netlify Functions in [`netlify/functions`](netlify/functions): `push-subscribe` stores a device's push subscription in Netlify Blobs, and `push-reminders` runs every hour, reads each user's reminder hour and days from their public `space.opendeck.profile` record and sends the reminders that are due. They need three environment variables on Netlify:

```bash
npx web-push generate-vapid-keys
```

- `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`: the key pair printed by the command above.
- `VAPID_SUBJECT`: a contact URL for push services, e.g. `mailto:you@example.com`.

The functions only run on Netlify (or `netlify dev`). Under `pnpm dev` push is unavailable, and the app falls back to reminders that only fire while it is open.

Thank you for contributing! ❤️
