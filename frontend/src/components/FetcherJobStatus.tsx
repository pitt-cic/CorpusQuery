import { useEffect } from 'react';
import { useFetcherJob } from '@/hooks/useFetcherJob';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  jobId: string;
  onComplete: () => void;
}

export default function FetcherJobStatus({ jobId, onComplete }: Props) {
  const { job, isPolling } = useFetcherJob(jobId);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (job?.status === 'completed') {
      queryClient.invalidateQueries({ queryKey: ['fetcher-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['fetched-documents'] });
      queryClient.invalidateQueries({ queryKey: ['researchers'] });
      onComplete();
    }
  }, [job?.status, jobId, onComplete, queryClient]);

  if (!job) return null;

  return (
    <div className="flex items-center gap-3 p-3 bg-gold-soft border border-gold rounded-lg mb-4">
      {isPolling && (
        <span className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      )}
      <span className="font-mono text-sm text-ink">
        {job.status === 'pending' && 'Queued...'}
        {job.status === 'processing' && 'Fetching papers...'}
        {job.status === 'indexing' && 'Indexing papers — queries will be available shortly...'}
        {job.status === 'completed' && '✓ Complete!'}
        {job.status === 'failed' && '✗ Failed'}
      </span>
      {job.answer && job.status === 'completed' && (
        <span className="text-xs text-ink-muted ml-auto">{job.answer}</span>
      )}
    </div>
  );
}
