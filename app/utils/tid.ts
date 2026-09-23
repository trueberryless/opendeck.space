const S32 = '234567abcdefghijklmnopqrstuvwxyz'
const CLOCK_ID = BigInt(Math.floor(Math.random() * 1024))
let lastMicros = 0

export function nextTid(): string {
  let micros = Date.now() * 1000
  if (micros <= lastMicros) micros = lastMicros + 1
  lastMicros = micros

  let n = (BigInt(micros) << 10n) | CLOCK_ID
  let out = ''
  for (let i = 0; i < 13; i++) {
    out = S32[Number(n & 31n)] + out
    n >>= 5n
  }
  return out
}
