import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, setUnauthorizedHandler, tokenStore } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const [user, setUser] = useState(null);
  // 'checking' until we know whether a saved token is still valid.
  const [status, setStatus] = useState(tokenStore.get() ? 'checking' : 'signedOut');

  const signOut = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setStatus('signedOut');
    qc.clear();
  }, [qc]);

  const startSession = useCallback(({ token, user: u }) => {
    tokenStore.set(token);
    setUser(u);
    setStatus('signedIn');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(signOut);
    if (!tokenStore.get()) return;
    api
      .get('/auth/me')
      .then((r) => {
        setUser(r.data.user);
        setStatus('signedIn');
      })
      .catch(() => signOut());
  }, [signOut]);

  const value = useMemo(
    () => ({
      user,
      status,
      signOut,
      updateUser: setUser,
      login: async (body) => startSession((await api.post('/auth/login', body)).data),
      register: async (body) => startSession((await api.post('/auth/register', body)).data),
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
