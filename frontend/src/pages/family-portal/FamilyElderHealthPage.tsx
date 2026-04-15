import React, { useEffect, useState, useCallback } from 'react';
import { Card, Tabs, Table, Spin, Empty, Descriptions, Tag, Typography } from 'antd';
import { HeartOutlined, AlertOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getFamilySelf, getFamilyElder, getElderHealthRecords, getElderAlerts } from '../../api/family';
import type { FamilyMemberInfo, FamilyElderInfo } from '../../types/family';

const { Text } = Typography;

interface HealthRecord {
  id: number;
  record_date: string;
  systolic_bp?: number;
  diastolic_bp?: number;
  blood_glucose?: number;
  heart_rate?: number;
  temperature?: number;
  notes?: string;
  created_at: string;
}

interface AlertRecord {
  id: number;
  elder_name: string;
  alert_type: string;
  level: string;
  message: string;
  status: string;
  created_at: string;
}

const alertLevelColorMap: Record<string, string> = {
  high: 'red',
  medium: 'orange',
  low: 'blue',
};

const alertStatusLabelMap: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已解决',
  closed: '已关闭',
};

const healthColumns: ColumnsType<HealthRecord> = [
  {
    title: '记录日期',
    dataIndex: 'record_date',
    key: 'record_date',
    width: 120,
  },
  {
    title: '收缩压 (mmHg)',
    dataIndex: 'systolic_bp',
    key: 'systolic_bp',
    width: 130,
    render: (val?: number) => val ?? '-',
  },
  {
    title: '舒张压 (mmHg)',
    dataIndex: 'diastolic_bp',
    key: 'diastolic_bp',
    width: 130,
    render: (val?: number) => val ?? '-',
  },
  {
    title: '血糖 (mmol/L)',
    dataIndex: 'blood_glucose',
    key: 'blood_glucose',
    width: 130,
    render: (val?: number) => val ?? '-',
  },
  {
    title: '心率 (bpm)',
    dataIndex: 'heart_rate',
    key: 'heart_rate',
    width: 110,
    render: (val?: number) => val ?? '-',
  },
  {
    title: '体温 (*C)',
    dataIndex: 'temperature',
    key: 'temperature',
    width: 100,
    render: (val?: number) => val ?? '-',
  },
  {
    title: '备注',
    dataIndex: 'notes',
    key: 'notes',
    ellipsis: true,
    render: (val?: string) => val || '-',
  },
];

const alertColumns: ColumnsType<AlertRecord> = [
  {
    title: '预警类型',
    dataIndex: 'alert_type',
    key: 'alert_type',
    width: 120,
  },
  {
    title: '级别',
    dataIndex: 'level',
    key: 'level',
    width: 80,
    render: (level: string) => (
      <Tag color={alertLevelColorMap[level] || 'default'}>{level}</Tag>
    ),
  },
  {
    title: '内容',
    dataIndex: 'message',
    key: 'message',
    ellipsis: true,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    render: (status: string) => alertStatusLabelMap[status] || status,
  },
  {
    title: '时间',
    dataIndex: 'created_at',
    key: 'created_at',
    width: 180,
  },
];

