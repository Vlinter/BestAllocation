import React from 'react';
import { Box } from '@mui/material';

/**
 * Beautiful animated gradient background with floating orbs and grid overlay.
 * This creates a premium, modern feel for the dashboard.
 */
const AnimatedBackground: React.FC = React.memo(() => {
    return (
        <Box className="animated-bg">
            {/* Floating gradient orbs */}
            <Box className="orb orb-1" />
            <Box className="orb orb-2" />
            <Box className="orb orb-3" />
            <Box className="orb orb-4" />

            {/* Subtle grid overlay */}
            <Box className="grid-overlay" />
        </Box>
    );
});

export default AnimatedBackground;
