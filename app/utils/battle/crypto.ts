const IV_BYTES = 12
const KEY_BYTES = 16

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

function importKey(encoded: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', fromBase64Url(encoded), 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export function randomId(bytes = 9): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)))
}

export function createKey(): string {
  return randomId(KEY_BYTES)
}

export function isKey(value: unknown): value is string {
  return typeof value === 'string' && /^[\w-]{22}$/.test(value)
}

export async function seal(key: string, data: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const plain = new TextEncoder().encode(JSON.stringify(data))
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await importKey(key), plain))
  const out = new Uint8Array(IV_BYTES + cipher.length)
  out.set(iv)
  out.set(cipher, IV_BYTES)
  return toBase64Url(out)
}

export async function unseal<T>(key: string, payload: string): Promise<T> {
  const bytes = fromBase64Url(payload)
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes.slice(0, IV_BYTES) },
    await importKey(key),
    bytes.slice(IV_BYTES),
  )
  return JSON.parse(new TextDecoder().decode(plain)) as T
}
