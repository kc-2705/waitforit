'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar, Button, Dropdown, Tooltip } from 'antd';
import { LogoutOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons';
import { useAuth } from '@/lib/auth';
import { useThemeMode } from '@/lib/theme';

export function Brand({ href = '/wishes/' }: { href?: string }) {
  return (
    <Link href={href} className="brand">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/favicon.svg" alt="" width={26} height={26} />
      <span>WaitForIt</span>
    </Link>
  );
}

export function ThemeButton() {
  const { mode, toggle } = useThemeMode();
  return (
    <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
      <Button type="text" shape="circle" icon={mode === 'dark' ? <SunOutlined /> : <MoonOutlined />} onClick={toggle} aria-label="Toggle dark mode" />
    </Tooltip>
  );
}

export default function AppHeader() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const initials = (user?.name ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <header className="topbar">
      <Brand />
      <nav className="nav">
        <Link href="/wishes/" className={pathname?.startsWith('/wish') ? 'active' : ''}>My wishes</Link>
      </nav>
      <Tooltip title="Payments use PayPal's sandbox: test money only.">
        <span className="env-label">PayPal sandbox</span>
      </Tooltip>
      <ThemeButton />
      <Dropdown
        trigger={['click']}
        menu={{
          items: [
            { key: 'who', label: <span className="muted">{user?.email}</span>, disabled: true },
            { type: 'divider' },
            { key: 'out', icon: <LogoutOutlined />, label: 'Sign out', onClick: signOut },
          ],
        }}
      >
        <Avatar size={32} style={{ background: '#1e3a8a', cursor: 'pointer', fontSize: 13 }} aria-label="Account menu">
          {initials}
        </Avatar>
      </Dropdown>
    </header>
  );
}
