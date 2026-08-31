const linkedinIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-[var(--color-ink-faint)]">
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
  </svg>
);

const team = [
  { name: 'Angela Renion',    href: 'https://www.linkedin.com/in/angela-renion/' },
  { name: 'Misran Mohammed',  href: 'https://www.linkedin.com/in/mmisran/' },
  { name: 'Ava Luu',          href: 'https://www.linkedin.com/in/avaluu/' },
];

const leadership = [
  { name: 'Maciej Zukowski',  href: 'https://www.linkedin.com/in/maciejzukowski/' },
  { name: 'Kate Ulreich',     href: 'https://www.linkedin.com/in/kate-ulreich-0a8902134/' },
  { name: 'Dwight Helfrich',  href: 'https://www.linkedin.com/in/dwight-helfrich-53a233b/' },
];

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-paper-warm)] py-10 px-6">
      <div className="container flex flex-col md:flex-row items-start justify-between gap-10">
        {/* Left */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-md bg-[var(--color-gold)] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16M4 10h12M4 14h14M4 18h10" />
                <circle cx="18" cy="16" r="4" />
                <line x1="21" y1="19" x2="23" y2="21" />
              </svg>
            </div>
            <span className="font-serif text-sm font-medium text-[var(--color-ink)]">CorpusQuery</span>
          </div>

          <a
            href="https://github.com/pitt-cic/CorpusQuery"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-[var(--color-ink-faint)] hover:text-[var(--color-gold)] transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            GitHub
          </a>

          <a
            href="https://www.digital.pitt.edu/cic"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--color-gold-dark)] hover:text-[var(--color-gold)] transition-colors"
          >
            Pitt Cloud Innovation Center
          </a>
        </div>

        {/* Right — Team */}
        <div className="flex flex-col sm:flex-row gap-10">
          <div className="flex flex-col gap-2">
            <span className="text-xs text-[var(--color-ink-faint)] uppercase tracking-wider mb-1">Development Team</span>
            {team.map(({ name, href }) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-gold)] transition-colors"
              >
                {name}
                {linkedinIcon}
              </a>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs text-[var(--color-ink-faint)] uppercase tracking-wider mb-1">Project Leadership</span>
            {leadership.map(({ name, href }) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-gold)] transition-colors"
              >
                {name}
                {linkedinIcon}
              </a>
            ))}
            <a
              href="https://www.linkedin.com/in/alexander-chang-839a53a6/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-[var(--color-ink-faint)] hover:text-[var(--color-gold)] transition-colors mt-1"
            >
              <span className="italic">Special thanks:</span> Alexander Chang
              {linkedinIcon}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
