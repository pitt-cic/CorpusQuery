import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { FetchedOrcidResult } from '@/contracts';
import { useCurrentUser } from './useCurrentUser';

export function useFetchedDocuments() {
  const { userId } = useCurrentUser();
  const { data, isLoading, error } = useQuery({
    queryKey: ['fetched-documents', userId],
    queryFn: () => api.getFetchedDocuments(),
    staleTime: 30_000,
    enabled: !!userId,
  });

  const fetched: FetchedOrcidResult[] = data?.fetched ?? [];

  return { fetched, isLoading, error };
}
