import React, { useMemo } from 'react';
import GroupAddRoundedIcon from '@mui/icons-material/GroupAddRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import MonitorHeartRoundedIcon from '@mui/icons-material/MonitorHeartRounded';
import AppShell, { type AppShellMenuItem } from '../components/AppShell';

const ElderLayout: React.FC = () => {
  const menuItems = useMemo<AppShellMenuItem[]>(() => {
    return [
      {
        key: '/elder',
        icon: <HomeRoundedIcon />,
        label: '首页',
      },
      {
        key: '/elder/health',
        icon: <MonitorHeartRoundedIcon />,
        label: '健康档案',
      },
      {
        key: '/elder/invite',
        icon: <GroupAddRoundedIcon />,
        label: '邀请家属',
      },
      {
        key: '/elder/personal',
        icon: <PersonRoundedIcon />,
        label: '个人账户',
      },
    ];
  }, []);

  return <AppShell items={menuItems} personalPath="/elder/personal" />;
};

export default ElderLayout;
