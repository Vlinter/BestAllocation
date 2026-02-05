import React, { useMemo, useState } from 'react';
import {
    ResponsiveContainer,
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    Label,
    ZAxis,
    ReferenceLine,
} from 'recharts';
import { Paper, Typography, Box, Chip, Button, Collapse, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { BubbleChart, Circle, ExpandMore, ExpandLess, TrendingUp, ShowChart, Visibility, VisibilityOff } from '@mui/icons-material';
import type { CompareResponse } from '../api/client';

interface EfficientFrontierChartProps {
    data: CompareResponse;
}

const METHOD_STYLES: Record<string, { color: string; glow: string }> = {
    hrp: { color: '#00D4AA', glow: 'rgba(0, 212, 170, 0.6)' },
    nco: { color: '#00D4AA', glow: 'rgba(0, 212, 170, 0.6)' },
    gmv: { color: '#FFE66D', glow: 'rgba(255, 230, 109, 0.6)' },
    mvo: { color: '#A78BFA', glow: 'rgba(167, 139, 250, 0.6)' },
};

const EfficientFrontierChart: React.FC<EfficientFrontierChartProps> = React.memo(({ data }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showSimulations, setShowSimulations] = useState(true);
    const [showAssets, setShowAssets] = useState(true);
    const [showCML, setShowCML] = useState(true);

    if (!data.efficient_frontier_data) {
        return null;
    }

    const curveData = useMemo(() => data.efficient_frontier_data!.curve.map(d => ({
        x: d.volatility * 100,
        y: d.return * 100
    })), [data.efficient_frontier_data]);

    const assetData = useMemo(() => data.efficient_frontier_data!.assets.map(d => ({
        x: d.volatility * 100,
        y: d.return * 100,
        name: d.ticker,
        z: 50
    })), [data.efficient_frontier_data]);

    const strategyData = useMemo(() => data.methods.map(m => ({
        x: m.performance_metrics.volatility * 100,
        y: m.performance_metrics.cagr * 100,
        name: m.method_name,
        method: m.method,
        sharpe: m.performance_metrics.sharpe_ratio,
        sortino: m.performance_metrics.sortino_ratio,
        maxDrawdown: m.performance_metrics.max_drawdown * 100,
        z: 200
    })), [data.methods]);

    const simData = useMemo(() => (data.efficient_frontier_data!.simulations || []).map(d => ({
        x: d.volatility * 100,
        y: d.return * 100,
        z: 15
    })), [data.efficient_frontier_data]);

    const benchmarkData = useMemo(() => [{
        x: data.benchmark_metrics.volatility * 100,
        y: data.benchmark_metrics.cagr * 100,
        name: data.benchmark_name,
        sharpe: data.benchmark_metrics.sharpe_ratio,
        z: 100
    }], [data.benchmark_metrics, data.benchmark_name]);

    // Calculate Capital Market Line (CML)
    const cmlData = useMemo(() => {
        const riskFree = data.risk_free_rate * 100;
        // Find the tangency portfolio (highest Sharpe on the frontier)
        const tangencyPoint = curveData.reduce((best, point) => {
            const sharpe = (point.y - riskFree) / point.x;
            const bestSharpe = (best.y - riskFree) / best.x;
            return sharpe > bestSharpe ? point : best;
        }, curveData[0]);

        if (!tangencyPoint) return [];

        // CML: from risk-free to tangency and beyond
        const slope = (tangencyPoint.y - riskFree) / tangencyPoint.x;
        const maxVol = Math.max(...curveData.map(d => d.x), ...strategyData.map(d => d.x)) * 1.2;

        return [
            { x: 0, y: riskFree },
            { x: tangencyPoint.x, y: tangencyPoint.y, isTangency: true },
            { x: maxVol, y: riskFree + slope * maxVol }
        ];
    }, [curveData, data.risk_free_rate, strategyData]);

    // Calculate frontier statistics
    const frontierStats = useMemo(() => {
        if (!curveData.length) return null;

        const maxReturn = Math.max(...curveData.map(d => d.y));
        const minVolatility = Math.min(...curveData.map(d => d.x));
        const minVolPoint = curveData.find(d => d.x === minVolatility);

        // Best strategy by Sharpe
        const bestStrategy = strategyData.reduce((best, s) =>
            s.sharpe > best.sharpe ? s : best, strategyData[0]);

        return {
            maxReturn,
            minVolatility,
            minVolPoint,
            bestStrategy,
            riskFreeRate: data.risk_free_rate * 100,
            simulationCount: simData.length
        };
    }, [curveData, strategyData, simData, data.risk_free_rate]);

    // Custom Tooltip
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const point = payload[0].payload;
            const isStrategy = point.sharpe !== undefined && point.method !== undefined;
            const isBenchmark = point.name === data.benchmark_name;
            const isAsset = point.name && !isStrategy && !isBenchmark;
            const title = point.name || 'Random Portfolio';
            const style = isStrategy && point.method ? METHOD_STYLES[point.method] : null;

            return (
                <Paper
                    sx={{
                        p: 2,
                        bgcolor: 'rgba(15, 23, 42, 0.98)',
                        border: '1px solid',
                        borderColor: style ? `${style.color}50` : 'rgba(255,255,255,0.15)',
                        backdropFilter: 'blur(20px)',
                        boxShadow: style ? `0 8px 32px ${style.glow}` : '0 8px 32px rgba(0,0,0,0.4)',
                        minWidth: 200,
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        {style && (
                            <Box sx={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                bgcolor: style.color,
                                boxShadow: `0 0 12px ${style.color}`
                            }} />
                        )}
                        {isAsset && (
                            <Box sx={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                bgcolor: '#94A3B8'
                            }} />
                        )}
                        {isBenchmark && (
                            <Box sx={{
                                width: 10,
                                height: 10,
                                bgcolor: '#fff',
                                transform: 'rotate(45deg)'
                            }} />
                        )}
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: style?.color || '#fff' }}>
                            {title}
                        </Typography>
                        {isStrategy && (
                            <Chip
                                label="Strategy"
                                size="small"
                                sx={{
                                    height: 18,
                                    fontSize: '0.6rem',
                                    bgcolor: `${style?.color}20`,
                                    color: style?.color,
                                }}
                            />
                        )}
                    </Box>

                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                        <Box>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', fontSize: '0.65rem' }}>
                                RETURN (CAGR)
                            </Typography>
                            <Typography variant="body2" sx={{
                                fontWeight: 700,
                                fontFamily: 'monospace',
                                color: point.y >= 0 ? '#10B981' : '#EF4444'
                            }}>
                                {point.y >= 0 ? '+' : ''}{point.y.toFixed(2)}%
                            </Typography>
                        </Box>
                        <Box>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', fontSize: '0.65rem' }}>
                                VOLATILITY
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                                {point.x.toFixed(2)}%
                            </Typography>
                        </Box>
                    </Box>

                    {(isStrategy || isBenchmark) && point.sharpe !== undefined && (
                        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                                <Box>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>
                                        SHARPE
                                    </Typography>
                                    <Typography variant="body2" sx={{
                                        fontWeight: 700,
                                        fontFamily: 'monospace',
                                        color: point.sharpe > 1 ? '#10B981' : point.sharpe > 0.5 ? '#F59E0B' : '#EF4444'
                                    }}>
                                        {point.sharpe.toFixed(2)}
                                    </Typography>
                                </Box>
                                {isStrategy && point.sortino && (
                                    <Box>
                                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>
                                            SORTINO
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace', color: '#60A5FA' }}>
                                            {point.sortino.toFixed(2)}
                                        </Typography>
                                    </Box>
                                )}
                            </Box>
                            {isStrategy && point.maxDrawdown && (
                                <Box sx={{ mt: 1 }}>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>
                                        MAX DRAWDOWN
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace', color: '#EF4444' }}>
                                        {point.maxDrawdown.toFixed(2)}%
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    )}
                </Paper>
            );
        }
        return null;
    };

    // Custom star shape for strategies
    const StrategyStar = (props: any) => {
        const { cx, cy, payload } = props;
        const style = METHOD_STYLES[payload.method] || METHOD_STYLES.hrp;

        return (
            <g>
                {/* Outer glow */}
                <circle cx={cx} cy={cy} r={24} fill={style.color} opacity={0.15} />
                <circle cx={cx} cy={cy} r={16} fill={style.color} opacity={0.3} />
                {/* Main point */}
                <circle cx={cx} cy={cy} r={10} fill={style.color} stroke="#fff" strokeWidth={2} />
                {/* Inner dot */}
                <circle cx={cx} cy={cy} r={3} fill="#fff" />
            </g>
        );
    };

    // Asset shape
    const AssetDot = (props: any) => {
        const { cx, cy, payload } = props;
        return (
            <g>
                <circle cx={cx} cy={cy} r={6} fill="#64748B" stroke="#94A3B8" strokeWidth={1.5} opacity={0.9} />
                <text x={cx} y={cy - 12} textAnchor="middle" fill="#94A3B8" fontSize={9} fontWeight={600}>
                    {payload.name}
                </text>
            </g>
        );
    };

    return (
        <Paper
            sx={{
                p: 3,
                background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.9) 0%, rgba(15, 23, 42, 0.6) 100%)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.08)',
            }}
        >
            {/* Header - Always visible */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{
                        p: 1.5,
                        borderRadius: 2,
                        background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.2), rgba(99, 102, 241, 0.1))',
                        border: '1px solid rgba(167, 139, 250, 0.3)',
                    }}>
                        <BubbleChart sx={{ fontSize: 28, color: '#A78BFA' }} />
                    </Box>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                            Efficient Frontier
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                            Monte Carlo • {simData.length.toLocaleString()} simulations • Capital Market Line
                        </Typography>
                    </Box>
                </Box>

                <Button
                    variant={isExpanded ? "contained" : "outlined"}
                    onClick={() => setIsExpanded(!isExpanded)}
                    startIcon={isExpanded ? <ExpandLess /> : <ExpandMore />}
                    sx={{
                        borderColor: isExpanded ? 'transparent' : 'rgba(167, 139, 250, 0.5)',
                        color: isExpanded ? '#fff' : '#A78BFA',
                        bgcolor: isExpanded ? 'rgba(167, 139, 250, 0.3)' : 'transparent',
                        '&:hover': {
                            bgcolor: 'rgba(167, 139, 250, 0.4)',
                            borderColor: 'rgba(167, 139, 250, 0.7)',
                        },
                        fontWeight: 600,
                        px: 3,
                    }}
                >
                    {isExpanded ? 'Hide Chart' : 'Show Chart'}
                </Button>
            </Box>

            {/* Quick Stats Row - Always visible */}
            {frontierStats && (
                <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
                    <Chip
                        icon={<TrendingUp sx={{ fontSize: 16, color: '#10B981 !important' }} />}
                        label={`Best Sharpe: ${frontierStats.bestStrategy.name} (${frontierStats.bestStrategy.sharpe.toFixed(2)})`}
                        size="small"
                        sx={{
                            bgcolor: 'rgba(16, 185, 129, 0.15)',
                            color: '#10B981',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            fontWeight: 600,
                        }}
                    />
                    <Chip
                        icon={<ShowChart sx={{ fontSize: 16, color: '#60A5FA !important' }} />}
                        label={`Min Vol: ${frontierStats.minVolatility.toFixed(1)}%`}
                        size="small"
                        sx={{
                            bgcolor: 'rgba(96, 165, 250, 0.15)',
                            color: '#60A5FA',
                            border: '1px solid rgba(96, 165, 250, 0.3)',
                            fontWeight: 600,
                        }}
                    />
                    <Chip
                        label={`Risk-Free: ${frontierStats.riskFreeRate.toFixed(2)}%`}
                        size="small"
                        sx={{
                            bgcolor: 'rgba(255,255,255,0.05)',
                            color: 'rgba(255,255,255,0.7)',
                            border: '1px solid rgba(255,255,255,0.1)',
                        }}
                    />
                </Box>
            )}

            {/* Collapsible Chart Section */}
            <Collapse in={isExpanded} timeout={400}>
                <Box sx={{ mt: 3 }}>
                    {/* Controls */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
                        {/* Legend Chips */}
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {strategyData.map(s => {
                                const style = METHOD_STYLES[s.method] || METHOD_STYLES.hrp;
                                return (
                                    <Chip
                                        key={s.method}
                                        icon={<Circle sx={{ fontSize: 10, color: `${style.color} !important` }} />}
                                        label={`${s.name}: ${s.sharpe.toFixed(2)}`}
                                        size="small"
                                        sx={{
                                            bgcolor: `${style.color}15`,
                                            color: style.color,
                                            fontWeight: 600,
                                            fontSize: '0.7rem',
                                        }}
                                    />
                                );
                            })}
                        </Box>

                        {/* Visibility Toggles */}
                        <ToggleButtonGroup size="small">
                            <ToggleButton
                                value="sim"
                                selected={showSimulations}
                                onClick={() => setShowSimulations(!showSimulations)}
                                sx={{
                                    px: 1.5,
                                    borderColor: 'rgba(255,255,255,0.1)',
                                    '&.Mui-selected': { bgcolor: 'rgba(75, 85, 99, 0.3)', color: '#9CA3AF' },
                                }}
                            >
                                {showSimulations ? <Visibility sx={{ fontSize: 16, mr: 0.5 }} /> : <VisibilityOff sx={{ fontSize: 16, mr: 0.5 }} />}
                                <Typography variant="caption">MC</Typography>
                            </ToggleButton>
                            <ToggleButton
                                value="assets"
                                selected={showAssets}
                                onClick={() => setShowAssets(!showAssets)}
                                sx={{
                                    px: 1.5,
                                    borderColor: 'rgba(255,255,255,0.1)',
                                    '&.Mui-selected': { bgcolor: 'rgba(148, 163, 184, 0.2)', color: '#94A3B8' },
                                }}
                            >
                                {showAssets ? <Visibility sx={{ fontSize: 16, mr: 0.5 }} /> : <VisibilityOff sx={{ fontSize: 16, mr: 0.5 }} />}
                                <Typography variant="caption">Assets</Typography>
                            </ToggleButton>
                            <ToggleButton
                                value="cml"
                                selected={showCML}
                                onClick={() => setShowCML(!showCML)}
                                sx={{
                                    px: 1.5,
                                    borderColor: 'rgba(255,255,255,0.1)',
                                    '&.Mui-selected': { bgcolor: 'rgba(251, 191, 36, 0.2)', color: '#FBBF24' },
                                }}
                            >
                                {showCML ? <Visibility sx={{ fontSize: 16, mr: 0.5 }} /> : <VisibilityOff sx={{ fontSize: 16, mr: 0.5 }} />}
                                <Typography variant="caption">CML</Typography>
                            </ToggleButton>
                        </ToggleButtonGroup>
                    </Box>

                    {/* Chart */}
                    <Box sx={{ height: 500, width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 20, right: 40, bottom: 40, left: 20 }}>
                                <defs>
                                    <linearGradient id="frontierGradient" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#6366F1" stopOpacity={0.8} />
                                        <stop offset="100%" stopColor="#A78BFA" stopOpacity={0.8} />
                                    </linearGradient>
                                    {Object.entries(METHOD_STYLES).map(([key, _]) => (
                                        <filter key={`glow-${key}`} id={`glow-${key}`} x="-50%" y="-50%" width="200%" height="200%">
                                            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                                            <feMerge>
                                                <feMergeNode in="coloredBlur" />
                                                <feMergeNode in="SourceGraphic" />
                                            </feMerge>
                                        </filter>
                                    ))}
                                </defs>

                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />

                                <XAxis
                                    type="number"
                                    dataKey="x"
                                    name="Volatility"
                                    unit="%"
                                    stroke="rgba(255,255,255,0.2)"
                                    tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                                    domain={['auto', 'auto']}
                                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                    tickLine={false}
                                >
                                    <Label
                                        value="Annualized Volatility (%)"
                                        offset={-25}
                                        position="insideBottom"
                                        fill="rgba(255,255,255,0.5)"
                                        style={{ fontSize: 12, fontWeight: 600 }}
                                    />
                                </XAxis>

                                <YAxis
                                    type="number"
                                    dataKey="y"
                                    name="Return"
                                    unit="%"
                                    stroke="rgba(255,255,255,0.2)"
                                    tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                                    domain={['auto', 'auto']}
                                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                    tickLine={false}
                                >
                                    <Label
                                        value="Annualized Return (%)"
                                        angle={-90}
                                        position="insideLeft"
                                        fill="rgba(255,255,255,0.5)"
                                        style={{ fontSize: 12, fontWeight: 600 }}
                                    />
                                </YAxis>

                                <ZAxis type="number" dataKey="z" range={[15, 250]} />
                                <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.15)' }} />
                                <Legend
                                    wrapperStyle={{ paddingTop: 20 }}
                                    formatter={(value) => <span style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>{value}</span>}
                                />

                                {/* Risk-Free Rate Line */}
                                <ReferenceLine
                                    y={data.risk_free_rate * 100}
                                    stroke="rgba(255,255,255,0.2)"
                                    strokeDasharray="5 5"
                                    label={{
                                        value: `Rf: ${(data.risk_free_rate * 100).toFixed(1)}%`,
                                        position: 'right',
                                        fill: 'rgba(255,255,255,0.4)',
                                        fontSize: 10
                                    }}
                                />

                                {/* Capital Market Line */}
                                {showCML && cmlData.length > 0 && (
                                    <Scatter
                                        name="Capital Market Line"
                                        data={cmlData}
                                        fill="#FBBF24"
                                        line={{ stroke: '#FBBF24', strokeWidth: 2, strokeDasharray: '8 4' }}
                                        shape={() => <></>}
                                        legendType="line"
                                    />
                                )}

                                {/* Monte Carlo Simulations (Background Cloud) */}
                                {showSimulations && (
                                    <Scatter
                                        name="Feasible Portfolios"
                                        data={simData}
                                        fill="#4B5563"
                                        opacity={0.2}
                                        shape="circle"
                                    />
                                )}

                                {/* Efficient Frontier Curve */}
                                <Scatter
                                    name="Efficient Frontier"
                                    data={curveData}
                                    fill="url(#frontierGradient)"
                                    line={{ stroke: '#6366F1', strokeWidth: 3 }}
                                    shape={() => <></>}
                                    legendType="line"
                                />

                                {/* Individual Assets */}
                                {showAssets && (
                                    <Scatter
                                        name="Individual Assets"
                                        data={assetData}
                                        shape={<AssetDot />}
                                    />
                                )}

                                {/* Benchmark */}
                                <Scatter
                                    name={data.benchmark_name}
                                    data={benchmarkData}
                                    fill="#fff"
                                    shape="diamond"
                                />

                                {/* Strategies with Glow */}
                                {strategyData.map((s) => (
                                    <Scatter
                                        key={s.name}
                                        name={s.name}
                                        data={[s]}
                                        shape={<StrategyStar />}
                                        legendType="circle"
                                    />
                                ))}
                            </ScatterChart>
                        </ResponsiveContainer>
                    </Box>

                    {/* Bottom Stats Grid */}
                    <Box sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: 2,
                        mt: 3,
                        pt: 2,
                        borderTop: '1px solid rgba(255,255,255,0.08)'
                    }}>
                        {strategyData.map(s => {
                            const style = METHOD_STYLES[s.method] || METHOD_STYLES.hrp;
                            return (
                                <Box
                                    key={s.method}
                                    sx={{
                                        p: 2,
                                        borderRadius: 2,
                                        background: `linear-gradient(135deg, ${style.color}10, transparent)`,
                                        border: `1px solid ${style.color}30`,
                                        textAlign: 'center',
                                    }}
                                >
                                    <Typography variant="caption" sx={{ color: style.color, fontWeight: 700, display: 'block', mb: 1 }}>
                                        {s.name}
                                    </Typography>
                                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3 }}>
                                        <Box>
                                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.6rem' }}>Return</Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 700, color: s.y >= 0 ? '#10B981' : '#EF4444', fontFamily: 'monospace' }}>
                                                {s.y >= 0 ? '+' : ''}{s.y.toFixed(1)}%
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.6rem' }}>Vol</Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                                                {s.x.toFixed(1)}%
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.6rem' }}>Sharpe</Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 700, color: style.color, fontFamily: 'monospace' }}>
                                                {s.sharpe.toFixed(2)}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                </Box>
            </Collapse>
        </Paper>
    );
});

export default EfficientFrontierChart;
