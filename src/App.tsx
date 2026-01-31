import { useState, lazy, Suspense } from 'react';
import { Minus, Square, X } from 'lucide-react';
import { ConfirmDialog, useConfirmations } from './components/ConfirmDialog';
import { UserQuestionDialog } from './components/UserQuestionDialog';
import { useUserQuestions } from './hooks/useUserQuestions';
import { ErrorBoundary } from './components/ErrorBoundary';

// Code splitting for better performance
const MainInterface = lazy(() => import('./components/MainInterface'));
const SettingsView = lazy(() => import('./components/SettingsView'));
const FloatingBallPage = lazy(() => import('./components/FloatingBallPage'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
  </div>
);

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const { pendingRequest, handleConfirm, handleDeny } = useConfirmations();
  const { pendingQuestion, handleAnswer } = useUserQuestions();

  // Check if this is the floating ball window
  const isFloatingBall = window.location.hash === '#/floating-ball' || window.location.hash === '#floating-ball';

  // If this is the floating ball window, render only the floating ball
  if (isFloatingBall) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <FloatingBallPage />
      </Suspense>
    );
  }

  // Main App - Narrow vertical layout
  return (
    <ErrorBoundary>
      <div className="h-screen w-full bg-[#FAF8F5] flex flex-col overflow-hidden font-sans">
      {/* Custom Titlebar */}
      <header
        className="h-10 border-b border-stone-200/80 flex items-center justify-between px-3 bg-white/80 backdrop-blur-sm shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} />

        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {/* Window Controls */}
          <button
            type="button"
            onClick={() => window.ipcRenderer.invoke('window:minimize')}
            aria-label="最小化窗口"
            className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            title="Minimize"
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            onClick={() => window.ipcRenderer.invoke('window:maximize')}
            aria-label="最大化窗口"
            className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            title="Maximize"
          >
            <Square size={12} />
          </button>
          <button
            type="button"
            onClick={() => window.ipcRenderer.invoke('window:close')}
            aria-label="关闭窗口"
            className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-red-100 hover:text-red-500 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <Suspense fallback={<LoadingFallback />}>
          {showSettings ? (
            <SettingsView onClose={() => setShowSettings(false)} />
          ) : (
            <MainInterface onOpenSettings={() => setShowSettings(true)} />
          )}
        </Suspense>
      </main>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        request={pendingRequest}
        onConfirm={handleConfirm}
        onDeny={handleDeny}
      />

      <UserQuestionDialog 
        request={pendingQuestion}
        onAnswer={handleAnswer}
      />
    </div>
    </ErrorBoundary>
  );
}

export default App;
