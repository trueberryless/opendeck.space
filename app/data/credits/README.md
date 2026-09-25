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

- `did`: the person's ATproto DID. Handles can change, DIDs cannot. Find it on [pdsls.dev](https://pdsls.dev) or in OpenDeck's settings under Account.
- `github` (optional): their GitHub username. Anyone who checked a translation in [`app/data/verifications`](../verifications/README.md) gets the translator role automatically, with the languages they checked.
- `roles`: `creator`, `maintainer`, `contributor`, `translator`, `designer` or `tester`. A role can be an object with a short English `note`, such as `{ "role": "tester", "note": "Mobile" }`.

A profile shows every role as a badge. Its card takes the effect of the first role in the list above, so a maintainer who also translates looks like a maintainer.

`pnpm credits:check` validates the file.
