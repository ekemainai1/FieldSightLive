export interface CalibrationGuide {
  equipmentType: string
  title: string
  estimatedTime: string
  requiredTools: string[]
  safetyWarnings: string[]
  steps: CalibrationStep[]
}

export interface CalibrationStep {
  step: number
  title: string
  instruction: string
  precautions?: string[]
  expectedResult?: string
}

const CALIBRATION_GUIDES: Record<string, CalibrationGuide> = {
  pressure_gauge: {
    equipmentType: 'pressure_gauge',
    title: 'Pressure Gauge Calibration',
    estimatedTime: '30-45 minutes',
    requiredTools: ['Pressure comparator', 'Reference gauge', 'Wrench set', 'O-ring kit'],
    safetyWarnings: [
      'Release pressure before removing gauge',
      'Wear safety glasses',
      'Use appropriate pressure rating equipment',
    ],
    steps: [
      {
        step: 1,
        title: 'Inspection',
        instruction: 'Visually inspect gauge for damage, corrosion, or loose parts. Check glass for cracks.',
        expectedResult: 'Gauge appears in good condition with no visible defects',
      },
      {
        step: 2,
        title: 'Zero Adjustment',
        instruction: 'With gauge at atmospheric pressure, verify pointer reads zero. If not, remove cap and adjust zero screw.',
        precautions: ['Do not over-tighten adjustment screw'],
        expectedResult: 'Pointer reads zero ±1% of full scale',
      },
      {
        step: 3,
        title: 'Connect to Comparator',
        instruction: 'Install gauge in pressure comparator. Hand-tighten, then wrench-tighten 1/4 to 1/2 turn.',
        precautions: ['Ensure proper thread engagement', 'Use correct adapter'],
      },
      {
        step: 4,
        title: 'Apply Test Pressure',
        instruction: 'Apply pressure at 0%, 25%, 50%, 75%, and 100% of full scale. Wait 30 seconds at each point.',
        expectedResult: 'Readings within ±2% of full scale accuracy',
      },
      {
        step: 5,
        title: 'Record Results',
        instruction: 'Document readings from both test gauge and reference gauge at each test point.',
      },
      {
        step: 6,
        title: 'Calculate Error',
        instruction: 'Calculate error at each point: Error = Test Reading - Reference Reading',
        expectedResult: 'Total error within gauge accuracy specification',
      },
      {
        step: 7,
        title: 'Adjust or Reject',
        instruction: 'If within tolerance, apply calibration sticker. If out of tolerance, attempt adjustment or tag for repair.',
      },
    ],
  },
  temperature_transmitter: {
    equipmentType: 'temperature_transmitter',
    title: 'Temperature Transmitter Calibration',
    estimatedTime: '45-60 minutes',
    requiredTools: ['Temperature calibrator', 'RTD simulator', 'Multimeter', 'Screwdriver set'],
    safetyWarnings: [
      'High temperature hazard',
      'Electrical isolation required',
      'Allow equipment to cool before calibration',
    ],
    steps: [
      {
        step: 1,
        title: 'Documentation',
        instruction: 'Record transmitter model, serial number, current configuration, and as-found readings.',
      },
      {
        step: 2,
        title: 'Electrical Checks',
        instruction: 'Disconnect from loop. Check input resistance (100Ω for PT100). Check output open circuit.',
        expectedResult: 'Input: 100-110Ω, Output: 4-20mA with no load',
      },
      {
        step: 3,
        title: 'Connect Calibrator',
        instruction: 'Connect RTD simulator to transmitter input. Connect multimeter to output (mA range).',
      },
      {
        step: 4,
        title: 'Zero Calibration',
        instruction: 'Set RTD simulator to 0°C (100Ω). Wait 3 minutes for stabilization. Adjust zero potentiometer until output reads 4.00mA.',
        expectedResult: 'Output = 4.00mA ±0.02mA',
      },
      {
        step: 5,
        title: 'Span Calibration',
        instruction: 'Set RTD simulator to maximum range (e.g., 100°C = 138.50Ω for PT100). Wait 3 minutes. Adjust span until output reads 20.00mA.',
        expectedResult: 'Output = 20.00mA ±0.02mA',
      },
      {
        step: 6,
        title: 'Verify Linearity',
        instruction: 'Test at 25%, 50%, 75% points. Record all readings.',
        expectedResult: 'All readings within ±0.1% of span',
      },
      {
        step: 7,
        title: 'Documentation',
        instruction: 'Apply calibration sticker with date and technician name. Record as-left values.',
      },
    ],
  },
  scale: {
    equipmentType: 'scale',
    title: 'Industrial Scale Calibration',
    estimatedTime: '60-90 minutes',
    requiredTools: ['Certified weights', 'Weight cart', 'Torque wrench', 'Clean cloth'],
    safetyWarnings: [
      'Heavy weight hazard',
      'Do not exceed rated capacity',
      'Secure weights before moving',
    ],
    steps: [
      {
        step: 1,
        title: 'Preparation',
        instruction: 'Level the scale using built-in level indicator. Adjust feet as needed. Clean platform.',
        expectedResult: 'Scale is level within ±1°',
      },
      {
        step: 2,
        title: 'Zero Check',
        instruction: 'With no load, verify display reads zero. Press tare/zero if needed.',
        expectedResult: 'Display reads 0.00',
      },
      {
        step: 3,
        title: 'Corner Load Test',
        instruction: 'Place test weight (25% capacity) at each corner and center. Record readings.',
        expectedResult: 'All readings within tolerance (±0.1% for commercial scale)',
      },
      {
        step: 4,
        title: 'Linearity Test',
        instruction: 'Apply weights at 25%, 50%, 75%, and 100% of capacity. Record each reading.',
        expectedResult: 'All readings within ±0.1% of applied weight',
      },
      {
        step: 5,
        title: 'Repeatability Test',
        instruction: 'Apply same weight 5 times. Calculate standard deviation.',
        expectedResult: 'Standard deviation < 0.1% of reading',
      },
      {
        step: 6,
        title: 'Adjustment',
        instruction: 'If out of tolerance, adjust calibration potentiometer or consult manual for software calibration.',
      },
      {
        step: 7,
        title: 'Certification',
        instruction: 'Apply calibration sticker with date, next due date, and certificate number.',
      },
    ],
  },
  flow_meter: {
    equipmentType: 'flow_meter',
    title: 'Electromagnetic Flow Meter Calibration',
    estimatedTime: '45-60 minutes',
    requiredTools: ['Amprobe', 'Process calibrator', 'Wire strippers', 'Documentation'],
    safetyWarnings: [
      'Electrical isolation required',
      'Process piping may contain hazardous fluids',
      'Confined space precautions if applicable',
    ],
    steps: [
      {
        step: 1,
        title: 'Visual Inspection',
        instruction: 'Inspect electrode tips for buildup or damage. Check grounding rings and liner condition.',
        expectedResult: 'No visible damage or excessive buildup',
      },
      {
        step: 2,
        title: 'Electrical Checks',
        instruction: 'Measure coil resistance (should be per nameplate). Check electrode circuit resistance (should be >20MΩ).',
        expectedResult: 'Coil: ±10% of nameplate. Electrode: >20MΩ to ground',
      },
      {
        step: 3,
        title: 'Empty Pipe Check',
        instruction: 'With pipe empty, verify zero flow reading. If not zero, perform zero adjustment per manual.',
        expectedResult: 'Reads 0.00 ±0.5% of full scale',
      },
      {
        step: 4,
        title: 'Signal Check',
        instruction: 'Connect amprobe to output. Verify 4mA at zero flow, 20mA at full scale.',
        expectedResult: '4.00mA and 20.00mA ±0.1mA',
      },
      {
        step: 5,
        title: 'Grounding Check',
        instruction: 'Verify proper grounding to pipe flanges and signal cable shield.',
      },
      {
        step: 6,
        title: 'Documentation',
        instruction: 'Record all readings. Apply calibration sticker.',
      },
    ],
  },
}

export class CalibrationGuideService {
  public getGuide(equipmentType: string, standard?: string): CalibrationGuide | null {
    const normalizedType = equipmentType.toLowerCase().replace(/\s+/g, '_')
    return CALIBRATION_GUIDES[normalizedType] || null
  }

  public getAvailableCalibrations(): string[] {
    return Object.keys(CALIBRATION_GUIDES)
  }

  public getStepsSummary(equipmentType: string): { step: number; title: string }[] | null {
    const guide = this.getGuide(equipmentType)
    if (!guide) return null

    return guide.steps.map((s) => ({ step: s.step, title: s.title }))
  }
}
