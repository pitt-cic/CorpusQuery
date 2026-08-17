import { useUserContext, type UserContextValue } from '@/contexts/UserContext';

export function useCurrentUser(): UserContextValue {
  return useUserContext();
}
