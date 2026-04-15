import React, { useState, useCallback } from 'react';
import { Button, Tag, Space, Select, Popconfirm, Modal, Form, Input, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import AppTable from '../../components/AppTable';
import AppForm, { type FormFieldConfig } from '../../components/AppForm';
import PermissionGuard from '../../components/PermissionGuard';
import { useTable } from '../../hooks/useTable';
import {
  getInterventions,
  createIntervention,
  updateIntervention,
  updateInterventionStatus,
  deleteIntervention,
} from '../../api/interventions';
import { formatDateTime, formatInterventionStatus } from '../../utils/formatter';
import { INTERVENTION_STATUS_OPTIONS, INTERVENTION_STATUS_COLORS } from '../../utils/constants';
import type { Intervention, InterventionListQuery } from '../../types/intervention';

const { TextArea } = Input;

const INTERVENTION_TYPE_OPTIONS = [
  { label: '用药指导', value: 'medication_guidance' },
  { label: '饮食建议', value: 'diet_advice' },
  { label: '运动指导', value: 'exercise_guidance' },
  { label: '心理干预', value: 'mental_intervention' },
  { label: '其他', value: 'other' },
];

const formFields: FormFieldConfig[] = [
  { name: 'elder_id', label: '老人ID', type: 'number', required: true },
  { name: 'type', label: '干预类型', type: 'select', required: true, options: INTERVENTION_TYPE_OPTIONS },
  { name: 'content', label: '干预内容', type: 'textarea', required: true },
  { name: 'followup_id', label: '关联随访ID', type: 'number' },
  { name: 'planned_at', label: '计划时间', type: 'date' },
];

const InterventionPage: React.FC = () => {
  const [formVisible, setFormVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Intervention | null>(null);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusTarget, setStatusTarget] = useState<{ id: number; status: string } | null>(null);
  const [statusForm] = Form.useForm();

  const fetchFn = useCallback(
    (params: InterventionListQuery & { page: number; page_size: number }) => getInterventions(params),
    [],
  );

  const { data, loading, pagination, handleTableChange, refresh, handleSearch, query, setQuery } =
    useTable<Intervention, InterventionListQuery>(fetchFn);

  const handleCreate = () => {
    setEditingItem(null);
    setFormVisible(true);
  };

  const handleEdit = (record: Intervention) => {
    setEditingItem(record);
    setFormVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteIntervention(id);
      message.success('删除成功');
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const openStatusModal = (id: number, status: string) => {
    setStatusTarget({ id, status });
    setStatusModalVisible(true);
  };

  const handleStatusSubmit = async () => {
    try {
      const values = await statusForm.validateFields();
      if (statusTarget) {
        await updateInterventionStatus(statusTarget.id, {
          status: statusTarget.status as Intervention['status'],
          result: values.result,
        });
        message.success('状态更新成功');
        setStatusModalVisible(false);
        statusForm.resetFields();
        refresh();
      }
    } catch {
      // validation errors
    }
  };

  const columns: ColumnsType<Intervention> = [
    { title: '老人ID', dataIndex: 'elder_id', width: 80 },
    { title: '老人姓名', dataIndex: 'elder_name', width: 100 },
    { title: '干预类型', dataIndex: 'type', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={INTERVENTION_STATUS_COLORS[status]}>
          {formatInterventionStatus(status)}
        </Tag>
      ),
    },
    { title: '干预内容', dataIndex: 'content', ellipsis: true },
    { title: '执行时间', dataIndex: 'performed_at', render: formatDateTime, width: 170 },
    {
      title: '操作',
      key: 'actions',
      width: 300,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <PermissionGuard permission="intervention:create">
            <Button type="link" size="small" onClick={() => handleEdit(record)}>
              编辑
            </Button>
            {record.status === 'planned' && (
              <Button
                type="link"
                size="small"
                onClick={() => openStatusModal(record.id, 'ongoing')}
              >
                开始执行
              </Button>
            )}
            {record.status === 'ongoing' && (
              <Button
                type="link"
                size="small"
                onClick={() => openStatusModal(record.id, 'completed')}
              >
                完成
              </Button>
            )}
            {(record.status === 'planned' || record.status === 'ongoing') && (
              <Button
                type="link"
                size="small"
                danger
                onClick={() => openStatusModal(record.id, 'stopped')}
              >
                停止
              </Button>
            )}
            <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
              <Button type="link" size="small" danger>删除</Button>
            </Popconfirm>
          </PermissionGuard>
        </Space>
      ),
    },
  ];

  return (
    <>
      <AppTable<Intervention>
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
        onSearch={handleSearch}
        searchPlaceholder="搜索干预记录"
        toolbar={
          <Space wrap>
            <Select
              placeholder="状态"
              allowClear
              options={INTERVENTION_STATUS_OPTIONS}
              style={{ width: 120 }}
              value={query.status || undefined}
              onChange={(val) => setQuery((prev) => ({ ...prev, status: val }))}
            />
            <Select
              placeholder="干预类型"
              allowClear
              options={INTERVENTION_TYPE_OPTIONS}
              style={{ width: 120 }}
              value={query.type || undefined}
              onChange={(val) => setQuery((prev) => ({ ...prev, type: val }))}
            />
            <PermissionGuard permission="intervention:create">
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                新建干预
              </Button>
            </PermissionGuard>
          </Space>
        }
      />

      <AppForm
        title={editingItem ? '编辑干预记录' : '新建干预记录'}
        visible={formVisible}
        fields={formFields}
        initialValues={editingItem || undefined}
        onSubmit={async (values) => {
          if (editingItem) {
            await updateIntervention(editingItem.id, values as Parameters<typeof updateIntervention>[1]);
          } else {
            await createIntervention(values as Parameters<typeof createIntervention>[0]);
          }
          message.success(editingItem ? '更新成功' : '创建成功');
          setFormVisible(false);
          refresh();
        }}
        onCancel={() => setFormVisible(false)}
      />

      <Modal
        title="更新干预状态"
        open={statusModalVisible}
        onOk={handleStatusSubmit}
        onCancel={() => {
          setStatusModalVisible(false);
          statusForm.resetFields();
        }}
      >
        <Form form={statusForm} layout="vertical">
          <Form.Item name="result" label="执行结果">
            <TextArea rows={3} placeholder="请输入执行结果（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default InterventionPage;
