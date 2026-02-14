import React from 'react';
import { Box, Typography, Paper, Chip } from '@mui/material';
import { PieChart, Shield, TrendingUp, HelpOutline } from '@mui/icons-material';

const WelcomeScreen: React.FC = () => {
    return (
        <Box sx={{
            height: '70vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
        }}>
            {/* Header */}
            <Box sx={{ position: 'absolute', top: 0, left: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.5px' }}>
                    Strategy Comparison
                </Typography>
                <HelpOutline sx={{ color: 'text.secondary', fontSize: 20, cursor: 'pointer' }} />
            </Box>

            <Typography variant="body2" sx={{ position: 'absolute', top: 32, left: 0, color: 'text.secondary' }}>
                Walk-Forward Analysis • HRP vs GMV vs MVO
            </Typography>

            {/* Central Visual */}
            <Box sx={{ position: 'relative', width: 200, height: 200, mb: 6 }}>
                {/* Glowing Center */}
                <Box sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 120,
                    height: 120,
                    background: 'radial-gradient(circle, rgba(167, 139, 250, 0.2) 0%, transparent 70%)',
                    filter: 'blur(20px)',
                    animation: 'pulse 4s infinite ease-in-out'
                }} />

                {/* Floating Icons */}
                <TrendingUp sx={{
                    fontSize: 40,
                    color: '#00D4AA',
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translate(-50%, -20%)',
                    animation: 'float 6s ease-in-out infinite',
                    filter: 'drop-shadow(0 0 10px rgba(0, 212, 170, 0.5))'
                }} />

                <PieChart sx={{
                    fontSize: 40,
                    color: '#FFE66D',
                    position: 'absolute',
                    bottom: 20,
                    left: 20,
                    animation: 'float 6s ease-in-out infinite 2s',
                    filter: 'drop-shadow(0 0 10px rgba(255, 230, 109, 0.5))'
                }} />

                <Shield sx={{
                    fontSize: 40,
                    color: '#A78BFA',
                    position: 'absolute',
                    bottom: 20,
                    right: 20,
                    animation: 'float 6s ease-in-out infinite 4s',
                    filter: 'drop-shadow(0 0 10px rgba(167, 139, 250, 0.5))'
                }} />
            </Box>

            {/* Call to Action */}
            <Typography variant="h4" className="gradient-text-purple" sx={{
                fontWeight: 800,
                mb: 2,
                textAlign: 'center',
                letterSpacing: '-1px'
            }}>
                Compare All Strategies
            </Typography>

            <Typography variant="body1" sx={{ color: 'text.secondary', textAlign: 'center', maxWidth: 500, mb: 4, lineHeight: 1.6 }}>
                Configure your portfolio in the sidebar and click <Chip label="Compare All Methods" size="small" sx={{ bgcolor: 'rgba(124, 58, 237, 0.1)', color: '#A78BFA', fontWeight: 600, border: '1px solid rgba(124, 58, 237, 0.2)' }} /> to analyze HRP, GMV, and MVO strategies.
            </Typography>

            {/* Feature Chips */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                {['Walk-Forward Analysis', 'Risk Metrics', 'Efficient Frontier', 'Monthly Heatmap'].map((feature) => (
                    <Paper key={feature} sx={{
                        px: 2,
                        py: 0.8,
                        bgcolor: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: 10,
                        transition: 'all 0.3s ease',
                        '&:hover': {
                            bgcolor: 'rgba(255,255,255,0.08)',
                            transform: 'translateY(-2px)'
                        }
                    }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                            {feature}
                        </Typography>
                    </Paper>
                ))}
            </Box>
        </Box>
    );
};

export default WelcomeScreen;
