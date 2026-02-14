import React, { useState, lazy, Suspense, useEffect } from 'react';
import { Box, Tabs, Tab, Alert, AlertTitle, Paper, Typography } from '@mui/material';
import { Dashboard as DashboardIcon, ShowChart, Shield, PieChart, Science, EmojiEvents as TrophyIcon, Warning as WarningIcon } from '@mui/icons-material';
import {
    DataInfoCard,
    ComparisonTable,
    SkeletonLoader,
    ErrorBoundary,
    WelcomeScreen,
} from '../components';

// Lazy load charts
const AllocationComparison = lazy(() => import('../components/AllocationComparison'));
const ComparisonChart = lazy(() => import('../components/ComparisonChart'));
const DrawdownComparisonChart = lazy(() => import('../components/DrawdownComparisonChart'));
const AllocationHistoryChart = lazy(() => import('../components/AllocationHistoryChart'));
const EfficientFrontierChart = lazy(() => import('../components/EfficientFrontierChart'));
const RiskContributionChart = lazy(() => import('../components/RiskContributionChart'));
const CorrelationHeatmap = lazy(() => import('../components/CorrelationHeatmap'));
const ReturnsDistributionChart = lazy(() => import('../components/ReturnsDistributionChart'));
const ModelHealthCards = lazy(() => import('../components/ModelHealthCards'));
const OverfittingChart = lazy(() => import('../components/OverfittingChart'));
const OverfittingTable = lazy(() => import('../components/OverfittingTable'));
const PerformanceHistogram = lazy(() => import('../components/PerformanceHistogram'));
const RebalancerCard = lazy(() => import('../components/RebalancerCard'));

interface DashboardProps {
    results: any;
    globalRanking: any;
    lastRebalancingWindow: number;
}

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function CustomTabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    const isActive = value === index;
    const [hasBeenActive, setHasBeenActive] = useState(false);

    useEffect(() => {
        if (isActive && !hasBeenActive) {
            setHasBeenActive(true);
        }
    }, [isActive, hasBeenActive]);

    if (!hasBeenActive && !isActive) return null;

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
            <Box sx={{ py: 3 }}>
                {children}
            </Box>
        </div>
    );
}

