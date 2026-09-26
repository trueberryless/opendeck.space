# OpenDeck

[![Nuxt UI](https://img.shields.io/badge/Made%20with-Nuxt%20UI-00DC82?logo=nuxt&labelColor=020420)](https://ui.nuxt.com)
[![Netlify Status](https://api.netlify.com/api/v1/badges/b69ca24e-718a-4276-beae-e38d8732a73a/deploy-status)](https://app.netlify.com/projects/opendeck-space/deploys)

OpenDeck is a language learning flashcard application that gives users complete control over their information by storing all decks, cards, and study progress directly in a personal ATproto repository instead of a traditional app database. The platform is built with Nuxt and uses AirSpace to connect to the ATproto network, while relying on the FSRS algorithm to handle study scheduling.

The application offers a variety of practical features including secure login on any personal data server, the ability to create multimedia decks, and an installable web app design complete with local reminders and swipe gestures. Users can study offline and synchronize their progress later, maintain a personal follow graph with custom profiles, keep decks private using ATproto Spaces, and easily move their data in and out using supported import and export formats like CSV, JSON, Anki, and Quizlet.

## Features

Learn languages with spaced-repetition flashcards you own.

- Decks, cards and progress stored in your own ATproto repository, deletable in one click
- Starter packs on 21 topics in 20 languages
- Image and audio cards, imported from Anki, Quizlet, CSV or JSON and exported as JSON
- Two-way study mode with FSRS scheduling across all your decks
- Study tiers that reward a regular habit instead of streaks, with an optional themed profile, break reminders, an activity heatmap and study reminders
- Offline study that syncs when you reconnect
- Follow learners, discover their decks, then copy and like them
- Study challenges with friends and live quiz battles in the same room, peer to peer without a server
- Private profile by default with opt-in sharing
- Installable PWA with swipe gestures
- 40 interface languages with community translation reviews
- Full keyboard navigation, dark and light mode, and accent colors synced across devices

## Translations

OpenDeck is available in 40 languages. The English text is written by hand; the other languages, both the interface and the [starter packs](app/data/starter-packs), were first drafted with AI and are being checked by native speakers one by one. See which ones are done, missing or outdated on the [translation dashboard](https://i18n.opendeck.space) and on [opendeck.space/translations](https://opendeck.space/translations).

**Speak one of these languages?** You can help without writing code: [review a translation](https://opendeck.space/translations/review) string by string next to English, fix what sounds wrong and approve it. Everyone who checks a language is credited by name. See [Checking translations](CONTRIBUTING.md#checking-translations) for details.

## AI disclosure

OpenDeck is built by one developer with a lot of help from AI:

- Much of the code was written with the help of AI. A person reviews, tests and ships every change, and is responsible for it.
- The interface and starter pack translations were first drafted with AI. Until a native or fluent speaker has checked a language, the app marks it as an AI draft and asks speakers of that language for help. Checks are recorded in [`app/data/verifications`](app/data/verifications/README.md).

Contributions made with AI tools are welcome too, as long as they are disclosed in the pull request and reviewed by the person opening it.

## License

Licensed under the MIT license, Copyright © trueberryless.

See [LICENSE](https://github.com/trueberryless/opendeck.space/blob/main/LICENSE) for more information.

Made with ❤️
