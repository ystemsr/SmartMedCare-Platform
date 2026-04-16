import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
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
  type?: 'input' | 'textarea' | 'number' | 'select' | 'date' | 'password';
  required?: boolean;
  options?: { label: string; value: string | number }[];
  placeholder?: string;
  rules?: FormFieldRule[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    setValues((previous) => ({
      ...previous,
      [name]: value,
    }));
    setErrors((previous) => ({
      ...previous,
      [name]: '',
    }));
  };

  const validate = () => {
    const nextErrors = fields.reduce<Record<string, string>>((result, field) => {
      const value = values[field.name];
      if (field.required && (value === '' || value === null || value === undefined)) {
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
    if (!validate()) {
      return;
    }

    await onSubmit(values);
  };

  return (
    <Dialog
      open={visible}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { width } }}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {fields.map((field) => {
            const value = values[field.name];

            if (field.type === 'select') {
              return (
                <FormControl key={field.name} fullWidth error={Boolean(errors[field.name])} required={field.required}>
                  <InputLabel required={field.required}>{field.label}</InputLabel>
                  <Select
                    label={field.label}
                    value={(value as string | number | '') ?? ''}
                    onChange={(event) => updateValue(field.name, event.target.value)}
                  >
                    {field.options?.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              );
            }

            if (field.type === 'date') {
              return (
                <DatePicker
                  key={field.name}
                  label={field.label}
                  value={value ? dayjs(String(value)) : null}
                  onChange={(nextValue) =>
                    updateValue(field.name, nextValue ? nextValue.format('YYYY-MM-DD') : '')
                  }
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      required: field.required,
                      error: Boolean(errors[field.name]),
                      helperText: errors[field.name] || ' ',
                    },
                  }}
                />
              );
            }

            return (
              <TextField
                key={field.name}
                fullWidth
                required={field.required}
                label={field.label}
                type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
                multiline={field.type === 'textarea'}
                minRows={field.type === 'textarea' ? 3 : undefined}
                value={(value as string | number | '') ?? ''}
                onChange={(event) =>
                  updateValue(
                    field.name,
                    field.type === 'number' && event.target.value !== ''
                      ? Number(event.target.value)
                      : event.target.value,
                  )
                }
                placeholder={field.placeholder}
                error={Boolean(errors[field.name])}
                helperText={errors[field.name] || ' '}
              />
            );
          })}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onCancel} color="inherit">
          取消
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={confirmLoading}>
          {confirmLoading ? '提交中...' : '确定'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AppForm;
