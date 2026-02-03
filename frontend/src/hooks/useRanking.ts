import { useMemo } from 'react';
import type { CompareResponse, MethodResult, PerformanceMetrics } from '../api/client';

interface RankingEntry {
    method: MethodResult;
    wins: number;
    winningMetrics: string[];
}

interface GlobalRanking {
    ranking: RankingEntry[];
    totalMetrics: number;
}

interface MetricConfig {
    key: keyof PerformanceMetrics;
    higherIsBetter: boolean;
    label: string;
}

const METRICS_TO_COMPARE: MetricConfig[] = [
    { key: 'sharpe_ratio', higherIsBetter: true, label: 'Sharpe Ratio' },
    { key: 'sortino_ratio', higherIsBetter: true, label: 'Sortino Ratio' },
    { key: 'cagr', higherIsBetter: true, label: 'CAGR' },
    { key: 'total_return', higherIsBetter: true, label: 'Total Return' },
    { key: 'max_drawdown', higherIsBetter: false, label: 'Max Drawdown' },
    { key: 'volatility', higherIsBetter: false, label: 'Volatility' },
    { key: 'calmar_ratio', higherIsBetter: true, label: 'Calmar Ratio' },
    { key: 'alpha', higherIsBetter: true, label: 'Alpha' },
    { key: 'omega_ratio', higherIsBetter: true, label: 'Omega Ratio' },
    { key: 'win_rate', higherIsBetter: true, label: 'Win Rate' },
    { key: 'annualized_turnover', higherIsBetter: false, label: 'Turnover' },
];

/**
 * Hook to calculate global ranking of methods based on multiple performance metrics.
 * Uses a "wins" count approach where each method gets a point for each metric it wins.
 */
export function useRanking(results: CompareResponse | null): GlobalRanking | null {
    return useMemo(() => {
        if (!results) return null;

        // Count wins per method across all metrics
        const wins: Record<string, { count: number; metrics: string[] }> = {};
        results.methods.forEach(m => { wins[m.method] = { count: 0, metrics: [] }; });

        METRICS_TO_COMPARE.forEach(metric => {
            let bestMethod = '';
            let bestValue = metric.higherIsBetter ? -Infinity : Infinity;

            results.methods.forEach(m => {
                const value = m.performance_metrics[metric.key] as number;
                if (metric.higherIsBetter ? value > bestValue : value < bestValue) {
                    bestValue = value;
                    bestMethod = m.method;
                }
            });

            if (bestMethod) {
                wins[bestMethod].count++;
                wins[bestMethod].metrics.push(metric.label);
            }
        });

        // Sort by number of wins
        const ranking = results.methods
            .map(m => ({
                method: m,
                wins: wins[m.method].count,
                winningMetrics: wins[m.method].metrics,
            }))
            .sort((a, b) => b.wins - a.wins);

        return {
            ranking,
            totalMetrics: METRICS_TO_COMPARE.length,
        };
    }, [results]);
}
