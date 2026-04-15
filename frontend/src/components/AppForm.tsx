import React, { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, DatePicker } from 'antd';
import dayjs from 'dayjs';

export interface FormFieldConfig {
  name: string;
  label: string;
  type?: 'input' | 'textarea' | 'number' | 'select' | 'date' | 'password';
  required?: boolean;
  options?: { label: string; value: string | number }[];
  placeholder?: string;
  rules?: object[];
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

/**
 * Reusable form component rendered inside a Modal.
 * Supports create and edit modes via initialValues.
 */
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
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible) {
      if (initialValues) {
        // Convert date strings to dayjs for DatePicker fields
        const converted = { ...initialValues };
        fields.forEach((f) => {
          if (f.type === 'date' && converted[f.name] && typeof converted[f.name] === 'string') {
            converted[f.name] = dayjs(converted[f.name] as string);
          }
        });
        form.setFieldsValue(converted);
      } else {
        form.resetFields();
      }
    }
  }, [visible, initialValues, form, fields]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      // Convert dayjs back to ISO string
      fields.forEach((f) => {
        if (f.type === 'date' && values[f.name]) {
          values[f.name] = (values[f.name] as dayjs.Dayjs).format('YYYY-MM-DD');
        }
      });
      await onSubmit(values);
      form.resetFields();
    } catch {
      // validation errors handled by antd
    }
  };

  const renderField = (field: FormFieldConfig) => {
    switch (field.type) {
      case 'textarea':
        return <Input.TextArea rows={3} placeholder={field.placeholder} />;
      case 'number':
        return <InputNumber style={{ width: '100%' }} placeholder={field.placeholder} />;
      case 'select':
        return (
          <Select
            placeholder={field.placeholder || `请选择${field.label}`}
            options={field.options}
            allowClear
          />
        );
      case 'date':
        return <DatePicker style={{ width: '100%' }} />;
      case 'password':
        return <Input.Password placeholder={field.placeholder} />;
      default:
        return <Input placeholder={field.placeholder || `请输入${field.label}`} />;
    }
  };

  return (
    <Modal
      title={title}
      open={visible}
      onOk={handleOk}
      onCancel={() => {
        form.resetFields();
        onCancel();
      }}
      confirmLoading={confirmLoading}
      width={width}
      destroyOnClose
    >
      <Form form={form} layout="vertical" autoComplete="off">
        {fields.map((field) => (
          <Form.Item
            key={field.name}
            name={field.name}
            label={field.label}
            rules={
              field.rules || (field.required ? [{ required: true, message: `请输入${field.label}` }] : [])
            }
          >
            {renderField(field)}
          </Form.Item>
        ))}
      </Form>
    </Modal>
  );
};

export default AppForm;
