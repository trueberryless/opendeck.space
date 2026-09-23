import { defineCollections, defineSpace, scopesFor } from 'airspace'
import { lexicons } from './lexicons'

export const collections = defineCollections(lexicons)

const vault = defineSpace(lexicons.vault, {
  collections: {
    deck: collections.deck,
    card: collections.card,
    progress: collections.progress,
    session: collections.session,
  },
})

export const spaces = { vault }

export const scopes = scopesFor({
  collections,
  spaces,
  manage: ['create', 'update', 'delete'],
})

export const baseScopes = scopesFor({ collections })
