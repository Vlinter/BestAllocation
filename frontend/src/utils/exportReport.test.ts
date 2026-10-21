import { describe, it, expect } from 'vitest';
import { buildJsonExport, buildMarkdownReport, reportFileStem, thin } from './exportReport';
import { method, metrics, response } from '../test/fixtures';
import type { OptimizationParams } from '../hooks/useOptimization';

const params: OptimizationParams = {
    tickers: ['AAA', 'BBB'],
    startDate: null,
    endDate: null,
    trainingWindow: 252,
    rebalancingWindow: 63,
    transactionCostBps: 10,
    minWeight: 0,
    maxWeight: 0.25,
    benchmarkType: 'custom',
    benchmarkTicker: 'SPY',
    enableVolatilityScaling: false,
    targetVolatility: 0.12,
    cvarConfidence: 0.95,
};

const at = (day: number) => Date.UTC(2021, 0, day);

describe('thin', () => {
    it('leaves a short series alone', () => {
        expect(thin([1, 2, 3], 10)).toEqual([1, 2, 3]);
    });

    it('keeps both endpoints — a sampled curve that lost its last value would misstate the total return', () => {
        const series = Array.from({ length: 500 }, (_, i) => i);
        const sampled = thin(series, 60);

        expect(sampled).toHaveLength(60);
        expect(sampled[0]).toBe(0);
        expect(sampled[sampled.length - 1]).toBe(499);
        expect([...sampled].sort((a, b) => a - b)).toEqual(sampled);
    });
});

