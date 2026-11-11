import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WishesView from '@/components/WishesView';
import { api, ApiError } from '@/lib/api';
import { makeWish, renderWithProviders } from './helpers';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: jest.fn() }) }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), api: jest.fn() }));
const mockApi = api as jest.MockedFunction<typeof api>;

beforeEach(() => {
  push.mockReset();
  mockApi.mockImplementation(async (path: string, opts?: { method?: string }) => {
    if (path === '/wishes' && opts?.method === 'POST') return { wish: makeWish({ _id: 'new1' }) } as never;
    if (path === '/wishes') return { wishes: [makeWish({ status: 'watching', prices: [{ at: '2026-11-10', price: 88 }] })] } as never;
    if (path === '/wishes/stats') return { watching: 1, held: 70, bought: 2, saved: 36 } as never;
    throw new Error(`unexpected ${path}`);
  });
});

test('lists wishes with their status and the stats', async () => {
  renderWithProviders(<WishesView />);
  expect(await screen.findByText('Watching price')).toBeInTheDocument();
  expect(screen.getByText(/Now \$88 · buying at \$70 or less/)).toBeInTheDocument();
  expect(await screen.findByText('$36')).toBeInTheDocument();
});

test('Start shopping stays disabled until there is a wish, and examples fill the box', async () => {
  renderWithProviders(<WishesView />);
  const start = screen.getByRole('button', { name: 'Start shopping' });
  expect(start).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: /Lodge 12 inch cast iron skillet/ }));
  expect(screen.getByLabelText('Describe what you want')).toHaveValue('Lodge 12 inch cast iron skillet under $30');
  expect(start).toBeEnabled();
});

test('sends the wish with Ask-me-first and opens the new wish', async () => {
  renderWithProviders(<WishesView />);
  await userEvent.type(screen.getByLabelText('Describe what you want'), 'Sony headphones under $70');
  await userEvent.click(screen.getByText('Ask me first'));
  await userEvent.click(screen.getByRole('button', { name: 'Start shopping' }));
  expect(mockApi).toHaveBeenCalledWith('/wishes', { method: 'POST', body: { text: 'Sony headphones under $70', maxPrice: null, mode: 'ask' } });
  expect(push).toHaveBeenCalledWith('/wish/?id=new1');
});

test("shows the server's message when the wish can't be started", async () => {
  mockApi.mockImplementation(async (path: string, opts?: { method?: string }) => {
    if (opts?.method === 'POST') throw new ApiError(400, 'How much is the most you would pay?');
    return (path === '/wishes' ? { wishes: [] } : { watching: 0, held: 0, bought: 0, saved: 0 }) as never;
  });
  renderWithProviders(<WishesView />);
  await userEvent.type(screen.getByLabelText('Describe what you want'), 'Sony headphones');
  await userEvent.click(screen.getByRole('button', { name: 'Start shopping' }));
  expect(await screen.findByText('How much is the most you would pay?')).toBeInTheDocument();
  expect(push).not.toHaveBeenCalled();
});
