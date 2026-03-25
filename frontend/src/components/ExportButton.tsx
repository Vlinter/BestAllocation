import React from 'react';
import { Button, Box } from '@mui/material';
import { FileDownload } from '@mui/icons-material';
import type { CompareResponse } from '../api/client';

interface ExportButtonProps {
    results: CompareResponse;
}

const ExportButton: React.FC<ExportButtonProps> = ({ results }) => {
    const exportAllocationsCSV = () => {
        const rows: string[] = [];

        // Header: Method, Ticker1, Ticker2, ...
        const tickers = results.tickers;
        rows.push(['Method', ...tickers, 'Sharpe', 'Sortino', 'CAGR', 'Max Drawdown', 'Volatility', 'Calmar', 'Alpha', 'Beta', 'Omega'].join(','));

        results.methods.forEach(m => {
            const weights = tickers.map(t => (m.current_allocation.weights[t] ?? 0).toFixed(4));
            const pm = m.performance_metrics;
            rows.push([
                m.method_name,
                ...weights,
                pm.sharpe_ratio.toFixed(4),
                pm.sortino_ratio.toFixed(4),
                pm.cagr.toFixed(4),
                pm.max_drawdown.toFixed(4),
                pm.volatility.toFixed(4),
                pm.calmar_ratio.toFixed(4),
                pm.alpha.toFixed(4),
                pm.beta.toFixed(4),
                pm.omega_ratio.toFixed(4),
            ].join(','));
        });

        // Add benchmark row
        const bm = results.benchmark_metrics;
        rows.push([
            results.benchmark_name,
            ...tickers.map(() => (1 / tickers.length).toFixed(4)),
            bm.sharpe_ratio.toFixed(4),
            bm.sortino_ratio.toFixed(4),
            bm.cagr.toFixed(4),
            bm.max_drawdown.toFixed(4),
            bm.volatility.toFixed(4),
            bm.calmar_ratio.toFixed(4),
            bm.alpha.toFixed(4),
            bm.beta.toFixed(4),
            bm.omega_ratio.toFixed(4),
        ].join(','));

        const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        link.download = `portfolio_optimization_${dateStr}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
                variant="outlined"
                startIcon={<FileDownload />}
                onClick={exportAllocationsCSV}
                sx={{
                    borderColor: 'rgba(167, 139, 250, 0.4)',
                    color: '#A78BFA',
                    '&:hover': {
                        bgcolor: 'rgba(167, 139, 250, 0.1)',
                        borderColor: '#A78BFA',
                    },
                    fontWeight: 600,
                    textTransform: 'none',
                }}
            >
                Export to CSV
            </Button>
        </Box>
    );
};

export default ExportButton;
