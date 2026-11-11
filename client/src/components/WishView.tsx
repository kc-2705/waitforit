'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, App, Button, Card, InputNumber, Popconfirm, Result, Segmented, Skeleton, Space, Steps, Timeline, Tooltip } from 'antd';
import {
  ArrowLeftOutlined,
  BulbOutlined,
  CheckCircleFilled,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  FallOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SearchOutlined,
  WalletOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  useApprove,
  useCancelWish,
  useCheckNow,
  useChoose,
  useConfig,
  useDecline,
  useDeleteWish,
  useRefund,
  useSetMode,
  useSimulateDrop,
  useWish,
} from '@/lib/hooks';
import { errorMessage } from '@/lib/api';
import type { JournalKind, Wish } from '@/lib/types';
import { currentPrice, money, ProductImage, StatusLabel } from './common';
import PayPalHold from './PayPalHold';
import PriceChart from './PriceChart';

dayjs.extend(relativeTime);

const HOLDING = ['watching', 'awaiting_approval'];
const REFUND_WINDOW_MS = 24 * 3600_000;

/** Shows a failed action as a toast. */
function useFail() {
  const { message } = App.useApp();
  return (e: unknown) => message.error(errorMessage(e));
}

// ---------------------------------------------------------------- Where am I?

const STEP_OF: Record<Wish['status'], number> = {
  choosing: 0,
  needs_payment: 1,
  watching: 2,
  awaiting_approval: 2,
  buying: 2,
  bought: 4,
  refunded: 4,
  cancelled: 2,
  expired: 2,
};

function Progress({ wish }: { wish: Wish }) {
  const stopped = ['cancelled', 'expired'].includes(wish.status);
  const third = stopped ? 'Stopped' : wish.status === 'awaiting_approval' ? 'Waiting for your OK' : 'Agent watches the price';
  return (
    <Card size="small" style={{ marginBottom: 16 }}>
      <Steps
        size="small"
        current={Math.min(STEP_OF[wish.status], 3)}
        status={stopped ? 'error' : ['bought', 'refunded'].includes(wish.status) ? 'finish' : 'process'}
        responsive
        items={[
          { title: 'Pick a product' },
          { title: 'Approve PayPal hold' },
          { title: third },
          { title: wish.status === 'refunded' ? 'Bought, then refunded' : 'Bought' },
        ]}
      />
    </Card>
  );
}

// ---------------------------------------------------------------- Side panel

function Understood({ wish }: { wish: Wish }) {
  const { plan } = wish;
  const chips = (label: string, list: string[]) =>
    list?.length ? (
      <div className="chips">
        <span className="muted small">{label}:</span>
        {list.map((x) => (
          <span key={x} className="chip">{x}</span>
        ))}
      </div>
    ) : null;
  return (
    <Card size="small" title="What I understood">
      <p style={{ margin: 0 }}>{plan.summary}</p>
      {chips('Brands', plan.brands)}
      {chips('Must have', plan.mustHave)}
      {chips('Avoid', plan.avoid)}
      <div className="chips">
        <span className="muted small">Condition:</span>
        <span className="chip">{plan.condition === 'new' ? 'New only' : 'New or used'}</span>
        <span className="muted small">Limit:</span>
        <span className="chip">{money(wish.maxPrice)}</span>
      </div>
    </Card>
  );
}

const KIND: Record<JournalKind, { icon: React.ReactNode; color: string }> = {
  think: { icon: <BulbOutlined />, color: 'gray' },
  search: { icon: <SearchOutlined />, color: 'gray' },
  pay: { icon: <WalletOutlined />, color: 'blue' },
  check: { icon: <EyeOutlined />, color: 'gray' },
  drop: { icon: <FallOutlined />, color: 'blue' },
  ask: { icon: <QuestionCircleOutlined />, color: 'blue' },
  buy: { icon: <CheckCircleFilled />, color: 'green' },
  wait: { icon: <EyeOutlined />, color: 'gray' },
  cancel: { icon: <CloseCircleOutlined />, color: 'gray' },
  refund: { icon: <RollbackOutlined />, color: 'gray' },
  error: { icon: <WarningOutlined />, color: 'red' },
};

