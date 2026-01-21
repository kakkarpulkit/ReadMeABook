/**
 * Component: Notification Test API
 * Documentation: documentation/backend/services/notifications.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '@/lib/middleware/auth';
import { getNotificationService, NotificationBackendType, NotificationPayload } from '@/lib/services/notification.service';
import { RMABLogger } from '@/lib/utils/logger';
import { z } from 'zod';

const logger = RMABLogger.create('API.Admin.Notifications.Test');

const TestNotificationSchema = z.object({
  type: z.enum(['discord', 'pushover', 'email', 'slack', 'telegram', 'webhook']),
  config: z.record(z.any()),
});

/**
 * POST /api/admin/notifications/test
 * Test notification with provided config (synchronous)
 */
export async function POST(request: NextRequest) {
  return requireAuth(request, async (req: AuthenticatedRequest) => {
    return requireAdmin(req, async () => {
      try {
        const body = await request.json();
        const { type, config } = TestNotificationSchema.parse(body);

        const notificationService = getNotificationService();

        // Encrypt config values
        const encryptedConfig = notificationService.encryptConfig(type, config);

        // Create test payload
        const testPayload: NotificationPayload = {
          event: 'request_available',
          requestId: 'test-request-id',
          title: "The Hitchhiker's Guide to the Galaxy",
          author: 'Douglas Adams',
          userName: 'Test User',
          timestamp: new Date(),
        };

        // Send test notification synchronously (not via job queue)
        try {
          // Call sendToBackend directly
          await (notificationService as any).sendToBackend(type, encryptedConfig, testPayload);

          logger.info(`Test notification sent successfully for ${type}`, {
            adminId: req.user?.sub,
          });

          return NextResponse.json({
            success: true,
            message: 'Test notification sent successfully',
          });
        } catch (notificationError) {
          logger.error(`Test notification failed for ${type}`, {
            error: notificationError instanceof Error ? notificationError.message : String(notificationError),
            adminId: req.user?.sub,
          });

          return NextResponse.json(
            {
              error: 'NotificationError',
              message: notificationError instanceof Error ? notificationError.message : 'Failed to send test notification',
            },
            { status: 400 }
          );
        }
      } catch (error) {
        logger.error('Failed to test notification', {
          error: error instanceof Error ? error.message : String(error),
        });

        if (error instanceof z.ZodError) {
          return NextResponse.json(
            {
              error: 'ValidationError',
              details: error.errors,
            },
            { status: 400 }
          );
        }

        return NextResponse.json(
          {
            error: 'TestError',
            message: 'Failed to test notification',
          },
          { status: 500 }
        );
      }
    });
  });
}
