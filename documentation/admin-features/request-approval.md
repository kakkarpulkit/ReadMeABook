# Request Approval System

**Status:** ✅ Implemented | Admin approval workflow for user requests with global & per-user auto-approve controls

## Overview
Allows admins to review and approve/deny user requests before they are processed. Supports global auto-approve toggle and per-user auto-approve overrides.

## Key Details

### Request Statuses
- **awaiting_approval** - New status for requests pending admin approval
- **denied** - New status for requests rejected by admin
- **pending** - Status after approval (triggers search job)
- Applies to all existing statuses: pending, searching, downloading, processing, downloaded, available, failed, cancelled, awaiting_search, awaiting_import, warn

### Configuration Keys
- `auto_approve_requests` (Configuration table) - Global setting (true/false string)
- `User.autoApproveRequests` (User table) - Per-user override (boolean, nullable)
  - `null` = Use global setting
  - `true` = Always auto-approve for this user
  - `false` = Always require approval for this user

### Approval Logic
**When user creates request:**
1. Check `User.autoApproveRequests`:
   - If `true` → Set status to 'pending', trigger search job
   - If `false` → Set status to 'awaiting_approval', wait for admin
   - If `null` → Check global `auto_approve_requests` setting
     - If 'true' → Auto-approve (status: 'pending')
     - Otherwise → Require approval (status: 'awaiting_approval')

**Admin approval actions:**
- **Approve** → Change status to 'pending', trigger search job
- **Deny** → Change status to 'denied', no further processing

## API Endpoints

### GET /api/admin/requests/pending-approval
Fetch all requests with status 'awaiting_approval'

**Auth:** Admin only

**Response:**
```json
{
  "success": true,
  "requests": [
    {
      "id": "uuid",
      "createdAt": "2026-01-15T12:00:00Z",
      "audiobook": {
        "title": "Book Title",
        "author": "Author Name",
        "coverArtUrl": "https://..."
      },
      "user": {
        "id": "uuid",
        "plexUsername": "username",
        "avatarUrl": "https://..."
      }
    }
  ],
  "count": 5
}
```

### POST /api/admin/requests/[id]/approve
Approve or deny a specific request

**Auth:** Admin only

**Request:**
```json
{
  "action": "approve" | "deny"
}
```

**Response (approve):**
```json
{
  "success": true,
  "message": "Request approved and search job triggered",
  "request": { /* full request object */ }
}
```

**Response (deny):**
```json
{
  "success": true,
  "message": "Request denied",
  "request": { /* full request object */ }
}
```

**Errors:**
- `404` - Request not found
- `400` - Request not in 'awaiting_approval' status
- `400` - Invalid action (must be 'approve' or 'deny')

### GET /api/admin/settings/auto-approve
Get global auto-approve setting

**Auth:** Admin only

**Response:**
```json
{
  "autoApproveRequests": true
}
```

### PATCH /api/admin/settings/auto-approve
Update global auto-approve setting

**Auth:** Admin only

**Request:**
```json
{
  "autoApproveRequests": true
}
```

**Response:**
```json
{
  "autoApproveRequests": true
}
```

### PUT /api/admin/users/[id]
Update user (includes autoApproveRequests field)

**Auth:** Admin only

**Request:**
```json
{
  "autoApproveRequests": true | false | null
}
```

## UI Features

### Admin Dashboard (/admin)
**Requests Awaiting Approval Section:**
- Shows only when pending approval requests exist
- Grid layout with book cards (3 columns on desktop)
- Each card displays:
  - Book cover image
  - Title and author
  - User avatar and username
  - Request timestamp (relative: "2 hours ago")
  - Approve button (green, checkmark icon)
  - Deny button (red, X icon)
- Auto-refreshes every 10 seconds (SWR)
- Loading states on buttons during approval/denial
- Success/error toast notifications
- Mutates multiple caches on action: pending-approval, recent requests, metrics

### Admin Users Page (/admin/users)
**Global Auto-Approve Toggle:**
- Checkbox at top of page
- Label: "Auto-approve all requests by default"
- Updates `auto_approve_requests` configuration
- Optimistic UI update with revert on error
- Toast notification on success/error

**Per-User Auto-Approve Control:**
- Each user row has toggle dropdown:
  - "Use Global Setting" (null, default)
  - "Always Auto-Approve" (true)
  - "Always Require Approval" (false)
- Updates `User.autoApproveRequests` field
- Shows current effective setting (considers global + per-user)
- Optimistic UI update

### User Request Flow
**When creating request (POST /api/requests):**
- System checks approval logic (see above)
- If awaiting approval → User sees status "Awaiting Approval" on request card
- If auto-approved → User sees status "Pending" and processing begins

### Request Status Badges
- **awaiting_approval** → Amber badge with warning icon
- **denied** → Red badge with X icon
- All other statuses → Existing badge colors

## Database Schema

### User Table
```
autoApproveRequests: Boolean (nullable, default null)
- null: Use global setting
- true: Always auto-approve
- false: Always require approval
```

### Request Table
```
status: Enum (includes 'awaiting_approval', 'denied')
```

### Configuration Table
```
key: 'auto_approve_requests'
value: 'true' | 'false' (string)
```

## Related
- [Admin Dashboard](../admin-dashboard.md) - Dashboard UI features
- [Database Schema](../backend/database.md) - User and Request tables
- [Settings Pages](../settings-pages.md) - Global settings management
