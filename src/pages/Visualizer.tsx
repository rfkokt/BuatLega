import { lazy, Suspense, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ChartDonut,
  Lightning,
  Spinner,
  SquaresFour,
} from '@phosphor-icons/react';
import { useScanStore } from '../stores/scan-store';
import { useScanner } from '../hooks/use-scanner';
import { SimpleSummary } from '../components/visualizer/SimpleSummary';
import { Breadcrumbs } from '../components/visualizer/Breadcrumbs';
import { formatBytes } from '../lib/format';
import type { FileNode } from '../types';

const Treemap = lazy(() => import('../components/visualizer/Treemap').then((module) => ({
  default: module.Treemap,
})));

export default function Visualizer() {
  const { scanResult, isScanning, progress } = useScanStore();
  const { scan } = useScanner();

  // Drill-down navigation
  const [navStack, setNavStack] = useState<FileNode[]>([]);
  const [viewMode, setViewMode] = useState<'simple' | 'detailed'>('simple');

  const currentNode = navStack.length > 0
    ? navStack[navStack.length - 1]
    : scanResult?.root;

  const handleDrillDown = useCallback((node: FileNode) => {
    if (node.is_dir && node.children && node.children.length > 0) {
      setNavStack((stack) => [...stack, node]);
    }
  }, []);

  const handleBreadcrumbNav = useCallback((index: number) => {
    if (index === 0) {
      setNavStack([]);
    } else {
      setNavStack((stack) => stack.slice(0, index));
    }
  }, []);

  const handleStartScan = useCallback(async () => {
    setNavStack([]);
    const homeDir = await import('@tauri-apps/api/path').then((m) => m.homeDir()).catch(() => '/');
    scan(homeDir, 5);
  }, [scan]);

  // Build breadcrumb path
  const breadcrumbPath: FileNode[] = [
    ...(scanResult ? [scanResult.root] : []),
    ...navStack,
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="h-full flex flex-col space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">Visualizer</h1>
          <p className="text-sm text-white/60 mt-1">
            {currentNode
              ? `${currentNode.name} — ${formatBytes(currentNode.size)}`
              : 'Interactive treemap of your disk usage'
            }
          </p>
        </div>
        {!scanResult && (
          <button
            onClick={handleStartScan}
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
                <Lightning size={16} weight="fill" />
                Scan to Visualize
              </>
            )}
          </button>
        )}
      </div>

      {/* Scanning progress */}
      {isScanning && progress && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="glass rounded-3xl p-6 border border-white/10 shrink-0 overflow-hidden"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-white flex items-center gap-2">
                <Spinner size={16} className="text-[#00F0FF] animate-spin" />
                Scanning Storage...
              </span>
              <span className="text-sm font-medium text-[#00F0FF]">
                {progress.scanned.toLocaleString()} files
              </span>
            </div>
            
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
              <motion.div
                className="h-full bg-gradient-to-r from-[#0D9488] to-[#00F0FF] shadow-[0_0_10px_rgba(0,240,255,0.5)]"
                animate={{ width: ['0%', '100%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              />
            </div>
            
            <p className="text-xs text-white/40 truncate">
              {progress.current_path}
            </p>
          </div>
        </motion.div>
      )}

      {/* Treemap / Directory List */}
      {scanResult && currentNode && !isScanning && (
        <>
          {/* Breadcrumbs */}
          <div className="shrink-0">
            <Breadcrumbs path={breadcrumbPath} onNavigate={handleBreadcrumbNav} />
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setViewMode('simple')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                viewMode === 'simple'
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:text-white/70'
              }`}
            >
              <ChartDonut size={16} weight="fill" />
              Simple View
            </button>
            <button
              onClick={() => setViewMode('detailed')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                viewMode === 'detailed'
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:text-white/70'
              }`}
            >
              <SquaresFour size={16} weight="fill" />
              Detailed Treemap
            </button>
          </div>

          {/* Content Container */}
          <div className="flex-1 min-h-0 glass rounded-3xl overflow-hidden border border-white/5 p-6">
            {viewMode === 'simple' ? (
              <SimpleSummary
                data={currentNode}
                totalSize={currentNode.size}
              />
            ) : (
              <Suspense
                fallback={
                  <div className="h-full min-h-[400px] flex items-center justify-center">
                    <Spinner size={24} className="animate-spin text-[#00F0FF]" />
                  </div>
                }
              >
                <Treemap
                  data={currentNode}
                  onDrillDown={handleDrillDown}
                />
              </Suspense>
            )}
          </div>

          {/* Info Footer */}
          <div className="flex items-center gap-4 flex-wrap text-xs text-white/40 shrink-0">
            {viewMode === 'detailed' && (
              <span>Click a block to zoom in · Use breadcrumbs to navigate back</span>
            )}
            {viewMode === 'detailed' && <span className="text-white/20">·</span>}
            <span>
              {scanResult.file_count.toLocaleString()} files ·{' '}
              {scanResult.dir_count.toLocaleString()} directories
            </span>
          </div>
        </>
      )}

      {/* Empty state */}
      {!scanResult && !isScanning && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex-1 flex flex-col items-center justify-center text-center -mt-12"
        >
          {/* 3D Glass Icon */}
          <div className="relative mb-8">
            <motion.div
              className="absolute inset-0 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#00F0FF] blur-3xl opacity-30"
              animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.4, 0.25] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="relative w-40 h-40 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(0, 240, 255, 0.15) 100%)',
                boxShadow: `
                  inset 0 8px 32px rgba(255, 255, 255, 0.2),
                  inset 0 -8px 32px rgba(0, 0, 0, 0.1),
                  0 20px 60px rgba(139, 92, 246, 0.3),
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
                className="absolute inset-4 rounded-full border-2 border-[#00F0FF]/30 border-dashed"
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              />
              <motion.div
                className="absolute inset-8 rounded-full border border-[#8B5CF6]/40"
                animate={{ rotate: -360 }}
                transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
              />
              <div className="relative z-10 text-[#00F0FF] drop-shadow-[0_0_15px_rgba(0,240,255,0.5)]">
                <ChartDonut size={48} weight="fill" />
              </div>
            </motion.div>
          </div>

          <h2 className="text-3xl font-semibold text-text-primary mb-3">
            Visualizer
          </h2>
          <p className="text-base text-text-secondary max-w-md leading-relaxed mb-10">
            Run a scan first to see an interactive treemap
            <br />
            visualization of your storage.
          </p>

          <motion.button
            onClick={handleStartScan}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            className="group relative flex items-center gap-3 px-10 py-4 rounded-full text-lg font-semibold text-white overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #8B5CF6 0%, #00F0FF 100%)',
              boxShadow: '0 8px 32px rgba(139, 92, 246, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
            }}
          >
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
              }}
            />
            <Lightning size={24} weight="fill" className="relative z-10" />
            <span className="relative z-10">Scan to Visualize</span>
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
}
