import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSyncJobs } from '@/hooks/useSyncJobs';
import { AllProviders } from '../test-utils';

function wrapper({ children }: { children: React.ReactNode }) {
  return <AllProviders>{children}</AllProviders>;
}

describe('useSyncJobs', () => {
  it('fetches sync jobs on mount', async () => {
    const { result } = renderHook(() => useSyncJobs(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.jobs.length).toBeGreaterThan(0);
    expect(result.current.jobs[0]).toHaveProperty('ingestionJobId');
    expect(result.current.jobs[0]).toHaveProperty('status');
  });

  it('provides refresh function', async () => {
    const { result } = renderHook(() => useSyncJobs(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.refresh).toBe('function');
  });

  it('provides pagination controls', async () => {
    const { result } = renderHook(() => useSyncJobs(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.hasNextPage).toBe('boolean');
    expect(typeof result.current.hasPrevPage).toBe('boolean');
    expect(typeof result.current.nextPage).toBe('function');
    expect(typeof result.current.prevPage).toBe('function');
  });
});