function Journal({ journal }: { journal: Wish['journal'] }) {
  return (
    <Card size="small" title="Agent activity" extra={<span className="muted small">Newest first</span>}>
      <Timeline
        items={[...journal].reverse().map((e, i) => ({
          key: i,
          color: KIND[e.kind]?.color,
          icon: KIND[e.kind]?.icon,
          content: (
            <div className="small">
              <div>{e.message}</div>
              <Tooltip title={dayjs(e.at).format('MMM D, YYYY h:mm A')}>
                <span className="muted">{dayjs(e.at).fromNow()}</span>
              </Tooltip>
            </div>
          ),
        }))}
      />
    </Card>
  );
}

// ---------------------------------------------------------------- Fair-price advice

const VERDICT: Record<NonNullable<Wish['advice']>['verdict'], string> = {
  already_met: 'Already at your price',
  realistic: 'Your limit looks realistic',
  stretch: 'Your limit is a stretch',
  unlikely: 'Your limit is unlikely',
};

function AdviceBox({ wish }: { wish: Wish }) {
  if (!wish.advice) return null;
  const { verdict, message, suggestedPrice, low, typical } = wish.advice;
  return (
    <div className="advice">
      <BulbOutlined style={{ color: 'var(--accent)', fontSize: 18, marginTop: 2 }} />
      <div>
        <div className="verdict">{VERDICT[verdict]}</div>
        <div className="small" style={{ marginTop: 2 }}>{message}</div>
        <div className="muted small" style={{ marginTop: 6 }}>
          Lowest now {money(low)} · typical {money(typical)}
          {verdict !== 'already_met' && suggestedPrice !== wish.maxPrice ? ` · a more likely limit: ${money(suggestedPrice)}` : ''}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Step 1: pick a product

function Candidates({ wish, onPicked }: { wish: Wish; onPicked: () => void }) {
  const choose = useChoose();
  const fail = useFail();
  return (
    <Card title="1. Pick the one you want" extra={<span className="muted small">Sorted by how well they match</span>}>
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <AdviceBox wish={wish} />
        <div className="candidates">
          {wish.candidates.map((c) => {
            const picked = wish.chosen?.productId === c.productId;
            const underLimit = c.bestOffer.price <= wish.maxPrice;
            return (
              <div key={c.productId} className={`candidate${picked ? ' picked' : ''}`}>
                <ProductImage src={c.image} alt={c.title} size={96} />
                <div className="fit">
                  Match <b>{c.fit}%</b>
                  {c.brand ? ` · ${c.brand}` : ''}
                </div>
                <div className="title">{c.title}</div>
                {c.reason && <p className="reason">{c.reason}</p>}
                <div>
                  <span className="price">{money(c.bestOffer.price)}</span>{' '}
                  <span className="muted small">
                    at {c.bestOffer.domain}
                    {(c.offerCount ?? 0) > 1 ? ` · ${c.offerCount} stores` : ''}
                  </span>
                </div>
                {underLimit && <span className="status done" style={{ justifySelf: 'start' }}>Under your limit now</span>}
                <Button
                  type={picked ? 'primary' : 'default'}
                  block
                  icon={picked ? <CheckCircleOutlined /> : null}
                  loading={choose.isPending && choose.variables?.productId === c.productId}
                  onClick={() => choose.mutate({ id: wish._id, productId: c.productId }, { onSuccess: onPicked, onError: fail })}
                >
                  {picked ? 'Selected' : 'Select'}
                </Button>
              </div>
            );
          })}
        </div>
      </Space>
    </Card>
  );
}

// ---------------------------------------------------------------- Auto-buy / Ask me first

function ModeSwitch({ wish }: { wish: Wish }) {
  const setMode = useSetMode();
  const fail = useFail();
  return (
    <Space size={8} wrap>
      <span className="muted small">When I find a deal:</span>
      <Segmented<'auto' | 'ask'>
        size="small"
        value={wish.mode}
        disabled={setMode.isPending}
        onChange={(mode) => setMode.mutate({ id: wish._id, mode }, { onError: fail })}
        options={[
          { label: 'Buy it', value: 'auto' },
          { label: 'Ask me first', value: 'ask' },
        ]}
      />
    </Space>
  );
}

// ---------------------------------------------------------------- Step 2: PayPal hold

function HoldStep({ wish }: { wish: Wish }) {
  const now = currentPrice(wish);
  const alreadyDeal = now != null && now <= wish.maxPrice;
  return (
    <Card title="2. Approve a PayPal hold for your top price">
      <div className="hold-grid">
        <div>
          <div className="muted small">PayPal will hold</div>
          <div className="hold-amount">{money(wish.maxPrice)}</div>
          <ul className="check-list">
            <li><CheckCircleFilled />Nothing is charged until the agent buys.</li>
            <li><CheckCircleFilled />You pay only the real price. The rest of the hold is released.</li>
            <li><CheckCircleFilled />Stop any time and the whole hold is released.</li>
          </ul>
          <ModeSwitch wish={wish} />
          {alreadyDeal && (
            <Alert
              type="info"
              showIcon
              style={{ marginTop: 14 }}
              title={`It’s already ${money(now)}, under your limit, so the agent will ${wish.mode === 'ask' ? 'ask you' : 'buy'} right after you approve.`}
            />
          )}
        </div>
        <div>
          <PayPalHold wish={wish} />
          <div className="note">
            <b>Test mode (PayPal sandbox).</b> In the PayPal window choose <b>Log in</b> and use a sandbox buyer account (…@personal.example.com), or a
            PayPal test card. Never enter a real card.
          </div>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- Step 3: watching

function SimulateDrop({ wish, now }: { wish: Wish; now: number }) {
  const drop = useSimulateDrop();
  const fail = useFail();
  const suggestion = Math.max(1, Math.floor(Math.min(now - 1, wish.maxPrice - Math.max(1, wish.maxPrice * 0.08))));
  const [price, setPrice] = useState<number | null>(suggestion);
  return (
    <div className="demo-box">
      <span className="small">
        <b>Demo:</b> <span className="muted">real sales can take days. Pretend the store drops its price to</span>
      </span>
      <Space.Compact>
        <InputNumber<number> prefix="$" min={1} max={now - 0.01} value={price} onChange={setPrice} aria-label="Simulated new price" />
        <Button icon={<FallOutlined />} loading={drop.isPending} disabled={!price} onClick={() => price && drop.mutate({ id: wish._id, price }, { onError: fail })}>
          Simulate drop
        </Button>
      </Space.Compact>
    </div>
  );
}

function Watching({ wish }: { wish: Wish }) {
  const { data: config } = useConfig();
  const check = useCheckNow();
  const cancel = useCancelWish();
  const fail = useFail();
  const now = currentPrice(wish) ?? 0;
  const gap = now - wish.maxPrice;

  return (
    <Card title="Watching the price" extra={<span className="muted small">Last checked {wish.lastCheckedAt ? dayjs(wish.lastCheckedAt).fromNow() : 'never'}</span>}>
      <div className="kv-grid">
        <div className="kv"><div className="label">Lowest now</div><div className="value">{money(now)}</div></div>
        <div className="kv"><div className="label">Your limit</div><div className="value">{money(wish.maxPrice)}</div></div>
        <div className="kv"><div className="label">Needs to drop</div><div className="value">{gap > 0 ? money(Math.round(gap * 100) / 100) : 'Ready'}</div></div>
        <div className="kv"><div className="label">Held on PayPal</div><div className="value">{money(wish.payment.held)}</div></div>
      </div>
      <PriceChart prices={wish.prices} limit={wish.maxPrice} />
      <div className="actions" style={{ justifyContent: 'space-between' }}>
        <Space wrap>
          <Button icon={<ReloadOutlined />} loading={check.isPending} onClick={() => check.mutate({ id: wish._id }, { onError: fail })}>
            Check now
          </Button>
          <Popconfirm
            title="Stop watching?"
            description={`Your ${money(wish.payment.held)} PayPal hold will be released.`}
            okText="Stop and release"
            onConfirm={() => cancel.mutateAsync({ id: wish._id }).catch(fail)}
          >
            <Button danger loading={cancel.isPending}>Stop and release hold</Button>
          </Popconfirm>
        </Space>
        <ModeSwitch wish={wish} />
      </div>
      {config?.demoTools && now > 1 && <SimulateDrop key={now} wish={wish} now={now} />}
    </Card>
  );
}

// ---------------------------------------------------------------- Ask me first: approval

function Approval({ wish }: { wish: Wish }) {
  const approve = useApprove();
  const decline = useDecline();
  const cancel = useCancelWish();
  const fail = useFail();
  const deal = wish.pending!;
  const busy = approve.isPending || decline.isPending || cancel.isPending;
  return (
    <Card title="The agent found a deal. Buy it?">
      <div className="approval">
        <div className="muted small">Lowest price at {deal.domain}</div>
        <div className="big">{money(deal.price)}</div>
        <div className="small" style={{ marginTop: 6 }}>
          <BulbOutlined /> {deal.reason}
        </div>
        <div className="muted small" style={{ marginTop: 6 }}>
          PayPal will charge {money(deal.price)} and release the other {money(Math.round(((wish.payment.held ?? 0) - deal.price) * 100) / 100)} of your hold.
          {deal.simulated ? ' (Price drop simulated for the demo.)' : ''}
        </div>
      </div>
      <div className="actions">
        <Button type="primary" loading={approve.isPending} disabled={busy} onClick={() => approve.mutate({ id: wish._id }, { onError: fail })}>
          Approve and buy for {money(deal.price)}
        </Button>
        <Button disabled={busy} loading={decline.isPending} onClick={() => decline.mutate({ id: wish._id }, { onError: fail })}>
          Not this one, keep watching
        </Button>
        <Popconfirm title="Stop and release your hold?" okText="Stop" onConfirm={() => cancel.mutateAsync({ id: wish._id }).catch(fail)}>
          <Button type="text" danger disabled={busy}>Stop</Button>
        </Popconfirm>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- Done

function Receipt({ wish }: { wish: Wish }) {
  const refund = useRefund();
  const fail = useFail();
  const { payment, purchase } = wish;
  if (!purchase) return null;
  const refunded = wish.status === 'refunded';
  const canUndo = !refunded && !payment.sample && Date.now() - new Date(purchase.at).getTime() < REFUND_WINDOW_MS;

  return (
    <Card>
      <div className="receipt-head">
        {refunded ? <RollbackOutlined style={{ color: 'var(--muted)' }} /> : <CheckCircleFilled />}
        <div>
          <h2>{refunded ? `Refunded ${money(payment.paid)}` : `Bought for ${money(purchase.price)}`}</h2>
          <div className="muted small">
            {refunded
              ? `You undid this purchase ${dayjs(purchase.refundedAt).fromNow()}. PayPal returned the full amount.`
              : purchase.saved > 0
                ? `You saved ${money(purchase.saved)} by waiting.`
                : 'Bought at your price.'}
          </div>
        </div>
      </div>
      <div className="rows">
        <div><span>PayPal held</span><span>{money(payment.held)}</span></div>
        <div><span>Charged</span><strong>{money(payment.paid)}</strong></div>
        <div><span>Released back to you</span><span>{money(payment.released)}</span></div>
        {refunded && <div><span>Refunded</span><span>{money(payment.paid)}</span></div>}
        <div>
          <span>Store</span>
          <span>{purchase.url ? <a href={purchase.url} target="_blank" rel="noreferrer">{purchase.domain}</a> : purchase.domain}</span>
        </div>
        <div><span>PayPal capture ID</span><code>{payment.captureId}</code></div>
        {payment.refundId && <div><span>PayPal refund ID</span><code>{payment.refundId}</code></div>}
        {payment.shipTo && <div><span>Ship to</span><span>{payment.shipTo}</span></div>}
      </div>
      <Alert type="info" showIcon icon={<BulbOutlined />} title="Why the agent bought it" description={purchase.reason} style={{ marginTop: 16 }} />
      {canUndo && (
        <div className="actions">
          <Popconfirm
            title="Undo this purchase?"
            description={`PayPal will refund the full ${money(payment.paid)}.`}
            okText="Undo and refund"
            onConfirm={() => refund.mutateAsync({ id: wish._id }).catch(fail)}
          >
            <Button icon={<RollbackOutlined />} loading={refund.isPending}>Undo purchase</Button>
          </Popconfirm>
          <span className="muted small" style={{ alignSelf: 'center' }}>
            Available until {dayjs(purchase.at).add(24, 'hour').format('MMM D, h:mm A')}
          </span>
        </div>
      )}
      {(purchase.simulated || payment.sample) && (
        <p className="muted small" style={{ marginTop: 12, marginBottom: 0 }}>
          {payment.sample
            ? 'This is a sample to show how a finished wish looks.'
            : 'The price drop was simulated for the demo. The PayPal hold, capture and refund are real sandbox transactions.'}
        </p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- Page

export default function WishView() {
  const id = useSearchParams().get('id');
  const router = useRouter();
  const { data: wish, isLoading, isError, error } = useWish(id);
  const remove = useDeleteWish();
  const fail = useFail();
  const [changing, setChanging] = useState(false);

  if (!id || isError) {
    return (
      <Result
        status="404"
        title="Wish not found"
        subTitle={isError ? errorMessage(error) : 'This link is missing the wish id.'}
        extra={<Link href="/wishes/"><Button>Back to my wishes</Button></Link>}
      />
    );
  }
  if (isLoading || !wish) return <Skeleton active paragraph={{ rows: 8 }} />;

  const canDelete = ![...HOLDING, 'buying'].includes(wish.status);
  const showCandidates = wish.status === 'choosing' || (wish.status === 'needs_payment' && changing);

  return (
    <>
      <div className="page-header">
        <div style={{ minWidth: 0 }}>
          <Link href="/wishes/" className="back-link"><ArrowLeftOutlined /> My wishes</Link>
          <h1>{wish.text}</h1>
          <Space wrap>
            <StatusLabel status={wish.status} />
            <span className="muted small">{wish.mode === 'ask' ? 'Asks before buying' : 'Buys automatically'}</span>
            {wish.payment?.sample && <span className="muted small">· Sample</span>}
          </Space>
        </div>
        {canDelete && (
          <Popconfirm
            title="Delete this wish?"
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => remove.mutateAsync(wish._id).then(() => router.push('/wishes/')).catch(fail)}
          >
            <Button type="text" danger>Delete</Button>
          </Popconfirm>
        )}
      </div>

      <Progress wish={wish} />

      <div className="detail-grid">
        <div className="stack">
          {wish.chosen && wish.status !== 'choosing' && (
            <Card>
              <div className="chosen">
                <ProductImage src={wish.chosen.image} alt={wish.chosen.title} size={80} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="muted small">{wish.status === 'needs_payment' ? 'Selected product' : wish.chosen.brand}</div>
                  <div className="title">{wish.chosen.title}</div>
                  {!!wish.chosen.features?.length && <div className="muted small">{wish.chosen.features.slice(0, 3).join(' · ')}</div>}
                </div>
                {wish.status === 'needs_payment' && (
                  <Button type="link" onClick={() => setChanging((c) => !c)}>{changing ? 'Hide options' : 'Change'}</Button>
                )}
              </div>
            </Card>
          )}
          {showCandidates && <Candidates wish={wish} onPicked={() => setChanging(false)} />}
          {wish.status === 'needs_payment' && <HoldStep wish={wish} />}
          {wish.status === 'watching' && <Watching wish={wish} />}
          {wish.status === 'awaiting_approval' && <Approval wish={wish} />}
          {wish.status === 'buying' && <Card>Working on it…</Card>}
          {['bought', 'refunded'].includes(wish.status) && <Receipt wish={wish} />}
          {['bought', 'refunded', 'awaiting_approval'].includes(wish.status) && wish.prices.length > 1 && (
            <Card title="Price while the agent waited">
              <PriceChart prices={wish.prices} limit={wish.maxPrice} />
            </Card>
          )}
          {['cancelled', 'expired'].includes(wish.status) && (
            <Card>
              <Result status="info" title={wish.status === 'expired' ? 'The PayPal hold expired' : 'Stopped watching'} subTitle="Nothing was charged." />
            </Card>
          )}
        </div>
        <div className="stack">
          <Understood wish={wish} />
          <Journal journal={wish.journal} />
        </div>
      </div>
    </>
  );
}
