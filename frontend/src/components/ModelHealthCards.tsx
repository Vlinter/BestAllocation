import React from 'react';
import {
    Paper,
    Typography,
    Box,
    LinearProgress,
} from '@mui/material';
import {
    HealthAndSafety as HealthIcon,
    CheckCircle,
    Warning as WarningIcon,
    Error as ErrorIcon,
    InfoOutlined
} from '@mui/icons-material';
import type { MethodResult } from '../api/client';

// Reuse logic from OverfittingTable but don't export/import it to avoid tangled deps.
// Copied "calculateStats" logic simplified for visual cards.

const calculateReliability = (method: MethodResult) => {
    const data = method.overfitting_metrics || [];
    if (data.length === 0) return null;

    const n = data.length;
    const realized = data.map(d => d.realized_sharpe);
    const predicted = data.map(d => d.predicted_sharpe);
    const differences = data.map(d => d.realized_sharpe - d.predicted_sharpe);

    // 1. Success Rate
    const successCount = data.filter(d => d.realized_sharpe >= d.predicted_sharpe).length;
    const successRate = (successCount / n) * 100;

    // 2. Avg Diff & Std Deviation
    const avgRealized = realized.reduce((a, b) => a + b, 0) / n;
    const avgPredicted = predicted.reduce((a, b) => a + b, 0) / n;
    const avgDiff = avgRealized - avgPredicted;

    const meanDiff = differences.reduce((a, b) => a + b, 0) / n;
    const stdDiff = Math.sqrt(differences.reduce((acc, d) => acc + Math.pow(d - meanDiff, 2), 0) / n);

    // 3. Correlation
    let numerator = 0, denomP = 0, denomR = 0;
    for (let i = 0; i < n; i++) {
        const dp = predicted[i] - avgPredicted;
        const dr = realized[i] - avgRealized;
        numerator += dp * dr;
        denomP += dp * dp;
        denomR += dr * dr;
    }
    const correlation = (denomP > 0 && denomR > 0)
        ? numerator / Math.sqrt(denomP * denomR)
        : 0;

    // 4. Overfit Ratio (Realized < 50% Predicted)
    const severeOverfitCount = data.filter(d => d.predicted_sharpe > 0 && d.realized_sharpe < d.predicted_sharpe * 0.5).length;
    const overfitRatio = (severeOverfitCount / n) * 100;

    // 5. Consistency
    const positiveRealizedCount = realized.filter(r => r > 0).length;
    const consistencyScore = (positiveRealizedCount / n) * 100;

    // 6. Degradation
    const degradations = data
        .filter(d => d.predicted_sharpe > 0)
        .map(d => ((d.predicted_sharpe - d.realized_sharpe) / d.predicted_sharpe) * 100);
    const degradationPct = degradations.length > 0
        ? degradations.reduce((a, b) => a + b, 0) / degradations.length
        : 0;

    // Reliability Score (Exact Formula from OverfittingTable)
    const successScore = Math.min(successRate, 100) * 0.20;
    const diffScore = Math.min(Math.max((avgDiff + 2) / 4, 0), 1) * 100 * 0.15;
    const stabilityScore = Math.max(0, 100 - stdDiff * 20) * 0.15;
    const corrScore = Math.min(Math.max((correlation + 1) / 2, 0), 1) * 100 * 0.15;
    const consistScore = consistencyScore * 0.15;
    const overfitPenalty = Math.max(0, 100 - overfitRatio * 2) * 0.10;
    const degradePenalty = Math.max(0, 100 - Math.abs(degradationPct)) * 0.10;

    const score = successScore + diffScore + stabilityScore + corrScore + consistScore + overfitPenalty + degradePenalty;

    return {
        score,
        successRate,
        avgDiff,
        isReliable: score >= 65,
        label: score >= 65 ? 'Reliable' : score >= 45 ? 'Mixed' : 'Potentially Overfit'
    };
};

