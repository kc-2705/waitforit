import { lazy, Suspense } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { Button, Result, Spin } from 'antd';
import { useAuth } from './context/AuthContext';
import AppLayout from './components/AppLayout';
import Landing from './pages/Landing';
import { LoginPage, RegisterPage } from './pages/AuthPages';

// Signed-in pages load on demand, so the landing and login pages open fast.
const Wishes = lazy(() => import('./pages/Wishes'));
const WishDetail = lazy(() => import('./pages/WishDetail'));

const FullPageSpinner = () => (
  <div className="center-screen">
    <Spin size="large" />
  </div>
);

function RequireAuth({ children }) {
  const { status } = useAuth();
  if (status === 'checking') return <FullPageSpinner />;
  return status === 'signedIn' ? children : <Navigate to="/login" replace />;
}

function GuestOnly({ children }) {
  const { status } = useAuth();
  if (status === 'checking') return <FullPageSpinner />;
  return status === 'signedIn' ? <Navigate to="/wishes" replace /> : children;
}

const page = (el) => <Suspense fallback={<Spin style={{ display: 'block', margin: 48 }} />}>{el}</Suspense>;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<GuestOnly><Landing /></GuestOnly>} />
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/wishes" element={page(<Wishes />)} />
        <Route path="/wishes/:id" element={page(<WishDetail />)} />
      </Route>
      <Route
        path="*"
        element={
          <Result
            status="404"
            title="Page not found"
            subTitle="That page doesn’t exist."
            extra={<Link to="/"><Button type="primary">Go home</Button></Link>}
          />
        }
      />
    </Routes>
  );
}
