import type { StarterCard, StarterDeck } from '~/composables/useStarterDecks'

type Translation = string | [string, string]

interface MasterItem {
  id: string
  section: string
  en: string
  hint?: string
}

const MASTER: MasterItem[] = [
  { id: 'hello', section: 'Greetings & being polite', en: 'Hello' },
  { id: 'good_morning', section: 'Greetings & being polite', en: 'Good morning' },
  { id: 'good_evening', section: 'Greetings & being polite', en: 'Good evening' },
  { id: 'goodbye', section: 'Greetings & being polite', en: 'Goodbye' },
  { id: 'yes', section: 'Greetings & being polite', en: 'Yes' },
  { id: 'no', section: 'Greetings & being polite', en: 'No' },
  { id: 'please', section: 'Greetings & being polite', en: 'Please' },
  { id: 'thank_you', section: 'Greetings & being polite', en: 'Thank you' },
  { id: 'youre_welcome', section: 'Greetings & being polite', en: "You're welcome" },
  { id: 'excuse_me', section: 'Greetings & being polite', en: 'Excuse me (sorry)' },
  { id: 'how_are_you', section: 'Greetings & being polite', en: 'How are you?' },
  { id: 'delicious', section: 'Greetings & being polite', en: 'Delicious' },

  { id: 'one', section: 'Numbers', en: 'One' },
  { id: 'two', section: 'Numbers', en: 'Two' },
  { id: 'three', section: 'Numbers', en: 'Three' },
  { id: 'four', section: 'Numbers', en: 'Four' },
  { id: 'five', section: 'Numbers', en: 'Five' },
  { id: 'six', section: 'Numbers', en: 'Six' },
  { id: 'seven', section: 'Numbers', en: 'Seven' },
  { id: 'eight', section: 'Numbers', en: 'Eight' },
  { id: 'nine', section: 'Numbers', en: 'Nine' },
  { id: 'ten', section: 'Numbers', en: 'Ten' },
  { id: 'twenty', section: 'Numbers', en: 'Twenty' },
  { id: 'fifty', section: 'Numbers', en: 'Fifty' },
  { id: 'hundred', section: 'Numbers', en: 'One hundred' },
  { id: 'thousand', section: 'Numbers', en: 'One thousand' },
  { id: 'one_million', section: 'Numbers', en: 'One million' },

  { id: 'how_much', section: 'Buying & bargaining', en: 'How much does it cost?' },
  { id: 'too_expensive', section: 'Buying & bargaining', en: 'Too expensive' },
  { id: 'i_want', section: 'Buying & bargaining', en: 'I want ...' },
  { id: 'do_you_have', section: 'Buying & bargaining', en: 'Do you have ...?' },
  { id: 'water', section: 'Buying & bargaining', en: 'Water' },
  { id: 'bill_please', section: 'Buying & bargaining', en: 'The bill, please' },

  { id: 'entrance', section: 'Reading signs', en: 'Entrance / In' },
  { id: 'exit', section: 'Reading signs', en: 'Exit / Out' },
  { id: 'toilet', section: 'Reading signs', en: 'Toilet' },
  { id: 'closed', section: 'Reading signs', en: 'Closed' },

  { id: 'where_is', section: 'Getting to places', en: 'Where is ...?' },
  { id: 'left', section: 'Getting to places', en: 'Left' },
  { id: 'right', section: 'Getting to places', en: 'Right' },
  { id: 'straight_ahead', section: 'Getting to places', en: 'Straight ahead' },
  { id: 'help_me', section: 'Getting to places', en: 'Can you help me?' },
  { id: 'hotel', section: 'Getting to places', en: 'Hotel' },
  { id: 'restaurant', section: 'Getting to places', en: 'Restaurant' },
  { id: 'market', section: 'Getting to places', en: 'Market' },
  { id: 'bank', section: 'Getting to places', en: 'Bank' },
  { id: 'doctor', section: 'Getting to places', en: 'Doctor' },
  { id: 'hospital', section: 'Getting to places', en: 'Hospital' },
  { id: 'police', section: 'Getting to places', en: 'Police' },
  { id: 'train_station', section: 'Getting to places', en: 'Train station' },
  { id: 'airport', section: 'Getting to places', en: 'Airport' },
  { id: 'ticket', section: 'Getting to places', en: 'Ticket' },

  { id: 'today', section: 'Time', en: 'Today' },
  { id: 'tomorrow', section: 'Time', en: 'Tomorrow' },

  { id: 'my_name_is', section: 'Talking about yourself', en: 'My name is ...' },
  { id: 'where_from', section: 'Talking about yourself', en: 'Where are you from?' },
  { id: 'i_am_sick', section: 'Talking about yourself', en: 'I am sick' },

  { id: 'dont_understand', section: 'Controlling communication', en: "I don't understand" },
  { id: 'do_you_speak_english', section: 'Controlling communication', en: 'Do you speak English?' },
  { id: 'speak_slowly', section: 'Controlling communication', en: 'Please speak slowly' },
]

export interface LangDef {
  code: string
  label: string
  flag?: string
  sort: number
  t: Record<string, Translation>
}

export function buildDeck(lang: LangDef): StarterDeck {
  const cards: StarterCard[] = []
  for (const item of MASTER) {
    const value = lang.t[item.id]
    if (value == null) continue
    const [back, phonetic] = Array.isArray(value) ? value : [value, undefined]
    if (!back) continue
    const card: StarterCard = { section: item.section, front: item.en, back }
    if (phonetic) card.phonetic = phonetic
    if (item.hint) card.hint = item.hint
    cards.push(card)
  }
  return {
    id: `survival-${lang.code}`,
    title: `${lang.label} survival vocabulary`,
    summary: `${cards.length} essential words and phrases for a short trip to a ${lang.label}-speaking place: greetings, numbers, shopping, getting around and handling problems.`,
    sourceLang: 'en',
    targetLang: lang.code,
    targetLangLabel: lang.label,
    flag: lang.flag,
    level: 'beginner',
    sort: lang.sort,
    verified: true,
    tags: ['survival', 'travel', 'beginner'],
    attribution:
      "Survival vocabulary set inspired by Paul Nation & David Crabbe's survival word lists. Translations compiled and hand-checked for OpenDeck. Corrections are welcome.",
    cards,
  }
}
