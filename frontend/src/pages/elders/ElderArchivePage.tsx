import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Timeline, Tag, Row, Col, Statistic, Spin, Button, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import {
  getElderDetail,
  getHealthRecords,
  getMedicalRecords,
  getCareRecords,
} from '../../api/elders';
import { formatGender, formatDate, formatDateTime } from '../../utils/formatter';
import type { Elder, HealthRecord, MedicalRecord, CareRecord } from '../../types/elder';

interface TimelineEntry {
  time: string;
  type: 'health' | 'medical' | 'care';
  label: string;
  content: string;
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

      // Build unified timeline
      const entries: TimelineEntry[] = [];
      healthRes.data.items.forEach((r: HealthRecord) => {
        entries.push({
          time: r.recorded_at,
          type: 'health',
          label: '健康记录',
          content: `血压 ${r.blood_pressure_systolic || '-'}/${r.blood_pressure_diastolic || '-'}，心率 ${r.heart_rate || '-'}，血糖 ${r.blood_glucose || '-'}`,
        });
      });
      medicalRes.data.items.forEach((r: MedicalRecord) => {
        entries.push({
          time: r.visit_date,
          type: 'medical',
          label: '医疗记录',
          content: `${r.hospital_name} ${r.department} - ${r.diagnosis}`,
        });
      });
      careRes.data.items.forEach((r: CareRecord) => {
        entries.push({
          time: r.care_date,
          type: 'care',
          label: '照护记录',
          content: `${r.caregiver_name}: ${r.content}`,
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

  const typeColorMap: Record<string, string> = {
    health: 'blue',
    medical: 'green',
    care: 'orange',
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        style={{ marginBottom: 16 }}
      >
        返回
      </Button>

      <Card title={`${elder?.name || ''} - 健康档案`} style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2, lg: 3 }}>
          <Descriptions.Item label="姓名">{elder?.name}</Descriptions.Item>
          <Descriptions.Item label="性别">{formatGender(elder?.gender)}</Descriptions.Item>
          <Descriptions.Item label="出生日期">{formatDate(elder?.birth_date)}</Descriptions.Item>
          <Descriptions.Item label="联系电话">{elder?.phone}</Descriptions.Item>
          <Descriptions.Item label="地址">{elder?.address}</Descriptions.Item>
          <Descriptions.Item label="标签">
            {elder?.tags?.map((t) => <Tag key={t} color="blue">{t}</Tag>) || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Statistic title="健康记录数" value={stats.health} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="医疗记录数" value={stats.medical} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="照护记录数" value={stats.care} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
      </Row>

      <Card title="时间线">
        <Timeline
          items={timeline.map((entry) => ({
            color: typeColorMap[entry.type],
            children: (
              <div>
                <div style={{ marginBottom: 4 }}>
                  <Tag color={typeColorMap[entry.type]}>{entry.label}</Tag>
                  <span style={{ color: '#8c8c8c', fontSize: 12 }}>
                    {formatDateTime(entry.time)}
                  </span>
                </div>
                <div>{entry.content}</div>
              </div>
            ),
          }))}
        />
        {timeline.length === 0 && <div style={{ textAlign: 'center', color: '#8c8c8c' }}>暂无记录</div>}
      </Card>
    </div>
  );
};

export default ElderArchivePage;
