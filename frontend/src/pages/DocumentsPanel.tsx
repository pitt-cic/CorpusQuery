// frontend/src/pages/DocumentsPanel.tsx
import { useState, useCallback, useRef, useEffect } from 'react';
import { getResearcherName, getManuallyUploaded, toggleManuallyUploaded, paperKey } from '@/utils/researcherNames';
import { useDocuments } from '@/hooks/useDocuments';
import { useDocumentUpload } from '@/hooks/useDocumentUpload';
import { useDocumentSync } from '@/hooks/useDocumentSync';
import { useSyncJobs } from '@/hooks/useSyncJobs';
import { useFetchedDocuments } from '@/hooks/useFetchedDocuments';
import DocumentsTable from '@/components/DocumentsTable';
import { UploadZone } from '@/components/UploadZone';
import { UploadProgress } from '@/components/UploadProgress';
import { SyncJobHistory } from '@/components/SyncJobHistory';
import FetcherJobStatus from '@/components/FetcherJobStatus';

const FETCHED_PAGE_SIZE = 10;
const ORCID_PATTERN = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

export default function DocumentsPanel() {
  const {
    documents,
    isLoading,
    isFetching,
    nextToken,
    setNextToken,
    refresh,
    canRefresh,
    cooldownRemaining,
    lastSyncedAt,
  } = useDocuments();

  const [orcidInput, setOrcidInput] = useState('');
  const orcid = ORCID_PATTERN.test(orcidInput) ? orcidInput : undefined;

  const upload = useDocumentUpload(orcid);
  const sync = useDocumentSync();
  const syncJobs = useSyncJobs();
  const { fetched } = useFetchedDocuments();

  const [pageStack, setPageStack] = useState<string[]>([]);
  const [fetchedPages, setFetchedPages] = useState<Record<string, number>>({});
  const [, setFetchedSearchQuery] = useState<Record<string, string>>({});
  const [fetchedSearchInput, setFetchedSearchInput] = useState<Record<string, string>>({});
  const [fetchedHighlight, setFetchedHighlight] = useState<Record<string, number | null>>({});
  const [fetchedNoMatch, setFetchedNoMatch] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const [uploadedPapers, setUploadedPapers] = useState<Set<string>>(new Set());
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    setUploadedPapers(getManuallyUploaded());
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setShowBackToTop(el.scrollTop > 300);
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const handleNextPage = useCallback(() => {
    if (nextToken) {
      setPageStack((prev) => [...prev, nextToken]);
      setNextToken(nextToken);
    }
  }, [nextToken, setNextToken]);

  const handlePrevPage = useCallback(() => {
    setPageStack((prev) => {
      const next = prev.slice(0, -1);
      setNextToken(next[next.length - 1] ?? null);
      return next;
    });
  }, [setNextToken]);

  const getFetchedPage = (o: string) => fetchedPages[o] ?? 0;
  const setFetchedPage = (o: string, page: number) =>
    setFetchedPages((prev) => ({ ...prev, [o]: page }));

  const handleFetchedSearch = (orcid: string, query: string, dedupedPapers: { title: string }[]) => {
    setFetchedSearchQuery((prev) => ({ ...prev, [orcid]: query }));
    if (!query.trim()) {
      setFetchedHighlight((prev) => ({ ...prev, [orcid]: null }));
      setFetchedNoMatch((prev) => ({ ...prev, [orcid]: false }));
      return;
    }
    const idx = dedupedPapers.findIndex((p) =>
      p.title.toLowerCase().includes(query.toLowerCase())
    );
    if (idx === -1) {
      setFetchedPages((prev) => ({ ...prev, [orcid]: 0 }));
      setFetchedHighlight((prev) => ({ ...prev, [orcid]: null }));
      setFetchedNoMatch((prev) => ({ ...prev, [orcid]: true }));
    } else {
      const targetPage = Math.floor(idx / FETCHED_PAGE_SIZE);
      setFetchedPages((prev) => ({ ...prev, [orcid]: targetPage }));
      setFetchedHighlight((prev) => ({ ...prev, [orcid]: idx }));
      setFetchedNoMatch((prev) => ({ ...prev, [orcid]: false }));
    }
  };

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto scrollbar-hidden">
      <div className="max-w-[1400px] mx-auto py-8 px-6">
        <h2 className="font-serif text-2xl font-medium mb-6">Documents</h2>

        <div className="flex gap-8">
          {/* Left column: Upload UI (fixed width) */}
          <div className="w-[380px] flex-shrink-0">
            <div className="flex items-center pb-4 mb-4 border-b border-dashed border-border">
              <span className="font-sans text-xs font-medium uppercase tracking-[0.08em] text-ink-muted">
                Manually Upload Documents for chat
              </span>
            </div>

            {/* Optional ORCID tag for dual-indexing */}
            <div className="mb-3">
              <label className="block font-sans text-xs text-ink-muted mb-1">
                Tag with ORCID (optional)
              </label>
              <input
                type="text"
                placeholder="0000-0000-0000-0000"
                value={orcidInput}
                onChange={(e) => setOrcidInput(e.target.value)}
                className="w-full font-mono text-sm border border-border rounded-[--radius-input] px-3 py-2 bg-surface focus:outline-none focus:border-gold"
              />
              {orcidInput && !orcid && (
                <p className="mt-1 text-xs text-red-500">Invalid ORCID format</p>
              )}
              {orcid && (
                <p className="mt-1 text-xs text-ink-muted">Files will be indexed for this researcher</p>
              )}
            </div>

            <UploadZone
              onFilesSelected={upload.selectFiles}
              disabled={upload.isUploading}
            />

            {/* Indexing status for ORCID-tagged uploads */}
            {upload.indexJobId && (
              <FetcherJobStatus
                jobId={upload.indexJobId}
                onComplete={() => {}}
              />
            )}

            <UploadProgress
              files={upload.files}
              skipped={upload.skipped}
              phase={upload.phase}
              overallProgress={upload.overallProgress}
              onRemove={upload.removeFile}
              onStartUpload={upload.startUpload}
              onCancel={upload.cancelUpload}
              onReset={upload.reset}
              canStartUpload={upload.canStartUpload}
              isUploading={upload.isUploading}
            />

            {/* Sync Knowledge Base Button */}
            <div className="mt-6">
              <button
                onClick={sync.triggerSync}
                disabled={sync.isSyncing}
                className="w-full font-sans text-sm font-medium bg-gold text-ink rounded-[--radius-input] px-4 py-2.5 hover:bg-ink hover:text-white disabled:opacity-50 transition-colors"
              >
                {sync.isSyncing ? 'Syncing...' : 'Sync Knowledge Base'}
              </button>

              {sync.isConflict && (
                <div className="mt-2 flex items-center gap-2 text-sm text-amber-600">
                  <p>A sync is already in progress. Refresh job history to check status.</p>
                  <button
                    onClick={sync.clearError}
                    className="text-amber-600 hover:text-amber-800"
                    aria-label="Dismiss message"
                  >
                    &times;
                  </button>
                </div>
              )}
              {sync.timeoutMessage && (
                <div className="mt-2 flex items-center gap-2 text-sm text-amber-600">
                  <p>{sync.timeoutMessage}</p>
                  <button
                    onClick={sync.clearTimeoutMessage}
                    className="text-amber-600 hover:text-amber-800"
                    aria-label="Dismiss message"
                  >
                    &times;
                  </button>
                </div>
              )}
            </div>

            {/* Sync Job History */}
            <SyncJobHistory
              jobs={syncJobs.jobs}
              isLoading={syncJobs.isLoading}
              isFetching={syncJobs.isFetching}
              hasNextPage={syncJobs.hasNextPage}
              hasPrevPage={syncJobs.hasPrevPage}
              onNextPage={syncJobs.nextPage}
              onPrevPage={syncJobs.prevPage}
              onRefresh={syncJobs.refresh}
            />
          </div>

          {/* Right column: Documents table (fluid) */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center pb-4 mb-4 border-b border-dashed border-border">
              <span className="flex-1 font-sans text-xs font-medium uppercase tracking-[0.08em] text-ink-muted">
                Uploaded Documents
              </span>
            </div>

            <DocumentsTable
                documents={documents}
                isLoading={isLoading}
                isFetching={isFetching}
                lastSyncedAt={lastSyncedAt}
                hasNextPage={!!nextToken}
                hasPrevPage={pageStack.length > 0}
                onNextPage={handleNextPage}
                onPrevPage={handlePrevPage}
                onRefresh={refresh}
                canRefresh={canRefresh}
                cooldownRemaining={cooldownRemaining}
              />

          </div>
        </div>

        {/* Researcher Papers — full width below the two-column layout */}
        {fetched.length > 0 && (
          <div className="mt-8">
                <div className="flex items-center pb-4 mb-4 border-b border-dashed border-border">
                  <span className="flex-1 font-sans text-xs font-medium uppercase tracking-[0.08em] text-ink-muted">
                    Researcher Papers
                  </span>
                </div>

                {fetched.map(({ orcid: resultOrcid, papers }) => {
                  // Deduplicate by title (case-insensitive), preferring success over failure
                  const seen = new Map<string, typeof papers[0]>();
                  for (const paper of papers) {
                    const key = paper.title.toLowerCase();
                    const existing = seen.get(key);
                    if (!existing || (paper.status === 'success' && existing.status !== 'success')) {
                      seen.set(key, paper);
                    }
                  }
                  const dedupedPapers = Array.from(seen.values());

                  const page = getFetchedPage(resultOrcid);
                  const totalPages = Math.ceil(dedupedPapers.length / FETCHED_PAGE_SIZE);
                  const pagePapers = dedupedPapers.slice(page * FETCHED_PAGE_SIZE, (page + 1) * FETCHED_PAGE_SIZE);
                  const researcherName = getResearcherName(resultOrcid);
                  const highlightIdx = fetchedHighlight[resultOrcid] ?? null;
                  const noMatch = fetchedNoMatch[resultOrcid] ?? false;
                  return (
                    <div key={resultOrcid} className="mb-8">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-baseline gap-2 flex-1 min-w-0">
                          {researcherName && (
                            <span className="font-sans text-sm font-medium text-ink">{researcherName}</span>
                          )}
                          <span className="font-mono text-xs text-ink-muted">{resultOrcid}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Search papers..."
                            value={fetchedSearchInput[resultOrcid] ?? ''}
                            onChange={(e) => setFetchedSearchInput((prev) => ({ ...prev, [resultOrcid]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleFetchedSearch(resultOrcid, fetchedSearchInput[resultOrcid] ?? '', dedupedPapers);
                              if (e.key === 'Escape') {
                                setFetchedSearchInput((prev) => ({ ...prev, [resultOrcid]: '' }));
                                handleFetchedSearch(resultOrcid, '', dedupedPapers);
                              }
                            }}
                            className="font-sans text-sm border border-border rounded-[--radius-input] px-3 py-1.5 w-56 focus:outline-none focus:border-gold bg-surface"
                          />
                          {noMatch && (
                            <span className="font-sans text-xs text-ink-muted">No match found</span>
                          )}
                        </div>
                      </div>
                      <div className="bg-surface border border-border rounded-[--radius-card] overflow-hidden shadow-sm">
                        <div className="flex items-center px-6 py-3 bg-paper-warm border-b border-border font-sans text-xs font-medium uppercase tracking-[0.08em] text-ink-muted">
                          <span className="flex-1 min-w-0">Title</span>
                          <span className="w-[180px] flex-shrink-0">DOI</span>
                          <span className="w-[120px] text-right flex-shrink-0">Status</span>
                          <span className="w-[110px] text-right flex-shrink-0">Uploaded</span>
                        </div>
                        {pagePapers.map((paper, i) => {
                          const key = paperKey(resultOrcid, paper.doi, paper.title);
                          const isUploaded = uploadedPapers.has(key);
                          const globalIdx = page * FETCHED_PAGE_SIZE + i;
                          const isHighlighted = highlightIdx === globalIdx;
                          return (
                            <div
                              key={i}
                              className={`flex items-center px-6 py-3.5 transition-colors duration-150 ${
                                isHighlighted ? 'bg-gold-soft' : 'hover:bg-gold-soft'
                              } ${i < pagePapers.length - 1 ? 'border-b border-border' : ''}`}
                            >
                              <span className="flex-1 min-w-0 font-sans text-sm text-ink truncate pr-4" title={paper.title}>
                                {paper.title}
                              </span>
                              <span className="w-[180px] font-mono text-[13px] text-ink-muted flex-shrink-0 truncate pr-4">
                                {paper.doi ? (
                                  <a
                                    href={`https://doi.org/${paper.doi}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-ink underline underline-offset-2"
                                    title={paper.doi}
                                  >
                                    {paper.doi}
                                  </a>
                                ) : paper.attempted_url ? (
                                  <a
                                    href={paper.attempted_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-ink underline underline-offset-2"
                                    title={paper.attempted_url}
                                  >
                                    attempted URL
                                  </a>
                                ) : '—'}
                              </span>
                              <span className="w-[120px] flex justify-end flex-shrink-0">
                                {paper.status === 'success' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 border border-green-200 font-sans text-[11px] font-medium text-success whitespace-nowrap">
                                    <span>&#10003;</span> Downloaded
                                  </span>
                                ) : isUploaded ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 border border-green-200 font-sans text-[11px] font-medium text-success whitespace-nowrap">
                                    <span>&#10003;</span> Uploaded
                                  </span>
                                ) : paper.failure_reason === 'not_open_access' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 font-sans text-[11px] font-medium text-amber-700 whitespace-nowrap cursor-help" title="Paper exists but no open-access version is available">
                                    Not OA
                                  </span>
                                ) : paper.failure_reason === 'download_error' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 font-sans text-[11px] font-medium text-error whitespace-nowrap cursor-help" title="Found an open-access URL but the download failed">
                                    Download Error
                                  </span>
                                ) : paper.failure_reason === 'not_found' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 font-sans text-[11px] font-medium text-error whitespace-nowrap cursor-help" title="Could not find this paper in any source">
                                    Not Found
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 font-sans text-[11px] font-medium text-error whitespace-nowrap">
                                    Failed
                                  </span>
                                )}
                              </span>
                              <span className="w-[110px] flex justify-end flex-shrink-0">
                                {paper.status === 'failure' && (
                                  <input
                                    type="checkbox"
                                    checked={isUploaded}
                                    onChange={() => setUploadedPapers(toggleManuallyUploaded(key))}
                                    title="Mark as manually uploaded"
                                    className="w-4 h-4 accent-gold cursor-pointer"
                                  />
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-4 mt-4">
                          <button
                            onClick={() => setFetchedPage(resultOrcid, page - 1)}
                            disabled={page === 0}
                            className="font-sans text-sm text-ink-muted hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            &lt; Previous
                          </button>
                          <button
                            onClick={() => setFetchedPage(resultOrcid, page + 1)}
                            disabled={page >= totalPages - 1}
                            className="font-sans text-sm text-ink-muted hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Next &gt;
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
          </div>
        )}
      </div>

      {/* Back to top */}
      {showBackToTop && (
        <button
          onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-8 right-8 z-50 font-sans text-sm bg-surface border border-border rounded-full px-4 py-2 shadow-md hover:border-gold hover:bg-gold-soft transition-colors"
        >
          ↑ Back to top
        </button>
      )}
    </div>
  );
}
