# OpenDeck Starter Packs

Starter packs are built-in vocabulary collections. Users select their native and target languages on the `/discover` page to instantly add a ready-made deck to their ATproto repository. Packs use language-neutral keys mapped to specific translations to support any language pair.

## Directory Layout

Files live in `app/data/starter-packs/<pack_name>/`:

- `pack.json`: The manifest defining the pack `id`, `category` (the topic group it is listed under on `/discover`: `essentials`, `home`, `everyday`, `people`, `nature`, `work`, `leisure` or `society`), `sections` (display order), and `entries` (unique key, section, and optional note).
- `<bcp47>.json` (e.g., `en.json`, `ja.json`): The translation files.

> [!NOTE]
> Pack names, descriptions and section labels are localized separately under `packs.<id>` in UI files like `i18n/en.json`, and category labels under `discover.categories`.

## Language Files

Each language file maps `pack.json` keys to a structured object:

- `text`: The translated word or phrase (required).
- `reading`: Romanization for pronunciation (optional).
- `note`: A hint in this language, shown on the card when this language is the prompt side (optional). Without it, the English `note` from `pack.json` is shown.

## Adding a Language

1. Copy an existing translation file and rename it to the target `<bcp47>.json` tag.
2. Update the `language` property to match the tag.
3. Translate all `text` values and provide `reading` values where helpful.
4. Maintain the exact keys from `pack.json`. Missing keys will be skipped during deck generation.
5. Get a native or fluent speaker to review the translations before submitting.

## Conventions for topic packs

Topic packs (house, kitchen, garden, ...) are vocabulary lists for learners, so every language follows the same rules:

- Words are lowercase (except where the language capitalizes, e.g. German nouns) and have no final punctuation.
- Nouns carry their article wherever the article shows gender or noun class: `der Kühlschrank`, `la cuisine`, `el horno`, `het huis`, `το ψυγείο`. French and Italian add `(m)`/`(f)` after an elided or plural article (`l'évier (m)`); Spanish marks feminine nouns taking `el` (`el agua (f)`). Swedish, Danish and Norwegian (Bokmål) use the indefinite article (`en`/`ett`, `en`/`et`, `en`/`ei`/`et`), because their definite article is a suffix. English nouns take `the`, so learners can map it to the gendered articles. Languages without an article word (Japanese, Chinese, Korean, Russian, Polish, Turkish, Indonesian, and Hebrew, whose `ה` is a prefix) use the bare noun. Nouns for people give both forms where the language distinguishes them (`der Arzt / die Ärztin`).
- Verbs are in the citation form: `to cook` in English, the infinitive in most languages, with `att`/`at`/`å` in Swedish/Danish/Norwegian, the imperfective infinitive in Polish and Russian, the dictionary form in Japanese and Korean, and the 1st person singular present in Greek.
- A few nouns follow natural usage instead of the article rule: English days and months have no `the` (other languages give their gender where they have one: `der Montag`, `el lunes`, `janvier (m)`); nouns with no singular in Swedish, Danish and Norwegian keep their plural form (`pengar`); and unique things that only occur in the definite form there keep it (`jorden`, `polisen`).
- Where one English word has several translations that a learner must choose between, the entry gives them with a slash: paternal/maternal relatives (`en farmor / en mormor`, `奶奶 / 外婆`) and older/younger siblings (`兄 / 弟`).
- Where English has separate everyday words for related things (deer and roe deer, octopus, squid and cuttlefish), each gets its own card. A language without a separate word uses its most specific natural phrase (`die Meeresschildkröte`, `kara kurbağası`).
- When two cards in one language still have the same text, each gets a `note` in that language that tells them apart (`som man går på` and `i skelettet` for Swedish `ett ben`). `pack.json` notes are English and apply to every language without its own note, so add them only when every language needs the hint, and translate them into each language file.
- Portuguese is European Portuguese and Spanish is European Spanish, matching the survival pack.
- `reading` is given for Japanese (Hepburn with macrons), Chinese (pinyin with tone marks), Korean (Revised Romanization), Russian (transliteration with the stressed vowel marked), Greek and Hebrew, and includes the article.
- A pack shows a verified badge once a native or fluent speaker has checked every language it is available in. Checks are recorded in [`app/data/verifications`](../verifications/README.md), not in `pack.json`.
- Exception: the Russian and Polish verbs for passing and failing an exam (`сдать`, `провалить`, `zdać`, `oblać`) are perfective, because the imperfective means taking the exam.

## Conventions for the survival pack

The survival pack is based on Paul Nation's survival vocabulary lists and holds phrases a traveller says to strangers:

- Phrases start with a capital letter, keep their question mark and have no final full stop. Blanks are written ` ...` with a space before.
- Where a language distinguishes polite and familiar "you", the polite form is used (`Sie`, `vous`, `usted`, `Lei`, `u`, `pan / pani`, and the verb form without pronoun in Portuguese). Swedish, Danish and Norwegian use `du`, as today's speakers do.
- Where the speaker's or listener's gender changes the words, both forms are given with a slash (`Estoy enfermo / enferma`, `מה שלומך?` with `shlomkha / shlomekh`).
- Places and signs are bare nouns like in English (`Mercado`, not `El mercado`).
- `reading` follows the topic-pack rules, and Sorani Kurdish uses Kurdish Latin script (`sillaw`, `supas`).
