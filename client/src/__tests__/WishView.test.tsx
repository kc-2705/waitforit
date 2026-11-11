import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WishView from '@/components/WishView';
import { api } from '@/lib/api';
import { chosen, makeWish, renderWithProviders } from './helpers';
import type { Wish } from '@/lib/types';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams('id=w1'),
  usePathname: () => '/wish/',
}));

jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), api: jest.fn() }));
const mockApi = api as jest.MockedFunction<typeof api>;

/** The fake server: GET returns the wish; actions return the next state. */
function serve(wish: Wish, actions: Record<string, Wish> = {}) {
  mockApi.mockImplementation(async (path: string, opts?: { method?: string }) => {
    if (path === '/config') return { paypalClientId: '', currency: 'USD', demoTools: true } as never;
    if (path === '/wishes/w1' && (!opts?.method || opts.method === 'GET')) return { wish } as never;
    const action = Object.keys(actions).find((a) => path.endsWith(a));
    if (action) return { wish: actions[action] } as never;
    throw new Error(`unexpected call ${opts?.method} ${path}`);
  });
}

const now = new Date().toISOString();
const held = { status: 'held' as const, held: 70 };
const pending = { at: now, price: 65, domain: 'bestbuy.com', reason: 'Exact model, new and in stock.' };
const bought = (extra: Partial<Wish> = {}) =>
  makeWish({
    status: 'bought',
    chosen,
    prices: [{ at: now, price: 88 }, { at: now, price: 65 }],
    payment: { status: 'captured', held: 70, paid: 65, released: 5, captureId: 'CAP-1' },
    purchase: { at: now, price: 65, domain: 'bestbuy.com', saved: 23, reason: 'Exact model, new and in stock.' },
    ...extra,
  });

afterEach(() => mockApi.mockReset());

describe('fair-price advice', () => {
  test('shows the verdict, the numbers and a more likely limit', async () => {
    serve(makeWish({ advice: { verdict: 'stretch', suggestedPrice: 80, message: 'It would need a bigger sale than usual.', low: 88, typical: 95 } }));
    renderWithProviders(<WishView />);
    expect(await screen.findByText('Your limit is a stretch')).toBeInTheDocument();
    expect(screen.getByText(/Lowest now \$88 · typical \$95 · a more likely limit: \$80/)).toBeInTheDocument();
  });
});

describe('ask me first', () => {
  test('a found deal waits for approval, and approving buys it', async () => {
    serve(makeWish({ status: 'awaiting_approval', mode: 'ask', chosen, payment: held, pending }), { '/approve': bought() });
    renderWithProviders(<WishView />);

    expect(await screen.findByText('The agent found a deal. Buy it?')).toBeInTheDocument();
    expect(screen.getByText(/release the other \$5 of your hold/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Approve and buy for \$65/ }));

    expect(mockApi).toHaveBeenCalledWith('/wishes/w1/approve', { method: 'POST', body: {} });
    expect(await screen.findByText('Bought for $65')).toBeInTheDocument();
  });

  test('saying no goes back to watching', async () => {
    serve(makeWish({ status: 'awaiting_approval', mode: 'ask', chosen, payment: held, pending }), {
      '/decline': makeWish({ status: 'watching', mode: 'ask', chosen, payment: held, prices: [{ at: now, price: 88 }] }),
    });
    renderWithProviders(<WishView />);
    await userEvent.click(await screen.findByRole('button', { name: /Not this one/ }));
    expect(await screen.findByText('Watching the price')).toBeInTheDocument();
  });
});

describe('undo purchase', () => {
  test('is offered within 24 hours and asks before refunding', async () => {
    serve(bought(), { '/refund': bought({ status: 'refunded', payment: { status: 'refunded', held: 70, paid: 65, released: 5, captureId: 'CAP-1', refundId: 'REF-1' } }) });
    renderWithProviders(<WishView />);
    await userEvent.click(await screen.findByRole('button', { name: /Undo purchase/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Undo and refund' }));
    expect(mockApi).toHaveBeenCalledWith('/wishes/w1/refund', { method: 'POST', body: {} });
    expect(await screen.findByText('Refunded $65')).toBeInTheDocument();
    expect(screen.getByText('REF-1')).toBeInTheDocument();
  });

  test('is not offered after 24 hours or for the sample', async () => {
    const old = new Date(Date.now() - 25 * 3600_000).toISOString();
    serve(bought({ purchase: { at: old, price: 65, domain: 'bestbuy.com', saved: 23, reason: 'ok' } }));
    const { unmount } = renderWithProviders(<WishView />);
    expect(await screen.findByText('Bought for $65')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Undo purchase/ })).not.toBeInTheDocument();
    unmount();

    serve(bought({ payment: { status: 'captured', held: 70, paid: 65, released: 5, captureId: 'S', sample: true } }));
    renderWithProviders(<WishView />);
    expect(await screen.findByText('Bought for $65')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Undo purchase/ })).not.toBeInTheDocument();
  });
});

describe('steps', () => {
  test('selecting a product calls the API and shows the PayPal step', async () => {
    serve(makeWish(), { '/choose': makeWish({ status: 'needs_payment', chosen, prices: [{ at: now, price: 88 }] }) });
    renderWithProviders(<WishView />);
    await userEvent.click(await screen.findByRole('button', { name: 'Select' }));
    expect(mockApi).toHaveBeenCalledWith('/wishes/w1/choose', { method: 'POST', body: { productId: 'p1' } });
    expect(await screen.findByText('2. Approve a PayPal hold for your top price')).toBeInTheDocument();
  });

  test('a wish that does not exist shows a clear message', async () => {
    mockApi.mockRejectedValue(new Error('Wish not found.'));
    renderWithProviders(<WishView />);
    await waitFor(() => expect(screen.getByText('Wish not found', { selector: '.ant-result-title' })).toBeInTheDocument());
  });
});
