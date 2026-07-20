import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, 
  ArrowUpRight,
  HandPalm,
  Lightning,
  MagnifyingGlass,
  Sparkle
} from '@phosphor-icons/react';
import { SmartCareLogModal } from '../components/smart-care/SmartCareLogModal';
import { useScanStore } from '../stores/scan-store';
import { useScanner } from '../hooks/use-scanner';
import { formatBytes } from '../lib/format';
import { invoke } from '@tauri-apps/api/core';
import { GSAPScanner3D } from '../components/ui/GSAPScanner3D';

interface SystemHealth {
  is_safe: boolean;
  sip_enabled: boolean;
}

type SmartCareState = 'idle' | 'scanning' | 'review' | 'success';

export default function SmartCare() {
  const { scanResult, isScanning, progress, hasCleaned, setHasCleaned } = useScanStore();
  
  const [step, setStep] = useState<SmartCareState>(() => {
    if (isScanning) return 'scanning';
    if (hasCleaned) return 'success';
    if (scanResult) return 'review';
    return 'idle';
  });

  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isSafe, setIsSafe] = useState(true);
  const [appCount, setAppCount] = useState(0);

  const { scan } = useScanner();

  // Handle transitions based on scanning state
  useEffect(() => {
    if (isScanning && step !== 'scanning') {
      setStep('scanning');
    } else if (!isScanning && scanResult && step === 'scanning') {
      setStep('review');
    }
  }, [isScanning, scanResult, step]);

  useEffect(() => {
    // Check system health for Moonlock card
    invoke<SystemHealth>('check_system_health').then(health => {
      setIsSafe(health.is_safe);
    }).catch(console.error);

    // Get app count for Applications card
    invoke<any[]>('list_installed_apps').then(apps => {
      setAppCount(apps.length);
    }).catch(console.error);
  }, []);

  const handleStartScan = async () => {
    setStep('scanning');
    const homeDir = await import('@tauri-apps/api/path')
      .then((m) => m.homeDir())
      .catch(() => '/');
    scan(homeDir, 3);
  };

  const handleRunTasks = () => {
    // Simulate fixing process
    setTimeout(() => {
      setStep('success');
      setHasCleaned(true);
    }, 1000);
  };

  const totalJunk = scanResult ? scanResult.total_size : 0;
  const junkText = totalJunk > 0 ? formatBytes(totalJunk) + ' of junk' : 'Mac is clean';
  const cleanupLabel = totalJunk > 0 ? (step === 'success' ? 'Cleaned' : 'Ready to clean') : 'Cleaned';

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      <AnimatePresence mode="wait">
        
        {/* IDLE STATE */}
        {step === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="flex-1 flex flex-col items-center justify-center relative z-10"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#0D9488]/5 to-[#BF5AF2]/5 pointer-events-none" />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleStartScan}
              className="relative group w-48 h-48 rounded-full flex flex-col items-center justify-center shadow-[0_0_50px_rgba(255,255,255,0.1)] border border-white/20 overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(88,38,154,0.6) 0%, rgba(56,18,103,0.8) 100%)' }}
            >
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-500" />
              <MagnifyingGlass size={48} weight="duotone" className="text-white mb-2" />
              <span className="text-2xl font-semibold text-white tracking-wide">Scan</span>
            </motion.button>
            <p className="mt-8 text-white/60 text-lg font-medium">Click to scan your Mac for junk and threats</p>
          </motion.div>
        )}

        {/* SCANNING STATE */}
        {step === 'scanning' && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="flex-1 flex flex-col items-center justify-center relative z-10"
          >
            <GSAPScanner3D />
            <h2 className="mt-8 text-2xl font-semibold text-white tracking-tight">Scanning your Mac...</h2>
            {progress && (
              <div className="mt-4 flex flex-col items-center gap-2">
                <span className="text-[#00F0FF] font-medium bg-[#00F0FF]/10 px-4 py-1.5 rounded-full border border-[#00F0FF]/20">
                  {progress.scanned.toLocaleString()} files scanned
                </span>
                <p className="text-sm text-white/40 font-mono truncate max-w-md px-4 text-center">
                  {progress.current_path}
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* REVIEW STATE */}
        {step === 'review' && (
          <motion.div
            key="review"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="flex-1 flex flex-col items-center justify-center relative z-10"
          >
            <div className="w-24 h-24 mb-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.3)]">
              <Sparkle size={48} weight="fill" className="text-white" />
            </div>
            <h2 className="text-4xl font-semibold text-white tracking-tight mb-2">Scan Completed</h2>
            <p className="text-xl text-white/80 mb-10">
              Found <span className="text-amber-400 font-bold">{junkText}</span> to clean up.
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleRunTasks}
              className="bg-white text-black px-12 py-4 rounded-full text-xl font-bold shadow-[0_0_40px_rgba(255,255,255,0.4)] hover:shadow-[0_0_60px_rgba(255,255,255,0.6)] transition-shadow"
            >
              Run Tasks
            </motion.button>
            
            <button 
              onClick={() => setIsLogOpen(true)}
              className="mt-8 text-white/50 hover:text-white transition-colors underline underline-offset-4"
            >
              Review details
            </button>
          </motion.div>
        )}

        {/* SUCCESS STATE */}
        {step === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full flex flex-col relative w-full"
          >
            {/* Header */}
            <div className="pt-12 pb-8 flex justify-center">
              <h1 className="text-3xl font-medium text-white tracking-tight">Well done! Your Mac is in great shape!</h1>
            </div>

            {/* Grid Layout */}
            <div className="flex-1 px-8 pb-20 max-w-[1200px] mx-auto w-full">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                
                {/* Card 1: Cleanup */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="col-span-1 glass rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[220px] group border-t border-white/10"
                  style={{ background: 'linear-gradient(135deg, rgba(88,38,154,0.4) 0%, rgba(56,18,103,0.6) 100%)' }}
                >
                  <div className="absolute top-0 right-0 -mr-4 -mt-4 w-32 h-32 bg-green-500/20 rounded-full blur-3xl group-hover:bg-green-500/30 transition-colors"></div>
                  
                  <div className="flex justify-between items-start relative z-10">
                    <span className="text-white/80 font-medium text-sm">Cleanup</span>
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-green-600 shadow-[0_0_20px_rgba(74,222,128,0.4)] flex items-center justify-center opacity-90 border border-white/20">
                       <div className="w-4 h-4 bg-white/40 rounded-full blur-[2px] absolute top-3 right-3"></div>
                       <div className="w-2 h-2 bg-white/60 rounded-full absolute bottom-4 left-4"></div>
                    </div>
                  </div>
                  
                  <div className="relative z-10 mt-12">
                    <h2 className="text-3xl font-semibold text-white tracking-tight mb-2">{junkText}</h2>
                    <div className="flex items-center gap-1.5 text-green-400 font-medium text-sm">
                      <CheckCircle weight="fill" size={16} />
                      <span>{cleanupLabel}</span>
                    </div>
                  </div>
                </motion.div>

                {/* Card 2: Moonlock */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="col-span-1 glass rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[220px] group border-t border-white/10 cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, rgba(88,38,154,0.4) 0%, rgba(56,18,103,0.6) 100%)' }}
                >
                  <div className="absolute top-0 right-0 -mr-4 -mt-4 w-32 h-32 bg-pink-500/20 rounded-full blur-3xl group-hover:bg-pink-500/30 transition-colors"></div>
                  
                  <div className="flex justify-between items-start relative z-10">
                    <div className="flex items-center gap-1 text-white/80 font-medium text-sm hover:text-white transition-colors">
                      <span>Scan deeper with Moonlock</span>
                      <ArrowUpRight size={14} weight="bold" />
                    </div>
                    <div className="w-16 h-16 rounded-[20px] rotate-12 bg-gradient-to-br from-pink-400 to-rose-600 shadow-[0_0_20px_rgba(2fb,113,133,0.4)] flex items-center justify-center opacity-90 border border-white/20">
                       <HandPalm size={32} weight="fill" className="text-white/80" />
                    </div>
                  </div>
                  
                  <div className="relative z-10 mt-12">
                    <h2 className="text-3xl font-semibold text-white tracking-tight mb-2">{isSafe ? 'Your Mac is safe' : 'Check security'}</h2>
                    <p className="text-white/50 font-medium text-sm">{isSafe ? 'No threats to remove' : 'SIP might be disabled'}</p>
                  </div>
                </motion.div>

                {/* Card 3: Performance */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="col-span-1 glass rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[220px] group border-t border-white/10"
                  style={{ background: 'linear-gradient(135deg, rgba(88,38,154,0.4) 0%, rgba(56,18,103,0.6) 100%)' }}
                >
                  <div className="absolute top-0 right-0 -mr-4 -mt-4 w-32 h-32 bg-orange-500/20 rounded-full blur-3xl group-hover:bg-orange-500/30 transition-colors"></div>
                  
                  <div className="flex justify-between items-start relative z-10">
                    <span className="text-white/80 font-medium text-sm">Performance</span>
                    <div className="w-16 h-16 rounded-[20px] -rotate-6 bg-gradient-to-br from-orange-400 to-amber-600 shadow-[0_0_20px_rgba(245,158,11,0.4)] flex items-center justify-center opacity-90 border border-white/20">
                       <Lightning size={32} weight="fill" className="text-white/80" />
                    </div>
                  </div>
                  
                  <div className="relative z-10 mt-12">
                    <h2 className="text-3xl font-semibold text-white tracking-tight mb-2">2 tasks</h2>
                    <div className="flex items-center gap-1.5 text-green-400 font-medium text-sm">
                      <CheckCircle weight="fill" size={16} />
                      <span>Done</span>
                    </div>
                  </div>
                </motion.div>

                {/* Card 4: Applications (Wide) */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="col-span-1 md:col-span-1.5 lg:col-span-1 md:col-start-1 md:col-end-3 glass rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[220px] group border-t border-white/10"
                  style={{ background: 'linear-gradient(135deg, rgba(88,38,154,0.4) 0%, rgba(56,18,103,0.6) 100%)' }}
                >
                  <div className="absolute top-0 right-10 -mr-4 -mt-4 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl group-hover:bg-blue-500/30 transition-colors"></div>
                  
                  <div className="flex justify-between items-start relative z-10">
                    <span className="text-white/80 font-medium text-sm">Applications</span>
                    <div className="w-20 h-20 rounded-3xl rotate-12 bg-gradient-to-br from-blue-400 to-indigo-600 shadow-[0_0_20px_rgba(99,102,241,0.4)] flex items-center justify-center opacity-90 border border-white/20 relative">
                       <div className="absolute flex flex-col gap-1 items-center">
                          <div className="w-6 h-1.5 bg-white/80 rounded-full rotate-45 absolute"></div>
                          <div className="w-6 h-1.5 bg-white/80 rounded-full -rotate-45 absolute"></div>
                       </div>
                       <div className="w-3 h-3 bg-white/40 rounded-full blur-[2px] absolute top-2 right-2"></div>
                    </div>
                  </div>
                  
                  <div className="relative z-10 mt-12">
                    <h2 className="text-3xl font-semibold text-white tracking-tight mb-2">{appCount > 0 ? `${appCount} apps installed` : 'All updated'}</h2>
                    <div className="flex items-center gap-1.5 text-green-400 font-medium text-sm">
                      <CheckCircle weight="fill" size={16} />
                      <span>{appCount > 0 ? 'Monitored' : 'Started'}</span>
                    </div>
                  </div>
                </motion.div>

                {/* Card 5: My Clutter (Wide) */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="col-span-1 md:col-span-1.5 lg:col-span-2 md:col-start-3 md:col-end-4 glass rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[220px] group border-t border-white/10"
                  style={{ background: 'linear-gradient(135deg, rgba(88,38,154,0.4) 0%, rgba(56,18,103,0.6) 100%)' }}
                >
                  <div className="absolute top-0 right-10 -mr-4 -mt-4 w-40 h-40 bg-teal-500/20 rounded-full blur-3xl group-hover:bg-teal-500/30 transition-colors"></div>
                  
                  <div className="flex justify-between items-start relative z-10">
                    <span className="text-white/80 font-medium text-sm">My Clutter</span>
                    <div className="w-20 h-20 rounded-3xl -rotate-12 bg-gradient-to-br from-teal-400 to-emerald-600 shadow-[0_0_20px_rgba(20,184,166,0.4)] flex items-center justify-center opacity-90 border border-white/20">
                       <div className="w-10 h-8 bg-white/20 rounded-lg border border-white/40 absolute -translate-y-2 translate-x-2"></div>
                       <div className="w-10 h-8 bg-white/80 rounded-lg border border-white/40 absolute translate-y-2 -translate-x-2 backdrop-blur-md"></div>
                    </div>
                  </div>
                  
                  <div className="relative z-10 mt-12">
                    <h2 className="text-3xl font-semibold text-white tracking-tight mb-2">88 duplicate downloads</h2>
                    <div className="flex items-center gap-1.5 text-green-400 font-medium text-sm">
                      <CheckCircle weight="fill" size={16} />
                      <span>Removed</span>
                    </div>
                  </div>
                </motion.div>

              </div>
            </div>

            {/* Footer Button */}
            <div className="absolute bottom-8 right-8">
              <button 
                onClick={() => setIsLogOpen(true)}
                className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium px-5 py-2 rounded-[14px] transition-colors shadow-lg backdrop-blur-md active:scale-95"
              >
                View Log
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SmartCareLogModal 
        isOpen={isLogOpen} 
        onClose={() => setIsLogOpen(false)} 
      />
    </div>
  );
}
