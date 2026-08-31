import { motion } from 'motion/react';
import { Card } from '../ui/Card';

const features = [
  {
    title: 'Automated Paper Ingestion',
    description:
      "Provide a researcher's ORCID and the platform automatically discovers their publication catalog via the ORCID API, then fetches available PDFs through Unpaywall, OpenAlex, and PubMed Central.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a10 10 0 1 0 10 10" />
        <path d="M12 8v4l3 3" />
        <path d="M16 2l4 4-4 4" />
        <path d="M20 6H10" />
      </svg>
    ),
  },
  {
    title: 'Cited Q&A',
    description:
      "Ask natural-language questions and receive answers with inline citations, powered by PaperQA's retrieve \u2192 summarize \u2192 generate pipeline.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21" />
        <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3" />
      </svg>
    ),
  },
  {
    title: 'Manual Document Upload',
    description:
      'Extend the knowledge base with preprints, book chapters, or internal documents not available through public APIs — upload PDFs directly.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    title: 'Configurable LLM Settings',
    description:
      'Choose between Amazon Bedrock, Anthropic, or OpenAI providers and fine-tune retrieval parameters — answer length, source count, and diversity — through a settings panel.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        <path d="M4.93 4.93a10 10 0 0 0 0 14.14" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M8.46 8.46a5 5 0 0 0 0 7.07" />
      </svg>
    ),
  },
];

export function Features() {
  return (
    <section id="features" className="section bg-[var(--color-paper-warm)]">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="font-serif text-3xl md:text-4xl font-medium mb-4 text-[var(--color-ink)]">
            Core <span className="text-gradient">Capabilities</span>
          </h2>
          <p className="text-[var(--color-ink-muted)] max-w-2xl mx-auto">
            Everything you need to build a searchable knowledge base and extract cited answers from scientific literature.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {/* Row 1: Large card (2-col) + two tall cards */}
          <div className="md:col-span-2 md:row-span-2">
            <Card delay={0} className="h-full flex flex-col min-h-[200px] md:min-h-full">
              <div className="w-10 h-10 rounded-lg bg-[var(--color-gold-soft)] border border-[var(--color-border-gold)] flex items-center justify-center text-[var(--color-gold-dark)] mb-4">
                {features[0].icon}
              </div>
              <h3 className="font-serif text-lg font-medium text-[var(--color-ink)] mb-2">
                {features[0].title}
              </h3>
              <p className="text-sm text-[var(--color-ink-muted)] flex-1">
                {features[0].description}
              </p>
            </Card>
          </div>
          <div className="md:row-span-2">
            <Card delay={0.1} className="h-full flex flex-col min-h-[200px] md:min-h-full">
              <div className="w-10 h-10 rounded-lg bg-[var(--color-gold-soft)] border border-[var(--color-border-gold)] flex items-center justify-center text-[var(--color-gold-dark)] mb-4">
                {features[1].icon}
              </div>
              <h3 className="font-serif text-lg font-medium text-[var(--color-ink)] mb-2">
                {features[1].title}
              </h3>
              <p className="text-sm text-[var(--color-ink-muted)] flex-1">
                {features[1].description}
              </p>
            </Card>
          </div>
          <div className="md:row-span-2">
            <Card delay={0.2} className="h-full flex flex-col min-h-[200px] md:min-h-full">
              <div className="w-10 h-10 rounded-lg bg-[var(--color-gold-soft)] border border-[var(--color-border-gold)] flex items-center justify-center text-[var(--color-gold-dark)] mb-4">
                {features[2].icon}
              </div>
              <h3 className="font-serif text-lg font-medium text-[var(--color-ink)] mb-2">
                {features[2].title}
              </h3>
              <p className="text-sm text-[var(--color-ink-muted)] flex-1">
                {features[2].description}
              </p>
            </Card>
          </div>

          {/* Row 2: wide card spanning remaining 2 cols (row 2, col 1–2 already taken by large card) */}
          <div className="md:col-span-4">
            <Card delay={0.3} className="flex flex-col sm:flex-row items-start gap-4 min-h-[120px]">
              <div className="w-10 h-10 rounded-lg bg-[var(--color-gold-soft)] border border-[var(--color-border-gold)] flex items-center justify-center text-[var(--color-gold-dark)] shrink-0">
                {features[3].icon}
              </div>
              <div>
                <h3 className="font-serif text-lg font-medium text-[var(--color-ink)] mb-1">
                  {features[3].title}
                </h3>
                <p className="text-sm text-[var(--color-ink-muted)]">
                  {features[3].description}
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
