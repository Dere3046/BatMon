import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#4dd0e1',
    },
    secondary: {
      main: '#b39ddb',
    },
    success: {
      main: '#69f0ae',
    },
    warning: {
      main: '#ffd54f',
    },
    error: {
      main: '#ff6e6e',
    },
    background: {
      default: '#0e1417',
      paper: '#151d21',
    },
    text: {
      primary: '#dbe7ea',
      secondary: '#8ba1a8',
    },
    divider: 'rgba(139, 161, 168, 0.14)',
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily:
      '"Inter", "SF Pro Text", "Segoe UI", system-ui, -apple-system, "Noto Sans SC", sans-serif',
    h6: {
      fontWeight: 600,
    },
    body2: {
      fontSize: '0.8125rem',
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
      },
    },
  },
});
