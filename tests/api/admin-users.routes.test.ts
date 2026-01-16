/**
 * Component: Admin Users API Route Tests
 * Documentation: documentation/testing.md
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPrismaMock } from '../helpers/prisma';

let authRequest: any;

const prismaMock = createPrismaMock();
const requireAuthMock = vi.hoisted(() => vi.fn());
const requireAdminMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

vi.mock('@/lib/middleware/auth', () => ({
  requireAuth: requireAuthMock,
  requireAdmin: requireAdminMock,
}));

describe('Admin users routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authRequest = { user: { sub: 'admin-1', role: 'admin' }, json: vi.fn() };
    requireAuthMock.mockImplementation((_req: any, handler: any) => handler(authRequest));
    requireAdminMock.mockImplementation((_req: any, handler: any) => handler());
  });

  it('returns users list', async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([{ id: 'u1' }]);

    const { GET } = await import('@/app/api/admin/users/route');
    const response = await GET({} as any);
    const payload = await response.json();

    expect(payload.users).toHaveLength(1);
  });

  it('returns pending users list', async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([{ id: 'u2' }]);

    const { GET } = await import('@/app/api/admin/users/pending/route');
    const response = await GET({} as any);
    const payload = await response.json();

    expect(payload.users).toHaveLength(1);
  });

  it('updates a user role', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      isSetupAdmin: false,
      authProvider: 'local',
      plexUsername: 'user',
      deletedAt: null,
      role: 'user',
    });
    prismaMock.user.update.mockResolvedValueOnce({ id: 'u3', plexUsername: 'user', role: 'admin' });
    const request = { json: vi.fn().mockResolvedValue({ role: 'admin' }) };

    const { PUT } = await import('@/app/api/admin/users/[id]/route');
    const response = await PUT(request as any, { params: Promise.resolve({ id: 'u3' }) });
    const payload = await response.json();

    expect(payload.user.role).toBe('admin');
  });

  it('allows autoApproveRequests update for OIDC users without role change', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      isSetupAdmin: false,
      authProvider: 'oidc',
      plexUsername: 'oidc-user',
      deletedAt: null,
      role: 'user',
    });
    prismaMock.user.update.mockResolvedValueOnce({
      id: 'oidc-1',
      plexUsername: 'oidc-user',
      role: 'user',
      autoApproveRequests: true,
    });
    const request = { json: vi.fn().mockResolvedValue({ role: 'user', autoApproveRequests: true }) };

    const { PUT } = await import('@/app/api/admin/users/[id]/route');
    const response = await PUT(request as any, { params: Promise.resolve({ id: 'oidc-1' }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.user.autoApproveRequests).toBe(true);
  });

  it('prevents OIDC user role change', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      isSetupAdmin: false,
      authProvider: 'oidc',
      plexUsername: 'oidc-user',
      deletedAt: null,
      role: 'user',
    });
    const request = { json: vi.fn().mockResolvedValue({ role: 'admin', autoApproveRequests: true }) };

    const { PUT } = await import('@/app/api/admin/users/[id]/route');
    const response = await PUT(request as any, { params: Promise.resolve({ id: 'oidc-1' }) });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toContain('OIDC');
  });

  it('allows autoApproveRequests update for setup admin without role change', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      isSetupAdmin: true,
      authProvider: 'local',
      plexUsername: 'setup-admin',
      deletedAt: null,
      role: 'admin',
    });
    prismaMock.user.update.mockResolvedValueOnce({
      id: 'setup-1',
      plexUsername: 'setup-admin',
      role: 'admin',
      autoApproveRequests: true,
    });
    const request = { json: vi.fn().mockResolvedValue({ role: 'admin', autoApproveRequests: true }) };

    const { PUT } = await import('@/app/api/admin/users/[id]/route');
    const response = await PUT(request as any, { params: Promise.resolve({ id: 'setup-1' }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.user.autoApproveRequests).toBe(true);
  });

  it('soft deletes a local user', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'u4',
      plexUsername: 'user',
      isSetupAdmin: false,
      authProvider: 'local',
      deletedAt: null,
      _count: { requests: 1 },
    });
    prismaMock.user.update.mockResolvedValueOnce({});

    const { DELETE } = await import('@/app/api/admin/users/[id]/route');
    const response = await DELETE({} as any, { params: Promise.resolve({ id: 'u4' }) });
    const payload = await response.json();

    expect(payload.success).toBe(true);
  });

  it('approves a pending user', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'u5',
      plexUsername: 'user',
      registrationStatus: 'pending_approval',
    });
    prismaMock.user.update.mockResolvedValueOnce({});
    const request = { json: vi.fn().mockResolvedValue({ approve: true }) };

    const { POST } = await import('@/app/api/admin/users/[id]/approve/route');
    const response = await POST(request as any, { params: Promise.resolve({ id: 'u5' }) });
    const payload = await response.json();

    expect(payload.success).toBe(true);
  });
});


