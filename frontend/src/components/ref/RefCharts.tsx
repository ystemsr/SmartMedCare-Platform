/**
 * Pure-SVG chart primitives — ported from the Smart-MedCare reference
 * demo. Kept tiny and dependency-free so they render crisply in dense
 * admin layouts without ECharts instantiation overhead.
 *
 * Color inputs accept CSS custom-property strings (e.g. "var(--smc-primary)")
 * or plain hex/named values.
 */
import React from 'react';

// ---------- Line chart ----------
interface LineChartProps {
  data: number[];
  compare?: number[];
  labels?: (string | undefined)[];
  width?: number;
  height?: number;
  color?: string;
  fill?: string;
  compareColor?: string;
  yMin?: number;
  yMax?: number;
  showDots?: boolean;
}

export const RefLineChart: React.FC<LineChartProps> = ({
  data,
  compare,
  labels,
  width = 600,
  height = 180,
  color = 'var(--smc-primary)',
  fill = 'rgba(217, 119, 87, 0.18)',
  compareColor = 'var(--smc-info)',
  yMin,
  yMax,
  showDots = true,
}) => {
  if (!data.length) return null;
  const pad = { t: 12, r: 12, b: 22, l: 32 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  const all = compare ? [...data, ...compare] : data;
  const min = yMin ?? Math.min(...all) - 4;
  const max = yMax ?? Math.max(...all) + 4;
  const range = max - min || 1;
  const xs = (i: number) =>
    pad.l + (i / Math.max(1, data.length - 1)) * W;
  const ys = (v: number) => pad.t + (1 - (v - min) / range) * H;
  const linePath = (arr: number[]) =>
    arr.map((v, i) => `${i ? 'L' : 'M'}${xs(i)},${ys(v)}`).join(' ');
  const areaPath = `${linePath(data)} L${xs(data.length - 1)},${pad.t + H} L${xs(0)},${pad.t + H} Z`;
  const yticks = 4;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="ref-chart"
      preserveAspectRatio="none"
      style={{ width: '100%', height }}
    >
      {Array.from({ length: yticks + 1 }).map((_, i) => {
        const y = pad.t + (i / yticks) * H;
        const v = max - (i / yticks) * range;
        return (
          <g key={i}>
            <line
              x1={pad.l}
              x2={pad.l + W}
              y1={y}
              y2={y}
              stroke="var(--smc-divider)"
              strokeDasharray="2 3"
            />
            <text
              x={pad.l - 6}
              y={y + 3}
              textAnchor="end"
              fontSize="10"
              fill="var(--smc-text-3)"
            >
              {Math.round(v)}
            </text>
          </g>
        );
      })}
      <path d={areaPath} fill={fill} />
      <path
        d={linePath(data)}
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {compare && (
        <path
          d={linePath(compare)}
          stroke={compareColor}
          strokeWidth="1.5"
          strokeDasharray="4 3"
          fill="none"
        />
      )}
      {showDots &&
        data.map((v, i) => (
          <circle
            key={i}
            cx={xs(i)}
            cy={ys(v)}
            r="2.5"
            fill="var(--smc-surface)"
            stroke={color}
            strokeWidth="1.5"
          />
        ))}
      {labels?.map((l, i) => (
        <text
          key={i}
          x={xs(i)}
          y={height - 6}
          textAnchor="middle"
          fontSize="10"
          fill="var(--smc-text-3)"
        >
          {l ?? ''}
        </text>
      ))}
    </svg>
  );
};

// ---------- Bar chart ----------
interface BarChartProps {
  data: number[];
  labels?: string[];
  width?: number;
  height?: number;
  color?: string;
  showValues?: boolean;
}

