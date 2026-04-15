import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import AppRouter from './router';
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
          // Token invalid — clear it so user sees login
          useAuthStore.getState().logout();
        })
        .finally(() => setInitializing(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (initializing) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
        },
      }}
    >
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
