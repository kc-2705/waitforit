import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp } from 'antd';
import type { Wish } from '@/lib/types';

/** Renders a component with the same providers the app uses (React Query + Ant Design App). */
export function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AntApp>{ui}</AntApp>
    </QueryClientProvider>,
  );
}

const product = {
  productId: 'p1',
  title: 'Sony WH-CH720N Headphones',
  brand: 'Sony',
  image: null,
  features: ['Noise cancelling'],
  bestOffer: { domain: 'bestbuy.com', url: 'https://bestbuy.com/p1', price: 88, currency: 'USD', availability: 'InStock', condition: 'new' },
  offerCount: 3,
  fit: 100,
  reason: 'Exact model you asked for.',
};

export function makeWish(overrides: Partial<Wish> = {}): Wish {
  return {
    _id: 'w1',
    text: 'Sony WH-CH720N headphones under $70',
    plan: { query: 'Sony WH-CH720N', summary: 'Sony WH-CH720N headphones', brands: ['Sony'], mustHave: [], avoid: [], condition: 'new' },
    maxPrice: 70,
    mode: 'auto',
    status: 'choosing',
    candidates: [product],
    prices: [],
    payment: { status: 'none' },
    journal: [{ at: new Date().toISOString(), kind: 'think', message: 'Understood: Sony WH-CH720N headphones' }],
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export const chosen = product;
