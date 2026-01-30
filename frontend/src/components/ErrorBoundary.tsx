import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <Box
                    sx={{
                        p: 4,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: 400,
                        textAlign: 'center',
                        bgcolor: 'rgba(239, 68, 68, 0.1)',
                        borderRadius: 2,
                        border: '1px solid rgba(239, 68, 68, 0.2)'
                    }}
                >
                    <Typography variant="h5" sx={{ color: '#ef4444', mb: 2, fontWeight: 700 }}>
                        Something went wrong
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, maxWidth: 600 }}>
                        {this.state.error?.message || 'An unexpected error occurred while rendering this component.'}
                    </Typography>
                    <Button
                        variant="outlined"
                        color="error"
                        startIcon={<RefreshIcon />}
                        onClick={() => window.location.reload()}
                    >
                        Reload Application
                    </Button>
                </Box>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
