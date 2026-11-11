'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button } from 'antd';
import { DEMO, useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/api';

/** Pages for signed-out visitors send signed-in users straight to their wishes. */
export function RedirectIfSignedIn() {
  const { status } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (status === 'signedIn') router.replace('/wishes/');
  }, [status, router]);
  return null;
}

export function DemoButton({ block = false }: { block?: boolean }) {
  const { login } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function tryDemo() {
    setBusy(true);
    setError(null);
    try {
      await login(DEMO);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="primary" size="large" block={block} loading={busy} onClick={tryDemo}>
        Try the demo
      </Button>
      {error && <Alert type="error" showIcon title={error} style={{ marginTop: 12, width: '100%' }} />}
    </>
  );
}
