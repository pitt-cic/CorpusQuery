import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, afterAll, beforeAll, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers, resetHandlerState } from '../src/mocks/handlers';

// Mock aws-amplify/auth to avoid actual AWS calls in tests
vi.mock('aws-amplify/auth', () => ({
  fetchUserAttributes: vi.fn().mockResolvedValue({
    sub: 'test-user-123',
    email: 'test@example.com',
    given_name: 'Test',
    family_name: 'User',
  }),
}));

export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  resetHandlerState();
  server.resetHandlers();
});
afterAll(() => server.close());
