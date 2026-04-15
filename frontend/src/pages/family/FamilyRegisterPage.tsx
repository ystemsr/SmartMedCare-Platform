import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Form, Input, Button, Card, Select, message } from 'antd';
import {
  KeyOutlined,
  UserOutlined,
  PhoneOutlined,
  LockOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SlideCaptcha from '../../components/SlideCaptcha';
import { validateInviteCode, registerFamily } from '../../api/family';
import type { InviteCodeValidation } from '../../types/family';

interface RegisterFormValues {
  invite_code: string;
  real_name: string;
  phone: string;
  password: string;
  confirm_password: string;
  relationship: string;
}

const relationshipOptions = [
  { value: '子女', label: '子女' },
  { value: '配偶', label: '配偶' },
  { value: '兄弟姐妹', label: '兄弟姐妹' },
  { value: '其他', label: '其他' },
];

const FamilyRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm<RegisterFormValues>();
  const [loading, setLoading] = useState(false);
  const [captchaVisible, setCaptchaVisible] = useState(false);
  const [codeValidation, setCodeValidation] = useState<InviteCodeValidation | null>(null);
  const [validating, setValidating] = useState(false);

  const sessionId = useMemo(() => crypto.randomUUID(), []);

  const doValidateCode = useCallback(async (code: string) => {
    if (!code || code.trim().length === 0) {
      setCodeValidation(null);
      return;
    }
    setValidating(true);
    try {
      const res = await validateInviteCode(code.trim());
      setCodeValidation(res.data as InviteCodeValidation);
    } catch {
      setCodeValidation({ valid: false, elder_name: '', remaining_slots: 0 });
    } finally {
      setValidating(false);
    }
  }, []);

  // Auto-fill and validate from URL query parameter
  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      form.setFieldsValue({ invite_code: code });
      doValidateCode(code);
    }
  }, [searchParams, form, doValidateCode]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length >= 8) {
      doValidateCode(value);
    } else {
      setCodeValidation(null);
    }
  };

  const handleCodeBlur = () => {
    const code = form.getFieldValue('invite_code') as string;
    if (code && code.trim().length > 0) {
      doValidateCode(code);
    }
  };

  const handleSubmit = () => {
    form.validateFields().then(() => {
      setCaptchaVisible(true);
    });
  };

  const handleCaptchaSuccess = async (captchaToken: string) => {
    setCaptchaVisible(false);
    const values = form.getFieldsValue();
    setLoading(true);
    try {
      await registerFamily({
        invite_code: values.invite_code,
        real_name: values.real_name,
        phone: values.phone,
        password: values.password,
        relationship: values.relationship,
        captcha_token: captchaToken,
        session_id: sessionId,
      });
      message.success('注册成功，请登录');
      navigate('/login', { replace: true });
    } catch (err) {
      message.error(err instanceof Error ? err.message : '注册失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCaptchaCancel = () => {
    setCaptchaVisible(false);
  };

  return (
    <>
      <Card
        style={{
          width: 480,
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
        }}
        styles={{ body: { padding: '40px 32px' } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#1677ff',
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            家属注册
          </h1>
          <p style={{ color: '#8c8c8c', fontSize: 14, margin: '8px 0 0' }}>
            智慧医养大数据公共服务平台
          </p>
        </div>

        <Form<RegisterFormValues>
          form={form}
          onFinish={handleSubmit}
          size="large"
          autoComplete="off"
        >
          <Form.Item
            name="invite_code"
            rules={[{ required: true, message: '请输入邀请码' }]}
          >
            <Input
              prefix={<KeyOutlined />}
              placeholder="请输入邀请码"
              onChange={handleCodeChange}
              onBlur={handleCodeBlur}
            />
          </Form.Item>

          {/* Invite code validation feedback */}
          {(validating || codeValidation) && (
            <div style={{ marginTop: -16, marginBottom: 16, fontSize: 13 }}>
              {validating && (
                <span style={{ color: '#8c8c8c' }}>验证中...</span>
              )}
              {!validating && codeValidation?.valid && (
                <span style={{ color: '#52c41a' }}>
                  关联老人：{codeValidation.elder_name}
                </span>
              )}
              {!validating && codeValidation && !codeValidation.valid && (
                <span style={{ color: '#ff4d4f' }}>邀请码无效</span>
              )}
            </div>
          )}

          <Form.Item
            name="real_name"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="请输入姓名" />
          </Form.Item>

          <Form.Item
            name="phone"
            rules={[
              { required: true, message: '请输入手机号' },
              { pattern: /^1\d{10}$/, message: '请输入正确的手机号' },
            ]}
          >
            <Input prefix={<PhoneOutlined />} placeholder="请输入手机号" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请设置密码' },
              { min: 6, message: '密码至少6位' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请设置密码（至少6位）" />
          </Form.Item>

          <Form.Item
            name="confirm_password"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请确认密码" />
          </Form.Item>

          <Form.Item
            name="relationship"
            rules={[{ required: true, message: '请选择与老人的关系' }]}
          >
            <Select
              placeholder="请选择与老人的关系"
              options={relationshipOptions}
              suffixIcon={<TeamOutlined />}
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              注 册
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: -8 }}>
          <Button type="link" onClick={() => navigate('/login')}>
            返回登录
          </Button>
        </div>
      </Card>

      <SlideCaptcha
        visible={captchaVisible}
        sessionId={sessionId}
        onSuccess={handleCaptchaSuccess}
        onCancel={handleCaptchaCancel}
      />
    </>
  );
};

export default FamilyRegisterPage;
