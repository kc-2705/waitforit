import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { currentPrice, money, StatusLabel } from '@/components/common';
import PriceChart from '@/components/PriceChart';
import { LoginForm } from '@/components/AuthForms';
import { AuthProvider } from '@/lib/auth';
import { api } from '@/lib/api';
import { makeWish, renderWithProviders } from './helpers';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
jest.mock('@/lib/api', () => ({ ...jest.requireActual('@/lib/api'), api: jest.fn() }));
const mockApi = api as jest.MockedFunction<typeof api>;

describe('formatting', () => {
  test('money shows cents only when needed', () => {
    expect(money(129)).toBe('$129');
    expect(money(12.5)).toBe('$12.50');
    expect(money(1299.99)).toBe('$1,299.99');
    expect(money(null)).toBe('—');
  });

  test('status labels are plain words', () => {
    render(<StatusLabel status="awaiting_approval" />);
    expect(screen.getByText('Waiting for your OK')).toBeInTheDocument();
  });

  test('current price is the latest check, or the chosen offer before any check', () => {
    expect(currentPrice(makeWish({ prices: [{ at: 'a', price: 90 }, { at: 'b', price: 81 }] }))).toBe(81);
    expect(currentPrice(makeWish({ chosen: makeWish().candidates[0] }))).toBe(88);
  });
});

describe('price chart', () => {
  test('describes itself for screen readers and lists every check in a table', () => {
    render(
      <PriceChart
        limit={70}
        prices={[
          { at: '2026-11-08T10:00:00Z', price: 88, domain: 'bestbuy.com' },
          { at: '2026-11-09T10:00:00Z', price: 79, domain: 'target.com' },
          { at: '2026-11-10T10:00:00Z', price: 65, domain: 'bestbuy.com', simulated: true },
        ]}
      />,
    );
    expect(screen.getByRole('img', { name: 'Lowest price over 3 checks: from $88 to $65. Your limit is $70.' })).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(4); // header + 3 checks
    expect(document.querySelectorAll('circle.dot.simulated')).toHaveLength(1);
  });

  test('draws nothing without data', () => {
    const { container } = render(<PriceChart limit={70} prices={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('login', () => {
  beforeEach(() => mockApi.mockReset());

  test('asks for missing fields before calling the server', async () => {
    renderWithProviders(
      <AuthProvider>
        <LoginForm />
      </AuthProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Enter your email.')).toBeInTheDocument();
    expect(mockApi).not.toHaveBeenCalled();
  });

  test('the demo button logs in with the demo account', async () => {
    mockApi.mockResolvedValue({ token: 't', user: { id: '1', name: 'Demo', email: 'demo@waitforit.app' } } as never);
    renderWithProviders(
      <AuthProvider>
        <LoginForm />
      </AuthProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try the demo' }));
    expect(mockApi).toHaveBeenCalledWith('/auth/login', { method: 'POST', body: { email: 'demo@waitforit.app', password: 'demo12345' } });
  });
});
