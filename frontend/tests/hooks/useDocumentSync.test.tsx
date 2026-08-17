import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse, delay } from 'msw';
import { useDocumentSync } from '@/hooks/useDocumentSync';
import { useSyncJobs } from '@/hooks/useSyncJobs';
import { AllProviders } from '../test-utils';
import { server } from '../setup';

function wrapper({ children }: { children: React.ReactNode }) {
  return <AllProviders>{children}</AllProviders>;
}

function makeSharedWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  function SharedWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }
  return SharedWrapper;
}

describe('useDocumentSync', () => {
  it('provides triggerSync function', async () => {
    const { result } = renderHook(() => useDocumentSync(), { wrapper });

    expect(result.current.triggerSync).toBeDefined();
    expect(typeof result.current.triggerSync).toBe('function');
  });

  it('tracks syncing state during mutation', async () => {
    const { result } = renderHook(() => useDocumentSync(), { wrapper });

    expect(result.current.isSyncing).toBe(false);

    await act(async () => {
      result.current.triggerSync();
    });

    await waitFor(() => {
      expect(result.current.isSyncing).toBe(false);
    });
  });

  it('returns job info after sync', async () => {
    const { result } = renderHook(() => useDocumentSync(), { wrapper });

    act(() => {
      result.current.triggerSync();
    });

    await waitFor(() => {
      expect(result.current.lastJobId).toBe('mock-job-123');
    });
  });

  it('calls api.syncDocuments and returns job info', async () => {
    const { result } = renderHook(() => useDocumentSync(), { wrapper });

    act(() => {
      result.current.triggerSync();
    });

    await waitFor(() => {
      expect(result.current.lastJobId).toBe('mock-job-123');
      expect(result.current.error).toBeNull();
    });
  });

  it('replaces optimistic job ID with real ID on success', async () => {
    const sharedWrapper = makeSharedWrapper();
    const { result: syncJobsResult } = renderHook(() => useSyncJobs(), { wrapper: sharedWrapper });
    const { result: syncResult } = renderHook(() => useDocumentSync(), { wrapper: sharedWrapper });

    await waitFor(() => {
      expect(syncJobsResult.current.isLoading).toBe(false);
    });

    act(() => {
      syncResult.current.triggerSync();
    });

    await waitFor(() => {
      expect(syncResult.current.lastJobId).toBe('mock-job-123');
    });

    await waitFor(() => {
      const firstJob = syncJobsResult.current.jobs[0];
      expect(firstJob.ingestionJobId).toBe('mock-job-123');
      expect(firstJob.status).toBe('STARTING');
    });
  });

  it('rolls back optimistic job on error', async () => {
    server.use(
      http.post('/api/documents/sync', () => {
        return HttpResponse.json(
          { error: 'SYNC_IN_PROGRESS', message: 'Sync already running' },
          { status: 409 }
        );
      })
    );

    const sharedWrapper = makeSharedWrapper();
    const { result: syncJobsResult } = renderHook(() => useSyncJobs(), { wrapper: sharedWrapper });
    const { result: syncResult } = renderHook(() => useDocumentSync(), { wrapper: sharedWrapper });

    await waitFor(() => {
      expect(syncJobsResult.current.isLoading).toBe(false);
    });

    const initialJobs = [...syncJobsResult.current.jobs];

    act(() => {
      syncResult.current.triggerSync();
    });

    await waitFor(() => {
      expect(syncResult.current.isConflict).toBe(true);
    });

    await waitFor(() => {
      expect(syncJobsResult.current.jobs).toEqual(initialJobs);
    });
  });

  it('optimistically inserts STARTING job into sync-jobs cache', async () => {
    // Add delay so mutation stays in-flight long enough to observe optimistic state
    server.use(
      http.post('/api/documents/sync', async () => {
        await delay(500);
        return HttpResponse.json({ ingestionJobId: 'mock-job-123', status: 'STARTING' });
      })
    );

    const sharedWrapper = makeSharedWrapper();
    const { result: syncJobsResult } = renderHook(() => useSyncJobs(), { wrapper: sharedWrapper });
    const { result: syncResult } = renderHook(() => useDocumentSync(), { wrapper: sharedWrapper });

    await waitFor(() => {
      expect(syncJobsResult.current.isLoading).toBe(false);
    });

    const initialJobCount = syncJobsResult.current.jobs.length;

    act(() => {
      syncResult.current.triggerSync();
    });

    await waitFor(() => {
      expect(syncJobsResult.current.jobs.length).toBe(initialJobCount + 1);
      expect(syncJobsResult.current.jobs[0].status).toBe('STARTING');
      expect(syncJobsResult.current.jobs[0].ingestionJobId).toMatch(/^optimistic-/);
    });
  });
});
