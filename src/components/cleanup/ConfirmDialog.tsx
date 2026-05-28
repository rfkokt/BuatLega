import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Spinner, Trash, Warning, ShieldCheck, X } from '@phosphor-icons/react';
import type { CleanupPreview, FileNode } from '../../types';
import { formatBytes } from '../../lib/format';
import { GSAPCleanup3D } from '../ui/GSAPCleanup3D';
import { previewCleanupItems } from '../../services/tauri';

interface ConfirmDialogProps {
  isOpen: boolean;
  items: FileNode[];
  totalSize: number;
  onConfirm: (permanent: boolean, cleanablePaths?: string[]) => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  items,
  totalSize,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const [isPermanent, setIsPermanent] = useState(false);
  const [preview, setPreview] = useState<CleanupPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const safeItems = items || [];
  const hasCautionItems = safeItems.some((i) => i.safety_level === 'Caution');
  const hasReviewOrCautionItems = safeItems.some((i) => i.safety_level !== 'Safe');
  const canPermanentDelete = !hasReviewOrCautionItems;
  const needsTyping = hasCautionItems || isPermanent;
  const isConfirmEnabled = !needsTyping || confirmText.toUpperCase() === 'DELETE';
  const cleanablePreviewItems = preview?.items.filter((item) => item.status === 'cleanable') || [];
  const skippedPreviewItems = preview?.items.filter((item) => item.status !== 'cleanable') || [];
  const cleanablePaths = cleanablePreviewItems.map((item) => item.path);
  const effectiveTotalSize = preview?.total_reclaimable_bytes ?? totalSize;
  const canSubmit = isConfirmEnabled && !isPreviewing && cleanablePaths.length > 0;

  const safeCount = safeItems.filter((i) => i.safety_level === 'Safe').length;
  const reviewCount = safeItems.filter((i) => i.safety_level === 'Review').length;
  const cautionCount = safeItems.filter((i) => i.safety_level === 'Caution').length;
  const itemByPath = useMemo(
    () => new Map(safeItems.map((item) => [item.path, item])),
    [safeItems],
  );

