import { Box, Paper, Typography, Chip, LinearProgress } from '@mui/material';
import { AccountBalance as BankIcon, Today as TodayIcon } from '@mui/icons-material';

interface CurrentAllocationProps {
    allocation: {
        date: string;
        weights: Record<string, number>;
        method: string;
    };
    tickers: string[];
}

const COLORS = [
    '#00D4AA', '#FF6B6B', '#4ECDC4', '#FFE66D', '#A78BFA',
    '#F472B6', '#60A5FA', '#34D399', '#FB923C', '#CBD5E1',
];

const methodNames: Record<string, string> = {
    nco: 'Nested Clustered Optimization',
    gmv: 'Global Minimum Variance',
    mdr: 'Max Diversification Ratio',
};

const CurrentAllocationCard: React.FC<CurrentAllocationProps> = ({ allocation, tickers }) => {
    // Sort weights by value descending
    const sortedWeights = Object.entries(allocation.weights)
        .sort(([, a], [, b]) => b - a);

    return (
        <Paper
            sx={{
                p: 3,
                background: 'linear-gradient(135deg, rgba(0,212,170,0.1) 0%, rgba(0,168,138,0.05) 100%)',
                border: '2px solid rgba(0,212,170,0.3)',
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Box
                    sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: 'rgba(0,212,170,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <BankIcon sx={{ color: 'primary.main', fontSize: 28 }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                        Recommended Allocation
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        <TodayIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            As of {allocation.date}
                        </Typography>
                        <Chip
                            label={methodNames[allocation.method] || allocation.method}
                            size="small"
                            sx={{
                                bgcolor: 'rgba(0,212,170,0.2)',
                                color: 'primary.main',
                                fontWeight: 600,
                                fontSize: '0.7rem',
                            }}
                        />
                    </Box>
                </Box>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {sortedWeights.map(([ticker, weight], index) => (
                    <Box key={ticker}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box
                                    sx={{
                                        width: 12,
                                        height: 12,
                                        borderRadius: 1,
                                        bgcolor: COLORS[index % COLORS.length]
                                    }}
                                />
                                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                    {ticker}
                                </Typography>
                            </Box>
                            <Typography
                                variant="body1"
                                sx={{
                                    fontWeight: 700,
                                    fontFamily: 'monospace',
                                    color: weight > 0.2 ? 'primary.main' : 'text.primary',
                                }}
                            >
                                {(weight * 100).toFixed(1)}%
                            </Typography>
                        </Box>
                        <LinearProgress
                            variant="determinate"
                            value={weight * 100}
                            sx={{
                                height: 8,
                                borderRadius: 4,
                                bgcolor: 'rgba(255,255,255,0.05)',
                                '& .MuiLinearProgress-bar': {
                                    borderRadius: 4,
                                    bgcolor: COLORS[index % COLORS.length],
                                },
                            }}
                        />
                    </Box>
                ))}
            </Box>

            <Box
                sx={{
                    mt: 3,
                    pt: 2,
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                }}
            >
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Total Assets
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {tickers.length} ETFs/Stocks
                </Typography>
            </Box>
        </Paper>
    );
};

export default CurrentAllocationCard;
