import Link from 'next/link';
import { Button } from 'antd';
import { Brand, ThemeButton } from '@/components/AppHeader';
import { DemoButton, RedirectIfSignedIn } from '@/components/GuestOnly';

// Landing page. A server component: only the demo button and the redirect run in the browser.

const STEPS = [
  {
    title: 'Describe what you want',
    text: '“Sony noise-cancelling headphones under $150.” The AI turns it into a search, finds the best matches across stores and tells you if your price is realistic.',
  },
  {
    title: 'Approve a PayPal hold',
    text: 'PayPal holds your top price. Nothing is charged, and the agent can never spend more than you approved.',
  },
  {
    title: 'The agent buys at your price',
    text: 'It watches the price. When it drops, the AI checks it’s the right item, then buys (or asks you first). You pay only the real price.',
  },
];

export default function Landing() {
  return (
    <>
      <RedirectIfSignedIn />
      <header className="topbar">
        <Brand href="/" />
        <div style={{ flex: 1 }} />
        <ThemeButton />
        <Link href="/login/">
          <Button type="text">Log in</Button>
        </Link>
      </header>
      <main>
        <section className="hero">
          <div>
            <div className="eyebrow">AI shopping agent with PayPal</div>
            <h1>Set your price once. The agent buys when it’s right.</h1>
            <p className="lead">
              WaitForIt watches prices across stores for you. PayPal holds the most you’ll pay, so you’re only charged when there’s a real deal, and
              only the real price.
            </p>
            <div className="hero-actions">
              <DemoButton />
              <Link href="/register/">
                <Button size="large">Create an account</Button>
              </Link>
            </div>
            <p className="muted small" style={{ marginTop: 16 }}>
              Payments run in PayPal’s sandbox, so no real money moves.
            </p>
          </div>
          <div className="hero-card" aria-label="Example purchase">
            <div className="head">
              <span className="muted small">Sony WH-CH720N headphones</span>
              <span className="status done">Bought</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '8px 0 16px' }}>
              <span className="now">$129</span>
              <span className="was">$179</span>
            </div>
            <div className="rows">
              <div><span>PayPal held</span><span>$150</span></div>
              <div><span>Charged</span><strong>$129</strong></div>
              <div><span>Released to you</span><span>$21</span></div>
            </div>
          </div>
        </section>
        <section className="features">
          {STEPS.map((s, i) => (
            <div className="feature" key={s.title}>
              <div className="num">{i + 1}</div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
