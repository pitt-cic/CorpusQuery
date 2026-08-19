import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useCurrentUser } from './useCurrentUser';

export function useResearchers() {
  const { userId } = useCurrentUser();
  const { data, isLoading } = useQuery({
    queryKey: ['researchers', userId],
    queryFn: () => api.getResearchers(),
    staleTime: 5 * 60_000,
    enabled: !!userId,
  });

  return {
    orcids: data?.researchers.map((r) => r.orcid) ?? [],
    isLoading,
  };
}
