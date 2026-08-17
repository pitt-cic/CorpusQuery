import { useState, useCallback } from 'react';

const STORAGE_KEY = 'selectedOrcid';

export function useSelectedOrcid() {
  const [selectedOrcid, setSelectedOrcidState] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );

  const setSelectedOrcid = useCallback((orcid: string | null) => {
    if (orcid) {
      localStorage.setItem(STORAGE_KEY, orcid);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setSelectedOrcidState(orcid);
  }, []);

  return { selectedOrcid, setSelectedOrcid };
}
