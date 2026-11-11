// Shapes returned by the WaitForIt API.

export type WishStatus =
  | 'choosing'
  | 'needs_payment'
  | 'watching'
  | 'awaiting_approval'
  | 'buying'
  | 'bought'
  | 'refunded'
  | 'cancelled'
  | 'expired';

export type JournalKind = 'think' | 'search' | 'pay' | 'check' | 'drop' | 'ask' | 'buy' | 'wait' | 'cancel' | 'refund' | 'error';

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Offer {
  domain: string;
  url: string;
  price: number;
  compareAt?: number | null;
  currency: string;
  availability: string;
  condition?: string | null;
}

export interface Product {
  productId: string;
  title: string;
  brand?: string;
  image?: string | null;
  features?: string[];
  bestOffer: Offer;
  offerCount?: number;
  fit?: number;
  reason?: string;
}

export interface PricePoint {
  at: string;
  price: number;
  domain?: string;
  simulated?: boolean;
}

export interface Advice {
  verdict: 'already_met' | 'realistic' | 'stretch' | 'unlikely';
  suggestedPrice: number;
  message: string;
  low: number;
  typical: number;
}

export interface Wish {
  _id: string;
  text: string;
  plan: { query: string; summary: string; brands: string[]; mustHave: string[]; avoid: string[]; condition: 'new' | 'any' };
  maxPrice: number;
  mode: 'auto' | 'ask';
  advice?: Advice;
  status: WishStatus;
  candidates: Product[];
  chosen?: Product;
  prices: PricePoint[];
  payment: {
    status: 'none' | 'created' | 'held' | 'captured' | 'voided' | 'refunded';
    held?: number;
    paid?: number;
    released?: number;
    captureId?: string;
    refundId?: string;
    shipTo?: string;
    expiresAt?: string;
    sample?: boolean;
  };
  pending?: { at: string; price: number; domain: string; url?: string; reason: string; simulated?: boolean };
  purchase?: { at: string; price: number; domain: string; url?: string; saved: number; reason: string; simulated?: boolean; refundedAt?: string };
  journal: { at: string; kind: JournalKind; message: string }[];
  lastCheckedAt?: string;
  updatedAt: string;
}

export interface Stats {
  watching: number;
  held: number;
  bought: number;
  saved: number;
}

export interface PublicConfig {
  paypalClientId: string;
  currency: string;
  demoTools: boolean;
}
