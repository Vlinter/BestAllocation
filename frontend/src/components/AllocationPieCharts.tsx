import React, { useMemo } from 'react';
import { Box, Paper, Typography, Chip } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Label } from 'recharts';
import { Today as TodayIcon, TrendingUp, TrendingDown } from '@mui/icons-material';
import type { MethodResult } from '../api/client';

interface AllocationPieChartsProps {
    methods: MethodResult[];
    date: string;
}

// Premium gradient colors with glow effects
const COLORS = [
    '#00D4AA', '#FF6B6B', '#4ECDC4', '#FFE66D', '#A78BFA',
    '#F472B6', '#60A5FA', '#34D399', '#FB923C', '#94A3B8',
];

const METHOD_COLORS: Record<string, { primary: string; glow: string; gradient: string }> = {
    nco: {
        primary: '#00D4AA',
        glow: 'rgba(0, 212, 170, 0.4)',
        gradient: 'linear-gradient(135deg, rgba(0, 212, 170, 0.15) 0%, rgba(0, 212, 170, 0.05) 100%)'
    },
    gmv: {
        primary: '#FFE66D',
        glow: 'rgba(255, 230, 109, 0.4)',
        gradient: 'linear-gradient(135deg, rgba(255, 230, 109, 0.15) 0%, rgba(255, 230, 109, 0.05) 100%)'
    },
    mdr: {
        primary: '#A78BFA',
        glow: 'rgba(167, 139, 250, 0.4)',
        gradient: 'linear-gradient(135deg, rgba(167, 139, 250, 0.15) 0%, rgba(167, 139, 250, 0.05) 100%)'
    },
};

