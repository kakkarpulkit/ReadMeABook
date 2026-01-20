/**
 * Component: Thumbnail Cache Service Tests
 * Documentation: documentation/integrations/audible.md
 */

import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThumbnailCacheService } from '@/lib/services/thumbnail-cache.service';

const fsMock = vi.hoisted(() => ({
  mkdir: vi.fn(),
  access: vi.fn(),
  writeFile: vi.fn(),
  readdir: vi.fn(),
  unlink: vi.fn(),
}));

const axiosMock = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  default: fsMock,
  ...fsMock,
}));
vi.mock('axios', () => ({
  default: axiosMock,
  ...axiosMock,
}));

describe('ThumbnailCacheService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fsMock.mkdir.mockReset();
    fsMock.access.mockReset();
    fsMock.writeFile.mockReset();
    fsMock.readdir.mockReset();
    fsMock.unlink.mockReset();
    axiosMock.get.mockReset();
  });

  it('returns null when missing ASIN or URL', async () => {
    const service = new ThumbnailCacheService();

    expect(await service.cacheThumbnail('', 'http://example.com/x.jpg')).toBeNull();
    expect(await service.cacheThumbnail('ASIN', '')).toBeNull();
  });

  it('returns cached path when file already exists', async () => {
    fsMock.mkdir.mockResolvedValue(undefined);
    fsMock.access.mockResolvedValue(undefined);

    const service = new ThumbnailCacheService();
    const result = await service.cacheThumbnail('ASIN1', 'https://img.example.com/cover.jpg');

    expect(result).toBe(path.join('/app/cache/thumbnails', 'ASIN1.jpg'));
    expect(axiosMock.get).not.toHaveBeenCalled();
  });

  it('skips non-image content types', async () => {
    fsMock.mkdir.mockResolvedValue(undefined);
    fsMock.access.mockRejectedValue(new Error('missing'));
    axiosMock.get.mockResolvedValue({
      headers: { 'content-type': 'text/html' },
      data: Buffer.from('nope'),
    });

    const service = new ThumbnailCacheService();
    const result = await service.cacheThumbnail('ASIN2', 'https://img.example.com/cover.png');

    expect(result).toBeNull();
    expect(fsMock.writeFile).not.toHaveBeenCalled();
  });

  it('downloads and caches image content', async () => {
    fsMock.mkdir.mockResolvedValue(undefined);
    fsMock.access.mockRejectedValue(new Error('missing'));
    axiosMock.get.mockResolvedValue({
      headers: { 'content-type': 'image/jpeg' },
      data: Buffer.from([1, 2, 3]),
    });
    fsMock.writeFile.mockResolvedValue(undefined);

    const service = new ThumbnailCacheService();
    const result = await service.cacheThumbnail('ASIN3', 'https://img.example.com/cover.jpeg');

    expect(result).toBe(path.join('/app/cache/thumbnails', 'ASIN3.jpeg'));
    expect(fsMock.writeFile).toHaveBeenCalled();
  });

  it('deletes thumbnails for a specific ASIN', async () => {
    fsMock.readdir.mockResolvedValue(['ASIN4.jpg', 'ASIN4.png', 'OTHER.jpg']);
    fsMock.unlink.mockResolvedValue(undefined);

    const service = new ThumbnailCacheService();
    await service.deleteThumbnail('ASIN4');

    expect(fsMock.unlink).toHaveBeenCalledTimes(2);
  });

  it('cleans up unused thumbnails', async () => {
    fsMock.mkdir.mockResolvedValue(undefined);
    fsMock.readdir.mockResolvedValue(['KEEP.jpg', 'DROP.jpg']);
    fsMock.unlink.mockResolvedValue(undefined);

    const service = new ThumbnailCacheService();
    const deleted = await service.cleanupUnusedThumbnails(new Set(['KEEP']));

    expect(deleted).toBe(1);
    expect(fsMock.unlink).toHaveBeenCalledTimes(1);
  });

  it('maps cached paths for serving', () => {
    const service = new ThumbnailCacheService();

    expect(service.getCachedPath(null)).toBeNull();
    expect(service.getCachedPath('/app/cache/thumbnails/ASIN.jpg')).toBe('/cache/thumbnails/ASIN.jpg');
  });

  it('exposes the cache directory', () => {
    const service = new ThumbnailCacheService();

    expect(service.getCacheDirectory()).toBe('/app/cache/thumbnails');
  });

  describe('Library Thumbnail Caching', () => {
    it('returns null when missing required parameters', async () => {
      const service = new ThumbnailCacheService();

      expect(await service.cacheLibraryThumbnail('', 'url', 'http://server', 'token', 'plex')).toBeNull();
      expect(await service.cacheLibraryThumbnail('guid', '', 'http://server', 'token', 'plex')).toBeNull();
      expect(await service.cacheLibraryThumbnail('guid', 'url', '', 'token', 'plex')).toBeNull();
      expect(await service.cacheLibraryThumbnail('guid', 'url', 'http://server', '', 'plex')).toBeNull();
    });

    it('returns cached path when library cover already exists', async () => {
      fsMock.mkdir.mockResolvedValue(undefined);
      fsMock.access.mockResolvedValue(undefined);

      const service = new ThumbnailCacheService();
      const result = await service.cacheLibraryThumbnail(
        'plex://guid/123',
        '/library/metadata/456/thumb',
        'http://plex:32400',
        'token123',
        'plex'
      );

      expect(result).toContain(path.join('app', 'cache', 'library'));
      expect(result).toMatch(/[a-f0-9]{16}\.jpg$/);
      expect(axiosMock.get).not.toHaveBeenCalled();
    });

    it('downloads library cover for Plex backend with token in URL', async () => {
      fsMock.mkdir.mockResolvedValue(undefined);
      fsMock.access.mockRejectedValue(new Error('missing'));
      axiosMock.get.mockResolvedValue({
        headers: { 'content-type': 'image/jpeg' },
        data: Buffer.from([1, 2, 3]),
      });
      fsMock.writeFile.mockResolvedValue(undefined);

      const service = new ThumbnailCacheService();
      const result = await service.cacheLibraryThumbnail(
        'plex://guid/789',
        '/library/metadata/123/thumb/456.jpg',
        'http://plex:32400',
        'plextoken',
        'plex'
      );

      expect(result).toContain(path.join('app', 'cache', 'library'));
      expect(result).toMatch(/[a-f0-9]{16}\.jpg$/);
      expect(axiosMock.get).toHaveBeenCalledWith(
        'http://plex:32400/library/metadata/123/thumb/456.jpg?X-Plex-Token=plextoken',
        expect.objectContaining({
          responseType: 'arraybuffer',
          timeout: 10000,
        })
      );
      expect(fsMock.writeFile).toHaveBeenCalled();
    });

    it('downloads library cover for Audiobookshelf backend with auth header', async () => {
      fsMock.mkdir.mockResolvedValue(undefined);
      fsMock.access.mockRejectedValue(new Error('missing'));
      axiosMock.get.mockResolvedValue({
        headers: { 'content-type': 'image/png' },
        data: Buffer.from([4, 5, 6]),
      });
      fsMock.writeFile.mockResolvedValue(undefined);

      const service = new ThumbnailCacheService();
      const result = await service.cacheLibraryThumbnail(
        'abs-item-456',
        '/api/items/abs-item-456/cover',
        'http://abs:13378',
        'abstoken',
        'audiobookshelf'
      );

      // URL has no extension, so defaults to .jpg
      expect(result).toContain(path.join('app', 'cache', 'library'));
      expect(result).toMatch(/[a-f0-9]{16}\.jpg$/);
      expect(axiosMock.get).toHaveBeenCalledWith(
        'http://abs:13378/api/items/abs-item-456/cover',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer abstoken',
          }),
        })
      );
      expect(fsMock.writeFile).toHaveBeenCalled();
    });

    it('rejects non-image content types for library covers', async () => {
      fsMock.mkdir.mockResolvedValue(undefined);
      fsMock.access.mockRejectedValue(new Error('missing'));
      axiosMock.get.mockResolvedValue({
        headers: { 'content-type': 'text/html' },
        data: Buffer.from('error page'),
      });

      const service = new ThumbnailCacheService();
      const result = await service.cacheLibraryThumbnail(
        'guid',
        '/cover',
        'http://server',
        'token',
        'plex'
      );

      expect(result).toBeNull();
      expect(fsMock.writeFile).not.toHaveBeenCalled();
    });

    it('generates consistent SHA-256 hash filenames for same plexGuid', async () => {
      fsMock.mkdir.mockResolvedValue(undefined);
      fsMock.access.mockResolvedValue(undefined);

      const service = new ThumbnailCacheService();
      const result1 = await service.cacheLibraryThumbnail(
        'plex://guid/123',
        '/thumb.jpg',
        'http://server',
        'token',
        'plex'
      );
      const result2 = await service.cacheLibraryThumbnail(
        'plex://guid/123',
        '/thumb.jpg',
        'http://server',
        'token',
        'plex'
      );

      expect(result1).toBe(result2);
      const filename = path.basename(result1 || '');
      expect(filename).toMatch(/^[a-f0-9]{16}\.jpg$/);
    });

    it('cleans up orphaned library thumbnails', async () => {
      fsMock.mkdir.mockResolvedValue(undefined);

      const service = new ThumbnailCacheService();

      // First, cache some files to get their actual hash filenames
      fsMock.access.mockRejectedValue(new Error('not found'));
      axiosMock.get.mockResolvedValue({
        headers: { 'content-type': 'image/jpeg' },
        data: Buffer.from([1, 2, 3]),
      });
      fsMock.writeFile.mockResolvedValue(undefined);

      const path1 = await service.cacheLibraryThumbnail('guid-1', '/cover.jpg', 'http://server', 'token', 'plex');
      const path2 = await service.cacheLibraryThumbnail('guid-2', '/cover.jpg', 'http://server', 'token', 'plex');

      const filename1 = path.basename(path1 || '');
      const filename2 = path.basename(path2 || '');

      // Now set up the cleanup test with actual filenames
      fsMock.readdir.mockResolvedValue([
        filename1,               // Will be kept
        'orphaned123456ab.png',  // Will be deleted
        filename2,               // Will be kept
      ]);
      fsMock.unlink.mockResolvedValue(undefined);

      const plexGuidMap = new Map([
        ['guid-1', 'any-value'],
        ['guid-2', 'any-value'],
      ]);

      const deleted = await service.cleanupLibraryThumbnails(plexGuidMap);

      expect(deleted).toBe(1);
      expect(fsMock.unlink).toHaveBeenCalledTimes(1);
      expect(fsMock.unlink).toHaveBeenCalledWith(
        expect.stringContaining('orphaned123456ab.png')
      );
    });

    it('handles errors gracefully when caching library thumbnails', async () => {
      fsMock.mkdir.mockResolvedValue(undefined);
      fsMock.access.mockRejectedValue(new Error('missing'));
      axiosMock.get.mockRejectedValue(new Error('Network error'));

      const service = new ThumbnailCacheService();
      const result = await service.cacheLibraryThumbnail(
        'guid',
        '/cover',
        'http://server',
        'token',
        'plex'
      );

      expect(result).toBeNull();
      expect(fsMock.writeFile).not.toHaveBeenCalled();
    });
  });
});
