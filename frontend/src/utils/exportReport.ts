/**
 * One-click export of a finished run, in the two shapes an answer needs.
 *
 * The dashboard is twenty charts across five tabs; none of it survives a
 * copy-paste into a conversation with an LLM, and a screenshot of a curve
 * cannot be read back as numbers. So the export is text: a Markdown report
 * that states the configuration, every metric, every statistical test, and
 * the DATA BEHIND each chart as a table — the assistant reads the shape of
 * the equity curve from the series, not from a picture of it.
 *
 * Two rules the report obeys, because an LLM cannot see the caveats the UI
 * prints next to a number:
 *   - every unit is spelled out (percent vs fraction, drawdown magnitudes,
 *     normalized equity), in a "How to read" preamble and again in the
 *     section headings;
 *   - any series that was thinned says so, with both counts. The backend
 *     computed every statistic on the full daily series (see metrics.py) —
 *     a sampled table is for reading the shape, never for recomputing a
 *     statistic, and the report says that out loud.
 *
 * The JSON export is the same run untouched, for anything that does want to
 * recompute.
 */
import type {
    AllocationEntry,
    CompareResponse,
    CurvePoint,
    PerformanceMetrics,
    StressTestResult,
} from '../api/client';
import type { OptimizationParams } from '../hooks/useOptimization';
import type { GlobalRanking } from '../hooks/useRanking';

export interface ReportContext {
    results: CompareResponse;
    /** Parameters of the run that produced `results`, when they are known. */
    params?: OptimizationParams | null;
    /** The metric-wins ranking the Overview tab shows. */
    ranking?: GlobalRanking | null;
    /** Injected by the tests; defaults to now. */
    generatedAt?: Date;
}

/**
 * Points kept per series in the Markdown. The API already downsamples display
 * curves to 500 points; 60 is what keeps a 15-year report pasteable while
 * still showing every regime (~3 points per year).
 */
const CURVE_POINTS = 60;
const ALLOCATION_ROWS = 24;
const FRONTIER_POINTS = 12;

/**
 * How far a curve may be from the date of the row it is printed on.
 *
 * The strategies are valued from the session after the decision, the
 * benchmark from the decision itself, so the two curves sit one session
 * apart — joining them on an exact timestamp left the benchmark column
 * empty on every row. Points are ~10 calendar days apart after the API's
 * downsampling, so a week is wide enough for the offset and far too narrow
 * to pair up two genuinely different dates.
 */
const ALIGNMENT_TOLERANCE_MS = 7 * 24 * 60 * 60 * 1000;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ---------------------------------------------------------------- formatting

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const num = (v: unknown, digits = 2): string => (isNum(v) ? v.toFixed(digits) : 'n/a');
const pct = (v: unknown, digits = 2): string => (isNum(v) ? `${(v * 100).toFixed(digits)}%` : 'n/a');
const signed = (v: unknown, digits = 2): string =>
    isNum(v) ? `${v > 0 ? '+' : ''}${(v * 100).toFixed(digits)}%` : 'n/a';

/** Curve dates travel as epoch milliseconds. */
const day = (ms: unknown): string => (isNum(ms) ? new Date(ms).toISOString().slice(0, 10) : 'n/a');

const table = (headers: string[], rows: (string | number)[][]): string => [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(r => `| ${r.join(' | ')} |`),
].join('\n');

/**
 * Evenly spaced subsample, first and last point always kept, order preserved.
 * Keeping the endpoints is not cosmetic: a sampled equity curve that lost its
 * final value would misstate the total return of the whole backtest.
 */
export function thin<T>(items: T[], max: number): T[] {
    if (max < 2 || items.length <= max) return items;
    const step = (items.length - 1) / (max - 1);
    return Array.from({ length: max }, (_, i) => items[Math.round(i * step)]);
}

const sampleNote = (kept: number, total: number): string =>
    kept < total ? ` — sampled ${kept} of ${total} points` : '';

// -------------------------------------------------------------- metric table

interface MetricRow {
    label: string;
    key: keyof PerformanceMetrics;
    fmt: (v: number) => string;
}

/**
 * Same rows as the Performance Comparison table, plus the distribution
 * metrics the UI only shows in tooltips — the point of the export is that
 * nothing stays behind in a tooltip.
 */
