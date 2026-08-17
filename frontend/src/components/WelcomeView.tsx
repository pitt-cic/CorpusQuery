import { motion } from 'framer-motion';
import InputBar from './InputBar';
import ResearcherPanel from './ResearcherPanel';

interface Props {
  firstName: string;
  onSubmit: (text: string) => void;
  disabled?: boolean;
  selectedOrcid: string | null;
  onSelectOrcid: (orcid: string | null) => void;
}

export default function WelcomeView({ firstName, onSubmit, disabled, selectedOrcid, onSelectOrcid }: Props) {
  return (
    <motion.div
      key="welcome"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col items-center px-8 overflow-y-auto"
    >
      <div className="flex-1 min-h-0 max-h-[calc(50vh-80px)]" />
      <h1 className="text-3xl font-medium text-ink mb-8 shrink-0">
        Welcome, {firstName || 'there'}!
      </h1>
      <div className="w-full max-w-[720px] shrink-0">
        <InputBar onSubmit={onSubmit} disabled={disabled} position="centered" />
        <ResearcherPanel
          selectedOrcid={selectedOrcid}
          onSelectOrcid={onSelectOrcid}
        />
      </div>
      <div className="flex-1 min-h-8" />
    </motion.div>
  );
}
