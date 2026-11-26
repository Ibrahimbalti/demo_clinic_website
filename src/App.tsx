import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PublicWebsite } from './components/PublicWebsite';
import { AdminDashboard } from './components/AdminDashboard';

const queryClient = new QueryClient();

export const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<'website' | 'admin'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (
        params.has('admin') ||
        window.location.hash === '#admin' ||
        window.location.pathname.startsWith('/admin')
      ) {
        return 'admin';
      }
    }
    return 'website';
  });

  useEffect(() => {
    const syncViewFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      if (
        params.has('admin') ||
        window.location.hash === '#admin' ||
        window.location.pathname.startsWith('/admin')
      ) {
        setViewMode('admin');
      }
    };
    window.addEventListener('hashchange', syncViewFromUrl);
    window.addEventListener('popstate', syncViewFromUrl);
    return () => {
      window.removeEventListener('hashchange', syncViewFromUrl);
      window.removeEventListener('popstate', syncViewFromUrl);
    };
  }, []);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem('gasha_clinic_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('gasha_clinic_theme', theme);
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <QueryClientProvider client={queryClient}>
      {viewMode === 'admin' ? (
        <AdminDashboard
          onBackToWebsite={() => setViewMode('website')}
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />
      ) : (
        <PublicWebsite
          onOpenAdmin={() => setViewMode('admin')}
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />
      )}
    </QueryClientProvider>
  );
};

export default App;
