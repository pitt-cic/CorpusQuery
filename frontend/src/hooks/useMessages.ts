import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';

export function useMessages(sessionId: string | null) {
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', sessionId],
    queryFn: () => api.getMessages(sessionId!),
    enabled: !!sessionId,
  });

  return { messages, isLoading };
}
