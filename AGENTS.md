# Working on OpenDeck

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [tests/README.md](tests/README.md) first.

- Before you call a change done, run `pnpm check:all` and `pnpm test:e2e`. Both must pass.
- Add or update tests with every change. A bug fix needs a test that fails without the fix.
- Do not lower a coverage threshold or skip a test to get a green run. If a test is wrong, fix the test and say why.
- Do not add code comments.
- Keep the UI text in `i18n/en.json` and run `pnpm i18n:check` after changing it.
