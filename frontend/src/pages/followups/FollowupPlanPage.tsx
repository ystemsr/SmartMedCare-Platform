import React, { useState, useCallback } from 'react';
import { Button, Tag, Space, Select, DatePicker, Popconfirm, message, Modal, Form, Input } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import AppTable from '../../components/AppTable';
import AppForm, { type FormFieldConfig } from '../../components/AppForm';
import PermissionGuard from '../../components/PermissionGuard';
import { useTable } from '../../hooks/useTable';
import {
  getFollowups,
  createFollowup,
  updateFollowup,
  updateFollowupStatus,
  addFollowupRecord,
  deleteFollowup,
} from '../../api/followups';
import { formatDateTime, formatFollowupStatus, formatPlanType } from '../../utils/formatter';
import {
  FOLLOWUP_STATUS_OPTIONS,
  FOLLOWUP_TYPE_OPTIONS,
  FOLLOWUP_STATUS_COLORS,
} from '../../utils/constants';
import type { Followup, FollowupListQuery } from '../../types/followup';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

const formFields: FormFieldConfig[] = [
  { name: 'elder_id', label: '老人ID', type: 'number', required: true },
  { name: 'plan_type', label: '随访方式', type: 'select', required: true, options: FOLLOWUP_TYPE_OPTIONS },
  { name: 'planned_at', label: '计划时间', type: 'date', required: true },
  { name: 'assigned_to', label: '负责人ID', type: 'number', required: true },
  { name: 'alert_id', label: '关联预警ID', type: 'number' },
  { name: 'notes', label: '备注', type: 'textarea' },
];

const FollowupPlanPage: React.FC = () => {
  const [formVisible, setFormVisible] = useState(false);
  const [editingFollowup, setEditingFollowup] = useState<Followup | null>(null);
  const [recordModalVisible, setRecordModalVisible] = useState(false);
  const [recordFollowupId, setRecordFollowupId] = useState<number | null>(null);
  const [recordForm] = Form.useForm();

  const fetchFn = useCallback(
    (params: FollowupListQuery & { page: number; page_size: number }) => getFollowups(params),
    [],
  );

  const { data, loading, pagination, handleTableChange, refresh, handleSearch, query, setQuery } =
    useTable<Followup, FollowupListQuery>(fetchFn);

  const handleEdit = (record: Followup) => {
    setEditingFollowup(record);
    setFormVisible(true);
  };

  const handleCreate = () => {
    setEditingFollowup(null);
    setFormVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteFollowup(id);
      message.success('删除成功');
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleStatusUpdate = async (id: number, status: string) => {
    try {
      await updateFollowupStatus(id, { status: status as Followup['status'] });
      message.success('状态更新成功');
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleAddRecord = (followupId: number) => {
    setRecordFollowupId(followupId);
    setRecordModalVisible(true);
  };

  const handleRecordSubmit = async () => {
    try {
      const values = await recordForm.validateFields();
      if (recordFollowupId) {
        await addFollowupRecord(recordFollowupId, {
          actual_time: new Date().toISOString(),
          result: values.result,
          next_action: values.next_action,
          status: 'completed',
        });
        message.success('记录添加成功');
        setRecordModalVisible(false);
        recordForm.resetFields();
        refresh();
      }
    } catch {
      // validation errors
    }
  };

  const columns: ColumnsType<Followup> = [
    { title: '老人ID', dataIndex: 'elder_id', width: 80 },
    { title: '老人姓名', dataIndex: 'elder_name', width: 100 },
    {
      title: '随访方式',
      dataIndex: 'plan_type',
      width: 100,
      render: formatPlanType,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={FOLLOWUP_STATUS_COLORS[status]}>{formatFollowupStatus(status)}</Tag>
      ),
    },
    { title: '计划时间', dataIndex: 'planned_at', render: formatDateTime, width: 170 },
    { title: '负责人', dataIndex: 'assigned_to_name', width: 100 },
    { title: '备注', dataIndex: 'notes', ellipsis: true },
    {
      title: '操作',
      key: 'actions',
      width: 320,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <PermissionGuard permission="followup:update">
            <Button type="link" size="small" onClick={() => handleEdit(record)}>
              编辑
            </Button>
            {record.status === 'todo' && (
              <Button
                type="link"
                size="small"
                onClick={() => handleStatusUpdate(record.id, 'in_progress')}
              >
                开始
              </Button>
            )}
            {record.status === 'in_progress' && (
              <Button type="link" size="small" onClick={() => handleAddRecord(record.id)}>
                记录结果
              </Button>
            )}
          </PermissionGuard>
          <PermissionGuard permission="followup:update">
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
      <AppTable<Followup>
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
        onSearch={handleSearch}
        searchPlaceholder="搜索随访计划"
        toolbar={
          <Space wrap>
            <Select
              placeholder="状态"
              allowClear
              options={FOLLOWUP_STATUS_OPTIONS}
              style={{ width: 120 }}
              value={query.status || undefined}
              onChange={(val) => setQuery((prev) => ({ ...prev, status: val }))}
            />
            <Select
              placeholder="随访方式"
              allowClear
              options={FOLLOWUP_TYPE_OPTIONS}
              style={{ width: 120 }}
              value={query.plan_type || undefined}
              onChange={(val) => setQuery((prev) => ({ ...prev, plan_type: val }))}
            />
            <RangePicker
              onChange={(dates) => {
                setQuery((prev) => ({
                  ...prev,
                  date_start: dates?.[0]?.format('YYYY-MM-DD') || undefined,
                  date_end: dates?.[1]?.format('YYYY-MM-DD') || undefined,
                }));
              }}
            />
            <PermissionGuard permission="followup:create">
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                新建随访计划
              </Button>
            </PermissionGuard>
          </Space>
        }
      />

      <AppForm
        title={editingFollowup ? '编辑随访计划' : '新建随访计划'}
        visible={formVisible}
        fields={formFields}
        initialValues={editingFollowup || undefined}
        onSubmit={async (values) => {
          if (editingFollowup) {
            await updateFollowup(editingFollowup.id, values as Parameters<typeof updateFollowup>[1]);
          } else {
            await createFollowup(values as Parameters<typeof createFollowup>[0]);
          }
          message.success(editingFollowup ? '更新成功' : '创建成功');
          setFormVisible(false);
          refresh();
        }}
        onCancel={() => setFormVisible(false)}
      />

      <Modal
        title="记录随访结果"
        open={recordModalVisible}
        onOk={handleRecordSubmit}
        onCancel={() => {
          setRecordModalVisible(false);
          recordForm.resetFields();
        }}
      >
        <Form form={recordForm} layout="vertical">
          <Form.Item name="result" label="随访结果" rules={[{ required: true, message: '请输入随访结果' }]}>
            <TextArea rows={3} placeholder="请输入随访结果" />
          </Form.Item>
          <Form.Item name="next_action" label="后续行动">
            <TextArea rows={2} placeholder="请输入后续行动建议" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default FollowupPlanPage;
