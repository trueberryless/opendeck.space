# Tests

Three layers, each answering a different question.

| Layer       | Runner                      | Where        | Question it answers                                                               |
| ----------- | --------------------------- | ------------ | --------------------------------------------------------------------------------- |
| Unit        | Vitest (`node`)             | `tests/unit` | Does this pure function, parser or data file behave the same?                     |
| Integration | Vitest (`nuxt` environment) | `tests/nuxt` | Do composables, plugins, middleware and components work inside the real Nuxt app? |
| End to end  | Playwright                  | `tests/e2e`  | Can a person still do this in a browser against the production build?             |

## Commands

```bash
pnpm test              # unit and integration
pnpm test:unit
pnpm test:nuxt
pnpm test:coverage     # same, with coverage and thresholds
pnpm test:watch
pnpm test:e2e          # builds first, then runs Playwright
pnpm exec playwright install chromium   # once
pnpm check:all         # every static check plus the coverage run
```

## What CI runs

`.github/workflows/ci.yaml` runs four jobs on every pull request, on `main` and in the merge queue. The `CI` job at the end needs all of them, so it is the only one to require in branch protection.

- Static checks: oxlint, oxfmt, knip, typecheck (including `tests/`), `i18n:check`, `translations:check`, `credits:check` and a production build.
- Unit and integration tests with coverage. The summary is on the run page and the HTML report is an artifact.
- End-to-end tests against the production build. Traces and screenshots are uploaded when they fail.

## Coverage

Coverage is measured over the logic layers: `app/utils`, `app/composables`, `app/plugins`, `app/middleware`, `shared`, `server` and `netlify`. The thresholds in `vitest.config.ts` sit just below the current numbers, so a drop fails the run. Raise them when coverage grows, never lower them to make a change pass.

Vue components and pages are not in the number. Key components have tests in `tests/nuxt/components.test.ts`, and pages are covered by the end-to-end tests.

## Conventions

- One file per module or feature, named after it. Test names describe behaviour in the present tense.
- No network. Unit and integration tests use the fake ATproto client in `tests/support/airspace.ts` and stub `fetch` or `$fetch`. End-to-end tests abort every request that does not go to localhost.
- No timeouts. Wait for a condition with `vi.waitFor` or a Playwright assertion.
- Every bug fix comes with a test that fails without the fix.
- Playwright uses role and label locators and page objects from `tests/e2e/pages`.

## Helpers

- `tests/support/session.ts`: `signIn()` puts a fake signed-in ATproto client into the app and resets it after each test.
- `tests/support/airspace.ts`: in-memory collections, vault, batches and blobs with `vi.fn` spies.
- `tests/support/nuxt.ts`: `inSetup(fn)` runs a composable inside a component setup, for the ones that need `useI18n`.
- `tests/e2e/seed.ts`: `signInWith({ decks })` signs a browser in without ATproto. It remembers an identity, forces offline mode and fills the IndexedDB cache, so study, decks, profile and settings run against real pages.

## Adding a test

1. Pure function or data check: add a file to `tests/unit`.
2. Anything that calls `useX()` composables or auto-imports: add it to `tests/nuxt` and use `signIn()`.
3. A user journey: add a spec to `tests/e2e`. Extend `tests/e2e/data.ts` if it needs different decks.