export const Dashboard: React.FC<DashboardProps> = ({ results, globalRanking }) => {
    const [activeTab, setActiveTab] = useState(0);

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
    };

    if (!results) {
        // Empty State
        return <WelcomeScreen />;
    }

    return (
        <Box>
            {/* Tabs */}
            <Tabs
                value={activeTab}
                onChange={handleTabChange}
                aria-label="dashboard tabs"
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    mb: 2,
                    '& .MuiTabs-indicator': { backgroundColor: '#A78BFA', height: 3 },
                    '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minWidth: 90 }
                }}
            >
                <Tab icon={<DashboardIcon fontSize="small" />} iconPosition="start" label="Overview" />
                <Tab icon={<ShowChart fontSize="small" />} iconPosition="start" label="Performance" />
                <Tab icon={<Shield fontSize="small" />} iconPosition="start" label="Risk" />
                <Tab icon={<PieChart fontSize="small" />} iconPosition="start" label="Allocations" />
                <Tab icon={<Science fontSize="small" />} iconPosition="start" label="Analysis" />
            </Tabs>

            {/* Warnings */}
            {(results.warnings?.length > 0 || results.methods.some((m: any) => m.current_allocation.constraints_clipped || m.current_allocation.fallback_used)) && (
                <Box sx={{ mb: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {results.warnings?.map((warning: string, idx: number) => (
                        <Alert key={`warn-${idx}`} severity="warning" icon={<WarningIcon />}>{warning}</Alert>
                    ))}
                    {results.methods.filter((m: any) => m.current_allocation.constraints_clipped).map((m: any) => (
                        <Alert key={`clip-${m.method}`} severity="info" icon={<WarningIcon />}>
                            <AlertTitle>{m.method_name}: Weight Constraints Applied</AlertTitle>
                            HRP weights were clipped to meet your min / max constraints.
                        </Alert>
                    ))}
                </Box>
            )}

            {/* TAB 0: OVERVIEW */}
            <CustomTabPanel value={activeTab} index={0}>
                <Suspense fallback={<SkeletonLoader height={400} />}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {/* Global Ranking Summary */}
                        {globalRanking && (
                            <Paper sx={{ p: 3, background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                                    <TrophyIcon sx={{ color: '#fbbf24', fontSize: 32 }} />
                                    <Typography variant="h5" sx={{ fontWeight: 700 }}>🏆 Global Ranking</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                                    {globalRanking.ranking.map((r: any, idx: number) => (
                                        <Box key={r.method.method} sx={{ flex: '1 1 200px', p: 2, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
                                            <Typography variant="h6">#{idx + 1} {r.method.method_name}</Typography>
                                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>{r.wins}/{globalRanking.totalMetrics} metrics won</Typography>
                                        </Box>
                                    ))}
                                </Box>
                            </Paper>
                        )}

                        <ComparisonTable methods={results.methods} benchmarkMetrics={results.benchmark_metrics} benchmarkName={results.benchmark_name} />
                        <DataInfoCard tickerStartDates={results.ticker_start_dates} limitingTicker={results.limiting_ticker} dataStartDate={results.data_start_date} dataEndDate={results.data_end_date} />
                    </Box>
                </Suspense>
            </CustomTabPanel>

            {/* TAB 1: PERFORMANCE */}
            <CustomTabPanel value={activeTab} index={1}>
                <Suspense fallback={<SkeletonLoader height={350} />}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <ComparisonChart methods={results.methods} benchmarkCurve={results.benchmark_curve} benchmarkName={results.benchmark_name} />
                        <DrawdownComparisonChart methods={results.methods} />
                        <PerformanceHistogram methods={results.methods} />
                        <ReturnsDistributionChart methods={results.methods} />
                    </Box>
                </Suspense>
            </CustomTabPanel>

            {/* TAB 2: RISK */}
            <CustomTabPanel value={activeTab} index={2}>
                <ErrorBoundary>
                    <Suspense fallback={<SkeletonLoader height={400} />}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {results.efficient_frontier_data && <EfficientFrontierChart data={results} />}
                            <RiskContributionChart methods={results.methods} />
                            {results.correlation_matrix && <CorrelationHeatmap data={results.correlation_matrix} dendrogramData={results.methods.find((m: any) => m.method === 'hrp')?.current_allocation.dendrogram_data} />}
                        </Box>
                    </Suspense>
                </ErrorBoundary>
            </CustomTabPanel>

            {/* TAB 3: ALLOCATIONS */}
            <CustomTabPanel value={activeTab} index={3}>
                <Suspense fallback={<SkeletonLoader height={350} />}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <AllocationComparison methods={results.methods} date={results.data_end_date} />
                        <Typography variant="h5" sx={{ fontWeight: 700, mt: 2 }}>Allocation Evolution</Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {results.methods.map((m: any) => (
                                <AllocationHistoryChart key={m.method} allocationHistory={m.allocation_history} tickers={results.tickers} methodName={m.method_name} />
                            ))}
                        </Box>
                        <RebalancerCard methods={results.methods} tickers={results.tickers} />
                    </Box>
                </Suspense>
            </CustomTabPanel>

            {/* TAB 4: ANALYSIS */}
            <CustomTabPanel value={activeTab} index={4}>
                <Suspense fallback={<SkeletonLoader height={300} />}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <ModelHealthCards methods={results.methods} />
                        <OverfittingTable methods={results.methods} />
                        <OverfittingChart datasets={results.methods.map((m: any) => ({ name: m.method_name, color: m.method === 'hrp' ? '#00D4AA' : m.method === 'gmv' ? '#FFE66D' : '#A78BFA', data: m.overfitting_metrics || [] }))} />
                    </Box>
                </Suspense>
            </CustomTabPanel>
        </Box>
    );
};
