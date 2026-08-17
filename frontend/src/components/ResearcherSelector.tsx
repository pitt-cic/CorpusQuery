import { useEffect, useRef, useState } from 'react';
import type { Job } from '@/contracts';
import { getResearcherName, saveResearcherName } from '@/utils/researcherNames';

interface Props {
  jobs: Job[];
  orcids: string[];
  selectedOrcid: string | null;
  onSelect: (orcid: string | null) => void;
}

async function fetchOrcidName(orcid: string): Promise<string | null> {
  try {
    const res = await fetch(`https://pub.orcid.org/v3.0/${orcid}/person`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const given = data?.name?.['given-names']?.value ?? '';
    const family = data?.name?.['family-name']?.value ?? '';
    const full = [given, family].filter(Boolean).join(' ');
    return full || null;
  } catch {
    return null;
  }
}

export default function ResearcherSelector({ jobs: _jobs, orcids, selectedOrcid, onSelect }: Props) {
  const [editingOrcid, setEditingOrcid] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [names, setNames] = useState<Record<string, string>>({});
  const fetchingRef = useRef<Set<string>>(new Set());

  // Resolve names: localStorage first, then ORCID API (once per ORCID)
  useEffect(() => {
    for (const orcid of orcids) {
      if (fetchingRef.current.has(orcid)) continue;
      const cached = getResearcherName(orcid);
      if (cached) {
        setNames((prev) => (prev[orcid] === cached ? prev : { ...prev, [orcid]: cached }));
      } else {
        fetchingRef.current.add(orcid);
        fetchOrcidName(orcid).then((name) => {
          if (name) {
            saveResearcherName(orcid, name);
            setNames((prev) => ({ ...prev, [orcid]: name }));
          }
        });
      }
    }
  }, [orcids]);

  const startRename = (orcid: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingOrcid(orcid);
    setEditName(currentName);
  };

  const commitRename = (orcid: string) => {
    if (editName.trim()) {
      saveResearcherName(orcid, editName.trim());
      setNames((prev) => ({ ...prev, [orcid]: editName.trim() }));
    }
    setEditingOrcid(null);
  };

  return (
    <div className="border border-border rounded-lg bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-ink">Filter by Researcher</h3>
        {selectedOrcid && (
          <button
            onClick={() => onSelect(null)}
            className="text-xs text-ink-muted hover:text-ink transition-colors"
          >
            Clear filter
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {orcids.map((orcid) => {
          const name = names[orcid] || orcid;
          const isEditing = editingOrcid === orcid;
          const isSelected = selectedOrcid === orcid;

          if (isEditing) {
            return (
              <div key={orcid} className="relative">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => commitRename(orcid)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(orcid);
                    if (e.key === 'Escape') setEditingOrcid(null);
                  }}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  className="px-3 py-1.5 rounded-full text-sm font-medium border border-gold outline-none bg-surface"
                />
              </div>
            );
          }

          return (
            <button
              key={orcid}
              onClick={() => onSelect(isSelected ? null : orcid)}
              onDoubleClick={(e) => startRename(orcid, name, e)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                isSelected
                  ? 'bg-gold text-ink'
                  : 'bg-surface border border-border text-ink-muted hover:border-gold'
              }`}
              title="Double-click to rename"
            >
              {name}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-ink-muted mt-2">Double-click to rename</p>
    </div>
  );
}
