import { Link, Outlet } from 'react-router-dom';
import { Avatar, Button, Dropdown, Tag, Tooltip } from 'antd';
import { LogoutOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeContext';

export function Brand({ to = '/wishes' }) {
  return (
    <Link to={to} className="brand">
      <img src="/favicon.svg" alt="" />
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

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const initials = (user?.name ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <>
      <header className="topbar">
        <Brand />
        <Tooltip title="Payments use PayPal's sandbox: test money only.">
          <Tag variant="filled" color="gold" className="sandbox-tag">Sandbox</Tag>
        </Tooltip>
        <div style={{ flex: 1 }} />
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
          <Avatar style={{ background: '#0f766e', cursor: 'pointer' }} aria-label="Account menu">{initials}</Avatar>
        </Dropdown>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </>
  );
}
