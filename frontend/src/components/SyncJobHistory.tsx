import { memo, useMemo } from 'react';
import type { SyncJob } from '@/contracts';

interface SyncJobHistoryProps {
  jobs: SyncJob[];
  isLoading: boolean;
  isFetching: boolean;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  onNextPage: () => void;
  onPrevPage: () => void;
  onRefresh: () => void;
}

interface StatusDotProps {
  status: SyncJob['status'];
  statistics: SyncJob['statistics'];
}

const StatusDot = memo(function StatusDot({ status, statistics }: StatusDotProps) {
  const colorClass = useMemo(() => {
    if (status === 'IN_PROGRESS' || status === 'STARTING') {
      return 'bg-info animate-pulse';
    }
    if (status === 'FAILED') {
      return 'bg-error';
    }

    const { numberOfDocumentsFailed, numberOfDocumentsScanned, numberOfNewDocumentsIndexed, numberOfModifiedDocumentsIndexed, numberOfDocumentsDeleted } = statistics;
    const hasChanges = numberOfNewDocumentsIndexed > 0 || numberOfModifiedDocumentsIndexed > 0 || numberOfDocumentsDeleted > 0;

    if (numberOfDocumentsFailed === 0) {
      return hasChanges ? 'bg-success' : 'bg-ink-muted';
    }
    if (numberOfDocumentsFailed === numberOfDocumentsScanned && numberOfDocumentsScanned > 0) {
      return 'bg-error';
    }
    return 'bg-warning'; // partial failure
  }, [status, statistics]);

  return <span className={`w-2 h-2 rounded-full ${colorClass}`} />;
});

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function formatStatsSummary(stats: SyncJob['statistics']): string {
  const parts: string[] = [];

  if (stats.numberOfNewDocumentsIndexed > 0) {
    parts.push(`${stats.numberOfNewDocumentsIndexed} new`);
  }
  if (stats.numberOfModifiedDocumentsIndexed > 0) {
    parts.push(`${stats.numberOfModifiedDocumentsIndexed} modified`);
  }
  if (stats.numberOfDocumentsDeleted > 0) {
    parts.push(`${stats.numberOfDocumentsDeleted} deleted`);
  }
  if (stats.numberOfDocumentsFailed > 0) {
    parts.push(`${stats.numberOfDocumentsFailed} failed`);
  }

  return parts.length > 0 ? parts.join(', ') : 'no changes';
}

const JobRow = memo(function JobRow({ job }: { job: SyncJob }) {
  const summary = formatStatsSummary(job.statistics);

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border last:border-b-0">
      <StatusDot status={job.status} statistics={job.statistics} />
      <span className="flex-1 font-mono text-[13px] text-ink truncate min-w-0" title={summary}>
        {job.status === 'FAILED' ? (
          <span className="text-error">
            Failed: {job.failureReasons[0]?.slice(0, 30) || 'Unknown error'}
            {job.failureReasons[0]?.length > 30 ? '...' : ''}
          </span>
        ) : job.status === 'IN_PROGRESS' || job.status === 'STARTING' ? (
          <span className="text-info">Syncing...</span>
        ) : (
          <span className="text-ink-muted">{summary}</span>
        )}
      </span>
      <span className="font-mono text-[13px] text-ink-muted flex-shrink-0">
        {formatRelativeTime(job.startedAt)}
      </span>
    </div>
  );
});

export const SyncJobHistory = memo(function SyncJobHistory({
  jobs,
  isLoading,
  isFetching,
  hasNextPage,
  hasPrevPage,
  onNextPage,
  onPrevPage,
  onRefresh,
}: SyncJobHistoryProps) {
  if (isLoading) {
    return (
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <span className="font-sans text-xs font-medium uppercase tracking-[0.08em] text-ink-muted">
            Sync History
          </span>
        </div>
        <div className="text-center py-6 text-ink-muted text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <span className="font-sans text-xs font-medium uppercase tracking-[0.08em] text-ink-muted">
          Sync History
        </span>
        <button
          onClick={onRefresh}
          disabled={isFetching}
          className="font-sans text-xs text-ink-muted hover:text-ink disabled:opacity-50 transition-colors"
        >
          {isFetching ? 'Refreshing...' : 'Refresh ↻'}
        </button>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-6 bg-surface border border-border rounded-[--radius-card]">
          <p className="text-sm text-ink-muted">No sync history yet</p>
        </div>
      ) : (
        <>
          <div className="bg-surface border border-border rounded-[--radius-card] overflow-hidden">
            {jobs.map((job) => (
              <JobRow key={job.ingestionJobId} job={job} />
            ))}
          </div>

          {(hasNextPage || hasPrevPage) && (
            <div className="flex items-center justify-center gap-4 mt-3">
              <button
                onClick={onPrevPage}
                disabled={!hasPrevPage}
                className="font-sans text-xs text-ink-muted hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed"
              >
                &lt; Prev
              </button>
              <button
                onClick={onNextPage}
                disabled={!hasNextPage}
                className="font-sans text-xs text-ink-muted hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next &gt;
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
});
