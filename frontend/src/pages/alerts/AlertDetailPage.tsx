import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Space, Steps, Spin, Popconfirm, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { getAlertDetail, updateAlertStatus } from '../../api/alerts';
import { formatDateTime, formatRiskLevel, formatAlertStatus } from '../../utils/formatter';
import { RISK_LEVEL_COLORS, ALERT_STATUS_COLORS } from '../../utils/constants';
import type { Alert } from '../../types/alert';

const statusSteps = ['pending', 'processing', 'resolved'];

const AlertDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const alertId = Number(id);

  const [alert, setAlert] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAlert = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAlertDetail(alertId);
      setAlert(res.data);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [alertId]);

  useEffect(() => {
    fetchAlert();
  }, [fetchAlert]);

  const handleStatusUpdate = async (status: string) => {
    try {
      await updateAlertStatus(alertId, { status: status as Alert['status'] });
      message.success('状态更新成功');
      fetchAlert();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const currentStep = alert?.status === 'ignored'
    ? -1
    : statusSteps.indexOf(alert?.status || 'pending');

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/alerts')}
        style={{ marginBottom: 16 }}
      >
        返回列表
      </Button>

      <Card title="预警详情" style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2 }} bordered>
          <Descriptions.Item label="预警标题">{alert?.title}</Descriptions.Item>
          <Descriptions.Item label="预警类型">{alert?.type}</Descriptions.Item>
          <Descriptions.Item label="风险等级">
            <Tag color={RISK_LEVEL_COLORS[alert?.risk_level || '']}>
              {formatRiskLevel(alert?.risk_level)}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={ALERT_STATUS_COLORS[alert?.status || '']}>
              {formatAlertStatus(alert?.status)}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="来源">{alert?.source || '-'}</Descriptions.Item>
          <Descriptions.Item label="老人ID">{alert?.elder_id}</Descriptions.Item>
          <Descriptions.Item label="触发时间" span={2}>
            {formatDateTime(alert?.triggered_at)}
          </Descriptions.Item>
          <Descriptions.Item label="描述" span={2}>
            {alert?.description}
          </Descriptions.Item>
          {alert?.remark && (
            <Descriptions.Item label="备注" span={2}>
              {alert.remark}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <Card title="处理进度" style={{ marginBottom: 16 }}>
        <Steps
          current={currentStep}
          status={alert?.status === 'ignored' ? 'error' : undefined}
          items={[
            { title: '待处理', description: formatDateTime(alert?.triggered_at) },
            { title: '处理中' },
            { title: '已解决', description: alert?.resolved_at ? formatDateTime(alert.resolved_at) : undefined },
          ]}
        />
      </Card>

      <Card>
        <Space>
          {alert?.status === 'pending' && (
            <Popconfirm title="确认开始处理？" onConfirm={() => handleStatusUpdate('processing')}>
              <Button type="primary">开始处理</Button>
            </Popconfirm>
          )}
          {alert?.status === 'processing' && (
            <Popconfirm title="确认已解决？" onConfirm={() => handleStatusUpdate('resolved')}>
              <Button type="primary">标记解决</Button>
            </Popconfirm>
          )}
          {(alert?.status === 'pending' || alert?.status === 'processing') && (
            <Popconfirm title="确认忽略此预警？" onConfirm={() => handleStatusUpdate('ignored')}>
              <Button danger>忽略</Button>
            </Popconfirm>
          )}
          <Button onClick={() => navigate(`/elders/${alert?.elder_id}`)}>
            查看老人信息
          </Button>
        </Space>
      </Card>
    </div>
  );
};

export default AlertDetailPage;
