import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import AppRouter from './router';
import ToastProvider from './components/ToastProvider';
import ConfirmHost from './components/ui/Confirm';
import Spinner from './components/ui/Spinner';
import { useAuthStore } from './store/auth';

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
          useAuthStore.getState().logout();
        })
        .finally(() => setInitializing(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (initializing) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <ToastProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
      <ConfirmHost />
    </ToastProvider>
  );
}

export default App;
