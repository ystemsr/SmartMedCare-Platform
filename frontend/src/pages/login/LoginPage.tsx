import React, { useState, useMemo } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import SlideCaptcha from '../../components/SlideCaptcha';

interface LoginFormValues {
  username: string;
  password: string;
}

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [form] = Form.useForm<LoginFormValues>();
  const [loading, setLoading] = useState(false);
  const [captchaVisible, setCaptchaVisible] = useState(false);

  const sessionId = useMemo(() => crypto.randomUUID(), []);

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
      await login({
        username: values.username,
        password: values.password,
        captcha_token: captchaToken,
        session_id: sessionId,
      });
      message.success('登录成功');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      message.error(err instanceof Error ? err.message : '登录失败');
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

        <Form<LoginFormValues>
          form={form}
          onFinish={handleSubmit}
          size="large"
          autoComplete="off"
        >
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>

          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登 录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: -8 }}>
          <Button type="link" onClick={() => navigate('/register/family')}>
            家属注册
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

export default LoginPage;
