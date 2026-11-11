'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Card, Divider, Form, Input, Typography } from 'antd';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/api';
import { Brand } from './AppHeader';
import { DemoButton, RedirectIfSignedIn } from './GuestOnly';

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="auth-screen">
      <RedirectIfSignedIn />
      <div className="auth-card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <Brand href="/" />
        </div>
        <Card>
          <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 4 }}>{title}</Typography.Title>
          <Typography.Paragraph type="secondary">{subtitle}</Typography.Paragraph>
          {children}
        </Card>
        <p className="muted small" style={{ textAlign: 'center' }}>{footer}</p>
      </div>
    </div>
  );
}

function useSubmit<T>(action: (values: T) => Promise<void>) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function submit(values: T) {
    setError(null);
    setLoading(true);
    try {
      await action(values);
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  }
  return { error, loading, submit };
}

export function LoginForm() {
  const { login } = useAuth();
  const { error, loading, submit } = useSubmit(login);
  return (
    <AuthShell title="Log in" subtitle="See your wishes and what the agent has found." footer={<>New here? <Link href="/register/">Create an account</Link></>}>
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
      <Form layout="vertical" requiredMark={false} onFinish={submit}>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Enter your email.' }]}>
          <Input autoComplete="email" />
        </Form.Item>
        <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Enter your password.' }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={loading}>Log in</Button>
      </Form>
      <Divider plain className="small">or</Divider>
      <DemoButton block />
    </AuthShell>
  );
}

export function RegisterForm() {
  const { register } = useAuth();
  const { error, loading, submit } = useSubmit(register);
  return (
    <AuthShell title="Create your account" subtitle="Free. Payments use the PayPal sandbox (test money)." footer={<>Already have an account? <Link href="/login/">Log in</Link></>}>
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
      <Form layout="vertical" requiredMark={false} onFinish={submit}>
        <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Enter your name.' }]}>
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
