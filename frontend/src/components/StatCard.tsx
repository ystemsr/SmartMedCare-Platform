import React, { type ReactNode } from 'react';
import { Card } from './ui';

interface StatCardProps {
  title: string;
  value: number | string;
  icon?: ReactNode;
  /** Optional accent; defaults to the Anthropic orange primary. */
  color?: string;
  suffix?: string;
  /** Short human-readable delta or hint shown under the value. */
  hint?: string;
  loading?: boolean;
}

/**
 * Editorial stat card — Lora display for the number, uppercase UI label,
 * warm tonal tile for the icon. Reads a single accent so it can theme
 * per-metric without importing the full palette.
 */
const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  color,
  suffix,
  hint,
  loading,
}) => {
  const tone = color || 'var(--smc-primary)';
  return (
    <Card className="smc-card--hoverable">
      <div style={{ padding: '22px 22px 20px', position: 'relative' }}>
        {/* Decorative hairline accent — asymmetric, small. */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 22,
            right: 22,
            width: 18,
            height: 1,
            background: tone,
            opacity: 0.7,
          }}
        />
        <div className="smc-stat">
          {icon && (
            <span
              className="smc-stat__icon"
              style={{
                background: `color-mix(in oklab, ${tone} 14%, transparent)`,
                color: tone,
              }}
            >
              {icon}
            </span>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="smc-stat__title">{title}</div>
            {loading ? (
              <div className="smc-skel" style={{ width: 110, height: 30 }} />
            ) : (
              <div className="smc-stat__value">
                {value}
                {suffix ? <span className="smc-stat__suffix">{suffix}</span> : null}
              </div>
            )}
            {hint && !loading && (
              <div
                style={{
                  marginTop: 6,
                  fontFamily: 'var(--smc-font-ui)',
                  fontSize: 12,
                  color: 'var(--smc-text-3)',
                  letterSpacing: 0.2,
                }}
              >
                {hint}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default StatCard;
