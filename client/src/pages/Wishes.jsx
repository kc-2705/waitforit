import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Empty, Input, InputNumber, Skeleton, Steps, Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useCreateWish, useStats, useWishes } from '../api/hooks';
import { errorMessage } from '../api/client';
import { currentPrice, money, ProductImage, StatusTag } from '../components/common';

const EXAMPLES = [
  'Sony noise-cancelling headphones, black, under $150',
  'A cast iron skillet, 12 inch, Lodge is fine, under $30',
  'Kids rain boots size 11, any bright color, under $25',
  'A standing desk mat, at least 30 inches long, under $40',
];

// What the agent is doing while the request runs (it takes a few seconds).
const WORK = ['Reading your wish', 'Searching stores', 'Checking which ones match'];

function AgentWorking() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, WORK.length - 1)), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <Steps
      size="small"
      current={step}
      status="process"
      style={{ marginTop: 16 }}
      items={WORK.map((title, i) => ({ title, status: i < step ? 'finish' : i === step ? 'process' : 'wait' }))}
    />
  );
}

function NewWish() {
  const navigate = useNavigate();
  const create = useCreateWish();
  const [text, setText] = useState('');
  const [maxPrice, setMaxPrice] = useState(null);

  async function submit() {
    try {
      const wish = await create.mutateAsync({ text, maxPrice });
      navigate(`/wishes/${wish._id}`);
    } catch {
      // Shown below.
    }
  }

  return (
    <Card className="new-wish">
      <h2 className="display" style={{ margin: '0 0 4px' }}>What are you waiting to buy?</h2>
      <p className="muted" style={{ marginTop: 0 }}>Describe it like you'd tell a friend, with the most you'd pay. I'll find it and watch the price.</p>
      <Input.TextArea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={EXAMPLES[0]}
        autoSize={{ minRows: 2, maxRows: 5 }}
        maxLength={500}
        disabled={create.isPending}
        onPressEnter={(e) => {
          if (!e.shiftKey && text.trim().length >= 3) {
            e.preventDefault();
            submit();
          }
        }}
        aria-label="Describe what you want"
      />
      <div className="new-wish-row">
        <InputNumber
          prefix="$"
          min={1}
          max={10000}
          value={maxPrice}
          onChange={setMaxPrice}
          placeholder="Max price"
          disabled={create.isPending}
          style={{ width: 150 }}
          aria-label="Most you would pay (optional if it's in the text)"
        />
        <span className="muted small">Optional if it's in your text.</span>
        <div style={{ flex: 1 }} />
        <Button type="primary" size="large" icon={<SearchOutlined />} loading={create.isPending} disabled={text.trim().length < 3} onClick={submit}>
          Start shopping
        </Button>
      </div>
      {!create.isPending && !text && (
        <div className="examples">
          <span className="muted small">Try:</span>
          {EXAMPLES.map((ex) => (
            <Tag key={ex} className="example" onClick={() => setText(ex)}>{ex}</Tag>
          ))}
        </div>
      )}
      {create.isPending && <AgentWorking />}
      {create.isError && <Alert type="error" showIcon title={errorMessage(create.error)} style={{ marginTop: 16 }} />}
    </Card>
  );
}

function Stats() {
  const { data } = useStats();
  const items = [
    { label: 'Watching', value: data?.watching ?? '—' },
    { label: 'Held on PayPal', value: data ? money(data.held) : '—' },
    { label: 'Bought', value: data?.bought ?? '—' },
    { label: 'Saved', value: data ? money(data.saved) : '—' },
  ];
  return (
    <div className="stat-row">
      {items.map((s) => (
        <div className="stat" key={s.label}>
          <div className="label">{s.label}</div>
          <div className="value">{s.value}</div>
        </div>
      ))}
    </div>
  );
}

function WishCard({ wish }) {
  const now = currentPrice(wish);
  const title = wish.chosen?.title ?? wish.plan?.summary ?? wish.text;
  let line = 'Pick one of the products I found.';
  if (wish.status === 'needs_payment') line = `Now ${money(now)} · your limit ${money(wish.maxPrice)}`;
  if (wish.status === 'watching') line = `Now ${money(now)} · buying at ${money(wish.maxPrice)} or less`;
  if (wish.status === 'bought') line = `Bought for ${money(wish.purchase?.price)}${wish.purchase?.saved ? ` · saved ${money(wish.purchase.saved)}` : ''}`;
  if (wish.status === 'cancelled') line = 'Stopped. Nothing was charged.';
  if (wish.status === 'expired') line = 'The hold expired. Nothing was charged.';

  return (
    <Link to={`/wishes/${wish._id}`} className="wish-card">
      <ProductImage src={wish.chosen?.image} alt="" size={72} />
      <div className="wish-card-body">
        <div className="wish-card-top">
          <StatusTag status={wish.status} />
          {wish.payment?.sample && <Tag variant="filled">Sample</Tag>}
        </div>
        <div className="title">{title}</div>
        <div className="muted small">{line}</div>
      </div>
    </Link>
  );
}

export default function Wishes() {
  const { data: wishes, isLoading, isError, error } = useWishes();

  return (
    <>
      <NewWish />
      <Stats />
      <h2 className="display section-title">My wishes</h2>
      {isError && <Alert type="error" showIcon title={errorMessage(error)} />}
      {isLoading && <Skeleton active />}
      {wishes?.length === 0 && <Empty description="No wishes yet. Describe something above to start." />}
      <div className="wish-grid">
        {wishes?.map((w) => <WishCard key={w._id} wish={w} />)}
      </div>
    </>
  );
}
