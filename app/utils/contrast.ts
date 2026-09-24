type Rgb = [number, number, number]

const WHITE: Rgb = [255, 255, 255]
const BLACK: Rgb = [0, 0, 0]

const LIGHT_ACCENT_CONTRAST = 5.3
const DARK_ACCENT_CONTRAST = 7

function parseHex(hex: string): Rgb | null {
  let c = hex.trim().replace('#', '')
  if (c.length === 3) c = [...c].map((ch) => ch + ch).join('')
  if (!/^[0-9a-f]{6}$/i.test(c)) return null
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]
}

function toHex(rgb: Rgb): string {
  return `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
}

function luminance([r, g, b]: Rgb): number {
  const lin = (v: number) => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

function mix(from: Rgb, to: Rgb, t: number): Rgb {
  return [0, 1, 2].map((i) => from[i]! + (to[i]! - from[i]!) * t) as Rgb
}

function adjust(color: Rgb, background: Rgb, target: number): Rgb {
  const toward = background === WHITE ? BLACK : WHITE
  for (let t = 0; t <= 1; t += 0.01) {
    const candidate = mix(color, toward, t)
    if (contrastRatio(candidate, background) >= target) return candidate
  }
  return toward
}

export function accessibleAccents(hex: string): { light: string; dark: string } | null {
  const rgb = parseHex(hex)
  if (!rgb) return null
  return {
    light: toHex(adjust(rgb, WHITE, LIGHT_ACCENT_CONTRAST)),
    dark: toHex(adjust(rgb, BLACK, DARK_ACCENT_CONTRAST)),
  }
}
