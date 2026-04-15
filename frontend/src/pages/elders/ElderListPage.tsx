import React, { useState, useCallback } from 'react';
import { Button, Tag, Space, Popconfirm, Select, message } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import AppTable from '../../components/AppTable';
import AppForm, { type FormFieldConfig } from '../../components/AppForm';
import PermissionGuard from '../../components/PermissionGuard';
import { useTable } from '../../hooks/useTable';
import { getElders, createElder, updateElder, deleteElder } from '../../api/elders';
import { formatGender, formatDate } from '../../utils/formatter';
import { GENDER_OPTIONS, RISK_LEVEL_OPTIONS, ACCOUNT_STATUS_OPTIONS } from '../../utils/constants';
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
    try {
      await deleteElder(id);
      message.success('删除成功');
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
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

  const columns: ColumnsType<Elder> = [
    { title: '姓名', dataIndex: 'name', width: 100 },
    { title: '性别', dataIndex: 'gender', width: 80, render: formatGender },
    { title: '出生日期', dataIndex: 'birth_date', width: 120, render: formatDate },
    { title: '联系电话', dataIndex: 'phone', width: 130 },
    { title: '地址', dataIndex: 'address', width: 200, ellipsis: true },
    {
      title: '标签',
      dataIndex: 'tags',
      width: 200,
      render: (tags: string[]) =>
        tags?.map((tag) => <Tag key={tag} color="blue">{tag}</Tag>),
    },
    {
      title: '账户状态',
      dataIndex: 'account_status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? '正常' : '已禁用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/elders/${record.id}`)}
          >
            查看
          </Button>
          <PermissionGuard permission="elder:update">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
          </PermissionGuard>
          <PermissionGuard permission="elder:delete">
            <Popconfirm title="确定删除该老人档案？" onConfirm={() => handleDelete(record.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </PermissionGuard>
        </Space>
      ),
    },
  ];

  const filterBar = (
    <Space wrap>
      <Select
        placeholder="性别"
        allowClear
        options={GENDER_OPTIONS}
        style={{ width: 100 }}
        value={query.gender || undefined}
        onChange={(val) => setQuery((prev) => ({ ...prev, gender: val }))}
      />
      <Select
        placeholder="风险等级"
        allowClear
        options={RISK_LEVEL_OPTIONS}
        style={{ width: 120 }}
        value={query.risk_level || undefined}
        onChange={(val) => setQuery((prev) => ({ ...prev, risk_level: val }))}
      />
      <Select
        placeholder="账户状态"
        allowClear
        options={ACCOUNT_STATUS_OPTIONS}
        style={{ width: 120 }}
        value={query.account_status || undefined}
        onChange={(val) => setQuery((prev) => ({ ...prev, account_status: val }))}
      />
    </Space>
  );

  return (
    <>
      <AppTable<Elder>
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
        onSearch={handleSearch}
        searchPlaceholder="搜索姓名/手机号/身份证"
        toolbar={
          <Space>
            {filterBar}
            <PermissionGuard permission="elder:create">
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                新增老人
              </Button>
            </PermissionGuard>
          </Space>
        }
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
  );
};

export default ElderListPage;
