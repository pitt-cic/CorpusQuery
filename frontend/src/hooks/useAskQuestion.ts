import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { AskRequest } from '@/contracts';

export function useAskQuestion() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (body: AskRequest) => api.ask(body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      if (variables.sessionId) {
        queryClient.invalidateQueries({ queryKey: ['messages', variables.sessionId] });
      }
    },
  });

  return {
    ask: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}
