import { useState, useCallback, useEffect } from 'react'

export interface GeoPosition {
  latitude: number
  longitude: number
  altitude?: number | null
  accuracy: number | null
  heading: number | null
  speed: number | null
  timestamp: number
}

export interface UseGPSReturn {
  position: GeoPosition | null
  error: string | null
  isLoading: boolean
  isSupported: boolean
  requestLocation: () => Promise<GeoPosition | null>
  watchPosition: () => void
  clearWatch: () => void
}

export function useGPS(): UseGPSReturn {
  const [position, setPosition] = useState<GeoPosition | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [watchId, setWatchId] = useState<number | null>(null)

  useEffect(() => {
    setIsSupported('geolocation' in navigator)
  }, [])

  const requestLocation = useCallback(async (): Promise<GeoPosition | null> => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported')
      return null
    }

    setIsLoading(true)
    setError(null)

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const position: GeoPosition = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            altitude: pos.coords.altitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
            timestamp: pos.timestamp,
          }
          setPosition(position)
          setIsLoading(false)
          resolve(position)
        },
        (err) => {
          const errorMessage = err.code === 1
            ? 'Location permission denied'
            : err.code === 2
            ? 'Location unavailable'
            : err.code === 3
            ? 'Location request timeout'
            : 'Failed to get location'
          setError(errorMessage)
          setIsLoading(false)
          resolve(null)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      )
    })
  }, [])

  const watchPosition = useCallback(() => {
    if (!navigator.geolocation || watchId !== null) return

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const position: GeoPosition = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          altitude: pos.coords.altitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        }
        setPosition(position)
        setError(null)
      },
      (err) => {
        setError(`Watch error: ${err.message}`)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    )
    setWatchId(id)
  }, [watchId])

  const clearWatch = useCallback(() => {
    if (watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId)
      setWatchId(null)
    }
  }, [watchId])

  useEffect(() => {
    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [watchId])

  return {
    position,
    error,
    isLoading,
    isSupported,
    requestLocation,
    watchPosition,
    clearWatch,
  }
}
