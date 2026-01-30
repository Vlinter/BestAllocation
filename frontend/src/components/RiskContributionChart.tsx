import React, { useState } from 'react';
import { Box, Paper, Typography, Tooltip } from '@mui/material';
import { Info as InfoIcon, TrendingUp } from '@mui/icons-material';
import type { MethodResult } from '../api/client';

interface RiskContributionChartProps {
    methods: MethodResult[];
    priceData?: { [ticker: string]: number[] };
}

const METHOD_COLORS: Record<string, string> = {
    hrp: '#00D4AA',
    nco: '#00D4AA',
    gmv: '#FFE66D',
    mvo: '#A78BFA',
};

// Enhanced color palette with gradients
const ASSET_GRADIENT_COLORS = [
    { start: '#00D4AA', end: '#00A884' },
    { start: '#FF6B6B', end: '#E85555' },
    { start: '#4ECDC4', end: '#3BB5AD' },
    { start: '#FFE66D', end: '#E6CF5C' },
    { start: '#A78BFA', end: '#9270E8' },
    { start: '#F472B6', end: '#DC5EA0' },
    { start: '#60A5FA', end: '#4A8DE8' },
    { start: '#34D399', end: '#2CB97F' },
    { start: '#FB923C', end: '#E97A26' },
    { start: '#CBD5E1', end: '#B0BBC7' },
];

