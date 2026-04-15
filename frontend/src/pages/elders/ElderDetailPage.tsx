import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Tabs,
  Table,
  Button,
  Space,
  Tag,
  message,
  Spin,
  Upload,
} from 'antd';
import { ArrowLeftOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import AppForm, { type FormFieldConfig } from '../../components/AppForm';
import {
  getElderDetail,
  getHealthRecords,
  createHealthRecord,
  importHealthRecords,
  getMedicalRecords,
  createMedicalRecord,
  getCareRecords,
  createCareRecord,
} from '../../api/elders';
import { formatGender, formatDate, formatDateTime } from '../../utils/formatter';
import { getToken } from '../../utils/storage';
import type { Elder, HealthRecord, MedicalRecord, CareRecord } from '../../types/elder';

const healthRecordFields: FormFieldConfig[] = [
  { name: 'height_cm', label: '身高(cm)', type: 'number' },
  { name: 'weight_kg', label: '体重(kg)', type: 'number' },
  { name: 'blood_pressure_systolic', label: '收缩压(mmHg)', type: 'number' },
  { name: 'blood_pressure_diastolic', label: '舒张压(mmHg)', type: 'number' },
  { name: 'blood_glucose', label: '血糖(mmol/L)', type: 'number' },
  { name: 'heart_rate', label: '心率(次/分)', type: 'number' },
  { name: 'temperature', label: '体温(℃)', type: 'number' },
];

const medicalRecordFields: FormFieldConfig[] = [
  { name: 'visit_date', label: '就诊日期', type: 'date', required: true },
  { name: 'hospital_name', label: '医院名称', required: true },
  { name: 'department', label: '科室', required: true },
  { name: 'diagnosis', label: '诊断', required: true },
  { name: 'remarks', label: '备注', type: 'textarea' },
];

const careRecordFields: FormFieldConfig[] = [
  {
    name: 'care_type',
    label: '照护类型',
    type: 'select',
    required: true,
    options: [
      { label: '日常照护', value: 'daily_care' },
      { label: '康复照护', value: 'rehab_care' },
      { label: '心理关怀', value: 'mental_care' },
    ],
  },
  { name: 'care_date', label: '照护日期', type: 'date', required: true },
  { name: 'content', label: '照护内容', type: 'textarea', required: true },
  { name: 'caregiver_name', label: '照护人员', required: true },
];

const ElderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const elderId = Number(id);

  const [elder, setElder] = useState<Elder | null>(null);
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [careRecords, setCareRecords] = useState<CareRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [healthFormVisible, setHealthFormVisible] = useState(false);
  const [medicalFormVisible, setMedicalFormVisible] = useState(false);
  const [careFormVisible, setCareFormVisible] = useState(false);

  const fetchElder = useCallback(async () => {
    try {
      const res = await getElderDetail(elderId);
      setElder(res.data);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载失败');
    }
  }, [elderId]);

  const fetchHealthRecords = useCallback(async () => {
    try {
      const res = await getHealthRecords(elderId);
      setHealthRecords(res.data.items);
    } catch {
      // silent
    }
  }, [elderId]);

  const fetchMedicalRecords = useCallback(async () => {
    try {
      const res = await getMedicalRecords(elderId);
      setMedicalRecords(res.data.items);
    } catch {
      // silent
    }
  }, [elderId]);

  const fetchCareRecords = useCallback(async () => {
    try {
      const res = await getCareRecords(elderId);
      setCareRecords(res.data.items);
    } catch {
      // silent
    }
  }, [elderId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchElder(), fetchHealthRecords(), fetchMedicalRecords(), fetchCareRecords()])
      .finally(() => setLoading(false));
  }, [fetchElder, fetchHealthRecords, fetchMedicalRecords, fetchCareRecords]);

  const healthColumns: ColumnsType<HealthRecord> = [
    { title: '身高(cm)', dataIndex: 'height_cm', width: 100 },
    { title: '体重(kg)', dataIndex: 'weight_kg', width: 100 },
    { title: '收缩压', dataIndex: 'blood_pressure_systolic', width: 90 },
    { title: '舒张压', dataIndex: 'blood_pressure_diastolic', width: 90 },
    { title: '血糖', dataIndex: 'blood_glucose', width: 80 },
    { title: '心率', dataIndex: 'heart_rate', width: 80 },
    { title: '体温', dataIndex: 'temperature', width: 80 },
    {
      title: '慢性病',
      dataIndex: 'chronic_diseases',
      render: (diseases: string[]) => diseases?.join(', ') || '-',
    },
    { title: '记录时间', dataIndex: 'recorded_at', render: formatDateTime, width: 170 },
  ];

  const medicalColumns: ColumnsType<MedicalRecord> = [
    { title: '就诊日期', dataIndex: 'visit_date', render: formatDate, width: 120 },
    { title: '医院', dataIndex: 'hospital_name', width: 150 },
    { title: '科室', dataIndex: 'department', width: 100 },
    { title: '诊断', dataIndex: 'diagnosis', width: 200 },
    {
      title: '用药',
      dataIndex: 'medications',
      render: (meds: string[]) =>
        meds?.map((m) => <Tag key={m}>{m}</Tag>) || '-',
    },
    { title: '备注', dataIndex: 'remarks', ellipsis: true },
  ];

  const careColumns: ColumnsType<CareRecord> = [
    { title: '照护类型', dataIndex: 'care_type', width: 120 },
    { title: '照护日期', dataIndex: 'care_date', render: formatDate, width: 120 },
    { title: '照护内容', dataIndex: 'content', ellipsis: true },
    { title: '照护人员', dataIndex: 'caregiver_name', width: 120 },
  ];

  const handleImport = async (file: File) => {
    try {
      await importHealthRecords(elderId, file);
      message.success('导入成功');
      fetchHealthRecords();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '导入失败');
    }
    return false; // prevent default upload
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/elders')}
        style={{ marginBottom: 16 }}
      >
        返回列表
      </Button>

      <Card title="基本信息" style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2, lg: 3 }}>
          <Descriptions.Item label="姓名">{elder?.name}</Descriptions.Item>
          <Descriptions.Item label="性别">{formatGender(elder?.gender)}</Descriptions.Item>
          <Descriptions.Item label="出生日期">{formatDate(elder?.birth_date)}</Descriptions.Item>
          <Descriptions.Item label="身份证号">{elder?.id_card}</Descriptions.Item>
          <Descriptions.Item label="联系电话">{elder?.phone}</Descriptions.Item>
          <Descriptions.Item label="地址">{elder?.address}</Descriptions.Item>
          <Descriptions.Item label="紧急联系人">{elder?.emergency_contact_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="紧急联系电话">{elder?.emergency_contact_phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="标签">
            {elder?.tags?.map((t) => <Tag key={t} color="blue">{t}</Tag>) || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card>
        <Tabs
          defaultActiveKey="health"
          items={[
            {
              key: 'health',
              label: '健康记录',
              children: (
                <>
                  <Space style={{ marginBottom: 16 }}>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => setHealthFormVisible(true)}
                    >
                      新增健康记录
                    </Button>
                    <Upload
                      accept=".csv,.xlsx,.xls"
                      showUploadList={false}
                      headers={{ Authorization: `Bearer ${getToken() || ''}` }}
                      beforeUpload={(file) => { handleImport(file); return false; }}
                    >
                      <Button icon={<UploadOutlined />}>导入数据</Button>
                    </Upload>
                  </Space>
                  <Table<HealthRecord>
                    columns={healthColumns}
                    dataSource={healthRecords}
                    rowKey="id"
                    scroll={{ x: 'max-content' }}
                  />
                </>
              ),
            },
            {
              key: 'medical',
              label: '医疗记录',
              children: (
                <>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setMedicalFormVisible(true)}
                    style={{ marginBottom: 16 }}
                  >
                    新增医疗记录
                  </Button>
                  <Table<MedicalRecord>
                    columns={medicalColumns}
                    dataSource={medicalRecords}
                    rowKey="id"
                    scroll={{ x: 'max-content' }}
                  />
                </>
              ),
            },
            {
              key: 'care',
              label: '照护记录',
              children: (
                <>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setCareFormVisible(true)}
                    style={{ marginBottom: 16 }}
                  >
                    新增照护记录
                  </Button>
                  <Table<CareRecord>
                    columns={careColumns}
                    dataSource={careRecords}
                    rowKey="id"
                    scroll={{ x: 'max-content' }}
                  />
                </>
              ),
            },
          ]}
        />
      </Card>

      <AppForm
        title="新增健康记录"
        visible={healthFormVisible}
        fields={healthRecordFields}
        onSubmit={async (values) => {
          await createHealthRecord(elderId, {
            ...values,
            recorded_at: new Date().toISOString(),
          } as Parameters<typeof createHealthRecord>[1]);
          message.success('添加成功');
          setHealthFormVisible(false);
          fetchHealthRecords();
        }}
        onCancel={() => setHealthFormVisible(false)}
      />

      <AppForm
        title="新增医疗记录"
        visible={medicalFormVisible}
        fields={medicalRecordFields}
        onSubmit={async (values) => {
          await createMedicalRecord(elderId, values as Parameters<typeof createMedicalRecord>[1]);
          message.success('添加成功');
          setMedicalFormVisible(false);
          fetchMedicalRecords();
        }}
        onCancel={() => setMedicalFormVisible(false)}
      />

      <AppForm
        title="新增照护记录"
        visible={careFormVisible}
        fields={careRecordFields}
        onSubmit={async (values) => {
          await createCareRecord(elderId, values as Parameters<typeof createCareRecord>[1]);
          message.success('添加成功');
          setCareFormVisible(false);
          fetchCareRecords();
        }}
        onCancel={() => setCareFormVisible(false)}
      />
    </div>
  );
};

export default ElderDetailPage;
