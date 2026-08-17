import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';

const TERMINAL_STATUSES = ['completed', 'failed'];

export function useFetcherJob(jobId: string | null) {
  const { data: job, isLoading } = useQuery({
    queryKey: ['fetcher-job', jobId],
    queryFn: () => api.getFetcherJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && TERMINAL_STATUSES.includes(status)) return false;
      return 2000;
    },
  });

  const isPolling = !!jobId && !!job && !TERMINAL_STATUSES.includes(job.status);

  return { job, isLoading, isPolling };
}
