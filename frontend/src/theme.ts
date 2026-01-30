import { createTheme } from '@mui/material/styles';

export const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#00D4AA', // Emerald Teal
            light: '#33DDBB',
            dark: '#00A88A',
            contrastText: '#fff',
        },
        secondary: {
            main: '#A78BFA', // Soft Purple
            light: '#C4B5FD',
            dark: '#8B5CF6',
            contrastText: '#fff',
        },
        background: {
            default: '#050810', // Deep space black
            paper: '#0F1623',   // Slighly lighter
        },
        text: {
            primary: '#F3F4F6',
            secondary: '#9CA3AF',
        },
        success: {
            main: '#10B981',
            light: '#34D399',
        },
        error: {
            main: '#EF4444',
        },
        warning: {
            main: '#F59E0B',
        },
        info: {
            main: '#3B82F6',
        },
        divider: 'rgba(255, 255, 255, 0.06)',
    },
    typography: {
        fontFamily: '"Outfit", "Inter", -apple-system, sans-serif',
        h1: { fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.02em' },
        h2: { fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.01em' },
        h3: { fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.01em' },
        h4: { fontSize: '1.25rem', fontWeight: 600 },
        h5: { fontSize: '1rem', fontWeight: 600 },
        h6: { fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' },
        body1: { fontSize: '0.95rem', lineHeight: 1.6 },
        body2: { fontSize: '0.875rem', lineHeight: 1.5 },
        button: { textTransform: 'none', fontWeight: 600 },
    },
    shape: {
        borderRadius: 16,
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#374151 #050810',
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    backgroundColor: 'rgba(15, 22, 35, 0.7)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
                },
                elevation1: {
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                }
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                    borderRadius: 20,
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 12,
                    padding: '10px 24px',
                    transition: 'all 0.3s ease',
                },
                containedPrimary: {
                    background: 'linear-gradient(135deg, #00D4AA 0%, #00A88A 100%)',
                    boxShadow: '0 4px 14px 0 rgba(0, 212, 170, 0.3)',
                    '&:hover': {
                        boxShadow: '0 6px 20px 0 rgba(0, 212, 170, 0.5)',
                        transform: 'translateY(-1px)',
                    },
                },
                containedSecondary: {
                    background: 'linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)',
                    boxShadow: '0 4px 14px 0 rgba(167, 139, 250, 0.3)',
                    '&:hover': {
                        boxShadow: '0 6px 20px 0 rgba(167, 139, 250, 0.5)',
                        transform: 'translateY(-1px)',
                    },
                }
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                },
                filled: {
                    backgroundColor: 'rgba(255,255,255,0.05)',
                }
            },
        },
    },
});
