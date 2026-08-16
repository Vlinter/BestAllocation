import { useState, useCallback, useRef, useEffect } from 'react';
import { startComparisonJob, getJobStatus } from '../api/client';
import type { CompareRequest, CompareResponse } from '../api/client';

export interface OptimizationParams {
    tickers: string[];
    startDate: string | null;
    endDate: string | null;
    trainingWindow: number;
    rebalancingWindow: number;
    transactionCostBps: number;
    minWeight: number;
    maxWeight: number;
    benchmarkType: string;
    benchmarkTicker: string;
    enableVolatilityScaling: boolean;
    targetVolatility: number;
    cvarConfidence: number;
}

interface UseOptimizationReturn {
    isLoading: boolean;
    loadingProgress: number;
    loadingMessage: string;
    results: CompareResponse | null;
    error: string | null;
    runOptimization: (params: OptimizationParams) => Promise<void>;
}

/** One entry of FastAPI's 422 payload. */
interface ValidationIssue {
    msg?: string;
    loc?: (string | number)[];
}

/**
 * Turn any API failure into a string.
 *
 * FastAPI returns request-validation errors as `detail: [{loc, msg, ...}]` — a
 * LIST of objects, not a string. Passing it straight to setError put an array
 * of objects into JSX, and React refuses to render that ("Objects are not
 * valid as a React child"): the whole app blanked out instead of showing the
 * message. Any parameter outside the Pydantic bounds triggered it.
 */
function describeApiError(err: unknown): string {
    const e = err as { response?: { data?: { detail?: unknown } }; message?: string };
    const detail = e?.response?.data?.detail;

    if (typeof detail === 'string' && detail.trim()) return detail;

    if (Array.isArray(detail)) {
        const parts = (detail as ValidationIssue[])
            .map(issue => {
                const field = Array.isArray(issue.loc)
                    ? issue.loc.filter(p => p !== 'body').join('.')
                    : '';
                const msg = issue.msg ?? 'invalid value';
                return field ? `${field} — ${msg}` : msg;
            })
            .filter(Boolean);
        if (parts.length) return parts.join(' · ');
    }

    return e?.message || 'An unexpected error occurred. Please try again.';
}

/**
 * Hook to manage the optimization job lifecycle.
 * Handles starting jobs, polling for status, and managing loading states.
 */
export function useOptimization(): UseOptimizationReturn {
    const [isLoading, setIsLoading] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [loadingMessage, setLoadingMessage] = useState("Initializing...");
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<CompareResponse | null>(null);

    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    const runOptimization = useCallback(async (params: OptimizationParams) => {
        setIsLoading(true);
        setLoadingProgress(0);
        setLoadingMessage("Starting Job...");
        setError(null);

        try {
            // 1. Start Job
            const request: CompareRequest = {
                tickers: params.tickers,
                start_date: params.startDate,
                end_date: params.endDate,
                training_window: params.trainingWindow,
                rebalancing_window: params.rebalancingWindow,
                transaction_cost_bps: params.transactionCostBps,
                min_weight: params.minWeight,
                max_weight: params.maxWeight,
                benchmark_type: params.benchmarkType as "equal_weight" | "custom",
                benchmark_ticker: params.benchmarkTicker,
                enable_volatility_scaling: params.enableVolatilityScaling,
                target_volatility: params.targetVolatility,
                cvar_confidence: params.cvarConfidence,
            };

            const { job_id } = await startComparisonJob(request);

            // 2. Poll until complete
            const pollInterval = 500; // 0.5s
            const maxRetries = 600; // 5 minutes max (600 × 500ms)
            let retryCount = 0;
            let isPolling = true;

            const poll = async () => {
                if (!isPolling) return;

                if (retryCount >= maxRetries) {
                    setError("Optimization timed out after 5 minutes. Please try again with fewer tickers or a shorter date range.");
                    setIsLoading(false);
                    isPolling = false;
                    return;
                }
                retryCount++;

                try {
                    const status = await getJobStatus(job_id);

                    setLoadingProgress(status.progress);
                    setLoadingMessage(status.message);

                    if (status.status === 'completed' && status.result) {
                        setResults(status.result);
                        // Allow 100% to be seen for a moment
                        setTimeout(() => setIsLoading(false), 800);
                        isPolling = false;
                        return;
                    } else if (status.status === 'failed') {
                        setError(status.error || "Optimization failed");
                        setIsLoading(false);
                        isPolling = false;
                        return;
                    }

                    // Continue polling if not done
                    if (status.status === 'queued' || status.status === 'processing') {
                        if (isMounted.current && isPolling) setTimeout(poll, pollInterval);
                    }
                } catch {
                    // Retry on transient network errors
                    if (isMounted.current && isPolling) setTimeout(poll, pollInterval);
                }
            };

            if (isMounted.current) poll();

        } catch (err: unknown) {
            setError(describeApiError(err));
            setIsLoading(false);
        }
    }, []);

    return {
        isLoading,
        loadingProgress,
        loadingMessage,
        results,
        error,
        runOptimization,
    };
}
