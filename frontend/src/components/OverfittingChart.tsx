import React, { useState, useMemo } from 'react';
import {
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    ZAxis,
} from 'recharts';
import { Box, Paper, Typography, Chip, Tooltip as MuiTooltip } from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';

interface OverfittingMetric {
    date: string;
    predicted_sharpe: number;
    realized_sharpe: number;
    is_cash?: boolean;
}

interface Dataset {
    name: string;
    data: OverfittingMetric[];
    color: string;
    // Computed server-side (significance.predictive_power). `ceiling` is the
    // largest |rho| observable given the sampling error of a Sharpe measured
    // over one holding window — the number this correlation must be read
    // against. When it is ~0 the test cannot resolve anything and a rho near
    // zero says nothing about the model.
    rho?: number;
    ceiling?: number;
}

interface OverfittingChartProps {
    datasets: Dataset[];
}

// Cash periods are recorded as degenerate (0, 0) placeholder pairs by the
// backend. Including them would pile identical, perfectly-"predicted" points
// into the statistics and artificially inflate the correlation — exclude them
// from all predictive-power calculations (they are still drawn, greyed out).
const activePoints = (data: OverfittingMetric[]): OverfittingMetric[] =>
    data.filter(d => !d.is_cash);

// Average ranks for ties (the classic 6Σd²/n(n²-1) shortcut is only valid
// without ties; capped Sharpes and repeated values make ties common here).
const getRanksWithTies = (arr: number[]): number[] => {
    const indexed = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const ranks = new Array<number>(arr.length);
    let pos = 0;
    while (pos < indexed.length) {
        let end = pos;
        while (end + 1 < indexed.length && indexed[end + 1].v === indexed[pos].v) end++;
        const avgRank = (pos + end) / 2 + 1; // ranks are 1-based
        for (let k = pos; k <= end; k++) ranks[indexed[k].i] = avgRank;
        pos = end + 1;
    }
    return ranks;
};

// Spearman = Pearson correlation of the (tie-averaged) ranks
const calculateSpearmanCorrelation = (data: OverfittingMetric[]): number => {
    const pts = activePoints(data);
    if (pts.length < 3) return 0;

    const rankX = getRanksWithTies(pts.map(d => d.predicted_sharpe));
    const rankY = getRanksWithTies(pts.map(d => d.realized_sharpe));

    const n = pts.length;
    const meanX = rankX.reduce((a, b) => a + b, 0) / n;
    const meanY = rankY.reduce((a, b) => a + b, 0) / n;
    let num = 0, denX = 0, denY = 0;
    for (let i = 0; i < n; i++) {
        const dx = rankX[i] - meanX;
        const dy = rankY[i] - meanY;
        num += dx * dy;
        denX += dx * dx;
        denY += dy * dy;
    }
    if (denX <= 0 || denY <= 0) return 0;
    return num / Math.sqrt(denX * denY);
};

// Calculate linear regression (cash periods excluded — see activePoints)
const calculateRegression = (data: OverfittingMetric[]): { slope: number; intercept: number } => {
    const pts = activePoints(data);
    if (pts.length < 2) return { slope: 1, intercept: 0 };

    const n = pts.length;
    const x = pts.map(d => d.predicted_sharpe);
    const y = pts.map(d => d.realized_sharpe);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope: isNaN(slope) ? 1 : slope, intercept: isNaN(intercept) ? 0 : intercept };
};

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const diff = data.realized_sharpe - data.predicted_sharpe;
        return (
            <Paper sx={{ p: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                    {data.date}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Typography variant="body2">
                        <strong>Predicted:</strong> {data.predicted_sharpe.toFixed(2)}
                    </Typography>
                    <Typography variant="body2">
                        <strong>Realized:</strong> {data.realized_sharpe.toFixed(2)}
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{
                            color: diff >= 0 ? 'success.main' : 'error.main',
                            fontWeight: 600
                        }}
                    >
                        Δ: {diff >= 0 ? '+' : ''}{diff.toFixed(2)}
                    </Typography>
                </Box>
            </Paper>
        );
    }
    return null;
};

