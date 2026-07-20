import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  HardDrives,
  MagnifyingGlass,
  ChartDonut,
  Wrench,
  Gear,
  FileMagnifyingGlass,
  CopySimple,
  AppWindow,
  Lightning,
  Pulse,
  Desktop,
} from '@phosphor-icons/react';
import { useAppInfo } from '../../hooks/use-app-info';

const navItems = [
  { to: '/smart-care', icon: Desktop, label: 'Smart Care' },
  { to: '/', icon: HardDrives, label: 'Dashboard' },
  { to: '/scan', icon: MagnifyingGlass, label: 'Scanner' },
  { to: '/visualize', icon: ChartDonut, label: 'Visualizer' },
  { to: '/dev-tools', icon: Wrench, label: 'Dev Tools' },
  { to: '/large-files', icon: FileMagnifyingGlass, label: 'Large Files' },
  { to: '/duplicates', icon: CopySimple, label: 'Duplicates' },
  { to: '/apps', icon: AppWindow, label: 'Apps' },
  { to: '/optimize', icon: Lightning, label: 'Optimize' },
  { to: '/status', icon: Pulse, label: 'Status' },
  { to: '/settings', icon: Gear, label: 'Settings' },
];

export function Sidebar() {
  const location = useLocation();
  const { appInfo } = useAppInfo();

  return (
    <aside className="w-20 h-full flex flex-col bg-white/5 backdrop-blur-md border-r border-white/10 z-50">
      {/* Drag region for macOS title bar */}
      <div className="drag-region h-12 w-full flex items-center justify-center pt-2">
        {/* The macOS traffic lights usually go here on the left, so we just leave space */}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 flex flex-col items-center space-y-4 mt-4">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              className={`no-drag flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 group relative ${
                isActive
                  ? 'text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute inset-0 bg-white/20 shadow-lg border border-white/20 rounded-2xl"
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                />
              )}
              
              <Icon size={24} weight={isActive ? "fill" : "duotone"} className="relative z-10" />
              
              {/* Custom Tooltip */}
              <span className="absolute left-full ml-4 px-3 py-1.5 bg-black/80 backdrop-blur-md border border-white/10 text-white text-xs font-medium rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap shadow-xl z-[100] translate-x-[-10px] group-hover:translate-x-0">
                {label}
              </span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="py-4 flex justify-center border-t border-white/10">
        <p className="text-[10px] text-white/40 font-medium">
          {appInfo ? `v${appInfo.version}` : 'v...'}
        </p>
      </div>
    </aside>
  );
}
