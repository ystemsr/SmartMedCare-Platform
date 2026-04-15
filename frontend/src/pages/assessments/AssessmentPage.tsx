import React, { useState, useCallback } from 'react';
import { Button, Tag, Space, Select, DatePicker, Popconfirm, Modal, Form, InputNumber, message } from 'antd';
import { PlusOutlined, ThunderboltOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import AppTable from '../../components/AppTable';
import AppForm, { type FormFieldConfig } from '../../components/AppForm';
import PermissionGuard from '../../components/PermissionGuard';
import { useTable } from '../../hooks/useTable';
import {
  getAssessments,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  generateAssessment,
} from '../../api/assessments';
import { formatDateTime, formatRiskLevel } from '../../utils/formatter';
import { RISK_LEVEL_OPTIONS, RISK_LEVEL_COLORS } from '../../utils/constants';
import type { Assessment, AssessmentListQuery } from '../../types/assessment';

const { RangePicker } = DatePicker;

const ASSESSMENT_TYPE_OPTIONS = [
  { label: '综合评估', value: 'comprehensive' },
  { label: '血压评估', value: 'blood_pressure' },
  { label: '血糖评估', value: 'blood_glucose' },
  { label: '心理评估', value: 'mental' },
];

const formFields: FormFieldConfig[] = [
  { name: 'elder_id', label: '老人ID', type: 'number', required: true },
  { name: 'assessment_type', label: '评估类型', type: 'select', options: ASSESSMENT_TYPE_OPTIONS },
  { name: 'score', label: '评估分数', type: 'number', required: true },
  { name: 'risk_level', label: '风险等级', type: 'select', required: true, options: RISK_LEVEL_OPTIONS },
  { name: 'summary', label: '评估摘要', type: 'textarea', required: true },
];

const AssessmentPage: React.FC = () => {
  const [formVisible, setFormVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Assessment | null>(null);
  const [generateModalVisible, setGenerateModalVisible] = useState(false);
  const [generateForm] = Form.useForm();
  const [generateLoading, setGenerateLoading] = useState(false);

  const fetchFn = useCallback(
    (params: AssessmentListQuery & { page: number; page_size: number }) => getAssessments(params),
    [],
  );

  const { data, loading, pagination, handleTableChange, refresh, handleSearch, query, setQuery } =
    useTable<Assessment, AssessmentListQuery>(fetchFn);

  const handleCreate = () => {
    setEditingItem(null);
    setFormVisible(true);
  };

  const handleEdit = (record: Assessment) => {
    setEditingItem(record);
    setFormVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteAssessment(id);
      message.success('删除成功');
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleGenerate = async () => {
    try {
      const values = await generateForm.validateFields();
      setGenerateLoading(true);
      await generateAssessment({
        elder_id: values.elder_id,
        force_recalculate: true,
      });
      message.success('评估生成成功');
      setGenerateModalVisible(false);
      generateForm.resetFields();
      refresh();
    } catch (err) {
      if (err instanceof Error) message.error(err.message);
    } finally {
      setGenerateLoading(false);
    }
  };

  const columns: ColumnsType<Assessment> = [
    { title: '老人ID', dataIndex: 'elder_id', width: 80 },
    { title: '老人姓名', dataIndex: 'elder_name', width: 100 },
    { title: '评估类型', dataIndex: 'assessment_type', width: 120 },
    { title: '评分', dataIndex: 'score', width: 80 },
    {
      title: '风险等级',
      dataIndex: 'risk_level',
      width: 100,
      render: (level: string) => (
        <Tag color={RISK_LEVEL_COLORS[level]}>{formatRiskLevel(level)}</Tag>
      ),
    },
    { title: '评估摘要', dataIndex: 'summary', ellipsis: true },
    { title: '创建时间', dataIndex: 'created_at', render: formatDateTime, width: 170 },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <PermissionGuard permission="assessment:create">
            <Button type="link" size="small" onClick={() => handleEdit(record)}>
              编辑
            </Button>
          </PermissionGuard>
          <PermissionGuard permission="assessment:create">
            <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </PermissionGuard>
        </Space>
      ),
    },
  ];

  return (
    <>
      <AppTable<Assessment>
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
        onSearch={handleSearch}
        searchPlaceholder="搜索评估"
        toolbar={
          <Space wrap>
            <Select
              placeholder="风险等级"
              allowClear
              options={RISK_LEVEL_OPTIONS}
              style={{ width: 120 }}
              value={query.risk_level || undefined}
              onChange={(val) => setQuery((prev) => ({ ...prev, risk_level: val }))}
            />
            <Select
              placeholder="评估类型"
              allowClear
              options={ASSESSMENT_TYPE_OPTIONS}
              style={{ width: 120 }}
              value={query.assessment_type || undefined}
              onChange={(val) => setQuery((prev) => ({ ...prev, assessment_type: val }))}
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
            <PermissionGuard permission="assessment:create">
              <Button
                icon={<ThunderboltOutlined />}
                onClick={() => setGenerateModalVisible(true)}
              >
                自动生成评估
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                新建评估
              </Button>
            </PermissionGuard>
          </Space>
        }
      />

      <AppForm
        title={editingItem ? '编辑评估' : '新建评估'}
        visible={formVisible}
        fields={formFields}
        initialValues={editingItem || undefined}
        onSubmit={async (values) => {
          if (editingItem) {
            await updateAssessment(editingItem.id, values as Parameters<typeof updateAssessment>[1]);
          } else {
            await createAssessment(values as Parameters<typeof createAssessment>[0]);
          }
          message.success(editingItem ? '更新成功' : '创建成功');
          setFormVisible(false);
          refresh();
        }}
        onCancel={() => setFormVisible(false)}
      />

      <Modal
        title="自动生成评估"
        open={generateModalVisible}
        onOk={handleGenerate}
        onCancel={() => {
          setGenerateModalVisible(false);
          generateForm.resetFields();
        }}
        confirmLoading={generateLoading}
      >
        <Form form={generateForm} layout="vertical">
          <Form.Item
            name="elder_id"
            label="老人ID"
            rules={[{ required: true, message: '请输入老人ID' }]}
          >
            <InputNumber style={{ width: '100%' }} placeholder="请输入老人ID" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default AssessmentPage;
