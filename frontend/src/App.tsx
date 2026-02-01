import { useState, useCallback, lazy, Suspense, useEffect } from 'react';
import { ThemeProvider, CssBaseline, Box, Typography, Chip, Paper, Alert, AlertTitle, Tabs, Tab, IconButton, Tooltip } from '@mui/material';
import { EmojiEvents as TrophyIcon, Warning as WarningIcon, Dashboard, ShowChart, Shield, PieChart, Science, Menu as MenuIcon, ChevronLeft as ChevronLeftIcon, HelpOutline as HelpIcon } from '@mui/icons-material';
import { darkTheme } from './theme';
import {
  Sidebar,
  DataInfoCard,
  ComparisonTable,
  LoadingOverlay,
  AnimatedBackground,
  ErrorBoundary,
  SkeletonLoader,
} from './components';

// Lazy load heavy chart components for performance
const AllocationComparison = lazy(() => import('./components/AllocationComparison'));
const ComparisonChart = lazy(() => import('./components/ComparisonChart'));
const DrawdownComparisonChart = lazy(() => import('./components/DrawdownComparisonChart'));
const AllocationHistoryChart = lazy(() => import('./components/AllocationHistoryChart'));
const EfficientFrontierChart = lazy(() => import('./components/EfficientFrontierChart'));
const RiskContributionChart = lazy(() => import('./components/RiskContributionChart'));
const CorrelationHeatmap = lazy(() => import('./components/CorrelationHeatmap'));
const MonthlyReturnsHeatmap = lazy(() => import('./components/MonthlyReturnsHeatmap'));
const ReturnsDistributionChart = lazy(() => import('./components/ReturnsDistributionChart'));
const ModelHealthCards = lazy(() => import('./components/ModelHealthCards'));
const OverfittingChart = lazy(() => import('./components/OverfittingChart'));
const OverfittingTable = lazy(() => import('./components/OverfittingTable'));
const DocumentationPage = lazy(() => import('./components/DocumentationPage'));

import type { OptimizationParams } from './components';
import { startComparisonJob, getJobStatus } from './api/client';
import type { CompareResponse } from './api/client';


