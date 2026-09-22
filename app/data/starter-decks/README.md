# Starter decks

Hand-crafted, ready-to-use decks that ship with OpenDeck so a new learner can get
going without building or importing anything. Each `*.json` file in this folder is
one deck. They are bundled at build time (via `import.meta.glob`) and surfaced on
the **Starter decks** page (`/starter`), where a signed-in user can copy one into
their own ATproto repository with a single tap.

The current decks follow **Paul Nation & David Crabbe's survival vocabulary lists**
(_A survival language learning syllabus for foreign travel_, Nation & Crabbe, 1991) —
roughly 120 high-frequency words and phrases that get a traveller through greetings,
shopping, numbers, directions and common problems. See the
[vocabulary lists](https://www.wgtn.ac.nz/lals/resources/paul-nations-resources/vocabulary-lists)
from Te Herenga Waka — Victoria University of Wellington.

## File format

```jsonc
{
  "id": "survival-de", // unique, stable slug (used in the URL /starter/<id>)
  "title": "German survival vocabulary",
  "summary": "Short description shown on the card and detail page.",
  "sourceLang": "en", // BCP-47 code of the language the learner knows
  "targetLang": "de", // BCP-47 code of the language being learned
  "targetLangLabel": "German", // human-readable name of the target language
  "flag": "🇩🇪", // emoji flag shown in the catalog (optional)
  "level": "beginner", // optional badge
  "sort": 10, // optional; lower sorts first in the catalog
  "tags": ["survival", "travel", "beginner"],
  "attribution": "Where the content came from (optional but encouraged).",
  "cards": [
    {
      "section": "Greetings & being polite", // optional grouping for the preview
      "front": "Good evening", // the prompt (usually English)
      "back": "Guten Abend", // the answer in the target language
      "hint": "Reply to \"How are you?\"", // optional
      "phonetic": "", // optional pronunciation (IPA, pinyin, rōmaji…)
      "examples": [], // optional example sentences
    },
  ],
}
```

Only `id`, `title` and `cards` (with `front` + `back`) are strictly required; the
rest is metadata that makes the catalog nicer. `section` is used purely for the
on-screen preview grouping — it is not stored on the imported cards.

## Adding a language

1. Copy an existing file (e.g. `survival-german.json`) to `survival-<lang>.json`.
2. Give it a unique `id`, set `targetLang` / `targetLangLabel` / `flag`.
3. Translate each `back` value. Keep the English `front` values the same so every
   survival deck teaches the same set of phrases. Drop a card if there is no good
   equivalent rather than inventing one.
4. For languages that use a non-Latin script, put the native script in `back` and
   (optionally) a romanisation in `phonetic`.
5. That's it — no code changes are needed. The deck appears automatically.

Please have a native or fluent speaker review new translations before submitting.
