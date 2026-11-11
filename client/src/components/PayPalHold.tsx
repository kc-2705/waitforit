'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Skeleton } from 'antd';
import { createHoldOrder, useAuthorizeHold, useConfig } from '@/lib/hooks';
import { errorMessage } from '@/lib/api';
import type { Wish } from '@/lib/types';

// Minimal typing for the part of PayPal's JS SDK we use.
interface PayPalButtons {
  render: (el: HTMLElement) => Promise<void>;
  close?: () => Promise<void>;
}
interface PayPalSdk {
  Buttons: (opts: {
    style?: Record<string, unknown>;
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string }) => Promise<void>;
    onCancel?: () => void;
    onError?: (err: unknown) => void;
  }) => PayPalButtons;
}
declare global {
  interface Window {
    paypal?: PayPalSdk;
  }
}

// Loads PayPal's SDK once. intent=authorize means the buyer approves a hold, not a payment.
let sdkPromise: Promise<PayPalSdk> | null = null;
function loadPayPal(clientId: string, currency: string): Promise<PayPalSdk> {
  if (window.paypal) return Promise.resolve(window.paypal);
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${currency}&intent=authorize&components=buttons&disable-funding=paylater`;
      s.onload = () => (window.paypal ? resolve(window.paypal) : reject(new Error('PayPal could not load.')));
      s.onerror = () => {
        sdkPromise = null;
        reject(new Error('PayPal could not load. Check your connection or ad blocker.'));
      };
      document.head.appendChild(s);
    });
  }
  return sdkPromise;
}

export default function PayPalHold({ wish }: { wish: Wish }) {
  const ref = useRef<HTMLDivElement>(null);
  const { data: config } = useConfig();
  const authorize = useAuthorizeHold();
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const { mutateAsync } = authorize;

  useEffect(() => {
    if (!config?.paypalClientId) return undefined;
    let buttons: PayPalButtons | undefined;
    let gone = false;
    loadPayPal(config.paypalClientId, config.currency)
      .then((paypal) => {
        if (gone || !ref.current) return;
        buttons = paypal.Buttons({
          style: { layout: 'vertical', shape: 'rect', label: 'paypal', height: 44, color: 'gold' },
          createOrder: async () => {
            setError(null);
            try {
              return await createHoldOrder(wish._id);
            } catch (e) {
              setError(errorMessage(e));
              throw e;
            }
          },
          onApprove: async (data) => {
            try {
              await mutateAsync({ id: wish._id, orderId: data.orderID });
            } catch (e) {
              setError(errorMessage(e));
            }
          },
          onCancel: () => setError('You closed PayPal before approving. Nothing was held.'),
          onError: () => setError((prev) => prev ?? 'PayPal had a problem. Please try again.'),
        });
        return buttons.render(ref.current).then(() => {
          if (!gone) setReady(true);
        });
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      gone = true;
      buttons?.close?.().catch(() => {});
    };
  }, [config, wish._id, mutateAsync]);

  if (config && !config.paypalClientId) {
    return <Alert type="warning" showIcon title="PayPal isn't set up on this server yet (PAYPAL_CLIENT_ID is missing)." />;
  }

  return (
    <div>
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 12 }} />}
      {authorize.isPending && <Alert type="info" showIcon title="Approved. Setting up your hold and checking prices…" style={{ marginBottom: 12 }} />}
      {!ready && <Skeleton.Button active block style={{ height: 44 }} />}
      <div ref={ref} className="paypal-slot" />
    </div>
  );
}
