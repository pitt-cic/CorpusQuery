import { useSearchParams } from 'react-router-dom';
import { useCallback } from 'react';

export function useActiveSession() {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeSessionId = searchParams.get('session') || null;

  const setActiveSession = useCallback(
    (sessionId: string | null) => {
      setSearchParams((prev) => {
        if (sessionId) {
          prev.set('session', sessionId);
        } else {
          prev.delete('session');
        }
        return prev;
      });
    },
    [setSearchParams]
  );

  return { activeSessionId, setActiveSession };
}