const RiskContributionChart: React.FC<RiskContributionChartProps> = ({ methods }) => {
    const [hoveredMethod, setHoveredMethod] = useState<string | null>(null);

    return (
        <Paper sx={{
            p: 3,
            background: 'linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.95) 100%)',
        }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TrendingUp sx={{ color: '#00D4AA', filter: 'drop-shadow(0 0 8px #00D4AA)' }} />
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff' }}>
                    Weight vs Risk Contribution
                </Typography>
                <Tooltip
                    title="Compares capital allocation (Weight) vs marginal risk contribution (Risk). High volatility assets contribute more risk than their weight suggests."
                    arrow
                >
                    <InfoIcon sx={{ fontSize: 18, color: 'text.secondary', cursor: 'help' }} />
                </Tooltip>
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 3 }}>
                True marginal risk contribution calculated from the covariance matrix.
            </Typography>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {methods.map((method) => {
                    const weights = method.current_allocation.weights;
                    const riskContribs = method.current_allocation.risk_contributions || {};

                    const tickers = Object.keys(weights)
                        .filter(t => weights[t] > 0.01)
                        .sort((a, b) => weights[b] - weights[a])
                        .slice(0, 8);

                    const riskConcentration = Math.max(...Object.values(riskContribs));
                    const hhi = Object.values(riskContribs).reduce((acc, val) => acc + val ** 2, 0);
                    const isWellBalanced = riskConcentration < 0.30;
                    const isHovered = hoveredMethod === method.method;

                    return (
                        <Box
                            key={method.method}
                            sx={{ flex: '1 1 350px', minWidth: 320, maxWidth: 450 }}
                            onMouseEnter={() => setHoveredMethod(method.method)}
                            onMouseLeave={() => setHoveredMethod(null)}
                        >
                            <Paper
                                elevation={0}
                                sx={{
                                    p: 2.5,
                                    background: 'linear-gradient(135deg, rgba(30,41,59,0.8) 0%, rgba(15,23,42,0.9) 100%)',
                                    border: '1px solid',
                                    borderColor: METHOD_COLORS[method.method] || '#00D4AA',
                                    borderRadius: 2,
                                    boxShadow: isHovered
                                        ? `0 8px 32px ${METHOD_COLORS[method.method]}40`
                                        : '0 4px 16px rgba(0,0,0,0.3)',
                                    transition: 'all 0.3s ease',
                                    transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                                }}
                            >
                                {/* Header */}
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                    <Typography
                                        variant="subtitle1"
                                        sx={{
                                            fontWeight: 700,
                                            color: METHOD_COLORS[method.method],
                                            textShadow: `0 0 12px ${METHOD_COLORS[method.method]}80`,
                                            fontSize: '1.1rem'
                                        }}
                                    >
                                        {method.method_name}
                                    </Typography>
                                    <Box
                                        sx={{
                                            px: 1.5,
                                            py: 0.5,
                                            borderRadius: 1.5,
                                            background: isWellBalanced
                                                ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(34, 197, 94, 0.1) 100%)'
                                                : 'linear-gradient(135deg, rgba(234, 179, 8, 0.2) 0%, rgba(234, 179, 8, 0.1) 100%)',
                                            border: '1px solid',
                                            borderColor: isWellBalanced ? '#22c55e' : '#eab308',
                                            boxShadow: isWellBalanced
                                                ? '0 0 12px rgba(34, 197, 94, 0.3)'
                                                : '0 0 12px rgba(234, 179, 8, 0.3)',
                                        }}
                                    >
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                color: isWellBalanced ? '#22c55e' : '#eab308',
                                                fontWeight: 600
                                            }}
                                        >
                                            {isWellBalanced ? '✓ Balanced Risk' : '⚠ Concentrated'}
                                        </Typography>
                                    </Box>
                                </Box>

                                {/* Weight Bar */}
                                <Box sx={{ mb: 2.5 }}>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', mb: 0.5, display: 'block', fontWeight: 600 }}>
                                        Weight:
                                    </Typography>
                                    <Box sx={{
                                        display: 'flex',
                                        height: 32,
                                        borderRadius: 2,
                                        overflow: 'hidden',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                        border: '1px solid rgba(255,255,255,0.1)'
                                    }}>
                                        {tickers.map((ticker, idx) => {
                                            const weight = weights[ticker];
                                            const colors = ASSET_GRADIENT_COLORS[idx % ASSET_GRADIENT_COLORS.length];

                                            return (
                                                <Tooltip
                                                    key={`w-${ticker}`}
                                                    title={`${ticker}: ${(weight * 100).toFixed(1)}%`}
                                                    arrow
                                                >
                                                    <Box
                                                        sx={{
                                                            width: `${weight * 100}%`,
                                                            background: `linear-gradient(180deg, ${colors.start} 0%, ${colors.end} 100%)`,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            transition: 'all 0.3s ease',
                                                            cursor: 'pointer',
                                                            '&:hover': {
                                                                filter: 'brightness(1.2)',
                                                                transform: 'scaleY(1.1)',
                                                            }
                                                        }}
                                                    >
                                                        {weight > 0.08 && (
                                                            <Typography
                                                                variant="caption"
                                                                sx={{
                                                                    color: '#fff',
                                                                    fontWeight: 700,
                                                                    fontSize: '0.7rem',
                                                                    textShadow: '0 1px 3px rgba(0,0,0,0.5)'
                                                                }}
                                                            >
                                                                {ticker}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                </Tooltip>
                                            );
                                        })}
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>
                                            0%
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>
                                            100%
                                        </Typography>
                                    </Box>
                                </Box>

                                {/* Risk Bar */}
                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', mb: 0.5, display: 'block', fontWeight: 600 }}>
                                        Risk:
                                    </Typography>
                                    <Box sx={{
                                        display: 'flex',
                                        height: 32,
                                        borderRadius: 2,
                                        overflow: 'hidden',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                        border: '1px solid rgba(255,255,255,0.1)'
                                    }}>
                                        {tickers.map((ticker, idx) => {
                                            const risk = riskContribs[ticker] || 0;
                                            const colors = ASSET_GRADIENT_COLORS[idx % ASSET_GRADIENT_COLORS.length];

                                            return (
                                                <Tooltip
                                                    key={`r-${ticker}`}
                                                    title={`${ticker}: ${(risk * 100).toFixed(1)}%`}
                                                    arrow
                                                >
                                                    <Box
                                                        sx={{
                                                            width: `${risk * 100}%`,
                                                            background: `linear-gradient(180deg, ${colors.start} 0%, ${colors.end} 100%)`,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            transition: 'all 0.3s ease',
                                                            cursor: 'pointer',
                                                            '&:hover': {
                                                                filter: 'brightness(1.2)',
                                                                transform: 'scaleY(1.1)',
                                                            }
                                                        }}
                                                    >
                                                        {risk > 0.08 && (
                                                            <Typography
                                                                variant="caption"
                                                                sx={{
                                                                    color: '#fff',
                                                                    fontWeight: 700,
                                                                    fontSize: '0.7rem',
                                                                    textShadow: '0 1px 3px rgba(0,0,0,0.5)'
                                                                }}
                                                            >
                                                                {ticker}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                </Tooltip>
                                            );
                                        })}
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>
                                            0%
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>
                                            100%
                                        </Typography>
                                    </Box>
                                </Box>

                                {/* Legend */}
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center', mb: 2 }}>
                                    {tickers.map((ticker, index) => {
                                        const colors = ASSET_GRADIENT_COLORS[index % ASSET_GRADIENT_COLORS.length];
                                        return (
                                            <Box
                                                key={ticker}
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 0.5,
                                                    px: 1,
                                                    py: 0.25,
                                                    background: `linear-gradient(135deg, ${colors.start}20, ${colors.end}10)`,
                                                    borderRadius: 1,
                                                    border: `1px solid ${colors.start}30`,
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        width: 10,
                                                        height: 10,
                                                        borderRadius: '50%',
                                                        background: `linear-gradient(135deg, ${colors.start}, ${colors.end})`,
                                                        boxShadow: `0 0 8px ${colors.start}60`,
                                                    }}
                                                />
                                                <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#fff', fontWeight: 600 }}>
                                                    {ticker}
                                                </Typography>
                                            </Box>
                                        );
                                    })}
                                </Box>

                                {/* Risk Stats */}
                                <Box sx={{
                                    mt: 2,
                                    pt: 1.5,
                                    borderTop: '1px solid rgba(255,255,255,0.1)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                                        Risk HHI (lower is better):
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            fontFamily: 'monospace',
                                            fontWeight: 700,
                                            color: hhi < 0.15 ? '#22c55e' : hhi < 0.25 ? '#eab308' : '#ef4444',
                                            fontSize: '0.85rem'
                                        }}
                                    >
                                        {hhi.toFixed(2)}
                                    </Typography>
                                </Box>
                            </Paper>
                        </Box>
                    );
                })}
            </Box>

            {/* Educational footer */}
            <Box sx={{
                mt: 3,
                p: 2.5,
                background: 'linear-gradient(135deg, rgba(100,181,246,0.05) 0%, rgba(0,212,170,0.05) 100%)',
                borderRadius: 2,
                border: '1px solid rgba(100,181,246,0.2)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', display: 'block', lineHeight: 1.6 }}>
                    <strong style={{ color: '#00D4AA' }}>💡 Interpretation:</strong>
                    {' '}"Weight" assumes all dollars are equal. "Risk" shows where the volatility actually comes from.
                    A balanced portfolio should ideally have balanced risk contributions (HRP goal).
                </Typography>
            </Box>
        </Paper>
    );
};

export default RiskContributionChart;