export const RefBarChart: React.FC<BarChartProps> = ({
  data,
  labels,
  width = 600,
  height = 180,
  color = 'var(--smc-primary)',
  showValues = true,
}) => {
  if (!data.length) return null;
  const pad = { t: 12, r: 12, b: 24, l: 32 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  const max = Math.max(...data) * 1.15 || 1;
  const bw = (W / data.length) * 0.62;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="ref-chart"
      preserveAspectRatio="none"
      style={{ width: '100%', height }}
    >
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
        const y = pad.t + t * H;
        return (
          <line
            key={i}
            x1={pad.l}
            x2={pad.l + W}
            y1={y}
            y2={y}
            stroke="var(--smc-divider)"
            strokeDasharray={t === 1 ? '0' : '2 3'}
          />
        );
      })}
      {data.map((v, i) => {
        const x = pad.l + (i + 0.5) * (W / data.length) - bw / 2;
        const h = (v / max) * H;
        const y = pad.t + H - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={h} fill={color} rx="3" />
            {labels?.[i] && (
              <text
                x={x + bw / 2}
                y={pad.t + H + 14}
                textAnchor="middle"
                fontSize="10"
                fill="var(--smc-text-3)"
              >
                {labels[i]}
              </text>
            )}
            {showValues && (
              <text
                x={x + bw / 2}
                y={y - 4}
                textAnchor="middle"
                fontSize="10"
                fill="var(--smc-text-3)"
              >
                {v}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

// ---------- Donut ----------
export interface DonutDatum {
  value: number;
  color: string;
  label?: string;
}

interface DonutProps {
  data: DonutDatum[];
  size?: number;
  stroke?: number;
  centerLabel?: string;
  centerValue?: string | number;
}

export const RefDonut: React.FC<DonutProps> = ({
  data,
  size = 160,
  stroke = 22,
  centerLabel = '总数',
  centerValue,
}) => {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const R = (size - stroke) / 2;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={R}
        fill="none"
        stroke="var(--smc-surface-alt)"
        strokeWidth={stroke}
      />
      {data.map((d, i) => {
        const len = (d.value / total) * C;
        const el = (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={R}
            fill="none"
            stroke={d.color}
            strokeWidth={stroke}
            strokeDasharray={`${len} ${C - len}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            strokeLinecap="butt"
          />
        );
        offset += len;
        return el;
      })}
      <text
        x={size / 2}
        y={size / 2 - 3}
        textAnchor="middle"
        fontSize="22"
        fontWeight="500"
        fill="var(--smc-text)"
        fontFamily="var(--smc-font-display)"
      >
        {centerValue ?? total}
      </text>
      <text
        x={size / 2}
        y={size / 2 + 14}
        textAnchor="middle"
        fontSize="11"
        fill="var(--smc-text-3)"
      >
        {centerLabel}
      </text>
    </svg>
  );
};

// ---------- Sparkline ----------
interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
}

export const RefSparkline: React.FC<SparklineProps> = ({
  data,
  width = 100,
  height = 28,
  color = 'var(--smc-primary)',
  strokeWidth = 1.5,
  fill,
}) => {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const xs = (i: number) => (i / Math.max(1, data.length - 1)) * width;
  const ys = (v: number) => height - ((v - min) / range) * height;
  const path = data
    .map((v, i) => `${i ? 'L' : 'M'}${xs(i)},${ys(v)}`)
    .join(' ');
  const areaPath = `${path} L${xs(data.length - 1)},${height} L${xs(0)},${height} Z`;
  return (
    <svg width={width} height={height} style={{ display: 'inline-block' }}>
      {fill && <path d={areaPath} fill={fill} />}
      <path d={path} fill="none" stroke={color} strokeWidth={strokeWidth} />
    </svg>
  );
};

// ---------- Heatmap (pseudo-random seed or user-supplied cells) ----------
interface HeatmapProps {
  rows?: number;
  cols?: number;
  seed?: number;
  values?: number[]; // flat row-major array in [0,1]
  color?: string;
  height?: number;
}

export const RefHeatmap: React.FC<HeatmapProps> = ({
  rows = 7,
  cols = 24,
  seed = 1,
  values,
  color = 'var(--smc-primary)',
  height = 160,
}) => {
  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const cells =
    values ??
    Array.from({ length: rows * cols }).map(() => rnd());
  const cw = 100 / cols;
  const ch = 100 / rows;
  return (
    <svg
      viewBox="0 0 100 60"
      preserveAspectRatio="none"
      style={{ width: '100%', height }}
    >
      {cells.map((v, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        return (
          <rect
            key={i}
            x={c * cw}
            y={r * ch * 0.6}
            width={cw - 0.2}
            height={ch * 0.6 - 0.2}
            fill={color}
            opacity={0.1 + v * 0.85}
          />
        );
      })}
    </svg>
  );
};

// ---------- Radar ----------
interface RadarProps {
  axes: string[];
  values: number[]; // each in [0, 1]
  width?: number;
  height?: number;
  color?: string;
}

export const RefRadar: React.FC<RadarProps> = ({
  axes,
  values,
  width = 320,
  height = 220,
  color = 'var(--smc-primary)',
}) => {
  const cx = width / 2;
  const cy = height / 2;
  const R = Math.min(cx, cy) - 30;
  const n = axes.length;
  const pts = (vals: number[]) =>
    vals.map((v, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v] as const;
    });
  const poly = (arr: readonly (readonly [number, number])[]) =>
    arr.map((p) => p.join(',')).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
      {[0.25, 0.5, 0.75, 1].map((t, i) => (
        <polygon
          key={i}
          points={poly(pts(Array(n).fill(t)))}
          fill="none"
          stroke="var(--smc-divider)"
        />
      ))}
      {axes.map((a, i) => {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        const lx = cx + Math.cos(ang) * (R + 16);
        const ly = cy + Math.sin(ang) * (R + 16);
        return (
          <g key={i}>
            <line
              x1={cx}
              y1={cy}
              x2={cx + Math.cos(ang) * R}
              y2={cy + Math.sin(ang) * R}
              stroke="var(--smc-divider)"
            />
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              fontSize="11"
              fill="var(--smc-text-2)"
              dy="4"
            >
              {a}
            </text>
          </g>
        );
      })}
      <polygon
        points={poly(pts(values))}
        fill={color}
        fillOpacity="0.28"
        stroke={color}
        strokeWidth="2"
      />
      {pts(values).map((p, i) => (
        <circle
          key={i}
          cx={p[0]}
          cy={p[1]}
          r="3.5"
          fill="var(--smc-surface)"
          stroke={color}
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
};

// ---------- Radial score dial (used in assessment reports) ----------
interface DialProps {
  value: number; // 0..100
  max?: number;
  label?: string;
  size?: number;
  stroke?: number;
  color?: string;
}

export const RefDial: React.FC<DialProps> = ({
  value,
  max = 100,
  label,
  size = 180,
  stroke = 14,
  color = 'var(--smc-warning)',
}) => {
  const R = (size - stroke) / 2;
  const C = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div className="ref-dial" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={R}
          fill="none"
          stroke="var(--smc-surface-alt)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${C * pct} ${C}`}
          strokeDashoffset="0"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeLinecap="round"
        />
      </svg>
      <div className="ref-dial__val">
        <div>
          <div className="ref-dial__num" style={{ color }}>
            {value}
          </div>
          {label && <div className="ref-dial__label">{label}</div>}
        </div>
      </div>
    </div>
  );
};
