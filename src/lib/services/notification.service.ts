/**
 * Component: Notification Service
 * Documentation: documentation/backend/services/notifications.md
 */

import { getEncryptionService } from './encryption.service';
import { RMABLogger } from '../utils/logger';
import { prisma } from '../db';

const logger = RMABLogger.create('NotificationService');

// Event types
export type NotificationEvent =
  | 'request_pending_approval'
  | 'request_approved'
  | 'request_available'
  | 'request_error';

// Backend types
export type NotificationBackendType =
  | 'discord'
  | 'pushover'
  | 'email'
  | 'slack'
  | 'telegram'
  | 'webhook';

// Config interfaces
export interface DiscordConfig {
  webhookUrl: string;
  username?: string;
  avatarUrl?: string;
}

export interface PushoverConfig {
  userKey: string;
  appToken: string;
  device?: string;
  priority?: number;
}

export type NotificationConfig = DiscordConfig | PushoverConfig;

// Notification payload
export interface NotificationPayload {
  event: NotificationEvent;
  requestId: string;
  title: string;
  author: string;
  userName: string;
  message?: string; // For error events
  timestamp: Date;
}

// Discord embed colors by event type
const DISCORD_COLORS = {
  request_pending_approval: 0xfbbf24, // yellow-400
  request_approved: 0x22c55e, // green-500
  request_available: 0x3b82f6, // blue-500
  request_error: 0xef4444, // red-500
};

// Discord embed titles
const DISCORD_TITLES = {
  request_pending_approval: '📬 New Request Pending Approval',
  request_approved: '✅ Request Approved',
  request_available: '🎉 Audiobook Available',
  request_error: '❌ Request Error',
};

// Pushover priorities
const PUSHOVER_PRIORITIES = {
  request_pending_approval: 0, // Normal
  request_approved: 0, // Normal
  request_available: 1, // High
  request_error: 1, // High
};

export class NotificationService {
  private encryptionService = getEncryptionService();

