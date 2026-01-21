# Notification System

**Status:** ✅ Implemented | Extensible notification system with Discord and Pushover support

## Overview
Sends notifications for audiobook request events (pending approval, approved, available, error) to configured backends. Non-blocking, atomic per-backend failure handling. Proper notification timing for all request flows including interactive search.

## Key Details
- **Backends:** Discord (webhooks), Pushover (API)
- **Events:** request_pending_approval, request_approved, request_available, request_error
- **Encryption:** AES-256-GCM for sensitive config (webhook URLs, API keys)
- **Delivery:** Async via Bull job queue (priority 5)
- **Failure Handling:** Non-blocking, Promise.allSettled (one backend fails, others succeed)

## Database Schema

```prisma
model NotificationBackend {
  id        String   @id @default(uuid())
  type      String   // 'discord' | 'pushover'
  name      String   // User-friendly label
  config    Json     // Encrypted sensitive values
  events    Json     // Array of subscribed events
  enabled   Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## Event Types

| Event | Trigger | Notification Sent When |
|-------|---------|------------------------|
| request_pending_approval | User creates request | Request needs admin approval |
| request_approved | Admin approves OR auto-approval | Request approved (manual or auto) |
| request_available | Plex/ABS scan completes | Audiobook available in library |
| request_error | Download/import fails | Request failed at any stage |

## Notification Triggers

**Request Creation (POST /api/requests)**
- Automatic search, approval needed: `status === 'awaiting_approval'` → request_pending_approval
- Automatic search, auto-approved: `status === 'pending'` → request_approved
- Interactive search: NO notification yet (deferred until torrent selection)

**BookDate Swipe (POST /api/bookdate/swipe)**
- Right swipe, approval needed: `status === 'awaiting_approval'` → request_pending_approval
- Right swipe, auto-approved: `status === 'pending'` → request_approved

**Request with Pre-Selected Torrent (POST /api/audiobooks/request-with-torrent)**
- Approval needed: `status === 'awaiting_approval'` → request_pending_approval
- Auto-approved: `status === 'downloading'` → request_approved

**Torrent Selection for Existing Request (POST /api/requests/[id]/select-torrent)**
- Approval needed: `status === 'awaiting_approval'` → request_pending_approval
- Auto-approved: `status === 'downloading'` → request_approved

**Admin Approval (POST /api/admin/requests/[id]/approve)**
- Approve (with or without pre-selected torrent): After job triggered → request_approved
- Deny: No notification

**Request Available (processors: scan-plex, plex-recently-added)**
- After `status: 'available'` update → request_available
- Includes user info in query (plexUsername)

**Request Error (processors: monitor-download, organize-files)**
- After `status: 'failed'` or `status: 'warn'` update → request_error
- Includes error message in payload

## Configuration Encryption

**Encrypted Values:**
- Discord: `webhookUrl`
- Pushover: `userKey`, `appToken`

**Pattern:** `iv:authTag:encryptedData` (base64)

**Masking:** Sensitive values returned as `••••••••` in API responses

**Preservation:** Masked values preserved on update (if value === '••••••••', use existing encrypted value)

## Message Formatting

**Discord (Rich Embeds):**
- Color-coded by event (yellow=pending, green=approved, blue=available, red=error)
- Fields: Title, Author, Requested By, Error (if applicable)
- Footer: Request ID
- Timestamp: Event time

**Pushover (Plain Text with Emojis):**
- Emojis: 📬 📬 🎉 ❌
- Priority: Normal (0) for pending/approved, High (1) for available/error
- Format: Event title + book details + user + error (if applicable)

## API Endpoints

**GET /api/admin/notifications**
- Returns all backends (sensitive values masked)

**POST /api/admin/notifications**
- Create backend (encrypts sensitive values)
- Body: `{type, name, config, events, enabled}`

**GET /api/admin/notifications/[id]**
- Get single backend (sensitive values masked)

**PUT /api/admin/notifications/[id]**
- Update backend (preserves masked values, encrypts new values)

**DELETE /api/admin/notifications/[id]**
- Delete backend

**POST /api/admin/notifications/test**
- Test notification (synchronous, not via job queue)
- Body: `{type, config}` (plaintext for testing)
- Sends test payload: "The Hitchhiker's Guide to the Galaxy" by Douglas Adams

## UI Components

**NotificationsTab (src/app/admin/settings/tabs/NotificationsTab)**
- Type selector cards (Discord: indigo "D", Pushover: blue "P")
- Configured backends grid (3 columns)
- Backend cards: type icon, name, enabled status, event count, edit/delete actions
- Modal: type-specific forms, event checkboxes, enable toggle, test button

**Modal Features:**
- Type-first selection (user clicks "Add Discord" or "Add Pushover")
- Password inputs for sensitive values
- Event subscription checkboxes (4 events, default: available + error)
- Test button (sends synchronous test notification)
- Save button (validates and creates/updates backend)

## Job Queue Integration

**Job Type:** `send_notification` (priority 5, concurrency 5)

**Payload:**
```typescript
{
  jobId?: string,
  event: string,
  requestId: string,
  title: string,
  author: string,
  userName: string,
  message?: string,
  timestamp: Date
}
```

**Processor:** `src/lib/processors/send-notification.processor.ts`
- Calls NotificationService.sendNotification()
- Non-blocking error handling (logs but doesn't throw)

**Queue Method:** `addNotificationJob(event, requestId, title, author, userName, message?)`

## Extensibility

**Adding New Backend (e.g., Email):**
1. Add 'email' to NotificationBackendType enum
2. Create EmailConfig interface
3. Add encryption logic for smtpPassword
4. Implement sendEmail() method in NotificationService
5. Add email card to type selector (green "E" badge)
6. Add email form fields to modal

**Adding New Event (e.g., download_complete):**
1. Add 'download_complete' to NotificationEvent enum
2. Add to event labels in UI
3. Add trigger point in processor
4. Add message formatting in Discord/Pushover formatters

## Tech Stack
- Bull (job queue)
- Node.js crypto (AES-256-GCM encryption)
- Discord webhooks, Pushover API
- React (UI), Tailwind CSS (styling)

## Related
- [Job Queue System](jobs.md)
- [Config Encryption](config.md)
- [Settings Pages](../../settings-pages.md)
