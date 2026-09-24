# Translation checks

Which translations a native or fluent speaker has checked. The app, the [translations page](https://opendeck.space/translations) and the [dashboard](https://i18n.opendeck.space) read them from here: a starter pack counts as verified once every language it is available in has been checked.

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
    "issue": 42
  }
]
```

`name` is optional, `fluency` is `native` or `fluent`, and `commit` is the commit the translation was reviewed at, so the dashboard can show how often the file changed since.

These files are written by the [Translation review](../../../.github/workflows/translation-review.yaml) workflow when a maintainer approves a review issue. See [Checking translations](../../../CONTRIBUTING.md#checking-translations).
