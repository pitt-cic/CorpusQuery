import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import type { Session } from '@/contracts';
import { relativeTime } from '@/utils/dateFormat';
import { truncate } from '@/utils/stringFormat';

interface Props {
  sessions: Session[];
  activeId: string | null;
  isActiveSessionLoading?: boolean;
  onSelect: (sessionId: string | null) => void;
  onCreate: () => void;
  onRename: (sessionId: string, title: string) => void;
  onDelete: (sessionId: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

export default function SessionSidebar({
  sessions,
  activeId,
  isActiveSessionLoading,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onLoadMore,
  hasMore,
  isLoadingMore,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const startRename = (session: Session) => {
    setEditingId(session.sessionId);
    setEditTitle(session.title);
  };

  const commitRename = () => {
    if (editingId && editTitle.trim()) {
      onRename(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <aside className="w-[20%] min-w-60 max-w-80 h-full bg-paper-warm border-r border-border flex flex-col overflow-hidden">
      <button
        className="mx-4 mt-4 mb-4 py-2.5 border border-border rounded-[--radius-input] bg-transparent font-sans text-sm font-medium text-ink cursor-pointer transition-colors duration-150 hover:border-gold"
        onClick={onCreate}
      >
        + New Chat
      </button>
      <div className="flex-1 overflow-y-auto scrollbar-hidden">
        <AnimatePresence mode="popLayout">
          {sessions.map((session) => {
            const isActive = session.sessionId === activeId;
            const showTitleShimmer = isActive && isActiveSessionLoading;

            const isConfirmingDelete = confirmDeleteId === session.sessionId;

            return (
              <motion.div
                key={session.sessionId}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`group relative py-3 px-4 cursor-pointer border-l-[3px] transition-colors duration-150 ${
                  isActive
                    ? 'bg-gold-soft border-l-gold'
                    : 'border-l-transparent hover:bg-gold-soft'
                }`}
                onClick={() => {
                  if (isConfirmingDelete) return;
                  onSelect(session.sessionId);
                }}
              >
                {editingId === session.sessionId ? (
                  <input
                    className="w-full font-sans text-sm py-1 px-2 border border-gold rounded outline-none"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => e.key === 'Enter' && commitRename()}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : showTitleShimmer ? (
                  <>
                    <div className="h-4 w-3/4 bg-gradient-to-r from-border via-paper-warm to-border animate-shimmer rounded mb-1" />
                    <div className="h-3 w-1/2 bg-gradient-to-r from-border via-paper-warm to-border animate-shimmer rounded" />
                  </>
                ) : isConfirmingDelete ? (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <span className="text-xs text-ink-muted flex-1">Delete?</span>
                    <button
                      className="text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
                      onClick={() => {
                        onDelete(session.sessionId);
                        setConfirmDeleteId(null);
                        if (isActive) onSelect(null);
                      }}
                    >
                      Yes
                    </button>
                    <button
                      className="text-xs font-medium text-ink-muted hover:text-ink transition-colors"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <>
                    <span
                      className="block font-sans text-sm text-ink mb-1 pr-6"
                      onDoubleClick={() => startRename(session)}
                    >
                      {truncate(session.title, 30)}
                    </span>
                    <span className="font-mono text-[11px] text-ink-muted">
                      {relativeTime(session.lastActive)}
                    </span>
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-ink-muted hover:text-red-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(session.sessionId);
                      }}
                      title="Delete session"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        {hasMore && (
          <button
            className="w-full py-3 text-sm text-ink-muted hover:text-ink transition-colors"
            onClick={onLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? 'Loading...' : 'Load more'}
          </button>
        )}
      </div>
    </aside>
  );
}
