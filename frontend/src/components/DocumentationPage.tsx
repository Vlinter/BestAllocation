import { useState } from 'react';
import {
    Drawer,
    Box,
    Typography,
    IconButton,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Divider,
    Chip,
    Paper,
} from '@mui/material';
import {
    Close as CloseIcon,
    ExpandMore as ExpandMoreIcon,
    Psychology as PsychologyIcon,
    Timeline as TimelineIcon,
    Assessment as AssessmentIcon,
    Storage as StorageIcon,
    MenuBook as MenuBookIcon,
    PlayArrow as PlayArrowIcon,
    AccountTree as AccountTreeIcon,
    Shield as ShieldIcon,
    ShowChart as ShowChartIcon,
    Fullscreen as FullscreenIcon,
    FullscreenExit as FullscreenExitIcon,
} from '@mui/icons-material';

interface DocumentationPageProps {
    open: boolean;
    onClose: () => void;
}

const DocumentationPage: React.FC<DocumentationPageProps> = ({ open, onClose }) => {
    const [expanded, setExpanded] = useState<string | false>('panel1');
    const [isFullscreen, setIsFullscreen] = useState(false);

    const handleChange = (panel: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
        setExpanded(isExpanded ? panel : false);
    };

    const SectionTitle = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {icon}
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{title}</Typography>
        </Box>
    );

    const Formula = ({ children }: { children: string }) => (
        <Box
            component="code"
            sx={{
                display: 'block',
                bgcolor: 'rgba(0,0,0,0.3)',
                p: 2,
                borderRadius: 1,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.85rem',
                my: 1,
                overflowX: 'auto',
            }}
        >
            {children}
        </Box>
    );

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    width: isFullscreen ? '100%' : { xs: '100%', sm: 500, md: 600 },
                    bgcolor: '#0D1117',
                    backgroundImage: 'none',
                    transition: 'width 0.3s ease',
                }
            }}
        >
            {/* Header */}
            <Box sx={{
                p: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.1) 0%, rgba(0, 212, 170, 0.1) 100%)',
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <MenuBookIcon sx={{ color: '#A78BFA', fontSize: 32 }} />
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff' }}>
                            Documentation
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            Complete Guide to the Portfolio Optimizer
                        </Typography>
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        sx={{ color: 'text.secondary', '&:hover': { color: '#A78BFA' } }}
                    >
                        {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                    </IconButton>
                    <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
                        <CloseIcon />
                    </IconButton>
                </Box>
            </Box>

            {/* Content */}
            <Box sx={{ p: 2, overflowY: 'auto', flex: 1 }}>
                {/* Getting Started */}
                <Accordion
                    expanded={expanded === 'panel1'}
                    onChange={handleChange('panel1')}
                    sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}
                >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <SectionTitle icon={<PlayArrowIcon sx={{ color: '#00D4AA' }} />} title="Quick Start" />
                    </AccordionSummary>
                    <AccordionDetails>
                        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                            <strong>1. Add Tickers</strong><br />
                            Enter your ETF/stock symbols (e.g., SPY, QQQ, GLD) in the input field and press Enter or click the + button.
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                            <strong>2. Configure Parameters</strong><br />
                            • <strong>Training Window</strong>: Learning period for the model (1 year by default)<br />
                            • <strong>Rebalancing</strong>: How often to update portfolio weights (monthly by default)<br />
                            • <strong>Transaction Costs</strong>: Fees in basis points (10 bps = 0.1%)
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            <strong>3. Run Optimization</strong><br />
                            Click "Compare All Methods" to run all 3 strategies simultaneously and compare their performance.
                        </Typography>
                    </AccordionDetails>
                </Accordion>

                <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.05)' }} />

                {/* Optimization Methods */}
                <Accordion
                    expanded={expanded === 'panel2'}
                    onChange={handleChange('panel2')}
                    sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}
                >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <SectionTitle icon={<PsychologyIcon sx={{ color: '#A78BFA' }} />} title="Optimization Methods" />
                    </AccordionSummary>
                    <AccordionDetails>
                        {/* HRP */}
                        <Paper sx={{ p: 2, mb: 2, bgcolor: 'rgba(167, 139, 250, 0.1)', border: '1px solid rgba(167, 139, 250, 0.3)' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <AccountTreeIcon sx={{ color: '#A78BFA' }} />
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#A78BFA' }}>
                                    HRP - Hierarchical Risk Parity
                                </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                                Developed by Marcos López de Prado (2016), this method uses machine learning
                                to cluster similar assets and distribute risk hierarchically.
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                <strong>Advantages:</strong> Robust, no need to invert the covariance matrix,
                                resistant to noise in data.
                            </Typography>
                        </Paper>

                        {/* GMV */}
                        <Paper sx={{ p: 2, mb: 2, bgcolor: 'rgba(0, 212, 170, 0.1)', border: '1px solid rgba(0, 212, 170, 0.3)' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <ShieldIcon sx={{ color: '#00D4AA' }} />
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#00D4AA' }}>
                                    GMV - Global Minimum Variance
                                </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                                Finds the portfolio with the lowest possible volatility, regardless of
                                expected returns. This is the leftmost point on the efficient frontier.
                            </Typography>
                            <Formula>min w'Σw  subject to  Σw = 1</Formula>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                <strong>Advantages:</strong> Simple, doesn't require estimating future returns
                                (which are often wrong), historically strong performance.
                            </Typography>
                        </Paper>

                        {/* MVO */}
                        <Paper sx={{ p: 2, bgcolor: 'rgba(96, 165, 250, 0.1)', border: '1px solid rgba(96, 165, 250, 0.3)' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <ShowChartIcon sx={{ color: '#60A5FA' }} />
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#60A5FA' }}>
                                    MVO - Mean-Variance Optimization (Max Sharpe)
                                </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                                The classic Markowitz method (1952). Maximizes the Sharpe ratio by finding
                                the optimal risk/return trade-off based on historical returns.
                            </Typography>
                            <Formula>max (μ'w - rf) / √(w'Σw)</Formula>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                <strong>Caution:</strong> Sensitive to return estimation errors.
                                We use an exponential moving average (EMA) to stabilize predictions.
                            </Typography>
                        </Paper>
                    </AccordionDetails>
                </Accordion>

                <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.05)' }} />

                {/* Walk-Forward */}
                <Accordion
                    expanded={expanded === 'panel3'}
                    onChange={handleChange('panel3')}
                    sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}
                >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <SectionTitle icon={<TimelineIcon sx={{ color: '#F59E0B' }} />} title="Walk-Forward Backtesting" />
                    </AccordionSummary>
                    <AccordionDetails>
                        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                            <strong>Walk-Forward Testing</strong> is the most realistic backtesting method.
                            It simulates exactly what would have happened if you had used the strategy in real-time.
                        </Typography>

                        <Paper sx={{ p: 2, mb: 2, bgcolor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                Day 1 → 252: Training (calculate weights)<br />
                                Day 253 → 273: Trading with those weights<br />
                                ─────────────────────────────────<br />
                                Day 22 → 273: Training (new weights)<br />
                                Day 274 → 294: Trading with new weights<br />
                                ─────────────────────────────────<br />
                                ... and so on until today
                            </Typography>
                        </Paper>

                        <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                            <strong>Training Window</strong>: The longer this window, the more stable the model
                            but the slower it adapts to recent market changes.
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            <strong>Rebalancing Frequency</strong>: Frequent rebalancing captures changes better
                            but generates more transaction costs.
                        </Typography>
                    </AccordionDetails>
                </Accordion>

                <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.05)' }} />

                {/* Metrics */}
                <Accordion
                    expanded={expanded === 'panel4'}
                    onChange={handleChange('panel4')}
                    sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}
                >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <SectionTitle icon={<AssessmentIcon sx={{ color: '#10B981' }} />} title="Performance Metrics" />
                    </AccordionSummary>
                    <AccordionDetails>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Box>
                                <Chip label="Sharpe Ratio" size="small" sx={{ mb: 0.5, bgcolor: 'rgba(0, 212, 170, 0.2)' }} />
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    Excess return per unit of risk. A Sharpe &gt; 1 is good, &gt; 2 is excellent.
                                </Typography>
                                <Formula>Sharpe = (Rp - Rf) / σp</Formula>
                            </Box>

                            <Box>
                                <Chip label="Sortino Ratio" size="small" sx={{ mb: 0.5, bgcolor: 'rgba(167, 139, 250, 0.2)' }} />
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    Like Sharpe but only penalizes downside volatility.
                                    More relevant because upside moves aren't "risk".
                                </Typography>
                            </Box>

                            <Box>
                                <Chip label="Max Drawdown" size="small" sx={{ mb: 0.5, bgcolor: 'rgba(239, 68, 68, 0.2)' }} />
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    The worst loss from a peak. A -20% drawdown means the portfolio
                                    fell 20% from its highest point.
                                </Typography>
                            </Box>

                            <Box>
                                <Chip label="Calmar Ratio" size="small" sx={{ mb: 0.5, bgcolor: 'rgba(245, 158, 11, 0.2)' }} />
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    Annualized return divided by max drawdown. Measures how much return
                                    you get per unit of maximum loss risk.
                                </Typography>
                            </Box>

                            <Box>
                                <Chip label="Omega Ratio" size="small" sx={{ mb: 0.5, bgcolor: 'rgba(96, 165, 250, 0.2)' }} />
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    Ratio of gains above threshold vs losses below. An Omega &gt; 1 means
                                    more gains than losses.
                                </Typography>
                            </Box>
                        </Box>
                    </AccordionDetails>
                </Accordion>

                <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.05)' }} />

                {/* Data Sources */}
                <Accordion
                    expanded={expanded === 'panel5'}
                    onChange={handleChange('panel5')}
                    sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}
                >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <SectionTitle icon={<StorageIcon sx={{ color: '#60A5FA' }} />} title="Data Sources" />
                    </AccordionSummary>
                    <AccordionDetails>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Paper sx={{ p: 2, bgcolor: 'rgba(96, 165, 250, 0.1)' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#60A5FA', mb: 1 }}>
                                    Tiingo API - Market Data
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    Adjusted prices (dividends & splits) for all US tickers.
                                    History available since 1990 for major ETFs.
                                </Typography>
                            </Paper>

                            <Paper sx={{ p: 2, bgcolor: 'rgba(0, 212, 170, 0.1)' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#00D4AA', mb: 1 }}>
                                    FRED API - Risk-Free Rate
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    3-month US Treasury Bill rates (DTB3) from the Federal Reserve.
                                    Updated daily and used to calculate Sharpe/Sortino ratios.
                                </Typography>
                            </Paper>
                        </Box>
                    </AccordionDetails>
                </Accordion>

                <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.05)' }} />

                {/* References */}
                <Accordion
                    expanded={expanded === 'panel6'}
                    onChange={handleChange('panel6')}
                    sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}
                >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <SectionTitle icon={<MenuBookIcon sx={{ color: '#F472B6' }} />} title="Academic References" />
                    </AccordionSummary>
                    <AccordionDetails>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff' }}>
                                    Markowitz, H. (1952)
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                                    "Portfolio Selection" - The Journal of Finance
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    Foundation of Modern Portfolio Theory (Nobel Prize 1990)
                                </Typography>
                            </Box>

                            <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff' }}>
                                    López de Prado, M. (2016)
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                                    "Building Diversified Portfolios that Outperform Out-of-Sample"
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    Introduction of the HRP (Hierarchical Risk Parity) method
                                </Typography>
                            </Box>

                            <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff' }}>
                                    Choueifaty, Y. & Coignard, Y. (2008)
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                                    "Toward Maximum Diversification"
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    Foundation of the Maximum Diversification Ratio
                                </Typography>
                            </Box>

                            <Divider sx={{ my: 1 }} />

                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', textAlign: 'center' }}>
                                This site is provided for educational purposes only.<br />
                                Past performance does not guarantee future results.
                            </Typography>
                        </Box>
                    </AccordionDetails>
                </Accordion>
            </Box>
        </Drawer>
    );
};

export default DocumentationPage;
