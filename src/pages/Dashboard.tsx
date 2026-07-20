import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  HardDrives,
  ArrowClockwise,
  Lightning,
  Wrench,
  FileMagnifyingGlass,
  ChartDonut,
  ArrowRight,
} from '@phosphor-icons/react';
import { useDiskInfo } from '../hooks/use-disk-info';
import { useScanStore } from '../stores/scan-store';
import { useScanner } from '../hooks/use-scanner';
import { CategoryChart } from '../components/scanner/CategoryChart';
import { FDAModal, FDABanner } from '../components/ui/FDAModal';
import { TiltCard } from '../components/ui/TiltCard';
import { GSAPScanner3D } from '../components/ui/GSAPScanner3D';
import { formatBytes, formatPercent } from '../lib/format';

export default function Dashboard() {
  const navigate = useNavigate();
  const { diskInfo, hasFDA, isLoading, refresh, refreshFDA } = useDiskInfo();
  const { scanResult, isScanning, progress } = useScanStore();
  const { scan } = useScanner();

  const [showFDAModal, setShowFDAModal] = useState(false);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const recheckAccess = () => {
      if (document.visibilityState !== 'hidden') {
        refreshFDA().catch(console.error);
      }
    };

    window.addEventListener('focus', recheckAccess);
    document.addEventListener('visibilitychange', recheckAccess);

    return () => {
      window.removeEventListener('focus', recheckAccess);
      document.removeEventListener('visibilitychange', recheckAccess);
    };
  }, [refreshFDA]);

  // Show FDA modal on first load if not granted
  useEffect(() => {
    if (hasFDA === false) {
      setShowFDAModal(true);
    } else if (hasFDA === true) {
      setShowFDAModal(false);
    }
  }, [hasFDA]);

  const handleQuickScan = useCallback(async () => {
    const homeDir = await import('@tauri-apps/api/path')
      .then((m) => m.homeDir())
      .catch(() => '/');
    scan(homeDir, 3);
  }, [scan]);

  const usagePercent = diskInfo
    ? (diskInfo.used_space / diskInfo.total_capacity) * 100
    : 0;

  const usageColor =
    usagePercent > 90 ? '#ef4444' : usagePercent > 70 ? '#f59e0b' : '#22c55e';

  const computedCategories = useMemo(() => {
    if (!scanResult?.root) return {};
    const cats: Record<string, number> = {};
    const walk = (node: typeof scanResult.root) => {
      if (!node.is_dir) {
        const cat = node.file_type || 'Other';
        cats[cat] = (cats[cat] || 0) + node.size;
      }
      node.children?.forEach(walk);
    };
    walk(scanResult.root);
    return cats;
  }, [scanResult]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
          <p className="text-sm text-text-secondary mt-1">
            Storage overview and quick actions
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all duration-300 shadow-md backdrop-blur-md border border-white/10 text-sm disabled:opacity-50"
        >
          <ArrowClockwise size={16} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* FDA Banner */}
      {hasFDA === false && (
        <FDABanner onOpenSettings={() => setShowFDAModal(true)} />
      )}

      {/* Bento Layout Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Main Column (Spans 2 columns on large screens) */}
        <div className="xl:col-span-2 space-y-6 flex flex-col">
          {/* Disk Usage Card */}
          {diskInfo && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.4, type: "spring" }}
            >
              <TiltCard className="glass p-8 text-left w-full block relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="flex items-center gap-5 mb-8 relative z-10">
                  <div className="p-3.5 rounded-2xl bg-white/10 border border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                    <HardDrives size={28} weight="duotone" className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white tracking-tight">System Storage</h2>
                    <p className="text-sm text-white/60 mt-0.5">
                      Macintosh HD
                    </p>
                  </div>
                  <div className="ml-auto flex flex-col items-end">
                    <span
                      className="text-3xl font-bold tracking-tight"
                      style={{ color: usageColor }}
                    >
                      {formatPercent(diskInfo.used_space, diskInfo.total_capacity)}
                    </span>
                    <span className="text-xs text-white/40 uppercase tracking-wider font-semibold mt-1">Used</span>
                  </div>
                </div>

                {/* Layered Usage bar */}
                <div className="relative w-full h-4 bg-black/40 rounded-full overflow-hidden border border-white/5 shadow-inner">
                  {/* Subtle grid/stripe background inside the track */}
                  <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)' }} />
                  
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${usagePercent}%` }}
                    transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute top-0 left-0 h-full rounded-full shadow-[0_0_15px_rgba(0,0,0,0.3)] overflow-hidden"
                    style={{
                      background: `linear-gradient(90deg, ${usageColor}aa, ${usageColor})`,
                    }}
                  >
                     {/* Inner shine */}
                     <div className="absolute top-0 left-0 right-0 h-1/2 bg-white/20 rounded-full" />
                  </motion.div>
                </div>

                <div className="flex justify-between mt-4 text-sm font-medium relative z-10">
                  <span className="text-white/80 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: usageColor }} />
                    {formatBytes(diskInfo.used_space)} used
                  </span>
                  <span className="text-white/60">{formatBytes(diskInfo.available_space)} available</span>
                </div>
              </TiltCard>
            </motion.div>
          )}

          {/* Disk Info loading skeleton */}
          {!diskInfo && isLoading && (
            <div className="glass p-8 animate-pulse rounded-[24px]">
              <div className="flex items-center gap-4 mb-8">
                <div className="h-14 w-14 bg-white/5 rounded-2xl" />
                <div>
                   <div className="h-6 w-32 bg-white/10 rounded mb-2" />
                   <div className="h-4 w-20 bg-white/5 rounded" />
                </div>
              </div>
              <div className="h-4 w-full bg-white/5 rounded-full mb-4" />
              <div className="flex justify-between">
                <div className="h-4 w-24 bg-white/5 rounded" />
                <div className="h-4 w-24 bg-white/5 rounded" />
              </div>
            </div>
          )}

          {/* Scanning progress */}
          <AnimatePresence>
            {isScanning && progress && (
              <motion.div
                initial={{ opacity: 0, height: 0, scale: 0.95 }}
                animate={{ opacity: 1, height: 'auto', scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.95 }}
                transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                className="glass rounded-[24px] p-6 overflow-hidden relative"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#0D9488]/10 to-[#00F0FF]/10 animate-pulse" />
                <div className="flex items-center gap-6 relative z-10">
                  <GSAPScanner3D />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-base font-semibold text-white tracking-wide">
                        Scanning Storage...
                      </span>
                      <span className="text-sm font-bold text-[#00F0FF] bg-[#00F0FF]/10 px-3 py-1 rounded-full border border-[#00F0FF]/20">
                        {progress.scanned.toLocaleString()} files
                      </span>
                    </div>
                    
                    <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden mb-3 border border-white/5 shadow-inner">
                      <motion.div
                        className="h-full bg-gradient-to-r from-[#0D9488] via-[#00F0FF] to-[#0D9488] bg-[length:200%_100%]"
                        animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                      />
                    </div>
                    
                    <p className="text-xs text-white/50 truncate font-mono">
                      {progress.current_path}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Category Breakdown */}
          {scanResult && !isScanning && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <CategoryChart
                categories={computedCategories}
                totalSize={scanResult.total_size}
                onCategoryClick={() => navigate('/scan')}
              />
            </motion.div>
          )}
          
          {/* Scan stats */}
          {scanResult && !isScanning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-4"
            >
              {[
                { label: 'Total Scanned', value: formatBytes(scanResult.total_size), color: '#00F0FF' },
                { label: 'Files', value: scanResult.file_count.toLocaleString(), color: '#BF5AF2' },
                { label: 'Directories', value: scanResult.dir_count.toLocaleString(), color: '#FF2E93' },
                { label: 'Scan Time', value: `${(scanResult.scan_duration_ms / 1000).toFixed(1)}s`, color: '#32D74B' },
              ].map(({ label, value, color }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.35 + i * 0.05, type: "spring" }}
                  className="glass rounded-[20px] p-5 relative overflow-hidden group flex flex-col justify-center"
                >
                  <div className="absolute -inset-2 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <p className="text-xs text-white/50 font-medium uppercase tracking-wider mb-1 relative z-10">{label}</p>
                  <p className="text-xl font-bold tracking-tight relative z-10" style={{ color }}>{value}</p>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Sidebar Column */}
        <div className="xl:col-span-1 space-y-4 flex flex-col">
          {/* Quick Actions Stack */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="flex flex-col gap-4"
          >
            <h3 className="text-sm font-semibold text-white/80 uppercase tracking-widest ml-2 mb-1">Quick Actions</h3>
            
            <button onClick={() => { navigate('/scan'); handleQuickScan(); }} className="w-full text-left glass p-5 flex items-center gap-5 group transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_8px_30px_rgba(13,148,136,0.2)] hover:border-[#0D9488]/40 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#0D9488]/0 via-[#0D9488]/5 to-[#0D9488]/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 group-hover:bg-[#0D9488]/20 group-hover:border-[#0D9488]/50 group-hover:shadow-[0_0_15px_rgba(13,148,136,0.5)] transition-all duration-300 relative z-10">
                <Lightning size={24} weight="duotone" className="text-white/70 group-hover:text-[#00F0FF] transition-colors" />
              </div>
              <div className="relative z-10">
                <h3 className="text-base font-semibold text-white group-hover:text-[#00F0FF] transition-colors">Smart Scan</h3>
                <p className="text-xs text-white/50 mt-0.5">Quickly find junk & caches</p>
              </div>
            </button>

            <button onClick={() => navigate('/dev-tools')} className="w-full text-left glass p-5 flex items-center gap-5 group transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_8px_30px_rgba(255,159,10,0.2)] hover:border-[#FF9F0A]/40 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#FF9F0A]/0 via-[#FF9F0A]/5 to-[#FF9F0A]/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 group-hover:bg-[#FF9F0A]/20 group-hover:border-[#FF9F0A]/50 group-hover:shadow-[0_0_15px_rgba(255,159,10,0.5)] transition-all duration-300 relative z-10">
                <Wrench size={24} weight="duotone" className="text-white/70 group-hover:text-[#FF9F0A] transition-colors" />
              </div>
              <div className="relative z-10">
                <h3 className="text-base font-semibold text-white group-hover:text-[#FF9F0A] transition-colors">Dev Cleanup</h3>
                <p className="text-xs text-white/50 mt-0.5">Clear node_modules & builds</p>
              </div>
            </button>

            <button onClick={() => navigate('/menubar')} className="w-full text-left glass p-5 flex items-center gap-5 group transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_8px_30px_rgba(255,46,147,0.2)] hover:border-[#FF2E93]/40 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#FF2E93]/0 via-[#FF2E93]/5 to-[#FF2E93]/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 group-hover:bg-[#FF2E93]/20 group-hover:border-[#FF2E93]/50 group-hover:shadow-[0_0_15px_rgba(255,46,147,0.5)] transition-all duration-300 relative z-10">
                <HardDrives size={24} weight="duotone" className="text-white/70 group-hover:text-[#FF2E93] transition-colors" />
              </div>
              <div className="relative z-10">
                <h3 className="text-base font-semibold text-white group-hover:text-[#FF2E93] transition-colors">Test Menubar UI</h3>
                <p className="text-xs text-white/50 mt-0.5">View the new toolbar</p>
              </div>
            </button>

            <button onClick={() => navigate('/large-files')} className="w-full text-left glass p-5 flex items-center gap-5 group transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_8px_30px_rgba(191,90,242,0.2)] hover:border-[#BF5AF2]/40 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#BF5AF2]/0 via-[#BF5AF2]/5 to-[#BF5AF2]/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 group-hover:bg-[#BF5AF2]/20 group-hover:border-[#BF5AF2]/50 group-hover:shadow-[0_0_15px_rgba(191,90,242,0.5)] transition-all duration-300 relative z-10">
                <FileMagnifyingGlass size={24} weight="duotone" className="text-white/70 group-hover:text-[#BF5AF2] transition-colors" />
              </div>
              <div className="relative z-10">
                <h3 className="text-base font-semibold text-white group-hover:text-[#BF5AF2] transition-colors">Large Files</h3>
                <p className="text-xs text-white/50 mt-0.5">Find space hoggers &gt; 100MB</p>
              </div>
            </button>
          </motion.div>

          {/* Quick navigation cards (Analysis results) */}
          {scanResult && !isScanning && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col gap-4 mt-2"
            >
              <h3 className="text-sm font-semibold text-white/80 uppercase tracking-widest ml-2 mb-1 mt-4">Analysis Results</h3>
              
              <button
                onClick={() => navigate('/visualize')}
                className="w-full text-left glass p-5 group transition-all duration-300 hover:scale-[1.02] hover:border-[#00F0FF]/40 hover:shadow-[0_8px_30px_rgba(0,240,255,0.15)] relative overflow-hidden"
              >
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#00F0FF]/10 text-[#00F0FF] group-hover:bg-[#00F0FF]/20 transition-colors">
                       <ChartDonut size={20} weight="duotone" />
                    </div>
                    <span className="text-sm font-semibold text-white group-hover:text-[#00F0FF] transition-colors">View Treemap</span>
                  </div>
                  <ArrowRight size={18} className="text-white/30 group-hover:text-[#00F0FF] group-hover:translate-x-1 transition-all" />
                </div>
              </button>

              <button
                onClick={() => navigate('/scan')}
                className="w-full text-left glass p-5 group transition-all duration-300 hover:scale-[1.02] hover:border-[#FF2E93]/40 hover:shadow-[0_8px_30px_rgba(255,46,147,0.15)] relative overflow-hidden"
              >
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#FF2E93]/10 text-[#FF2E93] group-hover:bg-[#FF2E93]/20 transition-colors">
                       <FileMagnifyingGlass size={20} weight="duotone" />
                    </div>
                    <span className="text-sm font-semibold text-white group-hover:text-[#FF2E93] transition-colors">Browse Files</span>
                  </div>
                  <ArrowRight size={18} className="text-white/30 group-hover:text-[#FF2E93] group-hover:translate-x-1 transition-all" />
                </div>
              </button>
            </motion.div>
          )}
        </div>
      </div>

      {/* FDA Modal */}
      <FDAModal
        isOpen={showFDAModal}
        onDismiss={() => setShowFDAModal(false)}
        onCheckAccess={refreshFDA}
      />
    </motion.div>
  );
}
