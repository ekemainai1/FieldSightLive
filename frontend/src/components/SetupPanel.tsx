'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/services/api-client'

interface Technician {
  id: string
  name: string
  email: string
  role: 'admin' | 'technician' | 'viewer'
}

interface Site {
  id: string
  name: string
  type: 'oil_gas' | 'power' | 'telecom' | 'manufacturing' | 'solar'
}

interface SetupPanelProps {
  technicianId: string
  siteId: string
  onTechnicianChange: (id: string) => void
  onSiteChange: (id: string) => void
}

export function SetupPanel({
  technicianId,
  siteId,
  onTechnicianChange,
  onSiteChange,
}: SetupPanelProps) {
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newTechName, setNewTechName] = useState('')
  const [newTechEmail, setNewTechEmail] = useState('')
  const [newSiteName, setNewSiteName] = useState('')
  const [newSiteType, setNewSiteType] = useState<Site['type']>('power')

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const [techs, fetchedSites] = await Promise.all([
        apiRequest<Technician[]>('/api/v1/technicians'),
        apiRequest<Site[]>('/api/v1/sites'),
      ])
      setTechnicians(techs)
      setSites(fetchedSites)

      if (!technicianId && techs.length > 0) {
        onTechnicianChange(techs[0].id)
      }
      if (!siteId && fetchedSites.length > 0) {
        onSiteChange(fetchedSites[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load setup data')
    } finally {
      setLoading(false)
    }
  }

  async function createTechnician() {
    if (!newTechName || !newTechEmail) return
    setLoading(true)
    setError(null)
    try {
      const created = await apiRequest<Technician>('/api/v1/technicians', {
        method: 'POST',
        body: {
          name: newTechName,
          email: newTechEmail,
          role: 'technician',
        },
      })
      const updated = [created, ...technicians]
      setTechnicians(updated)
      onTechnicianChange(created.id)
      setNewTechName('')
      setNewTechEmail('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create technician')
    } finally {
      setLoading(false)
    }
  }

  async function createSite() {
    if (!newSiteName) return
    setLoading(true)
    setError(null)
    try {
      const created = await apiRequest<Site>('/api/v1/sites', {
        method: 'POST',
        body: {
          name: newSiteName,
          type: newSiteType,
          location: {
            latitude: 0,
            longitude: 0,
          },
          technicianIds: technicianId ? [technicianId] : [],
        },
      })
      const updated = [created, ...sites]
      setSites(updated)
      onSiteChange(created.id)
      setNewSiteName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create site')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Setup</h2>
        <button
          onClick={() => void loadData()}
          className="text-xs px-2 py-1 rounded bg-secondary hover:bg-secondary/80"
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Technician</label>
          <select
            className="w-full rounded border px-2 py-2 text-sm"
            value={technicianId}
            onChange={(e) => onTechnicianChange(e.target.value)}
          >
            <option value="">Select technician</option>
            {technicians.map((tech) => (
              <option key={tech.id} value={tech.id}>
                {tech.name} ({tech.email})
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded border px-2 py-1 text-xs"
              placeholder="Name"
              value={newTechName}
              onChange={(e) => setNewTechName(e.target.value)}
            />
            <input
              className="flex-1 rounded border px-2 py-1 text-xs"
              placeholder="Email"
              value={newTechEmail}
              onChange={(e) => setNewTechEmail(e.target.value)}
            />
            <button
              onClick={() => void createTechnician()}
              className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground"
              disabled={loading}
            >
              Add
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Site</label>
          <select
            className="w-full rounded border px-2 py-2 text-sm"
            value={siteId}
            onChange={(e) => onSiteChange(e.target.value)}
          >
            <option value="">Select site</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name} ({site.type})
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded border px-2 py-1 text-xs"
              placeholder="Site name"
              value={newSiteName}
              onChange={(e) => setNewSiteName(e.target.value)}
            />
            <select
              className="rounded border px-2 py-1 text-xs"
              value={newSiteType}
              onChange={(e) => setNewSiteType(e.target.value as Site['type'])}
            >
              <option value="power">power</option>
              <option value="oil_gas">oil_gas</option>
              <option value="telecom">telecom</option>
              <option value="manufacturing">manufacturing</option>
              <option value="solar">solar</option>
            </select>
            <button
              onClick={() => void createSite()}
              className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground"
              disabled={loading}
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
