import { Box, keyframes } from '@mui/material';

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

interface SkeletonLoaderProps {
    height?: number | string;
    width?: string;
    variant?: 'chart' | 'card' | 'table';
}

/**
 * Elegant skeleton loader with shimmer animation.
 * Matches the app's glassmorphism style.
 */
const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
    height = 300,
    width = '100%',
    variant = 'chart'
}) => {
    const getHeight = () => {
        if (variant === 'card') return 120;
        if (variant === 'table') return 200;
        return height;
    };

    return (
        <Box
            sx={{
                width,
                height: getHeight(),
                borderRadius: 3,
                background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 100%)',
                backgroundSize: '200% 100%',
                animation: `${shimmer} 1.5s ease-in-out infinite`,
                border: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <Box
                sx={{
                    width: '60%',
                    height: 4,
                    borderRadius: 2,
                    background: 'linear-gradient(90deg, rgba(167,139,250,0.1) 0%, rgba(167,139,250,0.3) 50%, rgba(167,139,250,0.1) 100%)',
                    backgroundSize: '200% 100%',
                    animation: `${shimmer} 1.5s ease-in-out infinite`,
                }}
            />
        </Box>
    );
};

export default SkeletonLoader;
