/**
 * Component: Audiobookshelf Library Service Tests
 * Documentation: documentation/features/audiobookshelf-integration.md
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudiobookshelfLibraryService } from '@/lib/services/library/AudiobookshelfLibraryService';

const apiMock = vi.hoisted(() => ({
  getABSServerInfo: vi.fn(),
  getABSLibraries: vi.fn(),
  getABSLibraryItems: vi.fn(),
  getABSRecentItems: vi.fn(),
  getABSItem: vi.fn(),
  searchABSItems: vi.fn(),
  triggerABSScan: vi.fn(),
}));

const configServiceMock = vi.hoisted(() => ({
  getMany: vi.fn(),
}));

vi.mock('@/lib/services/audiobookshelf/api', () => apiMock);

vi.mock('@/lib/services/config.service', () => ({
  getConfigService: () => configServiceMock,
}));

describe('AudiobookshelfLibraryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tests connection and returns server info', async () => {
    apiMock.getABSServerInfo.mockResolvedValue({ name: 'ABS', version: '2.0.0' });

    const service = new AudiobookshelfLibraryService();
    const result = await service.testConnection();

    expect(result.success).toBe(true);
    expect(result.serverInfo).toEqual({
      name: 'ABS',
      version: '2.0.0',
      identifier: 'ABS',
    });
  });

  it('returns errors when server info fails', async () => {
    apiMock.getABSServerInfo.mockRejectedValue(new Error('No connection'));

    const service = new AudiobookshelfLibraryService();
    const result = await service.testConnection();

    expect(result.success).toBe(false);
    expect(result.error).toBe('No connection');
  });

  it('filters audiobook libraries only', async () => {
    apiMock.getABSLibraries.mockResolvedValue([
      { id: 'lib-1', name: 'Books', mediaType: 'book', stats: { totalItems: 10 } },
      { id: 'lib-2', name: 'Podcasts', mediaType: 'podcast', stats: { totalItems: 5 } },
    ]);

    const service = new AudiobookshelfLibraryService();
    const libs = await service.getLibraries();

    expect(libs).toEqual([
      { id: 'lib-1', name: 'Books', type: 'book', itemCount: 10 },
    ]);
  });

  it('maps library items to generic fields', async () => {
    apiMock.getABSLibraryItems.mockResolvedValue([
      {
        id: 'item-1',
        addedAt: 1700000000000,
        updatedAt: 1700000100000,
        media: {
          duration: 3600,
          coverPath: '/covers/1.jpg',
          metadata: {
            title: 'Title',
            authorName: 'Author',
            narratorName: 'Narrator',
            description: 'Desc',
            asin: 'ASIN1',
            isbn: 'ISBN1',
            publishedYear: '2020',
          },
        },
      },
    ]);

    const service = new AudiobookshelfLibraryService();
    const items = await service.getLibraryItems('lib-1');

    expect(items[0]).toEqual({
      id: 'item-1',
      externalId: 'item-1',
      title: 'Title',
      author: 'Author',
      narrator: 'Narrator',
      description: 'Desc',
      coverUrl: '/api/items/item-1/cover',
      duration: 3600,
      asin: 'ASIN1',
      isbn: 'ISBN1',
      year: 2020,
      addedAt: new Date(1700000000000),
      updatedAt: new Date(1700000100000),
    });
  });

  it('returns null when item fetch fails', async () => {
    apiMock.getABSItem.mockRejectedValue(new Error('missing'));

    const service = new AudiobookshelfLibraryService();
    const result = await service.getItem('item-1');

    expect(result).toBeNull();
  });

  it('searches items and maps results', async () => {
    apiMock.searchABSItems.mockResolvedValue([
      {
        libraryItem: {
          id: 'item-2',
          addedAt: 1700000000000,
          updatedAt: 1700000000000,
          media: {
            duration: 200,
            metadata: {
              title: 'Search Title',
              authorName: 'Search Author',
              narratorName: '',
              description: '',
            },
          },
        },
      },
    ]);

    const service = new AudiobookshelfLibraryService();
    const items = await service.searchItems('lib-1', 'Search');

    expect(items[0].title).toBe('Search Title');
    expect(items[0].author).toBe('Search Author');
  });

  it('triggers library scans', async () => {
    apiMock.triggerABSScan.mockResolvedValue(undefined);

    const service = new AudiobookshelfLibraryService();
    await service.triggerLibraryScan('lib-1');

    expect(apiMock.triggerABSScan).toHaveBeenCalledWith('lib-1');
  });

  it('returns cover caching params for Audiobookshelf backend', async () => {
    configServiceMock.getMany.mockResolvedValue({
      'audiobookshelf.server_url': 'http://abs:13378',
      'audiobookshelf.api_token': 'abs-token-456',
    });

    const service = new AudiobookshelfLibraryService();
    const params = await service.getCoverCachingParams();

    expect(params).toEqual({
      backendBaseUrl: 'http://abs:13378',
      authToken: 'abs-token-456',
      backendMode: 'audiobookshelf',
    });
  });

  it('throws when getting cover caching params without server URL', async () => {
    configServiceMock.getMany.mockResolvedValue({
      'audiobookshelf.server_url': null,
      'audiobookshelf.api_token': 'token',
    });

    const service = new AudiobookshelfLibraryService();

    await expect(service.getCoverCachingParams()).rejects.toThrow('Audiobookshelf server configuration is incomplete');
  });

  it('throws when getting cover caching params without API token', async () => {
    configServiceMock.getMany.mockResolvedValue({
      'audiobookshelf.server_url': 'http://abs',
      'audiobookshelf.api_token': null,
    });

    const service = new AudiobookshelfLibraryService();

    await expect(service.getCoverCachingParams()).rejects.toThrow('Audiobookshelf server configuration is incomplete');
  });
});
