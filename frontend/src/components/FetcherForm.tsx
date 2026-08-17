import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '@/api/client';
import { isValidOrcid, saveResearcherName, saveJobOrcid } from '@/utils/researcherNames';

interface Props {
  onJobStarted: (jobId: string, orcid: string) => void;
}

async function fetchOrcidName(orcid: string): Promise<string | null> {
  try {
    const resp = await fetch(`https://pub.orcid.org/v3.0/${orcid}/person`, {
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const given = data?.name?.['given-names']?.value ?? '';
    const family = data?.name?.['family-name']?.value ?? '';
    const full = [given, family].filter(Boolean).join(' ');
    return full || null;
  } catch {
    return null;
  }
}

export default function FetcherForm({ onJobStarted }: Props) {
  const [orcid, setOrcid] = useState('');
  const [name, setName] = useState('');
  const [nameFetching, setNameFetching] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOrcidBlur = async () => {
    if (!isValidOrcid(orcid) || name.trim()) return;
    setNameFetching(true);
    const fetched = await fetchOrcidName(orcid);
    if (fetched) setName(fetched);
    setNameFetching(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isValidOrcid(orcid)) {
      setError('Invalid ORCID format (e.g., 0000-0002-1234-5678)');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await api.startFetcher(orcid);

      if (name.trim()) {
        saveResearcherName(orcid, name.trim());
      }

      saveJobOrcid(response.jobId, orcid);

      onJobStarted(response.jobId, orcid);
      setOrcid('');
      setName('');
    } catch (err) {
      setError('Failed to start fetcher. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <input
          type="text"
          placeholder="ORCID (e.g., 0000-0002-1234-5678)"
          value={orcid}
          onChange={(e) => setOrcid(e.target.value)}
          onBlur={handleOrcidBlur}
          disabled={isSubmitting}
          className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gold"
        />
      </div>
      <div>
        <input
          type="text"
          placeholder={nameFetching ? 'Looking up name...' : 'Researcher Name (optional)'}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isSubmitting || nameFetching}
          className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gold disabled:text-ink-muted"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting || !orcid}
        className="w-full bg-gold text-ink font-medium py-2 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gold-dark transition-colors"
      >
        {isSubmitting ? 'Starting...' : 'Start Fetching'}
      </button>
    </form>
  );
}
