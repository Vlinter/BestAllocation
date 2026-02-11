import React from 'react';
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
} from '@mui/material';
import {
    TrendingUp as TrendingUpIcon,
    TrendingDown as TrendingDownIcon,
    ShowChart as ShowChartIcon,
} from '@mui/icons-material';

interface PerformanceMetrics {
    sharpe_ratio: number;
    sortino_ratio: number;
    max_drawdown: number;
    cagr: number;
    total_return: number;
    volatility: number;
    calmar_ratio: number;
    total_transaction_costs?: number;
    num_rebalances?: number;
}

interface MetricsTableProps {
    strategyMetrics: PerformanceMetrics;
    benchmarkMetrics: PerformanceMetrics;
    method: string;
}

interface MetricRow {
    label: string;
    key: keyof PerformanceMetrics;
    format: (value: number) => string;
    higherIsBetter: boolean;
    description: string;
}

const metricsConfig: MetricRow[] = [
    {
        label: 'Sharpe Ratio',
        key: 'sharpe_ratio',
        format: (v) => v.toFixed(2),
        higherIsBetter: true,
        description: 'Risk-adjusted return (excess return / volatility)',
    },
    {
        label: 'Sortino Ratio',
        key: 'sortino_ratio',
        format: (v) => v.toFixed(2),
        higherIsBetter: true,
        description: 'Downside risk-adjusted return',
    },
    {
        label: 'CAGR',
        key: 'cagr',
        format: (v) => `${(v * 100).toFixed(2)}%`,
        higherIsBetter: true,
        description: 'Compound Annual Growth Rate',
    },
    {
        label: 'Total Return',
        key: 'total_return',
        format: (v) => `${(v * 100).toFixed(2)}%`,
        higherIsBetter: true,
        description: 'Cumulative return over period',
    },
    {
        label: 'Max Drawdown',
        key: 'max_drawdown',
        format: (v) => `${(v * 100).toFixed(2)}%`,
        higherIsBetter: false,
        description: 'Largest peak-to-trough decline',
    },
    {
        label: 'Volatility',
        key: 'volatility',
        format: (v) => `${(v * 100).toFixed(2)}%`,
        higherIsBetter: false,
        description: 'Annualized standard deviation',
    },
    {
        label: 'Calmar Ratio',
        key: 'calmar_ratio',
        format: (v) => v.toFixed(2),
        higherIsBetter: true,
        description: 'CAGR / Max Drawdown',
    },
];

const MetricsTable: React.FC<MetricsTableProps> = ({
    strategyMetrics,
    benchmarkMetrics,
    method,
}) => {
    const methodNames: Record<string, string> = {
        hrp: 'HRP',
        gmv: 'GMV',
        mdr: 'MDR',
    };

    const getComparisonChip = (
        strategyValue: number,
        benchmarkValue: number,
        higherIsBetter: boolean
    ) => {
        if (benchmarkValue === 0) return null;

        const diff = ((strategyValue - benchmarkValue) / Math.abs(benchmarkValue)) * 100;
        const isBetter = higherIsBetter ? diff > 0 : diff < 0;

        if (Math.abs(diff) < 1) {
            return (
                <Chip
                    label="≈"
                    size="small"
                    sx={{
                        bgcolor: 'rgba(156, 163, 175, 0.2)',
                        color: 'text.secondary',
                        fontSize: '0.7rem',
                        height: 20,
                    }}
                />
            );
        }

        return (
            <Chip
                icon={isBetter ? <TrendingUpIcon sx={{ fontSize: 14 }} /> : <TrendingDownIcon sx={{ fontSize: 14 }} />}
                label={`${diff > 0 ? '+' : ''}${diff.toFixed(0)}%`}
                size="small"
                sx={{
                    bgcolor: isBetter ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: isBetter ? 'success.main' : 'error.main',
                    fontSize: '0.7rem',
                    height: 20,
                    '& .MuiChip-icon': {
                        color: 'inherit',
                    },
                }}
            />
        );
    };

    return (
        <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <ShowChartIcon sx={{ color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Performance Metrics
                </Typography>
            </Box>

            <TableContainer>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>Metric</TableCell>
                            <TableCell align="right" sx={{ color: 'primary.main', fontWeight: 600 }}>
                                {methodNames[method] || method}
                            </TableCell>
                            <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                                Benchmark
                            </TableCell>
                            <TableCell align="center" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                                vs Bench
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {metricsConfig.map((metric) => (
                            <TableRow
                                key={metric.key}
                                sx={{
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                                }}
                            >
                                <TableCell>
                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                        {metric.label}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                        {metric.description}
                                    </Typography>
                                </TableCell>
                                <TableCell align="right">
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            fontWeight: 600,
                                            color: 'primary.main',
                                            fontFamily: 'monospace',
                                        }}
                                    >
                                        {metric.format(strategyMetrics[metric.key] as number)}
                                    </Typography>
                                </TableCell>
                                <TableCell align="right">
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            fontFamily: 'monospace',
                                            color: 'text.secondary',
                                        }}
                                    >
                                        {metric.format(benchmarkMetrics[metric.key] as number)}
                                    </Typography>
                                </TableCell>
                                <TableCell align="center">
                                    {getComparisonChip(
                                        strategyMetrics[metric.key] as number,
                                        benchmarkMetrics[metric.key] as number,
                                        metric.higherIsBetter
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Typography variant="caption" sx={{ display: 'block', mt: 2, textAlign: 'right', color: 'text.secondary', fontStyle: 'italic' }}>
                * All returns are Net of Transaction Costs
            </Typography>
        </Paper>
    );
};

export default MetricsTable;
