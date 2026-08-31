import { motion } from 'motion/react';

const DEMO_VIDEO_URL = './CorpusQuery (1).mp4';

export function Demo() {
  return (
    <section id="demo" className="section">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="font-serif text-3xl md:text-4xl font-medium mb-4 text-[var(--color-ink)]">
            See It In <span className="text-gradient">Action</span>
          </h2>
          <p className="text-[var(--color-ink-muted)] max-w-2xl mx-auto">
            Watch how CorpusQuery ingests papers and answers natural-language questions with inline citations.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-4xl mx-auto"
        >
          <div className="browser-window shadow-lg">
            <div className="browser-header">
              <div className="browser-dot browser-dot-red" />
              <div className="browser-dot browser-dot-yellow" />
              <div className="browser-dot browser-dot-green" />
              <span className="ml-2 text-xs text-[var(--color-ink-faint)] font-mono">
                CorpusQuery — Demo
              </span>
            </div>
            <div className="relative aspect-video bg-[var(--color-ink)]">
              <video
                controls
                className="w-full h-full"
                preload="metadata"
              >
                <source src={DEMO_VIDEO_URL} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
