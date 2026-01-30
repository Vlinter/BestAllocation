import React, { useState, useMemo } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { Box, Paper, Typography, Chip } from '@mui/material';
import { format } from 'date-fns';
import { downsampleSeries } from '../utils/chartUtils';
import type { MethodResult } from '../api/client';

interface DrawdownComparisonChartProps {
    methods: MethodResult[];
}

const METHOD_COLORS: Record<string, string> = {
    hrp: '#00D4AA',
    gmv: '#FFE66D',
    mvo: '#A78BFA',
};

const DrawdownComparisonChart: React.FC<DrawdownComparisonChartProps> = React.memo(({ methods }) => {
    const [activeMethod, setActiveMethod] = useState<string | null>(null);

    // Memoize expensive data merge
    const chartData = useMemo(() => {
        if (!methods[0]?.drawdown_curve) return [];
        const rawData = methods[0].drawdown_curve.map((point, index) => {
            const dataPoint: Record<string, number> = { date: point.date };
            methods.forEach((m) => {
                dataPoint[m.method] = m.drawdown_curve[index]?.value || 0;
            });
            return dataPoint;
        });
        return downsampleSeries(rawData, 800);
    }, [methods]);

    // Memoize max drawdowns calculation
    const maxDrawdowns = useMemo(() => methods.map(m => ({
        method: m.method,
        name: m.method_name,
        maxDD: Math.min(...m.drawdown_curve.map(p => p.value)),
    })), [methods]);

    const formatDate = (timestamp: number) => format(new Date(timestamp), 'MMM yyyy');

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <Paper sx={{ p: 1.5, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                        {format(new Date(label), 'MMM dd, yyyy')}
                    </Typography>
                    {payload.map((entry: any, index: number) => (
                        <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: entry.color }} />
                            <Typography variant="body2" sx={{ flex: 1, fontSize: '0.8rem' }}>
                                {entry.name}:
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{
                                    fontWeight: 600,
                                    fontFamily: 'monospace',
                                    color: entry.value < -20 ? 'error.main' : entry.value < -10 ? 'warning.main' : 'text.primary',
                                }}
                            >
                                {entry.value.toFixed(2)}%
                            </Typography>
                        </Box>
                    ))}
                </Paper>
            );
        }
        return null;
    };

    return (
        <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                        Drawdown Comparison
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Historical drawdowns for all optimization methods
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {maxDrawdowns.map((dd) => (
                        <Chip
                            key={dd.method}
                            label={`${dd.name.split(' ')[0]}: ${dd.maxDD.toFixed(1)}%`}
                            size="small"
                            sx={{
                                bgcolor: `${METHOD_COLORS[dd.method]}20`,
                                color: METHOD_COLORS[dd.method],
                                fontWeight: 600,
                                fontSize: '0.7rem',
                                cursor: 'pointer',
                                borderWidth: activeMethod === dd.method ? 2 : 0,
                                borderStyle: 'solid',
                                borderColor: METHOD_COLORS[dd.method],
                            }}
                            onClick={() => setActiveMethod(activeMethod === dd.method ? null : dd.method)}
                        />
                    ))}
                </Box>
            </Box>

            <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <defs>
                        {methods.map((m) => (
                            <linearGradient key={`gradient-${m.method}`} id={`gradient-${m.method}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={METHOD_COLORS[m.method]} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={METHOD_COLORS[m.method]} stopOpacity={0} />
                            </linearGradient>
                        ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        stroke="#6B7280"
                        tick={{ fontSize: 11 }}
                    />
                    <YAxis
                        domain={['auto', 0]}
                        tickFormatter={(val) => `${val}%`}
                        stroke="#6B7280"
                        tick={{ fontSize: 11 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: 20 }} />

                    {methods.map((m) => (
                        <Area
                            key={m.method}
                            type="monotone"
                            dataKey={m.method}
                            name={m.method_name}
                            stroke={METHOD_COLORS[m.method] || '#00D4AA'}
                            strokeWidth={activeMethod === null || activeMethod === m.method ? 2 : 0.5}
                            fill={`url(#gradient-${m.method})`}
                            fillOpacity={activeMethod === null || activeMethod === m.method ? 1 : 0.2}
                            isAnimationActive={false}
                        />
                    ))}
                </AreaChart>
            </ResponsiveContainer>
        </Paper>
    );
});

export default DrawdownComparisonChart;

