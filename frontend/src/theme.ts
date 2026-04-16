import { createTheme } from '@mui/material/styles';
import { zhCN } from '@mui/material/locale';

const theme = createTheme(
  {
    palette: {
      mode: 'light',
      primary: {
        main: '#1f6feb',
        dark: '#174fb6',
        light: '#6aa7ff',
      },
      secondary: {
        main: '#0f9d8f',
        dark: '#0b6f65',
        light: '#58c7bc',
      },
      background: {
        default: '#f3f7fb',
        paper: '#ffffff',
      },
      success: {
        main: '#1f9d63',
      },
      warning: {
        main: '#d9822b',
      },
      error: {
        main: '#d14343',
      },
    },
    shape: {
      borderRadius: 16,
    },
    typography: {
      fontFamily: [
        '"Noto Sans SC"',
        '"PingFang SC"',
        '"Microsoft YaHei"',
        '"Helvetica Neue"',
        'sans-serif',
      ].join(','),
      h4: {
        fontWeight: 700,
        letterSpacing: '-0.02em',
      },
      h5: {
        fontWeight: 700,
      },
      h6: {
        fontWeight: 700,
      },
      button: {
        fontWeight: 600,
        textTransform: 'none',
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            background:
              'radial-gradient(circle at top, rgba(31, 111, 235, 0.1), transparent 30%), #f3f7fb',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 20,
            boxShadow: '0 16px 40px rgba(15, 23, 42, 0.08)',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 999,
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 14,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 999,
          },
        },
      },
    },
  },
  zhCN,
);

export default theme;
