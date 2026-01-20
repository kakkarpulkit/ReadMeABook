/**
 * Component: Library Scan Processor Tests
 * Documentation: documentation/backend/services/jobs.md
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPrismaMock } from '../helpers/prisma';

const prismaMock = createPrismaMock();
const libraryServiceMock = vi.hoisted(() => ({
  getLibraryItems: vi.fn(),
  getCoverCachingParams: vi.fn(),
}));
const configMock = vi.hoisted(() => ({
  getBackendMode: vi.fn(),
  getPlexConfig: vi.fn(),
  get: vi.fn(),
}));
const thumbnailCacheServiceMock = vi.hoisted(() => ({
  cacheLibraryThumbnail: vi.fn(),
}));

vi.mock('@/lib/utils/audiobook-matcher', () => ({
  findPlexMatch: vi.fn(),
}));

vi.mock('@/lib/services/audiobookshelf/api', () => ({
  triggerABSItemMatch: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

vi.mock('@/lib/services/library', () => ({
  getLibraryService: () => libraryServiceMock,
}));

vi.mock('@/lib/services/config.service', () => ({
  getConfigService: () => configMock,
}));

vi.mock('@/lib/services/thumbnail-cache.service', () => ({
  getThumbnailCacheService: () => thumbnailCacheServiceMock,
}));

describe('processScanPlex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates and updates library items, matches requests', async () => {
    configMock.getBackendMode.mockResolvedValue('plex');
    configMock.getPlexConfig.mockResolvedValue({
      serverUrl: 'http://plex',
      authToken: 'token',
      libraryId: 'lib-1',
      machineIdentifier: 'machine',
    });

    libraryServiceMock.getCoverCachingParams.mockResolvedValue({
      backendBaseUrl: 'http://plex',
      authToken: 'token',
      backendMode: 'plex',
    });

    thumbnailCacheServiceMock.cacheLibraryThumbnail.mockResolvedValue('/app/cache/library/test.jpg');

    libraryServiceMock.getLibraryItems.mockResolvedValue([
      {
        id: 'rating-1',
        externalId: 'guid-1',
        title: 'New Book',
        author: 'Author',
        addedAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'rating-2',
        externalId: 'guid-2',
        title: 'Existing Book',
        author: 'Author',
        addedAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    prismaMock.plexLibrary.findFirst.mockImplementation(async (query: any) => {
      if (query.where.plexGuid === 'guid-2') {
        return { id: 'existing-id', plexGuid: 'guid-2' };
      }
      return null;
    });
    prismaMock.plexLibrary.create.mockResolvedValue({ id: 'new-id', plexGuid: 'guid-1' });
    prismaMock.plexLibrary.update.mockResolvedValue({});
    prismaMock.plexLibrary.findMany.mockResolvedValue([]);
    prismaMock.audiobook.findMany.mockResolvedValue([]);
    prismaMock.request.findMany.mockResolvedValue([
      {
        id: 'req-1',
        status: 'downloaded',
        audiobook: {
          id: 'a1',
          title: 'New Book',
          author: 'Author',
          narrator: null,
          audibleAsin: 'ASIN1',
        },
      },
    ]);
    prismaMock.audiobook.update.mockResolvedValue({});
    prismaMock.request.update.mockResolvedValue({});

    const matcher = await import('@/lib/utils/audiobook-matcher');
    vi.spyOn(matcher, 'findPlexMatch').mockResolvedValue({
      plexGuid: 'guid-1',
      plexRatingKey: 'rating-1',
      title: 'New Book',
      author: 'Author',
    });

    const { processScanPlex } = await import('@/lib/processors/scan-plex.processor');
    const result = await processScanPlex({ jobId: 'job-1' });

    expect(result.success).toBe(true);
    expect(prismaMock.plexLibrary.create).toHaveBeenCalled();
    expect(prismaMock.plexLibrary.update).toHaveBeenCalled();
    expect(prismaMock.request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'available' }),
      })
    );
  });

  it('throws when audiobookshelf library is not configured', async () => {
    configMock.getBackendMode.mockResolvedValue('audiobookshelf');
    configMock.get.mockResolvedValue(null);

    libraryServiceMock.getCoverCachingParams.mockResolvedValue({
      backendBaseUrl: 'http://abs',
      authToken: 'token',
      backendMode: 'audiobookshelf',
    });

    const { processScanPlex } = await import('@/lib/processors/scan-plex.processor');

    await expect(processScanPlex({ jobId: 'job-2' })).rejects.toThrow(
      'Audiobookshelf library not configured'
    );
    expect(libraryServiceMock.getLibraryItems).not.toHaveBeenCalled();
  });

  it('removes stale items and resets linked audiobooks and requests', async () => {
    configMock.getBackendMode.mockResolvedValue('plex');
    configMock.getPlexConfig.mockResolvedValue({
      serverUrl: 'http://plex',
      authToken: 'token',
      libraryId: 'lib-1',
      machineIdentifier: 'machine',
    });

    libraryServiceMock.getCoverCachingParams.mockResolvedValue({
      backendBaseUrl: 'http://plex',
      authToken: 'token',
      backendMode: 'plex',
    });

    thumbnailCacheServiceMock.cacheLibraryThumbnail.mockResolvedValue('/app/cache/library/test.jpg');

    libraryServiceMock.getLibraryItems.mockResolvedValue([
      {
        id: 'rating-1',
        externalId: 'guid-1',
        title: 'Current Book',
        author: 'Author',
        addedAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    prismaMock.plexLibrary.findFirst.mockResolvedValue(null);
    prismaMock.plexLibrary.create.mockResolvedValue({ id: 'new-id', plexGuid: 'guid-1' });
    prismaMock.plexLibrary.findMany
      .mockResolvedValueOnce([{ id: 'stale-1', plexGuid: 'stale-guid', title: 'Stale Book' }])
      .mockResolvedValueOnce([{ plexGuid: 'guid-1' }]);
    prismaMock.plexLibrary.delete.mockResolvedValue({});
    prismaMock.audiobook.findMany
      .mockResolvedValueOnce([
        {
          id: 'ab-1',
          title: 'Stale Book',
          requests: [{ id: 'req-1', status: 'available' }],
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'ab-valid',
          title: 'Valid Book',
          plexGuid: 'guid-1',
          absItemId: null,
          requests: [],
        },
        {
          id: 'ab-orphan',
          title: 'Orphaned Book',
          plexGuid: null,
          absItemId: 'missing-guid',
          requests: [{ id: 'req-2', status: 'available' }],
        },
      ]);
    prismaMock.audiobook.update.mockResolvedValue({});
    prismaMock.request.update.mockResolvedValue({});
    prismaMock.request.findMany.mockResolvedValue([]);

    const matcher = await import('@/lib/utils/audiobook-matcher');
    (matcher.findPlexMatch as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { processScanPlex } = await import('@/lib/processors/scan-plex.processor');
    const result = await processScanPlex({ jobId: 'job-3' });

    expect(result.success).toBe(true);
    expect(prismaMock.plexLibrary.delete).toHaveBeenCalledWith({ where: { id: 'stale-1' } });
    expect(prismaMock.audiobook.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ab-orphan' },
        data: expect.objectContaining({ plexGuid: null, absItemId: null }),
      })
    );
    expect(prismaMock.request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'downloaded' }),
      })
    );
  });

  it('matches audiobookshelf requests and triggers metadata match', async () => {
    configMock.getBackendMode.mockResolvedValue('audiobookshelf');
    configMock.get.mockResolvedValue('abs-lib');

    libraryServiceMock.getCoverCachingParams.mockResolvedValue({
      backendBaseUrl: 'http://abs',
      authToken: 'token',
      backendMode: 'audiobookshelf',
    });

    thumbnailCacheServiceMock.cacheLibraryThumbnail.mockResolvedValue('/app/cache/library/test.jpg');

    libraryServiceMock.getLibraryItems.mockResolvedValue([]);

    prismaMock.plexLibrary.findMany.mockResolvedValue([]);
    prismaMock.audiobook.findMany.mockResolvedValue([]);
    prismaMock.request.findMany.mockResolvedValue([
      {
        id: 'req-abs',
        status: 'downloaded',
        audiobook: {
          id: 'abs-audio',
          title: 'ABS Title',
          author: 'ABS Author',
          narrator: 'Narrator',
          audibleAsin: 'ASIN123',
        },
      },
    ]);
    prismaMock.audiobook.update.mockResolvedValue({});
    prismaMock.request.update.mockResolvedValue({});

    const matcher = await import('@/lib/utils/audiobook-matcher');
    (matcher.findPlexMatch as ReturnType<typeof vi.fn>).mockResolvedValue({
      plexGuid: 'abs-item-1',
      plexRatingKey: 'rating-abs',
      title: 'ABS Title',
      author: 'ABS Author',
    });

    const absApi = await import('@/lib/services/audiobookshelf/api');

    const { processScanPlex } = await import('@/lib/processors/scan-plex.processor');
    const result = await processScanPlex({ jobId: 'job-4' });

    expect(result.success).toBe(true);
    expect(prismaMock.audiobook.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ absItemId: 'abs-item-1' }),
      })
    );
    expect(absApi.triggerABSItemMatch).toHaveBeenCalledWith('abs-item-1', 'ASIN123');
  });
});


