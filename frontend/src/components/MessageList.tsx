import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Job } from '@/contracts';
import AnswerContent from './AnswerContent';
import CopyButton from './CopyButton';
import { api } from '@/api/client';

interface Props {
  messages: Job[];
  newlyCompletedJobId?: string | null;
}

function sourceRowId(jobId: string, textName: string) {
  return `source-${jobId}-${textName.replace(/\s+/g, '-')}`;
}

function SourcesCollapsible({ citations, open, onOpenChange, jobId, highlightedTextName }: { citations: NonNullable<Job['citations']>; open: boolean; onOpenChange: (v: boolean) => void; jobId: string; highlightedTextName: string | null }) {
  const [downloading, setDownloading] = useState<string | null>(null);

  // Sort citations by relevance score (highest first)
  const sortedCitations = [...citations].sort((a,b) => b.relevanceScore - a.relevanceScore);

  const handleDownload = async (docname: string) => {
    setDownloading(docname);
    try {
      const { downloadUrl, filename } = await api.getDocumentDownload(docname);
      // Open download in new tab
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      link.target = '_blank';
      link.click();
    } catch (error) {
      console.error('Failed to download:', error);
      alert('Failed to download file. It may not be available.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="mt-3">
      <button
        className="font-mono text-[13px] text-gold bg-transparent border-none cursor-pointer py-1"
        onClick={() => onOpenChange(!open)}
      >
        <span className={`inline-block transition-transform duration-200 mr-1 ${open ? 'rotate-90' : ''}`}>
          &#9656;
        </span>
        Sources ({citations.length})
      </button>
      {open && (
        <div className="mt-2 border border-border rounded-[--radius-card] bg-surface overflow-hidden">
          {sortedCitations.map((citation, i) => (
            <div
              key={i}
              id={sourceRowId(jobId, citation.textName)}
              className={`py-3 px-4 transition-colors duration-1000 ${i < sortedCitations.length - 1 ? 'border-b border-dashed border-border' : ''} ${highlightedTextName === citation.textName ? 'bg-gold/20' : ''}`}
            >
              <p className="font-sans text-sm italic text-ink mb-1">
                &ldquo;{citation.quote}&rdquo;
              </p>
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs text-ink-muted">{citation.docname}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-ink-muted bg-paper-warm py-0.5 px-1.5 rounded">
                    relevance score: {citation.relevanceScore.toFixed(2)}
                  </span>
                  <button
                    onClick={() => handleDownload(citation.docname)}
                    disabled={downloading === citation.docname}
                    className="font-mono text-xs text-gold hover:text-gold-dark disabled:opacity-50 disabled:cursor-not-allowed bg-transparent border-none cursor-pointer py-0.5 px-2 rounded hover:bg-gold/10 transition-colors"
                  >
                    {downloading === citation.docname ? '...' : '↓ Download'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UserMessage({ question }: { question: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-ink text-white rounded-tl-lg rounded-tr-lg rounded-bl-lg rounded-br-sm py-3 px-4 ml-auto max-w-[85%] w-fit text-[15px]"
    >
      <p className="whitespace-pre-wrap">{question}</p>
    </motion.div>
  );
}

function MessageBlock({ msg, isNew }: { msg: Job; isNew: boolean }) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [highlightedTextName, setHighlightedTextName] = useState<string | null>(null);

  const handleCitationClick = (textName: string) => {
    setSourcesOpen(true);
    setTimeout(() => {
      const el = document.getElementById(sourceRowId(msg.jobId, textName));
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setHighlightedTextName(textName);
      setTimeout(() => setHighlightedTextName(null), 1200);
    }, 50);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      <UserMessage question={msg.question} />
      <div className="flex justify-end">
        <CopyButton text={msg.question} />
      </div>
      {msg.answer && (
        <div className="mt-4 text-[15px] leading-relaxed text-ink">
          <AnswerContent
            text={msg.answer}
            citations={msg.citations}
            animate={isNew}
            className="mb-4"
            onCitationClick={msg.citations && msg.citations.length > 0 ? handleCitationClick : undefined}
          />
          <CopyButton text={msg.answer} />
          {msg.citations && msg.citations.length > 0 && (
            <SourcesCollapsible
              citations={msg.citations}
              open={sourcesOpen}
              onOpenChange={setSourcesOpen}
              jobId={msg.jobId}
              highlightedTextName={highlightedTextName}
            />
          )}
        </div>
      )}
    </motion.div>
  );
}

export default function MessageList({ messages, newlyCompletedJobId }: Props) {
  return (
    <div className="flex flex-col">
      <AnimatePresence mode="popLayout">
        {messages.map((msg) => (
          <MessageBlock key={msg.jobId} msg={msg} isNew={msg.jobId === newlyCompletedJobId} />
        ))}
      </AnimatePresence>
    </div>
  );
}
