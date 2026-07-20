import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Shell } from './components/layout/Shell';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Scanner = lazy(() => import('./pages/Scanner'));
const Visualizer = lazy(() => import('./pages/Visualizer'));
const DevTools = lazy(() => import('./pages/DevTools'));
const LargeFiles = lazy(() => import('./pages/LargeFiles'));
const Duplicates = lazy(() => import('./pages/Duplicates'));
const Apps = lazy(() => import('./pages/Apps'));
const Optimize = lazy(() => import('./pages/Optimize'));
const Status = lazy(() => import('./pages/Status'));
const Settings = lazy(() => import('./pages/Settings'));
const Menubar = lazy(() => import('./pages/Menubar'));
const SmartCare = lazy(() => import('./pages/SmartCare'));

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listen } from '@tauri-apps/api/event';

function RouteFallback() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-white/15 border-t-accent-secondary animate-spin" />
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const unlisten = listen<string>('navigate_main', (event) => {
      navigate(event.payload);
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, [navigate]);

  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<RouteFallback />}>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/smart-care" element={<SmartCare />} />
          <Route path="/scan" element={<Scanner />} />
          <Route path="/visualize" element={<Visualizer />} />
          <Route path="/dev-tools" element={<DevTools />} />
          <Route path="/large-files" element={<LargeFiles />} />
          <Route path="/duplicates" element={<Duplicates />} />
          <Route path="/apps" element={<Apps />} />
          <Route path="/optimize" element={<Optimize />} />
          <Route path="/status" element={<Status />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/menubar" element={<Menubar />} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  );
}

function AppRoutes() {
  const location = useLocation();
  const isMenubar = location.pathname === '/menubar';

  if (isMenubar) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Routes location={location} key={location.pathname}>
          <Route path="/menubar" element={<Menubar />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <Shell>
      <AnimatedRoutes />
    </Shell>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
