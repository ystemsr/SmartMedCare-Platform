import React, { useMemo } from 'react';
import {
  LayoutDashboard,
  Users,
  Users2,
  ClipboardPlus,
  Pill,
  BellRing,
  User,
  Stethoscope,
  Activity,
  Database,
  BrainCircuit,
  Briefcase,
  FolderOpen,
  BarChart3,
  LineChart,
} from 'lucide-react';
import AppShell, { type AppShellMenuItem } from '../components/AppShell';
import { usePermission } from '../hooks/usePermission';

const BasicLayout: React.FC = () => {
  const { hasAnyPermission } = usePermission();

  const menuItems = useMemo<AppShellMenuItem[]>(() => {
    const items: AppShellMenuItem[] = [
      {
        key: '/dashboard',
        icon: <LayoutDashboard size={18} />,
        label: '工作台',
      },
    ];

    if (hasAnyPermission(['elder:read', 'elder:create'])) {
      items.push({
        key: '/elders',
        icon: <Users size={18} />,
        label: '老人管理',
      });
    }

    if (hasAnyPermission(['alert:read', 'alert:update'])) {
      items.push({
        key: '/alerts',
        icon: <BellRing size={18} />,
        label: '风险预警',
      });
    }

    if (hasAnyPermission(['followup:create', 'followup:update'])) {
      items.push({
        key: '/followups',
        icon: <Activity size={18} />,
        label: '随访管理',
      });
    }

    if (hasAnyPermission(['intervention:create'])) {
      items.push({
        key: '/interventions',
        icon: <Pill size={18} />,
        label: '干预记录',
      });
    }

    if (hasAnyPermission(['assessment:read', 'assessment:create'])) {
      items.push({
        key: '/assessments',
        icon: <ClipboardPlus size={18} />,
        label: '健康评估',
      });
    }

    if (hasAnyPermission(['user:manage'])) {
      items.push({
        key: '/doctors',
        icon: <Stethoscope size={18} />,
        label: '医生管理',
      });
      items.push({
        key: '/family-members',
        icon: <Users2 size={18} />,
        label: '家属管理',
      });
    }

    if (hasAnyPermission(['bigdata:read'])) {
      items.push({
        key: '/bigdata',
        icon: <Database size={18} />,
        label: '大数据',
        children: [
          {
            key: '/bigdata',
            icon: <LineChart size={16} />,
            label: '总览',
          },
          {
            key: '/bigdata/inference',
            icon: <BrainCircuit size={16} />,
            label: 'AI 推理',
          },
          {
            key: '/bigdata/jobs',
            icon: <Briefcase size={16} />,
            label: '作业管理',
          },
          {
            key: '/bigdata/hdfs',
            icon: <FolderOpen size={16} />,
            label: 'HDFS 浏览',
          },
          {
            key: '/bigdata/hive',
            icon: <BarChart3 size={16} />,
            label: 'Hive 查询',
          },
          {
            key: '/bigdata/analytics',
            icon: <LineChart size={16} />,
            label: '多维分析',
          },
        ],
      });
    }

    items.push({
      key: '/accounts/personal',
      icon: <User size={18} />,
      label: '个人账户',
    });

    return items;
  }, [hasAnyPermission]);

  return <AppShell items={menuItems} personalPath="/accounts/personal" />;
};

export default BasicLayout;
