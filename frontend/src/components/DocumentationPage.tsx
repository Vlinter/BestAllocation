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
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
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
    CheckCircle as CheckIcon,
    Warning as WarningIcon,
    Info as InfoIcon,
    TrendingUp as TrendingUpIcon,
    TrendingDown as TrendingDownIcon,
    Speed as SpeedIcon,
    Category as CategoryIcon,
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

    const InfoBox = ({ type, children }: { type: 'info' | 'warning' | 'success'; children: React.ReactNode }) => {
        const colors = {
            info: { bg: 'rgba(96, 165, 250, 0.1)', border: 'rgba(96, 165, 250, 0.3)', icon: <InfoIcon sx={{ color: '#60A5FA' }} /> },
            warning: { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)', icon: <WarningIcon sx={{ color: '#F59E0B' }} /> },
            success: { bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.3)', icon: <CheckIcon sx={{ color: '#10B981' }} /> },
        };
        return (
            <Paper sx={{ p: 2, my: 2, bgcolor: colors[type].bg, border: `1px solid ${colors[type].border}`, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                {colors[type].icon}
                <Box>{children}</Box>
            </Paper>
        );
    };

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    width: isFullscreen ? '100%' : { xs: '100%', sm: 550, md: 700 },
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

                {/* ==================== QUICK START ==================== */}
                <Accordion
                    expanded={expanded === 'panel1'}
                    onChange={handleChange('panel1')}
                    sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}
                >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <SectionTitle icon={<PlayArrowIcon sx={{ color: '#00D4AA' }} />} title="Quick Start Guide" />
                    </AccordionSummary>
                    <AccordionDetails>
                        <Typography variant="h6" sx={{ mb: 2, color: '#00D4AA' }}>What is this tool?</Typography>
                        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                            This Portfolio Optimizer is a professional-grade tool that helps you find the optimal allocation
                            of your investments across multiple assets. It uses advanced mathematical optimization techniques
                            used by quantitative hedge funds and institutional investors.
                        </Typography>

                        <Typography variant="h6" sx={{ mb: 2, mt: 3, color: '#00D4AA' }}>Step 1: Add Your Tickers</Typography>
                        <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                            Enter ticker symbols for the assets you want to include in your portfolio:
                        </Typography>
                        <List dense>
                            <ListItem><ListItemIcon><CheckIcon sx={{ color: '#00D4AA' }} /></ListItemIcon>
                                <ListItemText primary="US Stocks & ETFs" secondary="SPY, QQQ, AAPL, MSFT, VTI, VOO..." sx={{ '& .MuiListItemText-secondary': { color: 'text.secondary' } }} />
                            </ListItem>
                            <ListItem><ListItemIcon><CheckIcon sx={{ color: '#00D4AA' }} /></ListItemIcon>
                                <ListItemText primary="International ETFs" secondary="VGK (Europe), VWO (Emerging), EFA (Developed)..." sx={{ '& .MuiListItemText-secondary': { color: 'text.secondary' } }} />
                            </ListItem>
                            <ListItem><ListItemIcon><CheckIcon sx={{ color: '#00D4AA' }} /></ListItemIcon>
                                <ListItemText primary="Bonds" secondary="TLT, BND, AGG, LQD, HYG..." sx={{ '& .MuiListItemText-secondary': { color: 'text.secondary' } }} />
                            </ListItem>
                            <ListItem><ListItemIcon><CheckIcon sx={{ color: '#00D4AA' }} /></ListItemIcon>
                                <ListItemText primary="Commodities" secondary="GLD (Gold), SLV (Silver), USO (Oil), DBA (Agriculture)..." sx={{ '& .MuiListItemText-secondary': { color: 'text.secondary' } }} />
                            </ListItem>
                        </List>

                        <InfoBox type="info">
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                <strong>Tip:</strong> For best results, include at least 4-6 assets from different asset classes.
                                Diversification is the key to reducing risk without sacrificing returns.
                            </Typography>
                        </InfoBox>

                        <Typography variant="h6" sx={{ mb: 2, mt: 3, color: '#00D4AA' }}>Step 2: Configure Parameters</Typography>

                        <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                            <strong>Training Window (days):</strong>
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary', pl: 2 }}>
                            How many days of historical data to use for calculating optimal weights.
                            • <strong>252 days (1 year)</strong>: Good balance, adapts to recent market conditions<br />
                            • <strong>504 days (2 years)</strong>: More stable, less reactive to short-term changes<br />
                            • <strong>126 days (6 months)</strong>: Very reactive, may overfit to recent data
                        </Typography>

                        <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                            <strong>Rebalancing Frequency:</strong>
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary', pl: 2 }}>
                            How often to recalculate and update portfolio weights.<br />
                            • <strong>Monthly (21 days)</strong>: Standard choice, good balance of adaptation and costs<br />
                            • <strong>Quarterly (63 days)</strong>: Lower transaction costs, less tax events<br />
                            • <strong>Weekly (5 days)</strong>: More responsive, but higher transaction costs
                        </Typography>

                        <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                            <strong>Transaction Costs (bps):</strong>
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary', pl: 2 }}>
                            Basis points charged per trade. 1 bp = 0.01%<br />
                            • <strong>0 bps</strong>: Commission-free trading (Robinhood, etc.)<br />
                            • <strong>10 bps</strong>: Low-cost broker with spreads<br />
                            • <strong>30 bps</strong>: Professional/institutional costs
                        </Typography>

                        <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                            <strong>Weight Constraints:</strong>
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary', pl: 2 }}>
                            Min/Max percentage each asset can have.<br />
                            • <strong>Diversified (recommended)</strong>: Max = 1.5× equal weight. Forces diversification.<br />
                            • <strong>Unconstrained</strong>: 0-100%, allows concentration in best assets.
                        </Typography>

                        <Typography variant="h6" sx={{ mb: 2, mt: 3, color: '#00D4AA' }}>Step 3: Compare Methods</Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            Click "Compare All Methods" to run three different optimization strategies simultaneously:
                            HRP, GMV, and MVO (explained in detail in the next section). The tool will backtest all three
                            using walk-forward analysis and show you which performed best historically.
                        </Typography>

                        <InfoBox type="warning">
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                <strong>Important:</strong> Past performance does not guarantee future results.
                                Use this tool for research and education, not as financial advice.
                            </Typography>
                        </InfoBox>
                    </AccordionDetails>
                </Accordion>

                <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.05)' }} />

                {/* ==================== OPTIMIZATION METHODS ==================== */}
                <Accordion
                    expanded={expanded === 'panel2'}
                    onChange={handleChange('panel2')}
                    sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}
                >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <SectionTitle icon={<PsychologyIcon sx={{ color: '#A78BFA' }} />} title="Optimization Methods Explained" />
                    </AccordionSummary>
                    <AccordionDetails>

                        {/* HRP */}
                        <Paper sx={{ p: 3, mb: 3, bgcolor: 'rgba(167, 139, 250, 0.1)', border: '1px solid rgba(167, 139, 250, 0.3)' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                <AccountTreeIcon sx={{ color: '#A78BFA', fontSize: 28 }} />
                                <Typography variant="h6" sx={{ fontWeight: 700, color: '#A78BFA' }}>
                                    HRP - Hierarchical Risk Parity
                                </Typography>
                            </Box>

                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                                <strong>The Innovation:</strong> Developed by Marcos López de Prado in 2016, HRP revolutionized
                                portfolio optimization by using machine learning techniques (hierarchical clustering) to group
                                similar assets together before allocating risk.
                            </Typography>

                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                                <strong>How it Works:</strong>
                            </Typography>
                            <List dense sx={{ mb: 2 }}>
                                <ListItem><ListItemIcon><CategoryIcon sx={{ color: '#A78BFA' }} /></ListItemIcon>
                                    <ListItemText primary="1. Correlation Analysis" secondary="Calculate correlations between all assets" sx={{ '& .MuiListItemText-secondary': { color: 'text.secondary' } }} />
                                </ListItem>
                                <ListItem><ListItemIcon><AccountTreeIcon sx={{ color: '#A78BFA' }} /></ListItemIcon>
                                    <ListItemText primary="2. Hierarchical Clustering" secondary="Group similar assets into a tree structure" sx={{ '& .MuiListItemText-secondary': { color: 'text.secondary' } }} />
                                </ListItem>
                                <ListItem><ListItemIcon><SpeedIcon sx={{ color: '#A78BFA' }} /></ListItemIcon>
                                    <ListItemText primary="3. Risk Allocation" secondary="Distribute risk through the tree, giving less to risky clusters" sx={{ '& .MuiListItemText-secondary': { color: 'text.secondary' } }} />
                                </ListItem>
                            </List>

                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                                <strong>Why it's Better:</strong>
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', pl: 2 }}>
                                • <strong>No matrix inversion:</strong> Traditional methods need to invert the covariance matrix,
                                which amplifies estimation errors. HRP avoids this entirely.<br />
                                • <strong>Robust to noise:</strong> Works well even with short historical data.<br />
                                • <strong>Intuitive:</strong> Groups similar assets naturally (tech stocks together, bonds together, etc.).
                            </Typography>

                            <InfoBox type="success">
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    <strong>Best for:</strong> Most investors. HRP typically delivers the most consistent
                                    out-of-sample performance across different market conditions.
                                </Typography>
                            </InfoBox>
                        </Paper>

                        {/* GMV */}
                        <Paper sx={{ p: 3, mb: 3, bgcolor: 'rgba(0, 212, 170, 0.1)', border: '1px solid rgba(0, 212, 170, 0.3)' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                <ShieldIcon sx={{ color: '#00D4AA', fontSize: 28 }} />
                                <Typography variant="h6" sx={{ fontWeight: 700, color: '#00D4AA' }}>
                                    GMV - Global Minimum Variance
                                </Typography>
                            </Box>

                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                                <strong>The Philosophy:</strong> "I don't know which assets will go up, but I can measure
                                which combinations have the lowest volatility." GMV finds the portfolio with the absolute
                                minimum variance possible.
                            </Typography>

                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                                <strong>Mathematical Formulation:</strong>
                            </Typography>
                            <Formula>minimize   w'Σw   (portfolio variance)</Formula>
                            <Formula>subject to  Σwᵢ = 1   (weights sum to 100%)</Formula>
                            <Formula>            0 ≤ wᵢ ≤ max_weight   (weight constraints)</Formula>

                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1, mt: 2 }}>
                                <strong>Where:</strong>
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', pl: 2 }}>
                                • <strong>w</strong> = vector of portfolio weights<br />
                                • <strong>Σ</strong> = covariance matrix of asset returns<br />
                                • <strong>w'Σw</strong> = portfolio variance
                            </Typography>

                            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 2, mb: 1 }}>
                                <strong>Key Insight:</strong>
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                GMV doesn't try to predict returns (which is very hard). It only uses the covariance matrix,
                                which is more stable and easier to estimate. Research shows this often outperforms methods
                                that try to forecast returns.
                            </Typography>

                            <InfoBox type="success">
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    <strong>Best for:</strong> Conservative investors who prioritize capital preservation
                                    and want the smoothest equity curve with minimal drawdowns.
                                </Typography>
                            </InfoBox>
                        </Paper>

                        {/* MVO */}
                        <Paper sx={{ p: 3, bgcolor: 'rgba(96, 165, 250, 0.1)', border: '1px solid rgba(96, 165, 250, 0.3)' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                <ShowChartIcon sx={{ color: '#60A5FA', fontSize: 28 }} />
                                <Typography variant="h6" sx={{ fontWeight: 700, color: '#60A5FA' }}>
                                    MVO - Mean-Variance Optimization (Max Sharpe)
                                </Typography>
                            </Box>

                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                                <strong>The Classic:</strong> Developed by Harry Markowitz in 1952 (Nobel Prize in Economics, 1990).
                                This is the foundation of Modern Portfolio Theory. It finds the portfolio with the highest
                                Sharpe ratio - the best risk-adjusted return.
                            </Typography>

                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                                <strong>Mathematical Formulation:</strong>
                            </Typography>
                            <Formula>maximize   (μ'w - rf) / √(w'Σw)   (Sharpe Ratio)</Formula>
                            <Formula>subject to  Σwᵢ = 1</Formula>

                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1, mt: 2 }}>
                                <strong>Where:</strong>
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', pl: 2 }}>
                                • <strong>μ</strong> = vector of expected returns<br />
                                • <strong>rf</strong> = risk-free rate (T-Bill rate)<br />
                                • <strong>√(w'Σw)</strong> = portfolio standard deviation
                            </Typography>

                            <InfoBox type="warning">
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    <strong>Caution:</strong> MVO is very sensitive to return estimates. Small errors in
                                    expected returns can lead to wildly different allocations. We use Exponential Moving
                                    Average (EMA) of returns to stabilize predictions, but this method generally has
                                    higher estimation error than GMV or HRP.
                                </Typography>
                            </InfoBox>

                            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 2 }}>
                                <strong>When it goes to Cash:</strong> If all assets have expected returns below the
                                risk-free rate, MVO will allocate 100% to cash (T-Bills). This is mathematically correct
                                but may not match your investment goals.
                            </Typography>
                        </Paper>
                    </AccordionDetails>
                </Accordion>

                <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.05)' }} />

                {/* ==================== WALK-FORWARD ==================== */}
                <Accordion
                    expanded={expanded === 'panel3'}
                    onChange={handleChange('panel3')}
                    sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}
                >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <SectionTitle icon={<TimelineIcon sx={{ color: '#F59E0B' }} />} title="Walk-Forward Backtesting" />
                    </AccordionSummary>
                    <AccordionDetails>
                        <Typography variant="h6" sx={{ mb: 2, color: '#F59E0B' }}>What is Walk-Forward Testing?</Typography>

                        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                            Walk-Forward is the <strong>gold standard</strong> of backtesting. Unlike simple backtests that
                            use future data to make past decisions (look-ahead bias), walk-forward simulates exactly what
                            you would have experienced in real-time.
                        </Typography>

                        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                            <strong>The Problem with Simple Backtests:</strong><br />
                            If you optimize a portfolio using 10 years of data and then test it on those same 10 years,
                            you're cheating. The model already knows what happened. This leads to <strong>overfitting</strong> -
                            strategies that look great historically but fail in real trading.
                        </Typography>

                        <Typography variant="h6" sx={{ mb: 2, mt: 3, color: '#F59E0B' }}>How Walk-Forward Works</Typography>

                        <Paper sx={{ p: 2, mb: 3, bgcolor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: 1.8 }}>
                                <strong>Example: 1-year training, monthly rebalancing</strong><br /><br />
                                📊 Day 1 → 252:   Use this data to calculate optimal weights<br />
                                📈 Day 253 → 273: TRADE with those weights (21 days)<br />
                                ────────────────────────────────────────────<br />
                                📊 Day 22 → 273:  Slide window forward, recalculate weights<br />
                                📈 Day 274 → 294: TRADE with new weights (21 days)<br />
                                ────────────────────────────────────────────<br />
                                📊 Day 43 → 294:  Slide again, recalculate<br />
                                📈 Day 295 → 315: TRADE with new weights<br />
                                ────────────────────────────────────────────<br />
                                ... continues until today
                            </Typography>
                        </Paper>

                        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                            <strong>Key Point:</strong> At each step, we only use <em>past</em> data to make decisions.
                            The model never sees future prices. This gives you a realistic estimate of how the strategy
                            would have actually performed.
                        </Typography>

                        <Typography variant="h6" sx={{ mb: 2, mt: 3, color: '#F59E0B' }}>Parameter Trade-offs</Typography>

                        <Box sx={{ display: 'flex', gap: 2, flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                            <Paper sx={{ flex: 1, p: 2, bgcolor: 'rgba(255,255,255,0.03)' }}>
                                <Typography variant="subtitle2" sx={{ color: '#F59E0B', mb: 1 }}>
                                    <TrendingUpIcon sx={{ fontSize: 16, mr: 0.5 }} />
                                    Longer Training Window
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                                    ✅ More stable estimates<br />
                                    ✅ Less overfitting<br />
                                    ❌ Slower to adapt<br />
                                    ❌ May miss regime changes
                                </Typography>
                            </Paper>
                            <Paper sx={{ flex: 1, p: 2, bgcolor: 'rgba(255,255,255,0.03)' }}>
                                <Typography variant="subtitle2" sx={{ color: '#F59E0B', mb: 1 }}>
                                    <TrendingDownIcon sx={{ fontSize: 16, mr: 0.5 }} />
                                    Shorter Training Window
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                                    ✅ Adapts quickly<br />
                                    ✅ Captures regime changes<br />
                                    ❌ Noisy estimates<br />
                                    ❌ Higher overfitting risk
                                </Typography>
                            </Paper>
                        </Box>

                        <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                            <Paper sx={{ flex: 1, p: 2, bgcolor: 'rgba(255,255,255,0.03)' }}>
                                <Typography variant="subtitle2" sx={{ color: '#10B981', mb: 1 }}>
                                    <SpeedIcon sx={{ fontSize: 16, mr: 0.5 }} />
                                    Frequent Rebalancing
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                                    ✅ Stays close to optimal<br />
                                    ✅ Captures opportunities<br />
                                    ❌ Higher transaction costs<br />
                                    ❌ More tax events
                                </Typography>
                            </Paper>
                            <Paper sx={{ flex: 1, p: 2, bgcolor: 'rgba(255,255,255,0.03)' }}>
                                <Typography variant="subtitle2" sx={{ color: '#10B981', mb: 1 }}>
                                    <SpeedIcon sx={{ fontSize: 16, mr: 0.5 }} />
                                    Infrequent Rebalancing
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                                    ✅ Lower costs<br />
                                    ✅ Tax efficient<br />
                                    ❌ Drift from optimal<br />
                                    ❌ May miss signals
                                </Typography>
                            </Paper>
                        </Box>
                    </AccordionDetails>
                </Accordion>

                <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.05)' }} />

                {/* ==================== METRICS ==================== */}
                <Accordion
                    expanded={expanded === 'panel4'}
                    onChange={handleChange('panel4')}
                    sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}
                >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <SectionTitle icon={<AssessmentIcon sx={{ color: '#10B981' }} />} title="Performance Metrics Explained" />
                    </AccordionSummary>
                    <AccordionDetails>
                        <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
                            Understanding these metrics is crucial for evaluating portfolio performance.
                            Each captures a different aspect of risk and return.
                        </Typography>

                        {/* Sharpe */}
                        <Paper sx={{ p: 2, mb: 2, bgcolor: 'rgba(0, 212, 170, 0.1)' }}>
                            <Chip label="Sharpe Ratio" sx={{ mb: 1, bgcolor: 'rgba(0, 212, 170, 0.3)' }} />
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                                The most widely used risk-adjusted return metric. Measures excess return per unit of total volatility.
                            </Typography>
                            <Formula>Sharpe = (Rp - Rf) / σp</Formula>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                                • <strong>&lt; 0</strong>: You'd be better off in T-Bills<br />
                                • <strong>0 - 1</strong>: Acceptable but not great<br />
                                • <strong>1 - 2</strong>: Good, most mutual funds are here<br />
                                • <strong>2 - 3</strong>: Excellent, hedge fund territory<br />
                                • <strong>&gt; 3</strong>: Exceptional (or suspicious, check for errors)
                            </Typography>
                        </Paper>

                        {/* Sortino */}
                        <Paper sx={{ p: 2, mb: 2, bgcolor: 'rgba(167, 139, 250, 0.1)' }}>
                            <Chip label="Sortino Ratio" sx={{ mb: 1, bgcolor: 'rgba(167, 139, 250, 0.3)' }} />
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                                Like Sharpe but only counts <em>downside</em> volatility. A 10% gain and 10% loss are treated
                                the same by Sharpe, but Sortino only penalizes the loss.
                            </Typography>
                            <Formula>Sortino = (Rp - Rf) / σ_downside</Formula>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                                Generally more meaningful than Sharpe because investors care about losses, not gains.
                                A strategy with high upside volatility (large gains) but low downside volatility will
                                have a higher Sortino than Sharpe.
                            </Typography>
                        </Paper>

                        {/* Max Drawdown */}
                        <Paper sx={{ p: 2, mb: 2, bgcolor: 'rgba(239, 68, 68, 0.1)' }}>
                            <Chip label="Maximum Drawdown" sx={{ mb: 1, bgcolor: 'rgba(239, 68, 68, 0.3)' }} />
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                                The worst peak-to-trough decline. If your portfolio went from $100 to $75,
                                that's a -25% drawdown.
                            </Typography>
                            <Formula>Max DD = min(Portfolio Value / Peak Value - 1)</Formula>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                                <strong>Why it matters:</strong> Drawdowns test your emotional resilience. A -50% drawdown
                                requires a +100% gain to recover. Most investors panic-sell at the bottom.
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                                • <strong>0 to -10%</strong>: Very conservative<br />
                                • <strong>-10 to -20%</strong>: Moderate<br />
                                • <strong>-20 to -40%</strong>: Aggressive<br />
                                • <strong>&gt; -40%</strong>: Very risky
                            </Typography>
                        </Paper>

                        {/* Calmar */}
                        <Paper sx={{ p: 2, mb: 2, bgcolor: 'rgba(245, 158, 11, 0.1)' }}>
                            <Chip label="Calmar Ratio" sx={{ mb: 1, bgcolor: 'rgba(245, 158, 11, 0.3)' }} />
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                                Return per unit of maximum drawdown. Answers: "How much return did I get for the
                                worst pain I suffered?"
                            </Typography>
                            <Formula>Calmar = Annual Return / |Max Drawdown|</Formula>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                                • <strong>&gt; 1</strong>: Your annual return exceeds your worst drawdown - good<br />
                                • <strong>&gt; 2</strong>: Excellent risk-adjusted performance<br />
                                • <strong>&lt; 0.5</strong>: Your worst loss was more than 2x your annual return - concerning
                            </Typography>
                        </Paper>

                        {/* Omega */}
                        <Paper sx={{ p: 2, mb: 2, bgcolor: 'rgba(96, 165, 250, 0.1)' }}>
                            <Chip label="Omega Ratio" sx={{ mb: 1, bgcolor: 'rgba(96, 165, 250, 0.3)' }} />
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                                Ratio of gains above a threshold to losses below it. Unlike Sharpe, it considers
                                the entire return distribution, not just mean and variance.
                            </Typography>
                            <Formula>Omega = ∫(1 - F(r))dr / ∫F(r)dr  for r above/below threshold</Formula>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                                • <strong>&gt; 1</strong>: More gains above threshold than losses below - profitable<br />
                                • <strong>= 1</strong>: Break-even on a risk-adjusted basis<br />
                                • <strong>&lt; 1</strong>: More downside than upside
                            </Typography>
                        </Paper>

                        {/* Win Rate & Turnover */}
                        <Paper sx={{ p: 2, bgcolor: 'rgba(255, 255, 255, 0.03)' }}>
                            <Chip label="Other Metrics" sx={{ mb: 1 }} />
                            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                                • <strong>Win Rate</strong>: % of rebalancing periods with positive returns<br />
                                • <strong>Turnover</strong>: How much trading is required at each rebalance<br />
                                • <strong>CAGR</strong>: Compound Annual Growth Rate - your smoothed annual return
                            </Typography>
                        </Paper>
                    </AccordionDetails>
                </Accordion>

                <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.05)' }} />

                {/* ==================== DATA SOURCES ==================== */}
                <Accordion
                    expanded={expanded === 'panel5'}
                    onChange={handleChange('panel5')}
                    sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}
                >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <SectionTitle icon={<StorageIcon sx={{ color: '#60A5FA' }} />} title="Data Sources & API" />
                    </AccordionSummary>
                    <AccordionDetails>
                        <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
                            We use professional-grade financial data APIs to ensure accuracy and reliability.
                        </Typography>

                        <Paper sx={{ p: 2, mb: 2, bgcolor: 'rgba(96, 165, 250, 0.1)' }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#60A5FA', mb: 1 }}>
                                📈 Tiingo API - Market Data
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                <strong>What it provides:</strong> End-of-day adjusted prices for all US stocks and ETFs.<br />
                                <strong>Adjusted for:</strong> Stock splits, dividends, corporate actions.<br />
                                <strong>History:</strong> Back to 1990 for major tickers, varies for newer securities.<br />
                                <strong>Update frequency:</strong> Daily, after market close.
                            </Typography>
                            <InfoBox type="info">
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    "Adjusted close" means a stock that split 2:1 in 2010 will show prices as if the split
                                    had already happened. This ensures return calculations are accurate.
                                </Typography>
                            </InfoBox>
                        </Paper>

                        <Paper sx={{ p: 2, bgcolor: 'rgba(0, 212, 170, 0.1)' }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#00D4AA', mb: 1 }}>
                                🏦 FRED API - Risk-Free Rate
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                <strong>Source:</strong> Federal Reserve Bank of St. Louis (FRED).<br />
                                <strong>Series:</strong> DTB3 - 3-Month Treasury Bill Secondary Market Rate.<br />
                                <strong>Used for:</strong> Sharpe/Sortino ratio calculations, MVO optimization.<br />
                                <strong>Update frequency:</strong> Daily (business days).
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 2 }}>
                                The risk-free rate is crucial for calculating excess returns. A 10% portfolio return
                                means nothing without knowing if T-Bills paid 0% or 5%.
                            </Typography>
                        </Paper>
                    </AccordionDetails>
                </Accordion>

                <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.05)' }} />

                {/* ==================== REFERENCES ==================== */}
                <Accordion
                    expanded={expanded === 'panel6'}
                    onChange={handleChange('panel6')}
                    sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}
                >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <SectionTitle icon={<MenuBookIcon sx={{ color: '#F472B6' }} />} title="Academic References" />
                    </AccordionSummary>
                    <AccordionDetails>
                        <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
                            The methods implemented in this tool are based on peer-reviewed academic research.
                        </Typography>

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.03)' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#fff' }}>
                                    Markowitz, H. (1952)
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#A78BFA', fontStyle: 'italic' }}>
                                    "Portfolio Selection" - The Journal of Finance, 7(1), 77-91
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                                    The foundational paper of Modern Portfolio Theory. Introduced the concept of
                                    mean-variance optimization and the efficient frontier. Markowitz received the
                                    Nobel Prize in Economics in 1990 for this work.
                                </Typography>
                            </Paper>

                            <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.03)' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#fff' }}>
                                    López de Prado, M. (2016)
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#A78BFA', fontStyle: 'italic' }}>
                                    "Building Diversified Portfolios that Outperform Out-of-Sample" -
                                    The Journal of Portfolio Management, 42(4), 59-69
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                                    Introduced the Hierarchical Risk Parity (HRP) method. Demonstrated that
                                    machine learning-based clustering produces more stable allocations than
                                    traditional quadratic optimization.
                                </Typography>
                            </Paper>

                            <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.03)' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#fff' }}>
                                    Choueifaty, Y. & Coignard, Y. (2008)
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#A78BFA', fontStyle: 'italic' }}>
                                    "Toward Maximum Diversification" - The Journal of Portfolio Management, 35(1), 40-51
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                                    Introduced the Maximum Diversification approach and the Diversification Ratio metric.
                                </Typography>
                            </Paper>

                            <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.03)' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#fff' }}>
                                    Clarke, R., de Silva, H., & Thorley, S. (2011)
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#A78BFA', fontStyle: 'italic' }}>
                                    "Minimum-Variance Portfolio Composition" - The Journal of Portfolio Management
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                                    Comprehensive analysis of minimum variance portfolios and their out-of-sample performance.
                                </Typography>
                            </Paper>
                        </Box>

                        <Divider sx={{ my: 3 }} />

                        <Paper sx={{ p: 2, bgcolor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                                <strong>⚠️ Disclaimer</strong><br /><br />
                                This tool is provided for <strong>educational and research purposes only</strong>.
                                It is not financial advice. Past performance does not guarantee future results.
                                The authors are not responsible for any investment decisions made based on this tool.
                                Always consult a qualified financial advisor before making investment decisions.
                            </Typography>
                        </Paper>
                    </AccordionDetails>
                </Accordion>
            </Box>
        </Drawer>
    );
};

export default DocumentationPage;
