import type { CompareResponse, MethodResult, PerformanceMetrics } from '../api/client';

export const metrics = (over: Partial<PerformanceMetrics> = {}): PerformanceMetrics => ({
    sharpe_ratio: 0.5, sortino_ratio: 0.7, max_drawdown: 0.2, cagr: 0.08,
    total_return: 1.0, volatility: 0.12, calmar_ratio: 0.4,
    total_transaction_costs: 0.02, num_rebalances: 40,
    skewness: 0, kurtosis: 0, win_rate: 0.54, avg_win: 0.01, avg_loss: 0.01,
    max_gain: 0.05, max_loss: 0.05, omega_ratio: 1.1, annualized_turnover: 0.3,
    alpha: 0.01, beta: 0.8,
    ...over,
});

export const method = (id: string, over: Partial<MethodResult> = {}): MethodResult => ({
    method: id,
    method_name: `${id.toUpperCase()} (test)`,
    equity_curve: [
        { date: 1_600_000_000_000, value: 1.0 },
        { date: 1_600_086_400_000, value: 1.1 },
        { date: 1_600_172_800_000, value: 1.2 },
    ],
    drawdown_curve: [
        { date: 1_600_000_000_000, value: 0 },
        { date: 1_600_086_400_000, value: -5 },
        { date: 1_600_172_800_000, value: -2 },
    ],
    performance_metrics: metrics(),
    current_allocation: {
        date: '2026-06-18',
        weights: { AAA: 0.5, BBB: 0.5 },
        risk_contributions: { AAA: 0.5, BBB: 0.5 },
        method: id,
    },
    allocation_history: [],
    overfitting_metrics: [],
    monthly_returns: [
        { date: 1_600_000_000_000, value: 0.03 },
        { date: 1_602_678_400_000, value: -0.02 },
    ],
    yearly_returns: [{ date: 1_609_372_800_000, value: 0.11 }],
    ...over,
});

export const response = (over: Partial<CompareResponse> = {}): CompareResponse => ({
    methods: [method('hrp'), method('cvar'), method('mvo')],
    benchmark_curve: [
        { date: 1_600_000_000_000, value: 1.0 },
        { date: 1_600_086_400_000, value: 1.05 },
        { date: 1_600_172_800_000, value: 1.08 },
    ],
    benchmark_metrics: metrics(),
    benchmark_name: 'Equal Weight',
    tickers: ['AAA', 'BBB'],
    risk_free_rate: 0.03,
    data_start_date: '2020-01-01',
    data_end_date: '2026-06-18',
    ticker_start_dates: { AAA: '2020-01-01', BBB: '2020-01-01' },
    limiting_ticker: 'AAA',
    ...over,
});