const METRIC_ROWS: MetricRow[] = [
    { label: 'Sharpe ratio', key: 'sharpe_ratio', fmt: v => num(v) },
    { label: 'Sortino ratio', key: 'sortino_ratio', fmt: v => num(v) },
    { label: 'Alpha (vs benchmark)', key: 'alpha', fmt: v => signed(v) },
    { label: 'Beta (vs benchmark)', key: 'beta', fmt: v => num(v) },
    { label: 'CAGR', key: 'cagr', fmt: v => signed(v) },
    { label: 'Total return', key: 'total_return', fmt: v => signed(v) },
    { label: 'Max drawdown (magnitude)', key: 'max_drawdown', fmt: v => pct(v) },
    { label: 'Volatility (annualized)', key: 'volatility', fmt: v => pct(v) },
    { label: 'Calmar ratio', key: 'calmar_ratio', fmt: v => num(v) },
    { label: 'Omega ratio', key: 'omega_ratio', fmt: v => num(v) },
    { label: 'Skewness (daily)', key: 'skewness', fmt: v => num(v) },
    { label: 'Excess kurtosis (daily)', key: 'kurtosis', fmt: v => num(v) },
    // Daily, and the losses are magnitudes: metrics.py computes all five on the
    // daily return series, with abs() on avg_loss and max_loss. Printed as
    // "per period" they read as rebalancing-window figures, and signed they
    // turned the worst day of 2008 into a +11.87% gain.
    { label: 'Win rate (share of positive days)', key: 'win_rate', fmt: v => pct(v, 1) },
    { label: 'Average winning day', key: 'avg_win', fmt: v => pct(v) },
    { label: 'Average losing day (magnitude)', key: 'avg_loss', fmt: v => pct(v) },
    { label: 'Best day', key: 'max_gain', fmt: v => signed(v) },
    { label: 'Worst day (magnitude)', key: 'max_loss', fmt: v => pct(v) },
    { label: 'Annualized turnover', key: 'annualized_turnover', fmt: v => pct(v, 0) },
    { label: 'Cumulative transaction costs', key: 'total_transaction_costs', fmt: v => pct(v) },
    { label: 'Rebalances', key: 'num_rebalances', fmt: v => String(v) },
];

// ------------------------------------------------------------------ sections

