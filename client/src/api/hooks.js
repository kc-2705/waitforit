import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export const useConfig = () => useQuery({ queryKey: ['config'], queryFn: async () => (await api.get('/config')).data, staleTime: Infinity });

export const useWishes = () => useQuery({ queryKey: ['wishes'], queryFn: async () => (await api.get('/wishes')).data.wishes });

export const useStats = () => useQuery({ queryKey: ['stats'], queryFn: async () => (await api.get('/wishes/stats')).data });

export const useWish = (id) =>
  useQuery({
    queryKey: ['wish', id],
    queryFn: async () => (await api.get(`/wishes/${id}`)).data.wish,
    // While the agent is watching, keep the page fresh in case the timer bought it.
    refetchInterval: (q) => (q.state.data?.status === 'watching' ? 60_000 : false),
  });

/** Any action that returns the updated wish: put it straight into the cache. */
function useWishAction(path, method = 'post') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }) => (await api[method](`/wishes/${id}${path}`, body)).data,
    onSuccess: (data) => {
      if (data?.wish) qc.setQueryData(['wish', data.wish._id], data.wish);
      qc.invalidateQueries({ queryKey: ['wishes'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useCreateWish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => (await api.post('/wishes', body)).data.wish,
    onSuccess: (wish) => {
      qc.setQueryData(['wish', wish._id], wish);
      qc.invalidateQueries({ queryKey: ['wishes'] });
    },
  });
}

export const useChoose = () => useWishAction('/choose');
export const useCheckNow = () => useWishAction('/check');
export const useSimulateDrop = () => useWishAction('/simulate-drop');
export const useCancelWish = () => useWishAction('/cancel');
export const useAuthorizeHold = () => useWishAction('/paypal/authorize');

export function useDeleteWish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => api.delete(`/wishes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wishes'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export const createHoldOrder = async (id) => (await api.post(`/wishes/${id}/paypal/order`)).data.orderId;
