import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAskQuestion } from '@/hooks/useAskQuestion';
import { AllProviders } from '../test-utils';

function wrapper({ children }: { children: React.ReactNode }) {
  return <AllProviders>{children}</AllProviders>;
}

describe('useAskQuestion', () => {
  it('submits a question and returns jobId + sessionId', async () => {
    const { result } = renderHook(() => useAskQuestion(), { wrapper });

    let response: { jobId: string; sessionId: string } | undefined;
    await act(async () => {
      response = await result.current.ask({
        question: 'How do feedback loops affect prediction accuracy?',
        sessionId: 'sess-001',
      });
    });

    expect(response?.jobId).toBeDefined();
    expect(response?.sessionId).toBe('sess-001');
  });
});
