# Starter decks

Hand-crafted, ready-to-use decks that ship with OpenDeck so a new learner can get
going without building or importing anything. They are surfaced on the **Starter
decks** page (`/starter`), where a signed-in user can copy one into their own
ATproto repository with a single tap.

There are two kinds of starter deck, and both appear side by side in the catalog:

1. **Standalone JSON decks** live as `*.json` files in this folder. One file is one
   deck. Use these for a deck that needs its own full, richer card set (the German
   and Japanese decks are examples, following the extended survival syllabus).
2. **Generated decks** are built from a shared English master list plus a compact
   per-language translation table in [`../survival/`](../survival/). Every generated
   language teaches the same core survival set, so adding a language is one entry in
   a translation table. Start there if you just want to add a language.

Both are bundled at build time, so no server or database is involved.

The content follows **Paul Nation & David Crabbe's survival vocabulary lists**
(_A survival language learning syllabus for foreign travel_, Nation & Crabbe, 1991):
the high-frequency words and phrases that get a traveller through greetings,
shopping, numbers, directions and common problems. See the
[vocabulary lists](https://www.wgtn.ac.nz/lals/resources/paul-nations-resources/vocabulary-lists)
from Te Herenga Waka, Victoria University of Wellington.

## Standalone JSON format

Each deck object has:

- `id`: unique, stable slug used in the URL `/starter/<id>` (required).
- `title`: deck title shown in the catalog (required).
- `cards`: array of cards, each with `front` and `back` (required). A card may also
  have `hint`, `phonetic` (a pronunciation reading such as IPA, pinyin or rōmaji),
  `examples`, and `section` (a grouping used only for the on-screen preview, not
  stored on the imported cards).
- `summary`, `sourceLang`, `targetLang`, `targetLangLabel`, `flag`, `level`, `sort`,
  `verified`, `tags`, `attribution`: optional metadata that make the catalog nicer.

Example card:

```json
{
  "section": "Greetings & being polite",
  "front": "Good evening",
  "back": "Guten Abend"
}
```

For a language that uses a non-Latin script, put the native script in `back` and a
romanisation in `phonetic`, so learners meet the writing system from the start.

## Adding a generated language

1. Open the translation table that matches the script in [`../survival/`](../survival/)
   (`latin.ts`, `cyrillic-greek.ts`, `rtl.ts`, `indic.ts`, `cjk-thai.ts`).
2. Add one entry with a `code`, `label`, `flag`, `sort` and a `t` map of translations
   keyed by the master item ids in `master.ts`. A value is a plain string, or a
   `[script, romanisation]` pair for non-Latin scripts. Missing ids are skipped.
3. That is all. The deck appears automatically.

Please have a native or fluent speaker review new translations before submitting.
