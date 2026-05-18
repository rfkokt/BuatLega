import { motion, AnimatePresence } from 'framer-motion';
import { Trash, CheckCircle, X, Warning } from '@phosphor-icons/react';
import { useCleanupStore } from '../../stores/cleanup-store';
import { formatBytes } from '../../lib/format';

/**
 * Floating toast shown at the bottom-right of the screen during cleanup.
 * Non-blocking — users can navigate freely while cleanup runs in background.
 */
export function CleanupToast() {
  const { isCleaningUp, progress, result, dismissResult } = useCleanupStore();
  const cleanedLabel = result
    ? result.trashed_bytes > 0 && result.freed_bytes === 0
      ? `${formatBytes(result.trashed_bytes)} moved to Trash`
      : `${formatBytes(result.freed_bytes)} freed`
    : '';

  return (
    <div className="fixed bottom-6 right-6 z-[999] flex flex-col gap-3 items-end">
      <AnimatePresence>
        {/* Active cleanup progress */}
        {isCleaningUp && progress && (
          <motion.div
            key="progress"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="glass rounded-2xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.5)] p-4 w-80"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-full bg-[#E11D48]/20 border border-[#E11D48]/30">
                <Trash size={16} weight="fill" className="text-[#E11D48] animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">Cleaning up...</p>
                <p className="text-xs text-white/50">
                  {progress.completed.toLocaleString()} of {progress.total.toLocaleString()} items
                </p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#E11D48] to-[#FF2E93] rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.round((progress.completed / progress.total) * 100)}%` }}
                transition={{ ease: 'easeOut', duration: 0.3 }}
              />
            </div>
          </motion.div>
        )}

        {/* Cleanup result */}
        {result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="glass rounded-2xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.5)] p-4 w-80"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-[#0D9488]/20 border border-[#0D9488]/30">
                <CheckCircle size={16} weight="fill" className="text-[#0D9488]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">Cleanup Complete</p>
                <p className="text-xs text-white/50">
                  {result.items_deleted} items cleaned · {cleanedLabel}
                </p>
              </div>
              <button
                onClick={dismissResult}
                className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            {result.failed_items.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
                <Warning size={14} className="text-[#FF9F0A] shrink-0" />
                <p className="text-xs text-[#FF9F0A]">
                  {result.failed_items.length} items skipped (protected or in use)
                </p>
              </div>
            )}
            {result.trashed_bytes > 0 && result.freed_bytes === 0 && (
              <p className="mt-3 pt-3 border-t border-white/10 text-xs text-white/45">
                Space is reclaimed after Trash is emptied.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
