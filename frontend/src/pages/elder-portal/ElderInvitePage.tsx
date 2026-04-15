import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Button,
  Typography,
  Table,
  Space,
  Spin,
  Alert,
  Empty,
  Modal,
  message,
  Tag,
} from 'antd';
import {
  CopyOutlined,
  PlusOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useAuthStore } from '../../store/auth';
import {
  getInviteCode,
  generateInviteCode,
  revokeInviteCode,
  getElderFamily,
} from '../../api/elderPortal';

const { Title, Text, Paragraph } = Typography;

interface InviteCode {
  code: string;
  expires_at: string;
  used_count: number;
  max_uses: number;
}

interface FamilyMember {
  id: number;
  real_name: string;
  relationship: string;
  created_at: string;
}

const MAX_FAMILY_MEMBERS = 3;

const ElderInvitePage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const elderId = user?.elder_id;

  const [inviteCode, setInviteCode] = useState<InviteCode | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [codeLoading, setCodeLoading] = useState(true);
  const [familyLoading, setFamilyLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInviteCode = useCallback(async () => {
    if (!elderId) return;
    setCodeLoading(true);
    try {
      const res = await getInviteCode(elderId);
      setInviteCode(res.data || null);
    } catch {
      setInviteCode(null);
    } finally {
      setCodeLoading(false);
    }
  }, [elderId]);

  const fetchFamily = useCallback(async () => {
    setFamilyLoading(true);
    try {
      const res = await getElderFamily();
      setFamilyMembers(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取家属列表失败');
    } finally {
      setFamilyLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInviteCode();
    fetchFamily();
  }, [fetchInviteCode, fetchFamily]);

  const handleGenerate = async () => {
    if (!elderId) return;
    setActionLoading(true);
    try {
      await generateInviteCode(elderId);
      message.success('邀请码已生成');
      await fetchInviteCode();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '生成邀请码失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevoke = () => {
    if (!elderId) return;
    Modal.confirm({
      title: '确认撤销',
      icon: <ExclamationCircleOutlined />,
      content: '撤销后，当前邀请码将立即失效，已绑定的家属不受影响。',
      okText: '确认撤销',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        setActionLoading(true);
        try {
          await revokeInviteCode(elderId);
          message.success('邀请码已撤销');
          setInviteCode(null);
        } catch (err) {
          message.error(err instanceof Error ? err.message : '撤销邀请码失败');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleCopyLink = () => {
    if (!inviteCode) return;
    const link = `${window.location.origin}/register/family?code=${inviteCode.code}`;
    navigator.clipboard.writeText(link).then(() => {
      message.success('邀请链接已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败，请手动复制');
    });
  };

  const familyColumns: ColumnsType<FamilyMember> = [
    {
      title: '姓名',
      dataIndex: 'real_name',
      key: 'real_name',
    },
    {
      title: '关系',
      dataIndex: 'relationship',
      key: 'relationship',
    },
    {
      title: '绑定时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
    },
  ];

  if (!elderId) {
    return <Alert type="warning" message="账户异常" description="未找到关联的老人信息，请联系管理员。" showIcon />;
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Title level={4} style={{ marginTop: 0 }}>邀请家属</Title>
        <Paragraph type="secondary">
          生成邀请码分享给家属，家属可通过邀请码注册并绑定账号。每位老人最多绑定 {MAX_FAMILY_MEMBERS} 位家属。
        </Paragraph>

        {codeLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin />
          </div>
        ) : inviteCode ? (
          <Card
            type="inner"
            style={{ marginBottom: 16, background: '#fafafa' }}
          >
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Text type="secondary">当前邀请码</Text>
                <div style={{ marginTop: 8 }}>
                  <Text
                    copyable
                    style={{ fontSize: 28, fontWeight: 700, letterSpacing: 2 }}
                  >
                    {inviteCode.code}
                  </Text>
                </div>
              </div>
              <Space split={<span style={{ color: '#d9d9d9' }}>|</span>}>
                <Text type="secondary">
                  过期时间：{inviteCode.expires_at}
                </Text>
                <Tag color={inviteCode.used_count >= inviteCode.max_uses ? 'red' : 'blue'}>
                  已使用 {inviteCode.used_count}/{inviteCode.max_uses}
                </Tag>
              </Space>
              <Space>
                <Button
                  icon={<CopyOutlined />}
                  onClick={handleCopyLink}
                >
                  复制邀请链接
                </Button>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  loading={actionLoading}
                  onClick={handleRevoke}
                >
                  撤销邀请码
                </Button>
              </Space>
            </Space>
          </Card>
        ) : (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Empty description="暂无有效邀请码" style={{ marginBottom: 16 }} />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              loading={actionLoading}
              onClick={handleGenerate}
            >
              生成邀请码
            </Button>
          </div>
        )}
      </Card>

      <Card title="已绑定家属">
        <Table<FamilyMember>
          columns={familyColumns}
          dataSource={familyMembers}
          loading={familyLoading}
          rowKey="id"
          pagination={false}
          locale={{ emptyText: '暂无绑定家属' }}
          scroll={{ x: 'max-content' }}
        />
        {error && (
          <Alert type="error" message={error} style={{ marginTop: 16 }} showIcon />
        )}
      </Card>
    </div>
  );
};

export default ElderInvitePage;
