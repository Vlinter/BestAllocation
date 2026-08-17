import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRanking } from './useRanking';
import { method, metrics, response } from '../test/fixtures';

describe('useRanking', () => {
    it('returns null without a response', () => {
        expect(renderHook(() => useRanking(null)).result.current).toBeNull();
    });

    it('awards one point per metric won and ranks by the count', () => {
        const winner = method('mvo', { performance_metrics: metrics({
            sharpe_ratio: 2, sortino_ratio: 2, cagr: 0.2, calmar_ratio: 2,
            alpha: 0.1, omega_ratio: 2, win_rate: 0.7,
            max_drawdown: 0.05, volatility: 0.05, annualized_turnover: 0.1,
        }) });
        const loser = method('hrp', { performance_metrics: metrics({
            sharpe_ratio: 1, sortino_ratio: 1, cagr: 0.1, calmar_ratio: 1,
            alpha: 0.01, omega_ratio: 1, win_rate: 0.5,
            max_drawdown: 0.3, volatility: 0.2, annualized_turnover: 0.9,
        }) });

        const r = renderHook(() => useRanking(response({ methods: [loser, winner] }))).result.current!;

        expect(r.totalMetrics).toBe(10);
        expect(r.ranking[0].method.method).toBe('mvo');
        expect(r.ranking[0].wins).toBe(10);
        expect(r.ranking[1].wins).toBe(0);
    });

    it('counts lower-is-better metrics in the right direction', () => {
        const safe = method('hrp', { performance_metrics: metrics({ max_drawdown: 0.05, volatility: 0.05, annualized_turnover: 0.1 }) });
        const wild = method('mvo', { performance_metrics: metrics({ max_drawdown: 0.5, volatility: 0.4, annualized_turnover: 2.0 }) });

        const r = renderHook(() => useRanking(response({ methods: [safe, wild] }))).result.current!;
        const hrp = r.ranking.find(e => e.method.method === 'hrp')!;

        expect(hrp.winningMetrics).toEqual(
            expect.arrayContaining(['Max Drawdown', 'Volatility', 'Turnover']));
    });

    it('does not rank total_return: it is the same information as CAGR', () => {
        const r = renderHook(() => useRanking(response())).result.current!;
        const labels = r.ranking.flatMap(e => e.winningMetrics);
        expect(labels).not.toContain('Total Return');
        // Beta is excluded too — it describes exposure, it is not a score.
        expect(labels).not.toContain('Beta');
    });
});
