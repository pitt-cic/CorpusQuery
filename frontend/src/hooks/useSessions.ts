import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';

const PAGE_SIZE = 20;

export function useSessions() {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['sessions'],
    queryFn: ({ pageParam }) => api.getSessions(PAGE_SIZE, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextToken ?? undefined,
    initialPageParam: undefined as string | undefined,
  });

  const sessions = data?.pages.flatMap((page) => page.sessions) ?? [];

  const renameSession = useMutation({
    mutationFn: ({ sessionId, title }: { sessionId: string; title: string }) =>
      api.updateSession(sessionId, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });

  const deleteSession = useMutation({
    mutationFn: (sessionId: string) => api.deleteSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });

  return {
    sessions,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    renameSession: renameSession.mutateAsync,
    deleteSession: deleteSession.mutateAsync,
  };
}
