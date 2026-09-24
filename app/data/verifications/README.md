# Translation checks

Which translations a native or fluent speaker has checked. The app and the [translations page](https://opendeck.space/translations), which credits everyone who checked something, read them from here. A file counts as checked while every string in it is covered by a check, and a starter pack counts as verified once every language it is available in is checked.

There is one file per section and language, so checks of different languages or sections never touch the same file:

- `ui/<code>.json`: the interface, `i18n/<code>.json`
- `packs/<pack>/<code>.json`: a starter pack, `app/data/starter-packs/<pack>/<code>.json`

Each file is a list, one entry per person who checked it:

```json
[
  {
    "github": "octocat",
    "name": "Mona",
    "fluency": "native",
    "date": "2026-09-24",
    "commit": "0bcb481969f0739050b6437de538a3526bbe3351",
    "issue": 42,
    "strings": {
      "study.title": "1wigknn",
      "study.again": "17s8xhd"
    }
  }
]
```

`name` is optional, `fluency` is `native` or `fluent`, and `commit` is the commit the translation was reviewed at.

`strings` has a fingerprint for every string the person approved: a short hash of the English text and the translation (`stringFingerprint` in [`shared/translations.ts`](../../../shared/translations.ts)). A string is covered when any check has a fingerprint matching its current English text and translation. When English changes, a new string is added or a translation is edited, its fingerprint no longer matches, so only that string needs another look. The review page then offers just the new and changed strings, and approving them adds their fingerprints to the reviewer's entry. When the same person checks the file again, their fingerprints are merged into their existing entry.

The app doesn't load these files directly. At build time, the [`translation-status`](../../../modules/translation-status.ts) Nuxt module turns them into a small summary (who checked each file and how many strings are pending), and only the review page loads the full file it needs.

These files are written by the [Translation review](../../../.github/workflows/translation-review.yaml) workflow when a maintainer approves a review issue. See [Checking translations](../../../CONTRIBUTING.md#checking-translations).
