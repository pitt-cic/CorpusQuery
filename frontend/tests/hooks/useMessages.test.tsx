import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMessages } from '@/hooks/useMessages';
import { AllProviders } from '../test-utils';

function wrapper({ children }: { children: React.ReactNode }) {
  return <AllProviders>{children}</AllProviders>;
}

describe('useMessages', () => {
  it('fetches messages for a session', async () => {
    const { result } = renderHook(() => useMessages('sess-001'), { wrapper });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });

    expect(result.current.messages[0].question).toBe(
      'What are the key limitations of current climate models?'
    );
  });

  it('returns empty array when sessionId is null', async () => {
    const { result } = renderHook(() => useMessages(null), { wrapper });
    expect(result.current.messages).toEqual([]);
  });
});
