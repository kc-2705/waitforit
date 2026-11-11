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
            {/* The idea of the app in two seconds: the price falls to your limit, then it's bought. */}
            <svg className="intro" viewBox="0 0 240 120" aria-hidden="true">
              <line className="intro-limit" x1="12" x2="228" y1="86" y2="86" />
              <text className="intro-limit-label" x="12" y="102">your limit</text>
              <polyline className="intro-line" points="12,28 62,28 98,44 140,40 182,74 206,92" />
              <circle className="intro-dot" cx="206" cy="92" r="5" />
              <g className="intro-check">
                <circle cx="206" cy="92" r="11" />
                <path d="M201 92.5l3.4 3.4 6.6-7" />
              </g>
              <text className="intro-price intro-old" x="12" y="16">$179</text>
              <text className="intro-price intro-new" x="12" y="16">$129</text>
            </svg>
            <div className="splash-brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/favicon.svg" alt="" width={30} height={30} />
              <span>WaitForIt</span>
            </div>
            <div className="splash-tagline">Buying at your price</div>
            <div className="splash-wait">
              <div className="splash-bar" />
              <p id="splash-note">Starting the server. On the free plan this can take up to a minute.</p>
            </div>
          </div>
        </div>
        <AntdRegistry>
          <Providers>{children}</Providers>
        </AntdRegistry>
      </body>
    </html>
  );
}
