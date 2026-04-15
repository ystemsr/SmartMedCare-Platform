import React, { useEffect, useState } from 'react';
import { Card, Spin, Tag, Button, Descriptions, Typography } from 'antd';
import { HeartOutlined, PhoneOutlined, HomeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getFamilySelf, getFamilyElder } from '../../api/family';
import type { FamilyMemberInfo, FamilyElderInfo } from '../../types/family';

const { Title, Text } = Typography;

const FamilyHomePage: React.FC = () => {
  const navigate = useNavigate();
  const [familyInfo, setFamilyInfo] = useState<FamilyMemberInfo | null>(null);
  const [elderInfo, setElderInfo] = useState<FamilyElderInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [selfRes, elderRes] = await Promise.all([
          getFamilySelf(),
          getFamilyElder(),
        ]);
        setFamilyInfo(selfRes.data as FamilyMemberInfo);
        setElderInfo(elderRes.data as FamilyElderInfo);
      } catch {
        // Error is handled by the http interceptor
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Welcome card */}
      <Card style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          您好，{familyInfo?.real_name}
        </Title>
        <Text type="secondary" style={{ marginTop: 4, display: 'block' }}>
          关系：{familyInfo?.relationship} | 关联老人：{familyInfo?.elder_name}
        </Text>
      </Card>

      {/* Elder info card */}
      {elderInfo && (
        <Card
          title={
            <span>
              <HeartOutlined style={{ marginRight: 8, color: '#ff4d4f' }} />
              老人基本信息
            </span>
          }
          style={{ marginBottom: 24 }}
        >
          <Descriptions column={{ xs: 1, sm: 2 }} labelStyle={{ fontWeight: 500 }}>
            <Descriptions.Item label="姓名">{elderInfo.name}</Descriptions.Item>
            <Descriptions.Item label="性别">{elderInfo.gender}</Descriptions.Item>
            {elderInfo.birth_date && (
              <Descriptions.Item label="出生日期">{elderInfo.birth_date}</Descriptions.Item>
            )}
            <Descriptions.Item label="联系电话">
              <PhoneOutlined style={{ marginRight: 4 }} />
              {elderInfo.phone}
            </Descriptions.Item>
            <Descriptions.Item label="住址" span={2}>
              <HomeOutlined style={{ marginRight: 4 }} />
              {elderInfo.address}
            </Descriptions.Item>
            <Descriptions.Item label="紧急联系人">
              {elderInfo.emergency_contact_name}
            </Descriptions.Item>
            <Descriptions.Item label="紧急联系电话">
              {elderInfo.emergency_contact_phone}
            </Descriptions.Item>
          </Descriptions>

          {elderInfo.tags.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Text strong style={{ marginRight: 8 }}>标签：</Text>
              {elderInfo.tags.map((tag) => (
                <Tag key={tag} color="blue">{tag}</Tag>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Quick links */}
      <Card>
        <Button
          type="primary"
          icon={<HeartOutlined />}
          size="large"
          onClick={() => navigate('/family/elder')}
        >
          查看老人健康记录
        </Button>
      </Card>
    </div>
  );
};

export default FamilyHomePage;
