import React, { useMemo, useState } from 'react';
import { Box, Paper, Typography, ToggleButtonGroup, ToggleButton } from '@mui/material';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    ReferenceLine
} from 'recharts';
import { BarChart as BarChartIcon, CalendarMonth, DateRange } from '@mui/icons-material';
import type { MethodResult } from '../api/client';

interface PerformanceHistogramProps {
    methods: MethodResult[];
}

const METHOD_COLORS: Record<string, { main: string; light: string }> = {
    hrp: { main: '#00D4AA', light: '#00FFD4' },
    gmv: { main: '#FFE66D', light: '#FFF094' },
    mvo: { main: '#A78BFA', light: '#C4B5FD' },
};

const PerformanceHistogram: React.FC<PerformanceHistogramProps> = React.memo(({ methods }) => {
    const [selectedMethodIndex, setSelectedMethodIndex] = useState(0);
    const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');

    const method = methods[selectedMethodIndex];
    const methodColor = METHOD_COLORS[method?.method] || METHOD_COLORS.hrp;

    // Calculate returns data based on view mode
    const chartData = useMemo(() => {
        if (!method?.equity_curve || method.equity_curve.length < 30) {
            return [];
        }

        const curve = method.equity_curve;

        if (viewMode === 'monthly') {
            // Group by year-month and calculate monthly returns
            const monthlyData: { label: string; value: number; date: Date }[] = [];
            let prevMonthValue: number | null = null;
            let currentYear = '';
            let currentMonth = -1;
            let currentMonthEndValue = 0;

            curve.forEach((point, index) => {
                const date = new Date(point.date);
                const year = date.getFullYear().toString();
                const month = date.getMonth();

                if (currentYear === year && currentMonth === month) {
                    // Same month, update end value
                    currentMonthEndValue = point.value;
                } else {
                    // New month - finalize previous month
                    if (prevMonthValue !== null && currentYear !== '') {
                        const returnVal = (currentMonthEndValue - prevMonthValue) / prevMonthValue;
                        if (!isNaN(returnVal) && Math.abs(returnVal) < 1) {
                            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                            monthlyData.push({
                                label: `${monthNames[currentMonth]} ${currentYear.slice(-2)}`,
                                value: returnVal * 100,
                                date: new Date(parseInt(currentYear), currentMonth)
                            });
                        }
                    }
                    prevMonthValue = point.value;
                    currentMonthEndValue = point.value;
                    currentYear = year;
                    currentMonth = month;
                }

                // Handle last point
                if (index === curve.length - 1 && prevMonthValue !== null) {
                    const returnVal = (currentMonthEndValue - prevMonthValue) / prevMonthValue;
                    if (!isNaN(returnVal) && Math.abs(returnVal) < 1) {
                        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        monthlyData.push({
                            label: `${monthNames[currentMonth]} ${currentYear.slice(-2)}`,
                            value: returnVal * 100,
                            date: new Date(parseInt(currentYear), currentMonth)
                        });
                    }
                }
            });

            return monthlyData.sort((a, b) => a.date.getTime() - b.date.getTime());
        } else {
            // Yearly returns
            const yearlyData: { label: string; value: number; year: number }[] = [];
            const yearStartValues: Record<string, number> = {};
            const yearEndValues: Record<string, number> = {};

            curve.forEach((point) => {
                const date = new Date(point.date);
                const year = date.getFullYear().toString();

                if (!yearStartValues[year]) {
                    yearStartValues[year] = point.value;
                }
                yearEndValues[year] = point.value;
            });

            Object.keys(yearStartValues).sort().forEach(year => {
                const startVal = yearStartValues[year];
                const endVal = yearEndValues[year];
                const returnVal = (endVal - startVal) / startVal;

                if (!isNaN(returnVal) && Math.abs(returnVal) < 5) {
                    yearlyData.push({
                        label: year,
                        value: returnVal * 100,
                        year: parseInt(year)
                    });
                }
            });

            return yearlyData.sort((a, b) => a.year - b.year);
        }
    }, [method, viewMode]);

    // Custom tooltip
    const CustomTooltip = ({ active, payload }: any) => {
        if (!active || !payload || !payload[0]) return null;

        const data = payload[0].payload;
        const value = data.value;
        const isPositive = value >= 0;

        return (
            <Box
                sx={{
                    bgcolor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 2,
                    p: 1.5,
                    backdropFilter: 'blur(10px)',
                }}
            >
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    {data.label}
                </Typography>
                <Typography
                    variant="h6"
                    sx={{
                        fontWeight: 700,
                        color: isPositive ? '#10B981' : '#EF4444',
                        fontFamily: 'monospace'
                    }}
                >
                    {isPositive ? '+' : ''}{value.toFixed(2)}%
                </Typography>
            </Box>
        );
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
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                        <BarChartIcon sx={{ fontSize: 28, color: methodColor.main }} />
                        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                            Performance Histogram
                        </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {viewMode === 'monthly' ? 'Monthly' : 'Yearly'} returns • Green = gains, Red = losses
                    </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    {/* View Mode Toggle */}
                    <ToggleButtonGroup
                        value={viewMode}
                        exclusive
                        onChange={(_, v) => v !== null && setViewMode(v)}
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
                        <ToggleButton value="monthly">
                            <CalendarMonth sx={{ fontSize: 18, mr: 0.5 }} />
                            Month
                        </ToggleButton>
                        <ToggleButton value="yearly">
                            <DateRange sx={{ fontSize: 18, mr: 0.5 }} />
                            Year
                        </ToggleButton>
                    </ToggleButtonGroup>

                    {/* Strategy Selector */}
                    <ToggleButtonGroup
                        value={selectedMethodIndex}
                        exclusive
                        onChange={(_, v) => v !== null && setSelectedMethodIndex(v)}
                        size="small"
                        sx={{
                            '& .MuiToggleButton-root': {
                                px: 2,
                                borderColor: 'rgba(255,255,255,0.1)',
                                '&.Mui-selected': {
                                    bgcolor: 'rgba(16, 185, 129, 0.2)',
                                    color: '#10B981',
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
            </Box>

            {/* Chart */}
            {chartData.length > 0 ? (
                <Box sx={{ height: 350 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={chartData}
                            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                        >
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="rgba(255,255,255,0.05)"
                                vertical={false}
                            />
                            <XAxis
                                dataKey="label"
                                tick={{ fill: '#9CA3AF', fontSize: 10 }}
                                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                tickLine={false}
                                angle={-45}
                                textAnchor="end"
                                interval={viewMode === 'monthly' ? Math.floor(chartData.length / 12) : 0}
                            />
                            <YAxis
                                tick={{ fill: '#9CA3AF', fontSize: 11 }}
                                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                tickLine={false}
                                tickFormatter={(v) => `${v.toFixed(0)}%`}
                                domain={['auto', 'auto']}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                            <ReferenceLine y={0} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                            <Bar
                                dataKey="value"
                                radius={[4, 4, 0, 0]}
                                maxBarSize={viewMode === 'yearly' ? 60 : 20}
                            >
                                {chartData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.value >= 0 ? '#10B981' : '#EF4444'}
                                        fillOpacity={0.85}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </Box>
            ) : (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Insufficient data for histogram
                    </Typography>
                </Box>
            )}

            {/* Stats Summary */}
            {chartData.length > 0 && (
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
                    {(() => {
                        const positiveMonths = chartData.filter(d => d.value >= 0).length;
                        const avgReturn = chartData.reduce((a, b) => a + b.value, 0) / chartData.length;
                        const maxReturn = Math.max(...chartData.map(d => d.value));
                        const minReturn = Math.min(...chartData.map(d => d.value));

                        return (
                            <>
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                        Win Rate
                                    </Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#10B981' }}>
                                        {((positiveMonths / chartData.length) * 100).toFixed(0)}%
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                        ({positiveMonths}/{chartData.length})
                                    </Typography>
                                </Box>
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                        Avg Return
                                    </Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 700, color: avgReturn >= 0 ? '#10B981' : '#EF4444' }}>
                                        {avgReturn >= 0 ? '+' : ''}{avgReturn.toFixed(2)}%
                                    </Typography>
                                </Box>
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                        Best {viewMode === 'monthly' ? 'Month' : 'Year'}
                                    </Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#10B981' }}>
                                        +{maxReturn.toFixed(2)}%
                                    </Typography>
                                </Box>
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                        Worst {viewMode === 'monthly' ? 'Month' : 'Year'}
                                    </Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#EF4444' }}>
                                        {minReturn.toFixed(2)}%
                                    </Typography>
                                </Box>
                            </>
                        );
                    })()}
                </Box>
            )}
        </Paper>
    );
});

export default PerformanceHistogram;
