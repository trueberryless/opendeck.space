import type { UploadedBlob } from 'airspace'

export function useMedia() {
  async function uploadImage(input: Blob | Uint8Array | ArrayBuffer, mimeType?: string): Promise<UploadedBlob> {
    return requireAirspace().blobs.upload(input, { mimeType })
  }

  async function uploadAudio(input: Blob | Uint8Array | ArrayBuffer, mimeType?: string): Promise<UploadedBlob> {
    return requireAirspace().blobs.upload(input, { mimeType })
  }

  async function blobUrl(did: string, blob: unknown): Promise<string | null> {
    if (!blob) return null
    const client = useAuthUser().value?.did === did ? useAirspace() : readAirspace(did)
    if (!client) return null
    try {
      return await client.blobs.url(blob)
    } catch {
      return null
    }
  }

  return { uploadImage, uploadAudio, blobUrl }
}
