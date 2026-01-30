import axios from 'axios';

// Use relative URL in production (same origin), localhost in development
const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:8000';

export interface CompareRequest {
  tickers: string[];
  start_date: string | null;
  end_date: string | null;
  training_window: number;
  rebalancing_window: number;
  transaction_cost_bps: number;
  min_weight: number;
  max_weight: number;
  // Benchmark options
  benchmark_type: 'equal_weight' | 'custom';
  benchmark_ticker?: string;

}

export interface PerformanceMetrics {
  sharpe_ratio: number;
  sortino_ratio: number;
  max_drawdown: number;
  cagr: number;
  total_return: number;
  volatility: number;
  calmar_ratio: number;
  total_transaction_costs: number;
  num_rebalances: number;
  // New metrics
  skewness: number;
  kurtosis: number;
  win_rate: number;
  avg_win: number;
  avg_loss: number;
  max_gain: number;
  max_loss: number;
  omega_ratio: number;
  // Turnover
  annualized_turnover: number;
  // Risk-adjusted vs benchmark
  alpha: number;
  beta: number;
}

export interface CurvePoint {
  date: number;
  value: number;
}

export interface AllocationEntry {
  date: string;
  _fallback?: boolean;
  [ticker: string]: string | number | boolean | undefined;
}

export interface CurrentAllocation {
  date: string;
  weights: Record<string, number>;
  risk_contributions: Record<string, number>;
  method: string;
  constraints_clipped?: boolean;  // True if HRP weights were clipped to meet constraints
  fallback_used?: boolean;  // True if optimization failed and fell back to Equal Weight
  fallback_reason?: string;  // Reason for fallback if used
  dendrogram_data?: any;  // Specific to method (e.g. HRP used this, NCO does not)

}

// Model transparency parameters
export interface ModelParams {
  covariance_estimator?: string;
  confidence_level?: string;
  linkage_method?: string;
}

export interface MethodResult {
  method: string;
  method_name: string;
  equity_curve: CurvePoint[];
  drawdown_curve: CurvePoint[];
  performance_metrics: PerformanceMetrics;
  current_allocation: CurrentAllocation;
  allocation_history: AllocationEntry[];

  overfitting_metrics: Array<{
    date: string;
    predicted_sharpe: number;
    realized_sharpe: number;
  }>;
  method_params?: ModelParams;
}

export interface CorrelationMatrix {
  tickers: string[];
  matrix: number[][];
}

export interface EfficientFrontierData {
  assets: Array<{ ticker: string; return: number; volatility: number }>;
  curve: Array<{ return: number; volatility: number }>;
  simulations?: Array<{ return: number; volatility: number }>;
}

export interface CompareResponse {
  methods: MethodResult[];
  benchmark_curve: CurvePoint[];
  benchmark_metrics: PerformanceMetrics;
  benchmark_name: string;
  tickers: string[];
  risk_free_rate: number;
  data_start_date: string;
  data_end_date: string;
  ticker_start_dates: Record<string, string>;
  limiting_ticker: string | null;
  correlation_matrix?: CorrelationMatrix;
  efficient_frontier_data?: EfficientFrontierData;
  warnings?: string[];  // Data quality or optimization warnings
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 180000, // 3 min for multiple backtests
});

export interface JobStatus {
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  result?: CompareResponse;
  error?: string;
}

export const startComparisonJob = async (
  request: CompareRequest
): Promise<{ job_id: string }> => {
  const response = await apiClient.post<{ job_id: string }>('/compare/start', request);
  return response.data;
};

export const getJobStatus = async (jobId: string): Promise<JobStatus> => {
  const response = await apiClient.get<JobStatus>(`/jobs/${jobId}`);
  return response.data;
};

// Deprecated: use startComparisonJob + polling instead for better UX
export const comparePortfolio = async (
  request: CompareRequest
): Promise<CompareResponse> => {
  const response = await apiClient.post<CompareResponse>('/compare', request);
  return response.data;
};

export const healthCheck = async (): Promise<{ status: string; current_risk_free_rate: number }> => {
  const response = await apiClient.get('/health');
  return response.data;
};
