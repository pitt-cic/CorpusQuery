import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { api } from '@/api/client';
import { useCurrentUser } from './useCurrentUser';

export function useSyncJobs(pageSize = 10) {
  const queryClient = useQueryClient();
  const { userId } = useCurrentUser();
  const [pageStack, setPageStack] = useState<string[]>([]);
  const [currentToken, setCurrentToken] = useState<string | null>(null);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['sync-jobs', userId, { pageSize, nextToken: currentToken }],
    queryFn: () => api.getSyncJobs(pageSize, currentToken ?? undefined),
    enabled: !!userId,
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['sync-jobs', userId] });
  }, [queryClient, userId]);

  const nextPage = useCallback(() => {
    if (data?.nextToken) {
      setPageStack((prev) => [...prev, currentToken ?? '']);
      setCurrentToken(data.nextToken);
    }
  }, [data?.nextToken, currentToken]);

  const prevPage = useCallback(() => {
    setPageStack((prev) => {
      const next = prev.slice(0, -1);
      setCurrentToken(next.length > 0 ? next[next.length - 1] : null);
      return next;
    });
  }, []);

  return {
    jobs: data?.jobs ?? [],
    isLoading,
    isFetching,
    error,
    hasNextPage: !!data?.nextToken,
    hasPrevPage: pageStack.length > 0,
    nextPage,
    prevPage,
    refresh,
  };
}
