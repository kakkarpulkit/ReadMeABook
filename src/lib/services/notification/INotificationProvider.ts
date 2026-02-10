/**
 * Notification Provider Interface
 * Documentation: documentation/backend/services/notifications.md
 */

// Event types
export type NotificationEvent =
  | 'request_pending_approval'
  | 'request_approved'
  | 'request_available'
  | 'request_error';

// Backend type — string-based, registry is the runtime source of truth
export type NotificationBackendType = string;

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

// Provider config field definition for dynamic UI rendering
export interface ProviderConfigField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'select' | 'number';
  required: boolean;
  placeholder?: string;
  defaultValue?: string | number;
  options?: { label: string; value: string | number }[];
}

// Provider metadata for self-describing providers
export interface ProviderMetadata {
  type: string;
  displayName: string;
  description: string;
  iconLabel: string;
  iconColor: string;
  configFields: ProviderConfigField[];
}

export interface INotificationProvider {
  /** Provider identifier */
  type: string;

  /** Config field names that need encryption/masking */
  sensitiveFields: string[];

  /** Self-describing metadata for UI and validation */
  metadata: ProviderMetadata;

  /** Send notification with already-decrypted config */
  send(config: Record<string, any>, payload: NotificationPayload): Promise<void>;
}
