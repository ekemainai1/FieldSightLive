import { Storage } from '@google-cloud/storage'

interface SignedUploadResult {
  uploadUrl: string
  objectPath: string
  publicUrl: string
  expiresAt: string
}

interface SignedReadResult {
  url: string
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

    // Generate signed read URL (valid for 1 hour)
    const readExpiresMs = Date.now() + 60 * 60 * 1000
    const [signedReadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: readExpiresMs,
    })

    return {
      uploadUrl,
      objectPath,
      publicUrl: signedReadUrl, // Use signed URL instead of public URL
      expiresAt: new Date(expiresMs).toISOString(),
    }
  }

  public async getSignedReadUrl(objectPath: string, expiresInSeconds: number = 60 * 60): Promise<SignedReadResult> {
    if (!this.isConfigured()) {
      throw new Error('GCS_BUCKET_NAME is not configured')
    }

    const bucket = this.storage.bucket(this.bucketName)
    const file = bucket.file(objectPath)

    const expiresMs = Date.now() + expiresInSeconds * 1000
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: expiresMs,
    })

    return {
      url,
      expiresAt: new Date(expiresMs).toISOString(),
    }
  }
}
