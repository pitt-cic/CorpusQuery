import { useState } from 'react';
import type { ParsedCitation } from '@/utils/citationParser';

interface Props {
  citation: ParsedCitation;
  number: number;
  onClick?: () => void;
}

export default function CitationTooltip({ citation, number, onClick }: Props) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <sup
        className="text-gold cursor-pointer font-mono text-xs hover:underline"
        onClick={onClick}
      >[{number}]</sup>
      {isHovered && (
        <div className="absolute z-50 px-3 py-2 bg-surface border border-border rounded-lg shadow-lg bottom-full mb-2 left-1/2 transform -translate-x-1/2 w-max max-w-xs">
          <span className="font-mono text-sm text-ink">{citation.docname}</span>
          {/* Arrow pointing down */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
            <div className="border-8 border-transparent border-t-border" />
            <div className="border-8 border-transparent border-t-surface absolute top-0 left-0 transform -translate-y-px" />
          </div>
        </div>
      )}
    </span>
  );
}
