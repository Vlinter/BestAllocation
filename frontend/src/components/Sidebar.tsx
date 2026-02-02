import { useState } from 'react';
import {
    Box,
    TextField,
    Button,
    Typography,
    Paper,
    Chip,
    IconButton,
    Tooltip,
    Divider,
    Alert,
    Switch,
    FormControlLabel,
    ToggleButton,
    ToggleButtonGroup,
    Slider,
} from '@mui/material';
import {
    Add as AddIcon,
    TrendingUp as TrendingUpIcon,
    Settings as SettingsIcon,
    AttachMoney as MoneyIcon,
    CompareArrows as CompareIcon,
    ShowChart as BenchmarkIcon,
    Speed as SpeedIcon,
} from '@mui/icons-material';

interface SidebarProps {
    onOptimize: (params: OptimizationParams) => void;
    isLoading: boolean;
    error: string | null;
    isFullscreen?: boolean;
}

export interface OptimizationParams {
    tickers: string[];
    startDate: string | null;
    endDate: string | null;
    trainingWindow: number;
    rebalancingWindow: number;
    transactionCostBps: number;
    minWeight: number;
    maxWeight: number;
    benchmarkType: 'equal_weight' | 'custom';
    benchmarkTicker: string;
    enableVolatilityScaling: boolean;
    targetVolatility: number;
}