  /**
   * Send notification to all enabled backends subscribed to the event
   */
  async sendNotification(payload: NotificationPayload): Promise<void> {
    try {
      // Get all enabled backends subscribed to this event
      const backends = await prisma.notificationBackend.findMany({
        where: {
          enabled: true,
          events: {
            array_contains: payload.event,
          },
        },
      });

      if (backends.length === 0) {
        logger.debug(`No backends subscribed to event: ${payload.event}`);
        return;
      }

      logger.info(`Sending notification to ${backends.length} backend(s)`, {
        event: payload.event,
        requestId: payload.requestId,
      });

      // Send to all backends in parallel (atomic per-backend)
      const results = await Promise.allSettled(
        backends.map((backend) =>
          this.sendToBackend(backend.type as NotificationBackendType, backend.config, payload)
        )
      );

      // Log results
      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      logger.info(`Notification sent: ${successful} succeeded, ${failed} failed`, {
        event: payload.event,
        requestId: payload.requestId,
      });

      // Log individual failures
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          logger.error(`Failed to send to backend ${backends[index].name}`, {
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
            backend: backends[index].type,
          });
        }
      });
    } catch (error) {
      logger.error('Failed to send notifications', {
        error: error instanceof Error ? error.message : String(error),
        event: payload.event,
        requestId: payload.requestId,
      });
      // Don't throw - non-blocking
    }
  }

  /**
   * Route notification to type-specific sender
   */
  private async sendToBackend(
    type: NotificationBackendType,
    config: any,
    payload: NotificationPayload
  ): Promise<void> {
    // Decrypt config
    const decryptedConfig = this.decryptConfig(config);

    switch (type) {
      case 'discord':
        return this.sendDiscord(decryptedConfig as DiscordConfig, payload);
      case 'pushover':
        return this.sendPushover(decryptedConfig as PushoverConfig, payload);
      default:
        throw new Error(`Unsupported backend type: ${type}`);
    }
  }

  /**
   * Send Discord webhook notification
   */
  private async sendDiscord(config: DiscordConfig, payload: NotificationPayload): Promise<void> {
    const embed = this.formatDiscordEmbed(payload);

    const body = {
      username: config.username || 'ReadMeABook',
      avatar_url: config.avatarUrl,
      embeds: [embed],
    };

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Discord webhook failed: ${response.status} ${errorText}`);
    }
  }

  /**
   * Send Pushover notification
   */
  private async sendPushover(config: PushoverConfig, payload: NotificationPayload): Promise<void> {
    const { title, message } = this.formatPushoverMessage(payload);

    const body = new URLSearchParams({
      token: config.appToken,
      user: config.userKey,
      title,
      message,
      priority: String(config.priority ?? PUSHOVER_PRIORITIES[payload.event]),
      ...(config.device && { device: config.device }),
    });

    const response = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Pushover API failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    if (result.status !== 1) {
      throw new Error(`Pushover API error: ${JSON.stringify(result.errors || 'Unknown error')}`);
    }
  }

  /**
   * Format Discord rich embed
   */
  private formatDiscordEmbed(payload: NotificationPayload): any {
    const { event, title, author, userName, message, requestId, timestamp } = payload;

    const fields = [
      { name: 'Title', value: title, inline: false },
      { name: 'Author', value: author, inline: true },
      { name: 'Requested By', value: userName, inline: true },
    ];

    if (message) {
      fields.push({ name: 'Error', value: message, inline: false });
    }

    return {
      title: DISCORD_TITLES[event],
      color: DISCORD_COLORS[event],
      fields,
      footer: {
        text: `Request ID: ${requestId}`,
      },
      timestamp: timestamp.toISOString(),
    };
  }

  /**
   * Format Pushover message
   */
  private formatPushoverMessage(payload: NotificationPayload): { title: string; message: string } {
    const { event, title, author, userName, message } = payload;

    let eventTitle = '';
    let eventEmoji = '';

    switch (event) {
      case 'request_pending_approval':
        eventTitle = 'New Request Pending Approval';
        eventEmoji = '📬';
        break;
      case 'request_approved':
        eventTitle = 'Request Approved';
        eventEmoji = '✅';
        break;
      case 'request_available':
        eventTitle = 'Audiobook Available';
        eventEmoji = '🎉';
        break;
      case 'request_error':
        eventTitle = 'Request Error';
        eventEmoji = '❌';
        break;
    }

    const messageLines = [
      `${eventEmoji} ${eventTitle}`,
      '',
      `📚 ${title}`,
      `✍️ ${author}`,
      `👤 Requested by: ${userName}`,
    ];

    if (message) {
      messageLines.push('', `⚠️ Error: ${message}`);
    }

    return {
      title: eventTitle,
      message: messageLines.join('\n'),
    };
  }

  /**
   * Decrypt sensitive config values
   */
  private decryptConfig(config: any): any {
    const decrypted = { ...config };

    // Discord: decrypt webhookUrl
    if (decrypted.webhookUrl && this.isEncrypted(decrypted.webhookUrl)) {
      decrypted.webhookUrl = this.encryptionService.decrypt(decrypted.webhookUrl);
    }

    // Pushover: decrypt userKey and appToken
    if (decrypted.userKey && this.isEncrypted(decrypted.userKey)) {
      decrypted.userKey = this.encryptionService.decrypt(decrypted.userKey);
    }
    if (decrypted.appToken && this.isEncrypted(decrypted.appToken)) {
      decrypted.appToken = this.encryptionService.decrypt(decrypted.appToken);
    }

    return decrypted;
  }

  /**
   * Check if a value is encrypted (has iv:authTag:data format)
   */
  private isEncrypted(value: string): boolean {
    return value.includes(':') && value.split(':').length === 3;
  }

  /**
   * Encrypt sensitive config values before saving
   */
  encryptConfig(type: NotificationBackendType, config: any): any {
    const encrypted = { ...config };

    switch (type) {
      case 'discord':
        if (encrypted.webhookUrl && !this.isEncrypted(encrypted.webhookUrl)) {
          encrypted.webhookUrl = this.encryptionService.encrypt(encrypted.webhookUrl);
        }
        break;
      case 'pushover':
        if (encrypted.userKey && !this.isEncrypted(encrypted.userKey)) {
          encrypted.userKey = this.encryptionService.encrypt(encrypted.userKey);
        }
        if (encrypted.appToken && !this.isEncrypted(encrypted.appToken)) {
          encrypted.appToken = this.encryptionService.encrypt(encrypted.appToken);
        }
        break;
    }

    return encrypted;
  }

  /**
   * Mask sensitive config values for API responses
   */
  maskConfig(type: NotificationBackendType, config: any): any {
    const masked = { ...config };

    switch (type) {
      case 'discord':
        if (masked.webhookUrl) {
          masked.webhookUrl = '••••••••';
        }
        break;
      case 'pushover':
        if (masked.userKey) {
          masked.userKey = '••••••••';
        }
        if (masked.appToken) {
          masked.appToken = '••••••••';
        }
        break;
    }

    return masked;
  }
}

// Singleton instance
let notificationService: NotificationService | null = null;

export function getNotificationService(): NotificationService {
  if (!notificationService) {
    notificationService = new NotificationService();
  }
  return notificationService;
}
