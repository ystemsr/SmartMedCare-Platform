/**
 * Reference-style shared primitives — thin wrappers around the
 * ref-layout.css class vocabulary. They make pages terser and keep
 * typography / spacing consistent across the app.
 */
import React, { type ReactNode, type CSSProperties } from 'react';

// ---------- Page head ----------
interface PageHeadProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export const RefPageHead: React.FC<PageHeadProps> = ({
  title,
  subtitle,
  actions,
  className,
  style,
}) => (
  <div
    className={['ref-page-head', className].filter(Boolean).join(' ')}
    style={style}
  >
    <div style={{ minWidth: 0 }}>
      <h1 className="ref-page-head__title">{title}</h1>
      {subtitle && <p className="ref-page-head__sub">{subtitle}</p>}
    </div>
    {actions && <div className="ref-page-head__actions">{actions}</div>}
  </div>
);

// ---------- Stat card (matches reference .stat) ----------
type Tone = 'ok' | 'warn' | 'risk' | 'info' | 'purple' | 'primary';

interface RefStatProps {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  delta?: { text: ReactNode; up?: boolean };
  className?: string;
  style?: CSSProperties;
  valueColor?: string;
  kpi?: boolean;
}

export const RefStat: React.FC<RefStatProps> = ({
  label,
  value,
  sub,
  icon,
  tone = 'primary',
  delta,
  className,
  style,
  valueColor,
  kpi,
}) => (
  <div
    className={[kpi ? 'ref-kpi-tile' : 'ref-stat', className]
      .filter(Boolean)
      .join(' ')}
    style={style}
  >
    <div className="ref-stat__label">
      <span>{label}</span>
      {icon && !kpi && (
        <span className={`ref-stat__ico ref-stat__ico--${tone}`}>{icon}</span>
      )}
    </div>
    <div className="ref-stat__val" style={valueColor ? { color: valueColor } : undefined}>
      {value}
    </div>
    {(sub || delta) && (
      <div className="ref-stat__sub">
        {sub}
        {delta && (
          <span className={delta.up ? 'ref-delta-up' : 'ref-delta-down'}>
            · {delta.text}
          </span>
        )}
      </div>
    )}
  </div>
);

// ---------- Severity label ----------
type Sev = 'high' | 'med' | 'low' | 'ok' | 'mute';
export const RefSev: React.FC<{ level: Sev; children: ReactNode }> = ({
  level,
  children,
}) => <span className={`ref-sev ref-sev--${level}`}>{children}</span>;

// ---------- Badge pill ----------
type PillTone = Tone | 'mute';
export const RefPill: React.FC<{
  tone?: PillTone;
  dot?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}> = ({ tone = 'mute', dot, children, style }) => (
  <span className={`ref-pill ref-pill--${tone}`} style={style}>
    {dot && <span className="ref-pill__dot" />}
    {children}
  </span>
);

// ---------- Progress bar ----------
export const RefBar: React.FC<{
  value: number; // 0..100
  tone?: 'ok' | 'warn' | 'risk' | 'info' | 'primary';
  style?: CSSProperties;
  height?: number;
}> = ({ value, tone = 'primary', style, height }) => (
  <div
    className="ref-bar-track"
    style={height ? { ...style, height } : style}
  >
    <div
      className={`ref-bar-fill${tone === 'primary' ? '' : ` ref-bar-fill--${tone}`}`}
      style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
    />
  </div>
);

// ---------- Status strip ----------
export const RefStatusStrip: React.FC<{
  tone: 'ok' | 'warn' | 'risk' | 'info';
  icon?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  style?: CSSProperties;
}> = ({ tone, icon, children, actions, style }) => (
  <div className={`ref-status-strip ref-status-strip--${tone}`} style={style}>
    {icon}
    <span style={{ flex: 1 }}>{children}</span>
    {actions}
  </div>
);

// ---------- Timeline ----------
interface TimelineItem {
  time: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  tone?: 'risk' | 'ok' | 'warn' | 'info' | 'mute';
}

export const RefTimeline: React.FC<{ items: TimelineItem[] }> = ({ items }) => (
  <div className="ref-tl">
    {items.map((item, i) => (
      <div
        key={i}
        className={[
          'ref-tl__item',
          item.tone ? `ref-tl__item--${item.tone}` : undefined,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="ref-tl__date">{item.time}</div>
        <div className="ref-tl__title">{item.title}</div>
        {item.body && <div className="ref-tl__body">{item.body}</div>}
      </div>
    ))}
  </div>
);

// ---------- Simple card (ref-style) ----------
interface RefCardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  flush?: boolean;
  bodyStyle?: CSSProperties;
}

export const RefCard: React.FC<RefCardProps> = ({
  title,
  subtitle,
  actions,
  children,
  className,
  style,
  flush,
  bodyStyle,
}) => (
  <div className={['ref-card', className].filter(Boolean).join(' ')} style={style}>
    {(title || actions) && (
      <div className="ref-card__head">
        <div style={{ minWidth: 0 }}>
          {title && <h3 className="ref-card__title">{title}</h3>}
          {subtitle && <div className="ref-card__sub">{subtitle}</div>}
        </div>
        {actions}
      </div>
    )}
    <div
      className={`ref-card__body${flush ? ' ref-card__body--flush' : ''}`}
      style={bodyStyle}
    >
      {children}
    </div>
  </div>
);

// ---------- Grid ----------
export const RefGrid: React.FC<{
  cols?: 2 | 3 | 4 | '2-1' | '1-2' | '3-1';
  gap?: number;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}> = ({ cols = 2, gap = 16, children, style, className }) => (
  <div
    className={['ref-grid', `ref-grid--${cols}`, className]
      .filter(Boolean)
      .join(' ')}
    style={{ gap, ...style }}
  >
    {children}
  </div>
);

// ---------- Avatar ----------
export const RefAvatar: React.FC<{
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  muted?: boolean;
  style?: CSSProperties;
}> = ({ name, size = 'md', muted, style }) => (
  <span
    className={[
      'ref-avatar',
      size !== 'md' && `ref-avatar--${size}`,
      muted && 'ref-avatar--muted',
    ]
      .filter(Boolean)
      .join(' ')}
    style={style}
  >
    {(name || 'U').slice(0, 1)}
  </span>
);

// ---------- Section label ----------
export const RefSectionLabel: React.FC<{
  children: ReactNode;
  style?: CSSProperties;
}> = ({ children, style }) => (
  <div className="ref-section-label" style={style}>
    {children}
  </div>
);
