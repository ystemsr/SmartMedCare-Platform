import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { CircularProgress, CssBaseline, ThemeProvider } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import AppRouter from './router';
import ToastProvider from './components/ToastProvider';
import { useAuthStore } from './store/auth';
import theme from './theme';

dayjs.locale('zh-cn');

function App() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const fetchUser = useAuthStore((state) => state.fetchUser);
  const [initializing, setInitializing] = useState(!!token && !user);

  useEffect(() => {
    if (token && !user) {
      fetchUser()
        .catch(() => {
          // Token invalid — clear it so user sees login
          useAuthStore.getState().logout();
        })
        .finally(() => setInitializing(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (initializing) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <CircularProgress size={48} />
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="zh-cn">
        <ToastProvider>
          <CssBaseline />
          <BrowserRouter>
            <AppRouter />
          </BrowserRouter>
        </ToastProvider>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

export default App;
