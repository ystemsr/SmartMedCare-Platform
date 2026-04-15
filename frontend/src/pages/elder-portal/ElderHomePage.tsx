import React, { useEffect, useState } from 'react';
import { Card, Descriptions, Spin, Tag, Table, Typography, Alert } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useAuthStore } from '../../store/auth';
import { getElderSelf, getElderHealthRecords } from '../../api/elderPortal';

const { Title } = Typography;

interface ElderProfile {
  id: number;
  name: string;
  gender: string;
  birth_date: string;
  phone: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  tags: string[];
}

interface HealthRecord {
  id: number;
  record_date: string;
  record_type: string;
  summary: string;
  created_at: string;
}

const ElderHomePage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const [profile, setProfile] = useState<ElderProfile | null>(null);
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setProfileLoading(true);
      try {
        const res = await getElderSelf();
        setProfile(res.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取个人信息失败');
      } finally {
        setProfileLoading(false);
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    const elderId = user?.elder_id;
    if (!elderId) return;

    const fetchRecords = async () => {
      setRecordsLoading(true);
      try {
        const res = await getElderHealthRecords(elderId, { page: 1, page_size: 5 });
        setHealthRecords(res.data?.items || []);
      } catch {
        // Silently handle — profile section is more important
      } finally {
        setRecordsLoading(false);
      }
    };
    fetchRecords();
  }, [user?.elder_id]);

  const genderMap: Record<string, string> = {
    male: '男',
    female: '女',
    M: '男',
    F: '女',
  };

  const columns: ColumnsType<HealthRecord> = [
    {
      title: '记录日期',
      dataIndex: 'record_date',
      key: 'record_date',
      width: 120,
    },
    {
      title: '类型',
      dataIndex: 'record_type',
      key: 'record_type',
      width: 100,
    },
    {
      title: '摘要',
      dataIndex: 'summary',
      key: 'summary',
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
    },
  ];

  if (profileLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return <Alert type="error" message="加载失败" description={error} showIcon />;
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Title level={4} style={{ marginBottom: 16 }}>
          {profile?.name ? `${profile.name}，您好！` : '您好！'}
        </Title>
        <Descriptions column={{ xs: 1, sm: 2 }} bordered>
          <Descriptions.Item label="姓名">{profile?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="性别">
            {profile?.gender ? (genderMap[profile.gender] || profile.gender) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="出生日期">{profile?.birth_date || '-'}</Descriptions.Item>
          <Descriptions.Item label="联系电话">{profile?.phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="住址" span={2}>{profile?.address || '-'}</Descriptions.Item>
          <Descriptions.Item label="紧急联系人">
            {profile?.emergency_contact_name || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="紧急联系电话">
            {profile?.emergency_contact_phone || '-'}
          </Descriptions.Item>
          {profile?.tags && profile.tags.length > 0 && (
            <Descriptions.Item label="标签" span={2}>
              {profile.tags.map((tag) => (
                <Tag color="blue" key={tag}>
                  {tag}
                </Tag>
              ))}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <Card title="近期健康记录">
        <Table<HealthRecord>
          columns={columns}
          dataSource={healthRecords}
          loading={recordsLoading}
          rowKey="id"
          pagination={false}
          locale={{ emptyText: '暂无健康记录' }}
          scroll={{ x: 'max-content' }}
        />
      </Card>
    </div>
  );
};

export default ElderHomePage;
