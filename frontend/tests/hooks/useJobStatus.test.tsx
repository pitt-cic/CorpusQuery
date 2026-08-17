import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useJobStatus } from '@/hooks/useJobStatus';
import { AllProviders } from '../test-utils';
import { JobStatus } from '@/contracts';

function wrapper({ children }: { children: React.ReactNode }) {
  return <AllProviders>{children}</AllProviders>;
}

describe('useJobStatus', () => {
  it('fetches job status when jobId is provided', async () => {
    const { result } = renderHook(() => useJobStatus('job-001'), { wrapper });

    await waitFor(() => {
      expect(result.current.job?.status).toBe(JobStatus.COMPLETED);
    });
  });

  it('does not fetch when jobId is null', () => {
    const { result } = renderHook(() => useJobStatus(null), { wrapper });
    expect(result.current.job).toBeUndefined();
  });

  it('stops polling when job reaches terminal state', async () => {
    const { result } = renderHook(() => useJobStatus('job-001'), { wrapper });

    await waitFor(() => {
      expect(result.current.isPolling).toBe(false);
    });
  });
});
