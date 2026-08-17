import { motion } from 'framer-motion';
import Markdown from 'react-markdown';
import type { Citation } from '@/contracts';
import { parseAnswerWithCitations } from '@/utils/citationParser';
import CitationTooltip from './CitationTooltip';

interface Props {
  text: string;
  citations?: Citation[];
  animate?: boolean;
  className?: string;
  onCitationClick?: (textName: string) => void;
}

function AnswerWithCitations({ text, citations, onCitationClick }: { text: string; citations: Citation[]; onCitationClick?: (textName: string) => void }) {
  const { segments } = parseAnswerWithCitations(text, citations);

  return (
    <div className="prose">
      {segments.map((segment, idx) => {
        if (segment.type === 'text') {
          // Render markdown inline by using a wrapper component
          return (
            <Markdown
              key={idx}
              components={{
                p: ({ children }) => <span>{children}</span>,
              }}
            >
              {segment.content}
            </Markdown>
          );
        } else if (segment.citation) {
          return (
            <CitationTooltip
              key={idx}
              citation={segment.citation}
              number={segment.citation.number}
              onClick={onCitationClick ? () => onCitationClick(segment.citation!.textName) : undefined}
            />
          );
        }
        return null;
      })}
    </div>
  );
}

export default function AnswerContent({ text, citations, animate = true, className = '', onCitationClick }: Props) {
  const content = citations && citations.length > 0 ? (
    <AnswerWithCitations text={text} citations={citations} onCitationClick={onCitationClick} />
  ) : (
    <div className="prose">
      <Markdown>{text}</Markdown>
    </div>
  );

  if (!animate) {
    return <div className={className}>{content}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={className}
    >
      {content}
    </motion.div>
  );
}