// Optimized Tab Panel: Keeps all tabs mounted to avoid expensive re-renders
// Uses CSS visibility/display to hide inactive tabs while preserving state
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  const isActive = value === index;
  const [hasBeenActive, setHasBeenActive] = useState(false);

  // Fix: Use useEffect to update state to avoid "cannot update during render" or loops


  useEffect(() => {
    if (isActive && !hasBeenActive) {
      setHasBeenActive(true);
    }
  }, [isActive, hasBeenActive]);

  // Optimize: Don't render anything until the tab has been visited at least once.
  if (!hasBeenActive && !isActive) {
    return null;
  }

  return (
    <div
      role="tabpanel"
      hidden={!isActive}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
      style={{
        display: isActive ? 'block' : 'none',
        opacity: isActive ? 1 : 0,
        transition: 'opacity 0.25s ease-in-out',
      }}
    >
      {/* Always render children once mounted to keep chart state */}
      <Box sx={{ py: 3 }}>
        {children}
      </Box>
    </div>
  );
}

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("Initializing...");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CompareResponse | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDocsOpen, setIsDocsOpen] = useState(false);


  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleOptimize = useCallback(async (params: OptimizationParams) => {
    setIsLoading(true);
    setLoadingProgress(0);
    setLoadingMessage("Starting Job...");
    setError(null);
    setActiveTab(0);


    try {
      // 1. Start Job
      const { job_id } = await startComparisonJob({
        tickers: params.tickers,
        start_date: params.startDate,
        end_date: params.endDate,
        training_window: params.trainingWindow,
        rebalancing_window: params.rebalancingWindow,
        transaction_cost_bps: params.transactionCostBps,
        min_weight: params.minWeight,
        max_weight: params.maxWeight,
        benchmark_type: params.benchmarkType,
        benchmark_ticker: params.benchmarkTicker,
        // cvar_confidence no longer used
      });


      // 2. Poll until complete
      const pollInterval = 500; // 0.5s

      const poll = async () => {
        try {
          const status = await getJobStatus(job_id);

          setLoadingProgress(status.progress);
          setLoadingMessage(status.message);

          if (status.status === 'completed' && status.result) {
            setResults(status.result);
            // Allow 100% to be seen for a moment
            setTimeout(() => setIsLoading(false), 800);
            return;
          } else if (status.status === 'failed') {
            setError(status.error || "Optimization failed");
            setIsLoading(false);
            return;
          }

          // Continue polling if not done
          if (status.status === 'queued' || status.status === 'processing') {
            setTimeout(poll, pollInterval);
          }
        } catch (err) {
          // Retry on transient network errors
          if (isLoading) setTimeout(poll, pollInterval);
        }
      };

      poll();

    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        err?.message ||
        'An unexpected error occurred. Please try again.';
      setError(message);
      setIsLoading(false);
    }
  }, [isLoading]);

  // Calculate global ranking based on multiple metrics
  const getGlobalRanking = () => {
    if (!results) return null;

    const metricsToCompare: { key: keyof typeof results.methods[0]['performance_metrics']; higherIsBetter: boolean; label: string }[] = [
      { key: 'sharpe_ratio', higherIsBetter: true, label: 'Sharpe Ratio' },
      { key: 'sortino_ratio', higherIsBetter: true, label: 'Sortino Ratio' },
      { key: 'cagr', higherIsBetter: true, label: 'CAGR' },
      { key: 'total_return', higherIsBetter: true, label: 'Total Return' },
      { key: 'max_drawdown', higherIsBetter: false, label: 'Max Drawdown' },
      { key: 'volatility', higherIsBetter: false, label: 'Volatility' },
      { key: 'calmar_ratio', higherIsBetter: true, label: 'Calmar Ratio' },
      { key: 'alpha', higherIsBetter: true, label: 'Alpha' },
      { key: 'omega_ratio', higherIsBetter: true, label: 'Omega Ratio' },
      { key: 'win_rate', higherIsBetter: true, label: 'Win Rate' },
      { key: 'annualized_turnover', higherIsBetter: false, label: 'Turnover' },
    ];

    // Count wins per method across all metrics
    const wins: Record<string, { count: number; metrics: string[] }> = {};
    results.methods.forEach(m => { wins[m.method] = { count: 0, metrics: [] }; });

    metricsToCompare.forEach(metric => {
      let bestMethod = '';
      let bestValue = metric.higherIsBetter ? -Infinity : Infinity;

      results.methods.forEach(m => {
        const value = m.performance_metrics[metric.key] as number;
        if (metric.higherIsBetter ? value > bestValue : value < bestValue) {
          bestValue = value;
          bestMethod = m.method;
        }
      });

      if (bestMethod) {
        wins[bestMethod].count++;
        wins[bestMethod].metrics.push(metric.label);
      }
    });

    // Sort by number of wins
    const ranking = results.methods
      .map(m => ({
        method: m,
        wins: wins[m.method].count,
        winningMetrics: wins[m.method].metrics,
      }))
      .sort((a, b) => b.wins - a.wins);

    return {
      ranking,
      totalMetrics: metricsToCompare.length,
    };
  };

  const globalRanking = getGlobalRanking();

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />

      {/* Animated Background with floating orbs */}
      <AnimatedBackground />

      {/* Premium Loading Overlay */}
      <LoadingOverlay
        open={isLoading}
        progress={loadingProgress}
        message={loadingMessage}
      />

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, minHeight: '100vh', bgcolor: 'transparent', position: 'relative', zIndex: 1 }}>
        {/* Sidebar - collapsible on all screen sizes */}
        <Box
          sx={{
            width: { xs: '100%', md: isSidebarOpen ? 360 : 0 },
            opacity: isSidebarOpen ? 1 : 0,
            maxHeight: { xs: isSidebarOpen ? '80vh' : 0, md: 'none' },
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            overflow: 'hidden',
            borderRight: { xs: 'none', md: isSidebarOpen ? '1px solid rgba(255,255,255,0.05)' : 'none' },
            position: 'relative',
            flexShrink: 0,
          }}
        >
          <Sidebar onOptimize={handleOptimize} isLoading={isLoading} error={error} />
          {/* Close button - positioned differently on mobile */}
          <Box
            onClick={toggleSidebar}
            sx={{
              position: 'absolute',
              top: { xs: 8, md: 16 },
              right: { xs: 8, md: 16 },
              cursor: 'pointer',
              color: 'text.secondary',
              zIndex: 10,
              bgcolor: 'rgba(0,0,0,0.3)',
              borderRadius: '50%',
              p: 0.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              '&:hover': { color: 'white', bgcolor: 'rgba(0,0,0,0.5)' }
            }}
          >
            <ChevronLeftIcon sx={{ transform: { xs: 'rotate(-90deg)', md: 'rotate(0deg)' } }} />
          </Box>
        </Box>


        <Box
          component="main"
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto',
            background: 'linear-gradient(180deg, rgba(10,14,23,1) 0%, rgba(17,24,39,1) 100%)',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              px: { xs: 3, md: 5 },
              pt: { xs: 4, md: 5 },
              pb: 3,
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              gap: 2
            }}
          >
            {!isSidebarOpen && (
              <Box
                onClick={toggleSidebar}
                sx={{
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40,
                  height: 40,
                  borderRadius: 1,
                  bgcolor: 'rgba(255,255,255,0.05)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                  mr: 1
                }}
              >
                <MenuIcon />
              </Box>
            )}

            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 1 }}>
                  Strategy Comparison
                </Typography>
                <Tooltip title="Documentation">
                  <IconButton
                    onClick={() => setIsDocsOpen(true)}
                    sx={{
                      color: 'text.secondary',
                      '&:hover': { color: '#A78BFA', bgcolor: 'rgba(167, 139, 250, 0.1)' }
                    }}
                  >
                    <HelpIcon />
                  </IconButton>
                </Tooltip>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                {/* ... rest of header ... */}
                <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                  Walk-Forward Analysis • HRP vs GMV vs MVO
                </Typography>
                {results && (
                  <>
                    <Chip
                      label={`Risk-Free: ${(results.risk_free_rate * 100).toFixed(2)}%`}
                      size="small"
                      sx={{ bgcolor: 'rgba(59,130,246,0.15)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.3)', backdropFilter: 'blur(5px)' }}
                    />
                    <Chip
                      label={`${results.data_start_date} → ${results.data_end_date}`}
                      size="small"
                      sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: 'text.secondary', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                    {/* Infer Market Mode from frequency (simple heuristic for UI) */}
                    {(() => {
                      // If we have > 1.2 years of day and > 300 points per year, it's crypto.
                      // Or simply use the rolling sharpe annualized factor logic implied or just visually show based on days
                      // Easier: data_end_date - data_start_date vs num points
                      const start = new Date(results.data_start_date);
                      const end = new Date(results.data_end_date);
                      const days = (end.getTime() - start.getTime()) / (1000 * 3600 * 24);
                      const points = results.methods[0]?.equity_curve?.length || 0;
                      const ratio = days > 0 ? points / days : 0;
                      const isCrypto = ratio > 0.9; // ~1.0 for crypto, ~0.68 for stocks (252/365)

                      return (
                        <Chip
                          icon={isCrypto ? <Box component="span" sx={{ fontSize: '1rem' }}>⚡</Box> : <Box component="span" sx={{ fontSize: '1rem' }}>🏛️</Box>}
                          label={isCrypto ? "Crypto Mode (365d)" : "Wall St Mode (252d)"}
                          size="small"
                          sx={{
                            bgcolor: isCrypto ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            color: isCrypto ? '#fbbf24' : '#34d399',
                            border: isCrypto ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                            fontWeight: 600
                          }}
                        />
                      );
                    })()}
                  </>
                )}
              </Box>

              {/* Navigation Tabs - Only show when results exist */}
              {results && (
                <Tabs
                  value={activeTab}
                  onChange={handleTabChange}
                  aria-label="dashboard tabs"
                  variant="scrollable"
                  scrollButtons="auto"
                  allowScrollButtonsMobile
                  sx={{
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    '& .MuiTabs-indicator': { backgroundColor: '#A78BFA', height: 3 },
                    '& .MuiTab-root': {
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: { xs: '0.8rem', md: '1rem' },
                      minWidth: { xs: 'auto', md: 90 },
                      px: { xs: 1.5, md: 2 },
                      mr: { xs: 0, md: 2 }
                    },
                    '& .MuiTabs-scrollButtons': {
                      color: 'text.secondary',
                      '&.Mui-disabled': { opacity: 0.3 }
                    }
                  }}
                >
                  <Tab icon={<Dashboard fontSize="small" />} iconPosition="start" label="Overview" />
                  <Tab icon={<ShowChart fontSize="small" />} iconPosition="start" label="Performance" />
                  <Tab icon={<Shield fontSize="small" />} iconPosition="start" label="Risk" />
                  <Tab icon={<PieChart fontSize="small" />} iconPosition="start" label="Allocations" />
                  <Tab icon={<Science fontSize="small" />} iconPosition="start" label="Analysis" />

                </Tabs>
              )}
            </Box>
          </Box>

          {/* Content */}
          <Box sx={{ flex: 1, px: { xs: 3, md: 5 }, py: 2 }}>

            {/* Empty State - Premium Animated */}
            {!isLoading && !results && !error && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '70vh',
                  gap: 4,
                  animation: 'fadeInUp 0.8s ease-out',
                  '@keyframes fadeInUp': {
                    from: { opacity: 0, transform: 'translateY(30px)' },
                    to: { opacity: 1, transform: 'translateY(0)' },
                  },
                }}
              >
                {/* Animated Floating Charts Illustration */}
                <Box sx={{ position: 'relative', width: 200, height: 200 }}>
                  {/* Central glow */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: 180,
                      height: 180,
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, rgba(167,139,250,0.2) 0%, transparent 70%)',
                      animation: 'glowPulse 3s ease-in-out infinite',
                      '@keyframes glowPulse': {
                        '0%, 100%': { opacity: 0.5, transform: 'translate(-50%, -50%) scale(1)' },
                        '50%': { opacity: 1, transform: 'translate(-50%, -50%) scale(1.1)' },
                      },
                    }}
                  />
                  {/* Floating chart icons */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: '10%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      animation: 'float1 4s ease-in-out infinite',
                      '@keyframes float1': {
                        '0%, 100%': { transform: 'translateX(-50%) translateY(0)' },
                        '50%': { transform: 'translateX(-50%) translateY(-15px)' },
                      },
                    }}
                  >
                    <ShowChart sx={{ fontSize: 48, color: '#00D4AA', filter: 'drop-shadow(0 0 10px rgba(0, 212, 170, 0.5))' }} />
                  </Box>
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: '15%',
                      left: '15%',
                      animation: 'float2 5s ease-in-out infinite 0.5s',
                      '@keyframes float2': {
                        '0%, 100%': { transform: 'translateY(0) rotate(-5deg)' },
                        '50%': { transform: 'translateY(-12px) rotate(5deg)' },
                      },
                    }}
                  >
                    <PieChart sx={{ fontSize: 40, color: '#FFE66D', filter: 'drop-shadow(0 0 10px rgba(255, 230, 109, 0.5))' }} />
                  </Box>
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: '15%',
                      right: '15%',
                      animation: 'float3 4.5s ease-in-out infinite 1s',
                      '@keyframes float3': {
                        '0%, 100%': { transform: 'translateY(0) rotate(5deg)' },
                        '50%': { transform: 'translateY(-10px) rotate(-5deg)' },
                      },
                    }}
                  >
                    <Shield sx={{ fontSize: 40, color: '#A78BFA', filter: 'drop-shadow(0 0 10px rgba(167, 139, 250, 0.5))' }} />
                  </Box>
                </Box>

                <Box sx={{ textAlign: 'center', maxWidth: 550 }}>
                  <Typography
                    variant="h3"
                    sx={{
                      fontWeight: 800,
                      mb: 2,
                      background: 'linear-gradient(135deg, #fff 0%, #A78BFA 50%, #00D4AA 100%)',
                      backgroundSize: '200% 200%',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      animation: 'gradientText 6s ease infinite',
                      '@keyframes gradientText': {
                        '0%': { backgroundPosition: '0% 50%' },
                        '50%': { backgroundPosition: '100% 50%' },
                        '100%': { backgroundPosition: '0% 50%' },
                      },
                    }}
                  >
                    Compare All Strategies
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8, mb: 3 }}>
                    Configure your portfolio in the sidebar and click{' '}
                    <Box
                      component="span"
                      sx={{
                        color: '#A78BFA',
                        fontWeight: 700,
                        px: 1,
                        py: 0.25,
                        bgcolor: 'rgba(167, 139, 250, 0.15)',
                        borderRadius: 1,
                      }}
                    >
                      Compare All Methods
                    </Box>{' '}
                    to analyze HRP, GMV, and MVO strategies.
                  </Typography>

                  {/* Feature highlights */}
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {['Walk-Forward Analysis', 'Risk Metrics', 'Efficient Frontier', 'Monthly Heatmap'].map((feature, i) => (
                      <Chip
                        key={feature}
                        label={feature}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: 'text.secondary',
                          animation: `fadeIn 0.5s ease-out ${0.2 + i * 0.1}s both`,
                          '@keyframes fadeIn': {
                            from: { opacity: 0, transform: 'scale(0.9)' },
                            to: { opacity: 1, transform: 'scale(1)' },
                          },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              </Box>
            )}

            {/* Results with Tabs */}
            {!isLoading && results && globalRanking && (
              <>
                {/* Optimization Warnings (Always visible at top of content if relevant) */}
                {(results.warnings && results.warnings.length > 0) ||
                  results.methods.some(m => m.current_allocation.constraints_clipped || m.current_allocation.fallback_used) ? (
                  <Box sx={{ mb: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {results.warnings?.map((warning, idx) => (
                      <Alert key={`warn-${idx}`} severity="warning" icon={<WarningIcon />}>
                        {warning}
                      </Alert>
                    ))}

                    {results.methods.filter(m => m.current_allocation.constraints_clipped).map(m => (
                      <Alert key={`clip-${m.method}`} severity="info" icon={<WarningIcon />}>
                        <AlertTitle>{m.method_name}: Weight Constraints Applied</AlertTitle>
                        HRP weights were clipped to meet your min / max constraints. This may affect the hierarchical risk parity properties.
                      </Alert>
                    ))}

                    {results.methods.filter(m => m.current_allocation.fallback_used).map(m => (
                      <Alert key={`fall-${m.method}`} severity="error" icon={<WarningIcon />}>
                        <AlertTitle>{m.method_name}: Optimization Failed</AlertTitle>
                        Fell back to Equal Weight. Reason: {m.current_allocation.fallback_reason || 'Unknown error'}
                      </Alert>
                    ))}
                  </Box>
                ) : null}

                {/* TAB 0: OVERVIEW */}
                <CustomTabPanel value={activeTab} index={0}>
                  <Suspense fallback={<SkeletonLoader height={400} />}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {/* Global Ranking Summary - Keep this eager if possible, but lazy load is fine */}
                      <Paper sx={{ p: 3, background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                          <TrophyIcon sx={{ color: '#fbbf24', fontSize: 32 }} />
                          <Typography variant="h5" sx={{ fontWeight: 700 }}>
                            🏆 Global Ranking
                          </Typography>
                          <Chip
                            label={`Based on ${globalRanking.totalMetrics} metrics`}
                            size="small"
                            sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}
                          />
                        </Box>

                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                          {globalRanking.ranking.map((r, idx) => {
                            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
                            const bgColor = idx === 0
                              ? 'rgba(255, 215, 0, 0.15)'
                              : idx === 1
                                ? 'rgba(192, 192, 192, 0.15)'
                                : 'rgba(205, 127, 50, 0.15)';
                            const borderColor = idx === 0
                              ? 'rgba(255, 215, 0, 0.4)'
                              : idx === 1
                                ? 'rgba(192, 192, 192, 0.4)'
                                : 'rgba(205, 127, 50, 0.4)';

                            return (
                              <Box
                                key={r.method.method}
                                sx={{
                                  flex: '1 1 200px',
                                  p: 2,
                                  bgcolor: bgColor,
                                  border: `1px solid ${borderColor}`,
                                  borderRadius: 2,
                                }}
                              >
                                <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                                  {medal} #{idx + 1} {r.method.method_name}
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                                  <strong>{r.wins}/{globalRanking.totalMetrics}</strong> metrics won
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                  {r.winningMetrics.map(m => (
                                    <Chip
                                      key={m}
                                      label={m}
                                      size="small"
                                      sx={{
                                        height: 20,
                                        fontSize: '0.65rem',
                                        bgcolor: 'rgba(16, 185, 129, 0.2)',
                                        color: '#10b981',
                                      }}
                                    />
                                  ))}
                                </Box>
                              </Box>
                            );
                          })}
                        </Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', mt: 2, display: 'block' }}>
                          Data: {results.data_start_date} to {results.data_end_date} • Risk-free rate: {(results.risk_free_rate * 100).toFixed(2)}% (13-week T-Bill)
                        </Typography>
                      </Paper>

                      {/* Quick Metrics Table */}
                      <Box>
                        <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Summary Metrics</Typography>
                        <ComparisonTable
                          methods={results.methods}
                          benchmarkMetrics={results.benchmark_metrics}
                          benchmarkName={results.benchmark_name || 'Equal Weight'}
                        />
                      </Box>

                      {/* Data Info Card */}
                      <DataInfoCard
                        tickerStartDates={results.ticker_start_dates || {}}
                        limitingTicker={results.limiting_ticker || null}
                        dataStartDate={results.data_start_date}
                        dataEndDate={results.data_end_date}
                      />


                    </Box>
                  </Suspense>
                </CustomTabPanel>

                {/* TAB 1: PERFORMANCE */}
                <CustomTabPanel value={activeTab} index={1}>
                  <Suspense fallback={<SkeletonLoader height={350} />}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <ComparisonChart
                        methods={results.methods}
                        benchmarkCurve={results.benchmark_curve}
                        benchmarkName={results.benchmark_name || 'Equal Weight'}
                      />
                      <DrawdownComparisonChart methods={results.methods} />

                    </Box>
                  </Suspense>
                </CustomTabPanel>

                {/* TAB 2: RISK & FRONTIER */}
                <CustomTabPanel value={activeTab} index={2}>
                  <ErrorBoundary>
                    <Suspense fallback={<SkeletonLoader height={400} />}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {results.efficient_frontier_data && (
                          <EfficientFrontierChart data={results} />
                        )}

                        <RiskContributionChart methods={results.methods} />

                        {results.correlation_matrix && (
                          <CorrelationHeatmap
                            data={results.correlation_matrix}
                            dendrogramData={results.methods.find(m => m.method === 'hrp' || m.method === 'nco')?.current_allocation.dendrogram_data}
                          />
                        )}
                      </Box>
                    </Suspense>
                  </ErrorBoundary>
                </CustomTabPanel>

                {/* TAB 3: ALLOCATIONS */}
                <CustomTabPanel value={activeTab} index={3}>
                  <Suspense fallback={<SkeletonLoader height={350} />}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <AllocationComparison
                        methods={results.methods}
                        date={results.data_end_date}
                      />

                      {/* HRP Dendrogram removed as NCO doesn't use it */}

                      <Typography variant="h5" sx={{ fontWeight: 700, mt: 2 }}>
                        Allocation Evolution
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {results.methods.map((m) => (
                          <AllocationHistoryChart
                            key={m.method}
                            allocationHistory={m.allocation_history}
                            tickers={results.tickers}
                            methodName={m.method_name}
                          />
                        ))}
                      </Box>
                    </Box>
                  </Suspense>
                </CustomTabPanel>

                {/* TAB 4: MODEL ANALYSIS */}
                <CustomTabPanel value={activeTab} index={4}>
                  <Suspense fallback={<SkeletonLoader height={300} />}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <ModelHealthCards methods={results.methods} />

                      <OverfittingTable methods={results.methods} />

                      {/* Monthly Returns Heatmap */}
                      <MonthlyReturnsHeatmap methods={results.methods} />

                      {/* Returns Distribution (Gaussian) */}
                      <ReturnsDistributionChart methods={results.methods} />

                      <OverfittingChart
                        datasets={results.methods.map(m => ({
                          name: m.method_name,
                          color: m.method === 'hrp' ? '#00D4AA' : m.method === 'gmv' ? '#FFE66D' : '#A78BFA',
                          data: m.overfitting_metrics || []
                        }))}
                      />
                    </Box>
                  </Suspense>
                </CustomTabPanel>



              </>
            )}
          </Box>
        </Box>
      </Box>

      {/* Documentation Drawer */}
      <Suspense fallback={null}>
        <DocumentationPage open={isDocsOpen} onClose={() => setIsDocsOpen(false)} />
      </Suspense>
    </ThemeProvider >
  );
}

export default App;

