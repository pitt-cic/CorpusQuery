import { useState } from 'react';
import { motion } from 'framer-motion';
import { useFetcherJobs } from '@/hooks/useFetcherJobs';
import { useResearchers } from '@/hooks/useResearchers';
import FetcherForm from './FetcherForm';
import FetcherJobStatus from './FetcherJobStatus';
import ResearcherSelector from './ResearcherSelector';

interface Props {
  selectedOrcid: string | null;
  onSelectOrcid: (orcid: string | null) => void;
}

const panelVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.1 + i * 0.07, duration: 0.3, ease: 'easeOut' as const },
  }),
};

export default function ResearcherPanel({ selectedOrcid, onSelectOrcid }: Props) {
  const { completedJobs, refresh } = useFetcherJobs();
  const { orcids } = useResearchers();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const handleJobStarted = (jobId: string, _orcid: string) => {
    setActiveJobId(jobId);
  };

  const handleJobComplete = () => {
    setActiveJobId(null);
    refresh();
  };

  return (
    <div className="w-full max-w-[720px] mt-6 space-y-4">
      {/* Fetcher Form */}
      <motion.div
        custom={0}
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        className="border border-border rounded-lg bg-surface p-4"
      >
        <h3 className="text-sm font-medium text-ink mb-3">
          Fetch Researcher Papers
        </h3>
        <FetcherForm onJobStarted={handleJobStarted} />
      </motion.div>

      {/* Active Job Status */}
      {activeJobId && (
        <FetcherJobStatus jobId={activeJobId} onComplete={handleJobComplete} />
      )}

      {/* Researcher Selector — only mount once data is loaded and researchers exist */}
      {orcids.length > 0 && (
        <motion.div
          custom={1}
          variants={panelVariants}
          initial="hidden"
          animate="visible"
        >
          <ResearcherSelector
            jobs={completedJobs}
            orcids={orcids}
            selectedOrcid={selectedOrcid}
            onSelect={onSelectOrcid}
          />
        </motion.div>
      )}
    </div>
  );
}