// Interpretation of the rank-IC — RELATIVE to what the test can detect.
// A rho of 0 is only evidence of overfitting if a non-zero rho was observable
// in the first place; with a 63-day holding window it usually is not.
const getInterpretation = (
    rho: number,
    ceiling?: number,
): { label: string; color: string; bg: string; icon: 'up' | 'down' | 'neutral' } => {
    if (ceiling !== undefined && ceiling < 0.1) {
        return { label: 'Not measurable', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)', icon: 'neutral' };
    }
    const scale = ceiling && ceiling > 0.1 ? ceiling : 1;
    const ratio = rho / scale;
    if (ratio >= 0.5) return { label: 'Robust', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', icon: 'up' };
    if (ratio >= 0.25) return { label: 'Moderate', color: '#eab308', bg: 'rgba(234, 179, 8, 0.1)', icon: 'neutral' };
    if (ratio >= 0) return { label: 'Weak', color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)', icon: 'down' };
    return { label: 'Inverted', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', icon: 'down' };
};

export const OverfittingChart: React.FC<OverfittingChartProps> = ({ datasets }) => {
    const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

    const filteredDatasets = selectedMethod
        ? datasets.filter(d => d.name === selectedMethod)
        : datasets;

    const totalPoints = datasets.reduce((acc, ds) => acc + (ds.data?.length || 0), 0);
    const totalCashPoints = datasets.reduce(
        (acc, ds) => acc + (ds.data?.filter(d => d.is_cash).length || 0), 0
    );

    // Calculate stats for each dataset (cash periods excluded from statistics)
    const datasetStats = useMemo(() => {
        return datasets.map(ds => {
            // Prefer the server value: scipy handles ties and returns a p-value.
            const spearman = ds.rho !== undefined ? ds.rho : calculateSpearmanCorrelation(ds.data || []);
            const regression = calculateRegression(ds.data || []);
            const interpretation = getInterpretation(spearman, ds.ceiling);
            const cashCount = ds.data?.filter(d => d.is_cash).length || 0;
            return {
                name: ds.name,
                shortName: ds.name.split(' ')[0], // HRP, Min, Mean-Variance
                spearman,
                regression,
                color: ds.color,
                interpretation,
                dataCount: (ds.data?.length || 0) - cashCount,
                cashCount
            };
        });
    }, [datasets]);

    // Average Spearman
    const avgSpearman = datasetStats.length > 0
        ? datasetStats.reduce((acc, s) => acc + s.spearman, 0) / datasetStats.length
        : 0;
    const ceilings = datasets.map(d => d.ceiling).filter((c): c is number => c !== undefined);
    const avgCeiling = ceilings.length ? ceilings.reduce((a, b) => a + b, 0) / ceilings.length : undefined;
    const overallInterpretation = getInterpretation(avgSpearman, avgCeiling);

    if (totalPoints === 0) {
        return (
            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Overfitting Analysis</Typography>
                <Typography variant="body2" color="text.secondary">
                    No overfitting data available. Requires walk-forward analysis with multiple rebalancing periods.
                </Typography>
            </Paper>
        );
    }

    return (
        <Paper sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>
                            Overfitting Analysis
                        </Typography>
                        <MuiTooltip
                            title="Compares In-Sample (predicted) vs Out-of-Sample (realized) Sharpe ratios. Points below the diagonal indicate the model underperformed expectations."
                            arrow
                        >
                            <InfoIcon sx={{ fontSize: 18, color: 'text.secondary', cursor: 'help' }} />
                        </MuiTooltip>
                    </Box>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Predicted vs Realized Sharpe Ratio • {totalPoints - totalCashPoints} data points
                        {totalCashPoints > 0 && ` (${totalCashPoints} cash periods excluded from stats)`}
                    </Typography>
                </Box>

                {/* Overall Score Badge */}
                <Box
                    sx={{
                        px: 2,
                        py: 1.5,
                        borderRadius: 2,
                        bgcolor: overallInterpretation.bg,
                        border: `1px solid ${overallInterpretation.color}`,
                        textAlign: 'center',
                        minWidth: 120,
                    }}
                >
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                        Rank IC (ρ)
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: overallInterpretation.color }}>
                        {avgSpearman.toFixed(2)}
                    </Typography>
                    <Chip
                        label={overallInterpretation.label}
                        size="small"
                        sx={{
                            mt: 0.5,
                            bgcolor: overallInterpretation.color,
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: '0.7rem',
                            height: 20,
                        }}
                    />
                </Box>
            </Box>

            {/* Method Selector Pills */}
            <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
                <Chip
                    label="All Methods"
                    onClick={() => setSelectedMethod(null)}
                    variant={selectedMethod === null ? 'filled' : 'outlined'}
                    sx={{
                        bgcolor: selectedMethod === null ? 'primary.main' : 'transparent',
                        color: selectedMethod === null ? '#fff' : 'text.secondary',
                        fontWeight: 600,
                        '&:hover': { bgcolor: selectedMethod === null ? 'primary.dark' : 'rgba(255,255,255,0.1)' }
                    }}
                />
                {datasetStats.map((stat) => (
                    <Chip
                        key={stat.name}
                        label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: stat.color }} />
                                <span>{stat.shortName}</span>
                                <Typography component="span" sx={{ opacity: 0.7, fontSize: '0.75rem' }}>
                                    ρ={stat.spearman.toFixed(2)}
                                </Typography>
                            </Box>
                        }
                        onClick={() => setSelectedMethod(selectedMethod === stat.name ? null : stat.name)}
                        variant={selectedMethod === stat.name ? 'filled' : 'outlined'}
                        sx={{
                            bgcolor: selectedMethod === stat.name ? stat.color : 'transparent',
                            borderColor: stat.color,
                            color: selectedMethod === stat.name ? '#000' : stat.color,
                            fontWeight: 500,
                            '&:hover': {
                                bgcolor: selectedMethod === stat.name ? stat.color : `${stat.color}20`
                            }
                        }}
                    />
                ))}
            </Box>

            {/* Stats Cards */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                {datasetStats.map((stat) => (
                    <Box
                        key={stat.name}
                        sx={{
                            flex: '1 1 200px',
                            p: 2,
                            borderRadius: 2,
                            bgcolor: 'rgba(255,255,255,0.02)',
                            border: '1px solid',
                            borderColor: selectedMethod === stat.name || !selectedMethod ? stat.color : 'rgba(255,255,255,0.1)',
                            opacity: selectedMethod && selectedMethod !== stat.name ? 0.4 : 1,
                            transition: 'all 0.2s',
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: stat.color }} />
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                {stat.shortName}
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <Box>
                                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                                    Correlation
                                </Typography>
                                <Typography variant="h6" sx={{ fontWeight: 700, color: stat.interpretation.color }}>
                                    {stat.spearman.toFixed(3)}
                                </Typography>
                            </Box>
                            <Box sx={{ textAlign: 'right' }}>
                                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                                    Reg. Slope
                                </Typography>
                                <Typography
                                    variant="body2"
                                    sx={{
                                        fontFamily: 'monospace',
                                        color: stat.regression.slope < 0.5 ? 'warning.main' : 'text.primary'
                                    }}
                                >
                                    {stat.regression.slope.toFixed(2)}
                                    {stat.regression.slope < 0.5 && ' ⚠'}
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                ))}
            </Box>

            {/* Chart */}
            <Box sx={{ bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 2, p: 2 }}>
                <ResponsiveContainer width="100%" height={400}>
                    <ScatterChart margin={{ top: 20, right: 30, bottom: 50, left: 50 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                        <XAxis
                            type="number"
                            dataKey="predicted_sharpe"
                            name="Predicted"
                            stroke="#6B7280"
                            tick={{ fontSize: 11, fill: '#9CA3AF' }}
                            domain={['auto', 'auto']}
                            label={{
                                value: 'Predicted Sharpe (In-Sample)',
                                position: 'bottom',
                                offset: 10,
                                fill: '#9CA3AF',
                                fontSize: 12
                            }}
                        />
                        <YAxis
                            type="number"
                            dataKey="realized_sharpe"
                            name="Realized"
                            stroke="#6B7280"
                            tick={{ fontSize: 11, fill: '#9CA3AF' }}
                            label={{
                                value: 'Realized Sharpe (Out-of-Sample)',
                                angle: -90,
                                position: 'insideLeft',
                                offset: 10,
                                fill: '#9CA3AF',
                                fontSize: 12
                            }}
                        />
                        <ZAxis range={[40, 40]} />
                        <Tooltip content={<CustomTooltip />} />

                        {/* Perfect prediction line (y=x) */}
                        <ReferenceLine
                            segment={[{ x: -3, y: -3 }, { x: 6, y: 6 }]}
                            stroke="#4B5563"
                            strokeWidth={2}
                            strokeDasharray="8 4"
                            label={{
                                value: 'Perfect Prediction',
                                position: 'insideTopRight',
                                fill: '#6B7280',
                                fontSize: 10
                            }}
                        />

                        {/* Zero lines */}
                        <ReferenceLine x={0} stroke="#374151" strokeWidth={1} />
                        <ReferenceLine y={0} stroke="#374151" strokeWidth={1} />

                        {/* Regression lines for each method */}
                        {filteredDatasets.map((ds) => {
                            const stat = datasetStats.find(s => s.name === ds.name);
                            if (!stat) return null;
                            return (
                                <ReferenceLine
                                    key={`reg-${ds.name}`}
                                    segment={[
                                        { x: -2, y: stat.regression.slope * -2 + stat.regression.intercept },
                                        { x: 5, y: stat.regression.slope * 5 + stat.regression.intercept }
                                    ]}
                                    stroke={ds.color}
                                    strokeWidth={2}
                                    strokeOpacity={0.7}
                                />
                            );
                        })}

                        {/* Scatter points — cash periods drawn greyed-out, excluded from stats */}
                        {filteredDatasets.map((dataset) => (
                            <Scatter
                                key={dataset.name}
                                name={dataset.name}
                                data={(dataset.data || []).filter(d => !d.is_cash)}
                                fill={dataset.color}
                                fillOpacity={0.7}
                            />
                        ))}
                        {filteredDatasets.map((dataset) => {
                            const cashPts = (dataset.data || []).filter(d => d.is_cash);
                            if (!cashPts.length) return null;
                            return (
                                <Scatter
                                    key={`${dataset.name}-cash`}
                                    name={`${dataset.name} (cash)`}
                                    data={cashPts}
                                    fill="#6B7280"
                                    fillOpacity={0.35}
                                    legendType="none"
                                />
                            );
                        })}
                    </ScatterChart>
                </ResponsiveContainer>
            </Box>

            {/* Legend & Interpretation */}
            <Box sx={{ mt: 3, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <Box sx={{ flex: '1 1 300px' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                        📊 How to Read
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.6, display: 'block' }}>
                        • <strong>Diagonal line</strong> = perfect prediction (predicted = realized)<br />
                        • <strong>Points below diagonal</strong> = model overfit (underperformed)<br />
                        • <strong>Points above diagonal</strong> = model was conservative (outperformed)<br />
                        • <strong>Colored lines</strong> = linear regression for each method
                    </Typography>
                </Box>
                <Box sx={{ flex: '1 1 300px' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                        🎯 Metrics Explained
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.6, display: 'block' }}>
                        • <strong>Rank IC (ρ)</strong>: Spearman correlation (tie-adjusted), read against the
                        <em> detectable ceiling</em> in the table below — not against 1. A Sharpe measured over one
                        holding window carries a sampling error close to the dispersion between windows, so the ceiling
                        is often ~0 and ρ ≈ 0 then means <em>untestable</em>, not <em>overfit</em>.<br />
                        • <strong>Reg. Slope</strong>: How much realized Sharpe changes per unit predicted. Slope &lt; 0.5 = decay<br />
                        • <strong>Note</strong>: this is a heuristic in-house diagnostic (rank IC), not a formal PBO/Deflated-Sharpe test. With few rebalances the ρ is noisy — check the point count. Grey points = cash periods (excluded).
                    </Typography>
                </Box>
            </Box>
        </Paper>
    );
};

export default OverfittingChart;
