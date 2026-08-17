import { useState, useEffect, type ReactNode } from 'react';
import { Monitor } from 'lucide-react';

const MIN_WIDTH = 1024;

interface Props {
  children: ReactNode;
}

export default function DesktopOnlyGuard({ children }: Props) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MIN_WIDTH);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (isMobile) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-paper p-8 text-center">
        <Monitor className="w-16 h-16 text-ink-muted mb-6" />
        <h1 className="text-2xl font-medium text-ink mb-2">Desktop Required</h1>
        <p className="text-ink-muted max-w-sm">
          This application is optimized for desktop browsers.
          Please open on a device with a larger screen.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
