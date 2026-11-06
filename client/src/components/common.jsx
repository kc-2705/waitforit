import { Tag } from 'antd';
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  LoadingOutlined,
  ShoppingOutlined,
  WalletOutlined,
} from '@ant-design/icons';

export const money = (n) =>
  n == null ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

const STATUS = {
  choosing: { label: 'Pick a product', color: 'default', icon: <ShoppingOutlined /> },
  needs_payment: { label: 'Needs PayPal hold', color: 'gold', icon: <WalletOutlined /> },
  watching: { label: 'Watching price', color: 'cyan', icon: <EyeOutlined /> },
  buying: { label: 'Buying…', color: 'processing', icon: <LoadingOutlined /> },
  bought: { label: 'Bought', color: 'green', icon: <CheckCircleFilled /> },
  cancelled: { label: 'Stopped', color: 'default', icon: <CloseCircleOutlined /> },
  expired: { label: 'Hold expired', color: 'default', icon: <ClockCircleOutlined /> },
};

export function StatusTag({ status }) {
  const s = STATUS[status] ?? STATUS.choosing;
  return (
    <Tag color={s.color} icon={s.icon} variant="filled" style={{ marginInlineEnd: 0 }}>
      {s.label}
    </Tag>
  );
}

/** Product photo, or a neutral placeholder when the store gave none. */
export function ProductImage({ src, alt, size = 96 }) {
  return (
    <div className="product-img" style={{ width: size, height: size }}>
      {src ? <img src={src} alt={alt} loading="lazy" /> : <ShoppingOutlined style={{ fontSize: size / 2.6 }} aria-hidden />}
    </div>
  );
}

/** Latest price the agent saw, or the first one when it hasn't checked yet. */
export const currentPrice = (wish) => wish.prices?.at(-1)?.price ?? wish.chosen?.bestOffer?.price ?? null;
