import React, { useMemo, useState } from 'react';
import { Box, Paper, Typography, ToggleButtonGroup, ToggleButton, Chip } from '@mui/material';
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
import { ShowChart, TrendingUp, TrendingDown, Warning } from '@mui/icons-material';
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

    // Calculate distribution data with enhanced statistics
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
        const n = returns.length;
        const mean = returns.reduce((a, b) => a + b, 0) / n;
        const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
        const stdDev = Math.sqrt(variance);

        // Skewness (measure of asymmetry)
        const skewness = returns.reduce((a, b) => a + Math.pow((b - mean) / stdDev, 3), 0) / n;

        // Kurtosis (measure of tail thickness, excess kurtosis = kurtosis - 3)
        const kurtosis = returns.reduce((a, b) => a + Math.pow((b - mean) / stdDev, 4), 0) / n - 3;

        // VaR (Value at Risk) at 95% confidence - historical method
        const sortedReturns = [...returns].sort((a, b) => a - b);
        const varIndex = Math.floor(n * 0.05);
        const var95 = sortedReturns[varIndex];

        // Expected Shortfall (CVaR) - average of returns below VaR
        const tailReturns = sortedReturns.slice(0, varIndex + 1);
        const cvar95 = tailReturns.reduce((a, b) => a + b, 0) / tailReturns.length;

        // Best and worst months
        const maxReturn = Math.max(...returns);
        const minReturn = Math.min(...returns);

        // Win rate
        const positiveMonths = returns.filter(r => r >= 0).length;
        const winRate = positiveMonths / n;

        // Create Histogram Bins
        const minRet = Math.min(...returns);
        const maxRet = Math.max(...returns);
        const binCount = Math.min(25, Math.max(12, Math.ceil(Math.sqrt(n))));
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
        const scaleFactor = n * calculatedBinSize;

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
            stats: {
                mean,
                stdDev,
                skewness,
                kurtosis,
                var95,
                cvar95,
                maxReturn,
                minReturn,
                winRate,
                sampleSize: n,
                returns
            }
        };
    }, [method]);

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;

            if (data.type === 'bin' && data.binStart !== undefined) {
                return (
                    <Paper
                        sx={{
                            p: 2,
                            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.95) 100%)',
                            border: '1px solid',
                            borderColor: methodColor.light,
                            backdropFilter: 'blur(10px)',
                            boxShadow: `0 4px 20px ${methodColor.main}50`,
                        }}
                    >
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block', mb: 1 }}>
                            Return Range
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#fff', mb: 1, fontFamily: 'monospace' }}>
                            {(data.binStart * 100).toFixed(2)}% → {(data.binEnd * 100).toFixed(2)}%
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: methodColor.main }} />
                            <Typography variant="body2" sx={{ fontWeight: 700, color: methodColor.main }}>
                                {data.count} month{data.count !== 1 ? 's' : ''}
                            </Typography>
                        </Box>
                    </Paper>
                );
            }

            if (data.type === 'curve' && data.frequency !== undefined) {
                return (
                    <Paper
                        sx={{
                            p: 1.5,
                            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.95) 100%)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            backdropFilter: 'blur(10px)',
                        }}
                    >
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                            Normal: {(data.x * 100).toFixed(2)}%
                        </Typography>
                    </Paper>
                );
            }
        }
        return null;
    };

    // Helper to get interpretation of skewness/kurtosis
    const getSkewnessLabel = (skew: number) => {
        if (skew < -0.5) return { label: 'Left Skewed', color: '#EF4444', icon: <TrendingDown sx={{ fontSize: 14 }} /> };
        if (skew > 0.5) return { label: 'Right Skewed', color: '#10B981', icon: <TrendingUp sx={{ fontSize: 14 }} /> };
        return { label: 'Symmetric', color: '#60A5FA', icon: null };
    };

    const getKurtosisLabel = (kurt: number) => {
        if (kurt > 1) return { label: 'Fat Tails', color: '#F59E0B', icon: <Warning sx={{ fontSize: 14 }} /> };
        if (kurt < -1) return { label: 'Thin Tails', color: '#10B981', icon: null };
        return { label: 'Normal Tails', color: '#60A5FA', icon: null };
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
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
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
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                        Monthly returns histogram • Gaussian overlay • Risk metrics
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

            {/* Distribution Insights - Quick badges */}
            {stats && (
                <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
                    {(() => {
                        const skewInfo = getSkewnessLabel(stats.skewness);
                        const kurtInfo = getKurtosisLabel(stats.kurtosis);
                        return (
                            <>
                                <Chip
                                    icon={skewInfo.icon || undefined}
                                    label={skewInfo.label}
                                    size="small"
                                    sx={{
                                        bgcolor: `${skewInfo.color}20`,
                                        color: skewInfo.color,
                                        border: `1px solid ${skewInfo.color}40`,
                                        fontWeight: 600,
                                    }}
                                />
                                <Chip
                                    icon={kurtInfo.icon || undefined}
                                    label={kurtInfo.label}
                                    size="small"
                                    sx={{
                                        bgcolor: `${kurtInfo.color}20`,
                                        color: kurtInfo.color,
                                        border: `1px solid ${kurtInfo.color}40`,
                                        fontWeight: 600,
                                    }}
                                />
                                <Chip
                                    label={`Win Rate: ${(stats.winRate * 100).toFixed(0)}%`}
                                    size="small"
                                    sx={{
                                        bgcolor: stats.winRate >= 0.5 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                                        color: stats.winRate >= 0.5 ? '#10B981' : '#EF4444',
                                        border: `1px solid ${stats.winRate >= 0.5 ? '#10B98140' : '#EF444440'}`,
                                        fontWeight: 600,
                                    }}
                                />
                            </>
                        );
                    })()}
                </Box>
            )}

            {/* Chart */}
            <Box sx={{ height: 350, width: '100%', position: 'relative' }}>
                {/* Gradient definition for area fill */}
                <svg width="0" height="0" style={{ position: 'absolute' }}>
                    <defs>
                        <linearGradient id={`areaGradient-${method?.method}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={methodColor.main} stopOpacity={0.5} />
                            <stop offset="100%" stopColor={methodColor.main} stopOpacity={0.05} />
                        </linearGradient>
                    </defs>
                </svg>

                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                        <defs>
                            <linearGradient id="barGradientPositive" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10B981" stopOpacity={0.9} />
                                <stop offset="100%" stopColor="#10B981" stopOpacity={0.5} />
                            </linearGradient>
                            <linearGradient id="barGradientNegative" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#EF4444" stopOpacity={0.9} />
                                <stop offset="100%" stopColor="#EF4444" stopOpacity={0.5} />
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
                            stroke="rgba(255,255,255,0.2)"
                            tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 500 }}
                            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                            allowDataOverflow={false}
                        />
                        <YAxis
                            stroke="rgba(255,255,255,0.2)"
                            tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                            tickLine={false}
                        />

                        {/* VaR Reference Line */}
                        {stats && (
                            <ReferenceLine
                                x={stats.var95}
                                stroke="#EF4444"
                                strokeWidth={2}
                                strokeDasharray="4 4"
                                label={{
                                    value: `VaR 95%`,
                                    position: 'top',
                                    fill: '#EF4444',
                                    fontWeight: 700,
                                    fontSize: 10
                                }}
                            />
                        )}

                        {/* Mean line */}
                        {stats && (
                            <ReferenceLine
                                x={stats.mean}
                                stroke={methodColor.main}
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                label={{
                                    value: 'μ',
                                    position: 'top',
                                    fill: methodColor.main,
                                    fontWeight: 700,
                                    fontSize: 14
                                }}
                            />
                        )}

                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />

                        {/* Smooth area under curve - RENDER FIRST (background) */}
                        <Area
                            type="natural"
                            dataKey="frequency"
                            stroke={methodColor.main}
                            strokeWidth={2.5}
                            fill={`url(#areaGradient-${method?.method})`}
                            fillOpacity={0.3}
                            connectNulls
                            name="Gaussian Fit"
                            animationDuration={1200}
                        />

                        {/* Histogram bars - RENDER SECOND (foreground) */}
                        <Bar
                            dataKey="count"
                            barSize={35}
                            radius={[4, 4, 0, 0]}
                        >
                            {chartData.map((entry: any, index: number) => {
                                if (entry.type === 'bin') {
                                    const fill = entry.x >= 0 ? 'url(#barGradientPositive)' : 'url(#barGradientNegative)';
                                    return (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={fill}
                                            style={{ cursor: 'pointer' }}
                                        />
                                    );
                                }
                                return <Cell key={`cell-${index}`} fill="transparent" />;
                            })}
                        </Bar>
                    </ComposedChart>
                </ResponsiveContainer>
            </Box>

            {/* Enhanced Stats Grid */}
            {stats && (
                <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                    gap: 2,
                    mt: 3,
                    pt: 3,
                    borderTop: '1px solid rgba(255,255,255,0.08)'
                }}>
                    {/* Mean Return */}
                    <Box sx={{
                        textAlign: 'center',
                        p: 2,
                        borderRadius: 2,
                        background: `linear-gradient(135deg, ${stats.mean >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}, transparent)`,
                        border: `1px solid ${stats.mean >= 0 ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                    }}>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em' }}>
                            Mean (μ)
                        </Typography>
                        <Typography variant="h6" sx={{
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            color: stats.mean >= 0 ? '#10B981' : '#EF4444',
                        }}>
                            {stats.mean >= 0 ? '+' : ''}{(stats.mean * 100).toFixed(2)}%
                        </Typography>
                    </Box>

                    {/* Std Dev */}
                    <Box sx={{
                        textAlign: 'center',
                        p: 2,
                        borderRadius: 2,
                        background: `linear-gradient(135deg, ${methodColor.main}15, transparent)`,
                        border: `1px solid ${methodColor.main}25`,
                    }}>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em' }}>
                            Volatility (σ)
                        </Typography>
                        <Typography variant="h6" sx={{
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            color: methodColor.main,
                        }}>
                            {(stats.stdDev * 100).toFixed(2)}%
                        </Typography>
                    </Box>

                    {/* VaR */}
                    <Box sx={{
                        textAlign: 'center',
                        p: 2,
                        borderRadius: 2,
                        background: 'linear-gradient(135deg, rgba(239,68,68,0.15), transparent)',
                        border: '1px solid rgba(239,68,68,0.25)',
                    }}>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em' }}>
                            VaR 95%
                        </Typography>
                        <Typography variant="h6" sx={{
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            color: '#EF4444',
                        }}>
                            {(stats.var95 * 100).toFixed(2)}%
                        </Typography>
                    </Box>

                    {/* CVaR / Expected Shortfall */}
                    <Box sx={{
                        textAlign: 'center',
                        p: 2,
                        borderRadius: 2,
                        background: 'linear-gradient(135deg, rgba(239,68,68,0.1), transparent)',
                        border: '1px solid rgba(239,68,68,0.2)',
                    }}>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em' }}>
                            CVaR (ES)
                        </Typography>
                        <Typography variant="h6" sx={{
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            color: '#F87171',
                        }}>
                            {(stats.cvar95 * 100).toFixed(2)}%
                        </Typography>
                    </Box>

                    {/* Skewness */}
                    <Box sx={{
                        textAlign: 'center',
                        p: 2,
                        borderRadius: 2,
                        background: 'linear-gradient(135deg, rgba(96,165,250,0.15), transparent)',
                        border: '1px solid rgba(96,165,250,0.25)',
                    }}>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em' }}>
                            Skewness
                        </Typography>
                        <Typography variant="h6" sx={{
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            color: '#60A5FA',
                        }}>
                            {stats.skewness.toFixed(2)}
                        </Typography>
                    </Box>

                    {/* Kurtosis */}
                    <Box sx={{
                        textAlign: 'center',
                        p: 2,
                        borderRadius: 2,
                        background: 'linear-gradient(135deg, rgba(245,158,11,0.15), transparent)',
                        border: '1px solid rgba(245,158,11,0.25)',
                    }}>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em' }}>
                            Kurtosis
                        </Typography>
                        <Typography variant="h6" sx={{
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            color: '#F59E0B',
                        }}>
                            {stats.kurtosis.toFixed(2)}
                        </Typography>
                    </Box>

                    {/* Best Month */}
                    <Box sx={{
                        textAlign: 'center',
                        p: 2,
                        borderRadius: 2,
                        background: 'linear-gradient(135deg, rgba(16,185,129,0.15), transparent)',
                        border: '1px solid rgba(16,185,129,0.25)',
                    }}>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em' }}>
                            Best Month
                        </Typography>
                        <Typography variant="h6" sx={{
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            color: '#10B981',
                        }}>
                            +{(stats.maxReturn * 100).toFixed(2)}%
                        </Typography>
                    </Box>

                    {/* Worst Month */}
                    <Box sx={{
                        textAlign: 'center',
                        p: 2,
                        borderRadius: 2,
                        background: 'linear-gradient(135deg, rgba(239,68,68,0.15), transparent)',
                        border: '1px solid rgba(239,68,68,0.25)',
                    }}>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em' }}>
                            Worst Month
                        </Typography>
                        <Typography variant="h6" sx={{
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            color: '#EF4444',
                        }}>
                            {(stats.minReturn * 100).toFixed(2)}%
                        </Typography>
                    </Box>
                </Box>
            )}
        </Paper>
    );
});

export default ReturnsDistributionChart;
