import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { UpdateSecretsRequest } from '@/contracts';

export function useSecrets() {
  const queryClient = useQueryClient();

  const { data: secretsStatus, isLoading } = useQuery({
    queryKey: ['secrets-status'],
    queryFn: api.getSecretsStatus,
  });

  const updateSecrets = useMutation({
    mutationFn: (body: UpdateSecretsRequest) => api.updateSecrets(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['secrets-status'] });
    },
  });

  return {
    secretsStatus,
    isLoading,
    updateSecrets: updateSecrets.mutateAsync,
    isSaving: updateSecrets.isPending,
  };
}
