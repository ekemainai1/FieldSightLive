import { apiRequest, uploadFileToSignedUrl } from './api-client'

interface Inspection {
  id: string
  status: 'in_progress' | 'completed'
  technicianId?: string
  siteId?: string
  timestamp?: string
}

interface SignedUploadResponse {
  uploadUrl: string
  objectPath: string
  publicUrl: string
  expiresAt: string
}

export interface InspectionReport {
  inspectionId: string
  generatedAt: string
  status: 'in_progress' | 'completed'
  findings: string[]
  safetySummary: string[]
  recommendedActions: string[]
  imageCount: number
  summaryText: string
}

interface CreateInspectionInput {
  technicianId: string
  siteId: string
}

interface CompleteInspectionInput {
  summary?: string
}

export class InspectionService {
  public async createInspection(input: CreateInspectionInput): Promise<Inspection> {
    return apiRequest<Inspection>('/api/v1/inspections', {
      method: 'POST',
      body: input,
    })
  }

  public async listInspections(filters?: {
    technicianId?: string
    siteId?: string
    status?: 'in_progress' | 'completed'
  }): Promise<Inspection[]> {
    const params = new URLSearchParams()
    if (filters?.technicianId) params.set('technicianId', filters.technicianId)
    if (filters?.siteId) params.set('siteId', filters.siteId)
    if (filters?.status) params.set('status', filters.status)
    const query = params.toString()
    const path = query ? `/api/v1/inspections?${query}` : '/api/v1/inspections'
    return apiRequest<Inspection[]>(path)
  }

  public async completeInspection(
    inspectionId: string,
    input: CompleteInspectionInput,
  ): Promise<Inspection> {
    return apiRequest<Inspection>(`/api/v1/inspections/${inspectionId}/status`, {
      method: 'PATCH',
      body: {
        status: 'completed',
        summary: input.summary,
      },
    })
  }

  public async uploadSnapshot(inspectionId: string, frameDataUrl: string): Promise<string> {
    const blob = this.dataUrlToBlob(frameDataUrl)
    const signed = await apiRequest<SignedUploadResponse>(
      `/api/v1/inspections/${inspectionId}/snapshots/signed-url`,
      {
        method: 'POST',
        body: {
          fileName: `snapshot-${Date.now()}.jpg`,
          contentType: 'image/jpeg',
        },
      },
    )

    await uploadFileToSignedUrl(signed.uploadUrl, blob, 'image/jpeg')

    await apiRequest<void>(`/api/v1/inspections/${inspectionId}/snapshots/attach`, {
      method: 'POST',
      body: {
        imageUrl: signed.publicUrl,
      },
    })

    return signed.publicUrl
  }

  public async generateReport(inspectionId: string): Promise<InspectionReport> {
    return apiRequest<InspectionReport>(`/api/v1/inspections/${inspectionId}/report`, {
      method: 'POST',
    })
  }

  public async getReport(inspectionId: string): Promise<InspectionReport> {
    return apiRequest<InspectionReport>(`/api/v1/inspections/${inspectionId}/report`)
  }

  public async downloadReportPdf(inspectionId: string): Promise<Blob> {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
    const response = await fetch(`${baseUrl}/api/v1/inspections/${inspectionId}/report.pdf`)
    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.status}`)
    }
    return response.blob()
  }

  private dataUrlToBlob(dataUrl: string): Blob {
    const [meta, data] = dataUrl.split(',')
    if (!meta || !data) {
      throw new Error('Invalid frame data URL')
    }

    const mimeMatch = meta.match(/data:(.*?);base64/)
    const mimeType = mimeMatch?.[1] || 'image/jpeg'

    const binary = atob(data)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }

    return new Blob([bytes], { type: mimeType })
  }
}

export const inspectionService = new InspectionService()
