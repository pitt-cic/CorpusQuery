import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { JobStatus } from '@/contracts';

const TERMINAL_STATUSES: string[] = [JobStatus.COMPLETED, JobStatus.FAILED];

export function useJobStatus(jobId: string | null) {
  const { data: job } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => api.getJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && TERMINAL_STATUSES.includes(status)) return false;
      return 2000;
    },
  });

  const isPolling = !!jobId && !!job && !TERMINAL_STATUSES.includes(job.status);

  return { job, isPolling };
}
