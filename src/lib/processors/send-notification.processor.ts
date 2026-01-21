/**
 * Component: Send Notification Job Processor
 * Documentation: documentation/backend/services/notifications.md
 *
 * Processes notification jobs by calling NotificationService to send alerts
 * to all enabled backends subscribed to the event.
 */

import { getNotificationService } from '../services/notification.service';
import { RMABLogger } from '../utils/logger';

export interface SendNotificationPayload {
  jobId?: string;
  event: 'request_pending_approval' | 'request_approved' | 'request_available' | 'request_error';
  requestId: string;
  title: string;
  author: string;
  userName: string;
  message?: string;
  timestamp: Date;
}

/**
 * Process send notification job
 * Calls NotificationService to send notifications to all enabled backends
 */
export async function processSendNotification(payload: SendNotificationPayload): Promise<void> {
  const { event, requestId, title, author, userName, message, jobId } = payload;

  const logger = RMABLogger.forJob(jobId, 'SendNotification');

  logger.info(`Processing notification: ${event}`, { requestId });

  try {
    const notificationService = getNotificationService();
    await notificationService.sendNotification({
      event,
      requestId,
      title,
      author,
      userName,
      message,
      timestamp: new Date(),
    });

    logger.info(`Notification processed: ${event}`, { requestId });
  } catch (error) {
    logger.error('Failed to process notification', {
      event,
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - non-blocking
  }
}
