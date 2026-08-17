import { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LayoutGroup, AnimatePresence } from 'framer-motion';
import { JobStatus } from '@/contracts';
import { useSessions } from '@/hooks/useSessions';
import { useActiveSession } from '@/hooks/useActiveSession';
import { useChatFlow } from '@/hooks/useChatFlow';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useSelectedOrcid } from '@/hooks/useSelectedOrcid';
import SessionSidebar from '@/components/SessionSidebar';
import WelcomeView from '@/components/WelcomeView';
import ActiveConversationView from '@/components/ActiveConversationView';

const SESSION_ORCID_KEY = 'sessionOrcids';

function getSessionOrcid(sessionId: string): string | null {
  try {
    const stored = localStorage.getItem(SESSION_ORCID_KEY);
    const map = stored ? JSON.parse(stored) : {};
    return map[sessionId] ?? null;
  } catch {
    return null;
  }
}

function saveSessionOrcid(sessionId: string, orcid: string | null) {
  try {
    const stored = localStorage.getItem(SESSION_ORCID_KEY);
    const map = stored ? JSON.parse(stored) : {};
    if (orcid) {
      map[sessionId] = orcid;
    } else {
      delete map[sessionId];
    }
    localStorage.setItem(SESSION_ORCID_KEY, JSON.stringify(map));
  } catch {}
}

export default function ChatPanel() {
  const queryClient = useQueryClient();
  const { firstName } = useCurrentUser();
  const { sessions, renameSession, deleteSession, fetchNextPage, hasNextPage, isFetchingNextPage } = useSessions();
  const { activeSessionId, setActiveSession } = useActiveSession();
  const { messages, status, ask, pendingJobId } = useChatFlow(activeSessionId);
  const { selectedOrcid, setSelectedOrcid } = useSelectedOrcid();

  const [newlyCompletedJobId, setNewlyCompletedJobId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionOrcid, setSessionOrcidState] = useState<string | null>(null);

  // Sync session orcid when switching sessions (independent of global welcome-view filter)
  useEffect(() => {
    setSessionOrcidState(activeSessionId ? getSessionOrcid(activeSessionId) : null);
  }, [activeSessionId]);

  const clearSessionOrcid = () => {
    if (activeSessionId) {
      saveSessionOrcid(activeSessionId, null);
      setSessionOrcidState(null);
    }
  };

  const activeSession = activeSessionId
    ? sessions.find((s) => s.sessionId === activeSessionId)
    : null;

  const isWelcomeState = !activeSessionId;
  const isProcessing = status !== null && status !== JobStatus.COMPLETED && status !== JobStatus.FAILED;

  useEffect(() => {
    if (status === JobStatus.COMPLETED && pendingJobId) {
      setNewlyCompletedJobId(pendingJobId);
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      const timer = setTimeout(() => setNewlyCompletedJobId(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [status, pendingJobId, queryClient]);

  const handleSubmit = useCallback(
    async (text: string) => {
      if (isSubmitting) return;
      setIsSubmitting(true);

      // Welcome view uses the global filter; active sessions use their stored orcid
      const orcidToUse = isWelcomeState ? selectedOrcid : sessionOrcid;

      try {
        const response = await ask(text, orcidToUse || undefined);
        if (response?.sessionId && isWelcomeState) {
          saveSessionOrcid(response.sessionId, selectedOrcid);
          setActiveSession(response.sessionId);
        }
      } catch (error) {
        console.error('Failed to submit question:', error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [ask, isWelcomeState, isSubmitting, setActiveSession, selectedOrcid, sessionOrcid]
  );

  const handleNewChat = () => {
    setActiveSession(null);
  };

  return (
    <div className="flex h-full">
      <SessionSidebar
        sessions={sessions}
        activeId={activeSessionId}
        isActiveSessionLoading={isProcessing}
        onSelect={setActiveSession}
        onCreate={handleNewChat}
        onRename={(id, title) => renameSession({ sessionId: id, title })}
        onDelete={(id) => deleteSession(id)}
        onLoadMore={fetchNextPage}
        hasMore={hasNextPage}
        isLoadingMore={isFetchingNextPage}
      />
      <LayoutGroup>
        <AnimatePresence mode="wait">
          {isWelcomeState ? (
            <WelcomeView
              firstName={firstName}
              onSubmit={handleSubmit}
              disabled={isSubmitting}
              selectedOrcid={selectedOrcid}
              onSelectOrcid={setSelectedOrcid}
            />
          ) : (
            <ActiveConversationView
              title={activeSession?.title ?? null}
              question={messages[0]?.question ?? null}
              messages={messages}
              status={status}
              newlyCompletedJobId={newlyCompletedJobId}
              onSubmit={handleSubmit}
              disabled={isSubmitting}
              selectedOrcid={sessionOrcid}
              onClearOrcid={clearSessionOrcid}
            />
          )}
        </AnimatePresence>
      </LayoutGroup>
    </div>
  );
}
