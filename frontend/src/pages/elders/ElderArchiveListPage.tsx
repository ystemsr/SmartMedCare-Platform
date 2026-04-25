import React, { useCallback, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, Chip, Input, Spinner } from '../../components/ui';
import { useTable } from '../../hooks/useTable';
import { getElders } from '../../api/elders';
import { formatGender } from '../../utils/formatter';
import type { Elder, ElderListQuery } from '../../types/elder';
import { RefPageHead } from '../../components/ref';

const ElderArchiveListPage: React.FC = () => {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');

  const fetchFn = useCallback(
    (params: ElderListQuery & { page: number; page_size: number }) => getElders(params),
    [],
  );

  const { data, loading, setQuery } = useTable<Elder, ElderListQuery>(fetchFn);

  const handleSearch = useCallback(() => {
    setQuery((prev) => ({ ...prev, keyword: keyword.trim() } as ElderListQuery));
  }, [keyword, setQuery]);

  const items = useMemo(
    () =>
      data.map((elder) => (
        <div key={elder.id} style={{ flex: '1 1 240px', minWidth: 240, maxWidth: 320 }}>
          <Card
            hoverable
            style={{ height: '100%', cursor: 'pointer' }}
            onClick={() => navigate(`/elders/${elder.id}/archive`)}
          >
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{elder.name}</div>
              <div style={{ fontSize: 13, color: 'var(--smc-text-2)', marginBottom: 12 }}>
                {formatGender(elder.gender)} · {elder.phone || '-'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--smc-text-2)', marginBottom: 6 }}>标签</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {elder.tags?.length ? (
                  elder.tags.map((tag) => (
                    <Chip key={tag} tone="primary" outlined>
                      {tag}
                    </Chip>
                  ))
                ) : (
                  <span style={{ fontSize: 13, color: 'var(--smc-text-3)' }}>暂无标签</span>
                )}
              </div>
              <div style={{ fontSize: 13, color: 'var(--smc-text-2)' }}>点击查看健康档案</div>
            </div>
          </Card>
        </div>
      )),
    [data, navigate],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <RefPageHead
        title="老人健康档案"
        subtitle={`共 ${data.length} 位老人 · 查看并进入单个老人的健康档案详情`}
        actions={
          <div style={{ width: 320, maxWidth: '100%' }}>
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSearch();
              }}
              placeholder="搜索姓名/手机号/身份证"
              endAdornment={<Search size={14} />}
            />
          </div>
        }
      />

      {loading ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 320,
          }}
        >
          <Spinner />
        </div>
      ) : data.length === 0 ? (
        <Card>
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--smc-text-2)' }}>
            暂无老人档案
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>{items}</div>
      )}
    </div>
  );
};

export default ElderArchiveListPage;
