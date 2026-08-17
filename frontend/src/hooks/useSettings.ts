import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { UpdateSettingsRequest } from '@/contracts';

export function useSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  });

  const updateSettings = useMutation({
    mutationFn: (body: UpdateSettingsRequest) => api.updateSettings(body),
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
    },
  });

  return {
    settings,
    isLoading,
    updateSettings: updateSettings.mutateAsync,
    isSaving: updateSettings.isPending,
  };
}
