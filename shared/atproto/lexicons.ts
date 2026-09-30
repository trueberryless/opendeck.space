import { defineLexicons, field, space } from 'airspace/lexicon'

export const lexicons = defineLexicons('space.opendeck', {
  deck: {
    description: 'A deck of language-learning flashcards.',
    title: field.text({ max: 200 }),
    summary: field.text({ max: 2000 }).optional().describe('A short description of the deck.'),
    sourceLang: field.text({ max: 20 }).optional().describe('BCP-47 language the learner already knows.'),
    targetLang: field.text({ max: 20 }).optional().describe('BCP-47 language being learned.'),
    readingMode: field
      .enum(['off', 'answer', 'prompt', 'hint'])
      .optional()
      .describe('Where to show a card reading while studying; absent means with the answer.'),
    shortTermIntervals: field
      .enum(['auto', 'quick', 'balanced', 'relaxed', 'spaced'])
      .optional()
      .describe('Short-term intervals preset for new and forgotten cards; absent means the owner default.'),
    tags: field.list(field.text({ max: 64 }), { max: 20 }).optional(),
    copiedFrom: field.text({ format: 'at-uri' }).optional().describe('AT-URI of the deck this was copied from.'),
    createdAt: field.datetime(),
    updatedAt: field.datetime().optional(),
  },

  card: {
    description: 'A flashcard belonging to a deck.',
    deck: field.text({ max: 64 }).describe('Record key (rkey) of the owning deck in the same repo.'),
    front: field.text({ max: 2000 }),
    back: field.text({ max: 2000 }),
    hint: field.text({ max: 1000 }).optional(),
    examples: field.list(field.text({ max: 1000 }), { max: 20 }).optional(),
    frontReading: field.text({ max: 500 }).optional().describe('Reading of the front, e.g. IPA, pinyin or rōmaji.'),
    backReading: field.text({ max: 500 }).optional().describe('Reading of the back, e.g. IPA, pinyin or rōmaji.'),
    image: field.image().optional().describe('Optional image blob shown on the card.'),
    imageAlt: field.text({ max: 1000 }).optional().describe('Alt text for the image (accessibility).'),
    audio: field
      .blob({ accept: ['audio/*'] })
      .optional()
      .describe('Optional audio blob (pronunciation).'),
    order: field.number().optional(),
    createdAt: field.datetime(),
    updatedAt: field.datetime().optional(),
  },

  progress: {
    description: 'FSRS scheduling state for a single card.',
    card: field.text({ format: 'at-uri' }).describe('AT-URI of the card this tracks.'),
    deck: field.text({ max: 64 }).optional().describe('Record key (rkey) of the owning deck.'),
    dueAt: field.datetime().describe('When the card should be shown next.'),
    stability: field.text().describe('FSRS stability (float stored as string).'),
    difficulty: field.text().describe('FSRS difficulty (float stored as string).'),
    repetitions: field.number().describe('Number of times the card was rated.'),
    lapses: field.number().describe('Number of times a learned card was forgotten.'),
    shortTermStep: field
      .number()
      .optional()
      .describe('Index into the short-term intervals while learning or relearning; absent otherwise.'),
    direction: field
      .enum(['forward', 'reverse'])
      .optional()
      .describe('Study direction this schedule tracks; absent means forward (front to back).'),
    state: field.enum(['new', 'learning', 'review', 'relearning']),
    lastRating: field.enum(['again', 'hard', 'good', 'easy']).optional(),
    lastReviewedAt: field.datetime(),
  },

  session: {
    description: 'A finished study session. Written once; the source of study history and activity stats.',
    deck: field.text({ max: 64 }).optional().describe('Record key (rkey) of the studied deck.'),
    direction: field
      .enum(['forward', 'reverse'])
      .optional()
      .describe('Study direction; absent means forward (front to back).'),
    startedAt: field.datetime(),
    endedAt: field.datetime(),
    activeSeconds: field.number().describe('Time spent on cards, with idle gaps capped.'),
    repetitions: field.number(),
    again: field.number(),
    hard: field.number(),
    good: field.number(),
    easy: field.number(),
    newCards: field.number().describe('Cards rated for the first time in this direction.'),
  },

  like: {
    description: 'A like of a deck.',
    subject: field.ref('deck').describe('strongRef to the liked deck.'),
    createdAt: field.datetime(),
  },

  follow: {
    description: 'A follow of another OpenDeck user.',
    subject: field.text({ format: 'did' }).describe('DID of the followed account.'),
    createdAt: field.datetime(),
  },

  challenge: {
    description: 'A study challenge between friends. Participants link to it with a challengeEntry.',
    title: field.text({ max: 100 }),
    kind: field
      .enum(['studyDays', 'everyDay'])
      .describe('studyDays: most study days wins. everyDay: study every day, the last one standing wins.'),
    startsAt: field.datetime(),
    endsAt: field.datetime(),
    createdAt: field.datetime(),
  },

  challengeEntry: {
    description: 'Taking part in a challenge, with the days studied while it runs.',
    challenge: field.text({ format: 'at-uri' }).describe('AT-URI of the challenge.'),
    days: field
      .list(field.text({ max: 10 }), { max: 400 })
      .describe('Local dates (YYYY-MM-DD) with at least one study session during the challenge.'),
    createdAt: field.datetime(),
    updatedAt: field.datetime().optional(),
  },

  signal: {
    description: 'An encrypted WebRTC offer or answer to join a live battle. Deleted once the peers connect.',
    subject: field
      .text({ format: 'at-uri' })
      .describe('The battle a guest offers to join, or the guest signal a host answers.'),
    payload: field.text({ max: 30000 }).describe('AES-GCM ciphertext, readable only with the key in the invite link.'),
    createdAt: field.datetime(),
  },

  profile: {
    key: 'self',
    description: 'OpenDeck profile and synced preferences.',
    bio: field.text({ max: 2000 }).optional(),
    accentColor: field.text({ max: 9 }).optional().describe('Hex accent color, e.g. #3b82f6.'),
    uiLanguage: field.text({ max: 20 }).optional().describe('BCP-47 language tag for the OpenDeck interface.'),
    defaultVisibility: field.enum(['public', 'private']).optional(),
    shortTermIntervals: field
      .enum(['auto', 'quick', 'balanced', 'relaxed', 'spaced'])
      .optional()
      .describe('Default short-term intervals preset; absent means auto.'),
    showActivityOnProfile: field.boolean().optional(),
    showProgressOnProfile: field.boolean().optional(),
    showDecksOnProfile: field.boolean().optional(),
    showFollowsOnProfile: field.boolean().optional(),
    reminderEnabled: field.boolean().optional(),
    reminderHour: field
      .number({ min: 0, max: 23 })
      .optional()
      .describe('Local hour (0-23) of the study reminder; absent means 19.'),
    reminderDays: field
      .list(field.number({ min: 0, max: 6 }), { max: 7 })
      .optional()
      .describe('Weekdays 0-6 (Sun-Sat); absent means Monday to Friday.'),
    breakReminders: field
      .boolean()
      .optional()
      .describe('Suggest breaks after long study sessions or days; absent means on.'),
    showStats: field
      .enum(['nobody', 'me', 'everyone'])
      .optional()
      .describe('Who sees your study stats on your profile; absent means me.'),
    showTier: field
      .enum(['nobody', 'me', 'everyone'])
      .optional()
      .describe('Who sees your study tier on your profile, and with everyone also in battles; absent means me.'),
    tierStyle: field
      .enum(['theme', 'badge'])
      .optional()
      .describe('How a shown tier looks: theme styles the whole profile, badge only adds a badge; absent means theme.'),
    showMotivation: field
      .enum(['nobody', 'me', 'everyone'])
      .optional()
      .describe(
        'Who sees tier progress boxes: nobody hides them, me shows them on the home, study and profile pages, everyone also shows the profile box to visitors (only while showTier is everyone); absent means me.',
      ),
    showCredits: field
      .enum(['nobody', 'me', 'everyone'])
      .optional()
      .describe('Who sees your OpenDeck credit roles on your profile; absent means everyone.'),
    creditStyle: field
      .enum(['theme', 'badges'])
      .optional()
      .describe(
        'How shown credit roles look: theme styles the whole profile, badges only lists them; absent means theme.',
      ),
    studyTier: field
      .enum(['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion', 'grandChampion', 'supernova'])
      .optional()
      .describe('Study tier from the days studied in the last four weeks; only present while it is shown publicly.'),
    studyTierAt: field.datetime().optional().describe('When studyTier was last computed.'),
    studyDays: field
      .list(field.number({ min: 0, max: 3 }), { max: 84 })
      .optional()
      .describe(
        'Study sessions per day (capped at 3) for the 84 days up to studyDaysEnd, oldest first; only present while the motivation box is public.',
      ),
    studyDaysEnd: field
      .text({ max: 10 })
      .optional()
      .describe('Local date (YYYY-MM-DD) of the last entry in studyDays.'),
    publicStats: field
      .object({
        learned: field.number().describe('Cards in review.'),
        learning: field.number().describe('Cards in learning or relearning.'),
        repetitions: field.number().describe('All ratings ever given.'),
        secondsStudied: field.number().describe('Active study time in the last 365 days.'),
        retention: field
          .number({ min: 0, max: 100 })
          .optional()
          .describe('Percent of ratings in the last 30 days that were not again.'),
        lastStudiedAt: field.datetime().optional(),
        firstStudiedOn: field.text({ max: 10 }).optional().describe('Local date (YYYY-MM-DD) of the first study day.'),
        activity: field
          .list(field.number({ min: 0 }), { max: 371 })
          .describe('Repetitions per day for the days up to activityEnd, oldest first.'),
        activityEnd: field.text({ max: 10 }).describe('Local date (YYYY-MM-DD) of the last entry in activity.'),
        updatedAt: field.datetime(),
      })
      .optional()
      .describe('Summary of your study stats without deck or card details; only present while showStats is everyone.'),
    updatedAt: field.datetime().optional(),
  },

  vault: space(['deck', 'card', 'progress', 'session'], {
    key: 'self',
    name: 'OpenDeck',
    description: 'Private OpenDeck decks, cards, study progress and study sessions.',
  }),
})
