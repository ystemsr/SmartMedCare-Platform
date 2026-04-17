import React from 'react';
import { Card, CardBody, Input } from '@/components/ui';
import type { FeatureDict } from '../../types/bigdata';

export interface FeatureFieldConfig {
  name: keyof FeatureDict;
  label: string;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
}

export interface FeatureGroup {
  title: string;
  description?: string;
  fields: FeatureFieldConfig[];
}

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    title: '人口学信息',
    description: '老人的基本身份与背景',
    fields: [
      { name: 'AGE', label: '年龄', min: 0, max: 120 },
      { name: 'IS_FEMALE', label: '是否女性 (1=是, 0=否)', min: 0, max: 1 },
      { name: 'RACE', label: '种族编码' },
      { name: 'SCHLYRS', label: '受教育年限', min: 0, max: 30 },
    ],
  },
  {
    title: '自评健康',
    description: '由老人自己或照护者填写',
    fields: [
      { name: 'SELF_HEALTH', label: '自评健康 (1-5)', min: 1, max: 5 },
      { name: 'HEALTH_CHANGE', label: '健康变化 (1=更好 5=更差)', min: 1, max: 5 },
      { name: 'FALL_2YR', label: '近两年是否跌倒 (1=是)', min: 0, max: 1 },
      { name: 'PAIN', label: '疼痛程度 (0-4)', min: 0, max: 4 },
      { name: 'BMI_CATEGORY', label: 'BMI 分类 (0-3)', min: 0, max: 3 },
    ],
  },
  {
    title: '认知功能',
    description: '记忆与认知测评',
    fields: [
      { name: 'MEMORY_RATING', label: '记忆评分 (1-5)', min: 1, max: 5 },
      { name: 'MEMORY_CHANGE', label: '记忆变化 (1-5)', min: 1, max: 5 },
      { name: 'SERIAL7_SCORE', label: '连续减 7 评分 (0-5)', min: 0, max: 5 },
      { name: 'DATE_NAMING', label: '日期命名 (0-4)', min: 0, max: 4 },
    ],
  },
  {
    title: '日常活动能力 (ADL)',
    fields: [{ name: 'ADL_SCORE', label: 'ADL 综合得分', min: 0, max: 10 }],
  },
  {
    title: '医疗使用',
    description: '过去 12 个月的医疗服务利用情况',
    fields: [
      { name: 'HOSPITAL_STAY', label: '是否住院过 (1=是)', min: 0, max: 1 },
      { name: 'NURSING_HOME', label: '是否入住护理院 (1=是)', min: 0, max: 1 },
      { name: 'HOME_HEALTH', label: '是否使用居家护理 (1=是)', min: 0, max: 1 },
      { name: 'HAS_USUAL_CARE', label: '是否有固定就医场所 (1=是)', min: 0, max: 1 },
      { name: 'NUM_HOSPITAL_STAYS', label: '住院次数', min: 0 },
      { name: 'DOCTOR_VISITS', label: '就诊次数', min: 0 },
    ],
  },
];

interface FeatureFieldsetProps {
  values: FeatureDict;
  onChange: (name: keyof FeatureDict, value: number) => void;
}

const FeatureFieldset: React.FC<FeatureFieldsetProps> = ({ values, onChange }) => {
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {FEATURE_GROUPS.map((group) => (
        <Card key={group.title}>
          <CardBody>
            <div style={{ fontSize: 'var(--smc-fs-lg)', fontWeight: 700, color: 'var(--smc-text)' }}>
              {group.title}
            </div>
            {group.description && (
              <div
                style={{
                  fontSize: 'var(--smc-fs-xs)',
                  color: 'var(--smc-text-2)',
                  marginTop: 4,
                  marginBottom: 16,
                }}
              >
                {group.description}
              </div>
            )}
            <div
              style={{
                display: 'grid',
                gap: 16,
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              }}
            >
              {group.fields.map((field) => (
                <Input
                  key={field.name as string}
                  label={field.label}
                  helperText={field.hint}
                  type="number"
                  value={values[field.name] ?? 0}
                  onChange={(event) => {
                    const raw = event.target.value;
                    const next = raw === '' ? 0 : Number(raw);
                    onChange(field.name, Number.isFinite(next) ? next : 0);
                  }}
                  min={field.min}
                  max={field.max}
                  step={field.step ?? 1}
                />
              ))}
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
};

export const EMPTY_FEATURES: FeatureDict = {
  AGE: 0,
  IS_FEMALE: 0,
  RACE: 0,
  SCHLYRS: 0,
  SELF_HEALTH: 0,
  HEALTH_CHANGE: 0,
  FALL_2YR: 0,
  PAIN: 0,
  BMI_CATEGORY: 0,
  MEMORY_RATING: 0,
  MEMORY_CHANGE: 0,
  SERIAL7_SCORE: 0,
  DATE_NAMING: 0,
  ADL_SCORE: 0,
  HOSPITAL_STAY: 0,
  NURSING_HOME: 0,
  HOME_HEALTH: 0,
  HAS_USUAL_CARE: 0,
  NUM_HOSPITAL_STAYS: 0,
  DOCTOR_VISITS: 0,
};

export const EXAMPLE_FEATURES: FeatureDict = {
  AGE: 78,
  IS_FEMALE: 1,
  RACE: 1,
  SCHLYRS: 9,
  SELF_HEALTH: 3,
  HEALTH_CHANGE: 3,
  FALL_2YR: 1,
  PAIN: 2,
  BMI_CATEGORY: 2,
  MEMORY_RATING: 3,
  MEMORY_CHANGE: 3,
  SERIAL7_SCORE: 3,
  DATE_NAMING: 3,
  ADL_SCORE: 6,
  HOSPITAL_STAY: 1,
  NURSING_HOME: 0,
  HOME_HEALTH: 1,
  HAS_USUAL_CARE: 1,
  NUM_HOSPITAL_STAYS: 2,
  DOCTOR_VISITS: 6,
};

export default FeatureFieldset;
