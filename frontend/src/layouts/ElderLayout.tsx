import React, { useMemo } from 'react';
import { Home, User, HeartPulse, UserPlus } from 'lucide-react';
import AppShell, { type AppShellMenuItem } from '../components/AppShell';

const ElderLayout: React.FC = () => {
  const menuItems = useMemo<AppShellMenuItem[]>(() => {
    return [
      {
        key: '/elder',
        icon: <Home size={20} />,
        label: '首页',
      },
      {
        key: '/elder/health',
        icon: <HeartPulse size={20} />,
        label: '健康档案',
      },
      {
        key: '/elder/invite',
        icon: <UserPlus size={20} />,
        label: '邀请家属',
      },
      {
        key: '/elder/personal',
        icon: <User size={20} />,
        label: '个人账户',
      },
    ];
  }, []);

  return <AppShell items={menuItems} personalPath="/elder/personal" />;
};

export default ElderLayout;
