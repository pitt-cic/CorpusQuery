// frontend/src/components/DocumentsTable.tsx
import type { Document } from '@/contracts';
import { formatTimestamp } from '@/utils/dateFormat';
import { getResearcherName } from '@/utils/researcherNames';
import { memo, useState } from 'react';

interface Props {
  documents: Document[];
  isLoading: boolean;
  isFetching: boolean;
  lastSyncedAt: string | null;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  onNextPage: () => void;
  onPrevPage: () => void;
  onRefresh: () => void;
  canRefresh: boolean;
  cooldownRemaining: number;
}

const StatusBadge = memo(function StatusBadge({ status }: { status: Document['status'] }) {
  const isIndexed = status === 'INDEXED';
  const isPending = status === 'PENDING' || status === 'IN_PROGRESS' || status === 'STARTING';
  const isFailed = status === 'FAILED';

  return (
    <span
      className={`flex items-center gap-1.5 font-mono text-[13px] ${
        isIndexed ? 'text-success' : isPending ? 'text-gold' : isFailed ? 'text-error' : 'text-ink-muted'
      }`}
    >
      {isIndexed && <span>&#10003;</span>}
      {isPending && <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {isFailed && <span>&#10005;</span>}
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
});

export default function DocumentsTable({
  documents,
  isLoading,
  isFetching,
  lastSyncedAt,
  hasNextPage,
  hasPrevPage,
  onNextPage,
  onPrevPage,
  onRefresh,
  canRefresh,
  cooldownRemaining,
}: Props) {
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  if (isLoading) {
    return <div className="text-center py-12 text-ink-muted">Loading documents...</div>;
  }

  const filteredDocuments = searchQuery
    ? documents.filter((doc) => doc.filename.toLowerCase().includes(searchQuery.toLowerCase()))
    : documents;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        {lastSyncedAt && (
          <span className="font-mono text-[13px] text-ink-muted">
            Last synced: {formatTimestamp(lastSyncedAt)}
          </span>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search documents..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setSearchQuery(searchInput);
              if (e.key === 'Escape') { setSearchInput(''); setSearchQuery(''); }
            }}
            className="font-sans text-sm border border-border rounded-[--radius-input] px-3 py-1.5 w-56 focus:outline-none focus:border-gold bg-surface"
          />
          <button
            onClick={onRefresh}
            disabled={!canRefresh || isFetching}
            className="font-sans text-sm border border-border rounded-[--radius-input] px-3 py-1.5 hover:border-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isFetching ? 'Refreshing...' : cooldownRemaining > 0 ? `Refresh (${cooldownRemaining}s)` : 'Refresh'}
          </button>
        </div>
      </div>

      {filteredDocuments.length === 0 ? (
        <div className="text-center py-16 px-6 bg-surface border border-border rounded-[--radius-card]">
          <p className="text-[15px] text-ink-muted mb-2">{searchQuery ? 'No documents match your search' : 'No documents indexed yet'}</p>
          {!searchQuery && <p className="text-[13px] text-ink-muted">Upload papers to get started</p>}
        </div>
      ) : (
        <>
          <div className="bg-surface border border-border rounded-[--radius-card] overflow-hidden shadow-sm">
            <div className="flex items-center px-6 py-3 bg-paper-warm border-b border-border font-sans text-xs font-medium uppercase tracking-[0.08em] text-ink-muted">
              <span className="flex-1 min-w-0">Filename</span>
              <span className="w-[160px] flex-shrink-0">Researcher</span>
              <span className="w-[100px] text-center flex-shrink-0">Status</span>
              <span className="w-[130px] text-right flex-shrink-0">Last Updated</span>
            </div>
            {filteredDocuments.map((doc, i) => {
              const researcherLabel = doc.orcid
                ? (getResearcherName(doc.orcid) ?? doc.orcid)
                : null;
              return (
                <div
                  key={doc.filename}
                  className={`flex items-center px-6 py-3.5 transition-colors duration-150 hover:bg-gold-soft ${
                    i < filteredDocuments.length - 1 ? 'border-b border-border' : ''
                  }`}
                >
                  <span
                    className="flex-1 min-w-0 font-sans text-sm text-ink truncate pr-4"
                    title={doc.filename}
                  >
                    {doc.filename}
                  </span>
                  <span className="w-[160px] font-sans text-[13px] text-ink-muted flex-shrink-0 truncate pr-4" title={researcherLabel ?? ''}>
                    {researcherLabel ?? '—'}
                  </span>
                  <span className="w-[100px] flex justify-center flex-shrink-0">
                    <StatusBadge status={doc.status} />
                  </span>
                  <span className="w-[130px] text-right font-mono text-[13px] text-ink-muted flex-shrink-0">
                    {doc.updatedAt ? formatTimestamp(doc.updatedAt) : '-'}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              onClick={onPrevPage}
              disabled={!hasPrevPage}
              className="font-sans text-sm text-ink-muted hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed"
            >
              &lt; Previous
            </button>
            <button
              onClick={onNextPage}
              disabled={!hasNextPage}
              className="font-sans text-sm text-ink-muted hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next &gt;
            </button>
          </div>
        </>
      )}
    </div>
  );
}
