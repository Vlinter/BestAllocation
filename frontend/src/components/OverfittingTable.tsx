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
    Tooltip,
} from '@mui/material';
import { Analytics as AnalyticsIcon } from '@mui/icons-material';
import type { MethodResult } from '../api/client';

interface OverfittingTableProps {
    methods: MethodResult[];
    benchmarkName?: string;
}

const METHOD_COLORS: Record<string, string> = {
    hrp: '#00D4AA',
    cvar: '#FFE66D',
    mvo: '#A78BFA',
};

interface Row {
    label: string;
    tooltip: string;
    value: (m: MethodResult) => number | null;
    format: (v: number) => string;
    higherIsBetter?: boolean;   // undefined = no winner, the metric is descriptive
    group?: string;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const usable = (m: MethodResult) => (m.overfitting_metrics || []).filter(d => !d.is_cash);

const ROWS: Row[] = [
    {
        group: 'What happened',
        label: 'Periods analysed',
        tooltip: 'Rebalances used, excluding periods spent in cash (their (0, 0) placeholder would be counted as a perfect prediction).',
        value: m => m.predictive_power?.n ?? usable(m).length,
        format: v => v.toFixed(0),
    },
    {
        label: 'Avg predicted Sharpe',
        tooltip: 'Average in-sample Sharpe of the chosen weights over the training window — what the optimizer implicitly announced.',
        value: m => mean(usable(m).map(d => d.predicted_sharpe)),
        format: v => v.toFixed(2),
    },
    {
        label: 'Avg realized Sharpe',
        tooltip: 'Average Sharpe actually obtained over the following holding period.',
        value: m => mean(usable(m).map(d => d.realized_sharpe)),
        format: v => v.toFixed(2),
    },
    {
        group: 'What this test can see',
        label: 'Realized dispersion (σ)',
        tooltip: 'Standard deviation of the realized Sharpes across periods.',
        value: m => m.predictive_power?.realized_sd ?? null,
        format: v => v.toFixed(2),
    },
    {
        label: 'Estimation noise (±)',
        tooltip: 'Sampling error of an annualized Sharpe measured over a single holding window (Lo, 2002). When it matches the dispersion above, everything you see is measurement noise.',
        value: m => m.predictive_power?.noise_sd ?? null,
        format: v => v.toFixed(2),
    },
    {
        label: 'Signal share',
        tooltip: 'Share of the realized dispersion that cannot be explained by estimation noise — i.e. the part that could carry information.',
        value: m => m.predictive_power?.signal_share ?? null,
        format: v => `${(v * 100).toFixed(0)}%`,
    },
    {
        label: 'Detectable |ρ| ceiling',
        tooltip: 'Largest correlation observable EVEN IF the model were perfect, given the noise above. Compare the rank-IC to this number, never to 1.',
        value: m => m.predictive_power?.rho_ceiling ?? null,
        format: v => v.toFixed(2),
    },
    {
        label: 'Rank-IC (Spearman ρ)',
        tooltip: 'Rank correlation between predicted and realized Sharpe, ties handled properly. Read it against the ceiling on the line above: if the ceiling is ~0, this number carries no information about the model.',
        value: m => m.predictive_power?.rho ?? null,
        format: v => (v >= 0 ? '+' : '') + v.toFixed(2),
    },
    {
        label: 'p-value',
        tooltip: 'Probability of a rank correlation at least this large if predicted and realized were unrelated.',
        value: m => m.predictive_power?.p_value ?? null,
        format: v => v.toFixed(2),
    },
    {
        group: 'Edge over the benchmark (low-noise view)',
        label: 'Avg edge per period',
        tooltip: 'Strategy Sharpe minus benchmark Sharpe over the SAME window. Subtracting the benchmark removes the market regime, which is the dominant noise source in the raw levels.',
        value: m => m.edge_stats?.mean ?? null,
        format: v => (v >= 0 ? '+' : '') + v.toFixed(3),
        higherIsBetter: true,
    },
    {
        label: 'Edge t-stat',
        tooltip: 'Is the average edge distinguishable from zero? |t| above ~2 is the usual bar. Below that, the optimizer has not demonstrably beaten the benchmark period by period.',
        value: m => m.edge_stats?.t_stat ?? null,
        format: v => (v >= 0 ? '+' : '') + v.toFixed(2),
        higherIsBetter: true,
    },
    {
        label: 'Periods with positive edge',
        tooltip: 'Share of holding periods where the strategy beat the benchmark. 50% is a coin flip.',
        value: m => m.edge_stats?.hit_rate ?? null,
        format: v => `${(v * 100).toFixed(0)}%`,
        higherIsBetter: true,
    },
];

const OverfittingTable: React.FC<OverfittingTableProps> = ({ methods, benchmarkName }) => {
    const withData = methods.filter(m => usable(m).length > 0);
    if (withData.length === 0) return null;

    const bestFor = (row: Row): string | null => {
        if (row.higherIsBetter === undefined) return null;
        let best: string | null = null;
        let bestValue = -Infinity;
        withData.forEach(m => {
            const v = row.value(m);
            if (v === null) return;
            if (v > bestValue) { bestValue = v; best = m.method; }
        });
        return best;
    };

    const ceilingIsZero = withData.every(m => (m.predictive_power?.rho_ceiling ?? 0) < 0.05);

    return (
        <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <AnalyticsIcon sx={{ color: 'primary.main', fontSize: 28 }} />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    Predicted vs Realized
                </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                At every rebalance the optimizer implicitly announces a Sharpe; here is what followed, next to the
                precision this comparison actually has. Hover any row for the definition.
            </Typography>

            {ceilingIsZero && (
                <Box sx={{ mb: 2.5, p: 2, borderRadius: 1, bgcolor: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                    <Typography variant="body2" sx={{ color: '#F59E0B', fontWeight: 600, mb: 0.5 }}>
                        This rank correlation cannot detect anything — by construction.
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                        A Sharpe ratio measured over a single holding window carries a sampling error as large as the
                        dispersion between periods. The correlation is therefore attenuated to ~0 whatever the model does,
                        and a value near zero is <em>not</em> evidence of overfitting. Use the edge rows below, and the
                        bootstrap intervals above, to judge the strategies.
                    </Typography>
                </Box>
            )}

            <TableContainer>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Metric</TableCell>
                            {withData.map(m => (
                                <TableCell
                                    key={m.method}
                                    align="center"
                                    sx={{
                                        fontWeight: 700,
                                        color: METHOD_COLORS[m.method],
                                        borderBottom: `2px solid ${METHOD_COLORS[m.method]}`,
                                    }}
                                >
                                    {m.method_name}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {ROWS.map(row => {
                            const best = bestFor(row);
                            return (
                                <React.Fragment key={row.label}>
                                    {row.group && (
                                        <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.02)' }}>
                                            <TableCell colSpan={withData.length + 1} sx={{ py: 0.8 }}>
                                                <Typography
                                                    variant="caption"
                                                    sx={{ fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'text.secondary' }}
                                                >
                                                    {row.group === 'Edge over the benchmark (low-noise view)' && benchmarkName
                                                        ? `Edge over ${benchmarkName} (low-noise view)`
                                                        : row.group}
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    <TableRow sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                                        <TableCell>
                                            <Tooltip title={row.tooltip} arrow placement="right">
                                                <Typography variant="body2" sx={{ fontWeight: 500, cursor: 'help' }}>
                                                    {row.label}
                                                </Typography>
                                            </Tooltip>
                                        </TableCell>
                                        {withData.map(m => {
                                            const v = row.value(m);
                                            const isBest = best === m.method;
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
                                                            {v === null ? '—' : row.format(v)}
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
                                    </TableRow>
                                </React.Fragment>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>

            <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                    <strong>How to interpret:</strong> compare <em>Rank-IC</em> to the <em>detectable ceiling</em>, never
                    to 1 — a ρ of 0.05 against a ceiling of 0.06 is a model doing as well as this test can measure.
                    The <em>edge</em> rows are the ones with real resolving power: they remove the market regime shared by
                    every strategy. An edge t-stat below 2 means the advantage is not established, however pretty the
                    equity curve looks.
                </Typography>
            </Box>
        </Paper>
    );
};

export default OverfittingTable;
