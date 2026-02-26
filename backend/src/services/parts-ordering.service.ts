export interface PartOrder {
  id: string
  inspectionId: string
  partNumber: string
  quantity: number
  urgency: 'routine' | 'urgent' | 'critical'
  status: 'pending' | 'ordered' | 'shipped' | 'delivered' | 'cancelled'
  notes?: string
  createdAt: string
  updatedAt: string
  externalReferenceId?: string
  estimatedDelivery?: string
}

export interface PartAvailability {
  partNumber: string
  supplier: string
  inStock: boolean
  quantity?: number
  leadTime?: string
  price?: number
}

export class PartsOrderingService {
  private readonly webhookUrl: string | undefined
  private orders: Map<string, PartOrder> = new Map()

  constructor() {
    this.webhookUrl = process.env.PARTS_ORDER_WEBHOOK?.trim()
  }

  public async orderPart(
    inspectionId: string,
    partNumber: string,
    quantity: number,
    urgency: 'routine' | 'urgent' | 'critical' = 'routine',
    notes?: string
  ): Promise<PartOrder> {
    const orderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const now = new Date()
    let estimatedDelivery: string | undefined

    switch (urgency) {
      case 'critical':
        estimatedDelivery = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
        break
      case 'urgent':
        estimatedDelivery = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
        break
      default:
        estimatedDelivery = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    }

    const order: PartOrder = {
      id: orderId,
      inspectionId,
      partNumber,
      quantity,
      urgency,
      status: 'pending',
      notes,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      estimatedDelivery,
    }

    this.orders.set(orderId, order)

    await this.sendOrderToSupplier(order)

    return order
  }

  public getOrder(orderId: string): PartOrder | undefined {
    return this.orders.get(orderId)
  }

  public getOrdersForInspection(inspectionId: string): PartOrder[] {
    return Array.from(this.orders.values()).filter(
      (order) => order.inspectionId === inspectionId
    )
  }

  public async checkAvailability(partNumber: string): Promise<PartAvailability[]> {
    const mockAvailability: PartAvailability[] = [
      {
        partNumber,
        supplier: 'Primary Parts Co.',
        inStock: true,
        quantity: 50,
        leadTime: '1-2 days',
        price: this.estimatePrice(partNumber),
      },
      {
        partNumber,
        supplier: 'FastShip Industrial',
        inStock: true,
        quantity: 25,
        leadTime: '2-3 days',
        price: this.estimatePrice(partNumber) * 1.15,
      },
    ]

    return mockAvailability
  }

  public cancelOrder(orderId: string): PartOrder | null {
    const order = this.orders.get(orderId)
    if (!order) return null

    if (order.status !== 'pending' && order.status !== 'ordered') {
      throw new Error(`Cannot cancel order with status: ${order.status}`)
    }

    order.status = 'cancelled'
    order.updatedAt = new Date().toISOString()
    this.orders.set(orderId, order)

    return order
  }

  private async sendOrderToSupplier(order: PartOrder): Promise<void> {
    if (!this.webhookUrl) return

    const payload = {
      event: 'part_order',
      orderId: order.id,
      inspectionId: order.inspectionId,
      partNumber: order.partNumber,
      quantity: order.quantity,
      urgency: order.urgency,
      notes: order.notes,
      requestedDelivery: order.estimatedDelivery,
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      if (response.ok) {
        order.status = 'ordered'
        order.updatedAt = new Date().toISOString()
        order.externalReferenceId = `PO-${order.id}`
      }

      clearTimeout(timeout)
    } catch {
      order.status = 'pending'
    }
  }

  private estimatePrice(partNumber: string): number {
    const hash = partNumber.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return Math.round((50 + (hash % 500)) * 100) / 100
  }
}
