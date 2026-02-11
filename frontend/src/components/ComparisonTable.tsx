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
import { EmojiEvents as TrophyIcon, Info as InfoIcon } from '@mui/icons-material';
import type { MethodResult, PerformanceMetrics } from '../api/client';

interface ComparisonTableProps {
    methods: MethodResult[];
    benchmarkMetrics: PerformanceMetrics;
    benchmarkName?: string;
}

interface MetricConfig {
    label: string;
    key: keyof PerformanceMetrics;
    format: (value: number) => string;
    higherIsBetter: boolean;
    tooltip: string;
}

const metricsConfig: MetricConfig[] = [
    {
        label: 'Sharpe Ratio', key: 'sharpe_ratio', format: (v) => v.toFixed(2), higherIsBetter: true,
        tooltip: 'Risk-adjusted return: (Return - Risk-free rate) / Volatility. Higher = better risk-adjusted returns. >1 is good, >2 is excellent.'
    },
    {
        label: 'Sortino Ratio', key: 'sortino_ratio', format: (v) => v.toFixed(2), higherIsBetter: true,
        tooltip: 'Like Sharpe but only penalizes downside volatility. Better for asymmetric returns. Higher = better downside protection.'
    },
    {
        label: 'Alpha', key: 'alpha', format: (v) => `${(v * 100).toFixed(2)}%`, higherIsBetter: true,
        tooltip: "Jensen's Alpha: Excess return vs benchmark after adjusting for beta. Positive = outperformance, negative = underperformance."
    },
    {
        label: 'Beta', key: 'beta', format: (v) => v.toFixed(2), higherIsBetter: false,
        tooltip: 'Market sensitivity. β=1 moves with market, β<1 is defensive, β>1 is aggressive. Lower often preferred for stability.'
    },
    {
        label: 'CAGR', key: 'cagr', format: (v) => `${(v * 100).toFixed(2)}%`, higherIsBetter: true,
        tooltip: 'Compound Annual Growth Rate: Smoothed annual return over the period. The most important return metric.'
    },
    {
        label: 'Total Return', key: 'total_return', format: (v) => `${(v * 100).toFixed(2)}%`, higherIsBetter: true,
        tooltip: 'Cumulative return over the entire period. $1 invested becomes $(1+return).'
    },
    {
        label: 'Max Drawdown', key: 'max_drawdown', format: (v) => `${(v * 100).toFixed(2)}%`, higherIsBetter: false,
        tooltip: 'Largest peak-to-trough decline. Critical risk metric. -20% means you lost 20% from your highest point.'
    },
    {
        label: 'Volatility', key: 'volatility', format: (v) => `${(v * 100).toFixed(2)}%`, higherIsBetter: false,
        tooltip: 'Annualized standard deviation of returns. Measures price fluctuation. Lower = smoother ride.'
    },
    {
        label: 'Calmar Ratio', key: 'calmar_ratio', format: (v) => v.toFixed(2), higherIsBetter: true,
        tooltip: 'CAGR / Max Drawdown. Measures return per unit of drawdown risk. Higher = better recovery from losses.'
    },
    {
        label: 'Omega Ratio', key: 'omega_ratio', format: (v) => v.toFixed(2), higherIsBetter: true,
        tooltip: 'Probability-weighted gains / losses. >1 means gains outweigh losses. Captures full return distribution.'
    },
    {
        label: 'Win Rate', key: 'win_rate', format: (v) => `${(v * 100).toFixed(1)}%`, higherIsBetter: true,
        tooltip: 'Percentage of days with positive returns. 50%+ is typical for trending strategies.'
    },
    {
        label: 'Annualized Turnover', key: 'annualized_turnover', format: (v) => `${(v * 100).toFixed(0)}%`, higherIsBetter: false,
        tooltip: 'How much of portfolio is traded per year. 100% = entire portfolio replaced once. Lower = less trading costs.'
    },
    {
        label: 'Transaction Costs', key: 'total_transaction_costs', format: (v) => `${(v * 100).toFixed(2)}%`, higherIsBetter: false,
        tooltip: 'Cumulative trading costs over the period. Reduces actual returns. Based on your cost per trade setting.'
    },
];

const METHOD_COLORS: Record<string, string> = {
    hrp: '#00D4AA',
    gmv: '#FFE66D',
    mvo: '#A78BFA',
};

// Model parameters for transparency
const getModelParamsTooltip = (method: MethodResult): string => {
    const params = method.method_params;
    if (!params) return '';

    if (params.linkage_method) {
        return `Linkage: ${params.linkage_method}`;
    }
    return '';
};

const ComparisonTable: React.FC<ComparisonTableProps> = ({ methods, benchmarkMetrics, benchmarkName = 'Benchmark' }) => {
    const getBestMethod = (key: keyof PerformanceMetrics, higherIsBetter: boolean): string => {
        let bestMethod = '';
        let bestValue = higherIsBetter ? -Infinity : Infinity;

        methods.forEach((m) => {
            const value = m.performance_metrics[key] as number;
            if (higherIsBetter ? value > bestValue : value < bestValue) {
                bestValue = value;
                bestMethod = m.method;
            }
        });

        return bestMethod;
    };

    return (
        <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <TrophyIcon sx={{ color: 'primary.main', fontSize: 28 }} />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    Performance Comparison
                </Typography>
            </Box>

            <TableContainer sx={{
                overflowX: 'auto',
                '&::-webkit-scrollbar': { height: 6 },
                '&::-webkit-scrollbar-thumb': {
                    bgcolor: 'rgba(167, 139, 250, 0.3)',
                    borderRadius: 3
                }
            }}>
                <Table size="small" sx={{ minWidth: 600 }}>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Metric</TableCell>
                            {methods.map((m) => {
                                const tooltip = getModelParamsTooltip(m);
                                return (
                                    <TableCell
                                        key={m.method}
                                        align="center"
                                        sx={{
                                            fontWeight: 700,
                                            color: METHOD_COLORS[m.method],
                                            borderBottom: `2px solid ${METHOD_COLORS[m.method]}`,
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                            {m.method_name}
                                            {tooltip && (
                                                <Tooltip title={tooltip} arrow>
                                                    <InfoIcon sx={{ fontSize: 14, opacity: 0.6, cursor: 'help' }} />
                                                </Tooltip>
                                            )}
                                        </Box>
                                    </TableCell>
                                );
                            })}
                            <TableCell align="center" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                                {benchmarkName}
                            </TableCell>
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
                                    {methods.map((m) => {
                                        const value = m.performance_metrics[metric.key] as number;
                                        const isBest = m.method === bestMethod;

                                        return (
                                            <TableCell key={m.method} align="center">
                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            fontWeight: isBest ? 700 : 500,
                                                            fontFamily: 'monospace',
                                                            color: isBest ? METHOD_COLORS[m.method] : 'text.primary',
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
                                                                bgcolor: `${METHOD_COLORS[m.method]}30`,
                                                                color: METHOD_COLORS[m.method],
                                                            }}
                                                        />
                                                    )}
                                                </Box>
                                            </TableCell>
                                        );
                                    })}
                                    <TableCell align="center">
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                                            {metric.format(benchmarkMetrics[metric.key] as number)}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
};

export default ComparisonTable;