const FamilyElderHealthPage: React.FC = () => {
  const [familyInfo, setFamilyInfo] = useState<FamilyMemberInfo | null>(null);
  const [elderInfo, setElderInfo] = useState<FamilyElderInfo | null>(null);
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [healthTotal, setHealthTotal] = useState(0);
  const [alertsTotal, setAlertsTotal] = useState(0);
  const [healthPage, setHealthPage] = useState(1);
  const [alertsPage, setAlertsPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const fetchBaseData = async () => {
      setLoading(true);
      try {
        const [selfRes, elderRes] = await Promise.all([
          getFamilySelf(),
          getFamilyElder(),
        ]);
        setFamilyInfo(selfRes.data as FamilyMemberInfo);
        setElderInfo(elderRes.data as FamilyElderInfo);
      } catch {
        // Error handled by http interceptor
      } finally {
        setLoading(false);
      }
    };
    fetchBaseData();
  }, []);

  const fetchHealthRecords = useCallback(async (page: number) => {
    if (!familyInfo) return;
    setHealthLoading(true);
    try {
      const res = await getElderHealthRecords(familyInfo.elder_id, {
        page,
        page_size: pageSize,
      });
      const data = res.data as { items: HealthRecord[]; total: number };
      setHealthRecords(data.items || []);
      setHealthTotal(data.total || 0);
    } catch {
      // Error handled by http interceptor
    } finally {
      setHealthLoading(false);
    }
  }, [familyInfo]);

  const fetchAlerts = useCallback(async (page: number) => {
    if (!familyInfo) return;
    setAlertsLoading(true);
    try {
      const res = await getElderAlerts({
        elder_id: familyInfo.elder_id,
        page,
        page_size: pageSize,
      });
      const data = res.data as { items: AlertRecord[]; total: number };
      setAlerts(data.items || []);
      setAlertsTotal(data.total || 0);
    } catch {
      // Error handled by http interceptor
    } finally {
      setAlertsLoading(false);
    }
  }, [familyInfo]);

  // Fetch health records when familyInfo is ready or page changes
  useEffect(() => {
    if (familyInfo) {
      fetchHealthRecords(healthPage);
    }
  }, [familyInfo, healthPage, fetchHealthRecords]);

  // Fetch alerts when familyInfo is ready or page changes
  useEffect(() => {
    if (familyInfo) {
      fetchAlerts(alertsPage);
    }
  }, [familyInfo, alertsPage, fetchAlerts]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  const tabItems = [
    {
      key: 'health',
      label: (
        <span>
          <HeartOutlined style={{ marginRight: 4 }} />
          健康记录
        </span>
      ),
      children: (
        <Spin spinning={healthLoading}>
          {healthRecords.length === 0 && !healthLoading ? (
            <Empty description="暂无健康记录" />
          ) : (
            <Table<HealthRecord>
              columns={healthColumns}
              dataSource={healthRecords}
              rowKey="id"
              pagination={{
                current: healthPage,
                pageSize,
                total: healthTotal,
                onChange: (page) => setHealthPage(page),
                showTotal: (total) => `共 ${total} 条`,
              }}
              scroll={{ x: 800 }}
            />
          )}
        </Spin>
      ),
    },
    {
      key: 'alerts',
      label: (
        <span>
          <AlertOutlined style={{ marginRight: 4 }} />
          风险预警
        </span>
      ),
      children: (
        <Spin spinning={alertsLoading}>
          {alerts.length === 0 && !alertsLoading ? (
            <Empty description="暂无风险预警" />
          ) : (
            <Table<AlertRecord>
              columns={alertColumns}
              dataSource={alerts}
              rowKey="id"
              pagination={{
                current: alertsPage,
                pageSize,
                total: alertsTotal,
                onChange: (page) => setAlertsPage(page),
                showTotal: (total) => `共 ${total} 条`,
              }}
              scroll={{ x: 700 }}
            />
          )}
        </Spin>
      ),
    },
  ];

  return (
    <div>
      {/* Elder info header */}
      {elderInfo && (
        <Card style={{ marginBottom: 24 }}>
          <Descriptions
            title={
              <span>
                <HeartOutlined style={{ marginRight: 8, color: '#ff4d4f' }} />
                {elderInfo.name} 的健康信息
              </span>
            }
            column={{ xs: 1, sm: 3 }}
          >
            <Descriptions.Item label="性别">{elderInfo.gender}</Descriptions.Item>
            <Descriptions.Item label="联系电话">{elderInfo.phone}</Descriptions.Item>
            <Descriptions.Item label="住址">{elderInfo.address}</Descriptions.Item>
          </Descriptions>
          {elderInfo.tags.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <Text strong style={{ marginRight: 8 }}>标签：</Text>
              {elderInfo.tags.map((tag) => (
                <Tag key={tag} color="blue">{tag}</Tag>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Tabbed health data */}
      <Card>
        <Tabs items={tabItems} />
      </Card>
    </div>
  );
};

export default FamilyElderHealthPage;
