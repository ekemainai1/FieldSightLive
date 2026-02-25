import { logger } from '../utils/logger'

export interface CacheOptions {
  ttlMs?: number
  maxSize?: number
}

export class NodeCache<T> {
  private cache: Map<string, { value: T; expiresAt: number }> = new Map()
  private readonly ttlMs: number
  private readonly maxSize: number
  private hits = 0
  private misses = 0

  constructor(options: CacheOptions = {}) {
    this.ttlMs = options.ttlMs ?? 60 * 1000
    this.maxSize = options.maxSize ?? 1000
  }

  public set(key: string, value: T, ttlMs?: number): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) this.cache.delete(firstKey)
    }

    const expiresAt = Date.now() + (ttlMs ?? this.ttlMs)
    this.cache.set(key, { value, expiresAt })
  }

  public get(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) {
      this.misses++
      return undefined
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      this.misses++
      return undefined
    }

    this.hits++
    return entry.value
  }

  public has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return false
    }
    return true
  }

  public delete(key: string): void {
    this.cache.delete(key)
  }

  public clear(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
  }

  public cleanup(): number {
    const now = Date.now()
    let cleaned = 0
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
        cleaned++
      }
    }
    return cleaned
  }

  public stats(): { hits: number; misses: number; size: number; hitRate: number } {
    const total = this.hits + this.misses
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      hitRate: total > 0 ? this.hits / total : 0,
    }
  }
}

let technicianCache: NodeCache<unknown> | null = null
let siteCache: NodeCache<unknown> | null = null

export function getTechnicianCache(): NodeCache<unknown> {
  if (!technicianCache) {
    technicianCache = new NodeCache({ ttlMs: 5 * 60 * 1000, maxSize: 100 })
    setInterval(() => {
      const cleaned = technicianCache!.cleanup()
      if (cleaned > 0) {
        logger.debug(`Technician cache cleaned: ${cleaned} entries`)
      }
    }, 60 * 1000)
  }
  return technicianCache
}

export function getSiteCache(): NodeCache<unknown> {
  if (!siteCache) {
    siteCache = new NodeCache({ ttlMs: 5 * 60 * 1000, maxSize: 100 })
    setInterval(() => {
      const cleaned = siteCache!.cleanup()
      if (cleaned > 0) {
        logger.debug(`Site cache cleaned: ${cleaned} entries`)
      }
    }, 60 * 1000)
  }
  return siteCache
}