const header = (results: CompareResponse, generatedAt: Date): string => [
    '# BestAllocation — walk-forward backtest report',
    '',
    `**Universe:** ${results.tickers.join(', ')}  `,
    `**Backtest period:** ${results.data_start_date} → ${results.data_end_date}  `,
    `**Strategies:** ${results.methods.map(m => m.method_name).join(' · ')}  `,
    `**Benchmark:** ${results.benchmark_name}  `,
    `**Generated:** ${generatedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
].join('\n');

const howToRead = (): string => [
    '## How to read this report',
    '',
    '- **Method.** Walk-forward backtest: each strategy is re-optimized on a rolling training',
    '  window, then held for one rebalancing window, and so on. Only data available at the',
    "  decision date is used; orders are executed at the next session's open.",
    '- **Net of costs.** Every curve and metric is net of transaction costs (charged per side,',
    '  including the initial deployment, for the strategies *and* the equal-weight benchmark).',
    '  Idle cash earns the historical 3-month T-Bill rate, accrued daily.',
    '- **Units.** Equity curves are normalized to 1.0 at the start (1.0 = initial capital).',
    '  Drawdown curves are percentages and negative. Drawdown *metrics* are magnitudes:',
    '  `18.40%` means an 18.4% peak-to-trough loss. Weights and returns are percentages;',
    '  Sharpe, Sortino, Calmar, Omega, beta and skew/kurtosis are plain numbers.',
    '- **Sampled series.** Tables marked "sampled" were thinned for size. Every statistic in',
    '  this report was computed server-side on the full daily series — read a sampled table',
    '  for the shape of a curve, never to recompute a metric from it.',
    '- **Before calling a winner.** A ranking without error bars is a coin toss with decimals.',
    '  The *Statistical significance* section carries the bootstrap confidence interval on each',
    '  Sharpe gap, the probability of backtest overfitting and the deflated Sharpe ratio.',
    '  On most universes the honest answer is "inconclusive", and that is a result, not a gap.',
].join('\n');

const configuration = (results: CompareResponse, params?: OptimizationParams | null): string => {
    const rows: (string | number)[][] = [
        ['Tickers', `${results.tickers.join(', ')} (${results.tickers.length})`],
        ['Effective data window', `${results.data_start_date} → ${results.data_end_date}`],
    ];

    if (params) {
        rows.push(
            ['Requested start', params.startDate ?? 'full available history'],
            ['Requested end', params.endDate ?? 'latest available'],
            ['Training window', `${params.trainingWindow} trading days`],
            ['Rebalancing window', `${params.rebalancingWindow} trading days`],
            ['Transaction cost', `${params.transactionCostBps} bps per side`],
            [
                'Weight bounds per asset',
                `${pct(params.minWeight, 0)} – ${pct(params.maxWeight, 0)} (not applied to HRP, by design)`,
            ],
            [
                'Benchmark',
                params.benchmarkType === 'custom'
                    ? `${params.benchmarkTicker} (custom ticker, buy & hold, shown gross)`
                    : 'Equal weight 1/N (rebalanced on the same schedule, same costs)',
            ],
            [
                'Volatility scaling',
                params.enableVolatilityScaling
                    ? `on, target ${pct(params.targetVolatility, 0)} annualized`
                    : 'off',
            ],
            ['CVaR confidence (Min-CVaR beta)', pct(params.cvarConfidence, 0)],
        );
    }

    rows.push(['Risk-free rate (latest observed)', pct(results.risk_free_rate)]);

    return [
        '## 1. Run configuration',
        '',
        table(['Parameter', 'Value'], rows),
        ...(params ? [] : ['', '_The form parameters of this run were not recorded with the result._']),
    ].join('\n');
};

const dataCoverage = (results: CompareResponse): string => {
    const starts = Object.entries(results.ticker_start_dates ?? {});
    const parts = ['## 2. Data coverage and warnings', ''];

    if (starts.length) {
        parts.push(table(['Ticker', 'First price available'], starts.map(([t, d]) => [t, d])), '');
    }
    if (results.limiting_ticker) {
        parts.push(
            `**Limiting ticker:** ${results.limiting_ticker} — it starts last, so it sets the common ` +
            'start date of the whole comparison.',
            '',
        );
    }
    if (results.warnings?.length) {
        parts.push('**Warnings issued by the backend:**', '');
        results.warnings.forEach(w => parts.push(`- ${w}`));
    } else {
        parts.push('No data-quality warnings were raised.');
    }
    return parts.join('\n');
};

const rankingSection = (ranking?: GlobalRanking | null): string | null => {
    if (!ranking?.ranking.length) return null;
    return [
        '## 3. Global ranking (metric-wins heuristic)',
        '',
        `Each of the ${ranking.totalMetrics} ranked metrics awards one point to the strategy that wins`,
        'it. This is a quick summary, **not** a statistical verdict — see section 5 for that.',
        '',
        table(
            ['Rank', 'Strategy', 'Metrics won', 'Which'],
            ranking.ranking.map((entry, idx) => [
                `#${idx + 1}`,
                entry.method.method_name,
                `${entry.wins}/${ranking.totalMetrics}`,
                entry.winningMetrics.join(', ') || '—',
            ]),
        ),
    ].join('\n');
};

const performanceSection = (results: CompareResponse): string => {
    const fallbacks = results.methods
        .filter(m => m.current_allocation.fallback_used)
        .map(m => `- **${m.method_name}**: ${m.current_allocation.fallback_reason
            ?? 'the optimizer failed on the most recent rebalance and defaulted to cash.'}`);

    return [
        '## 4. Performance metrics',
        '',
        'Win rate and the win/loss rows are computed on *daily* returns; loss figures and the',
        'max drawdown are magnitudes, not negative numbers.',
        '',
        table(
            ['Metric', ...results.methods.map(m => m.method_name), results.benchmark_name],
            METRIC_ROWS.map(row => [
                row.label,
                ...results.methods.map(m => row.fmt(m.performance_metrics[row.key] as number)),
                row.fmt(results.benchmark_metrics[row.key] as number),
            ]),
        ),
        ...(fallbacks.length
            ? ['', '**Fallback allocations** (optimizer failure → cash):', '', ...fallbacks]
            : []),
    ].join('\n');
};

