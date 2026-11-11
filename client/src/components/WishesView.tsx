'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, Empty, Input, InputNumber, Segmented, Skeleton, Steps, Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { useCreateWish, useStats, useWishes } from '@/lib/hooks';
import { errorMessage } from '@/lib/api';
import type { Wish } from '@/lib/types';
import { currentPrice, money, ProductImage, StatusLabel } from './common';

const EXAMPLES = [
  'Sony noise-cancelling headphones, black, under $150',
  'Lodge 12 inch cast iron skillet under $30',
  'Kids rain boots size 11, any color but pink, under $25',
  'Standing desk mat, at least 30 inches long, under $40',
];

// What the agent is doing while the request runs (a few seconds).
const WORK = ['Reading your wish', 'Searching stores', 'Checking matches and prices'];

function AgentWorking() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, WORK.length - 1)), 2000);
    return () => clearInterval(t);
  }, []);
  return <Steps size="small" current={step} style={{ marginTop: 16 }} items={WORK.map((title) => ({ title }))} />;
}

function NewWish() {
  const router = useRouter();
  const create = useCreateWish();
  const [text, setText] = useState('');
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [mode, setMode] = useState<'auto' | 'ask'>('auto');

  async function submit() {
    try {
      const wish = await create.mutateAsync({ text, maxPrice, mode });
      router.push(`/wish/?id=${wish._id}`);
    } catch {
      // Shown below.
    }
  }

  return (
    <Card title="New wish">
      <Input.TextArea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Describe what you want and the most you'd pay, e.g. “Sony noise-cancelling headphones under $150”"
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
      <div className="wish-form-row">
        <InputNumber<number>
          prefix="$"
          min={1}
          max={10000}
          value={maxPrice}
          onChange={(v) => setMaxPrice(v)}
          placeholder="Max price"
          disabled={create.isPending}
          style={{ width: 140 }}
          aria-label="Most you would pay (optional if it's in the text)"
        />
        <Segmented<'auto' | 'ask'>
          value={mode}
          onChange={setMode}
          disabled={create.isPending}
          options={[
            { label: 'Auto-buy', value: 'auto' },
            { label: 'Ask me first', value: 'ask' },
          ]}
        />
        <Tooltip title="Auto-buy: the agent buys as soon as it finds a verified deal. Ask me first: it finds the deal and waits for you to approve.">
          <QuestionCircleOutlined className="muted" aria-label="What do these mean?" />
        </Tooltip>
        <div style={{ flex: 1 }} />
        <Button type="primary" loading={create.isPending} disabled={text.trim().length < 3} onClick={submit}>
          Start shopping
        </Button>
      </div>
      {!create.isPending && !text && (
        <div className="examples">
          <span className="muted small">Examples:</span>
          {EXAMPLES.map((ex) => (
            <button type="button" key={ex} className="example" onClick={() => setText(ex)}>
              {ex}
            </button>
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
    { label: 'Active wishes', value: data?.watching ?? '—' },
    { label: 'Held on PayPal', value: data ? money(data.held) : '—' },
    { label: 'Bought', value: data?.bought ?? '—' },
    { label: 'Saved by waiting', value: data ? money(data.saved) : '—' },
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

function summary(w: Wish) {
  const now = currentPrice(w);
  switch (w.status) {
    case 'choosing':
      return 'Pick one of the products I found';
    case 'needs_payment':
      return `Now ${money(now)} · approve the PayPal hold to start`;
    case 'watching':
      return `Now ${money(now)} · buying at ${money(w.maxPrice)} or less${w.mode === 'ask' ? ' (asks first)' : ''}`;
    case 'awaiting_approval':
      return `Found it for ${money(w.pending?.price)}. Approve to buy`;
    case 'bought':
      return `Bought at ${w.purchase?.domain}${w.purchase?.saved ? ` · saved ${money(w.purchase.saved)}` : ''}`;
    case 'refunded':
      return 'Purchase undone. PayPal refunded it';
    case 'expired':
      return 'The hold expired. Nothing was charged';
    default:
      return 'Stopped. Nothing was charged';
  }
}

function WishRow({ wish }: { wish: Wish }) {
  const title = wish.chosen?.title ?? wish.plan?.summary ?? wish.text;
  const amount = wish.status === 'bought' ? wish.purchase?.price : wish.maxPrice;
  return (
    <Link href={`/wish/?id=${wish._id}`} className="wish-row">
      <ProductImage src={wish.chosen?.image} size={48} />
      <div style={{ minWidth: 0 }}>
        <div className="title">{title}</div>
        <div className="muted small">{summary(wish)}</div>
      </div>
      <div className="hide-sm">
        <StatusLabel status={wish.status} />
        {wish.payment?.sample && <span className="muted small" style={{ marginLeft: 6 }}>Sample</span>}
      </div>
      <div className="num">
        <div style={{ fontWeight: 600 }}>{money(amount)}</div>
        <div className="muted small">{wish.status === 'bought' ? 'paid' : 'limit'}</div>
      </div>
    </Link>
  );
}

export default function WishesView() {
  const { data: wishes, isLoading, isError, error } = useWishes();

  return (
    <>
      <div className="page-header">
        <div>
          <h1>My wishes</h1>
          <p className="muted" style={{ margin: 0 }}>Tell the agent what you want. It finds the best match and buys when the price is right.</p>
        </div>
      </div>
      <NewWish />
      <Stats />
      <h2 className="section-title">All wishes</h2>
      {isError && <Alert type="error" showIcon title={errorMessage(error)} />}
      {isLoading && <Skeleton active />}
      {wishes?.length === 0 && <Empty description="No wishes yet. Describe something above to start." />}
      {!!wishes?.length && (
        <div className="wish-table">
          {wishes.map((w) => (
            <WishRow key={w._id} wish={w} />
          ))}
        </div>
      )}
    </>
  );
}
