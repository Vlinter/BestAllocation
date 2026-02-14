import React, { useState } from 'react';
import { Box, IconButton, Tooltip, Typography, Chip } from '@mui/material';
import { Menu as MenuIcon, Help as HelpIcon, Fullscreen as FullscreenIcon, FullscreenExit as FullscreenExitIcon, Close as CloseIcon } from '@mui/icons-material';
import Sidebar from '../Sidebar'; // Adjust path if needed
import AnimatedBackground from '../AnimatedBackground'; // Adjust path if needed

interface MainLayoutProps {
    children: React.ReactNode;
    isLoading: boolean;
    error: string | null;
    results: any; // Type properly if possible
    onOptimize: (params: any) => Promise<void>;
    sidebarMode: 'hidden' | 'normal' | 'fullscreen';
    setSidebarMode: (mode: 'hidden' | 'normal' | 'fullscreen') => void;
    onToggleDocs: () => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
    children,
    isLoading,
    error,
    results,
    onOptimize,
    sidebarMode,
    setSidebarMode,
    onToggleDocs
}) => {

    const toggleSidebarFullscreen = () => {
        if (sidebarMode === 'fullscreen') setSidebarMode('normal');
        else setSidebarMode('fullscreen');
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, minHeight: '100vh', bgcolor: 'transparent', position: 'relative', zIndex: 1 }}>

            <AnimatedBackground />

            {/* Sidebar */}
            <Box
                sx={{
                    width: sidebarMode === 'fullscreen'
                        ? '100%'
                        : sidebarMode === 'normal'
                            ? { xs: '100%', md: 360 }
                            : 0,
                    opacity: sidebarMode !== 'hidden' ? 1 : 0,
                    maxHeight: sidebarMode === 'hidden' ? 0 : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    overflow: sidebarMode === 'hidden' ? 'hidden' : 'visible',
                    borderRight: sidebarMode === 'normal' ? { xs: 'none', md: '1px solid rgba(255,255,255,0.05)' } : 'none',
                    position: 'relative',
                    flexShrink: 0,
                    zIndex: sidebarMode === 'fullscreen' ? 100 : 1,
                }}
            >
                <Sidebar onOptimize={onOptimize} isLoading={isLoading} error={error} isFullscreen={sidebarMode === 'fullscreen'} />

                {/* Sidebar Controls */}
                <Box sx={{ position: 'absolute', top: { xs: 8, md: 16 }, right: { xs: 8, md: 16 }, display: 'flex', gap: 0.5, zIndex: 10 }}>
                    <Tooltip title={sidebarMode === 'fullscreen' ? 'Exit Fullscreen' : 'Fullscreen'}>
                        <IconButton
                            onClick={toggleSidebarFullscreen}
                            size="small"
                            sx={{ color: 'text.secondary', bgcolor: 'rgba(0,0,0,0.3)', '&:hover': { color: 'white', bgcolor: 'rgba(0,0,0,0.5)' } }}
                        >
                            {sidebarMode === 'fullscreen' ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Hide Sidebar">
                        <IconButton
                            onClick={() => setSidebarMode('hidden')}
                            size="small"
                            sx={{ color: 'text.secondary', bgcolor: 'rgba(0,0,0,0.3)', '&:hover': { color: 'white', bgcolor: 'rgba(0,0,0,0.5)' } }}
                        >
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {/* Main Content Area */}
            <Box component="main" sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', background: 'linear-gradient(180deg, rgba(10,14,23,1) 0%, rgba(17,24,39,1) 100%)' }}>

                {/* Header */}
                <Box sx={{ px: { xs: 3, md: 5 }, pt: { xs: 4, md: 5 }, pb: 3, borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 2 }}>
                    {sidebarMode === 'hidden' && (
                        <Box
                            onClick={() => setSidebarMode('normal')}
                            sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.05)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }, mr: 1 }}
                        >
                            <MenuIcon />
                        </Box>
                    )}

                    <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 1 }}>
                                Strategy Comparison
                            </Typography>
                            <Tooltip title="Documentation">
                                <IconButton onClick={onToggleDocs} sx={{ color: 'text.secondary', '&:hover': { color: '#A78BFA', bgcolor: 'rgba(167, 139, 250, 0.1)' } }}>
                                    <HelpIcon />
                                </IconButton>
                            </Tooltip>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                            <Typography variant="body1" sx={{ color: 'text.secondary' }}>Walk-Forward Analysis • HRP vs GMV vs MVO</Typography>
                            {results && (
                                <>
                                    <Chip label={`Risk-Free: ${(results.risk_free_rate * 100).toFixed(2)}%`} size="small" sx={{ bgcolor: 'rgba(59,130,246,0.15)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.3)', backdropFilter: 'blur(5px)' }} />
                                    <Chip label={`${results.data_start_date} → ${results.data_end_date}`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: 'text.secondary', border: '1px solid rgba(255,255,255,0.1)' }} />
                                </>
                            )}
                        </Box>
                    </Box>
                </Box>

                {/* Page Content */}
                <Box sx={{ flex: 1, px: { xs: 3, md: 5 }, py: 2 }}>
                    {children}
                </Box>
            </Box>
        </Box>
    );
};
