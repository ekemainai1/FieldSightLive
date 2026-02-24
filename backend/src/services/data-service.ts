import type {
  DetectedFault,
  Inspection,
  OcrFinding,
  SafetyFlag,
  Site,
  SiteAsset,
  Technician,
  WorkflowEvent,
} from '../types'
import type { InspectionReport } from './firestore-data.service'

interface ListInspectionFilters {
  technicianId?: string
  siteId?: string
  status?: 'in_progress' | 'completed'
}

interface UpdateInspectionStatusInput {
  status: 'in_progress' | 'completed'
  summary?: string
}

export interface DataService {
  createTechnician: (
    input: Omit<Technician, 'id' | 'createdAt' | 'updatedAt'>,
  ) => Promise<Technician>
  listTechnicians: () => Promise<Technician[]>
  createSite: (input: Omit<Site, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Site>
  listSites: () => Promise<Site[]>
  createInspection: (input: { technicianId: string; siteId: string }) => Promise<Inspection>
  getInspectionById: (id: string) => Promise<Inspection | null>
  listInspections: (filters: ListInspectionFilters) => Promise<Inspection[]>
  updateInspectionStatus: (
    inspectionId: string,
    input: UpdateInspectionStatusInput,
  ) => Promise<Inspection | null>
  appendInspectionSafetyFlags: (inspectionId: string, flags: SafetyFlag[]) => Promise<void>
  appendInspectionDetectedFaults: (inspectionId: string, faults: DetectedFault[]) => Promise<void>
  appendInspectionTranscript: (inspectionId: string, entry: string) => Promise<void>
  appendInspectionImage: (inspectionId: string, imageUrl: string) => Promise<void>
  appendInspectionOcrFinding: (
    inspectionId: string,
    finding: Omit<OcrFinding, 'createdAt'>,
  ) => Promise<void>
  appendInspectionWorkflowEvent: (
    inspectionId: string,
    event: Omit<WorkflowEvent, 'id' | 'createdAt'>,
  ) => Promise<WorkflowEvent>
  generateInspectionReport: (inspectionId: string) => Promise<InspectionReport | null>
  getInspectionReport: (inspectionId: string) => Promise<InspectionReport | null>
  createSiteAsset: (input: Omit<SiteAsset, 'id' | 'createdAt' | 'updatedAt'>) => Promise<SiteAsset>
  listSiteAssets: (siteId: string) => Promise<SiteAsset[]>
  deleteSiteAsset: (assetId: string) => Promise<void>
}
