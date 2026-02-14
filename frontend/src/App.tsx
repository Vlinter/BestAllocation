import { useState } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { darkTheme } from './theme';
import { MainLayout } from './components/layout/MainLayout';
import { Dashboard } from './pages/Dashboard';
import DocumentationPage from './components/DocumentationPage'; // Import directly or lazy load
import { LoadingOverlay } from './components';
import { useOptimization, useRanking } from './hooks';
import type { OptimizationParams } from './hooks';

function App() {
  const {
    isLoading,
    loadingProgress,
    loadingMessage,
    results,
    error,
    runOptimization,
  } = useOptimization();

  const globalRanking = useRanking(results);
  const [sidebarMode, setSidebarMode] = useState<'hidden' | 'normal' | 'fullscreen'>('normal');
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [lastRebalancingWindow, setLastRebalancingWindow] = useState(63);

  const handleOptimize = async (params: OptimizationParams) => {
    setLastRebalancingWindow(params.rebalancingWindow);
    await runOptimization(params);
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />

      <LoadingOverlay
        open={isLoading}
        progress={loadingProgress}
        message={loadingMessage}
      />

      <MainLayout
        isLoading={isLoading}
        error={error}
        results={results}
        onOptimize={handleOptimize}
        sidebarMode={sidebarMode}
        setSidebarMode={setSidebarMode}
        onToggleDocs={() => setIsDocsOpen(true)}
      >
        <Dashboard
          results={results}
          globalRanking={globalRanking}
          lastRebalancingWindow={lastRebalancingWindow}
        />
      </MainLayout>

      {/* Documentation Modal/Drawer */}
      <DocumentationPage open={isDocsOpen} onClose={() => setIsDocsOpen(false)} />

    </ThemeProvider>
  );
}

export default App;
