import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';

export function useFetcherJobs() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['fetcher-jobs'],
    queryFn: () => api.getFetcherJobs(),
    refetchInterval: false,
  });

  const jobs = data?.jobs ?? [];
  const completedJobs = jobs.filter(j => j.status === 'completed');

  return { jobs, completedJobs, isLoading, refresh: refetch };
}