describe('buildMarkdownReport', () => {
    it('states the run configuration, so the numbers can be read without the app', () => {
        const md = buildMarkdownReport({ results: response(), params });

        expect(md).toContain('# BestAllocation — walk-forward backtest report');
        expect(md).toContain('2020-01-01 → 2026-06-18');
        expect(md).toContain('| Training window | 252 trading days |');
        expect(md).toContain('| Rebalancing window | 63 trading days |');
        expect(md).toContain('| Transaction cost | 10 bps per side |');
        expect(md).toContain('0% – 25%');
        expect(md).toContain('SPY (custom ticker, buy & hold, shown gross)');
        expect(md).toContain('| CVaR confidence (Min-CVaR beta) | 95% |');
        expect(md).toContain('| Risk-free rate (latest observed) | 3.00% |');
    });

    it('says so when the parameters of the run are unknown', () => {
        const md = buildMarkdownReport({ results: response() });

        expect(md).toContain('were not recorded');
        expect(md).not.toContain('Training window');
    });

    it('spells out the units an assistant cannot infer', () => {
        const md = buildMarkdownReport({ results: response() });

        expect(md).toContain('Equity curves are normalized to 1.0');
        expect(md).toContain('Drawdown *metrics* are magnitudes');
        expect(md).toContain('Max drawdown (magnitude)');
    });

    it('labels the daily win/loss rows as daily magnitudes, which is what the backend computes', () => {
        const md = buildMarkdownReport({
            results: response({
                methods: [method('hrp', { performance_metrics: metrics({ max_loss: 0.1187, max_gain: 0.0562 }) })],
            }),
        });

        // max_loss arrives as abs(returns.min()): printing it signed turned the
        // worst day of the backtest into a gain.
        expect(md).toContain('| Worst day (magnitude) | 11.87% |');
        expect(md).toContain('| Best day | +5.62% |');
        expect(md).toContain('Win rate and the win/loss rows are computed on *daily* returns');
        expect(md).not.toContain('Worst period');
    });

    it('aligns the benchmark on the nearest date — its curve is one session off the strategies', () => {
        const strategy = Array.from({ length: 4 }, (_, i) => ({ date: at(4 + i * 10), value: 1 + i / 10 }));
        const benchmark = strategy.map(p => ({ date: p.date - 86_400_000, value: p.value + 0.5 }));
        const md = buildMarkdownReport({
            results: response({
                methods: [method('hrp', { equity_curve: strategy })],
                benchmark_curve: benchmark,
            }),
        });

        expect(md).toContain('| 2021-01-04 | 1.0000 | 1.5000 |');
        expect(md).toContain('| 2021-02-03 | 1.3000 | 1.8000 |');
    });

    it('leaves a gap rather than pairing a row with a far-away point', () => {
        const strategy = [{ date: at(4), value: 1 }, { date: at(40), value: 1.2 }];
        const md = buildMarkdownReport({
            results: response({
                methods: [method('hrp', { equity_curve: strategy })],
                benchmark_curve: [{ date: at(4), value: 2 }],
            }),
        });

        expect(md).toContain('| 2021-01-04 | 1.0000 | 2.0000 |');
        expect(md).toContain('| 2021-02-09 | 1.2000 | — |');
    });

    it('puts every strategy and the benchmark in the metrics table', () => {
        const md = buildMarkdownReport({ results: response() });
        const header = md.split('\n').find(l => l.startsWith('| Metric |'))!;

        expect(header).toContain('HRP (test)');
        expect(header).toContain('CVAR (test)');
        expect(header).toContain('MVO (test)');
        expect(header).toContain('Equal Weight');
        expect(md).toContain('| Sharpe ratio | 0.50 | 0.50 | 0.50 | 0.50 |');
    });

    it('reports the ranking as a heuristic, not a verdict', () => {
        const md = buildMarkdownReport({
            results: response(),
            ranking: {
                totalMetrics: 10,
                ranking: [{ method: method('mvo'), wins: 7, winningMetrics: ['Sharpe Ratio', 'CAGR'] }],
            },
        });

        expect(md).toContain('| #1 | MVO (test) | 7/10 | Sharpe Ratio, CAGR |');
        expect(md).toContain('**not** a statistical verdict');
    });

    it('explains why the significance tests are missing instead of staying silent', () => {
        const md = buildMarkdownReport({
            results: response({ significance: { available: false, reason: 'too few observations', n_observations: 0, sharpe_comparisons: [], deflated_sharpe: {}, bootstrap: {} } }),
        });

        expect(md).toContain('Not computed: too few observations.');
    });

    it('carries the bootstrap interval and the PBO when they are available', () => {
        const md = buildMarkdownReport({
            results: response({
                significance: {
                    available: true,
                    benchmark_name: 'Equal Weight',
                    n_observations: 2500,
                    sharpe_comparisons: [{
                        a: 'HRP', b: 'Equal Weight', difference: 0.21,
                        ci_low: -0.18, ci_high: 0.61, p_value: 0.28, significant: false,
                    }],
                    pbo: {
                        pbo: 0.64, logit_mean: -0.4, n_combinations: 12870,
                        n_candidates: 4, n_splits: 16, in_sample_winner_share: { HRP: 0.5 },
                    },
                    deflated_sharpe: {
                        HRP: {
                            dsr: 0.42, threshold_sharpe: 0.6, observed_sharpe: 0.75,
                            n_trials: 4, skewness: -0.3, kurtosis: 1.4, tail_adjustment: -0.05,
                        },
                    },
                    bootstrap: { resamples: 1000, block_length: 21 },
                },
            }),
        });

        expect(md).toContain('1000 resamples, blocks of 21 days');
        expect(md).toContain('| HRP | Equal Weight | 0.21 | [-0.18, 0.61] | 0.280 | no |');
        expect(md).toContain('**PBO = 64.0%** over 12,870 train/test combinations');
        expect(md).toContain('| HRP | 42.0% | 0.75 | 0.60 | 4 | -0.30 | 1.40 | -0.050 |');
    });

    it('samples long curves and says it did, with both counts', () => {
        const long = Array.from({ length: 500 }, (_, i) => ({ date: at(1) + i * 86_400_000, value: 1 + i / 1000 }));
        const md = buildMarkdownReport({
            results: response({ methods: [method('hrp', { equity_curve: long })] }),
        });

        expect(md).toContain('sampled 60 of 500 points');
        // The last point survives the sampling, so the total return still reads.
        expect(md).toContain('1.4990');
    });

    it('derives the cash sleeve from weights that do not sum to 100%', () => {
        const md = buildMarkdownReport({
            results: response({
                methods: [method('mvo', {
                    current_allocation: {
                        date: '2026-06-18', method: 'mvo',
                        weights: { AAA: 0.3, BBB: 0.2 }, risk_contributions: {},
                    },
                })],
            }),
        });

        expect(md).toContain('| **Cash** | 50.0% |');
    });

    it('flags a fallback allocation with the reason the backend gave', () => {
        const md = buildMarkdownReport({
            results: response({
                methods: [method('mvo', {
                    current_allocation: {
                        date: '2026-06-18', method: 'mvo', weights: {}, risk_contributions: {},
                        fallback_used: true, fallback_reason: 'Solver failed on 8% of periods.',
                    },
                })],
            }),
        });

        expect(md).toContain('**Fallback allocations**');
        expect(md).toContain('Solver failed on 8% of periods.');
    });

    it('marks the per-rebalance fallback rows of the allocation history', () => {
        const md = buildMarkdownReport({
            results: response({
                methods: [method('mvo', {
                    allocation_history: [
                        { date: '2021-01-04', AAA: 0.6, BBB: 0.4 },
                        { date: '2021-04-01', AAA: 0, BBB: 0, _fallback: true },
                    ],
                })],
            }),
        });

        expect(md).toContain('| 2021-01-04 | 60.0 | 40.0 | 0.0 |');
        expect(md).toContain('| 2021-04-01 * | 0.0 | 0.0 | 100.0 |');
        expect(md).toContain('`*` = fallback');
    });

    it('lays monthly returns out as a year grid, with gaps for missing months', () => {
        const md = buildMarkdownReport({
            results: response({
                methods: [method('hrp', {
                    monthly_returns: [
                        { date: Date.UTC(2021, 0, 31), value: 0.025 },
                        { date: Date.UTC(2021, 2, 31), value: -0.011 },
                    ],
                })],
            }),
        });

        expect(md).toContain('### HRP (test) — monthly returns (%)');
        expect(md).toContain('| 2021 | 2.5 | — | -1.1 |');
    });

    it('skips the sections a run has no data for, rather than printing empty tables', () => {
        const md = buildMarkdownReport({ results: response() });

        expect(md).not.toContain('## 13. Correlation matrix');
        expect(md).not.toContain('## 10. Historical stress tests');
        expect(md).toContain('## 11. Current allocation');
    });

    it('keeps the stress tests of the benchmark next to the strategies', () => {
        const scenario = {
            name: 'GFC 2008', description: 'Global financial crisis',
            start: '2008-09-01', end: '2009-03-09', available: true,
        };
        const md = buildMarkdownReport({
            results: response({
                methods: [method('hrp', { stress_tests: [{ ...scenario, return: -0.32, max_drawdown: 0.41 }] })],
                benchmark_stress_tests: [{ ...scenario, return: -0.51, max_drawdown: 0.55 }],
            }),
        });

        expect(md).toContain('| GFC 2008 | 2008-09-01 → 2009-03-09 | Global financial crisis |');
        expect(md).toContain('| GFC 2008 | -32.00% | -51.00% |');
        expect(md).toContain('| GFC 2008 | 41.00% | 55.00% |');
    });

    it('reports a scenario the window has no data for as such', () => {
        const md = buildMarkdownReport({
            results: response({
                methods: [method('hrp', {
                    stress_tests: [{
                        name: 'GFC 2008', description: 'Global financial crisis',
                        start: '2008-09-01', end: '2009-03-09',
                        return: 0, max_drawdown: 0, available: false,
                    }],
                })],
            }),
        });

        expect(md).toContain('| GFC 2008 | no data | no data |');
    });
});

describe('buildJsonExport', () => {
    it('carries the request and the untouched response', () => {
        const results = response();
        const parsed = JSON.parse(buildJsonExport({ results, params }));

        expect(parsed.source).toBe('BestAllocation');
        expect(parsed.request.trainingWindow).toBe(252);
        expect(parsed.results.methods).toHaveLength(3);
        expect(parsed.results.methods[0].performance_metrics).toEqual(metrics());
    });
});

describe('reportFileStem', () => {
    it('names the file after the universe and the moment', () => {
        const stem = reportFileStem(response(), new Date('2026-10-21T10:04:00Z'));
        expect(stem).toBe('bestallocation-aaa-bbb-20261021-1004');
    });

    it('abbreviates a wide universe instead of building a 200-character filename', () => {
        const stem = reportFileStem(
            response({ tickers: ['QQQ', 'VGK', 'VWO', 'GLD', 'SLV', 'TLT'] }),
            new Date('2026-10-21T10:04:00Z'),
        );
        expect(stem).toBe('bestallocation-qqq-vgk-vwo-gld-plus-20261021-1004');
    });
});