  useEffect(() => {
    if (!isOpen) {
      setConfirmText('');
      setIsPermanent(false);
      setPreview(null);
      setPreviewError(null);
      return;
    }

    const paths = safeItems.map((item) => item.path);
    if (paths.length === 0) return;

    let cancelled = false;
    setIsPreviewing(true);
    setPreviewError(null);
    previewCleanupItems(paths)
      .then((result) => {
        if (!cancelled) setPreview(result);
      })
      .catch((error) => {
        if (!cancelled) setPreviewError(String(error));
      })
      .finally(() => {
        if (!cancelled) setIsPreviewing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, safeItems]);

  useEffect(() => {
    if (!canPermanentDelete && isPermanent) {
      setIsPermanent(false);
    }
  }, [canPermanentDelete, isPermanent]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-8"
          >
            <div className="w-full max-w-lg rounded-3xl glass border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden bg-[#0A0D15]/80">
              {/* Confirmation State */}
              <>
                  {/* Header */}
                  <div className="p-6 pb-4 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <GSAPCleanup3D isCleaningUp={false} />
                      <div>
                        <h2 className="text-lg font-bold text-white">
                          Confirm Cleanup
                        </h2>
                        <p className="text-sm text-white/60 mt-0.5">
                          {isPreviewing
                            ? 'Checking safety...'
                            : `${(preview?.cleanable_count ?? items.length).toLocaleString()} cleanable items • ${formatBytes(effectiveTotalSize)}`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={onCancel}
                      className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Summary */}
                  <div className="px-6 pb-4">
                  {previewError && (
                    <div className="mb-4 p-3 rounded-2xl bg-[#E11D48]/10 border border-[#E11D48]/20 text-xs text-[#E11D48]">
                      {previewError}
                    </div>
                  )}

                  {isPreviewing && (
                    <div className="mb-4 flex items-center gap-2 p-3 rounded-2xl bg-white/5 border border-white/10 text-xs text-white/60">
                      <Spinner size={14} className="animate-spin" />
                      Validating paths and protected locations
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    {safeCount > 0 && (
                      <div className="flex items-center gap-2 p-3 rounded-2xl bg-[#0D9488]/10 border border-[#0D9488]/20">
                        <ShieldCheck size={16} className="text-[#0D9488]" />
                        <div>
                          <p className="text-xs text-[#0D9488] font-medium">{safeCount} Safe</p>
                        </div>
                      </div>
                    )}
                    {reviewCount > 0 && (
                      <div className="flex items-center gap-2 p-3 rounded-2xl bg-[#FF9F0A]/10 border border-[#FF9F0A]/20">
                        <Warning size={16} className="text-[#FF9F0A]" />
                        <div>
                          <p className="text-xs text-[#FF9F0A] font-medium">{reviewCount} Review</p>
                        </div>
                      </div>
                    )}
                    {cautionCount > 0 && (
                      <div className="flex items-center gap-2 p-3 rounded-2xl bg-[#E11D48]/10 border border-[#E11D48]/20">
                        <Warning size={16} weight="fill" className="text-[#E11D48]" />
                        <div>
                          <p className="text-xs text-[#E11D48] font-medium">{cautionCount} Caution</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {preview && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-2xl bg-[#0D9488]/10 border border-[#0D9488]/20">
                        <p className="text-xs text-[#0D9488] font-medium">
                          {preview.cleanable_count} Will Clean
                        </p>
                        <p className="text-[10px] text-[#0D9488]/70 mt-0.5">
                          {formatBytes(preview.total_reclaimable_bytes)}
                        </p>
                      </div>
                      <div className="p-3 rounded-2xl bg-[#FF9F0A]/10 border border-[#FF9F0A]/20">
                        <p className="text-xs text-[#FF9F0A] font-medium">
                          {preview.skipped_count} Skipped
                        </p>
                        <p className="text-[10px] text-[#FF9F0A]/70 mt-0.5">
                          protected, missing, or nested
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Items list preview */}
                  <div className="mt-4 max-h-40 overflow-y-auto rounded-2xl bg-white/5 border border-white/10">
                    {(preview ? cleanablePreviewItems : items).slice(0, 20).map((previewItem) => {
                      const item = 'status' in previewItem
                        ? itemByPath.get(previewItem.path)
                        : previewItem;
                      const path = item?.path ?? previewItem.path;
                      const name = item?.name ?? path.split('/').pop() ?? path;
                      const size = 'status' in previewItem ? previewItem.size : item?.size ?? 0;
                      const diskLabel = getDiskLabel(path);
                      return (
                        <div
                          key={path}
                          className="flex items-center justify-between px-3 py-2 border-b border-white/5 last:border-0"
                        >
                          <div className="flex-1 min-w-0 mr-2">
                            <span className="text-xs text-white/80 truncate block">
                              {name}
                            </span>
                            <span className="text-[10px] text-white/40 truncate block mt-0.5">
                              {diskLabel} — {shortenPath(path)}
                            </span>
                          </div>
                          <span className="text-xs text-white/40 tabular-nums shrink-0">
                            {formatBytes(size)}
                          </span>
                        </div>
                      );
                    })}
                    {(preview ? cleanablePreviewItems.length : items.length) > 20 && (
                      <div className="px-3 py-2 text-xs text-white/40 text-center">
                        + {(preview ? cleanablePreviewItems.length : items.length) - 20} more items
                      </div>
                    )}
                  </div>

                  {skippedPreviewItems.length > 0 && (
                    <div className="mt-3 max-h-24 overflow-y-auto rounded-2xl bg-[#FF9F0A]/5 border border-[#FF9F0A]/15">
                      {skippedPreviewItems.slice(0, 6).map((item) => (
                        <div key={item.path} className="px-3 py-2 border-b border-[#FF9F0A]/10 last:border-0">
                          <p className="text-xs text-white/60 truncate">{shortenPath(item.path)}</p>
                          <p className="text-[10px] text-[#FF9F0A]/80 truncate mt-0.5">{item.reason || 'Skipped'}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Typing confirmation for irreversible or risky cleanup */}
                  {needsTyping && (
                    <div className="mt-4">
                      <p className="text-xs text-[#E11D48] mb-2 font-medium">
                        {isPermanent
                          ? 'Permanent cleanup cannot be undone. Type DELETE to confirm:'
                          : 'You have caution items. Type DELETE to confirm:'}
                      </p>
                      <input
                        type="text"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="Type DELETE"
                        className="w-full px-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[#E11D48]/50 focus:bg-white/10 transition-colors"
                      />
                    </div>
                  )}

                  <div className="mt-5 pt-4 border-t border-white/10">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center mt-0.5">
                        <input
                          type="checkbox"
                          checked={isPermanent}
                          disabled={!canPermanentDelete}
                          onChange={(e) => setIsPermanent(e.target.checked)}
                          className="peer appearance-none w-4 h-4 border border-white/20 rounded bg-white/5 checked:bg-[#E11D48] checked:border-[#E11D48] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                        <svg className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white group-hover:text-[#FF2E93] transition-colors">
                          Permanently delete items
                        </p>
                        <p className="text-xs text-white/50 mt-0.5">
                          {canPermanentDelete
                            ? 'Bypass Trash and free up space immediately. This action cannot be undone.'
                            : 'Available only when every selected item is marked Safe.'}
                        </p>
                      </div>
                    </label>
                  </div>

                  {!isPermanent && (
                    <p className="mt-3 text-xs text-white/40">
                      Items will be moved to Trash. You can restore them if needed.
                    </p>
                  )}
                </div>

              {/* Footer */}
                <div className="p-6 pt-2 flex gap-3">
                  <button
                    onClick={onCancel}
                    className="flex-1 px-4 py-2.5 rounded-full text-sm font-medium text-white/60 hover:text-white bg-white/5 hover:bg-white/10 transition-all border border-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => onConfirm(isPermanent, cleanablePaths)}
                    disabled={!canSubmit}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium text-white bg-gradient-to-r from-[#E11D48] to-[#FF2E93] hover:opacity-90 shadow-[0_0_20px_rgba(225,29,72,0.4)] transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    <Trash size={16} />
                    Clean {formatBytes(effectiveTotalSize)}
                  </button>
                </div>
                </>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** Determine which disk/volume a path belongs to */
function getDiskLabel(path: string): string {
  if (path.startsWith('/Volumes/')) {
    // External or named volume: /Volumes/External M4/...
    const parts = path.split('/');
    return `💾 ${parts[2]}`;
  }
  // Root disk (Macintosh HD)
  return '💻 Macintosh HD';
}

/** Shorten a file path for display */
function shortenPath(path: string): string {
  // Replace home dir with ~
  const shortened = path.replace(/^\/Users\/[^/]+\//, '~/');
  // If still long, take last 2 segments
  if (shortened.length > 60) {
    const parts = shortened.split('/');
    return '…/' + parts.slice(-2).join('/');
  }
  return shortened;
}
