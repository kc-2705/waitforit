import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, App, Button, Card, InputNumber, Popconfirm, Result, Skeleton, Space, Steps, Tag, Timeline, Tooltip } from 'antd';
import {
  ArrowLeftOutlined,
  BulbOutlined,
  CheckCircleFilled,
  CloseCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  FallOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShoppingOutlined,
  WalletOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useCancelWish, useCheckNow, useChoose, useConfig, useDeleteWish, useSimulateDrop, useWish } from '../api/hooks';
import { errorMessage } from '../api/client';
import { currentPrice, money, ProductImage, StatusTag } from '../components/common';
import PayPalHold from '../components/PayPalHold';
import PriceChart from '../components/PriceChart';

dayjs.extend(relativeTime);

// ---------------------------------------------------------------- What the AI understood

function Understood({ wish }) {
  const { plan } = wish;
  const chips = (label, list, color) =>
    list?.length ? (
      <div className="chips">
        <span className="muted small">{label}</span>
        {list.map((x) => <Tag key={x} color={color} variant="filled">{x}</Tag>)}
      </div>
    ) : null;
  return (
    <Card size="small" title={<><BulbOutlined /> What I understood</>}>
      <p style={{ marginTop: 0 }}>{plan.summary}</p>
      {chips('Brands', plan.brands, 'cyan')}
      {chips('Must have', plan.mustHave, 'green')}
      {chips('Avoid', plan.avoid, 'red')}
      <div className="chips">
        <span className="muted small">Condition</span>
        <Tag variant="filled">{plan.condition === 'new' ? 'New only' : 'New or used'}</Tag>
        <span className="muted small">Limit</span>
        <Tag variant="filled">{money(wish.maxPrice)}</Tag>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- Agent journal

const KIND = {
  think: { icon: <BulbOutlined />, color: 'gray' },
  search: { icon: <SearchOutlined />, color: 'blue' },
  pay: { icon: <WalletOutlined />, color: 'blue' },
  check: { icon: <EyeOutlined />, color: 'gray' },
  drop: { icon: <FallOutlined />, color: 'orange' },
  buy: { icon: <CheckCircleFilled />, color: 'green' },
  wait: { icon: <EyeOutlined />, color: 'gray' },
  cancel: { icon: <CloseCircleOutlined />, color: 'gray' },
  error: { icon: <WarningOutlined />, color: 'red' },
};

function Journal({ journal }) {
  return (
    <Card size="small" title="Agent journal" extra={<span className="muted small">Newest first</span>}>
      <Timeline
        items={[...journal].reverse().map((e, i) => ({
          key: i,
          color: KIND[e.kind]?.color,
          icon: KIND[e.kind]?.icon,
          content: (
            <div>
              <div>{e.message}</div>
              <Tooltip title={dayjs(e.at).format('MMM D, YYYY h:mm A')}>
                <span className="muted small">{dayjs(e.at).fromNow()}</span>
              </Tooltip>
            </div>
          ),
        }))}
      />
    </Card>
  );
}

// ---------------------------------------------------------------- Step 1: pick a product

function Candidates({ wish, onPicked }) {
  const choose = useChoose();
  const { message } = App.useApp();
  return (
    <Card title="1. Pick the one you want" extra={<span className="muted small">Sorted by how well they match</span>}>
      <div className="candidates">
        {wish.candidates.map((c) => {
          const picked = wish.chosen?.productId === c.productId;
          return (
            <div key={c.productId} className={`candidate${picked ? ' picked' : ''}`}>
              <ProductImage src={c.image} alt={c.title} size={110} />
              <div className="candidate-body">
                <Tooltip title="How well it matches your wish (the AI's score)">
                  <span className={`fit ${c.fit >= 75 ? 'high' : c.fit >= 50 ? 'mid' : 'low'}`}>{c.fit}% match</span>
                </Tooltip>
                <div className="title">{c.title}</div>
                <div className="muted small">{c.brand}</div>
                <p className="small reason">{c.reason}</p>
                <div className="price-line">
                  <strong>{money(c.bestOffer.price)}</strong>
                  <span className="muted small">at {c.bestOffer.domain}{c.offerCount > 1 ? ` · ${c.offerCount} stores` : ''}</span>
                </div>
                {c.bestOffer.price <= wish.maxPrice && (
                  <Tooltip title="Already at or under your limit, so I'd buy it right after the PayPal hold.">
                    <Tag color="green" variant="filled" style={{ justifySelf: 'start' }}>Under your limit now</Tag>
                  </Tooltip>
                )}
                <Button
                  type={picked ? 'primary' : 'default'}
                  block
                  icon={picked ? <CheckCircleFilled /> : null}
                  loading={choose.isPending && choose.variables?.productId === c.productId}
                  onClick={() =>
                    choose.mutate({ id: wish._id, productId: c.productId }, { onSuccess: onPicked, onError: (e) => message.error(errorMessage(e)) })
                  }
                >
                  {picked ? 'Picked' : 'Pick this'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- Step 2: PayPal hold

function HoldStep({ wish }) {
  const now = currentPrice(wish);
  const alreadyDeal = now != null && now <= wish.maxPrice;
  return (
    <Card title="2. Hold your top price with PayPal" className="hold-card">
      <div className="hold-grid">
        <div>
          <div className="hold-amount">{money(wish.maxPrice)}</div>
          <ul className="hold-points">
            <li><CheckCircleFilled /> PayPal <b>holds</b> this amount. Nothing is charged yet.</li>
            <li><CheckCircleFilled /> When the price drops to {money(wish.maxPrice)} or less, I buy and you pay <b>only the real price</b>. The rest is released.</li>
            <li><CheckCircleFilled /> Stop any time and the whole hold is released.</li>
          </ul>
          {alreadyDeal && <Alert type="info" showIcon title={`It's already ${money(now)}, under your limit, so I'll buy it right after you approve. Want to wait for a lower price? Make a new wish with a lower limit.`} />}
        </div>
        <div>
          <PayPalHold wish={wish} />
          <Alert
            type="warning"
            showIcon
            style={{ marginTop: 10 }}
            title="Test mode (PayPal sandbox)"
            description={
              <>
                In the PayPal window, choose <b>Log in</b> and use a <b>sandbox buyer</b> account (…@personal.example.com). Or pay with a PayPal
                test card. Never enter a real card here.
              </>
            }
          />
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- Step 3: watching

function SimulateDrop({ wish, now }) {
  const drop = useSimulateDrop();
  const { message } = App.useApp();
  const suggestion = Math.max(1, Math.floor(Math.min(now - 1, wish.maxPrice - Math.max(1, wish.maxPrice * 0.08))));
  const [price, setPrice] = useState(suggestion);
  return (
    <div className="demo-box">
      <div>
        <Tag color="gold" variant="filled">Demo</Tag>
        <span className="small">Real sales can take days. Pretend the store dropped its price to:</span>
      </div>
      <Space.Compact>
        <InputNumber prefix="$" min={1} max={now - 0.01} value={price} onChange={setPrice} aria-label="Simulated new price" />
        <Button
          icon={<FallOutlined />}
          loading={drop.isPending}
          disabled={!price}
          onClick={() => drop.mutate({ id: wish._id, price }, { onError: (e) => message.error(errorMessage(e)) })}
        >
          Simulate drop
        </Button>
      </Space.Compact>
    </div>
  );
}

function Watching({ wish }) {
  const { data: config } = useConfig();
  const check = useCheckNow();
  const cancel = useCancelWish();
  const { message } = App.useApp();
  const now = currentPrice(wish);
  const gap = now - wish.maxPrice;

  return (
    <Card
      title={<><EyeOutlined /> Watching the price</>}
      extra={<span className="muted small">Last checked {wish.lastCheckedAt ? dayjs(wish.lastCheckedAt).fromNow() : 'never'}</span>}
    >
      <div className="numbers">
        <div><div className="label">Lowest now</div><div className="value">{money(now)}</div></div>
        <div><div className="label">Your limit</div><div className="value">{money(wish.maxPrice)}</div></div>
        <div><div className="label">Needs to drop</div><div className="value">{gap > 0 ? money(Math.round(gap * 100) / 100) : 'Ready'}</div></div>
        <div><div className="label">Held on PayPal</div><div className="value">{money(wish.payment.held)}</div></div>
      </div>
      <PriceChart prices={wish.prices} limit={wish.maxPrice} />
      <div className="actions">
        <Button icon={<ReloadOutlined />} loading={check.isPending} onClick={() => check.mutate({ id: wish._id }, { onError: (e) => message.error(errorMessage(e)) })}>
          Check now
        </Button>
        <Popconfirm
          title="Stop watching?"
          description={`Your ${money(wish.payment.held)} PayPal hold will be released.`}
          okText="Stop and release"
          onConfirm={() => cancel.mutateAsync({ id: wish._id }).catch((e) => message.error(errorMessage(e)))}
        >
          <Button danger loading={cancel.isPending}>Stop and release hold</Button>
        </Popconfirm>
      </div>
      {config?.demoTools && now > 1 && <SimulateDrop key={now} wish={wish} now={now} />}
    </Card>
  );
}

// ---------------------------------------------------------------- Done

function Receipt({ wish }) {
  const { payment, purchase } = wish;
  return (
    <Card className="receipt">
      <Result
        status="success"
        title={`Bought for ${money(purchase.price)}`}
        subTitle={purchase.saved > 0 ? `You saved ${money(purchase.saved)} by waiting.` : 'Bought at your price.'}
        style={{ padding: '8px 0 16px' }}
      />
      <div className="receipt-rows">
        <div><span>PayPal held</span><span>{money(payment.held)}</span></div>
        <div><span>Charged</span><strong>{money(payment.paid)}</strong></div>
        <div><span>Released back to you</span><span>{money(payment.released)}</span></div>
        <div><span>Store</span><span>{purchase.url ? <a href={purchase.url} target="_blank" rel="noreferrer">{purchase.domain}</a> : purchase.domain}</span></div>
        <div><span>PayPal capture id</span><code>{payment.captureId}</code></div>
        {payment.shipTo && <div><span>Ship to</span><span>{payment.shipTo}</span></div>}
      </div>
      <Alert type="info" showIcon icon={<BulbOutlined />} title="Why I bought it" description={purchase.reason} style={{ marginTop: 16 }} />
      {(purchase.simulated || payment.sample) && (
        <p className="muted small" style={{ marginTop: 12 }}>
          {payment.sample ? 'This is a sample to show how a finished wish looks.' : 'The price drop was simulated for the demo; the PayPal hold and capture are real sandbox transactions.'}
        </p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- Where am I?

const STEP_OF = { choosing: 0, needs_payment: 1, watching: 2, buying: 2, bought: 4, cancelled: 2, expired: 2 };

function Progress({ status }) {
  const stopped = ['cancelled', 'expired'].includes(status);
  return (
    <Card size="small" className="progress">
      <Steps
        size="small"
        current={Math.min(STEP_OF[status] ?? 0, 3)}
        status={stopped ? 'error' : status === 'bought' ? 'finish' : 'process'}
        responsive
        items={[
          { title: 'Pick a product', description: 'From what I found' },
          { title: 'Approve PayPal hold', description: 'Your top price' },
          { title: stopped ? 'Stopped' : 'I watch the price', description: stopped ? 'Nothing charged' : 'You can walk away' },
          { title: 'Bought', description: 'Only the real price' },
        ]}
      />
    </Card>
  );
}

// ---------------------------------------------------------------- Page

export default function WishDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: wish, isLoading, isError, error } = useWish(id);
  const remove = useDeleteWish();
  const { message } = App.useApp();
  const [changing, setChanging] = useState(false);

  if (isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (isError) {
    return <Result status="404" title="Wish not found" subTitle={errorMessage(error)} extra={<Link to="/wishes"><Button>Back to my wishes</Button></Link>} />;
  }

  const canDelete = !['watching', 'buying'].includes(wish.status);
  const showProduct = wish.chosen && wish.status !== 'choosing';
  // Once a product is picked, fold the other options away so the PayPal step is right there.
  const showCandidates = wish.status === 'choosing' || (wish.status === 'needs_payment' && changing);

  return (
    <>
      <div className="page-header">
        <div>
          <Link to="/wishes" className="muted small"><ArrowLeftOutlined /> My wishes</Link>
          <h1 className="wish-title">“{wish.text}”</h1>
          <Space wrap>
            <StatusTag status={wish.status} />
            {wish.payment?.sample && <Tag variant="filled">Sample</Tag>}
          </Space>
        </div>
        {canDelete && (
          <Popconfirm
            title="Delete this wish?"
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() =>
              remove.mutateAsync(wish._id).then(() => navigate('/wishes')).catch((e) => message.error(errorMessage(e)))
            }
          >
            <Button icon={<DeleteOutlined />} type="text" danger>Delete</Button>
          </Popconfirm>
        )}
      </div>

      <Progress status={wish.status} />

      <div className="detail-grid">
        <div className="detail-main">
          {showProduct && (
            <Card className="chosen">
              <ProductImage src={wish.chosen.image} alt={wish.chosen.title} size={88} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="muted small">{wish.status === 'needs_payment' ? 'You picked' : wish.chosen.brand}</div>
                <div className="title">{wish.chosen.title}</div>
                {wish.chosen.features?.length > 0 && <div className="muted small">{wish.chosen.features.slice(0, 3).join(' · ')}</div>}
              </div>
              {wish.status === 'needs_payment' && (
                <Button type="link" onClick={() => setChanging((c) => !c)}>{changing ? 'Hide options' : 'Change product'}</Button>
              )}
            </Card>
          )}
          {showCandidates && <Candidates wish={wish} onPicked={() => setChanging(false)} />}
          {wish.status === 'needs_payment' && <HoldStep wish={wish} />}
          {wish.status === 'watching' && <Watching wish={wish} />}
          {wish.status === 'buying' && <Card><ShoppingOutlined /> Buying it now…</Card>}
          {wish.status === 'bought' && <Receipt wish={wish} />}
          {wish.status === 'bought' && wish.prices.length > 1 && (
            <Card title="Price while I waited"><PriceChart prices={wish.prices} limit={wish.maxPrice} /></Card>
          )}
          {['cancelled', 'expired'].includes(wish.status) && (
            <Card><Result status="info" title={wish.status === 'expired' ? 'The PayPal hold expired' : 'Stopped watching'} subTitle="Nothing was charged." /></Card>
          )}
        </div>
        <div className="detail-side">
          <Understood wish={wish} />
          <Journal journal={wish.journal} />
        </div>
      </div>
    </>
  );
}
