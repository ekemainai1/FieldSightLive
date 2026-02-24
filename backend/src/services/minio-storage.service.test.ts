import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { MinioStorageService } from './minio-storage.service'

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation((config) => ({ config })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}))

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}))

describe('MinioStorageService', () => {
  const mockedS3Client = S3Client as unknown as jest.Mock
  const mockedPutObjectCommand = PutObjectCommand as unknown as jest.Mock
  const mockedGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>

  const envBackup = { ...process.env }

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...envBackup }
    delete process.env.MINIO_BUCKET_NAME
    delete process.env.MINIO_ACCESS_KEY
    delete process.env.MINIO_SECRET_KEY
    delete process.env.MINIO_PUBLIC_BASE_URL
    process.env.MINIO_ENDPOINT = 'localhost'
    process.env.MINIO_PORT = '9000'
    process.env.MINIO_USE_SSL = 'false'
  })

  afterAll(() => {
    process.env = envBackup
  })

  it('should return false for isConfigured when required MinIO credentials are missing', () => {
    const service = new MinioStorageService()
    expect(service.isConfigured()).toBe(false)
  })

  it('should throw when createSignedUploadUrl is called without MinIO configuration', async () => {
    const service = new MinioStorageService()
    await expect(
      service.createSignedUploadUrl('insp-1', 'snapshot.jpg', 'image/jpeg'),
    ).rejects.toThrow('MinIO is not configured')
  })

  it('should create signed upload url and sanitize filename for object path', async () => {
    process.env.MINIO_BUCKET_NAME = 'fieldsight-dev'
    process.env.MINIO_ACCESS_KEY = 'minio'
    process.env.MINIO_SECRET_KEY = 'miniopass'

    mockedGetSignedUrl.mockResolvedValueOnce('https://signed.example/upload')
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const service = new MinioStorageService()

    const result = await service.createSignedUploadUrl(
      'insp-44',
      'snap shot?.jpg',
      'image/jpeg',
    )

    expect(service.isConfigured()).toBe(true)
    expect(mockedS3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'http://localhost:9000',
        forcePathStyle: true,
      }),
    )
    expect(mockedPutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'fieldsight-dev',
        ContentType: 'image/jpeg',
      }),
    )
    expect(mockedGetSignedUrl).toHaveBeenCalledTimes(1)
    expect(result.uploadUrl).toBe('https://signed.example/upload')
    expect(result.objectPath).toBe('inspections/insp-44/images/1700000000000-snap_shot_.jpg')
    expect(result.publicUrl).toBe(
      'http://localhost:9000/fieldsight-dev/inspections/insp-44/images/1700000000000-snap_shot_.jpg',
    )
    expect(result.expiresAt).toBe(new Date(1_700_000_600_000).toISOString())

    dateNowSpy.mockRestore()
  })

  it('should use configured public base url for public object path', async () => {
    process.env.MINIO_BUCKET_NAME = 'fieldsight-dev'
    process.env.MINIO_ACCESS_KEY = 'minio'
    process.env.MINIO_SECRET_KEY = 'miniopass'
    process.env.MINIO_PUBLIC_BASE_URL = 'https://cdn.example/minio'

    mockedGetSignedUrl.mockResolvedValueOnce('https://signed.example/upload-2')
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_500)
    const service = new MinioStorageService()

    const result = await service.createSignedUploadUrl('insp-45', 'photo.png', 'image/png')

    expect(result.publicUrl).toBe(
      'https://cdn.example/minio/fieldsight-dev/inspections/insp-45/images/1700000000500-photo.png',
    )
    dateNowSpy.mockRestore()
  })
})
