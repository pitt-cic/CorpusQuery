import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useChatFlow } from '@/hooks/useChatFlow';
import { AllProviders } from '../test-utils';
import { JobStatus } from '@/contracts';

function wrapper({ children }: { children: React.ReactNode }) {
  return <AllProviders>{children}</AllProviders>;
}

describe('useChatFlow', () => {
  it('loads messages for active session', async () => {
    const { result } = renderHook(() => useChatFlow('sess-001'), { wrapper });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });
  });

  it('submits question and tracks job status', async () => {
    const { result } = renderHook(() => useChatFlow('sess-001'), { wrapper });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });

    await act(async () => {
      await result.current.ask('How do feedback loops affect prediction accuracy?');
    });

    await waitFor(() => {
      expect(result.current.pendingJobId).not.toBeNull();
    });

    await waitFor(
      () => {
        expect(result.current.status).toBe(JobStatus.COMPLETED);
      },
      { timeout: 5000 }
    );
  });

  it('returns null status when no pending job', async () => {
    const { result } = renderHook(() => useChatFlow('sess-001'), { wrapper });

    await waitFor(() => {
      expect(result.current.messages).toBeDefined();
    });

    expect(result.current.status).toBeNull();
  });
});
