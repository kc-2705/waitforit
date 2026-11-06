import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../api/client';
import { Brand } from '../components/AppLayout';

export const DEMO = { email: 'demo@waitforit.app', password: 'demo12345' };

function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="center-screen" style={{ padding: 16 }}>
      <div className="auth-card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <Brand to="/" />
        </div>
        <Card>
          <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>{title}</Typography.Title>
          <Typography.Paragraph type="secondary">{subtitle}</Typography.Paragraph>
          {children}
        </Card>
        <p className="muted" style={{ textAlign: 'center' }}>{footer}</p>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const [form] = Form.useForm();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(values) {
    setError(null);
    setLoading(true);
    try {
      await login(values);
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to see your wishes." footer={<>New here? <Link to="/register">Create an account</Link></>}>
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
      <Form form={form} layout="vertical" requiredMark={false} onFinish={submit}>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Enter your email.' }]}>
          <Input autoComplete="email" />
        </Form.Item>
        <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Enter your password.' }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={loading}>Log in</Button>
        <Button block style={{ marginTop: 8 }} disabled={loading} onClick={() => { form.setFieldsValue(DEMO); submit(DEMO); }}>Use the demo account</Button>
      </Form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(values) {
    setError(null);
    setLoading(true);
    try {
      await register(values);
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Free. Payments use the PayPal sandbox (test money)." footer={<>Already have an account? <Link to="/login">Log in</Link></>}>
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
      <Form layout="vertical" requiredMark={false} onFinish={submit}>
        <Form.Item name="name" label="Your name" rules={[{ required: true, message: 'Enter your name.' }]}>
          <Input autoComplete="name" />
        </Form.Item>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Enter a valid email.' }]}>
          <Input autoComplete="email" />
        </Form.Item>
        <Form.Item name="password" label="Password" rules={[{ required: true, min: 8, message: 'At least 8 characters.' }]}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={loading}>Create account</Button>
      </Form>
    </AuthShell>
  );
}
