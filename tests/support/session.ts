import './reset'
import { _setAirspace, useAuthUser } from '~/composables/useAirspace'
import { createFakeAirspace, type FakeAirspace } from './airspace'

export function signIn(did = 'did:plc:me', handle = 'me.test'): FakeAirspace {
  const airspace = createFakeAirspace(did)
  _setAirspace(airspace as never)
  useAuthUser().value = { did, handle }
  return airspace
}
