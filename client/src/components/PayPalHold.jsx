import { useEffect, useRef, useState } from 'react';
import { Alert, Skeleton } from 'antd';
import { createHoldOrder, useAuthorizeHold, useConfig } from '../api/hooks';
import { errorMessage } from '../api/client';

// Loads PayPal's JavaScript SDK once. intent=authorize means the buyer approves a hold, not a payment.
let sdkPromise = null;
function loadPayPal(clientId, currency) {
  if (window.paypal) return Promise.resolve(window.paypal);
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${currency}&intent=authorize&components=buttons&disable-funding=paylater`;
      s.onload = () => resolve(window.paypal);
      s.onerror = () => {
        sdkPromise = null;
        reject(new Error('PayPal could not load.'));
      };
      document.head.appendChild(s);
    });
  }
  return sdkPromise;
}

export default function PayPalHold({ wish }) {
  const ref = useRef(null);
  const { data: config } = useConfig();
  const authorize = useAuthorizeHold();
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  const { mutateAsync } = authorize;

  useEffect(() => {
    if (!config?.paypalClientId) return undefined;
    let buttons;
    let gone = false;
    loadPayPal(config.paypalClientId, config.currency)
      .then((paypal) => {
        if (gone || !ref.current) return;
        buttons = paypal.Buttons({
          style: { layout: 'vertical', shape: 'rect', label: 'paypal', height: 45 },
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
        return buttons.render(ref.current).then(() => !gone && setReady(true));
      })
      .catch((e) => setError(e.message));
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
      {authorize.isPending && <Alert type="info" showIcon title="PayPal approved. Setting up your hold and taking a first look at prices…" style={{ marginBottom: 12 }} />}
      {!ready && <Skeleton.Button active block style={{ height: 45 }} />}
      <div ref={ref} className="paypal-slot" />
    </div>
  );
}
