import React, { useCallback, useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  Pencil,
  RefreshCw,
  Search,
  ToggleRight,
  ShieldCheck,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Chip,
  Input,
  Select,
  Spinner,
  Tabs,
  confirm,
} from '../../components/ui';
import AppTable, { type AppTableColumn } from '../../components/AppTable';
import AppForm, { type FormFieldConfig } from '../../components/AppForm';
import PermissionGuard from '../../components/PermissionGuard';
import { useTable } from '../../hooks/useTable';
import {
  activateElderAccount,
  createElder,
  deleteElder,
  getElders,
  resetElderPassword,
  updateElder,
  updateElderAccountStatus,
} from '../../api/elders';
import { formatDate, formatGender } from '../../utils/formatter';
import { ACCOUNT_STATUS_OPTIONS, GENDER_OPTIONS, RISK_LEVEL_OPTIONS } from '../../utils/constants';
import { message } from '../../utils/message';
import type { Elder, ElderListQuery } from '../../types/elder';

const formFields: FormFieldConfig[] = [
  { name: 'name', label: '姓名', required: true },
  { name: 'gender', label: '性别', type: 'select', required: true, options: GENDER_OPTIONS },
  { name: 'birth_date', label: '出生日期', type: 'date', required: true },
  { name: 'id_card', label: '身份证号', required: true },
  { name: 'phone', label: '联系电话', required: true },
  { name: 'address', label: '地址', type: 'textarea' },
  { name: 'emergency_contact_name', label: '紧急联系人' },
  { name: 'emergency_contact_phone', label: '紧急联系电话' },
];

const ElderListPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'list' | 'archive'>('list');
  const [archiveKeyword, setArchiveKeyword] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [editingElder, setEditingElder] = useState<Elder | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const fetchFn = useCallback(
    (params: ElderListQuery & { page: number; page_size: number }) => getElders(params),
    [],
  );

  const { data, loading, pagination, handleTableChange, refresh, handleSearch, query, setQuery } =
    useTable<Elder, ElderListQuery>(fetchFn);

  const handleCreate = () => {
    setEditingElder(null);
    setFormVisible(true);
  };

  const handleEdit = (record: Elder) => {
    setEditingElder(record);
    setFormVisible(true);
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: '删除老人档案',
      content: '确定删除该老人档案？此操作不可撤销。',
      intent: 'danger',
      okText: '删除',
    });
    if (!ok) return;
    try {
      await deleteElder(id);
      message.success('删除成功');
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleActivateAccount = async (record: Elder) => {
    const ok = await confirm({
      title: '激活账户',
      content: '确定为该老人激活登录账户？',
      intent: 'info',
    });
    if (!ok) return;
    try {
      const res = await activateElderAccount(record.id);
      message.success(`账户已激活，用户名: ${res.data.username}，密码: ${res.data.password}`);
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '激活失败');
    }
  };

  const handleResetPassword = async (id: number) => {
    const ok = await confirm({
      title: '重置密码',
      content: '确定重置密码？',
      intent: 'warning',
    });
    if (!ok) return;
    try {
      await resetElderPassword(id);
      message.success('密码已重置');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '重置失败');
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    const ok = await confirm({
      title: newStatus === 'active' ? '启用账户' : '禁用账户',
      content: `确定${newStatus === 'active' ? '启用' : '禁用'}该账户？`,
      intent: newStatus === 'active' ? 'info' : 'warning',
    });
    if (!ok) return;
    try {
      await updateElderAccountStatus(id, newStatus);
      message.success(newStatus === 'active' ? '已启用' : '已禁用');
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSubmit = async (values: any) => {
    setSubmitLoading(true);
    try {
      if (editingElder) {
        await updateElder(editingElder.id, values);
        message.success('更新成功');
      } else {
        await createElder(values);
        message.success('创建成功');
      }
      setFormVisible(false);
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitLoading(false);
    }
  };

  const columns = useMemo<AppTableColumn<Elder>[]>(
    () => [
      { title: '姓名', dataIndex: 'name', width: 100 },
      {
        title: '性别',
        dataIndex: 'gender',
        width: 80,
        render: (value: unknown) => formatGender(value as string | undefined | null),
      },
      {
        title: '出生日期',
        dataIndex: 'birth_date',
        width: 120,
        render: (value: unknown) => formatDate(value as string | undefined | null),
      },
      { title: '联系电话', dataIndex: 'phone', width: 130 },
      { title: '地址', dataIndex: 'address', width: 200, ellipsis: true },
      {
        title: '标签',
        dataIndex: 'tags',
        width: 220,
        render: (value: unknown) => {
          const tags = value as string[] | undefined;
          return tags?.length ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {tags.map((tag) => (
                <Chip key={tag} tone="primary" outlined>
                  {tag}
                </Chip>
              ))}
            </div>
          ) : (
            '-'
          );
        },
      },
      {
        title: '账户名',
        dataIndex: 'username',
        width: 130,
        render: (value: unknown) => {
          const val = value as string | undefined;
          return val || <Chip>未激活</Chip>;
        },
      },
      {
        title: '家属数',
        dataIndex: 'family_count',
        width: 80,
        render: (value: unknown) => {
          const val = value as number | undefined;
          return val ?? 0;
        },
      },
      {
        title: 'AI 风险',
        key: 'ai_risk',
        width: 130,
        render: (_: unknown, record: Elder) => {
          const score = record.latest_risk_score;
          if (score === null || score === undefined) {
            return <Chip outlined>未评估</Chip>;
          }
          if (record.latest_high_risk === true) {
            return (
              <Chip tone="error" outlined icon={<AlertTriangle size={12} />}>
                {`高风险 ${score.toFixed(0)}`}
              </Chip>
            );
          }
          if (record.latest_high_risk === false && score >= 70) {
            return (
              <Chip tone="success" outlined>
                {`正常 ${score.toFixed(0)}`}
              </Chip>
            );
          }
          return (
            <Chip tone="warning" outlined>
              {`关注 ${score.toFixed(0)}`}
            </Chip>
          );
        },
      },
      {
        title: '账户状态',
        dataIndex: 'account_status',
        width: 100,
        render: (value: unknown) => {
          const status = value as string;
          return (
            <Chip tone={status === 'active' ? 'success' : 'error'} outlined>
              {status === 'active' ? '正常' : '已禁用'}
            </Chip>
          );
        },
      },
      {
        title: '操作',
        key: 'actions',
        width: 380,
        fixed: 'right' as const,
        render: (_: unknown, record: Elder) => (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Button
              size="sm"
              variant="text"
              startIcon={<Eye size={14} />}
              onClick={() => navigate(`/elders/${record.id}`)}
            >
              查看
            </Button>
            <PermissionGuard permission="elder:update">
              <Button
                size="sm"
                variant="text"
                startIcon={<Pencil size={14} />}
                onClick={() => handleEdit(record)}
              >
                编辑
              </Button>
            </PermissionGuard>
            <PermissionGuard permission="elder:update">
              {!record.username ? (
                <Button
                  size="sm"
                  variant="text"
                  startIcon={<ShieldCheck size={14} />}
                  onClick={() => handleActivateAccount(record)}
                >
                  激活账户
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="text"
                    startIcon={<RefreshCw size={14} />}
                    onClick={() => handleResetPassword(record.id)}
                  >
                    重置密码
                  </Button>
                  <Button
                    size="sm"
                    variant="text"
                    startIcon={<ToggleRight size={14} />}
                    onClick={() => handleToggleStatus(record.id, record.account_status)}
                  >
                    {record.account_status === 'active' ? '禁用' : '启用'}
                  </Button>
                </>
              )}
            </PermissionGuard>
            <PermissionGuard permission="elder:delete">
              <Button
                size="sm"
                variant="text"
                danger
                startIcon={<Trash2 size={14} />}
                onClick={() => handleDelete(record.id)}
              >
                删除
              </Button>
            </PermissionGuard>
          </div>
        ),
      },
    ],
    [navigate],
  );

  const handleArchiveSearch = useCallback(() => {
    setQuery((prev) => ({ ...prev, keyword: archiveKeyword.trim() } as ElderListQuery));
  }, [archiveKeyword, setQuery]);

  const archiveCards = useMemo(
    () =>
      data.map((elder) => (
        <div
          key={elder.id}
          style={{ flex: '1 1 240px', minWidth: 240, maxWidth: 320 }}
        >
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

  const filterBar = (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <div style={{ minWidth: 120 }}>
        <Select
          label="性别"
          value={query.gender || ''}
          onChange={(v) =>
            setQuery((prev) => ({ ...prev, gender: v ? String(v) : undefined }))
          }
          options={[{ label: '全部', value: '' }, ...GENDER_OPTIONS]}
        />
      </div>
      <div style={{ minWidth: 140 }}>
        <Select
          label="风险等级"
          value={query.risk_level || ''}
          onChange={(v) =>
            setQuery((prev) => ({ ...prev, risk_level: v ? String(v) : undefined }))
          }
          options={[{ label: '全部', value: '' }, ...RISK_LEVEL_OPTIONS]}
        />
      </div>
      <div style={{ minWidth: 140 }}>
        <Select
          label="账户状态"
          value={query.account_status || ''}
          onChange={(v) =>
            setQuery((prev) => ({ ...prev, account_status: v ? String(v) : undefined }))
          }
          options={[{ label: '全部', value: '' }, ...ACCOUNT_STATUS_OPTIONS]}
        />
      </div>
      <PermissionGuard permission="elder:create">
        <Button startIcon={<Plus size={14} />} onClick={handleCreate}>
          新增老人
        </Button>
      </PermissionGuard>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as 'list' | 'archive')}
          items={[
            { key: 'list', label: '列表管理' },
            { key: 'archive', label: '健康档案' },
          ]}
        />
      </div>

      {activeTab === 'list' ? (
        <>
          <AppTable<Elder>
            columns={columns}
            dataSource={data}
            loading={loading}
            pagination={pagination}
            onChange={handleTableChange}
            onSearch={handleSearch}
            searchPlaceholder="搜索姓名/手机号/身份证"
            toolbar={filterBar}
          />

          <AppForm
            title={editingElder ? '编辑老人信息' : '新增老人'}
            visible={formVisible}
            fields={formFields}
            initialValues={editingElder || undefined}
            onSubmit={handleSubmit}
            onCancel={() => setFormVisible(false)}
            confirmLoading={submitLoading}
            width={600}
          />
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>老人健康档案</h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--smc-text-2)' }}>
                查看并进入单个老人的健康档案详情
              </p>
            </div>

            <div style={{ width: 340, maxWidth: '100%' }}>
              <Input
                value={archiveKeyword}
                onChange={(event) => setArchiveKeyword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleArchiveSearch();
                }}
                placeholder="搜索姓名/手机号/身份证"
                endAdornment={<Search size={14} />}
              />
            </div>
          </div>

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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>{archiveCards}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default ElderListPage;
