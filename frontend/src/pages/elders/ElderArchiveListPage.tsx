import React, { useCallback } from 'react';
import { Card, Row, Col, Tag, Input, Spin, Empty } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTable } from '../../hooks/useTable';
import { getElders } from '../../api/elders';
import { formatGender } from '../../utils/formatter';
import type { Elder, ElderListQuery } from '../../types/elder';

const { Search } = Input;

const ElderArchiveListPage: React.FC = () => {
  const navigate = useNavigate();

  const fetchFn = useCallback(
    (params: ElderListQuery & { page: number; page_size: number }) => getElders(params),
    [],
  );

  const { data, loading, handleSearch } = useTable<Elder, ElderListQuery>(fetchFn);

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>老人健康档案</h2>
        <Search
          placeholder="搜索姓名/手机号/身份证"
          allowClear
          onSearch={handleSearch}
          style={{ width: 300 }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 100 }}>
          <Spin size="large" />
        </div>
      ) : data.length === 0 ? (
        <Empty description="暂无老人档案" />
      ) : (
        <Row gutter={[16, 16]}>
          {data.map((elder) => (
            <Col key={elder.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
                onClick={() => navigate(`/elders/${elder.id}/archive`)}
                style={{ borderRadius: 8 }}
              >
                <Card.Meta
                  title={elder.name}
                  description={
                    <div>
                      <div style={{ marginBottom: 4 }}>{formatGender(elder.gender)} | {elder.phone || '-'}</div>
                      <div>
                        {elder.tags?.map((tag) => (
                          <Tag key={tag} color="blue" style={{ marginBottom: 4 }}>{tag}</Tag>
                        ))}
                      </div>
                    </div>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
};

export default ElderArchiveListPage;
