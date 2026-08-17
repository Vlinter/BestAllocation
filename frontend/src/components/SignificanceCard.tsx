import React from 'react';
import { Paper, Typography, Box, Tooltip, Chip, Divider } from '@mui/material';
import { Balance as BalanceIcon, HelpOutline } from '@mui/icons-material';
import type { CompareResponse, MethodResult } from '../api/client';
import { STRATEGY_COLORS as METHOD_COLORS } from '../theme/strategies';

interface Props {
    results: CompareResponse;
}

const GOOD = '#10B981';
const WARN = '#F59E0B';
const BAD = '#EF4444';

const colorOf = (name: string, methods: MethodResult[]): string => {
    const m = methods.find(x => x.method_name === name);
    return m ? METHOD_COLORS[m.method] || '#9CA3AF' : '#9CA3AF';
};
const shortOf = (name: string, methods: MethodResult[]): string => {
    const m = methods.find(x => x.method_name === name);
    return m ? m.method.toUpperCase() : name;
};

const SectionTitle: React.FC<{ label: string; help: string }> = ({ label, help }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1.5 }}>
        <Typography
            variant="caption"
            sx={{ fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'text.secondary' }}
        >
            {label}
        </Typography>
        <Tooltip title={help} arrow placement="right">
            <HelpOutline sx={{ fontSize: 14, color: 'text.secondary', cursor: 'help' }} />
        </Tooltip>
    </Box>
);

/** Confidence interval drawn on a track centred on zero. */
const IntervalBar: React.FC<{ low: number; high: number; point: number; span: number; color: string }> =
    ({ low, high, point, span, color }) => {
        const pos = (v: number) => ((v + span) / (2 * span)) * 100;
        return (
            <Box sx={{ position: 'relative', height: 26, width: '100%' }}>
                {/* track */}
                <Box sx={{ position: 'absolute', top: 12, left: 0, right: 0, height: 2, bgcolor: 'rgba(255,255,255,0.07)' }} />
                {/* zero — NB: in MUI's sx a numeric width <= 1 means a PERCENTAGE
                    (width: 1 === '100%'), so this hairline must be a string. */}
                <Box sx={{
                    position: 'absolute', top: 3, left: '50%', width: '1px', height: 20,
                    bgcolor: 'rgba(255,255,255,0.35)',
                }} />
                {/* interval */}
                <Box sx={{
                    position: 'absolute', top: 9, height: 8, borderRadius: 4,
                    left: `${Math.max(0, pos(low))}%`,
                    width: `${Math.max(1.5, pos(high) - pos(low))}%`,
                    bgcolor: `${color}55`, border: `1px solid ${color}`,
                }} />
                {/* point estimate */}
                <Box sx={{
                    position: 'absolute', top: 7, left: `calc(${pos(point)}% - 6px)`,
                    width: 12, height: 12, borderRadius: '50%', bgcolor: color,
                    border: '2px solid rgba(0,0,0,0.45)',
                }} />
            </Box>
        );
    };

const Meter: React.FC<{ value: number; threshold: number; color: string; invert?: boolean }> =
    ({ value, threshold, color }) => (
        <Box sx={{ position: 'relative', height: 8, width: '100%', bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 4 }}>
            <Box sx={{
                position: 'absolute', inset: 0, width: `${Math.min(100, Math.max(0, value * 100))}%`,
                bgcolor: color, borderRadius: 4, transition: 'width .6s ease',
            }} />
            <Box sx={{
                position: 'absolute', top: -3, left: `${threshold * 100}%`, width: 2, height: 14,
                bgcolor: 'rgba(255,255,255,0.5)',
            }} />
        </Box>
    );

