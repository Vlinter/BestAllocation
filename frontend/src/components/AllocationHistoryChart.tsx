import { Paper, Typography, Box, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceArea } from 'recharts';
import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import type { AllocationEntry } from '../api/client';

interface AllocationHistoryChartProps {
    allocationHistory: AllocationEntry[];
    tickers: string[];
    methodName: string;
}

const COLORS = [
    '#00D4AA', '#FF6B6B', '#4ECDC4', '#FFE66D', '#A78BFA',
    '#F472B6', '#60A5FA', '#34D399', '#FB923C', '#CBD5E1',
];

const AllocationHistoryChart: React.FC<AllocationHistoryChartProps> = React.memo(({
    allocationHistory,
    tickers,
    methodName,
}) => {
    const [showPercentage, setShowPercentage] = useState(true);

    // Memoize data transformation
    const chartData = useMemo(() => {
        return allocationHistory.map((entry) => {
            const dataPoint: Record<string, number | string> = { date: entry.date };
            let totalInvested = 0;

            tickers.forEach((ticker) => {
                const weight = typeof entry[ticker] === 'number' ? entry[ticker] as number : 0;
                totalInvested += weight;
                dataPoint[ticker] = showPercentage ? weight * 100 : weight;
            });

            // Implicit value for Cash if total invested < 1.0 (with small buffer for float errors)
            const cash = Math.max(0, 1.0 - totalInvested);
            if (cash > 0.001) {
                dataPoint['Cash'] = showPercentage ? cash * 100 : cash;
            } else {
                dataPoint['Cash'] = 0;
            }

            return dataPoint;
        });
    }, [allocationHistory, tickers, showPercentage]);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <Paper sx={{ p: 1.5, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                        {label}
                    </Typography>
                    {payload.map((entry: any, index: number) => (
                        <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                            <Typography variant="body2" sx={{ color: entry.color }}>
                                {entry.name}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {showPercentage ? `${entry.value.toFixed(1)}%` : entry.value.toFixed(4)}
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Allocation Evolution - {methodName}
                </Typography>
                <ToggleButtonGroup
                    size="small"
                    value={showPercentage ? 'pct' : 'dec'}
                    exclusive
                    onChange={(_, val) => val && setShowPercentage(val === 'pct')}
                >
                    <ToggleButton value="pct">%</ToggleButton>
                    <ToggleButton value="dec">Dec</ToggleButton>
                </ToggleButtonGroup>
            </Box>

            <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                    <defs>
                        <pattern id="diagonalHatch" patternUnits="userSpaceOnUse" width="4" height="4">
                            <path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2" stroke="#EF4444" strokeWidth="1" opacity="0.5" />
                        </pattern>
                    </defs>
                    <XAxis
                        dataKey="date"
                        tick={{ fill: '#888', fontSize: 11 }}
                        tickFormatter={(date) => format(new Date(date), 'MMM yy')}
                    />
                    <YAxis
                        tick={{ fill: '#888', fontSize: 11 }}
                        tickFormatter={(val) => showPercentage ? `${val}%` : val.toFixed(2)}
                        domain={showPercentage ? [0, 100] : [0, 1]}
                        allowDataOverflow={true}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    {/* Render Fallback (Defensive Mode) Zones - Grouped by Blocks */}
                    {(() => {
                        const blocks: { start: string; end: string }[] = [];
                        let currentBlockStart: string | null = null;

                        allocationHistory.forEach((entry, idx) => {
                            const isFallback = !!entry._fallback;
                            const nextIsFallback = allocationHistory[idx + 1]?._fallback;

                            if (isFallback) {
                                if (!currentBlockStart) {
                                    currentBlockStart = entry.date;
                                }
                                // If next is NOT fallback or we are at the end, close the block
                                if (!nextIsFallback) {
                                    blocks.push({
                                        start: currentBlockStart,
                                        end: entry.date // Use current entry date as end of block visual (or next entry for width)
                                    });
                                    currentBlockStart = null;
                                }
                            }
                        });

                        return blocks.map((block, i) => (
                            <ReferenceArea
                                key={`fallback-block-${i}`}
                                x1={block.start}
                                x2={block.end}
                                fill="url(#diagonalHatch)"
                                fillOpacity={0.35}
                            />
                        ));
                    })()}

                    {/* Explicit Cash Area - Rendered FIRST so it's at the bottom of the stack */}
                    <Area
                        key="Cash"
                        type="monotone"
                        dataKey="Cash"
                        name="Cash / Money Market"
                        stackId="1"
                        fill="#64748B" // Slate 500
                        stroke="#475569"
                        fillOpacity={0.7}
                        isAnimationActive={false}
                    />
                    {tickers.map((ticker, index) => (
                        <Area
                            key={ticker}
                            type="monotone"
                            dataKey={ticker}
                            stackId="1"
                            fill={COLORS[index % COLORS.length]}
                            stroke={COLORS[index % COLORS.length]}
                            fillOpacity={0.8}
                            isAnimationActive={false}
                        />
                    ))}
                </AreaChart>
            </ResponsiveContainer>
        </Paper>
    );
});

export default AllocationHistoryChart;

