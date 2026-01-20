/**
 * Component: Library Cover Cache API Tests
 * Documentation: documentation/features/library-thumbnail-cache.md
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cache/library/[filename]/route';

const fsMock = vi.hoisted(() => ({
  access: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  default: fsMock,
  ...fsMock,
}));

describe('GET /api/cache/library/[filename]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for invalid filename with directory traversal', async () => {
    const request = new NextRequest('http://localhost/api/cache/library/../etc/passwd');
    const response = await GET(request, { params: Promise.resolve({ filename: '../etc/passwd' }) });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Invalid filename');
  });

  it('returns 400 for filename with slashes', async () => {
    const request = new NextRequest('http://localhost/api/cache/library/path/to/file.jpg');
    const response = await GET(request, { params: Promise.resolve({ filename: 'path/to/file.jpg' }) });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Invalid filename');
  });

  it('returns 404 when file does not exist', async () => {
    fsMock.access.mockRejectedValue(new Error('File not found'));

    const request = new NextRequest('http://localhost/api/cache/library/missing.jpg');
    const response = await GET(request, { params: Promise.resolve({ filename: 'missing.jpg' }) });

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe('File not found');
  });

  it('serves JPEG images with correct content type', async () => {
    fsMock.access.mockResolvedValue(undefined);
    fsMock.readFile.mockResolvedValue(Buffer.from([0xFF, 0xD8, 0xFF]));

    const request = new NextRequest('http://localhost/api/cache/library/a1b2c3d4e5f6g7h8.jpg');
    const response = await GET(request, { params: Promise.resolve({ filename: 'a1b2c3d4e5f6g7h8.jpg' }) });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400');
  });

  it('serves PNG images with correct content type', async () => {
    fsMock.access.mockResolvedValue(undefined);
    fsMock.readFile.mockResolvedValue(Buffer.from([0x89, 0x50, 0x4E, 0x47]));

    const request = new NextRequest('http://localhost/api/cache/library/hash123456789abc.png');
    const response = await GET(request, { params: Promise.resolve({ filename: 'hash123456789abc.png' }) });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
  });

  it('serves WEBP images with correct content type', async () => {
    fsMock.access.mockResolvedValue(undefined);
    fsMock.readFile.mockResolvedValue(Buffer.from('webp data'));

    const request = new NextRequest('http://localhost/api/cache/library/cover.webp');
    const response = await GET(request, { params: Promise.resolve({ filename: 'cover.webp' }) });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/webp');
  });

  it('returns 500 when file read fails', async () => {
    fsMock.access.mockResolvedValue(undefined);
    fsMock.readFile.mockRejectedValue(new Error('Read error'));

    const request = new NextRequest('http://localhost/api/cache/library/error.jpg');
    const response = await GET(request, { params: Promise.resolve({ filename: 'error.jpg' }) });

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBe('Internal server error');
  });

  it('uses octet-stream for unknown file extensions', async () => {
    fsMock.access.mockResolvedValue(undefined);
    fsMock.readFile.mockResolvedValue(Buffer.from('unknown data'));

    const request = new NextRequest('http://localhost/api/cache/library/file.unknown');
    const response = await GET(request, { params: Promise.resolve({ filename: 'file.unknown' }) });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/octet-stream');
  });

  it('handles GIF images correctly', async () => {
    fsMock.access.mockResolvedValue(undefined);
    fsMock.readFile.mockResolvedValue(Buffer.from('GIF89a'));

    const request = new NextRequest('http://localhost/api/cache/library/animated.gif');
    const response = await GET(request, { params: Promise.resolve({ filename: 'animated.gif' }) });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/gif');
  });
});
