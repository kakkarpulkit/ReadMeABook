/**
 * Component: Setup Route Guard Tests
 * Documentation: documentation/testing.md
 *
 * Verifies that all setup API endpoints return 403 after setup is complete.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  configuration: {
    findUnique: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

// Mock all external dependencies that setup routes import
vi.mock('@/lib/integrations/plex.service', () => ({
  getPlexService: () => ({
    testConnection: vi.fn(),
    getLibraries: vi.fn(),
  }),
}));

vi.mock('@/lib/integrations/prowlarr.service', () => ({
  ProwlarrService: class {
    constructor() {}
    getIndexers = vi.fn();
  },
}));

vi.mock('openid-client', () => ({
  Issuer: { discover: vi.fn() },
}));

vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
  },
  access: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
  constants: { R_OK: 4 },
}));

vi.mock('@/lib/services/config.service', () => ({
  getConfigService: () => ({ get: vi.fn() }),
}));

vi.mock('@/lib/services/download-client-manager.service', () => ({
  getDownloadClientManager: () => ({ testConnection: vi.fn() }),
}));

vi.mock('@/lib/services/encryption.service', () => ({
  getEncryptionService: () => ({ encrypt: vi.fn((v: string) => `enc-${v}`) }),
}));

vi.mock('bcrypt', () => ({
  default: { hash: vi.fn() },
  hash: vi.fn(),
}));

vi.mock('@/lib/utils/jwt', () => ({
  generateAccessToken: vi.fn(() => 'token'),
  generateRefreshToken: vi.fn(() => 'token'),
}));

function mockSetupComplete() {
  prismaMock.configuration.findUnique.mockResolvedValue({ key: 'setup_completed', value: 'true' });
}

function makeRequest(body: Record<string, unknown> = {}) {
  return {
    json: vi.fn().mockResolvedValue(body),
    nextUrl: { pathname: '/api/setup/test' },
  } as any;
}

describe('Setup route guard - blocks access after setup is complete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetupComplete();
  });

  it('POST /api/setup/complete returns 403 when setup is already complete', async () => {
    const { POST } = await import('@/app/api/setup/complete/route');
    const response = await POST(makeRequest({ backendMode: 'plex' }));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe('Forbidden');
    expect(payload.message).toMatch(/Setup has already been completed/);
  });

  it('POST /api/setup/test-download-client returns 403 when setup is already complete', async () => {
    const { POST } = await import('@/app/api/setup/test-download-client/route');
    const response = await POST(makeRequest({ type: 'qbittorrent', url: 'http://qbt' }));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe('Forbidden');
  });

  it('POST /api/setup/test-plex returns 403 when setup is already complete', async () => {
    const { POST } = await import('@/app/api/setup/test-plex/route');
    const response = await POST(makeRequest({ url: 'http://plex', token: 'token' }));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe('Forbidden');
  });

  it('POST /api/setup/test-prowlarr returns 403 when setup is already complete', async () => {
    const { POST } = await import('@/app/api/setup/test-prowlarr/route');
    const response = await POST(makeRequest({ url: 'http://prowlarr', apiKey: 'key' }));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe('Forbidden');
  });

  it('POST /api/setup/test-paths returns 403 when setup is already complete', async () => {
    const { POST } = await import('@/app/api/setup/test-paths/route');
    const response = await POST(makeRequest({ downloadDir: '/downloads', mediaDir: '/media' }));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe('Forbidden');
  });

  it('POST /api/setup/test-abs returns 403 when setup is already complete', async () => {
    const { POST } = await import('@/app/api/setup/test-abs/route');
    const response = await POST(makeRequest({ serverUrl: 'http://abs', apiToken: 'token' }));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe('Forbidden');
  });

  it('POST /api/setup/test-oidc returns 403 when setup is already complete', async () => {
    const { POST } = await import('@/app/api/setup/test-oidc/route');
    const response = await POST(makeRequest({
      issuerUrl: 'http://issuer',
      clientId: 'client',
      clientSecret: 'secret',
    }));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe('Forbidden');
  });

  it('allows requests through when setup is not yet complete', async () => {
    // Override: setup not complete
    prismaMock.configuration.findUnique.mockResolvedValue(null);

    const { POST } = await import('@/app/api/setup/test-download-client/route');
    const response = await POST(makeRequest({ type: 'qbittorrent', url: 'http://qbt' }));
    const payload = await response.json();

    // Should reach the handler (not 403), even if the actual test fails
    expect(response.status).not.toBe(403);
  });

  it('allows requests through when database is not ready', async () => {
    // Override: database error
    prismaMock.configuration.findUnique.mockRejectedValue(new Error('DB not ready'));

    const { POST } = await import('@/app/api/setup/test-download-client/route');
    const response = await POST(makeRequest({ type: 'qbittorrent', url: 'http://qbt' }));
    const payload = await response.json();

    // Should reach the handler (not 403) — DB not ready means setup hasn't happened
    expect(response.status).not.toBe(403);
  });
});