const significanceSection = (results: CompareResponse): string => {
    const sig = results.significance;
    const parts = ['## 5. Statistical significance', ''];

    if (!sig?.available) {
        parts.push(`Not computed: ${sig?.reason ?? 'not available for this run'}.`);
        return parts.join('\n');
    }

    parts.push(
        `Computed on ${sig.n_observations} daily observations of the full-resolution returns; ` +
        `benchmark = ${sig.benchmark_name ?? results.benchmark_name}.`,
        '',
    );

    if (sig.sharpe_comparisons?.length) {
        parts.push(
            `### Sharpe gaps — circular block bootstrap (${sig.bootstrap?.resamples ?? '?'} resamples, ` +
            `blocks of ${sig.bootstrap?.block_length ?? '?'} days)`,
            '',
            'Both series are resampled with the same blocks, so their correlation survives. A 95%',
            'interval containing 0 means the gap is inside the noise.',
            '',
            table(
                ['A', 'B', 'Sharpe(A) − Sharpe(B)', '95% CI', 'p-value', 'Significant'],
                sig.sharpe_comparisons.map(c => [
                    c.a, c.b, num(c.difference),
                    `[${num(c.ci_low)}, ${num(c.ci_high)}]`,
                    num(c.p_value, 3),
                    c.significant ? 'yes' : 'no',
                ]),
            ),
            '',
        );
    }

    if (sig.pbo) {
        const p = sig.pbo;
        parts.push(
            '### PBO — probability of backtest overfitting (CSCV)',
            '',
            `**PBO = ${pct(p.pbo, 1)}** over ${p.n_combinations.toLocaleString('en-US')} train/test ` +
            `combinations (${p.n_splits} splits, ${p.n_candidates} candidates), mean logit ` +
            `${num(p.logit_mean, 3)}. It is the probability that the in-sample winner ranks below the ` +
            'median out-of-sample; above ~50% the selection is noise.',
            '',
        );
        const share = Object.entries(p.in_sample_winner_share ?? {});
        if (share.length) {
            parts.push(
                table(['Candidate', 'Share of splits won in-sample'], share.map(([n, v]) => [n, pct(v, 1)])),
                '',
            );
        }
    }

    const dsr = Object.entries(sig.deflated_sharpe ?? {});
    if (dsr.length) {
        parts.push(
            '### Deflated Sharpe ratio',
            '',
            "Probability that the true Sharpe is above zero, after correcting for the number of",
            'candidates tried and for the skew and fat tails of the returns themselves.',
            '',
            table(
                ['Strategy', 'DSR', 'Observed Sharpe', 'Threshold Sharpe', 'Trials', 'Skew', 'Excess kurtosis', 'Tail adjustment'],
                dsr.map(([name, d]) => [
                    name, pct(d.dsr, 1), num(d.observed_sharpe), num(d.threshold_sharpe),
                    d.n_trials, num(d.skewness), num(d.kurtosis), num(d.tail_adjustment, 3),
                ]),
            ),
            '',
        );
    }

    const predictive = results.methods.filter(m => m.predictive_power);
    if (predictive.length) {
        parts.push(
            '### Rank-IC of the in-sample Sharpe, with its detectability ceiling',
            '',
            'Does the Sharpe the optimizer expected predict the next realized one? The ceiling is the',
            'largest correlation observable even with a perfect model, given the sampling error of a',
            'Sharpe measured over a single holding window (Lo, 2002) — read rho against the ceiling,',
            'not against 1. Cash periods are excluded.',
            '',
            table(
                ['Strategy', 'Spearman rho', 'Ceiling', 'p-value', 'n periods', 'Signal share', 'Noise sd'],
                predictive.map(m => {
                    const p = m.predictive_power!;
                    return [m.method_name, num(p.rho, 3), num(p.rho_ceiling, 3), num(p.p_value, 3),
                        p.n, pct(p.signal_share, 1), num(p.noise_sd, 3)];
                }),
            ),
            '',
        );
    }

    const edges = results.methods.filter(m => m.edge_stats);
    if (edges.length) {
        parts.push(
            '### Per-period edge over the benchmark',
            '',
            table(
                ['Strategy', 'Mean edge (Sharpe points)', 'sd', 't-stat', 'Hit rate', 'n periods'],
                edges.map(m => {
                    const e = m.edge_stats!;
                    return [m.method_name, num(e.mean, 3), num(e.sd, 3), num(e.t_stat), pct(e.hit_rate, 1), e.n];
                }),
            ),
        );
    }

    return parts.join('\n').trimEnd();
};

