'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/lib/api';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
import ServerGate from '@/components/ServerGate';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (count, error) => count < 2 && !(error instanceof ApiError && [400, 401, 403, 404].includes(error.status)),
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ServerGate />
          {children}
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
