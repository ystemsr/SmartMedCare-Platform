import React, { useEffect, useMemo, useState } from 'react';
import { Button, DatePicker, Input, Modal, Select, Textarea } from './ui';
import ElderPicker from './ElderPicker';
import DoctorPicker from './DoctorPicker';
import AlertPicker, { type AlertSummary } from './AlertPicker';
import FollowupPicker from './FollowupPicker';
import { message } from '../utils/message';

export interface FormFieldRule {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  patternMessage?: string;
  message?: string;
}

export interface FormFieldConfig {
  name: string;
  label: string;
  type?:
    | 'input'
    | 'textarea'
    | 'number'
    | 'select'
    | 'date'
    | 'password'
    | 'elder-picker'
    | 'doctor-picker'
    | 'alert-picker'
    | 'followup-picker';
  required?: boolean;
  options?: { label: string; value: string | number }[];
  placeholder?: string;
  rules?: FormFieldRule[];
  /** For 'elder-picker' / 'doctor-picker' / 'alert-picker' / 'followup-picker': name of a sibling field in initialValues holding a prefilled display label (e.g. 'elder_name', 'assigned_to_name') */
  labelField?: string;
  /** For 'alert-picker' / 'followup-picker': name of a sibling field whose value scopes the options shown (e.g. 'elder_id'). */
  dependsOn?: string;
  /** For 'alert-picker': enable multi-select. The form value becomes number[]. */
  multi?: boolean;
  /** For 'alert-picker': hide alerts already linked to a todo/in-progress followup. */
  excludeLinked?: boolean;
  /** For 'alert-picker': name of a sibling field in initialValues holding the
   * already-linked alert summaries (so chips render before any fetch). */
  initialAlertsField?: string;
}

interface AppFormProps<T = any> {
  title: string;
  visible: boolean;
  fields: FormFieldConfig[];
  initialValues?: T;
  onSubmit: (values: T) => Promise<void> | void;
  onCancel: () => void;
  confirmLoading?: boolean;
  width?: number;
}

function createDefaultValues(fields: FormFieldConfig[]) {
  return fields.reduce<Record<string, unknown>>((result, field) => {
    result[field.name] = '';
    return result;
  }, {});
}

