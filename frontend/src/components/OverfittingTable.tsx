import {
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Box,
    Chip,
    Tooltip,
} from '@mui/material';
import { Analytics as AnalyticsIcon } from '@mui/icons-material';
import type { MethodResult } from '../api/client';

interface OverfittingTableProps {
    methods: MethodResult[];
}

interface OverfittingStats {
    method: string;
    methodName: string;
    count: number;
    // Core metrics
    successRate: number;           // % où réalisé >= prédit
    avgDifference: number;         // Moyenne réalisé - prédit
    correlation: number;           // Corrélation prédit/réalisé
    avgPredicted: number;
    avgRealized: number;
    // New metrics
    medianDifference: number;      // Médiane des différences
    stdDifference: number;         // Stabilité (écart-type des différences)
    overfitRatio: number;          // % où réalisé < prédit * 0.5 (forte déception)
    worstCaseRatio: number;        // Pire ratio réalisé/prédit
    bestCaseRatio: number;         // Meilleur ratio réalisé/prédit
    consistencyScore: number;      // % de périodes avec Sharpe réalisé > 0
    degradationPct: number;        // % de dégradation moyenne (prédit - réalisé) / prédit
    reliabilityScore: number;      // Score global 0-100
}

interface MetricConfig {
    label: string;
    key: keyof Omit<OverfittingStats, 'method' | 'methodName' | 'count'>;
    format: (value: number) => string;
    higherIsBetter: boolean;
    tooltip: string;
}

const metricsConfig: MetricConfig[] = [
    {
        label: 'Success Rate',
        key: 'successRate',
        format: (v) => `${v.toFixed(1)}%`,
        higherIsBetter: true,
        tooltip: '% of periods where Realized ≥ Predicted Sharpe (higher = model meets expectations)'
    },
    {
        label: 'Avg Δ Sharpe',
        key: 'avgDifference',
        format: (v) => v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2),
        higherIsBetter: true,
        tooltip: 'Average (Realized - Predicted). Positive = model underestimates (conservative, good!)'
    },
    {
        label: 'Median Δ Sharpe',
        key: 'medianDifference',
        format: (v) => v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2),
        higherIsBetter: true,
        tooltip: 'Median difference (more robust to outliers than average)'
    },
    {
        label: 'Stability (σ)',
        key: 'stdDifference',
        format: (v) => v.toFixed(2),
        higherIsBetter: false,
        tooltip: 'Std deviation of differences. Lower = more consistent predictions'
    },
    {
        label: 'Correlation',
        key: 'correlation',
        format: (v) => v.toFixed(2),
        higherIsBetter: true,
        tooltip: 'Correlation between predicted and realized. Higher = more predictable'
    },
    {
        label: 'Consistency',
        key: 'consistencyScore',
        format: (v) => `${v.toFixed(1)}%`,
        higherIsBetter: true,
        tooltip: '% of periods with positive realized Sharpe (model works often)'
    },
    {
        label: 'Severe Overfit Rate',
        key: 'overfitRatio',
        format: (v) => `${v.toFixed(1)}%`,
        higherIsBetter: false,
        tooltip: '% of periods where Realized < 50% of Predicted (model fails badly)'
    },
    {
        label: 'Degradation',
        key: 'degradationPct',
        format: (v) => `${v.toFixed(1)}%`,
        higherIsBetter: false,
        tooltip: 'Avg % loss from predicted to realized. Lower = predictions hold up'
    },
    {
        label: 'Worst Case',
        key: 'worstCaseRatio',
        format: (v) => `${v.toFixed(1)}x`,
        higherIsBetter: true,
        tooltip: 'Worst realized/predicted ratio. Higher (closer to 1) = less bad surprises'
    },
    {
        label: 'Best Case',
        key: 'bestCaseRatio',
        format: (v) => `${v.toFixed(1)}x`,
        higherIsBetter: true,
        tooltip: 'Best realized/predicted ratio. Shows upside potential'
    },
    {
        label: 'Avg Predicted',
        key: 'avgPredicted',
        format: (v) => v.toFixed(2),
        higherIsBetter: true,
        tooltip: 'Average in-sample Sharpe (what model expects)'
    },
    {
        label: 'Avg Realized',
        key: 'avgRealized',
        format: (v) => v.toFixed(2),
        higherIsBetter: true,
        tooltip: 'Average out-of-sample Sharpe (what actually happened)'
    },
    {
        label: 'Reliability Score',
        key: 'reliabilityScore',
        format: (v) => `${v.toFixed(0)}/100`,
        higherIsBetter: true,
        tooltip: `Composite score: 20% Success Rate + 15% Avg Δ + 15% Stability + 15% Correlation + 15% Consistency + 10% Overfit Penalty + 10% Degradation Penalty. Score ≥65 = Reliable, 45-65 = Mixed, <45 = Overfitting`
    },
];

