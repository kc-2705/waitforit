import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button } from 'antd';
import { BulbOutlined, EyeOutlined, SafetyCertificateOutlined, WalletOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../api/client';
import { Brand, ThemeButton } from '../components/AppLayout';
import { DEMO } from './AuthPages';

const STEPS = [
  { icon: <BulbOutlined />, title: 'Say what you want', text: '"Sony noise-cancelling headphones under $150." The AI turns it into a search and finds the best matches across stores.' },
  { icon: <WalletOutlined />, title: 'PayPal holds your top price', text: 'You approve a $150 hold once. Nothing is charged, and the agent can never spend more than that.' },
  { icon: <EyeOutlined />, title: 'It waits, then buys', text: 'The agent watches the price. When it drops, the AI checks it’s the right item and PayPal charges only the real price.' },
];

export default function Landing() {
  const { login } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function tryDemo() {
    setBusy(true);
    setError(null);
    try {
      await login(DEMO);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <Brand to="/" />
        <div style={{ flex: 1 }} />
        <ThemeButton />
        <Link to="/login"><Button type="text">Log in</Button></Link>
      </header>
      <section className="hero">
        <div>
          <span className="eyebrow">AI shopping agent · PayPal</span>
          <h1>Tell it what you want. Walk away. It buys when the price is right.</h1>
          <p className="lead">
            WaitForIt watches prices for you. PayPal holds the most you'll pay, so you're only charged when there's a real deal, and only the real price.
          </p>
          <div className="hero-actions">
            <Button type="primary" size="large" loading={busy} onClick={tryDemo}>Try the demo</Button>
            <Link to="/register"><Button size="large">Create a free account</Button></Link>
          </div>
          {error && <Alert type="error" showIcon title={error} style={{ marginTop: 16 }} />}
          <p className="muted small" style={{ marginTop: 16 }}>Payments run in PayPal's sandbox, so no real money moves.</p>
        </div>
        <div className="hero-card" aria-hidden="true">
          <div className="hero-tag">
            <span className="old">$179</span>
            <span className="new">$129</span>
          </div>
          <div className="hero-rows">
            <div><span>PayPal held</span><span>$150</span></div>
            <div><span>Charged</span><strong>$129</strong></div>
            <div><span>Released to you</span><span>$21</span></div>
          </div>
          <div className="hero-note"><SafetyCertificateOutlined /> Never above your limit. Stop any time and the hold is released.</div>
        </div>
      </section>
      <section className="features">
        {STEPS.map((s, i) => (
          <div className="feature" key={s.title}>
            <div className="feature-icon">{s.icon}</div>
            <h3>{i + 1}. {s.title}</h3>
            <p>{s.text}</p>
          </div>
        ))}
      </section>
    </>
  );
}
