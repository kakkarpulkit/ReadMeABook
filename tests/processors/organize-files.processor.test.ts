/**
 * Component: Organize Files Processor Tests
 * Documentation: documentation/phase3/file-organization.md
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPrismaMock } from '../helpers/prisma';

const prismaMock = createPrismaMock();
const organizerMock = vi.hoisted(() => ({ organize: vi.fn() }));
const libraryServiceMock = vi.hoisted(() => ({ triggerLibraryScan: vi.fn() }));
const configMock = vi.hoisted(() => ({
  getBackendMode: vi.fn(),
  get: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

vi.mock('@/lib/utils/file-organizer', () => ({
  getFileOrganizer: () => organizerMock,
}));

vi.mock('@/lib/services/library', () => ({
  getLibraryService: () => libraryServiceMock,
}));

vi.mock('@/lib/services/config.service', () => ({
  getConfigService: () => configMock,
}));

describe('processOrganizeFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('organizes files and triggers filesystem scan when enabled', async () => {
    prismaMock.request.update.mockResolvedValue({});
    prismaMock.audiobook.findUnique.mockResolvedValue({
      id: 'a1',
      title: 'Book',
      author: 'Author',
      narrator: null,
      coverArtUrl: null,
      audibleAsin: 'ASIN1',
    });
    organizerMock.organize.mockResolvedValue({
      success: true,
      targetPath: '/media/Author/Book',
      filesMovedCount: 1,
      errors: [],
      audioFiles: ['/media/Author/Book/Book.m4b'],
    });
    prismaMock.audiobook.update.mockResolvedValue({});
    prismaMock.request.update.mockResolvedValue({});
    configMock.getBackendMode.mockResolvedValue('plex');
    configMock.get.mockImplementation(async (key: string) => {
      if (key === 'plex.trigger_scan_after_import') return 'true';
      if (key === 'plex_audiobook_library_id') return 'lib-1';
      if (key === 'audiobook_path_template') return '{author}/{title} {asin}';
      return null;
    });

    const { processOrganizeFiles } = await import('@/lib/processors/organize-files.processor');
    const result = await processOrganizeFiles({
      requestId: 'req-1',
      audiobookId: 'a1',
      downloadPath: '/downloads/book',
      jobId: 'job-1',
    });

    expect(result.success).toBe(true);
    expect(libraryServiceMock.triggerLibraryScan).toHaveBeenCalledWith('lib-1');
  });

  it('queues retry when a retryable error occurs', async () => {
    prismaMock.request.update.mockResolvedValue({});
    prismaMock.audiobook.findUnique.mockResolvedValue({
      id: 'a2',
      title: 'Book',
      author: 'Author',
      narrator: null,
      coverArtUrl: null,
      audibleAsin: 'ASIN2',
    });
    organizerMock.organize.mockResolvedValue({
      success: false,
      targetPath: '',
      filesMovedCount: 0,
      errors: ['No audiobook files found in download'],
      audioFiles: [],
    });
    prismaMock.request.findFirst.mockResolvedValue({
      importAttempts: 0,
      maxImportRetries: 3,
      deletedAt: null,
    });
    configMock.get.mockImplementation(async (key: string) => {
      if (key === 'audiobook_path_template') return '{author}/{title} {asin}';
      return null;
    });

    const { processOrganizeFiles } = await import('@/lib/processors/organize-files.processor');
    const result = await processOrganizeFiles({
      requestId: 'req-2',
      audiobookId: 'a2',
      downloadPath: '/downloads/book',
      jobId: 'job-2',
    });

    expect(result.success).toBe(false);
    expect(prismaMock.request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'awaiting_import' }),
      })
    );
  });
});


