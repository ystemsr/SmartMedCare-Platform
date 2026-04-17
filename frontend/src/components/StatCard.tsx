import React, { type ReactNode } from 'react';
import { Card } from './ui';

interface StatCardProps {
  title: string;
  value: number | string;
  icon?: ReactNode;
  color?: string;
  suffix?: string;
  loading?: boolean;
}

/** Dashboard statistic card with icon and optional coloring — MUI-free. */
const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  color,
  suffix,
  loading,
}) => {
  const tone = color || 'var(--smc-primary)';
  return (
    <Card style={{ height: '100%' }}>
      <div style={{ padding: 20 }}>
        <div className="smc-stat">
          {icon && (
            <span
              className="smc-stat__icon"
              style={{
                background: `color-mix(in oklab, ${tone} 12%, transparent)`,
                color: tone,
              }}
            >
              {icon}
            </span>
          )}
          <div style={{ minWidth: 0 }}>
            <div className="smc-stat__title">{title}</div>
            {loading ? (
              <div className="smc-skel" style={{ width: 110, height: 28 }} />
            ) : (
              <div className="smc-stat__value">
                {value}
                {suffix ? <span className="smc-stat__suffix">{suffix}</span> : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default StatCard;