const AllocationPieCharts: React.FC<AllocationPieChartsProps> = React.memo(({ methods, date }) => {
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <Paper
                    sx={{
                        p: 2,
                        bgcolor: 'rgba(23, 23, 23, 0.95)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(10px)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: payload[0].payload.fill }} />
                        <Typography variant="body1" sx={{ fontWeight: 700 }}>
                            {payload[0].name}
                        </Typography>
                    </Box>
                    <Typography variant="h5" sx={{ color: payload[0].payload.fill, fontWeight: 800, mt: 0.5 }}>
                        {(payload[0].value * 100).toFixed(1)}%
                    </Typography>
                </Paper>
            );
        }
        return null;
    };

    // Custom label for center of donut
    const CenterLabel = ({ value, color }: { value: number; color: string }) => (
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
            <tspan x="50%" dy="-0.3em" fill={color} fontSize="24" fontWeight="800">
                {value > 0 ? '+' : ''}{(value * 100).toFixed(1)}%
            </tspan>
            <tspan x="50%" dy="1.4em" fill="#888" fontSize="10">
                Total Return
            </tspan>
        </text>
    );

    return (
        <Paper
            sx={{
                p: 4,
                background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.8) 0%, rgba(15, 23, 42, 0.4) 100%)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.05)',
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                        Recommended Allocations
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                        <TodayIcon sx={{ fontSize: 16, color: '#00D4AA' }} />
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            Based on latest optimization • {date}
                        </Typography>
                    </Box>
                </Box>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 3 }}>
                {methods.map((method) => {
                    const methodStyle = METHOD_COLORS[method.method] || METHOD_COLORS.hrp;
                    const pieData = useMemo(() =>
                        Object.entries(method.current_allocation.weights)
                            .filter(([, weight]) => weight > 0.001)
                            .map(([ticker, weight], index) => ({
                                name: ticker,
                                value: weight,
                                fill: COLORS[index % COLORS.length],
                            }))
                            .sort((a, b) => b.value - a.value),
                        [method.current_allocation.weights]
                    );

                    const totalReturn = method.performance_metrics.total_return;
                    const isPositive = totalReturn >= 0;

                    return (
                        <Paper
                            key={method.method}
                            elevation={0}
                            sx={{
                                p: 3,
                                background: methodStyle.gradient,
                                border: `1px solid ${methodStyle.primary}40`,
                                borderRadius: 3,
                                position: 'relative',
                                overflow: 'hidden',
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    transform: 'translateY(-4px)',
                                    boxShadow: `0 20px 40px ${methodStyle.glow}`,
                                    borderColor: methodStyle.primary,
                                },
                                '&::before': {
                                    content: '""',
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: '3px',
                                    background: `linear-gradient(90deg, transparent, ${methodStyle.primary}, transparent)`,
                                }
                            }}
                        >
                            {/* Header */}
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                <Chip
                                    label={method.method_name}
                                    size="small"
                                    sx={{
                                        bgcolor: `${methodStyle.primary}25`,
                                        color: methodStyle.primary,
                                        fontWeight: 700,
                                        fontSize: '0.8rem',
                                        px: 1,
                                    }}
                                />
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    {isPositive ? (
                                        <TrendingUp sx={{ fontSize: 18, color: '#10B981' }} />
                                    ) : (
                                        <TrendingDown sx={{ fontSize: 18, color: '#EF4444' }} />
                                    )}
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            fontWeight: 700,
                                            color: isPositive ? '#10B981' : '#EF4444',
                                            fontFamily: 'monospace'
                                        }}
                                    >
                                        {isPositive ? '+' : ''}{(totalReturn * 100).toFixed(1)}%
                                    </Typography>
                                </Box>
                            </Box>

                            {/* Pie Chart */}
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <defs>
                                        {pieData.map((_, index) => (
                                            <filter key={`glow-${index}`} id={`glow-${method.method}-${index}`}>
                                                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                                                <feMerge>
                                                    <feMergeNode in="coloredBlur" />
                                                    <feMergeNode in="SourceGraphic" />
                                                </feMerge>
                                            </filter>
                                        ))}
                                    </defs>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={85}
                                        paddingAngle={3}
                                        dataKey="value"
                                        stroke="rgba(0,0,0,0.2)"
                                        strokeWidth={1}
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={entry.fill}
                                                style={{ filter: `drop-shadow(0 0 6px ${entry.fill}50)` }}
                                            />
                                        ))}
                                        <Label
                                            content={() => <CenterLabel value={totalReturn} color={isPositive ? '#10B981' : '#EF4444'} />}
                                        />
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>

                            {/* Legend */}
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, justifyContent: 'center', mt: 2 }}>
                                {pieData.slice(0, 5).map((entry) => (
                                    <Box
                                        key={entry.name}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 0.5,
                                            px: 1.5,
                                            py: 0.5,
                                            bgcolor: `${entry.fill}15`,
                                            borderRadius: 2,
                                            border: `1px solid ${entry.fill}30`,
                                        }}
                                    >
                                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: entry.fill, boxShadow: `0 0 8px ${entry.fill}` }} />
                                        <Typography variant="caption" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.7rem' }}>
                                            {entry.name}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#888', fontSize: '0.7rem' }}>
                                            {(entry.value * 100).toFixed(0)}%
                                        </Typography>
                                    </Box>
                                ))}
                                {pieData.length > 5 && (
                                    <Box sx={{ px: 1.5, py: 0.5, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
                                        <Typography variant="caption" sx={{ color: '#666' }}>
                                            +{pieData.length - 5} more
                                        </Typography>
                                    </Box>
                                )}
                            </Box>

                            {/* Bottom Stats */}
                            <Box
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'space-around',
                                    mt: 3,
                                    pt: 2,
                                    borderTop: '1px solid rgba(255,255,255,0.08)'
                                }}
                            >
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="caption" sx={{ color: '#666', display: 'block', fontSize: '0.65rem' }}>
                                        SHARPE
                                    </Typography>
                                    <Typography
                                        variant="body1"
                                        sx={{
                                            fontWeight: 800,
                                            fontSize: '1.1rem',
                                            color: method.performance_metrics.sharpe_ratio > 1 ? '#10B981'
                                                : method.performance_metrics.sharpe_ratio > 0.5 ? '#F59E0B'
                                                    : '#EF4444',
                                        }}
                                    >
                                        {method.performance_metrics.sharpe_ratio.toFixed(2)}
                                    </Typography>
                                </Box>
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="caption" sx={{ color: '#666', display: 'block', fontSize: '0.65rem' }}>
                                        MAX DD
                                    </Typography>
                                    <Typography variant="body1" sx={{ fontWeight: 800, fontSize: '1.1rem', color: '#EF4444' }}>
                                        {(method.performance_metrics.max_drawdown * 100).toFixed(1)}%
                                    </Typography>
                                </Box>
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="caption" sx={{ color: '#666', display: 'block', fontSize: '0.65rem' }}>
                                        CAGR
                                    </Typography>
                                    <Typography
                                        variant="body1"
                                        sx={{
                                            fontWeight: 800,
                                            fontSize: '1.1rem',
                                            color: method.performance_metrics.cagr > 0 ? '#10B981' : '#EF4444'
                                        }}
                                    >
                                        {(method.performance_metrics.cagr * 100).toFixed(1)}%
                                    </Typography>
                                </Box>
                            </Box>
                        </Paper>
                    );
                })}
            </Box>
        </Paper>
    );
});

export default AllocationPieCharts;

