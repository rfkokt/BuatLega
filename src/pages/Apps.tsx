import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AppWindow,
  ArrowClockwise,
  ArrowSquareOut,
  CheckCircle,
  Clock,
  LockSimple,
  MagnifyingGlass,
  Spinner,
  Trash,
  XCircle,
} from '@phosphor-icons/react';
import { ConfirmDialog } from '../components/cleanup/ConfirmDialog';
import { formatBytes, formatRelativeTime } from '../lib/format';
import { listInstalledApps, openInFinder } from '../services/tauri';
import { useCleanupStore } from '../stores/cleanup-store';
import type { FileNode, InstalledApp } from '../types';

export default function Apps() {
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const scanApps = useCallback(async () => {
    setIsScanning(true);
    setError(null);
    try {
      const result = await listInstalledApps();
      setApps(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsScanning(false);
    }
  }, []);

  useEffect(() => {
    scanApps();
  }, [scanApps]);

  const filteredApps = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return apps;

    return apps.filter((app) => {
      const relatedText = app.related_files
        .map((file) => `${file.kind} ${file.path}`)
        .join(' ');
      return [
        app.name,
        app.bundle_id ?? '',
        app.path,
        relatedText,
      ].join(' ').toLowerCase().includes(query);
    });
  }, [apps, searchQuery]);

  const selectableApps = useMemo(() => apps.filter((app) => !app.is_protected), [apps]);
  const visibleSelectableApps = useMemo(
    () => filteredApps.filter((app) => !app.is_protected),
    [filteredApps],
  );
  const rarelyUsedApps = useMemo(
    () => visibleSelectableApps.filter(isRarelyUsedApp),
    [visibleSelectableApps],
  );
  const selectedItems = useMemo(
    () => apps.flatMap(appToCleanupItems).filter((item) => selectedPaths.has(item.path)),
    [apps, selectedPaths],
  );
  const selectedAppBundles = useMemo(
    () => selectableApps.filter((app) => selectedPaths.has(app.path)),
    [selectableApps, selectedPaths],
  );
  const selectedSize = selectedItems.reduce((total, item) => total + item.size, 0);
  const relatedTotal = apps.reduce((total, app) => total + app.related_size, 0);
  const cleanupActionLabel = selectedAppBundles.length > 0 ? 'Uninstall' : 'Clean';

  const toggleSelect = useCallback((app: InstalledApp) => {
    const items = appToCleanupItems(app);
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      const allSelected = items.every((item) => next.has(item.path));
      if (allSelected) {
        items.forEach((item) => next.delete(item.path));
      } else {
        items.forEach((item) => next.add(item.path));
      }
      return next;
    });
  }, []);

  const selectWithLeftovers = useCallback(() => {
    const leftoverPaths = visibleSelectableApps
      .filter((app) => app.related_size > 0)
      .flatMap((app) => app.related_files.map((file) => file.path));
    setSelectedPaths(new Set(leftoverPaths));
  }, [visibleSelectableApps]);

  const selectRarelyUsed = useCallback(() => {
    const rarelyUsedPaths = rarelyUsedApps.flatMap((app) =>
      appToCleanupItems(app).map((item) => item.path),
    );
    setSelectedPaths(new Set(rarelyUsedPaths));
  }, [rarelyUsedApps]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="h-full flex flex-col"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Apps</h1>
          <p className="text-sm text-text-secondary mt-1">
            {apps.length > 0
              ? `${filteredApps.length.toLocaleString()} of ${apps.length.toLocaleString()} apps • ${formatBytes(relatedTotal)} leftovers detected`
              : 'Find apps and removable support files'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedPaths.size > 0 && (
            <>
              <button
                onClick={() => setSelectedPaths(new Set())}
                className="px-4 py-2 rounded-full text-xs font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 transition-all border border-white/10"
              >
                Clear ({selectedPaths.size})
              </button>
              <button
                onClick={() => setShowConfirm(true)}
                className="flex items-center gap-2 px-5 py-2 rounded-full text-xs font-medium text-white bg-gradient-to-r from-red-500/80 to-rose-600/80 hover:opacity-90 transition-opacity shadow-[0_0_15px_rgba(225,29,72,0.4)]"
              >
                <Trash size={14} />
                {cleanupActionLabel} {formatBytes(selectedSize)}
              </button>
            </>
          )}

          <button
            onClick={selectWithLeftovers}
            disabled={visibleSelectableApps.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium text-[#0D9488] bg-[#0D9488]/10 hover:bg-[#0D9488]/20 border border-[#0D9488]/30 transition-all disabled:opacity-40"
          >
            <CheckCircle size={14} />
            Select Leftovers
          </button>

          <button
            onClick={selectRarelyUsed}
            disabled={rarelyUsedApps.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium text-[#FF9F0A] bg-[#FF9F0A]/10 hover:bg-[#FF9F0A]/20 border border-[#FF9F0A]/30 transition-all disabled:opacity-40"
            title="Select apps last used more than 6 months ago"
          >
            <Clock size={14} />
            Select Rarely Used
          </button>

          <button
            onClick={scanApps}
            disabled={isScanning}
            className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium text-white bg-gradient-to-r from-[#0D9488] to-[#0EA5E9] shadow-[0_0_20px_rgba(13,148,136,0.4)] hover:shadow-[0_0_30px_rgba(13,148,136,0.6)] transition-all disabled:opacity-50"
          >
            {isScanning ? (
              <>
                <Spinner size={16} className="animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <ArrowClockwise size={16} />
                Re-scan
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl glass border-red-500/20 bg-red-500/10 mt-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {isScanning && apps.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center -mt-12">
          <Spinner size={48} className="animate-spin text-[#00F0FF] mb-5" />
          <h2 className="text-3xl font-semibold text-text-primary mb-3">Scanning Apps...</h2>
          <p className="text-base text-text-secondary">Checking applications, support files, caches, and preferences</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 mt-6 pb-6">
          <div className="grid grid-cols-4 gap-4 shrink-0 mb-4">
            <SummaryCard label="Apps" value={filteredApps.length.toString()} color="#00F0FF" />
            <SummaryCard label="Protected" value={filteredApps.filter((app) => app.is_protected).length.toString()} color="#FF9F0A" />
            <SummaryCard label="Leftovers" value={formatBytes(filteredApps.reduce((total, app) => total + app.related_size, 0))} color="#FF2E93" />
            <SummaryCard label="Selected" value={formatBytes(selectedSize)} color="#22c55e" />
          </div>

          <div className="glass rounded-3xl overflow-hidden border border-white/5">
            <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.025] border-b border-white/5">
              <div className="relative flex-1">
                <MagnifyingGlass
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search apps, bundle IDs, paths, or related files"
                  className="w-full h-10 rounded-xl bg-black/20 border border-white/10 pl-9 pr-10 text-sm text-text-primary placeholder:text-text-muted outline-none transition-all focus:border-[#00F0FF]/40 focus:bg-black/30"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                    title="Clear search"
                  >
                    <XCircle size={16} />
                  </button>
                )}
              </div>
              <span className="text-xs text-text-muted tabular-nums">
                {filteredApps.length.toLocaleString()} results
              </span>
            </div>

            <div className="flex items-center gap-3 px-4 py-3 bg-white/5 border-b border-white/5 text-xs text-white/50 font-medium uppercase tracking-wider">
              <div className="w-12" />
              <span className="flex-1">Application</span>
              <span className="w-24 text-right">App</span>
              <span className="w-24 text-right">Leftovers</span>
              <span className="w-24 text-right">Total</span>
              <span className="w-28 text-right">Last Used</span>
              <div className="w-8" />
            </div>

            <div className="max-h-[58vh] overflow-y-auto">
              {filteredApps.length === 0 ? (
                <div className="px-5 py-12 text-center text-text-muted text-sm">
                  No apps match your search
                </div>
              ) : filteredApps.map((app, index) => {
                const cleanupItems = appToCleanupItems(app);
                const selected = cleanupItems.some((item) => selectedPaths.has(item.path));
                const fullySelected = cleanupItems.every((item) => selectedPaths.has(item.path));
                const rare = isRarelyUsedApp(app);
                return (
                  <motion.div
                    key={app.path}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(index * 0.015, 0.25) }}
                    className={`group flex items-center gap-3 px-5 py-4 border-b border-white/5 hover:bg-white/5 transition-colors ${
                      selected ? 'bg-[#FF2E93]/10' : ''
                    }`}
                  >
                    <button
                      onClick={() => !app.is_protected && toggleSelect(app)}
                      disabled={app.is_protected}
                      className="w-8 flex items-center justify-center shrink-0 disabled:cursor-not-allowed"
                    >
                      {app.is_protected ? (
                        <LockSimple size={16} className="text-[#FF9F0A]" />
                      ) : (
                        <div className={`w-4 h-4 rounded border transition-all ${
                          selected
                            ? 'bg-accent-primary border-accent-primary'
                            : 'border-bg-tertiary group-hover:border-bg-tertiary'
                        }`}>
                          {fullySelected && (
                            <svg className="w-4 h-4 text-white" viewBox="0 0 16 16" fill="none">
                              <path d="M4 8L7 11L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          )}
                          {selected && !fullySelected && (
                            <span className="block w-2 h-2 m-[3px] rounded-sm bg-white" />
                          )}
                        </div>
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <AppWindow size={16} weight="duotone" className="text-text-muted shrink-0" />
                        <span className="text-sm text-text-primary truncate">{app.name}</span>
                        {app.related_size > 0 && (
                          <span className="px-1.5 py-0.5 rounded-none bg-[#FF2E93]/10 text-[#FF2E93] text-[10px] font-medium shrink-0">
                            {app.related_files.length} related
                          </span>
                        )}
                        {rare && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-none bg-[#FF9F0A]/10 text-[#FF9F0A] text-[10px] font-medium shrink-0">
                            <Clock size={10} />
                            Rarely used
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-muted truncate mt-0.5">
                        {app.bundle_id || app.path}
                      </p>
                    </div>

                    <span className="w-24 text-right text-sm text-text-secondary tabular-nums">
                      {formatBytes(app.app_size)}
                    </span>
                    <span className="w-24 text-right text-sm text-[#FF2E93] tabular-nums">
                      {app.related_size > 0 ? formatBytes(app.related_size) : '-'}
                    </span>
                    <span className="w-24 text-right text-sm font-semibold text-text-primary tabular-nums">
                      {formatBytes(app.total_size)}
                    </span>
                    <span className="w-28 text-right text-xs text-text-muted tabular-nums">
                      {app.last_used ? formatRelativeTime(app.last_used) : 'Unknown'}
                    </span>

                    <button
                      onClick={() => openInFinder(app.path)}
                      className="w-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-text-primary"
                      title="Open in Finder"
                    >
                      <ArrowSquareOut size={14} />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showConfirm}
        items={selectedItems}
        totalSize={selectedSize}
        onConfirm={async (permanent, cleanablePaths) => {
          const paths = cleanablePaths ?? selectedItems.map((item) => item.path);
          setShowConfirm(false);
          setSelectedPaths(new Set());
          await useCleanupStore.getState().startCleanup(paths, permanent);
          scanApps();
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </motion.div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-5 border border-white/5"
    >
      <p className="text-xs text-white/50">{label}</p>
      <p className="text-xl font-bold mt-1" style={{ color }}>
        {value}
      </p>
    </motion.div>
  );
}

function isRarelyUsedApp(app: InstalledApp): boolean {
  if (!app.last_used) return false;
  const sixMonthsAgo = Date.now() / 1000 - 180 * 24 * 3600;
  return app.last_used < sixMonthsAgo;
}

function appToCleanupItems(app: InstalledApp): FileNode[] {
  const appItem: FileNode = {
    name: app.name,
    path: app.path,
    size: app.app_size,
    is_dir: true,
    file_type: 'Application',
    safety_level: 'Review',
    last_modified: app.last_modified,
  };

  const relatedItems: FileNode[] = app.related_files.map((file) => ({
    name: `${app.name} ${file.kind}`,
    path: file.path,
    size: file.size,
    is_dir: true,
    file_type: file.kind === 'Caches' || file.kind === 'Saved State' ? 'Cache' : 'Application',
    safety_level: file.kind === 'Caches' || file.kind === 'Logs' || file.kind === 'Saved State' ? 'Safe' : 'Review',
  }));

  return [appItem, ...relatedItems];
}
