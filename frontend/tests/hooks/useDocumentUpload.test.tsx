import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDocumentUpload } from '@/hooks/useDocumentUpload';
import { AllProviders } from '../test-utils';

function wrapper({ children }: { children: React.ReactNode }) {
  return <AllProviders>{children}</AllProviders>;
}

function createMockFile(name: string, size = 1024): File {
  const blob = new Blob(['x'.repeat(size)], { type: 'application/pdf' });
  return new File([blob], name, { type: 'application/pdf' });
}

describe('useDocumentUpload', () => {
  beforeEach(() => {
    // Mock XHR
    vi.stubGlobal('XMLHttpRequest', vi.fn(() => ({
      open: vi.fn(),
      send: vi.fn(),
      setRequestHeader: vi.fn(),
      upload: { addEventListener: vi.fn() },
      addEventListener: vi.fn((event, handler) => {
        if (event === 'load') {
          setTimeout(() => handler(), 10);
        }
      }),
      status: 200,
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initializes with idle phase', () => {
    const { result } = renderHook(() => useDocumentUpload(), { wrapper });

    expect(result.current.phase).toBe('idle');
    expect(result.current.files.size).toBe(0);
    expect(result.current.skipped).toHaveLength(0);
  });

  it('transitions to selecting phase on file selection', () => {
    const { result } = renderHook(() => useDocumentUpload(), { wrapper });

    act(() => {
      result.current.selectFiles([createMockFile('test.pdf')]);
    });

    expect(result.current.phase).toBe('selecting');
    expect(result.current.files.size).toBe(1);
  });

  it('allows adding more files to selection', () => {
    const { result } = renderHook(() => useDocumentUpload(), { wrapper });

    act(() => {
      result.current.selectFiles([createMockFile('test1.pdf')]);
    });

    act(() => {
      result.current.selectFiles([createMockFile('test2.pdf')]);
    });

    expect(result.current.files.size).toBe(2);
  });

  it('computes overall progress correctly', () => {
    const { result } = renderHook(() => useDocumentUpload(), { wrapper });

    act(() => {
      result.current.selectFiles([
        createMockFile('test1.pdf'),
        createMockFile('test2.pdf'),
      ]);
    });

    expect(result.current.overallProgress.total).toBe(2);
    expect(result.current.overallProgress.completed).toBe(0);
  });

  it('resets state correctly', () => {
    const { result } = renderHook(() => useDocumentUpload(), { wrapper });

    act(() => {
      result.current.selectFiles([createMockFile('test.pdf')]);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.phase).toBe('idle');
    expect(result.current.files.size).toBe(0);
  });
});
