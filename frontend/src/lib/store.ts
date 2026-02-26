import { create } from 'zustand'

export interface SafetyFlag {
  type: 'missing_ppe' | 'dangerous_proximity' | 'leak' | 'spark' | 'exposed_wire' | 'slippery_surface' | 'open_flame'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  timestamp: number
}

export interface DetectedFault {
  component: string
  faultType: string
  confidence: number
  description: string
  recommendedActions: string[]
}

export interface TranscriptMessage {
  id: string
  type: 'user' | 'agent' | 'system'
  text: string
  timestamp: number
}

export interface Inspection {
  id: string
  technicianId: string
  siteId: string
  status: 'idle' | 'active' | 'paused' | 'completed'
  startTime: number | null
  endTime: number | null
}

export interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'technician' | 'viewer'
}

export interface WorkspaceSelection {
  technicianId: string
  siteId: string
}

let idCounter = 0
const generateId = () => {
  idCounter += 1
  return `${Date.now()}_${idCounter}`
}

export type Theme = 'light' | 'dark' | 'system'

export type Language = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'zh' | 'ja' | 'ko' | 'ar' | 'hi'

export type VideoQuality = 'low' | 'medium' | 'high' | 'auto'

interface AppState {
  // Theme
  theme: Theme
  setTheme: (theme: Theme) => void
  
  // Language
  language: Language
  setLanguage: (language: Language) => void
  
  // Video Quality
  videoQuality: VideoQuality
  setVideoQuality: (quality: VideoQuality) => void
  
  // Offline Sync
  pendingOfflineCount: number
  setPendingOfflineCount: (count: number) => void
  isSyncing: boolean
  setIsSyncing: (syncing: boolean) => void
  
  // Session
  sessionId: string | null
  setSessionId: (id: string | null) => void
  
  // Connection
  isConnected: boolean
  setConnected: (connected: boolean) => void
  
  // Inspection
  inspection: Inspection
  startInspection: (technicianId: string, siteId: string) => void
  pauseInspection: () => void
  resumeInspection: () => void
  endInspection: () => void
  
  // Transcript
  messages: TranscriptMessage[]
  addMessage: (message: Omit<TranscriptMessage, 'id' | 'timestamp'>) => void
  clearMessages: () => void
  
  // Safety & Faults
  safetyFlags: SafetyFlag[]
  detectedFaults: DetectedFault[]
  addSafetyFlag: (flag: SafetyFlag) => void
  addDetectedFault: (fault: DetectedFault) => void
  clearSafetyData: () => void
  
  // User
  user: User | null
  setUser: (user: User | null) => void

  // Workspace Selection
  selection: WorkspaceSelection
  setTechnicianId: (id: string) => void
  setSiteId: (id: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  // Theme
  theme: 'system',
  setTheme: (theme) => {
    set({ theme })
    if (typeof window !== 'undefined') {
      const root = document.documentElement
      if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
      localStorage.setItem('fieldsightlive.theme', theme)
    }
  },
  
  // Language
  language: 'en',
  setLanguage: (language) => {
    set({ language })
    if (typeof window !== 'undefined') {
      localStorage.setItem('fieldsightlive.language', language)
    }
  },
  
  // Video Quality
  videoQuality: 'auto',
  setVideoQuality: (quality) => {
    set({ videoQuality: quality })
    if (typeof window !== 'undefined') {
      localStorage.setItem('fieldsightlive.videoQuality', quality)
    }
  },
  
  // Offline Sync
  pendingOfflineCount: 0,
  setPendingOfflineCount: (count) => set({ pendingOfflineCount: count }),
  isSyncing: false,
  setIsSyncing: (syncing) => set({ isSyncing: syncing }),
  
  // Session
  sessionId: null,
  setSessionId: (id) => set({ sessionId: id }),
  
  // Connection
  isConnected: false,
  setConnected: (connected) => set({ isConnected: connected }),
  
  // Inspection
  inspection: {
    id: '',
    technicianId: '',
    siteId: '',
    status: 'idle',
    startTime: null,
    endTime: null,
  },
  startInspection: (technicianId, siteId) => set({
    inspection: {
      id: `inspection_${Date.now()}`,
      technicianId,
      siteId,
      status: 'active',
      startTime: Date.now(),
      endTime: null,
    },
  }),
  pauseInspection: () => set((state) => ({
    inspection: { ...state.inspection, status: 'paused' },
  })),
  resumeInspection: () => set((state) => ({
    inspection: { ...state.inspection, status: 'active' },
  })),
  endInspection: () => set((state) => ({
    inspection: { 
      ...state.inspection, 
      status: 'completed', 
      endTime: Date.now() 
    },
  })),
  
  // Transcript
  messages: [],
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, {
      ...message,
      id: generateId(),
      timestamp: Date.now(),
    }],
  })),
  clearMessages: () => set({ messages: [] }),
  
  // Safety & Faults
  safetyFlags: [],
  detectedFaults: [],
  addSafetyFlag: (flag) => set((state) => ({
    safetyFlags: [...state.safetyFlags, flag],
  })),
  addDetectedFault: (fault) => set((state) => ({
    detectedFaults: [...state.detectedFaults, fault],
  })),
  clearSafetyData: () => set({ safetyFlags: [], detectedFaults: [] }),
  
  // User
  user: null,
  setUser: (user) => set({ user }),

  // Workspace Selection
  selection: {
    technicianId: process.env.NEXT_PUBLIC_DEFAULT_TECHNICIAN_ID || '',
    siteId: process.env.NEXT_PUBLIC_DEFAULT_SITE_ID || '',
  },
  setTechnicianId: (id) => set((state) => ({
    selection: {
      ...state.selection,
      technicianId: id,
    },
  })),
  setSiteId: (id) => set((state) => ({
    selection: {
      ...state.selection,
      siteId: id,
    },
  })),
}))
