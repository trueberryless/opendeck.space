export function useSpacesSupport() {
  const supported = useState<boolean | null>('opendeck-pds-spaces', () => null)

  async function ensure(): Promise<boolean> {
    if (supported.value !== null) return supported.value
    const airspace = useAirspace()
    if (!airspace) return false
    try {
      supported.value = await airspace.vault.supported()
    } catch {
      supported.value = false
    }
    return supported.value
  }

  return { supported, ensure }
}
