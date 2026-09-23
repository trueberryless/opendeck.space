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
    updatedAt: field.datetime().optional(),
  },

  vault: space(['deck', 'card', 'progress', 'session'], {
    key: 'self',
    name: 'OpenDeck',
    description: 'Private OpenDeck decks, cards, study progress and study sessions.',
  }),
})
