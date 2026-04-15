import React, { useMemo } from 'react';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import AppShell, { type AppShellMenuItem } from '../components/AppShell';

const FamilyLayout: React.FC = () => {
  const menuItems = useMemo<AppShellMenuItem[]>(() => [
    {
      key: '/family',
      icon: <HomeRoundedIcon />,
      label: '首页',
    },
    {
      key: '/family/elder',
      icon: <FavoriteRoundedIcon />,
      label: '老人健康',
    },
    {
      key: '/family/personal',
      icon: <PersonRoundedIcon />,
      label: '个人账户',
    },
  ], []);

  return <AppShell items={menuItems} personalPath="/family/personal" />;
};

export default FamilyLayout;
