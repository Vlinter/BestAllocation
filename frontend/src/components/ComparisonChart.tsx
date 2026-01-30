import {
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine,
    Area,
    ComposedChart,
} from 'recharts';
import { Box, Paper, Typography, ToggleButton, ToggleButtonGroup, Chip } from '@mui/material';
import { format } from 'date-fns';
import React, { useState, useMemo } from 'react';
import type { CurvePoint, MethodResult } from '../api/client';
import { TrendingUp, ShowChart } from '@mui/icons-material';
import { downsampleSeries } from '../utils/chartUtils';

interface ComparisonChartProps {
    methods: MethodResult[];
    benchmarkCurve: CurvePoint[];
    benchmarkName?: string;
}

const METHOD_STYLES: Record<string, { color: string; glow: string }> = {
    hrp: { color: '#00D4AA', glow: 'rgba(0, 212, 170, 0.5)' },
    nco: { color: '#00D4AA', glow: 'rgba(0, 212, 170, 0.5)' },
    gmv: { color: '#FFE66D', glow: 'rgba(255, 230, 109, 0.5)' },
    mvo: { color: '#A78BFA', glow: 'rgba(167, 139, 250, 0.5)' },
};

const ComparisonChart: React.FC<ComparisonChartProps> = React.memo(({ methods, benchmarkCurve, benchmarkName = 'Equal Weight' }) => {
    const [scale, setScale] = useState<'linear' | 'log'>('log');
    const [highlightedMethod, setHighlightedMethod] = useState<string | null>(null);

    // Memoize expensive data transformation
    const chartData = useMemo(() => {
        if (!methods[0]?.equity_curve) return [];

        const rawData = methods[0].equity_curve.map((point, index) => {
            const dataPoint: Record<string, number> = {
                date: point.date,
                benchmark: benchmarkCurve[index]?.value || 1,
            };
            methods.forEach((m) => {
                dataPoint[m.method] = m.equity_curve[index]?.value || 1;
            });
            return dataPoint;
        });

        // Downsample to max 800 points for performance
        return downsampleSeries(rawData, 800);
    }, [methods, benchmarkCurve]);

    // Calculate final returns for display
    const finalReturns = useMemo(() => {
        const results: Record<string, number> = {};
        methods.forEach(m => {
            const lastValue = m.equity_curve[m.equity_curve.length - 1]?.value || 1;
            results[m.method] = (lastValue - 1) * 100;
        });
        return results;
    }, [methods]);

    const formatDate = (timestamp: number) => format(new Date(timestamp), 'MMM yyyy');
    const formatValue = (value: number) => `$${value.toFixed(2)}`;

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const sorted = [...payload].sort((a, b) => b.value - a.value);
            return (
                <Paper
                    sx={{
                        p: 2,
                        bgcolor: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(20px)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                        minWidth: 220,
                    }}
                >
                    <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 1.5, fontSize: '0.75rem' }}>
                        {format(new Date(label), 'MMMM dd, yyyy')}
                    </Typography>
                    {sorted.map((entry: any, index: number) => (
                        <Box
                            key={index}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1.5,
                                mb: 0.75,
                                py: 0.5,
                                px: 1,
                                borderRadius: 1,
                                bgcolor: index === 0 ? 'rgba(255,255,255,0.05)' : 'transparent',
                            }}
                        >
                            <Box
                                sx={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: '50%',
                                    bgcolor: entry.color,
                                    boxShadow: `0 0 8px ${entry.color}`,
                                }}
                            />
                            <Typography variant="body2" sx={{ flex: 1, fontWeight: 500, fontSize: '0.85rem' }}>
                                {entry.name}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.9rem' }}>
                                {formatValue(entry.value)}
                            </Typography>
                            <Chip
                                label={`${entry.value >= 1 ? '+' : ''}${((entry.value - 1) * 100).toFixed(1)}%`}
                                size="small"
                                sx={{
                                    height: 20,
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    bgcolor: entry.value >= 1 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                    color: entry.value >= 1 ? '#10B981' : '#EF4444',
                                }}
                            />
                        </Box>
                    ))}
                </Paper>
            );
        }
        return null;
    };

    return (
        <Paper
            sx={{
                p: 4,
                background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.8) 0%, rgba(15, 23, 42, 0.4) 100%)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.05)',
            }}
        >
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                        <ShowChart sx={{ fontSize: 28, color: '#A78BFA' }} />
                        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                            Performance Comparison
                        </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Cumulative returns: All strategies vs {benchmarkName}
                    </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                    <ToggleButtonGroup
                        value={scale}
                        exclusive
                        onChange={(_, newScale) => newScale && setScale(newScale)}
                        size="small"
                        sx={{
                            '& .MuiToggleButton-root': {
                                px: 2,
                                borderColor: 'rgba(255,255,255,0.1)',
                                '&.Mui-selected': {
                                    bgcolor: 'rgba(167, 139, 250, 0.2)',
                                    color: '#A78BFA',
                                }
                            }
                        }}
                    >
                        <ToggleButton value="linear">Linear</ToggleButton>
                        <ToggleButton value="log">Log</ToggleButton>
                    </ToggleButtonGroup>
                </Box>
            </Box>

            {/* Strategy Performance Badges */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                {methods.map((m) => {
                    const style = METHOD_STYLES[m.method] || METHOD_STYLES.hrp;
                    const ret = finalReturns[m.method];
                    const isHighlighted = highlightedMethod === m.method;

                    return (
                        <Box
                            key={m.method}
                            onMouseEnter={() => setHighlightedMethod(m.method)}
                            onMouseLeave={() => setHighlightedMethod(null)}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1.5,
                                px: 2,
                                py: 1,
                                borderRadius: 2,
                                border: `1px solid ${style.color}40`,
                                bgcolor: isHighlighted ? `${style.color}15` : 'transparent',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                    bgcolor: `${style.color}15`,
                                    boxShadow: `0 4px 20px ${style.glow}`,
                                }
                            }}
                        >
                            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: style.color, boxShadow: `0 0 10px ${style.color}` }} />
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{m.method_name}</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <TrendingUp sx={{ fontSize: 16, color: ret >= 0 ? '#10B981' : '#EF4444' }} />
                                <Typography
                                    variant="body2"
                                    sx={{
                                        fontWeight: 700,
                                        color: ret >= 0 ? '#10B981' : '#EF4444',
                                        fontFamily: 'monospace'
                                    }}
                                >
                                    {ret >= 0 ? '+' : ''}{ret.toFixed(1)}%
                                </Typography>
                            </Box>
                        </Box>
                    );
                })}
            </Box>

            {/* Chart */}
            <ResponsiveContainer width="100%" height={450}>
                <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                    <defs>
                        {methods.map((m) => {
                            const style = METHOD_STYLES[m.method] || METHOD_STYLES.hrp;
                            return (
                                <linearGradient key={`gradient-${m.method}`} id={`gradient-${m.method}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={style.color} stopOpacity={0.3} />
                                    <stop offset="100%" stopColor={style.color} stopOpacity={0} />
                                </linearGradient>
                            );
                        })}
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                    <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        stroke="#4B5563"
                        tick={{ fontSize: 11, fill: '#6B7280' }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                        tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    />
                    <YAxis
                        scale={scale}
                        domain={['auto', 'auto']}
                        tickFormatter={(val) => `$${val.toFixed(1)}`}
                        stroke="#4B5563"
                        tick={{ fontSize: 11, fill: '#6B7280' }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                        tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                        wrapperStyle={{ paddingTop: 20 }}
                        formatter={(value) => <span style={{ color: '#9CA3AF', fontSize: '0.85rem' }}>{value}</span>}
                    />
                    <ReferenceLine y={1} stroke="#374151" strokeDasharray="3 3" label={{ value: 'Break Even', position: 'right', fill: '#6B7280', fontSize: 10 }} />

                    {/* Benchmark */}
                    <Line
                        type="monotone"
                        dataKey="benchmark"
                        name={benchmarkName}
                        stroke="#6B7280"
                        strokeWidth={2}
                        strokeDasharray="8 4"
                        dot={false}
                        isAnimationActive={false}
                    />

                    {/* Methods with gradient fills */}
                    {methods.map((m) => {
                        const style = METHOD_STYLES[m.method] || METHOD_STYLES.hrp;
                        const isHighlighted = highlightedMethod === null || highlightedMethod === m.method;

                        return (
                            <React.Fragment key={m.method}>
                                <Area
                                    type="monotone"
                                    dataKey={m.method}
                                    fill={`url(#gradient-${m.method})`}
                                    stroke="none"
                                    isAnimationActive={false}
                                    fillOpacity={isHighlighted ? 1 : 0.3}
                                />
                                <Line
                                    type="monotone"
                                    dataKey={m.method}
                                    name={m.method_name}
                                    stroke={style.color}
                                    strokeWidth={isHighlighted ? 3 : 1.5}
                                    dot={false}
                                    isAnimationActive={false}
                                    style={{
                                        filter: isHighlighted ? `drop-shadow(0 0 8px ${style.glow})` : 'none',
                                        opacity: isHighlighted ? 1 : 0.5,
                                    }}
                                />
                            </React.Fragment>
                        );
                    })}
                </ComposedChart>
            </ResponsiveContainer>
        </Paper>
    );
});

export default ComparisonChart;


