'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spin } from 'antd';
import AppHeader from '@/components/AppHeader';
import { useAuth } from '@/lib/auth';

// Every page in the (app) group needs a signed-in user.
export default function SignedInLayout({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'signedOut') router.replace('/login/');
  }, [status, router]);

  if (status !== 'signedIn') {
    return (
      <div className="center">
        <Spin size="large" />
      </div>
    );
  }
  return (
    <>
      <AppHeader />
      <main className="page">{children}</main>
    </>
  );
}
