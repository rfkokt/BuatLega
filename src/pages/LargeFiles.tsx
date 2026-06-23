import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  File,
  ArrowSquareOut,
  Trash,
  Spinner,
  Lightning,
  CheckCircle,
  CaretDown,
  FunnelSimple,
  Clock,
  Eye,
  EyeSlash,
  FileMagnifyingGlass,
  ArrowCounterClockwise,
} from '@phosphor-icons/react';
import { useLargeFiles } from '../hooks/use-large-files';
import { useCleanupStore } from '../stores/cleanup-store';
import { ConfirmDialog } from '../components/cleanup/ConfirmDialog';
import { addIgnoredPath, listIgnoredPaths, openInFinder, removeIgnoredPath } from '../services/tauri';
import { formatBytes, formatRelativeTime, getCategoryColor } from '../lib/format';
import type { FileNode, IgnoredPath } from '../types';

export default function LargeFiles() {
  const { files, isScanning, error, scan, threshold, setThreshold, thresholds } = useLargeFiles();

  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [showThresholdMenu, setShowThresholdMenu] = useState(false);
  const [ignoredPaths, setIgnoredPaths] = useState<IgnoredPath[]>([]);
  const [showIgnored, setShowIgnored] = useState(false);

  useEffect(() => {
    if (files.length === 0) handleScan();
  }, []);

  useEffect(() => {
    listIgnoredPaths()
      .then(setIgnoredPaths)
      .catch(console.error);
  }, []);

  const isIgnored = useCallback((path: string) => {
    return ignoredPaths.some((entry) => path === entry.path || path.startsWith(`${entry.path}/`));
  }, [ignoredPaths]);

  const visibleFiles = useMemo(() => files.filter((file) => !isIgnored(file.path)), [files, isIgnored]);
  const safeFiles = useMemo(() => {
    return visibleFiles.filter((file) => file.safety_level === 'Safe');
  }, [visibleFiles]);
  const ignoredFiles = useMemo(() => {
    const byPath = new Map(files.map((file) => [file.path, file]));
    return ignoredPaths.map((entry) => ({
      entry,
      file: byPath.get(entry.path),
    }));
  }, [files, ignoredPaths]);

  const scanWithThreshold = useCallback(async (minSizeBytes: number) => {
    setSelectedPaths(new Set());
    const homeDir = await import('@tauri-apps/api/path').then((m) => m.homeDir()).catch(() => '/');
    scan(homeDir, minSizeBytes);
  }, [scan]);

  const handleScan = useCallback(() => {
    scanWithThreshold(threshold);
  }, [scanWithThreshold, threshold]);

  const toggleSelect = useCallback((path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const selectSafe = useCallback(() => {
    setSelectedPaths(new Set(safeFiles.map((file) => file.path)));
  }, [safeFiles]);

  const handleIgnore = useCallback(async (path: string) => {
    const ignored = await addIgnoredPath(path, 'Ignored from Large Files');
    setIgnoredPaths(ignored);
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }, []);

  const handleUnignore = useCallback(async (path: string) => {
    const ignored = await removeIgnoredPath(path);
    setIgnoredPaths(ignored);
    setShowIgnored(false);
    handleScan();
  }, [handleScan]);

  const handleUnignoreAll = useCallback(async () => {
    let ignored = ignoredPaths;
    for (const entry of ignoredPaths) {
      ignored = await removeIgnoredPath(entry.path);
    }
    setIgnoredPaths(ignored);
    setShowIgnored(false);
    handleScan();
  }, [handleScan, ignoredPaths]);

  const selectedItems: FileNode[] = visibleFiles.filter((f) => selectedPaths.has(f.path));
  const selectedSize = selectedItems.reduce((a, i) => a + i.size, 0);

  // Check if file is stale (not accessed in 6+ months, with modified time as fallback)
  const isStale = (lastSeen?: number) => {
    if (!lastSeen) return false;
    const sixMonthsAgo = Date.now() / 1000 - 180 * 24 * 3600;
    return lastSeen < sixMonthsAgo;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Large Files</h1>
          <p className="text-sm text-text-secondary mt-1">
            {files.length > 0
              ? `${visibleFiles.length} files larger than ${formatBytes(threshold)}`
              : `Find files larger than ${formatBytes(threshold)}`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!showIgnored && safeFiles.length > 0 && (
            <button
              onClick={selectSafe}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium text-accent-secondary bg-accent-secondary/10 hover:bg-accent-secondary/20 transition-all border border-accent-secondary/20"
              title={`Select ${safeFiles.length} safe files`}
            >
              <CheckCircle size={14} />
              Select Safe ({safeFiles.length})
            </button>
          )}

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
                Clean {formatBytes(selectedSize)}
              </button>
            </>
          )}

          {/* Threshold selector */}
          {ignoredPaths.length > 0 && (
            <button
              onClick={() => setShowIgnored((value) => !value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium border transition-all ${
                showIgnored
                  ? 'text-[#FF9F0A] bg-[#FF9F0A]/10 border-[#FF9F0A]/30'
                  : 'text-white/70 bg-white/5 hover:bg-white/10 border-white/10'
              }`}
              title={showIgnored ? 'Show large files' : 'Show hidden paths'}
            >
              {showIgnored ? <Eye size={14} /> : <EyeSlash size={14} />}
              Hidden ({ignoredPaths.length})
            </button>
          )}

          {/* Threshold selector */}
          <div className="relative">
            <button
              onClick={() => setShowThresholdMenu(!showThresholdMenu)}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium text-white/80 bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
            >
              <FunnelSimple size={14} />
              Min: {formatBytes(threshold)}
              <CaretDown size={12} />
            </button>
            {showThresholdMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowThresholdMenu(false)} />
                <div className="absolute right-0 top-full mt-2 z-20 w-32 py-2 rounded-2xl glass border border-white/10 shadow-xl overflow-hidden">
                  {thresholds.map(({ label, value }) => (
                    <button
                      key={value}
                      onClick={() => {
                        setThreshold(value);
                        setShowThresholdMenu(false);
                        scanWithThreshold(value);
                      }}
                      className={`w-full px-3 py-2 text-xs text-left transition-colors ${
                        threshold === value
                          ? 'bg-accent-primary/10 text-accent-primary'
                          : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={handleScan}
            disabled={isScanning}
            className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium text-white bg-gradient-to-r from-[#0D9488] to-[#0EA5E9] shadow-[0_0_20px_rgba(13,148,136,0.4)] hover:shadow-[0_0_30px_rgba(13,148,136,0.6)] transition-all disabled:opacity-50"
          >
            {isScanning ? (
              <>
                <Spinner size={16} className="animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Lightning size={16} weight="fill" />
                Scan
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl glass border-red-500/20 bg-red-500/10">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Loading */}
      {isScanning && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex-1 flex flex-col items-center justify-center text-center -mt-12"
        >
          <div className="relative mb-8">
            <motion.div
              className="absolute inset-0 rounded-full bg-gradient-to-br from-[#BF5AF2] to-[#FF2E93] blur-3xl opacity-30"
              animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.4, 0.25] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="relative w-40 h-40 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(191, 90, 242, 0.3) 0%, rgba(255, 46, 147, 0.15) 100%)',
                boxShadow: `
                  inset 0 8px 32px rgba(255, 255, 255, 0.2),
                  inset 0 -8px 32px rgba(0, 0, 0, 0.1),
                  0 20px 60px rgba(191, 90, 242, 0.3),
                  0 0 0 1px rgba(255, 255, 255, 0.15)
                `,
                backdropFilter: 'blur(20px)',
              }}
              animate={{ y: [0, -8, 0], rotateX: [0, 3, 0], rotateY: [0, -3, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 50%)',
                  clipPath: 'ellipse(80% 40% at 50% 10%)',
                }}
              />
              <motion.div
                className="absolute inset-4 rounded-full border-2 border-[#BF5AF2]/30 border-dashed"
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              />
              <motion.div
                className="absolute inset-8 rounded-full border border-[#FF2E93]/40"
                animate={{ rotate: -360 }}
                transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
              />
              <div className="relative z-10 text-[#BF5AF2] drop-shadow-[0_0_15px_rgba(191,90,242,0.5)]">
                <Spinner size={48} className="animate-spin" />
              </div>
            </motion.div>
          </div>

          <h2 className="text-3xl font-semibold text-text-primary mb-3">
            Searching...
          </h2>
          <p className="text-base text-text-secondary max-w-md leading-relaxed">
            Looking for files larger than {formatBytes(threshold)}
          </p>
        </motion.div>
      )}

      {/* Results */}
      {!isScanning && showIgnored && (
        <div className="glass rounded-3xl overflow-hidden border border-white/5 mt-6">
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white/5 border-b border-white/5">
            <div className="flex flex-1 items-center gap-3 text-xs text-white/50 font-medium uppercase tracking-wider">
              <span className="flex-1">Hidden path</span>
              <span className="w-24 text-right">Size</span>
              <span className="w-24">Category</span>
              <div className="w-20" />
            </div>
            {ignoredFiles.length > 0 && (
              <button
                onClick={handleUnignoreAll}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium text-accent-primary bg-accent-primary/10 hover:bg-accent-primary/20 border border-accent-primary/25 transition-all"
                title="Restore all hidden paths to scans"
              >
                <ArrowCounterClockwise size={14} />
                Restore All
              </button>
            )}
          </div>

          <div className="max-h-[65vh] overflow-y-auto">
            {ignoredFiles.length === 0 ? (
              <div className="px-5 py-12 text-center text-text-muted text-sm">
                No hidden paths.
              </div>
            ) : (
              ignoredFiles.map(({ entry, file }) => {
                const catColor = file ? getCategoryColor(file.file_type) : '#8E8E93';
                return (
                  <motion.div
                    key={entry.path}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="group flex items-center gap-3 px-5 py-4 border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <EyeSlash size={14} className="text-[#FF9F0A] shrink-0" />
                        <span className="text-sm text-text-primary truncate">
                          {file?.name ?? entry.path.split('/').pop() ?? entry.path}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted truncate mt-0.5">
                        {entry.path.replace(/^\/Users\/[^/]+\//, '~/')}
                      </p>
                    </div>

                    <span className="w-24 text-right text-sm font-semibold text-text-primary tabular-nums">
                      {file ? formatBytes(file.size) : '—'}
                    </span>

                    <span className="w-24">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-none text-xs"
                        style={{ backgroundColor: `${catColor}15`, color: catColor }}
                      >
                        {file?.file_type ?? 'Hidden'}
                      </span>
                    </span>

                    <div className="w-20 flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleUnignore(entry.path)}
                        className="flex items-center justify-center text-text-muted hover:text-accent-primary transition-colors"
                        title="Restore to scans"
                      >
                        <ArrowCounterClockwise size={15} />
                      </button>
                      <button
                        onClick={() => openInFinder(entry.path)}
                        className="flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                        title="Open in Finder"
                      >
                        <ArrowSquareOut size={14} />
                      </button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      )}

      {!isScanning && !showIgnored && visibleFiles.length > 0 && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl p-5 border border-white/5"
            >
              <p className="text-xs text-white/50">Total Size</p>
              <p className="text-xl font-bold text-[#FF2E93] mt-1">
                {formatBytes(visibleFiles.reduce((a, f) => a + f.size, 0))}
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="glass rounded-2xl p-5 border border-white/5"
            >
              <p className="text-xs text-white/50">Files Found</p>
              <p className="text-xl font-bold text-[#00F0FF] mt-1">{visibleFiles.length}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass rounded-2xl p-5 border border-white/5"
            >
              <p className="text-xs text-white/50">Stale Files</p>
              <p className="text-xl font-bold text-[#FF9F0A] mt-1">
                {visibleFiles.filter((f) => isStale(f.last_accessed ?? f.last_modified)).length}
              </p>
            </motion.div>
          </div>

          {/* File list */}
          <div className="glass rounded-3xl overflow-hidden border border-white/5 mt-4">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white/5 border-b border-white/5 text-xs text-white/50 font-medium uppercase tracking-wider">
              <div className="w-16" />
              <span className="flex-1">File</span>
              <span className="w-24 text-right">Size</span>
              <span className="w-24">Category</span>
              <span className="w-28 text-right">Last Opened</span>
              <div className="w-8" />
            </div>

            {/* Rows */}
            <div className="max-h-[55vh] overflow-y-auto">
              {visibleFiles.map((file, i) => {
                const lastSeen = file.last_accessed ?? file.last_modified;
                const stale = isStale(lastSeen);
                const catColor = getCategoryColor(file.file_type);

                return (
                  <motion.div
                    key={file.path}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    className={`group flex items-center gap-3 px-5 py-4 border-b border-white/5 hover:bg-white/5 transition-colors ${
                      selectedPaths.has(file.path) ? 'bg-[#FF2E93]/10' : ''
                    }`}
                  >
                    <button
                      onClick={() => toggleSelect(file.path)}
                      className="w-8 flex items-center justify-center shrink-0"
                    >
                      <div className={`w-4 h-4 rounded border transition-all ${
                        selectedPaths.has(file.path)
                          ? 'bg-accent-primary border-accent-primary'
                          : 'border-bg-tertiary group-hover:border-bg-tertiary'
                      }`}>
                        {selectedPaths.has(file.path) && (
                          <svg className="w-4 h-4 text-white" viewBox="0 0 16 16" fill="none">
                            <path d="M4 8L7 11L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        )}
                      </div>
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <File size={14} weight="duotone" className="text-text-muted shrink-0" />
                        <span className="text-sm text-text-primary truncate">{file.name}</span>
                        {stale && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-none bg-review/10 text-review text-[10px] font-medium shrink-0">
                            <Clock size={10} />
                            Stale
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-muted truncate mt-0.5">
                        {file.path.replace(/^\/Users\/[^/]+\//, '~/')}
                      </p>
                    </div>

                    <span className="w-24 text-right text-sm font-semibold text-text-primary tabular-nums">
                      {formatBytes(file.size)}
                    </span>

                    <span className="w-24">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-none text-xs"
                        style={{ backgroundColor: `${catColor}15`, color: catColor }}
                      >
                        {file.file_type}
                      </span>
                    </span>

                    <span className="w-28 text-right text-xs text-text-muted tabular-nums">
                      {lastSeen ? formatRelativeTime(lastSeen) : '—'}
                    </span>

                    <div className="w-16 flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleIgnore(file.path)}
                        className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-[#FF9F0A]"
                        title="Hide from future scans"
                      >
                        <EyeSlash size={14} />
                      </button>
                      <button
                        onClick={() => openInFinder(file.path)}
                        className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-text-primary"
                        title="Open in Finder"
                      >
                        <ArrowSquareOut size={14} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!isScanning && !showIgnored && visibleFiles.length === 0 && !error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex-1 flex flex-col items-center justify-center text-center -mt-12"
        >
          <div className="relative mb-8">
            <motion.div
              className="absolute inset-0 rounded-full bg-gradient-to-br from-[#BF5AF2] to-[#00F0FF] blur-3xl opacity-30"
              animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.4, 0.25] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="relative w-40 h-40 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(191, 90, 242, 0.3) 0%, rgba(0, 240, 255, 0.15) 100%)',
                boxShadow: `
                  inset 0 8px 32px rgba(255, 255, 255, 0.2),
                  inset 0 -8px 32px rgba(0, 0, 0, 0.1),
                  0 20px 60px rgba(191, 90, 242, 0.3),
                  0 0 0 1px rgba(255, 255, 255, 0.15)
                `,
                backdropFilter: 'blur(20px)',
              }}
              animate={{ y: [0, -8, 0], rotateX: [0, 3, 0], rotateY: [0, -3, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 50%)',
                  clipPath: 'ellipse(80% 40% at 50% 10%)',
                }}
              />
              <motion.div
                className="absolute inset-4 rounded-full border-2 border-[#BF5AF2]/30 border-dashed"
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              />
              <motion.div
                className="absolute inset-8 rounded-full border border-[#00F0FF]/40"
                animate={{ rotate: -360 }}
                transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
              />
              <div className="relative z-10 text-[#BF5AF2] drop-shadow-[0_0_15px_rgba(191,90,242,0.5)]">
                <FileMagnifyingGlass size={48} weight="fill" />
              </div>
            </motion.div>
          </div>

          <h2 className="text-3xl font-semibold text-text-primary mb-3">
            No Large Files Found
          </h2>
          <p className="text-base text-text-secondary max-w-md leading-relaxed mb-10">
            No files larger than {formatBytes(threshold)} were found.
            <br />
            Try lowering the threshold.
          </p>

          <motion.button
            onClick={handleScan}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            className="group relative flex items-center gap-3 px-10 py-4 rounded-full text-lg font-semibold text-white overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #BF5AF2 0%, #FF2E93 100%)',
              boxShadow: '0 8px 32px rgba(191, 90, 242, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
            }}
          >
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
              }}
            />
            <Lightning size={24} weight="fill" className="relative z-10" />
            <span className="relative z-10">Re-scan</span>
          </motion.button>
        </motion.div>
      )}

      {/* Cleanup confirm */}
      <ConfirmDialog
        isOpen={showConfirm}
        items={selectedItems}
        totalSize={selectedSize}
        onConfirm={async (permanent, cleanablePaths) => {
          const paths = cleanablePaths ?? Array.from(selectedPaths);
          setShowConfirm(false);
          setSelectedPaths(new Set());
          await useCleanupStore.getState().startCleanup(paths, permanent);
          handleScan();
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </motion.div>
  );
}
