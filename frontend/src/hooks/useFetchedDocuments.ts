import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { FetchedOrcidResult } from '@/contracts';

export function useFetchedDocuments() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['fetched-documents'],
    queryFn: () => api.getFetchedDocuments(),
    staleTime: 30_000,
  });

  const fetched: FetchedOrcidResult[] = data?.fetched ?? [];

  return { fetched, isLoading, error };
}
