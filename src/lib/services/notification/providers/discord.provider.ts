/**
 * Component: Discord Notification Provider
 * Documentation: documentation/backend/services/notifications.md
 */

import { INotificationProvider, NotificationPayload, ProviderMetadata } from '../INotificationProvider';

export interface DiscordConfig {
  webhookUrl: string;
  username?: string;
  avatarUrl?: string;
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

export class DiscordProvider implements INotificationProvider {
  type = 'discord' as const;
  sensitiveFields = ['webhookUrl'];
  metadata: ProviderMetadata = {
    type: 'discord',
    displayName: 'Discord',
    description: 'Send notifications via Discord webhook',
    iconLabel: 'D',
    iconColor: 'bg-indigo-500',
    configFields: [
      { name: 'webhookUrl', label: 'Webhook URL', type: 'text', required: true, placeholder: 'https://discord.com/api/webhooks/...' },
      { name: 'username', label: 'Username', type: 'text', required: false, placeholder: 'ReadMeABook', defaultValue: 'ReadMeABook' },
      { name: 'avatarUrl', label: 'Avatar URL', type: 'text', required: false, placeholder: 'https://example.com/avatar.png', defaultValue: '' },
    ],
  };

  async send(config: Record<string, any>, payload: NotificationPayload): Promise<void> {
    const discordConfig = config as unknown as DiscordConfig;
    const embed = this.formatEmbed(payload);

    const body = {
      username: discordConfig.username || 'ReadMeABook',
      avatar_url: discordConfig.avatarUrl,
      embeds: [embed],
    };

    const response = await fetch(discordConfig.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Discord webhook failed: ${response.status} ${errorText}`);
    }
  }

  private formatEmbed(payload: NotificationPayload): any {
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
}
