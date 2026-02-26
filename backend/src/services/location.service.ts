export interface GeoLocation {
  latitude: number
  longitude: number
  altitude?: number
  accuracy?: number
  timestamp: Date
}

export interface LocationTag {
  inspectionId: string
  label?: string
  location: GeoLocation
  createdAt: Date
}

export class LocationService {
  async captureLocation(inspectionId: string, label?: string): Promise<LocationTag> {
    const mockLocation: GeoLocation = {
      latitude: 37.7749 + (Math.random() - 0.5) * 0.01,
      longitude: -122.4194 + (Math.random() - 0.5) * 0.01,
      altitude: Math.random() * 100,
      accuracy: 5 + Math.random() * 10,
      timestamp: new Date(),
    }

    console.log(`[LocationService] Captured location for inspection ${inspectionId}:`, mockLocation)

    return {
      inspectionId,
      label,
      location: mockLocation,
      createdAt: new Date(),
    }
  }

  async getLocationHistory(inspectionId: string): Promise<LocationTag[]> {
    console.log(`[LocationService] Getting location history for inspection ${inspectionId}`)
    return []
  }

  async calculateDistance(loc1: GeoLocation, loc2: GeoLocation): Promise<number> {
    const R = 6371e3
    const φ1 = (loc1.latitude * Math.PI) / 180
    const φ2 = (loc2.latitude * Math.PI) / 180
    const Δφ = ((loc2.latitude - loc1.latitude) * Math.PI) / 180
    const Δλ = ((loc2.longitude - loc1.longitude) * Math.PI) / 180

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }
}
