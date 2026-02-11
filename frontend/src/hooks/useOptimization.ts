import { useState, useCallback } from 'react';
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
}

interface UseOptimizationReturn {
    isLoading: boolean;
    loadingProgress: number;
    loadingMessage: string;
    results: CompareResponse | null;
    error: string | null;
    runOptimization: (params: OptimizationParams) => Promise<void>;
    clearResults: () => void;
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

    const clearResults = useCallback(() => {
        setResults(null);
        setError(null);
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
                        setTimeout(poll, pollInterval);
                    }
                } catch (err) {
                    // Retry on transient network errors
                    if (isPolling) setTimeout(poll, pollInterval);
                }
            };

            poll();

        } catch (err: unknown) {
            const error = err as { response?: { data?: { detail?: string } }; message?: string };
            const message =
                error?.response?.data?.detail ||
                error?.message ||
                'An unexpected error occurred. Please try again.';
            setError(message);
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
        clearResults,
    };
}
