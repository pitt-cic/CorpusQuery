import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { render } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { UserProvider } from '@/contexts/UserContext';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface WrapperProps {
  children: React.ReactNode;
}

export function AllProviders({ children }: WrapperProps) {
  const queryClient = useMemo(() => createTestQueryClient(), []);
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <UserProvider>{children}</UserProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export { createTestQueryClient };
