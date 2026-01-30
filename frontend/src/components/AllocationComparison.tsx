import React, { useMemo } from 'react';
import { Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Today as TodayIcon } from '@mui/icons-material';
import type { MethodResult } from '../api/client';

interface AllocationComparisonProps {
    methods: MethodResult[];
    date: string;
}

// Method details for consistent coloring/styling
const METHOD_DETAILS: Record<string, { label: string; color: string }> = {
    mvo: { label: 'MVO (Mean-Variance)', color: '#A78BFA' },
    gmv: { label: 'GMV (Min Variance)', color: '#FFE66D' },
    hrp: { label: 'HRP (Hierarchical Risk Parity)', color: '#00D4AA' },
    nco: { label: 'NCO (Legacy)', color: '#00D4AA' },
    cla: { label: 'CLA', color: '#F472B6' },
};

const AllocationComparison: React.FC<AllocationComparisonProps> = React.memo(({ methods, date }) => {

    // Transform data for the Bar Chart
    const chartData = useMemo(() => {
        // 1. Collect all unique assets across all methods
        const allAssets = new Set<string>();
        methods.forEach(method => {
            Object.keys(method.current_allocation.weights).forEach(asset => {
                if (method.current_allocation.weights[asset] > 0.001) { // Filter tiny weights
                    allAssets.add(asset);
                }
            });
        });

        // 2. Create data points for each asset
        const data = Array.from(allAssets).map(asset => {
            const point: any = { name: asset };
            methods.forEach(method => {
                const weight = method.current_allocation.weights[asset] || 0;
                point[method.method] = weight * 100; // Convert to percentage
            });
            // Calculate max weight for sorting
            point.maxWeight = Math.max(...methods.map(m => point[m.method] || 0));
            return point;
        });

        // 3. Sort by the highest allocation in any method to keep important assets first
        return data.sort((a, b) => b.maxWeight - a.maxWeight);
    }, [methods]);

    // Custom Tooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
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
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>{label}</Typography>
                    {payload.map((entry: any) => (
                        <Box key={entry.name} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: entry.fill }} />
                            <Typography variant="body2" sx={{ color: '#ccc', minWidth: 60 }}>
                                {METHOD_DETAILS[entry.name]?.label.split(' ')[0] || entry.name}:
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#fff' }}>
                                {entry.value.toFixed(1)}%
                            </Typography>
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
                borderRadius: 4,
            }}
        >
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 1 }}>
                        Allocation Comparison
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TodayIcon sx={{ fontSize: 16, color: '#00D4AA' }} />
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            Strategy breakdown • {date}
                        </Typography>
                    </Box>
                </Box>
            </Box>

            {/* Chart Section */}
            <Box sx={{ height: 400, mb: 6 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={chartData}
                        margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                        barGap={2}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis
                            dataKey="name"
                            stroke="#666"
                            tick={{ fill: '#888', fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            stroke="#666"
                            tick={{ fill: '#888', fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                            unit="%"
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                        <Legend
                            wrapperStyle={{ paddingTop: '20px' }}
                            formatter={(value) => (
                                <span style={{ color: '#ccc', fontSize: '14px', fontWeight: 500 }}>
                                    {METHOD_DETAILS[value]?.label || value}
                                </span>
                            )}
                        />
                        {methods.map((method) => (
                            <Bar
                                key={method.method}
                                dataKey={method.method}
                                fill={METHOD_DETAILS[method.method]?.color || '#888'}
                                radius={[4, 4, 0, 0]}
                                maxBarSize={60}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </Box>

            {/* Metrics Comparison Table */}
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: 'text.secondary' }}>
                Performance Metrics
            </Typography>
            <TableContainer component={Paper} sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ color: '#888', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Strategy</TableCell>
                            <TableCell align="right" sx={{ color: '#888', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Sharpe Ratio</TableCell>
                            <TableCell align="right" sx={{ color: '#888', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Max Drawdown</TableCell>
                            <TableCell align="right" sx={{ color: '#888', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>CAGR</TableCell>
                            <TableCell align="right" sx={{ color: '#888', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Total Return</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {methods.map((method) => {
                            const details = METHOD_DETAILS[method.method] || { label: method.method, color: '#fff' };
                            const metrics = method.performance_metrics;
                            return (
                                <TableRow key={method.method} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                    <TableCell component="th" scope="row" sx={{ color: '#fff', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: details.color }} />
                                            {details.label}
                                        </Box>
                                    </TableCell>
                                    <TableCell align="right" sx={{ color: metrics.sharpe_ratio > 1 ? '#10B981' : metrics.sharpe_ratio > 0.5 ? '#F59E0B' : '#EF4444', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        {metrics.sharpe_ratio.toFixed(2)}
                                    </TableCell>
                                    <TableCell align="right" sx={{ color: '#EF4444', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        {(metrics.max_drawdown * 100).toFixed(1)}%
                                    </TableCell>
                                    <TableCell align="right" sx={{ color: metrics.cagr > 0 ? '#10B981' : '#EF4444', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        {(metrics.cagr * 100).toFixed(1)}%
                                    </TableCell>
                                    <TableCell align="right" sx={{ color: metrics.total_return > 0 ? '#10B981' : '#EF4444', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        {(metrics.total_return * 100).toFixed(1)}%
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
});

export default AllocationComparison;
