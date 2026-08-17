import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSessions } from '@/hooks/useSessions';
import { AllProviders } from '../test-utils';

function wrapper({ children }: { children: React.ReactNode }) {
  return <AllProviders>{children}</AllProviders>;
}

describe('useSessions', () => {
  it('fetches session list', async () => {
    const { result } = renderHook(() => useSessions(), { wrapper });

    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(3);
    });

    expect(result.current.sessions[0].sessionId).toBe('sess-001');
    expect(result.current.sessions[0].title).toBe('Climate modeling accuracy');
  });

  it('exposes isLoading state', () => {
    const { result } = renderHook(() => useSessions(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });
});
