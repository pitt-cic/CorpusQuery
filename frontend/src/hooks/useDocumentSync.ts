import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { api } from '@/api/client';
import type { SyncJob, SyncJobsResponse } from '@/contracts';

const POLLING_INITIAL_INTERVAL = 10_000; // 10 seconds
const POLLING_MAX_INTERVAL = 30_000; // 30 seconds
const POLLING_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const TIMEOUT_MESSAGE = 'Sync is taking longer than expected. Please refresh manually in a few minutes.';

interface SyncError {
  error: 'SYNC_IN_PROGRESS' | 'UNKNOWN';
  message: string;
}

export function useDocumentSync() {
  const queryClient = useQueryClient();
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<SyncError | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [timeoutMessage, setTimeoutMessage] = useState<string | null>(null);

  const pollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptCountRef = useRef(0);
  const currentJobIdRef = useRef<string | null>(null);
  const pollRef = useRef<(() => Promise<void>) | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
    if (pollingIntervalRef.current) {
      clearTimeout(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    attemptCountRef.current = 0;
    currentJobIdRef.current = null;
    setIsPolling(false);
  }, []);

  const poll = useCallback(async () => {
    const jobId = currentJobIdRef.current;
    if (!jobId) return;

    try {
      const job = await api.getSyncJob(jobId);
      if (!job) {
        stopPolling();
        return;
      }

      // Update the sync-jobs cache with the latest job data
      const queryKey = ['sync-jobs', { pageSize: 10, nextToken: null }];
      queryClient.setQueryData<SyncJobsResponse>(queryKey, (old) => ({
        jobs: (old?.jobs ?? []).map((j) =>
          j.ingestionJobId === jobId ? job : j
        ),
        nextToken: old?.nextToken ?? null,
      }));

      if (job.status === 'COMPLETE') {
        queryClient.invalidateQueries({ queryKey: ['documents'] });
        stopPolling();
        return;
      }

      if (job.status === 'FAILED') {
        stopPolling();
        return;
      }

      // Schedule next poll with exponential backoff
      attemptCountRef.current += 1;
      const nextInterval = Math.min(
        POLLING_INITIAL_INTERVAL * Math.pow(2, attemptCountRef.current - 1),
        POLLING_MAX_INTERVAL
      );
      pollingIntervalRef.current = setTimeout(() => pollRef.current?.(), nextInterval);
    } catch {
      // On error, continue polling (network glitch)
      attemptCountRef.current += 1;
      const nextInterval = Math.min(
        POLLING_INITIAL_INTERVAL * Math.pow(2, attemptCountRef.current - 1),
        POLLING_MAX_INTERVAL
      );
      pollingIntervalRef.current = setTimeout(() => pollRef.current?.(), nextInterval);
    }
  }, [queryClient, stopPolling]);

  useEffect(() => {
    pollRef.current = poll;
  }, [poll]);

  const startPolling = useCallback((jobId: string) => {
    stopPolling();
    setTimeoutMessage(null);
    currentJobIdRef.current = jobId;
    attemptCountRef.current = 0;
    setIsPolling(true);

    // Set up 5-minute timeout
    pollingTimeoutRef.current = setTimeout(async () => {
      // Final fetch before stopping
      try {
        const job = await api.getSyncJob(jobId);
        if (job && (job.status === 'STARTING' || job.status === 'IN_PROGRESS')) {
          setTimeoutMessage(TIMEOUT_MESSAGE);
        }
      } catch {
        // Ignore errors on final fetch
      }
      stopPolling();
    }, POLLING_TIMEOUT);

    // Schedule first poll
    pollingIntervalRef.current = setTimeout(() => pollRef.current?.(), POLLING_INITIAL_INTERVAL);
  }, [stopPolling]);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  const mutation = useMutation({
    mutationFn: () => api.syncDocuments(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['sync-jobs'] });

      const queryKey = ['sync-jobs', { pageSize: 10, nextToken: null }];
      const previousData = queryClient.getQueryData<SyncJobsResponse>(queryKey);

      const optimisticJob: SyncJob = {
        ingestionJobId: `optimistic-${Date.now()}`,
        status: 'STARTING',
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        statistics: {
          numberOfDocumentsScanned: 0,
          numberOfDocumentsFailed: 0,
          numberOfNewDocumentsIndexed: 0,
          numberOfModifiedDocumentsIndexed: 0,
          numberOfDocumentsDeleted: 0,
        },
        failureReasons: [],
      };

      queryClient.setQueryData<SyncJobsResponse>(queryKey, (old) => ({
        jobs: [optimisticJob, ...(old?.jobs ?? [])],
        nextToken: old?.nextToken ?? null,
      }));

      return { previousData, optimisticJobId: optimisticJob.ingestionJobId };
    },
    onSuccess: (data, _variables, context) => {
      const queryKey = ['sync-jobs', { pageSize: 10, nextToken: null }];

      queryClient.setQueryData<SyncJobsResponse>(queryKey, (old) => ({
        jobs: (old?.jobs ?? []).map((job) =>
          job.ingestionJobId === context?.optimisticJobId
            ? { ...job, ingestionJobId: data.ingestionJobId }
            : job
        ),
        nextToken: old?.nextToken ?? null,
      }));

      setLastJobId(data.ingestionJobId);
      setSyncError(null);
      startPolling(data.ingestionJobId);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (error: Error, _variables, context) => {
      const queryKey = ['sync-jobs', { pageSize: 10, nextToken: null }];

      if (context?.previousData) {
        queryClient.setQueryData<SyncJobsResponse>(queryKey, context.previousData);
      }

      if (error.message.includes('409')) {
        setSyncError({
          error: 'SYNC_IN_PROGRESS',
          message: 'A sync is already in progress. Please try again later.',
        });
      } else {
        setSyncError({
          error: 'UNKNOWN',
          message: error.message,
        });
      }
    },
  });

  const isConflict = useMemo(
    () => syncError?.error === 'SYNC_IN_PROGRESS',
    [syncError]
  );

  const clearTimeoutMessage = useCallback(() => {
    setTimeoutMessage(null);
  }, []);

  return {
    triggerSync: () => mutation.mutate(),
    isSyncing: mutation.isPending,
    lastJobId,
    error: syncError,
    isConflict,
    clearError: () => setSyncError(null),
    isPolling,
    timeoutMessage,
    clearTimeoutMessage,
  };
}
