import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { CleanupToast } from '../ui/CleanupToast';

export function Shell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const path = location.pathname;

  return (
    <div className={`flex h-screen w-screen overflow-hidden transition-all duration-1000 bg-mesh-smartcare`}>
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-y-auto relative">
        {/* Top drag region for the main area */}
        <div className="drag-region h-12 w-full shrink-0" />
        <div className="flex-1 px-8 pb-8 flex flex-col relative">
          {children}
        </div>
      </main>
      <CleanupToast />
    </div>
  );
}
