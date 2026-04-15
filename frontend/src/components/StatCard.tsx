import React from 'react';
import { Card, Statistic } from 'antd';
import type { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: number | string;
  icon?: ReactNode;
  color?: string;
  suffix?: string;
  loading?: boolean;
}

/**
 * Dashboard statistic card with icon and optional coloring.
 */
const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  color,
  suffix,
  loading,
}) => {
  return (
    <Card hoverable loading={loading}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {icon && (
          <div
            style={{
              fontSize: 32,
              color: color || '#1677ff',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {icon}
          </div>
        )}
        <Statistic title={title} value={value} suffix={suffix} />
      </div>
    </Card>
  );
};

export default StatCard;
