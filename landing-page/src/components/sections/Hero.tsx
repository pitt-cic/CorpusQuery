import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';

interface Source {
  ref: string;
  title: string;
  excerpt: string;
}

const sources: Source[] = [
  {
    ref: '1',
    title: 'Smith et al. (2021). Effects of Mindfulness on HPA Axis Reactivity.',
    excerpt: '"Salivary cortisol was measured using ELISA at four standardized time points following the Trier Social Stress Test..."',
  },
  {
    ref: '2',
    title: 'Johnson et al. (2023). Cortisol Dynamics in Academic Stress.',
    excerpt: '"Post-stress sampling was performed at 0, 30, and 60 minutes. LC-MS/MS was used to confirm results in high-baseline populations..."',
  },
  {
    ref: '3',
    title: 'Chen et al. (2022). Stress Response Characterization.',
    excerpt: '"Immunoassay-based cortisol quantification was cross-validated against mass spectrometry readings across all trial cohorts..."',
  },
];

function ExpandableSource({ source, delay }: { source: Source; delay: number }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="border-l-2 border-[var(--color-gold)]/40 pl-4 py-1"
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-left group w-full"
      >
        <span className="w-5 h-5 rounded bg-[var(--color-gold-soft)] flex items-center justify-center text-xs text-[var(--color-gold-dark)] group-hover:bg-[var(--color-gold)]/20 transition-colors shrink-0 border border-[var(--color-border-gold)]">
          {isExpanded ? '−' : '+'}
        </span>
        <span className="text-sm text-[var(--color-ink)]">
          <span className="citation-badge">{source.ref}</span>
          <span className="ml-1 text-[var(--color-ink-muted)]">{source.title}</span>
        </span>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="mt-2 ml-7 text-xs text-[var(--color-ink-faint)] italic font-mono leading-relaxed">
              {source.excerpt}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function Hero() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16">
      {/* Subtle warm glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[var(--color-gold)] opacity-[0.06] blur-[120px] rounded-full" />

      <div className="container relative z-10 text-center px-6 py-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mb-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-gold-soft)] border border-[var(--color-border-gold)] text-sm text-[var(--color-ink-muted)]">
            <span className="w-2 h-2 rounded-full bg-[var(--color-gold)] animate-pulse" />
            AI-Powered Research Assistant
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
          className="font-serif text-4xl md:text-6xl lg:text-7xl font-medium tracking-tight mb-6 text-[var(--color-ink)]"
        >
          Cited Answers from Any
          <br />
          <span className="text-gradient">Research Corpus</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
          className="text-lg md:text-xl text-[var(--color-ink-muted)] max-w-2xl mx-auto mb-10"
        >
          Build a searchable knowledge base from scientific literature and ask natural-language
          questions — every answer is grounded in sources with inline citations.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
          <a href="#demo" className="btn-primary">Watch Demo</a>
          <a
            href="#architecture"
            className="px-6 py-3 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-muted)] hover:border-[var(--color-border-gold)] hover:text-[var(--color-gold-dark)] transition-colors"
          >
            View Architecture
          </a>
        </motion.div>

        {/* Mock Q&A panel */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
          className="max-w-3xl mx-auto"
        >
          <div className="card p-6 md:p-8 text-left">
            {/* Question */}
            <div className="flex items-start gap-4 mb-6">
              <div className="w-9 h-9 rounded-full bg-[var(--color-ink)] flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-[var(--color-ink-faint)] mb-1 font-mono">Query</p>
                <p className="text-[var(--color-ink)] font-medium">
                  What methods were used to measure cortisol levels in these studies?
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-[var(--color-border)] mb-6" />

            {/* Loading or Response */}
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-4"
                >
                  <div className="w-9 h-9 rounded-full bg-[var(--color-gold-soft)] border border-[var(--color-border-gold)] flex items-center justify-center shrink-0">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-5 h-5 rounded-full border-2 border-[var(--color-border-gold)] border-t-[var(--color-gold)]"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-ink-faint)] mb-1 font-mono">CorpusQuery</p>
                    <p className="text-sm text-[var(--color-ink-muted)]">Searching 42 indexed papers...</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="response"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-9 h-9 rounded-full bg-[var(--color-gold-soft)] border border-[var(--color-border-gold)] flex items-center justify-center shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-gold-dark)]">
                        <path d="M4 6h16M4 10h12M4 14h14M4 18h10" />
                        <circle cx="18" cy="16" r="4" />
                        <line x1="21" y1="19" x2="23" y2="21" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-[var(--color-ink-faint)] mb-2 font-mono">CorpusQuery</p>
                      <p className="text-[var(--color-ink-muted)] text-sm leading-relaxed mb-1">
                        The studies primarily used enzyme-linked immunosorbent assay (ELISA) to quantify salivary cortisol
                        <span className="citation-badge">1</span>.
                        Sampling followed standardized time points post-stimulus across all trials
                        <span className="citation-badge">2</span><span className="citation-badge">3</span>.
                        Liquid chromatography–mass spectrometry (LC-MS/MS) was additionally used for confirmation in high-baseline populations
                        <span className="citation-badge">2</span>.
                      </p>

                      <div className="mt-4 space-y-2">
                        <p className="text-xs text-[var(--color-ink-faint)] uppercase tracking-wider mb-2 font-mono">Sources</p>
                        {sources.map((source, index) => (
                          <ExpandableSource key={source.ref} source={source} delay={index * 0.1} />
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