const METHOD_COLORS: Record<string, string> = {
    hrp: '#00D4AA',
    gmv: '#FFE66D',
    mvo: '#A78BFA',
};

const calculateStats = (method: MethodResult): OverfittingStats | null => {
    const data = method.overfitting_metrics || [];

    if (data.length === 0) return null;

    const n = data.length;
    const predicted = data.map(d => d.predicted_sharpe);
    const realized = data.map(d => d.realized_sharpe);
    const differences = data.map(d => d.realized_sharpe - d.predicted_sharpe);

    // Sort differences for median
    const sortedDiff = [...differences].sort((a, b) => a - b);
    const medianDifference = n % 2 === 0
        ? (sortedDiff[n / 2 - 1] + sortedDiff[n / 2]) / 2
        : sortedDiff[Math.floor(n / 2)];

    // Success Rate (realized >= predicted)
    const successCount = data.filter(d => d.realized_sharpe >= d.predicted_sharpe).length;
    const successRate = (successCount / n) * 100;

    // Averages
    const avgPredicted = predicted.reduce((a, b) => a + b, 0) / n;
    const avgRealized = realized.reduce((a, b) => a + b, 0) / n;
    const avgDifference = avgRealized - avgPredicted;

    // Standard deviation of differences
    const meanDiff = differences.reduce((a, b) => a + b, 0) / n;
    const stdDifference = Math.sqrt(differences.reduce((acc, d) => acc + Math.pow(d - meanDiff, 2), 0) / n);

    // Pearson Correlation
    const meanP = avgPredicted;
    const meanR = avgRealized;
    let numerator = 0, denomP = 0, denomR = 0;
    for (let i = 0; i < n; i++) {
        const dp = predicted[i] - meanP;
        const dr = realized[i] - meanR;
        numerator += dp * dr;
        denomP += dp * dp;
        denomR += dr * dr;
    }
    const correlation = (denomP > 0 && denomR > 0)
        ? numerator / Math.sqrt(denomP * denomR)
        : 0;

    // Severe overfit ratio (realized < 50% of predicted)
    const severeOverfitCount = data.filter(d => d.predicted_sharpe > 0 && d.realized_sharpe < d.predicted_sharpe * 0.5).length;
    const overfitRatio = (severeOverfitCount / n) * 100;

    // Ratios (for cases where predicted > 0)
    const validRatios = data
        .filter(d => d.predicted_sharpe > 0.1)
        .map(d => d.realized_sharpe / d.predicted_sharpe);

    const worstCaseRatio = validRatios.length > 0 ? Math.min(...validRatios) : 0;
    const bestCaseRatio = validRatios.length > 0 ? Math.max(...validRatios) : 0;

    // Consistency: % with positive realized Sharpe
    const positiveRealizedCount = realized.filter(r => r > 0).length;
    const consistencyScore = (positiveRealizedCount / n) * 100;

    // Degradation %
    const degradations = data
        .filter(d => d.predicted_sharpe > 0)
        .map(d => ((d.predicted_sharpe - d.realized_sharpe) / d.predicted_sharpe) * 100);
    const degradationPct = degradations.length > 0
        ? degradations.reduce((a, b) => a + b, 0) / degradations.length
        : 0;

    // Reliability Score (0-100) - improved formula
    const successScore = Math.min(successRate, 100) * 0.20;
    const diffScore = Math.min(Math.max((avgDifference + 2) / 4, 0), 1) * 100 * 0.15;
    const stabilityScore = Math.max(0, 100 - stdDifference * 20) * 0.15;
    const corrScore = Math.min(Math.max((correlation + 1) / 2, 0), 1) * 100 * 0.15;
    const consistScore = consistencyScore * 0.15;
    const overfitPenalty = Math.max(0, 100 - overfitRatio * 2) * 0.10;
    const degradePenalty = Math.max(0, 100 - Math.abs(degradationPct)) * 0.10;
    const reliabilityScore = successScore + diffScore + stabilityScore + corrScore + consistScore + overfitPenalty + degradePenalty;

    return {
        method: method.method,
        methodName: method.method_name,
        count: n,
        successRate,
        avgDifference,
        medianDifference,
        stdDifference,
        correlation,
        avgPredicted,
        avgRealized,
        overfitRatio,
        worstCaseRatio,
        bestCaseRatio,
        consistencyScore,
        degradationPct,
        reliabilityScore
    };
};

