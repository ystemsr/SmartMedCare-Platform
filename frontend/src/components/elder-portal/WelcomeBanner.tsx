import React from 'react';
import { Sun, Droplets, Wind, MapPin, Thermometer } from 'lucide-react';
import dayjs from 'dayjs';
import { Card, CardBody, Spinner } from '@/components/ui';
import type { WeatherInfo } from '@/api/elderPortal';

function getGreetingByTime(): string {
  const hour = dayjs().hour();
  if (hour < 6) return '夜深了，注意休息';
  if (hour < 11) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

interface WelcomeBannerProps {
  name?: string | null;
  weather?: WeatherInfo | null;
  weatherLoading?: boolean;
  weatherError?: string | null;
}

const WelcomeBanner: React.FC<WelcomeBannerProps> = ({
  name,
  weather,
  weatherLoading,
  weatherError,
}) => {
  const greeting = getGreetingByTime();
  const iconUrl = weather?.icon
    ? `https://openweathermap.org/img/wn/${weather.icon}@2x.png`
    : null;

  return (
    <Card
      style={{
        borderRadius: 20,
        overflow: 'hidden',
        background: 'var(--smc-surface)',
        border: '1px solid var(--smc-border)',
        boxShadow: '0 2px 12px rgba(15, 23, 42, 0.04)',
      }}
    >
      <CardBody style={{ padding: '26px 30px' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 20,
          }}
        >
          {/* Left — greeting */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                background:
                  'linear-gradient(135deg, rgba(251, 191, 36, 0.18), rgba(249, 115, 22, 0.14))',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Sun size={28} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 26,
                  lineHeight: 1.2,
                  color: 'var(--smc-text)',
                  letterSpacing: 0.2,
                }}
              >
                {name ? `${name}，${greeting}！` : `${greeting}！`}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 15,
                  color: 'var(--smc-text-2)',
                }}
              >
                {dayjs().format('YYYY年M月D日 dddd')} · 祝您身体健康
              </div>
            </div>
          </div>

          {/* Right — weather summary */}
          <WeatherSummary
            weather={weather}
            loading={weatherLoading}
            error={weatherError}
            iconUrl={iconUrl}
          />
        </div>
      </CardBody>
    </Card>
  );
};

interface WeatherSummaryProps {
  weather?: WeatherInfo | null;
  loading?: boolean;
  error?: string | null;
  iconUrl?: string | null;
}

const WeatherSummary: React.FC<WeatherSummaryProps> = ({
  weather,
  loading,
  error,
  iconUrl,
}) => {
  const baseStyle: React.CSSProperties = {
    minWidth: 260,
    padding: '12px 18px',
    borderRadius: 16,
    background:
      'linear-gradient(135deg, rgba(56, 189, 248, 0.10), rgba(14, 165, 233, 0.06))',
    border: '1px solid rgba(56, 189, 248, 0.18)',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    color: 'var(--smc-text-2)',
    fontSize: 14,
  };

  if (loading) {
    return (
      <div style={baseStyle}>
        <Spinner size="sm" />
        <span>正在获取天气…</span>
      </div>
    );
  }

  if (error || !weather || weather.temp == null) {
    return (
      <div style={baseStyle}>
        <Thermometer size={18} style={{ color: '#0ea5e9' }} />
        <span>{error || '暂无天气信息'}</span>
      </div>
    );
  }

  return (
    <div style={baseStyle}>
      {iconUrl ? (
        <img
          src={iconUrl}
          alt={weather.description || 'weather'}
          style={{ width: 52, height: 52, flexShrink: 0 }}
        />
      ) : (
        <Sun size={32} style={{ color: '#f59e0b' }} />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            color: 'var(--smc-text)',
          }}
        >
          <span style={{ fontSize: 26, fontWeight: 700, lineHeight: 1 }}>
            {Math.round(weather.temp)}°
          </span>
          <span style={{ fontSize: 15, fontWeight: 500 }}>
            {weather.description || weather.main || '—'}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            fontSize: 13,
            color: 'var(--smc-text-2)',
          }}
        >
          {weather.city && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={13} />
              {weather.city}
            </span>
          )}
          {weather.humidity != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Droplets size={13} />
              湿度 {weather.humidity}%
            </span>
          )}
          {weather.wind_speed != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Wind size={13} />
              {weather.wind_speed} m/s
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default WelcomeBanner;
