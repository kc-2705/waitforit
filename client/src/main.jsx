import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import App from './App';
import { waitForServer } from './api/client';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => count < 2 && ![400, 401, 403, 404].includes(error?.response?.status),
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);

// Keep the opening screen up until the API is awake (and for at least a moment, so it doesn't flash).
const splash = document.getElementById('splash');
if (splash) {
  const minimum = new Promise((r) => setTimeout(r, 1600));
  const ready = waitForServer({
    onSlow: () => splash.classList.add('waiting'),
    onRetry: () => {
      const note = document.getElementById('splash-note');
      if (note) note.textContent = 'Still waking up. Thanks for waiting, almost there.';
    },
  });
  Promise.all([minimum, ready]).then(() => {
    splash.classList.add('done');
    setTimeout(() => splash.remove(), 600);
  });
}
