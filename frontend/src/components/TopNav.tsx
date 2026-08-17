import { NavLink } from 'react-router-dom';
import { signOut } from 'aws-amplify/auth';
import { useCurrentUser } from '@/hooks/useCurrentUser';

const tabs = [
  { label: 'Chat', path: '/chat' },
  { label: 'Settings', path: '/settings' },
  { label: 'Documents', path: '/documents' },
];

export default function TopNav() {
  const { displayName } = useCurrentUser();

  return (
    <nav className="h-14 flex items-center px-6 border-b border-border bg-surface gap-8">
      <h1 className="font-serif text-2xl font-medium text-ink">CorpusQuery</h1>
      <div className="flex gap-1">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              `font-sans text-sm font-medium no-underline py-4 px-4 relative transition-colors duration-150 ${
                isActive
                  ? 'text-ink after:absolute after:bottom-0 after:left-4 after:right-4 after:h-0.5 after:bg-gold after:content-[""]'
                  : 'text-ink-muted hover:text-ink'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
      <span className="ml-auto font-sans text-sm text-ink-muted">{displayName}</span>
      <button
        onClick={() => signOut()}
        className="font-sans text-sm font-medium px-4 py-2 border border-border rounded-[--radius-input] bg-transparent text-ink cursor-pointer transition-colors duration-150 hover:border-gold"
      >
        Sign Out
      </button>
    </nav>
  );
}
