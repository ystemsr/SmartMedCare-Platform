import React, { useMemo } from 'react';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import ElderlyRoundedIcon from '@mui/icons-material/ElderlyRounded';
import FamilyRestroomRoundedIcon from '@mui/icons-material/FamilyRestroomRounded';
import MedicalInformationRoundedIcon from '@mui/icons-material/MedicalInformationRounded';
import MedicationRoundedIcon from '@mui/icons-material/MedicationRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import MedicalServicesRoundedIcon from '@mui/icons-material/MedicalServicesRounded';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import WorkRoundedIcon from '@mui/icons-material/WorkRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import QueryStatsRoundedIcon from '@mui/icons-material/QueryStatsRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
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
        icon: <MedicalServicesRoundedIcon />,
        label: '医生管理',
      });
      items.push({
        key: '/family-members',
        icon: <FamilyRestroomRoundedIcon />,
        label: '家属管理',
      });
    }

    if (hasAnyPermission(['bigdata:read'])) {
      items.push({
        key: '/bigdata',
        icon: <StorageRoundedIcon />,
        label: '大数据',
        children: [
          {
            key: '/bigdata',
            icon: <InsightsRoundedIcon fontSize="small" />,
            label: '总览',
          },
          {
            key: '/bigdata/inference',
            icon: <PsychologyRoundedIcon fontSize="small" />,
            label: 'AI 推理',
          },
          {
            key: '/bigdata/jobs',
            icon: <WorkRoundedIcon fontSize="small" />,
            label: '作业管理',
          },
          {
            key: '/bigdata/hdfs',
            icon: <FolderOpenRoundedIcon fontSize="small" />,
            label: 'HDFS 浏览',
          },
          {
            key: '/bigdata/hive',
            icon: <QueryStatsRoundedIcon fontSize="small" />,
            label: 'Hive 查询',
          },
        ],
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
