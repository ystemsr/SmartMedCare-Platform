import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '@mui/material';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import AppShell, { type AppShellMenuItem } from '../components/AppShell';
import { getElderAlerts } from '../api/family';

const FamilyLayout: React.FC = () => {
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    const fetchAlertCount = async () => {
      try {
        const res = await getElderAlerts({ page: 1, page_size: 1, status: 'pending' });
        const data = res.data as { total: number };
        setAlertCount(data.total || 0);
      } catch {
        // Silently fail — badge is non-critical
      }
    };
    void fetchAlertCount();
  }, []);

  const menuItems = useMemo<AppShellMenuItem[]>(() => [
    {
      key: '/family',
      icon: <HomeRoundedIcon />,
      label: '首页',
    },
    {
      key: '/family/elder',
      icon: (
        <Badge badgeContent={alertCount} color="error" max={99} invisible={alertCount === 0}>
          <FavoriteRoundedIcon />
        </Badge>
      ),
      label: '老人健康',
    },
    {
      key: '/family/personal',
      icon: <PersonRoundedIcon />,
      label: '个人账户',
    },
  ], [alertCount]);

  return <AppShell items={menuItems} personalPath="/family/personal" />;
};

export default FamilyLayout;
