import React, { useCallback, useMemo, useState } from 'react';
import {
  Plus,
  Search,
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
import CredentialsModal from '../../components/CredentialsModal';
import ElderDetailDrawer from '../../components/ElderDetailDrawer';
import InlineDoctorSwitcher from '../../components/InlineDoctorSwitcher';
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
import { ACCOUNT_STATUS_OPTIONS, AI_RISK_OPTIONS, GENDER_OPTIONS } from '../../utils/constants';
import { useAuthStore } from '../../store/auth';
import { message } from '../../utils/message';
import type { Elder, ElderListQuery } from '../../types/elder';

const BASE_FORM_FIELDS: FormFieldConfig[] = [
  { name: 'name', label: '姓名', required: true },
  { name: 'gender', label: '性别', type: 'select', required: true, options: GENDER_OPTIONS },
  { name: 'birth_date', label: '出生日期', type: 'date', required: true },
  { name: 'id_card', label: '身份证号', required: true },
  { name: 'phone', label: '联系电话', required: true },
  { name: 'address', label: '地址', type: 'textarea' },
  { name: 'emergency_contact_name', label: '紧急联系人' },
  { name: 'emergency_contact_phone', label: '紧急联系电话' },
];

const DOCTOR_FIELD: FormFieldConfig = {
  name: 'primary_doctor_id',
  label: '负责医生',
  type: 'doctor-combo',
  labelField: 'primary_doctor_name',
  placeholder: '输入医生姓名 / 账号 / 手机号',
};

const TAGS_FIELD: FormFieldConfig = {
  name: 'tags',
  label: '标签',
  type: 'tags',
  placeholder: '输入标签后按回车',
};

interface CredentialsState {
  title: string;
  description?: string;
  username?: string;
  password: string;
}

const ElderListPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'list' | 'archive'>('list');
  const [archiveKeyword, setArchiveKeyword] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [editingElder, setEditingElder] = useState<Elder | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [credentials, setCredentials] = useState<CredentialsState | null>(null);
  const [detailElder, setDetailElder] = useState<Elder | null>(null);
  const userRoles = useAuthStore((state) => state.user?.roles ?? []);
  const isAdmin = userRoles.includes('admin');

  // Admins can assign/switch the primary doctor freely, in both create and
  // edit flows. Non-admin doctors never see the picker: on create the backend
  // auto-assigns them; on edit they can't reassign their own elders anyway.
  const formFields = useMemo<FormFieldConfig[]>(() => {
    const fields = [...BASE_FORM_FIELDS];
    if (isAdmin) {
      fields.push(DOCTOR_FIELD);
    }
    fields.push(TAGS_FIELD);
    return fields;
  }, [isAdmin]);

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
    setDetailElder(null);
    setEditingElder(record);
    setFormVisible(true);
  };

  const handleDelete = async (record: Elder) => {
    const ok = await confirm({
      title: '删除老人档案',
      content: `确定删除 ${record.name} 的档案？此操作不可撤销。`,
      intent: 'danger',
      okText: '删除',
    });
    if (!ok) return;
    try {
      await deleteElder(record.id);
      message.success('删除成功');
      setDetailElder(null);
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleActivateAccount = async (record: Elder) => {
    const ok = await confirm({
      title: '激活账户',
      content: `确定为 ${record.name} 激活登录账户？`,
      intent: 'info',
    });
    if (!ok) return;
    try {
      const res = await activateElderAccount(record.id);
      setDetailElder(null);
      setCredentials({
        title: '账户已激活',
        description: `已为 ${record.name} 开通登录账户，请将以下凭据交付给本人。`,
        username: res.data.username,
        password: res.data.password,
      });
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '激活失败');
    }
  };

  const handleResetPassword = async (record: Elder) => {
    const ok = await confirm({
      title: '重置密码',
      content: `确定为 ${record.name} 重置登录密码？`,
      intent: 'warning',
    });
    if (!ok) return;
    try {
      const res = await resetElderPassword(record.id);
      setDetailElder(null);
      setCredentials({
        title: '密码已重置',
        description: `已为 ${record.name} 生成新密码，请交付给本人。`,
        password: res.data.new_password,
      });
    } catch (err) {
      message.error(err instanceof Error ? err.message : '重置失败');
    }
  };

  const handleToggleStatus = async (record: Elder) => {
    const newStatus = record.account_status === 'active' ? 'disabled' : 'active';
    const ok = await confirm({
      title: newStatus === 'active' ? '启用账户' : '禁用账户',
      content: `确定${newStatus === 'active' ? '启用' : '禁用'} ${record.name} 的账户？`,
      intent: newStatus === 'active' ? 'info' : 'warning',
    });
    if (!ok) return;
    try {
      await updateElderAccountStatus(record.id, newStatus);
      message.success(newStatus === 'active' ? '已启用' : '已禁用');
      setDetailElder((prev) =>
        prev && prev.id === record.id ? { ...prev, account_status: newStatus } : prev,
      );
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleOpenFullArchive = (record: Elder) => {
    setDetailElder(null);
    navigate(`/elders/${record.id}`);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSubmit = async (values: any) => {
    setSubmitLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = {
        ...values,
        tags: Array.isArray(values.tags) ? values.tags : [],
      };
      // Only admins are allowed to pick/change the primary doctor. Non-admin
      // doctors get auto-assigned on create and can't reassign on edit, so
      // strip the field entirely for them.
      if (isAdmin) {
        payload.primary_doctor_id =
          values.primary_doctor_id === '' || values.primary_doctor_id === undefined
            ? null
            : values.primary_doctor_id;
      } else {
        delete payload.primary_doctor_id;
      }
      if (editingElder) {
        await updateElder(editingElder.id, payload);
        message.success('更新成功');
      } else {
        await createElder(payload);
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
        title: '负责医生',
        key: 'primary_doctor',
        width: 160,
        render: (_: unknown, record: Elder) => {
          if (!isAdmin) {
            return record.primary_doctor_name ? (
              record.primary_doctor_name
            ) : (
              <Chip outlined>未指派</Chip>
            );
          }
          return (
            <InlineDoctorSwitcher
              currentDoctorId={record.primary_doctor_id ?? null}
              currentDoctorName={record.primary_doctor_name ?? null}
              onSelect={async (doctorId) => {
                try {
                  await updateElder(record.id, { primary_doctor_id: doctorId });
                  message.success(
                    doctorId === null ? '已清除指派' : '已切换负责医生',
                  );
                  refresh();
                } catch (err) {
                  message.error(err instanceof Error ? err.message : '操作失败');
                  throw err;
                }
              }}
            />
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
        width: 110,
        fixed: 'right' as const,
        render: (_: unknown, record: Elder) => (
          <Button
            size="sm"
            variant="text"
            startIcon={<Eye size={14} />}
            onClick={() => setDetailElder(record)}
          >
            查看
          </Button>
        ),
      },
    ],
    [isAdmin, refresh],
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
          label="AI 风险"
          value={query.risk_level || ''}
          onChange={(v) =>
            setQuery((prev) => ({ ...prev, risk_level: v ? String(v) : undefined }))
          }
          options={[{ label: '全部', value: '' }, ...AI_RISK_OPTIONS]}
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
      <CredentialsModal
        open={credentials !== null}
        onClose={() => setCredentials(null)}
        title={credentials?.title ?? ''}
        description={credentials?.description}
        username={credentials?.username}
        password={credentials?.password ?? ''}
      />
      <ElderDetailDrawer
        open={detailElder !== null}
        elder={detailElder}
        onClose={() => setDetailElder(null)}
        onEdit={handleEdit}
        onActivate={handleActivateAccount}
        onResetPassword={handleResetPassword}
        onToggleStatus={handleToggleStatus}
        onDelete={handleDelete}
        onOpenFullArchive={handleOpenFullArchive}
      />
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
