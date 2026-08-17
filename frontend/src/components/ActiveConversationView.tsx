import { motion } from 'framer-motion';
import type { Job } from '@/contracts';
import { JobStatus } from '@/contracts';
import SessionHeader from './SessionHeader';
import MessageList from './MessageList';
import InputBar from './InputBar';
import { getResearcherName } from '@/utils/researcherNames';

interface Props {
  title: string | null;
  question: string | null;
  messages: Job[];
  status: string | null;
  newlyCompletedJobId: string | null;
  onSubmit: (text: string) => void;
  disabled?: boolean;
  selectedOrcid?: string | null;
  onClearOrcid?: () => void;
}

function StatusIndicator({ status }: { status: string }) {
  const steps = [
    { key: JobStatus.PENDING, label: 'Submitted' },
    { key: JobStatus.PROCESSING, label: 'Retrieving evidence' },
    { key: JobStatus.COMPLETED, label: 'Done' },
  ];

  const currentIdx = steps.findIndex((s) => s.key === status);

  return (
    <div className="font-mono text-[13px] py-4">
      {steps.map((step, i) => {
        if (i > currentIdx) return null;
        const isCurrent = i === currentIdx && status !== JobStatus.COMPLETED;
        return (
          <span key={step.key}>
            {i > 0 && <span className="text-ink-muted"> &gt; </span>}
            <span className={isCurrent ? 'text-ink animate-pulse' : 'text-ink-muted'}>
              {step.label}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export default function ActiveConversationView({
  title,
  question,
  messages,
  status,
  newlyCompletedJobId,
  onSubmit,
  disabled,
  selectedOrcid,
  onClearOrcid,
}: Props) {
  const researcherLabel = selectedOrcid
    ? (getResearcherName(selectedOrcid) || selectedOrcid)
    : null;
  const isProcessing = status !== null && status !== JobStatus.COMPLETED && status !== JobStatus.FAILED;

  return (
    <motion.div
      key="active"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col overflow-hidden"
    >
      <SessionHeader title={title} question={question} isLoading={isProcessing} />
      <div className="flex-1 overflow-y-auto scrollbar-hidden">
        <div className="max-w-[80%] w-[720px] mx-auto py-8 px-8">
          <MessageList
            messages={messages}
            newlyCompletedJobId={newlyCompletedJobId}
          />
          {isProcessing && <StatusIndicator status={status} />}
        </div>
      </div>
      <div className="py-4 px-8 border-t border-border">
        <div className="max-w-[80%] w-[720px] mx-auto">
          {researcherLabel && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-ink-muted">Filtering by:</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/20 text-xs font-medium text-ink">
                {researcherLabel}
                {onClearOrcid && (
                  <button onClick={onClearOrcid} className="ml-1 text-ink-muted hover:text-ink">×</button>
                )}
              </span>
            </div>
          )}
          <InputBar onSubmit={onSubmit} disabled={disabled} position="docked" />
        </div>
      </div>
    </motion.div>
  );
}
