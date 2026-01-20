/**
 * Component: Plex Library Service Tests
 * Documentation: documentation/features/audiobookshelf-integration.md
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlexLibraryService } from '@/lib/services/library/PlexLibraryService';

const plexServiceMock = vi.hoisted(() => ({
  testConnection: vi.fn(),
  getLibraries: vi.fn(),
  getLibraryContent: vi.fn(),
  getRecentlyAdded: vi.fn(),
  getItemMetadata: vi.fn(),
  searchLibrary: vi.fn(),
  scanLibrary: vi.fn(),
}));

const configServiceMock = vi.hoisted(() => ({
  getPlexConfig: vi.fn(),
}));

vi.mock('@/lib/integrations/plex.service', () => ({
  getPlexService: () => plexServiceMock,
}));

vi.mock('@/lib/services/config.service', () => ({
  getConfigService: () => configServiceMock,
}));

describe('PlexLibraryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when Plex config is incomplete', async () => {
    configServiceMock.getPlexConfig.mockResolvedValue({ serverUrl: null, authToken: null });

    const service = new PlexLibraryService();
    const result = await service.testConnection();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Plex server configuration is incomplete');
  });

  it('returns server info on successful test', async () => {
    configServiceMock.getPlexConfig.mockResolvedValue({ serverUrl: 'http://plex', authToken: 'token' });
    plexServiceMock.testConnection.mockResolvedValue({
      success: true,
      info: {
        platform: 'Plex',
        version: '1.0.0',
        machineIdentifier: 'machine',
      },
    });

    const service = new PlexLibraryService();
    const result = await service.testConnection();

    expect(result.success).toBe(true);
    expect(result.serverInfo).toEqual({
      name: 'Plex',
      version: '1.0.0',
      platform: 'Plex',
      identifier: 'machine',
    });
  });

  it('returns an error when testConnection throws', async () => {
    configServiceMock.getPlexConfig.mockResolvedValue({ serverUrl: 'http://plex', authToken: 'token' });
    plexServiceMock.testConnection.mockRejectedValue(new Error('boom'));

    const service = new PlexLibraryService();
    const result = await service.testConnection();

    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
  });

  it('maps libraries and items', async () => {
    configServiceMock.getPlexConfig.mockResolvedValue({ serverUrl: 'http://plex', authToken: 'token' });
    plexServiceMock.getLibraries.mockResolvedValue([
      { id: 'lib-1', title: 'Audiobooks', type: 'artist', itemCount: 5 },
    ]);
    plexServiceMock.getLibraryContent.mockResolvedValue([
      {
        ratingKey: 'rk-1',
        guid: 'com.plexapp.agents.audible://B00ABC1234?lang=en',
        title: 'Title',
        author: 'Author',
        narrator: 'Narrator',
        summary: 'Summary',
        thumb: '/thumb',
        duration: 120000,
        year: 2020,
        addedAt: 1700000000,
        updatedAt: 1700000100,
      },
    ]);

    const service = new PlexLibraryService();
    const libs = await service.getLibraries();
    const items = await service.getLibraryItems('lib-1');

    expect(libs).toEqual([{ id: 'lib-1', name: 'Audiobooks', type: 'artist', itemCount: 5 }]);
    expect(items[0]).toEqual({
      id: 'rk-1',
      externalId: 'com.plexapp.agents.audible://B00ABC1234?lang=en',
      title: 'Title',
      author: 'Author',
      narrator: 'Narrator',
      description: 'Summary',
      coverUrl: '/thumb',
      duration: 120,
      asin: 'B00ABC1234',
      isbn: undefined,
      year: 2020,
      addedAt: new Date(1700000000 * 1000),
      updatedAt: new Date(1700000100 * 1000),
    });
  });

  it('returns null for getItem when metadata is unavailable', async () => {
    configServiceMock.getPlexConfig.mockResolvedValue({ serverUrl: 'http://plex', authToken: 'token' });
    plexServiceMock.getItemMetadata.mockResolvedValue({ userRating: 4 });

    const service = new PlexLibraryService();
    const item = await service.getItem('rk-1');

    expect(item).toBeNull();
  });

  it('triggers Plex scans and searches', async () => {
    configServiceMock.getPlexConfig.mockResolvedValue({ serverUrl: 'http://plex', authToken: 'token' });
    plexServiceMock.searchLibrary.mockResolvedValue([
      {
        ratingKey: 'rk-2',
        guid: 'plex://album/abc',
        title: 'Search Title',
        author: 'Search Author',
        addedAt: 1700000000,
        updatedAt: 1700000000,
      },
    ]);
    plexServiceMock.scanLibrary.mockResolvedValue(undefined);

    const service = new PlexLibraryService();
    const results = await service.searchItems('lib-1', 'Search');
    await service.triggerLibraryScan('lib-1');

    expect(results[0].title).toBe('Search Title');
    expect(results[0].asin).toBeUndefined();
    expect(plexServiceMock.scanLibrary).toHaveBeenCalledWith('http://plex', 'token', 'lib-1');
  });

  it('maps recently added items with missing duration', async () => {
    configServiceMock.getPlexConfig.mockResolvedValue({ serverUrl: 'http://plex', authToken: 'token' });
    plexServiceMock.getRecentlyAdded.mockResolvedValue([
      {
        ratingKey: 'rk-3',
        guid: 'plex://album/xyz',
        title: 'Recent Title',
        author: 'Author',
        addedAt: 1700000000,
        updatedAt: 1700000100,
      },
    ]);

    const service = new PlexLibraryService();
    const items = await service.getRecentlyAdded('lib-1', 5);

    expect(items[0]).toEqual(expect.objectContaining({
      id: 'rk-3',
      title: 'Recent Title',
      asin: undefined,
      duration: undefined,
    }));
  });

  it('throws when server info cannot be retrieved', async () => {
    configServiceMock.getPlexConfig.mockResolvedValue({ serverUrl: 'http://plex', authToken: 'token' });
    plexServiceMock.testConnection.mockResolvedValue({ success: false, message: 'down' });

    const service = new PlexLibraryService();

    await expect(service.getServerInfo()).rejects.toThrow('Failed to get server information');
  });

  it('throws when libraries are fetched without config', async () => {
    configServiceMock.getPlexConfig.mockResolvedValue({ serverUrl: null, authToken: null });

    const service = new PlexLibraryService();

    await expect(service.getLibraries()).rejects.toThrow('Plex server configuration is incomplete');
  });

  it('returns null when getItem metadata lookup fails', async () => {
    configServiceMock.getPlexConfig.mockResolvedValue({ serverUrl: 'http://plex', authToken: 'token' });
    plexServiceMock.getItemMetadata.mockRejectedValue(new Error('boom'));

    const service = new PlexLibraryService();
    const item = await service.getItem('rk-2');

    expect(item).toBeNull();
  });

  it('throws when triggerLibraryScan is called without config', async () => {
    configServiceMock.getPlexConfig.mockResolvedValue({ serverUrl: null, authToken: null });

    const service = new PlexLibraryService();

    await expect(service.triggerLibraryScan('lib-1')).rejects.toThrow('Plex server configuration is incomplete');
  });

  it('returns cover caching params for Plex backend', async () => {
    configServiceMock.getPlexConfig.mockResolvedValue({
      serverUrl: 'http://plex:32400',
      authToken: 'plex-token-123',
      libraryId: 'lib-1',
    });

    const service = new PlexLibraryService();
    const params = await service.getCoverCachingParams();

    expect(params).toEqual({
      backendBaseUrl: 'http://plex:32400',
      authToken: 'plex-token-123',
      backendMode: 'plex',
    });
  });

  it('throws when getting cover caching params without config', async () => {
    configServiceMock.getPlexConfig.mockResolvedValue({ serverUrl: null, authToken: null });

    const service = new PlexLibraryService();

    await expect(service.getCoverCachingParams()).rejects.toThrow('Plex server configuration is incomplete');
  });
});
