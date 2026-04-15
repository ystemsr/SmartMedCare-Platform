import React, { useMemo } from 'react';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import ElderlyRoundedIcon from '@mui/icons-material/ElderlyRounded';
import FamilyRestroomRoundedIcon from '@mui/icons-material/FamilyRestroomRounded';
import HealingRoundedIcon from '@mui/icons-material/HealingRounded';
import MedicalInformationRoundedIcon from '@mui/icons-material/MedicalInformationRounded';
import MedicationRoundedIcon from '@mui/icons-material/MedicationRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import StethoscopeRoundedIcon from '@mui/icons-material/StethoscopeRounded';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import AppShell, { type AppShellMenuItem } from '../components/AppShell';
import { usePermission } from '../hooks/usePermission';

const BasicLayout: React.FC = () => {
  const { hasAnyPermission } = usePermission();

  const menuItems = useMemo<AppShellMenuItem[]>(() => {
    const items: AppShellMenuItem[] = [
      {
        key: '/dashboard',
        icon: <DashboardRoundedIcon />,
        label: '工作台',
      },
    ];

    if (hasAnyPermission(['elder:read', 'elder:create'])) {
      items.push({
        key: '/elders',
        icon: <ElderlyRoundedIcon />,
        label: '老人管理',
        children: [
          { key: '/elders', label: '老人列表', icon: <ElderlyRoundedIcon fontSize="small" /> },
          { key: '/elders/archive', label: '老人档案', icon: <MedicalInformationRoundedIcon fontSize="small" /> },
        ],
      });
    }

    if (hasAnyPermission(['alert:read', 'alert:update'])) {
      items.push({
        key: '/alerts',
        icon: <NotificationsActiveRoundedIcon />,
        label: '风险预警',
      });
    }

    if (hasAnyPermission(['followup:create', 'followup:update'])) {
      items.push({
        key: '/followups',
        icon: <TimelineRoundedIcon />,
        label: '随访管理',
        children: [
          { key: '/followups/plans', label: '随访计划', icon: <TimelineRoundedIcon fontSize="small" /> },
          { key: '/followups/records', label: '随访记录', icon: <HealingRoundedIcon fontSize="small" /> },
        ],
      });
    }

    if (hasAnyPermission(['intervention:create'])) {
      items.push({
        key: '/interventions',
        icon: <MedicationRoundedIcon />,
        label: '干预记录',
      });
    }

    if (hasAnyPermission(['assessment:read', 'assessment:create'])) {
      items.push({
        key: '/assessments',
        icon: <MedicalInformationRoundedIcon />,
        label: '健康评估',
      });
    }

    if (hasAnyPermission(['user:manage'])) {
      items.push({
        key: '/doctors',
        icon: <StethoscopeRoundedIcon />,
        label: '医生管理',
      });
      items.push({
        key: '/family-members',
        icon: <FamilyRestroomRoundedIcon />,
        label: '家属管理',
      });
    }

    items.push({
      key: '/accounts/personal',
      icon: <PersonRoundedIcon />,
      label: '个人账户',
    });

    return items;
  }, [hasAnyPermission]);

  return <AppShell items={menuItems} personalPath="/accounts/personal" />;
};

export default BasicLayout;
