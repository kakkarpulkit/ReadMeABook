/**
 * Component: Apprise Notification Provider
 * Documentation: documentation/backend/services/notifications.md
 */

import { INotificationProvider, NotificationPayload, ProviderMetadata } from '../INotificationProvider';

export interface AppriseConfig {
  serverUrl: string;
  urls?: string;
  configKey?: string;
  tag?: string;
  authToken?: string;
}

// Apprise notification types by event
const APPRISE_TYPES: Record<string, string> = {
  request_pending_approval: 'info',
  request_approved: 'success',
  request_available: 'success',
  request_error: 'failure',
};

export class AppriseProvider implements INotificationProvider {
  type = 'apprise' as const;
  sensitiveFields = ['urls', 'authToken'];
  metadata: ProviderMetadata = {
    type: 'apprise',
    displayName: 'Apprise',
    description: 'Send notifications via Apprise API to 100+ services',
    iconLabel: 'A',
    iconColor: 'bg-purple-500',
    configFields: [
      { name: 'serverUrl', label: 'Server URL', type: 'text', required: true, placeholder: 'http://apprise:8000' },
      { name: 'urls', label: 'Notification URLs', type: 'password', required: false, placeholder: 'slack://token, discord://webhook_id/token, ...' },
      { name: 'configKey', label: 'Config Key', type: 'text', required: false, placeholder: 'Persistent configuration key' },
      { name: 'tag', label: 'Tag', type: 'text', required: false, placeholder: 'Filter tag for stateful config' },
      { name: 'authToken', label: 'Auth Token', type: 'password', required: false, placeholder: 'Optional API auth token' },
    ],
  };

  async send(config: Record<string, any>, payload: NotificationPayload): Promise<void> {
    const appriseConfig = config as unknown as AppriseConfig;
    const { title, body } = this.formatMessage(payload);

    const serverUrl = appriseConfig.serverUrl.replace(/\/+$/, '');
    const notificationType = APPRISE_TYPES[payload.event] || 'info';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (appriseConfig.authToken) {
      headers['Authorization'] = `Bearer ${appriseConfig.authToken}`;
    }

    // Stateful mode: use configKey endpoint
    if (appriseConfig.configKey) {
      const url = `${serverUrl}/notify/${appriseConfig.configKey}`;
      const requestBody: Record<string, string> = {
        title,
        body,
        type: notificationType,
      };

      if (appriseConfig.tag) {
        requestBody.tag = appriseConfig.tag;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Apprise API failed: ${response.status} ${errorText}`);
      }
      return;
    }

    // Stateless mode: send URLs directly
    if (!appriseConfig.urls) {
      throw new Error('Apprise requires either notification URLs or a config key');
    }

    const url = `${serverUrl}/notify/`;
    const requestBody = {
      urls: appriseConfig.urls,
      title,
      body,
      type: notificationType,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Apprise API failed: ${response.status} ${errorText}`);
    }
  }

  private formatMessage(payload: NotificationPayload): { title: string; body: string } {
    const { event, title, author, userName, message } = payload;

    const eventTitles: Record<string, string> = {
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
      body: messageLines.join('\n'),
    };
  }
}
