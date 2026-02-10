/**
 * Component: Pushover Notification Provider
 * Documentation: documentation/backend/services/notifications.md
 */

import { INotificationProvider, NotificationPayload, ProviderMetadata } from '../INotificationProvider';

export interface PushoverConfig {
  userKey: string;
  appToken: string;
  device?: string;
  priority?: number;
}

// Pushover priorities by event type
const PUSHOVER_PRIORITIES = {
  request_pending_approval: 0, // Normal
  request_approved: 0, // Normal
  request_available: 1, // High
  request_error: 1, // High
};

export class PushoverProvider implements INotificationProvider {
  type = 'pushover' as const;
  sensitiveFields = ['userKey', 'appToken'];
  metadata: ProviderMetadata = {
    type: 'pushover',
    displayName: 'Pushover',
    description: 'Send notifications via Pushover API',
    iconLabel: 'P',
    iconColor: 'bg-blue-500',
    configFields: [
      { name: 'userKey', label: 'User Key', type: 'text', required: true, placeholder: 'Your Pushover user key' },
      { name: 'appToken', label: 'App Token', type: 'text', required: true, placeholder: 'Your Pushover app token' },
      { name: 'device', label: 'Device', type: 'text', required: false, placeholder: 'Optional device name' },
      {
        name: 'priority', label: 'Priority', type: 'select', required: false, defaultValue: 0,
        options: [
          { label: 'Lowest', value: -2 },
          { label: 'Low', value: -1 },
          { label: 'Normal', value: 0 },
          { label: 'High', value: 1 },
          { label: 'Emergency', value: 2 },
        ],
      },
    ],
  };

  async send(config: Record<string, any>, payload: NotificationPayload): Promise<void> {
    const pushoverConfig = config as unknown as PushoverConfig;
    const { title, message } = this.formatMessage(payload);

    const body = new URLSearchParams({
      token: pushoverConfig.appToken,
      user: pushoverConfig.userKey,
      title,
      message,
      priority: String(pushoverConfig.priority ?? PUSHOVER_PRIORITIES[payload.event]),
      ...(pushoverConfig.device && { device: pushoverConfig.device }),
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

  private formatMessage(payload: NotificationPayload): { title: string; message: string } {
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
}
