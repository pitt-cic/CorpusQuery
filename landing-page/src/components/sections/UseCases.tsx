import { motion } from 'motion/react';
import { Card } from '../ui/Card';

const useCases = [
  {
    title: 'Grant Applications',
    description: 'Quickly synthesize prior work and verify that relevant publications are cited before a draft is ready for senior review.',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    color: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    title: 'Manuscript Drafts',
    description: 'Answer specific questions about methods, findings, and prior results from the full body of indexed literature.',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
    color: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    title: 'Recommendation Letters',
    description: "Ground letters of recommendation in specific, cited examples from the trainee's published research.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
    color: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  {
    title: 'Letters of Support',
    description: 'Verify consistency with past writing and surface relevant prior work without manually scanning every paper.',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
      </svg>
    ),
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
];

export function UseCases() {
  return (
    <section id="use-cases" className="section bg-[var(--color-paper-warm)]">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="font-serif text-3xl md:text-4xl font-medium mb-4 text-[var(--color-ink)]">
            Built for Academic <span className="text-gradient">Writing</span>
          </h2>
          <p className="text-[var(--color-ink-muted)] max-w-2xl mx-auto">
            Designed to reduce the repetitive, low-level writing work that fills a faculty member's day.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {useCases.map((useCase, index) => (
            <Card key={useCase.title} delay={index * 0.1}>
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${useCase.color}`}>
                  {useCase.icon}
                </div>
                <div>
                  <h3 className="font-serif text-lg font-medium text-[var(--color-ink)] mb-1">
                    {useCase.title}
                  </h3>
                  <p className="text-sm text-[var(--color-ink-muted)]">
                    {useCase.description}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
