import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Trash,
  ArrowClockwise,
  Spinner,
  CheckCircle,
  Wrench,
} from '@phosphor-icons/react';
import { useDevTools } from '../hooks/use-dev-tools';
import { useCleanupStore } from '../stores/cleanup-store';
import { DevJunkList } from '../components/cleanup/DevJunkList';
import { ConfirmDialog } from '../components/cleanup/ConfirmDialog';
import { openInFinder } from '../services/tauri';
import { formatBytes } from '../lib/format';
import type { FileNode } from '../types';

export default function DevTools() {
  const { items, isScanning, error, scan, totalSize, groupedByType } = useDevTools();

  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (items.length === 0) scan();
  }, []);

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

  const selectGroup = useCallback((paths: string[]) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      paths.forEach((p) => next.add(p));
      return next;
    });
  }, []);

  const selectAllSafe = useCallback(() => {
    const safePaths = items
      .filter((i) => i.safety_level === 'Safe')
      .map((i) => i.path);
    setSelectedPaths(new Set(safePaths));
  }, [items]);

  // Convert DevJunkItems to FileNodes for the confirm dialog
  const selectedItems: FileNode[] = items
    .filter((i) => selectedPaths.has(i.path))
    .map((i) => ({
      name: i.project_name || i.path.split('/').pop() || i.path,
      path: i.path,
      size: i.size,
      is_dir: true,
      file_type: 'DevCache' as const,
      safety_level: i.safety_level,
      last_modified: i.last_modified,
    }));

  const selectedSize = selectedItems.reduce((a, i) => a + i.size, 0);

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
          <h1 className="text-2xl font-bold text-text-primary">Developer Tools</h1>
          <p className="text-sm text-text-secondary mt-1">
            {items.length > 0
              ? `Found ${items.length} items • ${formatBytes(totalSize)} reclaimable`
              : 'Scan for developer-specific junk files'
            }
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
                Clean {formatBytes(selectedSize)}
              </button>
            </>
          )}
          <button
            onClick={selectAllSafe}
            disabled={items.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium text-[#0D9488] bg-[#0D9488]/10 hover:bg-[#0D9488]/20 border border-[#0D9488]/30 transition-all disabled:opacity-40"
          >
            <CheckCircle size={14} />
            Select Safe
          </button>
          <button
            onClick={scan}
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
        <div className="p-4 rounded-2xl glass border-red-500/20 bg-red-500/10">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Loading */}
      {isScanning && items.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex-1 flex flex-col items-center justify-center text-center -mt-12"
        >
          <div className="relative mb-8">
            <motion.div
              className="absolute inset-0 rounded-full bg-gradient-to-br from-[#FF9F0A] to-[#FF2E93] blur-3xl opacity-30"
              animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.4, 0.25] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="relative w-40 h-40 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 159, 10, 0.3) 0%, rgba(255, 46, 147, 0.15) 100%)',
                boxShadow: `
                  inset 0 8px 32px rgba(255, 255, 255, 0.2),
                  inset 0 -8px 32px rgba(0, 0, 0, 0.1),
                  0 20px 60px rgba(255, 159, 10, 0.3),
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
                className="absolute inset-4 rounded-full border-2 border-[#FF9F0A]/30 border-dashed"
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              />
              <motion.div
                className="absolute inset-8 rounded-full border border-[#FF2E93]/40"
                animate={{ rotate: -360 }}
                transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
              />
              <div className="relative z-10 text-[#FF9F0A] drop-shadow-[0_0_15px_rgba(255,159,10,0.5)]">
                <Spinner size={48} className="animate-spin" />
              </div>
            </motion.div>
          </div>

          <h2 className="text-3xl font-semibold text-text-primary mb-3">
            Scanning...
          </h2>
          <p className="text-base text-text-secondary max-w-md leading-relaxed">
            Checking node_modules, Xcode, Docker, and more
          </p>
        </motion.div>
      )}

      {/* Results */}
      {items.length > 0 && (
        <div className="flex-1 flex flex-col min-h-0 space-y-4 mt-6 pb-6">
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-4 shrink-0">
            {[
              { label: 'Total Found', value: formatBytes(totalSize), color: '#6366f1' },
              { label: 'Items', value: items.length.toString(), color: '#8b5cf6' },
              { label: 'Types', value: Object.keys(groupedByType).length.toString(), color: '#ec4899' },
              { label: 'Selected', value: formatBytes(selectedSize), color: '#22c55e' },
            ].map(({ label, value, color }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass rounded-2xl p-5 border border-white/5"
              >
                <p className="text-xs text-white/60">{label}</p>
                <p className="text-xl font-bold mt-1" style={{ color }}>
                  {value}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Junk list */}
          <div className="flex-1 overflow-y-auto pr-2 -mr-2">
            <DevJunkList
              groupedByType={groupedByType}
              selectedPaths={selectedPaths}
              onToggleSelect={toggleSelect}
              onSelectGroup={selectGroup}
              onOpenInFinder={(path) => openInFinder(path)}
            />
          </div>
        </div>
      )}

      {!isScanning && items.length === 0 && !error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex-1 flex flex-col items-center justify-center text-center -mt-12"
        >
          <div className="relative mb-8">
            <motion.div
              className="absolute inset-0 rounded-full bg-gradient-to-br from-[#22C55E] to-[#0D9488] blur-3xl opacity-30"
              animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.4, 0.25] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="relative w-40 h-40 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.3) 0%, rgba(13, 148, 136, 0.15) 100%)',
                boxShadow: `
                  inset 0 8px 32px rgba(255, 255, 255, 0.2),
                  inset 0 -8px 32px rgba(0, 0, 0, 0.1),
                  0 20px 60px rgba(34, 197, 94, 0.3),
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
                className="absolute inset-4 rounded-full border-2 border-[#22C55E]/30 border-dashed"
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              />
              <motion.div
                className="absolute inset-8 rounded-full border border-[#0D9488]/40"
                animate={{ rotate: -360 }}
                transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
              />
              <div className="relative z-10 text-[#22C55E] drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]">
                <CheckCircle size={48} weight="fill" />
              </div>
            </motion.div>
          </div>

          <h2 className="text-3xl font-semibold text-text-primary mb-3">
            All Clean!
          </h2>
          <p className="text-base text-text-secondary max-w-md leading-relaxed mb-10">
            No developer junk was found on your system.
            <br />
            Your dev environment is already optimized!
          </p>

          <motion.button
            onClick={scan}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            className="group relative flex items-center gap-3 px-10 py-4 rounded-full text-lg font-semibold text-white overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #FF9F0A 0%, #FF2E93 100%)',
              boxShadow: '0 8px 32px rgba(255, 159, 10, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
            }}
          >
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
              }}
            />
            <Wrench size={24} weight="fill" className="relative z-10" />
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
          scan(); // Re-scan after cleanup
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </motion.div>
  );
}
