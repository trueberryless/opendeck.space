# OpenDeck Starter Packs

Starter packs are built-in vocabulary collections. Users select their native and target languages on the `/discover` page to instantly add a ready-made deck to their ATproto repository. Packs use language-neutral keys mapped to specific translations to support any language pair.

## Directory Layout

Files live in `app/data/starter-packs/<pack_name>/`:

- `pack.json`: The manifest defining the pack `id`, `verified` status, `sections` (display order), and `entries` (unique key, section, and optional note).
- `<bcp47>.json` (e.g., `en.json`, `ja.json`): The translation files.

> [!NOTE]
> Pack descriptions and section labels are localized separately in UI files like `i18n/en.json`.

## Language Files

Each language file maps `pack.json` keys to a structured object:

- `text`: The translated word or phrase (required).
- `reading`: Romanization for pronunciation (optional).

## Adding a Language

1. Copy an existing translation file and rename it to the target `<bcp47>.json` tag.
2. Update the `language` property to match the tag.
3. Translate all `text` values and provide `reading` values where helpful.
4. Maintain the exact keys from `pack.json`. Missing keys will be skipped during deck generation.
5. Get a native or fluent speaker to review the translations before submitting.
