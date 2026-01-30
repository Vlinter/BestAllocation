import React, { useMemo } from 'react';
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
} from 'recharts';
import { Paper, Typography, Box, Chip } from '@mui/material';
import { BubbleChart, Circle } from '@mui/icons-material';
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
        z: 40
    })), [data.efficient_frontier_data]);

    const strategyData = useMemo(() => data.methods.map(m => ({
        x: m.performance_metrics.volatility * 100,
        y: m.performance_metrics.cagr * 100,
        name: m.method_name,
        method: m.method,
        sharpe: m.performance_metrics.sharpe_ratio,
        z: 200
    })), [data.methods]);

    const simData = useMemo(() => (data.efficient_frontier_data!.simulations || []).map(d => ({
        x: d.volatility * 100,
        y: d.return * 100,
        z: 20
    })), [data.efficient_frontier_data]);

    const benchmarkData = useMemo(() => [{
        x: data.benchmark_metrics.volatility * 100,
        y: data.benchmark_metrics.cagr * 100,
        name: data.benchmark_name,
        z: 80
    }], [data.benchmark_metrics, data.benchmark_name]);

    // Custom Tooltip
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const point = payload[0].payload;
            const isStrategy = point.sharpe !== undefined;
            const title = point.name || 'Random Portfolio';
            const style = isStrategy && point.method ? METHOD_STYLES[point.method] : null;

            return (
                <Paper
                    sx={{
                        p: 2,
                        bgcolor: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(20px)',
                        boxShadow: style ? `0 8px 32px ${style.glow}` : '0 8px 32px rgba(0,0,0,0.3)',
                        minWidth: 180,
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        {style && (
                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: style.color, boxShadow: `0 0 10px ${style.color}` }} />
                        )}
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {title}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                        <Box>
                            <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>Return</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: point.y >= 0 ? '#10B981' : '#EF4444' }}>
                                {point.y >= 0 ? '+' : ''}{point.y.toFixed(2)}%
                            </Typography>
                        </Box>
                        <Box>
                            <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>Volatility</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {point.x.toFixed(2)}%
                            </Typography>
                        </Box>
                    </Box>
                    {isStrategy && (
                        <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <Typography variant="caption" sx={{ color: '#666' }}>Sharpe Ratio</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: point.sharpe > 1 ? '#10B981' : point.sharpe > 0.5 ? '#F59E0B' : '#EF4444' }}>
                                {point.sharpe.toFixed(2)}
                            </Typography>
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
                {/* Glow effect */}
                <circle cx={cx} cy={cy} r={20} fill={style.color} opacity={0.3} />
                <circle cx={cx} cy={cy} r={14} fill={style.color} opacity={0.5} />
                {/* Main point */}
                <circle cx={cx} cy={cy} r={8} fill={style.color} stroke="#fff" strokeWidth={2} />
            </g>
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
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                        <BubbleChart sx={{ fontSize: 28, color: '#A78BFA' }} />
                        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                            Efficient Frontier
                        </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Risk-Return optimization landscape • Monte Carlo simulations
                    </Typography>
                </Box>

                {/* Legend Chips */}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {strategyData.map(s => {
                        const style = METHOD_STYLES[s.method] || METHOD_STYLES.hrp;
                        return (
                            <Chip
                                key={s.method}
                                icon={<Circle sx={{ fontSize: 10, color: `${style.color} !important` }} />}
                                label={s.name}
                                size="small"
                                sx={{
                                    bgcolor: `${style.color}15`,
                                    color: style.color,
                                    fontWeight: 600,
                                    fontSize: '0.75rem',
                                }}
                            />
                        );
                    })}
                </Box>
            </Box>

            {/* Chart */}
            <Box sx={{ height: 500, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 20 }}>
                        <defs>
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
                            stroke="#4B5563"
                            tick={{ fill: '#6B7280', fontSize: 11 }}
                            domain={['auto', 'auto']}
                            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                        >
                            <Label value="Annualized Volatility (%)" offset={-15} position="insideBottom" fill="#6B7280" style={{ fontSize: 12 }} />
                        </XAxis>
                        <YAxis
                            type="number"
                            dataKey="y"
                            name="Return"
                            unit="%"
                            stroke="#4B5563"
                            tick={{ fill: '#6B7280', fontSize: 11 }}
                            domain={['auto', 'auto']}
                            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                        >
                            <Label value="Annualized Return (%)" angle={-90} position="insideLeft" fill="#6B7280" style={{ fontSize: 12 }} />
                        </YAxis>
                        <ZAxis type="number" dataKey="z" range={[20, 200]} />
                        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.2)' }} />
                        <Legend
                            wrapperStyle={{ paddingTop: 20 }}
                            formatter={(value) => <span style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>{value}</span>}
                        />

                        {/* Monte Carlo Simulations (Background Cloud) */}
                        <Scatter
                            name="Feasible Region"
                            data={simData}
                            fill="#4B5563"
                            opacity={0.15}
                            shape="circle"
                        />

                        {/* Efficient Frontier Curve */}
                        <Scatter
                            name="Efficient Frontier"
                            data={curveData}
                            fill="#6366F1"
                            line={{ stroke: '#6366F1', strokeWidth: 2, strokeDasharray: '5 5' }}
                            shape={() => <></>}
                            legendType="line"
                        />

                        {/* Individual Assets */}
                        <Scatter
                            name="Individual Assets"
                            data={assetData}
                            fill="#94A3B8"
                            shape="circle"
                        />

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
        </Paper>
    );
});

export default EfficientFrontierChart;

