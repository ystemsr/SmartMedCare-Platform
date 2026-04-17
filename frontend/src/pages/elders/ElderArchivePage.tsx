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
      <div style={{ padding: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--smc-text-2)', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
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
        entries.push({
          time: record.recorded_at,
          type: 'health',
          label: '健康记录',
          content: `血压 ${record.blood_pressure_systolic || '-'}/${record.blood_pressure_diastolic || '-'}，心率 ${record.heart_rate || '-'}，血糖 ${record.blood_glucose || '-'}`,
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

      entries.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
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
      health: '#1f6feb',
      medical: '#1f9d63',
      care: '#d9822b',
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <Button variant="text" startIcon={<ArrowLeft size={14} />} onClick={() => navigate(-1)}>
          返回
        </Button>
      </div>

      <Card>
        <div style={{ padding: 24 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 22, fontWeight: 700 }}>
            {elder?.name || ''} - 健康档案
          </h2>
          <div
            style={{
              display: 'grid',
              gap: 16,
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: 'var(--smc-text-2)' }}>姓名</div>
              <div style={{ fontSize: 14 }}>{elder?.name || '-'}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--smc-text-2)' }}>性别</div>
              <div style={{ fontSize: 14 }}>{formatGender(elder?.gender)}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--smc-text-2)' }}>出生日期</div>
              <div style={{ fontSize: 14 }}>{formatDate(elder?.birth_date)}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--smc-text-2)' }}>联系电话</div>
              <div style={{ fontSize: 14 }}>{elder?.phone || '-'}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--smc-text-2)' }}>地址</div>
              <div style={{ fontSize: 14 }}>{elder?.address || '-'}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--smc-text-2)' }}>标签</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {elder?.tags?.length ? (
                  elder.tags.map((tag) => (
                    <Chip key={tag} tone="primary" outlined>
                      {tag}
                    </Chip>
                  ))
                ) : (
                  <span style={{ fontSize: 14 }}>-</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ padding: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600 }}>统计概览</h3>
          <div
            style={{
              display: 'grid',
              gap: 16,
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            }}
          >
            <InlineStatCard label="健康记录数" value={stats.health} color="#1f6feb" />
            <InlineStatCard label="医疗记录数" value={stats.medical} color="#1f9d63" />
            <InlineStatCard label="照护记录数" value={stats.care} color="#d9822b" />
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ padding: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600 }}>时间线</h3>
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
