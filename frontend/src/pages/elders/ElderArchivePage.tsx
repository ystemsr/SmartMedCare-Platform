import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button, Card, Chip, Divider, Spinner } from '../../components/ui';
import { getElderDetail, getHealthRecords, getMedicalRecords, getCareRecords } from '../../api/elders';
import { formatGender, formatDate, formatDateTime } from '../../utils/formatter';
import { message } from '../../utils/message';
import type { Elder, HealthRecord, MedicalRecord, CareRecord } from '../../types/elder';

interface TimelineEntry {
  time: string;
  type: 'health' | 'medical' | 'care';
  label: string;
  content: string;
}

function InlineStatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card>
      <div style={{ padding: '20px 22px', position: 'relative' }}>
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 22,
            right: 22,
            width: 18,
            height: 1,
            background: color,
            opacity: 0.7,
          }}
        />
        <div
          style={{
            fontFamily: 'var(--smc-font-ui)',
            fontSize: 10,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--smc-text-3)',
            marginBottom: 8,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: 'var(--smc-font-display)',
            fontSize: 30,
            fontWeight: 500,
            letterSpacing: '-0.01em',
            color: 'var(--smc-text)',
            lineHeight: 1.05,
          }}
        >
          {value}
        </div>
      </div>
    </Card>
  );
}

const ElderArchivePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const elderId = Number(id);

  const [elder, setElder] = useState<Elder | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [stats, setStats] = useState({ health: 0, medical: 0, care: 0 });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [elderRes, healthRes, medicalRes, careRes] = await Promise.all([
        getElderDetail(elderId),
        getHealthRecords(elderId, { page_size: 100 }),
        getMedicalRecords(elderId, { page_size: 100 }),
        getCareRecords(elderId, { page_size: 100 }),
      ]);

      setElder(elderRes.data);
      setStats({
        health: healthRes.data.total,
        medical: medicalRes.data.total,
        care: careRes.data.total,
      });

      const entries: TimelineEntry[] = [];
      healthRes.data.items.forEach((record: HealthRecord) => {
        const parts = [
          `血压 ${record.blood_pressure_systolic || '-'}/${record.blood_pressure_diastolic || '-'}`,
          `心率 ${record.heart_rate || '-'}`,
          `血糖 ${record.blood_glucose || '-'}`,
        ];
        if (record.chronic_diseases?.length) {
          parts.push(`慢性病: ${record.chronic_diseases.join('、')}`);
        }
        if (record.allergies?.length) {
          parts.push(`过敏史: ${record.allergies.join('、')}`);
        }
        entries.push({
          time: record.recorded_at,
          type: 'health',
          label: '健康记录',
          content: parts.join('，'),
        });
      });
      medicalRes.data.items.forEach((record: MedicalRecord) => {
        entries.push({
          time: record.visit_date,
          type: 'medical',
          label: '医疗记录',
          content: `${record.hospital_name} ${record.department} - ${record.diagnosis}`,
        });
      });
      careRes.data.items.forEach((record: CareRecord) => {
        entries.push({
          time: record.care_date,
          type: 'care',
          label: '照护记录',
          content: `${record.caregiver_name}: ${record.content}`,
        });
      });

      entries.sort((a, b) => {
        const tb = a.time ? new Date(a.time).getTime() : 0;
        const ta = b.time ? new Date(b.time).getTime() : 0;
        return ta - tb;
      });
      setTimeline(entries);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [elderId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const typeColorMap = useMemo<Record<string, string>>(
    () => ({
      health: '#D97757',
      medical: '#788C5D',
      care: '#C08A2E',
    }),
    [],
  );

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '50vh',
        }}
      >
        <Spinner />
      </div>
    );
  }

  const initial = (elder?.name || '老').slice(0, 1);

  const profileField = (label: string, value: React.ReactNode) => (
    <div>
      <div
        style={{
          fontFamily: 'var(--smc-font-ui)',
          fontSize: 10,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--smc-text-3)',
          fontWeight: 500,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 15, color: 'var(--smc-text)', lineHeight: 1.5 }}>
        {value}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <Button
          variant="text"
          startIcon={<ArrowLeft size={14} />}
          onClick={() => navigate(-1)}
        >
          返回
        </Button>
      </div>

      <div className="smc-page-hero" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', gap: 18, minWidth: 0, flex: 1 }}>
          <span
            aria-hidden
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background:
                'color-mix(in oklab, var(--smc-primary) 14%, transparent)',
              color: 'var(--smc-primary-700)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--smc-font-display)',
              fontSize: 28,
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            {initial}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="smc-page-hero__kicker">档案 · Health Archive</div>
            <h1 className="smc-page-hero__title">
              {elder?.name || '老人档案'}
            </h1>
            <p className="smc-page-hero__sub">
              时间线视角的健康档案，汇总体征、就诊与照护记录，按时间倒序。
            </p>
          </div>
        </div>
      </div>

      <Card>
        <div style={{ padding: 24 }}>
          <div
            style={{
              fontFamily: 'var(--smc-font-ui)',
              fontSize: 10,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--smc-text-3)',
              marginBottom: 18,
            }}
          >
            基础信息
          </div>
          <div
            style={{
              display: 'grid',
              gap: 20,
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            }}
          >
            {profileField('性别', formatGender(elder?.gender))}
            {profileField('出生日期', formatDate(elder?.birth_date))}
            {profileField('联系电话', elder?.phone || '-')}
            {profileField('地址', elder?.address || '-')}
            {profileField(
              '标签',
              elder?.tags?.length ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {elder.tags.map((tag) => (
                    <Chip key={tag} tone="primary" outlined>
                      {tag}
                    </Chip>
                  ))}
                </div>
              ) : (
                '-'
              ),
            )}
          </div>
        </div>
      </Card>

      <div
        style={{
          display: 'grid',
          gap: 16,
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        }}
      >
        <InlineStatCard label="健康记录数" value={stats.health} color="#D97757" />
        <InlineStatCard label="医疗记录数" value={stats.medical} color="#788C5D" />
        <InlineStatCard label="照护记录数" value={stats.care} color="#C08A2E" />
      </div>

      <Card>
        <div style={{ padding: 24 }}>
          <div
            style={{
              fontFamily: 'var(--smc-font-ui)',
              fontSize: 10,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--smc-text-3)',
              marginBottom: 18,
            }}
          >
            时间线
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {timeline.length ? (
              timeline.map((entry, index) => (
                <div
                  key={`${entry.type}-${entry.time}-${index}`}
                  style={{ display: 'flex', gap: 16 }}
                >
                  <div
                    style={{
                      width: 12,
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'flex-start',
                      paddingTop: 6,
                    }}
                  >
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: typeColorMap[entry.type],
                        boxShadow: `0 0 0 6px ${typeColorMap[entry.type]}22`,
                      }}
                    />
                  </div>
                  <div style={{ flex: 1, paddingBottom: 16 }}>
                    <div
                      style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}
                    >
                      <Chip
                        outlined
                        style={{
                          borderColor: typeColorMap[entry.type],
                          color: typeColorMap[entry.type],
                        }}
                      >
                        {entry.label}
                      </Chip>
                      <span style={{ fontSize: 12, color: 'var(--smc-text-2)' }}>
                        {formatDateTime(entry.time)}
                      </span>
                    </div>
                    <div style={{ fontSize: 14 }}>{entry.content}</div>
                    {index < timeline.length - 1 && <Divider />}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--smc-text-2)' }}>
                暂无记录
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ElderArchivePage;
