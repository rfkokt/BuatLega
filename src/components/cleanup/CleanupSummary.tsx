import { motion } from 'framer-motion';
import { CheckCircle, X, Warning } from '@phosphor-icons/react';
import type { CleanupResult } from '../../types';
import { formatBytes } from '../../lib/format';

interface CleanupSummaryProps {
  result: CleanupResult;
  onDismiss: () => void;
}

export function CleanupSummary({ result, onDismiss }: CleanupSummaryProps) {
  const hasFailures = result.failed_items.length > 0;
  const movedToTrashOnly = result.trashed_bytes > 0 && result.freed_bytes === 0;
  const resultLabel = movedToTrashOnly
    ? `${formatBytes(result.trashed_bytes)} moved to Trash`
    : `${formatBytes(result.freed_bytes)} freed`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="fixed bottom-6 right-6 z-40 w-80"
    >
      <div className={`rounded-none border shadow-2xl overflow-hidden ${
        hasFailures
          ? 'bg-bg-secondary border-review/20'
          : 'bg-bg-secondary border-safe/20'
      }`}>
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {hasFailures ? (
                <div className="p-2 rounded-none bg-review/15">
                  <Warning size={20} weight="duotone" className="text-review" />
                </div>
              ) : (
                <div className="p-2 rounded-none bg-safe/15">
                  <CheckCircle size={20} weight="duotone" className="text-safe" />
                </div>
              )}
              <div>
                <h3 className="text-sm font-semibold text-text-primary">
                  {hasFailures ? 'Cleanup Completed with Errors' : 'Cleanup Complete!'}
                </h3>
                <p className="text-xl font-bold mt-0.5" style={{ color: hasFailures ? '#f59e0b' : '#22c55e' }}>
                  {resultLabel}
                </p>
              </div>
            </div>
            <button
              onClick={onDismiss}
              className="p-1 rounded-none text-text-muted hover:text-text-primary hover:bg-bg-secondary transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-4 text-xs text-text-muted">
            <span>{result.items_deleted} items cleaned</span>
            {movedToTrashOnly && <span>Empty Trash to reclaim space</span>}
            {hasFailures && (
              <span className="text-review">
                {result.failed_items.length} failed
              </span>
            )}
          </div>

          {hasFailures && (
            <div className="mt-2 max-h-20 overflow-y-auto">
              {result.failed_items.map((item, i) => (
                <p key={i} className="text-xs text-review/80 truncate">
                  {item.path}: {item.reason}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Auto-dismiss progress bar */}
        <motion.div
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: 8, ease: 'linear' }}
          onAnimationComplete={onDismiss}
          className="h-0.5"
          style={{ backgroundColor: hasFailures ? '#f59e0b' : '#22c55e' }}
        />
      </div>
    </motion.div>
  );
}
