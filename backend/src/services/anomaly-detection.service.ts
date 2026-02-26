import { GoogleGenAI } from '@google/genai'

export interface AnomalyDetectionResult {
  isAnomaly: boolean
  anomalyType?: 'statistical' | 'visual' | 'behavioral'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  confidence: number
  historicalBaseline?: {
    normalValue: string
    deviation: number
    deviationPercent: number
  }
  recommendations: string[]
}

interface AnomalyPayload {
  isAnomaly?: boolean
  anomalyType?: string
  severity?: string
  description?: string
  confidence?: number
  historicalBaseline?: {
    normalValue?: string
    deviation?: number
    deviationPercent?: number
  }
  recommendations?: string[]
}

export class AnomalyDetectionService {
  private readonly client: GoogleGenAI | null

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY?.trim()
    this.client = apiKey ? new GoogleGenAI({ apiKey }) : null
  }

  public async detectAnomaly(
    currentReading: number,
    equipmentType: string,
    historicalData?: number[],
  ): Promise<AnomalyDetectionResult> {
    if (!this.client) {
      return this.fallbackResult('Anomaly detection service unavailable')
    }

    const baselineStats = this.calculateBaselineStats(historicalData || [])
    const prompt = this.buildAnomalyPrompt(equipmentType, currentReading, baselineStats)

    try {
      const result = await this.client.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
        contents: [{ text: prompt }],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      })

      return this.parseAnomalyResult(result.text || '{}', currentReading, baselineStats)
    } catch (error) {
      return this.fallbackResult(
        error instanceof Error ? error.message : 'Anomaly detection failed',
      )
    }
  }

  private calculateBaselineStats(data: number[]): {
    mean: number
    stdDev: number
    min: number
    max: number
  } {
    if (data.length === 0) {
      return { mean: 0, stdDev: 0, min: 0, max: 0 }
    }

    const mean = data.reduce((a, b) => a + b, 0) / data.length
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length
    const stdDev = Math.sqrt(variance)

    return {
      mean,
      stdDev,
      min: Math.min(...data),
      max: Math.max(...data),
    }
  }

  private buildAnomalyPrompt(
    equipmentType: string,
    currentReading: number,
    baseline: { mean: number; stdDev: number; min: number; max: number },
  ): string {
    const hasHistory = baseline.stdDev > 0
    const zScore = hasHistory ? (currentReading - baseline.mean) / baseline.stdDev : 0

    return `Analyze the following equipment reading for anomalies:

Equipment Type: ${equipmentType}
Current Reading: ${currentReading}
${hasHistory ? `
Historical Data:
- Mean: ${baseline.mean.toFixed(2)}
- Standard Deviation: ${baseline.stdDev.toFixed(2)}
- Min: ${baseline.min.toFixed(2)}
- Max: ${baseline.max.toFixed(2)}
- Z-Score: ${zScore.toFixed(2)}
` : 'No historical data available.'}

Return JSON with:
{
  "isAnomaly": boolean,
  "anomalyType": "statistical" | "visual" | "behavioral" | null,
  "severity": "low" | "medium" | "high" | "critical",
  "description": "string",
  "confidence": 0-1,
  "historicalBaseline": {
    "normalValue": "string",
    "deviation": number,
    "deviationPercent": number
  } | null,
  "recommendations": ["string"]
}`
  }

  private parseAnomalyResult(
    rawText: string,
    currentReading: number,
    baseline: { mean: number; stdDev: number },
  ): AnomalyDetectionResult {
    const cleaned = rawText.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim()

    try {
      const payload = JSON.parse(cleaned) as AnomalyPayload
      const zScore = baseline.stdDev > 0 ? (currentReading - baseline.mean) / baseline.stdDev : 0

      return {
        isAnomaly: payload.isAnomaly ?? false,
        anomalyType: payload.anomalyType as AnomalyDetectionResult['anomalyType'] || undefined,
        severity: this.validateSeverity(payload.severity),
        description: payload.description || 'Analysis complete',
        confidence: Math.max(0, Math.min(1, payload.confidence || 0)),
        historicalBaseline: payload.historicalBaseline
          ? {
              normalValue: payload.historicalBaseline.normalValue || baseline.mean.toFixed(2),
              deviation: payload.historicalBaseline.deviation ?? zScore,
              deviationPercent: payload.historicalBaseline.deviationPercent ?? Math.abs(zScore * 10),
            }
          : undefined,
        recommendations: payload.recommendations || [],
      }
    } catch {
      return {
        isAnomaly: false,
        severity: 'low',
        description: 'Analysis complete',
        confidence: 0.5,
        recommendations: ['Continue monitoring'],
      }
    }
  }

  private validateSeverity(severity?: string): AnomalyDetectionResult['severity'] {
    if (!severity) return 'low'
    const valid = ['low', 'medium', 'high', 'critical']
    return valid.includes(severity.toLowerCase()) ? severity.toLowerCase() as AnomalyDetectionResult['severity'] : 'low'
  }

  private fallbackResult(message: string): AnomalyDetectionResult {
    return {
      isAnomaly: false,
      severity: 'low',
      description: message,
      confidence: 0,
      recommendations: ['Retry later'],
    }
  }
}
