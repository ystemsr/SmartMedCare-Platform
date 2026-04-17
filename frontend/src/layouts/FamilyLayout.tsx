import React, { useEffect, useMemo, useState } from 'react';
import { HeartPulse, Home, User } from 'lucide-react';
import AppShell, { type AppShellMenuItem } from '../components/AppShell';
import { getElderAlerts } from '../api/family';

function IconWithBadge({ icon, count }: { icon: React.ReactNode; count: number }) {
  if (count <= 0) {
    return <span style={{ display: 'inline-flex' }}>{icon}</span>;
  }
  const display = count > 99 ? '99+' : String(count);
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      {icon}
      <span
        style={{
          position: 'absolute',
          top: -6,
          right: -8,
          minWidth: 16,
          height: 16,
          padding: '0 4px',
          borderRadius: 8,
          background: 'var(--smc-error)',
          color: '#fff',
          fontSize: 10,
          fontWeight: 700,
          lineHeight: '16px',
          textAlign: 'center',
          boxSizing: 'border-box',
        }}
      >
        {display}
      </span>
    </span>
  );
}

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
      icon: <Home size={18} />,
      label: '首页',
    },
    {
      key: '/family/elder',
      icon: <IconWithBadge icon={<HeartPulse size={18} />} count={alertCount} />,
      label: '老人健康',
    },
    {
      key: '/family/personal',
      icon: <User size={18} />,
      label: '个人账户',
    },
  ], [alertCount]);

  return <AppShell items={menuItems} personalPath="/family/personal" />;
};

export default FamilyLayout;
