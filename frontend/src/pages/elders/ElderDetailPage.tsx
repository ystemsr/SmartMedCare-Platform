import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, AlertTriangle } from 'lucide-react';
import { Button, Card, Chip, Divider, Spinner, Tabs } from '../../components/ui';
import AppForm, { type FormFieldConfig } from '../../components/AppForm';
import AppTable, { type AppTableColumn } from '../../components/AppTable';
import UploadFile from '../../components/UploadFile';
import {
  importHealthRecords,
  getElderDetail,
  getHealthRecords,
  createHealthRecord,
  getMedicalRecords,
  createMedicalRecord,
  getCareRecords,
  createCareRecord,
} from '../../api/elders';
import { getElderPredictions } from '../../api/bigdata';
import { formatGender, formatDate, formatDateTime } from '../../utils/formatter';
import { message } from '../../utils/message';
import type { Elder, HealthRecord, MedicalRecord, CareRecord } from '../../types/elder';
import type { PredictionRecord } from '../../types/bigdata';

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

interface DetailItemProps {
  label: string;
  value: React.ReactNode;
}

function DetailItem({ label, value }: DetailItemProps) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--smc-text-2)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}

const ElderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const elderId = Number(id);

  const [elder, setElder] = useState<Elder | null>(null);
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [careRecords, setCareRecords] = useState<CareRecord[]>([]);
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'health' | 'medical' | 'care' | 'ai'>('health');

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
      // keep the page usable if one record source fails
    }
  }, [elderId]);

  const fetchMedicalRecords = useCallback(async () => {
    try {
      const res = await getMedicalRecords(elderId);
      setMedicalRecords(res.data.items);
    } catch {
      // keep the page usable if one record source fails
    }
  }, [elderId]);

  const fetchCareRecords = useCallback(async () => {
    try {
      const res = await getCareRecords(elderId);
      setCareRecords(res.data.items);
    } catch {
      // keep the page usable if one record source fails
    }
  }, [elderId]);

  const fetchPredictions = useCallback(async () => {
    try {
      const res = await getElderPredictions(elderId);
      const payload = res.data as unknown;
      const list: PredictionRecord[] = Array.isArray(payload)
        ? (payload as PredictionRecord[])
        : payload
          ? [payload as PredictionRecord]
          : [];
      list.sort((a, b) => (b.predicted_at || '').localeCompare(a.predicted_at || ''));
      setPredictions(list);
    } catch {
      setPredictions([]);
    }
  }, [elderId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchElder(),
      fetchHealthRecords(),
      fetchMedicalRecords(),
      fetchCareRecords(),
      fetchPredictions(),
    ]).finally(() => setLoading(false));
  }, [fetchElder, fetchHealthRecords, fetchMedicalRecords, fetchCareRecords, fetchPredictions]);

  const healthColumns = useMemo<AppTableColumn<HealthRecord>[]>(
    () => [
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
        render: (value: unknown) => {
          const diseases = value as string[] | undefined;
          return diseases?.join(', ') || '-';
        },
      },
      {
        title: '记录时间',
        dataIndex: 'recorded_at',
        render: (value: unknown) => formatDateTime(value as string | undefined | null),
        width: 170,
      },
    ],
    [],
  );

  const medicalColumns = useMemo<AppTableColumn<MedicalRecord>[]>(
    () => [
      {
        title: '就诊日期',
        dataIndex: 'visit_date',
        render: (value: unknown) => formatDate(value as string | undefined | null),
        width: 120,
      },
      { title: '医院', dataIndex: 'hospital_name', width: 150 },
      { title: '科室', dataIndex: 'department', width: 100 },
      { title: '诊断', dataIndex: 'diagnosis', width: 200 },
      {
        title: '用药',
        dataIndex: 'medications',
        render: (value: unknown) => {
          const meds = value as string[] | undefined;
          return meds?.length ? (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {meds.map((med) => (
                <Chip key={med} outlined>
                  {med}
                </Chip>
              ))}
            </div>
          ) : (
            '-'
          );
        },
      },
      { title: '备注', dataIndex: 'remarks', ellipsis: true },
    ],
    [],
  );

  const predictionColumns = useMemo<AppTableColumn<PredictionRecord>[]>(
    () => [
      {
        title: '预测时间',
        dataIndex: 'predicted_at',
        render: (value: unknown) => formatDateTime(value as string | undefined | null),
        width: 180,
      },
      {
        title: '健康评分',
        dataIndex: 'health_score',
        width: 120,
        render: (value: unknown) => {
          const v = value as number | null | undefined;
          return typeof v === 'number' ? v.toFixed(1) : '-';
        },
      },
      {
        title: '风险',
        dataIndex: 'high_risk',
        width: 110,
        render: (value: unknown) => {
          const v = value as boolean;
          return v ? (
            <Chip tone="error" outlined icon={<AlertTriangle size={12} />}>
              高风险
            </Chip>
          ) : (
            <Chip tone="success" outlined>
              正常
            </Chip>
          );
        },
      },
      {
        title: '建议随访',
        dataIndex: 'followup_needed',
        width: 110,
        render: (value: unknown) => {
          const v = value as boolean;
          return v ? (
            <Chip tone="warning" outlined>
              建议
            </Chip>
          ) : (
            <Chip outlined>无需</Chip>
          );
        },
      },
    ],
    [],
  );

  const careColumns = useMemo<AppTableColumn<CareRecord>[]>(
    () => [
      { title: '照护类型', dataIndex: 'care_type', width: 120 },
      {
        title: '照护日期',
        dataIndex: 'care_date',
        render: (value: unknown) => formatDate(value as string | undefined | null),
        width: 120,
      },
      { title: '照护内容', dataIndex: 'content', ellipsis: true },
      { title: '照护人员', dataIndex: 'caregiver_name', width: 120 },
    ],
    [],
  );

  const handleImport = async (file: File) => {
    await importHealthRecords(elderId, file);
    message.success('导入成功');
    try {
      await fetchHealthRecords();
    } catch {
      // import succeeded; keep the success signal even if refresh fails
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '50vh',
        }}
      >
        <Spinner />
      </div>
    );
  }

  const detailGridStyle: React.CSSProperties = {
    display: 'grid',
    gap: 16,
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  };

  const tabItems = [
    {
      key: 'health',
      label: '健康记录',
      children: (
        <AppTable<HealthRecord>
          columns={healthColumns}
          dataSource={healthRecords}
          rowKey="id"
          loading={false}
          pagination={false}
          emptyText="暂无健康记录"
          toolbar={
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Button startIcon={<Plus size={14} />} onClick={() => setHealthFormVisible(true)}>
                新增健康记录
              </Button>
              <UploadFile accept=".csv,.xlsx,.xls" buttonText="导入数据" onUpload={handleImport} />
            </div>
          }
        />
      ),
    },
    {
      key: 'medical',
      label: '医疗记录',
      children: (
        <AppTable<MedicalRecord>
          columns={medicalColumns}
          dataSource={medicalRecords}
          rowKey="id"
          loading={false}
          pagination={false}
          emptyText="暂无医疗记录"
          toolbar={
            <Button startIcon={<Plus size={14} />} onClick={() => setMedicalFormVisible(true)}>
              新增医疗记录
            </Button>
          }
        />
      ),
    },
    {
      key: 'care',
      label: '照护记录',
      children: (
        <AppTable<CareRecord>
          columns={careColumns}
          dataSource={careRecords}
          rowKey="id"
          loading={false}
          pagination={false}
          emptyText="暂无照护记录"
          toolbar={
            <Button startIcon={<Plus size={14} />} onClick={() => setCareFormVisible(true)}>
              新增照护记录
            </Button>
          }
        />
      ),
    },
    {
      key: 'ai',
      label: 'AI 预测历史',
      children: (
        <AppTable<PredictionRecord>
          columns={predictionColumns}
          dataSource={predictions}
          rowKey="id"
          loading={false}
          pagination={false}
          emptyText="暂无 AI 预测记录"
        />
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <Button variant="text" startIcon={<ArrowLeft size={14} />} onClick={() => navigate('/elders')}>
          返回列表
        </Button>
      </div>

      <Card>
        <div style={{ padding: 24 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 22, fontWeight: 700 }}>
            {elder?.name || '老人档案'}
          </h2>
          <div style={detailGridStyle}>
            <DetailItem label="姓名" value={elder?.name || '-'} />
            <DetailItem label="性别" value={formatGender(elder?.gender)} />
            <DetailItem label="出生日期" value={formatDate(elder?.birth_date)} />
            <DetailItem label="身份证号" value={elder?.id_card || '-'} />
            <DetailItem label="联系电话" value={elder?.phone || '-'} />
            <DetailItem label="地址" value={elder?.address || '-'} />
            <DetailItem label="紧急联系人" value={elder?.emergency_contact_name || '-'} />
            <DetailItem label="紧急联系电话" value={elder?.emergency_contact_phone || '-'} />
            <DetailItem
              label="标签"
              value={
                elder?.tags?.length ? (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {elder.tags.map((tag) => (
                      <Chip key={tag} tone="primary" outlined>
                        {tag}
                      </Chip>
                    ))}
                  </div>
                ) : (
                  '-'
                )
              }
            />
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ padding: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600 }}>记录概览</h3>
          <div
            style={{
              display: 'grid',
              gap: 16,
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            }}
          >
            <Card>
              <div style={{ padding: 20 }}>
                <div style={{ fontSize: 13, color: 'var(--smc-text-2)', marginBottom: 4 }}>
                  健康记录数
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--smc-primary)' }}>
                  {healthRecords.length}
                </div>
              </div>
            </Card>
            <Card>
              <div style={{ padding: 20 }}>
                <div style={{ fontSize: 13, color: 'var(--smc-text-2)', marginBottom: 4 }}>
                  医疗记录数
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--smc-success)' }}>
                  {medicalRecords.length}
                </div>
              </div>
            </Card>
            <Card>
              <div style={{ padding: 20 }}>
                <div style={{ fontSize: 13, color: 'var(--smc-text-2)', marginBottom: 4 }}>
                  照护记录数
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--smc-warning)' }}>
                  {careRecords.length}
                </div>
              </div>
            </Card>
            <Card>
              <div style={{ padding: 20 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontSize: 13, color: 'var(--smc-text-2)' }}>AI 健康评估</span>
                  {predictions.length > 0 && (
                    <Button size="sm" variant="text" onClick={() => setTab('ai')}>
                      查看历史
                    </Button>
                  )}
                </div>
                {predictions.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--smc-text-2)' }}>暂无评估</div>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                      <span
                        style={{
                          fontSize: 28,
                          fontWeight: 700,
                          color: predictions[0].high_risk
                            ? 'var(--smc-error)'
                            : 'var(--smc-success)',
                        }}
                      >
                        {predictions[0].health_score.toFixed(1)}
                      </span>
                      {predictions[0].high_risk ? (
                        <Chip tone="error" outlined icon={<AlertTriangle size={12} />}>
                          高风险
                        </Chip>
                      ) : (
                        <Chip tone="success" outlined>
                          正常
                        </Chip>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--smc-text-3)', marginTop: 4 }}>
                      {formatDateTime(predictions[0].predicted_at)}
                    </div>
                  </>
                )}
              </div>
            </Card>
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ padding: '8px 24px 0' }}>
          <Tabs
            activeKey={tab}
            onChange={(k) => setTab(k as typeof tab)}
            items={tabItems.map(({ key, label }) => ({ key, label }))}
          />
        </div>
        <Divider />
        <div style={{ padding: 24 }}>{tabItems.find((item) => item.key === tab)?.children}</div>
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