/** Value of a date-sorted series at the date closest to `target`, if near enough. */
const valueNear = (points: CurvePoint[], target: number): number | undefined => {
    if (!points.length) return undefined;

    let low = 0;
    let high = points.length - 1;
    while (low < high) {
        const mid = (low + high) >> 1;
        if (points[mid].date < target) low = mid + 1;
        else high = mid;
    }

    const closest = [low, low - 1]
        .filter(i => i >= 0 && i < points.length)
        .reduce((a, b) => (Math.abs(points[a].date - target) <= Math.abs(points[b].date - target) ? a : b));

    return Math.abs(points[closest].date - target) <= ALIGNMENT_TOLERANCE_MS
        ? points[closest].value
        : undefined;
};

/** One table across all methods plus the benchmark, keyed by the sampled dates. */
const curveTable = (
    series: { name: string; points: CurvePoint[] }[],
    digits: number,
): { body: string; kept: number; total: number } | null => {
    const reference = series.find(s => s.points.length)?.points ?? [];
    if (!reference.length) return null;

    const sampled = thin(reference, CURVE_POINTS);

    return {
        body: table(
            ['Date', ...series.map(s => s.name)],
            sampled.map(point => [
                day(point.date),
                ...series.map(s => {
                    const v = valueNear(s.points, point.date);
                    return isNum(v) ? v.toFixed(digits) : '—';
                }),
            ]),
        ),
        kept: sampled.length,
        total: reference.length,
    };
};

const equitySection = (results: CompareResponse): string | null => {
    const curves = curveTable([
        ...results.methods.map(m => ({ name: m.method_name, points: m.equity_curve })),
        { name: results.benchmark_name, points: results.benchmark_curve },
    ], 4);
    if (!curves) return null;

    return [
        '## 6. Equity curves',
        '',
        `Growth of 1.0, net of costs${sampleNote(curves.kept, curves.total)}. This is the data behind the`,
        'main comparison chart. The strategies are valued from the session after each decision and the',
        'benchmark from the decision itself, so the columns are aligned on the nearest date.',
        '',
        curves.body,
    ].join('\n');
};

const drawdownSection = (results: CompareResponse): string | null => {
    const curves = curveTable(
        results.methods.map(m => ({ name: m.method_name, points: m.drawdown_curve })), 2);
    if (!curves) return null;

    return [
        '## 7. Drawdowns',
        '',
        `Percent below the running peak, negative${sampleNote(curves.kept, curves.total)}. The worst value`,
        'of each full-resolution curve is the max drawdown reported in section 4.',
        '',
        curves.body,
    ].join('\n');
};

const rollingSharpeSection = (results: CompareResponse): string | null => {
    const available = results.methods.filter(m => m.rolling_sharpe?.length);
    if (!available.length) return null;

    const summary = table(
        ['Strategy', 'Min', 'Median', 'Max', 'Share of time above 0'],
        available.map(m => {
            const values = m.rolling_sharpe!.map(p => p.value).filter(isNum).sort((a, b) => a - b);
            const median = values.length % 2
                ? values[(values.length - 1) / 2]
                : (values[values.length / 2 - 1] + values[values.length / 2]) / 2;
            return [
                m.method_name, num(values[0]), num(median), num(values[values.length - 1]),
                pct(values.filter(v => v > 0).length / values.length, 0),
            ];
        }),
    );

    const curves = curveTable(available.map(m => ({ name: m.method_name, points: m.rolling_sharpe! })), 2);

    return [
        '## 8. Rolling Sharpe',
        '',
        'Annualized Sharpe over a rolling window, computed on the full daily curve.',
        '',
        summary,
        ...(curves ? ['', `Series${sampleNote(curves.kept, curves.total)}:`, '', curves.body] : []),
    ].join('\n');
};

