import React, { useMemo } from 'react';
import { Paper, Typography, Box, Chip } from '@mui/material';
import { WarningAmber } from '@mui/icons-material';
import type { MethodResult } from '../api/client';

interface StressTestCardProps {
    methods: MethodResult[];
}

interface StressScenario {
    name: string;
    emoji: string;
    startDate: string; // ISO date
    endDate: string;
    description: string;
}

const STRESS_SCENARIOS: StressScenario[] = [
    { name: 'COVID Crash', emoji: '🦠', startDate: '2020-02-19', endDate: '2020-03-23', description: 'Pandemic market selloff' },
    { name: 'GFC 2008', emoji: '🏦', startDate: '2008-09-15', endDate: '2009-03-09', description: 'Global Financial Crisis' },
    { name: 'Taper Tantrum', emoji: '📉', startDate: '2013-05-22', endDate: '2013-09-05', description: 'Fed tapering shock' },
    { name: 'China Deval 2015', emoji: '🇨🇳', startDate: '2015-08-10', endDate: '2015-08-25', description: 'Yuan devaluation selloff' },
    { name: 'Q4 2018', emoji: '📊', startDate: '2018-10-01', endDate: '2018-12-24', description: 'Fed tightening selloff' },
    { name: '2022 Rate Hikes', emoji: '🏛️', startDate: '2022-01-03', endDate: '2022-10-12', description: 'Aggressive Fed rate hiking' },
];

const METHOD_COLORS: Record<string, string> = {
    hrp: '#00D4AA',
    gmv: '#FFE66D',
    mvo: '#A78BFA',
    risk_parity: '#F472B6',
};

const StressTestCard: React.FC<StressTestCardProps> = ({ methods }) => {
    const stressResults = useMemo(() => {
        if (!methods.length) return [];

        return STRESS_SCENARIOS.map(scenario => {
            const startTs = new Date(scenario.startDate).getTime();
            const endTs = new Date(scenario.endDate).getTime();

            const methodResults: Record<string, { return: number; maxDrawdown: number; available: boolean }> = {};

            methods.forEach(m => {
                // Find equity curve points within the scenario window
                const periodPoints = m.equity_curve.filter(p => p.date >= startTs && p.date <= endTs);

                if (periodPoints.length < 2) {
                    methodResults[m.method] = { return: 0, maxDrawdown: 0, available: false };
                    return;
                }

                const startVal = periodPoints[0].value;
                const endVal = periodPoints[periodPoints.length - 1].value;
                const periodReturn = (endVal - startVal) / startVal;

                // Max drawdown during the period
                let peak = periodPoints[0].value;
                let maxDD = 0;
                for (const p of periodPoints) {
                    if (p.value > peak) peak = p.value;
                    const dd = (p.value - peak) / peak;
                    if (dd < maxDD) maxDD = dd;
                }

                methodResults[m.method] = {
                    return: periodReturn,
                    maxDrawdown: Math.abs(maxDD),
                    available: true,
                };
            });

            return { scenario, methodResults };
        }).filter(r => {
            // Only show scenarios where at least one method has data
            return Object.values(r.methodResults).some(mr => mr.available);
        });
    }, [methods]);

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
                                {methods.map((m, idx) => {
                                    const result = methodResults[m.method];
                                    const isLast = idx === methods.length - 1;
                                    return (
                                        <td key={m.method} style={{ textAlign: 'center', padding: '10px 8px', borderRadius: isLast ? '0 8px 8px 0' : undefined }}>
                                            {result.available ? (
                                                <Box>
                                                    <Typography variant="body2" sx={{
                                                        fontWeight: 700,
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
