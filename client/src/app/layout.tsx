import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import Providers from './providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'WaitForIt: an AI agent that buys at your price', template: '%s · WaitForIt' },
  description:
    'Tell WaitForIt what you want and the most you will pay. An AI agent watches prices across stores and buys with a PayPal hold, never above your limit.',
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = { themeColor: '#1d4ed8', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>
        {/* Apply a saved dark-mode choice before anything paints, so the page doesn't flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "try{var t=localStorage.getItem('waitforit.theme');if(t)document.documentElement.dataset.theme=t;}catch(e){}",
          }}
        />
        {/* Opening screen: plain HTML so it shows at once while the free API server wakes up. */}
        <div id="splash" role="status" aria-live="polite">
          <div className="splash-inner">
            <div className="splash-brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/favicon.svg" alt="" width={36} height={36} />
              <span>WaitForIt</span>
            </div>
            <div className="splash-bar" />
            <p id="splash-note">Starting the server. On the free plan this can take up to a minute.</p>
          </div>
        </div>
        <AntdRegistry>
          <Providers>{children}</Providers>
        </AntdRegistry>
      </body>
    </html>
  );
}
