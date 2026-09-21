import { clientMetadata } from 'airspace/oauth/metadata'
import { clientMetadataOptions } from '../../shared/atproto/oauth'

export default defineEventHandler((event) => {
  const host =
    getRequestHeader(event, 'x-forwarded-host')?.split(',')[0]?.trim() || getRequestHeader(event, 'host') || ''
  const isLoopback = /^(localhost|127\.|\[::1\])/.test(host)
  const proto = getRequestHeader(event, 'x-forwarded-proto')?.split(',')[0]?.trim() || (isLoopback ? 'http' : 'https')
  const origin = `${proto}://${host}`

  setResponseHeaders(event, {
    'content-type': 'application/json',
    'cache-control': 'public, max-age=300',
  })

  return clientMetadata(clientMetadataOptions(origin))
})
