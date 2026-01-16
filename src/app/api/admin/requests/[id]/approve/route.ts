/**
 * Component: Admin Request Approval API
 * Documentation: documentation/admin-features/request-approval.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db';
import { getJobQueueService } from '@/lib/services/job-queue.service';
import { RMABLogger } from '@/lib/utils/logger';
import { z } from 'zod';

const logger = RMABLogger.create('API.Admin.Requests.Approve');

const ApprovalActionSchema = z.object({
  action: z.enum(['approve', 'deny']),
});

/**
 * POST /api/admin/requests/[id]/approve
 * Approve or deny a request in 'awaiting_approval' status
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return requireAuth(request, async (req: AuthenticatedRequest) => {
    return requireAdmin(req, async () => {
      try {
        if (!req.user) {
          return NextResponse.json(
            { error: 'Unauthorized', message: 'User not authenticated' },
            { status: 401 }
          );
        }

        const { id } = await params;
        const body = await request.json();

        // Validate action
        const { action } = ApprovalActionSchema.parse(body);

        // Fetch the request
        const existingRequest = await prisma.request.findUnique({
          where: { id },
          include: {
            audiobook: true,
            user: {
              select: {
                id: true,
                plexUsername: true,
              },
            },
          },
        });

        if (!existingRequest) {
          return NextResponse.json(
            { error: 'NotFound', message: 'Request not found' },
            { status: 404 }
          );
        }

        // Validate request is in 'awaiting_approval' status
        if (existingRequest.status !== 'awaiting_approval') {
          return NextResponse.json(
            {
              error: 'InvalidStatus',
              message: `Request is not awaiting approval (current status: ${existingRequest.status})`,
              currentStatus: existingRequest.status,
            },
            { status: 400 }
          );
        }

        // Update request based on action
        if (action === 'approve') {
          // Approve: Change status to 'pending' and trigger search job
          const updatedRequest = await prisma.request.update({
            where: { id },
            data: { status: 'pending' },
            include: {
              audiobook: true,
              user: {
                select: {
                  id: true,
                  plexUsername: true,
                },
              },
            },
          });

          // Trigger search job
          const jobQueue = getJobQueueService();
          await jobQueue.addSearchJob(updatedRequest.id, {
            id: updatedRequest.audiobook.id,
            title: updatedRequest.audiobook.title,
            author: updatedRequest.audiobook.author,
            asin: updatedRequest.audiobook.audibleAsin || undefined,
          });

          logger.info(`Request ${id} approved by admin ${req.user.sub}`, {
            requestId: id,
            userId: updatedRequest.userId,
            audiobookTitle: updatedRequest.audiobook.title,
            adminId: req.user.sub,
          });

          return NextResponse.json({
            success: true,
            message: 'Request approved and search job triggered',
            request: updatedRequest,
          });
        } else {
          // Deny: Change status to 'denied'
          const updatedRequest = await prisma.request.update({
            where: { id },
            data: { status: 'denied' },
            include: {
              audiobook: true,
              user: {
                select: {
                  id: true,
                  plexUsername: true,
                },
              },
            },
          });

          logger.info(`Request ${id} denied by admin ${req.user.sub}`, {
            requestId: id,
            userId: updatedRequest.userId,
            audiobookTitle: updatedRequest.audiobook.title,
            adminId: req.user.sub,
          });

          return NextResponse.json({
            success: true,
            message: 'Request denied',
            request: updatedRequest,
          });
        }
      } catch (error) {
        logger.error('Failed to process approval action', {
          error: error instanceof Error ? error.message : String(error)
        });

        if (error instanceof z.ZodError) {
          return NextResponse.json(
            {
              error: 'ValidationError',
              message: 'Invalid action. Must be "approve" or "deny"',
              details: error.errors,
            },
            { status: 400 }
          );
        }

        return NextResponse.json(
          {
            error: 'ApprovalError',
            message: 'Failed to process approval action',
          },
          { status: 500 }
        );
      }
    });
  });
}
