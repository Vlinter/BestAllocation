import React, { useMemo } from 'react';
import { Paper, Typography, Box, Chip } from '@mui/material';
import { WarningAmber } from '@mui/icons-material';
import type { MethodResult, StressTestResult } from '../api/client';
import { STRATEGY_COLORS as METHOD_COLORS } from '../theme/strategies';

interface StressTestCardProps {
    methods: MethodResult[];
    benchmarkName?: string;
    /** Same windows on the benchmark curve: "-35% in 2008" means nothing alone. */
    benchmarkStressTests?: StressTestResult[];
}

const BENCHMARK_KEY = '__benchmark__';

// Display decoration only — the numbers come from the backend, which computes
// them on the FULL-resolution equity curve. Never recompute them here from
// m.equity_curve: that curve is downsampled to ~500 points for display, which
// understates intra-crisis drawdowns and misses short windows entirely.
const SCENARIO_EMOJIS: Record<string, string> = {
    'COVID Crash': '🦠',
    'GFC 2008': '🏦',
    'Taper Tantrum': '📉',
    'China Deval 2015': '🇨🇳',
    'Q4 2018': '📊',
    '2022 Rate Hikes': '🏛️',
};

const StressTestCard: React.FC<StressTestCardProps> = ({ methods, benchmarkName, benchmarkStressTests }) => {
    const hasBenchmark = (benchmarkStressTests?.length ?? 0) > 0;

    const stressResults = useMemo(() => {
        if (!methods.length) return [];

        // Collect the scenario list from the first method that has results
        const reference = methods.find(m => (m.stress_tests?.length ?? 0) > 0);
        if (!reference?.stress_tests) return [];

        return reference.stress_tests.map(sc => {
            const methodResults: Record<string, { return: number; maxDrawdown: number; available: boolean }> = {};

            methods.forEach(m => {
                const entry = m.stress_tests?.find(s => s.name === sc.name);
                methodResults[m.method] = entry
                    ? { return: entry.return, maxDrawdown: entry.max_drawdown, available: entry.available }
                    : { return: 0, maxDrawdown: 0, available: false };
            });

            const benchEntry = benchmarkStressTests?.find(s => s.name === sc.name);
            methodResults[BENCHMARK_KEY] = benchEntry
                ? { return: benchEntry.return, maxDrawdown: benchEntry.max_drawdown, available: benchEntry.available }
                : { return: 0, maxDrawdown: 0, available: false };

            return {
                scenario: {
                    name: sc.name,
                    emoji: SCENARIO_EMOJIS[sc.name] ?? '📉',
                    startDate: sc.start,
                    endDate: sc.end,
                    description: sc.description,
                },
                methodResults,
            };
        }).filter(r => {
            // Only show scenarios where at least one method has data
            return Object.values(r.methodResults).some(mr => mr.available);
        });
    }, [methods, benchmarkStressTests]);

    if (!stressResults.length) return null;

    return (
        <Paper
            sx={{
                p: 3,
                background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.9) 0%, rgba(15, 23, 42, 0.6) 100%)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.08)',
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <Box sx={{
                    p: 1.5,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.1))',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                }}>
                    <WarningAmber sx={{ fontSize: 28, color: '#EF4444' }} />
                </Box>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                        Historical Stress Tests
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                        Portfolio performance during major market crises
                    </Typography>
                </Box>
            </Box>

            <Box sx={{ overflowX: 'auto', mt: 2 }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', fontWeight: 600 }}>
                                SCENARIO
                            </th>
                            {methods.map(m => (
                                <th key={m.method} style={{ textAlign: 'center', padding: '8px 12px', color: METHOD_COLORS[m.method] || '#888', fontSize: '0.75rem', fontWeight: 700 }}>
                                    {m.method.toUpperCase()}
                                </th>
                            ))}
                            {hasBenchmark && (
                                <th style={{ textAlign: 'center', padding: '8px 12px', color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', fontWeight: 700 }}>
                                    {benchmarkName ?? 'Benchmark'}
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {stressResults.map(({ scenario, methodResults }) => (
                            <tr key={scenario.name} style={{ background: 'rgba(255,255,255,0.03)' }}>
                                <td style={{ padding: '10px 12px', borderRadius: '8px 0 0 8px' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                            {scenario.emoji} {scenario.name}
                                        </Typography>
                                    </Box>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem' }}>
                                        {scenario.startDate} → {scenario.endDate}
                                    </Typography>
                                </td>
                                {[...methods.map(m => m.method), ...(hasBenchmark ? [BENCHMARK_KEY] : [])].map((key, idx, all) => {
                                    const result = methodResults[key];
                                    const isLast = idx === all.length - 1;
                                    const isBenchmark = key === BENCHMARK_KEY;
                                    return (
                                        <td key={key} style={{ textAlign: 'center', padding: '10px 8px', borderRadius: isLast ? '0 8px 8px 0' : undefined }}>
                                            {result?.available ? (
                                                <Box sx={{ opacity: isBenchmark ? 0.75 : 1 }}>
                                                    <Typography variant="body2" sx={{
                                                        fontWeight: isBenchmark ? 600 : 700,
                                                        fontFamily: 'monospace',
                                                        color: result.return >= 0 ? '#10B981' : '#EF4444',
                                                    }}>
                                                        {result.return >= 0 ? '+' : ''}{(result.return * 100).toFixed(1)}%
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.6rem' }}>
                                                        DD: {(result.maxDrawdown * 100).toFixed(1)}%
                                                    </Typography>
                                                </Box>
                                            ) : (
                                                <Chip label="N/A" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem' }} />
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Box>
        </Paper>
    );
};

export default StressTestCard;
