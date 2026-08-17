import { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMessages } from './useMessages';
import { useAskQuestion } from './useAskQuestion';
import { useJobStatus } from './useJobStatus';
import { JobStatus } from '@/contracts';

export function useChatFlow(sessionId: string | null) {
  const queryClient = useQueryClient();
  const { messages, isLoading } = useMessages(sessionId);
  const { ask: submitQuestion } = useAskQuestion();
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);

  const { job: pendingJob } = useJobStatus(pendingJobId);

  // Derive status from job; null when no pending job
  const status = pendingJob?.status ?? null;

  // Invalidate messages when job reaches terminal state.
  // pendingJobId is cleared at the start of the next ask() instead of here,
  // so status stays visible as COMPLETED/FAILED until the next question is submitted.
  useEffect(() => {
    if (
      pendingJobId &&
      pendingJob &&
      (pendingJob.status === JobStatus.COMPLETED || pendingJob.status === JobStatus.FAILED)
    ) {
      queryClient.invalidateQueries({ queryKey: ['messages', sessionId] });
    }
  }, [pendingJob, pendingJobId, sessionId, queryClient]);

  const ask = useCallback(
    async (question: string, orcid?: string) => {
      setPendingJobId(null); // clear previous job before starting a new one
      const request = sessionId ? { question, sessionId, orcid } : { question, orcid };
      const response = await submitQuestion(request);
      setPendingJobId(response.jobId);
      return response;
    },
    [sessionId, submitQuestion]
  );

  return {
    messages,
    isLoading,
    ask,
    status,
    pendingJobId,
  };
}
