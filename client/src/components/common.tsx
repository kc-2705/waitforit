import { ShoppingOutlined } from '@ant-design/icons';
import type { Wish, WishStatus } from '@/lib/types';

export const money = (n: number | null | undefined) =>
  n == null ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

const STATUS: Record<WishStatus, { label: string; tone?: 'active' | 'done' | 'attention' }> = {
  choosing: { label: 'Pick a product' },
  needs_payment: { label: 'Needs PayPal hold', tone: 'attention' },
  watching: { label: 'Watching price', tone: 'active' },
  awaiting_approval: { label: 'Waiting for your OK', tone: 'attention' },
  buying: { label: 'Buying', tone: 'active' },
  bought: { label: 'Bought', tone: 'done' },
  refunded: { label: 'Refunded' },
  cancelled: { label: 'Stopped' },
  expired: { label: 'Hold expired' },
};

export function StatusLabel({ status }: { status: WishStatus }) {
  const s = STATUS[status] ?? STATUS.choosing;
  return <span className={`status${s.tone ? ` ${s.tone}` : ''}`}>{s.label}</span>;
}

/** Product photo, or a neutral placeholder when the store gave none. */
export function ProductImage({ src, alt = '', size = 96 }: { src?: string | null; alt?: string; size?: number }) {
  return (
    <div className="product-img" style={{ width: size, height: size }}>
      {/* Store images come from many domains, so a plain img is used (the site is a static export). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt={alt} loading="lazy" /> : <ShoppingOutlined style={{ fontSize: size / 2.8 }} aria-hidden />}
    </div>
  );
}

/** Latest price the agent saw, or the first one when it hasn't checked yet. */
export const currentPrice = (wish: Wish) => wish.prices?.at(-1)?.price ?? wish.chosen?.bestOffer?.price ?? null;
