/**
 * Component: Admin Logs Page Tests
 * Documentation: documentation/admin-dashboard.md
 */

// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminLogsPage from '@/app/admin/logs/page';

const useSWRMock = vi.hoisted(() => vi.fn());

vi.mock('swr', () => ({
  default: (...args: any[]) => useSWRMock(...args),
}));

vi.mock('@/lib/utils/api', () => ({
  authenticatedFetcher: vi.fn(),
}));

describe('AdminLogsPage', () => {
  beforeEach(() => {
    useSWRMock.mockReset();
  });

  it('renders logs and toggles detail rows', async () => {
    useSWRMock.mockImplementation(() => ({
      data: {
        logs: [
          {
            id: 'log-1',
            bullJobId: 'bull-1',
            type: 'search_indexers',
            status: 'failed',
            priority: 1,
            attempts: 2,
            maxAttempts: 3,
            errorMessage: 'Search failed',
            startedAt: '2024-01-01T00:00:00Z',
            completedAt: '2024-01-01T00:02:00Z',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:02:00Z',
            result: { retries: 2 },
            events: [
              {
                id: 'event-1',
                level: 'error',
                context: 'SearchJob',
                message: 'Indexer timeout',
                metadata: { indexer: 'Example' },
                createdAt: '2024-01-01T00:01:00Z',
              },
            ],
            request: {
              id: 'req-1',
              audiobook: { title: 'Search Book', author: 'Author' },
              user: { plexUsername: 'User' },
            },
          },
        ],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
      },
      error: undefined,
    }));

    render(<AdminLogsPage />);

    expect(await screen.findByText('System Logs')).toBeInTheDocument();
    expect(screen.getAllByText('Search Book')[0]).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Show Details' })[0]);
    expect(screen.getAllByText('Event Log')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Job Result')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Error')[0]).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Hide Details' })[0]);
    expect(screen.queryByText('Event Log')).not.toBeInTheDocument();
  });

  it('updates the swr key when filters change', async () => {
    useSWRMock.mockImplementation(() => ({
      data: { logs: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 1 } },
      error: undefined,
    }));

    render(<AdminLogsPage />);

    const statusSelect = screen
      .getByText('Status', { selector: 'label' })
      .parentElement?.querySelector('select');
    expect(statusSelect).not.toBeNull();
    fireEvent.change(statusSelect as HTMLSelectElement, { target: { value: 'completed' } });

    await waitFor(() => {
      expect(useSWRMock).toHaveBeenCalledWith(
        '/api/admin/logs?page=1&limit=50&status=completed&type=all',
        expect.any(Function),
        expect.any(Object)
      );
    });
  });

  it('renders error state when logs fail to load', async () => {
    useSWRMock.mockImplementation(() => ({
      data: undefined,
      error: new Error('Log failure'),
    }));

    render(<AdminLogsPage />);

    expect(await screen.findByText('Error Loading Logs')).toBeInTheDocument();
    expect(screen.getByText('Log failure')).toBeInTheDocument();
  });

  it('renders empty state when no logs are returned', async () => {
    useSWRMock.mockImplementation(() => ({
      data: { logs: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 1 } },
      error: undefined,
    }));

    render(<AdminLogsPage />);

    expect((await screen.findAllByText('No logs found'))[0]).toBeInTheDocument();
  });
});
