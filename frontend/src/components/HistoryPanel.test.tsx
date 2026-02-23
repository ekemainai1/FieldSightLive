import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { HistoryPanel } from './HistoryPanel'

const listInspectionsMock = jest.fn()

jest.mock('@/services/inspection-service', () => ({
  inspectionService: {
    listInspections: (...args: unknown[]) => listInspectionsMock(...args),
  },
}))

describe('HistoryPanel', () => {
  beforeEach(() => {
    listInspectionsMock.mockReset()
  })

  it('should load and render inspection history', async () => {
    listInspectionsMock.mockResolvedValue([
      {
        id: 'abc12345xyz',
        status: 'completed',
        timestamp: new Date().toISOString(),
      },
    ])

    const onOpenReport = jest.fn()
    render(
      <HistoryPanel technicianId="tech-1" siteId="site-1" onOpenReport={onOpenReport} />,
    )

    await waitFor(() => {
      expect(screen.getByText('completed')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Open Report'))
    expect(onOpenReport).toHaveBeenCalledWith('abc12345xyz')
  })

  it('should render empty state when no items', async () => {
    listInspectionsMock.mockResolvedValue([])

    render(<HistoryPanel technicianId="" siteId="" onOpenReport={jest.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('No inspections found for current filters.')).toBeInTheDocument()
    })
  })
})
