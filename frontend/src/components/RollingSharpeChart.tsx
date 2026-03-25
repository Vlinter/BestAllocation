import React, { useMemo } from 'react';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ReferenceLine,
} from 'recharts';
import { Paper, Typography, Box, Chip } from '@mui/material';
import { TrendingUp } from '@mui/icons-material';
import type { MethodResult } from '../api/client';

interface RollingSharpeChartProps {
    methods: MethodResult[];
    rollingWindow?: number; // in trading days, default 252
}

const METHOD_COLORS: Record<string, string> = {
    hrp: '#00D4AA',
    gmv: '#FFE66D',
    mvo: '#A78BFA',
    risk_parity: '#F472B6',
};

const RollingSharpeChart: React.FC<RollingSharpeChartProps> = ({ methods, rollingWindow = 252 }) => {
    const chartData = useMemo(() => {
        if (!methods.length) return [];

        // Build rolling Sharpe for each method from equity curve
        const methodSeries: Record<string, { dates: number[]; values: number[] }> = {};

        methods.forEach(m => {
            const curve = m.equity_curve;
            if (curve.length < rollingWindow + 1) return;

            // Compute daily returns
            const returns: number[] = [];
            for (let i = 1; i < curve.length; i++) {
                returns.push((curve[i].value - curve[i - 1].value) / curve[i - 1].value);
            }

            const dates: number[] = [];
            const sharpes: number[] = [];
            const annFactor = Math.sqrt(252);

            for (let i = rollingWindow; i < returns.length; i++) {
                const window = returns.slice(i - rollingWindow, i);
                const mean = window.reduce((a, b) => a + b, 0) / window.length;
                const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / (window.length - 1);
                const std = Math.sqrt(variance);
                const sharpe = std > 1e-8 ? (mean / std) * annFactor : 0;
                // Cap for display
                const cappedSharpe = Math.max(-5, Math.min(5, sharpe));

                dates.push(curve[i + 1]?.date ?? curve[i].date);
                sharpes.push(cappedSharpe);
            }

            methodSeries[m.method] = { dates, values: sharpes };
        });

        // Merge into unified timeline
        const allMethods = Object.keys(methodSeries);
        if (!allMethods.length) return [];

        const primaryMethod = allMethods[0];
        const primaryDates = methodSeries[primaryMethod].dates;

        return primaryDates.map((date, i) => {
            const point: Record<string, number> = { date };
            allMethods.forEach(method => {
                point[method] = Number((methodSeries[method]?.values[i] ?? 0).toFixed(3));
            });
            return point;
        });
    }, [methods, rollingWindow]);

    if (!chartData.length) return null;

    const formatDate = (timestamp: number) => {
        const d = new Date(timestamp);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

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
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.1))',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                }}>
                    <TrendingUp sx={{ fontSize: 28, color: '#10B981' }} />
                </Box>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                        Rolling Sharpe Ratio
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                        {rollingWindow}-day rolling window • Annualized • Capped at ±5
                    </Typography>
                </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                {methods.map(m => (
                    <Chip
                        key={m.method}
                        label={`${m.method_name}: ${m.performance_metrics.sharpe_ratio.toFixed(2)} (overall)`}
                        size="small"
                        sx={{
                            bgcolor: `${METHOD_COLORS[m.method] || '#888'}15`,
                            color: METHOD_COLORS[m.method] || '#888',
                            fontWeight: 600,
                            fontSize: '0.7rem',
                        }}
                    />
                ))}
            </Box>

            <Box sx={{ height: 350, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                            dataKey="date"
                            type="number"
                            domain={['auto', 'auto']}
                            tickFormatter={formatDate}
                            stroke="rgba(255,255,255,0.2)"
                            tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                            tickLine={false}
                        />
                        <YAxis
                            stroke="rgba(255,255,255,0.2)"
                            tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                            tickLine={false}
                            domain={['auto', 'auto']}
                        />
                        <Tooltip
                            labelFormatter={(val) => new Date(val as number).toLocaleDateString()}
                            contentStyle={{
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 8,
                            }}
                        />
                        <Legend
                            formatter={(value) => <span style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>{value}</span>}
                        />
                        <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="5 5" />
                        <ReferenceLine y={1} stroke="rgba(16, 185, 129, 0.2)" strokeDasharray="3 3" label={{ value: 'Good (1.0)', position: 'right', fill: 'rgba(16,185,129,0.4)', fontSize: 10 }} />

                        {methods.map(m => (
                            <Line
                                key={m.method}
                                type="monotone"
                                dataKey={m.method}
                                name={m.method_name}
                                stroke={METHOD_COLORS[m.method] || '#888'}
                                strokeWidth={2}
                                dot={false}
                                connectNulls
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </Box>
        </Paper>
    );
};

export default RollingSharpeChart;
