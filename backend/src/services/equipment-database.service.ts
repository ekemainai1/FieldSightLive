export interface EquipmentManual {
  equipmentType: string
  title: string
  sections: ManualSection[]
}

export interface ManualSection {
  title: string
  content: string
  subsections?: { title: string; content: string }[]
  warnings?: string[]
}

const EQUIPMENT_MANUALS: Record<string, EquipmentManual> = {
  pump: {
    equipmentType: 'pump',
    title: 'Centrifugal Pump Manual',
    sections: [
      {
        title: 'Safety Precautions',
        content: 'Always wear appropriate PPE. Lockout/tagout before maintenance. Release pressure before opening.',
        warnings: ['Never operate without proper priming', 'Check for leaks regularly', 'Ensure coupling guards are in place'],
      },
      {
        title: 'Installation',
        content: 'Install on level foundation. Align pump and motor shafts. Connect suction and discharge pipes.',
        subsections: [
          { title: 'Foundation', content: 'Concrete foundation must be level within 0.005"/ft.' },
          { title: 'Alignment', content: 'Use laser alignment for precision. misalignment < 0.002"' },
          { title: 'Piping', content: 'Suction pipe should be at least pipe diameter + 3 pipe diameters from elbow.' },
        ],
      },
      {
        title: 'Operation',
        content: 'Start with valve partially open. Monitor pressure and temperature. Check for vibration.',
        subsections: [
          { title: 'Startup', content: 'Open suction valve, close discharge valve, start motor, slowly open discharge.' },
          { title: 'Operating Ranges', content: 'Flow: 50-120% of BEP. Head: ±10% of design. NPSH available > NPSH required.' },
        ],
      },
      {
        title: 'Maintenance',
        content: 'Daily: Check oil level, temperature, vibration. Weekly: Grease bearings. Monthly: Check alignment.',
        subsections: [
          { title: 'Bearing Lubrication', content: 'Use specified grease. Over-lubrication causes overheating.' },
          { title: 'Seal Maintenance', content: 'Check for leaks. Replace seal if leaking.' },
        ],
      },
      {
        title: 'Troubleshooting',
        content: 'Common issues: no flow, low flow, high power consumption, noise, vibration.',
        subsections: [
          { title: 'No Flow', content: 'Check: priming, suction pipe leak, valve closed, NPSH insufficient.' },
          { title: 'Low Flow', content: 'Check: partially closed valve, impeller wear, obstruction in pipe.' },
          { title: 'High Power', content: 'Check: viscosity too high, specific gravity, impeller rubbing.' },
        ],
      },
    ],
  },
  motor: {
    equipmentType: 'motor',
    title: 'Electric Motor Manual',
    sections: [
      {
        title: 'Safety Precautions',
        content: 'Lockout/tagout before work. Wait 5 minutes after disconnect for capacitor discharge.',
        warnings: ['Never bypass overload protection', 'Ensure proper grounding', 'Check rotation before loading'],
      },
      {
        title: 'Installation',
        content: 'Mount on level surface. Check alignment with driven equipment. Connect according to nameplate.',
        subsections: [
          { title: 'Electrical Connection', content: 'Verify voltage, phase, frequency matches supply.' },
          { title: 'Grounding', content: 'Connect ground wire to designated terminal.' },
        ],
      },
      {
        title: 'Operation',
        content: 'Start under no load. Monitor current draw. Check temperature.',
        subsections: [
          { title: 'Startup', content: 'Verify rotation direction. Listen for unusual sounds.' },
          { title: 'Operating Temp', content: 'Ambient + 40°C max for Class B. Ambient + 65°C for Class F.' },
        ],
      },
      {
        title: 'Maintenance',
        content: 'Clean vents regularly. Check bearing condition. Test insulation resistance annually.',
        subsections: [
          { title: 'Bearing Replacement', content: 'Replace at first sign of roughness or excessive play.' },
          { title: 'Insulation Testing', content: 'Megger test: minimum 1MΩ per 1000V operating voltage.' },
        ],
      },
      {
        title: 'Troubleshooting',
        content: 'Won\'t start, runs hot, noisy, vibrates.',
        subsections: [
          { title: 'Won\'t Start', content: 'Check: power supply, overload tripped, winding short, bearing seized.' },
          { title: 'Runs Hot', content: 'Check: overload, ventilation blocked, winding short, phase loss.' },
        ],
      },
    ],
  },
  valve: {
    equipmentType: 'valve',
    title: 'Industrial Valve Manual',
    sections: [
      {
        title: 'Safety Precautions',
        content: 'Relieve pressure before maintenance. Wear face shield for pneumatic/hydraulic.',
        warnings: ['Never tighten bolts while system is pressurized', 'Check for toxic/hazardous fluids'],
      },
      {
        title: 'Types & Selection',
        content: 'Ball: quick on/off. Gate: full flow. Globe: throttling. Butterfly: large diameters.',
      },
      {
        title: 'Installation',
        content: 'Install with flow direction correct. Support piping to prevent valve stress.',
        subsections: [
          { title: 'Orientation', content: 'Actuators: vertical for reliable operation. Position indicator visible.' },
        ],
      },
      {
        title: 'Operation',
        content: 'Open/close slowly to avoid water hammer. Use handwheel, not extension.',
      },
      {
        title: 'Maintenance',
        content: 'Cycle valves regularly. Lubricate stem. Check for leaks.',
        subsections: [
          { title: 'Packing', content: 'Tighten gland nuts evenly. Replace packing if leaking persists.' },
          { title: 'Actuators', content: 'Check air pressure, lubricate moving parts, test operation.' },
        ],
      },
      {
        title: 'Troubleshooting',
        content: 'Leaking, hard to operate, won\'t close fully.',
        subsections: [
          { title: 'Leaking', content: 'Tighten bolts, replace stem packing, replace seat.' },
          { title: 'Hard to Operate', content: 'Lubricate stem, check actuator, clear debris.' },
        ],
      },
    ],
  },
  transformer: {
    equipmentType: 'transformer',
    title: 'Power Transformer Manual',
    sections: [
      {
        title: 'Safety Precautions',
        content: 'HIGH VOLTAGE. Only qualified personnel. Arc flash hazard. PPE required.',
        warnings: ['Never approach without proper PPE', 'Wait 5 minutes after de-energizing', 'Ground all terminals'],
      },
      {
        title: 'Specifications',
        content: 'KVA rating, primary/secondary voltage, frequency, impedance, temperature rise.',
      },
      {
        title: 'Installation',
        content: 'Install in ventilated area. Minimum clearances per code. Ground properly.',
        subsections: [
          { title: 'Ventilation', content: 'Air-cooled: 1 ft minimum clearance on all sides.' },
          { title: 'Grounding', content: 'Connect tank to system ground with dedicated conductor.' },
        ],
      },
      {
        title: 'Operation',
        content: 'Monitor load < 80% of rated. Check oil level/temperature. Listen for noise.',
        subsections: [
          { title: 'Loading', content: 'Ambient temp affects capacity. De-rate above 40°C.' },
        ],
      },
      {
        title: 'Maintenance',
        content: 'Monthly: visual inspection, oil level. Annually: DGA, oil test, IR scan.',
        subsections: [
          { title: 'Oil Testing', content: 'Dissolved Gas Analysis (DGA) for fault detection.' },
        ],
      },
      {
        title: 'Troubleshooting',
        content: 'Overheating, noise, gas accumulation.',
        subsections: [
          { title: 'Overheating', content: 'Check: overload, poor ventilation, bad connections, shorted turns.' },
        ],
      },
    ],
  },
  conveyor: {
    equipmentType: 'conveyor',
    title: 'Conveyor System Manual',
    sections: [
      {
        title: 'Safety Precautions',
        content: 'Never ride conveyor. Lockout/tagout before maintenance. Emergency stops clearly marked.',
        warnings: ['Pinch points can amputate', 'Snatch points can entangle', 'Emergency stop every 20ft'],
      },
      {
        title: 'Operation',
        content: 'Start empty. Verify belt tracking. Check belt tension. Monitor motor current.',
      },
      {
        title: 'Maintenance',
        content: 'Daily: check belt tracking, clean spillage. Weekly: lubricate bearings, check tension.',
        subsections: [
          { title: 'Belt Tracking', content: 'Adjust tail pulley or bend-idler position.' },
          { title: 'Tension', content: 'Proper tension: 1-3% elongation for fabric, 0.25% for steel cord.' },
        ],
      },
      {
        title: 'Troubleshooting',
        content: 'Belt slip, belt misaligned, material spillage, motor overload.',
      },
    ],
  },
  hvac: {
    equipmentType: 'hvac',
    title: 'HVAC System Manual',
    sections: [
      {
        title: 'Safety Precautions',
        content: 'Lockout/tagout. Refrigerant handling requires certification. Electrical hazard.',
        warnings: ['Refrigerant is toxic when heated', 'High voltage present', 'Rotating fans'],
      },
      {
        title: 'Components',
        content: 'Compressor, condenser, evaporator, expansion valve, refrigerant, controls.',
      },
      {
        title: 'Operation',
        content: 'Setpoints: cooling 68-72°F, heating 68-72°F. Monitor superheat and subcooling.',
        subsections: [
          { title: 'Startup', content: 'Verify all disconnect switches closed. Start condenser fan first.' },
        ],
      },
      {
        title: 'Maintenance',
        content: 'Monthly: clean filters, check refrigerant. Seasonal: clean coils, check controls.',
        subsections: [
          { title: 'Filters', content: 'Replace or clean every 1-3 months.' },
          { title: 'Refrigerant', content: 'Check sight glass. Charge if needed. Never overcharge.' },
        ],
      },
      {
        title: 'Troubleshooting',
        content: 'No cooling, insufficient cooling, high pressure, low pressure.',
      },
    ],
  },
}

export class EquipmentDatabaseService {
  public getManual(equipmentType: string, serialNumber?: string, topic?: string): EquipmentManual | null {
    const normalizedType = equipmentType.toLowerCase()
    const manual = EQUIPMENT_MANUALS[normalizedType]
    
    if (!manual) {
      return null
    }

    if (topic) {
      const filteredSections = manual.sections.filter(
        (s) => s.title.toLowerCase().includes(topic.toLowerCase())
      )
      return {
        ...manual,
        sections: filteredSections.length > 0 ? filteredSections : manual.sections,
      }
    }

    return manual
  }

  public getAvailableEquipmentTypes(): string[] {
    return Object.keys(EQUIPMENT_MANUALS)
  }

  public searchManuals(query: string): string[] {
    const results: string[] = []
    const lowerQuery = query.toLowerCase()

    for (const [type, manual] of Object.entries(EQUIPMENT_MANUALS)) {
      if (type.includes(lowerQuery) || manual.title.toLowerCase().includes(lowerQuery)) {
        results.push(type)
      }
    }

    return results
  }
}
