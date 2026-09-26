# Credits

People who helped build OpenDeck get their role shown on their OpenDeck profile, with a badge and a small effect on their profile card. The roles live in `credits.json` and change through pull requests like any other file.

```json
{
  "people": [
    { "did": "did:plc:abc123", "github": "octocat", "roles": ["maintainer"] },
    { "did": "did:plc:def456", "roles": [{ "role": "tester", "note": "Mobile" }] }
  ]
}
```

- `did`: the person's ATproto DID. Handles can change, DIDs cannot.
- `github` (optional): their GitHub username.
- `roles` (optional): `creator`, `maintainer`, `contributor`, `translator`, `designer` or `tester`. A role can be an object with a short English `note`, such as `{ "role": "tester", "note": "Mobile" }`.

Leave `roles` out for people whose roles all come automatically, such as a translator matched by `github`.

A profile shows every role as a badge. Its card takes the effect of the first role in the list above, so a maintainer who also translates looks like a maintainer.

## Automatic credits

- **Contributors:** the pull request template asks for an ATproto handle. When a pull request is merged, the [Credits](../../../.github/workflows/credits.yaml) workflow resolves the handle to its DID, checks that the DID claims the handle back, and adds the author as a contributor in a `credits` pull request. Authors already listed by `github` are credited without a handle.
- **Translators:** the review page fills in the handle of the signed-in reviewer, and the [Translation review](../../../.github/workflows/translation-review.yaml) workflow stores the resolved `did` in their [translation check](../verifications/README.md). Anyone with a check gets the translator role, matched by `did`, or by `github` for people listed here.

`pnpm credits:check` validates the file.