const calendarSection = (results: CompareResponse): string | null => {
    const withYears = results.methods.filter(m => m.yearly_returns?.length);
    const withMonths = results.methods.filter(m => m.monthly_returns?.length);
    if (!withYears.length && !withMonths.length) return null;

    const parts = ['## 9. Calendar returns', ''];

    if (withYears.length) {
        const byMethod = withYears.map(m => ({
            name: m.method_name,
            at: new Map(m.yearly_returns!.map(p => [day(p.date).slice(0, 4), p.value])),
        }));
        const years = Array.from(new Set(byMethod.flatMap(m => [...m.at.keys()]))).sort();
        parts.push(
            'Calendar-year returns. The first entry is the first *full* year — a partial one is not',
            'comparable to the others, so the backend does not report it.',
            '',
            table(
                ['Year', ...byMethod.map(m => m.name)],
                years.map(y => [y, ...byMethod.map(m => signed(m.at.get(y)))]),
            ),
            '',
        );
    }

    if (withMonths.length) {
        parts.push(
            'Monthly return distribution — this is what the returns histogram bins.',
            '',
            table(
                ['Strategy', 'Months', 'Mean', 'Median', 'sd', 'Best', 'Worst', 'Positive months'],
                withMonths.map(m => {
                    const values = m.monthly_returns!.map(p => p.value).filter(isNum);
                    const sorted = [...values].sort((a, b) => a - b);
                    const mean = values.reduce((a, b) => a + b, 0) / values.length;
                    const median = sorted.length % 2
                        ? sorted[(sorted.length - 1) / 2]
                        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
                    const sd = Math.sqrt(
                        values.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(values.length - 1, 1));
                    return [
                        m.method_name, values.length, signed(mean), signed(median), pct(sd),
                        signed(sorted[sorted.length - 1]), signed(sorted[0]),
                        pct(values.filter(v => v > 0).length / values.length, 0),
                    ];
                }),
            ),
            '',
        );

        withMonths.forEach(m => {
            const byYear = new Map<string, Map<number, number>>();
            m.monthly_returns!.forEach(p => {
                const date = new Date(p.date);
                const year = String(date.getUTCFullYear());
                if (!byYear.has(year)) byYear.set(year, new Map());
                byYear.get(year)!.set(date.getUTCMonth(), p.value);
            });
            parts.push(
                `### ${m.method_name} — monthly returns (%)`,
                '',
                table(
                    ['Year', ...MONTHS],
                    Array.from(byYear.keys()).sort().map(year => {
                        const months = byYear.get(year)!;
                        return [year, ...MONTHS.map((_, i) => {
                            const v = months.get(i);
                            return isNum(v) ? (v * 100).toFixed(1) : '—';
                        })];
                    }),
                ),
                '',
            );
        });
    }

    return parts.join('\n').trimEnd();
};

const stressSection = (results: CompareResponse): string | null => {
    const scenarios = results.methods.find(m => m.stress_tests?.length)?.stress_tests
        ?? results.benchmark_stress_tests;
    if (!scenarios?.length) return null;

    const columns = [
        ...results.methods.map(m => ({
            name: m.method_name,
            at: new Map((m.stress_tests ?? []).map(s => [s.name, s])),
        })),
        {
            name: results.benchmark_name,
            at: new Map((results.benchmark_stress_tests ?? []).map(s => [s.name, s])),
        },
    ];

    const cells = (
        pick: (s: StressTestResult) => number,
        fmt: (v: number) => string,
    ): (string | number)[][] => scenarios.map(scenario => [
        scenario.name,
        ...columns.map(c => {
            const entry = c.at.get(scenario.name);
            return entry?.available ? fmt(pick(entry)) : 'no data';
        }),
    ]);

    const names = ['Scenario', ...columns.map(c => c.name)];

    return [
        '## 10. Historical stress tests',
        '',
        "Each strategy's own curve over fixed crisis windows, computed on the full daily series.",
        '',
        table(
            ['Scenario', 'Window', 'What it was'],
            scenarios.map(s => [s.name, `${s.start} → ${s.end}`, s.description]),
        ),
        '',
        '**Return over the window**',
        '',
        table(names, cells(s => s.return, v => signed(v))),
        '',
        '**Max drawdown inside the window (magnitude)**',
        '',
        table(names, cells(s => s.max_drawdown, v => pct(v))),
    ].join('\n');
};

