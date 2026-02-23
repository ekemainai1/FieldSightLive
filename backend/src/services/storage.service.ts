import { Storage } from '@google-cloud/storage'

interface SignedUploadResult {
  uploadUrl: string
  objectPath: string
  publicUrl: string
  expiresAt: string
}

export class StorageService {
  private readonly storage: Storage
  private readonly bucketName: string

  constructor() {
    this.storage = new Storage()
    this.bucketName = process.env.GCS_BUCKET_NAME?.trim() || ''
  }

  public isConfigured(): boolean {
    return this.bucketName.length > 0
  }

  public async createSignedUploadUrl(
    inspectionId: string,
    fileName: string,
    contentType: string,
  ): Promise<SignedUploadResult> {
    if (!this.isConfigured()) {
      throw new Error('GCS_BUCKET_NAME is not configured')
    }

    const safeName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_')
    const objectPath = `inspections/${inspectionId}/images/${Date.now()}-${safeName}`
    const bucket = this.storage.bucket(this.bucketName)
    const file = bucket.file(objectPath)

    const expiresMs = Date.now() + 10 * 60 * 1000
    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: expiresMs,
      contentType,
    })

    return {
      uploadUrl,
      objectPath,
      publicUrl: `https://storage.googleapis.com/${this.bucketName}/${objectPath}`,
      expiresAt: new Date(expiresMs).toISOString(),
    }
  }
}
