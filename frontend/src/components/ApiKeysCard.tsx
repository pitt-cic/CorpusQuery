import { useState } from 'react';
import type { SecretsStatus, UpdateSecretsRequest } from '@/contracts';

interface Props {
  secretsStatus: SecretsStatus | undefined;
  onSave: (secrets: UpdateSecretsRequest) => Promise<void>;
  isSaving: boolean;
  visible: boolean; // controls Anthropic/OpenAI fields; OpenAlex always shows
}

export default function ApiKeysCard({ secretsStatus, onSave, isSaving, visible }: Props) {
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [openalexKey, setOpenalexKey] = useState('');
  const [ncbiKey, setNcbiKey] = useState('');

  const handleSave = async () => {
    const body: UpdateSecretsRequest = {};
    if (anthropicKey) body.anthropicApiKey = anthropicKey;
    if (openaiKey) body.openaiApiKey = openaiKey;
    if (openalexKey) body.openalexApiKey = openalexKey;
    if (ncbiKey) body.ncbiApiKey = ncbiKey;
    await onSave(body);
    setAnthropicKey('');
    setOpenaiKey('');
    setOpenalexKey('');
    setNcbiKey('');
  };

  return (
    <div className="bg-surface border border-border rounded-[--radius-card] p-8 mb-6 shadow-sm">
      <div className="flex justify-between items-center pb-4 mb-6 border-b border-dashed border-border">
        <span className="font-sans text-xs font-medium uppercase tracking-[0.08em] text-ink-muted">API KEYS</span>
      </div>
      <div className="flex flex-col gap-5">
        {visible && (
          <>
            <div className="flex items-center gap-4">
              <label className="font-sans text-sm text-ink w-[180px] shrink-0">Anthropic API Key</label>
              <div className="flex items-center gap-3 flex-1">
                <input
                  type="password"
                  className="flex-1 h-10 border border-border rounded-[--radius-input] px-3 font-sans text-sm focus:outline-none focus:border-border-focus"
                  placeholder="sk-ant-..."
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                />
                <span className={`font-mono text-xs whitespace-nowrap ${secretsStatus?.anthropicApiKey ? 'text-success' : 'text-ink-muted'}`}>
                  {secretsStatus?.anthropicApiKey ? 'Configured' : 'Not Configured'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="font-sans text-sm text-ink w-[180px] shrink-0">OpenAI API Key</label>
              <div className="flex items-center gap-3 flex-1">
                <input
                  type="password"
                  className="flex-1 h-10 border border-border rounded-[--radius-input] px-3 font-sans text-sm focus:outline-none focus:border-border-focus"
                  placeholder="sk-..."
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                />
                <span className={`font-mono text-xs whitespace-nowrap ${secretsStatus?.openaiApiKey ? 'text-success' : 'text-ink-muted'}`}>
                  {secretsStatus?.openaiApiKey ? 'Configured' : 'Not Configured'}
                </span>
              </div>
            </div>
          </>
        )}
        <div className="flex items-center gap-4">
          <div className="w-[180px] shrink-0">
            <label className="font-sans text-sm text-ink">OpenAlex API Key</label>
            <p className="font-sans text-xs text-ink-muted mt-0.5">
              Free account at{' '}
              <a href="https://openalex.org" target="_blank" rel="noreferrer" className="underline">
                openalex.org
              </a>
              .<sup>1</sup> Required to download researcher papers.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-1">
            <input
              type="password"
              className="flex-1 h-10 border border-border rounded-[--radius-input] px-3 font-sans text-sm focus:outline-none focus:border-border-focus"
              placeholder="..."
              value={openalexKey}
              onChange={(e) => setOpenalexKey(e.target.value)}
            />
            <span className={`font-mono text-xs whitespace-nowrap ${secretsStatus?.openalexApiKey ? 'text-success' : 'text-ink-muted'}`}>
              {secretsStatus?.openalexApiKey ? 'Configured' : 'Not Configured'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-[180px] shrink-0">
            <label className="font-sans text-sm text-ink">NCBI API Key</label>
            <p className="font-sans text-xs text-ink-muted mt-0.5">
              Free account at{' '}
              <a href="https://www.ncbi.nlm.nih.gov/account/" target="_blank" rel="noreferrer" className="underline">
                ncbi.nlm.nih.gov
              </a>
              .<sup>2</sup> Improves PubMed Central paper retrieval. 
            </p>
          </div>
          <div className="flex items-center gap-3 flex-1">
            <input
              type="password"
              className="flex-1 h-10 border border-border rounded-[--radius-input] px-3 font-sans text-sm focus:outline-none focus:border-border-focus"
              placeholder="..."
              value={ncbiKey}
              onChange={(e) => setNcbiKey(e.target.value)}
            />
            <span className={`font-mono text-xs whitespace-nowrap ${secretsStatus?.ncbiApiKey ? 'text-success' : 'text-ink-muted'}`}>
              {secretsStatus?.ncbiApiKey ? 'Configured' : 'Not Configured'}
            </span>
          </div>
        </div>
      </div>
      <div className="flex justify-end mt-6">
        <button
          className="font-sans text-sm font-medium bg-ink text-white border-none rounded-[--radius-input] h-10 px-6 cursor-pointer transition-colors duration-150 hover:bg-gold hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isSaving}
          onClick={handleSave}
        >
          {isSaving ? 'Saving...' : 'Save Secrets'}
        </button>
      </div>
      <div className= "flex justify-start mt-0.5">
        <p className="font-sans text-xs text-ink-muted mt-0.5"><sup>1</sup> Account {">"} Settings {">"} API Key
        <br></br><sup>2</sup> Your account {">"} Account settings {">"} API Key Management</p>
      </div>
    </div>
  );
}
