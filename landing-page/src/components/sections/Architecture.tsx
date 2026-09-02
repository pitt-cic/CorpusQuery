import { motion } from 'motion/react';

const tags = [
  'S3 Vectors',
  'Bedrock Knowledge Base',
  'Async Job Pattern',
  'Cognito Auth',
  'Serverless',
  'ORCID Integration',
];

export function Architecture() {
  return (
    <section id="architecture" className="section bg-[var(--color-paper-warm)]">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"  
        >
          <h2 className="font-serif text-3xl md:text-4xl font-medium mb-4 text-[var(--color-ink)]">
            Serverless <span className="text-gradient">Architecture</span>
          </h2>
          <p className="text-[var(--color-ink-muted)] max-w-2xl mx-auto">
            Four specialized Lambda functions handle ingestion, querying, and session management — all on AWS serverless infrastructure.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-5xl mx-auto"
        >
          <div className="card p-4 md:p-8">
            <img
              src="./architecture-diagram.png"
              alt="CorpusQuery Architecture Diagram"
              className="w-full rounded-lg"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-10 flex flex-wrap justify-center gap-3"
        >
          {tags.map((tag) => (
            <span
              key={tag}
              className="px-4 py-2 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-ink-muted)]"
            >
              {tag}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