const SignificanceCard: React.FC<Props> = ({ results }) => {
    const sig = results.significance;
    if (!sig) return null;

    if (!sig.available) {
        return (
            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Statistical Significance</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {sig.reason || 'Not enough history to run the significance tests.'}
                </Typography>
            </Paper>
        );
    }

    const methods = results.methods;
    const vsBenchmark = sig.sharpe_comparisons.filter(c => c.b === sig.benchmark_name);
    const headToHead = sig.sharpe_comparisons.filter(c => c.b !== sig.benchmark_name);
    const span = Math.max(
        0.25,
        ...sig.sharpe_comparisons.flatMap(c => [Math.abs(c.ci_low), Math.abs(c.ci_high)])
    ) * 1.1;

    const pbo = sig.pbo;
    const pboColor = !pbo ? WARN : pbo.pbo < 0.25 ? GOOD : pbo.pbo < 0.5 ? WARN : BAD;

    return (
        <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <BalanceIcon sx={{ color: 'primary.main', fontSize: 28 }} />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    Can you trust the podium?
                </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                A ranking without error bars is a coin toss with a decimal point. These three tests ask whether the
                winner is really a winner ({sig.n_observations.toLocaleString()} daily observations,
                {' '}{sig.bootstrap?.resamples ?? 0} bootstrap resamples).
            </Typography>

            {/* ═══════════ 1. Sharpe gap vs benchmark ═══════════ */}
            <SectionTitle
                label={`Sharpe gap vs ${sig.benchmark_name}`}
                help={"Circular block bootstrap (blocks of " + (sig.bootstrap?.block_length ?? 21) +
                    " trading days, so volatility clustering is preserved). Both series are resampled with the same " +
                    "blocks to keep their correlation. If the 95% interval contains zero, the gap is not distinguishable " +
                    "from luck."}
            />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2, mb: 1 }}>
                {vsBenchmark.map(c => {
                    const color = colorOf(c.a, methods);
                    return (
                        <Box key={c.a} sx={{
                            display: 'grid',
                            // The right-hand column is content-sized (`auto`) and the bar takes
                            // what is left: a fixed width there pushes the verdict chip outside
                            // the card as soon as the numbers or the locale get wider.
                            gridTemplateColumns: { xs: '1fr', sm: '84px minmax(0, 1fr) auto' },
                            gap: 1.5, alignItems: 'center',
                        }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, color }}>
                                {shortOf(c.a, methods)}
                            </Typography>
                            <IntervalBar low={c.ci_low} high={c.ci_high} point={c.difference} span={span} color={color} />
                            <Box sx={{
                                display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
                                justifyContent: { sm: 'flex-end' },
                            }}>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                    {c.difference >= 0 ? '+' : ''}{c.difference.toFixed(3)}
                                </Typography>
                                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                                    [{c.ci_low.toFixed(2)}, {c.ci_high.toFixed(2)}]
                                </Typography>
                                <Chip
                                    size="small"
                                    label={c.significant ? 'significant' : 'inconclusive'}
                                    sx={{
                                        height: 18, fontSize: '0.6rem', fontWeight: 700,
                                        bgcolor: c.significant ? `${GOOD}25` : 'rgba(255,255,255,0.06)',
                                        color: c.significant ? GOOD : 'text.secondary',
                                    }}
                                />
                            </Box>
                        </Box>
                    );
                })}
            </Box>
            {headToHead.map(c => (
                <Typography key={`${c.a}-${c.b}`} variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                    Top two head-to-head — <b>{shortOf(c.a, methods)}</b> vs <b>{shortOf(c.b, methods)}</b>:
                    {' '}{c.difference >= 0 ? '+' : ''}{c.difference.toFixed(3)} Sharpe,
                    95% CI [{c.ci_low.toFixed(2)}, {c.ci_high.toFixed(2)}], p = {c.p_value.toFixed(3)}
                    {c.significant ? ' — the gap holds.' : ' — the two are statistically indistinguishable.'}
                </Typography>
            ))}

            <Divider sx={{ my: 3 }} />

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4 }}>
                {/* ═══════════ 2. PBO ═══════════ */}
                <Box>
                    <SectionTitle
                        label="Probability of backtest overfitting"
                        help={"CSCV (Bailey, Borwein, Lopez de Prado & Zhu, 2016): the timeline is cut into " +
                            (pbo?.n_splits ?? 16) + " blocks and every way of using half of them as in-sample is tried. " +
                            "PBO is the share of splits where the in-sample winner ends up below the median out-of-sample. " +
                            "Above 50% the selection is worthless; below 25% it is robust."}
                    />
                    {pbo ? (
                        <>
                            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 1 }}>
                                <Typography variant="h3" sx={{ fontWeight: 800, color: pboColor, lineHeight: 1 }}>
                                    {(pbo.pbo * 100).toFixed(0)}%
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    over {pbo.n_combinations.toLocaleString()} splits · {pbo.n_candidates} candidates
                                </Typography>
                            </Box>
                            <Meter value={pbo.pbo} threshold={0.5} color={pboColor} />
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1.5 }}>
                                Picked in-sample:{' '}
                                {Object.entries(pbo.in_sample_winner_share)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([name, share]) => `${shortOf(name, methods)} ${(share * 100).toFixed(0)}%`)
                                    .join(' · ')}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                                With only {pbo.n_candidates} candidates the out-of-sample rank is coarse — read this as an
                                order of magnitude, not a precise probability.
                            </Typography>
                        </>
                    ) : (
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            Not enough observations for CSCV.
                        </Typography>
                    )}
                </Box>

                {/* ═══════════ 3. Deflated Sharpe ═══════════ */}
                <Box>
                    <SectionTitle
                        label="Deflated Sharpe Ratio"
                        help={"Bailey & Lopez de Prado (2014): probability that the true Sharpe is above zero once " +
                            "corrected for the number of configurations tried, for the skew and for the fat tails of the " +
                            "return distribution. The white mark is the 95% credibility threshold."}
                    />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.6 }}>
                        {Object.entries(sig.deflated_sharpe).map(([name, d]) => {
                            const color = colorOf(name, methods);
                            return (
                                <Box key={name}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                        <Typography variant="caption" sx={{ fontWeight: 700, color }}>
                                            {shortOf(name, methods)}
                                        </Typography>
                                        <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                                            {(d.dsr * 100).toFixed(1)}%
                                        </Typography>
                                    </Box>
                                    <Meter value={d.dsr} threshold={0.95} color={d.dsr >= 0.95 ? GOOD : WARN} />
                                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', display: 'block' }}>
                                        Sharpe {d.observed_sharpe.toFixed(2)} vs a {d.threshold_sharpe.toFixed(2)} bar
                                        {' '}set by {d.n_trials} trials
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', display: 'block', opacity: 0.75 }}>
                                        tail correction {d.tail_adjustment >= 0 ? '+' : ''}{d.tail_adjustment.toFixed(2)} pt
                                        {' '}· skew {d.skewness.toFixed(2)} · excess kurtosis {d.kurtosis.toFixed(1)}
                                    </Typography>
                                </Box>
                            );
                        })}
                    </Box>
                </Box>
            </Box>

            <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                    <strong>How to read this together:</strong> a high Deflated Sharpe says the strategy genuinely beats
                    cash. It says nothing about it beating the others — that is what the gap intervals answer. When those
                    intervals overlap zero and PBO sits near a coin flip, the ranking above is a description of this one
                    run, not a prediction. Prefer the strategy whose risk profile you can hold, not the one at the top by
                    a tenth of a Sharpe.
                </Typography>
            </Box>
        </Paper>
    );
};

export default SignificanceCard;
