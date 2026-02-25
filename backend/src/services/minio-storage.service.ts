import {
  S3Client,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { PutObjectCommand } from '@aws-sdk/client-s3'

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

export class MinioStorageService {
  private readonly client: S3Client
  private readonly bucketName: string
  private readonly endpoint: string
  private readonly port: number
  private readonly useSSL: boolean
  private readonly publicBaseUrl: string

  constructor() {
    this.endpoint = process.env.MINIO_ENDPOINT?.trim() || 'localhost'
    this.port = Number(process.env.MINIO_PORT || 9000)
    this.useSSL = String(process.env.MINIO_USE_SSL || 'false').toLowerCase() === 'true'
    this.bucketName = process.env.MINIO_BUCKET_NAME?.trim() || ''

    const protocol = this.useSSL ? 'https' : 'http'
    const configuredPublic = process.env.MINIO_PUBLIC_BASE_URL?.trim()
    this.publicBaseUrl = configuredPublic || `${protocol}://${this.endpoint}:${this.port}`

    const accessKey = process.env.MINIO_ACCESS_KEY?.trim() || ''
    const secretKey = process.env.MINIO_SECRET_KEY?.trim() || ''

    this.client = new S3Client({
      region: process.env.MINIO_REGION?.trim() || 'us-east-1',
      endpoint: `${protocol}://${this.endpoint}:${this.port}`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
    })
  }

  public isConfigured(): boolean {
    return Boolean(
      this.bucketName &&
      process.env.MINIO_ACCESS_KEY?.trim() &&
      process.env.MINIO_SECRET_KEY?.trim(),
    )
  }

  public async createSignedUploadUrl(
    inspectionId: string,
    fileName: string,
    _contentType: string,
  ): Promise<SignedUploadResult> {
    if (!this.isConfigured()) {
      throw new Error('MinIO is not configured (MINIO_BUCKET_NAME/MINIO_ACCESS_KEY/MINIO_SECRET_KEY)')
    }

    const safeName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_')
    const objectPath = `inspections/${inspectionId}/images/${Date.now()}-${safeName}`
    const expiresSeconds = 10 * 60

    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: objectPath,
        ContentType: _contentType,
      }),
      { expiresIn: expiresSeconds },
    )

    const expiresMs = Date.now() + expiresSeconds * 1000

    const readUrl = await this.getSignedReadUrl(objectPath)

    return {
      uploadUrl,
      objectPath,
      publicUrl: readUrl.url,
      expiresAt: new Date(expiresMs).toISOString(),
    }
  }

  public async getSignedReadUrl(objectPath: string, expiresInSeconds: number = 60 * 60): Promise<SignedReadResult> {
    if (!this.isConfigured()) {
      throw new Error('MinIO is not configured')
    }

    const expiresMs = Date.now() + expiresInSeconds * 1000

    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucketName,
        Key: objectPath,
      }),
      { expiresIn: expiresInSeconds },
    )

    return {
      url,
      expiresAt: new Date(expiresMs).toISOString(),
    }
  }
}
