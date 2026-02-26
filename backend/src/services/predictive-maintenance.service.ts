import type { Inspection, DetectedFault } from '../types'

export interface PredictiveMaintenanceResult {
  riskScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  predictedFailures: Array<{
    component: string
    likelihood: number
    timeframe: string
    indicators: string[]
  }>
  maintenanceRecommendations: string[]
  lastMaintenanceSuggestions: string[]
  sparesToOrder: string[]
}

interface MaintenancePattern {
  faultPattern: string[]
  recommendedAction: string
  typicalTimeToFailure: string
}

const MAINTENANCE_PATTERNS: Record<string, MaintenancePattern[]> = {
  generic: [
    {
      faultPattern: ['vibration', 'noise', 'unusual'],
      recommendedAction: 'Check bearings and lubricate',
      typicalTimeToFailure: '2-4 weeks',
    },
    {
      faultPattern: ['leak', 'drip', 'moisture'],
      recommendedAction: 'Inspect seals and gaskets',
      typicalTimeToFailure: '1-2 weeks',
    },
    {
      faultPattern: ['overheat', 'hot', 'temperature'],
      recommendedAction: 'Check cooling system and filters',
      typicalTimeToFailure: '3-7 days',
    },
    {
      faultPattern: ['corrosion', 'rust', 'degradation'],
      recommendedAction: 'Clean and apply protective coating',
      typicalTimeToFailure: '1-3 months',
    },
  ],
  pump: [
    {
      faultPattern: ['low pressure', 'flow reduction'],
      recommendedAction: 'Check impeller wear and seals',
      typicalTimeToFailure: '2-4 weeks',
    },
    {
      faultPattern: ['cavitation', 'noise'],
      recommendedAction: 'Check inlet conditions and suction line',
      typicalTimeToFailure: '1-2 weeks',
    },
  ],
  motor: [
    {
      faultPattern: ['overheating', 'high temperature'],
      recommendedAction: 'Check windings and cooling fan',
      typicalTimeToFailure: '1-2 weeks',
    },
    {
      faultPattern: ['vibration', 'unusual noise'],
      recommendedAction: 'Check alignment and bearings',
      typicalTimeToFailure: '2-4 weeks',
    },
  ],
  valve: [
    {
      faultPattern: ['leak', 'seal'],
      recommendedAction: 'Replace valve seat and seals',
      typicalTimeToFailure: '2-4 weeks',
    },
    {
      faultPattern: ['sticking', 'hard to operate'],
      recommendedAction: 'Lubricate and clean stem',
      typicalTimeToFailure: '1-2 months',
    },
  ],
}

export class PredictiveMaintenanceService {
  public async analyzeForPredictiveMaintenance(
    inspection: Inspection,
    faults: DetectedFault[],
  ): Promise<PredictiveMaintenanceResult> {
    const riskFactors = this.calculateRiskFactors(faults)
    const riskScore = this.calculateRiskScore(riskFactors)
    const riskLevel = this.determineRiskLevel(riskScore)

    const predictedFailures = this.predictFailures(faults)
    const recommendations = this.generateRecommendations(faults, predictedFailures)
    const spares = this.identifySpares(faults)

    return {
      riskScore,
      riskLevel,
      predictedFailures,
      maintenanceRecommendations: recommendations.maintenance,
      lastMaintenanceSuggestions: recommendations.lastMaintenance,
      sparesToOrder: spares,
    }
  }

  private calculateRiskFactors(faults: DetectedFault[]): number[] {
    const severityMap: Record<string, number> = {
      critical: 1.0,
      high: 0.75,
      medium: 0.5,
      low: 0.25,
    }

    return faults.map((fault) => {
      const severity = severityMap[Object.keys(fault).find((k) => k === 'severity') || 'medium'] || 0.5
      const confidence = fault.confidence || 0.5
      return severity * confidence
    })
  }

  private calculateRiskScore(factors: number[]): number {
    if (factors.length === 0) return 0

    const avgRisk = factors.reduce((a, b) => a + b, 0) / factors.length
    const maxRisk = Math.max(...factors)
    const countRisk = Math.min(factors.length / 5, 1)

    return Math.min(100, (avgRisk * 40 + maxRisk * 40 + countRisk * 20))
  }

  private determineRiskLevel(score: number): PredictiveMaintenanceResult['riskLevel'] {
    if (score >= 75) return 'critical'
    if (score >= 50) return 'high'
    if (score >= 25) return 'medium'
    return 'low'
  }

  private predictFailures(faults: DetectedFault[]): PredictiveMaintenanceResult['predictedFailures'] {
    const predictions: PredictiveMaintenanceResult['predictedFailures'] = []
    const faultText = faults.map((f) => `${f.faultType} ${f.component}`).join(' ').toLowerCase()

    for (const [equipmentType, patterns] of Object.entries(MAINTENANCE_PATTERNS)) {
      for (const pattern of patterns) {
        const matchCount = pattern.faultPattern.filter((p) => faultText.includes(p)).length

        if (matchCount > 0) {
          predictions.push({
            component: equipmentType,
            likelihood: Math.min(0.95, 0.3 + matchCount * 0.2),
            timeframe: pattern.typicalTimeToFailure,
            indicators: pattern.faultPattern,
          })
        }
      }
    }

    return predictions.slice(0, 5)
  }

  private generateRecommendations(
    faults: DetectedFault[],
    predictions: PredictiveMaintenanceResult['predictedFailures'],
  ): { maintenance: string[]; lastMaintenance: string[] } {
    const maintenance: string[] = []
    const lastMaintenance: string[] = []

    for (const prediction of predictions) {
      const pattern = Object.values(MAINTENANCE_PATTERNS)
        .flat()
        .find((p) => prediction.indicators.some((i) => p.faultPattern.includes(i)))

      if (pattern) {
        maintenance.push(pattern.recommendedAction)
      }
    }

    for (const fault of faults) {
      if (fault.recommendedActions) {
        maintenance.push(...fault.recommendedActions)
      }
    }

    if (maintenance.length === 0) {
      maintenance.push('Continue regular inspection schedule')
      maintenance.push('Monitor equipment performance trends')
    }

    lastMaintenance.push('Review maintenance logs for last service date')
    lastMaintenance.push('Check spare parts inventory')
    lastMaintenance.push('Schedule preventive maintenance window')

    return {
      maintenance: [...new Set(maintenance)].slice(0, 5),
      lastMaintenance: [...new Set(lastMaintenance)].slice(0, 3),
    }
  }

  private identifySpares(faults: DetectedFault[]): string[] {
    const spares: string[] = []

    const faultText = faults.map((f) => f.faultType.toLowerCase()).join(' ')

    if (faultText.includes('seal') || faultText.includes('leak')) {
      spares.push('Seal kit', 'Gaskets')
    }
    if (faultText.includes('bearing') || faultText.includes('vibration')) {
      spares.push('Bearings', 'Lubricant')
    }
    if (faultText.includes('filter')) {
      spares.push('Filter elements')
    }
    if (faultText.includes('belt')) {
      spares.push('Drive belts')
    }
    if (faultText.includes('fuse') || faultText.includes('electrical')) {
      spares.push('Fuses', 'Circuit breakers')
    }

    return spares.length > 0 ? spares : ['General consumables']
  }
}
