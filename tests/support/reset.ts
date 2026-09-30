import { afterEach, beforeEach, vi } from 'vitest'
import { _setAirspace } from '~/composables/useAirspace'
import { clearLocalData } from '~/utils/db'

beforeEach(async () => {
  await clearLocalData()
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  _setAirspace(null)
  clearNuxtState()
  vi.unstubAllGlobals()
})
