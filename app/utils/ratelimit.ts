export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export function retryAfterMs(err: unknown): number | null {
  const e = err as any
  const status = e?.status ?? e?.statusCode ?? e?.cause?.status
  const msg = String(e?.message ?? '')
  const isRate = status === 429 || /rate ?limit|too many requests|\b429\b/i.test(msg)
  if (!isRate) return null
  const headers = e?.headers ?? e?.cause?.headers ?? {}
  const reset = Number(headers['ratelimit-reset'])
  if (reset > 0) return Math.max(1000, reset * 1000 - Date.now())
  const ra = Number(headers['retry-after'])
  if (ra > 0) return ra * 1000
  return 60_000
}
