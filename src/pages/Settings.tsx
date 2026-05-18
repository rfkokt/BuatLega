import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Laptop,
  Info as InfoIcon,
  HardDrives,
  Database,
  ArrowDown,
  Trash,
} from '@phosphor-icons/react';
import { useAppInfo } from '../hooks/use-app-info';
import { useDiskInfo } from '../hooks/use-disk-info';
import {
  clearCleanupHistory,
  clearScanCache,
  listCleanupHistory,
  listIgnoredPaths,
  openSystemPreferences,
  removeIgnoredPath,
} from '../services/tauri';
import { formatBytes, formatRelativeTime } from '../lib/format';
import type { CleanupHistoryEntry, IgnoredPath } from '../types';

export default function Settings() {
  const { appInfo } = useAppInfo();
  const { diskInfo, hasFDA, refresh } = useDiskInfo();
  const [history, setHistory] = useState<CleanupHistoryEntry[]>([]);
  const [ignoredPaths, setIgnoredPaths] = useState<IgnoredPath[]>([]);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [isClearingScanCache, setIsClearingScanCache] = useState(false);

  const refreshStorageMeta = useCallback(() => {
    Promise.all([listCleanupHistory(), listIgnoredPaths()])
      .then(([historyEntries, ignored]) => {
        setHistory(historyEntries);
        setIgnoredPaths(ignored);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    refresh();
    refreshStorageMeta();
  }, [refresh, refreshStorageMeta]);

  const clearHistory = useCallback(async () => {
    setIsClearingHistory(true);
    try {
      await clearCleanupHistory();
      setHistory([]);
    } finally {
      setIsClearingHistory(false);
    }
  }, []);

  const unignorePath = useCallback(async (path: string) => {
    const ignored = await removeIgnoredPath(path);
    setIgnoredPaths(ignored);
  }, []);

  const clearCachedScans = useCallback(async () => {
    setIsClearingScanCache(true);
    try {
      await clearScanCache();
    } finally {
      setIsClearingScanCache(false);
    }
  }, []);

  const usagePercent = diskInfo 
    ? (diskInfo.used_space / diskInfo.total_capacity) * 100 
    : 0;
  const historyTotal = history.reduce((total, item) => total + item.reclaimable_bytes, 0);
  const buildProfileLabel = appInfo?.build_profile === 'debug' ? 'Debug build' : 'Release build';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 mb-6">
        <h1 className="text-3xl font-semibold text-white tracking-wide">My Activity</h1>
        <span className="text-sm text-white/40">Device Information</span>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 pr-4 -mr-4 space-y-4 pb-10">
        {/* Top Row: 2-1-1 columns */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Mac Health (col-span-2) */}
          <div className="lg:col-span-2 relative glass rounded-3xl overflow-hidden border border-white/5 p-6 flex flex-col justify-between min-h-[220px]">
            {/* Background glowing circle */}
            <div className="absolute -top-20 -right-20 w-96 h-96 bg-gradient-to-br from-[#00F0FF]/30 to-transparent rounded-full blur-3xl opacity-50 pointer-events-none" />
            <div className="absolute right-10 top-1/2 -translate-y-1/2 opacity-80 pointer-events-none">
              <Laptop size={120} weight="duotone" className="text-[#00F0FF]" />
            </div>

            <div className="relative z-10 space-y-1">
              <p className="text-xs text-white/60 font-medium">Device Health:</p>
              <div className="flex items-center gap-2">
                <h2 className="text-3xl font-semibold text-[#00F0FF]">Good</h2>
                <button className="p-0.5 rounded-full bg-white/10 text-white/60 hover:text-white transition-colors">
                  <InfoIcon size={14} />
                </button>
              </div>
              <p className="text-xs text-white/50">Your System</p>
            </div>

            <div className="relative z-10 mt-12">
              <div className="flex items-center justify-between text-sm font-medium mb-3">
                <span className="text-white flex items-center gap-2">
                  <HardDrives size={16} />
                  Main Storage
                </span>
                <span className="text-white/60">
                  {diskInfo ? `${formatBytes(diskInfo.used_space)} of ${formatBytes(diskInfo.total_capacity)} used` : 'Calculating...'}
                </span>
              </div>
              <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden backdrop-blur-md border border-white/5">
                <motion.div
                  className="h-full bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${usagePercent}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>
            </div>
          </div>

          {/* Card 2: Permissions / FDA (col-span-1) */}
          <div className="glass rounded-3xl p-6 border border-white/5 flex flex-col relative min-h-[220px]">
            <button className="absolute top-4 right-4 p-1 rounded-full bg-white/5 text-white/40 hover:text-white transition-colors">
              <InfoIcon size={14} />
            </button>
            <p className="text-xs text-white/60 font-medium mb-1">Disk Access</p>
            <h2 className="text-2xl font-semibold text-white">
              {hasFDA ? 'Granted' : 'Limited'}
            </h2>
            <p className="text-xs text-white/40 mt-1">
              {hasFDA ? 'Full system accessible' : 'Action required'}
            </p>

            <div className="mt-auto">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${hasFDA ? 'bg-[#00F0FF]' : 'bg-[#FF9F0A]'}`} />
                    <span className="text-white/60">Status</span>
                  </div>
                  <span className="text-white">{hasFDA ? 'Active' : 'Warning'}</span>
                </div>
              </div>
              
              {!hasFDA && (
                <button
                  onClick={() => openSystemPreferences().catch(console.error)}
                  className="w-full mt-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-colors border border-white/10"
                >
                  Grant Access
                </button>
              )}
            </div>
          </div>

          {/* Card 3: About / App Info (col-span-1) */}
          <div className="glass rounded-3xl p-6 border border-white/5 flex flex-col relative min-h-[220px]">
            <button className="absolute top-4 right-4 p-1 rounded-full bg-white/5 text-white/40 hover:text-white transition-colors">
              <InfoIcon size={14} />
            </button>
            <p className="text-xs text-white/60 font-medium mb-1">App Version</p>
            <h2 className="text-2xl font-semibold text-white">
              {appInfo ? `v${appInfo.version}` : 'Loading...'}
            </h2>
            <p className="text-xs text-white/40 mt-1">
              {appInfo ? `${appInfo.name} • ${buildProfileLabel}` : 'Reading bundle metadata'}
            </p>

            <div className="mt-auto space-y-3">
              <p className="text-xs text-white/60 leading-relaxed">
                {appInfo
                  ? `${appInfo.identifier} powered by React, Framer Motion, and Rust.`
                  : 'Antigravity Storage Engine powered by React, Framer Motion, and Rust.'}
              </p>
              <button 
                onClick={refresh}
                className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-colors border border-white/10 flex items-center justify-center gap-2"
              >
                Refresh Data
              </button>
              <button
                onClick={clearCachedScans}
                disabled={isClearingScanCache}
                className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm font-medium transition-colors border border-white/10 disabled:opacity-50"
              >
                Clear Scan Cache
              </button>
            </div>
          </div>

        </div>

        {/* Bottom Row: Detailed Storage Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          {/* Card 4: Total Capacity */}
          <div className="glass rounded-3xl p-6 border border-white/5 flex items-center gap-5 relative">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center shrink-0 border border-white/10">
              <Database size={24} weight="duotone" className="text-white" />
            </div>
            <div>
              <p className="text-xs text-white/60 font-medium mb-1">Total Capacity</p>
              <h3 className="text-xl font-semibold text-white">
                {diskInfo ? formatBytes(diskInfo.total_capacity) : '---'}
              </h3>
            </div>
          </div>

          {/* Card 5: Available Space */}
          <div className="glass rounded-3xl p-6 border border-white/5 flex items-center gap-5 relative">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00F0FF]/20 to-[#00F0FF]/5 flex items-center justify-center shrink-0 border border-[#00F0FF]/20">
              <ArrowDown size={24} weight="duotone" className="text-[#00F0FF]" />
            </div>
            <div>
              <p className="text-xs text-white/60 font-medium mb-1">Available Space</p>
              <h3 className="text-xl font-semibold text-white">
                {diskInfo ? formatBytes(diskInfo.available_space) : '---'}
              </h3>
            </div>
          </div>

          {/* Card 6: Purgeable Space */}
          <div className="glass rounded-3xl p-6 border border-white/5 flex items-center gap-5 relative">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#BF5AF2]/20 to-[#BF5AF2]/5 flex items-center justify-center shrink-0 border border-[#BF5AF2]/20">
              <Trash size={24} weight="duotone" className="text-[#BF5AF2]" />
            </div>
            <div>
              <p className="text-xs text-white/60 font-medium mb-1">Purgeable Space</p>
              <h3 className="text-xl font-semibold text-white">
                {diskInfo && diskInfo.purgeable_space ? formatBytes(diskInfo.purgeable_space) : 'Zero Bytes'}
              </h3>
            </div>
          </div>

        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Cleanup History */}
        <div className="glass rounded-3xl p-6 border border-white/5">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <p className="text-xs text-white/60 font-medium mb-1">Cleanup History</p>
              <h2 className="text-2xl font-semibold text-white">
                {history.length > 0 ? formatBytes(historyTotal) : 'No Activity'}
              </h2>
              <p className="text-xs text-white/40 mt-1">
                {history.length > 0
                  ? `${history.length} cleanup sessions recorded`
                  : 'Cleaned items will appear here'}
              </p>
            </div>

            {history.length > 0 && (
              <button
                onClick={clearHistory}
                disabled={isClearingHistory}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-medium transition-colors border border-white/10 disabled:opacity-50"
              >
                Clear History
              </button>
            )}
          </div>

          {history.length > 0 ? (
            <div className="space-y-2">
              {history.slice(0, 6).map((entry) => {
                const label = entry.trashed_bytes > 0 && entry.freed_bytes === 0
                  ? `${formatBytes(entry.trashed_bytes)} moved to Trash`
                  : `${formatBytes(entry.freed_bytes)} freed`;

                return (
                  <div
                    key={`${entry.created_at}-${entry.items_count}`}
                    className="flex items-center justify-between gap-4 rounded-2xl bg-white/5 border border-white/5 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {label}
                      </p>
                      <p className="text-xs text-white/45 mt-0.5">
                        {entry.items_count} items · {entry.permanent ? 'Permanent' : 'Trash'} · {formatRelativeTime(entry.created_at)}
                      </p>
                    </div>
                    {entry.failed_count > 0 && (
                      <span className="shrink-0 text-xs text-[#FF9F0A]">
                        {entry.failed_count} skipped
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl bg-white/5 border border-white/5 px-4 py-5 text-sm text-white/45">
              No cleanup history yet.
            </div>
          )}
        </div>

        {/* Ignored Paths */}
        <div className="glass rounded-3xl p-6 border border-white/5">
          <div className="mb-5">
            <p className="text-xs text-white/60 font-medium mb-1">Ignored Paths</p>
            <h2 className="text-2xl font-semibold text-white">
              {ignoredPaths.length > 0 ? ignoredPaths.length : 'None'}
            </h2>
            <p className="text-xs text-white/40 mt-1">
              Hidden from future scanner and large file results
            </p>
          </div>

          {ignoredPaths.length > 0 ? (
            <div className="space-y-2">
              {ignoredPaths.slice(0, 6).map((entry) => (
                <div
                  key={entry.path}
                  className="flex items-center justify-between gap-4 rounded-2xl bg-white/5 border border-white/5 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {entry.path.replace(/^\/Users\/[^/]+\//, '~/')}
                    </p>
                    <p className="text-xs text-white/45 mt-0.5">
                      {entry.reason || 'Ignored'} · {formatRelativeTime(entry.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => unignorePath(entry.path)}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/60 hover:text-white border border-white/10 transition-colors"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-white/5 border border-white/5 px-4 py-5 text-sm text-white/45">
              No ignored paths yet.
            </div>
          )}
        </div>
        </div>
      </div>
    </motion.div>
  );
}