const Gauge = ({ value, color }: { value: number, color: string }) => (
    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <svg width="80" height="80" viewBox="0 0 36 36">
            <path
                d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="3"
            />
            <path
                d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke={color}
                strokeWidth="3"
                strokeDasharray={`${value}, 100`}
                className="circular-chart"
                style={{ transition: 'stroke-dasharray 1s ease 0.5s' }}
            />
        </svg>
        <Box
            sx={{
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                position: 'absolute',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <Typography variant="caption" component="div" sx={{ fontWeight: 800, fontSize: '0.9rem', color: '#fff' }}>
                {Math.round(value)}
            </Typography>
        </Box>
    </Box>
);

interface ModelHealthCardsProps {
    methods: MethodResult[];
}

const METHOD_COLORS: Record<string, string> = {
    nco: '#00D4AA',
    gmv: '#FFE66D',
    mdr: '#A78BFA',
};

const ModelHealthCards: React.FC<ModelHealthCardsProps> = ({ methods }) => {
    return (
        <React.Fragment>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(236, 72, 153, 0.15)', color: '#EC4899' }}>
                    <HealthIcon fontSize="small" />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Model Health & Reliability
                </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {methods.map((method) => {
                    const stats = calculateReliability(method);
                    if (!stats) return null;

                    const color = METHOD_COLORS[method.method] || '#ccc';
                    const statusColor = stats.score >= 65 ? '#10B981' : stats.score >= 45 ? '#F59E0B' : '#EF4444';
                    const StatusIcon = stats.score >= 65 ? CheckCircle : stats.score >= 45 ? WarningIcon : ErrorIcon;


                    return (
                        <Box key={method.method} sx={{ flex: { xs: '1 1 100%', md: '1 1 300px' }, maxWidth: { md: '33.333%' } }}>
                            <Paper
                                sx={{
                                    p: 3,
                                    height: '100%',
                                    background: 'linear-gradient(180deg, rgba(23, 23, 23, 0.8) 0%, rgba(23, 23, 23, 0.4) 100%)',
                                    border: `1px solid ${color}30`,
                                    borderRadius: 3,
                                    position: 'relative',
                                    overflow: 'hidden',
                                    '&:hover': {
                                        borderColor: color,
                                        transform: 'translateY(-2px)',
                                        transition: 'all 0.3s ease'
                                    }
                                }}
                            >
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                                    <Box>
                                        <Typography variant="h6" sx={{ fontWeight: 800, color: color }}>
                                            {method.method_name}
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                            <StatusIcon sx={{ fontSize: 16, color: statusColor }} />
                                            <Typography variant="subtitle2" sx={{ color: statusColor, fontWeight: 700 }}>
                                                {stats.label}
                                            </Typography>
                                        </Box>
                                    </Box>
                                    <Gauge value={stats.score} color={statusColor} />
                                </Box>

                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Success Rate</Typography>
                                            <Typography variant="caption" sx={{ fontWeight: 700 }}>{stats.successRate.toFixed(0)}%</Typography>
                                        </Box>
                                        <LinearProgress
                                            variant="determinate"
                                            value={stats.successRate}
                                            sx={{
                                                height: 6,
                                                borderRadius: 3,
                                                bgcolor: 'rgba(255,255,255,0.05)',
                                                '& .MuiLinearProgress-bar': { bgcolor: color }
                                            }}
                                        />
                                    </Box>

                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <InfoOutlined sx={{ fontSize: 16, color: '#666' }} />
                                            <Typography variant="caption" sx={{ color: '#aaa' }}>Avg Bias</Typography>
                                        </Box>
                                        <Typography variant="body2" sx={{ fontWeight: 700, color: stats.avgDiff >= 0 ? '#10B981' : '#F59E0B' }}>
                                            {stats.avgDiff >= 0 ? '+' : ''}{stats.avgDiff.toFixed(2)}
                                        </Typography>
                                    </Box>


                                </Box>

                                {stats.score < 40 && (
                                    <Box sx={{ mt: 2, p: 1, bgcolor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 1 }}>
                                        <Typography variant="caption" sx={{ color: '#EF4444', display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <WarningIcon fontSize="inherit" /> High overfitting risk
                                        </Typography>
                                    </Box>
                                )}
                            </Paper>
                        </Box>
                    );
                })}
            </Box>


        </React.Fragment>
    );
};

export default ModelHealthCards;
