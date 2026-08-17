import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';

export function useResearchers() {
  const { data, isLoading } = useQuery({
    queryKey: ['researchers'],
    queryFn: () => api.getResearchers(),
    staleTime: 5 * 60_000,
  });

  return {
    orcids: data?.researchers.map((r) => r.orcid) ?? [],
    isLoading,
  };
}
