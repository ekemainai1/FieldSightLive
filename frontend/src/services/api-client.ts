const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

type AuthTokenProvider = () => Promise<string | null>

let authTokenProvider: AuthTokenProvider = async () => null

export function setAuthTokenProvider(provider: AuthTokenProvider): void {
  authTokenProvider = provider
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH'
  body?: unknown
}

interface BlobRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH'
}

async function buildAuthHeaders(baseHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await authTokenProvider()
  return {
    ...baseHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function readResponseError(response: Response): Promise<string> {
  const payload = (await response.clone().json().catch(() => ({}))) as { error?: string }
  if (payload.error) {
    return payload.error
  }

  const text = await response.text().catch(() => '')
  if (text.trim().length > 0) {
    return text
  }

  return `Request failed: ${response.status}`
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = await buildAuthHeaders({
    'Content-Type': 'application/json',
  })

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    throw new Error(await readResponseError(response))
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export async function apiRequestBlob(path: string, options: BlobRequestOptions = {}): Promise<Blob> {
  const headers = await buildAuthHeaders()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
  })

  if (!response.ok) {
    throw new Error(await readResponseError(response))
  }

  return response.blob()
}

export async function uploadFileToSignedUrl(
  signedUrl: string,
  fileBlob: Blob,
  contentType: string,
): Promise<void> {
  const response = await fetch(signedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body: fileBlob,
  })

  if (!response.ok) {
    throw new Error(`Signed upload failed: ${response.status}`)
  }
}
