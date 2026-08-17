import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { UserProvider } from '@/contexts/UserContext';
import { authComponents, authFormFields } from '@/auth/authConfig';
import '@/auth/AuthTheme.css';
import TopNav from '@/components/TopNav';
import DesktopOnlyGuard from '@/components/DesktopOnlyGuard';
import ChatPanel from '@/pages/ChatPanel';
import SettingsPanel from '@/pages/SettingsPanel';
import DocumentsPanel from '@/pages/DocumentsPanel';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      refetchOnWindowFocus: false,
    },
  },
});

function AuthenticatedApp() {
  return (
    <UserProvider>
      <DesktopOnlyGuard>
        <BrowserRouter>
          <div className="flex flex-col h-screen overflow-hidden">
            <TopNav />
            <main className="flex-1 overflow-hidden">
              <Routes>
                <Route path="/chat" element={<ChatPanel />} />
                <Route path="/settings" element={<SettingsPanel />} />
                <Route path="/documents" element={<DocumentsPanel />} />
                <Route path="*" element={<Navigate to="/chat" replace />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </DesktopOnlyGuard>
    </UserProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Authenticator
        hideSignUp
        components={authComponents}
        formFields={authFormFields}
      >
        <AuthenticatedApp />
      </Authenticator>
    </QueryClientProvider>
  );
}

export default App;
