import React, { useCallback, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  type SelectChangeEvent,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ToggleOnRoundedIcon from '@mui/icons-material/ToggleOnRounded';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useNavigate } from 'react-router-dom';
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

interface ConfirmState {
  title: string;
  content: string;
  onConfirm: () => Promise<void> | void;
}

const ElderListPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [archiveKeyword, setArchiveKeyword] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [editingElder, setEditingElder] = useState<Elder | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

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

  const openConfirm = useCallback((title: string, content: string, onConfirm: () => Promise<void> | void) => {
    setConfirmState({ title, content, onConfirm });
  }, []);

  const closeConfirm = () => setConfirmState(null);

  const handleDelete = async (id: number) => {
    try {
      await deleteElder(id);
      message.success('删除成功');
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleActivateAccount = async (record: Elder) => {
    try {
      const res = await activateElderAccount(record.id);
      message.success(`账户已激活，用户名: ${res.data.username}，密码: ${res.data.password}`);
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '激活失败');
    }
  };

  const handleResetPassword = async (id: number) => {
    try {
      await resetElderPassword(id);
      message.success('密码已重置');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '重置失败');
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
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
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {tags.map((tag) => (
                <Chip key={tag} label={tag} color="primary" variant="outlined" size="small" />
              ))}
            </Stack>
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
          return val || <Chip label="未激活" size="small" />;
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
            return <Chip label="未评估" size="small" variant="outlined" />;
          }
          if (record.latest_high_risk === true) {
            return (
              <Chip
                icon={<WarningAmberIcon />}
                label={`高风险 ${score.toFixed(0)}`}
                color="error"
                size="small"
                variant="outlined"
              />
            );
          }
          if (record.latest_high_risk === false && score >= 70) {
            return (
              <Chip
                label={`正常 ${score.toFixed(0)}`}
                color="success"
                size="small"
                variant="outlined"
              />
            );
          }
          return (
            <Chip
              label={`关注 ${score.toFixed(0)}`}
              color="warning"
              size="small"
              variant="outlined"
            />
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
            <Chip
              label={status === 'active' ? '正常' : '已禁用'}
              color={status === 'active' ? 'success' : 'error'}
              size="small"
              variant="outlined"
            />
          );
        },
      },
      {
        title: '操作',
        key: 'actions',
        width: 380,
        fixed: 'right' as const,
        render: (_: unknown, record: Elder) => (
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Button
              size="small"
              variant="text"
              startIcon={<VisibilityRoundedIcon />}
              onClick={() => navigate(`/elders/${record.id}`)}
            >
              查看
            </Button>
            <PermissionGuard permission="elder:update">
              <Button
                size="small"
                variant="text"
                startIcon={<EditRoundedIcon />}
                onClick={() => handleEdit(record)}
              >
                编辑
              </Button>
            </PermissionGuard>
            <PermissionGuard permission="elder:update">
              {!record.username ? (
                <Button
                  size="small"
                  variant="text"
                  color="info"
                  startIcon={<VerifiedUserRoundedIcon />}
                  onClick={() =>
                    openConfirm('激活账户', '确定为该老人激活登录账户？', () =>
                      handleActivateAccount(record),
                    )
                  }
                >
                  激活账户
                </Button>
              ) : (
                <>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<LockResetRoundedIcon />}
                    onClick={() =>
                      openConfirm('重置密码', '确定重置密码？', () => handleResetPassword(record.id))
                    }
                  >
                    重置密码
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    color={record.account_status === 'active' ? 'warning' : 'success'}
                    startIcon={<ToggleOnRoundedIcon />}
                    onClick={() =>
                      openConfirm(
                        record.account_status === 'active' ? '禁用账户' : '启用账户',
                        `确定${record.account_status === 'active' ? '禁用' : '启用'}该账户？`,
                        () => handleToggleStatus(record.id, record.account_status),
                      )
                    }
                  >
                    {record.account_status === 'active' ? '禁用' : '启用'}
                  </Button>
                </>
              )}
            </PermissionGuard>
            <PermissionGuard permission="elder:delete">
              <Button
                size="small"
                variant="text"
                color="error"
                startIcon={<DeleteRoundedIcon />}
                onClick={() =>
                  openConfirm('删除老人档案', '确定删除该老人档案？', () => handleDelete(record.id))
                }
              >
                删除
              </Button>
            </PermissionGuard>
          </Stack>
        ),
      },
    ],
    [navigate, openConfirm],
  );

  const handleArchiveSearch = useCallback(() => {
    setQuery((prev) => ({ ...prev, keyword: archiveKeyword.trim() } as ElderListQuery));
  }, [archiveKeyword, setQuery]);

  const archiveCards = useMemo(
    () =>
      data.map((elder) => (
        <Box key={elder.id} sx={{ width: { xs: '100%', sm: '50%', md: '33.333%', lg: '25%' } }}>
          <Card
            variant="outlined"
            sx={{ height: '100%', borderRadius: 4, overflow: 'hidden' }}
          >
            <CardActionArea
              onClick={() => navigate(`/elders/${elder.id}/archive`)}
              sx={{ height: '100%', alignItems: 'stretch' }}
            >
              <Box sx={{ p: 2.5, height: '100%' }}>
                <Stack spacing={1.5} sx={{ height: '100%' }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                      {elder.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatGender(elder.gender)} · {elder.phone || '-'}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                      标签
                    </Typography>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      {elder.tags?.length ? (
                        elder.tags.map((tag) => (
                          <Chip key={tag} label={tag} color="primary" variant="outlined" size="small" />
                        ))
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          暂无标签
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    点击查看健康档案
                  </Typography>
                </Stack>
              </Box>
            </CardActionArea>
          </Card>
        </Box>
      )),
    [data, navigate],
  );

  const filterBar = (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} useFlexGap flexWrap="wrap">
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>性别</InputLabel>
        <Select
          label="性别"
          value={query.gender || ''}
          onChange={(event: SelectChangeEvent) =>
            setQuery((prev) => ({ ...prev, gender: event.target.value || undefined }))
          }
        >
          <MenuItem value="">全部</MenuItem>
          {GENDER_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel>风险等级</InputLabel>
        <Select
          label="风险等级"
          value={query.risk_level || ''}
          onChange={(event: SelectChangeEvent) =>
            setQuery((prev) => ({ ...prev, risk_level: event.target.value || undefined }))
          }
        >
          <MenuItem value="">全部</MenuItem>
          {RISK_LEVEL_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel>账户状态</InputLabel>
        <Select
          label="账户状态"
          value={query.account_status || ''}
          onChange={(event: SelectChangeEvent) =>
            setQuery((prev) => ({ ...prev, account_status: event.target.value || undefined }))
          }
        >
          <MenuItem value="">全部</MenuItem>
          {ACCOUNT_STATUS_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <PermissionGuard permission="elder:create">
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={handleCreate}>
          新增老人
        </Button>
      </PermissionGuard>
    </Stack>
  );

  return (
    <Box>
      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
        <Tab label="列表管理" />
        <Tab label="健康档案" />
      </Tabs>

      {activeTab === 0 ? (
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

          <Dialog open={Boolean(confirmState)} onClose={closeConfirm}>
            <DialogTitle>{confirmState?.title}</DialogTitle>
            <DialogContent>
              <DialogContentText>{confirmState?.content}</DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={closeConfirm} color="inherit">
                取消
              </Button>
              <Button
                onClick={async () => {
                  const action = confirmState?.onConfirm;
                  closeConfirm();
                  await action?.();
                }}
                color="error"
                variant="contained"
              >
                确认
              </Button>
            </DialogActions>
          </Dialog>
        </>
      ) : (
        <Stack spacing={2.5}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', sm: 'center' }}
            spacing={2}
          >
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                老人健康档案
              </Typography>
              <Typography variant="body2" color="text.secondary">
                查看并进入单个老人的健康档案详情
              </Typography>
            </Box>

            <TextField
              value={archiveKeyword}
              onChange={(event) => setArchiveKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleArchiveSearch();
                }
              }}
              placeholder="搜索姓名/手机号/身份证"
              size="small"
              sx={{ width: { xs: '100%', sm: 340 } }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Stack>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
              <CircularProgress size={36} />
            </Box>
          ) : data.length === 0 ? (
            <Card variant="outlined" sx={{ p: 4 }}>
              <Typography variant="body2" color="text.secondary" align="center">
                暂无老人档案
              </Typography>
            </Card>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {archiveCards}
            </Box>
          )}
        </Stack>
      )}
    </Box>
  );
};

export default ElderListPage;
