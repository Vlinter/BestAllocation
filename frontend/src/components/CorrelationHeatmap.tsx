import React from 'react';
import { Box, Paper, Typography, Tooltip } from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';
import type { CorrelationMatrix } from '../api/client';
import DendrogramChart from './DendrogramChart';

interface CorrelationHeatmapProps {
    data: CorrelationMatrix;
    dendrogramData?: any;
}

// Color scale: -1 (red) to 0 (white) to +1 (green)
const getCorrelationColor = (value: number): string => {
    // Clamp between -1 and 1
    const v = Math.max(-1, Math.min(1, value));

    if (v >= 0) {
        // 0 to 1: white to green
        const intensity = Math.round(v * 180);
        return `rgb(${220 - intensity}, ${220 + intensity * 0.15}, ${220 - intensity})`;
    } else {
        // -1 to 0: red to white
        const intensity = Math.round(Math.abs(v) * 180);
        return `rgb(${220 + intensity * 0.15}, ${220 - intensity}, ${220 - intensity})`;
    }
};

const getTextColor = (value: number): string => {
    return Math.abs(value) > 0.5 ? '#fff' : '#1e293b';
};

const CorrelationHeatmap: React.FC<CorrelationHeatmapProps> = ({ data, dendrogramData }) => {
    const { tickers, matrix } = data;
    const n = tickers.length;

    // Debug
    console.log('CorrelationHeatmap dendrogramData:', dendrogramData);

    if (n === 0 || matrix.length === 0) {
        return (
            <Paper sx={{ p: 3 }}>
                <Typography variant="body2" color="text.secondary">
                    No correlation data available.
                </Typography>
            </Paper>
        );
    }

    const cellSize = Math.min(50, Math.max(30, 400 / n));

    return (
        <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    Asset Correlation Matrix
                </Typography>
                <Tooltip
                    title="Correlation between assets ordered by hierarchical clustering. Similar assets are grouped together. Green = positive correlation, Red = negative correlation, White = no correlation."
                    arrow
                >
                    <InfoIcon sx={{ fontSize: 18, color: 'text.secondary', cursor: 'help' }} />
                </Tooltip>
            </Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                Assets ordered by similarity (hierarchical clustering). Low correlation = better diversification.
            </Typography>

            <Box sx={{ overflowX: 'auto', pb: 2 }}>
                <Box sx={{ display: 'inline-block', minWidth: 'fit-content' }}>
                    {/* Header row with ticker labels */}
                    <Box sx={{ display: 'flex', ml: `${cellSize + 8}px` }}>
                        {tickers.map((ticker, i) => (
                            <Box
                                key={`header-${i}`}
                                sx={{
                                    width: cellSize,
                                    height: cellSize,
                                    display: 'flex',
                                    alignItems: 'flex-end',
                                    justifyContent: 'center',
                                    pb: 0.5,
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    sx={{
                                        fontSize: Math.min(10, cellSize / 4),
                                        fontWeight: 600,
                                        color: 'text.secondary',
                                        transform: 'rotate(-45deg)',
                                        transformOrigin: 'center center',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {ticker}
                                </Typography>
                            </Box>
                        ))}
                    </Box>

                    {/* Matrix rows */}
                    {matrix.map((row, i) => (
                        <Box key={`row-${i}`} sx={{ display: 'flex', alignItems: 'center' }}>
                            {/* Row label */}
                            <Box
                                sx={{
                                    width: cellSize,
                                    pr: 1,
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    sx={{
                                        fontSize: Math.min(11, cellSize / 3.5),
                                        fontWeight: 600,
                                        color: 'text.secondary',
                                    }}
                                >
                                    {tickers[i]}
                                </Typography>
                            </Box>

                            {/* Row cells */}
                            {row.map((value, j) => (
                                <Tooltip
                                    key={`cell-${i}-${j}`}
                                    title={`${tickers[i]} ↔ ${tickers[j]}: ${value.toFixed(2)}`}
                                    arrow
                                >
                                    <Box
                                        sx={{
                                            width: cellSize,
                                            height: cellSize,
                                            backgroundColor: getCorrelationColor(value),
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: '1px solid rgba(0,0,0,0.1)',
                                            cursor: 'pointer',
                                            transition: 'transform 0.1s',
                                            '&:hover': {
                                                transform: 'scale(1.1)',
                                                zIndex: 10,
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                            },
                                        }}
                                    >
                                        {cellSize >= 35 && (
                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    fontSize: Math.min(9, cellSize / 4.5),
                                                    fontWeight: 600,
                                                    color: getTextColor(value),
                                                }}
                                            >
                                                {value.toFixed(1)}
                                            </Typography>
                                        )}
                                    </Box>
                                </Tooltip>
                            ))}
                        </Box>
                    ))}
                </Box>
            </Box>

            {/* Color scale legend */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Correlation:
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{
                        width: 20, height: 20,
                        backgroundColor: getCorrelationColor(-1),
                        border: '1px solid rgba(0,0,0,0.2)',
                        borderRadius: 0.5,
                    }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>-1</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{
                        width: 20, height: 20,
                        backgroundColor: getCorrelationColor(0),
                        border: '1px solid rgba(0,0,0,0.2)',
                        borderRadius: 0.5,
                    }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>0</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{
                        width: 20, height: 20,
                        backgroundColor: getCorrelationColor(1),
                        border: '1px solid rgba(0,0,0,0.2)',
                        borderRadius: 0.5,
                    }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>+1</Typography>
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', ml: 2 }}>
                    💡 Diversified portfolios have mostly white/red correlations between different assets.
                </Typography>
            </Box>
            {dendrogramData && (
                <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <DendrogramChart data={dendrogramData} height={500} />
                </Box>
            )}
        </Paper>
    );
};

export default CorrelationHeatmap;
