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
} from '@mui/icons-material';

interface DocumentationPageProps {
    open: boolean;
    onClose: () => void;
}

const DocumentationPage: React.FC<DocumentationPageProps> = ({ open, onClose }) => {
    const [expanded, setExpanded] = useState<string | false>('panel1');

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
                    width: { xs: '100%', sm: 500, md: 600 },
                    bgcolor: '#0D1117',
                    backgroundImage: 'none',
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
                            Guide complet du Portfolio Optimizer
                        </Typography>
                    </Box>
                </Box>
                <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
                    <CloseIcon />
                </IconButton>
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
                        <SectionTitle icon={<PlayArrowIcon sx={{ color: '#00D4AA' }} />} title="Démarrage Rapide" />
                    </AccordionSummary>
                    <AccordionDetails>
                        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                            <strong>1. Ajouter des tickers</strong><br />
                            Entrez les symboles de vos ETFs/actions (ex: SPY, QQQ, GLD) dans la barre de saisie et appuyez sur Entrée ou le bouton +.
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                            <strong>2. Configurer les paramètres</strong><br />
                            • <strong>Training Window</strong> : Période d'apprentissage (1 an par défaut)<br />
                            • <strong>Rebalancing</strong> : Fréquence de rééquilibrage (mensuel par défaut)<br />
                            • <strong>Coûts de transaction</strong> : Frais en basis points (10 bps = 0.1%)
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            <strong>3. Lancer l'optimisation</strong><br />
                            Cliquez sur "Compare All Methods" pour exécuter les 3 stratégies simultanément et comparer leurs performances.
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
                        <SectionTitle icon={<PsychologyIcon sx={{ color: '#A78BFA' }} />} title="Méthodes d'Optimisation" />
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
                                Développée par Marcos López de Prado (2016), cette méthode utilise le machine learning
                                pour regrouper les actifs similaires et distribuer le risque de manière hiérarchique.
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                <strong>Avantages :</strong> Robuste, pas besoin d'inverser la matrice de covariance,
                                résistant au bruit dans les données.
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
                                Trouve le portefeuille avec la volatilité la plus faible possible, sans se soucier
                                des rendements attendus. C'est le point le plus à gauche de la frontière efficiente.
                            </Typography>
                            <Formula>min w'Σw  subject to  Σw = 1</Formula>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                <strong>Avantages :</strong> Simple, ne nécessite pas d'estimer les rendements futurs
                                (souvent erronés), historiquement performant.
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
                                La méthode classique de Markowitz (1952). Maximise le ratio de Sharpe en trouvant
                                le meilleur compromis rendement/risque basé sur les rendements historiques.
                            </Typography>
                            <Formula>max (μ'w - rf) / √(w'Σw)</Formula>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                <strong>Attention :</strong> Sensible aux erreurs d'estimation des rendements.
                                Nous utilisons une moyenne mobile exponentielle (EMA) pour stabiliser les prédictions.
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
                            Le <strong>Walk-Forward Testing</strong> est la méthode de backtest la plus réaliste.
                            Elle simule exactement ce qui se serait passé si vous aviez utilisé la stratégie en temps réel.
                        </Typography>

                        <Paper sx={{ p: 2, mb: 2, bgcolor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                Jour 1 → 252 : Entraînement (calcul des poids)<br />
                                Jour 253 → 273 : Trading avec ces poids<br />
                                ─────────────────────────────────<br />
                                Jour 22 → 273 : Entraînement (nouveaux poids)<br />
                                Jour 274 → 294 : Trading avec les nouveaux poids<br />
                                ─────────────────────────────────<br />
                                ... et ainsi de suite jusqu'à aujourd'hui
                            </Typography>
                        </Paper>

                        <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                            <strong>Training Window</strong> : Plus cette fenêtre est longue, plus le modèle est stable
                            mais moins il s'adapte aux changements récents du marché.
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            <strong>Rebalancing Frequency</strong> : Un rééquilibrage fréquent capte mieux les changements
                            mais génère plus de frais de transaction.
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
                        <SectionTitle icon={<AssessmentIcon sx={{ color: '#10B981' }} />} title="Métriques de Performance" />
                    </AccordionSummary>
                    <AccordionDetails>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Box>
                                <Chip label="Sharpe Ratio" size="small" sx={{ mb: 0.5, bgcolor: 'rgba(0, 212, 170, 0.2)' }} />
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    Rendement excédentaire par unité de risque. Un Sharpe &gt; 1 est bon, &gt; 2 est excellent.
                                </Typography>
                                <Formula>Sharpe = (Rp - Rf) / σp</Formula>
                            </Box>

                            <Box>
                                <Chip label="Sortino Ratio" size="small" sx={{ mb: 0.5, bgcolor: 'rgba(167, 139, 250, 0.2)' }} />
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    Comme le Sharpe mais ne pénalise que la volatilité négative (downside).
                                    Plus pertinent car les hausses ne sont pas un "risque".
                                </Typography>
                            </Box>

                            <Box>
                                <Chip label="Max Drawdown" size="small" sx={{ mb: 0.5, bgcolor: 'rgba(239, 68, 68, 0.2)' }} />
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    La pire perte depuis un sommet. Un drawdown de -20% signifie que le portefeuille
                                    a chuté de 20% depuis son plus haut.
                                </Typography>
                            </Box>

                            <Box>
                                <Chip label="Calmar Ratio" size="small" sx={{ mb: 0.5, bgcolor: 'rgba(245, 158, 11, 0.2)' }} />
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    Rendement annualisé divisé par le max drawdown. Mesure combien de rendement
                                    vous obtenez pour chaque unité de risque de perte maximale.
                                </Typography>
                            </Box>

                            <Box>
                                <Chip label="Omega Ratio" size="small" sx={{ mb: 0.5, bgcolor: 'rgba(96, 165, 250, 0.2)' }} />
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    Ratio des gains au-dessus du seuil vs pertes en-dessous. Un Omega &gt; 1 signifie
                                    plus de gains que de pertes.
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
                        <SectionTitle icon={<StorageIcon sx={{ color: '#60A5FA' }} />} title="Sources de Données" />
                    </AccordionSummary>
                    <AccordionDetails>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Paper sx={{ p: 2, bgcolor: 'rgba(96, 165, 250, 0.1)' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#60A5FA', mb: 1 }}>
                                    Tiingo API - Données de Marché
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    Prix ajustés (dividendes & splits) pour tous les tickers US.
                                    Historique disponible depuis 1990 pour les ETFs majeurs.
                                </Typography>
                            </Paper>

                            <Paper sx={{ p: 2, bgcolor: 'rgba(0, 212, 170, 0.1)' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#00D4AA', mb: 1 }}>
                                    FRED API - Taux Sans Risque
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    Taux des bons du Trésor US à 3 mois (DTB3) de la Federal Reserve.
                                    Mis à jour quotidiennement et utilisé pour calculer les ratios de Sharpe/Sortino.
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
                        <SectionTitle icon={<MenuBookIcon sx={{ color: '#F472B6' }} />} title="Références Académiques" />
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
                                    Fondement de la théorie moderne du portefeuille (Prix Nobel 1990)
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
                                    Introduction de la méthode HRP (Hierarchical Risk Parity)
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
                                    Fondement du Maximum Diversification Ratio
                                </Typography>
                            </Box>

                            <Divider sx={{ my: 1 }} />

                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', textAlign: 'center' }}>
                                Ce site est fourni à titre éducatif uniquement.<br />
                                Les performances passées ne préjugent pas des performances futures.
                            </Typography>
                        </Box>
                    </AccordionDetails>
                </Accordion>
            </Box>
        </Drawer>
    );
};

export default DocumentationPage;