const Sidebar: React.FC<SidebarProps> = ({ onOptimize, isLoading, error, isFullscreen = false }) => {
    const [tickerInput, setTickerInput] = useState('');
    const [tickers, setTickers] = useState<string[]>(['QQQ', 'VGK', 'VWO', 'GLD', 'SLV', 'TLT']);
    const [useFullHistory, setUseFullHistory] = useState(true);
    const [startDate, setStartDate] = useState('2010-01-01');
    const [endDate, setEndDate] = useState('');
    const [trainingWindow, setTrainingWindow] = useState(252);
    const [rebalancingWindow, setRebalancingWindow] = useState(21);
    const [transactionCostBps, setTransactionCostBps] = useState(10);
    const [minWeight, setMinWeight] = useState(0);
    const [maxWeight, setMaxWeight] = useState(25); // Default: Diversified (1.5x equal weight for 6 tickers)
    // Benchmark settings
    const [benchmarkType, setBenchmarkType] = useState<'equal_weight' | 'custom'>('equal_weight');
    const [benchmarkTicker, setBenchmarkTicker] = useState('SPY');
    // Volatility Scaling (Quant Enhancement)
    const [enableVolatilityScaling, setEnableVolatilityScaling] = useState(false);
    const [targetVolatility, setTargetVolatility] = useState(12); // 12%


    // Custom toggle states
    const [isCustomTraining, setIsCustomTraining] = useState(false);
    const [isCustomRebalancing, setIsCustomRebalancing] = useState(false);

    const handleAddTicker = () => {
        const ticker = tickerInput.trim().toUpperCase();
        if (ticker && !tickers.includes(ticker)) {
            setTickers([...tickers, ticker]);
            setTickerInput('');
        }
    };

    const handleRemoveTicker = (tickerToRemove: string) => {
        setTickers(tickers.filter((t) => t !== tickerToRemove));
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleAddTicker();
    };

    const handleSubmit = () => {
        if (tickers.length < 2) return;
        onOptimize({
            tickers,
            startDate: useFullHistory ? null : startDate,
            endDate: endDate || null,
            trainingWindow,
            rebalancingWindow,
            transactionCostBps,
            minWeight: minWeight / 100,
            maxWeight: maxWeight / 100,
            benchmarkType,
            benchmarkTicker,
            enableVolatilityScaling,
            targetVolatility: targetVolatility / 100,
        });
    };

    return (
        <Paper
            elevation={0}
            sx={{
                width: isFullscreen ? '100%' : { xs: '100%', md: 360 },
                height: { xs: 'auto', md: '100vh' },
                minHeight: { xs: 'auto', md: '100vh' },
                p: { xs: 2, md: 3 },
                display: isFullscreen ? 'grid' : 'flex',
                gridTemplateColumns: isFullscreen ? 'repeat(auto-fit, minmax(320px, 1fr))' : undefined,
                flexDirection: isFullscreen ? undefined : 'column',
                gap: { xs: 2.5, md: 2 },
                borderRight: isFullscreen ? 'none' : { xs: 'none', md: '1px solid' },
                borderBottom: { xs: '1px solid', md: 'none' },
                borderColor: 'divider',
                overflowY: 'auto',
                pb: { xs: 4, md: 3 },
                WebkitOverflowScrolling: 'touch',
                alignItems: isFullscreen ? 'start' : 'stretch',
                alignContent: isFullscreen ? 'start' : 'stretch',
                '& > *': isFullscreen ? {
                    minWidth: 280,
                    maxWidth: 400,
                } : {},
            }}
        >
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <TrendingUpIcon sx={{ color: 'primary.main', fontSize: 28 }} />
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                    Quant Optimizer
                </Typography>
            </Box>

            {/* Compare Badge */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'rgba(167, 139, 250, 0.15)', p: 1.5, borderRadius: 2 }}>
                <CompareIcon sx={{ color: '#A78BFA' }} />
                <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#A78BFA' }}>
                        Compare All Methods
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        HRP, GMV, MDR run simultaneously
                    </Typography>
                </Box>
            </Box>

            <Divider />

            {/* Tickers Section */}
            <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary', fontSize: '0.7rem' }}>
                    PORTFOLIO TICKERS
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <TextField
                        size="small"
                        placeholder="Add ticker..."
                        value={tickerInput}
                        onChange={(e) => setTickerInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        sx={{ flex: 1 }}
                    />
                    <IconButton onClick={handleAddTicker} color="primary" sx={{ bgcolor: 'rgba(0, 212, 170, 0.1)' }}>
                        <AddIcon />
                    </IconButton>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {tickers.map((ticker) => (
                        <Chip
                            key={ticker}
                            label={ticker}
                            onDelete={() => handleRemoveTicker(ticker)}
                            size="small"
                            sx={{
                                bgcolor: 'rgba(0, 212, 170, 0.15)',
                                color: 'primary.main',
                                fontWeight: 600,
                                '& .MuiChip-deleteIcon': { color: 'primary.main' },
                            }}
                        />
                    ))}
                </Box>
                {tickers.length < 2 && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                        At least 2 tickers required
                    </Typography>
                )}
            </Box>

            {/* Benchmark Section */}
            <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <BenchmarkIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                        BENCHMARK
                    </Typography>
                </Box>
                <ToggleButtonGroup
                    value={benchmarkType}
                    exclusive
                    onChange={(_, v) => v && setBenchmarkType(v)}
                    size="small"
                    fullWidth
                    sx={{ mb: 1, flexWrap: { xs: 'wrap', md: 'nowrap' } }}
                >
                    <ToggleButton value="equal_weight" sx={{ fontSize: { xs: '0.65rem', md: '0.7rem' }, py: { xs: 1, md: 0.5 }, flex: { xs: '1 0 45%', md: 1 } }}>
                        Equal Weight (1/N)
                    </ToggleButton>
                    <ToggleButton value="custom" sx={{ fontSize: { xs: '0.65rem', md: '0.7rem' }, py: { xs: 1, md: 0.5 }, flex: { xs: '1 0 45%', md: 1 } }}>
                        Custom Ticker
                    </ToggleButton>
                </ToggleButtonGroup>
                {benchmarkType === 'custom' && (
                    <TextField
                        size="small"
                        placeholder="e.g., SPY"
                        value={benchmarkTicker}
                        onChange={(e) => setBenchmarkTicker(e.target.value.toUpperCase())}
                        fullWidth
                        sx={{ mb: 1 }}
                    />
                )}
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {benchmarkType === 'equal_weight'
                        ? 'Fair "Zero Skill" benchmark using your selected tickers'
                        : 'Compare against a specific market index'}
                </Typography>
            </Box>

            {/* Date Range */}
            <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary', fontSize: '0.7rem' }}>
                    DATA RANGE
                </Typography>
                <FormControlLabel
                    control={
                        <Switch
                            checked={useFullHistory}
                            onChange={(e) => setUseFullHistory(e.target.checked)}
                            color="primary"
                            size="small"
                        />
                    }
                    label={<Typography variant="body2">Use full history</Typography>}
                    sx={{ mb: 1 }}
                />
                {!useFullHistory && (
                    <TextField
                        size="small"
                        type="date"
                        label="Start Date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        fullWidth
                        sx={{ mb: 1 }}
                    />
                )}
                <TextField
                    size="small"
                    type="date"
                    label="End Date (blank = today)"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                />
            </Box>

            {/* Walk-Forward Settings */}
            <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <SettingsIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                        WALK-FORWARD SETTINGS
                    </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>Training Window</Typography>
                    <ToggleButtonGroup
                        value={isCustomTraining ? 'custom' : trainingWindow}
                        exclusive
                        onChange={(_, v) => {
                            if (v === 'custom') {
                                setIsCustomTraining(true);
                            } else if (v) {
                                setIsCustomTraining(false);
                                setTrainingWindow(v);
                            }
                        }}
                        size="small"
                        fullWidth
                        sx={{ mb: 1, flexWrap: { xs: 'wrap', md: 'nowrap' } }}
                    >
                        <ToggleButton value={126} sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' }, py: { xs: 1, md: 0.5 }, flex: { xs: '1 0 30%', md: 1 } }}>6M</ToggleButton>
                        <ToggleButton value={252} sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' }, py: { xs: 1, md: 0.5 }, flex: { xs: '1 0 30%', md: 1 } }}>1Y</ToggleButton>
                        <ToggleButton value={378} sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' }, py: { xs: 1, md: 0.5 }, flex: { xs: '1 0 30%', md: 1 } }}>1.5Y</ToggleButton>
                        <ToggleButton value={504} sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' }, py: { xs: 1, md: 0.5 }, flex: { xs: '1 0 30%', md: 1 } }}>2Y</ToggleButton>
                        <ToggleButton value="custom" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' }, py: { xs: 1, md: 0.5 }, flex: { xs: '1 0 30%', md: 1 } }}>Custom</ToggleButton>
                    </ToggleButtonGroup>

                    {isCustomTraining && (
                        <TextField
                            size="small"
                            type="number"
                            label="Training Window (Days)"
                            value={trainingWindow}
                            onChange={(e) => setTrainingWindow(Number(e.target.value))}
                            fullWidth
                            sx={{ mb: 1 }}
                            InputProps={{ inputProps: { min: 20 } }}
                        />
                    )}
                </Box>

                <Box>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>Rebalancing Frequency</Typography>
                    <ToggleButtonGroup
                        value={isCustomRebalancing ? 'custom' : rebalancingWindow}
                        exclusive
                        onChange={(_, v) => {
                            if (v === 'custom') {
                                setIsCustomRebalancing(true);
                            } else if (v) {
                                setIsCustomRebalancing(false);
                                setRebalancingWindow(v);
                            }
                        }}
                        size="small"
                        fullWidth
                        sx={{ flexWrap: { xs: 'wrap', md: 'nowrap' } }}
                    >
                        <ToggleButton value={5} sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' }, py: { xs: 1, md: 0.5 }, flex: { xs: '1 0 45%', md: 1 } }}>Weekly</ToggleButton>
                        <ToggleButton value={21} sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' }, py: { xs: 1, md: 0.5 }, flex: { xs: '1 0 45%', md: 1 } }}>Monthly</ToggleButton>
                        <ToggleButton value={63} sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' }, py: { xs: 1, md: 0.5 }, flex: { xs: '1 0 45%', md: 1 } }}>Quarterly</ToggleButton>
                        <ToggleButton value="custom" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' }, py: { xs: 1, md: 0.5 }, flex: { xs: '1 0 45%', md: 1 } }}>Custom</ToggleButton>
                    </ToggleButtonGroup>

                    {isCustomRebalancing && (
                        <TextField
                            size="small"
                            type="number"
                            label="Rebalance Every (Days)"
                            value={rebalancingWindow}
                            onChange={(e) => setRebalancingWindow(Number(e.target.value))}
                            fullWidth
                            sx={{ mt: 1 }}
                            InputProps={{ inputProps: { min: 1 } }}
                        />
                    )}
                </Box>
            </Box>

            {/* Transaction Costs */}
            <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <MoneyIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                        TRANSACTION COSTS
                    </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                        size="small"
                        type="number"
                        label="Cost per rebalance (bps)"
                        value={transactionCostBps}
                        onChange={(e) => setTransactionCostBps(Number(e.target.value))}
                        fullWidth
                        InputProps={{ inputProps: { min: 0, max: 200 } }}
                    />
                </Box>
                <Box sx={{ display: 'flex', gap: { xs: 1, md: 0.5 }, mt: 0.5, flexWrap: 'wrap' }}>
                    <Chip label="Zero (0)" size="small" onClick={() => setTransactionCostBps(0)} clickable variant={transactionCostBps === 0 ? "filled" : "outlined"} color="success" sx={{ py: { xs: 1.5, md: 0.5 }, fontSize: { xs: '0.75rem', md: '0.8125rem' } }} />
                    <Chip label="Low (10)" size="small" onClick={() => setTransactionCostBps(10)} clickable variant={transactionCostBps === 10 ? "filled" : "outlined"} sx={{ py: { xs: 1.5, md: 0.5 }, fontSize: { xs: '0.75rem', md: '0.8125rem' } }} />
                    <Chip label="Pro (30)" size="small" onClick={() => setTransactionCostBps(30)} clickable variant={transactionCostBps === 30 ? "filled" : "outlined"} sx={{ py: { xs: 1.5, md: 0.5 }, fontSize: { xs: '0.75rem', md: '0.8125rem' } }} />
                </Box>
            </Box>

            {/* Weight Constraints */}
            <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <SettingsIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                        WEIGHT CONSTRAINTS
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                        size="small"
                        type="number"
                        label="Min %"
                        value={minWeight}
                        onChange={(e) => setMinWeight(Math.min(Number(e.target.value), maxWeight))}
                        fullWidth
                        InputProps={{ inputProps: { min: 0, max: 100 } }}
                    />
                    <TextField
                        size="small"
                        type="number"
                        label="Max %"
                        value={maxWeight}
                        onChange={(e) => setMaxWeight(Math.max(Number(e.target.value), minWeight))}
                        fullWidth
                        InputProps={{ inputProps: { min: 0, max: 100 } }}
                    />
                </Box>
                <Box sx={{ display: 'flex', gap: { xs: 1, md: 0.5 }, mt: 0.5, flexWrap: 'wrap' }}>
                    {(() => {
                        // Dynamic Diversification Cap: 1.5x Equal Weight (1/N)
                        // Rounding to nearest 5% for cleaner UI
                        const n = tickers.length;
                        const recommendedMax = n > 0 ? Math.min(100, Math.ceil((100 / n) * 1.5 / 5) * 5) : 25;

                        return (
                            <Chip
                                label={`Diversified (Max ${recommendedMax}%)`}
                                size="small"
                                onClick={() => { setMinWeight(0); setMaxWeight(recommendedMax); }}
                                clickable
                                variant={maxWeight === recommendedMax ? "filled" : "outlined"}
                                color="primary"
                                sx={{ py: { xs: 1.5, md: 0.5 }, fontSize: { xs: '0.7rem', md: '0.8125rem' } }}
                            />
                        );
                    })()}
                    <Chip
                        label="Unconstrained"
                        size="small"
                        onClick={() => { setMinWeight(0); setMaxWeight(100); }}
                        clickable
                        variant={maxWeight === 100 ? "filled" : "outlined"}
                        sx={{ py: { xs: 1.5, md: 0.5 }, fontSize: { xs: '0.7rem', md: '0.8125rem' } }}
                    />
                </Box>
            </Box>

            {/* Volatility Scaling (Quant Enhancement) */}
            <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <SpeedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                        VOLATILITY SCALING
                    </Typography>
                </Box>
                <FormControlLabel
                    control={
                        <Switch
                            checked={enableVolatilityScaling}
                            onChange={(e) => setEnableVolatilityScaling(e.target.checked)}
                            color="primary"
                            size="small"
                        />
                    }
                    label={<Typography variant="body2">Enable adaptive risk targeting</Typography>}
                    sx={{ mb: 1 }}
                />
                {enableVolatilityScaling && (
                    <Box sx={{ px: 1 }}>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                            Target Volatility: {targetVolatility}%
                        </Typography>
                        <Slider
                            value={targetVolatility}
                            onChange={(_, v) => setTargetVolatility(v as number)}
                            min={5}
                            max={25}
                            step={1}
                            marks={[
                                { value: 5, label: '5%' },
                                { value: 10, label: '10%' },
                                { value: 15, label: '15%' },
                                { value: 20, label: '20%' },
                                { value: 25, label: '25%' },
                            ]}
                            sx={{ mb: 1 }}
                        />
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Reduces exposure when market volatility exceeds target
                        </Typography>
                    </Box>
                )}
            </Box>

            {/* CVaR Confidence Level Removed for GMV */}

            {/* Error */}
            {error && <Alert severity="error">{error}</Alert>}

            {/* Submit */}
            <Box sx={{ mt: 'auto', pt: 2 }}>
                <Tooltip title={tickers.length < 2 ? 'Add at least 2 tickers' : ''}>
                    <span>
                        <Button
                            variant="contained"
                            fullWidth
                            size="large"
                            onClick={handleSubmit}
                            disabled={isLoading || tickers.length < 2}
                            startIcon={<CompareIcon />}
                            sx={{
                                py: 1.5,
                                fontSize: '1rem',
                                background: 'linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)',
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #C4B5FD 0%, #8B5CF6 100%)',
                                },
                            }}
                        >
                            {isLoading ? 'Running 3 Strategies...' : 'Compare All Methods'}
                        </Button>
                    </span>
                </Tooltip>
            </Box>
        </Paper>
    );
};

export default Sidebar;
