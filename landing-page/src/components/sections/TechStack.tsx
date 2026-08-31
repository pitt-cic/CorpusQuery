import { motion } from 'motion/react';

const technologies = [
  {
    name: 'Amazon Bedrock',
    description: 'Claude LLMs & Titan Embed v2',
  },
  {
    name: 'S3 Vectors',
    description: 'Cosine vector index, 1024-dim',
  },
  {
    name: 'PaperQA',
    description: 'Retrieve → summarize → generate',
  },
  {
    name: 'AWS Lambda',
    description: 'API, Query, Fetcher, Indexer',
  },
  {
    name: 'Amazon DynamoDB',
    description: 'Sessions, chat & job records',
  },
  {
    name: 'AWS Amplify',
    description: 'React SPA hosting',
  },
  {
    name: 'React 19',
    description: 'TypeScript + Vite frontend',
  },
  {
    name: 'AWS CDK',
    description: 'Infrastructure as code',
  },
];

export function TechStack() {
  return (
    <section id="tech-stack" className="section">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="font-serif text-3xl md:text-4xl font-medium mb-4 text-[var(--color-ink)]">
            Built With <span className="text-gradient">Modern Tech</span>
          </h2>
          <p className="text-[var(--color-ink-muted)] max-w-2xl mx-auto">
            Powered by cutting-edge AWS services, PaperQA, and a modern React frontend.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {technologies.map((tech, index) => (
            <motion.div
              key={tech.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              whileHover={{ y: -3, borderColor: 'var(--color-border-gold)' }}
              className="flex flex-col items-center justify-center p-6 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] transition-all cursor-default text-center"
            >
              <span className="text-sm font-medium text-[var(--color-ink)] mb-1">
                {tech.name}
              </span>
              <span className="text-xs text-[var(--color-ink-faint)]">
                {tech.description}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
