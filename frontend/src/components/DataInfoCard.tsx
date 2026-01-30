import { Paper, Typography, Box, Chip, Alert } from '@mui/material';
import { Info as InfoIcon, Warning as WarningIcon } from '@mui/icons-material';

interface DataInfoCardProps {
    tickerStartDates: Record<string, string>;
    limitingTicker: string | null;
    dataStartDate: string;
    dataEndDate: string;
}

const DataInfoCard: React.FC<DataInfoCardProps> = ({
    tickerStartDates,
    limitingTicker,
    dataStartDate,
    dataEndDate,
}) => {
    // Sort tickers by start date
    const sortedTickers = Object.entries(tickerStartDates).sort(([, a], [, b]) => a.localeCompare(b));

    return (
        <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <InfoIcon sx={{ color: 'info.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Data Availability
                </Typography>
            </Box>

            {limitingTicker && (
                <Alert severity="info" sx={{ mb: 2 }} icon={<WarningIcon />}>
                    <Typography variant="body2">
                        <strong>{limitingTicker}</strong> limits the start date to <strong>{dataStartDate}</strong>
                    </Typography>
                </Alert>
            )}

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {sortedTickers.map(([ticker, startDate]) => (
                    <Chip
                        key={ticker}
                        label={`${ticker}: ${startDate}`}
                        size="small"
                        color={ticker === limitingTicker ? 'warning' : 'default'}
                        variant={ticker === limitingTicker ? 'filled' : 'outlined'}
                        sx={{
                            fontWeight: ticker === limitingTicker ? 700 : 400,
                        }}
                    />
                ))}
            </Box>

            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Common data period: <strong>{dataStartDate}</strong> to <strong>{dataEndDate}</strong>
                </Typography>
            </Box>
        </Paper>
    );
};

export default DataInfoCard;