/** Weights sum to less than 1 when a strategy has glided to cash. */
const cashOf = (weights: Record<string, number>): number =>
    1 - Object.values(weights).reduce((a, b) => a + (isNum(b) ? b : 0), 0);

const allocationSection = (results: CompareResponse): string => {
    const parts = [
        '## 11. Current allocation (latest rebalance)',
        '',
        `Target weights as of ${results.data_end_date}. "Cash" is the remainder — the strategies are`,
        'allowed to glide to cash, so the weights do not have to sum to 100%.',
        '',
        table(
            ['Asset', ...results.methods.map(m => m.method_name)],
            [
                ...results.tickers.map(ticker => [
                    ticker,
                    ...results.methods.map(m => pct(m.current_allocation.weights?.[ticker] ?? 0, 1)),
                ]),
                ['**Cash**', ...results.methods.map(m => pct(cashOf(m.current_allocation.weights ?? {}), 1))],
            ],
        ),
    ];

    const withRisk = results.methods.filter(
        m => Object.keys(m.current_allocation.risk_contributions ?? {}).length);
    if (withRisk.length) {
        parts.push(
            '',
            '**Marginal risk contribution** (share of portfolio volatility, sums to 100%) — a 20%',
            'weight carrying 45% of the risk is the thing to look at here.',
            '',
            table(
                ['Asset', ...withRisk.map(m => m.method_name)],
                results.tickers.map(ticker => [
                    ticker,
                    ...withRisk.map(m => pct(m.current_allocation.risk_contributions?.[ticker] ?? 0, 1)),
                ]),
            ),
        );
    }

    return parts.join('\n');
};

const allocationHistorySection = (results: CompareResponse): string | null => {
    const withHistory = results.methods.filter(m => m.allocation_history?.length);
    if (!withHistory.length) return null;

    const parts = ['## 12. Allocation history', '', 'Target weights (%) decided at each rebalance.', ''];

    const weightsOf = (entry: AllocationEntry): Record<string, number> =>
        Object.fromEntries(results.tickers.map(t => [t, isNum(entry[t]) ? entry[t] as number : 0]));

    withHistory.forEach(m => {
        const history = m.allocation_history;
        const sampled = thin(history, ALLOCATION_ROWS);
        const note = sampled.length < history.length
            ? ` — sampled ${sampled.length} of ${history.length} rebalances`
            : '';

        parts.push(
            `### ${m.method_name}${note}`,
            '',
            table(
                ['Date', ...results.tickers, 'Cash'],
                sampled.map(entry => {
                    const weights = weightsOf(entry);
                    return [
                        `${entry.date}${entry._fallback ? ' *' : ''}`,
                        ...results.tickers.map(t => (weights[t] * 100).toFixed(1)),
                        (cashOf(weights) * 100).toFixed(1),
                    ];
                }),
            ),
            '',
        );
        if (history.some(e => e._fallback)) {
            parts.push('`*` = fallback: the optimizer failed on that period and defaulted to cash.', '');
        }
    });

    return parts.join('\n').trimEnd();
};

const correlationSection = (results: CompareResponse): string | null => {
    const corr = results.correlation_matrix;
    if (!corr?.tickers?.length) return null;

    return [
        '## 13. Correlation matrix',
        '',
        'Daily-return correlations over the backtest window. Rows are ordered by hierarchical',
        'clustering, which is why neighbouring tickers are the ones that move together.',
        '',
        table(
            ['', ...corr.tickers],
            corr.tickers.map((ticker, i) => [
                ticker, ...corr.tickers.map((_, j) => num(corr.matrix?.[i]?.[j], 2)),
            ]),
        ),
    ].join('\n');
};

