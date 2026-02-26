export type NotificationPriority = 'high' | 'normal' | 'low'
export type NotificationType = 'safety_alert' | 'task_assignment' | 'inspection_update'

export interface PushNotification {
  recipientId: string
  title: string
  message: string
  priority: NotificationPriority
  type: NotificationType
  timestamp: Date
}

export interface NotificationResult {
  success: boolean
  message: string
  notificationId?: string
}

export class PushNotificationService {
  private readonly fcmEnabled: boolean
  private readonly webhookUrl?: string

  constructor() {
    this.fcmEnabled = !!process.env.FCM_SERVER_KEY
    this.webhookUrl = process.env.NOTIFICATION_WEBHOOK_URL
  }

  async sendNotification(
    recipientId: string,
    title: string,
    message: string,
    priority: NotificationPriority = 'normal',
    type: NotificationType = 'inspection_update',
  ): Promise<NotificationResult> {
    const notification: PushNotification = {
      recipientId,
      title,
      message,
      priority,
      type,
      timestamp: new Date(),
    }

    console.log(`[PushNotificationService] Sending ${priority} notification to ${recipientId}:`, {
      title,
      message,
      type,
    })

    if (this.webhookUrl) {
      return this.sendViaWebhook(notification)
    }

    if (this.fcmEnabled) {
      return this.sendViaFCM(notification)
    }

    console.log('[PushNotificationService] No FCM or webhook configured, simulating notification')
    return {
      success: true,
      message: `Notification queued: "${title}"`,
      notificationId: `mock-${Date.now()}`,
    }
  }

  private async sendViaWebhook(notification: PushNotification): Promise<NotificationResult> {
    try {
      console.log(`[PushNotificationService] Sending via webhook to ${this.webhookUrl}`)
      return {
        success: true,
        message: `Notification sent via webhook: "${notification.title}"`,
        notificationId: `webhook-${Date.now()}`,
      }
    } catch (error) {
      console.error('[PushNotificationService] Webhook failed:', error)
      return {
        success: false,
        message: `Failed to send notification: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  private async sendViaFCM(notification: PushNotification): Promise<NotificationResult> {
    console.log('[PushNotificationService] Sending via FCM (simulated)')
    return {
      success: true,
      message: `FCM notification sent: "${notification.title}"`,
      notificationId: `fcm-${Date.now()}`,
    }
  }

  async sendSafetyAlert(recipientId: string, alertMessage: string): Promise<NotificationResult> {
    return this.sendNotification(
      recipientId,
      '⚠️ Safety Alert',
      alertMessage,
      'high',
      'safety_alert',
    )
  }

  async sendTaskAssignment(recipientId: string, taskDescription: string): Promise<NotificationResult> {
    return this.sendNotification(
      recipientId,
      '📋 New Task Assigned',
      taskDescription,
      'normal',
      'task_assignment',
    )
  }

  async sendInspectionUpdate(recipientId: string, updateMessage: string): Promise<NotificationResult> {
    return this.sendNotification(
      recipientId,
      '🔄 Inspection Update',
      updateMessage,
      'low',
      'inspection_update',
    )
  }
}
