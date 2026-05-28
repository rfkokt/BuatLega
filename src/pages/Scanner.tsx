import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Trash,
  CheckCircle,
  Lightning,
  CaretRight,
  House,
  HardDrives,
  XCircle,
} from '@phosphor-icons/react';
import { useScanStore } from '../stores/scan-store';
import { useCleanupStore } from '../stores/cleanup-store';
import { useScanner } from '../hooks/use-scanner';
import { FileList } from '../components/scanner/FileList';
import { FilterBar } from '../components/scanner/FilterBar';
import { ConfirmDialog } from '../components/cleanup/ConfirmDialog';
import { ScanningPlaceholder } from '../components/scanner/ScanningPlaceholder';
import { GlassIcon } from '../components/ui/GlassIcon';
import { openInFinder } from '../services/tauri';
import { formatBytes } from '../lib/format';
import type { FileNode, FileCategory, SafetyLevel } from '../types';

type SortKey = 'name' | 'size' | 'file_type' | 'safety_level' | 'last_modified';

export default function Scanner() {
  const { scanResult, isScanning, progress, selectedPaths } = useScanStore();
  const { toggleSelected, selectAllSafe, clearSelection } = useScanStore();
  const { scan, cancel } = useScanner();

  // Drill-down state
  const [navStack, setNavStack] = useState<FileNode[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>('size');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [categoryFilter, setCategoryFilter] = useState<FileCategory[]>([]);
  const [safetyFilter, setSafetyFilter] = useState<SafetyLevel[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);

  // Auto remove items from UI when cleanup finishes
  const cleanupResult = useCleanupStore((s) => s.result);
  const prevResultRef = useRef(cleanupResult);
  useEffect(() => {
    if (cleanupResult && cleanupResult !== prevResultRef.current && scanResult) {
      const successfulPaths = cleanupResult.items_deleted > 0 
        ? Array.from(selectedPaths)
        : [];
      
      if (successfulPaths.length > 0) {
        useScanStore.getState().removeItems(successfulPaths);
      }
      clearSelection();
    }
    prevResultRef.current = cleanupResult;
  }, [cleanupResult, scanResult, clearSelection, selectedPaths]);

  // Current view — either root or drilled-down
  const currentNode = navStack.length > 0 ? navStack[navStack.length - 1] : scanResult?.root;
  const currentChildren = currentNode?.children || [];

  const handleSort = useCallback((key: SortKey) => {
    if (key === sortBy) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  }, [sortBy]);

  const handleDrillDown = useCallback((node: FileNode) => {
    if (node.is_dir && node.children) {
      setNavStack((stack) => [...stack, node]);
    }
  }, []);

  const handleBreadcrumbNav = useCallback((index: number) => {
    if (index === -1) {
      setNavStack([]);
    } else {
      setNavStack((stack) => stack.slice(0, index + 1));
    }
  }, []);

  const handleStartScan = async () => {
    try {
      const homeDir = await import('@tauri-apps/api/path')
        .then((m) => m.homeDir())
        .catch(() => '/');
      setNavStack([]);
      scan(homeDir, 3, { forceRefresh: Boolean(scanResult) });
    } catch (e) {
      console.error(e);
    }
  };

  // Filter and sort
  const displayItems = useMemo(() => {
    let items = [...currentChildren];

    if (categoryFilter.length > 0) {
      items = items.filter((i) => i.file_type && categoryFilter.includes(i.file_type as FileCategory));
    }
    if (safetyFilter.length > 0) {
      items = items.filter((i) => i.safety_level && safetyFilter.includes(i.safety_level));
    }

    items.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      if (sortBy === 'safety_level') {
        const order = { Safe: 1, Review: 2, Caution: 3 };
        aVal = order[a.safety_level as keyof typeof order] || 4;
        bVal = order[b.safety_level as keyof typeof order] || 4;
      }

      if (aVal === bVal) return 0;
      if (aVal === undefined) return 1;
      if (bVal === undefined) return -1;

      const factor = sortDir === 'asc' ? 1 : -1;
      return aVal < bVal ? -1 * factor : 1 * factor;
    });

    return items;
  }, [currentChildren, sortBy, sortDir, categoryFilter, safetyFilter]);

  // Selected items list for ConfirmDialog
  const selectedItemsList = useMemo(() => {
    const found: FileNode[] = [];
    const paths = new Set(selectedPaths);
    
    const findNodes = (node: FileNode) => {
      if (paths.has(node.path)) {
        found.push(node);
      }
      if (node.children) {
        node.children.forEach(findNodes);
      }
    };
    
    if (scanResult && scanResult.root) findNodes(scanResult.root);
    return found;
  }, [scanResult, selectedPaths]);

  const totalSelectedSize = useMemo(() => {
    return selectedItemsList.reduce((acc, curr) => acc + curr.size, 0);
  }, [selectedItemsList]);


  if (isScanning && !scanResult) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.15 }}
        className="h-full"
      >
        <ScanningPlaceholder currentPath={progress?.current_path || ''} onCancel={cancel} />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="space-y-6 h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Scanner</h1>
          <p className="text-sm text-text-secondary mt-1">
            {scanResult
              ? `${scanResult.file_count.toLocaleString()} files • ${scanResult.dir_count.toLocaleString()} folders • ${formatBytes(scanResult.total_size)}`
              : 'Scan your disk to analyze storage usage'
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedPaths.size > 0 && (
            <>
              <button
                onClick={clearSelection}
                className="px-3 py-2 rounded-xl text-xs font-medium text-text-secondary hover:text-text-primary bg-bg-secondary hover:bg-bg-secondary transition-all border border-white/5"
              >
                Clear ({selectedPaths.size})
              </button>
              <button
                onClick={() => setShowConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-white bg-gradient-to-r from-caution to-caution/80 hover:opacity-90 transition-opacity shadow-lg shadow-caution/20 border border-caution/50"
              >
                <Trash size={14} />
                Clean {formatBytes(totalSelectedSize)}
              </button>
            </>
          )}
          <button
            onClick={isScanning ? cancel : handleStartScan}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity border shadow-lg ${
              isScanning
                ? 'bg-caution/80 hover:bg-caution border-caution/40 shadow-caution/10'
                : 'bg-accent-secondary/70 hover:bg-accent-secondary/90 border-accent-secondary/30 shadow-accent-secondary/10'
            }`}
          >
            {isScanning ? (
              <>
                <XCircle size={16} />
                Cancel
              </>
            ) : (
              <>
                <Play size={16} weight="fill" />
                {scanResult ? 'Re-scan' : 'Start Scan'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Empty State - Initial View */}
      {!scanResult && !isScanning && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex-1 flex flex-col items-center justify-center text-center -mt-12"
        >
          {/* 3D Glass Icon */}
          <div className="relative mb-8">
            {/* Background glow */}
            <motion.div
              className="absolute inset-0 rounded-full bg-gradient-to-br from-[#0D9488] to-[#00F0FF] blur-3xl opacity-30"
              animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.4, 0.25] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />
            
            {/* Main glass orb */}
            <motion.div
              className="relative w-40 h-40 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.3) 0%, rgba(0, 240, 255, 0.15) 100%)',
                boxShadow: `
                  inset 0 8px 32px rgba(255, 255, 255, 0.2),
                  inset 0 -8px 32px rgba(0, 0, 0, 0.1),
                  0 20px 60px rgba(13, 148, 136, 0.3),
                  0 0 0 1px rgba(255, 255, 255, 0.15)
                `,
                backdropFilter: 'blur(20px)',
              }}
              animate={{ y: [0, -8, 0], rotateX: [0, 3, 0], rotateY: [0, -3, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            >
              {/* Inner reflection */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 50%)',
                  clipPath: 'ellipse(80% 40% at 50% 10%)',
                }}
              />
              
              {/* Scanning rings */}
              <motion.div
                className="absolute inset-4 rounded-full border-2 border-[#00F0FF]/30 border-dashed"
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              />
              <motion.div
                className="absolute inset-8 rounded-full border border-[#0D9488]/40"
                animate={{ rotate: -360 }}
                transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
              />
              
              {/* Center icon */}
              <div className="relative z-10 text-[#00F0FF] drop-shadow-[0_0_15px_rgba(0,240,255,0.5)]">
                <HardDrives size={48} weight="fill" />
              </div>
            </motion.div>
          </div>

          {/* Title & Description */}
          <h2 className="text-3xl font-semibold text-text-primary mb-3">
            Scanner
          </h2>
          <p className="text-base text-text-secondary max-w-md leading-relaxed mb-10">
            Scan your system to analyze storage usage
            <br />
            and reclaim free space.
          </p>

          {/* Scan Button */}
          <motion.button
            onClick={handleStartScan}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            className="group relative flex items-center gap-3 px-10 py-4 rounded-full text-lg font-semibold text-white overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #0D9488 0%, #00F0FF 100%)',
              boxShadow: '0 8px 32px rgba(13, 148, 136, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
            }}
          >
            {/* Button shine effect */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
              }}
            />
            <Play size={24} weight="fill" className="relative z-10" />
            <span className="relative z-10">Scan</span>
          </motion.button>
        </motion.div>
      )}

      {/* Scanning progress */}
      <AnimatePresence>
        {isScanning && progress && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="glass rounded-2xl p-5 border border-white/5 overflow-hidden"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <GlassIcon icon={<Lightning size={24} />} color="indigo" />
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    Deep scanning in progress...
                  </h3>
                  <p className="text-xs text-text-secondary mt-1 font-mono truncate max-w-xl">
                    {progress.current_path}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-accent-primary">
                  {progress.scanned.toLocaleString()} files
                </p>
                <button
                  onClick={cancel}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-caution hover:text-caution/80 transition-colors"
                >
                  <XCircle size={12} />
                  Cancel scan
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      {scanResult && !isScanning && (
        <div className="flex-1 flex flex-col min-h-0 glass rounded-3xl border border-white/5 overflow-hidden">
          {/* Breadcrumbs & Actions */}
          <div className="flex items-center justify-between p-4 border-b border-white/5 shrink-0 bg-white/[0.02]">
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={() => handleBreadcrumbNav(-1)}
                className="text-text-muted hover:text-accent-primary transition-colors flex items-center gap-1"
              >
                <House size={16} />
                <span className="sr-only">Root</span>
              </button>
              {navStack.map((node, idx) => (
                <div key={node.path} className="flex items-center gap-2">
                  <CaretRight size={14} className="text-text-muted" />
                  <button
                    onClick={() => handleBreadcrumbNav(idx)}
                    className="text-text-secondary hover:text-accent-primary transition-colors max-w-[150px] truncate"
                  >
                    {node.name}
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => selectAllSafe(displayItems)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-accent-secondary bg-accent-secondary/10 hover:bg-accent-secondary/20 transition-colors border border-accent-secondary/20"
              >
                <CheckCircle size={14} />
                Select Safe
              </button>
            </div>
          </div>

          <div className="px-4 py-3 border-b border-white/5 shrink-0 bg-white/[0.01]">
            <FilterBar
              categoryFilter={categoryFilter}
              safetyFilter={safetyFilter}
              onCategoryChange={setCategoryFilter}
              onSafetyChange={setSafetyFilter}
            />
          </div>

          <div className="flex-1 overflow-hidden p-2">
            <FileList
              nodes={displayItems}
              selectedPaths={selectedPaths}
              onToggleSelect={toggleSelected}
              onNavigate={handleDrillDown}
              onOpenInFinder={(path) => openInFinder(path)}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={handleSort}
              categoryFilter={categoryFilter}
              safetyFilter={safetyFilter}
            />
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showConfirm}
        items={selectedItemsList}
        totalSize={totalSelectedSize}
        onConfirm={(permanent, cleanablePaths) => {
          setShowConfirm(false);
          useCleanupStore.getState().startCleanup(cleanablePaths ?? Array.from(selectedPaths), permanent);
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </motion.div>
  );
}
