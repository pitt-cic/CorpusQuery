import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useEffect, useRef } from 'react';
import { api } from '@/api/client';

const COOLDOWN_MS = 60000;

export function useDocuments(pageSize = 20) {
  const queryClient = useQueryClient();
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<number | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['documents', { pageSize, nextToken }],
    queryFn: () => api.getDocuments(pageSize, nextToken ?? undefined),
  });

  // Cooldown timer
  useEffect(() => {
    if (lastRefreshTime === null) return;

    const updateCooldown = () => {
      const elapsed = Date.now() - lastRefreshTime;
      const remaining = Math.max(0, Math.ceil((COOLDOWN_MS - elapsed) / 1000));
      setCooldownRemaining(remaining);

      if (remaining === 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    updateCooldown();
    intervalRef.current = setInterval(updateCooldown, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [lastRefreshTime]);

  const refresh = useCallback(() => {
    if (lastRefreshTime && Date.now() - lastRefreshTime < COOLDOWN_MS) {
      return;
    }
    setLastRefreshTime(Date.now());
    queryClient.invalidateQueries({ queryKey: ['documents'] });
  }, [lastRefreshTime, queryClient]);

  const canRefresh = cooldownRemaining === 0;
  const isSyncing = data?.syncStatus === 'STARTING' || data?.syncStatus === 'IN_PROGRESS';

  return {
    documents: data?.documents ?? [],
    isLoading,
    isFetching,
    nextToken: data?.nextToken ?? null,
    setNextToken,
    refresh,
    canRefresh,
    cooldownRemaining,
    lastSyncedAt: data?.lastSyncedAt ?? null,
    syncStatus: data?.syncStatus ?? null,
    isSyncing,
  };
}
