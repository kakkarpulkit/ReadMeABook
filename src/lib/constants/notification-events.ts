/**
 * Component: Notification Event Constants
 * Documentation: documentation/backend/services/notifications.md
 *
 * Single source of truth for all notification event types and metadata.
 * Add new events here — all providers, API schemas, and UI labels derive from this.
 */

export type NotificationSeverity = 'info' | 'success' | 'error' | 'warning';
export type NotificationPriority = 'normal' | 'high';

/**
 * Central registry of notification events.
 *
 * Each entry defines:
 * - `label`:    Human-readable name shown in the UI
 * - `title`:    Title used in notification messages
 * - `emoji`:    Emoji prefix for notification titles
 * - `severity`: Drives provider formatting (colors, Apprise types, ntfy tags)
 * - `priority`: Drives notification urgency (Pushover/ntfy priority levels)
 */
export const NOTIFICATION_EVENTS = {
  request_pending_approval: {
    label: 'Request Pending Approval',
    title: 'New Request Pending Approval',
    emoji: '\u{1F4EC}',
    severity: 'info' as const,
    priority: 'normal' as const,
  },
  request_approved: {
    label: 'Request Approved',
    title: 'Request Approved',
    emoji: '\u2705',
    severity: 'success' as const,
    priority: 'normal' as const,
  },
  request_available: {
    label: 'Audiobook Available',
    title: 'Audiobook Available',
    emoji: '\u{1F389}',
    severity: 'success' as const,
    priority: 'high' as const,
  },
  request_error: {
    label: 'Request Error',
    title: 'Request Error',
    emoji: '\u274C',
    severity: 'error' as const,
    priority: 'high' as const,
  },
  issue_reported: {
    label: 'Issue Reported',
    title: 'Issue Reported',
    emoji: '\u{1F6A9}',
    severity: 'warning' as const,
    priority: 'high' as const,
  },
} as const;

/** Union type of all valid notification event keys */
export type NotificationEvent = keyof typeof NOTIFICATION_EVENTS;

/** Ordered array of all notification event keys (for Zod schemas, iteration) */
export const NOTIFICATION_EVENT_KEYS = Object.keys(NOTIFICATION_EVENTS) as [NotificationEvent, ...NotificationEvent[]];

/** Metadata shape for a single notification event */
export type NotificationEventMeta = (typeof NOTIFICATION_EVENTS)[NotificationEvent];

/** Helper: get event metadata by key */
export function getEventMeta(event: NotificationEvent) {
  return NOTIFICATION_EVENTS[event];
}

/** Helper: get the human-readable label for an event */
export function getEventLabel(event: NotificationEvent): string {
  return NOTIFICATION_EVENTS[event].label;
}

/** Record mapping all event keys to their labels (for UI dropdowns, etc.) */
export const EVENT_LABELS: Record<NotificationEvent, string> = Object.fromEntries(
  Object.entries(NOTIFICATION_EVENTS).map(([key, meta]) => [key, meta.label])
) as Record<NotificationEvent, string>;
