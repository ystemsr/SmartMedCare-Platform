import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { getCaptcha } from '../../api/auth';
import type { LoginRequest, CaptchaResponse } from '../../types/auth';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState<CaptchaResponse | null>(null);

  const fetchCaptcha = async () => {
    try {
      const res = await getCaptcha();
      setCaptcha(res.data);
    } catch {
      // Captcha may not be configured yet; allow login without it
    }
  };

  useEffect(() => {
    fetchCaptcha();
  }, []);

  const handleSubmit = async (values: LoginRequest) => {
    setLoading(true);
    try {
      await login({
        ...values,
        captcha_id: captcha?.captcha_id || '',
      });
      message.success('登录成功');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      message.error(err instanceof Error ? err.message : '登录失败');
      fetchCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      style={{
        width: 420,
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
          智慧医养大数据公共服务平台
        </h1>
        <p style={{ color: '#8c8c8c', fontSize: 14, margin: '8px 0 0' }}>
          医生服务系统
        </p>
      </div>

      <Form<LoginRequest> onFinish={handleSubmit} size="large" autoComplete="off">
        <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
          <Input prefix={<UserOutlined />} placeholder="用户名" />
        </Form.Item>

        <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
          <Input.Password prefix={<LockOutlined />} placeholder="密码" />
        </Form.Item>

        <Form.Item name="captcha_code" rules={[{ required: !!captcha, message: '请输入验证码' }]}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              prefix={<SafetyOutlined />}
              placeholder="验证码"
              style={{ flex: 1 }}
            />
            {captcha?.captcha_image && (
              <img
                src={captcha.captcha_image}
                alt="验证码"
                style={{ height: 40, cursor: 'pointer', borderRadius: 6, border: '1px solid #d9d9d9' }}
                onClick={fetchCaptcha}
                title="点击刷新验证码"
              />
            )}
          </div>
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            登 录
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default LoginPage;
