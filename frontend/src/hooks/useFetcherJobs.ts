import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useCurrentUser } from './useCurrentUser';

export function useFetcherJobs() {
  const { userId } = useCurrentUser();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['fetcher-jobs', userId],
    queryFn: () => api.getFetcherJobs(),
    refetchInterval: false,
    enabled: !!userId,
  });

  const jobs = data?.jobs ?? [];
  const completedJobs = jobs.filter(j => j.status === 'completed');

  return { jobs, completedJobs, isLoading, refresh: refetch };
}
