import { fireEvent, render, screen } from '@testing-library/react'
import { ReportPanel } from './ReportPanel'

describe('ReportPanel', () => {
  it('should render empty state when no report', () => {
    render(<ReportPanel report={null} onRefresh={jest.fn()} onDownloadPdf={jest.fn()} />)

    expect(
      screen.getByText('Complete an inspection to preview and download the generated report.'),
    ).toBeInTheDocument()
  })

  it('should render report details and invoke actions', () => {
    const onRefresh = jest.fn()
    const onDownloadPdf = jest.fn()

    render(
      <ReportPanel
        report={{
          inspectionId: 'inspection-123',
          generatedAt: new Date().toISOString(),
          status: 'completed',
          findings: ['Valve misalignment'],
          safetySummary: ['HIGH - PPE missing'],
          recommendedActions: ['Wear gloves'],
          imageCount: 2,
          summaryText: 'Inspection summary text',
        }}
        onRefresh={onRefresh}
        onDownloadPdf={onDownloadPdf}
      />,
    )

    expect(screen.getByText('Inspection summary text')).toBeInTheDocument()
    expect(screen.getByText('Valve misalignment')).toBeInTheDocument()
    expect(screen.getByText('HIGH - PPE missing')).toBeInTheDocument()
    expect(screen.getByText('Wear gloves')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Refresh'))
    fireEvent.click(screen.getByText('Download PDF'))

    expect(onRefresh).toHaveBeenCalledTimes(1)
    expect(onDownloadPdf).toHaveBeenCalledTimes(1)
  })
})
