'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, setUnauthorizedHandler, tokenStore } from './api';
import type { User } from './types';

type Status = 'checking' | 'signedIn' | 'signedOut';
type Session = { token: string; user: User };

interface AuthValue {
  user: User | null;
  status: Status;
  signOut: () => void;
  login: (body: { email: string; password: string }) => Promise<void>;
  register: (body: { name: string; email: string; password: string }) => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export const DEMO = { email: 'demo@waitforit.app', password: 'demo12345' };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  // 'checking' until we know whether a saved token is still valid.
  const [status, setStatus] = useState<Status>('checking');

  const signOut = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setStatus('signedOut');
    qc.clear();
  }, [qc]);

  const startSession = useCallback(({ token, user: u }: Session) => {
    tokenStore.set(token);
    setUser(u);
    setStatus('signedIn');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(signOut);
    if (!tokenStore.get()) {
      setStatus('signedOut');
      return;
    }
    api<{ user: User }>('/auth/me')
      .then((r) => {
        setUser(r.user);
        setStatus('signedIn');
      })
      .catch(() => signOut());
  }, [signOut]);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      status,
      signOut,
      login: async (body) => startSession(await api<Session>('/auth/login', { method: 'POST', body })),
      register: async (body) => startSession(await api<Session>('/auth/register', { method: 'POST', body })),
    }),
    [user, status, signOut, startSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
