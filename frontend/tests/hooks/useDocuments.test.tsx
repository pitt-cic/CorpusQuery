import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDocuments } from '@/hooks/useDocuments';
import { AllProviders } from '../test-utils';

function wrapper({ children }: { children: React.ReactNode }) {
  return <AllProviders>{children}</AllProviders>;
}

describe('useDocuments', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches document list with sync status', async () => {
    const { result } = renderHook(() => useDocuments(), { wrapper });

    await waitFor(() => {
      expect(result.current.documents).toHaveLength(5);
    });

    expect(result.current.documents[0].filename).toBe('zhang-climate-models-2024.pdf');
    expect(result.current.documents[0].status).toBe('INDEXED');
    expect(result.current.syncStatus).toBe('COMPLETE');
    expect(result.current.lastSyncedAt).toBeTruthy();
  });

  it('supports refresh with 60s cooldown', async () => {
    const { result } = renderHook(() => useDocuments(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.canRefresh).toBe(true);

    act(() => {
      result.current.refresh();
    });

    expect(result.current.canRefresh).toBe(false);
    expect(result.current.cooldownRemaining).toBeGreaterThan(0);

    // Fast-forward 60 seconds
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(result.current.canRefresh).toBe(true);
    expect(result.current.cooldownRemaining).toBe(0);
  });

  it('derives isSyncing from syncStatus', async () => {
    const { result } = renderHook(() => useDocuments(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Mock returns COMPLETE, so isSyncing should be false
    expect(result.current.isSyncing).toBe(false);
  });
});
