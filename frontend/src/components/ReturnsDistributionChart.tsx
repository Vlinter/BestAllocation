import React, { useMemo, useState } from 'react';
import { Box, Paper, Typography, ToggleButtonGroup, ToggleButton } from '@mui/material';
import {
    ComposedChart,
    Bar,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    ReferenceLine
} from 'recharts';
import { ShowChart } from '@mui/icons-material';
import type { MethodResult } from '../api/client';

interface ReturnsDistributionChartProps {
    methods: MethodResult[];
}

const METHOD_COLORS: Record<string, { main: string; light: string; gradient: [string, string] }> = {
    hrp: {
        main: '#00D4AA',
        light: '#00FFD4',
        gradient: ['#00D4AA', '#00FFF0']
    },
    gmv: {
        main: '#FFE66D',
        light: '#FFF094',
        gradient: ['#FFE66D', '#FFF9CC']
    },
    mvo: {
        main: '#A78BFA',
        light: '#C4B5FD',
        gradient: ['#A78BFA', '#DDD6FE']
    },
};

const ReturnsDistributionChart: React.FC<ReturnsDistributionChartProps> = React.memo(({ methods }) => {
    const [selectedMethodIndex, setSelectedMethodIndex] = useState(0);
    const method = methods[selectedMethodIndex];

    const methodColor = METHOD_COLORS[method?.method] || METHOD_COLORS.hrp;

    // Calculate distribution data
    const { chartData, stats } = useMemo(() => {
        if (!method?.equity_curve || method.equity_curve.length < 30) {
            return { chartData: [], stats: null };
        }

        // Calculate Monthly Returns
        const returns: number[] = [];
        const curve = method.equity_curve;
        let prevValue = curve[0].value;
        let currentMonth = new Date(curve[0].date).getMonth();

        for (let i = 1; i < curve.length; i++) {
            const date = new Date(curve[i].date);
            const month = date.getMonth();

            if (month !== currentMonth) {
                const currentVal = curve[i].value;
                const ret = (currentVal - prevValue) / prevValue;
                returns.push(ret);
                prevValue = currentVal;
                currentMonth = month;
            }
        }

        if (returns.length < 5) return { chartData: [], stats: null };

        // Statistics
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + b ** 2, 0) / returns.length - mean ** 2;
        const stdDev = Math.sqrt(variance);

        // Create Histogram Bins
        const minRet = Math.min(...returns);
        const maxRet = Math.max(...returns);
        // Reduce bin count for wider, chunkier bars (max 20 instead of 30)
        const binCount = Math.min(20, Math.max(10, Math.ceil(Math.sqrt(returns.length))));
        const range = maxRet - minRet;
        const calculatedBinSize = range / binCount;

        const combinedData: any[] = [];

        // Add Bins
        for (let i = 0; i < binCount; i++) {
            const binStart = minRet + i * calculatedBinSize;
            const binEnd = minRet + (i + 1) * calculatedBinSize;
            const mid = minRet + (i + 0.5) * calculatedBinSize;
            const count = returns.filter(r => r >= binStart && r < binEnd).length;

            if (count > 0 || i === 0 || i === binCount - 1) {
                combinedData.push({
                    x: mid,
                    count: count,
                    binStart,
                    binEnd,
                    type: 'bin'
                });
            }
        }

        // Add High-Res Curve Points with smooth area
        const curveSteps = 150;
        const curveStart = minRet - calculatedBinSize;
        const curveEnd = maxRet + calculatedBinSize;
        const step = (curveEnd - curveStart) / curveSteps;
        const scaleFactor = returns.length * calculatedBinSize;

        for (let i = 0; i <= curveSteps; i++) {
            const x = curveStart + i * step;
            const pdf = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
            combinedData.push({
                x: x,
                frequency: pdf * scaleFactor,
                type: 'curve'
            });
        }

        combinedData.sort((a, b) => a.x - b.x);

        return {
            chartData: combinedData,
            stats: { mean, stdDev, returns }
        };
    }, [method]);

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;

            if (data.type === 'bin' && data.binStart !== undefined) {
                return (
                    <Paper
                        sx={{
                            p: 1.5,
                            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.95) 100%)',
                            border: '1px solid',
                            borderColor: methodColor.light,
                            backdropFilter: 'blur(10px)',
                            boxShadow: `0 4px 16px ${methodColor.main}40`,
                        }}
                    >
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mb: 0.5 }}>
                            Range: {(data.binStart * 100).toFixed(1)}% to {(data.binEnd * 100).toFixed(1)}%
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: methodColor.main }}>
                            Count: {data.count} months
                        </Typography>
                    </Paper>
                );
            }

            if (data.type === 'curve' && data.frequency !== undefined) {
                return (
                    <Paper
                        sx={{
                            p: 1.5,
                            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.95) 100%)',
                            border: '1px solid',
                            borderColor: methodColor.light,
                            backdropFilter: 'blur(10px)',
                            boxShadow: `0 4px 16px ${methodColor.main}40`,
                        }}
                    >
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mb: 0.5 }}>
                            Return: {(data.x * 100).toFixed(1)}%
                        </Typography>
                        <Typography variant="body2" sx={{ color: methodColor.main, fontWeight: 700 }}>
                            Normal Dist: {data.frequency.toFixed(2)}
                        </Typography>
                    </Paper>
                );
            }
        }
        return null;
    };

    return (
        <Paper
            sx={{
                p: 4,
                background: 'linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.95) 100%)',
                border: '1px solid rgba(100,181,246,0.1)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                        <ShowChart sx={{
                            fontSize: 32,
                            color: methodColor.main,
                            filter: `drop-shadow(0 0 12px ${methodColor.main}80)`
                        }} />
                        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
                            Returns Distribution
                        </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                        Monthly returns histogram vs Normal distribution (Gaussian)
                    </Typography>
                </Box>

                <ToggleButtonGroup
                    value={selectedMethodIndex}
                    exclusive
                    onChange={(_, v) => v !== null && setSelectedMethodIndex(v)}
                    size="small"
                    sx={{
                        '& .MuiToggleButton-root': {
                            px: 2,
                            py: 0.75,
                            borderColor: 'rgba(255,255,255,0.1)',
                            color: 'rgba(255,255,255,0.7)',
                            fontWeight: 600,
                            '&.Mui-selected': {
                                background: `linear-gradient(135deg, ${methodColor.main}30, ${methodColor.main}10)`,
                                color: methodColor.main,
                                borderColor: methodColor.main,
                                boxShadow: `0 0 16px ${methodColor.main}40`,
                            },
                            '&:hover': {
                                bgcolor: 'rgba(255,255,255,0.05)',
                            }
                        }
                    }}
                >
                    {methods.map((m, i) => (
                        <ToggleButton key={m.method} value={i}>
                            {m.method_name}
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>
            </Box>

            <Box sx={{ height: 380, width: '100%', position: 'relative' }}>
                {/* Gradient definition for area fill */}
                <svg width="0" height="0" style={{ position: 'absolute' }}>
                    <defs>
                        <linearGradient id={`areaGradient-${method?.method}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={methodColor.main} stopOpacity={0.6} />
                            <stop offset="100%" stopColor={methodColor.main} stopOpacity={0.05} />
                        </linearGradient>
                    </defs>
                </svg>

                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                        <defs>
                            <linearGradient id="barGradientPositive" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10B981" stopOpacity={0.8} />
                                <stop offset="100%" stopColor="#10B981" stopOpacity={0.4} />
                            </linearGradient>
                            <linearGradient id="barGradientNegative" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#EF4444" stopOpacity={0.8} />
                                <stop offset="100%" stopColor="#EF4444" stopOpacity={0.4} />
                            </linearGradient>
                        </defs>

                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(255,255,255,0.05)"
                            vertical={false}
                        />

                        <XAxis
                            dataKey="x"
                            type="number"
                            domain={['dataMin', 'dataMax']}
                            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                            stroke="rgba(255,255,255,0.3)"
                            tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600 }}
                            allowDataOverflow={false}
                        />
                        <YAxis
                            stroke="rgba(255,255,255,0.3)"
                            tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600 }}
                        />

                        {/* Mean line */}
                        {stats && (
                            <ReferenceLine
                                x={stats.mean}
                                stroke={methodColor.main}
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                label={{
                                    value: 'Mean',
                                    position: 'top',
                                    fill: methodColor.main,
                                    fontWeight: 700,
                                    fontSize: 12
                                }}
                            />
                        )}

                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />

                        {/* Smooth area under curve - RENDER FIRST (background) */}
                        <Area
                            type="natural"
                            dataKey="frequency"
                            stroke={methodColor.main}
                            strokeWidth={3}
                            fill={`url(#areaGradient-${method?.method})`}
                            fillOpacity={0.4}
                            connectNulls
                            name="Gaussian Fit"
                            animationDuration={1500}
                            style={{
                                filter: `drop-shadow(0 0 12px ${methodColor.main}60)`,
                            }}
                        />

                        {/* Histogram bars - RENDER SECOND (foreground) */}
                        <Bar
                            dataKey="count"
                            barSize={40} // Wider bars
                        >
                            {chartData.map((entry: any, index: number) => {
                                if (entry.type === 'bin') {
                                    const fill = entry.x >= 0 ? 'url(#barGradientPositive)' : 'url(#barGradientNegative)';
                                    return (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={fill}
                                            style={{
                                                filter: `drop-shadow(0 0 8px ${entry.x >= 0 ? '#10B981' : '#EF4444'}60)`,
                                                cursor: 'pointer'
                                            }}
                                        />
                                    );
                                }
                                return <Cell key={`cell-${index}`} fill="transparent" />;
                            })}
                        </Bar>
                    </ComposedChart>
                </ResponsiveContainer>
            </Box>

            {stats && (
                <Box sx={{
                    display: 'flex',
                    gap: 5,
                    mt: 3,
                    justifyContent: 'center',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    pt: 3
                }}>
                    <Box
                        sx={{
                            textAlign: 'center',
                            px: 3,
                            py: 1.5,
                            borderRadius: 2,
                            background: `linear-gradient(135deg, ${stats.mean >= 0 ? '#10B98130' : '#EF444430'}, transparent)`,
                            border: '1px solid',
                            borderColor: stats.mean >= 0 ? '#10B98150' : '#EF444450'
                        }}
                    >
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mb: 0.5 }}>
                            Mean Return
                        </Typography>
                        <Typography
                            variant="h6"
                            sx={{
                                fontWeight: 800,
                                fontFamily: 'monospace',
                                color: stats.mean >= 0 ? '#10B981' : '#EF4444',
                                textShadow: `0 0 12px ${stats.mean >= 0 ? '#10B98160' : '#EF444460'}`
                            }}
                        >
                            {stats.mean >= 0 ? '+' : ''}{(stats.mean * 100).toFixed(2)}%
                        </Typography>
                    </Box>

                    <Box
                        sx={{
                            textAlign: 'center',
                            px: 3,
                            py: 1.5,
                            borderRadius: 2,
                            background: `linear-gradient(135deg, ${methodColor.main}30, transparent)`,
                            border: '1px solid',
                            borderColor: `${methodColor.main}50`
                        }}
                    >
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mb: 0.5 }}>
                            Std Deviation
                        </Typography>
                        <Typography
                            variant="h6"
                            sx={{
                                fontWeight: 800,
                                fontFamily: 'monospace',
                                color: methodColor.main,
                                textShadow: `0 0 12px ${methodColor.main}60`
                            }}
                        >
                            {(stats.stdDev * 100).toFixed(2)}%
                        </Typography>
                    </Box>

                    <Box
                        sx={{
                            textAlign: 'center',
                            px: 3,
                            py: 1.5,
                            borderRadius: 2,
                            background: 'linear-gradient(135deg, rgba(100,181,246,0.2), transparent)',
                            border: '1px solid rgba(100,181,246,0.3)'
                        }}
                    >
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mb: 0.5 }}>
                            Sample Size
                        </Typography>
                        <Typography
                            variant="h6"
                            sx={{
                                fontWeight: 800,
                                fontFamily: 'monospace',
                                color: '#64b5f6',
                                textShadow: '0 0 12px rgba(100,181,246,0.6)'
                            }}
                        >
                            {stats.returns.length} months
                        </Typography>
                    </Box>
                </Box>
            )}
        </Paper>
    );
});

export default ReturnsDistributionChart;
