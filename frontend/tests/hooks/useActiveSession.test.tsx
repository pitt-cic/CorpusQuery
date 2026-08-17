import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActiveSession } from '@/hooks/useActiveSession';
import { MemoryRouter } from 'react-router-dom';

function wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter initialEntries={['/chat?session=sess-001']}>{children}</MemoryRouter>;
}

describe('useActiveSession', () => {
  it('reads session ID from URL search param', () => {
    const { result } = renderHook(() => useActiveSession(), { wrapper });
    expect(result.current.activeSessionId).toBe('sess-001');
  });

  it('updates session ID and syncs to URL', () => {
    const { result } = renderHook(() => useActiveSession(), { wrapper });

    act(() => {
      result.current.setActiveSession('sess-002');
    });

    expect(result.current.activeSessionId).toBe('sess-002');
  });

  it('returns null when no session param exists', () => {
    const noParamWrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/chat']}>{children}</MemoryRouter>
    );
    const { result } = renderHook(() => useActiveSession(), { wrapper: noParamWrapper });
    expect(result.current.activeSessionId).toBeNull();
  });
});
