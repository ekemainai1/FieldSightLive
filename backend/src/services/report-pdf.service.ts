import PDFDocument from 'pdfkit'
import type { InspectionReport } from './firestore-data.service'

export class ReportPdfService {
  public async renderInspectionReportPdf(report: InspectionReport): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48, size: 'A4' })
      const chunks: Buffer[] = []

      doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      doc.fontSize(18).text('FieldSight Live - Inspection Report')
      doc.moveDown(0.5)
      doc.fontSize(10)
      doc.text(`Inspection ID: ${report.inspectionId}`)
      doc.text(`Generated At: ${report.generatedAt.toISOString()}`)
      doc.text(`Status: ${report.status}`)
      doc.text(`Technician ID: ${report.technicianId}`)
      doc.text(`Site ID: ${report.siteId}`)
      doc.text(`Images Captured: ${report.imageCount}`)
      doc.moveDown()

      this.writeSection(doc, 'Summary', [report.summaryText])
      this.writeSection(doc, 'Findings', report.findings)
      this.writeSection(doc, 'Safety Flags', report.safetySummary)
      this.writeSection(doc, 'Workflow Actions', report.workflowSummary)
      this.writeSection(doc, 'Recommended Actions', report.recommendedActions)

      doc.end()
    })
  }

  private writeSection(doc: PDFKit.PDFDocument, title: string, lines: string[]): void {
    doc.fontSize(12).text(title)
    doc.moveDown(0.3)
    const values = lines.length > 0 ? lines : ['None']
    doc.fontSize(10)
    for (const line of values) {
      doc.text(`- ${line}`)
    }
    doc.moveDown()
  }
}
