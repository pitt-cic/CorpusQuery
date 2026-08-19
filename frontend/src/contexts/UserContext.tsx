import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchUserAttributes, type FetchUserAttributesOutput } from 'aws-amplify/auth';
import { initResearcherStorage } from '@/utils/researcherNames';

export interface UserContextValue {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  isLoading: boolean;
}

const defaultUser: UserContextValue = {
  userId: '',
  email: '',
  firstName: '',
  lastName: '',
  displayName: '',
  isLoading: true,
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserContextValue>(defaultUser);

  useEffect(() => {
    fetchUserAttributes()
      .then((attrs: FetchUserAttributesOutput) => {
        const firstName = attrs.given_name ?? '';
        const lastName = attrs.family_name ?? '';
        const userId = attrs.sub ?? '';
        initResearcherStorage(userId);
        setUser({
          userId,
          email: attrs.email ?? '',
          firstName,
          lastName,
          displayName: `${firstName} ${lastName}`.trim() || 'User',
          isLoading: false,
        });
      })
      .catch(() => {
        setUser({ ...defaultUser, isLoading: false });
      });
  }, []);

  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUserContext(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error('useUserContext must be used within UserProvider');
  }
  return ctx;
}
