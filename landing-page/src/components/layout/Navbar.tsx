import { motion } from 'motion/react';

export function Navbar() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 bg-[var(--color-paper)]/90 backdrop-blur-md border-b border-[var(--color-border)]"
    >
      <div className="container flex items-center justify-between h-16 px-6">
        <a href="#" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-gold)] flex items-center justify-center">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 6h16M4 10h12M4 14h14M4 18h10" />
              <circle cx="18" cy="16" r="4" />
              <line x1="21" y1="19" x2="23" y2="21" />
            </svg>
          </div>
          <span className="font-serif text-lg font-medium text-[var(--color-ink)] group-hover:text-[var(--color-gold)] transition-colors">
            CorpusQuery
          </span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          {['Features', 'Demo', 'Architecture', 'Tech Stack'].map((label) => (
            <a
              key={label}
              href={`#${label.toLowerCase().replace(' ', '-')}`}
              className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-gold)] transition-colors"
            >
              {label}
            </a>
          ))}
        </div>

        <a
          href="https://github.com/pitt-cic/CorpusQuery"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary text-sm py-2 px-4 inline-flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          View on GitHub
        </a>
      </div>
    </motion.nav>
  );
}