const frontierSection = (results: CompareResponse): string | null => {
    const frontier = results.efficient_frontier_data;
    if (!frontier?.assets?.length) return null;

    const parts = [
        '## 14. Efficient frontier (full-sample, context only)',
        '',
        'Computed on the whole period, so it is **in-sample** and not comparable to the walk-forward',
        'results above. Annualized return and volatility.',
        '',
        table(
            ['Asset', 'Return', 'Volatility'],
            frontier.assets.map(a => [a.ticker, signed(a.return), pct(a.volatility)]),
        ),
    ];

    if (frontier.curve?.length) {
        const sampled = thin(frontier.curve, FRONTIER_POINTS);
        parts.push(
            '',
            `**Frontier**${sampleNote(sampled.length, frontier.curve.length)}`,
            '',
            table(['Volatility', 'Return'], sampled.map(p => [pct(p.volatility), signed(p.return)])),
        );
    }

    return parts.join('\n');
};

const overfittingSection = (results: CompareResponse): string | null => {
    const withMetrics = results.methods.filter(m => m.overfitting_metrics?.length);
    if (!withMetrics.length) return null;

    const parts = [
        '## 15. Predicted vs realized Sharpe, per rebalance',
        '',
        "The optimizer's expectation at the decision date against what the next holding window",
        'actually delivered. The edge columns subtract the benchmark on the same window, which removes',
        'the market regime that dominates raw Sharpe levels. Rows flagged as cash periods are',
        'placeholders (the strategy was mostly out of the market) and are excluded from the',
        'statistics in section 5.',
        '',
    ];

    withMetrics.forEach(m => {
        parts.push(
            `### ${m.method_name}`,
            '',
            table(
                ['Decision date', 'Predicted Sharpe', 'Realized Sharpe', 'Predicted edge', 'Realized edge', 'Invested weight', 'Cash period'],
                m.overfitting_metrics.map(o => [
                    o.date, num(o.predicted_sharpe), num(o.realized_sharpe),
                    num(o.predicted_edge), num(o.realized_edge),
                    pct(o.invested_weight, 0), o.is_cash ? 'yes' : '',
                ]),
            ),
            '',
        );
    });

    return parts.join('\n').trimEnd();
};

// -------------------------------------------------------------------- public

/** The whole run as a Markdown report, ready to paste into a conversation. */
export function buildMarkdownReport(ctx: ReportContext): string {
    const { results, params, ranking } = ctx;
    const generatedAt = ctx.generatedAt ?? new Date();

    const sections: (string | null)[] = [
        header(results, generatedAt),
        howToRead(),
        configuration(results, params),
        dataCoverage(results),
        rankingSection(ranking),
        performanceSection(results),
        significanceSection(results),
        equitySection(results),
        drawdownSection(results),
        rollingSharpeSection(results),
        calendarSection(results),
        stressSection(results),
        allocationSection(results),
        allocationHistorySection(results),
        correlationSection(results),
        frontierSection(results),
        overfittingSection(results),
        '---\n\n_Exported from BestAllocation — walk-forward comparator of HRP, Min-CVaR and MVO._',
    ];

    return `${sections.filter(Boolean).join('\n\n')}\n`;
}

/** The same run untouched, for whatever wants to recompute rather than read. */
export function buildJsonExport(ctx: ReportContext): string {
    const generatedAt = ctx.generatedAt ?? new Date();
    return `${JSON.stringify({
        exported_at: generatedAt.toISOString(),
        source: 'BestAllocation',
        request: ctx.params ?? null,
        ranking: ctx.ranking
            ? {
                total_metrics: ctx.ranking.totalMetrics,
                order: ctx.ranking.ranking.map(e => ({
                    method: e.method.method,
                    wins: e.wins,
                    winning_metrics: e.winningMetrics,
                })),
            }
            : null,
        results: ctx.results,
    }, null, 2)}\n`;
}

/** `bestallocation-qqq-gld-tlt-20261021-1004` — tickers first, they identify the run. */
export function reportFileStem(results: CompareResponse, generatedAt = new Date()): string {
    const stamp = generatedAt.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
    const universe = results.tickers.slice(0, 4).join('-') + (results.tickers.length > 4 ? '-plus' : '');
    return `bestallocation-${universe || 'run'}-${stamp}`.toLowerCase();
}
