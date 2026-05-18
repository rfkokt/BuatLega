import { motion, AnimatePresence } from 'framer-motion';
import { ShieldWarning, ArrowSquareOut, ArrowClockwise, X } from '@phosphor-icons/react';
import { useState } from 'react';
import { openSystemPreferences, restartApp } from '../../services/tauri';

interface FDAModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  onCheckAccess?: () => Promise<boolean>;
}

export function FDAModal({ isOpen, onDismiss, onCheckAccess }: FDAModalProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);

  const handleCheckAccess = async () => {
    if (!onCheckAccess) return;

    setIsChecking(true);
    setCheckFailed(false);

    try {
      const hasAccess = await onCheckAccess();
      if (hasAccess) {
        onDismiss();
      } else {
        setCheckFailed(true);
      }
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onDismiss}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-8"
          >
            <div className="w-full max-w-md rounded-3xl glass border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden bg-[#0A0D15]/80">
              {/* Header */}
              <div className="relative p-6 pb-4">
                <button
                  onClick={onDismiss}
                  className="absolute top-4 right-4 p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X size={16} />
                </button>

                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 rounded-full bg-[#FF9F0A]/20 border border-[#FF9F0A]/30 shadow-[0_0_20px_rgba(255,159,10,0.3)]">
                    <ShieldWarning size={32} weight="duotone" className="text-[#FF9F0A]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      Full Disk Access Required
                    </h2>
                    <p className="text-sm text-white/60 mt-0.5">
                      BuatLega needs permission to scan
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 pb-4">
                <div className="space-y-3 text-sm text-white/70">
                  <p>
                    To scan and clean your entire disk, BuatLega needs <strong className="text-white">Full Disk Access</strong> permission.
                  </p>
                  <p>
                    Without it, many directories (like Library and system caches) will be inaccessible, and your scan results will be incomplete.
                  </p>
                  {checkFailed && (
                    <div className="mt-2 p-3 rounded-xl bg-[#FF9F0A]/10 border border-[#FF9F0A]/20">
                      <p className="text-[#FF9F0A] text-xs mb-2">
                        macOS requires a full restart for permission changes to take effect.
                      </p>
                      <button
                        onClick={() => restartApp().catch(console.error)}
                        className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-full text-xs font-medium text-white bg-[#FF9F0A] hover:bg-[#FF9F0A]/90 transition-all"
                      >
                        <ArrowClockwise size={14} />
                        Restart BuatLega Now
                      </button>
                    </div>
                  )}

                  <div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                    <p className="text-xs text-white/40 font-medium mb-2">HOW TO ENABLE:</p>
                    <ol className="text-xs text-white/60 space-y-1.5 list-decimal list-inside">
                      <li>Open <strong className="text-white">System Settings</strong></li>
                      <li>Go to <strong className="text-white">Privacy & Security</strong></li>
                      <li>Click <strong className="text-white">Full Disk Access</strong></li>
                      <li>Toggle on <strong className="text-white">BuatLega</strong></li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 pt-4 flex gap-3">
                <button
                  onClick={onCheckAccess ? handleCheckAccess : onDismiss}
                  disabled={isChecking}
                  className="flex-1 px-4 py-2.5 rounded-full text-sm font-medium text-white/60 hover:text-white bg-white/5 hover:bg-white/10 transition-all border border-white/10"
                >
                  {isChecking ? 'Checking...' : onCheckAccess ? 'I Enabled It' : 'Later'}
                </button>
                <button
                  onClick={() => {
                    openSystemPreferences().catch(console.error);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium text-white bg-gradient-to-r from-[#0D9488] to-[#0EA5E9] hover:opacity-90 shadow-[0_0_20px_rgba(13,148,136,0.4)] transition-all"
                >
                  <ArrowSquareOut size={16} />
                  Open Settings
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** Persistent banner shown when FDA is not granted and modal is dismissed */
export function FDABanner({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-[#FF9F0A]/10 border border-[#FF9F0A]/20"
    >
      <div className="flex items-center gap-2">
        <ShieldWarning size={16} weight="duotone" className="text-[#FF9F0A] shrink-0" />
        <p className="text-xs text-[#FF9F0A]">
          Full Disk Access not granted — scan results may be incomplete.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onOpenSettings}
          className="text-xs font-medium text-[#FF9F0A] hover:text-[#FF9F0A]/80 transition-colors underline"
        >
          Fix
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-0.5 text-[#FF9F0A]/50 hover:text-[#FF9F0A] transition-colors"
        >
          <X size={12} />
        </button>
      </div>
    </motion.div>
  );
}
