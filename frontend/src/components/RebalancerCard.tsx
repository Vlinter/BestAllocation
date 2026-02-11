import React, { useState, useMemo } from 'react';
import {
    Box,
    Typography,
    Paper,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Divider,
    Chip,
    Switch,
    FormControlLabel,
    InputAdornment,
} from '@mui/material';
import {
    SwapVert as SwapIcon,
    TrendingUp as BuyIcon,
    TrendingDown as SellIcon,
    AccountBalanceWallet as WalletIcon,
    AddCircleOutline as AddCashIcon,
} from '@mui/icons-material';
import type { MethodResult } from '../api/client';

interface RebalancerCardProps {
    methods: MethodResult[];
    tickers: string[];
}

const METHOD_COLORS: Record<string, string> = {
    hrp: '#00D4AA',
    gmv: '#60A5FA',
    mvo: '#FBBF24',
    average: '#A78BFA',
};

const fmt$ = (v: number) => v >= 0
    ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : `-$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const RebalancerCard: React.FC<RebalancerCardProps> = React.memo(({ methods, tickers }) => {
    // Holdings State
    const [holdings, setHoldings] = useState<Record<string, number>>(() =>
        Object.fromEntries(tickers.map(t => [t, 0]))
    );
    const [targetMethod, setTargetMethod] = useState<string>('hrp');

    // Feature toggles
    const [cashToAdd, setCashToAdd] = useState<number>(0);
    const [minTradeFilter, setMinTradeFilter] = useState<number>(50);
    const [showSmallTrades, setShowSmallTrades] = useState(true);

    const currentTotal = useMemo(() =>
        Object.values(holdings).reduce((sum, v) => sum + (v || 0), 0),
        [holdings]
    );

    const totalPortfolio = currentTotal + cashToAdd;
    const hasHoldings = currentTotal > 0;

    // Compute target weights based on selected method
    const targetWeights = useMemo(() => {
        if (targetMethod === 'average') {
            const avg: Record<string, number> = {};
            tickers.forEach(t => {
                const sum = methods.reduce((s, m) => s + (m.current_allocation.weights[t] || 0), 0);
                avg[t] = sum / methods.length;
            });
            return avg;
        }
        const method = methods.find(m => m.method === targetMethod);
        return method?.current_allocation.weights || {};
    }, [targetMethod, methods, tickers]);

    // Compute trades
    const trades = useMemo(() => {
        if (totalPortfolio <= 0) return [];

        return tickers.map(ticker => {
            const currentAmount = holdings[ticker] || 0;
            const currentWeight = currentTotal > 0 ? currentAmount / currentTotal : 0;
            const targetWeight = targetWeights[ticker] || 0;
            const targetAmount = targetWeight * totalPortfolio;
            const tradeAmount = targetAmount - currentAmount;
            const driftPct = Math.abs(currentWeight - targetWeight) * 100;

            return {
                ticker,
                currentWeight,
                targetWeight,
                currentAmount,
                targetAmount,
                tradeAmount,
                driftPct,
            };
        }).sort((a, b) => Math.abs(b.tradeAmount) - Math.abs(a.tradeAmount));
    }, [holdings, targetWeights, totalPortfolio, currentTotal, tickers]);

    // Filtered trades based on minimum trade size
    const visibleTrades = useMemo(() =>
        showSmallTrades ? trades : trades.filter(t => Math.abs(t.tradeAmount) >= minTradeFilter),
        [trades, showSmallTrades, minTradeFilter]
    );

    // Drift analysis
    const maxDrift = useMemo(() =>
        trades.length > 0 ? Math.max(...trades.map(t => t.driftPct)) : 0,
        [trades]
    );

    const handleHoldingChange = (ticker: string, value: string) => {
        const num = parseFloat(value) || 0;
        setHoldings(prev => ({ ...prev, [ticker]: Math.max(0, num) }));
    };

    // Quick-fill: distribute evenly
    const handleEqualFill = (amount: number) => {
        const perTicker = amount / tickers.length;
        setHoldings(Object.fromEntries(tickers.map(t => [t, Math.round(perTicker)])));
    };

    return (
        <Paper sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                <SwapIcon sx={{ color: '#A78BFA', fontSize: 28 }} />
                <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Rebalancer
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Enter your holdings → get exact trade instructions
                    </Typography>
                </Box>
            </Box>

            {/* ═══════════════════ SECTION 1: Current Holdings ═══════════════════ */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <WalletIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 1 }}>
                    Current Holdings
                </Typography>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 1.5, mb: 2 }}>
                {tickers.map(ticker => (
                    <TextField
                        key={ticker}
                        size="small"
                        label={ticker}
                        type="number"
                        value={holdings[ticker] || ''}
                        onChange={e => handleHoldingChange(ticker, e.target.value)}
                        InputProps={{
                            startAdornment: <InputAdornment position="start">$</InputAdornment>,
                            inputProps: { min: 0, step: 100 },
                        }}
                        sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.03)' } }}
                    />
                ))}
            </Box>

            {/* Quick fill buttons */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Quick fill:</Typography>
                {[5000, 10000, 25000, 50000].map(amount => (
                    <Chip
                        key={amount}
                        label={`$${(amount / 1000).toFixed(0)}k`}
                        size="small"
                        clickable
                        onClick={() => handleEqualFill(amount)}
                        sx={{ fontSize: '0.7rem', height: 24, bgcolor: 'rgba(255,255,255,0.05)' }}
                    />
                ))}
            </Box>

            {/* Total + Cash to deploy */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, p: 2, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 1.5, mb: 2.5 }}>
                <Box sx={{ flex: '1 1 150px' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>Current Portfolio</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: hasHoldings ? '#00D4AA' : 'text.secondary' }}>
                        {fmt$(currentTotal)}
                    </Typography>
                </Box>
                <Box sx={{ flex: '1 1 180px' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                        <AddCashIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>New Cash to Deploy</Typography>
                    </Box>
                    <TextField
                        size="small"
                        type="number"
                        value={cashToAdd || ''}
                        onChange={e => setCashToAdd(Math.max(0, parseFloat(e.target.value) || 0))}
                        InputProps={{
                            startAdornment: <InputAdornment position="start">$</InputAdornment>,
                            inputProps: { min: 0, step: 500 },
                        }}
                        sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.02)' } }}
                        fullWidth
                    />
                </Box>
                <Box sx={{ flex: '1 1 150px' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {cashToAdd > 0 ? 'Total After Cash' : 'Total'}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: cashToAdd > 0 ? '#A78BFA' : (hasHoldings ? '#00D4AA' : 'text.secondary') }}>
                        {fmt$(totalPortfolio)}
                    </Typography>
                </Box>
            </Box>

            <Divider sx={{ mb: 2.5 }} />

            {/* ═══════════════════ SECTION 2: Target Strategy ═══════════════════ */}
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 1 }}>
                Target Strategy
            </Typography>
            <ToggleButtonGroup
                value={targetMethod}
                exclusive
                onChange={(_, v) => v && setTargetMethod(v)}
                size="small"
                fullWidth
                sx={{ mb: 1.5, flexWrap: 'wrap' }}
            >
                {methods.map(m => (
                    <ToggleButton
                        key={m.method}
                        value={m.method}
                        sx={{
                            fontSize: '0.75rem', py: 0.7, flex: '1 1 0',
                            color: targetMethod === m.method ? METHOD_COLORS[m.method] : undefined,
                            borderColor: targetMethod === m.method ? METHOD_COLORS[m.method] : undefined,
                        }}
                    >
                        {m.method.toUpperCase()}
                    </ToggleButton>
                ))}
                <ToggleButton
                    value="average"
                    sx={{
                        fontSize: '0.75rem', py: 0.7, flex: '1 1 0',
                        color: targetMethod === 'average' ? '#A78BFA' : undefined,
                        borderColor: targetMethod === 'average' ? '#A78BFA' : undefined,
                    }}
                >
                    AVG
                </ToggleButton>
            </ToggleButtonGroup>

            {/* Drift Alert */}
            {hasHoldings && maxDrift > 0 && (
                <Box sx={{
                    p: 1.5, mb: 2, borderRadius: 1.5,
                    bgcolor: maxDrift > 10 ? 'rgba(239, 68, 68, 0.08)' : maxDrift > 5 ? 'rgba(251, 191, 36, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                    border: `1px solid ${maxDrift > 10 ? 'rgba(239, 68, 68, 0.2)' : maxDrift > 5 ? 'rgba(251, 191, 36, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: maxDrift > 10 ? '#ef4444' : maxDrift > 5 ? '#fbbf24' : '#10b981' }}>
                        {maxDrift > 10 ? '🔴 High Drift' : maxDrift > 5 ? '🟡 Moderate Drift' : '🟢 Low Drift'}
                        {' — '}Max deviation: {maxDrift.toFixed(1)}%
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {maxDrift > 10
                            ? 'Your portfolio has drifted significantly from target. Consider rebalancing.'
                            : maxDrift > 5
                                ? 'Some positions have drifted. Rebalancing may improve efficiency.'
                                : 'Your portfolio is well-aligned with the target strategy.'}
                    </Typography>
                </Box>
            )}

            {/* Filter options */}
            {hasHoldings && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                    <FormControlLabel
                        control={
                            <Switch
                                size="small"
                                checked={showSmallTrades}
                                onChange={e => setShowSmallTrades(e.target.checked)}
                                color="primary"
                            />
                        }
                        label={<Typography variant="caption">Show all trades</Typography>}
                    />
                    {!showSmallTrades && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Min trade:</Typography>
                            {[25, 50, 100, 250].map(v => (
                                <Chip
                                    key={v}
                                    label={`$${v}`}
                                    size="small"
                                    clickable
                                    onClick={() => setMinTradeFilter(v)}
                                    variant={minTradeFilter === v ? 'filled' : 'outlined'}
                                    color={minTradeFilter === v ? 'primary' : 'default'}
                                    sx={{ fontSize: '0.65rem', height: 22 }}
                                />
                            ))}
                        </Box>
                    )}
                </Box>
            )}

            {/* ═══════════════════ SECTION 3: Trade Instructions ═══════════════════ */}
            {!hasHoldings && cashToAdd <= 0 ? (
                <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    <WalletIcon sx={{ fontSize: 40, mb: 1, opacity: 0.3 }} />
                    <Typography variant="body2">
                        Enter your current $ amounts above to see trade instructions
                    </Typography>
                    <Typography variant="caption">
                        Or add cash to deploy to see how to invest new money
                    </Typography>
                </Box>
            ) : (
                <Box>
                    {/* Trade table */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '60px 1fr 80px 70px', gap: 0.5, mb: 1, px: 1, alignItems: 'center' }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>Ticker</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>Current vs Target</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textAlign: 'right' }}>Trade</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textAlign: 'right' }}>Action</Typography>
                    </Box>

                    {visibleTrades.map(trade => {
                        const isBuy = trade.tradeAmount > 1;
                        const isSell = trade.tradeAmount < -1;
                        const isHold = !isBuy && !isSell;
                        const targetColor = METHOD_COLORS[targetMethod] || '#A78BFA';
                        const maxWeight = Math.max(trade.currentWeight, trade.targetWeight, 0.01);
                        // Scale bars so the largest fills the full width
                        const scaleFactor = 100 / (maxWeight * 100 * 1.15);

                        return (
                            <Box
                                key={trade.ticker}
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: '60px 1fr 80px 70px',
                                    gap: 0.5,
                                    py: 1.2,
                                    px: 1,
                                    borderRadius: 1,
                                    alignItems: 'center',
                                    bgcolor: isBuy ? 'rgba(16, 185, 129, 0.04)' : isSell ? 'rgba(239, 68, 68, 0.04)' : 'transparent',
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                                }}
                            >
                                {/* Ticker */}
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>{trade.ticker}</Typography>

                                {/* Overlapping bars */}
                                <Box sx={{ position: 'relative', height: 28 }}>
                                    {/* Current weight bar (bottom layer) */}
                                    <Box sx={{
                                        position: 'absolute', top: 3, left: 0, height: 22, borderRadius: 1.5,
                                        width: `${Math.min(trade.currentWeight * 100 * scaleFactor, 100)}%`,
                                        bgcolor: 'rgba(255,255,255,0.12)',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                                        pr: trade.currentWeight * 100 * scaleFactor > 15 ? 0.8 : 0,
                                        transition: 'width 0.3s ease',
                                    }}>
                                        {trade.currentWeight * 100 * scaleFactor > 15 && (
                                            <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                                                {(trade.currentWeight * 100).toFixed(1)}%
                                            </Typography>
                                        )}
                                    </Box>
                                    {/* Target weight bar (top layer, semi-transparent) */}
                                    <Box sx={{
                                        position: 'absolute', top: 3, left: 0, height: 22, borderRadius: 1.5,
                                        width: `${Math.min(trade.targetWeight * 100 * scaleFactor, 100)}%`,
                                        bgcolor: `${targetColor}22`,
                                        border: `1.5px solid ${targetColor}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                                        pr: trade.targetWeight * 100 * scaleFactor > 15 ? 0.8 : 0,
                                        transition: 'width 0.3s ease',
                                    }}>
                                        {trade.targetWeight * 100 * scaleFactor > 15 && (
                                            <Typography sx={{ fontSize: '0.65rem', color: targetColor, fontWeight: 700 }}>
                                                {(trade.targetWeight * 100).toFixed(1)}%
                                            </Typography>
                                        )}
                                    </Box>
                                    {/* Percentage labels for small bars */}
                                    {trade.currentWeight * 100 * scaleFactor <= 15 && (
                                        <Typography sx={{
                                            position: 'absolute', top: 6,
                                            left: `${Math.min(trade.currentWeight * 100 * scaleFactor, 100) + 1}%`,
                                            fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)',
                                        }}>
                                            {(trade.currentWeight * 100).toFixed(1)}%
                                        </Typography>
                                    )}
                                    {trade.targetWeight * 100 * scaleFactor <= 15 && (
                                        <Typography sx={{
                                            position: 'absolute', top: 6,
                                            left: `${Math.min(trade.targetWeight * 100 * scaleFactor, 100) + 1}%`,
                                            fontSize: '0.6rem', color: targetColor,
                                        }}>
                                            {(trade.targetWeight * 100).toFixed(1)}%
                                        </Typography>
                                    )}
                                </Box>

                                {/* Trade amount */}
                                <Typography variant="body2" sx={{
                                    textAlign: 'right', fontWeight: 700, fontSize: '0.85rem',
                                    color: isBuy ? '#10b981' : isSell ? '#ef4444' : 'text.secondary',
                                }}>
                                    {isBuy ? '+' : ''}{fmt$(trade.tradeAmount)}
                                </Typography>

                                {/* Action chip */}
                                <Box sx={{ textAlign: 'right' }}>
                                    {isHold ? (
                                        <Chip label="HOLD" size="small" sx={{ height: 22, fontSize: '0.6rem', bgcolor: 'rgba(255,255,255,0.06)' }} />
                                    ) : (
                                        <Chip
                                            icon={isBuy ? <BuyIcon sx={{ fontSize: 14 }} /> : <SellIcon sx={{ fontSize: 14 }} />}
                                            label={isBuy ? 'BUY' : 'SELL'}
                                            size="small"
                                            sx={{
                                                height: 22, fontSize: '0.6rem', fontWeight: 700,
                                                bgcolor: isBuy ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                color: isBuy ? '#10b981' : '#ef4444',
                                                '& .MuiChip-icon': { color: 'inherit' },
                                            }}
                                        />
                                    )}
                                </Box>
                            </Box>
                        );
                    })}

                    {/* Hidden trades notice */}
                    {!showSmallTrades && trades.length > visibleTrades.length && (
                        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'text.secondary', mt: 1 }}>
                            {trades.length - visibleTrades.length} small trade{trades.length - visibleTrades.length > 1 ? 's' : ''} hidden (below ${minTradeFilter})
                        </Typography>
                    )}

                    {/* ═══════════════════ SUMMARY ═══════════════════ */}
                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, px: 1 }}>
                        <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Trades Required</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {trades.filter(t => Math.abs(t.tradeAmount) > 1).length} of {tickers.length}
                            </Typography>
                        </Box>
                        <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Total Turnover</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {fmt$(trades.reduce((s, t) => s + Math.abs(t.tradeAmount), 0))}
                            </Typography>
                        </Box>
                        {cashToAdd > 0 && (
                            <Box>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>New Cash Deployed</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: '#A78BFA' }}>
                                    {fmt$(cashToAdd)}
                                </Typography>
                            </Box>
                        )}
                        <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Max Position Drift</Typography>
                            <Typography variant="body2" sx={{
                                fontWeight: 700,
                                color: maxDrift > 10 ? '#ef4444' : maxDrift > 5 ? '#fbbf24' : '#10b981',
                            }}>
                                {maxDrift.toFixed(1)}%
                            </Typography>
                        </Box>
                    </Box>
                </Box>
            )}
        </Paper>
    );
});

export default RebalancerCard;
