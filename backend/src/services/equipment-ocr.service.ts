import { GoogleGenAI } from '@google/genai'

export interface OcrExtractionResult {
  imageUrl: string
  extractedText: string
  serialNumbers: string[]
  partCodes: string[]
  meterReadings: string[]
  warningLabels: string[]
  confidence: number
}

interface OcrPayload {
  extractedText?: string
  serialNumbers?: string[]
  partCodes?: string[]
  meterReadings?: string[]
  warningLabels?: string[]
  confidence?: number
}

export class EquipmentOcrService {
  private readonly client: GoogleGenAI | null

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY?.trim()
    this.client = apiKey ? new GoogleGenAI({ apiKey }) : null
  }

  public async extractFromImageUrl(imageUrl: string): Promise<OcrExtractionResult> {
    if (!this.client) {
      throw new Error('GEMINI_API_KEY is not configured')
    }

    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch image for OCR: ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const arrayBuffer = await response.arrayBuffer()
    const base64Data = Buffer.from(arrayBuffer).toString('base64')

    const prompt =
      'Extract equipment labels and readings from this image. Return strict JSON with keys: extractedText, serialNumbers[], partCodes[], meterReadings[], warningLabels[], confidence (0-1).'

    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
    const result = await this.client.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: contentType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    })

    const parsed = this.parseOcrPayload(result.text || '{}')
    return {
      imageUrl,
      extractedText: parsed.extractedText || '',
      serialNumbers: parsed.serialNumbers || [],
      partCodes: parsed.partCodes || [],
      meterReadings: parsed.meterReadings || [],
      warningLabels: parsed.warningLabels || [],
      confidence: this.clampConfidence(parsed.confidence),
    }
  }

  private parseOcrPayload(rawText: string): OcrPayload {
    const cleaned = rawText.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
    try {
      const payload = JSON.parse(cleaned) as OcrPayload
      return payload
    } catch {
      return {
        extractedText: rawText,
        serialNumbers: [],
        partCodes: [],
        meterReadings: [],
        warningLabels: [],
        confidence: 0.4,
      }
    }
  }

  private clampConfidence(value?: number): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 0.5
    }
    return Math.max(0, Math.min(1, value))
  }
}
