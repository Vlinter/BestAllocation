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
                            HRP, CVaR, and MVO (explained in detail in the next section). The tool will backtest all three
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

                        <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
                            This tool implements three distinct portfolio optimization strategies. Each one answers a different question
                            about how to allocate your capital. Understanding how they work will help you interpret their results
                            and choose the right one for your investment goals.
                        </Typography>

                        {/* HRP */}
                        <Paper sx={{ p: 3, mb: 3, bgcolor: 'rgba(167, 139, 250, 0.1)', border: '1px solid rgba(167, 139, 250, 0.3)' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                <AccountTreeIcon sx={{ color: '#A78BFA', fontSize: 28 }} />
                                <Typography variant="h6" sx={{ fontWeight: 700, color: '#A78BFA' }}>
                                    HRP — Hierarchical Risk Parity
                                </Typography>
                                <Chip label="Most Robust" size="small" sx={{ bgcolor: 'rgba(167, 139, 250, 0.3)', color: '#A78BFA', fontWeight: 600 }} />
                            </Box>

                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                                <strong>Origin:</strong> Developed by Marcos López de Prado in 2016.
                                This method uses machine learning (hierarchical clustering) to group
                                similar assets together, then distributes risk intelligently across those groups.
                            </Typography>

                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                                <strong>The question it answers:</strong> <em>"How can I spread risk intelligently across groups of similar assets?"</em>
                            </Typography>

                            <Typography variant="subtitle2" sx={{ color: '#A78BFA', mt: 2, mb: 1 }}>
                                How it works — Step by Step
                            </Typography>

                            <List dense sx={{ mb: 2 }}>
                                <ListItem><ListItemIcon><CategoryIcon sx={{ color: '#A78BFA' }} /></ListItemIcon>
                                    <ListItemText
                                        primary="Step 1 — Correlation Distance"
                                        secondary="Calculate correlations between all assets, then convert them into a distance metric: d = √(0.5 × (1 − ρ)). Assets with high correlation (ρ close to 1) are 'close', uncorrelated assets are 'far apart'."
                                        sx={{ '& .MuiListItemText-secondary': { color: 'text.secondary' } }}
                                    />
                                </ListItem>
                                <ListItem><ListItemIcon><AccountTreeIcon sx={{ color: '#A78BFA' }} /></ListItemIcon>
                                    <ListItemText
                                        primary="Step 2 — Hierarchical Clustering (Ward Linkage)"
                                        secondary="Build a tree (dendrogram) by iteratively merging the two closest assets or clusters. This creates a hierarchy: e.g. AAPL and MSFT form a 'Tech' cluster, TLT and BND form a 'Bonds' cluster, then those clusters merge into the full portfolio."
                                        sx={{ '& .MuiListItemText-secondary': { color: 'text.secondary' } }}
                                    />
                                </ListItem>
                                <ListItem><ListItemIcon><SpeedIcon sx={{ color: '#A78BFA' }} /></ListItemIcon>
                                    <ListItemText
                                        primary="Step 3 — Quasi-Diagonalization"
                                        secondary="Reorder the covariance matrix so that correlated assets sit next to each other. This makes the matrix nearly block-diagonal, which is key to the next step."
                                        sx={{ '& .MuiListItemText-secondary': { color: 'text.secondary' } }}
                                    />
                                </ListItem>
                                <ListItem><ListItemIcon><SpeedIcon sx={{ color: '#A78BFA' }} /></ListItemIcon>
                                    <ListItemText
                                        primary="Step 4 — Recursive Bisection"
                                        secondary="Split the ordered list in half. Allocate risk to each half proportionally to its inverse variance (less risky half gets more weight). Repeat recursively until each asset has a weight."
                                        sx={{ '& .MuiListItemText-secondary': { color: 'text.secondary' } }}
                                    />
                                </ListItem>
                            </List>

                            <Typography variant="subtitle2" sx={{ color: '#A78BFA', mt: 2, mb: 1 }}>
                                Key Mathematical Property
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                                HRP never needs to invert the covariance matrix. Traditional methods (MVO) require matrix inversion,
                                which amplifies estimation errors — small noise in the data leads to large changes in weights.
                                HRP avoids this entirely, making it inherently more stable.
                            </Typography>

                            <Typography variant="subtitle2" sx={{ color: '#A78BFA', mt: 2, mb: 1 }}>
                                Advantages & Disadvantages
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2, flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                                <Paper sx={{ flex: 1, p: 2, bgcolor: 'rgba(255,255,255,0.03)' }}>
                                    <Typography variant="body2" sx={{ color: '#10B981', fontWeight: 600, mb: 0.5 }}>✅ Advantages</Typography>
                                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                                        • Most stable across market regimes<br />
                                        • Works well even with short data history<br />
                                        • No matrix inversion = robust to noise<br />
                                        • Naturally diversified portfolio<br />
                                        • Scales to many assets without issues
                                    </Typography>
                                </Paper>
                                <Paper sx={{ flex: 1, p: 2, bgcolor: 'rgba(255,255,255,0.03)' }}>
                                    <Typography variant="body2" sx={{ color: '#EF4444', fontWeight: 600, mb: 0.5 }}>❌ Disadvantages</Typography>
                                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                                        • Does not optimize any explicit objective<br />
                                        • Ignores expected returns entirely<br />
                                        • No guarantee of mathematical optimality<br />
                                        • Cannot target a specific risk/return profile
                                    </Typography>
                                </Paper>
                            </Box>

                            <InfoBox type="success">
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    <strong>Best for:</strong> Most investors. HRP typically delivers the most consistent
                                    out-of-sample performance. It is the most "all-weather" strategy.
                                </Typography>
                            </InfoBox>
                        </Paper>

                        {/* CVaR */}
                        <Paper sx={{ p: 3, mb: 3, bgcolor: 'rgba(0, 212, 170, 0.1)', border: '1px solid rgba(0, 212, 170, 0.3)' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                <ShieldIcon sx={{ color: '#00D4AA', fontSize: 28 }} />
                                <Typography variant="h6" sx={{ fontWeight: 700, color: '#00D4AA' }}>
                                    Min-CVaR — Minimum Conditional Value at Risk
                                </Typography>
                                <Chip label="Tail-Risk Focus" size="small" sx={{ bgcolor: 'rgba(0, 212, 170, 0.3)', color: '#00D4AA', fontWeight: 600 }} />
                            </Box>

                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                                <strong>Origin:</strong> Based on the work of Rockafellar & Uryasev (2000). CVaR (also called
                                Expected Shortfall) is the standard risk measure used by financial regulators (Basel III/IV)
                                and institutional risk managers worldwide.
                            </Typography>

                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                                <strong>The question it answers:</strong> <em>"Which portfolio minimizes my average loss during the worst market days?"</em>
                            </Typography>

                            <Typography variant="subtitle2" sx={{ color: '#00D4AA', mt: 2, mb: 1 }}>
                                Understanding VaR vs CVaR
                            </Typography>

                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                                <strong>VaR (Value at Risk)</strong> answers: "What is the maximum I can lose with 95% confidence?"
                                For example, a VaR₉₅ of -2% means: "On 95 days out of 100, I lose less than 2%."
                                But VaR says nothing about what happens on the other 5 days — you could lose 3%, 10%, or 50%.
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                                <strong>CVaR (Conditional VaR)</strong> answers: "When I do exceed that threshold, how bad is it on average?"
                                It is the average loss across the worst 5% of days. CVaR is always ≥ VaR and captures the severity of extreme losses.
                            </Typography>

                            <Formula>VaR₉₅ = "I lose at most X on 95% of days"</Formula>
                            <Formula>CVaR₉₅ = "On the 5% worst days, I lose Y on average"  (Y ≥ X)</Formula>

                            <Typography variant="subtitle2" sx={{ color: '#00D4AA', mt: 3, mb: 1 }}>
                                How the Optimization Works — Step by Step
                            </Typography>

                            <List dense sx={{ mb: 2 }}>
                                <ListItem><ListItemIcon><CheckIcon sx={{ color: '#00D4AA' }} /></ListItemIcon>
                                    <ListItemText
                                        primary="Step 1 — Collect Historical Returns"
                                        secondary="Take all daily returns from the training window (e.g. 252 days). Unlike MVO which condenses this into a covariance matrix, Min-CVaR uses every individual daily return."
                                        sx={{ '& .MuiListItemText-secondary': { color: 'text.secondary' } }}
                                    />
                                </ListItem>
                                <ListItem><ListItemIcon><CheckIcon sx={{ color: '#00D4AA' }} /></ListItemIcon>
                                    <ListItemText
                                        primary="Step 2 — For each possible portfolio..."
                                        secondary="Calculate what the portfolio return would have been on each of those 252 days. Sort the returns from worst to best."
                                        sx={{ '& .MuiListItemText-secondary': { color: 'text.secondary' } }}
                                    />
                                </ListItem>
                                <ListItem><ListItemIcon><CheckIcon sx={{ color: '#00D4AA' }} /></ListItemIcon>
                                    <ListItemText
                                        primary="Step 3 — Isolate the tail"
                                        secondary="At 95% confidence: take the 5% worst days (≈ 13 days out of 252). Calculate their average loss. This is the CVaR for that portfolio."
                                        sx={{ '& .MuiListItemText-secondary': { color: 'text.secondary' } }}
                                    />
                                </ListItem>
                                <ListItem><ListItemIcon><CheckIcon sx={{ color: '#00D4AA' }} /></ListItemIcon>
                                    <ListItemText
                                        primary="Step 4 — Find the minimum"
                                        secondary="Use a convex optimization solver to find the set of weights that makes this average tail loss as small as possible."
                                        sx={{ '& .MuiListItemText-secondary': { color: 'text.secondary' } }}
                                    />
                                </ListItem>
                            </List>

                            <Typography variant="subtitle2" sx={{ color: '#00D4AA', mt: 2, mb: 1 }}>
                                Mathematical Formulation (Rockafellar & Uryasev)
                            </Typography>
                            <Formula>minimize    ζ + (1 / αT) × Σ max(0, −rₜᵀw − ζ)</Formula>
                            <Formula>subject to  Σwᵢ = 1,  0 ≤ wᵢ ≤ max_weight</Formula>
                            <Typography variant="body2" sx={{ color: 'text.secondary', pl: 2, mt: 1 }}>
                                • <strong>w</strong> = portfolio weights (what we're looking for)<br />
                                • <strong>ζ (zeta)</strong> = auxiliary variable that converges to the VaR at the optimum<br />
                                • <strong>rₜ</strong> = vector of asset returns on day t<br />
                                • <strong>α</strong> = tail probability (e.g. 0.05 for 95% confidence)<br />
                                • <strong>T</strong> = number of historical days<br />
                                • <strong>max(0, ...)</strong> = only counts losses that exceed the threshold ζ
                            </Typography>

                            <InfoBox type="info">
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    <strong>Key insight:</strong> This formulation transforms CVaR minimization into a linear program,
                                    which is guaranteed to find the global optimum (no local minima). The trick is the auxiliary variable ζ
                                    that simultaneously finds the optimal VaR threshold and the weights that minimize losses beyond it.
                                </Typography>
                            </InfoBox>

                            <Typography variant="subtitle2" sx={{ color: '#00D4AA', mt: 2, mb: 1 }}>
                                Why CVaR is a "Coherent" Risk Measure
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                                Unlike VaR, CVaR satisfies four mathematical properties (Artzner et al., 1999) that make it reliable
                                for portfolio optimization:
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', pl: 2 }}>
                                • <strong>Sub-additivity:</strong> Diversifying can only reduce or maintain risk, never increase it<br />
                                • <strong>Monotonicity:</strong> If portfolio A always loses more than B, then A is riskier<br />
                                • <strong>Positive Homogeneity:</strong> Doubling your position doubles your risk<br />
                                • <strong>Translation Invariance:</strong> Adding cash reduces risk by exactly that amount
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                                VaR violates sub-additivity: it is possible for two portfolios to have a higher combined VaR than
                                the sum of their individual VaRs. This paradox makes VaR unsuitable for optimization.
                            </Typography>

                            <Typography variant="subtitle2" sx={{ color: '#00D4AA', mt: 3, mb: 1 }}>
                                Advantages & Disadvantages
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2, flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                                <Paper sx={{ flex: 1, p: 2, bgcolor: 'rgba(255,255,255,0.03)' }}>
                                    <Typography variant="body2" sx={{ color: '#10B981', fontWeight: 600, mb: 0.5 }}>✅ Advantages</Typography>
                                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                                        • Focuses on what investors fear most: extreme losses<br />
                                        • No assumption about return distribution (works with fat tails)<br />
                                        • Coherent risk measure (Basel III/IV standard)<br />
                                        • Convex problem → guaranteed global optimum<br />
                                        • Uses every data point, not just summary statistics
                                    </Typography>
                                </Paper>
                                <Paper sx={{ flex: 1, p: 2, bgcolor: 'rgba(255,255,255,0.03)' }}>
                                    <Typography variant="body2" sx={{ color: '#EF4444', fontWeight: 600, mb: 0.5 }}>❌ Disadvantages</Typography>
                                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                                        • Needs a lot of data (only uses 5% of observations for estimation)<br />
                                        • Sensitive to training window size<br />
                                        • Can produce concentrated portfolios if data is scarce<br />
                                        • Slower to compute than HRP or MVO<br />
                                        • Ignores expected returns (risk-only optimization)
                                    </Typography>
                                </Paper>
                            </Box>

                            <InfoBox type="warning">
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    <strong>Data sensitivity:</strong> With a 252-day training window at 95% confidence,
                                    Min-CVaR bases its decisions on only ~13 extreme days. With a 60-day window, that drops to
                                    just 3 days. Use at least 252 days of training data for reliable results.
                                </Typography>
                            </InfoBox>

                            <InfoBox type="success">
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    <strong>Best for:</strong> Investors who are particularly sensitive to large drawdowns
                                    and want a portfolio specifically designed to survive market crashes and black swan events.
                                </Typography>
                            </InfoBox>
                        </Paper>

                        {/* MVO */}
                        <Paper sx={{ p: 3, mb: 3, bgcolor: 'rgba(96, 165, 250, 0.1)', border: '1px solid rgba(96, 165, 250, 0.3)' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                <ShowChartIcon sx={{ color: '#60A5FA', fontSize: 28 }} />
                                <Typography variant="h6" sx={{ fontWeight: 700, color: '#60A5FA' }}>
                                    MVO — Mean-Variance Optimization (Max Sharpe)
                                </Typography>
                                <Chip label="Return Focused" size="small" sx={{ bgcolor: 'rgba(96, 165, 250, 0.3)', color: '#60A5FA', fontWeight: 600 }} />
                            </Box>

                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                                <strong>Origin:</strong> Developed by Harry Markowitz in 1952 (Nobel Prize in Economics, 1990).
                                This is the foundation of Modern Portfolio Theory. It finds the portfolio with the highest
                                Sharpe ratio — the best return per unit of risk.
                            </Typography>

                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                                <strong>The question it answers:</strong> <em>"Which portfolio gives me the best return for the level of risk I'm taking?"</em>
                            </Typography>

                            <Typography variant="subtitle2" sx={{ color: '#60A5FA', mt: 2, mb: 1 }}>
                                How it works — Step by Step
                            </Typography>

                            <List dense sx={{ mb: 2 }}>
                                <ListItem><ListItemIcon><CheckIcon sx={{ color: '#60A5FA' }} /></ListItemIcon>
                                    <ListItemText
                                        primary="Step 1 — Estimate Expected Returns (μ)"
                                        secondary="Calculate the Exponential Moving Average (EMA) of historical returns. EMA gives more weight to recent data, making it more reactive than a simple average. Then apply James-Stein shrinkage to reduce extreme estimates towards the mean."
                                        sx={{ '& .MuiListItemText-secondary': { color: 'text.secondary' } }}
                                    />
                                </ListItem>
                                <ListItem><ListItemIcon><CheckIcon sx={{ color: '#60A5FA' }} /></ListItemIcon>
                                    <ListItemText
                                        primary="Step 2 — Estimate Covariance Matrix (Σ)"
                                        secondary="Calculate how assets move together. Apply Ledoit-Wolf shrinkage to stabilize the matrix — this blends the sample covariance with a structured estimator, reducing noise especially when the number of assets is large relative to the data."
                                        sx={{ '& .MuiListItemText-secondary': { color: 'text.secondary' } }}
                                    />
                                </ListItem>
                                <ListItem><ListItemIcon><CheckIcon sx={{ color: '#60A5FA' }} /></ListItemIcon>
                                    <ListItemText
                                        primary="Step 3 — Risk-Free Rate Check"
                                        secondary="If all assets have expected returns below the risk-free rate (T-Bill), the optimizer goes to 100% cash. This is the rational choice: why take risk if bonds pay more?"
                                        sx={{ '& .MuiListItemText-secondary': { color: 'text.secondary' } }}
                                    />
                                </ListItem>
                                <ListItem><ListItemIcon><CheckIcon sx={{ color: '#60A5FA' }} /></ListItemIcon>
                                    <ListItemText
                                        primary="Step 4 — Maximize the Sharpe Ratio"
                                        secondary="Solve the optimization: find the weights that maximize (portfolio return − risk-free rate) / portfolio volatility. This point is the tangency portfolio on the efficient frontier."
                                        sx={{ '& .MuiListItemText-secondary': { color: 'text.secondary' } }}
                                    />
                                </ListItem>
                            </List>

                            <Typography variant="subtitle2" sx={{ color: '#60A5FA', mt: 2, mb: 1 }}>
                                Mathematical Formulation
                            </Typography>
                            <Formula>maximize   (μᵀw − rf) / √(wᵀΣw)   (Sharpe Ratio)</Formula>
                            <Formula>subject to  Σwᵢ = 1,  0 ≤ wᵢ ≤ max_weight</Formula>
                            <Typography variant="body2" sx={{ color: 'text.secondary', pl: 2, mt: 1 }}>
                                • <strong>μ</strong> = vector of expected returns (EMA + James-Stein shrinkage)<br />
                                • <strong>rf</strong> = risk-free rate (3-Month US Treasury Bill, from FRED)<br />
                                • <strong>Σ</strong> = covariance matrix (Ledoit-Wolf shrinkage)<br />
                                • <strong>wᵀΣw</strong> = portfolio variance
                            </Typography>

                            <Typography variant="subtitle2" sx={{ color: '#60A5FA', mt: 3, mb: 1 }}>
                                Our Regularization Techniques (Robustness)
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                                Raw MVO is notoriously unstable — it is often called a "maximum error maximizer" because it concentrates
                                in the assets with the highest estimation error. We apply three layers of regularization:
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', pl: 2 }}>
                                • <strong>Ledoit-Wolf Shrinkage</strong> on the covariance matrix — stabilizes the risk estimates<br />
                                • <strong>James-Stein Shrinkage</strong> on expected returns — pulls extreme return forecasts back to earth<br />
                                • <strong>Weight Constraints</strong> (min/max per asset) — prevents extreme concentration
                            </Typography>

                            <Typography variant="subtitle2" sx={{ color: '#60A5FA', mt: 3, mb: 1 }}>
                                Advantages & Disadvantages
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2, flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                                <Paper sx={{ flex: 1, p: 2, bgcolor: 'rgba(255,255,255,0.03)' }}>
                                    <Typography variant="body2" sx={{ color: '#10B981', fontWeight: 600, mb: 0.5 }}>✅ Advantages</Typography>
                                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                                        • The only method that explicitly maximizes returns<br />
                                        • Nobel Prize-winning theoretical foundation<br />
                                        • Integrates risk-free rate into the decision<br />
                                        • Well-defined mathematical optimality<br />
                                        • "Risk-off" mode when markets are unfavorable
                                    </Typography>
                                </Paper>
                                <Paper sx={{ flex: 1, p: 2, bgcolor: 'rgba(255,255,255,0.03)' }}>
                                    <Typography variant="body2" sx={{ color: '#EF4444', fontWeight: 600, mb: 0.5 }}>❌ Disadvantages</Typography>
                                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                                        • Very sensitive to expected return estimates<br />
                                        • Assumes returns follow a Gaussian distribution<br />
                                        • Can produce concentrated portfolios<br />
                                        • Requires matrix inversion (amplifies errors)<br />
                                        • May underperform out-of-sample due to overfitting
                                    </Typography>
                                </Paper>
                            </Box>

                            <InfoBox type="success">
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    <strong>Best for:</strong> Investors who believe past returns contain useful signals about
                                    future performance and want the highest risk-adjusted return. Works best in stable, trending markets.
                                </Typography>
                            </InfoBox>
                        </Paper>

                        {/* COMPARISON TABLE */}
                        <Paper sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', mb: 2 }}>
                                📊 Side-by-Side Comparison
                            </Typography>

                            <Box sx={{ overflowX: 'auto' }}>
                                <Box component="table" sx={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    '& th, & td': {
                                        p: 1.5,
                                        fontSize: '0.8rem',
                                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                                        color: 'text.secondary',
                                        textAlign: 'left',
                                    },
                                    '& th': {
                                        color: '#fff',
                                        fontWeight: 600,
                                        bgcolor: 'rgba(255,255,255,0.05)',
                                    },
                                }}>
                                    <thead>
                                        <tr>
                                            <th>Criterion</th>
                                            <th style={{ color: '#A78BFA' }}>HRP</th>
                                            <th style={{ color: '#00D4AA' }}>Min-CVaR</th>
                                            <th style={{ color: '#60A5FA' }}>MVO</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td><strong>Objective</strong></td>
                                            <td>Allocate risk equally across clusters</td>
                                            <td>Minimize average loss in worst scenarios</td>
                                            <td>Maximize return per unit of risk</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Uses Expected Returns?</strong></td>
                                            <td>❌ No</td>
                                            <td>❌ No (risk-only)</td>
                                            <td>✅ Yes (central to the method)</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Risk Measure</strong></td>
                                            <td>Variance (per cluster)</td>
                                            <td>CVaR (tail risk)</td>
                                            <td>Variance (total portfolio)</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Distributional Assumption</strong></td>
                                            <td>None</td>
                                            <td>None (works with fat tails)</td>
                                            <td>Gaussian (Normal)</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Stability</strong></td>
                                            <td>⭐⭐⭐ Very High</td>
                                            <td>⭐⭐ Moderate</td>
                                            <td>⭐ Low (without regularization)</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Data Requirement</strong></td>
                                            <td>Low (works with 60+ days)</td>
                                            <td>High (needs 252+ days for 95% conf.)</td>
                                            <td>Moderate (126+ days)</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Solver Type</strong></td>
                                            <td>No solver (heuristic)</td>
                                            <td>Linear programming</td>
                                            <td>Quadratic programming</td>
                                        </tr>
                                    </tbody>
                                </Box>
                            </Box>

                            <InfoBox type="info">
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    <strong>Tip:</strong> Compare all three methods on the same data.
                                    If they agree on a similar allocation, that's a strong signal.
                                    If they diverge significantly, the data may be too noisy for confident decisions.
                                </Typography>
                            </InfoBox>
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

                {/* ==================== ADVANCED QUANT FEATURES ==================== */}
                <Accordion
                    expanded={expanded === 'panel_quant'}
                    onChange={handleChange('panel_quant')}
                    sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}
                >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <SectionTitle icon={<PsychologyIcon sx={{ color: '#F472B6' }} />} title="Advanced Quant Features" />
                    </AccordionSummary>
                    <AccordionDetails>
                        <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
                            We have implemented professional quantitative techniques to improve robustness and reduce overfitting.
                        </Typography>

                        {/* Volatility Scaling */}
                        <Paper sx={{ p: 2, mb: 2, bgcolor: 'rgba(167, 139, 250, 0.1)', border: '1px solid rgba(167, 139, 250, 0.3)' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <SpeedIcon sx={{ color: '#A78BFA' }} />
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#A78BFA' }}>
                                    Volatility Scaling (Adaptive Risk)
                                </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                                <strong>Concept:</strong> Automatically reduces portfolio exposure when market volatility rises.
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                                If realized volatility (e.g. 20%) exceeds your Target Volatility (e.g. 10%), the system reduces allocation
                                to 50% (10/20) and puts the rest in Cash.
                            </Typography>
                            <Formula>Scale Factor = Target Vol / Realized Vol</Formula>

                            <Box sx={{ mt: 1, p: 1, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 1 }}>
                                <Typography variant="caption" sx={{ color: '#A78BFA' }}>
                                    Result: Smoother equity curve, smaller drawdowns during crashes, but potentially lower total return in raging bull markets.
                                </Typography>
                            </Box>
                        </Paper>

                        {/* James-Stein Shrinkage */}
                        <Paper sx={{ p: 2, mb: 2, bgcolor: 'rgba(0, 212, 170, 0.1)', border: '1px solid rgba(0, 212, 170, 0.3)' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <AssessmentIcon sx={{ color: '#00D4AA' }} />
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#00D4AA' }}>
                                    James-Stein Shrinkage (MVO)
                                </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                                <strong>Problem:</strong> Standard Mean-Variance Optimization chases past winners too aggressively ("max error maximization").
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                <strong>Solution:</strong> We "shrink" expected returns towards the global mean. If Nvidia did +200%, we might model it as +120%
                                to be conservative. This significantly improves out-of-sample performance and stability.
                            </Typography>
                        </Paper>

                        {/* Turnover Smoothing */}
                        <Paper sx={{ p: 2, bgcolor: 'rgba(96, 165, 250, 0.1)', border: '1px solid rgba(96, 165, 250, 0.3)' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <TimelineIcon sx={{ color: '#60A5FA' }} />
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#60A5FA' }}>
                                    Turnover Smoothing
                                </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                                <strong>Concept:</strong> Avoids drastic portfolio changes. Instead of selling 100% of AAPL instantly,
                                we blend the new target weights with previous weights.
                            </Typography>
                            <Formula>Weight = 0.75 * New + 0.25 * Old</Formula>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                This reduces transaction costs and "whipsaw" losses (buying high/selling low on noise) without significantly hurting performance.
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
                                    "Portfolio Selection" — The Journal of Finance, 7(1), 77-91
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                                    The foundational paper of Modern Portfolio Theory. Introduced the concept of
                                    mean-variance optimization and the efficient frontier. Markowitz received the
                                    Nobel Prize in Economics in 1990 for this work. Our MVO (Max Sharpe) method
                                    is a direct implementation of this framework.
                                </Typography>
                            </Paper>

                            <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.03)' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#fff' }}>
                                    Artzner, P., Delbaen, F., Eber, J.-M. & Heath, D. (1999)
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#A78BFA', fontStyle: 'italic' }}>
                                    "Coherent Measures of Risk" — Mathematical Finance, 9(3), 203-228
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                                    Defined the four axioms of coherent risk measures (sub-additivity, monotonicity,
                                    positive homogeneity, translation invariance) and showed that VaR is not coherent.
                                    This paper is the theoretical foundation for why CVaR is superior to VaR for
                                    portfolio optimization.
                                </Typography>
                            </Paper>

                            <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.03)' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#fff' }}>
                                    Rockafellar, R. T. & Uryasev, S. (2000)
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#A78BFA', fontStyle: 'italic' }}>
                                    "Optimization of Conditional Value-at-Risk" — Journal of Risk, 2(3), 21-41
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                                    Showed that CVaR minimization can be reformulated as a linear program using an
                                    auxiliary variable (ζ), making it computationally tractable. This is the exact
                                    algorithm used by our Min-CVaR implementation via PyPortfolioOpt.
                                </Typography>
                            </Paper>

                            <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.03)' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#fff' }}>
                                    López de Prado, M. (2016)
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#A78BFA', fontStyle: 'italic' }}>
                                    "Building Diversified Portfolios that Outperform Out-of-Sample" —
                                    The Journal of Portfolio Management, 42(4), 59-69
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                                    Introduced the Hierarchical Risk Parity (HRP) method. Demonstrated that
                                    machine learning-based clustering produces more stable allocations than
                                    traditional quadratic optimization, with superior out-of-sample performance.
                                </Typography>
                            </Paper>

                            <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.03)' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#fff' }}>
                                    Ledoit, O. & Wolf, M. (2004)
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#A78BFA', fontStyle: 'italic' }}>
                                    "A well-conditioned estimator for large-dimensional covariance matrices" —
                                    Journal of Multivariate Analysis, 88(2), 365-411
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                                    Introduced the shrinkage estimator for covariance matrices used in our MVO
                                    implementation. Blends the sample covariance with a structured target to reduce
                                    estimation error, especially when the number of assets is large relative to the
                                    number of observations.
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
