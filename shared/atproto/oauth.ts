import type { ClientMetadataOptions } from 'airspace/oauth/metadata'
import { baseScopes, scopes } from './collections'

const OAUTH_METADATA_PATH = '/oauth-client-metadata.json'
const OAUTH_REDIRECT_PATH = '/'
const OAUTH_CLIENT_NAME = 'OpenDeck'

export function clientMetadataOptions(baseUrl: string): ClientMetadataOptions {
  return {
    baseUrl,
    redirectPath: OAUTH_REDIRECT_PATH,
    name: OAUTH_CLIENT_NAME,
    scopes,
    metadataPath: OAUTH_METADATA_PATH,
  }
}

export const fallbackScopes = baseScopes
