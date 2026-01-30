import React, { useMemo } from 'react';
import { Box, Paper, Typography, Tooltip as MuiTooltip, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { CalendarMonth, TrendingUp, TrendingDown } from '@mui/icons-material';
import type { MethodResult } from '../api/client';

interface MonthlyReturnsHeatmapProps {
    methods: MethodResult[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Get color based on return value
const getReturnColor = (value: number | null): string => {
    if (value === null) return 'rgba(255,255,255,0.03)';

    if (value >= 0.08) return '#059669';      // Strong green
    if (value >= 0.04) return '#10B981';
    if (value >= 0.02) return '#34D399';
    if (value >= 0.01) return '#6EE7B7';
    if (value >= 0) return '#A7F3D0';          // Light green
    if (value >= -0.01) return '#FECACA';      // Light red
    if (value >= -0.02) return '#FCA5A5';
    if (value >= -0.04) return '#F87171';
    if (value >= -0.08) return '#EF4444';
    return '#DC2626';                          // Strong red
};

// Get text color for readability
const getTextColor = (value: number | null): string => {
    if (value === null) return '#6B7280';
    if (Math.abs(value) < 0.02) return '#111827';
    return '#FFFFFF';
};

const MonthlyReturnsHeatmap: React.FC<MonthlyReturnsHeatmapProps> = React.memo(({ methods }) => {
    const [selectedMethod, setSelectedMethod] = React.useState(0);

    const method = methods[selectedMethod];

    // Calculate monthly returns from equity curve
    const { yearlyData, years, yearAverages } = useMemo(() => {
        if (!method?.equity_curve || method.equity_curve.length < 30) {
            return { yearlyData: {}, years: [], yearAverages: {} };
        }

        const monthly: Record<string, Record<number, number>> = {};
        const curve = method.equity_curve;

        // Group by year-month and calculate returns
        let prevMonthValue: number | null = null;
        let currentYear = '';
        let currentMonth = -1;

        curve.forEach((point) => {
            const date = new Date(point.date);
            const year = date.getFullYear().toString();
            const month = date.getMonth();

            if (!monthly[year]) {
                monthly[year] = {};
            }

            // End of month: calculate return
            if (currentYear === year && currentMonth === month) {
                // Same month, update end value
                monthly[year][month] = point.value;
            } else {
                // New month
                if (prevMonthValue !== null && monthly[currentYear]?.[currentMonth] !== undefined) {
                    const endValue = monthly[currentYear][currentMonth];
                    monthly[currentYear][currentMonth] = (endValue - prevMonthValue) / prevMonthValue;
                }
                prevMonthValue = point.value;
                monthly[year][month] = point.value;
                currentYear = year;
                currentMonth = month;
            }
        });

        // Fix last month
        if (prevMonthValue !== null && monthly[currentYear]?.[currentMonth] !== undefined) {
            const endValue = monthly[currentYear][currentMonth];
            monthly[currentYear][currentMonth] = (endValue - prevMonthValue) / prevMonthValue;
        }

        // Calculate year averages
        const avgs: Record<string, number> = {};
        Object.keys(monthly).forEach(year => {
            const monthReturns = Object.values(monthly[year]).filter(v => typeof v === 'number' && !isNaN(v) && Math.abs(v) < 1);
            if (monthReturns.length > 0) {
                avgs[year] = monthReturns.reduce((a, b) => a + b, 0) / monthReturns.length;
            }
        });

        return {
            yearlyData: monthly,
            years: Object.keys(monthly).sort(),
            yearAverages: avgs,
        };
    }, [method]);

    const getCellValue = (year: string, month: number): number | null => {
        const val = yearlyData[year]?.[month];
        if (val === undefined || isNaN(val) || Math.abs(val) > 1) return null;
        return val;
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
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                        <CalendarMonth sx={{ fontSize: 28, color: '#10B981' }} />
                        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                            Monthly Returns
                        </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Calendar heatmap • Green = gains, Red = losses
                    </Typography>
                </Box>

                {/* Strategy Selector */}
                <ToggleButtonGroup
                    value={selectedMethod}
                    exclusive
                    onChange={(_, v) => v !== null && setSelectedMethod(v)}
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

            {/* Heatmap Grid */}
            {years.length > 0 ? (
                <Box sx={{ overflowX: 'auto' }}>
                    <Box sx={{ display: 'inline-block', minWidth: '100%' }}>
                        {/* Header Row */}
                        <Box sx={{ display: 'flex', gap: 0.5, mb: 0.5 }}>
                            <Box sx={{ width: 50, flexShrink: 0 }} />
                            {MONTHS.map(month => (
                                <Box
                                    key={month}
                                    sx={{
                                        width: 48,
                                        textAlign: 'center',
                                        py: 0.5,
                                    }}
                                >
                                    <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 600, fontSize: '0.65rem' }}>
                                        {month}
                                    </Typography>
                                </Box>
                            ))}
                            <Box sx={{ width: 60, textAlign: 'center', py: 0.5 }}>
                                <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 600, fontSize: '0.65rem' }}>
                                    AVG
                                </Typography>
                            </Box>
                        </Box>

                        {/* Data Rows */}
                        {years.map((year, rowIndex) => (
                            <Box
                                key={year}
                                sx={{
                                    display: 'flex',
                                    gap: 0.5,
                                    mb: 0.5,
                                    opacity: 0,
                                    animation: `fadeInUp 0.4s ease-out ${rowIndex * 50}ms forwards`,
                                    '@keyframes fadeInUp': {
                                        from: { opacity: 0, transform: 'translateY(10px)' },
                                        to: { opacity: 1, transform: 'translateY(0)' },
                                    },
                                }}
                            >
                                {/* Year Label */}
                                <Box sx={{ width: 50, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                    <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 700, fontSize: '0.75rem' }}>
                                        {year}
                                    </Typography>
                                </Box>

                                {/* Month Cells */}
                                {MONTHS.map((_, monthIndex) => {
                                    const value = getCellValue(year, monthIndex);
                                    const bgColor = getReturnColor(value);
                                    const textColor = getTextColor(value);

                                    return (
                                        <MuiTooltip
                                            key={monthIndex}
                                            title={
                                                value !== null ? (
                                                    <Box sx={{ p: 0.5 }}>
                                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                            {MONTHS[monthIndex]} {year}
                                                        </Typography>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                                            {value >= 0 ? (
                                                                <TrendingUp sx={{ fontSize: 14, color: '#10B981' }} />
                                                            ) : (
                                                                <TrendingDown sx={{ fontSize: 14, color: '#EF4444' }} />
                                                            )}
                                                            <Typography
                                                                variant="body2"
                                                                sx={{
                                                                    fontWeight: 700,
                                                                    color: value >= 0 ? '#10B981' : '#EF4444',
                                                                    fontFamily: 'monospace'
                                                                }}
                                                            >
                                                                {value >= 0 ? '+' : ''}{(value * 100).toFixed(2)}%
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                ) : 'No data'
                                            }
                                            arrow
                                        >
                                            <Box
                                                sx={{
                                                    width: 48,
                                                    height: 32,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    bgcolor: bgColor,
                                                    borderRadius: 1,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease',
                                                    '&:hover': {
                                                        transform: 'scale(1.1)',
                                                        boxShadow: `0 4px 12px ${bgColor}60`,
                                                        zIndex: 1,
                                                    },
                                                }}
                                            >
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        color: textColor,
                                                        fontWeight: 600,
                                                        fontSize: '0.6rem',
                                                        fontFamily: 'monospace',
                                                    }}
                                                >
                                                    {value !== null ? `${(value * 100).toFixed(1)}` : ''}
                                                </Typography>
                                            </Box>
                                        </MuiTooltip>
                                    );
                                })}

                                {/* Year Average */}
                                <Box
                                    sx={{
                                        width: 60,
                                        height: 32,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        bgcolor: getReturnColor(yearAverages[year] || null),
                                        borderRadius: 1,
                                        border: '1px solid rgba(255,255,255,0.1)',
                                    }}
                                >
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            color: getTextColor(yearAverages[year] || null),
                                            fontWeight: 700,
                                            fontSize: '0.65rem',
                                            fontFamily: 'monospace',
                                        }}
                                    >
                                        {yearAverages[year] !== undefined
                                            ? `${(yearAverages[year] * 100).toFixed(1)}%`
                                            : '-'}
                                    </Typography>
                                </Box>
                            </Box>
                        ))}
                    </Box>
                </Box>
            ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Insufficient data for monthly breakdown
                    </Typography>
                </Box>
            )}

            {/* Legend */}
            <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <Typography variant="caption" sx={{ color: '#EF4444', mr: 1 }}>← Loss</Typography>
                {[-8, -4, -2, 0, 2, 4, 8].map(val => (
                    <Box
                        key={val}
                        sx={{
                            width: 24,
                            height: 16,
                            bgcolor: getReturnColor(val / 100),
                            borderRadius: 0.5,
                        }}
                    />
                ))}
                <Typography variant="caption" sx={{ color: '#10B981', ml: 1 }}>Gain →</Typography>
            </Box>
        </Paper>
    );
});

export default MonthlyReturnsHeatmap;
