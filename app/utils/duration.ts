export function formatStudyTime(seconds: number, locale: string): string {
  const minutes = Math.max(1, Math.round(seconds / 60))
  const inHours = minutes >= 60
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: inHours ? 'hour' : 'minute',
    unitDisplay: 'long',
    maximumFractionDigits: inHours ? 1 : 0,
  }).format(inHours ? minutes / 60 : minutes)
}
