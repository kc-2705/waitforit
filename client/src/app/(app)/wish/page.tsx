import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Skeleton } from 'antd';
import WishView from '@/components/WishView';

export const metadata: Metadata = { title: 'Wish' };

// The wish id comes from ?id=..., read in the browser, so this page can be a static file.
export default function WishPage() {
  return (
    <Suspense fallback={<Skeleton active paragraph={{ rows: 8 }} />}>
      <WishView />
    </Suspense>
  );
}
