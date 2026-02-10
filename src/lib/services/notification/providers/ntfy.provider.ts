/**
 * Component: ntfy Notification Provider
 * Documentation: documentation/backend/services/notifications.md
 */

import { INotificationProvider, NotificationPayload, ProviderMetadata } from '../INotificationProvider';

export interface NtfyConfig {
  serverUrl?: string;
  topic: string;
  accessToken?: string;
  priority?: number;
}

const DEFAULT_SERVER_URL = 'https://ntfy.sh';

// ntfy priorities by event type (1=min, 2=low, 3=default, 4=high, 5=urgent)
const NTFY_PRIORITIES = {
  request_pending_approval: 3, // Default
  request_approved: 3, // Default
  request_available: 4, // High
  request_error: 4, // High
};

// ntfy tags (emojis) by event type
const NTFY_TAGS = {
  request_pending_approval: ['mailbox_with_mail'],
  request_approved: ['white_check_mark'],
  request_available: ['tada'],
  request_error: ['x'],
};

export class NtfyProvider implements INotificationProvider {
  type = 'ntfy' as const;
  sensitiveFields = ['accessToken'];
  metadata: ProviderMetadata = {
    type: 'ntfy',
    displayName: 'ntfy',
    description: 'Send notifications via ntfy pub/sub',
    iconLabel: 'N',
    iconColor: 'bg-teal-500',
    configFields: [
      { name: 'serverUrl', label: 'Server URL', type: 'text', required: false, placeholder: 'https://ntfy.sh', defaultValue: 'https://ntfy.sh' },
      { name: 'topic', label: 'Topic', type: 'text', required: true, placeholder: 'readmeabook' },
      { name: 'accessToken', label: 'Access Token', type: 'password', required: false, placeholder: 'tk_...' },
    ],
  };

  async send(config: Record<string, any>, payload: NotificationPayload): Promise<void> {
    const ntfyConfig = config as unknown as NtfyConfig;
    const { title, message } = this.formatMessage(payload);

    const serverUrl = (ntfyConfig.serverUrl || DEFAULT_SERVER_URL).replace(/\/+$/, '');
    const url = `${serverUrl}/${ntfyConfig.topic}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (ntfyConfig.accessToken) {
      headers['Authorization'] = `Bearer ${ntfyConfig.accessToken}`;
    }

    const body = {
      topic: ntfyConfig.topic,
      title,
      message,
      priority: ntfyConfig.priority ?? NTFY_PRIORITIES[payload.event],
      tags: NTFY_TAGS[payload.event],
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`ntfy API failed: ${response.status} ${errorText}`);
    }
  }

  private formatMessage(payload: NotificationPayload): { title: string; message: string } {
    const { event, title, author, userName, message } = payload;

    const eventTitles = {
      request_pending_approval: 'New Request Pending Approval',
      request_approved: 'Request Approved',
      request_available: 'Audiobook Available',
      request_error: 'Request Error',
    };

    const messageLines = [
      `📚 ${title}`,
      `✍️ ${author}`,
      `👤 Requested by: ${userName}`,
    ];

    if (message) {
      messageLines.push(`⚠️ Error: ${message}`);
    }

    return {
      title: eventTitles[event],
      message: messageLines.join('\n'),
    };
  }
}