const OverfittingTable: React.FC<OverfittingTableProps> = ({ methods }) => {
    const stats = methods
        .map(calculateStats)
        .filter((s): s is OverfittingStats => s !== null);

    if (stats.length === 0) {
        return null;
    }

    const getBestMethod = (key: keyof Omit<OverfittingStats, 'method' | 'methodName' | 'count'>, higherIsBetter: boolean): string => {
        let bestMethod = '';
        let bestValue = higherIsBetter ? -Infinity : Infinity;

        stats.forEach((s) => {
            const value = s[key] as number;
            if (higherIsBetter ? value > bestValue : value < bestValue) {
                bestValue = value;
                bestMethod = s.method;
            }
        });

        return bestMethod;
    };

    // Count wins per method
    const winsPerMethod: Record<string, number> = {};
    stats.forEach(s => { winsPerMethod[s.method] = 0; });
    metricsConfig.forEach(metric => {
        const best = getBestMethod(metric.key, metric.higherIsBetter);
        if (best) winsPerMethod[best]++;
    });

    const getVerdict = (s: OverfittingStats): { text: string; color: string } => {
        if (s.reliabilityScore >= 65) return { text: '✅ Reliable', color: '#10b981' };
        if (s.reliabilityScore >= 45) return { text: '⚠️ Mixed', color: '#f59e0b' };
        return { text: '❌ Overfitting', color: '#ef4444' };
    };

    return (
        <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <AnalyticsIcon sx={{ color: 'primary.main', fontSize: 28 }} />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    Model Reliability Analysis
                </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                Comparing In-Sample (training) vs Out-of-Sample (test) to detect overfitting. Hover metrics for details.
            </Typography>

            <TableContainer>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Metric</TableCell>
                            {stats.map((s) => (
                                <TableCell
                                    key={s.method}
                                    align="center"
                                    sx={{
                                        fontWeight: 700,
                                        color: METHOD_COLORS[s.method],
                                        borderBottom: `2px solid ${METHOD_COLORS[s.method]}`,
                                    }}
                                >
                                    {s.methodName}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {metricsConfig.map((metric) => {
                            const bestMethod = getBestMethod(metric.key, metric.higherIsBetter);

                            return (
                                <TableRow key={metric.key} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                                    <TableCell>
                                        <Tooltip title={metric.tooltip} arrow placement="right">
                                            <Typography variant="body2" sx={{ fontWeight: 500, cursor: 'help' }}>
                                                {metric.label}
                                            </Typography>
                                        </Tooltip>
                                    </TableCell>
                                    {stats.map((s) => {
                                        const value = s[metric.key] as number;
                                        const isBest = s.method === bestMethod;

                                        return (
                                            <TableCell key={s.method} align="center">
                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            fontWeight: isBest ? 700 : 500,
                                                            fontFamily: 'monospace',
                                                            color: isBest ? METHOD_COLORS[s.method] : 'text.primary',
                                                        }}
                                                    >
                                                        {metric.format(value)}
                                                    </Typography>
                                                    {isBest && (
                                                        <Chip
                                                            label="Best"
                                                            size="small"
                                                            sx={{
                                                                height: 16,
                                                                fontSize: '0.6rem',
                                                                bgcolor: `${METHOD_COLORS[s.method]}30`,
                                                                color: METHOD_COLORS[s.method],
                                                            }}
                                                        />
                                                    )}
                                                </Box>
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            );
                        })}

                        {/* Wins Count Row */}
                        <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.02)' }}>
                            <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    🏆 Total Wins
                                </Typography>
                            </TableCell>
                            {stats.map((s) => (
                                <TableCell key={s.method} align="center">
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            fontWeight: 700,
                                            color: METHOD_COLORS[s.method],
                                        }}
                                    >
                                        {winsPerMethod[s.method]} / {metricsConfig.length}
                                    </Typography>
                                </TableCell>
                            ))}
                        </TableRow>

                        {/* Verdict Row */}
                        <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}>
                            <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                    Overall Verdict
                                </Typography>
                            </TableCell>
                            {stats.map((s) => {
                                const verdict = getVerdict(s);
                                return (
                                    <TableCell key={s.method} align="center">
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                fontWeight: 700,
                                                color: verdict.color,
                                            }}
                                        >
                                            {verdict.text}
                                        </Typography>
                                    </TableCell>
                                );
                            })}
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Interpretation */}
            <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                    <strong>How to interpret:</strong> Higher <em>Success Rate</em> and <em>Consistency</em> = model often delivers.
                    Low <em>Stability (σ)</em> and <em>Degradation</em> = reliable predictions.
                    Low <em>Severe Overfit Rate</em> = fewer bad surprises.
                    Higher <em>Total Wins</em> = best overall performer across metrics.
                </Typography>
            </Box>
        </Paper>
    );
};

export default OverfittingTable;

