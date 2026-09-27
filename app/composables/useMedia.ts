import { cidFromBlob, type UploadedBlob } from 'airspace'
import { getDb } from '~/utils/db'

export function useMedia() {
  async function uploadImage(input: Blob | Uint8Array | ArrayBuffer, mimeType?: string): Promise<UploadedBlob> {
    return requireAirspace().blobs.upload(input, { mimeType })
  }

  async function uploadAudio(input: Blob | Uint8Array | ArrayBuffer, mimeType?: string): Promise<UploadedBlob> {
    return requireAirspace().blobs.upload(input, { mimeType })
  }

  async function blobUrl(did: string, blob: unknown): Promise<string | null> {
    if (!blob) return null
    const cid = cidFromBlob(blob)
    const saved = cid
      ? await getDb()
          .media.get(cid)
          .catch(() => undefined)
      : undefined
    if (saved) return URL.createObjectURL(saved.blob)
    const client = useAuthUser().value?.did === did ? useAirspace() : readAirspace(did)
    if (!client) return null
    try {
      return await client.blobs.url(blob)
    } catch {
      return null
    }
  }

  function releaseUrl(url: string | null | undefined) {
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
  }

  return { uploadImage, uploadAudio, blobUrl, releaseUrl }
}
