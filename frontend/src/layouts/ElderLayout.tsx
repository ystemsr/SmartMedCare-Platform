import React, { useEffect, useMemo, useState } from 'react';
import { Home, User, HeartPulse, UserPlus, ClipboardList, Sparkles } from 'lucide-react';
import AppShell, { type AppShellMenuItem } from '../components/AppShell';
import { listMySurveys } from '../api/surveys';
import { listMyPredictionTasks } from '../api/predictions';

const ElderLayout: React.FC = () => {
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [s, p] = await Promise.all([
          listMySurveys({ status: 'pending', limit: 100 }),
          listMyPredictionTasks({ status: 'pending_elder', limit: 100 }),
        ]);
        if (alive) {
          setPendingCount(
            (s.data.total || s.data.items.length || 0) +
              (p.data.total || p.data.items.length || 0),
          );
        }
      } catch {
        if (alive) setPendingCount(0);
      }
    };
    // Live refresh when the elder submits or a doctor dispatches a new task.
    const onChanged = () => load();
    window.addEventListener('elder:tasks:changed', onChanged);
    load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener('elder:tasks:changed', onChanged);
    };
  }, []);

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
        key: '/elder/surveys',
        icon: <ClipboardList size={20} />,
        label: '健康调查',
        badge: pendingCount,
      },
      {
        key: '/elder/invite',
        icon: <UserPlus size={20} />,
        label: '邀请家属',
      },
      {
        key: '/ai',
        icon: <Sparkles size={20} />,
        label: 'AI 助手',
      },
      {
        key: '/elder/personal',
        icon: <User size={20} />,
        label: '个人账户',
      },
    ];
  }, [pendingCount]);

  return <AppShell items={menuItems} personalPath="/elder/personal" />;
};

export default ElderLayout;
