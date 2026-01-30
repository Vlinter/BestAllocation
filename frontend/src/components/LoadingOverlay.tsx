import { Box, Typography, Backdrop, keyframes, Stack } from '@mui/material';
import {
    Timeline as TimelineIcon,
    Memory as MemoryIcon,
    Psychology as PsychologyIcon,
    ShowChart as ChartIcon
} from '@mui/icons-material';
import { useEffect, useState } from 'react';

interface LoadingOverlayProps {
    open: boolean;
    progress: number;
    message: string;
}

// Animations
const pulse = keyframes`
  0% { transform: scale(1); opacity: 0.5; box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.4); }
  70% { transform: scale(1.1); opacity: 1; box-shadow: 0 0 0 20px rgba(124, 58, 237, 0); }
  100% { transform: scale(1); opacity: 0.5; box-shadow: 0 0 0 0 rgba(124, 58, 237, 0); }
`;

const float = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
`;

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ open, progress, message }) => {
    // Only used for rotating icons, independent of progress
    const [iconIndex, setIconIndex] = useState(0);

    useEffect(() => {
        if (!open) return;
        const interval = setInterval(() => {
            setIconIndex(prev => (prev + 1) % 4);
        }, 2000);
        return () => clearInterval(interval);
    }, [open]);

    // Ensure progress is clamped 0-100
    const clampedProgress = Math.min(100, Math.max(0, progress));

    return (
        <Backdrop
            sx={{
                color: '#fff',
                zIndex: (theme) => theme.zIndex.drawer + 1000,
                backgroundColor: 'rgba(10, 14, 23, 0.90)',
                backdropFilter: 'blur(12px)',
                display: 'flex',
                flexDirection: 'column',
                gap: 5
            }}
            open={open}
            transitionDuration={500}
        >
            <Box sx={{ position: 'relative' }}>
                <Box
                    sx={{
                        position: 'relative',
                        width: 140,
                        height: 140,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    {/* Outer Glow Ring */}
                    <Box
                        sx={{
                            position: 'absolute',
                            inset: -20,
                            borderRadius: '50%',
                            border: '1px solid rgba(139, 92, 246, 0.2)',
                            boxShadow: '0 0 30px rgba(124, 58, 237, 0.1)',
                            animation: `${pulse} 3s infinite ease-in-out`
                        }}
                    />

                    {/* Inner Gradient Circle */}
                    <Box
                        sx={{
                            width: 120,
                            height: 120,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 0 50px rgba(124, 58, 237, 0.4)',
                            animation: `${float} 6s infinite ease-in-out`
                        }}
                    >
                        {/* Rotating Icons */}
                        {iconIndex === 0 && <TimelineIcon sx={{ fontSize: 60, color: 'white' }} />}
                        {iconIndex === 1 && <MemoryIcon sx={{ fontSize: 60, color: 'white' }} />}
                        {iconIndex === 2 && <PsychologyIcon sx={{ fontSize: 60, color: 'white' }} />}
                        {iconIndex === 3 && <ChartIcon sx={{ fontSize: 60, color: 'white' }} />}
                    </Box>
                </Box>
            </Box>

            <Stack alignItems="center" spacing={2} sx={{ maxWidth: 500, width: '90%' }}>
                {/* Status Message */}
                <Typography
                    variant="h5"
                    sx={{
                        fontWeight: 700,
                        letterSpacing: '-0.02em',
                        textAlign: 'center',
                        minHeight: 40, // Prevent layout shift
                        background: 'linear-gradient(90deg, #fff, #A78BFA, #fff)',
                        backgroundSize: '200% 100%',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        animation: 'gradient 4s linear infinite',
                        '@keyframes gradient': {
                            '0%': { backgroundPosition: '200% 0%' },
                            '100%': { backgroundPosition: '-200% 0%' }
                        }
                    }}
                >
                    {message}
                </Typography>

                {/* Progress Bar Container */}
                <Box sx={{ width: '100%', mt: 2, maxWidth: 400 }}>
                    <Box sx={{
                        width: '100%',
                        height: 6,
                        bgcolor: 'rgba(255,255,255,0.1)',
                        borderRadius: 3,
                        overflow: 'hidden',
                        position: 'relative'
                    }}>
                        <Box sx={{
                            width: `${Math.round(clampedProgress)}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #7C3AED, #3B82F6)',
                            transition: 'width 0.3s ease-out', // Smooth transition between backend updates
                            boxShadow: '0 0 10px rgba(124, 58, 237, 0.5)'
                        }} />
                    </Box>
                    <Typography
                        variant="caption"
                        sx={{
                            display: 'block',
                            textAlign: 'right',
                            mt: 1,
                            color: '#A78BFA',
                            fontFamily: 'monospace'
                        }}
                    >
                        {Math.round(clampedProgress)}% COMPLETE
                    </Typography>
                </Box>

            </Stack>
        </Backdrop>
    );
};

export default LoadingOverlay;
