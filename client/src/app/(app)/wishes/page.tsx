import type { Metadata } from 'next';
import WishesView from '@/components/WishesView';

export const metadata: Metadata = { title: 'My wishes' };

export default function WishesPage() {
  return <WishesView />;
}
