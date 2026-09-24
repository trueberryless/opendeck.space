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

Most translations, of both the interface and the starter packs, were first drafted with AI. They are usually close, but only a native or fluent speaker can tell whether they sound natural. The app is honest about this: languages that nobody has checked yet show a small notice that links to [opendeck.space/translations](https://opendeck.space/translations).

### For translators

Open the [review page](https://opendeck.space/translations/review), pick your language and a file (the interface or a starter pack), and read it string by string next to English. Fix anything that sounds wrong right there. Each section has to stay on screen for a moment before you can confirm it, and once every section is confirmed you can approve the file. **Approve** opens a prefilled [🌐 Translation review](https://github.com/trueberryless/opendeck.space/issues/new?template=2_translation_check.yaml) issue, and **Only send my changes** opens a [✏️ Translation fix](https://github.com/trueberryless/opendeck.space/issues/new?template=3_translation_fix.yaml) issue that suggests your fixes without approving the file. Your progress is saved in the browser, so you can take breaks.

The [translation dashboard](https://i18n.opendeck.space) (built with [Lunaria](https://lunaria.dev)) lists every language with its missing and outdated keys and who checked it. A file can be complete and still be an unchecked AI draft, which is why checks are tracked separately.

### For maintainers

- **How a review reaches the repo:** the review page writes a JSON block into the issue with the language, the file, the commit it was reviewed at, the changed strings and, for an approval, the reviewer's fluency. GitHub issue forms can only prefill text fields, which is why this is a JSON text field and not dropdowns.
- **Approving a review:** add the `translation-approved` label to the issue. The [Translation review](.github/workflows/translation-review.yaml) workflow validates it (keys exist in English, placeholders and plural forms match, nothing changed on `main` since the review) and applies the changes in place, without reformatting the file. For an approval it also adds an entry (GitHub username, optional name, fluency, date, the reviewed commit and the issue number) to [`app/data/verifications`](app/data/verifications/README.md). If something is wrong, the workflow comments on the issue instead. Fix issues without a JSON block have to be applied by hand.
- **One pull request per language:** all approved reviews of a language collect in the same `translations/<code>` pull request, which lists every check, credits each translator as co-author and closes all their issues. Each review gets a comment with a before/after table of its changes. Reviews of different languages never touch the same files, so these pull requests don't conflict.
- **Verified packs:** a starter pack shows a verified badge once every language it is available in has been checked, and the pack page shows which of the two chosen languages are checked. There is no flag to keep in sync.
- **When a checked file changes later,** the check stays on record, and the dashboard shows how many commits have touched the file since then, so it's easy to see which languages need another look.
- **Check files:** `pnpm translations:check` makes sure every file in `app/data/verifications` belongs to an existing translation and is well formed.
- **Lunaria tracking:** a translation counts as outdated when English changed in a later commit than the translation. Commits that change English without needing new translations (typo fixes, formatting) can include `lunaria-ignore` or `fix typo` in the message, or a `@lunaria-ignore:<path>` line in the body. Preview the dashboard locally with `pnpm lunaria:build && pnpm lunaria:preview`, which serves it on port 4321 so it doesn't clash with the app on port 3000.
- **Deployment:** Netlify builds the dashboard with `pnpm lunaria:build` and serves `dist/lunaria` at `i18n.opendeck.space`.

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
