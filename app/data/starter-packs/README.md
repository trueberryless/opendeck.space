# Starter packs

Hand-crafted vocabulary packs that ship with OpenDeck so a learner can start
without building or importing anything. They appear on the **Starter packs**
page (`/starter`), where a signed-in user picks the language they know and the
one they want to learn, and adds a ready-made deck to their own ATproto
repository in one tap.

Each pack is language-neutral: it defines a set of keys once, and every language
provides a translation for the same keys. A deck is then built for any pair of
supported languages, using one language as the front of each card and the other
as the back.

## Folder layout

```
app/data/starter-packs/
  survival/
    pack.json     the language-neutral manifest
    en.json       English translations
    de.json       German translations
    ja.json       Japanese translations
```

## pack.json

```json
{
  "id": "survival",
  "verified": true,
  "sections": ["greetings", "numbers", "..."],
  "entries": [
    { "key": "hello", "section": "greetings" },
    { "key": "this_that", "section": "buying", "note": "pointing at goods" }
  ]
}
```

- `id` matches the folder name and the URL `/starter/<id>`.
- `sections` lists the section ids in display order. Their labels and the pack's
  name and description are localised in the UI translation files under
  `packs.<id>` (see `i18n/en.json`).
- `entries` is the ordered list of terms. Each has a stable `key`, a `section`,
  and an optional language-neutral `note`.

## Language files

One file per language, named by its BCP-47 tag. Each maps every entry key to a
structured value, never a bare array:

```json
{
  "language": "ja",
  "entries": {
    "hello": { "text": "こんにちは", "reading": "konnichi wa" },
    "water": { "text": "水", "reading": "mizu" }
  }
}
```

- `text` is the word or phrase in that language (required).
- `reading` is an optional romanisation shown as the pronunciation, so scripts
  like Japanese keep both the native form and a Latin reading.

## Adding a language

1. Copy an existing file (for example `de.json`) to `<bcp47>.json`.
2. Set `language` to the same tag and translate every `text` (add `reading`
   where a romanisation helps).
3. Keep the exact same keys as `pack.json`. A missing key is simply skipped when
   a deck is built, so complete files give the best decks.

Please have a native or fluent speaker review new translations before submitting.
