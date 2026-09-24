# OpenDeck

[![Nuxt UI](https://img.shields.io/badge/Made%20with-Nuxt%20UI-00DC82?logo=nuxt&labelColor=020420)](https://ui.nuxt.com)
[![Netlify Status](https://api.netlify.com/api/v1/badges/b69ca24e-718a-4276-beae-e38d8732a73a/deploy-status)](https://app.netlify.com/projects/opendeck-space/deploys)

OpenDeck is a language learning flashcard application that gives users complete control over their information by storing all decks, cards, and study progress directly in a personal ATproto repository instead of a traditional app database. The platform is built with Nuxt and uses AirSpace to connect to the ATproto network, while relying on the FSRS algorithm to handle study scheduling.

The application offers a variety of practical features including secure login on any personal data server, the ability to create multimedia decks, and an installable web app design complete with local reminders and swipe gestures. Users can study offline and synchronize their progress later, maintain a personal follow graph with custom profiles, keep decks private using ATproto Spaces, and easily move their data in and out using supported import and export formats like CSV, JSON, Anki, and Quizlet.

## Translations

OpenDeck is available in 40 languages. The English text is written by hand; the other languages, both the interface and the [starter packs](app/data/starter-packs), were first drafted with AI and are being checked by native speakers one by one. See which ones are done, missing or outdated on the [translation dashboard](https://i18n.opendeck.space) and on [opendeck.space/translations](https://opendeck.space/translations).

**Speak one of these languages?** You can help without writing code: read through a translation and [tell us it's checked](https://github.com/trueberryless/opendeck.space/issues/new?template=2_translation_check.yaml) or [report a wrong translation](https://github.com/trueberryless/opendeck.space/issues/new?template=3_translation_fix.yaml). Everyone who checks a language is credited by name. See [Checking translations](CONTRIBUTING.md#checking-translations) for details.

## AI disclosure

OpenDeck is built by one developer with a lot of help from [Claude](https://claude.com/claude-code), an AI assistant made by Anthropic:

- **Code:** much of the code was written together with Claude. A person reviews, tests and ships every change, and is responsible for it.
- **Translations:** the interface and starter pack translations were first drafted with Claude. Until a native or fluent speaker has checked a language, the app marks it as an AI draft and asks speakers of that language for help. Checks are recorded in [`app/data/translation-verifications.json`](app/data/translation-verifications.json).

Contributions made with AI tools are welcome too, as long as they are disclosed in the pull request and reviewed by the person opening it.

## License

Licensed under the MIT license, Copyright © trueberryless.

See [LICENSE](https://github.com/trueberryless/opendeck.space/blob/main/LICENSE) for more information.

Made with ❤️
