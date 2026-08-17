import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSettings } from '@/hooks/useSettings';
import { AllProviders } from '../test-utils';
import { Provider } from '@/contracts';

function wrapper({ children }: { children: React.ReactNode }) {
  return <AllProviders>{children}</AllProviders>;
}

describe('useSettings', () => {
  it('fetches user settings', async () => {
    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => {
      expect(result.current.settings).toBeDefined();
    });

    expect(result.current.settings?.modelConfig.llm.provider).toBe(Provider.BEDROCK);
    expect(result.current.settings?.retrievalConfig.evidenceK).toBe(10);
  });
});