const AppForm: React.FC<AppFormProps> = ({
  title,
  visible,
  fields,
  initialValues,
  onSubmit,
  onCancel,
  confirmLoading,
  width = 520,
}) => {
  const [values, setValues] = useState<Record<string, unknown>>(createDefaultValues(fields));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const defaultValues = useMemo(() => createDefaultValues(fields), [fields]);

  useEffect(() => {
    if (visible) {
      setValues({
        ...defaultValues,
        ...(initialValues as Record<string, unknown> | undefined),
      });
      setErrors({});
    }
  }, [defaultValues, initialValues, visible]);

  const updateValue = (name: string, value: unknown) => {
    setValues((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: '' }));
  };

  const validate = () => {
    const nextErrors = fields.reduce<Record<string, string>>((result, field) => {
      const value = values[field.name];
      const isEmpty =
        value === '' ||
        value === null ||
        value === undefined ||
        (Array.isArray(value) && value.length === 0);
      if (field.required && isEmpty) {
        result[field.name] = `请输入${field.label}`;
        return result;
      }
      if (field.rules && value !== '' && value !== null && value !== undefined) {
        const strValue = String(value);
        for (const rule of field.rules) {
          if (rule.minLength && strValue.length < rule.minLength) {
            result[field.name] = rule.message || `${field.label}至少${rule.minLength}个字符`;
            break;
          }
          if (rule.maxLength && strValue.length > rule.maxLength) {
            result[field.name] = rule.message || `${field.label}最多${rule.maxLength}个字符`;
            break;
          }
          if (rule.pattern && !rule.pattern.test(strValue)) {
            result[field.name] = rule.patternMessage || rule.message || `${field.label}格式不正确`;
            break;
          }
        }
      }
      return result;
    }, {});
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const firstError = Object.values(nextErrors)[0];
      message.warning(firstError || '请填写所有必填项');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    await onSubmit(values);
  };

  return (
    <Modal
      open={visible}
      onClose={onCancel}
      title={title}
      width={width}
      footer={
        <>
          <Button variant="outlined" onClick={onCancel}>取消</Button>
          <Button onClick={handleSubmit} loading={confirmLoading}>
            {confirmLoading ? '提交中...' : '确定'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 4 }}>
        {fields.map((field) => {
          const value = values[field.name];
          if (field.type === 'select') {
            return (
              <Select
                key={field.name}
                label={field.label}
                required={field.required}
                value={(value as string | number | '') ?? ''}
                onChange={(v) => updateValue(field.name, v)}
                options={field.options ?? []}
                error={errors[field.name]}
                placeholder={field.placeholder}
              />
            );
          }
          if (field.type === 'date') {
            return (
              <DatePicker
                key={field.name}
                label={field.label}
                required={field.required}
                value={(value as string) || null}
                onChange={(v) => updateValue(field.name, v ?? '')}
                error={errors[field.name]}
              />
            );
          }
          if (field.type === 'elder-picker') {
            const initialLabel =
              field.labelField && initialValues
                ? ((initialValues as Record<string, unknown>)[field.labelField] as string | undefined)
                : undefined;
            return (
              <ElderPicker
                key={field.name}
                label={field.label}
                required={field.required}
                value={(value as number | '' | null) ?? ''}
                onChange={(v) => updateValue(field.name, v)}
                initialLabel={initialLabel}
                placeholder={field.placeholder}
                error={errors[field.name]}
              />
            );
          }
          if (field.type === 'doctor-picker') {
            const initialLabel =
              field.labelField && initialValues
                ? ((initialValues as Record<string, unknown>)[field.labelField] as string | undefined)
                : undefined;
            return (
              <DoctorPicker
                key={field.name}
                label={field.label}
                required={field.required}
                value={(value as number | '' | null) ?? ''}
                onChange={(v) => updateValue(field.name, v)}
                initialLabel={initialLabel}
                placeholder={field.placeholder}
                error={errors[field.name]}
              />
            );
          }
          if (field.type === 'followup-picker') {
            const initialLabel =
              field.labelField && initialValues
                ? ((initialValues as Record<string, unknown>)[field.labelField] as string | undefined)
                : undefined;
            const dependsOn = field.dependsOn ?? 'elder_id';
            const elderId = values[dependsOn] as number | '' | null | undefined;
            return (
              <FollowupPicker
                key={field.name}
                label={field.label}
                required={field.required}
                value={(value as number | '' | null) ?? ''}
                onChange={(v) => updateValue(field.name, v)}
                elderId={elderId ?? ''}
                initialLabel={initialLabel}
                placeholder={field.placeholder}
                error={errors[field.name]}
              />
            );
          }
          if (field.type === 'alert-picker') {
            const initialLabel =
              field.labelField && initialValues
                ? ((initialValues as Record<string, unknown>)[field.labelField] as string | undefined)
                : undefined;
            const initialAlerts =
              field.initialAlertsField && initialValues
                ? ((initialValues as Record<string, unknown>)[
                    field.initialAlertsField
                  ] as AlertSummary[] | undefined)
                : undefined;
            const dependsOn = field.dependsOn ?? 'elder_id';
            const elderId = values[dependsOn] as number | '' | null | undefined;
            const isMulti = Boolean(field.multi);
            const fallbackValue: unknown = isMulti ? [] : '';
            const currentValue = value === '' || value === null || value === undefined
              ? fallbackValue
              : value;
            // When excludeLinked is on, the current selection (edit mode) must
            // stay visible even though those alerts are linked to this very
            // followup, so feed them back through keep_ids.
            const keepIds = isMulti
              ? Array.isArray(currentValue)
                ? (currentValue as number[])
                : []
              : typeof currentValue === 'number'
                ? [currentValue]
                : [];
            return (
              <AlertPicker
                key={field.name}
                label={field.label}
                required={field.required}
                multi={isMulti}
                value={currentValue as number | number[] | '' | null}
                onChange={(v) => updateValue(field.name, v)}
                elderId={elderId ?? ''}
                excludeLinked={field.excludeLinked}
                keepIds={field.excludeLinked ? keepIds : undefined}
                initialAlerts={initialAlerts}
                initialLabel={initialLabel}
                placeholder={field.placeholder}
                error={errors[field.name]}
              />
            );
          }
          if (field.type === 'textarea') {
            return (
              <Textarea
                key={field.name}
                label={field.label}
                required={field.required}
                value={(value as string) ?? ''}
                placeholder={field.placeholder}
                onChange={(e) => updateValue(field.name, e.target.value)}
                error={errors[field.name]}
                rows={3}
              />
            );
          }
          return (
            <Input
              key={field.name}
              label={field.label}
              required={field.required}
              type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
              value={(value as string | number | '') ?? ''}
              placeholder={field.placeholder}
              onChange={(e) =>
                updateValue(
                  field.name,
                  field.type === 'number' && e.target.value !== ''
                    ? Number(e.target.value)
                    : e.target.value,
                )
              }
              error={errors[field.name]}
            />
          );
        })}
      </div>
    </Modal>
  );
};

export default AppForm;
