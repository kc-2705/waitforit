'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { PublicConfig, Stats, Wish } from './types';

export const useConfig = () => useQuery({ queryKey: ['config'], queryFn: () => api<PublicConfig>('/config'), staleTime: Infinity });

export const useWishes = () => useQuery({ queryKey: ['wishes'], queryFn: async () => (await api<{ wishes: Wish[] }>('/wishes')).wishes });

export const useStats = () => useQuery({ queryKey: ['stats'], queryFn: () => api<Stats>('/wishes/stats') });

export const useWish = (id: string | null) =>
  useQuery({
    queryKey: ['wish', id],
    enabled: Boolean(id),
    queryFn: async () => (await api<{ wish: Wish }>(`/wishes/${id}`)).wish,
    // While the agent is watching, refresh in case the timer found a deal.
    refetchInterval: (q) => (q.state.data?.status === 'watching' ? 60_000 : false),
  });

type ActionInput = { id: string } & Record<string, unknown>;

/** Any action that returns the updated wish: put it straight into the cache. */
function useWishAction(path: string, method = 'POST') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: ActionInput) => api<{ wish: Wish }>(`/wishes/${id}${path}`, { method, body }),
    onSuccess: ({ wish }) => {
      qc.setQueryData(['wish', wish._id], wish);
      qc.invalidateQueries({ queryKey: ['wishes'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useCreateWish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { text: string; maxPrice: number | null; mode: 'auto' | 'ask' }) =>
      (await api<{ wish: Wish }>('/wishes', { method: 'POST', body })).wish,
    onSuccess: (wish) => {
      qc.setQueryData(['wish', wish._id], wish);
      qc.invalidateQueries({ queryKey: ['wishes'] });
    },
  });
}

export const useChoose = () => useWishAction('/choose');
export const useSetMode = () => useWishAction('/mode', 'PATCH');
export const useAuthorizeHold = () => useWishAction('/paypal/authorize');
export const useCheckNow = () => useWishAction('/check');
export const useSimulateDrop = () => useWishAction('/simulate-drop');
export const useApprove = () => useWishAction('/approve');
export const useDecline = () => useWishAction('/decline');
export const useRefund = () => useWishAction('/refund');
export const useCancelWish = () => useWishAction('/cancel');

export function useDeleteWish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/wishes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wishes'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export const createHoldOrder = async (id: string) => (await api<{ orderId: string }>(`/wishes/${id}/paypal/order`, { method: 'POST' })).orderId;
